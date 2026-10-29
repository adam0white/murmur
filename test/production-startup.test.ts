/** Actual minified startup/layout only; central services blocked, no profile/shared write or player verdict. */
import { execFileSync } from 'node:child_process';
import { chromium, webkit } from 'playwright';
import { type PreviewServer, preview } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let server: PreviewServer;
let origin: string;
beforeAll(async () => {
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe' });
  server = await preview({ preview: { host: '127.0.0.1', port: 0 } });
  origin = server.resolvedUrls?.local[0] ?? '';
  if (!origin) throw new Error('Preview did not provide a local URL.');
}, 60_000);
afterAll(async () => {
  const httpServer = server?.httpServer;
  if (httpServer)
    await new Promise<void>((resolve, reject) =>
      httpServer.close((error) => (error ? reject(error) : resolve())),
    );
});
for (const engine of [chromium, webkit])
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
    { width: 412, height: 891 },
    { width: 820, height: 1180 },
    { width: 1180, height: 820 },
  ])
    it(`renders the production bundle and recording controls in ${engine.name()} at ${viewport.width}×${viewport.height}`, async () => {
      const browser = await engine.launch();
      try {
        const context = await browser.newContext({ viewport, extraHTTPHeaders: { DNT: '1' } });
        await context.route('https://human.adamwhite.work/**', (route) => route.abort());
        const page = await context.newPage();
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(origin);
        await expect(page.locator('body').innerText()).resolves.toContain('Two Voices');
        await expect(page.locator('body').innerText()).resolves.toContain('We record and link play');
        const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        expect(await overflow()).toBe(false);
        await page.locator('#menu').click();
        await expect(page.locator('body').innerText()).resolves.toContain('Recording');
        expect(await overflow()).toBe(false);
        await page.locator('#bp-close').click();
        await page.getByRole('button', { name: 'Start', exact: true }).click();
        await page.locator('#hush').waitFor({ timeout: 30_000 });
        expect(await page.evaluate(() => window.__murmur.state?.version)).toBe('0.9.0');
        expect(await overflow()).toBe(false);
        for (const selector of ['#menu', '#hush']) {
          const box = await page.locator(selector).boundingBox();
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
        }
        expect(errors).toEqual([]);
        await context.close();
      } finally {
        await browser.close();
      }
    }, 60_000);

