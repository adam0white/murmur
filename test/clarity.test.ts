import { readFileSync } from 'node:fs';
import { type Browser, chromium, type Page } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cardView, cloneState, newGame, queueInput, replay, runToCard, step } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
  await server.listen();
  origin = server.resolvedUrls?.local[0] ?? '';
  browser = await chromium.launch({ headless: true, channel: 'chrome' });
}, 30_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
}, 30_000);

async function firstChoice(page: Page, version = '0.2.1') {
  await page.goto(`${origin}?seed=1`);
  await page.evaluate(() => {
    const game = (window as unknown as { __murmur: { fast: boolean } }).__murmur;
    game.fast = true;
  });
  await page.evaluate((edition) => {
    (window as unknown as { __murmur: { start(seed: number, version: string): void } }).__murmur.start(
      1,
      edition,
    );
  }, version);
  await page.locator('#hush').waitFor();
  await page.waitForTimeout(350);
}

async function documentTargets(page: Page, height: number) {
  const boxes = [];
  for (const el of await page.locator('button:visible, a:visible, summary:visible').all()) {
    const box = await el.boundingBox();
    expect(box?.width, await el.innerText()).toBeGreaterThanOrEqual(44);
    expect(box?.height, await el.innerText()).toBeGreaterThanOrEqual(44);
    expect(box?.y).toBeGreaterThanOrEqual(0);
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
    if (box) boxes.push({ ...box, label: await el.innerText(), id: await el.getAttribute('id') });
  }
  for (const [i, a] of boxes.entries()) {
    for (const b of boxes.slice(i + 1)) {
      expect(
        a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y,
        JSON.stringify({ a, b }),
      ).toBe(true);
    }
  }
}

