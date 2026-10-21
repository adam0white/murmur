import { describe, expect, it } from 'vitest';
import { cardView, fingerprint, queueInput, replay, runToCard, step } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';
import { doneLine, journalLines } from '../src/ui/journal.ts';

// Minimal Tuesday prefixes from the owner's runs; private replay files are not fixtures.
// r-1hc66srngy
const run1 = {
  seed: 1664725615,
  inputs: [
    { kind: 'say', option: 'up', at: 576401 },
    { kind: 'say', option: 'reply', at: 576437 },
    { kind: 'say', option: 'truth', insist: true, at: 576506 },
    { kind: 'say', option: 'talk', at: 576642 },
    { kind: 'say', option: 'defend', at: 576761 },
    { kind: 'say', option: 'walk', insist: true, at: 576921 },
    { kind: 'say', option: 'call', at: 577092 },
    { kind: 'say', option: 'sleep', at: 577292 },
    { kind: 'next', at: 577292 },
    { kind: 'say', option: 'up', at: 577841 },
    { kind: 'say', option: 'truth', at: 577946 },
    { kind: 'say', option: 'own', at: 578111 },
    { kind: 'say', option: 'sit', insist: true, at: 578201 },
  ] satisfies Input[],
};
// r-s3kb1atjbk
const run2 = {
  seed: 2036190023,
  inputs: [
    { kind: 'say', option: 'snooze', at: 576403 },
    { kind: 'say', option: 'reply', insist: true, at: 576438 },
    { kind: 'say', option: 'truth', at: 576507 },
    { kind: 'say', option: 'talk', insist: true, at: 576642 },
    { kind: 'quiet', at: 576762 },
    { kind: 'say', option: 'walk', at: 576922 },
    { kind: 'say', option: 'call', insist: true, at: 577092 },
    { kind: 'say', option: 'write', insist: true, at: 577292 },
    { kind: 'next', at: 577292 },
    { kind: 'say', option: 'up', at: 577842 },
    { kind: 'say', option: 'own', at: 577932 },
    { kind: 'say', option: 'own', at: 578112 },
    { kind: 'say', option: 'sit', insist: true, at: 578202 },
  ] satisfies Input[],
};

describe('owner replay regressions', () => {
  it('does not claim yesterday was coffee when the owner actually got the walk', () => {
    const s = replay(run1.seed, run1.inputs);
    expect(cardView(s)?.id).toBe('slump-2');
    expect(s.chosen['slump-1']).toBe('walk');
    expect(cardView(s)?.pullLine).toBe('Coffee. Get the board green.');
  });

  it('can recall yesterday’s coffee, without claiming the lost sleep was fine', () => {
    const s = replay(run2.seed, run2.inputs);
    expect(s.chosen['slump-1']).toBe('coffee'); // She declined the owner’s walk.
    expect(cardView(s)?.pullLine).toBe('Coffee. Same as yesterday.');
    delete s.chosen['slump-1'];
    expect(cardView(s)?.pullLine).toBe('Coffee. Get the board green.');
    s.chosen['slump-4'] = 'coffee'; // Another day is not yesterday.
    expect(cardView(s)?.pullLine).toBe('Coffee. Get the board green.');
  });

  it.each(['say', 'quiet', 'expiry'] as const)(
    'shows the %s completion once in the journal when it becomes due',
    (mode) => {
      const s = replay(run1.seed, run1.inputs);
      if (mode === 'say') queueInput(s, { kind: 'say', option: 'walk', insist: true });
      else if (mode === 'quiet') queueInput(s, { kind: 'quiet' });
      else while (s.card) step(s);
      const completion = s.log.find((l) => l.who === 'narrator' && l.at >= (s.answer?.at ?? Infinity));
      expect(completion).toBeDefined();
      expect(doneLine(s)).toBeUndefined(); // The activity has not finished yet.
      expect(journalLines(s)).not.toContain(completion);
      while (s.minute < (completion?.at ?? 0)) step(s);
      const before = fingerprint(s);
      expect(doneLine(s)).toBe(completion);
      expect(journalLines(s).filter((l) => l === completion)).toHaveLength(1);
      expect(fingerprint(s)).toBe(before); // Rendering never changes state or RNG.
      runToCard(s);
      expect(cardView(s)?.id).toBe('bus-2');
      expect(doneLine(s)).toBeUndefined();
      expect(journalLines(s).filter((l) => l === completion)).toHaveLength(1);
      expect(journalLines(s).at(-1)).toBe(completion);
      expect(journalLines(s).some((l) => l.at === s.card?.openedAt)).toBe(false);
    },
  );
});
