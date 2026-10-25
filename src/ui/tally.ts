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
  return `<section class="block" aria-label="Your notebook tally"><p class="label">Your choices this week</p><p>Total: ${suggestions + holds + silences} recorded ${suggestions + holds + silences === 1 ? 'choice' : 'choices'} = ${suggestions} ${suggestions === 1 ? 'suggestion' : 'suggestions'} + ${holds} ${holds === 1 ? 'time' : 'times'} you insisted + ${silences} ${silences === 1 ? 'time' : 'times'} you chose to say nothing.</p><p class="soft small">Each recorded choice counts once. Turning a page or letting time pass adds nothing. This tally counts your choices. It does not measure Dilan.</p></section>`;
}
