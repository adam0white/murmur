/** Source observation never settles work, clears duties or changes ownership. */
import { inspect, type PersonView } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { CAST, type CastRole, roleOf } from './canonical-cast.ts';
import { isHf4Edition } from './edition.ts';
import { restoreState } from './game-hf4.ts';
import { checkpointMurmur } from './hf4-session.ts';
import type { GameState, GameStateSnapshot } from './types.ts';
export async function castDigest(value: unknown): Promise<string> {
  return Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalPersona(value)))),
    (b) => b.toString(16).padStart(2, '0'),
  ).join('');
}
export async function createCastSource(input: GameState | GameStateSnapshot, role: CastRole) {
  const s = 'host' in input.hf ? (input as GameState) : restoreState(input as GameStateSnapshot);
  if (!isHf4Edition(s.version) || !s.cast || s.phase !== 'end' || ![6, 13, 20].includes(s.day) || s.card)
    throw new Error('A checkpoint needs an actually completed Saturday.');
  if (s.hf.host.active.some((a) => a.person === role))
    throw new Error('Finish this person’s activity before taking a checkpoint.');
  const cast = CAST.find((c) => roleOf(c.castId) === role);
  if (!cast) throw new Error('Unknown cast identity.');
  const result = inspect(s.hf.run, {
    perspective: { kind: 'host' },
    people: [role],
    select: ['persona', 'calendar'],
    portable: { person: role, castId: cast.castId, castRevision: cast.revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const view = result.value.people[0] as Extract<PersonView, { kind: 'host' }> | undefined;
  const portable = view?.parts.find((p) => p.select === 'persona')?.value;
  if (!portable || !('format' in portable) || portable.version !== 2)
    throw new Error('A complete retained-person passport is unavailable.');
  return {
    transfer: {
      castPassport: 'hf-portable-person/2',
      sourceRole: role,
      portable,
      checkpoint: { sourceAt: result.value.at, checkpointDigest: await castDigest(portable) },
    },
    raw: checkpointMurmur(s.hf),
    limitations: [
      'The complete source run and RNG remain in this notebook. Supported history and responsibilities retain explicit reference and calendar mapping.',
    ],
  };
}
export function releaseCastSource(_s: GameState, _role: CastRole): never {
  throw new Error('Unfinished purposes remain in this chapter. Finish them here before taking a checkpoint.');
}
export const createCastHistorySource = (s: GameState | GameStateSnapshot) => createCastSource(s, 'aylin');