// Browser navigation and font loading can exceed Vitest's five-second unit-test default.
describe('first-minute clarity', { timeout: 30_000 }, () => {
  it('states purpose and influence before play, keeping the biography optional', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(origin);
      await page.locator('.title .page-body > p').first().waitFor();
      const purpose = await page.locator('.title .page-body > p').allTextContents();
      expect(purpose.join(' ')).toMatch(/from Monday to Saturday/);
      expect(purpose.join(' ')).toMatch(/words can change her choices/);
      const more = page.locator('.info-panel');
      expect(await more.isVisible()).toBe(false);
      await page.getByRole('button', { name: 'Information', exact: true }).focus();
      await page.keyboard.press('Space');
      expect(await more.innerText()).toContain('She dispatches vans');
      await page.keyboard.press('Escape');
      expect(await more.isVisible()).toBe(false);
      await page.goto(`${origin}?seed=1`);
      await page.locator('#new').click();
      const gap = await page.locator('.gap').innerText();
      expect(gap).toBe('Her alarm is about to go.');
      await page.locator('#hush').waitFor();
      await page.waitForTimeout(350);
      const story = [...purpose, gap, ...(await page.locator('.scene,.pull').allTextContents())].join(' ');
      expect(story).toContain('Her alarm is about to go.');
      const instructions = (await page.locator('.caption,.hint,.gesture').allTextContents()).join(' ');
      expect(instructions).toContain('Tap one to say it.');
      expect(instructions).toContain('hold to insist');
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
      expect(await page.locator('.top .when').evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
        true,
      );
      const context = await page.locator('.card-text').boundingBox();
      expect(context?.height).toBeGreaterThan(0);
      for (const selector of ['.scene', '.pull', '.opt .ink', '.opt .lean', '#hush']) {
        for (const el of await page.locator(selector).all()) {
          await el.scrollIntoViewIfNeeded();
          const bounds = await el.boundingBox();
          const card = await page.locator('.card').evaluate((node) => {
            const r = node.getBoundingClientRect();
            return { top: r.top + node.clientTop, bottom: r.top + node.clientTop + node.clientHeight };
          });
          if (selector === '.scene' || selector === '.pull') {
            const text = await page.locator('.card-text').boundingBox();
            expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeGreaterThan(text?.y ?? 0);
            expect(bounds?.y).toBeLessThan((text?.y ?? 0) + (text?.height ?? 0));
          } else {
            expect(bounds?.y).toBeGreaterThanOrEqual(card.top - 1);
            expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(card.bottom + 1);
            expect(bounds?.y).toBeGreaterThanOrEqual(0);
            expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(691);
          }
          expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    } finally {
      await page.close();
    }
  });

  it('shows the deciding and answering states, pauses under the menu, and resumes the reply beat', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await firstChoice(page);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.clock.install();
      await page.clock.resume();
      await page.clock.runFor(100);
      expect(await page.locator('#state-words').innerText()).toBe("She's deciding");
      const before = await page.locator('#clock').innerText();
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      await page.clock.runFor(8000);
      expect(await page.locator('#clock').innerText()).toBe(before);
      expect(await page.locator('#hush').count()).toBe(1);
      expect(await page.getByRole('dialog', { name: 'Game menu' }).isVisible()).toBe(true);
      await page.locator('#bp-close').click();
      await page.locator('.opt').first().click();
      expect(await page.locator('#state-words').innerText()).toBe("She's answering");
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      const answered = await page.locator('#clock').innerText();
      await page.clock.runFor(8000);
      expect(await page.locator('#clock').innerText()).toBe(answered);
      await page.locator('#bp-close').click();
      await page.clock.runFor(1000);
      expect(await page.locator('#state-words').innerText()).toBe("She's answering");
      await page.clock.runFor(2100);
      expect(await page.locator('#state-words').innerText()).toBe('');
      await page.locator('#hurry').click();
      await page.clock.runFor(3000);
      expect(await page.locator('#state-words').innerText()).toBe("She's deciding");
      await page.locator('#hush').click();
      expect(await page.locator('#state-words').innerText()).toBe("She's answering");
      await page.clock.runFor(3100);
      expect(await page.locator('#state-words').innerText()).toBe('');
      expect(await page.locator('#state-words').count()).toBe(1);
    } finally {
      await page.close();
    }
  }, 30_000);

  it.each(['no-preference', 'reduce'] as const)(
    'highlights and announces each arrival once with %s motion',
    async (reducedMotion) => {
      const page = await browser.newPage({ reducedMotion });
      try {
        await firstChoice(page);
        await page.evaluate(() => {
          (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
          window.requestAnimationFrame = () => 1;
        });
        await page.locator('[data-o="up"]').click();
        const reply = page.locator('.journal .record-reply').first();
        const words = await reply.textContent();
        const arrival = reply.locator('..');
        expect(await arrival.evaluate((el) => getComputedStyle(el).animationName)).toBe(
          reducedMotion === 'reduce' ? 'none' : 'journal-highlight',
        );
        expect(await page.locator('#journal-live').getAttribute('aria-live')).toBe('polite');
        expect(await page.locator('#journal-live').textContent()).toContain(words);
        await reply.evaluate((el) => el.setAttribute('data-retained-node', 'true'));
        if (reducedMotion === 'no-preference') {
          await page.waitForFunction(
            () => !document.querySelector('.record-reply')?.parentElement?.classList.contains('journal-new'),
            undefined,
            { polling: 50 },
          );
        }
        await page.evaluate(() => {
          (window as unknown as { __murmur: { skipToCard(): void } }).__murmur.skipToCard();
        });
        expect(await reply.getAttribute('data-retained-node')).toBe('true');
        expect(await page.locator('#journal-live').textContent()).not.toContain(words);
        expect(await page.locator('.journal .record-reply').count()).toBe(1);
        expect(await arrival.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
      } finally {
        await page.close();
      }
    },
  );

  it('pauses the evening transition while the menu is open and resumes it on close', async () => {
    const state = newGame(1, '0.2.1');
    runToCard(state);
    let lastCard = cloneState(state);
    while (state.phase === 'day') {
      if (state.card) {
        lastCard = cloneState(state);
        queueInput(state, { kind: 'quiet' });
      }
      runToCard(state);
    }
    const page = await browser.newPage();
    try {
      await page.clock.install();
      await page.goto(origin);
      await page.locator('#other-ways').click();
      await page.locator('#file').setInputFiles({
        name: 'last-card.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({
            version: lastCard.version,
            seed: lastCard.seed,
            inputs: lastCard.inputs,
            state: lastCard,
          }),
        ),
      });
      await page.locator('#hush').waitFor();
      await page.waitForTimeout(350);
      await page.locator('#hush').click();
      for (let i = 0; i < 200; i++) {
        const phase = await page.evaluate(
          () => (window as unknown as { __murmur: { state: { phase: string } } }).__murmur.state.phase,
        );
        if (phase === 'evening') break;
        await page.clock.runFor(100);
      }
      expect(await page.locator('#state-words').innerText()).toBe('The day is done');
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      await page.clock.runFor(8000);
      expect(await page.locator('#dayroot').count()).toBe(1);
      expect(await page.locator('#next').count()).toBe(0);
      await page.locator('#bp-close').click();
      await page.clock.runFor(3100);
      expect(await page.locator('#next').count()).toBe(1);
    } finally {
      await page.close();
    }
  });

  it.each([
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ])('keeps the refusal, recovery and response on screen at $width×$height', async (viewport) => {
    const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    try {
      await firstChoice(page);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.locator('.opt[data-o="up"]').click();
      expect(await page.locator('.journal .record-reply').innerText()).toMatch(
        /next.*alarm.*press and hold/i,
      );
      for (const selector of ['#state-words', '.record-yours', '.journal .record-reply', '#hurry']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        const box = await page.locator(selector).boundingBox();
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      }
      await documentTargets(page, viewport.height);
    } finally {
      await page.close();
    }
  });

  it('keeps a long refusal and completed outcome visible without moving the response', async () => {
    const example = JSON.parse(
      readFileSync(new URL('./fixtures/clarity-long-reply.json', import.meta.url), 'utf8'),
    ) as {
      seed: number;
      inputs: Input[];
      minute: number;
      completion: number;
      option: string;
      words: string;
    };
    const page = await browser.newPage({
      viewport: { width: 360, height: 690 },
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    try {
      const before = replay(example.seed, example.inputs, example.minute);
      expect(cardView(before)?.id).toBe('ece-4');
      await page.goto(origin);
      await page.locator('#other-ways').click();
      await page.locator('#file').setInputFiles({
        name: 'before.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ seed: before.seed, inputs: before.inputs, state: cloneState(before) }),
        ),
      });
      await page.locator('#hush').waitFor();
      await page.waitForTimeout(350);
      await page.locator(`.opt[data-o="${example.option}"]`).click();
      const position = await page.locator('#hurry').boundingBox();
      const run = await page.evaluate(() => {
        const game = (
          window as unknown as { __murmur: { state: { seed: number; inputs: Input[]; minute: number } } }
        ).__murmur;
        return { seed: game.state.seed, inputs: game.state.inputs, minute: game.state.minute };
      });
      const after = replay(run.seed, run.inputs, run.minute);
      while (after.minute < example.completion && after.phase === 'day') step(after);
      await page.locator('#menu').click();
      await page.locator('#bp-title').click();
      await page.locator('#other-ways').click();
      await page.locator('#file').setInputFiles({
        name: 'after.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ seed: after.seed, inputs: after.inputs, state: cloneState(after) }),
        ),
      });
      const latest = page.locator('.journal');
      const completion = after.log.find((line) => line.who === 'narrator' && line.at === example.completion);
      expect(completion).toBeDefined();
      await page.locator('.journal .n').filter({ hasText: completion?.text }).waitFor();
      expect(await page.locator('.journal').innerText()).toContain(completion?.text);
      expect(await latest.locator('.record-reply').last().innerText()).toContain(
        example.words.replaceAll('“', '‘').replaceAll('”', '’'),
      );
      expect(await page.locator('.gap').count()).toBe(0);
      for (const el of [latest.locator('.record-reply').last(), page.locator('.journal .n').last()]) {
        await el.scrollIntoViewIfNeeded();
        const box = await el.boundingBox();
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
        expect(await el.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
      expect((await page.locator('#hurry').boundingBox())?.y).toBe(position?.y);
      for (const selector of ['#state-words', '#hurry']) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        const box = await page.locator(selector).boundingBox();
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(690);
      }
    } finally {
      await page.close();
    }
  });

  it('uses the shared menu names and downloads a replayable run', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await page.goto(origin);
      expect(await page.getByRole('link', { name: 'All games', exact: true }).isVisible()).toBe(true);
      await firstChoice(page);
      await page.getByRole('button', { name: 'Game menu', exact: true }).click();
      const menu = page.getByRole('dialog', { name: 'Game menu' });
      expect(await menu.locator('h2').innerText()).toContain('Game menu');
      await menu.locator('#bp-send').click();
      const pending = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Keep a copy of this run', exact: true }).click();
      const download = await pending;
      const stream = await download.createReadStream();
      const chunks: Buffer[] = [];
      if (!stream) throw new Error('Run download has no stream');
      for await (const chunk of stream) chunks.push(Buffer.from(chunk));
      const run = JSON.parse(Buffer.concat(chunks).toString());
      const { replay, fingerprint, restoreState } = await import('../src/sim/game.ts');
      expect(fingerprint(replay(run.seed, run.inputs, run.state.minute))).toBe(
        fingerprint(restoreState(run.state)),
      );
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
    const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
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
      expect(await page.getByRole('dialog', { name: 'Game menu' }).isVisible()).toBe(true);
      await page.locator('#bp-close').click();
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.locator('#hush').click();
      expect(await page.locator('.journal .record-yours').innerText()).toContain('You said nothing.');
      expect(await page.locator('.gap').count()).toBe(0);
    } finally {
      await page.close();
    }
  });
});

