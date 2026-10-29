import { describe, expect, it } from 'vitest';
import { anotherWeek, cloneState, replay, step } from '../src/sim/game.ts';
import { firstWeek, importRun, setupWeekTwoBrowser, weekTwoBrowser } from './week2-ui-shared.ts';

setupWeekTwoBrowser();

describe('a played first week', () => {
  it.each([1, 42, 1003])(
    'plays and replays seed %i through the normal inputs',
    (seed) => {
      const s = firstWeek(seed);
      expect(s.version).toBe('0.10.0');
      expect(s.phase).toBe('end');
      expect(s.day).toBe(6);
      expect(s.inputs.some((i) => i.kind === 'say' && i.insist)).toBe(false);
      const again = replay(seed, s.inputs, s.minute, s.version);
      // The last answer can end the day on its own minute; finish that day as anotherWeek does.
      while (again.phase === 'day') step(again);
      expect(cloneState(again)).toEqual(cloneState(s));
      const next = anotherWeek(s);
      expect(next.day).toBe(8);
      expect(next.phase).toBe('day');
      expect(next.past).toHaveLength(1);
    },
    120_000,
  );
});

it('offers the notebook tally only at the ending, closed until requested', async () => {
  const page = await weekTwoBrowser().newPage();
  await importRun(page, firstWeek(42));
  const before = await page.evaluate(() => ({
    state: window.__murmur.state,
    save: localStorage.getItem('murmur-save-v1'),
  }));
  const tally = page.locator('#notebook-tally');
  expect(await tally.isVisible()).toBe(false);
  await page.locator('#menu').click();
  expect(await page.locator('#bp-tally').count()).toBe(0);
  await page.locator('#bp-close').click();
  await page.getByText('See the tally', { exact: true }).click();
  expect(await tally.innerText()).toContain('Total:');
  expect(await tally.isVisible()).toBe(true);
  await page.getByText('See the tally', { exact: true }).click();
  expect(await tally.isVisible()).toBe(false);
  expect(
    await page.evaluate(() => ({
      state: window.__murmur.state,
      save: localStorage.getItem('murmur-save-v1'),
    })),
  ).toEqual(before);
  await page.close();
}, 300_000);
