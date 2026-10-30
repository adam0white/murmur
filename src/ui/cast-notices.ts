import { CAST } from '../sim/canonical-cast.ts';
import type { GameState, GameStateSnapshot } from '../sim/types.ts';

export function castNotices(s: GameState | GameStateSnapshot | null): string[] {
  if (!s) return [];
  const names = CAST.filter((c) => s.castChapter?.blocked?.includes(c.castId)).map((c) => c.name);
  const notices = names.length
    ? [
        `${names.join(', ')} could not join this week. They start fresh here. Their saved history in other games has not changed.`,
      ]
    : [];
  if (s.castScope === 'shared' && !s.castAdmission)
    notices.push(
      'This saved week began before an update. You can finish it here, but its people will not carry over to other games. Start a new game to carry people over.',
    );
  if (s.castScope === 'file')
    notices.push(
      'This file can be played here. Its people will not carry over to other games. Start a new game to carry people over.',
    );
  return notices;
}
