import { mkdir } from 'node:fs/promises';
import { type Browser, chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { playedFirstWeek } from '../src/sim/firstweek.ts';
import { anotherWeek, cloneState, newGame, queueInput, replay, runToCard, step } from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import type { tester } from '../src/ui/app.ts';

declare global {
  interface Window {
    __murmur: typeof tester;
  }
}

/** Set MURMUR_SHOTS to a directory to keep screenshots; otherwise none are written. */
const shots = process.env.MURMUR_SHOTS;
let server: ViteDevServer;
let browser: Browser;
let origin: string;

function finish(s: GameState) {
  while (s.phase !== 'end') {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
      else if (s.phase === 'day') step(s);
    }
  }
  return s;
}

beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch({ headless: true });
  if (shots) await mkdir(shots, { recursive: true });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 30_000);

async function importRun(page: Page, state: GameState) {
  await page.goto(origin);
  await page.evaluate(() => {
    window.__murmur.fast = true;
  });
  await page.locator('#file').setInputFiles({
    name: 'run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({
        version: state.version,
        seed: state.seed,
        inputs: state.inputs,
        state: cloneState(state),
      }),
    ),
  });
  await page.locator('.toast').waitFor();
  expect(await page.locator('.toast').innerText()).toBe('Replayed. It matches the file.');
}

async function snapshot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
}

describe('a played first week', () => {
  it.each([1, 42, 1003])(
    'plays and replays seed %i through the normal inputs',
    (seed) => {
      const s = playedFirstWeek(seed);
      expect(s.version).toBe('0.4.2');
      expect(s.phase).toBe('end');
      expect(s.day).toBe(6);
      expect(s.inputs.some((i) => i.kind === 'say' && i.insist)).toBe(false);
      const again = replay(seed, s.inputs, s.minute, '0.4.2');
      // The last answer can end the day on its own minute; finish that day as anotherWeek does.
      while (again.phase === 'day') step(again);
      expect(cloneState(again)).toEqual(cloneState(s));
      const next = anotherWeek(s);
      expect(next.day).toBe(8);
      expect(next.phase).toBe('day');
      expect(next.past).toHaveLength(1);
    },
    30_000,
  );
});

