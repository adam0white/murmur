import { cardView, newGame, queueInput, runToCard, step, WEEK_TWO_EDITION } from './game.ts';
import type { GameState } from './types.ts';

/** A played first week, built through the same inputs as a player and ready for another week. */
export function playedFirstWeek(seed: number): GameState {
  const state = newGame(seed, WEEK_TWO_EDITION);
  while (state.phase !== 'end') {
    if (state.phase === 'evening') {
      queueInput(state, { kind: 'next' });
      continue;
    }
    runToCard(state);
    const card = cardView(state);
    if (!card) continue;
    const option = card.options.find(
      (option) =>
        !option.isPull &&
        (option.likelihood !== undefined
          ? option.likelihood >= 0.5
          : option.lean === 'yes' || option.lean === 'if pushed'),
    );
    queueInput(state, option ? { kind: 'say', option: option.id } : { kind: 'quiet' });
    step(state);
  }
  return state;
}
