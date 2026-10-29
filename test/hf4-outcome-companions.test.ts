import { expect, it } from 'vitest';
import { newGame } from '../src/sim/game.ts';
import { playEncounter } from '../src/sim/hf4-encounter.ts';
import { OUTCOME_COMPANION_ACTIONS } from '../src/sim/outcomes.ts';

it.each([
  ['murat', OUTCOME_COMPANION_ACTIONS.bench],
  ['ece', OUTCOME_COMPANION_ACTIONS.correction],
] as const)(
  'offers the %s companion a valid outcome action',
  (person, action) => {
    const s = newGame(17, '0.10.2');
    // Place the encounter in a free interval before the next ordinary companion offer.
    s.hf.nextCompanionEvent = 2;
    expect(() => playEncounter(s, person, action, 20, 'depot')).not.toThrow();
    expect(s.cast?.encounters.some((e) => e.person === person)).toBe(true);
  },
  60_000,
);
