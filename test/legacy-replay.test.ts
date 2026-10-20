import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { cloneState, replay, step } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';

it('exactly replays and continues the pre-clarity 0.2.1 export prefix', () => {
  const old = JSON.parse(
    readFileSync(new URL('./fixtures/clarity-legacy.json', import.meta.url), 'utf8'),
  ) as {
    seed: number;
    inputs: Input[];
    minute: number;
    hash: string;
    continuation: string;
  };
  const s = replay(old.seed, old.inputs, old.minute);
  const hash = () =>
    createHash('sha256')
      .update(JSON.stringify(cloneState(s)))
      .digest('hex');
  expect(hash()).toBe(old.hash);
  for (let i = 0; i < 37; i++) step(s);
  expect(hash()).toBe(old.continuation);
});
