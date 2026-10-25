/** Finite native source maps for the actual allocated cast. Claims are not native checkpoints.
 * Calendar translation takes zero lived minutes. Source duties, health and full archives are never settled here.
 */
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  ENGINE_VERSION,
  type Person,
  snapshot,
  validateCalendarPersona,
} from '@adam0white/human-framework';
import {
  canonicalCast,
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST_VERSION, type CastState, cloneCast, freshCast, roleOf } from './canonical-cast.ts';
import { createCastSource } from './cast-source.ts';
import { cloneState, replay, step } from './game.ts';
import type { GameState } from './types.ts';

export interface CastReturnArchive {
  source: GameState;
  departure: PersonaEnvelope;
  lineage?: PersonaEnvelope[];
}
export interface CastChapter {
  resume?: { source: GameState; departure: PersonaEnvelope; lineage?: PersonaEnvelope[] };
  edition: typeof CAST_VERSION;
  seed: number;
  inputs: LifePreparation[];
  claims: PersonaEnvelope[];
  initial: CastState;
  mapping: 'murmur-calendar/1';
}
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
const native = {
  dilan: {
    game: 'hearsay',
    rules: 'hearsay-cast-6',
    passport: 'hearsay-cast/1',
    mapping: 'hearsay-calendar/1',
    role: 'dilan',
    field: 'person',
  },
  aylin: {
    game: 'goodhands',
    rules: 'goodhands-6',
    passport: 'goodhands-agency/1',
    mapping: 'goodhands-agency-calendar/1',
    role: 'aylin',
    field: 'agencyPerson',
  },
  ece: {
    game: 'neighbours',
    rules: 'neighbours-cast-1',
    passport: 'neighbours-cast/1',
    mapping: 'neighbours-calendar/1',
    role: 'noor',
    field: 'person',
  },
} as const;
/** Mutates only a detached opening. Actual source health is checked by HF, not rewritten into fitness or age. */
function admit(input: LifePreparation, opening: Person): Person {
  const { parent } = input,
    cast = canonicalCast(parent.castId),
    role = roleOf(parent.castId);
  if (parent.castRevision !== cast.revision || parent.terminal)
    throw Error(`${cast.name}: old or closed branch. Inspect/export it or explicitly play fresh locally.`);
  if (!same(preparePersonaLife(parent, input.clockMs).life, input.life))
    throw Error('Pinned life input differs from its captured clock.');
  const own =
    parent.source.game === 'murmur' &&
    parent.source.rules === CAST_VERSION &&
    parent.transfer.castPassport === 'murmur-cast/1';
  const source = role === 'murat' ? undefined : native[role];
  const d = own
    ? {
        game: 'murmur',
        rules: CAST_VERSION,
        passport: 'murmur-cast/1',
        mapping: 'murmur-calendar/1',
        role,
        field: 'person',
      }
    : source;
  if (
    !d ||
    parent.source.game !== d.game ||
    parent.source.rules !== d.rules ||
    !(
      parent.source.engine === '2.17.0' ||
      parent.source.engine === '2.21.0' ||
      (own && parent.source.engine === ENGINE_VERSION) ||
      (((d.game === 'neighbours' && d.role === 'noor') ||
        (d.game === 'hearsay' && d.role === 'dilan') ||
        (d.game === 'goodhands' && d.role === 'aylin')) &&
        parent.source.engine === '2.23.0')
    ) ||
    parent.transfer.castPassport !== d.passport ||
    parent.transfer.sourceRole !== d.role
  )
    throw Error(
      `${cast.name}: no native source passport adapter for ${parent.source.game}/${String(parent.transfer.castPassport)}. Keep the existing chapter or choose fresh local play.`,
    );
  const p = validateCalendarPersona(parent.transfer[d.field]);
  const receipt = parent.transfer.checkpoint as Record<string, unknown> | undefined;
  const agency = d.game === 'goodhands';
  if (
    p.person.mappingVersion !== d.mapping ||
    p.person.source.id !== d.role ||
    p.person.name !== cast.name ||
    !receipt ||
    (agency ? receipt.sourceSchema : receipt.schema) !== p.person.source.schema ||
    (agency ? receipt.sourceNow : receipt.sourceMinute) !== p.person.source.now ||
    !same(agency ? receipt.sourceRng : receipt.rng, p.person.rng) ||
    !/^[a-f0-9]{64}$/.test(String(agency ? receipt.checkpointDigest : receipt.sha256))
  )
    throw Error('Native identity or full-source checkpoint receipt mismatch.');
  if (!same(p.calendar.norms, DEFAULT_NORMS)) throw Error('Untrusted source norm meanings.');
  // Only local Murmur duties have a receiving action loop. No care, agency placement, garden invoice or town role may disappear.
  const actions = new Set(
    own ? ['get-up', 'call-mum', 'dinner', 'practice-ece', 'close-with-ece', 'shelf'] : [],
  );
  for (const duty of [...p.calendar.commitments, ...p.calendar.owed]) {
    if ([...duty.actions, ...(duty.violatedBy ?? [])].some((a) => !actions.has(a)))
      throw Error(`${cast.name}: a source duty needs its actual source chapter.`);
    if (
      ('toId' in duty && duty.toId && !['self', role, 'mum', 'aylin', 'ece'].includes(duty.toId)) ||
      ('targetId' in duty && duty.targetId && !['self', role, 'mum', 'aylin', 'ece'].includes(duty.targetId))
    )
      throw Error('An obligation needs somebody still at source.');
  }
  const skillKeys = Object.keys(p.person.skills);
  const supported = role === 'aylin' ? ['cooking'] : role === 'ece' ? ['repair'] : [];
  if (skillKeys.some((k) => !supported.includes(k)))
    throw Error('A represented source skill has no finite receiving meaning. Export it at source.');
  const offset = opening.now - p.person.source.now;
  const age = p.person.source.now - p.person.life.bornAt;
  if (age < cast.age * 525600 || age > (cast.age + 200) * 525600)
    throw Error('Incompatible canonical age provenance.');
  const local = structuredClone(opening.agenda.commitments);
  opening.agenda.commitments = [];
  delete opening.agenda.owed;
  delete opening.agenda.lapse;
  opening.life.bornAt = p.person.life.bornAt + offset;
  opening.body.fitness = p.person.health.fitness;
  p.calendar.offset = offset;
  for (const c of p.calendar.commitments) {
    c.from += offset;
    c.until += offset;
    if (c.recurUntil !== undefined) c.recurUntil += offset;
    if (c.exempt) c.exempt.at += offset;
  }
  for (const c of p.calendar.owed) {
    c.at += offset;
    if (c.lapseSince !== undefined) c.lapseSince += offset;
  }
  if (p.calendar.lapse) p.calendar.lapse.since += offset;
  const admitted = admitCalendarPersona(p, opening, {
    mappingVersion: d.mapping,
    sourceId: d.role,
    targetId: role,
    targetNorms: DEFAULT_NORMS,
  }).person;
  // Newly authored local promises are additional duties. Received duties remain intact.
  for (const c of local) {
    const copy = structuredClone(c);
    copy.id = `murmur-opening:${c.id}`;
    if (copy.chain) copy.chain = `murmur-opening:${copy.chain}`;
    if (copy.makeUpOf) copy.makeUpOf = `murmur-opening:${copy.makeUpOf}`;
    admitted.agenda.commitments.push(copy);
  }
  for (const n of opening.conscience.norms)
    if (!admitted.conscience.norms.some((v) => v.normId === n.normId))
      admitted.conscience.norms.push(structuredClone(n));
  return admitted;
}
export async function prepareCastChapter(
  inputs: LifePreparation[],
  seed: number,
  archives: Record<string, GameState | CastReturnArchive> = {},
): Promise<CastChapter> {
  if (inputs.length > 4 || new Set(inputs.map((i) => i.parent.castId)).size !== inputs.length)
    throw Error('Invalid or duplicate cast collection.');
  const own = inputs.filter(
    (i) =>
      (i.parent.source.game === 'murmur' && i.parent.transfer.castPassport === 'murmur-cast/1') ||
      archives[i.parent.revision],
  );
  if (own.length) {
    const selected = own
      .map((i) => {
        const archive = archives[i.parent.revision];
        return {
          input: i,
          source: archive && 'departure' in archive ? archive.source : (archive as GameState | undefined),
          departure: archive && 'departure' in archive ? archive.departure : i.parent,
          lineage: archive && 'departure' in archive ? archive.lineage : undefined,
        };
      })
      .sort((a, b) => (b.source?.inputs.length ?? -1) - (a.source?.inputs.length ?? -1))[0];
    if (!selected?.source)
      throw Error(
        'This native return needs its exact local source notebook. Continue that notebook or explicitly play fresh locally.',
      );
    const source = selected.source;
    await validatePersona(selected.departure);
    if (
      selected.departure.source.game !== 'murmur' ||
      selected.departure.source.rules !== CAST_VERSION ||
      selected.departure.transfer.castPassport !== 'murmur-cast/1' ||
      selected.departure.branchId !== selected.input.parent.branchId ||
      selected.departure.castId !== selected.input.parent.castId
    )
      throw Error('Source-bound origin conflicts.');
    if (selected.input.parent.revision !== selected.departure.revision) {
      let parent = selected.input.parent.parentRevision;
      for (const link of selected.lineage ?? []) {
        await validatePersona(link);
        if (
          link.revision !== parent ||
          link.castId !== selected.departure.castId ||
          link.branchId !== selected.departure.branchId
        )
          throw Error('Source-bound return lineage conflicts.');
        parent = link.parentRevision;
      }
      if (!(selected.lineage ?? []).some((link) => link.revision === selected.departure.revision))
        throw Error('The exact source departure is absent from retained return lineage.');
    }

    if (
      source.version !== CAST_VERSION ||
      !source.cast ||
      source.phase !== 'end' ||
      source.day !== 6 ||
      source.fileHistory ||
      source.castScope !== 'shared'
    )
      throw Error(
        'This source chapter is not an owned first-Saturday return. Continue or export it; choose a fresh local story explicitly.',
      );
    if (source.castChapter) await validateCastChapter(source.castChapter, source.seed);
    const replayed = replay(
      source.seed,
      source.inputs,
      source.minute,
      source.version,
      source.castChapter,
      source.person.lexicon?.plainEnglish ?? false,
    );
    if (replayed.phase === 'day') step(replayed);
    const clean = (s: GameState) => {
      const c = cloneState(s);
      delete c.castHeads;
      delete c.castScope;
      delete c.castHeadScopes;
      delete c.castSources;
      delete c.fileHistory;
      return c;
    };
    if (!same(clean(replayed), clean(source)))
      throw Error('The exact native source notebook does not replay.');
    const initial = cloneCast(source.cast);
    const origin = await createCastSource(source, roleOf(selected.departure.castId));
    for (const key of ['castPassport', 'sourceRole', 'person', 'checkpoint'] as const)
      if (!same(selected.departure.transfer[key], origin.transfer[key]))
        throw Error('Source-bound departure differs from its exact native prefix.');
    for (const input of inputs) {
      await validatePersona(input.parent);
      const role = roleOf(input.parent.castId);
      if (!same(preparePersonaLife(input.parent, input.clockMs).life, input.life))
        throw Error('Pinned life differs.');
      if (input.parent.source.game === 'murmur' && input.parent.transfer.castPassport === 'murmur-cast/1') {
        const native = await createCastSource(source, role);
        for (const key of ['castPassport', 'sourceRole', 'person', 'checkpoint'] as const)
          if (!same(input.parent.transfer[key], native.transfer[key]))
            throw Error('Native return differs from its exact source prefix.');
      } else if (
        input.parent.castId === selected.departure.castId &&
        input.parent.revision !== selected.departure.revision
      ) {
        const memories = structuredClone(initial.people[role].memory.episodes);
        initial.people[role] = admit(input, snapshot(initial.people[role]));
        initial.people[role].memory.episodes = memories;
      } else if (
        source.castHeads?.[input.parent.castId]?.revision !== input.parent.revision ||
        (source.castHeadScopes?.[input.parent.castId] ?? source.castScope) !== 'shared'
      )
        throw Error(
          'Another cast history moved beyond this source chapter. Preserve the pinned notebook or choose a fresh local story.',
        );
      const life = lifeAdmission(input, 'murmur');
      initial.assignments[role] = life.assignment;
      initial.contacts[role] = life.contacts;
      initial.places[role] = life.life.place;
      initial.extraWork[role] = life.availableForExtraWork;
    }
    return {
      edition: CAST_VERSION,
      seed: source.seed,
      inputs: structuredClone(inputs),
      claims: [],
      initial,
      mapping: 'murmur-calendar/1',
      resume: {
        source: cloneState(source),
        departure: selected.departure,
        ...(selected.lineage ? { lineage: structuredClone(selected.lineage) } : {}),
      },
    };
  }
  const initial = freshCast(seed),
    seen = new Set<string>();
  for (const input of inputs) {
    // Full validation precedes any central mutation. Callers use the batch CAS only after this resolves.
    await validatePersona(input.parent);
    if (seen.has(input.parent.castId)) throw Error('Duplicate cast input.');
    seen.add(input.parent.castId);
    const role = roleOf(input.parent.castId);
    initial.people[role] = admit(input, snapshot(initial.people[role]));
    const life = lifeAdmission(input, 'murmur');
    initial.assignments[role] = life.assignment;
    initial.contacts[role] = life.contacts;
    initial.places[role] = life.life.place;
    initial.extraWork[role] = life.availableForExtraWork;
  }
  return {
    edition: CAST_VERSION,
    seed,
    inputs: structuredClone(inputs),
    claims: [],
    initial,
    mapping: 'murmur-calendar/1',
  };
}

