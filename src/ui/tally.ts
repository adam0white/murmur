/** Optional final-page count of player inputs, never Dilan's inner life or actions. */
import { dayStart } from '../sim/dilan.ts';
import { weekOf } from '../sim/game.ts';
import type { GameState } from '../sim/types.ts';

export function notebookTally(s: GameState, enabled: boolean): string {
  if (!enabled || s.phase !== 'end' || !s.final) return '';
  const inputs = s.inputs.filter((i) => i.at >= dayStart(weekOf(s.day) === 2 ? 8 : 1));
  const suggestions = inputs.filter((i) => i.kind === 'say' && !i.insist).length;
  const holds = inputs.filter((i) => i.kind === 'say' && i.insist).length;
  const silences = inputs.filter((i) => i.kind === 'quiet').length;
  return `<section class="block" aria-label="Your notebook tally"><p class="label">Your notebook’s tally · this week</p><p>Total: ${suggestions + holds + silences} recorded choices = ${suggestions} plain suggestions + ${holds} holds + ${silences} chosen silences.</p><p class="soft small">One count per recorded choice. Page turns and moments left to pass add none. This game’s own reckoning counts your inputs; it does not measure Dilan.</p></section>`;
}
