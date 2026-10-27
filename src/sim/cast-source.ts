/** Native source observation. Publication and local full-prefix custody belong to the UI.
 * No advances, abandonment, healing, duty release, outcome or ownership is created by projection.
 */
import {
  AGENDA_DEFAULTS,
  abandonGoal,
  DEFAULT_NORMS,
  isContinuingCommitment,
  projectCalendarPersona,
  snapshot,
} from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import type { CastRole } from './canonical-cast.ts';
import { isCanonicalEdition } from './edition.ts';
import type { GameState } from './types.ts';

const identity = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, id]));
export async function castDigest(value: unknown): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function createCastSource(s: GameState, role: CastRole) {
  if (s.version === '0.7.0')
    throw Error('The three-week edition has no supported source passport yet. Keep its full notebook.');
  if (!isCanonicalEdition(s.version) || !s.cast || s.phase !== 'end' || ![6, 13].includes(s.day) || s.card)
    throw Error('A native checkpoint needs an actually played completed Saturday boundary.');
  const p = s.cast.people[role];
  if (!p.body.alive) throw Error('This actual death needs terminal closure, not an alive passport.');
  if (p.activity) throw Error('Finish the actual activity first.');
  const raw = snapshot(p),
    person = projectCastPerson(p);
  return {
    transfer: {
      castPassport: 'murmur-cast/1',
      sourceRole: role,
      person,
      checkpoint: { schema: raw.schema, sourceMinute: raw.now, rng: raw.rng, sha256: await castDigest(raw) },
    },
    raw,
    limitations: [
      'Full native Murmur source state and played input prefix stay in the local export.',
      'Private discoveries, unsupported source habits and relationships remain in that archive. This projection awards no knowledge or qualification.',
    ],
  };
}

function projectCastPerson(p: import('@adam0white/human-framework').Person) {
  const cs = p.agenda.commitments.filter((c) => isContinuingCommitment(p.agenda, c)),
    owed = p.agenda.owed ?? [];
  return projectCalendarPersona(p, {
    version: 'murmur-calendar/1',
    skills: identity(Object.keys(p.skills)),
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: identity([
          ...cs.flatMap((c) => [c.id, ...(c.makeUpOf ? [c.makeUpOf] : [])]),
          ...owed.flatMap((c) => [c.ofId, ...(c.scheduledAs ? [c.scheduledAs] : [])]),
        ]),
        chains: identity(cs.flatMap((c) => (c.chain ? [c.chain] : []))),
        actions: identity([
          ...cs.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
          ...owed.flatMap((c) => [...c.actions, ...(c.violatedBy ?? [])]),
        ]),
        entities: identity(cs.flatMap((c) => [c.toId, c.targetId].filter((x): x is string => !!x))),
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  });
}

/** An explicit replayed Saturday choice, never called by import or checkpoint. Unsupported purposes and duties refuse before mutation. */
export function releaseCastSource(s: GameState, role: CastRole): void {
  if (s.version === '0.7.0')
    throw Error('The three-week edition has no supported source departure yet. Keep its full notebook.');
  if (!isCanonicalEdition(s.version) || !s.cast || s.phase !== 'end' || ![6, 13].includes(s.day))
    throw Error('Pause at an actually completed Saturday boundary.');
  const p = s.cast.people[role];
  const goals = p.agenda.goals.filter((g) => g.status === 'active');
  if (
    goals.some(
      (g) =>
        g.project ||
        (!(
          role === 'dilan' &&
          g.label === 'the shelf' &&
          canonicalPersona(g.advancedBy) === canonicalPersona([{ action: 'shelf', amount: 0.45 }])
        ) &&
          !Object.entries(AGENDA_DEFAULTS.goalTemplates).some(
            ([need, t]) =>
              t.label === g.label &&
              canonicalPersona(t.advancedBy) === canonicalPersona(g.advancedBy) &&
              canonicalPersona(g.serves) === canonicalPersona([need]),
          )),
    )
  )
    throw Error('An unsupported purpose or project still needs its actual resolution.');
  const copy = snapshot(p);
  for (const g of goals) abandonGoal(copy, g.id);
  projectCastPerson(copy); // Validate every body/calendar/project restriction before changing the source.
  for (const g of goals) abandonGoal(p, g.id);
  s.cast.pauses ??= {};
  s.cast.pauses[role] = {
    at: p.now,
    purposes: goals.map((g) => ({ id: g.id, label: g.label, progress: g.progress })),
  };
}

