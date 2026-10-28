import type { PersonaEnvelope } from '@adam0white/lab-client';
import type { GameState, GameStateSnapshot } from '../sim/types.ts';
import {
  automaticCastCheckpoint,
  heldCanonicalWeek,
  saveCastPerson,
  validateCanonicalRun,
} from './cast-chapter.ts';
import { shelf } from './continuity.ts';
export const hasPendingReturn = () => false;
export const continuityMessage = () => '';
export async function initOneCast() {
  await shelf.ready;
}
export function recordingState(s: GameState | null) {
  if (s?.cast)
    return {
      owner: s,
      heads: Object.values(s.castHeads ?? {}).map((head) => ({
        head,
        scope: s.castHeadScopes?.[head.castId] ?? s.castScope ?? ('local' as const),
      })),
      invalidHistory: Boolean(s.fileHistory),
    };
  return s
    ? {
        owner: s,
        invalidHistory: Boolean(s.fileHistory && !s.personaHead),
        heads: s.personaHead ? [{ head: s.personaHead, scope: s.personaScope ?? 'local' }] : [],
      }
    : undefined;
}

export async function validateRun(json: GameStateSnapshot): Promise<GameState> {
  if (json.version.startsWith('0.9.')) return validateCanonicalRun(json);
  const { validateRun: validateHistorical } = await import('../legacy/ui/one-cast.ts');
  return (await validateHistorical(
    json as unknown as import('../legacy/types.ts').GameState,
  )) as unknown as GameState;
}
export const checkpoint = (s: GameState | null, save: () => void) => automaticCastCheckpoint(s, save);
export const releaseAndCheckpoint = (s: GameState, save: () => void) => saveCastPerson(s, 'dilan', save);
export const forkDeparture = (s: GameState, save: () => void) =>
  saveCastPerson(s, 'dilan', save, { fork: true });
export async function personaFile(s: GameState): Promise<PersonaEnvelope> {
  const head = s.castHeads?.['hf.cast.dilan.murmur'];
  if (!head) throw new Error('Save a completed Dilan checkpoint first.');
  return head;
}
export async function returnedChapter(..._args: unknown[]): Promise<GameState> {
  throw new Error('Keep the old source notebook. Start a separate current story.');
}
export async function forkPendingReturn(..._args: unknown[]): Promise<GameState> {
  throw new Error('No current return was selected.');
}
export async function heldReturn(): Promise<GameState> {
  const s = await heldCanonicalWeek();
  if (!s) throw new Error('No accepted held chapter.');
  return s;
}
