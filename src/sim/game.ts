/**
 * The Two Voices: the day host. Pure and deterministic: state is plain JSON, and every player input is stamped
 * with the sim minute it applies at, so replaying the same seed and input log rebuilds the same state (`replay`).
 *
 * Covers: Dilan's week as authored moments; at each moment one HF decision with two voices (`you` and `pull`, each
 * with its own trust), her answer in HF's words, prompts and turning away (HF promptings), the evening review (HF
 * review: `ruminating` by default, `accounting` on nights she writes the day down), the hours between moments lived
 * through HF (commute, work, meals, sleep). Does not cover: other people as HF persons, money, spatial movement.
 */
import {
  type Activity,
  type Affordance,
  begin,
  bodyForecast,
  type DecisionRecord,
  decide,
  enablePromptings,
  enableReview,
  finish,
  type Outcome,
  type Person,
  type PromptingResponse,
  predict,
  restore,
  reviewLine,
  type Suggestion,
  snapshot,
  tick,
} from '@adam0white/human-framework';
import { DAY0, dayStart, LABEL, makeDilan, PULL, REVIEW_AT, WAKE, YOU } from './dilan.ts';
import { LAST_DAY, momentById, momentsOf } from './moments.ts';
import type {
  Answer,
  Ctx,
  DayStats,
  Final,
  GameState,
  Input,
  Moment,
  NewInput,
  Opt,
  Page,
  Verdict,
} from './types.ts';

export const GAME_VERSION = '0.2.0';
export const DAY_NAMES = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WINDOW = 5;
const SAY = 0.6;
const INSIST = 0.85;
const PULL_STRENGTH = 0.7;
/** A tired Dilan hears the pull louder. */
const TIRED_PULL = 0.2;
/** The pull borrows your ink only once she trusts you this much. */
const BORROW_FROM = 0.55;
const PSYCH = ['safety', 'belonging', 'esteem', 'autonomy', 'competence', 'leisure', 'meaning'];

export const trustOf = (p: Person, id: string) => p.will.voices.find((v) => v.voiceId === id)?.trust ?? 0.5;
export const minuteOfDay = (m: number) => (((m - DAY0) % 1440) + 1440) % 1440;
export const clock = (m: number) => {
  const d = minuteOfDay(m);
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};
const text = (x: string | ((c: Ctx) => string), c: Ctx) => (typeof x === 'function' ? x(c) : x);

function blankStats(p: Person): DayStats {
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
    trustYouAtStart: trustOf(p, YOU),
    trustPullAtStart: trustOf(p, PULL),
  };
}