describe('second week browser flow', { timeout: 60_000 }, () => {
  for (const viewport of [
    { width: 360, height: 690 },
    { width: 412, height: 891 },
    { width: 1280, height: 800 },
  ]) {
    const size = viewport.width < 500 ? `phone-${viewport.width}` : 'desktop';
    it(`continues the same Dilan and shows a readable Monday on ${size}`, async () => {
      const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
      try {
        const state = playedFirstWeek(42);
        const canon = structuredClone(state.final);
        await importRun(page, state);
        expect(await page.getByRole('button', { name: 'Another week', exact: true }).count()).toBe(1);
        expect(await page.getByRole('button', { name: 'Start over', exact: true }).count()).toBe(1);
        await snapshot(page, `week-one-ending-${size}`);
        await page.getByRole('button', { name: 'Another week', exact: true }).click();
        await page.locator('#hush').waitFor();
        expect(await page.locator('body').innerText()).toContain('second week');
        expect(await page.locator('.top').innerText()).toMatch(/Mon/);
        await page.evaluate(() => document.fonts.ready);
        expect(await page.locator('.top .week-label').isVisible()).toBe(true);
        expect(
          await page.locator('.top .mark').evaluate((el) => {
            const range = document.createRange();
            range.selectNodeContents(el);
            return range.getClientRects().length;
          }),
        ).toBe(1);
        for (const selector of ['.top .mark', '.top .week-label']) {
          const label = page.locator(selector);
          if (!(await label.isVisible())) continue;
          expect(await label.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), selector).toBe(true);
          const bounds = await label.boundingBox();
          expect(bounds?.x).toBeGreaterThanOrEqual(0);
          expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(viewport.width);
        }
        expect(await page.evaluate(() => window.__murmur.state?.past?.[0])).toEqual(canon);
        const card = await page.locator('.card').boundingBox();
        expect(card?.y).toBeGreaterThanOrEqual(0);
        expect((card?.y ?? 0) + (card?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
        expect(await page.locator('.card').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(
          true,
        );
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        await snapshot(page, `week-two-monday-${size}`);
        await page.getByRole('button', { name: 'Game menu', exact: true }).click();
        const pending = page.waitForEvent('download');
        await page.locator('#bp-export').click();
        expect((await pending).suggestedFilename()).toBe('two-voices-42-week2-monday.json');
        await page.locator('#bp-close').click();
        await page.reload();
        await page.locator('#cont').click();
        await page.locator('#hush').waitFor();
        expect(await page.evaluate(() => window.__murmur.state?.day)).toBe(8);
        expect(await page.locator('body').innerText()).toContain('second week');
      } finally {
        await page.close();
      }
    });

    it(`offers a played first week from the cover on ${size}`, async () => {
      const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
      try {
        await page.goto(`${origin}?seed=1003`);
        await page.getByRole('button', { name: 'Begin at the second week', exact: true }).click();
        // Straight to Monday of the second week: no recap page of answers the player never gave.
        await page.locator('#hush').waitFor();
        expect(await page.evaluate(() => window.__murmur.state?.seed)).toBe(1003);
        expect(await page.evaluate(() => window.__murmur.state?.past?.length)).toBe(1);
        expect(await page.evaluate(() => window.__murmur.state?.day)).toBe(8);
        expect(await page.locator('body').innerText()).toContain('second week');
      } finally {
        await page.close();
      }
    });

    it(`renders both weeks and no empty voice note on ${size}`, async () => {
      const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
      try {
        const state = finish(anotherWeek(playedFirstWeek(42)));
        expect(state.day).toBe(13);
        expect(state.final?.note).toBe('');
        await importRun(page, state);
        expect(await page.locator('.voicenote').count()).toBe(0);
        expect(await page.locator('.final-input').count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Another week', exact: true }).count()).toBe(0);
        expect(await page.getByRole('button', { name: 'Start over', exact: true }).count()).toBe(1);
        expect(await page.locator('.first-week').innerText()).toContain(state.past?.[0]?.line);
        expect(await page.locator('.current-week .sday > .notebook-text').allTextContents()).toEqual([
          'Mon',
          'Tue',
          'Wed',
          'Thu',
          'Fri',
        ]);
        expect(await page.locator('.hands').innerText()).toContain('A fortnight ago');
        expect(await page.locator('.hands').innerText()).toContain('On Monday');
        const first = await page.locator('.first-week').boundingBox();
        const current = await page.locator('.current-week').boundingBox();
        expect(first?.y).toBe(current?.y);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          viewport.width,
        );
        expect(await page.evaluate(() => window.__murmur.state)).toEqual(cloneState(state));
        await snapshot(page, `week-two-ending-${size}`);
      } finally {
        await page.close();
      }
    });
  }

  it.each(['0.2.1', '0.3.0'])('keeps the %s ending and its allowed actions', async (version) => {
    const page = await browser.newPage();
    try {
      await importRun(page, finish(newGame(42, version)));
      expect(await page.getByRole('button', { name: 'Another week', exact: true }).count()).toBe(
        version === '0.3.0' ? 1 : 0,
      );
      expect(await page.locator('.voicenote').count()).toBe(1);
      if (version === '0.3.0') {
        await page.getByRole('button', { name: 'Another week', exact: true }).click();
        expect(await page.evaluate(() => window.__murmur.state?.version)).toBe('0.4.1');
        expect(await page.evaluate(() => window.__murmur.state?.day)).toBe(8);
      }
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      await page.locator('#bp-new').click();
      expect(await page.evaluate(() => window.__murmur.state?.version)).toBe('0.4.2');
      expect(await page.evaluate(() => window.__murmur.state?.day)).toBe(1);
    } finally {
      await page.close();
    }
  });
});

it('keeps the optional notebook count off until chosen and updates the ending immediately', async () => {
  const page = await browser.newPage();
  await importRun(page, playedFirstWeek(42));
  const before = await page.evaluate(() => ({
    state: window.__murmur.state,
    save: localStorage.getItem('murmur-save-v1'),
  }));
  expect(await page.locator('#notebook-tally').innerText()).toBe('');
  await page.locator('#menu').click();
  expect(await page.locator('#bp-tally').isChecked()).toBe(false);
  await page.locator('#bp-tally').check();
  expect(await page.locator('#notebook-tally').innerText()).toContain('Total:');
  await page.locator('#bp-close').click();
  await page.locator('#menu').click();
  expect(await page.locator('#bp-tally').isChecked()).toBe(true);
  await page.locator('#bp-tally').uncheck();
  expect(await page.locator('#notebook-tally').innerText()).toBe('');
  await page.locator('#bp-close').click();
  expect(
    await page.evaluate(() => ({
      state: window.__murmur.state,
      save: localStorage.getItem('murmur-save-v1'),
    })),
  ).toEqual(before);
  await page.close();
}, 60_000);
