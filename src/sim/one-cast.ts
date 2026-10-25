/** Murmur's bounded, host-authored Dilan crossing. Full checkpoints stay at this origin. */
import {
  AGENDA_DEFAULTS,
  abandonGoal,
  admitPersona,
  adoptGoal,
  type Person,
  type PersonaProjectionSnapshot,
  projectPersona,
  restore,
  snapshot,
  validatePersonaProjection,
} from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import type { GameState } from './types.ts';

const SOURCE_MAPPING = 'murmur-hearsay/1';
export const RETURN_MAPPING = 'hearsay-murmur/1';
export interface DepartureReceipt {
  v: 1;
  boundaryDay: number;
  at: number;
  purposes: { id: string; label: string; progress: number }[];
  shelf: { status: 'active' | 'achieved' | 'abandoned'; progress: number } | null;
}
export interface OneCastFact {
  id: string;
  kind: 'delivery-work' | 'hearsay-encounter';
  sourceGame: 'murmur' | 'hearsay';
  episodeId: string;
  disclosed: boolean;
  outcome?: 'accepted' | 'declined';
}
export interface PersonCheckpoint {
  sourceSchema: Person['schema'];
  sourceNow: number;
  sourceRng: Person['rng'];
  checkpointDigest: string;
}
export interface DilanTransfer extends Record<string, unknown> {
  person: PersonaProjectionSnapshot;
  history: OneCastFact[];
  checkpoint: PersonCheckpoint;
  departure?: DepartureReceipt;
  admission?: { adapter: string; mapping: string; openingMinute: number };
}

function isAuthoredPurpose(g: Person['agenda']['goals'][number]): boolean {
  return Object.entries(AGENDA_DEFAULTS.goalTemplates).some(
    ([need, template]) =>
      g.label === template.label &&
      canonicalPersona(g.serves) === canonicalPersona([need]) &&
      canonicalPersona(g.advancedBy) === canonicalPersona(template.advancedBy) &&
      !g.project,
  );
}

function purposeDescription(label: string): string {
  return (
    (
      {
        'make-friend': 'making a friend',
        'master-skill': 'mastering a skill',
        serve: 'helping someone',
        'earn-respect': 'earning respect',
        'the shelf': 'the unfinished shelf',
      } as Record<string, string>
    )[label] ?? label
  );
}

export function departureReleaseDescription(s: GameState): string[] {
  return s.person.agenda.goals.filter((g) => g.status === 'active').map((g) => purposeDescription(g.label));
}

function requireBoundary(s: GameState): void {
  if (s.version !== '0.5.0' || s.phase !== 'end' || ![6, 13].includes(s.day) || s.card)
    throw new Error(
      'Dilan can leave only at a completed Saturday chapter boundary in a fresh current edition.',
    );
  if (s.person.activity) throw new Error('Dilan must finish her current activity before leaving.');
}

/** Player input, replayed at Saturday's actual boundary. No one forgives another person's promise here. */
export function releaseOneCastDeparture(s: GameState): DepartureReceipt {
  requireBoundary(s);
  if (s.oneCastDeparture) throw new Error('This departure has already been recorded.');
  const p = s.person;
  // A dated broken promise remains in the full checkpoint. Pending duties never vanish from a transfer.
  if (p.agenda.commitments.some((c) => c.status === 'pending'))
    throw new Error('An unresolved promise still needs its own resolution before departure.');
  if (p.agenda.goals.some((g) => g.status === 'active' && g.id !== 'shelf' && !isAuthoredPurpose(g)))
    throw new Error('Another active goal cannot be carried to Hearsay. Resolve it here first.');
  const shelf = p.agenda.goals.find((g) => g.id === 'shelf');
  const receipt: DepartureReceipt = {
    v: 1,
    boundaryDay: s.day,
    at: p.now,
    purposes: p.agenda.goals
      .filter((g) => g.status === 'active' && g.id !== 'shelf')
      .map((g) => ({ id: g.id, label: g.label, progress: g.progress })),
    shelf: shelf ? { status: shelf.status, progress: shelf.progress } : null,
  };
  // Preflight all HF constraints on a copy; failure must not partly change the source run.
  const candidate = restore(snapshot(p));
  if (shelf?.status === 'active') abandonGoal(candidate, shelf.id);
  for (const purpose of receipt.purposes) abandonGoal(candidate, purpose.id);
  projectPersona(candidate, { version: SOURCE_MAPPING, skills: {} });
  if (shelf?.status === 'active') abandonGoal(p, shelf.id);
  for (const purpose of receipt.purposes) {
    abandonGoal(p, purpose.id);
    s.log.push({
      at: s.minute,
      who: 'dilan',
      text: `For this short visit, I am setting aside “${purposeDescription(purpose.label)}”. I have not finished it.`,
    });
  }
  s.log.push({
    at: s.minute,
    who: 'dilan',
    text:
      shelf && shelf.status !== 'achieved'
        ? 'My week of deliveries is over. I am leaving the unfinished shelf here for this visit. I will plan to work on it again when I return.'
        : 'My week of deliveries is over. My promises with dates stay in this week’s record. I can make a short visit now.',
  });
  return receipt;
}

