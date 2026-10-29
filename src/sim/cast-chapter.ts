/** Atomic retained-cast admission. Full passports and captured life clocks are replay inputs. */
import { DEFAULT_NORMS, type PortableAdmission, validatePortablePerson } from '@adam0white/human-framework';
import {
  canonicalPersona,
  type LifePreparation,
  lifeAdmission,
  type PersonaEnvelope,
  portablePersonRole,
  preparePersonaLife,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, type CastState, freshCast, roleOf } from './canonical-cast.ts';
import { sourceRules } from './edition.ts';
import { actionsForEdition } from './hf4-actions.ts';
import { retainedReferences } from './hf4-history.ts';
import { createMurmurOpening } from './hf4-opening.ts';
import type { GameStateSnapshot } from './types.ts';
export interface CastReturnArchive {
  source: GameStateSnapshot;
  departure: PersonaEnvelope;
  lineage?: PersonaEnvelope[];
}
export interface CastChapter {
  edition: '0.9.0' | '0.10.0';
  seed: number;
  inputs: LifePreparation[];
  claims: PersonaEnvelope[];
  initial: CastState;
  mapping: 'murmur-portable/2';
  portable: Record<string, PortableAdmission>;
  resume?: never;
}
const same = (a: unknown, b: unknown) => canonicalPersona(a) === canonicalPersona(b);
export async function prepareCastChapter(
  inputs: LifePreparation[],
  seed: number,
  _archives: Record<string, unknown> = {},
  version = '0.9.0',
): Promise<CastChapter> {
  if (inputs.length > 4 || new Set(inputs.map((i) => i.parent.castId)).size !== inputs.length)
    throw new Error('Invalid or duplicate cast batch.');
  const initial = freshCast(seed),
    portable: Record<string, PortableAdmission> = {};
  for (const input of inputs) {
    const parent = await validatePersona(input.parent),
      cast = CAST.find((c) => c.castId === parent.castId),
      role = roleOf(parent.castId);
    if (
      !cast ||
      parent.terminal ||
      parent.castRevision !== cast.revision ||
      !same(preparePersonaLife(parent, input.clockMs).life, input.life)
    )
      throw new Error('The retained person or captured life clock conflicts with this opening.');
    if (
      !cast.games.includes(parent.source.game) ||
      parent.transfer.castPassport !== 'hf-portable-person/2' ||
      portablePersonRole(parent, 'murmur') !== role
    )
      throw new Error(
        `${cast.name}: keep this source notebook. It needs the complete retained-person passport. Start a separate local story.`,
      );
    const person = validatePortablePerson(parent.transfer.portable);
    if (
      person.version !== 2 ||
      person.castId !== cast.castId ||
      person.castRevision !== cast.revision ||
      person.source.game !== parent.source.game ||
      person.source.engine !== parent.source.engine
    )
      throw new Error('Retained source identity conflicts.');
    const offsetMs = (400 * 1440 + 399) * 60_000 - person.retained.at;
    if (offsetMs % 86_400_000 !== 0 && person.retained.agenda.commitments.some((c) => c.status === 'pending'))
      throw new Error('Source duties require a matching time of day. Continue the source chapter.');
    const references = retainedReferences(person, parent.revision, version);
    portable[role] = { person, mapping: { offsetMs, references } };
    const life = lifeAdmission(input, 'murmur');
    initial.assignments[role] = life.assignment;
    initial.contacts[role] = life.contacts;
    initial.places[role] = life.life.place;
    initial.extraWork[role] = life.availableForExtraWork;
  }
  // HF validates every retained history/reference and responsibility before any central write.
  createMurmurOpening(seed, actionsForEdition(version), portable);
  return {
    edition: sourceRules(version),
    seed,
    inputs: structuredClone(inputs),
    claims: [],
    initial,
    mapping: 'murmur-portable/2',
    portable,
  };
}
export async function validateCastChapter(chapter: CastChapter, seed: number): Promise<void> {
  if (
    !chapter ||
    chapter.seed !== seed ||
    !['0.9.0', '0.10.0'].includes(chapter.edition) ||
    chapter.mapping !== 'murmur-portable/2' ||
    !Array.isArray(chapter.claims) ||
    chapter.claims.length !== chapter.inputs.length
  )
    throw new Error('Invalid pinned retained cast chapter.');
  const prepared = await prepareCastChapter(chapter.inputs, seed, {}, chapter.edition);
  if (!same({ ...prepared, claims: chapter.claims }, chapter))
    throw new Error('Pinned cast admission differs from its complete sources.');
  const seen = new Set<string>();
  for (const claim of chapter.claims) {
    await validatePersona(claim);
    const parent = chapter.inputs.find((i) => i.parent.castId === claim.castId)?.parent;
    if (
      !parent ||
      seen.has(claim.castId) ||
      claim.parentRevision !== parent.revision ||
      claim.branchId !== parent.branchId ||
      !same(claim.source, parent.source) ||
      !same(claim.transfer, {
        ...parent.transfer,
        portableClaim: { game: 'murmur' },
        life: chapter.inputs.find((i) => i.parent.castId === claim.castId)?.life,
      })
    )
      throw new Error('Cast claim conflicts with its exact parent.');
    seen.add(claim.castId);
  }
}
