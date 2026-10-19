/**
 * The week, as moments. Content only: scene lines, the pull's lines, and what Dilan could do. Every tempting
 * option carries a `temptation` tag and a norm from HF's own catalog, so HF notices it as a prompt; options the
 * pull favours without any held norm against them are places where the pull may simply be right.
 */
import type { Ctx, Moment, Opt } from './types.ts';

const T = ['temptation'];
/** The same moment on another day reads differently: one variant per weekday (Monday first). */
const byDay = (c: Ctx, lines: string[]): string => lines[(c.day - 1) % lines.length] ?? lines[0] ?? '';
const at = (h: number, m = 0) => h * 60 + m;

// ---------- recurring cards ----------

const getUp: Opt = {
  id: 'up',
  ink: 'Up. Feet on the floor.',
  label: 'get up',
  action: 'get-up',
  duration: 15,
  effort: 0.15,
  advertises: { competence: 0.1 },
  gives: { competence: 0.15, autonomy: 0.1 },
  norms: [{ normId: 'punctuality', relation: 'fulfills' }],
  placeId: 'bed',
  phrase: { id: 'feet', kind: 'redirect', text: 'Feet on the floor' },
  done: 'She was up before the second alarm.',
};
const snooze: Opt = {
  id: 'snooze',
  ink: 'Five more.',
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
        c.tired ? 'Five more. You were up till all hours.' : 'Five more. The alarm is more of a suggestion.',
      borrow: 'You said rest matters. Five more.',
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
        ? '08:25. Murat doesn’t look up. “Ring road again?”'
        : '08:25. Murat looks at the clock, then at her. “Traffic?”',
    pull: { to: 'lie', line: 'Say the ring road. Everyone says the ring road.', strength: 1 },
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
            ? '“Overslept.” Murat sighed. “That’s twice. I have to put it down, Dilan.” He did, in pen.'
            : '“Overslept. Sorry.” Murat shrugged. “Happens. Board’s yours.”',
      },
      {
        id: 'lie',
        ink: 'The ring road.',
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
            ? '“The ring road was solid.” Murat nodded. Nobody checked. It worked, which was almost worse.'
            : '“The ring road again.” Murat didn’t look up. “It’s very unlucky, that road.”',
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
            '15:20. The board is red with late drops. Her eyes keep closing on the screen.',
            '15:20. The board again. The same red. Her eyes sting.',
            '15:20. The board is red. Her head is full of sand.',
            '15:20. Red again. She reads the same postcode three times.',
            '15:20. Friday red. She yawns so hard her jaw clicks.',
          ])
        : byDay(c, [
            '15:20. The board is red with late drops. The kettle is right there.',
            '15:20. The board again. The same red. The kettle again.',
            '15:20. The afternoon dip. Somebody has left biscuits by the kettle.',
            '15:20. The board goes red on schedule. So does she.',
            '15:20. Friday afternoon. Red board, warm kettle, two hours to go.',
          ]),
    pull: {
      to: 'coffee',
      line: (c) =>
        byDay(c, [
          'Third coffee. You’ve earned it.',
          'Coffee. Same as yesterday. Yesterday was fine.',
          'Coffee. Today of all days.',
          'Coffee. Who sleeps anyway.',
          'Coffee. It’s Friday. Nobody counts on Friday.',
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
            'The third coffee. The board was green by five.',
            'Coffee. The board went green. Her hands buzzed a little.',
            'Coffee, and a biscuit nobody claimed. Green by five.',
            'Coffee. She cleared the board and felt like a wire.',
            'Coffee. Green by five. Friday’s problem now is tonight.',
          ]),
      },
      {
        id: 'walk',
        ink: 'Water, and a lap of the yard.',
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
            ? 'A lap of the yard. She came back and fell asleep in front of the board. Murat saw.'
            : 'A lap of the yard. The parked vans looked like sleeping animals. The board went green by five.',
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
      : 'Twenty minutes. Mum talked about the neighbour’s roof. Dilan laughed twice.',
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
  done: 'She scrolled to her stop, and two stops past it.',
};
const textMum: Opt = {
  id: 'text',
  ink: 'Text her: tomorrow, promise.',
  label: 'text Mum instead',
  action: 'text-mum',
  duration: 3,
  advertises: { belonging: 0.05 },
  gives: { belonging: 0.1 },
  placeId: 'phone',
  done: '“Tomorrow, promise.” Mum sent back a flower.',
};

