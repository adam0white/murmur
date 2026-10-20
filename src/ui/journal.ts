import { DAY0 } from '../sim/dilan.ts';
import { ctxOf, newGame, openMoment, optionsOf, queueInput, step } from '../sim/game.ts';
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

export interface MomentRecord {
  moment: string;
  sceneAt: number;
  scene: string;
  answer: Answer;
  said?: { id: string; ink: string };
  chosen: { id: string; ink: string };
  insisted: boolean;
  quiet: 'explicit' | 'timeout' | null;
  done?: LogLine;
  completed: boolean;
}

/**
 * Rebuild all resolved moments in one pass. Read option text before resolve changes flags,
 * and keep future narrator lines hidden until the player's clock reaches them.
 * Call once when rendering a changed journal, then index by sceneAt.
 */
export function momentRecords(s: GameState): MomentRecord[] {
  const history = newGame(s.seed, s.version);
  const records: MomentRecord[] = [];
  const advance = (action: () => void, quiet: 'explicit' | 'timeout' | null) => {
    const card = history.card;
    const m = openMoment(history);
    const c = ctxOf(history);
    const options = m ? optionsOf(history, m) : [];
    const ink = (id: string) => {
      const option = options.find((o) => o.id === id);
      return option ? { id, ink: typeof option.ink === 'function' ? option.ink(c) : option.ink } : undefined;
    };
    // Materialize conditional text before action mutates c.flags or c.chosen.
    const words = new Map(options.map((o) => [o.id, ink(o.id)]));
    const logLength = history.log.length;
    action();
    const answer = history.answer;
    if (!card || history.card || !answer || answer.moment !== card.moment) return;
    const chosen =
      words.get(answer.chosen) ??
      (answer.chosen === 'none' ? { id: 'none', ink: 'Stay where she is.' } : undefined);
    if (!chosen) return;
    const done = history.log.slice(logLength).find((l) => l.who === 'narrator');
    records.push({
      moment: answer.moment,
      sceneAt: card.openedAt,
      scene: history.log.find((l) => l.who === 'scene' && l.at === card.openedAt)?.text ?? '',
      answer,
      said: answer.said ? words.get(answer.said) : undefined,
      chosen,
      insisted: answer.insisted === true,
      quiet: answer.said ? null : quiet,
      done: done && done.at <= s.minute ? done : undefined,
      completed: done !== undefined && done.at <= s.minute,
    });
  };
  const minute = () => {
    if (history.card && history.minute >= history.card.closesAt) advance(() => step(history), 'timeout');
    else step(history);
  };
  for (const input of s.inputs.slice(0, s.applied)) {
    // This is replay's evening rule: next can share the last answer's minute.
    while (history.phase === 'day' && (history.minute < input.at || input.kind === 'next')) minute();
    advance(() => queueInput(history, input), input.kind === 'quiet' ? 'explicit' : null);
  }
  while (history.phase === 'day' && history.minute < s.minute) minute();
  return records;
}

/** A journal scene boundary's resolved suggestion and choice. */
export function momentRecord(s: GameState, sceneAt: number): MomentRecord | undefined {
  return momentRecords(s).find((record) => record.sceneAt === sceneAt);
}

/** The same record while the latest answer is still below the current card. */
export function answerRecord(s: GameState, a: Answer): MomentRecord | undefined {
  return momentRecords(s).find((record) => record.moment === a.moment && record.answer.at === a.at);
}
