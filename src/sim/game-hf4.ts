import { canonicalPersona } from '@adam0white/lab-client';
/**
 * The Two Voices: the day host. Pure and deterministic: state is plain JSON, and every player input is stamped
 * with the sim minute it applies at, so replaying the same seed and input log rebuilds the same state (`replay`).
 *
 * Covers: two authored weeks, the offstage weekend between them, edition-preserving replay, and one HF decision
 * per moment with two voices (`you` and `pull`, each with its own trust), her answer in HF's words, prompts and turning away (HF promptings), the evening review (HF
 * review: `ruminating` by default, `accounting` on nights she writes the day down), the hours between moments lived
 * through HF (commute, work, meals, sleep), and learned mornings without an alarm card.
 * Optional0.7 adds a third week; existing0.6 and earlier editions retain exact rules. Does not cover money or spatial movement.
 */
import {
  advanceCast,
  CAST_VERSION,
  castMoment,
  castOptions,
  castScene,
  finishCastEncounter,
  freshCast,
} from './canonical-cast.ts';
import type { CastChapter } from './cast-chapter.ts';
import { releaseCastSource } from './cast-source.ts';
import { DAY0, dayStart, LABEL, PULL, promiseReview, REVIEW_AT, WAKE, YOU } from './dilan-content.ts';
import { isCanonicalEdition, PROMISE_EDITION } from './edition.ts';
import { changeReviewStyle, learnResponse, requestPromise, requestReview } from './hf4-agenda.ts';
import { saturdayRoutineEndsAt } from './hf4-companions.ts';
import { freshMurmurHf4, type MurmurHf4, playHf4Moment, playHf4Routine } from './hf4-game.ts';
import { advanceHost } from './hf4-host.ts';
import { previewChoice } from './hf4-preview.ts';
import { readDilan, readDilanEvents } from './hf4-read.ts';
import { checkpointMurmur, restoreMurmur } from './hf4-session.ts';
import { settleMurmur } from './hf4-world.ts';
import { listens } from './listening-editions.ts';
import { LAST_DAY, momentById, momentsOf, WEEK_TWO_LAST_DAY } from './moments.ts';
import { releaseOneCastDeparture } from './one-cast.ts';
import { finishOutcome, OUTCOMES_VERSION, outcomeThreads } from './outcomes.ts';
import * as weekTwo from './week2.ts';
import { thirdWeekHerLine, thirdWeekNote, thirdWeekThreads } from './week3.ts';

export { listens } from './listening-editions.ts';

import type {
  Answer,
  Ctx,
  DayStats,
  Final,
  GameState,
  GameStateSnapshot,
  Input,
  Moment,
  NewInput,
  Opt,
  Page,
  Verdict,
} from './types.ts';

export const GAME_VERSION = PROMISE_EDITION;
export const NEXT_VERSION = '0.9.1';
/** Pinned0.7 continuous scale: one day of disuse retains0.8. Old editions keep their nightly rule. */
export const PRACTICE_HALF_LIFE_DAYS = 3.1062837195053903;
export const LEGACY_VERSION = '0.2.1';
export const isEdition = (version: string) => listens({ version }) || version === LEGACY_VERSION;
export const DAY_NAMES = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
/** Edition 0.4.0 adds a second week after Saturday's last page. */
export const WEEK_TWO_EDITION = '0.4.0';
const hasWeekTwo = (s: GameState) =>
  s.version === '0.4.2' ||
  s.version === '0.5.0' ||
  s.version === CAST_VERSION ||
  s.version === WEEK_TWO_EDITION ||
  s.version === '0.4.1' ||
  s.version === GAME_VERSION ||
  s.version === NEXT_VERSION ||
  s.version === OUTCOMES_VERSION;
export const weekOf = (day: number) => Math.floor((day - 1) / 7) + 1;
export const weekdayOf = (day: number) => ((day - 1) % 7) + 1;
const WINDOW = 5;
const SAY = 0.6;
const INSIST = 0.85;
const PULL_STRENGTH = 0.7;
/** A tired Dilan hears the pull louder. */
const TIRED_PULL = 0.2;
/** How much louder the pull is in the second week. */
const WEEK_TWO_PULL = 0.1;
/** The pull borrows your ink only once she trusts you this much. */
const BORROW_FROM = 0.55;
const PSYCH = ['safety', 'belonging', 'esteem', 'autonomy', 'competence', 'leisure', 'meaning'];
const { FEET_ALONE_FROM, upAloneLine } = weekTwo;

const minuteOfDay = (m: number) => (((m - DAY0) % 1440) + 1440) % 1440;
export const clock = (m: number) => {
  const d = minuteOfDay(m);
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};
const text = (x: string | ((c: Ctx) => string), c: Ctx) => (typeof x === 'function' ? x(c) : x);

function blankStats(hf: MurmurHf4): DayStats {
  const voices = readDilan(hf.run).relationships.voices;
  const trust = (id: string) => voices.find((voice) => voice.voiceId === id)?.trust ?? 0.5;
  return {
    said: 0,
    insisted: 0,
    heard: 0,
    refused: 0,
    silent: 0,
    pullWon: 0,
    turnedAlone: [],
    borrowedHeard: 0,
    reinforced: [],
    borrowable: 0,
    borrowed: 0,
    learned: [],
    trustYouAtStart: trust(YOU),
    trustPullAtStart: trust(PULL),
  };
}

export function newGame(
  seed: number,
  version = GAME_VERSION,
  chapter?: CastChapter,
  plainEnglish = true,
): GameState {
  if (!isEdition(version)) throw new Error(`Unknown Murmur edition: ${version}`);
  if (chapter && (chapter.seed !== seed || chapter.mapping !== 'murmur-portable/2'))
    throw new Error('Invalid pinned cast chapter.');
  const hf = freshMurmurHf4(seed, undefined, chapter?.portable);
  const s: GameState = {
    hf,
    cast: chapter ? structuredClone(chapter.initial) : freshCast(seed),
    ...(chapter ? { castChapter: structuredClone(chapter) } : {}),
    plainEnglish,
    version,
    seed,
    day: 1,
    phase: 'day',
    minute: dayStart(1) + WAKE - 1,
    inputs: [],
    applied: 0,
    queue: momentsOf(1, version).map((m) => m.id),
    card: null,
    answer: null,
    log: [],
    flags: {},
    stats: blankStats(hf),
    pages: [],
    phrases: [],
    chosen: {},
    hinted: [],
    final: null,
  };
  return s;
}

