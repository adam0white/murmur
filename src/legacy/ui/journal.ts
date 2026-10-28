import { restore } from '@adam0white/human-framework-legacy';
import { DAY0 } from '../dilan.ts';
import { ctxOf, newGame, openMoment, optionsOf, queueInput, step } from '../game.ts';
import type { Answer, GameState, LogLine } from '../types.ts';

/** The outcome becomes visible when the sim clock reaches its completion. */
export function doneLine(s: GameState, a: Answer | null = s.answer): LogLine | undefined {
  if (!a) return undefined;
  return s.log.find((l) => l.who === 'narrator' && l.at >= a.at && l.at <= s.minute);
}

/** Today's journal; only the still-open scene and pull remain on the choice card. */
export function journalLines(s: GameState): LogLine[] {
  return s.log.filter(
    (l) =>
      Math.floor((l.at - DAY0) / 1440) + 1 === s.day &&
      l.at <= s.minute &&
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
  chosenAction: string;
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
  const history = newGame(s.seed, s.version, s.castChapter, s.person.lexicon?.plainEnglish ?? false);
  const source = s.castChapter?.resume?.source;
  const inherited = source?.inputs.length ?? 0;
  const records: MomentRecord[] = source ? momentRecords(source) : [];
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
      chosenAction: options.find((o) => o.id === answer.chosen)?.action ?? '',
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
  for (const [index, input] of s.inputs.slice(inherited, s.applied).entries()) {
    if (s.returnChapter && index + inherited === s.returnChapter.prefixInputs.length)
      history.person = restore(s.returnChapter.initialPerson);
    // This is replay's evening rule: next can share the last answer's minute.
    while (
      history.phase === 'day' &&
      (history.minute < input.at ||
        input.kind === 'next' ||
        input.kind === 'one-cast-release' ||
        input.kind === 'cast-pause')
    )
      minute();
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
