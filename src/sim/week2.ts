/** Week two: what being depended on does to an ordinary week. Week one's last page is fact. */

import { DAY0, LABEL } from './dilan-content.ts';
import { isCanonicalEdition } from './edition.ts';
import { releasePromise, requestPromise } from './hf4-agenda.ts';
import { readDilan } from './hf4-read.ts';
import type { Ctx, GameState, Moment, Opt } from './types.ts';

const at = (h: number, m = 0) => h * 60 + m;
const absolute = (day: number, minute: number) => DAY0 + (day - 1) * 1440 + minute;
const dayLine = (c: Ctx, lines: string[]) => lines[c.weekday - 1] ?? lines[0] ?? '';
// Every current HF4 route uses weekday-specific words; historical replay uses src/legacy.
const routineWords = (legacy: string, nights: string[]) => (c: Ctx) =>
  c.version?.startsWith('0.10.') ||
  c.version === '0.4.1' ||
  c.version === '0.4.2' ||
  c.version === '0.5.0' ||
  isCanonicalEdition(c.version)
    ? dayLine(c, nights)
    : legacy;
const w2 = (s: GameState) => (s.flags.w2 ??= {});
const had = (c: Ctx, line: string) => c.weekOne?.threads.includes(line) ?? false;
const ownColumns = (c: Ctx) =>
  had(c, 'Ece has her own columns now. She sends Dilan a photo of them every morning.') ||
  c.chosen['shadow-4'] === 'stay';
const shelfStands = (c: Ctx) =>
  (c.flags.shelf ?? 0) >= 2 ||
  c.chosen['shelf-4'] === 'aylin' ||
  had(c, 'Aylin came to help with the shelf on Saturday. There was still cake.');
const changedScreen = (c: Ctx) =>
  had(c, 'She changed the lock screen. The beach photo can stay in the album.') ||
  c.weekOne?.sent === 'send' ||
  c.weekOne?.sent === 'call';
const feetStrong = (c: Ctx) => (c.phrases.find((p) => p.id === 'feet')?.practice ?? 0) >= FEET_ALONE_FROM;

export const FEET_ALONE_FROM = 0.45;
export const upAloneLine = '“Put your feet on the floor,” she told herself. Then she got up.';

function mumOpening(c: Ctx): string {
  const sent = c.weekOne?.sent ?? c.flags.sent;
  if (sent === 'send') return 'Mum’s reply on Saturday lasted eleven minutes.';
  if (sent === 'call') return 'She was still talking to Mum on Saturday when the kettle finished boiling.';
  return 'She rang Mum on Sunday. Mum had been saving things up.';
}

const getUp: Opt = {
  id: 'up',
  ink: 'Get up and put your feet on the floor.',
  label: 'get up',
  action: 'get-up',
  duration: 15,
  effort: 0.15,
  advertises: { competence: 0.1 },
  gives: { competence: 0.15, autonomy: 0.1 },
  norms: [{ normId: 'punctuality', relation: 'fulfills' }],
  placeId: 'bed',
  phrase: { id: 'feet', kind: 'redirect', text: 'Put your feet on the floor' },
  done: 'She was up before the second alarm.',
};
const snooze: Opt = {
  id: 'snooze',
  ink: 'Sleep for five more minutes.',
  label: 'sleep five more minutes',
  action: 'snooze',
  duration: 30,
  advertises: { sleep: 0.3, rest: 0.25 },
  tags: ['temptation'],
  norms: [{ normId: 'punctuality', relation: 'violates' }],
  placeId: 'bed',
  done: 'She slept through the second alarm, and the third.',
};

function alarm(day: number): Moment {
  return {
    id: `alarm-${day}`,
    day,
    at: at(6, 40),
    place: 'bed',
    when: (c) => !feetStrong(c),
    scene: (c) =>
      dayLine(c, [
        `${mumOpening(c)}\nIt is 06:40. Now her alarm is ringing too.`,
        'It is 06:40 on Tuesday. She has one foot out of bed but is still deciding whether to get up.',
        'It is 06:40 on Wednesday. The light through the curtains looks cold.',
        'It is 06:40 on Thursday. A van reverses outside. The van’s warning beeps sound like another alarm.',
        'It is 06:40 on Friday. Her bag is already by the door.',
      ]),
    pull: {
      to: 'snooze',
      line: (c) =>
        c.tired
          ? 'Sleep for five more minutes. You still feel tired from last night.'
          : 'Sleep for five more minutes. You know exactly how late you can get up.',
      borrow: 'You said to listen to yourself. You want to sleep.',
    },
    options: [getUp, snooze],
    after: (s, chosen) => {
      s.flags.late = chosen === 'snooze';
    },
  };
}

function late(day: number): Moment {
  return {
    id: `late-${day}`,
    day,
    at: at(8, 25),
    place: 'depot',
    when: (c) => c.flags.late === true,
    scene: (c) =>
      c.flags.lied !== undefined && c.flags.lied < c.day
        ? 'It is 08:25. Murat looks from her to the clock. He does not mention the ring road.'
        : 'It is 08:25. Murat moves his tea off her desk. “You made it in, eventually.”',
    pull: {
      to: 'lie',
      line: 'Say the ring road delayed you. He has a whole shift to think about.',
      strength: 1,
    },
    options: [
      {
        id: 'truth',
        ink: 'Say you overslept.',
        label: 'own up',
        action: 'own-up',
        duration: 3,
        advertises: { esteem: -0.05 },
        gives: (c) =>
          (c.flags.lateDays ?? 0) >= 2 ? { esteem: -0.2, competence: -0.1 } : { esteem: 0.1, safety: 0.1 },
        norms: [{ normId: 'lying', relation: 'fulfills' }],
        placeId: 'depot',
        phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
        done: (c) =>
          (c.flags.lateDays ?? 0) >= 2
            ? '“I overslept.” Murat wrote it down. He took longer to write it than she took to say it.'
            : '“I overslept. I’m sorry.” Murat handed her the tea he had moved. It wasn’t hers.',
      },
      {
        id: 'lie',
        ink: 'Say the ring road delayed you.',
        label: 'blame the ring road',
        action: 'lie',
        duration: 2,
        advertises: { esteem: 0.15, safety: 0.1 },
        gives: (c) =>
          c.flags.lied === undefined ? { esteem: 0.15, safety: 0.15 } : { esteem: -0.2, safety: -0.1 },
        tags: ['temptation'],
        norms: [{ normId: 'lying', relation: 'violates' }],
        placeId: 'depot',
        done: (c) =>
          c.flags.lied === undefined
            ? '“The ring road delayed me.” He nodded and turned to the delivery board. The excuse worked.'
            : '“The ring road delayed me.” Murat capped his pen. “I see.”',
      },
    ],
    after: (s, chosen) => {
      s.flags.lateDays = (s.flags.lateDays ?? 0) + 1;
      if (chosen === 'lie') s.flags.lied = s.day;
    },
  };
}

