/** Authored cast visit, independent of the simulation runtime. */
import type { Moment } from './types.ts';

export const CAST_MOMENTS: Moment[] = [
  {
    id: 'shelf-visit-6',
    day: 6,
    at: 8 * 60 + 15,
    window: 20,
    place: 'home',
    when: (c) => c.flags.shelfVisitAgreed === true,
    scene:
      'It is Saturday. Dilan has cleared the boxes from the uneven shelf support. She can ask Aylin to join the repair they discussed, or leave it for another day. Aylin still has her own work.',
    pull: { to: 'leave-shelf', line: 'Have cake. Leave the shelf for another day.' },
    options: [
      {
        id: 'repair-with-aylin',
        ink: 'Ask Aylin to join you. Work on the uneven support.',
        label: 'repair the shelf with Aylin',
        action: 'shelf',
        duration: 60,
        alsoDoes: { action: 'shelf', duration: 30 },
        effort: 0.25,
        advertises: { competence: 0.3, belonging: 0.25 },
        gives: { competence: 0.3, belonging: 0.25 },
        done: 'Dilan stayed while Aylin held the support. They repaired it and finished the shelf. The crooked edge remained visible inside; they put a book on it together.',
      },
      {
        id: 'leave-shelf',
        ink: 'Leave the repair for now. Tell Aylin it will wait.',
        label: 'leave the repair for now',
        action: 'chat',
        duration: 20,
        advertises: { belonging: 0.2 },
        gives: { belonging: 0.2 },
        done: 'Dilan left the shelf unfinished and said the repair would wait.',
      },
    ],
    after: (s, chosen) => {
      if (chosen === 'repair-with-aylin') s.flags.shelf = 2;
    },
  },
];
