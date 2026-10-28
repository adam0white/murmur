/** Murmur's local world settles only actions it has actually offered and started. */
import type {
  ActualConsequences,
  DeepReadonly,
  HostRequest,
  Input,
  Offer,
} from '@adam0white/human-framework';
import { companionChoice } from './hf4-companions.ts';
import type { BoundarySettlement } from './hf4-host.ts';

export interface PreparedChoice {
  offer: Offer;
  actual: ActualConsequences;
}
export interface ActiveChoice {
  activityId: string;
  person: string;
  offerId: string;
  actionId: string;
  start: number;
  actual: ActualConsequences;
  fulfills: readonly string[];
  advances: readonly string[];
}
export const RECENT_COMPLETIONS = 64;
export interface MurmurWorld {
  revision: number;
  active: ActiveChoice[];
  /** Recent diagnostic names only. Complete outcomes remain in accepted HF action.resolved inputs. */
  completed: string[];
}

/** Choice data is a host fact. Pending starts and active records must be retained with the notebook. */
export function settleMurmur(
  host: MurmurWorld,
  request: DeepReadonly<HostRequest>,
  choices: readonly PreparedChoice[],
): BoundarySettlement<MurmurWorld> {
  if (request.kind !== 'action')
    throw new Error('Murmur has no declared communication transport for this request');
  const envelope = {
    id: `murmur:receipt:${request.id}`,
    at: request.boundaryAt,
    source: { type: 'host' as const, id: 'murmur' },
  };
  const common = {
    requestId: request.id,
    requestHash: request.requestHash,
    person: request.person,
    activityId: request.activityId,
    stage: request.stage,
    worldRevision: host.revision,
    observations: [],
  };
  if (request.stage === 'start') {
    const choice =
      choices.find((c) => c.offer.id === request.offerId && c.offer.person === request.person) ??
      companionChoice(request.person, request.offerId);
    if (!choice)
      return {
        host,
        input: { ...envelope, kind: 'action.resolved', payload: { ...common, disposition: 'rejected' } },
      };
    host.active.push({
      activityId: request.activityId,
      person: request.person,
      offerId: choice.offer.id,
      actionId: choice.offer.actionId,
      start: request.boundaryAt,
      actual: structuredClone(choice.actual),
      fulfills: [...choice.offer.fulfills],
      advances: [...choice.offer.advances],
    });
    const prior = host.revision++;
    return {
      host,
      input: {
        ...envelope,
        kind: 'action.resolved',
        payload: { ...common, disposition: 'accepted', worldChange: worldChange(host, prior) },
      },
    };
  }
  const index = host.active.findIndex(
    (a) => a.activityId === request.activityId && a.person === request.person,
  );
  const active = host.active[index];
  if (!active) throw new Error('The notebook lacks the accepted active action');
  host.active.splice(index, 1);
  const status = request.stage === 'finish' ? 'completed' : 'interrupted';
  if (status === 'completed') {
    host.completed.push(active.actionId);
    if (host.completed.length > RECENT_COMPLETIONS)
      host.completed.splice(0, host.completed.length - RECENT_COMPLETIONS);
  }
  const prior = host.revision++;
  const input: Input<'action.resolved'> = {
    ...envelope,
    kind: 'action.resolved',
    payload: {
      ...common,
      disposition: status,
      outcome: {
        activityId: active.activityId,
        offerId: active.offerId,
        actionId: active.actionId,
        start: active.start,
        end: request.boundaryAt,
        status,
        evidenceId: `murmur:outcome:${request.id}`,
        actual: status === 'completed' ? active.actual : { exposures: [], observedProgress: [] },
        fulfills: status === 'completed' ? active.fulfills : [],
        advances: status === 'completed' ? active.advances : [],
      },
      worldChange: worldChange(host, prior),
    },
  };
  return { host, input };
}
function worldChange(host: MurmurWorld, expectedRevision: number) {
  // Copy through JSON to keep the world state detached and free of undefined fields.
  return {
    expectedRevision,
    revision: host.revision,
    put: [],
    remove: [],
    hostState: JSON.parse(JSON.stringify({ active: host.active, completed: host.completed })),
  };
}

