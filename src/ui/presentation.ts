/** Read-only projections of the recorded 0.3.0 story. Never change advice or replay state. */
import { type CardView, DAY_NAMES } from '../sim/game.ts';
import { momentById } from '../sim/moments.ts';
import type { Answer, GameState } from '../sim/types.ts';
import type { MomentRecord } from './journal.ts';
import { plainEnglish } from './plain-english.ts';

/** Authored options may already carry quotation marks. Add just one pair for display. */
export function quotedWords(text: string, nested = false): string {
  const bare =
    (text.startsWith('“') && text.endsWith('”')) || (text.startsWith('"') && text.endsWith('"'))
      ? text.slice(1, -1)
      : text;
  const words = plainEnglish(bare);
  return nested ? `‘${words}’` : `“${words}”`;
}

/** A little more of completed calls; the stored log and legacy editions stay exact. */
export function conversationWords(s: GameState, text: string): string {
  if (s.version !== '0.4.2' && s.version !== '0.5.0' && s.version !== '0.6.0') return text;
  const extra: Record<string, string> = {
    'Twenty minutes. Mum talked about the neighbour’s roof. Dilan laughed twice.':
      '“He says he can patch it himself,” Mum said. “He said that before the rain, too.”',
    'Mum had bought too many tomatoes. Dilan was given instructions for three dinners.':
      '“You can freeze it,” Mum said. “I know,” Dilan said, and wrote it down anyway.',
    'Mum put the phone down to find her glasses. Dilan could hear her asking the empty room.':
      '“On your head?” Dilan asked. The room went quiet. “Well,” Mum said.',
  };
  return extra[text] ? `${plainEnglish(text)} ${extra[text]}` : text;
}

type Thought = NonNullable<GameState['thoughts']>[number];
const recallOf = (t: Thought) =>
  t.action === 'call-mum'
    ? 'You said call Mum. I didn’t, but I thought about it. Maybe this time.'
    : `You said “${t.ink}” I didn’t then, but I thought about it.`;

/** surfacedAt is the first related card's recorded opening, including after import. */
export function cardThought(s: GameState, view: CardView): string | undefined {
  if (!view.recalled) return;
  const t = s.thoughts?.findLast((t) => recallOf(t) === view.recalled);
  if (!t || !s.card) return;
  return t.surfacedAt === s.card.openedAt
    ? `On ${DAY_NAMES[momentById(t.moment).day]} you said ${quotedWords(t.ink, true)}`
    : undefined;
}

function retainedWords(t: Thought): string {
  const specific: Record<string, string> = {
    'get-up': 'Feet on the floor. Not yet. I heard you, though.',
    'call-mum': 'I could make time to call Mum. I haven’t dismissed that.',
    reply: 'Aylin’s message is still there. I could tell her when I’ll be free.',
    help: 'Making time for Ece. I haven’t forgotten what you asked.',
    defend: 'I could have spoken up when they laughed. You gave me the words.',
    walk: 'Water and a walk. I wanted coffee, but I can see why you said it.',
    'own-up': 'Telling the truth would mean answering for it. I’m not ready to dismiss that.',
    write: 'The notebook is beside the bed. I could put the phone down for it.',
    'lights-out': 'Sleep before another video. That would be a different end to the day.',
  };
  return specific[t.action] ?? `${quotedWords(t.ink, true)} I could still ${t.label} another time.`;
}

export function answerThoughts(s: GameState, a: Answer, records: MomentRecord[]): string[] {
  const lines: string[] = [];
  const origin = s.thoughts?.find((t) => t.at === a.at && t.moment === a.moment);
  if (a.stayed && origin) lines.push(retainedWords(origin));
  const record = records.find((r) => r.answer.at === a.at && r.moment === a.moment);
  const recalled = s.thoughts?.findLast(
    (t) => t.surfacedAt === record?.sceneAt && recallOf(t) === a.recalled,
  );
  if (record && recalled) {
    if (record.chosenAction === recalled.action) {
      if (!record.completed) return lines;
      const done: Record<string, string> = {
        'get-up': 'I got up this time. Feet on the floor.',
        'call-mum': 'I called her. Your idea, in the end.',
        reply: 'I answered Aylin this time.',
        help: 'I made time for Ece this time.',
        walk: 'I took the walk this time.',
        defend: 'I spoke up this time.',
        'own-up': 'I told the truth this time.',
        write: 'I opened the notebook this time.',
        'lights-out': 'I put the phone down and turned out the light this time.',
      };
      lines.push(done[recalled.action] ?? `This time I did ${recalled.label}. You’d asked me to.`);
    } else if (record.chosen.id === 'none') {
      lines.push(`I couldn’t ${recalled.label} this time. I stayed where I was.`);
    } else {
      lines.push(
        `I still didn’t ${recalled.label}. This time I chose ${quotedWords(record.chosen.ink, true)}`,
      );
    }
  }
  return lines;
}

/** One actual learned phrase; no tally and no claim about still-pending advice. */
export function keptWords(s: GameState): string | undefined {
  return s.phrases.at(-1)?.text;
}

/** The final card's own recorded input; earlier pressure never counts here. */
export function finalInputWords(_s: GameState, records: MomentRecord[]): string | undefined {
  const r = records.findLast((r) => r.moment === 'voice-6');
  if (!r) return;
  if (!r.said)
    return r.quiet === 'timeout'
      ? `You said nothing; time ran out. She chose ${quotedWords(r.chosen.ink)}`
      : `You left it to her. She chose ${quotedWords(r.chosen.ink)}`;
  if (r.insisted)
    return r.answer.chosen === r.said.id &&
      (r.answer.verdict === 'assented' || r.answer.verdict === 'complied')
      ? `You pressed: ${quotedWords(r.said.ink)} She went along with you.`
      : `You pressed: ${quotedWords(r.said.ink)} She chose ${quotedWords(r.chosen.ink)} anyway.`;
  return `You suggested: ${quotedWords(r.said.ink)} She chose ${quotedWords(r.chosen.ink)}`;
}
