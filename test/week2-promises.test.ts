import { expect, it } from 'vitest';
import { playWeek } from '../scripts/measure-promises.ts';
import { DAY0, dayStart, LABEL } from '../src/sim/dilan.ts';
import { anotherWeek, cloneState, newGame, replay, runToCard, step } from '../src/sim/game.ts';
import { momentById } from '../src/sim/moments.ts';
import { weekStanding } from '../src/sim/standing.ts';
import type { GameState } from '../src/sim/types.ts';

const totals = (s: GameState) => {
  const pages = s.pages.filter((p) => p.day >= 8);
  return {
    kept: pages.reduce((n, p) => n + p.kept.length, 0),
    missed: pages.reduce((n, p) => n + p.missed.length, 0),
  };
};
it('charges repeated week-two videos their lost sleep while preserving the first week', () => {
  const old = playWeek(newGame(2003, '0.6.0'), 'careless');
  const current = playWeek(newGame(2003), 'careless');
  expect({ ...cloneState(current), version: old.version }).toEqual(cloneState(old));
  const options = momentById('bed-8', current.version).options;
  if (typeof options === 'function') throw Error('Expected authored options');
  expect(options.find((o) => o.id === 'scroll')?.duration).toBe(150);
  anotherWeek(current);
  expect(
    current.person.agenda.commitments.find((c) => c.label === LABEL.mum && c.from >= dayStart(8))?.actions,
  ).toEqual(['listen-to-mum']);
  playWeek(current, 'careless');
  expect(
    current.pages
      .filter((p) => p.day >= 8)
      .flatMap((p) => [...p.kept, ...p.missed])
      .filter((x) => x === LABEL.bedtime),
  ).toHaveLength(5);
  expect(current.pages.some((p) => p.day >= 8 && p.gotUpAlone)).toBe(false);
  const { kept, missed } = totals(current);
  expect(missed / (kept + missed)).toBeGreaterThan(0.45);
  const rebuilt = replay(current.seed, current.inputs, current.minute, current.version);
  if (rebuilt.phase === 'day') step(rebuilt);
  expect(cloneState(rebuilt)).toEqual(cloneState(current));
}, 30_000);
it('one headless careful control still holds the second week', () => {
  const s = playWeek(newGame(2003), 'careful');
  anotherWeek(s);
  runToCard(s);
  expect(s.card?.moment).toBe('alarm-8');
  playWeek(s, 'careful');
  expect(weekStanding(s)?.kind).toBe('kept');
  const listening = s.inputs.filter((i) => i.kind === 'say' && i.option === 'listen' && i.at >= dayStart(8));
  expect(listening.length).toBeGreaterThan(0);
  for (const input of listening) expect((input.at - DAY0) % 1440).toBeLessThan(21 * 60 + 30);
}, 30_000);
