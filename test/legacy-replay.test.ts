import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cloneState, GAME_VERSION, replay, restoreState, step } from '../src/legacy/game.ts';
import type { Input } from '../src/legacy/types.ts';

it('replays the historical input corpus under the current edition and continues its current save exactly', () => {
  // Only the ordinary inputs are reused. HF2.8 state/hash fixtures are not a compatibility contract.
  const corpus = JSON.parse(
    readFileSync(new URL('./fixtures/clarity-legacy.json', import.meta.url), 'utf8'),
  ) as { seed: number; inputs: Input[]; minute: number };
  const inputs = structuredClone(corpus.inputs);
  const direct = replay(corpus.seed, inputs, corpus.minute, GAME_VERSION);
  const reconstructed = replay(corpus.seed, inputs, corpus.minute, GAME_VERSION);
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(direct))));
  expect(direct.version).toBe(GAME_VERSION);
  expect(direct.inputs).toEqual(corpus.inputs);
  expect(cloneState(reconstructed)).toEqual(cloneState(direct));
  for (let i = 0; i < 37; i++) {
    step(direct);
    step(reconstructed);
    step(restored);
  }
  expect(cloneState(restored)).toEqual(cloneState(direct));
  expect(cloneState(reconstructed)).toEqual(cloneState(direct));
  expect(inputs).toEqual(corpus.inputs);
});
