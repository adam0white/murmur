/** Captured admission authority is distinct from replay and file provenance. */
import { CAST } from './canonical-cast.ts';
import type { GameState, GameStateSnapshot } from './types.ts';
export type CastAdmission =
  | { kind: 'local' }
  | { kind: 'shared'; expectedHeads: Record<string, string | null> };
export function assertCastMetadata(
  s: Pick<GameState | GameStateSnapshot, 'castChapter' | 'castAdmission' | 'castHeads'>,
): void {
  const chapter = s.castChapter;
  const blocked = chapter?.blocked;
  if (chapter && (!Array.isArray(chapter.inputs) || !Array.isArray(chapter.claims)))
    throw Error('Invalid cast admission metadata.');
  if (
    blocked !== undefined &&
    (!Array.isArray(blocked) ||
      new Set(blocked).size !== blocked.length ||
      blocked.some(
        (id) =>
          !CAST.some((c) => c.castId === id) ||
          chapter?.inputs.some((i) => i.parent.castId === id) ||
          chapter?.claims.some((c) => c.castId === id) ||
          Object.hasOwn(s.castHeads ?? {}, id),
      ))
  )
    throw Error('Invalid skipped person metadata.');
  const admission = s.castAdmission;
  if (admission === undefined) return; // Historical absence grants no publication authority.
  if (
    !admission ||
    typeof admission !== 'object' ||
    (admission.kind !== 'local' && admission.kind !== 'shared') ||
    Object.keys(admission).sort().join(',') !== (admission.kind === 'local' ? 'kind' : 'expectedHeads,kind')
  )
    throw Error('Invalid cast admission authority.');
  if (admission.kind === 'local') return;
  const heads = admission.expectedHeads;
  if (
    !heads ||
    typeof heads !== 'object' ||
    Array.isArray(heads) ||
    Object.keys(heads).length !== CAST.length ||
    CAST.some(
      (c) =>
        !Object.hasOwn(heads, c.castId) ||
        !(
          heads[c.castId] === null ||
          (typeof heads[c.castId] === 'string' && /^[a-f0-9]{64}$/.test(heads[c.castId]!))
        ),
    ) ||
    !chapter ||
    CAST.some((c) => {
      const input = chapter.inputs.find((i) => i.parent.castId === c.castId);
      return input
        ? heads[c.castId] !== input.parent.revision
        : (heads[c.castId] !== null) !== Boolean(blocked?.includes(c.castId));
    })
  )
    throw Error('Invalid captured cast parents or skipped people.');
}
export function requireCastPerson(s: GameState | GameStateSnapshot, castId: string): void {
  assertCastMetadata(s);
  if (s.castChapter?.blocked?.includes(castId))
    throw Error('This person could not join this chapter. Continue their saved chapter first.');
}
export function requireCastPublication(s: GameState | GameStateSnapshot): void {
  assertCastMetadata(s);
  if (!s.castAdmission || (s.castScope === 'shared' && s.castAdmission.kind !== 'shared'))
    throw Error(
      'This notebook has no captured admission authority. Keep or export it, then start a fresh game.',
    );
}
