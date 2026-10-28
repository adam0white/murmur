/** Conditional card readings use HF's detached preview and the person's own evidence. */
import { preview } from '@adam0white/human-framework';
import type { MurmurHf4 } from './hf4-game.ts';
import { momentInputs } from './hf4-moment.ts';
import { readDilan } from './hf4-read.ts';
import type { Opt } from './types.ts';

export function previewChoice(
  game: MurmurHf4,
  args: {
    cardId: string;
    at: number;
    place: string;
    options: readonly Opt[];
    pull: { option: string; strength: number; borrowed: boolean };
    said: { option: string; insist: boolean };
    fulfills: Readonly<Record<string, readonly string[]>>;
    advances?: Readonly<Record<string, readonly string[]>>;
  },
) {
  const at = Math.max(args.at, readDilan(game.run).at + 1);
  const card = momentInputs({
    ...args,
    at,
    cardId: `preview:${args.cardId}:${args.said.option}:${args.said.insist ? 'hold' : 'tap'}`,
    revision: game.offerRevision + 1,
  });
  const inputs = card.inputs
    .filter((entry) => entry.at === at)
    .map((entry) => ({ ...entry, source: { type: 'host' as const, id: 'murmur' } }));
  const result = preview(game.run, {
    perspective: { kind: 'person', observer: 'dilan' },
    person: 'dilan',
    until: at + 1,
    inputs,
  });
  if (!result.ok) return undefined;
  const event = result.value.possibilities.find(
    (item) => item.data.kind === 'suggestion-resolved' && item.data.resolution.voiceId === 'you',
  );
  return event?.data.kind === 'suggestion-resolved' ? event.data.resolution : undefined;
}
