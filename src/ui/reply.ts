import { tick } from '@adam0white/human-framework';
import { cardView, insistCarries, replay } from '../sim/game.ts';
import type { Answer, GameState } from '../sim/types.ts';

const willing = (lean: string) => lean === 'yes' || lean === 'if pushed';
const nextMoment = 'When the next moment comes, try a different suggestion, or say nothing.';

/** Her reply plus a way forward. Reconstruct the decision without changing the run or its export. */
export function replyWords(s: GameState, a: Answer): string | undefined {
  if (!a.said || a.said === a.chosen) return a.says;

  let recovery = `Let me choose this time. ${nextMoment}`;
  const index = s.inputs.findLastIndex(
    (input) =>
      input.kind === 'say' &&
      input.at === a.at &&
      input.option === a.said &&
      (input.insist === true) === (a.insisted === true),
  );
  if (index >= 0) {
    const before = replay(s.seed, s.inputs.slice(0, index), a.at);
    // resolve() advances her body to the input minute before deciding. Forecast that same state.
    if (before.person.now < a.at) tick(before.person, a.at);
    const view = cardView(before);
    if (view?.id === a.moment) {
      const said = view.options.find((option) => option.id === a.said);
      if (!insistCarries(before.person)) {
        recovery = 'At the next moment, ask me plainly, or say nothing. Give me room to choose.';
      } else if (!a.insisted && said && willing(said.pushed)) {
        recovery = 'Another time, press and hold a suggestion to insist. I might listen.';
      } else {
        const other = view.options.find((option) => option.id !== a.said && willing(option.lean));
        if (other) recovery = `I could have heard “${other.ink}” ${nextMoment}`;
      }
    }
  }
  return [a.says, recovery].filter(Boolean).join(' ');
}