// ---------- reading the state ----------

export function ctxOf(s: GameState): Ctx {
  const person = readDilan(s.hf.run);
  const missedMum = s.pages.filter(
    (pg) => weekOf(pg.day) === weekOf(s.day) && pg.missed.includes(LABEL.mum),
  ).length;
  const bedLate = s.flags.bedAt !== undefined && minuteOfDay(s.flags.bedAt) > 23 * 60 + 15;
  const bedSmall = s.flags.bedAt !== undefined && minuteOfDay(s.flags.bedAt) < 4 * 60;
  return {
    version: s.version,
    day: s.day,
    flags: s.flags,
    missedMum,
    tired: bedLate || bedSmall || person.body.state.sleepPressure > 0.55,
    chosen: s.chosen,
    note: voiceNote(s),
    week: weekOf(s.day),
    weekday: weekdayOf(s.day),
    phrases: s.phrases
      .map((ph) => ({
        id: ph.id,
        text: ph.text,
        practice: person.promptings.responses.find((r) => r.id === ph.id)?.effectivePractice ?? 0,
      }))
      .sort((a, b) => b.practice - a.practice),
    ...(s.past?.[0] ? { weekOne: s.past[0] } : {}),
  };
}

/** The card's moment, if one is open. */
export const openMoment = (s: GameState): Moment | null =>
  s.card ? castMoment(s, momentById(s.card.moment, s.version)) : null;

export function optionsOf(s: GameState, m: Moment): Opt[] {
  const c = ctxOf(s);
  return castOptions(s, m, typeof m.options === 'function' ? m.options(c) : m.options);
}

const INSIST_FROM = 0.45;
export const insistCarries = (s: GameState) => trustOf(s, YOU) >= INSIST_FROM;

/** Preview and submission use the same trust-dependent advice strength. */
function suggestionFor(s: GameState, said: { option: string; insist: boolean }) {
  const carried = !said.insist || insistCarries(s);
  return {
    option: said.option,
    insist: said.insist && carried,
    ...(!carried ? { strength: SAY / 2 } : {}),
  };
}

/** Thursday on, the pull borrows your ink where she trusts you more than it. */
/**
 * Thursday on, the pull sometimes borrows your ink: once a day at most, where she trusts you more than it. Which
 * eligible card it picks (the first, second or third of the day) is fixed by the seed, so it is not always the alarm.
 * Called once per card open; it counts.
 */
function borrows(s: GameState, m: Moment): boolean {
  const you = trustOf(s, YOU);
  if (weekdayOf(s.day) < 4 || !m.pull.borrow || you <= BORROW_FROM || you <= trustOf(s, PULL)) return false;
  const st = s.stats;
  const pick = ((s.seed * 31 + s.day * 7) >>> 0) % 3;
  const n = st.borrowable;
  st.borrowable += 1;
  if (st.borrowed > 0 || n < pick) return false;
  st.borrowed += 1;
  return true;
}

export type Lean = 'yes' | 'if pushed' | 'later' | 'rather not' | 'no' | 'unknown';
const leanOf = (v: Verdict): Lean =>
  v === 'assented'
    ? 'yes'
    : v === 'complied'
      ? 'if pushed'
      : v === 'deferred'
        ? 'later'
        : v === 'modified'
          ? 'rather not'
          : 'no';

export interface CardView {
  id: string;
  day: number;
  scene: string;
  pullLine: string;
  pullTo: string;
  borrowed: boolean;
  hint?: string;
  forecast?: string;
  recalled?: string;
  resolve?: { label: string; marks: number; line: string };
  closesAt: number;
  options: {
    id: string;
    ink: string;
    lean: Lean;
    pushed: Lean;
    isPull: boolean;
    mood?: string;
    likelihood?: number;
  }[];
}

const RESOLVE_FOR: Record<string, string> = {
  alarm: LABEL.alarm,
  bus: LABEL.mum,
  note: LABEL.mum,
  bowl: LABEL.mum,
  dinner: LABEL.aylin,
};
const marksOf = (strength: number) => (strength < 0.3 ? 1 : strength < 0.6 ? 2 : 3);

/** The open card as the player sees it. Pure: no state change, no randomness. */
export function cardView(s: GameState): CardView | null {
  const m = openMoment(s),
    card = s.card;
  if (!m || !card) return null;
  const c = ctxOf(s),
    opts = optionsOf(s, m),
    reading = readDilan(s.hf.run);
  const fulfills = Object.fromEntries(
    opts.map((option) => [
      option.id,
      reading.agenda.commitments
        .filter(
          (commitment) =>
            commitment.status === 'pending' &&
            commitment.until >= reading.at &&
            (commitment.actions.includes(option.action) ||
              (option.keeps ?? []).some(
                (label) => commitment.label === (LABEL[label as keyof typeof LABEL] ?? label),
              )),
        )
        .map((commitment) => commitment.id),
    ]),
  );
  const advances = Object.fromEntries(
    opts.map((option) => [
      option.id,
      reading.agenda.goals
        .filter(
          (goal) =>
            goal.status === 'active' && goal.advancedBy.some((entry) => entry.action === option.action),
        )
        .map((goal) => goal.id),
    ]),
  );
  const pull = {
    option: m.pull.to,
    strength: Math.min(
      1,
      (m.pull.strength ?? PULL_STRENGTH) +
        (c.tired ? TIRED_PULL : 0) +
        (weekOf(s.day) === 2 ? WEEK_TWO_PULL : 0),
    ),
    borrowed: card.borrowed,
  };
  const resultFor = (option: Opt, insist: boolean) =>
    previewChoice(s.hf, {
      cardId: m.id,
      at: s.minute * 60_000,
      place: m.place,
      options: opts,
      pull,
      said: suggestionFor(s, { option: option.id, insist }),
      fulfills,
      advances,
    });
  const view: CardView = {
    id: m.id,
    day: m.day,
    scene: castScene(s, m, text(m.scene, c)),
    pullLine: card.borrowed && m.pull.borrow ? m.pull.borrow : text(m.pull.line, c),
    pullTo: m.pull.to,
    borrowed: card.borrowed,
    closesAt: card.closesAt,
    options: opts.map((option) => {
      const tap = resultFor(option, false),
        held = resultFor(option, true);
      return {
        id: option.id,
        ink: text(option.ink, c),
        lean: tap ? leanOf(tap.verdict) : 'unknown',
        pushed: held ? leanOf(held.verdict) : 'unknown',
        isPull: option.id === m.pull.to,
        ...(!tap ? { mood: 'She has not formed a view yet.' } : {}),
      };
    }),
  };
  if (m.hint && !s.hinted.includes(m.hint)) view.hint = m.hint;
  const label = RESOLVE_FOR[m.id.split('-')[0] ?? ''];
  const resolve = label ? reading.review.resolves.find((item) => item.label === label) : undefined;
  if (resolve && label) view.resolve = { label, marks: marksOf(resolve.strength), line: resolveLine(label) };
  return view;
}

