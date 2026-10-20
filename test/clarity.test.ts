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

async function documentTargets(page: Page, height: number) {
  const boxes = [];
  for (const el of await page.locator('button:visible, a:visible, summary:visible').all()) {
    const box = await el.boundingBox();
    expect(box?.width, await el.innerText()).toBeGreaterThanOrEqual(44);
    expect(box?.height, await el.innerText()).toBeGreaterThanOrEqual(44);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
    if (box) boxes.push(box);
  }
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      expect(
        a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
      ).toBe(true);
    }
  }
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
      await page.goto(`${origin}?seed=1`);
      await page.locator('#new').click();
      const gap = await page.locator('.gap').innerText();
      expect(gap).toBe('Her alarm is about to go.');
      await page.locator('#hush').waitFor();
      const story = [...purpose, gap, ...(await page.locator('.scene,.pull').allTextContents())].join(' ');
      expect(story.trim().split(/\s+/).length).toBe(41);
      const instructions = (await page.locator('.caption,.hint').allTextContents()).join(' ');
      expect(instructions.trim().split(/\s+/).length).toBe(23);
    } finally {
      await page.close();
    }
  });

  it.each([360, 320])('preserves context and responses at 200% text and %ipx width', async (width) => {
    const page = await browser.newPage({ viewport: { width, height: 690 }, reducedMotion: 'reduce' });
    try {
      await firstChoice(page);
      await page.evaluate(async () => {
        await document.fonts.ready;
        const elements = [...document.querySelectorAll<HTMLElement>('#app, #app *')];
        const sizes = elements.map((el) => Number.parseFloat(getComputedStyle(el).fontSize));
        elements.forEach((el, i) => {
          el.style.fontSize = `${(sizes[i] ?? 17) * 2}px`;
        });
      });
      expect(await page.locator('.mark').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
      const context = await page.locator('.card-text').boundingBox();
      expect(context?.height).toBeGreaterThan(100);
      for (const selector of ['.scene', '.pull', '.opt .ink', '.opt .lean', '#hush']) {
        for (const el of await page.locator(selector).all()) {
          await el.scrollIntoViewIfNeeded();
          const bounds = await el.boundingBox();
          const card = await page.locator('.card').evaluate((node) => {
            const r = node.getBoundingClientRect();
            return { top: r.top + node.clientTop, bottom: r.top + node.clientTop + node.clientHeight };
          });
          expect(bounds?.y).toBeGreaterThanOrEqual(card.top - 1);
          expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(card.bottom + 1);
          expect(bounds?.y).toBeGreaterThanOrEqual(0);
          expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(691);
          expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
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
      await page.goto(origin);
      await documentTargets(page, viewport.height);
      await firstChoice(page);
      await documentTargets(page, viewport.height);
      for (const selector of ['.scene', '.pull', '#menu', '#hush', '.opt']) {
        for (const target of await page.locator(selector).all()) {
          const box = await target.boundingBox();
          expect(box).not.toBeNull();
          if (!['.scene', '.pull'].includes(selector)) {
            expect(box?.width).toBeGreaterThanOrEqual(44);
            expect(box?.height).toBeGreaterThanOrEqual(44);
          }
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
