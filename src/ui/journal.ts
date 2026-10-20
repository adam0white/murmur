import { DAY0 } from '../sim/dilan.ts';
import type { Answer, GameState, LogLine } from '../sim/types.ts';

/** The outcome becomes visible when the sim clock reaches its completion. */
export function doneLine(s: GameState, a: Answer | null = s.answer): LogLine | undefined {
  if (!a) return undefined;
  return s.log.find((l) => l.who === 'narrator' && l.at >= a.at && l.at <= s.minute);
}

/** Today's journal; the current card and reply stay below it until the next card opens. */
export function journalLines(s: GameState): LogLine[] {
  const done = s.card ? undefined : doneLine(s);
  return s.log.filter(
    (l) =>
      Math.floor((l.at - DAY0) / 1440) + 1 === s.day &&
      l.at <= s.minute &&
      l !== done &&
      // Her unprompted phrase also appears in the reply below the card.
      !(done && s.answer?.turnedAlone && l.who === 'dilan' && l.at === done.at) &&
      !(s.card && l.at === s.card.openedAt && (l.who === 'scene' || l.who === 'pull')),
  );
}