function resolveLine(label: string): string {
  if (label === LABEL.alarm) return 'I said I’d get up when the alarm rings.';
  if (label === LABEL.mum) return 'I said I’d call Mum for ten minutes.';
  return `I said I’d keep ${label}.`;
}

// ---------- inputs ----------

export function queueInput(s: GameState, input: NewInput): void {
  if (input.kind === 'cast-pause') releaseCastSource(restoreState(cloneState(s)), input.role);
  if (input.kind === 'one-cast-release') releaseOneCastDeparture(restoreState(cloneState(s)));
  s.inputs.push({ ...input, at: s.minute } as Input);
  applyPending(s);
}

function applyPending(s: GameState) {
  while (s.applied < s.inputs.length) {
    const inp = s.inputs[s.applied] as Input;
    if (inp.at > s.minute) break;
    s.applied += 1;
    apply(s, inp);
  }
}

function apply(s: GameState, inp: Input) {
  if (inp.kind === 'cast-pause') {
    releaseCastSource(s, inp.role);
  }
  if (inp.kind === 'one-cast-release') {
    s.oneCastDeparture = releaseOneCastDeparture(s);
    return;
  }
  if (inp.kind === 'say') {
    if (s.phase !== 'day' || !s.card) return;
    const m = castMoment(s, momentById(s.card.moment, s.version));
    if (!optionsOf(s, m).some((o) => o.id === inp.option)) return;
    resolve(s, { option: inp.option, insist: inp.insist === true });
    return;
  }
  if (inp.kind === 'quiet') {
    if (s.phase === 'day' && s.card) resolve(s, null);
    return;
  }
  if (inp.kind === 'next') {
    if (
      s.phase === 'end' &&
      ((s.day === LAST_DAY && hasWeekTwo(s)) ||
        (s.day === WEEK_TWO_LAST_DAY && (s.version === NEXT_VERSION || s.version === OUTCOMES_VERSION)))
    ) {
      startWeekTwo(s);
      return;
    }
    if (s.phase === 'evening') nextDay(s);
  }
}

// ---------- the minute ----------

/** Advance one sim minute. */
export function step(s: GameState): void {
  if (s.phase !== 'day') return;
  advanceCast(s, s.minute);
  applyPending(s);
  if (s.phase !== 'day') return;
  if (s.card) {
    if (s.minute >= s.card.closesAt) resolve(s, null);
  } else {
    const c = ctxOf(s);
    while (s.queue.length > 0) {
      const m = castMoment(s, momentById(s.queue[0] as string, s.version));
      if (m.when && !m.when(ctxOf(s))) {
        if (getsUpAlone(s, m)) {
          const at = dayStart(s.day) + (typeof m.at === 'function' ? m.at(ctxOf(s)) : m.at);
          if (s.minute < at) {
            s.minute += 1;
            return;
          }
          getUpAlone(s, m);
        }
        s.queue.shift();
        continue;
      }
      break;
    }
    const id = s.queue[0];
    if (id === undefined) {
      // Even an unauthored second-week day starts at wake time before it can finish.
      if (weekOf(s.day) === 2 && s.minute < dayStart(s.day) + WAKE) {
        s.minute += 1;
        return;
      }
      endDay(s);
      return;
    }
    const m = castMoment(s, momentById(id, s.version));
    const at = dayStart(s.day) + (typeof m.at === 'function' ? m.at(c) : m.at);
    if (s.minute >= at && s.minute >= hfMinute(s)) open(s, m);
  }
  s.minute += 1;
}

function open(s: GameState, m: Moment) {
  liveUntil(s, s.minute);
  s.card = {
    moment: m.id,
    openedAt: s.minute,
    closesAt: s.minute + (m.window ?? WINDOW),
    borrowed: borrows(s, m),
  };
  s.answer = null;
  // The journal keeps what was asked, so a card that closed while the player was away still reads.
  const c = ctxOf(s);
  const v = cardView(s);
  s.log.push({ at: s.minute, who: 'scene', text: castScene(s, m, text(m.scene, c)) });
  if (v) s.log.push({ at: s.minute, who: 'pull', text: v.pullLine });
  if (v?.recalled) {
    for (const t of s.thoughts ?? []) {
      if (
        t.surfacedAt === undefined &&
        t.at < s.minute &&
        optionsOf(s, m).some((a) => a.action === t.action) &&
        readDilan(s.hf.run).advice.some(
          (a) => a.sourceId === YOU && a.action === t.action && a.at === t.at * 60_000,
        )
      )
        t.surfacedAt = s.minute;
    }
  }
}

/** Old editions force a learned morning. New promises still go through an HF decision. */
function getsUpAlone(s: GameState, m: Moment): boolean {
  return (
    weekOf(s.day) === 2 &&
    s.version !== PROMISE_EDITION &&
    m.id.startsWith('alarm-') &&
    (ctxOf(s).phrases.find((ph) => ph.id === 'feet')?.practice ?? 0) >= FEET_ALONE_FROM
  );
}

function getUpAlone(s: GameState, m: Moment) {
  liveUntil(s, s.minute);
  const up = optionsOf(s, m).find((o) => o.action === 'get-up');
  if (!up) throw new Error(`Alarm ${m.id} has no get-up action.`);
  const due = readDilan(s.hf.run)
    .agenda.commitments.filter((item) => item.status === 'pending' && item.actions.includes(up.action))
    .map((item) => item.id);
  hostAct(
    s,
    {
      id: up.id,
      action: up.action,
      label: up.label,
      duration: up.duration,
      effort: up.effort ?? 0,
      advertises: up.advertises ?? {},
      placeId: up.placeId,
    },
    hfMinute(s),
    { competence: 0.15, autonomy: 0.1 },
    undefined,
    due,
  );
  s.flags.late = false;
  s.chosen[m.id] = up.id;
  s.stats.gotUpAlone = true;
  s.stats.turnedAlone.push(s.phrases.find((ph) => ph.id === 'feet')?.text ?? 'Put your feet on the floor');
  say(s, 'narrator', upAloneLine);
  m.after?.(s, up.id);
  // Do not mark the phrase reinforced: no player said it again today.
  // The ordinary HF action above keeps her alarm promise and practises the get-up habit.
}

