/** Translate an authored Murmur choice at the boundary; all actor scoring remains in HF. */
import type { Offer } from '@adam0white/human-framework';
import type { Opt } from './types.ts';

const MINUTE_MS = 60_000;

export function offerForChoice(
  person: string,
  choice: Opt,
  place: string,
  fulfills: readonly string[],
  advances: readonly string[] = [],
): Offer {
  return {
    id: choice.id,
    actionId: choice.action,
    label: choice.label,
    person,
    durationMs: choice.duration * MINUTE_MS,
    place: choice.placeId ?? place,
    participants: [],
    alongside: [],
    demands: { effort: choice.effort ?? 0.05, focus: choice.focus ?? 0, mode: 'awake', requires: {} },
    tags: choice.tags ?? [],
    norms: choice.norms ?? [],
    expected: {
      needs: choice.advertises ?? {},
      followedBy: (choice.followedBy ?? []).map(({ duration, ...other }) => ({
        ...other,
        durationMs: duration * MINUTE_MS,
      })),
      provenance: ['murmur:authored-choice'],
    },
    fulfills,
    advances,
    diminishes: [],
  };
}