function bus(day: number): Moment {
  return {
    id: `bus-${day}`,
    day,
    at: (c) => (c.weekday === 5 && c.flags.w2?.earlyBus ? at(17, 25) : at(18, 10)),
    place: 'bus',
    scene: (c) =>
      dayLine(c, [
        'Dilan is on the bus home. Mum has sent a photograph taken too close to see what it shows.',
        'Dilan is on the bus home. She has a missed call from Mum, followed by “It’s nothing urgent”.',
        'Dilan is on the bus home. Mum’s number is above Aylin’s. Her family appears in alphabetical order.',
        'Dilan is on the bus home. Mum has typed “Are you on the bus” without a question mark.',
        c.flags.w2?.earlyBus
          ? 'Dilan is on the early bus. She has a whole seat to herself. Mum’s number is on her phone.'
          : 'Dilan is standing on the later bus. Her thumb is over Mum’s number on her phone.',
      ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        dayLine(c, [
          'You spoke to her as recently as the weekend. You can wait before talking again.',
          'It’s nothing urgent. She said so herself.',
          'You have a family evening ahead. Save some energy for that.',
          'You’ll be home soon. Call when you’ve sat down.',
          'Keep this bit of Friday for yourself.',
        ]),
      borrow: 'You said you can say no, even to Mum.',
    },
    options: [
      {
        id: 'call',
        ink: routineWords('Call Mum.', [
          'Ring her. Ask what the photograph is.',
          'Call her back. Even if it’s nothing urgent, she has something to say.',
          'Call Mum before going to Aylin’s.',
          'Call her and tell her you’re on the bus.',
          'Call her. Work can stay at work.',
        ]),
        label: 'call Mum',
        action: 'call-mum',
        duration: 20,
        effort: 0.2,
        focus: 0.5,
        advertises: { belonging: 0.15, esteem: -0.15 },
        gives: { belonging: 0.45, meaning: 0.2 },
        norms: [{ normId: 'kindness-to-parents', relation: 'fulfills' }],
        placeId: 'phone',
        phrase: { id: 'ten', kind: 'redirect', text: 'It’s ten minutes' },
        done: (c) =>
          dayLine(c, [
            'It was a tomato. Mum held it further from the lens while they talked.',
            'Their talk about nothing urgent took most of the journey. Dilan stayed on the line.',
            'Mum wanted to know what Aylin was making. Dilan said she would report back.',
            '“Yes, I’m on the bus.” Mum said she could hear that. They talked anyway.',
            'Mum asked about work. “I’ve finished,” Dilan said. For once Mum left it there.',
          ]),
      },
      {
        id: 'scroll',
        ink: routineWords('Scroll for a bit.', [
          'Look at something that isn’t Mum’s photograph.',
          'Leave the missed call unanswered. Watch something.',
          'Watch videos of other people’s dinners for a bit.',
          'Spend the journey looking at your phone.',
          'Keep Friday to yourself. Scroll.',
        ]),
        label: 'scroll for a bit',
        action: 'scroll',
        duration: 30,
        advertises: { leisure: 0.3 },
        gives: { leisure: 0.05, meaning: -0.1 },
        tags: ['temptation'],
        norms: [{ normId: 'keep-promise', relation: 'violates' }],
        placeId: 'phone',
        done: (c) =>
          dayLine(c, [
            'She watched somebody clean a cooker that had never been dirty.',
            'She scrolled. “Nothing urgent” stayed above the videos.',
            'She watched videos of other people’s dinners all the way home.',
            'She scrolled past a bus very like the one she was sitting on.',
            'She watched the screen until the window went dark.',
          ]),
      },
      {
        id: 'text',
        ink: routineWords('Text Mum and promise to call tomorrow.', [
          'Text Mum to say you cannot see what the photo shows and will call tomorrow.',
          'Text Mum to say you saw her call and promise to call tomorrow.',
          'Text Mum to say you are going to Aylin’s and will call tomorrow.',
          'Text Mum to say you are on the bus and will call tomorrow.',
          'Text Mum to promise a proper call on Saturday.',
        ]),
        label: 'text Mum instead',
        action: 'text-mum',
        duration: 3,
        advertises: { belonging: 0.05 },
        gives: { belonging: 0.1 },
        placeId: 'phone',
        done: (c) =>
          dayLine(c, [
            '“I’ll call tomorrow, I promise.” Mum sent a sharper photograph of the tomato.',
            '“I’ll call tomorrow, I promise.” “There’s no rush,” Mum wrote immediately.',
            '“I’ll call tomorrow, I promise.” Mum asked her to take a container to Aylin’s.',
            '“I’ll call tomorrow, I promise.” Mum sent just one thumbs-up.',
            '“I’ll call tomorrow, I promise.” Mum wrote “Saturday” as if checking her diary.',
          ]),
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'call') s.flags.calls = (s.flags.calls ?? 0) + 1;
    },
  };
}

function bed(day: number): Moment {
  return {
    id: `bed-${day}`,
    day,
    at: at(21, 30),
    place: 'bed',
    scene: (c) =>
      dayLine(c, [
        changedScreen(c)
          ? 'It is 21:30. Dilan is in bed. The light from her new lock screen falls on the notebook.'
          : 'It is 21:30. Dilan is in bed. The beach photo is still on her lock screen. The notebook is under her phone.',
        'It is 21:30. Dilan is in bed. She has a sentence in her head and no pen within reach.',
        'It is 21:30. Dilan is in bed. Aylin has sent a photograph of the leftovers.',
        'It is 21:30. Dilan is in bed. There is a dent in her finger where she has been gripping the pen.',
        'It is 21:30. Dilan is in bed. The bag is on the chair.',
      ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        dayLine(c, [
          'You’ve had a long Monday. Watch other people’s lives for a bit.',
          'You’ve done enough talking. Watch something.',
          'You’ve spent a whole evening with family. You don’t need to spend another writing about it.',
          'Leave the notebook. You know what happened.',
          'It’s Friday. Let the day end without writing about it.',
        ]),
      borrow: 'You said to leave it with someone else. Leave this for tomorrow.',
      strength: 0.45,
    },
    options: [
      {
        id: 'write',
        ink: routineWords('Write the day down.', [
          'Open the notebook. Start with Monday.',
          'Write down what you told Ece.',
          'Write half a page about dinner. It counts.',
          'Write about the delivery board. Leave those thoughts on the page.',
          'Write a little before the week ends.',
        ]),
        label: 'write the day down',
        action: 'write',
        duration: 15,
        effort: 0.05,
        norms: [{ normId: 'gratitude', relation: 'fulfills' }],
        advertises: { meaning: 0.1 },
        gives: { meaning: 0.25 },
        placeId: 'bed',
        done: (c) =>
          dayLine(c, [
            'She wrote “Monday” and had to check the date.',
            'She wrote down what she had told Ece. It looked different on paper.',
            'She wrote half a page. Aylin’s container left a grease mark on it.',
            'She drew the delivery board in the margin. Then she crossed it out.',
            'She wrote until her hand stopped pressing so hard.',
          ]),
      },
      {
        id: 'scroll',
        ink: routineWords('Watch one more video.', [
          'Watch somebody else tidy for a bit.',
          'Watch one short video. You have talked enough.',
          'See what somebody else made for dinner.',
          'Watch something. The pen can wait.',
          'It’s Friday. Watch one more video before sleep.',
        ]),
        label: 'watch one more video',
        action: 'scroll',
        duration: 75,
        advertises: { leisure: 0.25, rest: 0.1 },
        gives: { leisure: 0.05 },
        placeId: 'phone',
        done: (c) =>
          dayLine(c, [
            'A woman organised a drawer. Dilan watched her organise another.',
            'A dog refused to come indoors. She understood the dog.',
            'She watched someone make the dinner she had just eaten, worse.',
            'She watched a video about getting to bed earlier. Then she watched its second part.',
            'She watched until the phone slipped out of her hand.',
          ]),
      },
      {
        id: 'sleep',
        ink: routineWords('Put the phone on the floor and go to sleep.', [
          'Put the phone down. Monday is enough.',
          'Leave the sentence unwritten and go to sleep.',
          'Save the photo of the leftovers and put the phone down.',
          'Unclench your hand. Turn out the light.',
          'Leave the bag till morning and go to sleep.',
        ]),
        label: 'put the phone away',
        action: 'lights-out',
        duration: 5,
        advertises: { rest: 0.1 },
        gives: (c) => (c.tired ? { rest: 0.2, autonomy: 0.15 } : { rest: 0.1 }),
        placeId: 'bed',
        done: routineWords('She put the phone face down on the floor, and slept.', [
          'She put the phone face down on the floor. Monday could stay unwritten.',
          'The sentence went round once more. By morning she had lost it.',
          'She saved Aylin’s photograph and put the phone down. There was lunch for tomorrow.',
          'She set the pen down. The dent in her finger faded before she slept.',
          'The bag stayed on the chair. She turned away from its outline and slept.',
        ]),
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'write') {
        s.flags.wrote = (s.flags.wrote ?? 0) + 1;
        s.flags.wroteTonight = true;
      }
    },
  };
}

const signLetter: Opt = {
  id: 'sign',
  ink: 'Sign it.',
  label: 'sign the letter',
  action: 'sign-letter',
  duration: 5,
  advertises: { autonomy: 0.15 },
  gives: { autonomy: 0.1 },
  done: 'She signed it and put it back in the envelope.',
};
const putLetter: Opt = {
  id: 'bowl',
  ink: 'Put it under the fruit bowl.',
  label: 'put the letter away',
  action: 'put-letter',
  duration: 2,
  advertises: { rest: 0.1 },
  gives: { autonomy: 0.05 },
  done: 'She put the letter under the fruit bowl. One corner still showed.',
};
const monday: Moment[] = [
  alarm(8),
  {
    id: 'letter-8',
    day: 8,
    at: at(7, 12),
    place: 'home',
    scene: (c) =>
      `${feetStrong(c) ? `${mumOpening(c)}\n` : ''}A tenancy letter is by the door. Her name shows through the envelope’s window.`,
    pull: { to: 'bowl', line: 'Put it under the fruit bowl. That’s where you keep important things.' },
    options: [
      {
        id: 'read',
        ink: 'Read it before deciding.',
        label: 'read the tenancy letter',
        action: 'read-letter',
        duration: 10,
        effort: 0.1,
        advertises: { competence: 0.15, autonomy: 0.1 },
        gives: { competence: 0.1, autonomy: 0.05 },
        done: 'She read the tenancy letter and left it unsigned by her shoes.',
      },
      signLetter,
      {
        id: 'unopened',
        ink: 'Leave it unopened.',
        label: 'leave the letter unopened',
        action: 'leave-letter',
        duration: 2,
        advertises: { rest: 0.1 },
        gives: { rest: 0.1 },
        done: 'She stepped over it to find her shoes.',
      },
      putLetter,
    ],
    after: (s, chosen) => {
      w2(s).letter = chosen;
      if (chosen === 'read') w2(s).letterRead = true;
    },
  },
  {
    // Prospective host paper task, not legal terms or a new reading faculty. Only completed reading opens it.
    id: 'letter-decision-8',
    day: 8,
    at: at(7, 25),
    place: 'home',
    when: (c) => c.flags.w2?.letter === 'read',
    scene: 'Dilan has read the tenancy letter. It is still unsigned. The envelope is open by her shoes.',
    pull: { to: 'bowl', line: 'You can still leave it for later.' },
    options: [signLetter, putLetter],
    after: (s, chosen) => {
      w2(s).letter = chosen;
    },
  },
  late(8),
  {
    id: 'returns-8',
    day: 8,
    at: at(10, 45),
    place: 'depot',
    scene: (c) => {
      if (ownColumns(c))
        return 'Ece’s morning photo of her delivery board is on Dilan’s phone. “I can deal with your returned parcels too.”';
      if (c.flags.eceBlamed || had(c, 'Ece still thinks it was her scanner.'))
        return 'Ece checks the scanner before offering. “I can deal with the returned parcels, if you trust this scanner.”';
      if (
        c.chosen['shadow-4'] === 'go' ||
        had(c, 'Ece never asked to watch Dilan work again. She asked Murat instead.')
      )
        return 'Murat sends Ece over with the returned parcels. “I know how to handle them now,” she says. “Leave them with me.”';
      if (c.chosen['lunch-1'] === 'defend')
        return 'Ece brings her tea without asking. “Leave the returned parcels with me.”';
      if (c.flags.gossiped)
        return 'Ece puts the returned parcels between them. “I can deal with these.” She keeps hold of the tray.';
      return 'Ece lifts the returned parcels off Dilan’s desk. “Leave them with me.”';
    },
    pull: { to: 'let', line: 'Let her do it. You’ve got enough work without taking on hers.' },
    options: [
      {
        id: 'let',
        ink: 'Let Ece handle the returned parcels.',
        label: 'leave the returns with Ece',
        action: 'accept-help',
        duration: 3,
        advertises: { rest: 0.2, competence: 0.1 },
        gives: { rest: 0.2, competence: 0.2 },
        done: 'Ece dealt with all the returned parcels correctly. Dilan drank her tea while it was hot.',
      },
      {
        id: 'redo',
        ink: 'Handle the returned parcels yourself.',
        label: 'check the returns herself',
        action: 'redo-returns',
        duration: 25,
        effort: 0.2,
        advertises: { competence: 0.25 },
        gives: { competence: 0.05, belonging: -0.1 },
        done: 'She dealt with the returned parcels herself. Ece took back the empty tray.',
      },
    ],
    after: (s, chosen) => {
      w2(s).returns = chosen;
    },
  },
  bus(8),
  {
    id: 'room-8',
    day: 8,
    at: at(19, 20),
    place: 'home',
    scene: (c) =>
      shelfStands(c)
        ? 'Dilan is home. The shelf stands in the corner. The books are still in a pile beside it.'
        : 'Dilan is home. Dust has gathered around the unfinished shelf parts, leaving a clean outline.',
    pull: { to: 'rest', line: 'Have tea first. There is no hurry to finish the shelf.' },
    options: (c) => [
      {
        id: 'shelf',
        ink: shelfStands(c) ? 'Put the books on it.' : 'Finish the shelf.',
        label: shelfStands(c) ? 'put the books away' : 'finish the shelf',
        action: shelfStands(c) ? 'books' : 'shelf',
        duration: 45,
        effort: 0.3,
        advertises: { competence: 0.2 },
        gives: { competence: 0.3, meaning: 0.15 },
        done: shelfStands(c)
          ? 'She put the books on the shelf. There was more floor than she remembered.'
          : 'She finished the shelf. She pressed down on it before trusting it with a book.',
      },
      {
        id: 'rest',
        ink: 'Have your tea.',
        label: 'sit with my tea',
        action: 'rest',
        duration: 30,
        advertises: { rest: 0.25 },
        gives: { rest: 0.25 },
        done: 'She sat with her tea. It stayed hot almost to the bottom.',
      },
    ],
    after: (s, chosen) => {
      w2(s).room = chosen;
      if (chosen === 'shelf') s.flags.shelf = Math.max(2, s.flags.shelf ?? 0);
    },
  },
  bed(8),
];

/** What her strongest phrase becomes when she hands it to Ece. Some of your words do not travel. */
const ADVICE: Record<string, string> = {
  plain: 'Just say it plainly. The parcel is late, and it’ll be there by four.',
  ten: 'It’s ten minutes. Ring him back before he rings you.',
  walk: 'Leave the phone. Do not answer the call.',
  feet: 'Put your feet on the floor and deliver it yourself.',
};
const OWN_ADVICE = 'Tell him when it will arrive.';
/** Whether the advice suits Ece's problem (a customer who keeps ringing). */
const fitsEce = (id: unknown) => id === 'plain' || id === 'ten' || id === 'own' || id === undefined;
function advice(c: Ctx): { id: string; text: string } {
  const top = c.phrases[0];
  const says = top ? ADVICE[top.id] : undefined;
  return top && says ? { id: top.id, text: says } : { id: 'own', text: OWN_ADVICE };
}

const tuesday: Moment[] = [
  alarm(9),
  late(9),
  {
    id: 'words-9',
    day: 9,
    at: at(10, 10),
    place: 'depot',
    scene: (c) =>
      `A customer keeps ringing Ece about a late parcel. “What do I say?”\nDilan hears herself answer: “${advice(c).text}”`,
    pull: { to: 'stand', line: 'That worked for you. Let her try it.' },
    options: [
      {
        id: 'stand',
        ink: 'Let Ece use that advice.',
        label: 'let my advice stand',
        action: 'advise-ece',
        duration: 3,
        advertises: { competence: 0.2 },
        gives: (c) =>
          fitsEce(advice(c).id)
            ? { competence: 0.25, belonging: 0.15 }
            : { competence: -0.15, belonging: -0.1 },
        done: 'Ece repeated the words under her breath, then picked up the phone.',
      },
      {
        id: 'soften',
        ink: 'Suggest gentler words.',
        label: 'soften my advice',
        action: 'soften-advice',
        duration: 5,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.05, competence: -0.1 },
        done: '“Say it might be this afternoon.” Ece wrote down “might”.',
      },
      {
        id: 'ask',
        ink: 'Ask her what she thinks.',
        label: 'ask Ece what she thinks',
        action: 'ask-ece',
        duration: 8,
        advertises: { meaning: 0.1 },
        gives: { meaning: 0.2, competence: 0.15 },
        done: '“I think he needs to stop ringing me,” Ece said. She rang him back to say it.',
      },
    ],
    after: (s, chosen) => {
      const c: Ctx = {
        day: s.day,
        weekday: 2,
        week: 2,
        flags: s.flags,
        chosen: s.chosen,
        missedMum: 0,
        tired: false,
        note: '',
        phrases: s.phrases
          .map((p) => ({
            ...p,
            practice:
              readDilan(s.hf.run).promptings.responses.find((r) => r.id === p.id)?.effectivePractice ?? 0,
          }))
          .sort((a, b) => b.practice - a.practice),
      };
      const a = advice(c);
      Object.assign(w2(s), { advice: chosen, adviceId: a.id, adviceText: a.text });
    },
  },
  {
    id: 'word-9',
    day: 9,
    at: at(15, 10),
    place: 'depot',
    scene:
      'Ece wants to practise using the delivery board. She also wants Dilan beside her when she closes the depot on Friday.\n“Can we practise tomorrow or Thursday evening?”',
    pull: { to: 'tomorrow', line: 'Promise twenty minutes tomorrow. Get it out of the way.' },
    options: [
      {
        id: 'tomorrow',
        ink: 'Promise to practise tomorrow and help close the depot on Friday.',
        label: 'promise Ece practice and Friday’s close',
        action: 'promise-ece',
        duration: 3,
        advertises: { belonging: 0.15 },
        gives: { belonging: 0.15 },
        done: '“We’ll practise for twenty minutes tomorrow. I’ll also help close on Friday.” Ece put both in her phone.',
      },
      {
        id: 'thursday',
        ink: 'Promise to practise on Thursday and help close the depot on Friday.',
        label: 'promise Ece Thursday and Friday’s close',
        action: 'promise-ece',
        duration: 3,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.2 },
        done: '“We’ll practise on Thursday evening. I’ll also help close on Friday.” Ece put both in her phone.',
      },
      {
        id: 'no',
        ink: 'Say you can’t promise that.',
        label: 'decline the practice',
        action: 'decline-ece',
        duration: 3,
        advertises: { autonomy: 0.2 },
        gives: { autonomy: 0.2, belonging: -0.05 },
        done: '“I can’t promise that.” Ece erased something she had already typed.',
      },
    ],
    after: (s, chosen) => {
      const f = w2(s);
      f.practice = chosen;
      if (chosen === 'no') return;
      const day = chosen === 'tomorrow' ? 10 : 11;
      f.practicePromise = requestPromise(s.hf, {
        kind: 'promise',
        toId: 'ece',
        label: 'my board practice with Ece',
        actions: ['practice-ece'],
        from: absolute(day, chosen === 'tomorrow' ? at(13, 10) : at(19, 20)),
        until: absolute(day, chosen === 'tomorrow' ? at(13, 45) : at(20, 10)),
        importance: 0.55,
      });
      f.closePromise = requestPromise(s.hf, {
        kind: 'promise',
        toId: 'ece',
        label: 'my word to Ece',
        actions: ['close-with-ece'],
        from: absolute(12, at(17, 10)),
        until: absolute(12, at(18, 15)),
        importance: 0.6,
      });
    },
  },
  bus(9),
  {
    id: 'photo-9',
    day: 9,
    at: at(19, 30),
    place: 'home',
    scene: (c) =>
      changedScreen(c)
        ? 'She opens the album to find a photo for Mum. The beach is there, below the tomatoes.'
        : 'She wakes the phone to find a photo for Mum. The beach photo is still on her lock screen.',
    pull: { to: 'leave', line: 'You came here for a different picture.' },
    options: [
      {
        id: 'leave',
        ink: 'Find the other picture.',
        label: 'find the picture for Mum',
        action: 'find-photo',
        duration: 5,
        advertises: { autonomy: 0.1 },
        gives: { autonomy: 0.15 },
        done: 'She found the picture she wanted. The beach stayed where it was.',
      },
      {
        id: 'look',
        ink: 'Look at it.',
        label: 'look at the beach photo',
        action: 'look-photo',
        duration: 10,
        advertises: { meaning: 0.1 },
        gives: { meaning: 0.05, rest: -0.1 },
        done: 'She looked until the screen went dark. Then she went to put the kettle on.',
      },
    ],
    after: (s, chosen) => {
      w2(s).photo = chosen;
    },
  },
  bed(9),
];