describe('round 4 early insistence', { timeout: 30_000 }, () => {
  it('lets a real touch hold carry the first ordinary suggestion before any refusals', async () => {
    const page = await browser.newPage({
      viewport: { width: 360, height: 690 },
      hasTouch: true,
      reducedMotion: 'reduce',
    });
    try {
      await firstChoice(page);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.evaluate(() => document.fonts.ready);
      await page.clock.install();
      await page.clock.runFor(1000);
      const up = page.locator('.opt[data-o="up"]');
      expect(await up.locator('.lean').innerText()).toBe('only with a push');
      expect(await up.locator('.gesture').innerText()).toContain('hold to insist');
      const box = await up.boundingBox();
      if (!box) throw new Error('No alarm suggestion');
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + 30, y: box.y + 25 }],
      });
      await page.clock.runFor(300);
      expect(await up.locator('.gesture').innerText()).toContain('insisting');
      expect((await up.boundingBox())?.y).toBe(box.y);
      await page.clock.runFor(350);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const run = await page.evaluate(
        () =>
          (
            window as unknown as {
              __murmur: {
                state: { seed: number; inputs: Input[]; minute: number; answer: { chosen: string } };
              };
            }
          ).__murmur.state,
      );
      expect(run.inputs).toHaveLength(1);
      expect(run.inputs[0]).toMatchObject({ kind: 'say', option: 'up', insist: true });
      expect(run.answer.chosen).toBe('up');
      expect(await page.locator('.record-yours').innerText()).toContain('You insisted');
      expect(cloneState(replay(run.seed, run.inputs, run.minute))).toEqual(run);
    } finally {
      await page.close();
    }
  });

  it('does not send an old hold to the next card and supports keyboard insistence', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await firstChoice(page);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.evaluate(() => document.fonts.ready);
      await page.clock.install();
      await page.clock.runFor(1000);
      const up = page.locator('[data-o="up"]');
      const box = await up.boundingBox();
      if (!box) throw new Error('No alarm suggestion');
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + 30, y: box.y + 25 }],
      });
      await page.clock.runFor(200);
      await page.evaluate(() => {
        const game = (window as unknown as { __murmur: { quiet(): void; skipToCard(): void } }).__murmur;
        game.quiet();
        game.skipToCard();
      });
      await page.clock.runFor(600);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const inputs = await page.evaluate(
        () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs,
      );
      expect(inputs).toHaveLength(1);
      expect(inputs[0]?.kind).toBe('quiet');
      await page.locator('[data-o="reply"]').focus();
      await page.keyboard.press('Shift+Enter');
      const last = await page.evaluate(() =>
        (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs.at(-1),
      );
      expect(last).toMatchObject({ kind: 'say', option: 'reply', insist: true });
    } finally {
      await page.close();
    }
  });

  it('cancels an unfinished touch hold and keeps an ordinary tap available', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await firstChoice(page);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
      });
      await page.evaluate(() => document.fonts.ready);
      await page.clock.install();
      await page.clock.runFor(1000);
      const up = page.locator('.opt[data-o="up"]');
      const box = await up.boundingBox();
      if (!box) throw new Error('No alarm suggestion');
      const touch = await page.context().newCDPSession(page);
      await touch.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: box.x + 30, y: box.y + 25 }],
      });
      await page.clock.runFor(250);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      await page.clock.runFor(700);
      expect(await up.locator('.gesture').innerText()).toContain('hold to insist');
      expect(
        await page.evaluate(
          () =>
            (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs.length,
        ),
      ).toBe(0);
      await up.tap();
      const input = await page.evaluate(
        () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs[0],
      );
      expect(input).toMatchObject({ kind: 'say', option: 'up' });
      expect(input && 'insist' in input ? input.insist : false).not.toBe(true);
    } finally {
      await page.close();
    }
  });
});

