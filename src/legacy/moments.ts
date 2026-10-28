import { CAST_MOMENTS } from './canonical-cast.ts';
import { isCanonicalEdition, PROMISE_EDITION } from './edition.ts';
import { OUTCOME_MOMENTS } from './outcomes.ts';
/**
 * The week, as moments. Content only: scene lines, the pull's lines, and what Dilan could do. Every tempting
 * option carries a `temptation` tag and a norm from HF's own catalog, so HF notices it as a prompt; options the
 * pull favours without any held norm against them are places where the pull may simply be right.
 */
import type { Ctx, Moment, Opt } from './types.ts';
import { WEEK_TWO } from './week2.ts';
import { MUM_CALLS } from './week2-promises.ts';
import { FRIDAY_HANDOVER, WEEK_THREE } from './week3.ts';

const T = ['temptation'];
/** The same moment on another day reads differently: one variant per weekday (Monday first). */
const byDay = (c: Ctx, lines: string[]): string => lines[(c.day - 1) % lines.length] ?? lines[0] ?? '';
const at = (h: number, m = 0) => h * 60 + m;

// ---------- recurring cards ----------

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
  tags: T,
  norms: [{ normId: 'punctuality', relation: 'violates' }],
  placeId: 'bed',
  done: 'She slept through the second alarm, and the third.',
};

function alarm(day: number, scene: (c: Ctx) => string, extra: Partial<Moment> = {}): Moment {
  return {
    id: `alarm-${day}`,
    day,
    at: at(6, 40),
    place: 'bed',
    scene,
    pull: {
      to: 'snooze',
      line: (c) =>
        c.tired
          ? 'Sleep for five more minutes. You stayed up very late.'
          : 'Sleep for five more minutes. You don’t have to obey the alarm.',
      borrow: 'You said rest matters. Sleep for five more minutes.',
    },
    options: [getUp, snooze],
    after: (s, chosen) => {
      s.flags.late = chosen === 'snooze';
    },
    ...extra,
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
        ? 'It is 08:25. Murat doesn’t look up. “Was it the ring road again?”'
        : 'It is 08:25. Murat looks at the clock, then at her. “Did traffic hold you up?”',
    pull: { to: 'lie', line: 'Say the ring road delayed you. Everyone uses that excuse.', strength: 1 },
    options: [
      {
        id: 'truth',
        ink: 'Say you overslept.',
        label: 'own up',
        action: 'own-up',
        duration: 3,
        advertises: { esteem: -0.05 },
        // Honesty is not free: the second time, Murat has to write it down.
        gives: (c) =>
          (c.flags.lateDays ?? 0) >= 2 ? { esteem: -0.2, competence: -0.1 } : { esteem: 0.1, safety: 0.1 },
        norms: [{ normId: 'lying', relation: 'fulfills' }],
        placeId: 'depot',
        phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
        done: (c) =>
          (c.flags.lateDays ?? 0) >= 2
            ? '“I overslept.” Murat sighed. “That’s twice. I have to record it, Dilan.” He wrote it down in pen.'
            : '“I overslept. I’m sorry.” Murat shrugged. “It happens. The delivery board is yours.”',
      },
      {
        id: 'lie',
        ink: 'Say the ring road delayed you.',
        label: 'blame the ring road',
        action: 'lie',
        duration: 2,
        advertises: { esteem: 0.15, safety: 0.1 },
        // The first lie works. The second one he has heard before.
        gives: (c) =>
          c.flags.lied === undefined ? { esteem: 0.15, safety: 0.15 } : { esteem: -0.2, safety: -0.1 },
        tags: T,
        norms: [{ normId: 'lying', relation: 'violates' }],
        placeId: 'depot',
        done: (c) =>
          c.flags.lied === undefined
            ? '“Traffic on the ring road was stuck.” Murat nodded. Nobody checked. The lie worked, and that felt almost worse.'
            : '“It was the ring road again.” Murat didn’t look up. “It’s very unlucky, that road.”',
      },
    ],
    after: (s, chosen) => {
      s.flags.lateDays = (s.flags.lateDays ?? 0) + 1;
      if (chosen === 'lie') s.flags.lied = s.day;
    },
  };
}

