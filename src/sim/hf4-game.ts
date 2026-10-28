/** HF4 card decisions use one shared cast run and the actual authored choices. */
import type { DeepReadonly, Input, PortableAdmission, Run, StepResult } from '@adam0white/human-framework';
import { MURMUR_ACTIONS } from './hf4-actions.ts';
import { advanceHost } from './hf4-host.ts';
import { momentInputs } from './hf4-moment.ts';
import { offerForChoice } from './hf4-offers.ts';
import { createMurmurOpening } from './hf4-opening.ts';
import { type MurmurWorld, prepareChoice, settleMurmur } from './hf4-world.ts';
import type { Ctx, Opt } from './types.ts';

export interface MurmurHf4 {
  run: Run;
  host: MurmurWorld;
  offerRevision: number;
  nextCommand: number;
  nextCompanionEvent: number;
  companionRevisions: Record<string, number>;
}
export function freshMurmurHf4(
  seed: number,
  actionIds: readonly string[] = MURMUR_ACTIONS,
  portable: Record<string, PortableAdmission> = {},
): MurmurHf4 {
  const game: MurmurHf4 = {
    run: createMurmurOpening(seed, actionIds, portable),
    host: { revision: 0, active: [], completed: [] },
    offerRevision: 0,
    nextCommand: 0,
    nextCompanionEvent: 0,
    companionRevisions: { aylin: 0, ece: 0, murat: 0 },
  };
  return game;
}

/** Run one card to the actual action completion. Caller retains HF archive and its own input log. */
export function playHf4Moment(
  game: MurmurHf4,
  args: {
    cardId: string;
    at: number;
    place: string;
    options: readonly Opt[];
    context: Ctx;
    pull: { option: string; strength: number; borrowed: boolean };
    said?: { option: string; insist: boolean; strength?: number };
    fulfills: Readonly<Record<string, readonly string[]>>;
    advances?: Readonly<Record<string, readonly string[]>>;
  },
): {
  action: string | null;
  choice: string | null;
  completed: boolean;
  events: readonly DeepReadonly<StepResult['events'][number]>[];
} {
  const revision = game.offerRevision + 1;
  const card = momentInputs({ ...args, revision });
  const choices = card.offers.map((offer) => {
    const option = args.options.find((o) => o.id === offer.id);
    if (!option) throw new Error('An offered choice lacks authored outcomes');
    const actual = typeof option.gives === 'function' ? option.gives(args.context) : option.gives;
    return prepareChoice(offer, actual ?? option.advertises ?? {});
  });
  const settle = (host: MurmurWorld, request: Parameters<typeof settleMurmur>[1]) =>
    settleMurmur(host, request, choices);
  const started = advanceHost(game, args.at + 1, card.inputs, settle);
  game.offerRevision = revision + 1;
  const active = game.host.active.find((a) => a.person === 'dilan');
  if (!active) return { action: null, choice: null, completed: false, events: started.events };
  const offered = card.offers.find((o) => o.id === active.offerId);
  if (!offered) throw new Error('Started action is missing from the card');
  const finished = advanceHost(game, active.start + offered.durationMs, [], settle);
  const completed = finished.events.some(
    (event) =>
      event.data.kind === 'action-settled' &&
      event.data.activityId === active.activityId &&
      event.data.disposition === 'completed',
  );
  return {
    action: active.actionId,
    choice: active.offerId,
    completed,
    events: [...started.events, ...finished.events],
  };
}

export function playOpeningAlarm(
  game: MurmurHf4,
  options: readonly Opt[],
  at: number,
  said?: { option: string; insist: boolean },
) {
  if (!options.some((o) => o.id === 'up') || !options.some((o) => o.id === 'snooze'))
    throw new Error('The opening alarm choices are incomplete');
  return playHf4Moment(game, {
    cardId: 'opening',
    at,
    place: 'bed',
    options,
    context: {
      day: 1,
      flags: {},
      missedMum: 0,
      tired: false,
      chosen: {},
      note: '',
      week: 1,
      weekday: 1,
      phrases: [],
    },
    pull: { option: 'snooze', strength: 0.7, borrowed: false },
    said,
    fulfills: Object.fromEntries(options.filter((o) => o.action === 'get-up').map((o) => [o.id, ['alarm']])),
  });
}

/** Live one authored routine block. The caller chooses its actual start and end boundaries. */
export function playHf4Routine(
  game: MurmurHf4,
  args: {
    id: string;
    at: number;
    end: number;
    option: Opt;
    needs: Readonly<Record<string, number>>;
    mode?: 'awake' | 'sleep';
    fulfills?: readonly string[];
  },
): { completed: boolean; events: readonly DeepReadonly<StepResult['events'][number]>[] } {
  if (!Number.isSafeInteger(args.at) || !Number.isSafeInteger(args.end) || args.end <= args.at + 1)
    throw new Error('Invalid routine time span');
  const revision = game.offerRevision + 1;
  const option = { ...args.option, duration: (args.end - args.at) / 60_000 };
  const offer = offerForChoice('dilan', option, option.placeId ?? 'home', args.fulfills ?? []);
  // Preserve exact millisecond boundaries; a fractional minute round trip can introduce fractions.
  offer.durationMs = args.end - args.at;
  if (args.mode) offer.demands.mode = args.mode;
  const inputs: Input[] = [
    {
      id: `${args.id}:offers`,
      at: args.at,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person: 'dilan', revision, offers: [offer] },
    },
    {
      id: `${args.id}:close`,
      at: args.at + 1,
      source: { type: 'host', id: 'murmur' },
      kind: 'offers.received',
      payload: { person: 'dilan', revision: revision + 1, offers: [] },
    },
  ];
  const choice = prepareChoice(offer, args.needs);
  const settle = (host: MurmurWorld, request: Parameters<typeof settleMurmur>[1]) =>
    settleMurmur(host, request, [choice]);
  const result = advanceHost(game, args.end, inputs, settle);
  game.offerRevision = revision + 1;
  const requested = result.events.find(
    (event) =>
      event.data.kind === 'action-requested' &&
      event.data.request.person === 'dilan' &&
      event.data.request.offerId === offer.id &&
      event.data.request.stage === 'start',
  );
  const activityId =
    requested?.data.kind === 'action-requested' ? requested.data.request.activityId : undefined;
  const completed =
    activityId !== undefined &&
    result.events.some(
      (event) =>
        event.data.kind === 'action-settled' &&
        event.data.activityId === activityId &&
        event.data.disposition === 'completed',
    );
  return { completed, events: result.events };
}
