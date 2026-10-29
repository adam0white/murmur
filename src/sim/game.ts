/** Dispatch pinned historical editions to their original simulation and engine. */

import * as legacy from '../legacy/game.ts';
import { isHf4Edition } from './edition.ts';
import * as current from './game-hf4.ts';

export type { CardView, Lean } from './game-hf4.ts';
export {
  clock,
  DAY_NAMES,
  GAME_VERSION,
  LEGACY_VERSION,
  NEXT_VERSION,
  PRACTICE_HALF_LIFE_DAYS,
  WEEK_TWO_EDITION,
  weekdayOf,
  weekOf,
} from './game-hf4.ts';

const isCurrent = isHf4Edition;
export const isEdition = (version: string) => isCurrent(version) || legacy.isEdition(version);
export const listens: typeof current.listens = (state) =>
  isCurrent(state.version) ? current.listens(state) : legacy.listens(state);

// A historical state is passed back to its original implementation unchanged. The UI sees
// the same outer game fields; each engine owns its distinct internal person/archive shape.
const engine = (state: { version: string }) => (isCurrent(state.version) ? current : legacy);
export const newGame: typeof current.newGame = ((
  seed: number,
  version = current.GAME_VERSION,
  chapter?: unknown,
  plainEnglish?: boolean,
) =>
  isCurrent(version)
    ? current.newGame(seed, version, chapter as never, plainEnglish)
    : legacy.newGame(seed, version, chapter as never, plainEnglish)) as typeof current.newGame;
export const restoreState: typeof current.restoreState = ((state: { version: string }) =>
  engine(state).restoreState(state as never)) as typeof current.restoreState;
export const replay: typeof current.replay = ((
  seed: number,
  inputs: unknown,
  minute: number,
  version = current.GAME_VERSION,
  chapter?: unknown,
  plainEnglish?: boolean,
) =>
  isCurrent(version)
    ? current.replay(seed, inputs as never, minute, version, chapter as never, plainEnglish)
    : legacy.replay(
        seed,
        inputs as never,
        minute,
        version,
        chapter as never,
        plainEnglish,
      )) as typeof current.replay;
export const ctxOf: typeof current.ctxOf = ((s: { version: string }) =>
  engine(s).ctxOf(s as never)) as typeof current.ctxOf;
export const openMoment: typeof current.openMoment = ((s: { version: string }) =>
  engine(s).openMoment(s as never)) as typeof current.openMoment;
export const optionsOf: typeof current.optionsOf = ((s: { version: string }, m: unknown) =>
  engine(s).optionsOf(s as never, m as never)) as typeof current.optionsOf;
export const cardView: typeof current.cardView = ((s: { version: string }) =>
  engine(s).cardView(s as never)) as typeof current.cardView;
export const queueInput: typeof current.queueInput = ((s: { version: string }, input: unknown) =>
  engine(s).queueInput(s as never, input as never)) as typeof current.queueInput;
export const step: typeof current.step = ((s: { version: string }) =>
  engine(s).step(s as never)) as typeof current.step;
export const canAnotherWeek: typeof current.canAnotherWeek = ((s: { version: string }) =>
  engine(s).canAnotherWeek(s as never)) as typeof current.canAnotherWeek;
export const anotherWeek: typeof current.anotherWeek = ((s: { version: string }) =>
  engine(s).anotherWeek(s as never)) as typeof current.anotherWeek;
export const cloneState: typeof current.cloneState = ((s: { version: string }) =>
  engine(s).cloneState(s as never)) as typeof current.cloneState;
export const fingerprint: typeof current.fingerprint = ((s: { version: string }) =>
  engine(s).fingerprint(s as never)) as typeof current.fingerprint;
export const nextCardAt: typeof current.nextCardAt = ((s: { version: string }) =>
  engine(s).nextCardAt(s as never)) as typeof current.nextCardAt;
export const runToCard: typeof current.runToCard = ((s: { version: string }, max?: number) =>
  engine(s).runToCard(s as never, max)) as typeof current.runToCard;
export const insistCarries: typeof current.insistCarries = (s) =>
  isCurrent(s.version)
    ? current.insistCarries(s)
    : legacy.insistCarries((s as unknown as import('../legacy/types.ts').GameState).person);
export const trustOf: typeof current.trustOf = (s, id) =>
  isCurrent(s.version)
    ? current.trustOf(s, id)
    : legacy.trustOf((s as unknown as import('../legacy/types.ts').GameState).person, id);
