import { expect, it } from 'vitest';
import { dayStart } from '../src/sim/dilan.ts';
import {
  anotherWeek,
  canAnotherWeek,
  cardView,
  cloneState,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';

function ordinary(s: GameState) {
  const option = cardView(s)?.options.find((o) => !o.isPull && (o.likelihood ?? 0) >= 0.5);
  queueInput(s, option ? { kind: 'say', option: option.id } : { kind: 'quiet' });
}
function week(s: GameState, opened: { id: string; at: number }[]) {
  while (s.phase !== 'end') {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) {
        opened.push({ id: s.card.moment, at: s.card.openedAt - dayStart(s.day) });
        ordinary(s);
      }
    }
  }
}
it('keeps 0.6 default and plays six third-week days only on explicit 0.7', () => {
  // One complete campaign supplies the chronology and departure controls; replay still covers every input.
  expect(newGame(17).version).toBe('0.6.0');
  let s = newGame(17, '0.7.0');
  const opened: { id: string; at: number }[] = [];
  week(s, opened);
  s = anotherWeek(s);
  week(s, opened);
  expect(canAnotherWeek(s)).toBe(true);
  s = anotherWeek(s);
  expect(s.day).toBe(15);
  expect(s.past).toHaveLength(2);
  const seen = new Set<number>();
  while (s.phase !== 'end') {
    seen.add(s.day);
    if (s.phase === 'evening') {
      expect(s.pages.at(-1)?.herLine).not.toMatch(
        /The week is over|apparently good at bowling|There is a shelf\. I made it/,
      );
      queueInput(s, { kind: 'next' });
    } else {
      runToCard(s);
      if (s.card) {
        opened.push({ id: s.card.moment, at: s.card.openedAt - dayStart(s.day) });
        if (s.card.moment === 'close-19') {
          const alternative = restoreState(cloneState(s));
          queueInput(alternative, { kind: 'say', option: 'help' });
          const alternativeEnd = alternative.person.now;
          runToCard(alternative);
          const alternativeTrace = alternative.person.trace.filter((r) => r.at >= dayStart(19) + 17 * 60);
          console.log(
            'ordinary close-19',
            alternative.flags.w3?.close,
            alternativeEnd - dayStart(19),
            alternativeTrace.map((r) => [r.at - dayStart(19), r.chosenAction]),
          );
          expect.soft(alternative.flags.w3?.close).toBe('help');
          expect.soft(alternativeEnd).toBeGreaterThan(dayStart(19) + 18 * 60);
          expect.soft(cardView(alternative)?.scene).toContain('missed the early bus');
          queueInput(s, { kind: 'say', option: 'leave', insist: true });
          const finished = s.person.now;
          runToCard(s);
          const trace = s.person.trace.filter((r) => r.at >= finished);
          console.log(
            'accepted leave-19',
            s.flags.w3?.close,
            finished - dayStart(19),
            trace.map((r) => [r.at - dayStart(19), r.chosenAction]),
          );
          expect.soft(s.flags.w3?.close).toBe('leave');
          expect
            .soft(trace.some((r) => ['deliver-parcel', 'dispatch'].includes(r.chosenAction ?? '')))
            .toBe(false);
          expect
            .soft(trace.some((r) => r.chosenAction === 'commute' && r.at === dayStart(19) + 17 * 60 + 20))
            .toBe(true);
          expect.soft(trace.some((r) => r.chosenAction === 'home')).toBe(true);
          expect.soft(cardView(s)?.scene).toContain('caught the early bus');
        } else ordinary(s);
      }
    }
  }
  console.log(
    'actual openings',
    opened.filter((o) => ['handover-5', 'bowl-5', 'bus-16', 'photos-16'].includes(o.id)),
  );
  const handover = opened.findIndex((o) => o.id === 'handover-5');
  const bowling = opened.findIndex((o) => o.id === 'bowl-5');
  expect.soft(handover).toBeLessThan(bowling);
  expect.soft(opened[handover]?.at).toBe(15 * 60 + 20);
  expect
    .soft(opened.findIndex((o) => o.id === 'bus-16'))
    .toBeLessThan(opened.findIndex((o) => o.id === 'photos-16'));
  expect.soft(opened.find((o) => o.id === 'bus-16')?.at).toBe(18 * 60 + 15);
  expect.soft(opened.find((o) => o.id === 'photos-16')?.at).toBeGreaterThanOrEqual(18 * 60 + 40);
  expect([...seen]).toEqual([15, 16, 17, 18, 19, 20]);
  expect(canAnotherWeek(s)).toBe(false);
  const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
  if (rebuilt.phase === 'day') step(rebuilt);
  expect(cloneState(rebuilt)).toEqual(cloneState(s));
}, 20_000);
