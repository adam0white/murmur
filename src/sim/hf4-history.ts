/** Reference catalogues retain source meanings. They do not add actors, skills or present locations. */
import { DEFAULT_NORMS, type PortableAdmission, type PortablePerson } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { actionsForEdition } from './hf4-actions.ts';
export const MURMUR_PLACES = [
  'home',
  'bed',
  'phone',
  'depot',
  'bus',
  'canteen',
  'bowling',
  'gym',
  'van',
  'yard',
  'kitchen',
  'delivery district',
  'public-garden',
  'depot break room',
  'dance-hall',
  'worker-board',
];
const people = ['mum', 'dilan', 'aylin', 'ece', 'murat'];
export function retainedReferences(
  person: Extract<PortablePerson, { version: 2 }>,
  revision: string,
  edition = '0.9.0',
): PortableAdmission['mapping']['references'] {
  const catalog: readonly string[] = actionsForEdition(edition);
  const actions = new Set<string>(catalog),
    entities = new Set<string>(people),
    sources = new Set(['murmur', 'you', 'pull', ...people]);
  const r = person.retained;
  for (const norm of r.calendar.norms)
    if (!DEFAULT_NORMS.some((n) => canonicalPersona(n) === canonicalPersona(norm)))
      throw new Error('This source norm has no declared Murmur meaning.');
  for (const duty of [...r.agenda.commitments, ...r.agenda.owed]) {
    if ([...duty.actions, ...(duty.violatedBy ?? [])].some((a) => !catalog.includes(a)))
      throw new Error('A source duty requires its source action loop.');
    if ('toId' in duty && duty.toId && !['self', person.source.personId, ...people].includes(duty.toId))
      throw new Error('A source duty needs somebody still at source.');
  }
  for (const e of [...r.memory.episodes, ...r.memory.gists]) {
    if (e.action) actions.add(e.action);
    for (const id of [e.actorId, e.targetId, e.placeId])
      if (id && id !== 'self' && id !== person.source.personId) entities.add(id);
    if (e.voiceId) sources.add(e.voiceId);
  }
  for (const id of Object.keys(r.memory.sourceTrust)) sources.add(id);
  for (const b of r.memory.beliefs) {
    for (const v of b.sources) sources.add(v.id);
    if (b.provenance) {
      sources.add(b.provenance.origin);
      sources.add(b.provenance.firstFrom);
    }
  }
  for (const c of r.memory.contradictions) sources.add(c.sourceId);
  const historical = (kind: string, id: string) =>
    `murmur-history:${kind}:${person.castId}:${revision}:${id}`;
  return [
    ...[...actions].map((source) => ({
      kind: 'action' as const,
      source,
      target: catalog.includes(source) ? source : historical('action', source),
    })),
    ...DEFAULT_NORMS.map((n) => ({ kind: 'norm' as const, source: n.id, target: n.id })),
    ...[...entities]
      .filter((id) => id !== person.source.personId)
      .map((source) => ({
        kind: 'entity' as const,
        source,
        target:
          people.includes(source) || (person.source.game === 'murmur' && MURMUR_PLACES.includes(source))
            ? source
            : historical('entity', source),
      })),
    ...[...sources]
      .filter((id) => id !== 'self' && id !== person.source.personId)
      .map((source) => ({
        kind: 'source' as const,
        source,
        target: ['murmur', 'you', 'pull', ...people].includes(source) ? source : historical('source', source),
      })),
  ];
}