describe('round 4 suggestion history', { timeout: 30_000 }, () => {
  it.each([
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ])(
    'retains the suggestion and her choice after advancing and importing at $width×$height',
    async (viewport) => {
      const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
      try {
        await firstChoice(page);
        await page.evaluate(() => {
          (window as unknown as { __murmur: { fast: boolean } }).__murmur.fast = false;
        });
        await page.locator('[data-o="up"]').click();
        await page.locator('.journal .record-yours').waitFor();
        expect(await page.locator('.journal .record-yours').count()).toBe(1);
        expect(await page.locator('.record-yours').innerText()).toContain('Up. Feet on the floor.');
        expect(await page.locator('.record-yours').innerText()).toContain('She chose “Five more.”');
        const after = await page.evaluate(
          () => (window as unknown as { __murmur: { state: unknown } }).__murmur.state,
        );
        await page.getByRole('button', { name: 'Game menu', exact: true }).click();
        await page.locator('#bp-title').click();
        await page.locator('#other-ways').click();
        await page.locator('#file').setInputFiles({
          name: 'reply.json',
          mimeType: 'application/json',
          buffer: Buffer.from(
            JSON.stringify({
              seed: (after as { seed: number }).seed,
              inputs: (after as { inputs: Input[] }).inputs,
              state: after,
            }),
          ),
        });
        await page.locator('.journal .record-yours').waitFor();
        expect(await page.locator('.journal .record-yours').count()).toBe(1);
        expect(await page.locator('.record-yours').innerText()).toContain('Up. Feet on the floor.');
        expect(await page.locator('.record-yours').innerText()).toContain('She chose “Five more.”');
        await page.locator('#hurry').click();
        await page.locator('#hush').waitFor();
        await page.waitForTimeout(350);
        const record = page.locator('.journal .record-yours').first();
        const journal = page.locator('.journal');
        expect(await record.innerText()).toContain('You:');
        expect(await record.innerText()).toContain('Up. Feet on the floor.');
        expect(await journal.innerText()).toContain('She chose');
        expect(await journal.innerText()).toContain('Five more.');
        expect(await page.locator('.journal').innerText()).toContain('slept through');
        await record.scrollIntoViewIfNeeded();
        const box = await record.boundingBox();
        expect(box?.y).toBeGreaterThanOrEqual(0);
        expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      } finally {
        await page.close();
      }
    },
  );
});