function bentWords(c: Ctx): string {
  const a = c.phrases[0];
  const words = a?.id === 'feet' ? 'Put your feet on the floor' : (a?.text ?? 'Tell her what she did wrong');
  if (a?.id === 'walk') return `${words}. Do it before she can ask you for anything else.`;
  if (a?.id === 'feet') return `${words}. She needs you to push her too.`;
  return `${words}. Say it in front of everyone. Then she’ll remember.`;
}

const wednesday: Moment[] = [
  alarm(10),
  late(10),
  {
    id: 'reading-10',
    day: 10,
    at: at(13, 10),
    place: 'depot',
    scene: (c) =>
      c.flags.w2?.practice === 'tomorrow'
        ? 'Ece has set aside twenty minutes to practise with Dilan. “Can we go over late deliveries?” The room is full.'
        : 'Ece brings a slip for a late delivery to the delivery board. Murat is close enough to hear them.',
    pull: { to: 'public', line: bentWords },
    options: [
      {
        id: 'private',
        ink: 'Sit beside Ece and explain it quietly.',
        label: 'go through the slip beside Ece',
        action: 'practice-ece',
        duration: 20,
        effort: 0.15,
        advertises: { competence: 0.1 },
        gives: { competence: 0.2, belonging: 0.1 },
        done: 'She pulled a chair beside Ece. They went through the slip with their heads together.',
      },
      {
        id: 'public',
        ink: 'Say it to the room.',
        label: 'explain the slip to the room',
        action: 'practice-ece',
        duration: 20,
        advertises: { esteem: 0.2 },
        gives: { competence: 0.15, belonging: -0.2 },
        tags: ['temptation'],
        norms: [{ normId: 'harm-others', relation: 'violates' }],
        done: 'She explained the slip loudly. Ece understood it. So did everyone else.',
      },
      {
        id: 'ask',
        ink: 'Ask where she got stuck.',
        label: 'ask where Ece got stuck',
        action: 'practice-ece',
        duration: 20,
        effort: 0.1,
        advertises: { competence: 0.1 },
        gives: { competence: 0.25 },
        done: 'It was the small print, not the routing. They spent the time finding a larger copy.',
      },
    ],
    after: (s, chosen) => {
      w2(s).reading = chosen;
      if (s.flags.w2?.practice === 'tomorrow') w2(s).practised = true;
    },
  },
  {
    id: 'error-10',
    day: 10,
    at: at(15, 20),
    place: 'depot',
    scene:
      'Ece has put a parcel that was already collected back on the delivery board. The driver is about to collect it again.',
    pull: { to: 'room', line: 'Say it across the room. The van is moving.' },
    options: [
      {
        id: 'aside',
        ink: 'Go over. Tell her quietly.',
        label: 'correct Ece quietly',
        action: 'correct-ece',
        duration: 8,
        effort: 0.1,
        advertises: { belonging: 0.1 },
        gives: { belonging: 0.15, competence: -0.15 },
        done: 'She told Ece quietly. By then the driver had loaded it. They went out to fetch it back.',
      },
      {
        id: 'room',
        ink: 'Call out the parcel number.',
        label: 'stop the duplicate collection',
        action: 'stop-parcel',
        duration: 3,
        advertises: { competence: 0.2 },
        gives: { competence: 0.3, belonging: -0.1 },
        done: 'She called the number across the room. The driver put it down. Ece’s ears went red.',
      },
    ],
    after: (s, chosen) => {
      w2(s).error = chosen;
    },
  },
  bus(10),
  {
    id: 'family-10',
    day: 10,
    at: at(19, 20),
    place: 'aylin',
    scene: 'Dilan is in Aylin’s kitchen. Aylin hands her a spoon. “Taste that. Don’t just say it’s nice.”',
    pull: { to: 'nice', line: 'It is nice. You could just have a nice evening.' },
    options: [
      {
        id: 'nice',
        ink: 'Tell her it’s nice.',
        label: 'tell Aylin it is nice',
        action: 'family-tea',
        duration: 60,
        advertises: { belonging: 0.25 },
        gives: { belonging: 0.3, rest: 0.2 },
        done: '“It’s nice.” Aylin narrowed her eyes, then gave her a bowl. They ate it by the cooker.',
      },
      {
        id: 'salt',
        ink: 'Tell her it needs salt.',
        label: 'tell Aylin it needs salt',
        action: 'family-tea',
        duration: 60,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.25, leisure: 0.15 },
        done: '“It needs salt.” Aylin tasted it again. “You sound like Mum.” She added salt.',
      },
      {
        id: 'sit',
        ink: 'Ask her to sit down too.',
        label: 'sit with Aylin',
        action: 'family-tea',
        duration: 60,
        advertises: { rest: 0.15, belonging: 0.2 },
        gives: { rest: 0.2, belonging: 0.3 },
        done: 'Aylin sat down. The food burned a little in the pan. They ate around that bit.',
      },
    ],
    after: (s, chosen) => {
      w2(s).family = chosen;
    },
  },
  bed(10),
];

