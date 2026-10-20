import { type Browser, chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch({ headless: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

async function firstChoice(page: Page) {
  await page.goto(`${origin}?seed=1`);
  await page.evaluate(() => {
    const game = (window as unknown as { __murmur: { fast: boolean } }).__murmur;
    game.fast = true;
  });
  await page.locator('#new').click();
  await page.locator('#hush').waitFor();
}

describe('first-minute clarity', () => {
  it('states purpose and influence before play, keeping the biography optional', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(origin);
      const purpose = await page.locator('.title > p').allTextContents();
      expect(purpose.join(' ')).toMatch(/through her week/);
      expect(purpose.join(' ')).toMatch(/words can change her choices/);
      const more = page.locator('.title details');
      expect(await more.getAttribute('open')).toBeNull();
      await more.locator('summary').click();
      expect(await more.innerText()).toContain('She dispatches vans');
      await more.locator('summary').click();
      await firstChoice(page);
      const story = [...purpose, ...(await page.locator('.scene,.pull').allTextContents())].join(' ');
      expect(story.trim().split(/\s+/).length).toBeLessThanOrEqual(40);
    } finally {
      await page.close();
    }
  });

  it('marks every current response with the accent, without accenting the rival', async () => {
    const page = await browser.newPage();
    try {
      await firstChoice(page);
      const colors = await page.locator('.opts').evaluate((el) => {
        const css = getComputedStyle(el);
        return { border: css.borderLeftColor, width: css.borderLeftWidth };
      });
      expect(colors.width).toBe('3px');
      const accent = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = 'var(--rope)';
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
      expect(colors.border).toBe(accent);
      expect(await page.locator('.pull').evaluate((el) => getComputedStyle(el).color)).not.toBe(accent);
      expect(
        await page.locator('.pull').evaluate((el) => Number.parseFloat(getComputedStyle(el).fontSize)),
      ).toBeLessThanOrEqual(24);
      expect(await page.locator('.opt').count()).toBe(2);
      expect(await page.locator('.opt .ink').first().getAttribute('style')).toContain('font-weight:');
    } finally {
      await page.close();
    }
  });

  it.each([
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ])('keeps menu and silence at least 44px and responses visible at $width×$height', async (viewport) => {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    try {
      await firstChoice(page);
      for (const selector of ['#menu', '#hush', '.opt']) {
        for (const target of await page.locator(selector).all()) {
          const box = await target.boundingBox();
          expect(box).not.toBeNull();
          expect(box?.width).toBeGreaterThanOrEqual(44);
          expect(box?.height).toBeGreaterThanOrEqual(44);
          expect(box?.y).toBeGreaterThanOrEqual(0);
          expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
        }
      }
      await page.locator('#menu').click();
      expect(await page.getByRole('dialog', { name: 'The back page' }).isVisible()).toBe(true);
      await page.locator('#bp-close').click();
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.locator('#hush').click();
      expect(await page.locator('.gap').innerText()).toContain('You let her be.');
    } finally {
      await page.close();
    }
  });
});
