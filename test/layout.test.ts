import { type Browser, chromium } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, expect, it } from 'vitest';

let browser: Browser;
let server: ViteDevServer;
let url: string;
beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  url = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser?.close();
  await server?.close();
});
for (const width of [360, 1280]) {
  it(`keeps answers pinned and reading inside the card at ${width}`, async () => {
    const height = width === 360 ? 690 : 800;
    const page = await browser.newPage({ viewport: { width, height } });
    try {
      await page.goto(url);
      await page.evaluate(() => {
        window.__murmur.fast = true;
        window.__murmur.start(1);
      });
      await page.locator('#hush').waitFor();
      expect(await page.locator('.card-actions').count()).toBe(1);
      const before = await page.locator('#hush').boundingBox();
      await page.locator('.card-text').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      expect(await page.locator('#hush').boundingBox()).toEqual(before);
      expect((before?.y ?? 0) + (before?.height ?? 0)).toBeLessThanOrEqual(height);
      expect(await page.evaluate(() => document.scrollingElement!.scrollHeight)).toBeLessThanOrEqual(height);
      if (width === 360) {
        const journal = await page.locator('#journal').boundingBox();
        expect(journal?.height).toBeGreaterThanOrEqual(64);
        expect(journal?.height).toBeLessThanOrEqual(112);
      } else {
        const journal = await page.locator('#journal').boundingBox();
        const card = await page.locator('.card').boundingBox();
        expect((journal?.x ?? 0) + (journal?.width ?? 0)).toBeLessThanOrEqual(card?.x ?? 0);
      }
    } finally {
      await page.close();
    }
  }, 30000);
}
it('releases feedback and reading holds when returning to the title page', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(url);
    await page.evaluate(() => {
      window.__murmur.fast = true;
      window.__murmur.start(1);
    });
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    await page.locator('#menu').click();
    await page.locator('#bp-title').click();
    await page.locator('#cont').click();
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    expect(await page.locator('.feedback').count()).toBe(1);
  } finally {
    await page.close();
  }
}, 30000);
for (const mode of ['linked', 'off', 'privacy'] as const) {
  it(`sends feedback through the ${mode} consent path and remembers its name`, async () => {
    const page = await browser.newPage();
    try {
      await page.addInitScript((mode) => {
        localStorage.removeItem('hf-lab-recording-off');
        if (mode === 'off') localStorage.setItem('hf-lab-recording-off', '1');
        if (mode === 'privacy') Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
      }, mode);
      await page.goto(url);
      await page.evaluate(async () => {
        const path = '/src/ui/lab.ts';
        const { lab } = await new Function('path', 'return import(path)')(path);
        const calls: unknown[] = [];
        Object.assign(window, { feedbackCalls: calls });
        lab.sendFeedback = async (...args: unknown[]) => {
          calls.push(['feedback', ...args]);
          return 'stub';
        };
        lab.sendRun = async (...args: unknown[]) => {
          calls.push(['run', ...args]);
          return 'stub';
        };
        window.__murmur.fast = true;
        window.__murmur.start(1);
      });
      await page.locator('#menu').click();
      await page.locator('#bp-send').click();
      await page.locator('[data-verdict="keep"]').click();
      await page.locator('#feedback-note').fill('I wanted to read the reply.');
      await page.locator('.feedback-name summary').click();
      await page.locator('#feedback-name').fill('  tester  ');
      expect((await page.locator('#feedback-note').boundingBox())?.height).toBeGreaterThanOrEqual(100);
      if (mode === 'off') {
        expect(await page.locator('#feedback-send').isDisabled()).toBe(true);
        await page.locator('#feedback-toggle input').click();
      }
      if (mode === 'privacy') {
        expect(await page.locator('#feedback-send').isDisabled()).toBe(true);
        await page.locator('#feedback-consent-check').check();
      }
      await page.locator('#feedback-send').click();
      expect(await page.locator('#feedback-status').innerText()).toBe('Sent. Thank you.');
      const calls = await page.evaluate(() => Reflect.get(window, 'feedbackCalls'));
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toBe(mode === 'privacy' ? 'run' : 'feedback');
      const extra = calls[0].at(-1);
      expect(extra.name).toBe('tester');
      expect(mode === 'privacy' ? extra.note : calls[0][1]).toContain('Verdict: keep');
      expect(await page.evaluate(() => localStorage.getItem('hf-lab-feedback-name'))).toBe('tester');
      await page.locator('#feedback-send').click();
      await page.locator('#bp-send').click();
      expect(await page.locator('#feedback-name').inputValue()).toBe('tester');
    } finally {
      await page.close();
    }
  }, 30000);
}
it('offers privacy beside the recording switch and yields journal room before scrolling long text', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 } });
  try {
    await page.goto(`${url}?seed=1`);
    await page.locator('#menu').click();
    expect(await page.locator('.menu-footer').getByRole('link', { name: 'Lab privacy' }).count()).toBe(1);
    await page.locator('#bp-close').click();
    await page.evaluate(() => (window.__murmur.fast = true));
    await page.locator('#other-ways').click();
    await page.locator('#second').click();
    await page.evaluate(() => {
      const g = window.__murmur;
      for (let i = 0; i < 100 && g.view()?.id !== 'bus-10'; i++) {
        if (g.state?.phase === 'evening') g.next();
        else g.skipToCard();
      }
    });
    expect(await page.evaluate(() => window.__murmur.view()?.id)).toBe('bus-10');
    expect((await page.locator('#journal').boundingBox())!.height).toBeLessThan(112);
  } finally {
    await page.close();
  }
}, 30000);
it('refreshes Send when the shared recording preference changes after the form opens', async () => {
  const page = await browser.newPage();
  try {
    await page.addInitScript(() => localStorage.setItem('hf-lab-recording-off', '1'));
    await page.goto(url);
    await page.locator('#menu').click();
    await page.locator('#bp-send').click();
    expect(await page.locator('#feedback-send').isDisabled()).toBe(true);
    await page.evaluate(async () => {
      const { lab } = await new Function('return import("/src/ui/lab.ts")')();
      lab.setEventsOff(false);
    });
    expect(await page.locator('#feedback-send').isDisabled()).toBe(false);
  } finally {
    await page.close();
  }
}, 30000);
