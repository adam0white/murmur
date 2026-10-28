/** Authored third-week scenes independent of the simulation runtime. */
import type { Ctx, Moment, Opt } from './types.ts';

const option = (id: string, ink: string, duration: number): Opt => ({
  id,
  ink,
  label: ink.replace(/[.!]$/, ''),
  action: `outcome-${id}`,
  duration,
  effort: 0.15,
  advertises: { autonomy: 0.2, meaning: 0.25 },
  gives: { meaning: 0.15 },
  done: 'She left the matter there.',
});
const leave = option('leave', 'Keep your own time.', 5);
function scene(
  id: string,
  day: number,
  at: number,
  place: string,
  text: string | ((c: Ctx) => string),
  options: Moment['options'],
): Moment {
  return {
    id,
    day,
    at,
    place,
    scene: text,
    pull: { to: 'leave', line: 'You have work and an evening of your own.' },
    options,
  };
}
export const OUTCOME_MOMENTS: Moment[] = [
  scene(
    'old-record-15',
    15,
    16 * 60,
    'depot',
    'An old delivery slip is in Dilan’s folder. It is not the scanner mistake or the later duplicate collection. Ece has a logistics class. Dilan can ask whether she has time to discuss it; her own board still needs finishing.',
    [option('discuss', 'Ask Ece to discuss the old delivery slip.', 35), leave],
  ),
  scene(
    'old-answer-15',
    15,
    17 * 60,
    'depot',
    (c) =>
      c.flags.outcomes?.grievance === 'disclosed'
        ? 'Dilan has named the delivery she covered and the thanks she expected. Ece says she thought the matter was settled. She never promised a favour in return. Dilan’s board is still unfinished.'
        : 'They have not discussed the old slip together. Dilan can finish her board without turning her expectation into Ece’s promise.',
    (c) =>
      c.flags.outcomes?.grievance === 'disclosed'
        ? [
            option('boundary', 'Ask for explicit agreements next time.', 25),
            option('insist', 'Insist that Ece still owes you.', 15),
            leave,
          ]
        : [leave],
  ),
  scene(
    'dance-invite-16',
    16,
    12 * 60 + 40,
    'yard',
    'Aylin has finished her school lunch shift. Dilan can ask about an evening of Aylin’s own. An extra paid delivery route is available tonight.',
    [option('invite', 'Ask Aylin about her own evening.', 15), leave],
  ),
  scene(
    'dance-outing-16',
    16,
    17 * 60,
    'depot',
    (c) =>
      c.flags.outcomes?.dance === 'invited'
        ? 'Aylin invited Dilan to the casual dance night above the tyre shop. “You needn’t dance. I needn’t host you. Keep it out of the family chat.” Travel and the evening take two hours. The paid route takes the same time.'
        : 'Aylin has not invited Dilan to her private evening. There is paid work available; Dilan can also go home.',
    (c) => [
      ...(c.flags.outcomes?.dance === 'invited'
        ? [option('attend', 'Travel to the dance night on those terms.', 120)]
        : []),
      option('paid', 'Take the paid delivery route.', 120),
      leave,
    ],
  ),
  scene(
    'map-check-17',
    17,
    16 * 60,
    'depot',
    'Ece has a folded map in her bag. Dilan can ask about it. Checking public opening signs together would use an hour she could spend finishing deliveries. Ece also has coursework.',
    [option('check', 'Ask Ece to check her resting places together.', 60), leave],
  ),
  scene(
    'map-permission-18',
    18,
    12 * 60 + 40,
    'depot',
    (c) =>
      c.flags.outcomes?.map === 'checked'
        ? 'Their sheet now records the public garden’s posted hours, dawn to dusk, checked yesterday. Private courtyards are crossed out. Ece has not agreed to publish it. Murat must separately agree to moving the existing depot bench.'
        : 'No checked local sheet is ready. A biography or an old copy does not supply current hours or permission.',
    (c) =>
      c.flags.outcomes?.map === 'checked'
        ? [option('permission', 'Ask Ece whether she wants a local copy posted.', 20), leave]
        : [leave],
  ),
  scene(
    'map-place-18',
    18,
    16 * 60,
    'depot',
    (c) =>
      c.flags.outcomes?.publication === 'permitted'
        ? 'Ece agreed to one local worker-board copy with private places excluded. Moving the depot’s existing loose bench into the shaded break area needs Murat’s assent and a clear doorway. This costs the end of Dilan’s shift.'
        : 'Ece has not permitted publication. Her map stays private. Nothing has been posted or moved.',
    (c) =>
      c.flags.outcomes?.publication === 'permitted'
        ? [option('place', 'Post the checked copy and ask to move the depot bench.', 50), leave]
        : [leave],
  ),
  scene(
    'allocation-open-19',
    19,
    14 * 60,
    'depot',
    'Dilan can ask Murat to open the original allocation file. The review costs time on her own route. No private admission changes the workers’ record.',
    [option('review', 'Ask Murat to review the original allocation.', 30), leave],
  ),
  scene(
    'allocation-correct-19',
    19,
    16 * 60,
    'depot',
    (c) =>
      c.flags.outcomes?.allocation === 'disclosed'
        ? 'Murat admitted assigning Dilan the difficult stops after she challenged a target, then recording the delays as her fault. Ece is here. He can correct that account in front of the workers concerned, or keep his admission private.'
        : 'The allocation has not been reviewed together. There is no disclosed account to publish.',
    (c) =>
      c.flags.outcomes?.allocation === 'disclosed'
        ? [option('correct', 'Ask Murat to correct the worker-visible record.', 35), leave]
        : [leave],
  ),
  scene(
    'route-trial-20',
    20,
    9 * 60,
    'depot',
    (c) =>
      c.flags.outcomes?.correction === 'posted'
        ? 'The corrected sheet names Murat’s assignment decision. Dilan can spend Saturday trying a smaller route with the steep stops split between two rounds. Murat must join the check. It replaces Dilan’s free morning; it is not a permanent rota.'
        : 'No public correction is recorded. Dilan has not agreed to a route trial this morning.',
    (c) =>
      c.flags.outcomes?.correction === 'posted'
        ? [option('trial', 'Try the smaller route and compare the return.', 150), leave]
        : [leave],
  ),
];
