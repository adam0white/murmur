/**
 * The second week (edition 0.4.0): days 8-12 (Monday to Friday) and day 13 (Saturday morning). Content only, like
 * moments.ts. Day 7 is Sunday, lived offstage. Owned by the week-two content work; the engine reads these exports.
 *
 * Week two must honour week one's last page (`Ctx.weekOne`): every thread line and the closing line are canon.
 */
import type { GameState, Moment } from './types.ts';

/** Week two's moments, Monday (day 8) to Saturday (day 13). */
export const WEEK_TWO: Moment[] = [];

/** Her own line on a week-two evening page (the counterpart of week one's herLine). */
export function weekTwoHerLine(_s: GameState): string {
  return '';
}

/** Saturday of week two closes what the week opened, in a line each. */
export function weekTwoThreads(_s: GameState): string[] {
  return [];
}

/** The last line of week two's final page. */
export function weekTwoLine(_s: GameState): string {
  return '';
}