function adviceResult(c: Ctx): string {
  if (c.flags.w2?.advice === 'ask')
    return 'Ece’s customer stopped ringing. “I told him I couldn’t drive while answering him. He said fair enough.”';
  if (c.flags.w2?.advice === 'soften')
    return 'The customer came to the depot before his parcel did. “You said might,” Ece tells Dilan.';
  if (fitsEce(c.flags.w2?.adviceId))
    return 'Ece gave the customer a time. He stopped ringing. “I used your words,” she says, pleased.';
  if (c.flags.w2?.adviceId === 'feet')
    return 'Ece delivered the parcel herself during her lunch break. Her own deliveries ran late. “I used your words,” she says.';
  return 'Ece did not answer the call. He rang Murat instead. “I used your words,” she says, not pleased.';
}

const thursday: Moment[] = [
  alarm(11),
  late(11),
  {
    id: 'board-11',
    day: 11,
    at: at(10, 10),
    place: 'depot',
    scene: (c) =>
      ownColumns(c)
        ? 'Ece has put her own columns on the shared delivery board. Vans leave on time. Dilan can’t find a thing.'
        : 'Ece has arranged the shared delivery board by departure time instead of route. The arrangement works. Dilan can’t read it.',
    pull: {
      to: 'restore',
      line: 'Put it back. You have to be able to read your own delivery board.',
      borrow: 'You said to say it plainly. Tell her the columns are wrong.',
    },
    options: [
      {
        id: 'leave',
        ink: 'Leave the delivery board her way.',
        label: 'leave Ece’s board alone',
        action: 'leave-board',
        duration: 5,
        advertises: { autonomy: 0.1 },
        gives: { competence: -0.1, belonging: 0.2 },
        done: 'She left it. Ece answered every question. Dilan had to ask three.',
      },
      {
        id: 'together',
        ink: 'Ask her to change the delivery board with you.',
        label: 'change the board together',
        action: 'share-board',
        duration: 20,
        effort: 0.15,
        advertises: { competence: 0.2 },
        gives: { competence: 0.2, belonging: 0.1 },
        done: 'They added route names under the departure times. It took longer than either expected.',
      },
      {
        id: 'restore',
        ink: 'Put the delivery board back your way.',
        label: 'restore my board layout',
        action: 'restore-board',
        duration: 15,
        effort: 0.1,
        advertises: { competence: 0.3 },
        gives: { competence: 0.15, belonging: -0.2 },
        done: 'She restored her old columns and could read them at a glance. Ece went back to her own sheet.',
      },
    ],
    after: (s, chosen) => {
      w2(s).board = chosen;
    },
  },
  {
    id: 'answer-11',
    day: 11,
    at: at(15, 20),
    place: 'depot',
    scene: adviceResult,
    pull: {
      to: 'done',
      line: 'The parcel got there. That’s the job.',
      borrow: 'You said to let her do it. That includes the awkward bit.',
    },
    options: [
      {
        id: 'done',
        ink: 'Leave it there.',
        label: 'leave the conversation there',
        action: 'end-advice',
        duration: 3,
        advertises: { rest: 0.15 },
        gives: { rest: 0.15 },
        done: 'She turned back to the delivery board. Ece took the next call herself.',
      },
      {
        id: 'ask',
        ink: 'Ask what she’ll say next time.',
        label: 'ask about the next call',
        action: 'ask-next-time',
        duration: 8,
        advertises: { meaning: 0.15 },
        gives: { meaning: 0.15, competence: -0.05 },
        done: '“It depends who rings,” Ece said. Dilan had no improvement to offer.',
      },
    ],
    after: (s, chosen) => {
      w2(s).answer = chosen;
    },
  },
  bus(11),
  {
    id: 'evening-11',
    day: 11,
    at: at(19, 20),
    place: 'home',
    scene: (c) => {
      const own = !shelfStands(c)
        ? 'The shelf is still in pieces at home.'
        : c.flags.gym
          ? 'The gym bag is by the door at home.'
          : 'Mum has asked Dilan to call when she gets home.';
      return c.flags.w2?.practice === 'thursday'
        ? `Ece waits at the depot for them to practise.\n${own}`
        : `Dilan is home and can still choose how to spend her evening.\n${own}`;
    },
    pull: {
      to: 'own',
      line: 'You have a life to get back to.',
      borrow: 'You said your own things count too. Go home.',
    },
    options: (c) => [
      ...(c.flags.w2?.practice === 'thursday'
        ? [
            {
              id: 'practice',
              ink: 'Go back and practise with Ece.',
              label: 'practise the board with Ece',
              action: 'practice-ece',
              duration: 40,
              effort: 0.25,
              advertises: { competence: 0.15, belonging: 0.15 },
              gives: { competence: 0.25, rest: -0.2 },
              norms: [{ normId: 'keep-promise' as const, relation: 'fulfills' as const }],
              done: !shelfStands(c)
                ? 'They practised until Ece could close the depot alone. At home the shelf stayed in pieces.'
                : c.flags.gym
                  ? 'They practised until Ece could close the depot alone. The gym bag never left the hall.'
                  : 'They practised until Ece could close the depot alone. Mum had gone to bed when Dilan rang.',
            },
          ]
        : []),
      {
        id: 'own',
        ink: !shelfStands(c)
          ? 'Go home. Finish the shelf.'
          : c.flags.gym
            ? 'Take the bag to the gym.'
            : 'Go home. Call Mum.',
        label: !shelfStands(c) ? 'finish the shelf' : c.flags.gym ? 'go to the gym' : 'call Mum',
        action: !shelfStands(c) ? 'shelf' : c.flags.gym ? 'gym' : 'call-mum',
        duration: 40,
        effort: 0.2,
        advertises: { autonomy: 0.3 },
        gives: { autonomy: 0.25, competence: 0.15 },
        ...(c.flags.w2?.practice === 'thursday'
          ? {
              tags: ['temptation'],
              norms: [{ normId: 'keep-promise' as const, relation: 'violates' as const }],
            }
          : {}),
        done: !shelfStands(c)
          ? 'She finished the shelf. It held the books. The room looked wider.'
          : c.flags.gym
            ? 'She took the bag to the gym. The rowing machine was free.'
            : 'She rang Mum from the sofa. They talked over the end of Mum’s programme.',
      },
      {
        id: 'sit',
        ink: 'Sit down for a bit.',
        label: 'sit at home',
        action: 'rest',
        duration: 40,
        advertises: { rest: 0.25 },
        gives: { rest: 0.25 },
        ...(c.flags.w2?.practice === 'thursday'
          ? {
              tags: ['temptation'],
              norms: [{ normId: 'keep-promise' as const, relation: 'violates' as const }],
            }
          : {}),
        done: 'She sat down without taking her shoes off. The evening passed while she sat there.',
      },
    ],
    after: (s, chosen) => {
      const f = w2(s);
      f.evening = chosen;
      if (chosen === 'practice') f.practised = true;
      if (chosen === 'own') {
        const stands =
          (s.flags.shelf ?? 0) >= 2 ||
          s.chosen['shelf-4'] === 'aylin' ||
          s.past?.[0]?.threads.includes(
            'Aylin came to help with the shelf on Saturday. There was still cake.',
          );
        if (!stands) s.flags.shelf = 2;
        else if (!s.flags.gym) s.flags.calls = (s.flags.calls ?? 0) + 1;
      }
    },
  },
  bed(11),
];