/** Her reason when she turns your word down and HF gave her no words: tiredness, the easier way, or plain no. */
function reasonOf(c: Ctx, v: Verdict, pullWay: boolean): string {
  if (v === 'deferred')
    return c.tired ? 'I’ll do it later. I’m too tired now.' : 'I’ll do it later. I’m not ready now.';
  if (c.tired) return 'I’m too tired for that.';
  if (pullWay) return 'The other way is easier.';
  return 'No, I don’t want that one.';
}

function resolve(s: GameState, said: { option: string; insist: boolean } | null) {
  const card = s.card;
  if (!card) return;
  const m = momentById(card.moment, s.version);
  const c = ctxOf(s),
    opts = optionsOf(s, m),
    reading = readDilan(s.hf.run);
  const fulfills = Object.fromEntries(
    opts.map((option) => [
      option.id,
      reading.agenda.commitments
        .filter(
          (commitment) =>
            commitment.status === 'pending' &&
            commitment.until >= reading.at &&
            (commitment.actions.includes(option.action) ||
              (option.keeps ?? []).some(
                (label) => commitment.label === (LABEL[label as keyof typeof LABEL] ?? label),
              )),
        )
        .map((commitment) => commitment.id),
    ]),
  );
  const advances = Object.fromEntries(
    opts.map((option) => [
      option.id,
      reading.agenda.goals
        .filter(
          (goal) =>
            goal.status === 'active' && goal.advancedBy.some((entry) => entry.action === option.action),
        )
        .map((goal) => goal.id),
    ]),
  );
  const at = Math.max(s.minute * 60_000, reading.at + 1);
  const carried = !said?.insist || insistCarries(s);
  const result = playHf4Moment(s.hf, {
    cardId: m.id,
    at,
    place: m.place,
    options: opts,
    context: c,
    pull: {
      option: m.pull.to,
      strength: Math.min(
        1,
        (m.pull.strength ?? PULL_STRENGTH) +
          (c.tired ? TIRED_PULL : 0) +
          (weekOf(s.day) === 2 ? WEEK_TWO_PULL : 0),
      ),
      borrowed: card.borrowed,
    },
    ...(said ? { said: suggestionFor(s, said) } : {}),
    fulfills,
    advances,
  });
  const selected = result.choice ? opts.find((option) => option.id === result.choice) : undefined;
  const event = result.events.find(
    (item) => item.data.kind === 'suggestion-resolved' && item.data.resolution.voiceId === YOU,
  );
  const resolution = event?.data.kind === 'suggestion-resolved' ? event.data.resolution : undefined;
  const answer: Answer = {
    moment: m.id,
    at: s.minute,
    chosen: selected?.id ?? 'none',
    borrowed: card.borrowed,
    pullWon: selected?.id === m.pull.to,
  };
  if (said) {
    answer.said = said.option;
    answer.insisted = said.insist;
    s.stats.said++;
    if (said.insist) s.stats.insisted++;
    if (resolution) {
      answer.verdict = resolution.verdict;
      if (!carried) answer.says = 'You keep pushing me. I’m not listening to that today.';
      else if (resolution.verdict === 'refused')
        answer.says = reasonOf(c, resolution.verdict, selected?.id === m.pull.to);
      if (resolution.verdict === 'assented' || resolution.verdict === 'complied') s.stats.heard++;
      if (resolution.verdict === 'refused') s.stats.refused++;
    }
  } else {
    s.stats.silent++;
    if (card.borrowed && answer.pullWon) s.stats.borrowedHeard++;
  }
  if (answer.pullWon) s.stats.pullWon++;
  const turn = result.events.find(
    (item) => item.data.kind === 'prompting' && item.data.record.outcome === 'turned',
  );
  if (!said && turn?.data.kind === 'prompting') {
    const responseId = turn.data.record.responseId;
    const phrase = s.phrases.find((item) => item.id === responseId);
    if (phrase) {
      answer.turnedAlone = phrase.text;
      s.stats.turnedAlone.push(phrase.text);
    }
  }
  if (
    said &&
    result.completed &&
    selected?.phrase &&
    said.option === selected.id &&
    (resolution?.verdict === 'assented' || resolution?.verdict === 'complied') &&
    opts.some((option) => option.tags?.includes('temptation')) &&
    !s.phrases.some((phrase) => phrase.id === selected.phrase?.id)
  ) {
    const cue = opts.find((option) => option.tags?.includes('temptation'))?.action;
    learnResponse(s.hf, { id: selected.phrase.id, kind: selected.phrase.kind, ...(cue ? { cue } : {}) });
    s.phrases.push({ id: selected.phrase.id, text: selected.phrase.text });
    answer.learned = selected.phrase.text;
    s.stats.learned.push(selected.phrase.text);
  }
  if (
    said &&
    selected?.phrase &&
    said.option === selected.id &&
    (resolution?.verdict === 'assented' || resolution?.verdict === 'complied')
  )
    s.stats.reinforced.push(selected.phrase.id);
  s.answer = answer;
  s.chosen[m.id] = selected?.id ?? 'none';
  if (selected && result.completed) {
    if (selected.id === 'write' && m.id.startsWith('bed-')) changeReviewStyle(s.hf, 'accounting');
    const encounter = finishOutcome(s, m, selected) ?? finishCastEncounter(s, m, selected);
    if (selected.alsoDoes) {
      const start = readDilan(s.hf.run).at + 1;
      playHf4Routine(s.hf, {
        id: `${m.id}:also`,
        at: start,
        end: start + selected.alsoDoes.duration * 60_000,
        option: {
          id: `${m.id}:also`,
          action: selected.alsoDoes.action,
          label: selected.alsoDoes.action,
          ink: '',
          duration: selected.alsoDoes.duration,
          done: '',
        },
        needs: {},
      });
    }
    say(s, 'narrator', encounter ?? text(selected.done, c));
    m.after?.(s, selected.id);
    if (m.id.startsWith('bed-'))
      s.flags.bedAt =
        hfMinute(s) +
        (selected.id === 'write' ? 10 : selected.id === 'scroll' ? 20 : 0) +
        (s.flags.coffee === s.day ? 50 : 0);
  } else say(s, 'narrator', selected ? 'She could not finish that action.' : 'She stayed where she was.');
  if (answer.turnedAlone) say(s, 'dilan', `${answer.turnedAlone}.`);
  if (m.hint && !s.hinted.includes(m.hint)) s.hinted.push(m.hint);
  s.card = null;
  s.queue.shift();
}