/** Record the authored result of this particular choice before its start is accepted. */
export function prepareChoice(offer: Offer, needs: Readonly<Record<string, number>>): PreparedChoice {
  const psychological: NonNullable<ActualConsequences['psychological']> = {};
  for (const key of [
    'safety',
    'belonging',
    'esteem',
    'autonomy',
    'competence',
    'leisure',
    'meaning',
  ] as const) {
    const value = needs[key];
    if (value !== undefined) psychological[key] = value;
  }
  const consumed: NonNullable<ActualConsequences['consumed']> = {};
  for (const key of ['food', 'water', 'relief'] as const) {
    const value = needs[key];
    if (value !== undefined) consumed[key] = value;
  }
  return {
    offer,
    actual: {
      psychological,
      ...(Object.keys(consumed).length ? { consumed } : {}),
      exposures: [],
      observedProgress: [],
    },
  };
}

/** Decode the finite host state from a restored archive; reject missing or extra fields. */
export function decodeMurmurWorld(
  archive: DeepReadonly<import('@adam0white/human-framework').RunArchive>,
): MurmurWorld {
  if (archive.host.id !== 'murmur' || archive.host.schema !== 'murmur-hf4/1')
    throw new Error('Unsupported Murmur notebook');
  const raw = archive.current.world.hostState;
  const object = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x);
  const keys = (x: Record<string, unknown>, expected: string[]) =>
    Object.keys(x).sort().join(',') === [...expected].sort().join(',');
  const strings = (x: unknown): x is string[] =>
    Array.isArray(x) && x.every((item) => typeof item === 'string' && item.length > 0);
  const numeric = (x: unknown, allowed: readonly string[], min: number) =>
    object(x) &&
    Object.entries(x).every(
      ([key, value]) =>
        allowed.includes(key) &&
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= min &&
        value <= 1,
    );
  if (
    !object(raw) ||
    !keys(raw, ['active', 'completed']) ||
    !Array.isArray(raw.active) ||
    !strings(raw.completed) ||
    raw.completed.length > RECENT_COMPLETIONS
  )
    throw new Error('Invalid Murmur world state');
  const active: ActiveChoice[] = raw.active.map((item) => {
    if (
      !object(item) ||
      !keys(item, [
        'activityId',
        'person',
        'offerId',
        'actionId',
        'start',
        'actual',
        'fulfills',
        'advances',
      ]) ||
      !['activityId', 'person', 'offerId', 'actionId'].every(
        (key) => typeof item[key] === 'string' && (item[key] as string).length > 0,
      ) ||
      !Number.isSafeInteger(item.start) ||
      !strings(item.fulfills) ||
      !strings(item.advances) ||
      !object(item.actual)
    )
      throw new Error('Invalid Murmur active action');
    const actual = item.actual;
    const allowed = ['psychological', 'consumed', 'exposures', 'observedProgress'];
    if (
      Object.keys(actual).some((key) => !allowed.includes(key)) ||
      !Array.isArray(actual.exposures) ||
      actual.exposures.length !== 0 ||
      !Array.isArray(actual.observedProgress) ||
      actual.observedProgress.length !== 0 ||
      (actual.psychological !== undefined &&
        !numeric(
          actual.psychological,
          ['safety', 'belonging', 'esteem', 'autonomy', 'competence', 'leisure', 'meaning'],
          -1,
        )) ||
      (actual.consumed !== undefined && !numeric(actual.consumed, ['food', 'water', 'relief'], 0))
    )
      throw new Error('Invalid Murmur action outcome');
    return {
      activityId: item.activityId as string,
      person: item.person as string,
      offerId: item.offerId as string,
      actionId: item.actionId as string,
      start: item.start as number,
      actual: structuredClone(actual) as ActualConsequences,
      fulfills: [...item.fulfills],
      advances: [...item.advances],
    };
  });
  if (new Set(active.map((a) => a.activityId)).size !== active.length)
    throw new Error('Duplicate active action');
  return { revision: archive.current.world.revision, active, completed: [...raw.completed] };
}
