/** Optional current third-week campaign: five workdays and Saturday, using actual carried choices and HF acts.
 * Time and effort compete; no cash ledger, invented private facts, extra maintained person or fourth week.
 * Completion hooks run only after a completed HF act. Source passports remain on their separate finite rules.
 */

import { dayStart } from './dilan-content.ts';
import { requestPromise } from './hf4-agenda.ts';
import { readDilan } from './hf4-read.ts';
import type { Ctx, GameState, Moment, Opt } from './types.ts';

const at = (h: number, m = 0) => h * 60 + m;
const f = (s: GameState) => (s.flags.w3 ??= {});
const practiced = (c: Ctx) => c.flags.w2?.practised === true || c.flags.w3?.floor === 'demonstrate';
const opt = (
  id: string,
  ink: string,
  action: string,
  duration: number,
  done: Opt['done'],
  extra: Partial<Opt> = {},
): Opt => ({
  id,
  ink,
  label: ink.replace(/[.!]$/, ''),
  action,
  duration,
  effort: 0.12,
  advertises: { autonomy: 0.15 },
  done,
  ...extra,
});
const rest = opt(
  'leave',
  'Leave on time.',
  'home',
  5,
  'She left on time. The remaining work stayed at the depot.',
  { gives: { rest: 0.25, autonomy: 0.2 } },
);
export const FRIDAY_HANDOVER: Moment = {
  id: 'handover-5',
  day: 5,
  at: at(15, 20),
  place: 'depot',
  scene:
    'The loading-floor handover sheet has not been checked. It is Ece’s next job. Dilan could check it and ask Ece to compare it with her. Her own delivery board is still red.',
  pull: { to: 'board', line: 'Have a coffee. Do your own board first.' },
  options: [
    opt(
      'handover',
      'Check the handover with Ece.',
      'handover-ece',
      20,
      'Dilan checked the handover sheet. Her own late deliveries still needed routing.',
      {
        effort: 0.28,
        gives: { competence: 0.2, belonging: 0.15 },
        followedBy: [{ duration: 50, effort: 0.35 }],
      },
    ),
    opt(
      'board',
      'Finish your own board with a coffee.',
      'coffee',
      15,
      'Dilan worked on her own board with a coffee. She left the handover sheet unchecked.',
      { advertises: { rest: 0.3, competence: 0.2 }, gives: { rest: 0.3, competence: 0.2 } },
    ),
  ],
  after: (s, id) => {
    if (id === 'board') s.flags.coffee = s.day;
    f(s).handover = id;
  },
};
function routine(day: number, kind: 'alarm' | 'bus' | 'bed'): Moment {
  if (kind === 'alarm')
    return {
      id: `alarm-${day}`,
      day,
      at: at(6, 40),
      place: 'bed',
      scene: 'The alarm rings. Her bag is by the door. Her feet are still under the duvet.',
      pull: { to: 'snooze', line: 'Five more minutes. The bag is ready.' },
      options: [
        opt('up', 'Put your feet on the floor.', 'get-up', 15, 'She got up and took her bag.', {
          norms: [{ normId: 'punctuality', relation: 'fulfills' }],
          phrase: { id: 'feet', kind: 'redirect', text: 'Put your feet on the floor' },
          placeId: 'bed',
        }),
        opt('snooze', 'Sleep a little longer.', 'snooze', 30, 'She woke to a second alarm.', {
          tags: ['temptation'],
          norms: [{ normId: 'punctuality', relation: 'violates' }],
          advertises: { sleep: 0.3, rest: 0.25 },
          placeId: 'bed',
        }),
      ],
      after: (s, id) => {
        s.flags.late = id === 'snooze';
      },
    };
  if (kind === 'bus')
    return {
      id: `bus-${day}`,
      day,
      at: at(18, 15),
      place: 'bus',
      scene: (c) =>
        c.day === 17 && c.flags.w3?.route === 'route'
          ? 'The extra route is over. Aylin’s requested arrival time has passed.'
          : ([
              'Ece has sent a sketch of the loading bays. The bus window rattles.',
              'Mum has sent a photograph of three almost identical envelopes. The bus is nearly home.',
              'Aylin has sent a photograph of the laid table. The bus is quiet.',
              'A delivery van passes the bus. Dilan recognizes the parcel number on the rear window.',
              c.flags.w3?.close === 'leave' &&
              typeof c.flags.w3.closeAt === 'number' &&
              c.flags.w3.closeAt <= dayStart(19) + at(17, 20)
                ? 'She caught the early bus. The depot is behind her.'
                : c.flags.w3?.close === 'help'
                  ? 'She has missed the early bus and her evening with Aylin.'
                  : 'The early bus has gone. The depot is behind her.',
            ][c.weekday - 1] ?? 'The bus is nearly home.'),
      pull: { to: 'scroll', line: 'Look at something else for a minute.' },
      options: [
        opt(
          'call',
          'Call Mum.',
          'call-mum',
          10,
          (c) =>
            [
              'Mum asked how the work with Ece had gone. Dilan told her what happened.',
              'Mum explained which photographs were in each envelope.',
              'Mum asked when Dilan would arrive. Dilan told her where she was.',
              'Mum listened while Dilan described the duplicate collection.',
              'Mum asked about the evening. Dilan told her what she had chosen.',
            ][c.weekday - 1] ?? 'She and Mum talked.',
          {
            keeps: ['mum'],
            gives: { belonging: 0.25 },
            phrase: { id: 'mum', kind: 'redirect', text: 'Make time for the call' },
          },
        ),
        opt('scroll', 'Look at your phone.', 'scroll', 15, 'She looked up after her stop.', {
          tags: ['temptation'],
          norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
          advertises: { leisure: 0.2 },
          placeId: 'phone',
        }),
      ],
    };
  return {
    id: `bed-${day}`,
    day,
    at: at(22),
    place: 'bed',
    scene: (c) =>
      c.day === 18
        ? 'She thinks of the duplicate collection while she takes her shoes off.'
        : ([
            'The sketch of the loading bays is beside her notebook.',
            'The photograph envelopes are by the chair. The notebook is open.',
            'Aylin’s message is still on her screen. The notebook is under her phone.',
            'The duplicate collection is still on her mind.',
            'She puts Monday’s clothes on the chair. Tomorrow is Saturday.',
          ][c.weekday - 1] ?? 'The notebook is open on the bed.'),
    pull: { to: 'sleep', line: 'Go to sleep. It was a long day.' },
    options: [
      opt(
        'write',
        'Write down what happened.',
        'write',
        10,
        'She wrote down what she did, including the part she would rather leave out.',
        { gives: { meaning: 0.2 } },
      ),
      opt('sleep', 'Go to sleep.', 'sleep', 5, 'She closed the notebook and switched off the light.'),
    ],
    after: (s, id) => {
      if (id === 'write') {
        s.flags.wrote = (s.flags.wrote ?? 0) + 1;
        s.flags.wroteTonight = true;
      }
    },
  };
}
const central: Moment[] = [
  {
    id: 'floor-15',
    day: 15,
    at: at(14),
    place: 'depot',
    scene: (c) =>
      `${practiced(c) ? 'Ece has practised the delivery board.' : 'Ece has not completed the board practice.'} ${c.flags.w3?.handover === 'handover' ? (c.handoverTogether ? 'They checked a handover together in the first week.' : 'Dilan checked a handover alone in the first week.') : 'Dilan did not check the first week’s handover sheet.'} ${c.flags.w2?.adviceId ? 'Ece remembers borrowing Dilan’s advice for a customer last week.' : 'They have not settled on a phrase to use here.'} An instruction that fits the board sends a van to the wrong loading bay.`,
    pull: { to: 'repeat', line: 'The instruction worked last week. Say it again.' },
    options: [
      opt(
        'demonstrate',
        'Check the loading bay together.',
        'floor-ece',
        35,
        'They checked the sheet against the actual van. Ece crossed out the old bay number.',
        {
          effort: 0.3,
          gives: { competence: 0.3 },
          phrase: { id: 'floor-check', kind: 'redirect', text: 'Check what is actually there' },
        },
      ),
      opt(
        'repeat',
        'Repeat the board instruction.',
        'repeat-board',
        5,
        'The van reached the wrong bay. The sheet had been right about the parcel, not the bay.',
        {
          tags: ['temptation'],
          advertises: { competence: 0.1 },
          norms: [{ normId: 'help-neighbor', relation: 'violates' }],
        },
      ),
    ],
    after: (s, id) => {
      f(s).floor = id;
    },
  },
  {
    id: 'photos-16',
    day: 16,
    at: at(18, 40),
    place: 'home',
    scene: (c) =>
      `${(c.flags.shelf ?? 0) >= 2 ? 'The shelf is standing.' : 'The shelf still needs work.'} Mum asks for an hour sorting photographs. ${c.flags.w2?.photo === 'look' ? 'She recognizes the beach photograph she looked at last week.' : 'One envelope contains the old beach photograph.'}`,
    pull: { to: 'shelf', line: 'Do the shelf first. You have been meaning to.' },
    options: (c) => [
      opt(
        'photos',
        'Sort the photographs with Mum.',
        'call-mum',
        60,
        'They sorted the photographs together. Mum asked before putting the beach photograph in an album.',
        { keeps: ['mum'], gives: { belonging: 0.3 } },
      ),
      opt(
        'shelf',
        (c.flags.shelf ?? 0) >= 2 ? 'Make room on the shelf.' : 'Work on the shelf.',
        'shelf',
        60,
        (x) =>
          (x.flags.shelf ?? 0) >= 2
            ? 'She cleared a shelf for the albums. She had not sorted them with Mum.'
            : 'She fitted a support. Mum’s envelopes stayed closed.',
        { effort: 0.35, gives: { competence: 0.25 } },
      ),
    ],
    after: (s, id) => {
      f(s).photos = id;
      if (id === 'shelf') s.flags.shelf = (s.flags.shelf ?? 0) + 1;
    },
  },
  {
    id: 'arrival-17',
    day: 17,
    at: at(12, 40),
    place: 'yard',
    scene: (c) =>
      `Aylin asks for help at six, before the family meal. ${c.flags.route ? '“Last time you came exhausted.”' : '“Can you come before we eat this time?”'}`,
    pull: { to: 'unsure', line: 'Do not give a time you might miss.' },
    options: [
      opt(
        'promise',
        'Promise to help at six.',
        'reply-aylin',
        5,
        '“Six,” she told Aylin. That was a promise about arriving, not about eating later.',
        { gives: { belonging: 0.2 } },
      ),
      opt(
        'unsure',
        'Say you cannot promise six.',
        'reply-aylin',
        5,
        '“I can’t promise six.” Aylin said she would ask someone else.',
      ),
    ],
    after: (s, id) => {
      f(s).arrival = id;
      if (id === 'promise')
        requestPromise(s.hf, {
          kind: 'promise',
          toId: 'aylin',
          label: 'my six o’clock help for Aylin',
          actions: ['help-aylin'],
          from: dayStart(17) + at(17, 50),
          until: dayStart(17) + at(18, 10),
          importance: 0.6,
        });
    },
  },
  {
    id: 'route-17',
    day: 17,
    at: at(16, 50),
    place: 'depot',
    scene: 'Murat offers a paid extra route. It takes ninety minutes. Aylin needs help at six.',
    pull: { to: 'route', line: 'Take the paid work. You can still eat with them later.' },
    options: [
      opt(
        'route',
        'Take the extra route.',
        'extra-route',
        90,
        'She finished the paid route after six. Eating with Aylin later would not keep an arrival promise.',
        { effort: 0.65, gives: { competence: 0.2 }, followedBy: [{ duration: 25, effort: 0.15 }] },
      ),
      opt(
        'family',
        'Leave for Aylin’s.',
        'help-aylin',
        65,
        'She reached Aylin’s before six and helped prepare the meal.',
        { keeps: ['my six o’clock help for Aylin'], effort: 0.2, gives: { belonging: 0.3 } },
      ),
    ],
    after: (s, id) => {
      f(s).route = id;
    },
  },
  {
    id: 'complaint-18',
    day: 18,
    at: at(14, 10),
    place: 'depot',
    scene: (c) =>
      `${c.flags.ownedMistake ? 'Dilan has already owned an earlier routing mistake.' : 'Dilan still has an earlier routing mistake to explain.'} ${c.flags.w2?.board === 'restore' ? 'The shared board is back in Dilan’s old layout.' : c.flags.w2?.board === 'together' ? 'The shared board has the route names they added together.' : 'The board still uses Ece’s departure times.'} A duplicate collection appears during the solo shift. Ece sees the van starting.`,
    pull: { to: 'quiet', line: 'Fix the sheet quietly. No need for everyone to hear.' },
    options: [
      opt(
        'quiet',
        'Correct the sheet quietly.',
        'repair-sheet',
        25,
        'She corrected the sheet. The van had left; recalling it would take another call.',
        { effort: 0.25, gives: { competence: 0.15 } },
      ),
      opt(
        'call',
        'Call the parcel number across the room.',
        'stop-van',
        5,
        'The driver stopped before leaving. Dilan named the duplicate in front of the room.',
        {
          gives: { competence: 0.25 },
          advertises: { competence: 0.15 },
          norms: [{ normId: 'lying', relation: 'fulfills' }],
          phrase: { id: 'stop-van', kind: 'redirect', text: 'Stop the van before fixing the sheet' },
        },
      ),
    ],
    after: (s, id) => {
      f(s).complaint = id;
    },
  },
  {
    id: 'close-19',
    day: 19,
    at: at(17, 10),
    place: 'depot',
    scene: (c) =>
      `${practiced(c) ? 'Ece says she can close alone.' : 'Ece asks for another closing practice.'} ${c.flags.w2?.closePromise ? 'Dilan remembers the Friday she promised to help.' : 'Dilan made no earlier closing promise.'} Dilan has planned an evening with Aylin.`,
    pull: { to: 'leave', line: 'Leave on time. You have an evening of your own.' },
    options: [
      opt(
        'help',
        'Stay for closing practice.',
        'close-with-ece',
        70,
        'They closed the depot together. Dilan told Aylin she would miss their evening.',
        { effort: 0.4, gives: { competence: 0.25, belonging: 0.15 } },
      ),
      rest,
      opt(
        'ask',
        'Ask whether Ece wants help.',
        'ask-ece',
        10,
        (c) =>
          practiced(c)
            ? '“I can do it,” Ece said. Dilan left the closing to her.'
            : '“I need another practice,” Ece said. Dilan had asked, but had not stayed to do it.',
        { gives: { autonomy: 0.15 } },
      ),
    ],
    after: (s, id) => {
      f(s).close = id;
      f(s).closeAt = Math.floor(readDilan(s.hf.run).at / 60_000);
    },
  },
  {
    id: 'voice-20',
    day: 20,
    at: at(10),
    window: 8,
    place: 'home',
    scene: (c) => `She records a note and listens. “${thirdWeekNote(c)}”`,
    pull: { to: 'keep', line: 'Keep it for yourself. You do not have to send every thought.' },
    options: [
      opt('send', 'Send the note to Mum.', 'send', 2, 'She sent the note as it was.', {
        gives: { belonging: 0.2 },
      }),
      opt(
        'revise',
        'Change the advice before sending.',
        'revise-note',
        10,
        'She changed the advice about the board: check the loading floor too. Then she sent the revised note.',
        { gives: { meaning: 0.2 } },
      ),
      opt('keep', 'Keep the note for yourself.', 'keep-note', 2, 'She saved the note without sending it.'),
    ],
    after: (s, id) => {
      s.flags.sent = id;
      f(s).note =
        thirdWeekNote({ chosen: s.chosen, flags: s.flags }) +
        (id === 'revise' ? ' I changed the advice: check the loading floor as well as the board.' : '');
    },
  },
];
export const WEEK_THREE: Moment[] = [
  ...Array.from({ length: 5 }, (_, i) =>
    [
      routine(i + 15, 'alarm'),
      ...central.filter((m) => m.day === i + 15),
      routine(i + 15, 'bus'),
      routine(i + 15, 'bed'),
    ].sort((a, b) => (a.at as number) - (b.at as number)),
  ).flat(),
  ...central.filter((m) => m.day === 20),
];
export function thirdWeekNote(c: Pick<Ctx, 'chosen' | 'flags'>): string {
  const lines = ['Mum, it’s me.'];
  const first = c.chosen['voice-6'];
  if (first)
    lines.push(
      first === 'send'
        ? 'In the first week I sent you that note.'
        : first === 'call'
          ? 'In the first week I called instead of sending the note.'
          : 'In the first week I deleted the note.',
    );
  const second = c.flags.w2?.saturday;
  if (second)
    lines.push(
      second === 'offer'
        ? 'Last Saturday I offered Ece another practice.'
        : second === 'answer'
          ? 'Last Saturday I answered Ece.'
          : 'Last Saturday I left Ece’s message unanswered.',
    );
  if (c.chosen['dinner-3'] === 'truth') lines.push('I told you I wasn’t eating properly.');
  if (c.flags.w2?.practised) lines.push('We practised the board together.');
  if (c.flags.w3?.floor === 'demonstrate') lines.push('This week we checked the loading bay too.');
  else if (c.flags.w3?.floor === 'repeat') lines.push('The same instruction sent the van to the wrong bay.');
  if (c.flags.w3?.photos === 'photos') lines.push('We sorted the photographs.');
  if (c.flags.w3?.route === 'route') lines.push('I took the extra route and missed six.');
  if (c.flags.w3?.close === 'help') lines.push('I stayed to practise closing and missed my evening.');
  return lines.join(' ');
}
export function thirdWeekThreads(s: GameState): string[] {
  return [
    s.flags.w3?.floor === 'demonstrate'
      ? 'Ece checked the loading bay with Dilan.'
      : 'The board instruction still needed checking against the loading floor.',
    s.flags.w3?.photos === 'photos'
      ? 'Mum’s photographs are sorted.'
      : 'The photographs still need sorting together.',
    s.flags.w3?.route === 'family' ? 'Dilan helped Aylin before the meal.' : 'Dilan did not help before six.',
    s.flags.w3?.close === 'help' ? 'Dilan stayed for closing practice.' : 'Ece’s closing was left to her.',
  ];
}

