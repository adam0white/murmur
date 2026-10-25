/** Read-only projections of the recorded 0.3.0 story. Never change advice or replay state. */
import { type CardView, DAY_NAMES } from '../sim/game.ts';
import { momentById } from '../sim/moments.ts';
import type { Answer, GameState } from '../sim/types.ts';
import type { MomentRecord } from './journal.ts';

/** Labels belong to recorded simulation state; only speech uses Dilan's first person. */
export function spokenAction(label: string): string {
  const firstPerson: Record<string, string> = {
    'say it was her': 'say it was me',
    'keep her head down': 'keep my head down',
    'eat at her desk': 'eat at my desk',
    'say she’s busy': 'say I’m busy',
    'check the returns herself': 'check the returns myself',
    'tell Aylin she is unsure': 'tell Aylin I’m unsure',
    'tell Ece she cannot stay': 'tell Ece I can’t stay',
    'Name the crooked support. Ask Aylin for a short practical visit.':
      'name the uneven shelf support and ask Aylin for a short visit',
    'Stay for dinner. Ask what Aylin wants to do on her own evening.':
      'stay for dinner and ask Aylin about her own evening',
    'Ask Ece where she takes a break away from the depot.':
      'ask Ece where she takes a break away from the depot',
    'Decline the extra route. Ask Murat to open the allocation record with you.':
      'decline the extra route and ask Murat to look at the delivery assignment record with me',
  };
  return firstPerson[label] ?? label;
}

/** Authored options may already carry quotation marks. Add just one pair for display. */
export function quotedWords(text: string, nested = false): string {
  const bare =
    (text.startsWith('“') && text.endsWith('”')) || (text.startsWith('"') && text.endsWith('"'))
      ? text.slice(1, -1)
      : text;
  const words = bare;
  return nested ? `‘${words}’` : `“${words}”`;
}

/** A little more of completed calls; the stored log and legacy editions stay exact. */
export function conversationWords(s: GameState, text: string): string {
  if (s.version !== '0.4.2' && s.version !== '0.5.0' && s.version !== '0.6.0') return text;
  const extra: Record<string, string> = {
    'They talked for twenty minutes. Mum told her about the neighbour’s roof. Dilan laughed twice.':
      '“He says he can patch it himself,” Mum said. “He said that before the rain, too.”',
    'Mum had bought too many tomatoes. She gave Dilan instructions for three dinners.':
      '“You can freeze it,” Mum said. “I know,” Dilan said, and wrote it down anyway.',
    'Mum put the phone down to find her glasses. Dilan could hear her asking where they were, though nobody else was there.':
      '“Are they on your head?” Dilan asked. The room went quiet. “Well, there they are,” Mum said.',
  };
  return extra[text] ? `${text} ${extra[text]}` : text;
}

type Thought = NonNullable<GameState['thoughts']>[number];
const recallOf = (t: Thought) =>
  t.action === 'call-mum'
    ? 'You told me to call Mum. I didn’t, but I thought about it. Maybe I will this time.'
    : `You said, “${t.ink}” I didn’t follow your suggestion then, but I thought about it.`;

/** surfacedAt is the first related card's recorded opening, including after import. */
export function cardThought(s: GameState, view: CardView): string | undefined {
  if (!view.recalled) return;
  const t = s.thoughts?.findLast((t) => recallOf(t) === view.recalled);
  if (!t || !s.card) return;
  return t.surfacedAt === s.card.openedAt
    ? `On ${DAY_NAMES[momentById(t.moment).day]}, you said ${quotedWords(t.ink, true)}`
    : undefined;
}

function retainedWords(t: Thought): string {
  const specific: Record<string, string> = {
    'get-up': 'I’m not ready to get up yet. I heard you, though.',
    'call-mum': 'I could make time to call Mum. I haven’t dismissed that.',
    reply: 'Aylin’s message is still there. I could tell her when I’ll be free.',
    help: 'I could make time for Ece. I haven’t forgotten what you asked.',
    defend: 'I could have spoken up when they laughed. You gave me the words.',
    walk: 'You suggested water and a walk. I wanted coffee, but I can see why you said it.',
    'own-up': 'Telling the truth would mean answering for it. I’m not ready to dismiss that.',
    write: 'The notebook is beside the bed. I could put the phone down for it.',
    'lights-out': 'I could sleep before watching another video. That would be a different end to the day.',
  };
  return (
    specific[t.action] ??
    `You suggested ${quotedWords(t.ink, true)} I could still ${spokenAction(t.label)} another time.`
  );
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
        'get-up': 'I got up and put my feet on the floor this time.',
        'call-mum': 'I called her. In the end, I followed your idea.',
        reply: 'I answered Aylin this time.',
        help: 'I made time for Ece this time.',
        walk: 'I took the walk this time.',
        defend: 'I spoke up this time.',
        'own-up': 'I told the truth this time.',
        write: 'I opened the notebook this time.',
        'lights-out': 'I put the phone down and turned out the light this time.',
      };
      lines.push(
        done[recalled.action] ?? `This time I chose to ${spokenAction(recalled.label)}. You’d asked me to.`,
      );
    } else if (record.chosen.id === 'none') {
      lines.push(`I couldn’t ${spokenAction(recalled.label)} this time. I stayed where I was.`);
    } else {
      lines.push(
        `I still didn’t ${spokenAction(recalled.label)}. This time I chose ${quotedWords(record.chosen.ink, true)}`,
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
      ? `You insisted on ${quotedWords(r.said.ink)} She went along with you.`
      : `You insisted on ${quotedWords(r.said.ink)} She chose ${quotedWords(r.chosen.ink)} anyway.`;
  return `You suggested: ${quotedWords(r.said.ink)} She chose ${quotedWords(r.chosen.ink)}`;
}
