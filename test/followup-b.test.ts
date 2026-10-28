import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Browser, Page as BrowserPage } from 'playwright';
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cardView, cloneState, newGame, queueInput, runToCard } from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import { momentRecords } from '../src/ui/journal.ts';
import { answerThoughts, attributedWords, cardThought, finalInputWords } from '../src/ui/presentation.ts';
import { launchBrowser } from './browser.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Required test state is absent');
  return value;
}
const shots = process.env.MURMUR_SHOTS;
function nextAlarm(s: GameState) {
  const day = s.day;
  while (s.day === day) {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  runToCard(s);
}
function retained() {
  const s = newGame(2, '0.3.0');
  runToCard(s);
  queueInput(s, { kind: 'say', option: 'up' });
  expect(s.answer?.stayed).toBeTruthy();
  return s;
}
function phoneCard() {
  const s = newGame(2, '0.3.0');
  for (let guard = 0; guard < 100; guard++) {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    runToCard(s);
    const v = cardView(s);
    if (!v) continue;
    if (v.options.length === 3 && cardThought(s, v) && s.phrases.length) return s;
    const o = v.options.find((o) => !o.isPull);
    if (o) queueInput(s, { kind: 'say', option: o.id, insist: v.id === 'alarm-2' });
  }
  throw new Error('No natural three-option card with phrase and first recall');
}
let browser: Browser;
let current: ViteDevServer;
let before: ViteDevServer | undefined;
let url: string;
let beforeUrl: string | undefined;
async function load(s: GameState, viewport = { width: 360, height: 690 }, base = url) {
  const page = await browser.newPage({ viewport, hasTouch: viewport.width === 360 });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 1;
  });
  await page.goto(`${base}`);
  if (base === url) {
    await page.locator('#menu').click();
    await page.getByText('Debug', { exact: true }).click();
  }
  await page.locator('#file').setInputFiles({
    name: 'exact-run.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ version: s.version, seed: s.seed, inputs: s.inputs, state: cloneState(s) }),
    ),
  });
  await page.locator('.toast').waitFor();
  expect(await page.locator('.toast').textContent()).toContain('matches the file');
  // Layout assertions must use the shipped fonts, as Playwright screenshots already do.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(350);
  return page;
}
async function visibleText(page: BrowserPage, selector: string) {
  return (await page.locator(selector).allTextContents()).join(' ');
}
describe('follow-up b rendered exact runs', { timeout: 30_000 }, () => {
  beforeAll(async () => {
    current = await createServer({ server: { host: '127.0.0.1', port: 0 }, logLevel: 'silent' });
    await current.listen();
    url = required(current.resolvedUrls?.local[0]);
    const beforeRoot = process.env.MURMUR_BEFORE;
    if (beforeRoot && existsSync(beforeRoot)) {
      before = await createServer({
        root: beforeRoot,
        server: { host: '127.0.0.1', port: 0 },
        logLevel: 'silent',
      });
      await before.listen();
      beforeUrl = before.resolvedUrls?.local[0];
    }
    browser = await launchBrowser();
    if (shots) mkdirSync(shots, { recursive: true });
  });
  afterAll(async () => {
    await browser?.close();
    await current?.close();
    await before?.close();
  });
  it('shows retained words, the first Tuesday recall and its distinct silent result once, then no Wednesday repeat', async () => {
    const s = retained();
    let page = await load(s);
    expect(await page.locator('.journal .stayed').last().count()).toBe(1);
    await page.close();
    nextAlarm(s);
    const recall = required(cardThought(s, required(cardView(s))));
    page = await load(s);
    expect(await visibleText(page, '.card .stayed')).toContain(attributedWords(recall));
    await page.locator('#hush').click();
    expect(await page.locator('.journal .stayed').last().count()).toBe(1);
    expect(await page.locator('.journal .stayed').last().innerText()).not.toContain(attributedWords(recall));
    queueInput(s, { kind: 'quiet' });
    expect(await page.locator('.journal .stayed').last().innerText()).toContain(
      attributedWords(required(answerThoughts(s, required(s.answer), momentRecords(s))[0])),
    );
    await page.close();
    nextAlarm(s);
    page = await load(s);
    expect(await page.locator('.card .stayed').count()).toBe(0);
    await page.close();
    const night = retained();
    while (night.phase === 'day') {
      runToCard(night);
      if (night.card) queueInput(night, { kind: 'quiet' });
    }
    page = await load(night);
    expect(await page.locator('.stayed').count()).toBe(0);
    await page.close();
  });
  it('renders an actual held-up phrase and Saturday pressure, suggestion and silence separately', async () => {
    const learned = newGame(2, '0.3.0');
    runToCard(learned);
    queueInput(learned, { kind: 'say', option: 'up', insist: true });
    let page = await load(learned);
    expect(await visibleText(page, '.journal .margin')).toContain(required(learned.phrases.at(-1)).text);
    await page.close();
    const base = newGame(42, '0.3.0');
    while (base.day < 6) {
      if (base.phase === 'evening') queueInput(base, { kind: 'next' });
      else {
        runToCard(base);
        if (base.card) queueInput(base, { kind: 'quiet' });
      }
    }
    runToCard(base);
    for (const mode of ['suggestion', 'pressure', 'quiet']) {
      const s = cloneState(base);
      if (mode === 'quiet') queueInput(s, { kind: 'quiet' });
      else queueInput(s, { kind: 'say', option: 'send', insist: mode === 'pressure' });
      while (s.phase === 'day') runToCard(s);
      if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      page = await load(s);
      expect(await visibleText(page, '.final-input')).toBe(finalInputWords(s, momentRecords(s)));
      await page.close();
    }
  });
  it('captures before and after and keeps the three-option card, phrase, recall and silence within the phone viewport', async () => {
    const s = phoneCard();
    const bounds: unknown[] = [];
    for (const viewport of [
      { width: 360, height: 690 },
      { width: 1280, height: 800 },
    ]) {
      for (const [label, base] of [
        ['before', beforeUrl],
        ['after', url],
      ]) {
        if (!base) continue;
        const page = await load(s, viewport, base);
        await page.locator('#toast').evaluate((el) => el.remove());
        if (shots)
          await page.screenshot({
            animations: 'disabled',
            path: `${shots}/${label}-${viewport.width === 360 ? 'phone' : 'desktop'}-b.png`,
          });
        if (label === 'after') {
          expect(await page.locator('.opt').count()).toBe(3);
          expect(await page.locator('.card .stayed').count()).toBe(1);
          for (const selector of ['.scene', '.card .stayed', '.opt', '#hush'])
            for (const el of await page.locator(selector).all()) {
              await el.scrollIntoViewIfNeeded();
              const b = await el.boundingBox();
              expect(b).not.toBeNull();
              if (!b) throw new Error(`Missing bounds: ${selector}`);
              bounds.push({ viewport, selector, ...b });
              expect(b.x).toBeGreaterThanOrEqual(0);
              expect(b.y).toBeGreaterThanOrEqual(0);
              expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
              expect(b.y + b.height).toBeLessThanOrEqual(viewport.height);
            }
        }
        await page.close();
      }
    }
    if (shots) writeFileSync(`${shots}/bounds-b.json`, JSON.stringify(bounds, null, 2));
  });
});