describe('design round card safety and time', { timeout: 30_000 }, () => {
  it.each([
    { width: 360, height: 690 },
    { width: 1280, height: 800 },
  ])('replaces an unread reply with the next live card at $width×$height', async (viewport) => {
    const page = await browser.newPage({ viewport, hasTouch: true, reducedMotion: 'reduce' });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
    try {
      await page.clock.install();
      await page.goto(`${origin}?seed=1`);
      await page.locator('#new').click();
      await page.locator('#hush').waitFor();
      await page.clock.runFor(1350);
      await page.locator('[data-o="up"]').click();
      expect(await page.locator('.journal .record-reply').count()).toBe(1);
      expect(await page.locator('.gap').count()).toBe(0);
      expect(await page.locator('#hurry').count()).toBe(1);
      // Leave the reply open: normal playback must open the next moment without an acceleration click.
      await page.clock.runFor(20_000);
      expect(errors).toEqual([]);
      const live = await page.evaluate(() => {
        const game = (
          window as unknown as {
            __murmur: {
              fast: boolean;
              state: { card: { moment: string }; minute: number; inputs: Input[] };
            };
          }
        ).__murmur;
        return { fast: game.fast, ...game.state };
      });
      expect(live.fast).toBe(false);
      expect(live.card?.moment).toBe('note-1');
      expect(await page.locator('.gap').count()).toBe(0);
      expect(await page.locator('.sheet.open .card').count()).toBe(1);
      expect(await page.locator('#state-words').innerText()).toBe("She's deciding");
      expect(await page.locator('#hurry').count()).toBe(0);
      const reply = page.locator('[data-o="reply"]');
      const box = await reply.boundingBox();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(viewport.height);
      const clock = await page.locator('#clock').innerText();
      await page.clock.runFor(13_000);
      expect(await page.locator('#clock').innerText()).not.toBe(clock);
      const minute = await page.evaluate(
        () => (window as unknown as { __murmur: { state: { minute: number } } }).__murmur.state.minute,
      );
      expect(minute - live.minute).toBeGreaterThanOrEqual(1);
      expect(minute - live.minute).toBeLessThanOrEqual(3);
      await reply.tap();
      const input = await page.evaluate(() =>
        (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs.at(-1),
      );
      expect(input).toMatchObject({ kind: 'say', option: 'reply' });
      expect(await page.locator('.gap').count()).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await page.close();
    }
  });

  it('ignores silence and option releases after the card is replaced', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await firstChoice(page, '0.3.0');
      await page.evaluate(() => {
        const game = (window as unknown as { __murmur: { skipToCard(): void } }).__murmur;
        const old = document.getElementById('hush');
        old?.dispatchEvent(new PointerEvent('pointerdown', { button: 0, isPrimary: true }));
        game.skipToCard();
        // A delayed click on the detached control must not answer the replacement.
        old?.dispatchEvent(new MouseEvent('click', { detail: 1 }));
      });
      expect(
        await page.evaluate(
          () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs,
        ),
      ).toEqual([]);
      // A release retargeted to a new control had no pointerdown on that control.
      await page.locator('#hush').dispatchEvent('pointerup', { isPrimary: true });
      await page.locator('#hush').dispatchEvent('click', { detail: 1 });
      expect(
        await page.evaluate(
          () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs,
        ),
      ).toEqual([]);
      await page.locator('.opt').first().dispatchEvent('pointerup', { isPrimary: true });
      await page.locator('.opt').first().dispatchEvent('click', { detail: 1 });
      expect(
        await page.evaluate(
          () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs,
        ),
      ).toEqual([]);
      await page.waitForTimeout(350);
      await page.locator('#hush').tap();
      expect(
        await page.evaluate(
          () => (window as unknown as { __murmur: { state: { inputs: Input[] } } }).__murmur.state.inputs[0],
        ),
      ).toMatchObject({ kind: 'quiet' });
    } finally {
      await page.close();
    }
  });
});

