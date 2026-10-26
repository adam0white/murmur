import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { cloneState, queueInput, replay, restoreState, runToCard, step } from '../src/sim/game.ts';
import type { GameState, Input } from '../src/sim/types.ts';

it('retains the complete raw states captured from12914c3 and exact restored continuations', () => {
  const corpus = JSON.parse(
    readFileSync(new URL('./fixtures/next-raw-baseline.json', import.meta.url), 'utf8'),
  ) as {
    fixtures: {
      seed: number;
      version: string;
      minute: number;
      phase: string;
      inputs: Input[];
      sha256: string;
    }[];
  };
  let firstWeek: GameState | undefined;
  for (const f of corpus.fixtures) {
    // The two-week fixture extends the already verified first week. Play its actual suffix once.
    let s: GameState;
    if (firstWeek && f.version === firstWeek.version && f.seed === firstWeek.seed) {
      s = firstWeek;
      expect(f.inputs.slice(0, s.inputs.length)).toEqual(s.inputs);
      const suffix = f.inputs.slice(s.inputs.length);
      for (const { at, ...input } of suffix) {
        if (input.kind === 'next' && s.phase === 'day') runToCard(s);
        while (s.phase === 'day' && s.minute < at) step(s);
        expect(s.minute).toBe(at);
        queueInput(s, input);
      }
      while (s.phase === 'day' && s.minute < f.minute) step(s);
    } else s = replay(f.seed, f.inputs, f.minute, f.version);
    if (f.phase !== 'day' && s.phase === 'day') step(s);
    // Reuse the same complete JSON snapshot for its raw hash and persisted restore.
    const saved = canonicalPersona(cloneState(s));
    expect(createHash('sha256').update(saved).digest('hex')).toBe(f.sha256);
    const restored = restoreState(JSON.parse(saved));
    for (let i = 0; i < 37; i++) {
      step(s);
      step(restored);
    }
    expect(canonicalPersona(cloneState(restored))).toBe(canonicalPersona(cloneState(s)));
    if (f.version === '0.6.0' && s.phase === 'end') firstWeek = s;
  }
});