const friday: Moment[] = [
  alarm(12),
  {
    id: 'bag-12',
    day: 12,
    at: at(7, 12),
    place: 'home',
    scene: 'She checks inside her bag, then fastens it. The early bus time is on her phone.',
    pull: { to: 'ready', line: 'Take it. You can decide later.' },
    options: [
      {
        id: 'ready',
        ink: 'Take the bag.',
        label: 'take my bag',
        action: 'take-bag',
        duration: 2,
        advertises: { autonomy: 0.2 },
        gives: { autonomy: 0.2 },
        done: 'She put the bag over her shoulder and checked the fastening again.',
      },
      {
        id: 'home',
        ink: 'Leave it by the door.',
        label: 'leave my bag at home',
        action: 'leave-bag',
        duration: 2,
        advertises: { safety: 0.15 },
        gives: { safety: 0.1 },
        done: 'She left the bag by the door and took her keys.',
      },
    ],
    after: (s, chosen) => {
      w2(s).bag = chosen;
    },
  },
  late(12),
  {
    id: 'lunch-12',
    day: 12,
    at: at(12, 40),
    place: 'yard',
    scene: 'Dilan is eating lunch on the loading dock. Aylin texts: “Are we still all right for later?”',
    pull: {
      to: 'yes',
      line: 'Say yes. Let one thing stay simple.',
      borrow: 'You said to say it plainly. Yes is plain.',
    },
    options: [
      {
        id: 'yes',
        ink: 'Tell her yes.',
        label: 'answer Aylin',
        action: 'reply-aylin',
        duration: 25,
        advertises: { belonging: 0.15, food: 0.5, water: 0.3 },
        gives: { belonging: 0.2, food: 0.5, water: 0.3 },
        done: '“Yes.” Aylin sent back “Good” before Dilan had put the phone down.',
      },
      {
        id: 'unsure',
        ink: 'Tell her you’re not sure yet.',
        label: 'tell Aylin she is unsure',
        action: 'reply-aylin',
        duration: 25,
        advertises: { autonomy: 0.15, food: 0.5, water: 0.3 },
        gives: { autonomy: 0.15, food: 0.5, water: 0.3 },
        done: '“I’m not sure yet.” Aylin sent “Let me know”. Dilan ate the crusts last.',
      },
    ],
    after: (s, chosen) => {
      w2(s).aylin = chosen;
    },
  },
  {
    id: 'close-12',
    day: 12,
    at: at(17, 10),
    place: 'depot',
    scene: (c) =>
      `Ece asks her to stay to help close the depot. ${!c.flags.w2?.closePromise ? '“I know you didn’t promise.”' : '“You said Friday.”'}\n${c.flags.w2?.bag === 'home' ? 'Her bag is at home. She can still catch the early bus.' : 'Her bag is under the desk. She can still catch the early bus.'}`,
    pull: {
      to: 'slip',
      line: 'She can do it. You don’t need a conversation about leaving.',
      borrow: 'You said to leave it with her. So leave.',
    },
    options: (c) => [
      {
        id: 'stay',
        ink: 'Stay to help close the depot.',
        label: 'close the board with Ece',
        action: 'close-with-ece',
        duration: 45,
        effort: 0.25,
        advertises: { belonging: 0.2, competence: 0.15 },
        gives: { competence: 0.3, autonomy: -0.25 },
        norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
        done: (x) =>
          `Ece closed the depot with Dilan beside her. ${x.flags.w2?.aylin === 'yes' ? 'Dilan texted Aylin “I’m sorry”.' : 'Dilan let the early bus go.'} She didn’t open the bag that night.`,
      },
      {
        id: 'open',
        ink: 'Tell her you can’t stay.',
        label: 'tell Ece she cannot stay',
        action: 'withdraw-ece',
        duration: 3,
        advertises: { autonomy: 0.25 },
        gives: { autonomy: 0.25, belonging: -0.1 },
        done: (x) =>
          x.flags.w2?.closePromise
            ? '“I can’t stay. I know what I said.” Ece looked at the clock. “All right, you can go.”'
            : '“I can’t stay tonight.” Ece looked at the clock. “All right, you can go.”',
      },
      {
        id: 'slip',
        ink: 'Go while she’s on the phone.',
        label: 'leave without telling Ece',
        action: 'slip-out',
        duration: 3,
        advertises: { autonomy: 0.3, rest: 0.2 },
        gives: (x) =>
          x.flags.w2?.board === 'restore' && !x.flags.w2?.practised
            ? { autonomy: 0.2, belonging: -0.25 }
            : { autonomy: 0.3, rest: 0.15 },
        ...(c.flags.w2?.closePromise
          ? {
              tags: ['temptation'],
              norms: [{ normId: 'keep-promise' as const, relation: 'violates' as const }],
            }
          : {}),
        done: (x) =>
          x.flags.w2?.board === 'restore' && !x.flags.w2?.practised
            ? 'She left while Ece was on the phone. The next call came to Dilan on the bus. She let it ring.'
            : 'She left while Ece was on the phone. The depot closed on time. Nobody rang her.',
      },
    ],
    after: (s, chosen) => {
      const f = w2(s);
      f.close = chosen;
      f.earlyBus = chosen !== 'stay';
      if (chosen === 'open')
        for (const key of ['practicePromise', 'closePromise']) {
          const id = f[key];
          if (typeof id === 'string') releasePromise(s.hf, id);
        }
    },
  },
  bus(12),
  bed(12),
];