/** Replay admission reuses the captured clock and source inputs. Never consults the shelf or Date.now. */
export async function validateCastChapter(chapter: CastChapter, seed: number): Promise<void> {
  if (
    !chapter ||
    chapter.edition !== CAST_VERSION ||
    chapter.mapping !== 'murmur-calendar/1' ||
    chapter.seed !== seed ||
    !Array.isArray(chapter.inputs) ||
    chapter.inputs.length > 4 ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length !== chapter.inputs.length
  )
    throw Error('Invalid pinned cast chapter. Start fresh.');
  const archives: Record<string, GameState | CastReturnArchive> = {};
  if (chapter.resume)
    for (const input of chapter.inputs)
      if (input.parent.castId === chapter.resume.departure.castId)
        archives[input.parent.revision] = {
          source: chapter.resume.source,
          departure: chapter.resume.departure,
          ...(chapter.resume.lineage ? { lineage: chapter.resume.lineage } : {}),
        };
      else if (
        input.parent.source.game === 'murmur' &&
        input.parent.transfer.castPassport === 'murmur-cast/1'
      )
        archives[input.parent.revision] = chapter.resume.source;
  const prepared = await prepareCastChapter(chapter.inputs, seed, archives);
  if (!same(prepared.resume ?? null, chapter.resume ?? null))
    throw Error('Pinned native return source differs.');
  if (!same(prepared.initial, chapter.initial))
    throw Error('Pinned initial cast differs from actual source admission.');
  const seen = new Set<string>();
  for (const claim of chapter.claims) {
    await validatePersona(claim);
    const input = chapter.inputs.find((i) => i.parent.castId === claim.castId);
    if (
      !input ||
      seen.has(claim.castId) ||
      claim.parentRevision !== input.parent.revision ||
      claim.branchId !== input.parent.branchId ||
      claim.castRevision !== input.parent.castRevision ||
      claim.source.game !== 'murmur' ||
      claim.source.rules !== CAST_VERSION ||
      !['2.17.0', '2.21.0', ENGINE_VERSION].includes(claim.source.engine) ||
      !same(claim.transfer, { ...input.parent.transfer, life: input.life })
    )
      throw Error('Pinned whole-cast claim does not match its exact parent.');
    seen.add(claim.castId);
  }
}