export function newGame(seed: number): GameState {
  const person = makeDilan(seed);
  const s: GameState = {
    version: GAME_VERSION,
    seed,
    day: 1,
    phase: 'day',
    minute: dayStart(1) + WAKE - 1,
    person,
    inputs: [],
    applied: 0,
    queue: momentsOf(1).map((m) => m.id),
    card: null,
    answer: null,
    log: [],
    flags: {},
    stats: blankStats(person),
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
  const p = s.person;
  const missedMum = s.pages.filter((pg) => pg.missed.includes(LABEL.mum)).length;
  const bedLate = s.flags.bedAt !== undefined && minuteOfDay(s.flags.bedAt) > 23 * 60 + 15;
  const bedSmall = s.flags.bedAt !== undefined && minuteOfDay(s.flags.bedAt) < 4 * 60;
  return {
    day: s.day,
    flags: s.flags,
    missedMum,
    tired: bedLate || bedSmall || p.body.sleepPressure > 0.55,
    chosen: s.chosen,
    note: voiceNote(s),
  };
}

/** The card's moment, if one is open. */
export const openMoment = (s: GameState): Moment | null => (s.card ? momentById(s.card.moment) : null);

export function optionsOf(s: GameState, m: Moment): Opt[] {
  const c = ctxOf(s);
  return typeof m.options === 'function' ? m.options(c) : m.options;
}

function pendingId(p: Person, label: string): string | undefined {
  return p.agenda.commitments.find((x) => x.label === label && x.status === 'pending' && x.until >= p.now)
    ?.id;
}

function affordanceOf(s: GameState, o: Opt, m: Moment): Affordance {
  const p = s.person;
  const aff: Affordance = {
    id: o.id,
    action: o.action,
    label: o.label,
    duration: o.duration,
    effort: o.effort ?? 0.05,
    advertises: o.advertises ?? {},
    placeId: o.placeId ?? m.place,
  };
  if (o.focus !== undefined) aff.focus = o.focus;
  if (o.tags) aff.tags = [...o.tags];
  if (o.norms) aff.norms = o.norms.map((n) => ({ ...n }));
  if (o.followedBy) aff.followedBy = o.followedBy.map((f) => ({ ...f }));
  if (o.keeps) {
    const ids = o.keeps
      .map((k) => pendingId(p, LABEL[k as keyof typeof LABEL] ?? k))
      .filter((x): x is string => !!x);
    if (ids.length > 0) aff.fulfills = ids;
  }
  return aff;
}

function offersOf(s: GameState, m: Moment): Affordance[] {
  return optionsOf(s, m).map((o) => affordanceOf(s, o, m));
}

function pullSuggestion(s: GameState, m: Moment, borrowed: boolean): Suggestion {
  const tired = ctxOf(s).tired ? TIRED_PULL : 0;
  return {
    voiceId: borrowed ? YOU : PULL,
    affordanceId: m.pull.to,
    strength: Math.min(1, (m.pull.strength ?? PULL_STRENGTH) + tired),
  };
}

/**
 * Insisting is a capability, not a free override: it carries only while she trusts you enough
 * (INSIST_FROM). Below that, holding is just a louder say, and she can still refuse.
 */
export const INSIST_FROM = 0.45;
export const insistCarries = (p: Person) => trustOf(p, YOU) >= INSIST_FROM;

function yourSuggestion(p: Person, option: string, insist?: boolean): Suggestion {
  // Pushing when she does not trust you enough backfires: it carries less than a plain say.
  if (insist && !insistCarries(p)) return { voiceId: YOU, affordanceId: option, strength: SAY / 2 };
  return insist
    ? { voiceId: YOU, affordanceId: option, strength: INSIST, insist: true }
    : { voiceId: YOU, affordanceId: option, strength: SAY };
}

/** Thursday on, the pull borrows your ink where she trusts you more than it. */
/**
 * Thursday on, the pull sometimes borrows your ink: once a day at most, where she trusts you more than it. Which
 * eligible card it picks (the first, second or third of the day) is fixed by the seed, so it is not always the alarm.
 * Called once per card open; it counts.
 */
function borrows(s: GameState, m: Moment): boolean {
  const you = trustOf(s.person, YOU);
  if (s.day < 4 || !m.pull.borrow || you <= BORROW_FROM || you <= trustOf(s.person, PULL)) return false;
  const st = s.stats;
  const pick = ((s.seed * 31 + s.day * 7) >>> 0) % 3;
  const n = st.borrowable;
  st.borrowable += 1;
  if (st.borrowed > 0 || n < pick) return false;
  st.borrowed += 1;
  return true;
}

export type Lean = 'yes' | 'if pushed' | 'later' | 'rather not' | 'no';
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
  resolve?: { label: string; marks: number; line: string };
  closesAt: number;
  options: { id: string; ink: string; lean: Lean; pushed: Lean; isPull: boolean }[];
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
  const m = openMoment(s);
  const card = s.card;
  if (!m || !card) return null;
  const p = s.person;
  const c = ctxOf(s);
  const offers = offersOf(s, m);
  const opts = optionsOf(s, m);
  const pull = pullSuggestion(s, m, card.borrowed);
  const others = card.borrowed ? [] : [pull];
  const view: CardView = {
    id: m.id,
    day: m.day,
    scene: text(m.scene, c),
    pullLine: card.borrowed && m.pull.borrow ? m.pull.borrow : text(m.pull.line, c),
    pullTo: m.pull.to,
    borrowed: card.borrowed,
    closesAt: card.closesAt,
    options: opts.map((o) => ({
      id: o.id,
      ink: text(o.ink, c),
      lean: leanOf(predict(p, offers, yourSuggestion(p, o.id), { others }).verdict),
      pushed: leanOf(predict(p, offers, yourSuggestion(p, o.id, true), { others }).verdict),
      isPull: o.id === m.pull.to,
    })),
  };
  if (m.hint && !s.hinted.includes(m.hint)) view.hint = m.hint;
  const heavy = offers.find((a) => a.followedBy && a.followedBy.length > 0);
  if (heavy) view.forecast = bodyForecast(p, heavy).line;
  const label = RESOLVE_FOR[m.id.split('-')[0] ?? ''];
  const r = label ? p.review?.resolves.find((x) => x.label === label) : undefined;
  if (r && label) view.resolve = { label, marks: marksOf(r.strength), line: resolveLine(label) };
  return view;
}