/** Her evening reflection names completed acts, never the earlier week's generic Friday ending. */
export function thirdWeekHerLine(s: GameState): string {
  const w = s.flags.w3 ?? {};
  switch (s.day) {
    case 15:
      return w.floor === 'demonstrate'
        ? 'We checked the loading bay before changing the instruction.'
        : w.floor === 'repeat'
          ? 'The board instruction sent the van to the wrong bay.'
          : 'I did not check the loading bay with Ece.';
    case 16:
      return w.photos === 'photos'
        ? 'We sorted the photographs together.'
        : w.photos === 'shelf'
          ? 'I worked on the shelf. I did not sort the photographs.'
          : 'I did not sort the photographs with Mum.';
    case 17:
      return w.route === 'family'
        ? 'I reached Aylin’s before the meal and helped.'
        : w.route === 'route'
          ? 'I took the extra route. I missed six.'
          : 'I did not finish either plan for the afternoon.';
    case 18:
      return w.complaint === 'call'
        ? 'I called out the parcel number before the van left.'
        : w.complaint === 'quiet'
          ? 'I fixed the sheet after the van had left.'
          : 'I did not finish dealing with the duplicate collection.';
    case 19:
      return w.close === 'help'
        ? 'I stayed to close with Ece. I missed the evening with Aylin.'
        : w.close === 'ask'
          ? 'I asked Ece what she needed. I did not stay to close.'
          : w.close === 'leave'
            ? 'I left on time. I left the closing to Ece.'
            : 'I did not finish what I chose at closing time.';
    default:
      return 'The day is over.';
  }
}
