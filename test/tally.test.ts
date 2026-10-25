import { expect, it } from 'vitest';
import { dayStart } from '../src/sim/dilan.ts';
import { cloneState, newGame } from '../src/sim/game.ts';
import { notebookTally } from '../src/ui/tally.ts';

it('counts only player process inputs at a clear ending, without changing state', () => {
  const s = newGame(42);
  s.inputs = [
    { kind: 'say', at: dayStart(1) + 1, option: 'up' },
    { kind: 'say', at: dayStart(1) + 2, option: 'up', insist: true },
    { kind: 'quiet', at: dayStart(1) + 3 },
    { kind: 'next', at: dayStart(1) + 4 },
  ];
  expect(notebookTally(s, true)).toBe('');
  s.phase = 'end';
  s.final = {
    note: '',
    sent: '',
    phrases: [],
    unasked: [],
    threads: [],
    strip: [],
    hands: { start: { you: 0, pull: 0 }, end: { you: 0, pull: 0 } },
    line: '',
  };
  const before = cloneState(s);
  expect(notebookTally(s, false)).toBe('');
  expect(notebookTally(s, true)).toContain(
    'Total: 3 recorded choices = 1 suggestion + 1 time you insisted + 1 time you chose to say nothing.',
  );
  expect(cloneState(s)).toEqual(before);
});

it('excludes the first week from the second ending, including a prepared first week', () => {
  const s = newGame(42);
  s.day = 13;
  s.phase = 'end';
  s.final = {} as NonNullable<typeof s.final>;
  s.inputs = [
    { kind: 'quiet', at: dayStart(1) },
    { kind: 'quiet', at: dayStart(8) },
  ];
  expect(notebookTally(s, true)).toContain(
    'Total: 1 recorded choice = 0 suggestions + 0 times you insisted + 1 time you chose to say nothing.',
  );
});