/** Explicit finite history dialect for canonical Aylin on0.6 only. The last eight actual episodes
 * retain every source reference and payload. The declared producer clock offset is zero; a receiver must
 * explicitly map its own clock. This creates no acquaintances, skill credit, told facts or ownership.
 * Full raw state/notebook remain mandatory archive inputs. Belief/debt transport is not demonstrated.
 */
export async function createHistoryProjection(p: import('@adam0white/human-framework').Person) {
  if (p.id !== 'aylin' || p.name !== 'Aylin' || p.engine !== '2.23.0' || !p.body.alive || p.activity)
    throw Error('History projection requires the supported living idle Aylin source.');
  if (Object.keys(p.memory.beliefs).length || p.agenda.commitments.length || (p.agenda.owed ?? []).length)
    throw Error('This finite history dialect does not map beliefs, commitments or debt.');
  const raw = snapshot(p);
  const selected = raw.memory.episodes.slice(-8);
  if (selected.length !== 8) throw Error('This history dialect needs eight actual source episodes.');
  const episodes = Object.fromEntries(
    selected.map((e) => [
      e.id,
      {
        id: e.id,
        ...(e.action !== undefined ? { action: e.action } : {}),
        ...(e.actorId !== undefined ? { actorId: e.actorId } : {}),
        ...(e.targetId !== undefined ? { targetId: e.targetId } : {}),
        ...(e.placeId !== undefined ? { placeId: e.placeId } : {}),
        ...(e.voiceId !== undefined ? { voiceId: e.voiceId } : {}),
        ...(e.tags !== undefined ? { tags: [...e.tags] } : {}),
      },
    ]),
  );
  const map = {
    version: 'murmur-calendar/2',
    skills: identity(Object.keys(raw.skills)),
    episodes,
    calendar: {
      version: 'hf-persona-calendar-map/1' as const,
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: {},
        chains: {},
        actions: {},
        entities: {},
        norms: identity(DEFAULT_NORMS.map((n) => n.id)),
      },
    },
  };
  const person = projectCalendarPersona(raw, map); // Public HF3.0 validates actual health, active work/projects and duties.
  return {
    person,
    checkpoint: { schema: raw.schema, sourceMinute: raw.now, rng: raw.rng, sha256: await castDigest(raw) },
    selection: {
      version: 'murmur-history-selection/1' as const,
      ids: selected.map((e) => e.id),
      map,
      omittedEpisodeIds: raw.memory.episodes.slice(0, -8).map((e) => e.id),
      unsupportedStores: person.person.limitations,
      sourceRawDigest: await castDigest(raw),
      clockOffset: 0,
    },
  };
}
export async function createCastHistorySource(s: GameState) {
  const old = await createCastSource(s, 'aylin'); // Preserve the actual completed Saturday and all native source restrictions.
  const history = await createHistoryProjection(old.raw);
  return {
    raw: old.raw,
    transfer: { castPassport: 'murmur-cast/2', sourceRole: 'aylin', ...history },
    limitations: [
      ...old.limitations,
      `${history.selection.omittedEpisodeIds.length} source episodes remain only in the full archive.`,
      'Supported story source: Murmur0.6.0 and0.6.1 (the notebook pins the simulation edition). Third-week0.7 sources are not admitted by this finite dialect.',
      'Source references retain source meanings. They create no destination acquaintance, trust, qualification or publicly told fact.',
      'This source has empty beliefs, commitments and debt; no nonempty transport coverage is claimed.',
    ],
  };
}