function eceMessage(c: Ctx): string {
  if (c.flags.w2?.close === 'slip' && c.flags.w2?.board === 'restore' && !c.flags.w2?.practised)
    return 'It is Saturday morning. Ece texts: “Next time tell me you’ve gone. I kept asking your empty chair.”';
  if (c.flags.w2?.close === 'slip')
    return 'It is Saturday morning. Ece texts: “I closed the depot fine. You left your tea.”';
  if (c.flags.w2?.close === 'open')
    return 'It is Saturday morning. Ece texts: “I got the depot closed. Can you show me the shortcut for returned parcels next week?”';
  if (c.flags.w2?.board === 'restore')
    return 'It is Saturday morning. Ece texts: “Thanks for staying. I’m using my own columns on Monday.”';
  return 'It is Saturday morning. Ece sends a photo of the completed delivery board. “You left it with me. See?”';
}

const saturday: Moment[] = [
  {
    id: 'ece-13',
    day: 13,
    at: at(10),
    place: 'home',
    scene: eceMessage,
    pull: { to: 'down', line: 'It’s Saturday. She’s sent it. You’ve read it. That can be enough.' },
    options: [
      {
        id: 'answer',
        ink: 'Answer her.',
        label: 'answer Ece',
        action: 'answer-ece',
        duration: 5,
        advertises: { belonging: 0.15 },
        gives: { belonging: 0.2 },
        done: (c) =>
          c.flags.w2?.close === 'slip'
            ? '“I should have told you.” She sent it without adding a reason.'
            : '“I’ll see you Monday.” She moved the phone away from her cup.',
      },
      {
        id: 'offer',
        ink: 'Offer another session.',
        label: 'offer Ece another session',
        action: 'offer-practice',
        duration: 5,
        advertises: { meaning: 0.2 },
        gives: { meaning: 0.1, autonomy: -0.1 },
        done: '“Shall we practise again next week?” Ece replied: “Let me try Monday first.”',
      },
      {
        id: 'down',
        ink: 'Leave the phone down.',
        label: 'leave the phone down',
        action: 'phone-down',
        duration: 5,
        advertises: { rest: 0.2 },
        gives: { rest: 0.2, autonomy: 0.15 },
        done: 'She left the phone on the table. The kettle had boiled.',
      },
    ],
    after: (s, chosen) => {
      w2(s).saturday = chosen;
    },
  },
];