/** Synthetic linked receipts exercise the two actual production getters; nothing reaches the lab service. */
it('sends complete in-progress native notebooks through automatic recording and explicit Feedback', async () => {
  const { gunzipSync } = await import('node:zlib');
  const { expandNotebook } = await import('../src/ui/notebook.ts');
  const { cloneState, replay, restoreState, step } = await import('../src/sim/game.ts');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const records: {
      id: string;
      kind: string;
      data: { upload: string; index: number; total: number; text: string };
    }[] = [];
    // A reserved synthetic HTTPS origin makes normal recording eligible without changing the client.
    await context.route('https://murmur.fixture/**', async (route) => {
      const url = new URL(route.request().url());
      const response = await route.fetch({ url: `${origin}${url.pathname}${url.search}` });
      await route.fulfill({ response });
    });
    await context.route('https://human.adamwhite.work/**', async (route) => {
      const request = route.request();
      if (request.method() === 'OPTIONS') {
        await route.fulfill({
          status: 204,
          headers: {
            'access-control-allow-origin': '*',
            'access-control-allow-headers': '*',
            'access-control-allow-methods': 'POST',
          },
        });
      } else if (request.url().endsWith('/lab/api/linked') && request.postDataBuffer()) {
        const record = JSON.parse(gunzipSync(request.postDataBuffer()!).toString());
        records.push(record);
        await route.fulfill({
          json: { ok: true, id: record.id },
          headers: { 'access-control-allow-origin': '*' },
        });
      } else await route.abort();
    });
    const page = await context.newPage();
    await page.clock.install();
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('https://murmur.fixture/');
    await page.evaluate(async () => {
      await window.__murmur.ready;
      window.__murmur.fast = true;
      window.__murmur.start(17);
    });
    await page.locator('#hush').waitFor();
    const expected = async () => {
      const wasOpen = await page.locator('#bp-export').count();
      if (!wasOpen) await page.locator('#menu').click();
      const pending = page.waitForEvent('download');
      await page.locator('#bp-export').click();
      const download = await pending;
      const stream = await download.createReadStream();
      if (!stream) throw new Error('No native file stream');
      const bytes: Buffer[] = [];
      for await (const chunk of stream) bytes.push(Buffer.from(chunk));
      const value = JSON.parse(Buffer.concat(bytes).toString());
      await download.delete();
      if (!wasOpen) await page.locator('#bp-close').click();
      return value.state as import('../src/sim/types.ts').GameStateSnapshot;
    };
    await page.evaluate(() => window.__murmur.flushSave());
    const saved = (
      await expandNotebook(await page.evaluate(() => JSON.parse(localStorage.getItem('murmur-save-v1')!)))
    ).state;
    await expect
      .poll(() => {
        const pieces = records.filter((r) => r.kind === 'save');
        return pieces.length > 0 && pieces.length === pieces[0]!.data.total;
      })
      .toBe(true);
    const savePieces = records.filter((r) => r.kind === 'save');
    const savePayload = JSON.parse(
      savePieces
        .sort((a, b) => a.data.index - b.data.index)
        .map((r) => r.data.text)
        .join(''),
    );
    expect(savePayload.format).toBe('murmur-notebook/1');
    expect((await expandNotebook(savePayload)).state).toEqual(saved);
    const automatic = await expected();
    await page.clock.runFor(60_100);
    await expect.poll(() => records.filter((r) => r.kind === 'run').length).toBeGreaterThan(0);
    const notebookFor = async (state: typeof automatic) => {
      const groups = new Map<string, typeof records>();
      for (const record of records.filter((r) => r.kind === 'run')) {
        const group = groups.get(record.data.upload) ?? [];
        if (!group.some((r) => r.data.index === record.data.index)) group.push(record);
        groups.set(record.data.upload, group);
      }
      for (const group of groups.values()) {
        if (group.length !== group[0]!.data.total) continue;
        const packed = JSON.parse(
          group
            .sort((a, b) => a.data.index - b.data.index)
            .map((r) => r.data.text)
            .join(''),
        );
        const expanded = await expandNotebook(packed);
        if (JSON.stringify(expanded.state) === JSON.stringify(state)) return expanded;
      }
      throw new Error('No complete matching notebook reached the synthetic transport');
    };
    expect((await notebookFor(automatic)).state).toEqual(automatic);
    await page.evaluate(() => window.__murmur.quiet());
    await page.waitForFunction(() => Boolean(window.__murmur.state?.inputs.length));
    await page.locator('#menu').click();
    const manual = await expected();
    await page.locator('#bp-send').click();
    await page.locator('#feedback-note').fill('Synthetic production transport control');
    await page.locator('#feedback-send').click();
    await page.waitForFunction(() =>
      document.querySelector('#feedback-status')?.textContent?.includes('Your note is stored'),
    );
    const sent = (await notebookFor(manual)).state;
    expect(sent).toEqual(manual);
    const cold = restoreState(sent);
    const rebuilt = replay(
      sent.seed,
      sent.inputs,
      sent.minute,
      sent.version,
      sent.castChapter,
      sent.plainEnglish,
    );
    expect(cloneState(rebuilt)).toEqual(sent);
    step(cold);
    step(rebuilt);
    expect(cloneState(cold)).toEqual(cloneState(rebuilt));
    expect(errors).toEqual([]);
    await context.close();
  } finally {
    await browser.close();
  }
}, 60_000);

/** Public alternate starts only; no historical fixture or implied full-campaign/owner acceptance. */
it('starts each current optional route through its public title checkbox', async () => {
  const browser = await chromium.launch();
  try {
    for (const [selector, edition] of [
      ['#next-edition', '0.9.1'],
      ['#outcomes-edition', '0.9.2'],
    ]) {
      const context = await browser.newContext({
        viewport: { width: 360, height: 690 },
        extraHTTPHeaders: { DNT: '1' },
      });
      await context.route('https://human.adamwhite.work/**', (route) => route.abort());
      const page = await context.newPage();
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(origin);
      await page.locator(selector!).check();
      await page.getByRole('button', { name: 'Start', exact: true }).click();
      await page.locator('#hush').waitFor({ timeout: 30_000 });
      expect(await page.evaluate(() => window.__murmur.state?.version)).toBe(edition);
      expect(errors).toEqual([]);
      await context.close();
    }
  } finally {
    await browser.close();
  }
}, 60_000);