export async function checkpointPerson(person: Person): Promise<PersonCheckpoint> {
  const complete = snapshot(person);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(complete)));
  return {
    sourceSchema: complete.schema,
    sourceNow: complete.now,
    sourceRng: structuredClone(complete.rng),
    checkpointDigest: Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join(''),
  };
}

/** Biography only: Murmur has no HF delivery skill, and this adapter invents none. */
export async function createOneCastDeparture(s: GameState): Promise<DilanTransfer> {
  requireBoundary(s);
  const departure = s.oneCastDeparture;
  if (!departure || departure.at !== s.person.now || departure.boundaryDay !== s.day)
    throw new Error('Record Dilan’s explicit chapter departure before making a checkpoint.');
  const p = s.person;
  const episode =
    s.chosen['route-3'] === 'route'
      ? p.memory.episodes.find((e) => e.action === 'route' && e.kind === 'outcome')
      : undefined;
  const episodes = episode
    ? {
        [episode.id]: {
          id: 'delivery-work',
          action: 'delivery-work',
          ...(episode.actorId !== undefined ? { actorId: 'dilan-delivery' } : {}),
          ...(episode.targetId !== undefined ? { targetId: 'delivery-recipient' } : {}),
          ...(episode.placeId !== undefined ? { placeId: 'delivery-route' } : {}),
          ...(episode.voiceId !== undefined ? { voiceId: 'source-inner-voice' } : {}),
          tags: [],
        },
      }
    : {};
  const person = projectPersona(p, { version: SOURCE_MAPPING, skills: {}, episodes });
  const history: OneCastFact[] = episode
    ? [
        {
          id: 'murmur-attended-route',
          kind: 'delivery-work',
          sourceGame: 'murmur',
          episodeId: 'delivery-work',
          disclosed: false,
        },
      ]
    : [];
  return { person, history, checkpoint: await checkpointPerson(p), departure: structuredClone(departure) };
}

function checkedReturn(value: unknown): DilanTransfer {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Missing return transfer.');
  const raw = value as Record<string, unknown>;
  if (
    Object.keys(raw).some((k) => !['person', 'history', 'checkpoint', 'admission', 'departure'].includes(k))
  )
    throw new Error('Unsupported return field.');
  const person = validatePersonaProjection(raw.person);
  if (
    person.mappingVersion !== RETURN_MAPPING ||
    person.source.id !== 'dilan-delivery' ||
    !['2.14.1', '2.17.0', '2.21.0'].includes(person.source.engine) ||
    person.name !== 'Dilan'
  )
    throw new Error('This return is not Hearsay’s Dilan mapping.');
  if (Object.keys(person.skills).length || person.commitments.length || person.episodes.length > 1)
    throw new Error('Unsupported return skill, promise or episode.');
  const checkpoint = raw.checkpoint as PersonCheckpoint | undefined;
  if (
    !checkpoint ||
    canonicalPersona(checkpoint.sourceSchema) !== canonicalPersona(person.source.schema) ||
    checkpoint.sourceNow !== person.source.now ||
    canonicalPersona(checkpoint.sourceRng) !== canonicalPersona(person.rng) ||
    !/^[a-f0-9]{64}$/.test(checkpoint.checkpointDigest)
  )
    throw new Error('Return checkpoint stamps do not match its projection.');
  if (!Array.isArray(raw.history) || raw.history.length !== 1)
    throw new Error('Return needs the actual attended encounter receipt.');
  const fact = raw.history[0] as OneCastFact;
  if (
    !fact ||
    Object.keys(fact).some(
      (k) => !['id', 'kind', 'sourceGame', 'episodeId', 'disclosed', 'outcome'].includes(k),
    ) ||
    fact.id !== 'hearsay-encounter' ||
    fact.kind !== 'hearsay-encounter' ||
    fact.sourceGame !== 'hearsay' ||
    typeof fact.episodeId !== 'string' ||
    !/^(hearsay-encounter|e[0-9]+)$/.test(fact.episodeId) ||
    typeof fact.disclosed !== 'boolean' ||
    !['accepted', 'declined'].includes(fact.outcome ?? '')
  )
    throw new Error('Unsupported encounter receipt.');
  if (
    person.episodes.some(
      (e) =>
        e.id !== 'hearsay-encounter' ||
        fact.episodeId !== e.id ||
        e.actorId !== 'hearsay-hatice' ||
        !['talk', 'leave'].includes(e.action ?? ''),
    )
  )
    throw new Error('Unsupported encounter episode.');
  return structuredClone({ ...raw, person }) as unknown as DilanTransfer;
}

