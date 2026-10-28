/**
 * How the finished week stands: kept or slipped, and the named cost of a slipped week.
 * Scope: a pure reader of the week's evening pages. It writes nothing, so saves, exports and replay hashes are
 * unchanged. Owner aim (2026-10-27): careless play loses well over half the time, and the loss names its cost.
 */
import { LABEL } from './dilan.ts';
import { weekOf } from './game.ts';
import type { GameState } from './types.ts';

export interface WeekStanding {
  kind: 'kept' | 'slipped';
  /** One headline for the Saturday page. */
  title: string;
  /** What the week cost, or what it held, in plain words. */
  line: string;
}

/** A week slips when Dilan keeps no more than this share of her promises. */
export const SLIPPED_SHARE = 0.55;
/** Missed promises of one kind that make it the week's named cost. */
const NAMED_FROM = 3;

export function weekStanding(s: GameState): WeekStanding | null {
  if (s.phase !== 'end' || !s.final) return null;
  const pages = s.pages.filter((pg) => weekOf(pg.day) === weekOf(s.day));
  const kept = pages.reduce((n, pg) => n + pg.kept.length, 0);
  const missed = pages.flatMap((pg) => pg.missed);
  const total = kept + missed.length;
  if (total === 0) return null;
  if (kept / total > SLIPPED_SHARE)
    return {
      kind: 'kept',
      title: 'She held the week together',
      line: 'Dilan kept most of what she promised this week.',
    };
  const count = (label: string) => missed.filter((x) => x === label).length;
  const alarms = count(LABEL.alarm);
  const calls = count(LABEL.mum);
  const line =
    alarms >= NAMED_FROM && alarms >= calls
      ? 'Murat gave Dilan a written warning for oversleeping. One more late morning, and her route goes to someone else.'
      : calls >= NAMED_FROM
        ? 'Dilan missed most of her calls to Mum. Aylin rang on Saturday, angry. Mum had waited by the phone every evening.'
        : 'Dilan let too many promises slip this week. Murat and Aylin both noticed.';
  return { kind: 'slipped', title: 'The week slipped away from her', line };
}
