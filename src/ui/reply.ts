import { tick } from '@adam0white/human-framework';
import { cardView, ctxOf, insistCarries, listens, optionsOf, replay } from '../sim/game.ts';
import { momentById } from '../sim/moments.ts';
import type { Answer, GameState } from '../sim/types.ts';

const willing = (lean: string) => lean === 'yes' || lean === 'if pushed';
const nextMoment = 'When the next moment comes, try a different suggestion, or say nothing.';

/** Only used when the exact decision forecast says a hold could have carried. */
function mightHear(before: GameState, a: Answer): string {
  const c = ctxOf(before);
  if (a.moment.startsWith('alarm-') && a.said === 'up') {
    const tired = c.tired ? 'I’m still tired. ' : '';
    return `${tired}Next time the alarm goes, press and hold. I might get my feet down before I start bargaining.`;
  }
  if (a.moment === 'note-1' && a.said === 'reply') {
    return 'I could tell Aylin I’ll call on the bus. Another time, hold that suggestion a little longer.';
  }
  if (a.moment.startsWith('late-') && a.said === 'truth') {
    return 'I might tell Murat I overslept next time. Hold that suggestion before I start on the ring road.';
  }
  if (a.moment === 'ece-1' && a.said === 'talk') {
    return c.flags.late
      ? 'I’m already late, but Ece’s stuck too. Next time, hold the suggestion. I might stay on the phone.'
      : 'Ece could use someone on the phone. Another time, hold that suggestion. I might make time for her.';
  }
  if (a.moment === 'lunch-1' && a.said === 'defend') {
    return 'Another time they start on Ece, I could speak up. Hold that suggestion before I join in.';
  }
  if (a.moment.startsWith('bus-') && a.said === 'call') {
    return 'I might call Mum on the next bus. Hold the suggestion before I open those videos.';
  }
  return 'Another time, press and hold that suggestion. I might be ready to hear it.';
}

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
    const before = replay(s.seed, s.inputs.slice(0, index), a.at, s.version);
    if (listens(s)) {
      const chosen = optionsOf(before, momentById(a.moment)).find((o) => o.id === a.chosen);
      if (!chosen) return a.says;
      if (a.insisted) return a.says;
      const c = ctxOf(before);
      const reason = a.moment.startsWith('alarm-')
        ? chosen.action === 'get-up'
          ? 'The alarm has already gone.'
          : c.tired
            ? 'I’m still tired.'
            : 'I’m not ready to face the morning.'
        : a.moment.startsWith('ece-')
          ? 'Ece caught me in the middle of work.'
          : a.moment.startsWith('lunch-')
            ? a.said === 'defend'
              ? `Speaking up for ${a.moment === 'lunch-4' ? 'Murat' : 'Ece'} means facing the whole table.`
              : 'Everyone at the table is listening.'
            : a.moment.startsWith('bus-')
              ? chosen.action === 'call-mum'
                ? 'Mum’s message is waiting.'
                : 'Mum’s call will have to wait.'
              : a.moment.startsWith('slump-')
                ? c.tired
                  ? 'I need to get through this afternoon.'
                  : 'I want something easy this afternoon.'
                : a.moment.startsWith('bed-')
                  ? chosen.action === 'watch' || chosen.action === 'scroll'
                    ? 'I don’t want the day to be over yet.'
                    : chosen.action === 'write'
                      ? 'The notebook is right beside me.'
                      : 'I need sleep.'
                  : a.moment.startsWith('note-')
                    ? `I haven’t got an answer for ${a.moment === 'note-3' && c.missedMum >= 2 ? 'Mum' : 'Aylin'} yet.`
                    : undefined;
      return reason ? `${reason} I’m going to ${chosen.label}.` : a.says;
    }
    // resolve() advances her body to the input minute before deciding. Forecast that same state.
    if (before.person.now < a.at) tick(before.person, a.at);
    const view = cardView(before);
    if (view?.id === a.moment) {
      const said = view.options.find((option) => option.id === a.said);
      if (!insistCarries(before.person)) {
        recovery = 'At the next moment, ask me plainly, or say nothing. Give me room to choose.';
      } else if (!a.insisted && said && willing(said.pushed)) {
        recovery = mightHear(before, a);
      } else {
        const other = view.options.find((option) => option.id !== a.said && willing(option.lean));
        if (other) recovery = `I could have heard “${other.ink}” ${nextMoment}`;
      }
    }
  }
  return [a.says, recovery].filter(Boolean).join(' ');
}
