import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { cloneState, replay, restoreState, step } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';

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
  for (const f of corpus.fixtures) {
    const s = replay(f.seed, f.inputs, f.minute, f.version);
    if (f.phase !== 'day' && s.phase === 'day') step(s);
    expect(
      createHash('sha256')
        .update(canonicalPersona(cloneState(s)))
        .digest('hex'),
    ).toBe(f.sha256);
    const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
    for (let i = 0; i < 37; i++) {
      step(s);
      step(restored);
    }
    expect(cloneState(restored)).toEqual(cloneState(s));
  }
});