function bus(day: number, extra: Partial<Moment> = {}): Moment {
  return {
    id: `bus-${day}`,
    day,
    at: at(18, 10),
    place: 'bus',
    scene: (c) =>
      c.missedMum >= 2
        ? 'The bus home. Mum’s voice note is still at the top of her messages.'
        : byDay(c, [
            'The bus home. Mum’s number is right there. So is everything else.',
            'The bus home. The same seat. Mum’s number, one tap away.',
            'The bus home. Rain on the window. Mum’s number.',
            'The bus home. A man opposite is on the phone to his mum, loudly. It’s a sign, or it isn’t.',
            'The bus home. Friday. Mum’s number, and every video in the world.',
          ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        c.missedMum >= 2
          ? 'She said no need. Take her at her word.'
          : byDay(c, [
              'You’ll call her when you’re human again.',
              'You called yesterday. Or the day before. Recently.',
              'She’ll only ask if you’re eating.',
              'Tomorrow. You’ll have more to say tomorrow.',
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
        '21:30. Bed. The phone is warm in her hand. The beach photo is still the lock screen.',
        '21:30. Bed. The beach photo lights up when she touches the phone. Someone is cropped out of it.',
        'Bed, late. Cake crumbs in the bag. The beach photo, still.',
        '21:30. Bed. The notebook from March is under the phone, which is under her thumb.',
        '22:00. Bed. The week is nearly done with her.',
      ]),
    pull: {
      to: 'scroll',
      line: (c) =>
        byDay(c, [
          'One more video. Then sleep. Honestly.',
          'Just one. You were good today. Ish.',
          'You can’t write tonight, you’re full of cake.',
          'One video for each thing that went wrong. That’s fair.',
          'It’s nearly the weekend. Videos are basically the weekend.',
        ]),
      borrow: 'You said switch off. Videos are switching off.',
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
            'A page. Her handwriting was worse than she remembered, and more hers.',
            'Three lines. One of them was about the cake.',
            'A page and a bit. She drew a box round one sentence.',
            'She filled the page and turned it over.',
          ]),
      },
      {
        id: 'scroll',
        ink: 'One more video.',
        label: 'watch one more video',
        action: 'scroll',
        duration: 75,
        advertises: { leisure: 0.25, rest: 0.1 },
        gives: { leisure: 0.05 },
        placeId: 'phone',
        done: (c) =>
          byDay(c, [
            'It was not one more video.',
            'A man restoring a rusty knife. Then another man, another knife.',
            'She watched a stranger’s whole house tour. It had a better shelf.',
            'Forty minutes of other people’s holidays.',
            'It was not one more video. It was never going to be.',
          ]),
      },
      {
        id: 'sleep',
        ink: 'Phone on the floor. Sleep.',
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
  alarm(1, () => '06:40, Monday. The alarm. The half-built shelf watches from the corner.'),
  {
    id: 'note-1',
    day: 1,
    at: at(7, 15),
    place: 'phone',
    scene: 'A voice note from Aylin: “Mum’s asking again. Just ring her. It’s ten minutes.”',
    pull: { to: 'read', line: 'Later. Nobody does Mum before tea.' },
    options: [
      {
        id: 'reply',
        ink: 'Tell Aylin: tonight, on the bus.',
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
        ink: 'Leave it on read.',
        label: 'leave it for later',
        action: 'scroll',
        duration: 15,
        advertises: { leisure: 0.2 },
        gives: { leisure: 0.05 },
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'phone',
        done: 'She left it on read and watched four videos about other people’s kitchens.',
      },
    ],
  },
  late(1),
  {
    id: 'ece-1',
    day: 1,
    at: at(10, 40),
    place: 'depot',
    scene: 'Ece, the new driver, calls from her van. Lost in the new estate. Trying not to cry.',
    pull: { to: 'pin', line: 'Send her the map pin. You have forty drops to route.' },
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
            ? 'Fifteen minutes, street by street. Ece made her drop. Dilan’s board did not.'
            : 'Fifteen minutes, street by street. Ece made her drop.',
      },
      {
        id: 'pin',
        ink: 'Send the pin.',
        label: 'send her the pin',
        action: 'pin',
        duration: 2,
        advertises: { competence: 0.15 },
        gives: (c) => (c.flags.late ? { competence: 0.25 } : { competence: 0.05, meaning: -0.1 }),
        placeId: 'depot',
        done: 'She sent the pin and went back to the board.',
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
    scene: 'Lunch. Murat is doing an impression of Ece crying in her van. People are laughing.',
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
        done: 'She laughed. The impression got a second act.',
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
        done: '“She found it, didn’t she?” It went quiet. Then Murat laughed at himself.',
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
    (c) => (c.tired ? '06:40, Tuesday. She slept late. It shows.' : '06:40, Tuesday. Grey light. The shelf.'),
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
    scene: 'Murat, by the kettle: “Ring road was clear yesterday, my cousin says. Clear as anything.”',
    pull: { to: 'again', line: 'Say it cleared up after. Roads do that.' },
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
        ink: 'It cleared up after.',
        label: 'say it cleared up after',
        action: 'lie',
        duration: 2,
        advertises: { esteem: 0.1, safety: 0.1 },
        gives: {},
        tags: T,
        norms: [{ normId: 'lying', relation: 'violates' }],
        placeId: 'depot',
        done: '“Must have cleared up after.” Murat poured his tea and said nothing at all.',
      },
    ],
  },
  late(2),
  {
    id: 'mistake-2',
    day: 2,
    at: at(11, 10),
    place: 'depot',
    scene: 'The eleven o’clock drops went to the wrong depot. Her routing. Murat asks the room who did it.',
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
        ink: 'Keep your head down.',
        label: 'keep her head down',
        action: 'quiet',
        duration: 3,
        advertises: { safety: 0.1 },
        gives: {},
        placeId: 'depot',
        done: 'She kept her eyes on the board. Somebody said it was probably the new girl.',
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
        ? 'Lunch. Ece eats alone at the end of the long table.'
        : 'Lunch. Ece waves her over. There is a seat.',
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
            ? 'Ece talked about football. The afternoon drops went out forty minutes late.'
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
        done: 'A sandwich over the keyboard. The afternoon drops were routed by one.',
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
    c.tired ? '06:40, Wednesday. Heavy. Aylin’s birthday.' : '06:40, Wednesday. Aylin’s birthday.',
  ),
  {
    id: 'note-3',
    day: 3,
    at: at(7, 15),
    place: 'phone',
    scene: (c) =>
      c.missedMum >= 2
        ? 'A voice note from Mum: “No need to call back, love. I know you’re busy.”'
        : 'Aylin: “Tonight, half seven. Bring nothing. Mum is bringing everything.”',
    pull: {
      to: 'read',
      line: (c) =>
        c.missedMum >= 2 ? 'See? She’s fine. She said so.' : 'Thumbs up. Done. Back to bed for a bit.',
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
            ink: 'Say: wouldn’t miss it.',
            label: 'answer Aylin',
            action: 'reply',
            duration: 3,
            gives: { belonging: 0.2 },
            norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
            placeId: 'phone',
            done: '“Wouldn’t miss it.” Aylin sent eleven balloons.',
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
        done: 'She left it. The kettle boiled twice.',
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
        ? 'Lunch. They’re saying Ece’s scanner sent yesterday’s drops astray. Ece is off sick.'
        : 'Lunch. Murat, loudly: Ece is off sick “again”. Somebody does the van impression.',
    pull: { to: 'laugh', line: 'Laugh. You’re in now. Don’t spoil it.', strength: 1 },
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
        done: 'She laughed with them. It tasted like the canteen soup.',
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
        done: 'The loading dock again. One pigeon seemed to know her now.',
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
      'Murat: “Ece’s off. Can you take her evening route? Double time.” Aylin’s dinner is at half seven.',
    pull: { to: 'route', line: 'Take it. Double time. Aylin will save you a plate.' },
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
        done: 'Thirty-one drops in the dark. She parked the van at 19:20, legs humming.',
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
    scene: 'Aylin’s kitchen. Mum is cutting a cake nobody asked her to bring. “Are you eating properly?”',
    pull: {
      to: 'yes',
      line: (c) =>
        c.flags.route ? 'Say yes, then go home. You’re dead on your feet.' : 'Say yes. It’s easier.',
    },
    options: (c) => [
      {
        id: 'truth',
        ink: 'Tell her: not really.',
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
        done: '“Not really.” Mum put down the knife and sat with her. Aylin pretended not to listen.',
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
    c.tired ? '06:40, Thursday. Cake for breakfast is a choice.' : '06:40, Thursday. Cake for breakfast.',
  ),
  late(4),
  {
    id: 'ece-4',
    day: 4,
    at: at(9, 30),
    place: 'depot',
    scene: (c) =>
      c.flags.eceBlamed
        ? 'Ece is back. Someone told her Tuesday’s wrong drops were her scanner. She’s apologising to Murat.'
        : 'Ece is back. She asks if she can shadow Dilan on the board after her shift.',
    pull: {
      to: 'let',
      line: 'It blew over. Leave it.',
      borrow: 'You said look after yourself first. Leave it.',
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
              done: '“It was my routing, not your scanner.” Ece stared, then laughed. “I thought I was going mad.”',
            },
            {
              id: 'let',
              ink: 'Let it go.',
              label: 'let it go',
              action: 'quiet',
              duration: 3,
              advertises: { safety: 0.15 },
              gives: {},
              tags: T,
              norms: [{ normId: 'lying', relation: 'violates' }],
              placeId: 'depot',
              done: 'She let it go. Ece apologised to Murat twice.',
            },
          ]
        : [
            {
              id: 'yes',
              ink: 'Say yes, after six.',
              label: 'say yes to Ece',
              action: 'help',
              duration: 5,
              advertises: { meaning: 0.1 },
              gives: { meaning: 0.25, belonging: 0.15 },
              placeId: 'depot',
              done: '“After six, then.” Ece did a small fist pump she thought nobody saw.',
            },
            {
              id: 'let',
              ink: 'Say next week.',
              label: 'say next week',
              action: 'decline',
              duration: 3,
              advertises: { rest: 0.1 },
              gives: { autonomy: 0.1 },
              placeId: 'depot',
              done: '“Next week?” Ece said of course, of course.',
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
    scene: 'Lunch. Ece is doing an impression of Murat on the phone to his mother. It is very good.',
    pull: {
      to: 'laugh',
      line: 'Laugh. Turnabout’s fair.',
      borrow: 'You said be one of them. Laugh.',
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
        done: 'Loading dock. The pigeon brought a friend.',
      },
      {
        id: 'defend',
        ink: '“He covered your route on Monday.”',
        label: 'stick up for Murat',
        action: 'defend',
        duration: 25,
        advertises: { esteem: 0.05, ...lunchFood },
        gives: { esteem: 0.1, meaning: 0.15, ...lunchFood },
        norms: [{ normId: 'backbiting', relation: 'fulfills' }],
        placeId: 'canteen',
        done: '“He covered your route on Monday.” Ece went pink and did a kinder Murat.',
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
      'Six o’clock, nearly. Ece is waiting by the board with two teas and a notebook. She has drawn columns.',
    pull: {
      to: 'go',
      line: 'You said after six. It’s nearly six. Technically you’re free.',
      borrow: 'You said look after yourself. Go home.',
    },
    options: [
      {
        id: 'stay',
        ink: 'Stay. Show her the board.',
        label: 'show Ece the board',
        action: 'shadow',
        duration: 40,
        effort: 0.2,
        advertises: { belonging: 0.15, meaning: 0.15 },
        gives: { belonging: 0.3, meaning: 0.35, competence: 0.15 },
        norms: [{ normId: 'keep-promise', relation: 'fulfills' }],
        placeId: 'depot',
        done: 'Forty minutes, street by street. Ece’s columns were better than the board’s. Dilan caught the late bus.',
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
    scene: 'Home. The shelf. The screws have been in their little bag since March.',
    pull: { to: 'watch', line: 'Not tonight. You’ll only do it wrong tired.' },
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
            ? 'She put the back on backwards, tired, and took it off again. Two sides, at least.'
            : 'Two sides and the back. One screw left over, which is normal, apparently.',
      },
      {
        id: 'watch',
        ink: 'Put something on.',
        label: 'put something on',
        action: 'watch',
        duration: 60,
        advertises: { leisure: 0.3, rest: 0.2 },
        gives: { leisure: 0.2, rest: 0.15 },
        placeId: 'home',
        done: 'Two episodes of a show about people renovating a farmhouse.',
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
        done: 'Aylin: “Only if there’s cake.” There was still cake.',
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
  alarm(5, (c) => (c.tired ? '06:40, Friday. Nearly. Nearly.' : '06:40, Friday.')),
  {
    id: 'gym-5',
    day: 5,
    at: at(7, 15),
    place: 'phone',
    scene: 'An email: “We miss you! Your plan renews Friday.” It is Friday.',
    pull: {
      to: 'keep',
      line: 'Keep it. You’ll go. Next week, properly.',
      borrow: 'You said be kind to yourself. Keep it.',
    },
    options: [
      {
        id: 'cancel',
        ink: 'Cancel it.',
        label: 'cancel the gym',
        action: 'cancel',
        duration: 5,
        advertises: { esteem: -0.05 },
        gives: { autonomy: 0.25, esteem: 0.1 },
        placeId: 'phone',
        done: 'Three screens of “Are you sure?”. She was sure.',
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
        done: 'She archived the email. The plan renewed at 09:00.',
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
    scene: 'Murat, to the room: “Bowling tonight. Whole floor. Dilan, you’re coming.”',
    pull: { to: 'bowl', line: 'Go. Be someone who goes to things.' },
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
        done: '“Go on then.” Ece cheered. Murat said lane six was his.',
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
        done: '“Busy.” Murat said she was always busy, and meant it kindly.',
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
    scene: 'Lane six. Ece bowls like she drives. Murat keeps score in pen. Mum’s number, in her pocket.',
    pull: {
      to: 'stay',
      line: 'Stay for another game. Call her from bed.',
      borrow: 'You said have fun for once. Stay.',
    },
    options: [
      {
        ...callMum,
        ink: 'Call Mum from the car park.',
        placeId: 'phone',
        done: 'The car park, under a buzzing light. Mum wanted to know who won.',
      },
      {
        id: 'stay',
        ink: 'Another game.',
        label: 'stay for another game',
        action: 'bowl',
        duration: 60,
        effort: 0.2,
        advertises: { belonging: 0.25, leisure: 0.2 },
        gives: { belonging: 0.3, leisure: 0.25 },
        tags: T,
        norms: [{ normId: 'kindness-to-parents', relation: 'violates' }],
        placeId: 'bowling',
        done: 'Another game. She got a strike and Ece screamed.',
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
    scene: 'The gym bag by the door. She trips on it, as planned.',
    pull: { to: 'skip', line: 'You’re spent. The bag will still be there tomorrow.' },
    options: [
      {
        id: 'gym',
        ink: 'Go. Twenty minutes counts.',
        label: 'go to the gym',
        action: 'gym',
        duration: 50,
        effort: 0.55,
        advertises: { competence: 0.1, esteem: 0.1 },
        gives: (c) => (c.tired ? { competence: -0.15, esteem: -0.1 } : { competence: 0.25, esteem: 0.2 }),
        placeId: 'gym',
        done: 'Twenty minutes on the rowing machine. The receptionist said “welcome back” like she meant it.',
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
        done: 'She sat on the sofa with the bag at her feet like a dog that wanted a walk.',
      },
    ],
  },
  {
    id: 'shelf-5',
    day: 5,
    at: at(20, 30),
    place: 'home',
    when: (c) => !c.flags.bowling && (c.flags.shelf ?? 0) >= 1,
    scene: 'The shelf: two sides and a back. The rest of it looks at her.',
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
        ink: 'Saturday.',
        label: 'leave it till Saturday',
        action: 'watch',
        duration: 50,
        advertises: { leisure: 0.3, rest: 0.2 },
        gives: { leisure: 0.2, rest: 0.15 },
        placeId: 'home',
        done: 'She left it till Saturday. The screws were patient.',
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
    scene: (c) => `Saturday, ten o’clock. She records a voice note for Mum, and listens back. “${c.note}”`,
    pull: { to: 'delete', line: 'Delete it. You sound mad.' },
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

export const MOMENTS: Moment[] = [...monday, ...tuesday, ...wednesday, ...thursday, ...friday, ...saturday];
export const LAST_DAY = 6;
export const momentById = (id: string): Moment => {
  const m = MOMENTS.find((x) => x.id === id);
  if (!m) throw new Error(`no moment ${id}`);
  return m;
};
export const momentsOf = (day: number): Moment[] => MOMENTS.filter((m) => m.day === day);
