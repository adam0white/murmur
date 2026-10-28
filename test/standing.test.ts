import { expect, it } from 'vitest';
import { cardView, fingerprint, newGame, queueInput, runToCard, step } from '../src/legacy/game.ts';
import { weekStanding } from '../src/legacy/standing.ts';
import type { GameState } from '../src/legacy/types.ts';

function week(seed: number, say: (s: GameState) => { option: string; insist?: boolean } | null) {
  const s = newGame(seed);
  for (let g = 0; g < 2000 && s.phase !== 'end'; g++) {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    if (!s.card) continue;
    const said = say(s);
    if (said) queueInput(s, { kind: 'say', ...said });
    else while (s.card) step(s);
  }
  return s;
}

it('a careless week slips with a named cost; a careful week holds; reading it changes nothing', () => {
  const careless = week(2003, (s) => ({ option: cardView(s)!.pullTo }));
  const before = fingerprint(careless);
  const lost = weekStanding(careless);
  expect(fingerprint(careless)).toBe(before);
  expect(lost?.kind).toBe('slipped');
  expect(lost?.line).toMatch(/written warning|Aylin rang/);

  const careful = week(2003, (s) => {
    const first = cardView(s)?.options.find((o) => !o.isPull);
    return first ? { option: first.id, insist: true } : null;
  });
  expect(weekStanding(careful)?.kind).toBe('kept');
});