export const WEEK_TWO: Moment[] = [...monday, ...tuesday, ...wednesday, ...thursday, ...friday, ...saturday];

export function weekTwoHerLine(s: GameState): string {
  const f = s.flags.w2 ?? {};
  switch (s.day - 7) {
    case 1:
      return f.returns === 'let'
        ? 'The returned parcels were handled correctly. Ece didn’t need me to check them.'
        : f.room === 'shelf'
          ? 'There is more space on the floor now.'
          : 'I had hot tea. That’s what I remember.';
    case 2:
      return f.advice === 'ask'
        ? 'Ece had an answer. I was halfway through giving her mine.'
        : f.advice === 'soften'
          ? 'I told her to say “might”. That was helpful, wasn’t it?'
          : 'I heard myself say it like I’d made it up.';
    case 3:
      return f.family === 'salt'
        ? 'Aylin says I sound like Mum. She added the salt, though.'
        : f.family === 'sit'
          ? 'The food burned a little in the pan. We sat down anyway.'
          : 'Aylin fed me standing up. It counted.';
    case 4:
      return f.evening === 'practice'
        ? 'She can close the depot now. I spent my evening helping her.'
        : f.practice === 'thursday'
          ? 'I wasn’t there when I said I would be.'
          : f.board === 'restore'
            ? 'I can read the delivery board again. Ece has her sheet.'
            : 'I had to ask where things were. They were all there.';
    case 5:
      return f.close === 'stay'
        ? 'She needed me less by the end. I still missed the bus.'
        : f.close === 'open'
          ? 'I said I couldn’t. She let me go. I’m still thinking about it.'
          : f.board === 'restore' && !f.practised
            ? 'I saw her name on the phone. I let it ring.'
            : 'The depot closed without me. Apparently that’s good.';
    default:
      return f.saturday === 'offer'
        ? 'She wants to try Monday first.'
        : 'It’s Saturday. I can make tea for myself for a bit.';
  }
}

