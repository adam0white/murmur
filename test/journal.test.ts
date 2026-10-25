import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  fingerprint,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import { answerRecord, momentRecord, momentRecords } from '../src/ui/journal.ts';

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('Expected a value');
  return value;
}

function first(option?: string): GameState {
  const s = newGame(9, '0.2.1');
  runToCard(s);
  queueInput(s, option ? { kind: 'say', option } : { kind: 'quiet' });
  return s;
}

describe('persistent moment records', () => {
  it('keeps a refused suggestion beside the actual choice after the next card opens', () => {
    const s = first('up');
    const answer = required(s.answer);
    const immediate = required(answerRecord(s, answer));
    expect(immediate.said).toEqual({ id: 'up', ink: 'Get up and put your feet on the floor.' });
    expect(immediate.chosen).toEqual({ id: 'snooze', ink: 'Sleep for five more minutes.' });
    expect(immediate.completed).toBe(false);
    runToCard(s);
    expect(s.answer).toBeNull();
    const historical = required(momentRecord(s, immediate.sceneAt));
    expect(historical.answer).toEqual(answer);
    expect(historical.said).toEqual(immediate.said);
    expect(historical.completed).toBe(true);
    expect(historical.done?.text).toContain('slept through');
  });

  it('preserves acceptance and a held suggestion', () => {
    const s = newGame(9, '0.2.1');
    runToCard(s);
    queueInput(s, { kind: 'say', option: 'snooze', insist: true });
    const record = required(answerRecord(s, required(s.answer)));
    expect(record.said).toEqual(record.chosen);
    expect(record.insisted).toBe(true);
    expect(record.quiet).toBeNull();
  });

  it('distinguishes explicit silence from the clock running out', () => {
    const quiet = first();
    expect(answerRecord(quiet, required(quiet.answer))?.quiet).toBe('explicit');
    const timeout = newGame(9, '0.2.1');
    runToCard(timeout);
    while (timeout.card) step(timeout);
    const record = required(answerRecord(timeout, required(timeout.answer)));
    expect(record.quiet).toBe('timeout');
    expect(record.said).toBeUndefined();
    expect(record.chosen.id).toBe(timeout.answer?.chosen);
  });

  it('does not reveal the unresolved card as a choice', () => {
    const s = newGame(9, '0.2.1');
    runToCard(s);
    expect(momentRecords(s)).toEqual([]);
    expect(momentRecord(s, required(s.card).openedAt)).toBeUndefined();
  });

  it('uses the original conditional option ink even if later flags differ', () => {
    const s = newGame(9, '0.2.1');
    for (let guard = 0; guard < 100; guard++) {
      if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      runToCard(s);
      if (s.card?.moment === 'lunch-3') break;
      const v = cardView(s);
      if (!v) continue;
      queueInput(s, { kind: 'say', option: required(v.options[0]).id });
    }
    expect(s.card?.moment).toBe('lunch-3');
    const option = required(required(cardView(s)).options.find((o) => o.id === 'defend'));
    expect(option).toBeDefined();
    queueInput(s, { kind: 'say', option: option.id });
    const a = required(s.answer);
    s.flags.eceBlamed = !s.flags.eceBlamed;
    expect(answerRecord(s, a)?.said?.ink).toBe(option.ink);
  });

  it('keeps every resolved scene through evening transitions and the final page', () => {
    const s = newGame(9, '0.2.1');
    for (let guard = 0; guard < 120 && s.phase !== 'end'; guard++) {
      if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
    expect(s.phase).toBe('end');
    const records = momentRecords(s);
    expect(records).toHaveLength(Object.keys(s.chosen).length);
    expect(records.every((r) => r.quiet === 'explicit')).toBe(true);
    expect(records.slice(0, -1).every((r) => r.completed)).toBe(true);
    expect(Object.fromEntries(records.map((r) => [r.moment, r.chosen.id]))).toEqual(s.chosen);
  });

  it('reconstructs after restore without changing the run, export, or continuation', () => {
    const s = first('up');
    runToCard(s);
    const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
    const before = JSON.stringify(cloneState(restored));
    expect(momentRecords(restored)).toEqual(momentRecords(s));
    expect(JSON.stringify(cloneState(restored))).toBe(before);
    const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
    expect(fingerprint(rebuilt)).toBe(fingerprint(s));
    queueInput(restored, { kind: 'quiet' });
    queueInput(rebuilt, { kind: 'quiet' });
    expect(fingerprint(restored)).toBe(fingerprint(rebuilt));
  });
});
