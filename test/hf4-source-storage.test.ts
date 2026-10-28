import { createServer } from 'vite';
import { expect, it } from 'vitest';
import { launchBrowser } from './browser.ts';

it('commits one complete browser source value and preserves it after a real transaction abort', async () => {
  const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(server.resolvedUrls!.local[0]!);
    const result = await page.evaluate(async () => {
      // Native browser import must survive Vitest's server-side callback transform.
      const load = new Function('path', 'return import(path)') as (path: string) => Promise<any>;
      const { newGame, cloneState } = await load('/src/sim/game.ts');
      const { compactNotebook } = await load('/src/ui/notebook.ts');
      const { storeSourceArchive, readSourceArchive } = await load('/src/ui/source-archive.ts');
      const { castDigest } = await load('/src/sim/cast-source.ts');
      const notebook = { state: cloneState(newGame(17)) };
      const compact = await compactNotebook(notebook);
      const receipt = await storeSourceArchive('atomic-fixture', compact);
      const before = await readSourceArchive(receipt);
      const proto = IDBDatabase.prototype as any;
      const transaction = proto.transaction;
      let message = '';
      proto.transaction = function (this: IDBDatabase, ...args: any[]) {
        const tx = Reflect.apply(transaction, this, args) as IDBTransaction;
        if (this.name === 'murmur-source-archives' && args[1] === 'readwrite')
          queueMicrotask(() => tx.abort());
        return tx;
      };
      try {
        await storeSourceArchive('atomic-fixture', await compactNotebook({ state: cloneState(newGame(18)) }));
      } catch (e) {
        message = String(e);
      } finally {
        proto.transaction = transaction;
      }
      const after = await readSourceArchive(receipt);
      let oldRefused = false;
      try {
        await readSourceArchive({ format: 'murmur-notebook/1' });
      } catch {
        oldRefused = true;
      }
      return {
        message,
        oldRefused,
        complete: (await castDigest(before)) === (await castDigest(notebook)),
        preserved: (await castDigest(after)) === (await castDigest(before)),
        receipt,
      };
    });
    expect(result.complete).toBe(true);
    expect(result.preserved).toBe(true);
    expect(result.oldRefused).toBe(true);
    expect(result.message).toMatch(/abort|interrupt|could not be saved/i);
    expect(result.receipt.format).toBe('murmur-source-archive-ref/1');
    expect(JSON.stringify(result.receipt).length).toBeLessThan(256);
  } finally {
    await browser.close();
    await server.close();
  }
}, 120000);