describe('edition persistence in the browser', { timeout: 30_000 }, () => {
  it('stores the run edition with the local continue record', async () => {
    const page = await browser.newPage();
    try {
      await firstChoice(page, '0.3.0');
      const editions = await page.evaluate(() => ({
        state: (window as unknown as { __murmur: { state: { version: string } } }).__murmur.state.version,
        save: JSON.parse(localStorage.getItem('murmur-save-v1') ?? '{}').version,
      }));
      expect(editions.save).toBe(editions.state);
    } finally {
      await page.close();
    }
  });

  it('rejects an unknown imported edition', async () => {
    const page = await browser.newPage();
    try {
      await page.goto(origin);
      await page.locator('#other-ways').click();
      await page.locator('#file').setInputFiles({
        name: 'unknown.json',
        mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify({ seed: 1, inputs: [], version: 'unknown' })),
      });
      await page.locator('#new').waitFor();
      expect(await page.locator('#dayroot').count()).toBe(0);
    } finally {
      await page.close();
    }
  });
});

describe('design round remembered words', { timeout: 30_000 }, () => {
  it('uses uncertain mood words and shows a retained suggestion in her reply, history and next related card', async () => {
    const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
    try {
      await firstChoice(page, '0.3.0');
      expect(await page.locator('[data-o="up"] .lean').innerText()).toMatch(/listening|hasn't decided/);
      const stayed = await page.evaluate(() => {
        const game = (
          window as unknown as {
            __murmur: {
              start(seed: number): void;
              say(option: string): void;
              quiet(): void;
              skipToCard(): void;
              fast: boolean;
              state: { day: number; phase: string; card: unknown; answer: { stayed?: string } };
            };
          }
        ).__murmur;
        for (let seed = 1; seed <= 16; seed++) {
          game.fast = false;
          game.start(seed);
          game.skipToCard();
          game.say('up');
          if (game.state.answer.stayed) return game.state.answer.stayed;
        }
        return null;
      });
      expect(stayed).toBeTruthy();
      expect(await page.locator('.journal .stayed').innerText()).toContain(stayed);
      await page.evaluate(() => {
        (window as unknown as { __murmur: { skipToCard(): void } }).__murmur.skipToCard();
      });
      expect(await page.locator('.journal .stayed').first().innerText()).toContain(stayed);
      await page.evaluate(() => {
        const game = (
          window as unknown as {
            __murmur: {
              quiet(): void;
              skipToCard(): void;
              fast: boolean;
              state: { day: number; phase: string; card: unknown };
            };
          }
        ).__murmur;
        game.fast = true;
        while (game.state.day === 1 && game.state.phase === 'day' && game.state.card) game.quiet();
      });
      await page.locator('#next').waitFor();
      expect(await page.locator('.notebook .stayed').count()).toBe(0);
      await page.locator('#next').click();
      await page.locator('#hush').waitFor();
      await page.waitForTimeout(350);
      expect(await page.locator('.card .stayed').innerText()).toMatch(/get up|feet|alarm/i);
    } finally {
      await page.close();
    }
  });
});

describe('silent edition exports', { timeout: 30_000 }, () => {
  it('imports a full week whose last decision timed out without another input', async () => {
    const state = newGame(7);
    while (state.phase !== 'end') {
      if (state.phase === 'evening') queueInput(state, { kind: 'next' });
      else {
        runToCard(state);
        while (state.card) step(state);
      }
    }
    const page = await browser.newPage();
    try {
      await page.goto(origin);
      await page.locator('#other-ways').click();
      await page.locator('#file').setInputFiles({
        name: 'silent-week.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify({ version: state.version, seed: state.seed, inputs: state.inputs, state }),
        ),
      });
      await page.locator('.toast').waitFor();
      expect(await page.locator('.toast').innerText()).toBe('Replayed. It matches the file.');
      expect(
        await page.evaluate(() => (window as unknown as { __murmur: { state: unknown } }).__murmur.state),
      ).toEqual({ ...cloneState(state), fileHistory: true, castScope: 'file', castHeadScopes: {} });
    } finally {
      await page.close();
    }
  });
});

it('reserves first-visit notice height when mobile text wraps', async () => {
  const page = await browser.newPage({ viewport: { width: 360, height: 690 }, hasTouch: true });
  try {
    await page.goto(origin);
    const notice = page.locator('.lk-telemetry-notice');
    await notice.waitFor();
    // Mobile system fonts and user text sizing can wrap the longer automatic-linkage notice.
    await notice.evaluate((el) => {
      el.style.font = '16px/1.4 system-ui';
    });
    await documentTargets(page, 690);
    const noticeBox = await notice.boundingBox();
    const spacer = await page.locator('.title-spacer').boundingBox();
    expect(spacer?.height).toBeGreaterThanOrEqual(noticeBox?.height ?? 0);
  } finally {
    await page.close();
  }
}, 30000);
