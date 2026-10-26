/** Optional0.8 finite host scenes. HF chooses participation against work/rest and lives each act.
 * Records only completed conversations, attendance, fictional local posting/bench movement and a route trial.
 * No relationship score, forgiveness, external reply, official survey, new person or transferable achievement.
 */
import { begin, decide, finish, tick } from '@adam0white/human-framework';
import { advanceCast, type CastRole } from './canonical-cast.ts';
import { dayStart } from './dilan.ts';
import { LISTENING_TEMPERATURE } from './listening.ts';
import type { Ctx, GameState, Moment, Opt } from './types.ts';

export const OUTCOMES_VERSION = '0.8.0';
const flags = (s: GameState) => (s.flags.outcomes ??= {});
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

/** A genuine competing HF choice, without a voice ordering another person to assent. */
function participates(
  s: GameState,
  role: Exclude<CastRole, 'dilan'>,
  action: string,
  duration: number,
  place: string,
): boolean {
  const start = s.person.now - duration;
  advanceCast(s, start);
  const p = s.cast?.people[role];
  if (!p || !p.body.alive || p.activity || p.now > start) return false;
  const offers = [
    {
      id: `${action}-join`,
      label: action,
      action,
      duration,
      effort: 0.12,
      placeId: place,
      advertises: { meaning: 0.4, belonging: 0.35, autonomy: 0.2 },
    },
    {
      id: `${action}-own`,
      label: 'keep own work and rest',
      action: 'own-time',
      duration,
      effort: 0.05,
      placeId: 'home',
      advertises: { rest: 0.35, competence: 0.3, autonomy: 0.3 },
    },
  ];
  // Use the host's existing published HF uncertainty setting for these new voluntary choices only.
  const temperature = p.will.temperature;
  p.will.temperature = LISTENING_TEMPERATURE;
  const rec = decide(p, offers);
  p.will.temperature = temperature;
  const chosen = offers.find((o) => o.id === rec.chosenAffordanceId);
  if (!chosen || !begin(p, chosen, rec)) return false;
  tick(p, p.activity!.endsAt);
  finish(p, {
    affordanceId: chosen.id,
    action: chosen.action,
    status: 'completed',
    at: p.now,
    needs: chosen.advertises,
  });
  s.cast!.encounters.push({ person: role, at: p.now, action: chosen.action });
  return chosen === offers[0];
}

