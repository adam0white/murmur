/** Optional0.8 finite host scenes. HF chooses participation against work/rest and lives each act.
 * Records only completed conversations, attendance, fictional local posting/bench movement and a route trial.
 * No relationship score, forgiveness, external reply, official survey, new person or transferable achievement.
 */
import type { CastRole } from './canonical-cast.ts';
import { dayStart } from './dilan-content.ts';
import { isOutcomesEdition } from './edition.ts';
import { playEncounter } from './hf4-encounter.ts';
import type { GameState, Moment, Opt } from './types.ts';

export const OUTCOMES_VERSION = '0.9.2';
const flags = (s: GameState) => (s.flags.outcomes ??= {});

import { OUTCOME_MOMENTS } from './outcome-moments.ts';

export { OUTCOME_MOMENTS };

/** A genuine competing HF choice, without a voice ordering another person to assent. */
const participates = playEncounter;
export const OUTCOME_COMPANION_ACTIONS = { bench: 'outcome-place', correction: 'outcome-correct' } as const;

/** Called only after Dilan completes an outcome act. Refusal never awards the proposed physical result. */
export function finishOutcome(s: GameState, m: Moment, o: Opt): string | undefined {
  if (!isOutcomesEdition(s.version) || !OUTCOME_MOMENTS.some((x) => x.id === m.id)) return;
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
    return `${role === 'aylin' ? 'Aylin' : role === 'murat' ? 'Murat' : 'Ece'} gave no completed reply in this chapter. Dilan spent the time on her request. The proposed shared act did not happen.`;
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
      f.checkedAt = s.minute;
      f.publicHours = 'dawn to dusk';
      f.privatePlaces = 'excluded';
      return 'Ece chose to unfold her informal resting map. They walked to the public garden and copied its posted dawn-to-dusk hours, dated today. They crossed private courtyards off the local draft rather than assume permission. It was not an accessibility survey. Dilan’s deliveries and Ece’s coursework waited.';
    case 'map-permission-18':
      f.publication = 'permitted';
      return 'Ece read the checked draft and agreed to one worker-board copy without the private courtyards. “Keep it local. Don’t call it an official survey.” This permission did not move a bench or post a copy.';
    case 'map-place-18': {
      if (!participates(s, 'murat', OUTCOME_COMPANION_ACTIONS.bench, o.duration, m.place))
        return 'Ece joined Dilan, but Murat kept the bench where it was. They did not post or move anything as a completed joint plan.';
      f.publication = 'posted';
      f.publishedAt = s.minute;
      f.bench = 'shaded-break-area';
      return 'Ece and Dilan pinned the dated checked-hours sheet on the worker board. Murat agreed to moving the existing depot bench. They moved it into the shaded break area and left the doorway clear. Ece liked the shade; Dilan wanted a seat with a back. They kept that limit on the sheet. No private courtyard or official accessibility claim was included.';
    }
    case 'allocation-open-19':
      f.allocation = 'disclosed';
      return 'Murat opened the old allocation file. He named the difficult stops he had given Dilan after she challenged a target, and the delays he had then recorded as her fault. “I chose those stops.” The admission was still private.';
    case 'allocation-correct-19': {
      if (!participates(s, 'ece', OUTCOME_COMPANION_ACTIONS.correction, o.duration, m.place))
        return 'Murat was ready to speak, but Ece kept her own work. The worker-visible correction remained undone.';
      f.correction = 'posted';
      f.correctedAt = s.minute;
      f.allocationRecord = 'old delays retained; Murat assigned difficult stops after target challenge';
      return 'With Dilan and Ece present, Murat added a dated correction beside the old allocation: he assigned the difficult stops, so the delays were not evidence of Dilan’s discipline alone. He read it aloud and left both versions visible. Ece asked why he had omitted that before. Nobody offered him a promotion or promised to trust him.';
    }
    case 'route-trial-20':
      f.trial = 'completed';
      f.trialAt = s.minute;
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