function say(s: GameState, who: GameState['log'][number]['who'], line: string) {
  s.log.push({ at: hfMinute(s), who, text: line });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

// ---------- the hours between moments ----------

interface Block {
  from: number;
  to: number;
  aff: RoutineOffer;
  needs?: Record<string, number>;
  line?: string;
}

type RoutineOffer = {
  id: string;
  action: string;
  label: string;
  duration: number;
  effort?: number;
  focus?: number;
  advertises?: Opt['advertises'];
  placeId?: string;
  mode?: 'awake' | 'sleep';
};

function offer(id: string, over: Partial<RoutineOffer> = {}): RoutineOffer {
  return { id, action: id, label: id, duration: 20, effort: 0.05, advertises: {}, ...over };
}

function routine(s: GameState): Block[] {
  const d = dayStart(s.day);
  const t = (h: number, m = 0) => d + h * 60 + m;
  const meal = (from: number, to: number): Block => ({
    from,
    to,
    aff: offer('meal', { advertises: { food: 0.6, water: 0.5 }, placeId: 'home' }),
    needs: { food: 0.6, water: 0.5 },
  });
  if (s.past?.length && (s.day === LAST_DAY || weekdayOf(s.day) === 7)) {
    const home = (from: number, to: number): Block => ({
      from,
      to,
      aff: offer('home', { advertises: { rest: 0.2, leisure: 0.1 }, placeId: 'home' }),
      needs: { rest: 0.2, leisure: 0.1, water: 0.3 },
    });
    return [
      home(t(6, 40), t(8, 30)),
      meal(t(8, 30), t(9)),
      home(t(9), t(12, 30)),
      meal(t(12, 30), t(13)),
      home(t(13), t(18, 40)),
      meal(t(18, 40), t(19, 10)),
      home(t(19, 10), t(23)),
    ];
  }
  if (weekdayOf(s.day) === 6)
    return [
      meal(t(8, 30), t(9, 0)),
      { from: t(9, 0), to: t(12, 0), aff: offer('home', { advertises: { rest: 0.2 } }) },
    ];
  const leave = s.flags.late ? t(8, 2) : t(7, 35);
  const work = (from: number, to: number): Block => ({
    from,
    to,
    aff: offer(s.cast?.assignments.dilan === 'local parcel round' ? 'deliver-parcel' : 'dispatch', {
      effort: 0.22,
      focus: 0.6,
      placeId: s.cast?.assignments.dilan === 'local parcel round' ? 'delivery district' : 'depot',
      advertises: { competence: 0.05 },
    }),
    // Tea at the desk: she drinks through the shift without thinking about it.
    needs: { competence: 0.05, water: 0.5 },
  });
  const blocks: Block[] = [];
  if (!s.flags.late) blocks.push(meal(t(7, 20), t(7, 32)));
  blocks.push({ from: leave, to: leave + 22, aff: offer('commute', { placeId: 'bus' }) });
  blocks.push(work(leave + 22, t(12, 40)));
  // Friday of week two: leaving at the close card (17:10) catches the 17:15 bus, home by 17:40.
  const earlyBus = s.day === 12 && s.flags.w2?.earlyBus === true;
  // Week three ends depot work only after a completed closing choice. The commute still takes 25 minutes.
  const closeAt =
    (s.version === NEXT_VERSION || s.version === OUTCOMES_VERSION) && s.day === 19
      ? s.flags.w3?.closeAt
      : undefined;
  if (typeof closeAt === 'number') {
    const busAt = Math.max(t(17, 20), closeAt);
    blocks.push(work(t(13, 5), t(17, 10)));
    blocks.push({ from: busAt, to: busAt + 25, aff: offer('commute', { placeId: 'bus' }) });
    if (busAt + 25 < t(18, 40))
      blocks.push({
        from: busAt + 25,
        to: t(18, 40),
        aff: offer('home', { advertises: { rest: 0.2, leisure: 0.1 }, placeId: 'home' }),
        needs: { water: 0.3 },
      });
    blocks.push(meal(Math.max(t(18, 40), busAt + 25), Math.max(t(19, 10), busAt + 25 + 30)));
    blocks.push({
      from: Math.max(t(19, 10), busAt + 25 + 30),
      to: t(21, 30),
      aff: offer('home', { advertises: { rest: 0.2, leisure: 0.1 }, placeId: 'home' }),
      needs: { water: 0.3 },
    });
    return blocks;
  }
  blocks.push(work(t(13, 5), s.day === 3 ? t(16, 50) : earlyBus ? t(17, 10) : t(17, 40)));
  if (s.day !== 3 && !(s.day === 5 && s.flags.bowling)) {
    blocks.push({
      from: earlyBus ? t(17, 15) : t(17, 45),
      to: earlyBus ? t(17, 40) : t(18, 10),
      aff: offer('commute', { placeId: 'bus' }),
    });
    if (earlyBus)
      blocks.push({
        from: t(17, 40),
        to: t(18, 40),
        aff: offer('home', { advertises: { rest: 0.2, leisure: 0.1 }, placeId: 'home' }),
        needs: { water: 0.3 },
      });
    blocks.push(meal(t(18, 40), t(19, 10)));
    blocks.push({
      from: t(19, 10),
      to: t(21, 30),
      aff: offer('home', { advertises: { rest: 0.2, leisure: 0.1 }, placeId: 'home' }),
      needs: { water: 0.3 },
    });
  }
  if (s.day === 5 && s.flags.bowling)
    blocks.push({
      from: t(18, 0),
      to: t(22, 15),
      aff: offer('bowling', { effort: 0.2, placeId: 'bowling', advertises: { belonging: 0.2 } }),
      needs: { belonging: 0.2, food: 0.4, water: 0.5 },
    });
  return blocks;
}

/** Advance the shared run and settle only actual pending world work. */
function forward(s: GameState, targetMs: number) {
  if (targetMs <= readDilan(s.hf.run).at) return;
  advanceHost(s.hf, targetMs, [], (host, request) => settleMurmur(host, request, []));
}

function liveUntil(s: GameState, target: number) {
  let guard = 0;
  while (hfMinute(s) < target && guard++ < 50) {
    const now = hfMinute(s),
      blocks = routine(s);
    const current = blocks.find((block) => block.from <= now && now < block.to);
    if (current) {
      const end = Math.min(current.to, target);
      if (end - now >= 2) hostAct(s, current.aff, now, current.needs, end);
      else forward(s, end * 60_000);
      continue;
    }
    const next = blocks.filter((block) => block.from > now).sort((a, b) => a.from - b.from)[0];
    forward(s, Math.min(next ? next.from : target, target) * 60_000);
  }
  if (hfMinute(s) < target) forward(s, target * 60_000);
}

/** An offered routine action can be refused; only completed work receives an outcome. */
function hostAct(
  s: GameState,
  aff: RoutineOffer,
  at: number,
  needs?: Record<string, number>,
  until = at + aff.duration,
  fulfills: readonly string[] = [],
) {
  const start = Math.max(at * 60_000, readDilan(s.hf.run).at + 1);
  const end = until * 60_000;
  if (end <= start + 1) {
    forward(s, end);
    return;
  }
  playHf4Routine(s.hf, {
    id: `routine:${s.day}:${s.hf.offerRevision + 1}`,
    at: start,
    end,
    option: {
      id: aff.id,
      action: aff.action,
      label: aff.label,
      ink: '',
      done: '',
      duration: aff.duration,
      effort: aff.effort,
      focus: aff.focus,
      advertises: aff.advertises,
      placeId: aff.placeId,
    },
    needs: needs ?? {},
    fulfills,
    mode: aff.mode === 'sleep' ? 'sleep' : 'awake',
  });
}

// ---------- evenings ----------

function endDay(s: GameState) {
  s.card = null;
  if (
    s.day === LAST_DAY ||
    s.day === WEEK_TWO_LAST_DAY ||
    ((s.version === NEXT_VERSION || s.version === OUTCOMES_VERSION) && s.day === 20)
  ) {
    const closingAt = saturdayRoutineEndsAt(readDilan(s.hf.run).at);
    forward(s, closingAt);
    s.minute = Math.max(s.minute, Math.ceil(closingAt / 60_000));
    s.final = finalPage(s);
    s.phase = 'end';
    return;
  }
  if (s.flags.bedAt === undefined) s.flags.bedAt = dayStart(s.day) + 23 * 60;
  liveUntil(s, Math.max(hfMinute(s), dayStart(s.day) + REVIEW_AT + 5));
  requestReview(s.hf, 'evening page');
  s.pages.push(pageOf(s));
  changeReviewStyle(s.hf, (s.flags.wrote ?? 0) >= 3 ? 'accounting' : 'ruminating');
  s.phase = 'evening';
}

function nextDay(s: GameState) {
  const bed = Math.max(hfMinute(s), s.flags.bedAt ?? hfMinute(s));
  const wake = dayStart(s.day + 1) + WAKE - 1;
  forward(s, bed * 60_000);
  hostAct(
    s,
    offer('sleep', {
      mode: 'sleep',
      duration: Math.max(60, wake - bed),
      effort: 0,
      advertises: { sleep: 1, rest: 0.5 },
      placeId: 'bed',
    }),
    bed,
  );
  forward(s, wake * 60_000);
  const coffee = s.flags.coffee === s.day;
  s.day++;
  s.phase = 'day';
  s.minute = Math.max(wake, hfMinute(s));
  s.queue = momentsOf(s.day, s.version).map((m) => m.id);
  s.flags.late = false;
  s.flags.wroteTonight = false;
  s.stats = blankStats(s.hf);
  s.answer = null;
  if (coffee) say(s, 'narrator', 'She lay awake past midnight because of the third coffee.');
  else if (minuteOfDay(bed) > 23 * 60 || minuteOfDay(bed) < 4 * 60)
    say(s, 'narrator', `She fell asleep around ${clock(bed)}.`);
}

function pageOf(s: GameState): Page {
  const reading = readDilan(s.hf.run);
  const review = reading.review;
  const r = review.last;
  const today = r && r.day === Math.floor((dayStart(s.day) + REVIEW_AT) / 1440);
  const st = s.stats;
  const page: Page = {
    day: s.day,
    style: review.style,
    kept: today ? [...r.kept] : [],
    missed: today ? [...r.missed] : [],
    resolves: review.resolves.map((x) => ({ label: x.label ?? x.key, marks: marksOf(x.strength) })),
    aboutYou: aboutYou(s),
    herLine: herLine(s),
    phrases: phrasesOf(s),
    turnedAlone: [...st.turnedAlone],
    learned: [...st.learned],
    hands: { you: trustOf(s, YOU), pull: trustOf(s, PULL) },
  };
  if (st.gotUpAlone) page.gotUpAlone = true;
  if (listens(s)) {
    const thoughts = (s.thoughts ?? []).filter((t) => t.at >= dayStart(s.day));
    if (thoughts.length)
      page.stayed = thoughts
        .slice(-2)
        .map((t) => `When you said “${t.ink}”, I didn’t follow your suggestion. I kept thinking about it.`);
  }
  if (today && review.style !== 'none') {
    const event = readDilanEvents(s.hf.run).findLast(
      (e) => e.data.kind === 'review' && e.at >= dayStart(s.day) * 60_000,
    );
    const line =
      promiseReview([...r.kept], [...r.missed], review.style === 'ruminating') ?? event?.narration[0]?.text;
    if (line) page.review = line;
  }
  return page;
}

function phrasesOf(s: GameState) {
  const responses = readDilan(s.hf.run).promptings.responses;
  return s.phrases.map((ph) => ({
    text: ph.text,
    weight: responses.find((r) => r.id === ph.id)?.effectivePractice ?? 0,
  }));
}

function hfMinute(s: GameState): number {
  return Math.floor(readDilan(s.hf.run).at / 60_000);
}

export function trustOf(s: GameState, id: string): number {
  return readDilan(s.hf.run).relationships.voices.find((voice) => voice.voiceId === id)?.trust ?? 0.5;
}

function aboutYou(s: GameState): string {
  const st = s.stats;
  const dYou = trustOf(s, YOU) - st.trustYouAtStart;
  if (st.borrowedHeard > 0) return 'Some of what I heard today wasn’t you.';
  if (st.insisted >= 3) return 'You pushed me a lot today. I did it. I didn’t like it.';
  if (st.insisted >= 1 && dYou < -0.02) return 'You pushed me. Next time, ask me first.';
  if (st.said === 0)
    return st.turnedAlone.length > 0
      ? 'You were quiet today. I made one of those choices myself.'
      : 'You were quiet today. I managed, I think.';
  if (st.refused >= 2) return 'I didn’t listen to you much today.';
  if (dYou > 0.02) return 'You were right more than you were wrong.';
  if (dYou < -0.02)
    return s.day % 2 === 0
      ? 'Some of what you said today felt wrong to me.'
      : 'I listened to you, and I’m not sure I should have.';
  if (st.said >= 6) return 'You had something to say about everything.';
  return 'You were there. I heard most of what you said.';
}

function herLine(s: GameState): string {
  if (s.version === OUTCOMES_VERSION && weekOf(s.day) === 3) return outcomeThreads(s).join(' ');
  if (s.version === NEXT_VERSION && weekOf(s.day) === 3) return thirdWeekHerLine(s);
  if (weekOf(s.day) === 2) return weekTwo.weekTwoHerLine(s) || `${DAY_NAMES[s.day]} is over.`;
  const f = s.flags;
  const ch = s.chosen;
  switch (s.day) {
    case 1:
      if (f.lied === 1) return 'Murat knows it wasn’t the ring road.';
      if (f.gossiped === 1) return 'I keep thinking about Ece’s face when she came back in.';
      if (ch['bus-1'] === 'call')
        return 'Mum’s neighbour is putting on a new roof. I know far too much about it.';
      return 'Monday is over.';
    case 2:
      if (ch['mistake-2'] === 'own') return 'I said it was my mistake, and nothing terrible happened.';
      if (f.eceBlamed) return 'They think it was Ece.';
      return 'It is Tuesday.';
    case 3:
      if (ch['dinner-3'] === 'truth') return 'Mum held my hand under the table like I was nine.';
      if (ch['dinner-3'] === 'home') return 'I left before Aylin blew out the candles.';
      if (f.route) return 'At dinner, my legs still ached from driving the van.';
      return 'It is Aylin’s birthday. I can’t believe another year has passed.';
    case 4:
      if ((f.shelf ?? 0) >= 1) return 'The shelf has sides now.';
      if (f.eceBlamed) return 'Ece apologised for something I did.';
      return 'I almost couldn’t manage everything on Thursday.';
    default:
      if ((f.shelf ?? 0) >= 2) return 'There is a shelf. I made it.';
      if (f.bowling) return 'I am apparently good at bowling.';
      return 'The week is over. I think.';
  }
}

/** Saturday's voice note, composed from what the week was. */
function voiceNote(s: GameState): string {
  const calls = s.flags.calls ?? 0;
  const parts: string[] = ['Mum, it’s me.'];
  if (calls >= 3) parts.push('I know I rang most days. I liked it.');
  else if (calls >= 1) parts.push('I know I didn’t call every day. I meant to call.');
  else parts.push('I know I didn’t call. I kept meaning to call.');
  if (s.chosen['dinner-3'] === 'truth') parts.push('You asked if I was eating. I’m trying.');
  if (
    s.chosen['shelf-visit-6'] === 'repair-with-aylin' &&
    s.cast?.encounters.some((e) => e.person === 'aylin' && e.action === 'shelf')
  )
    parts.push('Aylin and I finished the shelf together. The uneven edge is still visible inside.');
  else if ((s.flags.shelf ?? 0) >= 2) parts.push('I finished the shelf. It’s not straight.');
  else if ((s.flags.shelf ?? 0) === 1) parts.push('I finally started building the shelf.');
  if (s.flags.ownedMistake) parts.push('I made a mistake at work and said so.');
  parts.push('Anyway, I love you. That’s all I wanted to say.');
  return parts.join(' ');
}

/** Saturday closes what the week opened, in a line each. */
function threadsOf(s: GameState): string[] {
  const f = s.flags;
  const ch = s.chosen;
  const out: string[] = [];
  if (ch['shadow-4'] === 'stay')
    out.push('Ece has her own columns now. She sends Dilan a photo of them every morning.');
  else if (ch['shadow-4'] === 'go')
    out.push('Ece never asked to watch Dilan work again. She asked Murat instead.');
  else if (f.eceBlamed && ch['ece-4'] !== 'tell') out.push('Ece still thinks it was her scanner.');
  else if (ch['ece-1'] === 'talk')
    out.push('Ece knows the new housing estate now. She knows who guided her through it.');
  if ((f.lied ?? 0) > 0 && (f.lateDays ?? 0) >= 2)
    out.push('Murat stopped asking about the ring road. His silence felt worse than his questions.');
  else if ((f.lateDays ?? 0) >= 2 && !f.lied)
    out.push('Murat wrote in pen that she was late twice. He also wrote that she was reliable.');
  if (
    ch['shelf-visit-6'] === 'repair-with-aylin' &&
    s.cast?.encounters.some((e) => e.person === 'aylin' && e.action === 'shelf')
  )
    out.push('Dilan and Aylin finished the shelf together. The repaired support stays visible inside.');
  else if (ch['shelf-visit-6'] === 'leave-shelf')
    out.push('Dilan left the shelf unfinished and said the repair would wait.');
  else if (ch['shelf-4'] === 'aylin')
    out.push('Aylin came to help with the shelf on Saturday. There was still cake.');
  else if ((f.shelf ?? 0) === 0)
    out.push('The screws are still in their little bag. March is a long time ago now.');
  if (ch['gymgo-5'] === 'gym') out.push('She put the gym bag by the door again on purpose.');
  if (f.sent === 'send' || f.sent === 'call')
    out.push('She changed the lock screen. The beach photo can stay in the album.');
  else out.push('The beach photo is still the lock screen.');
  return out;
}

function finalPage(s: GameState): Final {
  const pages = s.pages.filter((pg) => weekOf(pg.day) === weekOf(s.day));
  const first = pages[0]?.hands ?? { you: 0.45, pull: 0.62 };
  const unasked = [...new Set(pages.flatMap((pg) => pg.turnedAlone))];
  const sent = s.version === OUTCOMES_VERSION && weekOf(s.day) === 3 ? 'kept' : (s.flags.sent ?? 'delete');
  const line =
    sent === 'send'
      ? 'Mum replied with a voice note eleven minutes long.'
      : sent === 'call'
        ? 'They talked until the kettle went cold.'
        : 'She deleted it. On Sunday she rang anyway.';
  return {
    note:
      weekOf(s.day) === 3
        ? s.version === OUTCOMES_VERSION
          ? outcomeThreads(s).join(' ')
          : String(s.flags.w3?.note ?? thirdWeekNote(ctxOf(s)))
        : weekOf(s.day) === 2
          ? String(s.flags.w2?.note ?? '')
          : voiceNote(s),
    threads:
      weekOf(s.day) === 3
        ? s.version === OUTCOMES_VERSION
          ? outcomeThreads(s)
          : thirdWeekThreads(s)
        : weekOf(s.day) === 2
          ? weekTwo.weekTwoThreads(s)
          : threadsOf(s),
    sent,
    phrases: phrasesOf(s),
    unasked,
    strip: pages.map((pg) => ({ day: pg.day, kept: pg.kept, missed: pg.missed })),
    hands: { start: first, end: { you: trustOf(s, YOU), pull: trustOf(s, PULL) } },
    line:
      weekOf(s.day) === 3
        ? 'Three weeks. Some advice I kept. Some I changed.'
        : weekOf(s.day) === 2
          ? weekTwo.weekTwoLine(s)
          : line,
  };
}

// ---------- another week ----------

/** Whether this finished listening-edition run can go on to a second week. */
export function canAnotherWeek(s: GameState): boolean {
  return (
    s.phase === 'end' &&
    listens(s) &&
    (s.day === LAST_DAY ||
      ((s.version === NEXT_VERSION || s.version === OUTCOMES_VERSION) && s.day === WEEK_TWO_LAST_DAY))
  );
}

/** The same run, going on into week two. Returns the state to continue with (a new object for a 0.3.0 run). */
export function anotherWeek(s: GameState): GameState {
  if (!canAnotherWeek(s)) throw new Error('This run cannot continue into another week.');
  if (!hasWeekTwo(s)) {
    const rebuilt = replay(s.seed, s.inputs, s.minute, '0.4.1', undefined, s.plainEnglish);
    // The last answer may end the day without advancing the host clock.
    while (rebuilt.phase === 'day') step(rebuilt);
    if (fingerprint(rebuilt) !== fingerprint(s)) throw new Error('Week-one replay does not match this run.');
    s = rebuilt;
  }
  queueInput(s, { kind: 'next' });
  step(s);
  return s;
}

/** Saturday afternoon and Sunday pass without choices or evening pages. */
function startWeekTwo(s: GameState) {
  if (!s.final) throw new Error('The first week has no last page.');
  s.past ??= [];
  s.past.push(s.final);
  s.final = null;
  const firstDay = s.day + 2;
  for (let day = s.day; day < firstDay; day++) {
    const bed = dayStart(day) + 23 * 60;
    liveUntil(s, bed);
    s.flags.bedAt = bed;
    nextDay(s);
  }
  delete s.flags.bedAt;
  const recurUntil = dayStart(firstDay + 4) + 1439;
  requestPromise(s.hf, {
    kind: 'promise',
    toId: 'self',
    label: LABEL.alarm,
    actions: ['get-up'],
    from: dayStart(firstDay) + WAKE - 5,
    until: dayStart(firstDay) + WAKE + 20,
    importance: 0.5,
    recurEvery: 1440,
    recurUntil,
  });
  requestPromise(s.hf, {
    kind: 'promise',
    toId: 'mum',
    label: LABEL.mum,
    actions: [s.version === PROMISE_EDITION ? 'listen-to-mum' : 'call-mum'],
    from: dayStart(firstDay) + 17 * 60 + 30,
    until: dayStart(firstDay) + 21 * 60 + 30,
    importance: 0.55,
    recurEvery: 1440,
    recurUntil,
  });
  if (s.version === PROMISE_EDITION)
    requestPromise(s.hf, {
      kind: 'promise',
      toId: 'self',
      label: LABEL.bedtime,
      actions: ['write', 'lights-out'],
      from: dayStart(firstDay) + 21 * 60 + 30,
      until: dayStart(firstDay) + 21 * 60 + 55,
      importance: 0.15,
      recurEvery: 1440,
      recurUntil,
    });
}

// ---------- saves and replays ----------

export function cloneState(s: GameState): GameStateSnapshot {
  const { hf, ...host } = s;
  return { ...structuredClone(host), hf: checkpointMurmur(hf) };
}

export function restoreState(json: GameStateSnapshot): GameState {
  if (!isEdition(json.version)) throw new Error(`Unknown Murmur edition: ${json.version}`);
  const { hf, ...host } = json;
  return { ...structuredClone(host), hf: restoreMurmur(hf) };
}

/** Rebuild a run from its seed and input log. */
export function replay(
  seed: number,
  inputs: readonly Input[],
  until?: number,
  version = LEGACY_VERSION,
  chapter?: CastChapter,
  plainEnglish = true,
): GameState {
  const s = newGame(seed, version, chapter, plainEnglish);
  const inherited: Input[] = [];
  if (JSON.stringify(inputs.slice(0, inherited.length)) !== JSON.stringify(inherited))
    throw Error('Native return input prefix changed.');
  for (const inp of inputs.slice(inherited.length)) {
    // A 'next' belongs to the evening: run the day out first, even when it ended on the minute of the last answer.
    while (
      s.phase === 'day' &&
      (s.minute < inp.at ||
        inp.kind === 'next' ||
        inp.kind === 'one-cast-release' ||
        inp.kind === 'cast-pause')
    )
      step(s);
    s.inputs.push(inp);
    applyPending(s);
  }
  if (until !== undefined) while (s.phase === 'day' && s.minute < until) step(s);
  // Then on to where the player was: the next card, the evening, or the end.
  else runToCard(s);
  return s;
}

/** A compact fingerprint of everything that matters, for replay checks. */
export function fingerprint(s: GameState): string {
  return canonicalPersona(cloneState(s));
}

/**
 * The minute the next card can open, or null when no card is left today (or one is open). Read-only, for UI pacing:
 * mirrors `step`'s opening rule (skip moments whose `when` is false; never before her own clock).
 */
export function nextCardAt(s: GameState): number | null {
  if (s.phase !== 'day' || s.card) return null;
  const c = ctxOf(s);
  for (const id of s.queue) {
    const m = castMoment(s, momentById(id, s.version));
    if (m.when && !m.when(c)) continue;
    const at = dayStart(s.day) + (typeof m.at === 'function' ? m.at(c) : m.at);
    return Math.max(at, hfMinute(s));
  }
  return null;
}

/** Run the sim until a card opens, the day ends, or `max` minutes pass (headless and tests). */
export function runToCard(s: GameState, max = 3000): void {
  for (let i = 0; i < max && s.phase === 'day' && !s.card; i++) step(s);
}