/** Called only after Dilan completes an outcome act. Refusal never awards the proposed physical result. */
export function finishOutcome(s: GameState, m: Moment, o: Opt): string | undefined {
  if (s.version !== OUTCOMES_VERSION || !OUTCOME_MOMENTS.some((x) => x.id === m.id)) return;
  const f = flags(s);
  if (o.id === 'leave') {
    f[m.id] = 'left';
    return 'Dilan kept her own time. Nothing else was agreed or completed.';
  }
  if (o.id === 'paid') {
    f.dance = 'paid-work';
    return 'Dilan completed the paid route. She did not attend the dance night.';
  }
  const role = m.id.startsWith('dance')
    ? 'aylin'
    : m.id.startsWith('allocation') || m.id.startsWith('route')
      ? 'murat'
      : 'ece';
  const joined = participates(s, role, o.action, o.duration, m.place);
  f[m.id] = joined ? o.id : 'declined';
  if (!joined)
    return `${role === 'aylin' ? 'Aylin' : role === 'murat' ? 'Murat' : 'Ece'} kept their own work and rest. Dilan spent the time on her request. The proposed shared act did not happen.`;
  switch (m.id) {
    case 'old-record-15':
      f.grievance = 'disclosed';
      return 'Dilan showed Ece the old slip. “I covered your missed delivery and let Murat think the delay was mine. I wanted you to thank me.” Ece said, “I thought we had settled it. You never asked me for anything.” Dilan still had her own board to finish.';
    case 'old-answer-15':
      f.grievance = o.id === 'boundary' ? 'boundary-agreed' : 'disputed';
      return o.id === 'boundary'
        ? 'They agreed to ask plainly before covering another delivery. “I’m not promising to repay something I never agreed to,” Ece said. Dilan wrote that down. The old resentment was not declared resolved; the current board still cost her time.'
        : 'Dilan insisted that Ece owed her. Ece rejected that account. They left the old grievance disputed; no apology or forgiveness was recorded.';
    case 'dance-invite-16':
      f.dance = 'invited';
      return 'Aylin volunteered the dance night above the tyre shop. “You can come, but you needn’t dance and I needn’t host you. No family announcement.” Dilan had an invitation, not an attended evening.';
    case 'dance-outing-16':
      f.dance = 'attended';
      return 'Dilan declined the paid route, took the bus and climbed to the hall. Aylin chose to join her there. Dilan sat beside the music while Aylin counted too hard, lost the rhythm and laughed with her usual elderly class partner. Nobody asked Dilan to dance. Aylin did not arrange her evening for her. They left without posting it to the family chat.';
    case 'map-check-17':
      f.map = 'checked';
      f.checkedAt = s.person.now;
      f.publicHours = 'dawn to dusk';
      f.privatePlaces = 'excluded';
      return 'Ece chose to unfold her informal resting map. They walked to the public garden and copied its posted dawn-to-dusk hours, dated today. They crossed private courtyards off the local draft rather than assume permission. It was not an accessibility survey. Dilan’s deliveries and Ece’s coursework waited.';
    case 'map-permission-18':
      f.publication = 'permitted';
      return 'Ece read the checked draft and agreed to one worker-board copy without the private courtyards. “Keep it local. Don’t call it an official survey.” This permission did not move a bench or post a copy.';
    case 'map-place-18': {
      if (!participates(s, 'murat', 'move-depot-bench', o.duration, m.place))
        return 'Ece joined Dilan, but Murat kept the bench where it was. They did not post or move anything as a completed joint plan.';
      f.publication = 'posted';
      f.publishedAt = s.person.now;
      f.bench = 'shaded-break-area';
      return 'Ece and Dilan pinned the dated checked-hours sheet on the worker board. Murat agreed to moving the existing depot bench. They moved it into the shaded break area and left the doorway clear. Ece liked the shade; Dilan wanted a seat with a back. They kept that limit on the sheet. No private courtyard or official accessibility claim was included.';
    }
    case 'allocation-open-19':
      f.allocation = 'disclosed';
      return 'Murat opened the old allocation file. He named the difficult stops he had given Dilan after she challenged a target, and the delays he had then recorded as her fault. “I chose those stops.” The admission was still private.';
    case 'allocation-correct-19': {
      if (!participates(s, 'ece', 'hear-allocation-correction', o.duration, m.place))
        return 'Murat was ready to speak, but Ece kept her own work. The worker-visible correction remained undone.';
      f.correction = 'posted';
      f.correctedAt = s.person.now;
      f.allocationRecord = 'old delays retained; Murat assigned difficult stops after target challenge';
      return 'With Dilan and Ece present, Murat added a dated correction beside the old allocation: he assigned the difficult stops, so the delays were not evidence of Dilan’s discipline alone. He read it aloud and left both versions visible. Ece asked why he had omitted that before. Nobody offered him a promotion or promised to trust him.';
    }
    case 'route-trial-20':
      f.trial = 'completed';
      f.trialAt = s.person.now;
      f.trialPlannedReturn = dayStart(20) + 12 * 60;
      f.trialSecondRound = 'remaining work recorded';
      f.trialAllocation = 'steep stops split between two rounds';
      return 'Dilan completed the smaller round. Murat joined the return check. They split the steep stops between two rounds instead of leaving all of them with Dilan. She returned before the trial sheet’s planned finish, with time to unload. They wrote down that result and the extra second-round work. One Saturday did not prove a permanent fair rota; the corrected record stayed visible.';
  }
}
export function outcomeThreads(s: GameState): string[] {
  const f = s.flags.outcomes ?? {};
  return [
    f.grievance === 'boundary-agreed'
      ? 'Ece and Dilan agreed to explicit requests next time. No forgiveness was assumed.'
      : 'The old covered-delivery grievance remains open.',
    f.dance === 'attended'
      ? 'Dilan attended Aylin’s dance night on her terms.'
      : 'Dilan did not attend Aylin’s dance night.',
    f.publication === 'posted'
      ? 'The dated local sheet is posted; the depot bench is in shade.'
      : 'No checked sheet or bench placement was completed.',
    f.trial === 'completed'
      ? 'The corrected allocation and the bounded route-trial result are recorded.'
      : f.correction === 'posted'
        ? 'The correction is public. The route trial remains undone.'
        : 'The public correction and route trial remain undone.',
  ];
}