function resolveLine(label: string): string {
  if (label === LABEL.alarm) return 'I said I’d get up when it goes.';
  if (label === LABEL.mum) return 'I said I’d ring her. Ten minutes.';
  return `I said I’d keep ${label}.`;
}

// ---------- inputs ----------

export function queueInput(s: GameState, input: NewInput): void {
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
  if (inp.kind === 'say') {
    if (s.phase !== 'day' || !s.card) return;
    const m = momentById(s.card.moment);
    if (!optionsOf(s, m).some((o) => o.id === inp.option)) return;
    resolve(s, { option: inp.option, insist: inp.insist === true });
    return;
  }
  if (inp.kind === 'quiet') {
    if (s.phase === 'day' && s.card) resolve(s, null);
    return;
  }
  if (inp.kind === 'next') {
    if (s.phase !== 'evening') return;
    nextDay(s);
  }
}

// ---------- the minute ----------

/** Advance one sim minute. */
export function step(s: GameState): void {
  if (s.phase !== 'day') return;
  applyPending(s);
  if (s.phase !== 'day') return;
  if (s.card) {
    if (s.minute >= s.card.closesAt) resolve(s, null);
  } else {
    const c = ctxOf(s);
    while (s.queue.length > 0) {
      const m = momentById(s.queue[0] as string);
      if (m.when && !m.when(c)) {
        s.queue.shift();
        continue;
      }
      break;
    }
    const id = s.queue[0];
    if (id === undefined) {
      endDay(s);
      return;
    }
    const m = momentById(id);
    const at = dayStart(s.day) + (typeof m.at === 'function' ? m.at(c) : m.at);
    if (s.minute >= at && s.minute >= s.person.now) open(s, m);
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
  s.log.push({ at: s.minute, who: 'scene', text: text(m.scene, c) });
  if (v) s.log.push({ at: s.minute, who: 'pull', text: v.pullLine });
}

function resolve(s: GameState, said: { option: string; insist: boolean } | null) {
  const card = s.card;
  if (!card) return;
  const m = momentById(card.moment);
  const p = s.person;
  const c = ctxOf(s);
  if (p.now < s.minute) tick(p, s.minute);
  if (m.hint && !s.hinted.includes(m.hint)) s.hinted.push(m.hint);
  const offers = offersOf(s, m);
  const opts = optionsOf(s, m);
  const pull = pullSuggestion(s, m, card.borrowed);
  // Your real voice drowns out a borrowed one: one suggestion per voice.
  const suggestions: Suggestion[] = said
    ? [yourSuggestion(p, said.option, said.insist), ...(card.borrowed ? [] : [pull])]
    : [pull];
  const carried = said?.insist ? insistCarries(p) : true;
  const rec: DecisionRecord = decide(p, offers, { suggestions });
  const chosenAff =
    offers.find((a) => a.id === rec.chosenAffordanceId) ?? offers.find((a) => a.id === m.pull.to);
  const chosen = chosenAff ? (opts.find((o) => o.id === chosenAff.id) as Opt) : (opts[0] as Opt);
  const aff = chosenAff ?? (offers[0] as Affordance);
  const yours = (rec.suggestions ?? []).find((r) => r.voiceId === YOU);
  const answer: Answer = {
    moment: m.id,
    at: s.minute,
    chosen: chosen.id,
    borrowed: card.borrowed,
    pullWon: chosen.id === m.pull.to,
  };
  const st = s.stats;
  if (said) {
    answer.said = said.option;
    answer.insisted = said.insist;
    st.said += 1;
    if (said.insist) st.insisted += 1;
    if (yours) {
      answer.verdict = yours.verdict as Verdict;
      answer.says = yours.says;
      const heard = yours.verdict === 'assented' || yours.verdict === 'complied';
      // A hold that did not carry: she says why, in her words.
      if (!carried && !heard) answer.says = 'Don’t push me. Not today.';
      if (heard) st.heard += 1;
      const ph = opts.find((o) => o.id === said.option)?.phrase;
      if (heard && ph && said.option === chosen.id) st.reinforced.push(ph.id);
      if (yours.verdict === 'refused') st.refused += 1;
    }
  } else {
    st.silent += 1;
    if (card.borrowed && chosen.id === m.pull.to) st.borrowedHeard += 1;
  }
  if (answer.pullWon) st.pullWon += 1;
  // Prompts at this decision (HF promptings): did she turn from one on her own?
  const prompts = (p.promptings?.recent ?? []).filter((r) => r.at === s.minute);
  const turned = prompts.find((r) => r.outcome === 'turned');
  if (turned && !said) {
    const phrase = s.phrases.find((x) => x.id === turned.responseId);
    if (phrase) {
      answer.turnedAlone = phrase.text;
      st.turnedAlone.push(phrase.text);
    }
  }
  // She keeps your words as her own when she followed you away from a prompt.
  const hadPrompt = opts.some((o) => o.tags?.includes('temptation'));
  if (
    said &&
    hadPrompt &&
    chosen.phrase &&
    said.option === chosen.id &&
    (yours?.verdict === 'assented' || yours?.verdict === 'complied') &&
    !s.phrases.some((x) => x.id === chosen.phrase?.id)
  ) {
    learnPhrase(s, chosen.phrase);
    answer.learned = chosen.phrase.text;
    st.learned.push(chosen.phrase.text);
  }
  s.answer = answer;
  s.chosen[m.id] = chosen.id;
  // Live it.
  if (begin(p, aff, rec)) {
    const a = p.activity as Activity;
    if (chosen.id === 'write' && m.id.startsWith('bed-')) enableReview(p, { style: 'accounting' });
    tick(p, a.endsAt);
    finish(p, outcomeOf(a, chosen, c));
    if (chosen.alsoDoes)
      hostAct(
        p,
        offer(chosen.alsoDoes.action, { duration: chosen.alsoDoes.duration, placeId: m.place }),
        p.now,
      );
  }
  say(s, 'narrator', text(chosen.done, c));
  if (answer.turnedAlone) say(s, 'dilan', `${answer.turnedAlone}.`);
  m.after?.(s, chosen.id);
  if (m.id.startsWith('bed-')) {
    let bed = p.now + (chosen.id === 'write' ? 10 : chosen.id === 'scroll' ? 20 : 0);
    if (s.flags.coffee === s.day) bed += 50;
    s.flags.bedAt = bed;
  }
  s.card = null;
  s.queue.shift();
}

function learnPhrase(s: GameState, ph: NonNullable<Opt['phrase']>) {
  const p = s.person;
  s.phrases.push({ id: ph.id, text: ph.text });
  const held: { id: string; kind: PromptingResponse['kind']; practice?: number }[] = (
    p.promptings?.responses ?? []
  ).map((r) => ({ id: r.id, kind: r.kind }));
  held.push({ id: ph.id, kind: ph.kind, practice: 0.1 });
  enablePromptings(p, { reading: 'inclination', readingSource: 'host:dilan', responses: held });
}

function outcomeOf(a: Activity, o: Opt, c: Ctx): Outcome {
  const out: Outcome = { affordanceId: a.affordanceId, action: a.action, status: 'completed', at: a.endsAt };
  const base: Record<string, number> = {};
  for (const [k, v] of Object.entries(o.advertises ?? {})) if (PSYCH.includes(k)) base[k] = v ?? 0;
  const gives = typeof o.gives === 'function' ? o.gives(c) : o.gives;
  const needs: Record<string, number> = { ...(gives ?? base) };
  for (const k of ['food', 'water'] as const) {
    const v = gives?.[k] ?? o.advertises?.[k];
    if (v !== undefined) needs[k] = v;
  }
  if (Object.keys(needs).length > 0) out.needs = needs;
  return out;
}

function say(s: GameState, who: GameState['log'][number]['who'], line: string) {
  s.log.push({ at: s.person.now, who, text: line });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

// ---------- the hours between moments ----------

interface Block {
  from: number;
  to: number;
  aff: Affordance;
  needs?: Record<string, number>;
  line?: string;
}

function offer(id: string, over: Partial<Affordance> = {}): Affordance {
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
  if (s.day === LAST_DAY)
    return [
      meal(t(8, 30), t(9, 0)),
      { from: t(9, 0), to: t(12, 0), aff: offer('home', { advertises: { rest: 0.2 } }) },
    ];
  const leave = s.flags.late ? t(8, 2) : t(7, 35);
  const work = (from: number, to: number): Block => ({
    from,
    to,
    aff: offer('dispatch', { effort: 0.22, focus: 0.6, placeId: 'depot', advertises: { competence: 0.05 } }),
    // Tea at the desk: she drinks through the shift without thinking about it.
    needs: { competence: 0.05, water: 0.5 },
  });
  const blocks: Block[] = [];
  if (!s.flags.late) blocks.push(meal(t(7, 20), t(7, 32)));
  blocks.push({ from: leave, to: leave + 22, aff: offer('commute', { placeId: 'bus' }) });
  blocks.push(work(leave + 22, t(12, 40)));
  blocks.push(work(t(13, 5), s.day === 3 ? t(16, 50) : t(17, 40)));
  if (s.day !== 3 && !(s.day === 5 && s.flags.bowling)) {
    blocks.push({ from: t(17, 45), to: t(18, 10), aff: offer('commute', { placeId: 'bus' }) });
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

/** Live Dilan from her own clock to `target` through the routine (no choices offered). */
function liveUntil(s: GameState, target: number) {
  const p = s.person;
  let guard = 0;
  while (p.now < target && guard++ < 50) {
    const blocks = routine(s);
    const cur = blocks.find((b) => b.from <= p.now && p.now < b.to);
    if (cur) {
      const end = Math.min(cur.to, target);
      if (end - p.now >= 2) hostAct(p, { ...cur.aff, duration: end - p.now }, p.now, cur.needs);
      else tick(p, end);
      continue;
    }
    const next = blocks.filter((b) => b.from > p.now).sort((a, b) => a.from - b.from)[0];
    tick(p, Math.min(next ? next.from : target, target));
  }
  if (p.now < target) tick(p, target);
}

/** The host does `aff` at `at` (no choice offered). */
function hostAct(p: Person, aff: Affordance, at: number, needs?: Record<string, number>) {
  if (p.now < at) tick(p, at);
  const rec = decide(p, [aff]);
  if (rec.chosenAffordanceId !== aff.id || !begin(p, aff, rec)) {
    tick(p, p.now + aff.duration);
    return;
  }
  const a = p.activity as Activity;
  tick(p, a.endsAt);
  const out: Outcome = { affordanceId: aff.id, action: aff.action, status: 'completed', at: a.endsAt };
  if (needs) out.needs = needs;
  finish(p, out);
}

// ---------- evenings ----------

function endDay(s: GameState) {
  const p = s.person;
  s.card = null;
  if (s.day === LAST_DAY) {
    s.final = finalPage(s);
    s.phase = 'end';
    return;
  }
  const bed = s.flags.bedAt ?? dayStart(s.day) + 23 * 60;
  if (s.flags.bedAt === undefined) s.flags.bedAt = bed;
  liveUntil(s, Math.max(p.now, dayStart(s.day) + REVIEW_AT + 5));
  s.pages.push(pageOf(s));
  // She takes up writing it down once she has done it three nights.
  enableReview(p, { style: (s.flags.wrote ?? 0) >= 3 ? 'accounting' : 'ruminating' });
  s.phase = 'evening';
}

/**
 * Her phrases fade overnight unless you said them again that day: borrowed words need saying to stay hers. HF's
 * own practice half-life is 60 days, too slow for one week, so the host scales practice down here (HF request 5).
 */
const PHRASE_FADES = 0.8;
function fadePhrases(s: GameState) {
  for (const r of s.person.promptings?.responses ?? [])
    if (!s.stats.reinforced.includes(r.id)) r.practice *= PHRASE_FADES;
}

function nextDay(s: GameState) {
  const p = s.person;
  fadePhrases(s);
  const bed = Math.max(p.now, s.flags.bedAt ?? p.now);
  const wake = dayStart(s.day + 1) + WAKE - 1;
  if (p.now < bed) tick(p, bed);
  hostAct(
    p,
    offer('sleep', {
      mode: 'sleep',
      duration: Math.max(60, wake - bed),
      effort: 0,
      advertises: { sleep: 1, rest: 0.5 },
      placeId: 'bed',
    }),
    bed,
  );
  if (p.now < wake) tick(p, wake);
  const coffee = s.flags.coffee === s.day;
  s.day += 1;
  s.phase = 'day';
  s.minute = Math.max(wake, p.now);
  s.queue = momentsOf(s.day).map((m) => m.id);
  s.flags.late = false;
  s.flags.wroteTonight = false;
  s.stats = blankStats(p);
  s.answer = null;
  if (coffee) say(s, 'narrator', 'She lay awake past midnight. The third coffee.');
  else if (minuteOfDay(bed) > 23 * 60 || minuteOfDay(bed) < 4 * 60)
    say(s, 'narrator', `She fell asleep around ${clock(bed)}.`);
}

function pageOf(s: GameState): Page {
  const p = s.person;
  const r = p.review?.last;
  const today = r && r.day === Math.floor(p.now / 1440);
  const st = s.stats;
  const page: Page = {
    day: s.day,
    style: p.review?.style ?? 'none',
    kept: today ? [...r.kept] : [],
    missed: today ? [...r.missed] : [],
    resolves: (p.review?.resolves ?? []).map((x) => ({
      label: x.label ?? x.key,
      marks: marksOf(x.strength),
    })),
    aboutYou: aboutYou(s),
    herLine: herLine(s),
    phrases: phrasesOf(s),
    turnedAlone: [...st.turnedAlone],
    learned: [...st.learned],
    hands: { you: trustOf(p, YOU), pull: trustOf(p, PULL) },
  };
  const line = today ? reviewLine(p) : undefined;
  if (line) page.review = line;
  return page;
}

function phrasesOf(s: GameState) {
  const p = s.person;
  return s.phrases.map((ph) => {
    const r = p.promptings?.responses.find((x) => x.id === ph.id);
    return { text: ph.text, weight: r ? r.practice : 0 };
  });
}

function aboutYou(s: GameState): string {
  const st = s.stats;
  const p = s.person;
  const dYou = trustOf(p, YOU) - st.trustYouAtStart;
  if (st.borrowedHeard > 0) return 'Some of what I heard today wasn’t you.';
  if (st.insisted >= 3) return 'You pushed me a lot today. I did it. I didn’t like it.';
  if (st.insisted >= 1 && dYou < -0.02) return 'You pushed. Next time ask me first.';
  if (st.said === 0)
    return st.turnedAlone.length > 0
      ? 'You were quiet today. I did one myself.'
      : 'You were quiet today. I managed. Sort of.';
  if (st.refused >= 2) return 'I didn’t listen to you much today.';
  if (dYou > 0.02) return 'You were right more than you were wrong.';
  if (dYou < -0.02)
    return s.day % 2 === 0
      ? 'Some of what you said today didn’t sit right.'
      : 'I listened to you, and I’m not sure I should have.';
  if (st.said >= 6) return 'You had something to say about everything.';
  return 'You were there. Mostly I heard you.';
}

function herLine(s: GameState): string {
  const f = s.flags;
  const ch = s.chosen;
  switch (s.day) {
    case 1:
      if (f.lied === 1) return 'Murat knows it wasn’t the ring road.';
      if (f.gossiped === 1) return 'Ece’s face when she came back in.';
      if (ch['bus-1'] === 'call')
        return 'Mum’s neighbour is putting on a new roof. I know far too much about it.';
      return 'Monday, done.';
    case 2:
      if (ch['mistake-2'] === 'own') return 'I said it was me, and nothing fell down.';
      if (f.eceBlamed) return 'They think it was Ece.';
      return 'Tuesday.';
    case 3:
      if (ch['dinner-3'] === 'truth') return 'Mum held my hand under the table like I was nine.';
      if (ch['dinner-3'] === 'home') return 'I left before the candles.';
      if (f.route) return 'I could still feel the van in my legs at dinner.';
      return 'Aylin is thirty. That can’t be right.';
    case 4:
      if ((f.shelf ?? 0) >= 1) return 'The shelf has sides now.';
      if (f.eceBlamed) return 'Ece apologised for something I did.';
      return 'Thursday nearly got me.';
    default:
      if ((f.shelf ?? 0) >= 2) return 'There is a shelf. I made it.';
      if (f.bowling) return 'I am apparently good at bowling.';
      return 'The week is over. I think.';
  }
}

/** Saturday's voice note, composed from what the week was. */
export function voiceNote(s: GameState): string {
  const calls = s.flags.calls ?? 0;
  const parts: string[] = ['Mum, it’s me.'];
  if (calls >= 3) parts.push('I know I rang most days. I liked it.');
  else if (calls >= 1) parts.push('I know I didn’t ring every day. I meant to.');
  else parts.push('I know I didn’t ring. I kept meaning to.');
  if (s.chosen['dinner-3'] === 'truth') parts.push('You asked if I was eating. I’m trying.');
  if ((s.flags.shelf ?? 0) >= 2) parts.push('I finished the shelf. It’s not straight.');
  else if ((s.flags.shelf ?? 0) === 1) parts.push('I started the shelf. Finally.');
  if (s.flags.ownedMistake) parts.push('I messed up at work and said so.');
  parts.push('Anyway. Love you. That’s it.');
  return parts.join(' ');
}

/** Saturday closes what the week opened, in a line each. */
function threadsOf(s: GameState): string[] {
  const f = s.flags;
  const ch = s.chosen;
  const out: string[] = [];
  if (ch['shadow-4'] === 'stay')
    out.push('Ece has her own columns now. She sends Dilan a photo of them every morning.');
  else if (ch['shadow-4'] === 'go') out.push('Ece never asked to shadow her again. She asked Murat.');
  else if (f.eceBlamed && ch['ece-4'] !== 'tell') out.push('Ece still thinks it was her scanner.');
  else if (ch['ece-1'] === 'talk')
    out.push('Ece knows the new estate now. She knows who talked her round it.');
  if ((f.lied ?? 0) > 0 && (f.lateDays ?? 0) >= 2)
    out.push('Murat stopped asking about the ring road. That was worse.');
  else if ((f.lateDays ?? 0) >= 2 && !f.lied)
    out.push('Murat’s note says late twice. In pen. It also says reliable.');
  if (ch['shelf-4'] === 'aylin')
    out.push('Aylin came round on Saturday for the shelf. There was still cake.');
  else if ((f.shelf ?? 0) === 0)
    out.push('The screws are still in their little bag. March is a long time ago now.');
  if (ch['gymgo-5'] === 'gym') out.push('The gym bag is by the door again. On purpose.');
  if (f.sent === 'send' || f.sent === 'call')
    out.push('She changed the lock screen. The beach can stay in the album.');
  else out.push('The beach photo is still the lock screen.');
  return out;
}

function finalPage(s: GameState): Final {
  const p = s.person;
  const first = s.pages[0]?.hands ?? { you: 0.45, pull: 0.62 };
  const unasked = [...new Set(s.pages.flatMap((pg) => pg.turnedAlone))];
  const sent = s.flags.sent ?? 'delete';
  const line =
    sent === 'send'
      ? 'Mum replied with a voice note eleven minutes long.'
      : sent === 'call'
        ? 'They talked until the kettle went cold.'
        : 'She deleted it. On Sunday she rang anyway.';
  return {
    note: voiceNote(s),
    threads: threadsOf(s),
    sent,
    phrases: phrasesOf(s),
    unasked,
    strip: s.pages.map((pg) => ({ day: pg.day, kept: pg.kept, missed: pg.missed })),
    hands: { start: first, end: { you: trustOf(p, YOU), pull: trustOf(p, PULL) } },
    line,
  };
}

// ---------- saves and replays ----------

export function cloneState(s: GameState): GameState {
  return { ...structuredClone({ ...s, person: null as unknown as Person }), person: snapshot(s.person) };
}

export function restoreState(json: GameState): GameState {
  return { ...structuredClone({ ...json, person: null as unknown as Person }), person: restore(json.person) };
}

/** Rebuild a run from its seed and input log. */
export function replay(seed: number, inputs: readonly Input[], until?: number): GameState {
  const s = newGame(seed);
  for (const inp of inputs) {
    // A 'next' belongs to the evening: run the day out first, even when it ended on the minute of the last answer.
    while (s.phase === 'day' && (s.minute < inp.at || inp.kind === 'next')) step(s);
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
  return JSON.stringify({
    day: s.day,
    phase: s.phase,
    minute: s.minute,
    chosen: s.chosen,
    pages: s.pages,
    final: s.final,
    now: s.person.now,
    trace: s.person.trace.length,
    rng: s.person.rng,
    trust: s.person.will.voices.map((v) => [v.voiceId, v.trust]),
  });
}

/**
 * The minute the next card can open, or null when no card is left today (or one is open). Read-only, for UI pacing:
 * mirrors `step`'s opening rule (skip moments whose `when` is false; never before her own clock).
 */
export function nextCardAt(s: GameState): number | null {
  if (s.phase !== 'day' || s.card) return null;
  const c = ctxOf(s);
  for (const id of s.queue) {
    const m = momentById(id);
    if (m.when && !m.when(c)) continue;
    const at = dayStart(s.day) + (typeof m.at === 'function' ? m.at(c) : m.at);
    return Math.max(at, s.person.now);
  }
  return null;
}

/** Run the sim until a card opens, the day ends, or `max` minutes pass (headless and tests). */
export function runToCard(s: GameState, max = 3000): void {
  for (let i = 0; i < max && s.phase === 'day' && !s.card; i++) step(s);
}
