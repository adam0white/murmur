/** Authored offscreen routines for the three other cast members. HF decides and the host settles each act. */
import type { Input, Offer } from '@adam0white/human-framework';
import type { PreparedChoice } from './hf4-world.ts';

const MINUTE = 60_000;
const DAY = 86_400_000;
const SLOT = 30 * MINUTE + 1;
const START = (400 * 1440 + 6 * 60 + 39) * MINUTE;
const roles = ['aylin', 'ece', 'murat'] as const;
const validActions = ['sleep', 'meal', 'work', 'rest'] as const;
type Action = (typeof validActions)[number];
function actionAt(at: number): Action {
  const hour = (at % DAY) / (60 * MINUTE);
  return hour < 7 || hour >= 22
    ? 'sleep'
    : (hour >= 7 && hour < 8) || (hour >= 12 && hour < 13) || (hour >= 18 && hour < 19)
      ? 'meal'
      : hour >= 8 && hour < 17
        ? 'work'
        : 'rest';
}
function scheduledOffer(person: string, at: number): Offer {
  const action = actionAt(at);
  return {
    id: `companion:${person}:${at}`,
    actionId: action,
    label: action,
    person,
    durationMs: 30 * MINUTE,
    place:
      action === 'work'
        ? person === 'aylin'
          ? 'kitchen'
          : person === 'ece'
            ? 'delivery district'
            : 'depot'
        : 'home',
    participants: [],
    alongside: [],
    demands: {
      effort: action === 'sleep' ? 0 : 0.02,
      focus: 0,
      mode: action === 'sleep' ? 'sleep' : 'awake',
      requires: {},
    },
    tags: [],
    norms: [],
    expected: {
      needs:
        action === 'meal'
          ? { food: 0.6, water: 0.7 }
          : action === 'work'
            ? { competence: 0.05, water: 0.25 }
            : { water: 0.15, autonomy: 0.1 },
      followedBy: [],
      provenance: ['murmur:companion-routine'],
    },
    fulfills: [],
    advances: [],
    diminishes: [],
  };
}
/** The identity must match one of this host's actual scheduled entries. */
export function companionChoice(person: string, offerId: string): PreparedChoice | undefined {
  if (!roles.includes(person as (typeof roles)[number])) return undefined;
  const prefix = `companion:${person}:`;
  if (!offerId.startsWith(prefix)) return undefined;
  const at = Number(offerId.slice(prefix.length));
  if (
    !Number.isSafeInteger(at) ||
    at < START + 1 ||
    (at - START - 1) % SLOT !== 0 ||
    (at - START - 1) / SLOT >= 20 * 48
  )
    return undefined;
  const offer = scheduledOffer(person, at);
  const action = offer.actionId;
  return {
    offer,
    actual: {
      psychological: action === 'work' ? { competence: 0.05 } : action === 'meal' ? {} : { autonomy: 0.1 },
      consumed:
        action === 'meal' ? { food: 0.6, water: 0.7 } : action === 'work' ? { water: 0.25 } : { water: 0.15 },
      exposures: [],
      observedProgress: [],
    },
  };
}

/** Matching offer books are actual host snapshots; each slot is closed after it is offered. */
export function companionOffersUntil(
  nextEvent: number,
  until: number,
  revisions: Record<string, number>,
): { inputs: Input[]; nextEvent: number; revisions: Record<string, number> } {
  const inputs: Input[] = [];
  revisions = { ...revisions };
  let cursor = nextEvent;
  while (cursor < 20 * 48 * 2) {
    const slot = Math.floor(cursor / 2),
      close = cursor % 2 === 1;
    const at = START + 1 + slot * SLOT + (close ? 1 : 0);
    if (at > until) break;
    for (const person of roles) {
      revisions[person] = (revisions[person] ?? 0) + 1;
      inputs.push({
        id: `companion:${person}:snapshot:${cursor}`,
        at,
        source: { type: 'host', id: 'murmur' },
        kind: 'offers.received',
        payload: { person, revision: revisions[person]!, offers: close ? [] : [scheduledOffer(person, at)] },
      });
    }
    if (!close)
      for (const person of roles)
        inputs.push({
          id: `companion:${person}:decision:${slot}`,
          at,
          source: { type: 'host', id: 'murmur' },
          kind: 'decision.requested',
          payload: {
            person,
            reason: 'ordinary life',
            treatment: 'ordinary',
            offerRevision: revisions[person]!,
          },
        });
    cursor++;
  }
  return { inputs, nextEvent: cursor, revisions };
}

/** The final page follows the current ordinary routine block, before the next offer. */
export function saturdayRoutineEndsAt(at: number): number {
  const first = START + 1;
  const slot = Math.max(0, Math.floor((at - first) / SLOT));
  const end = first + slot * SLOT + 30 * MINUTE;
  return end >= at ? end : end + SLOT;
}
