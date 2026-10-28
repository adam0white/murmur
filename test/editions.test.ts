import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  GAME_VERSION,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/legacy/game.ts';
import type { GameState } from '../src/legacy/types.ts';

function answer(s: GameState): void {
  if (s.phase === 'evening') queueInput(s, { kind: 'next' });
  runToCard(s);
  const option = cardView(s)?.options.find((o) => !o.isPull);
  if (option) queueInput(s, { kind: 'say', option: option.id });
}

describe('current edition replay boundaries', () => {
  it('starts fresh games on the explicitly versioned one-cast edition', () => {
    expect(GAME_VERSION).toBe('0.6.1');
    expect(newGame(7).version).toBe(GAME_VERSION);
    // Retained authored editions are selectable; no old HF snapshot compatibility is claimed.
    expect(newGame(7, '0.3.0').version).toBe('0.3.0');
  });

  it.each([7, 31, 42])(
    'pins complete current replay and resumed continuation: seed %s',
    (seed) => {
      const s = newGame(seed);
      for (const checkpoint of [3, 8, 14]) {
        while (s.inputs.length < checkpoint) answer(s);
        const saved = JSON.parse(JSON.stringify(cloneState(s))) as GameState;
        const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
        expect(cloneState(rebuilt)).toEqual(saved);
        const restored = restoreState(saved);
        expect(cloneState(restored)).toEqual(saved);
        expect(restored.person.rng).toEqual(s.person.rng);
        for (let i = 0; i < 37; i++) {
          step(s);
          step(restored);
          step(rebuilt);
        }
        expect(cloneState(restored)).toEqual(cloneState(s));
        expect(cloneState(rebuilt)).toEqual(cloneState(s));
        // Exercise further actual inputs after loading, rather than only an idle snapshot round trip.
        answer(s);
        answer(restored);
        answer(rebuilt);
        expect(cloneState(restored)).toEqual(cloneState(s));
        expect(cloneState(rebuilt)).toEqual(cloneState(s));
      }
    },
    60_000,
  );
});
