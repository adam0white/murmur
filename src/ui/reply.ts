import { tick } from '@adam0white/human-framework';
import { cardView, ctxOf, insistCarries, listens, optionsOf, replay } from '../sim/game.ts';
import { momentById } from '../sim/moments.ts';
import type { Answer, GameState } from '../sim/types.ts';
import { quotedWords } from './presentation.ts';

const willing = (lean: string) => lean === 'yes' || lean === 'if pushed';
const nextMoment = 'When the next moment comes, try a different suggestion, or say nothing.';

/** Labels belong to recorded simulation state; only speech uses Dilan's first person. */
function spokenAction(label: string): string {
  const firstPerson: Record<string, string> = {
    'say it was her': 'say it was me',
    'keep her head down': 'keep my head down',
    'eat at her desk': 'eat at my desk',
    'say she’s busy': 'say I’m busy',
    'check the returns herself': 'check the returns myself',
    'tell Aylin she is unsure': 'tell Aylin I’m unsure',
    'tell Ece she cannot stay': 'tell Ece I can’t stay',
  };
  return firstPerson[label] ?? label;
}

/** Replace generic assent only; pressure, refusal and bodily limits keep their own words. */
function assentWords(s: GameState, a: Answer): string | undefined {
  if (
    !listens(s) ||
    a.insisted ||
    a.verdict !== 'assented' ||
    !/^(?:Alright[,.] I['’]ll do it\.|Fine\.)$/.test(a.says ?? '')
  )
    return a.says;
  const day = Number(a.moment.split('-').at(-1));
  const routine = a.moment.split('-')[0];
  const words: Record<string, Record<string, string[]>> = {
    alarm: {
      up: [
        'Feet down. Before I start bargaining.',
        'Yes. Out of bed this time.',
        'I’m getting up. Leave the phone there.',
        'Up, then. The floor is cold.',
        'Friday. Feet on the floor.',
      ],
      snooze: [
        'Five minutes. I’m staying here.',
        'Not yet. One more alarm.',
        'I’m pulling the cover back up.',
        'Five more. Then I’ll face it.',
        'It’s Friday. I want these five minutes.',
      ],
    },
    slump: {
      coffee: [
        'Coffee, then. The board is still red.',
        'I’m putting the kettle on.',
        'I want the coffee today.',
        'One cup before I face the board again.',
        'Coffee. Two hours left.',
      ],
      walk: [
        'Water first. Then outside for a minute.',
        'I could use some air.',
        'Yes. Away from this screen for a minute.',
        'I’m taking the water with me.',
        'A short walk. Then the last drops.',
      ],
    },
    bus: {
      scroll: [
        'I’m opening the videos.',
        'Something easy for the ride home.',
        'I want to look at something else.',
        'I’m scrolling until my stop.',
        'Friday. I want the bus ride to myself.',
      ],
      text: [
        'I’ll text Mum. Tomorrow, promise.',
        'A message, then. I’m not calling now.',
        'I’ll tell Mum I’ll ring tomorrow.',
        'I can send her a message from here.',
        'I’m texting her before the weekend.',
      ],
      call: [
        'Ten minutes. I can ring Mum.',
        'I’m calling her before I open anything else.',
        'Yes. I want to hear Mum.',
        'I’ll ring while I have the bus ride.',
        'Mum first. The videos can wait.',
      ],
    },
    bed: {
      write: [
        'I’ll get the notebook out.',
        'A few lines before I sleep.',
        'I want to put today on paper.',
        'Yes. Write it down while I remember.',
        'The notebook. There’s a week to put down.',
      ],
      scroll: [
        'One video. I’m not ready for sleep.',
        'I’m keeping the phone a little longer.',
        'I want to watch something before sleep.',
        'A video before I turn out the light.',
        'It’s nearly the weekend. One more.',
      ],
      sleep: [
        'Phone down. I’m done for tonight.',
        'Yes. Turn out the light.',
        'I need this night’s sleep.',
        'No more screen. I’m going to sleep.',
        'The week can wait until morning.',
      ],
    },
  };
  const routineWords = words[routine ?? '']?.[a.chosen];
  if (routineWords && day >= 1 && day <= 5) return routineWords[day - 1];
  if (a.moment === 'note-1' && a.chosen === 'reply') return 'I’ll tell Aylin: tonight, on the bus.';
  return a.says;
}

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
  if (!a.said) return a.says;
  if (a.said === a.chosen) return assentWords(s, a);

  // HF's deferred wording can promise rejected advice after an action that closes its window.
  // Describe these recorded choices without adding a future commitment.
  if (s.version === '0.4.2' && a.verdict === 'deferred') {
    if (a.moment === 'gym-5' && a.said === 'cancel' && a.chosen === 'keep')
      return 'I’m leaving the membership as it is. It renews this morning.';
    if (a.moment === 'error-10' && a.said === 'aside' && a.chosen === 'room')
      return 'The van is moving. I’m calling the number across the room.';
  }

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
              : a.moment === 'lunch-2'
                ? chosen.action === 'eat-desk'
                  ? 'The deliveries still need routing.'
                  : 'Ece has made room for me.'
                : a.moment === 'lunch-1'
                  ? 'Murat has the whole table laughing.'
                  : a.moment === 'lunch-3'
                    ? 'I have to work beside them after lunch.'
                    : a.moment === 'lunch-4'
                      ? 'Murat will hear about what I say.'
                      : chosen.action === 'plan-bowl'
                        ? 'I want to go with them tonight.'
                        : 'I want tonight to myself.'
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
      return reason ? `${reason} I’m going to ${spokenAction(chosen.label)}.` : a.says;
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
        if (other) recovery = `I could have heard ${quotedWords(other.ink, true)} ${nextMoment}`;
      }
    }
  }
  return [a.says, recovery].filter(Boolean).join(' ');
}