export function prepareOneCastReturn(
  prefix: GameState,
  transfer: unknown,
): {
  person: Person;
  history: OneCastFact[];
  report: { mappingVersion: string; offset: number; limitations: string[] };
} {
  requireBoundary(prefix);
  if (!prefix.oneCastDeparture)
    throw new Error(
      'This browser has no saved source departure prefix. Fresh authored play remains available.',
    );
  const incoming = checkedReturn(transfer);
  const p = restore(snapshot(prefix.person));
  const sourceAge = incoming.person.source.now - incoming.person.life.bornAt;
  const localAge = p.now - p.life.bornAt;
  if (incoming.person.life.sex !== 'female' || sourceAge < localAge || sourceAge > localAge + 30 * 1440)
    throw new Error('Dilan’s return age or identity conflicts with the saved departure.');
  if (
    p.body.health !== incoming.person.health.health ||
    p.body.circadianPeak !== incoming.person.health.circadianPeak
  )
    throw new Error('Dilan’s clinical health or circadian state conflicts with the saved departure.');
  // Fitness is portable. Only after exact clinical/circadian checks may ordinary target drift carry back.
  p.body.fitness = incoming.person.health.fitness;
  p.life.bornAt = p.now - sourceAge;
  const result = admitPersona(incoming.person, p, {
    mappingVersion: RETURN_MAPPING,
    sourceId: 'dilan-delivery',
    targetId: 'dilan',
  });
  // A new shelf intention is voluntary in the new chapter. The old goal and achieved progress stay in source history.
  const oldShelf = prefix.person.agenda.goals.find((g) => g.id === 'shelf');
  if (prefix.oneCastDeparture.shelf?.status === 'active' && oldShelf?.status === 'abandoned') {
    adoptGoal(
      result.person,
      {
        label: 'take up the unfinished shelf again',
        serves: [...oldShelf.serves],
        advancedBy: oldShelf.advancedBy.map((a) => ({ ...a })),
        importance: oldShelf.importance,
      },
      result.person.now,
    );
  }
  for (const purpose of prefix.oneCastDeparture.purposes) {
    const old = prefix.person.agenda.goals.find((g) => g.id === purpose.id);
    if (old?.status !== 'abandoned' || old.progress !== purpose.progress)
      throw new Error('Saved source purpose no longer matches its departure receipt.');
    adoptGoal(
      result.person,
      {
        label: `take up ${old.label} again`,
        serves: [...old.serves],
        advancedBy: old.advancedBy.map((a) => ({ ...a })),
        importance: old.importance,
      },
      result.person.now,
    );
  }
  return { ...result, history: incoming.history };
}

/** Construct a new pinned return chapter; the loaded source run is never replaced in place. */
export function installOneCastReturn(prefix: GameState, transfer: unknown): GameState {
  const admitted = prepareOneCastReturn(prefix, transfer);
  const s = structuredClone({ ...prefix, person: null }) as unknown as GameState;
  s.person = admitted.person;
  const accepted = admitted.history[0]?.outcome === 'accepted';
  s.log.push({
    at: s.minute,
    who: 'dilan',
    text: accepted
      ? 'I am back from the garden. Hatice and I talked briefly. I still remember the week before my visit.'
      : 'I am back from the garden. I did not stay to talk. I still remember the week before my visit.',
  });
  return s;
}