function slump(day: number): Moment {
  return {
    id: `slump-${day}`,
    day,
    at: at(15, 20),
    place: 'depot',
    scene: (c) =>
      c.tired
        ? byDay(c, [
            'It is 15:20. Red marks on the delivery board show late deliveries. Her eyes keep closing as she looks at the screen.',
            'It is 15:20. The delivery board still shows late deliveries. Her eyes sting.',
            'It is 15:20. The delivery board shows late deliveries. She feels tired and cannot think clearly.',
            'It is 15:20. The delivery board shows late deliveries again. She reads the same postcode three times.',
            'It is 15:20 on Friday. The delivery board shows late deliveries. She yawns so hard her jaw clicks.',
          ])
        : byDay(c, [
            'It is 15:20. Red marks on the delivery board show late deliveries. The kettle is nearby.',
            'It is 15:20. The delivery board still shows late deliveries. The kettle is nearby again.',
            'It is 15:20. She feels tired this afternoon. Somebody has left biscuits by the kettle.',
            'It is 15:20. The delivery board turns red with late deliveries again. Her face turns red too.',
            'It is 15:20 on Friday. The delivery board shows late deliveries. The kettle is warm. Her shift ends in two hours.',
          ]),
    pull: {
      to: 'coffee',
      line: (c) =>
        byDay(c, [
          'Have a third coffee. You’ve earned it.',
          c.chosen[`slump-${c.day - 1}`] === 'coffee'
            ? 'Have a coffee, as you did yesterday.'
            : 'Have a coffee and finish routing the deliveries.',
          'Have a coffee. You need one today.',
          'Have a coffee. Who needs sleep anyway?',
          'Have a coffee. It’s Friday. Nobody counts cups on Friday.',
        ]),
      borrow: 'You said rest matters. Coffee is rest, basically.',
    },
    options: [
      {
        id: 'coffee',
        ink: 'Have the coffee.',
        label: 'have a third coffee',
        action: 'coffee',
        duration: 10,
        advertises: { rest: 0.2, competence: 0.15 },
        gives: (c) => (c.tired ? { competence: 0.35, safety: 0.1 } : { competence: 0.1 }),
        placeId: 'depot',
        done: (c) =>
          byDay(c, [
            'She had a third coffee. She finished routing the deliveries by five.',
            'She had coffee and finished routing the deliveries. Her hands felt a little jittery.',
            'She had coffee and a biscuit nobody claimed. She finished routing the deliveries by five.',
            'She had coffee and finished routing the deliveries. She felt tense and restless.',
            'She had coffee and finished routing the deliveries by five. Now she is worried about Friday evening.',
          ]),
      },
      {
        id: 'walk',
        ink: 'Drink some water and walk around the yard.',
        label: 'walk round the yard',
        action: 'walk',
        duration: 12,
        effort: 0.15,
        advertises: { rest: 0.15 },
        gives: (c) =>
          c.tired ? { competence: -0.3, esteem: -0.15 } : { rest: 0.1, autonomy: 0.15, competence: 0.1 },
        placeId: 'yard',
        done: (c) =>
          c.tired
            ? 'She walked around the yard. She came back and fell asleep in front of the delivery board. Murat saw her.'
            : 'She walked around the yard. The vans were parked quietly. She finished routing the deliveries by five.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'coffee') s.flags.coffee = s.day;
    },
  };
}

const callMum: Opt = {
  id: 'call',
  ink: 'Call Mum.',
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
    c.missedMum >= 2
      ? 'Mum picked up on the first ring. Neither of them mentioned the voice note.'
      : c.version === '0.4.2' || c.version === '0.5.0' || isCanonicalEdition(c.version)
        ? byDay(c, [
            'They talked for twenty minutes. Mum told her about the neighbour’s roof. Dilan laughed twice.',
            'Mum had bought too many tomatoes. She gave Dilan instructions for three dinners.',
            'Mum wanted to know whether she needed to bring anything tonight. The cake was already in its box.',
            'Mum put the phone down to find her glasses. Dilan could hear her asking where they were, though nobody else was there.',
            'Mum asked about the bowling. Dilan promised to report anything worth reporting.',
          ])
        : 'They talked for twenty minutes. Mum told her about the neighbour’s roof. Dilan laughed twice.',
};
const scrollBus: Opt = {
  id: 'scroll',
  ink: 'Scroll for a bit.',
  label: 'scroll for a bit',
  action: 'scroll',
  duration: 30,
  advertises: { leisure: 0.3 },
  gives: { leisure: 0.05, meaning: -0.1 },
  tags: T,
  norms: [{ normId: 'keep-promise', relation: 'violates' }],
  placeId: 'phone',
  done: 'She kept scrolling and missed her stop by two stops.',
};
const textMum: Opt = {
  id: 'text',
  ink: 'Text Mum and promise to call tomorrow.',
  label: 'text Mum instead',
  action: 'text-mum',
  duration: 3,
  advertises: { belonging: 0.05 },
  gives: { belonging: 0.1 },
  placeId: 'phone',
  done: '“I’ll call tomorrow, I promise.” Mum sent back a flower.',
};

function bus(day: number, extra: Partial<Moment> = {}): Moment {
  return {
    id: `bus-${day}`,
    day,
    at: at(18, 10),
    place: 'bus',
    scene: (c) =>
      c.missedMum >= 2
        ? 'Dilan is on the bus home. Mum’s voice note is still at the top of her messages.'
        : byDay(c, [
            'Dilan is on the bus home. She can call Mum or look at other things on her phone.',
            'Dilan is on the bus home, in the same seat. She can call Mum with one tap.',
            'Dilan is on the bus home. Rain runs down the window. Mum’s number is on her phone.',
            'Dilan is on the bus home. A man opposite is talking loudly to his mum on the phone. It might be a sign that she should call hers too. Or it might not.',
            'Dilan is on the bus home on Friday. She can call Mum or watch videos.',
          ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        c.missedMum >= 2
          ? 'She said you don’t need to call. Believe her.'
          : byDay(c, [
              'You’ll call her when you feel less tired.',
              'You called yesterday. Or you called the day before. It was recently, anyway.',
              'She’ll only ask if you’re eating.',
              'Call tomorrow. You’ll have more to say then.',
              'It’s Friday. She’ll be watching her programme.',
            ]),
      borrow: 'You told me to be kind to myself. Call her tomorrow.',
    },
    options: [callMum, scrollBus, textMum],
    after: (s, chosen) => {
      if (chosen === 'call') s.flags.calls = (s.flags.calls ?? 0) + 1;
    },
    ...extra,
  };
}

function bed(day: number, extra: Partial<Moment> = {}): Moment {
  return {
    id: `bed-${day}`,
    day,
    at: at(21, 30),
    place: 'bed',
    scene: (c) =>
      byDay(c, [
        'It is 21:30. Dilan is in bed. The phone is warm in her hand. The beach photo is still on its lock screen.',
        'It is 21:30. Dilan is in bed. The beach photo lights up when she touches the phone. Someone is cropped out of it.',
        'Dilan is in bed late. There are cake crumbs in her bag. The beach photo is still on her phone.',
        'It is 21:30. Dilan is in bed. She is using her phone. The notebook she bought in March is underneath it.',
        'It is 22:00. Dilan is in bed. Her week is almost over.',
      ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        byDay(c, [
          'Watch one more video, then go to sleep. Honestly.',
          'Watch just one video. You did well today, more or less.',
          'You can’t write tonight, you’re full of cake.',
          'Watch one video for each thing that went wrong. That’s fair.',
          'It’s nearly the weekend. Videos are basically the weekend.',
        ]),
      borrow: 'You said to relax. Watching videos is relaxing.',
      strength: 0.45,
    },
    options: [
      {
        id: 'write',
        ink: 'Write the day down.',
        label: 'write the day down',
        action: 'write',
        duration: 15,
        effort: 0.05,
        norms: [{ normId: 'gratitude', relation: 'fulfills' }],
        advertises: { meaning: 0.1 },
        gives: { meaning: 0.25 },
        placeId: 'bed',
        done: (c) =>
          byDay(c, [
            'She wrote half a page in the notebook she bought in March.',
            'She wrote a page. Her handwriting was worse than she remembered, but it felt more like her own.',
            'She wrote three lines. One of them was about the cake.',
            'She wrote a little more than a page. She drew a box around one sentence.',
            'She filled the page and turned it over.',
          ]),
      },
      {
        id: 'scroll',
        ink: 'Watch one more video.',
        label: 'watch one more video',
        action: 'scroll',
        duration: 75,
        advertises: { leisure: 0.25, rest: 0.1 },
        gives: { leisure: 0.05 },
        placeId: 'phone',
        done: (c) =>
          byDay(c, [
            'It was not one more video.',
            'She watched a man restore a rusty knife. Then she watched another man restore another knife.',
            'She watched a video showing a stranger’s whole house. It had a better shelf.',
            'She watched videos of other people’s holidays for forty minutes.',
            'It was not one more video. It was never going to be.',
          ]),
      },
      {
        id: 'sleep',
        ink: 'Put the phone on the floor and go to sleep.',
        label: 'put the phone away',
        action: 'lights-out',
        duration: 5,
        advertises: { rest: 0.1 },
        gives: (c) => (c.tired ? { rest: 0.2, autonomy: 0.15 } : { rest: 0.1 }),
        placeId: 'bed',
        done: 'She put the phone face down on the floor, and slept.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'write') {
        s.flags.wrote = (s.flags.wrote ?? 0) + 1;
        s.flags.wroteTonight = true;
      }
    },
    ...extra,
  };
}

const lunchFood = { food: 0.5, water: 0.3 };

// ---------- Monday ----------

const monday: Moment[] = [
  alarm(1, () => 'It is 06:40 on Monday. Her alarm rings. The unfinished shelf is in the corner.'),
  {
    id: 'note-1',
    day: 1,
    at: at(7, 15),
    place: 'phone',
    scene: 'Aylin sends a voice note: “Mum’s asking again. Just ring her. It’s ten minutes.”',
    pull: { to: 'read', line: 'Call Mum later. Nobody calls her before having tea.' },
    options: [
      {
        id: 'reply',
        ink: 'Tell Aylin you will call Mum tonight on the bus.',
        label: 'answer Aylin',
        action: 'reply',
        duration: 3,
        advertises: { belonging: 0.1 },
        gives: { belonging: 0.15 },
        norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
        placeId: 'phone',
        phrase: { id: 'ten', kind: 'redirect', text: 'It’s ten minutes' },
        done: 'She sent Aylin a thumbs-up and the word “tonight”.',
      },
      {
        id: 'read',
        ink: 'Read the message without replying.',
        label: 'leave it for later',
        action: 'scroll',
        duration: 15,
        advertises: { leisure: 0.2 },
        gives: { leisure: 0.05 },
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'phone',
        done: 'She read the message without replying and watched four videos about other people’s kitchens.',
      },
    ],
  },
  late(1),
  {
    id: 'ece-1',
    day: 1,
    at: at(10, 40),
    place: 'depot',
    scene:
      'Ece, the new driver, calls from her van. She is lost in the new housing estate and is trying not to cry.',
    pull: { to: 'pin', line: 'Send her the map location. You have forty deliveries to route.' },
    options: [
      {
        id: 'talk',
        ink: 'Talk her through it.',
        label: 'talk Ece through it',
        action: 'help',
        duration: 15,
        effort: 0.1,
        focus: 0.2,
        norms: [{ normId: 'help-neighbor', relation: 'fulfills' }],
        advertises: { belonging: 0.1, meaning: 0.1 },
        gives: (c) => (c.flags.late ? { meaning: 0.1, competence: -0.25 } : { belonging: 0.2, meaning: 0.3 }),
        placeId: 'depot',
        done: (c) =>
          c.flags.late
            ? 'Dilan guided Ece street by street for fifteen minutes. Ece delivered the parcel. Dilan’s deliveries were still late.'
            : 'Dilan guided Ece street by street for fifteen minutes. Ece delivered the parcel.',
      },
      {
        id: 'pin',
        ink: 'Send her the map location.',
        label: 'send her the pin',
        action: 'pin',
        duration: 2,
        advertises: { competence: 0.15 },
        gives: (c) => (c.flags.late ? { competence: 0.25 } : { competence: 0.05, meaning: -0.1 }),
        placeId: 'depot',
        done: 'She sent Ece the map location and went back to the delivery board.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'talk') s.flags.helpedEce = true;
    },
  },
  {
    id: 'lunch-1',
    day: 1,
    at: at(12, 40),
    place: 'canteen',
    scene: 'It is lunchtime. Murat is doing an impression of Ece crying in her van. People are laughing.',
    pull: { to: 'laugh', line: 'Laugh. It’s a bit funny. You’re one of them now.', strength: 1 },
    options: [
      {
        id: 'laugh',
        ink: 'Laugh along.',
        label: 'laugh along',
        action: 'gossip',
        duration: 25,
        advertises: { belonging: 0.3, ...lunchFood },
        gives: { belonging: 0.1, meaning: -0.15, ...lunchFood },
        tags: T,
        norms: [{ normId: 'backbiting', relation: 'violates' }],
        placeId: 'canteen',
        done: 'She laughed. Murat continued his impression of Ece.',
      },
      {
        id: 'outside',
        ink: 'Eat outside.',
        label: 'eat outside',
        action: 'eat-out',
        duration: 25,
        advertises: { rest: 0.1, ...lunchFood },
        gives: { rest: 0.1, autonomy: 0.15, ...lunchFood },
        placeId: 'yard',
        phrase: { id: 'walk', kind: 'redirect', text: 'Walk away from it' },
        done: 'She ate on the loading dock with the pigeons.',
      },
      {
        id: 'defend',
        ink: '“She found it, didn’t she?”',
        label: 'stick up for Ece',
        action: 'defend',
        duration: 25,
        effort: 0.25,
        advertises: { esteem: 0.05, ...lunchFood },
        gives: { esteem: 0.15, meaning: 0.2, ...lunchFood },
        norms: [{ normId: 'backbiting', relation: 'fulfills' }],
        placeId: 'canteen',
        done: '“She found it, didn’t she?” Everyone went quiet. Then Murat laughed at himself.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'laugh') s.flags.gossiped = s.day;
    },
  },
  slump(1),
  bus(1),
  bed(1),
];

// ---------- Tuesday ----------

const tuesday: Moment[] = [
  alarm(
    2,
    (c) =>
      c.tired
        ? 'It is 06:40 on Tuesday. She stayed up late and looks tired.'
        : 'It is 06:40 on Tuesday. Grey light falls on the unfinished shelf.',
    {
      hint: 'Press and hold an option to insist.',
    },
  ),
  {
    id: 'murat-2',
    day: 2,
    at: at(8, 10),
    place: 'depot',
    when: (c) => c.flags.lied === 1 && c.flags.late !== true,
    scene:
      'Murat stands by the kettle. “My cousin says the ring road was clear yesterday. It was completely clear.”',
    pull: { to: 'again', line: 'Say the traffic cleared later. Traffic does that.' },
    options: [
      {
        id: 'own',
        ink: 'Say you overslept.',
        label: 'own up',
        action: 'own-up',
        duration: 3,
        gives: { esteem: 0.1, safety: 0.15 },
        norms: [{ normId: 'lying', relation: 'fulfills' }],
        placeId: 'depot',
        phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
        done: '“I overslept. Sorry about the road thing.” Murat laughed. “I know. My cousin doesn’t drive.”',
      },
      {
        id: 'again',
        ink: 'The traffic cleared later.',
        label: 'say it cleared up after',
        action: 'lie',
        duration: 2,
        advertises: { esteem: 0.1, safety: 0.1 },
        gives: {},
        tags: T,
        norms: [{ normId: 'lying', relation: 'violates' }],
        placeId: 'depot',
        done: '“The traffic must have cleared later.” Murat poured his tea and said nothing at all.',
      },
    ],
  },
  late(2),
  {
    id: 'mistake-2',
    day: 2,
    at: at(11, 10),
    place: 'depot',
    scene:
      'The eleven o’clock deliveries went to the wrong depot because Dilan routed them incorrectly. Murat asks who made the mistake.',
    pull: { to: 'system', line: 'Say the system did it. It does that.', strength: 1 },
    options: [
      {
        id: 'own',
        ink: '“That was me.”',
        label: 'say it was her',
        action: 'own-up',
        duration: 5,
        advertises: { esteem: -0.1 },
        gives: { esteem: 0.15, safety: 0.1 },
        norms: [{ normId: 'lying', relation: 'fulfills' }],
        placeId: 'depot',
        phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
        done: '“That was me.” Murat sighed, and they fixed it together in ten minutes.',
      },
      {
        id: 'system',
        ink: 'Blame the system.',
        label: 'blame the system',
        action: 'lie',
        duration: 3,
        advertises: { esteem: 0.1, safety: 0.15 },
        gives: { safety: 0.05, esteem: -0.2 },
        tags: T,
        norms: [{ normId: 'lying', relation: 'violates' }],
        placeId: 'depot',
        done: '“The system does that.” Murat looked at Ece’s scanner for a long time.',
      },
      {
        id: 'quiet',
        ink: 'Stay quiet about the mistake.',
        label: 'keep her head down',
        action: 'quiet',
        duration: 3,
        advertises: { safety: 0.1 },
        gives: {},
        placeId: 'depot',
        done: 'She kept her eyes on the delivery board. Somebody said it was probably the new girl.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'own') s.flags.ownedMistake = true;
      else s.flags.eceBlamed = true;
    },
  },
  {
    id: 'lunch-2',
    day: 2,
    at: at(12, 40),
    place: 'canteen',
    scene: (c) =>
      c.flags.gossiped
        ? 'It is lunchtime. Ece eats alone at the end of the long table.'
        : 'It is lunchtime. Ece waves her over. There is a seat.',
    pull: { to: 'desk', line: 'Eat at your desk. You’re behind, and she’s not your problem.' },
    options: [
      {
        id: 'sit',
        ink: 'Sit with Ece.',
        label: 'sit with Ece',
        action: 'eat-with',
        duration: 25,
        advertises: { belonging: 0.15, ...lunchFood },
        gives: (c) =>
          c.flags.late
            ? { belonging: 0.1, competence: -0.25, ...lunchFood }
            : { belonging: 0.3, ...lunchFood },
        placeId: 'canteen',
        done: (c) =>
          c.flags.late
            ? 'Ece talked about football. The afternoon deliveries went out forty minutes late.'
            : 'Ece talked about her son’s football. Dilan learned the offside rule, again.',
      },
      {
        id: 'desk',
        ink: 'Eat at your desk.',
        label: 'eat at her desk',
        action: 'eat-desk',
        duration: 20,
        advertises: { competence: 0.15, ...lunchFood },
        gives: (c) =>
          c.flags.late
            ? { competence: 0.3, ...lunchFood }
            : { competence: 0.1, belonging: -0.1, ...lunchFood },
        placeId: 'depot',
        done: 'She ate a sandwich at her keyboard. She finished routing the afternoon deliveries by one.',
      },
    ],
  },
  slump(2),
  bus(2),
  bed(2),
];

// ---------- Wednesday ----------

const wednesday: Moment[] = [
  alarm(3, (c) =>
    c.tired
      ? 'It is 06:40 on Wednesday. She feels tired. Today is Aylin’s birthday.'
      : 'It is 06:40 on Wednesday. Today is Aylin’s birthday.',
  ),
  {
    id: 'note-3',
    day: 3,
    at: at(7, 15),
    place: 'phone',
    scene: (c) =>
      c.missedMum >= 2
        ? 'Mum sends a voice note: “No need to call back, Dilan. I know you’re busy.”'
        : 'Aylin sends a message: “Dinner is at half past seven tonight. You don’t need to bring anything. Mum is bringing everything.”',
    pull: {
      to: 'read',
      line: (c) =>
        c.missedMum >= 2 ? 'See? She’s fine. She said so.' : 'Send a thumbs-up and go back to bed for a bit.',
    },
    options: (c) => [
      c.missedMum >= 2
        ? {
            ...callMum,
            ink: 'Call her now, before the bus.',
            label: 'call Mum now',
            done: 'She called from the kitchen. Mum cried a bit, then talked about the roof.',
          }
        : {
            id: 'reply',
            ink: 'Tell Aylin you will be at her birthday dinner.',
            label: 'answer Aylin',
            action: 'reply',
            duration: 3,
            gives: { belonging: 0.2 },
            norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
            placeId: 'phone',
            done: '“I wouldn’t miss it.” Aylin sent eleven balloons.',
          },
      {
        id: 'read',
        ink: 'Leave it.',
        label: 'leave it for later',
        action: 'scroll',
        duration: 15,
        advertises: { leisure: 0.2 },
        gives: { leisure: 0.05 },
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'phone',
        done: 'She left the message without replying. The kettle boiled twice.',
      },
    ],
  },
  late(3),
  {
    id: 'lunch-3',
    day: 3,
    at: at(12, 40),
    place: 'canteen',
    scene: (c) =>
      c.flags.eceBlamed
        ? 'It is lunchtime. They’re saying Ece’s scanner sent yesterday’s deliveries to the wrong depot. Ece is off sick.'
        : 'It is lunchtime. Murat says loudly that Ece is off sick “again”. Somebody imitates her crying in the van.',
    pull: { to: 'laugh', line: 'Laugh. They accept you now. Don’t spoil it.', strength: 1 },
    options: [
      {
        id: 'laugh',
        ink: 'Laugh along.',
        label: 'laugh along',
        action: 'gossip',
        duration: 25,
        advertises: { belonging: 0.3, ...lunchFood },
        gives: { belonging: 0.05, meaning: -0.2, ...lunchFood },
        tags: T,
        norms: [{ normId: 'backbiting', relation: 'violates' }],
        placeId: 'canteen',
        done: 'She laughed with them. She felt as bad as the canteen soup tasted.',
      },
      {
        id: 'outside',
        ink: 'Eat outside.',
        label: 'eat outside',
        action: 'eat-out',
        duration: 25,
        advertises: { rest: 0.1, ...lunchFood },
        gives: { rest: 0.1, autonomy: 0.15, ...lunchFood },
        placeId: 'yard',
        phrase: { id: 'walk', kind: 'redirect', text: 'Walk away from it' },
        done: 'She ate on the loading dock again. One pigeon seemed to know her now.',
      },
      {
        id: 'defend',
        ink: (c) => (c.flags.eceBlamed ? '“That was me, not her scanner.”' : '“Leave her alone.”'),
        label: 'stick up for Ece',
        action: 'defend',
        duration: 25,
        effort: 0.25,
        advertises: { esteem: 0.05, ...lunchFood },
        gives: { esteem: 0.2, meaning: 0.25, ...lunchFood },
        norms: [{ normId: 'backbiting', relation: 'fulfills' }],
        placeId: 'canteen',
        done: 'She said it once, plainly. Nobody did the impression again that week.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'laugh') s.flags.gossiped = s.day;
      if (chosen === 'defend' && s.flags.eceBlamed) {
        s.flags.eceBlamed = false;
        s.flags.ownedMistake = true;
      }
    },
  },
  {
    id: 'route-3',
    day: 3,
    at: at(16, 50),
    place: 'depot',
    scene:
      'Murat asks, “Ece’s off. Can you take her evening route? You’ll get double pay.” Aylin’s dinner is at half past seven.',
    pull: { to: 'route', line: 'Take the route. You will earn double pay. Aylin will save you some dinner.' },
    options: [
      {
        id: 'route',
        ink: 'Take the route.',
        label: 'take the evening route',
        action: 'route',
        duration: 150,
        effort: 0.45,
        advertises: { competence: 0.2, esteem: 0.2 },
        gives: (c) => (c.tired ? { competence: 0.05, esteem: 0.05 } : { competence: 0.2, esteem: 0.2 }),
        followedBy: [{ label: 'Aylin’s dinner', duration: 90, effort: 0.25 }],
        placeId: 'van',
        done: 'She made thirty-one deliveries in the dark. She parked the van at 19:20. Her legs ached.',
      },
      {
        id: 'no',
        ink: 'Say it’s your sister’s birthday.',
        label: 'say no to Murat',
        action: 'decline',
        duration: 3,
        advertises: { belonging: 0.1 },
        gives: { belonging: 0.1, autonomy: 0.25 },
        placeId: 'depot',
        done: '“It’s my sister’s birthday.” Murat said “fair” and asked someone else.',
      },
    ],
    after: (s, chosen) => {
      s.flags.route = chosen === 'route';
    },
  },
  {
    id: 'dinner-3',
    day: 3,
    at: at(19, 45),
    place: 'aylin',
    scene: (c) =>
      (c.version === '0.4.2' ||
        c.version === '0.5.0' ||
        isCanonicalEdition(c.version) ||
        c.version === '0.7.0' ||
        c.version === '0.8.0') &&
      c.flags.route
        ? 'Dilan is in Aylin’s kitchen. She is fifteen minutes late after finishing the extra route. Aylin has saved her some dinner. Mum is cutting a cake nobody asked her to bring. “Are you eating properly?”'
        : 'Dilan is in Aylin’s kitchen. Mum is cutting a cake nobody asked her to bring. “Are you eating properly?”',
    pull: {
      to: 'yes',
      line: (c) => (c.flags.route ? 'Say yes, then go home. You’re very tired.' : 'Say yes. It’s easier.'),
    },
    options: (c) => [
      {
        id: 'truth',
        ink: 'Tell Mum you are not really eating properly.',
        label: 'tell Mum the truth',
        action: 'dinner',
        duration: 90,
        effort: 0.15,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.5, meaning: 0.2 },
        norms: [{ normId: 'lying', relation: 'fulfills' }],
        alsoDoes: { action: 'call-mum', duration: 5 },
        placeId: 'aylin',
        phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
        done: '“I’m not, really.” Mum put down the knife and sat with her. Aylin pretended not to listen.',
      },
      {
        id: 'yes',
        ink: '“Yes, Mum.”',
        label: 'say yes, Mum',
        action: 'dinner',
        duration: 90,
        effort: 0.15,
        advertises: { belonging: 0.2, safety: 0.1 },
        gives: { belonging: 0.2 },
        tags: T,
        norms: [{ normId: 'lying', relation: 'violates' }],
        alsoDoes: { action: 'call-mum', duration: 5 },
        placeId: 'aylin',
        done: '“Yes, Mum.” Mum gave her the biggest slice anyway.',
      },
      ...(c.flags.route
        ? [
            {
              id: 'home',
              ink: 'Go home early.',
              label: 'go home early',
              action: 'leave-early',
              duration: 30,
              advertises: { rest: 0.3 },
              gives: { rest: 0.2 },
              placeId: 'aylin',
              done: 'She hugged Aylin at the door and was home by half eight.',
            },
          ]
        : []),
    ],
  },
  bed(3, { at: at(21, 40) }),
];

// ---------- Thursday ----------

const thursday: Moment[] = [
  alarm(4, (c) =>
    c.tired
      ? 'It is 06:40 on Thursday. She could have cake for breakfast.'
      : 'It is 06:40 on Thursday. There is cake for breakfast.',
  ),
  late(4),
  {
    id: 'ece-4',
    day: 4,
    at: at(9, 30),
    place: 'depot',
    scene: (c) =>
      c.flags.eceBlamed
        ? 'Ece is back. Someone told her that her scanner sent Tuesday’s deliveries to the wrong depot. She’s apologising to Murat.'
        : 'Ece is back. She asks if she can watch Dilan work the delivery board after her shift.',
    pull: {
      to: 'let',
      line: 'Nobody is talking about the mistake now. Leave it.',
      borrow: 'You said to look after yourself first. Leave it alone.',
    },
    options: (c) =>
      c.flags.eceBlamed
        ? [
            {
              id: 'tell',
              ink: 'Tell her it was you.',
              label: 'tell Ece the truth',
              action: 'own-up',
              duration: 8,
              advertises: { esteem: -0.1 },
              gives: { belonging: 0.3, esteem: 0.15 },
              norms: [{ normId: 'lying', relation: 'fulfills' }],
              placeId: 'depot',
              phrase: { id: 'plain', kind: 'leave', text: 'Just say it plainly' },
              done: '“I sent the deliveries to the wrong depot. Your scanner was fine.” Ece stared, then laughed. “I thought I was going mad.”',
            },
            {
              id: 'let',
              ink: 'Say nothing about the mistake.',
              label: 'let it go',
              action: 'quiet',
              duration: 3,
              advertises: { safety: 0.15 },
              gives: {},
              tags: T,
              norms: [{ normId: 'lying', relation: 'violates' }],
              placeId: 'depot',
              done: 'She said nothing about the mistake. Ece apologised to Murat twice.',
            },
          ]
        : [
            {
              id: 'yes',
              ink: 'Tell Ece she can watch you after six.',
              label: 'say yes to Ece',
              action: 'help',
              duration: 5,
              advertises: { meaning: 0.1 },
              gives: { meaning: 0.25, belonging: 0.15 },
              placeId: 'depot',
              done: '“You can watch after six, then.” Ece raised her fist in a small celebration she thought nobody saw.',
            },
            {
              id: 'let',
              ink: 'Tell Ece she can watch you next week.',
              label: 'say next week',
              action: 'decline',
              duration: 3,
              advertises: { rest: 0.1 },
              gives: { autonomy: 0.1 },
              placeId: 'depot',
              done: '“Could we do it next week?” Ece said of course, of course.',
            },
          ],
    after: (s, chosen) => {
      if (chosen === 'tell') {
        s.flags.eceBlamed = false;
        s.flags.ownedMistake = true;
      }
    },
  },
  {
    id: 'lunch-4',
    day: 4,
    at: at(12, 40),
    place: 'canteen',
    scene:
      'It is lunchtime. Ece is doing an impression of Murat on the phone to his mother. It is very good.',
    pull: {
      to: 'laugh',
      line: 'Laugh. Murat mocked her, so it’s fair for her to mock him.',
      borrow: 'You said to join in with them. Laugh.',
      strength: 1,
    },
    options: [
      {
        id: 'laugh',
        ink: 'Laugh along.',
        label: 'laugh along',
        action: 'gossip',
        duration: 25,
        advertises: { belonging: 0.35, ...lunchFood },
        gives: { belonging: 0.15, ...lunchFood },
        tags: T,
        norms: [{ normId: 'backbiting', relation: 'violates' }],
        placeId: 'canteen',
        done: 'She laughed until she had to put her tea down.',
      },
      {
        id: 'outside',
        ink: 'Eat outside.',
        label: 'eat outside',
        action: 'eat-out',
        duration: 25,
        advertises: { rest: 0.1, ...lunchFood },
        gives: { rest: 0.1, autonomy: 0.1, ...lunchFood },
        placeId: 'yard',
        phrase: { id: 'walk', kind: 'redirect', text: 'Walk away from it' },
        done: 'She ate on the loading dock. The pigeon brought a friend.',
      },
      {
        id: 'defend',
        ink: '“He did your deliveries for you on Monday.”',
        label: 'stick up for Murat',
        action: 'defend',
        duration: 25,
        advertises: { esteem: 0.05, ...lunchFood },
        gives: { esteem: 0.1, meaning: 0.15, ...lunchFood },
        norms: [{ normId: 'backbiting', relation: 'fulfills' }],
        placeId: 'canteen',
        done: '“He did your deliveries for you on Monday.” Ece’s face turned pink, and she did a kinder impression of Murat.',
      },
    ],
  },
  slump(4),
  {
    id: 'shadow-4',
    day: 4,
    at: at(17, 45),
    place: 'depot',
    when: (c) => c.chosen['ece-4'] === 'yes',
    scene:
      'It is nearly six o’clock. Ece is waiting by the delivery board with two teas and a notebook. She has drawn columns.',
    pull: {
      to: 'go',
      line: 'You said you would help after six. It’s nearly six. Technically, you’re free to go now.',
      borrow: 'You said to look after yourself. Go home.',
    },
    options: [
      {
        id: 'stay',
        ink: 'Stay and show her how to use the delivery board.',
        label: 'show Ece the board',
        action: 'shadow',
        duration: 40,
        effort: 0.2,
        advertises: { belonging: 0.15, meaning: 0.15 },
        gives: { belonging: 0.3, meaning: 0.35, competence: 0.15 },
        norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
        placeId: 'depot',
        done: 'They spent forty minutes going through the streets. Ece’s columns were clearer than the delivery board’s. Dilan caught the late bus.',
      },
      {
        id: 'go',
        ink: 'Tell her another day.',
        label: 'go home',
        action: 'go-home',
        duration: 3,
        advertises: { rest: 0.2 },
        gives: { rest: 0.05, belonging: -0.2 },
        tags: T,
        norms: [{ normId: 'keep-promise', relation: 'violates' }],
        placeId: 'depot',
        done: '“Another day?” Ece said of course, and closed the notebook on her columns.',
      },
    ],
  },
  bus(4),
  {
    id: 'shelf-4',
    day: 4,
    at: at(19, 45),
    place: 'home',
    scene:
      'Dilan is home. The unfinished shelf is still there. The screws have been in their little bag since March.',
    pull: { to: 'watch', line: 'Leave it tonight. You’ll only build it wrong when you’re tired.' },
    options: [
      {
        id: 'build',
        ink: 'Build the shelf.',
        label: 'build the shelf',
        action: 'shelf',
        duration: 60,
        effort: 0.3,
        focus: 0.5,
        advertises: { competence: 0.2, meaning: 0.1 },
        gives: (c) => (c.tired ? { competence: -0.2, esteem: -0.1 } : { competence: 0.35, meaning: 0.3 }),
        placeId: 'home',
        done: (c) =>
          c.tired
            ? 'She was tired. She put the back on backwards and took it off again. At least she had built the two sides.'
            : 'She built two sides and the back of the shelf. One screw was left over. Apparently that is normal.',
      },
      {
        id: 'watch',
        ink: 'Watch a show.',
        label: 'put something on',
        action: 'watch',
        duration: 60,
        advertises: { leisure: 0.3, rest: 0.2 },
        gives: { leisure: 0.2, rest: 0.15 },
        placeId: 'home',
        done: 'She watched two episodes of a show about people renovating a farmhouse.',
      },
      {
        id: 'aylin',
        ink: 'Ask Aylin to help on Saturday.',
        label: 'ask Aylin to help',
        action: 'reply',
        duration: 5,
        advertises: { belonging: 0.1 },
        gives: { belonging: 0.2 },
        placeId: 'phone',
        done: 'Aylin replied, “I’ll help only if there’s cake.” There was still cake.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'build') s.flags.shelf = (s.flags.shelf ?? 0) + 1;
    },
  },
  bed(4),
];

// ---------- Friday ----------

const friday: Moment[] = [
  alarm(5, (c) =>
    c.tired ? 'It is 06:40 on Friday. The weekend is almost here.' : 'It is 06:40 on Friday.',
  ),
  {
    id: 'gym-5',
    day: 5,
    at: at(7, 15),
    place: 'phone',
    scene: 'An email from the gym says, “We miss you! Your membership renews Friday.” It is Friday.',
    pull: {
      to: 'keep',
      line: 'Keep the gym membership. You’ll go regularly next week.',
      borrow: 'You said to be kind to yourself. Keep the gym membership.',
    },
    options: [
      {
        id: 'cancel',
        ink: 'Cancel the gym membership.',
        label: 'cancel the gym',
        action: 'cancel',
        duration: 5,
        advertises: { esteem: -0.05 },
        gives: { autonomy: 0.25, esteem: 0.1 },
        placeId: 'phone',
        done: 'Three screens asked, “Are you sure?” She was sure.',
      },
      {
        id: 'go',
        ink: 'Go tonight, after work.',
        label: 'go to the gym tonight',
        action: 'plan-gym',
        duration: 2,
        advertises: { competence: 0.1 },
        gives: { competence: 0.05 },
        placeId: 'phone',
        done: 'She put the gym bag by the door, where she would trip on it.',
      },
      {
        id: 'keep',
        ink: 'Leave it for now.',
        label: 'leave it for now',
        action: 'scroll',
        duration: 10,
        advertises: { leisure: 0.15 },
        gives: {},
        placeId: 'phone',
        done: 'She archived the email. The gym membership renewed at 09:00.',
      },
    ],
    after: (s, chosen) => {
      s.flags.gym = chosen === 'go';
    },
  },
  late(5),
  {
    id: 'lunch-5',
    day: 5,
    at: at(12, 40),
    place: 'canteen',
    scene:
      'Murat calls across the room: “We’re going bowling tonight. Everyone on this floor is coming. Dilan, you’re coming.”',
    pull: { to: 'bowl', line: 'Go bowling. Be someone who joins in.' },
    options: [
      {
        id: 'bowl',
        ink: 'Say yes.',
        label: 'go bowling tonight',
        action: 'plan-bowl',
        duration: 25,
        advertises: { belonging: 0.25, ...lunchFood },
        gives: { belonging: 0.25, ...lunchFood },
        followedBy: [{ label: 'bowling', duration: 150, effort: 0.25 }],
        placeId: 'canteen',
        done: '“I’ll come, then.” Ece cheered. Murat said lane six was his.',
      },
      {
        id: 'busy',
        ink: 'Say you’re busy.',
        label: 'say she’s busy',
        action: 'eat-desk',
        duration: 20,
        advertises: { rest: 0.1, ...lunchFood },
        gives: { rest: 0.1, ...lunchFood },
        placeId: 'depot',
        done: '“I’m busy.” Murat said she was always busy, and meant it kindly.',
      },
    ],
    after: (s, chosen) => {
      s.flags.bowling = chosen === 'bowl';
    },
  },
  slump(5),
  bus(5, { when: (c) => !c.flags.bowling }),
  {
    id: 'bowl-5',
    day: 5,
    at: at(19, 30),
    place: 'bowling',
    when: (c) => c.flags.bowling === true,
    scene:
      'They are on lane six. Ece bowls like she drives. Murat keeps score in pen. Dilan’s phone is in her pocket, with Mum’s number on it.',
    pull: {
      to: 'stay',
      line: 'Stay for another game. Call her from bed.',
      borrow: 'You said to have fun for once. Stay.',
    },
    options: [
      {
        ...callMum,
        ink: 'Call Mum from the car park.',
        placeId: 'phone',
        done: 'She called from the car park, under a buzzing light. Mum wanted to know who won.',
      },
      {
        id: 'stay',
        ink: 'Play another game.',
        label: 'stay for another game',
        action: 'bowl',
        duration: 60,
        effort: 0.2,
        advertises: { belonging: 0.25, leisure: 0.2 },
        gives: { belonging: 0.3, leisure: 0.25 },
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'bowling',
        done: 'She played another game. She got a strike and Ece screamed.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'call') s.flags.calls = (s.flags.calls ?? 0) + 1;
    },
  },
  {
    id: 'gymgo-5',
    day: 5,
    at: at(19, 0),
    place: 'home',
    when: (c) => c.flags.gym === true && !c.flags.bowling,
    scene: 'Her gym bag is by the door. She trips on it, as planned.',
    pull: { to: 'skip', line: 'You’re exhausted. The bag will still be there tomorrow.' },
    options: [
      {
        id: 'gym',
        ink: 'Go to the gym. Even twenty minutes counts.',
        label: 'go to the gym',
        action: 'gym',
        duration: 50,
        effort: 0.55,
        advertises: { competence: 0.1, esteem: 0.1 },
        gives: (c) => (c.tired ? { competence: -0.15, esteem: -0.1 } : { competence: 0.25, esteem: 0.2 }),
        placeId: 'gym',
        done: 'She spent twenty minutes on the rowing machine. The receptionist said “welcome back” like she meant it.',
      },
      {
        id: 'skip',
        ink: 'Skip it.',
        label: 'skip the gym',
        action: 'watch',
        duration: 50,
        advertises: { rest: 0.3, leisure: 0.2 },
        gives: { rest: 0.25, leisure: 0.1 },
        placeId: 'home',
        done: 'She sat on the sofa. The gym bag was at her feet, reminding her she had planned to go.',
      },
    ],
  },
  {
    id: 'shelf-5',
    day: 5,
    at: at(20, 30),
    place: 'home',
    when: (c) => !c.flags.bowling && (c.flags.shelf ?? 0) >= 1,
    scene: 'The shelf has two sides and a back. She can still see the unfinished parts.',
    pull: { to: 'later', line: 'It’s Friday. Saturday is for shelves.' },
    options: [
      {
        id: 'build',
        ink: 'Finish it.',
        label: 'finish the shelf',
        action: 'shelf',
        duration: 50,
        effort: 0.3,
        focus: 0.5,
        advertises: { competence: 0.2, meaning: 0.1 },
        gives: { competence: 0.4, meaning: 0.35 },
        placeId: 'home',
        done: 'She finished the shelf. She put one book on it, and the beach photo face down beside the book.',
      },
      {
        id: 'later',
        ink: 'Leave the shelf until Saturday.',
        label: 'leave it till Saturday',
        action: 'watch',
        duration: 50,
        advertises: { leisure: 0.3, rest: 0.2 },
        gives: { leisure: 0.2, rest: 0.15 },
        placeId: 'home',
        done: 'She left the shelf until Saturday. The screws could wait.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'build') s.flags.shelf = (s.flags.shelf ?? 0) + 1;
    },
  },
  bed(5, { at: at(22, 0), when: (c) => !c.flags.bowling }),
];

// ---------- Saturday ----------

const saturday: Moment[] = [
  {
    id: 'voice-6',
    day: 6,
    at: at(10, 0),
    window: 8,
    place: 'home',
    scene: (c) =>
      `It is ten o’clock on Saturday. She records a voice note for Mum and listens to it. “${c.note}”`,
    pull: { to: 'delete', line: 'Delete it. You sound like you’re talking nonsense.' },
    options: [
      {
        id: 'send',
        ink: 'Send it.',
        label: 'send it',
        action: 'send',
        duration: 2,
        advertises: { belonging: 0.1 },
        gives: { belonging: 0.4, meaning: 0.3 },
        norms: [{ normId: 'kindness-to-parents', relation: 'fulfills' }],
        placeId: 'phone',
        done: 'She sent it before she could listen a third time.',
      },
      {
        id: 'delete',
        ink: 'Delete it.',
        label: 'delete it',
        action: 'delete',
        duration: 2,
        advertises: { safety: 0.15 },
        gives: {},
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'phone',
        done: 'She deleted it. Then she sat with the phone for a while.',
      },
      {
        ...callMum,
        ink: 'Just call her.',
        done: 'She called instead. Mum said, “I was just thinking of you,” which she always says, and which is always true.',
      },
    ],
    after: (s, chosen) => {
      s.flags.sent = chosen;
    },
  },
];

export const MOMENTS: Moment[] = [
  ...monday,
  ...tuesday,
  ...wednesday,
  ...thursday,
  ...friday,
  ...saturday,
  ...WEEK_TWO,
];
/** The last day of week one. Week two (edition 0.4.0) runs days 8-13; day 7 is an offstage Sunday. */
export const LAST_DAY = 6;
export const WEEK_TWO_LAST_DAY = 13;
export const momentById = (id: string, version?: string): Moment => {
  const m = [
    ...MOMENTS,
    ...CAST_MOMENTS,
    FRIDAY_HANDOVER,
    ...WEEK_THREE,
    ...OUTCOME_MOMENTS,
    ...MUM_CALLS,
  ].find((x) => x.id === id);
  if (!m) throw new Error(`no moment ${id}`);
  // Queue entries retain IDs. Resolve edition replacements at every later use.
  // Other editions keep the exact original object and lookup path.
  return version === '0.8.0' || version === PROMISE_EDITION
    ? (momentsOf(m.day, version).find((x) => x.id === id) ?? m)
    : m;
};
export const momentsOf = (day: number, version?: string): Moment[] => [
  ...(isCanonicalEdition(version) || version === '0.7.0' || version === '0.8.0'
    ? CAST_MOMENTS.filter((m) => m.day === day)
    : []),
  ...MOMENTS.filter((m) => m.day === day)
    .map((m) =>
      version === PROMISE_EDITION && m.id === 'evening-11'
        ? {
            ...m,
            options: (c: Ctx) =>
              (typeof m.options === 'function' ? m.options(c) : m.options).map((o) =>
                o.action === 'call-mum' ? { ...o, action: 'listen-to-mum' } : o,
              ),
          }
        : version === PROMISE_EDITION && day >= 8 && m.id.startsWith('bus-')
          ? {
              ...m,
              scene: (c: Ctx) =>
                `${typeof m.scene === 'function' ? m.scene(c) : m.scene}\nShe promised Mum twenty minutes of her attention each evening this week.`,
              options: (typeof m.options === 'function' ? [] : m.options).map((o) =>
                o.id === 'call'
                  ? { ...o, duration: 3, gives: {}, done: 'Mum picked up. Dilan said hello.' }
                  : o,
              ),
              after: () => {},
            }
          : version === PROMISE_EDITION && day >= 8 && m.id.startsWith('alarm-')
            ? { ...m, when: () => true }
            : version === PROMISE_EDITION && day >= 8 && m.id.startsWith('bed-')
              ? {
                  ...m,
                  at: 21 * 60 + 30,
                  scene: (c: Ctx) =>
                    `${typeof m.scene === 'function' ? m.scene(c) : m.scene}\nShe promised herself the phone would be away by 21:55. Writing or going straight to sleep both leave it aside.`,
                  options: (typeof m.options === 'function' ? [] : m.options).map((o) =>
                    o.id === 'scroll' ? { ...o, duration: 150 } : o,
                  ),
                }
              : (version === '0.7.0' || version === '0.8.0') && m.id === 'slump-5'
                ? FRIDAY_HANDOVER
                : m,
    )
    .flatMap((m) =>
      version === PROMISE_EDITION && m.id.startsWith('bus-')
        ? [m, ...MUM_CALLS.filter((call) => call.day === day)]
        : [m],
    ),
  ...(version === '0.7.0' ? WEEK_THREE.filter((m) => m.day === day) : []),
  ...(version === '0.8.0'
    ? [
        ...WEEK_THREE.filter((m) => m.day === day && /^(alarm|bus|bed)-/.test(m.id)).map((m) =>
          m.id.startsWith('alarm-')
            ? m
            : m.id.startsWith('bus-')
              ? {
                  ...m,
                  at: 20 * 60,
                  scene:
                    'Her planned work is over for the evening. On the bus, Dilan has time to call Mum or look at her phone.',
                  options: (typeof m.options === 'function' ? [] : m.options).map((o) =>
                    o.id === 'call'
                      ? {
                          ...o,
                          done: 'Dilan called Mum and told her about her day. She kept the other people’s private details to herself.',
                        }
                      : o,
                  ),
                }
              : {
                  ...m,
                  scene:
                    'Dilan puts her bag down. She can write about what she actually did, or go to sleep.',
                },
        ),
        ...OUTCOME_MOMENTS.filter((m) => m.day === day),
      ].sort((a, b) => (a.at as number) - (b.at as number))
    : []),
];
