import { type Browser, chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { newGame } from '../src/sim/game.ts';

let browser: Browser;
let server: ViteDevServer;
let url: string;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  url = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch({ channel: 'chrome' });
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
it('shows a simple title and menu; lab tools require the explicit flag', async () => {
  const page = await browser.newPage();
  try {
    for (const lab of [false, true]) {
      await page.goto(`${url}?${lab ? 'lab=1&' : ''}seed=19`);
      await page.locator('#new').waitFor();
      expect(await page.locator('#other-ways').count()).toBe(lab ? 1 : 0);
      expect(await page.locator('#fresh-authored').count()).toBe(lab ? 1 : 0);
      expect(await page.evaluate(() => Boolean(window.__murmur))).toBe(lab);
      await page.locator('#menu').click();
      expect(await page.locator('[data-speed]').count()).toBe(lab ? 4 : 0);
      expect(await page.locator('.continuity-panel').count()).toBe(lab ? 1 : 0);
      expect(await page.locator('#passport-export').count()).toBe(lab ? 1 : 0);
      expect(await page.locator('#bp-send').innerText()).toContain('Feedback');
      await page.locator('#bp-send').click();
      expect(await page.locator('#feedback-title').innerText()).toBe('Feedback');
      expect(await page.locator('#feedback-download').count()).toBe(lab ? 1 : 0);
    }
  } finally {
    await page.close();
  }
}, 30000);
for (const [width, height] of [
  [360, 690],
  [820, 1180],
  [1180, 820],
  [1280, 800],
] as const) {
  it(`keeps readable choices within ${width}x${height}`, async () => {
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(`${url}?lab=1`);
      await page.evaluate(() => {
        window.__murmur.fast = true;
        window.__murmur.start(1);
      });
      await page.locator('#hush').waitFor();
      const box = await page.locator('#hush').boundingBox();
      expect(box!.y + box!.height).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      if (width >= 700) {
        expect(
          await page.locator('.scene').evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
        ).toBeGreaterThanOrEqual(18);
        expect((await page.locator('.sheet').boundingBox())!.width).toBeGreaterThan(width * 0.4);
      }
    } finally {
      await page.close();
    }
  });
}
it('starts local development play without making a shared admission', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(url);
    await page.locator('#new').click();
    await page.locator('#hush').waitFor();
    expect(await page.locator('.scene').innerText()).toContain('Her alarm rings');
    await page.locator('#menu').click();
    await page.locator('#bp-new').click();
    expect(await page.locator('#bp-confirm').isVisible()).toBe(true);
    await page.locator('#bp-cancel-new').click();
    expect(await page.locator('#bp-confirm').isVisible()).toBe(false);
  } finally {
    await page.close();
  }
}, 30000);

for (const labMode of [false, true])
  it(`preserves the saved week and explains a failed production admission (${labMode ? 'lab' : 'ordinary'})`, async () => {
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 360, height: 690 } });
    const state = newGame(19, '0.2.1');
    const saved = JSON.stringify({ version: state.version, seed: state.seed, inputs: state.inputs, state });
    try {
      await page.addInitScript((saved) => localStorage.setItem('murmur-save-v1', saved), saved);
      await page.route('https://murmur.adamwhite.work/**', async (route) => {
        const requested = new URL(route.request().url());
        await route.fulfill({
          response: await route.fetch({ url: new URL(requested.pathname + requested.search, url).href }),
        });
      });
      await page.route('https://human.adamwhite.work/**', (route) => route.abort());
      await page.goto(`https://murmur.adamwhite.work/${labMode ? '?lab=1' : ''}`);
      await page.locator('#new').waitFor();
      await page.evaluate(async () => {
        const { shelf } = await new Function('return import("/src/ui/continuity.ts")')();
        Object.defineProperty(shelf, 'enabled', { get: () => true });
        shelf.request = async () => {
          throw new Error('Shelf unavailable. The response was lost.');
        };
      });
      await page.locator('#new').click();
      await page.locator('#confirm-new').click();
      const error = page.locator(labMode ? '.toast' : '.start-error');
      await error.waitFor();
      if (labMode) {
        expect(await error.innerText()).toContain('response was lost');
      } else {
        expect(await error.innerText()).toContain('Your saved week is still here.');
        expect(await page.locator('body').innerText()).not.toMatch(
          /Shelf unavailable|local file|response was lost/,
        );
        expect(await page.locator('#start-retry').isVisible()).toBe(true);
        expect(await page.locator('#start-feedback').isVisible()).toBe(true);
        for (const selector of ['#start-retry', '#start-feedback']) {
          const box = await page.locator(selector).boundingBox();
          expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
        }
        expect(await page.evaluate(() => Boolean(window.__murmur))).toBe(false);
        await page.locator('#start-feedback').click();
        expect(await page.locator('#feedback-title').innerText()).toBe('Feedback');
        await page.locator('#feedback-back').click();
        await page.locator('#start-retry').click();
        await page.locator('#start-retry:not(:disabled)').waitFor();
      }
      expect(await page.locator('#cont').isVisible()).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem('murmur-save-v1'))).toBe(saved);
    } finally {
      await page.close();
    }
  }, 30000);

it('shows the longer response window and explains that Slow changes only gaps', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${url}?lab=1`);
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(19);
    });
    await page.locator('#hush').waitFor();
    expect(await page.locator('#state-words').textContent()).toMatch(/6[34] seconds to answer/);
    await page.locator('#menu').click();
    expect(await page.locator('.menu-speed').textContent()).toContain(
      'Every choice allows 64 seconds. Slow changes only the time between choices.',
    );
  } finally {
    await page.close();
  }
});
