import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import type { GameState, Input } from '../src/sim/types.ts';

const canonical = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : x;
const hash = (s: GameState) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(cloneState(s))))
    .digest('hex');
interface Checkpoint {
  minute: number;
  inputs: Input[];
  hash: string;
  after37: string;
}
const rows = JSON.parse(
  readFileSync(new URL('./fixtures/edition021-hashes.json', import.meta.url), 'utf8'),
) as {
  seed: number;
  policy: string;
  version: string;
  minute: number;
  inputs: Input[];
  hash: string;
  checkpoints: Checkpoint[];
}[];
describe('edition boundaries', () => {
  it('starts new weeks on the listening edition', () => {
    expect(newGame(7).version).toBe('0.3.0');
  });
  for (const row of rows)
    it(`preserves full legacy ${row.seed}/${row.policy} and restored continuations`, () => {
      const final = replay(row.seed, row.inputs, row.minute, row.version);
      while (final.phase === 'day') step(final);
      expect(hash(final)).toBe(row.hash);
      for (const c of row.checkpoints) {
        const s = replay(row.seed, c.inputs, c.minute, row.version);
        expect(hash(s)).toBe(c.hash);
        const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
        for (let i = 0; i < 37; i++) step(restored);
        expect(hash(restored)).toBe(c.after37);
      }
    });
  it('replays and restores the new edition including its RNG and remembered words', () => {
    const s = newGame(42);
    for (let i = 0; i < 12; i++) {
      if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      runToCard(s);
      const option = cardView(s)?.options.find((o) => !o.isPull);
      if (option) queueInput(s, { kind: 'say', option: option.id });
    }
    const r = replay(s.seed, s.inputs, s.minute, s.version);
    expect(hash(r)).toBe(hash(s));
    const restored = restoreState(cloneState(s));
    for (let i = 0; i < 200; i++) {
      step(s);
      step(restored);
    }
    expect(hash(restored)).toBe(hash(s));
  });
});