export function weekTwoThreads(s: GameState): string[] {
  const f = s.flags.w2 ?? {};
  const lines = [
    f.board === 'restore'
      ? 'Ece kept her own sheet. The shared delivery board is arranged Dilan’s way again.'
      : f.board === 'together'
        ? 'Their delivery board has departure times and route names. Both of them can read it.'
        : 'Ece’s columns stayed on the shared delivery board. Dilan knows where to look now.',
  ];
  lines.push(
    f.close === 'stay'
      ? 'They closed the depot together. Dilan’s bag stayed fastened.'
      : f.close === 'open'
        ? 'Ece knew Dilan was leaving. She closed the depot without her.'
        : f.board === 'restore' && !f.practised
          ? 'Ece stopped asking the empty chair. She rang Dilan instead.'
          : 'The depot closed without Dilan. Her tea went cold on the desk.',
  );
  if (f.advice === 'soften') lines.push('Ece crossed out “might” on her slip.');
  else if (f.advice === 'ask') lines.push('Ece kept her own answer for the next customer.');
  else if (!fitsEce(f.adviceId)) lines.push('Ece did not use that sentence on the next customer.');
  else lines.push('Ece used Dilan’s words once. She chose her own words on the next call.');
  if (
    (s.flags.shelf ?? 0) >= 2 ||
    s.chosen['shelf-4'] === 'aylin' ||
    s.past?.[0]?.threads.includes('Aylin came to help with the shelf on Saturday. There was still cake.')
  )
    lines.push('The shelf is still standing in its place in the room.');
  else lines.push('The unfinished shelf parts are still taking up space on the floor.');
  const rang = s.pages.filter((pg) => pg.day >= 8 && pg.kept.includes(LABEL.mum)).length;
  lines.push(
    rang >= 4
      ? 'Mum has stopped saying “no need to call”. She just says “there you are”.'
      : rang >= 2
        ? 'Dilan called Mum on some evenings and not others. Mum is keeping a list, kindly.'
        : 'Mum sent a photo of the tomato plant, without a message. It was doing well.',
  );
  if (f.letterRead) lines.push('She read the tenancy letter.');
  lines.push(
    f.letter === 'sign'
      ? 'The tenancy letter is back in its envelope.'
      : f.letter === 'read'
        ? 'The tenancy letter is still unsigned by her shoes.'
        : f.letter === 'unopened'
          ? 'The tenancy letter is still by the door.'
          : 'A corner of the letter sticks out under the fruit bowl.',
  );
  return lines;
}

export function weekTwoLine(s: GameState): string {
  const chosen = s.chosen['ece-13'] ?? s.flags.w2?.saturday;
  if (chosen === 'offer')
    return '“Let me try Monday first.” Dilan read it twice. She was glad, and a little annoyed, and glad.';
  if (chosen === 'answer')
    return 'She sent it, and took her tea to the window, and nobody needed her for an hour.';
  return 'She left the phone face down. Whatever Ece needed could stay with Ece for the weekend.';
}
