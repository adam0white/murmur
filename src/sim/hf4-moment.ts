/** Translate one live Murmur card into timestamped HF inputs. */
import type { Input, Offer } from '@adam0white/human-framework';
import { offerForChoice } from './hf4-offers.ts';
import type { Opt } from './types.ts';

export function momentInputs(args: {
  cardId: string;
  at: number;
  revision: number;
  place: string;
  options: readonly Opt[];
  pull: { option: string; strength: number; borrowed: boolean };
  said?: { option: string; insist: boolean; strength?: number };
  fulfills: Readonly<Record<string, readonly string[]>>;
  advances?: Readonly<Record<string, readonly string[]>>;
}): { offers: Offer[]; inputs: Input[] } {
  const { cardId, at, revision, options, pull, said } = args;
  if (!options.some((o) => o.id === pull.option)) throw new Error('The pull named an unavailable choice');
  if (said && !options.some((o) => o.id === said.option))
    throw new Error('The voice named an unavailable choice');
  const offers = options.map((option) =>
    offerForChoice(
      'dilan',
      option,
      args.place,
      args.fulfills[option.id] ?? [],
      args.advances?.[option.id] ?? [],
    ),
  );
  const inputs: Input[] = [
    {
      id: `${cardId}:offers`,
      at,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person: 'dilan', revision, offers },
    },
    {
      id: `${cardId}:decision`,
      at,
      source: { type: 'host', id: 'murmur' },
      kind: 'decision.requested',
      payload: { person: 'dilan', reason: cardId, treatment: 'ordinary', offerRevision: revision },
    },
    // A completed card must not recur after HF settles its chosen activity.
    {
      id: `${cardId}:close`,
      at: at + 1,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person: 'dilan', revision: revision + 1, offers: [] },
    },
  ];
  if (!(said && pull.borrowed)) {
    const voiceId = pull.borrowed ? 'you' : 'pull';
    inputs.push({
      id: `${cardId}:pull`,
      at,
      source: { type: 'voice', id: voiceId },
      kind: 'suggestion.received',
      payload: {
        person: 'dilan',
        received: {
          kind: 'ordinary',
          suggestion: {
            adviceId: `${cardId}:pull`,
            voiceId,
            affordanceId: pull.option,
            strength: pull.strength,
          },
        },
      },
    });
  }
  if (said)
    inputs.push({
      id: `${cardId}:you`,
      at,
      source: { type: 'voice', id: 'you' },
      kind: 'suggestion.received',
      payload: {
        person: 'dilan',
        received: {
          kind: 'ordinary',
          suggestion: {
            adviceId: `${cardId}:you`,
            voiceId: 'you',
            affordanceId: said.option,
            strength: said.strength ?? (said.insist ? 0.85 : 0.6),
            ...(said.insist ? { insist: true } : {}),
          },
        },
      },
    });
  return { offers, inputs };
}
