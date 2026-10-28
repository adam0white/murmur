/** Opt-in actual full-run artifact proof. Local source custody is tested with an explicitly rejected transport. */
import { appendFileSync, readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { launchBrowser } from './browser.ts';

const artifact = process.env.MURMUR_FULL_NOTEBOOK;
function progress(value: unknown) {
  const line = JSON.stringify(value);
  if (process.env.MURMUR_BROWSER_PROGRESS) appendFileSync(process.env.MURMUR_BROWSER_PROGRESS, `${line}\n`);
  console.log(line);
}
for (const viewport of [
  { width: 360, height: 690 },
  { width: 1280, height: 800 },
])
  it.skipIf(!artifact)(
    `cold resumes the full artifact and retains source custody at ${viewport.width}×${viewport.height}`,
    async () => {
      const state = JSON.parse(readFileSync(artifact!, 'utf8'));
      expect(state.phase).toBe('end');
      const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
      await server.listen();
      const browser = await launchBrowser();
      try {
        const page = await browser.newPage({ viewport });
        page.setDefaultTimeout(600000);
        await page.exposeFunction('__fullProofProgress', (stage: string) =>
          progress({ stage, clock: new Date().toISOString(), viewport }),
        );
        const errors: string[] = [];
        page.on('pageerror', (e) => {
          errors.push(e.message);
          progress({
            stage: 'browser-page-error',
            clock: new Date().toISOString(),
            viewport,
            message: e.message,
          });
        });
        page.on('crash', () =>
          progress({ stage: 'browser-page-crash', clock: new Date().toISOString(), viewport }),
        );
        progress({
          stage: 'browser-import',
          clock: new Date().toISOString(),
          viewport,
          artifactBytes: JSON.stringify(state).length,
        });
        await page.goto(server.resolvedUrls!.local[0]!);
        await page.locator('#menu').click();
        await page.getByText('Debug', { exact: true }).click();
        await page.locator('#file').setInputFiles({
          name: 'full-run.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({
              game: 'murmur',
              version: state.version,
              seed: state.seed,
              inputs: state.inputs,
              state,
            }),
          ),
        });
        await page.waitForFunction(
          (day) => window.__murmur.state?.day === day && window.__murmur.state?.phase === 'end',
          state.day,
          { timeout: 600000 },
        );
        await page.evaluate(() => window.__murmur.flushSave());
        const before = await page.evaluate(() => ({
          day: window.__murmur.state!.day,
          phase: window.__murmur.state!.phase,
          inputs: window.__murmur.state!.inputs.length,
          file: window.__murmur.state!.fileHistory,
          scope: window.__murmur.state!.castScope,
          saved: localStorage.getItem('murmur-save-v1')!,
        }));
        expect(before.file).toBe(true);
        expect(before.scope).toBe('file');
        expect(JSON.parse(before.saved).format).toBe('murmur-notebook/1');
        progress({
          stage: 'browser-reload',
          clock: new Date().toISOString(),
          viewport,
          savedCharacters: before.saved.length,
        });
        await page.reload();
        await page.locator('#cont').click();
        await page.waitForFunction(
          (day) => window.__murmur.state?.day === day && window.__murmur.state?.phase === 'end',
          state.day,
          { timeout: 600000 },
        );
        progress({ stage: 'browser-source-custody', clock: new Date().toISOString(), viewport });
        const custody = await page.evaluate(async (testAbort) => {
          // The fixture remains a file. No head is owned or accepted by this check.
          const dynamicImport = new Function('path', 'return import(path)') as (path: string) => Promise<any>;
          const { cloneState, fingerprint } = await dynamicImport('/src/sim/game.ts');
          const { readSourceArchive } = await dynamicImport('/src/ui/source-archive.ts');
          const { castDigest } = await dynamicImport('/src/sim/cast-source.ts');
          const { saveCastPerson } = await dynamicImport('/src/ui/cast-chapter.ts');
          const { shelf } = await dynamicImport('/src/ui/continuity.ts');
          const emit = (stage: string) =>
            (
              window as unknown as { __fullProofProgress: (stage: string) => Promise<void> }
            ).__fullProofProgress(stage);
          const s = window.__murmur.state!;
          const prior = fingerprint(s);
          const saveBefore = localStorage.getItem('murmur-save-v1');
          let quotaProbe = 'accepted';
          try {
            localStorage.setItem('murmur-quota-probe', saveBefore!);
          } catch (e) {
            quotaProbe = e instanceof DOMException ? e.name : String(e);
          } finally {
            localStorage.removeItem('murmur-quota-probe');
          }
          await emit(`browser-quota-probe:${quotaProbe}`);
          const original = shelf.request;
          let requests = 0,
            message = '';
          shelf.request = async () => {
            requests++;
            throw new Error('controlled publication rejection');
          };
          try {
            await emit('browser-source-request');
            await saveCastPerson(s, 'aylin', () => {}, { fork: true });
          } catch (e) {
            message = String(e);
          } finally {
            shelf.request = original;
          }
          const keys = Object.keys(localStorage).filter((k) => k.startsWith('murmur-cast-source:'));
          if (keys.length !== 1)
            throw new Error(
              `Source save failed before custody: ${message}. Expected one complete source archive, got${keys.length}`,
            );
          const key = keys[0]!;
          const raw = localStorage.getItem(key)!;
          await emit('browser-source-committed');
          const archive = await readSourceArchive(JSON.parse(raw));
          const source = archive.state;
          const actual = cloneState(s);
          let abortResult = null;
          if (testAbort) {
            await emit('browser-forced-abort-start');
            const proto = IDBDatabase.prototype as any;
            const transaction = proto.transaction;
            let abortRequests = 0,
              abortMessage = '';
            proto.transaction = function (this: IDBDatabase, ...args: any[]) {
              const tx = Reflect.apply(transaction, this, args) as IDBTransaction;
              if (this.name === 'murmur-source-archives' && args[1] === 'readwrite')
                queueMicrotask(() => tx.abort());
              return tx;
            };
            shelf.request = async () => {
              abortRequests++;
              throw new Error('Publication must not run after storage abort');
            };
            try {
              await saveCastPerson(s, 'aylin', () => {}, { fork: true });
            } catch (e) {
              abortMessage = String(e);
            } finally {
              proto.transaction = transaction;
              shelf.request = original;
            }
            await emit('browser-forced-abort-complete');
            const retained = await readSourceArchive(JSON.parse(raw));
            abortResult = {
              requests: abortRequests,
              message: abortMessage,
              receiptCount: Object.keys(localStorage).filter((k) => k.startsWith('murmur-cast-source:'))
                .length,
              sourcePreserved: (await castDigest(retained.state)) === (await castDigest(source)),
              savePreserved: localStorage.getItem('murmur-save-v1') === saveBefore,
            };
          }
          return {
            quotaProbe,
            abortResult,
            requests,
            message,
            archiveKey: key,
            archiveBytes: raw.length,
            archiveHash: source.hf.run.hashes.full,
            currentHash: actual.hf.run.hashes.full,
            fullSourceMatches: (await castDigest(source)) === (await castDigest(actual)),
            stateUnchanged: fingerprint(s) === prior,
            scope: s.castScope,
            file: s.fileHistory,
            headCount: Object.keys(s.castHeads ?? {}).length,
          };
        }, viewport.width === 360);
        expect(custody.message).toContain('controlled publication rejection');
        expect(custody.requests).toBe(1);
        if (viewport.width === 360) {
          expect(custody.abortResult?.requests).toBe(0);
          expect(custody.abortResult?.message).toMatch(/abort|interrupt|could not be saved/i);
          expect(custody.abortResult?.receiptCount).toBe(1);
          expect(custody.abortResult?.sourcePreserved).toBe(true);
          expect(custody.abortResult?.savePreserved).toBe(true);
        }
        expect(custody.archiveHash).toBe(state.hf.run.hashes.full);
        expect(custody.archiveHash).toBe(custody.currentHash);
        expect(custody.fullSourceMatches).toBe(true);
        expect(custody.stateUnchanged).toBe(true);
        expect(custody.scope).toBe('file');
        expect(custody.file).toBe(true);
        expect(custody.headCount).toBe(0);
        expect(errors).toEqual([]);
        progress({
          viewport,
          day: before.day,
          phase: before.phase,
          inputs: before.inputs,
          savedCharacters: before.saved.length,
          ...custody,
        });
      } finally {
        await browser.close();
        await server.close();
      }
    },
    900000,
  );
