/**
 * The Two Voices UI: plain DOM over the pure sim. The UI reads state and queues inputs; it never changes the sim
 * directly. Real time drives sim minutes, continuously: fast between cards (dead time skipped quickly), strongly
 * slowed while a card is open (never a hard pause), then a short readable beat after each answer.
 */
import { FRAMEWORK_VERSION } from '@adam0white/human-framework';
import { PULL, YOU } from '../sim/dilan.ts';
import { playedFirstWeek } from '../sim/firstweek.ts';
import {
  anotherWeek,
  type CardView,
  canAnotherWeek,
  cardView,
  clock,
  cloneState,
  DAY_NAMES,
  fingerprint,
  GAME_VERSION,
  isEdition,
  LEGACY_VERSION,
  type Lean,
  newGame,
  nextCardAt,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
  trustOf,
  weekdayOf,
  weekOf,
} from '../sim/game.ts';
import type { Answer, Final, GameState, Input, LogLine, Page } from '../sim/types.ts';
import { doneLine, journalLines, type MomentRecord, momentRecords } from './journal.ts';
import { lab } from './lab.ts';
import { answerThoughts, cardThought, finalInputWords, keptWords } from './presentation.ts';
import { replyWords } from './reply.ts';
import { notebookTally } from './tally.ts';

const SAVE = 'murmur-save-v1';
/** Real seconds an open card lasts (its whole window). */
const CARD_SECONDS = 32;
/** Real seconds after an answer when the clock runs slowly, so her words can be read. */
const READ_SECONDS = 3;
/** Between cards: the remaining gap shrinks with this time constant (s), never slower than GAP_FLOOR min/s. */
const GAP_TAU = 1.8;
const GAP_FLOOR = 15;
/** How long the day's last answer stays before the evening page turns (ms). */
const TURN_MS = 3000;
const HOLD_MS = 600;

interface Save {
  version?: string;
  seed: number;
  inputs: Input[];
}

const app = document.getElementById('app') as HTMLElement;
let s: GameState | null = null;
let fast = false;
// Presentation preference only; never saved or passed to the simulation.
let showNotebookTally = false;
let raf = 0;
let last = 0;
let carry = 0;
let answeredAt = -1e9;
let hurry = false;
let turnAt = 0;
let view: { key: string; v: CardView } | null = null;
let drawn = { log: '', sheet: '' };
let menuPausedAt: number | null = null;
const journalMarkup = new WeakMap<HTMLElement, string>();
let history: { state: GameState; minute: number; applied: number; records: MomentRecord[] } | null = null;
let toast = '';
let wake: { release(): Promise<void> } | null = null;

// ---------- save ----------

function readSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE);
    const sv = raw ? (JSON.parse(raw) as Save) : null;
    return sv &&
      typeof sv.seed === 'number' &&
      Array.isArray(sv.inputs) &&
      (!sv.version || isEdition(sv.version))
      ? sv
      : null;
  } catch {
    return null;
  }
}
function writeSave() {
  if (!s) return;
  try {
    localStorage.setItem(SAVE, JSON.stringify({ version: s.version, seed: s.seed, inputs: s.inputs }));
  } catch {}
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE);
  } catch {}
}

// ---------- helpers ----------

const esc = (x: string) =>
  x.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** Trust as a 0..1 position on the page (never shown as a number). */
const pos = (t: number) => clamp((t - 0.25) / 0.5, 0, 1);
/** The pull's pencil: its hand grows with her trust in it. */
const pencilStyle = (t: number, growth = 16) =>
  `font-size:${(18 + pos(t) * growth).toFixed(1)}px;--other-voice-angle:${(-1.2 - pos(t) * 1.6).toFixed(2)}deg`;
/** Your ink: heavier and darker as she trusts you. */
const inkStyle = (t: number) =>
  `font-weight:${Math.round(330 + pos(t) * 330)};color:color-mix(in srgb, var(--ink) ${Math.round(48 + pos(t) * 52)}%, var(--ink-soft))`;
/** A hand-drawn stroke: jittered points between two ends, deterministic per key. */
function wob(x1: number, y1: number, x2: number, y2: number, key: number, amp = 1.2): string {
  let d = `M${x1.toFixed(1)} ${y1.toFixed(1)}`;
  const n = 4;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const j = i === n ? 0 : Math.sin(key * 12.9898 + i * 78.233) * amp;
    d += ` L${(x1 + (x2 - x1) * t + j * 0.5).toFixed(1)} ${(y1 + (y2 - y1) * t + j).toFixed(1)}`;
  }
  return d;
}
/** Tally marks in pencil: one to three strokes. */
function tally(marks: number, key: number): string {
  const w = 8 + marks * 7;
  let p = '';
  for (let i = 0; i < marks; i++) {
    const x = 3 + i * 7;
    p += `<path d="${wob(x, 5, x + 4, 17, key + i, 0.6)}"/>`;
  }
  return `<svg class="tally" viewBox="0 0 ${w} 20" width="${w}" height="20" aria-hidden="true">${p}</svg>`;
}
const tick = (key: number) =>
  `<svg class="tick" viewBox="0 0 18 16" width="18" height="16" aria-hidden="true"><path d="M2 9 L7 13 L16 2" transform="rotate(${(Math.sin(key) * 4).toFixed(1)} 9 8)"/></svg>`;
const rule = (key: number) =>
  `<svg class="rule" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true"><path d="${wob(2, 3, 298, 3, key, 1)}"/></svg>`;
const markLink = '<a class="mark" href="https://human.adamwhite.work/">◇ human framework</a>';
/** The same header on every screen: mark, the day and clock (on the day screen), the back-page button. */
const header = (menu = true, when = false) =>
  `<header class="top">${markLink}<span class="when">${when ? '<span class="dayname notebook-text"><span id="dayname" class="long"></span><span id="dayshort" class="short"></span></span><span class="week-label" id="week-label" hidden>second week</span><span class="clock" id="clock"></span>' : ''}</span>${menu ? '<button class="menu-btn" id="menu" aria-label="Game menu">≡</button>' : '<span></span>'}</header>${when ? '<p class="pace" id="pace"></p><p class="kept-words notebook-text" id="kept-words" hidden></p>' : ''}`;
const RANK: Record<Lean, number> = { yes: 4, 'if pushed': 3, later: 2, 'rather not': 1, no: 0 };
const footer = () =>
  '<div class="footer"><a href="https://human.adamwhite.work/games/">◇ All games</a></div>';

/** Her mood about each option, in a few words: never a number, never odds. */
function cue(lean: Lean, pushed: Lean): string {
  if (lean === 'yes') return 'she’s willing';
  if (lean === 'if pushed') return 'she’d grumble';
  if (pushed === 'yes' || pushed === 'if pushed') return 'only with a push';
  if (lean === 'later') return 'she’d put it off';
  return 'she’s against it';
}

function urlSeed(): number | null {
  const v = new URLSearchParams(location.search).get('seed');
  if (v === null || !/^\d+$/.test(v)) return null;
  return Number(v) >>> 0;
}
const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

// ---------- title ----------

export function start() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  title();
}

function title() {
  cancelAnimationFrame(raf);
  lab.screen('title');
  const save = readSave();
  app.innerHTML = `${header(false)}<div class="page title">
    <h1>The Two Voices</h1>
    <p>Accompany Dilan through her week. Your words can change her choices and become her own.</p>
    <details class="about">
      <summary>More about Dilan</summary>
      <p class="soft">an ordinary week, from the inside</p>
      <p>Dilan is thirty-three. She dispatches vans at a courier depot in the town she came back to.</p>
      <p>There are two voices in her head. One is yours. <span class="notebook-text other-voice pencil-inline">The other got there first.</span></p>
    </details>
    <div class="grow"></div>
    <div class="actions">
      ${save ? '<button class="primary" id="cont">Continue the week</button>' : ''}
      <button class="${save ? '' : 'primary'}" id="new">${save ? 'New week' : 'Wake her up'}</button>
      <button class="quiet" id="second" aria-describedby="second-explained">Begin at the second week</button>
      <p class="soft small" id="second-explained">Her first week is played for you, by a quiet voice. You start on Monday of the second.</p>
      <button class="quiet" id="load">Replay a run file</button>
      <input type="file" id="file" accept="application/json,.json" hidden />
    </div>
    ${footer()}
  </div>`;
  document.getElementById('cont')?.addEventListener('click', () => {
    if (!save) return;
    s = replay(save.seed, save.inputs, undefined, save.version ?? LEGACY_VERSION);
    enter();
  });
  document.getElementById('new')?.addEventListener('click', () => newWeek(urlSeed() ?? randomSeed()));
  document.getElementById('second')?.addEventListener('click', () => {
    s = anotherWeek(playedFirstWeek(urlSeed() ?? randomSeed()));
    writeSave();
    enter();
  });
  bindImport(document.getElementById('load'), document.getElementById('file'));
}

function newWeek(seed: number, version = GAME_VERSION) {
  clearSave();
  s = newGame(seed, version);
  writeSave();
  enter();
}

function bindImport(btn: HTMLElement | null, input: HTMLElement | null) {
  const file = input as HTMLInputElement | null;
  if (!btn || !file) return;
  btn.addEventListener('click', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    if (!f) return;
    try {
      const ex = JSON.parse(await f.text()) as {
        game?: string;
        version?: string;
        seed: number;
        inputs: Input[];
        state?: GameState;
      };
      if (typeof ex.seed !== 'number' || !Array.isArray(ex.inputs)) throw new Error('not a run');
      const version = ex.version ?? ex.state?.version ?? LEGACY_VERSION;
      if (!isEdition(version) || (ex.version && ex.state?.version && ex.version !== ex.state.version))
        throw new Error('unknown or conflicting edition');
      const until = ex.state?.minute;
      const r = replay(ex.seed, ex.inputs, until, version);
      // A timeout can end a day without advancing its minute. Include that boundary.
      if (ex.state && ex.state.phase !== 'day' && r.phase === 'day' && r.minute === until) step(r);
      let note = 'Replayed.';
      if (ex.state) {
        let want = '';
        try {
          want = fingerprint(restoreState(ex.state));
        } catch {
          want = fingerprint(ex.state);
        }
        note =
          fingerprint(r) === want
            ? 'Replayed. It matches the file.'
            : 'Replayed, but it differs from the file.';
      }
      s = r;
      writeSave();
      toast = note;
      enter();
    } catch {
      toast = 'That file is not a run from this notebook.';
      if (s) enter();
      else title();
    }
  });
}

function enter() {
  if (!s) return;
  view = null;
  menuPausedAt = null;
  turnAt = 0;
  if (s.phase === 'day') day();
  else if (s.phase === 'evening') evening();
  else ending();
}

// ---------- the day ----------

function day() {
  if (!s) return;
  lab.screen(`day ${s.day}`);
  requestWake();
  drawn = { log: '', sheet: '' };
  hurry = false;
  app.innerHTML = `<div class="day" id="dayroot">
    ${header(true, true)}
    ${toast ? `<div class="toast" id="toast">${esc(toast)}</div>` : ''}
    <div class="journal" id="journal"></div>
    <div class="sr-only" id="journal-live" aria-live="polite" aria-atomic="true"></div>
    <div class="sheet" id="sheet"></div>
  </div>`;
  if (toast) {
    const t = toast;
    setTimeout(() => {
      if (toast === t) toast = '';
      document.getElementById('toast')?.remove();
    }, 4000);
  }
  document.getElementById('menu')?.addEventListener('click', backPage);
  drawDay();
  last = performance.now();
  carry = 0;
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

/** Sim minutes per real second, now. */
function rate(nowMs: number): number {
  if (!s) return 0;
  if (s.card) {
    const win = s.card.closesAt - s.card.openedAt;
    // The card closes on the window's last step: `win` steps after the one that opened it.
    return win / CARD_SECONDS;
  }
  if ((nowMs - answeredAt) / 1000 < READ_SECONDS && !hurry) return 1;
  const next = nextCardAt(s);
  const remaining = next === null ? 1 : Math.max(1, next - s.minute);
  return hurry ? Math.max(60, remaining / 0.5) : Math.max(GAP_FLOOR, remaining / GAP_TAU);
}

function frame(t: number) {
  if (!s) return;
  const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
  last = t;
  if (menuPausedAt !== null) {
    raf = requestAnimationFrame(frame);
    return;
  }
  if (s.phase === 'day') {
    if (fast) {
      if (!s.card) runToCard(s);
    } else {
      carry += dt * rate(t);
      while (carry >= 1 && s.phase === 'day') {
        carry -= 1;
        const had = !!s.card;
        step(s);
        if (had && !s.card) {
          answeredAt = t;
          carry = 0;
          break;
        }
        if (!had && s.card) {
          carry = 0;
          hurry = false;
          break;
        }
      }
    }
    if (s.phase === 'day') drawDay();
  }
  if (s.phase !== 'day') {
    if (turnAt === 0) turnAt = t + (fast ? 0 : TURN_MS);
    drawDay();
    if (t >= turnAt) {
      releaseWake();
      writeSave();
      enter();
      return;
    }
  }
  raf = requestAnimationFrame(frame);
}

function currentView(): CardView | null {
  if (!s?.card) return null;
  const key = `${s.card.moment}@${s.card.openedAt}`;
  if (view?.key !== key) {
    const v = cardView(s);
    if (!v) return null;
    view = { key, v };
  }
  return view.v;
}

function drawDay() {
  if (!s) return;
  const dn = document.getElementById('dayname');
  const ck = document.getElementById('clock');
  if (dn) dn.textContent = DAY_NAMES[s.day] ?? '';
  const ds = document.getElementById('dayshort');
  if (ds) ds.textContent = (DAY_NAMES[s.day] ?? '').slice(0, 3);
  if (ck) ck.textContent = clock(s.minute);
  const week = document.getElementById('week-label');
  if (week) week.hidden = weekOf(s.day) !== 2;
  const margin = document.getElementById('kept-words');
  const words = keptWords(s);
  if (margin) {
    margin.hidden = !words;
    margin.textContent = words ? `She kept “${words}”` : '';
  }
  const shown = journalLines(s);
  const logKey = `${shown.length}:${s.card?.openedAt ?? ''}:${s.applied}:${doneLine(s) ? 1 : 0}`;
  if (drawn.log !== logKey) {
    drawn.log = logKey;
    drawJournal(shown);
  }
  document.getElementById('dayroot')?.classList.toggle('has-card', !!s.card);
  const key = s.card
    ? `card:${s.card.moment}:${s.card.openedAt}`
    : `gap:${s.answer?.moment ?? ''}:${s.answer?.at ?? ''}:${doneLine(s, s.answer) ? 1 : 0}`;
  if (drawn.sheet !== key) {
    drawn.sheet = key;
    drawSheet();
    // The sheet's new height moves the journal's bottom; keep the latest line in view.
    const j = document.getElementById('journal');
    if (j) j.scrollTop = j.scrollHeight;
  }
  const pace = document.getElementById('pace');
  if (pace) {
    const now = performance.now();
    const speed = rate(now);
    const amount = speed < 1 ? speed.toFixed(2) : speed.toFixed(0);
    const mode = s.card ? 'choice waiting' : speed === 1 ? 'reading her reply' : 'between moments';
    pace.textContent =
      s.phase !== 'day'
        ? 'Day ended · clock stopped'
        : `${s.card || speed === 1 ? 'Slow' : 'Fast'} · ${amount} min/s · ${mode}`;
  }
  drawTimer();
}

/** Did the player act (say something, or choose quiet) on the card that opened at `at`? */
function actedOn(at: number, until: number): boolean {
  return !!s?.inputs.some((i) => (i.kind === 'say' || i.kind === 'quiet') && i.at >= at && i.at < until);
}

/** Presentation cache only; the records are reconstructed without changing the simulation. */
function records(): MomentRecord[] {
  if (!s) return [];
  if (history?.state !== s || history.minute !== s.minute || history.applied !== s.applied) {
    history = { state: s, minute: s.minute, applied: s.applied, records: momentRecords(s) };
  }
  return history.records;
}

function recordHtml(record: MomentRecord): string {
  const yours = record.said
    ? `You suggested${record.insisted ? ' · you insisted' : ''}: “${esc(record.said.ink)}”`
    : record.quiet === 'explicit'
      ? 'You chose to say nothing.'
      : 'You said nothing · time ran out.';
  const a = record.answer;
  const reply = s ? replyWords(s, a) : undefined;
  const how =
    a.said && a.said !== a.chosen
      ? a.verdict === 'deferred'
        ? s?.version === '0.4.2'
          ? 'She chose this instead.'
          : 'She put yours off, so the pencil’s way, for now.'
        : a.pullWon
          ? 'She didn’t. She went the pencil’s way.'
          : 'She didn’t. She did something else.'
      : '';
  return `<p class="record-yours">${yours}</p><p class="record-chosen">She chose: “${esc(record.chosen.ink)}”</p>${reply ? `<p class="record-reply her notebook-text">“${esc(reply)}” <span class="who">she says</span></p>` : ''}${how ? `<p class="turn small${how.includes('pencil') ? ' notebook-text other-voice' : ''}">${how}</p>` : ''}${thoughtHtml(a)}${a.learned ? `<p class="margin notebook-text">She took it as “${esc(a.learned)}.” She kept that one.</p>` : ''}`;
}

function drawJournal(lines: LogLine[]) {
  if (!s) return;
  const el = document.getElementById('journal');
  if (!el) return;
  const scenes = lines.filter((l) => l.who === 'scene').map((l) => l.at);
  const past = new Map(records().map((record) => [record.sceneAt, record]));
  const head =
    lines.length === 0
      ? `<p class="jhead notebook-text">${esc(DAY_NAMES[s.day] ?? '')}${weekOf(s.day) === 2 ? ' <span class="week-label">second week</span>' : ''}</p>`
      : '';
  const entries: { key: string; html: string }[] = [];
  if (head) entries.push({ key: 'head', html: head });
  for (const l of lines) {
    const key = `line:${s.log.indexOf(l)}`;
    if (l.who === 'scene') {
      const next = scenes.find((x) => x > l.at) ?? Number.POSITIVE_INFINITY;
      const record = past.get(l.at);
      const away = record ? record.quiet === 'timeout' : !actedOn(l.at, next);
      const stamp = /^\d\d:\d\d/.test(l.text) ? '' : `<span class="jt">${clock(l.at)}</span> `;
      entries.push({
        key,
        html: `${away ? '<p class="away">while you were away</p>' : ''}<p class="jl jscene">${stamp}${esc(l.text)}</p>`,
      });
      if (record) {
        const template = document.createElement('template');
        template.innerHTML = recordHtml(record);
        const counts = new Map<string, number>();
        for (const paragraph of template.content.children) {
          const role = paragraph.className;
          const index = counts.get(role) ?? 0;
          counts.set(role, index + 1);
          entries.push({ key: `record:${record.sceneAt}:${role}:${index}`, html: paragraph.outerHTML });
        }
      }
    } else {
      const html =
        l.who === 'pull'
          ? `<p class="jl pencil other-voice">${esc(l.text)}</p>`
          : l.who === 'dilan'
            ? `<p class="jl notebook-text her">“${esc(l.text.replace(/\.$/, ''))}.”</p>`
            : `<p class="jl ${l.who === 'you' ? 'yours' : 'n'}"><span class="jt">${clock(l.at)}</span> ${esc(l.text)}</p>`;
      entries.push({ key, html });
    }
  }
  // Keep existing nodes: a new arrival must not replay old highlights or announcements.
  const initial = el.dataset.ready !== 'true';
  const existing = new Map(
    [...el.children].map((node) => [(node as HTMLElement).dataset.key, node as HTMLElement]),
  );
  const announcements: string[] = [];
  for (const entry of entries) {
    let node = existing.get(entry.key);
    if (!node) {
      node = document.createElement('div');
      node.className = 'journal-entry';
      node.dataset.key = entry.key;
    }
    existing.delete(entry.key);
    if (journalMarkup.get(node) !== entry.html) {
      node.innerHTML = entry.html;
      journalMarkup.set(node, entry.html);
      if (!initial) {
        node.classList.add('journal-new');
        node.addEventListener('animationend', () => node?.classList.remove('journal-new'), { once: true });
        announcements.push(node.textContent ?? '');
      }
    }
    const position = entries.indexOf(entry);
    if (el.children[position] !== node) el.insertBefore(node, el.children[position] ?? null);
  }
  for (const node of existing.values()) node.remove();
  el.dataset.ready = 'true';
  if (announcements.length) {
    const live = document.getElementById('journal-live');
    if (live) live.textContent = announcements.join(' ');
  }
  el.scrollTop = el.scrollHeight;
}

function drawSheet() {
  if (!s) return;
  const el = document.getElementById('sheet');
  if (!el) return;
  const v = currentView();
  if (v && s.card) {
    el.className = 'sheet open';
    el.innerHTML = cardHtml(v);
    for (const b of el.querySelectorAll<HTMLButtonElement>('button.opt')) bindHold(b);
    const silence = document.getElementById('hush');
    if (silence) bindSilence(silence);
    return;
  }
  el.className = 'sheet';
  el.innerHTML = gapHtml(s.answer);
  document.getElementById('hurry')?.addEventListener('click', () => {
    hurry = true;
    answeredAt = -1e9;
  });
}

function cardHtml(v: CardView): string {
  if (!s) return '';
  const recalled = cardThought(s, v);
  const p = s.person;
  const tYou = trustOf(p, YOU);
  const tPull = trustOf(p, PULL);
  const first = s.day === 1 && v.id === 'alarm-1';
  // Holding helps only while she trusts you enough; when a hold would land worse than a tap, say so in words.
  const pushSore = v.options.some((o) => RANK[o.pushed] < RANK[o.lean]);
  const hint = pushSore
    ? 'She’s had enough of being pushed. A hold now lands worse than a word.'
    : (v.hint ?? (first ? 'Tap one to say it.' : undefined));
  const pull = `<p class="pull notebook-text other-voice${v.borrowed ? ' borrowed' : ''}" style="${pencilStyle(tPull, 6)}">${esc(v.pullLine)}</p>`;
  const resolve = v.resolve
    ? `<p class="resolve">${tally(v.resolve.marks, v.id.length)}<span class="notebook-text">${esc(v.resolve.line)}</span></p>`
    : '';
  const forecast = v.forecast ? `<p class="thought notebook-text">${esc(v.forecast)}</p>` : '';
  const opts = v.options
    .map(
      (o) =>
        `<button class="opt" data-o="${esc(o.id)}" aria-keyshortcuts="Shift+Enter" title="Tap to suggest; hold or Shift+Enter to insist."><span class="fill"></span><span class="ink" style="${inkStyle(tYou)}">${esc(o.ink)}</span><span class="lean notebook-text">${esc(o.mood ?? cue(o.lean, o.pushed))}</span>${first && RANK[o.pushed] > RANK[o.lean] ? '<span class="gesture">hold to insist · costs trust</span>' : ''}</button>`,
    )
    .join('');
  return `<div class="card ink-in">
    <div class="timerrow"><svg class="timer" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true"><path id="timer" pathLength="100" d="${wob(2, 3, 298, 3, v.id.length, 1)}"/></svg><span class="caption time-left" id="time-left"></span></div>
    <div class="card-text">
      <p class="scene">${esc(v.scene)}</p>
      ${resolve}${forecast}${pull}${recalled ? `<p class="stayed notebook-text">“${esc(recalled)}” <span class="who">she thinks</span></p>` : ''}
      ${first && !v.borrowed ? '<p class="caption notebook-text other-voice">the pencil is the other voice</p>' : ''}
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </div>
    <div class="opts">${first ? '<p class="caption right">the small words are her mood about each</p>' : ''}${opts}
      <button class="hush" id="hush">say nothing</button>
    </div>
  </div>`;
}

function drawTimer() {
  if (!s?.card) return;
  const el = document.getElementById('timer');
  if (!el) return;
  const win = Math.max(1, s.card.closesAt - s.card.openedAt);
  const left = clamp((s.card.closesAt - s.minute + 1 - (fast ? 0 : carry)) / win, 0, 1);
  el.setAttribute('stroke-dasharray', `${(left * 100).toFixed(1)} 100`);
  const time = document.getElementById('time-left');
  if (time)
    time.textContent = fast
      ? 'She’s waiting for your words'
      : `She decides in ${Math.max(1, Math.ceil(left * CARD_SECONDS))}s`;
}

/** Only pacing controls remain below the journal after a decision. */
function gapHtml(a: Answer | null): string {
  if (!s) return '';
  if (!a) {
    return `<div class="gap"><p class="soft">${s.day === 1 ? 'Her alarm is about to go.' : 'The day starts.'}</p></div>`;
  }
  return '<div class="gap-actions"><p class="caption">The clock keeps running.</p><button class="quiet" id="hurry">Let time pass faster ▸</button></div>';
}

/** These are her reported thoughts, not a promise to agree next time. */
function thoughtHtml(answer: Answer): string {
  return (s ? answerThoughts(s, answer, records()) : [])
    .map((line) => `<p class="stayed notebook-text">“${esc(line)}” <span class="who">she thinks</span></p>`)
    .join('');
}

/** A release must belong to this control on this exact card, including silence. */
function bindSilence(button: HTMLElement) {
  const card = s?.card;
  let down = false;
  const current = () => button.isConnected && s?.card === card;
  const cancel = () => {
    down = false;
  };
  button.addEventListener('pointerdown', (event) => {
    down = event.button === 0 && event.isPrimary && current();
  });
  button.addEventListener('pointerleave', cancel);
  button.addEventListener('pointercancel', cancel);
  button.addEventListener('pointerup', (event) => {
    const answer = event.isPrimary && down && current();
    cancel();
    if (answer) hush();
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0 && current()) hush();
  });
}

function bindHold(b: HTMLButtonElement) {
  let timer = 0;
  let fired = false;
  let down = false;
  const option = b.dataset.o ?? '';
  const card = s?.card;
  const gesture = b.querySelector('.gesture');
  const label = gesture?.textContent ?? '';
  const current = () => b.isConnected && s?.card === card;
  b.addEventListener('contextmenu', (e) => e.preventDefault());
  b.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.isPrimary || !current() || down) return;
    down = true;
    fired = false;
    b.classList.add('holding');
    if (gesture) gesture.textContent = 'insisting… · costs trust';
    timer = window.setTimeout(() => {
      if (!down || !current()) return;
      fired = true;
      b.classList.remove('holding');
      b.classList.add('insisted');
      sayIt(option, true);
    }, HOLD_MS);
  });
  const cancel = () => {
    down = false;
    clearTimeout(timer);
    b.classList.remove('holding');
    if (gesture) gesture.textContent = label;
  };
  b.addEventListener('pointerleave', cancel);
  b.addEventListener('pointercancel', cancel);
  b.addEventListener('pointerup', (e) => {
    if (!e.isPrimary) return;
    const was = down && current();
    cancel();
    if (was && !fired) sayIt(option, false);
  });
  // Keyboard: Enter or Space says it; Shift+Enter insists.
  b.addEventListener('click', (e) => {
    if (e.detail === 0 && current()) sayIt(option, e.shiftKey);
  });
}

/** Say nothing, now: she decides with only the pull. */
function hush(): Answer | null {
  if (menuPausedAt !== null || s?.phase !== 'day' || !s.card) return null;
  queueInput(s, { kind: 'quiet' });
  writeSave();
  answeredAt = performance.now();
  carry = 0;
  const a = s.answer;
  if (fast) runToCard(s);
  drawDay();
  return a;
}

function sayIt(option: string, insist: boolean): Answer | null {
  if (menuPausedAt !== null || s?.phase !== 'day' || !s.card) return null;
  queueInput(s, insist ? { kind: 'say', option, insist: true } : { kind: 'say', option });
  writeSave();
  answeredAt = performance.now();
  carry = 0;
  const a = s.answer;
  if (fast) runToCard(s);
  drawDay();
  return a;
}

// ---------- evening ----------

function evening() {
  cancelAnimationFrame(raf);
  if (!s) return;
  const pg = s.pages.at(-1);
  if (!pg) return;
  lab.screen(`day ${s.day}: evening`);
  lab.milestone(`day ${s.day} done`);
  app.innerHTML = `${header()}<div class="page notebook">
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    ${pageHtml(pg)}
    <div class="grow"></div>
    <div class="actions"><button class="primary" id="next">Tomorrow</button></div>
    ${footer()}
  </div>`;
  toast = '';
  document.getElementById('menu')?.addEventListener('click', backPage);
  document.getElementById('next')?.addEventListener('click', nextDay);
}

function pageHtml(pg: Page): string {
  const k = pg.day * 7;
  const kept = pg.kept.map((x, i) => `<li class="kept">${tick(k + i)} ${esc(x)}</li>`).join('');
  const missed = pg.missed.map((x) => `<li class="missed"><s>${esc(x)}</s></li>`).join('');
  const resolves = pg.resolves
    .map((r, i) => `<li>${tally(r.marks, k + 3 + i)}<span class="notebook-text">${esc(r.label)}</span></li>`)
    .join('');
  const phrases = pg.phrases
    .map(
      (ph) =>
        `<span class="phrase notebook-text" style="opacity:${(0.45 + clamp(ph.weight, 0, 1) * 0.55).toFixed(2)};font-size:${(19 + clamp(ph.weight, 0, 1) * 8).toFixed(0)}px">${esc(ph.text)}</span>`,
    )
    .join('');
  const alone = [...new Set(pg.turnedAlone)]
    .map((x) => `<p class="notebook-text her">I did that one myself. “${esc(x)}.”</p>`)
    .join('');
  return `<h2 class="notebook-text dayhead">${esc(DAY_NAMES[pg.day] ?? '')}, in bed</h2>
    ${rule(k)}
    ${pg.review ? `<p class="review notebook-text">${esc(pg.review)}</p>` : ''}
    <p class="notebook-text her">${esc(pg.herLine)}</p>
    ${alone}
    ${kept || missed ? `<ul class="km">${kept}${missed}</ul>` : ''}
    ${resolves ? `<div class="block"><p class="label">she means to keep</p><ul class="resolves">${resolves}</ul></div>` : ''}
    <div class="block"><p class="label">about you</p><p class="notebook-text to-you${pg.aboutYou === 'Some of what I heard today wasn’t you.' ? ' other-voice' : ''}">${esc(pg.aboutYou)}</p></div>
    ${phrases ? `<div class="block margin-list"><p class="label">in the margin</p><div class="phrases">${phrases}</div></div>` : ''}`;
}

function nextDay() {
  if (s?.phase !== 'evening') return;
  queueInput(s, { kind: 'next' });
  writeSave();
  answeredAt = -1e9;
  if (fast) runToCard(s);
  enter();
}

// ---------- the end ----------

function ending() {
  cancelAnimationFrame(raf);
  if (!s?.final) return;
  const f = s.final;
  lab.screen('ending');
  lab.milestone('ending reached');
  app.innerHTML = `${header()}<div class="page notebook">
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    ${finalHtml(f)}
    <div id="notebook-tally">${notebookTally(s, showNotebookTally)}</div>
    <div class="grow"></div>
    ${canAnotherWeek(s) ? '<div class="continuation"><p class="notebook-text soft">Monday will come round again.</p><button class="primary" id="another">Another week</button></div>' : ''}
    <div class="actions">
      <button class="quiet" id="again">Start over</button>
      <button class="quiet" id="export">Download this run</button>
      <button class="quiet" id="send">Send this run to the notebook</button>
    </div>
    ${footer()}
  </div>`;
  document.getElementById('menu')?.addEventListener('click', backPage);
  toast = '';
  document.getElementById('another')?.addEventListener('click', () => {
    if (!s || !canAnotherWeek(s)) return;
    s = anotherWeek(s);
    writeSave();
    enter();
  });
  document.getElementById('again')?.addEventListener('click', () => newWeek(randomSeed()));
  document.getElementById('export')?.addEventListener('click', download);
  document
    .getElementById('send')
    ?.addEventListener('click', () => lab.openSendDialog({ getRun: () => exportRun() }));
}

function stripHtml(f: Final): string {
  const short = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const strip = f.strip
    .map(
      (d, i) =>
        `<div class="sday"><span class="notebook-text">${short[weekdayOf(d.day)] ?? ''}</span>${d.kept.map((x, j) => `<span class="kept">${tick(i * 5 + j)}${esc(x.replace(/^my /, ''))}</span>`).join('')}${d.missed.map((x) => `<span class="missed"><s>${esc(x.replace(/^my /, ''))}</s></span>`).join('')}</div>`,
    )
    .join('');
  return `<div class="strip">${strip}</div>`;
}

function finalHtml(f: Final): string {
  const firstWeek = s?.past?.[0];
  const secondWeek = s && weekOf(s.day) === 2;
  const phrases = f.phrases
    .map(
      (ph) =>
        `<span class="phrase notebook-text" style="opacity:${(0.45 + clamp(ph.weight, 0, 1) * 0.55).toFixed(2)};font-size:${(19 + clamp(ph.weight, 0, 1) * 8).toFixed(0)}px">${esc(ph.text)}</span>`,
    )
    .join('');
  const unasked = f.unasked.map((x) => `<p class="notebook-text her">${esc(x)}.</p>`).join('');
  const finalInput = s && !secondWeek ? finalInputWords(s, records()) : undefined;
  const sentWord = f.sent === 'send' ? 'sent' : f.sent === 'call' ? 'rang instead' : 'deleted';
  return `<h2 class="notebook-text dayhead">Saturday</h2>
    ${rule(61)}
    ${f.note ? `<div class="voicenote"><p class="label">voice note to Mum, ${sentWord}</p><p class="note">“${esc(f.note)}”</p></div>` : ''}
    ${finalInput ? `<p class="final-input notebook-text">${esc(finalInput)}</p>` : ''}
    <p class="n">${esc(f.line)}</p>
    ${(f.threads ?? []).length > 0 ? `<div class="block threads"><p class="label">and</p>${(f.threads ?? []).map((x) => `<p class="n">${esc(x)}</p>`).join('')}</div>` : ''}
    ${
      firstWeek
        ? `<div class="week-pages"><div class="block first-week"><p class="label">the first week</p><p class="n">${esc(firstWeek.line)}</p>${stripHtml(firstWeek)}</div><div class="block current-week"><p class="label">the second week</p>${stripHtml(f)}</div></div>`
        : `<div class="block current-week"><p class="label">the week</p>${stripHtml(f)}</div>`
    }
    ${phrases ? `<div class="block margin-list"><p class="label">her own words now</p><div class="phrases">${phrases}</div></div>` : ''}
    ${unasked ? `<div class="block"><p class="label">what she did unasked</p>${unasked}</div>` : ''}
    <div class="block hands"><p class="label">two hands</p>${handsHtml(f)}</div>`;
}

/** Two lines whose size shows how the two voices changed over the week. Never a number. */
function handsHtml(f: Final): string {
  const side = (h: { you: number; pull: number }) => {
    const d = pos(h.pull) - pos(h.you);
    return d > 0.08 ? 'pencil' : d < -0.08 ? 'you' : 'even';
  };
  const line = (when: string, h: { you: number; pull: number }, then?: { you: number; pull: number }) => {
    const pencil = `<span class="notebook-text other-voice pencil-inline" style="${pencilStyle(h.pull)}">the pencil</span>`;
    const you = `<span class="ink" style="${inkStyle(h.you)}">you</span>`;
    const now = side(h);
    const still = then && side(then) === now ? ' still' : '';
    const rel =
      now === 'pencil'
        ? `${pencil}${still} wrote bigger than ${you}`
        : now === 'you'
          ? `${you}${still} wrote darker than ${pencil}`
          : `${pencil} and ${you}${still} wrote about the same`;
    return `<p class="handline">${when}, ${rel}.</p>`;
  };
  const firstWeek = s?.past?.[0];
  return (
    (firstWeek ? line('A fortnight ago', firstWeek.hands.start) : '') +
    line('On Monday', f.hands.start) +
    line('By Saturday', f.hands.end, f.hands.start)
  );
}

// ---------- the back page (menu) ----------

function backPage() {
  if (!s) return;
  lab.screen('back page');
  if (menuPausedAt !== null) return;
  menuPausedAt = performance.now();
  const el = document.createElement('div');
  el.className = 'backpage-wrap';
  el.innerHTML = `<div class="backpage ink-in" role="dialog" aria-modal="true" aria-label="Game menu">
    <p class="label">Game menu</p>
    <button class="row" id="bp-export">Download this run</button>
    <button class="row" id="bp-send">Send this run to the notebook</button>
    <button class="row" id="bp-load">Replay a run file</button>
    <input type="file" id="bp-file" accept="application/json,.json" hidden />
    <label class="row"><input type="checkbox" id="bp-tally" ${showNotebookTally ? 'checked' : ''} /> Count my choices at the last page</label>
    <button class="row" id="bp-new">Start a new week</button>
    <button class="row" id="bp-title">Back to the cover</button>
    <p class="soft small">Week ${s.seed}. Edition ${s.version}. Dilan is a person from the Human Framework ${FRAMEWORK_VERSION}; what she says comes from it.</p>
    <button class="primary" id="bp-close">Close</button>
  </div>`;
  const background = [...app.children] as HTMLElement[];
  const previousInert = background.map((node) => node.inert);
  for (const node of background) node.inert = true;
  app.appendChild(el);
  document.getElementById('bp-close')?.focus();
  const close = () => {
    if (!el.isConnected) return;
    el.remove();
    for (const [i, node] of background.entries()) node.inert = previousInert[i] ?? false;
    document.getElementById('menu')?.focus();
    const now = performance.now();
    const paused = now - (menuPausedAt ?? now);
    answeredAt += paused;
    if (turnAt) turnAt += paused;
    last = now;
    menuPausedAt = null;
  };
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  document.getElementById('bp-tally')?.addEventListener('change', (event) => {
    showNotebookTally = (event.target as HTMLInputElement).checked;
    const tally = document.getElementById('notebook-tally');
    if (tally && s) tally.innerHTML = notebookTally(s, showNotebookTally);
  });
  document.getElementById('bp-close')?.addEventListener('click', close);
  document.getElementById('bp-export')?.addEventListener('click', download);
  document
    .getElementById('bp-send')
    ?.addEventListener('click', () => lab.openSendDialog({ getRun: () => exportRun() }));
  document.getElementById('bp-new')?.addEventListener('click', () => {
    close();
    newWeek(randomSeed());
  });
  document.getElementById('bp-title')?.addEventListener('click', () => {
    close();
    writeSave();
    title();
  });
  bindImport(document.getElementById('bp-load'), document.getElementById('bp-file'));
}

function exportRun() {
  if (!s) return null;
  return { game: 'murmur', version: s.version, seed: s.seed, inputs: s.inputs, state: cloneState(s) };
}

function download() {
  const ex = exportRun();
  if (!ex || !s) return;
  const blob = new Blob([JSON.stringify(ex)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `two-voices-${s.seed}-week${weekOf(s.day)}-${(DAY_NAMES[s.day] ?? 'day').toLowerCase()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- phone niceties ----------

async function requestWake() {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request(t: 'screen'): Promise<{ release(): Promise<void> }> };
    };
    if (nav.wakeLock && !wake) wake = await nav.wakeLock.request('screen');
  } catch {}
}
function releaseWake() {
  wake?.release().catch(() => {});
  wake = null;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    writeSave();
    // Away from the page, her day waits for you.
    cancelAnimationFrame(raf);
  } else if (s && s.phase === 'day' && app.querySelector('.day')) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
    requestWake();
  }
});

// ---------- automated playtesters ----------

/**
 * `window.__murmur`. `say` answers the open card; `quiet` says nothing on it, at once; `next` turns the evening page; `skipToCard` lets an open card
 * close in silence, then runs to the next card (or the evening). With `fast` on, nothing waits on real time:
 * gaps are skipped at once and cards stay open until answered or skipped.
 */
export const tester = {
  get state(): GameState | null {
    return s;
  },
  get fast(): boolean {
    return fast;
  },
  set fast(v: boolean) {
    fast = v;
  },
  start(seed?: number, version = GAME_VERSION) {
    newWeek(seed ?? urlSeed() ?? randomSeed(), version);
    return s;
  },
  view(): CardView | null {
    return s?.card ? currentView() : null;
  },
  say(option: string, insist = false) {
    return sayIt(option, insist);
  },
  quiet() {
    return hush();
  },
  next() {
    nextDay();
    return s;
  },
  skipToCard() {
    if (!s) return null;
    if (s.phase === 'day') {
      while (s.card) step(s);
      runToCard(s);
      writeSave();
    }
    if (s.phase === 'day') {
      if (!app.querySelector('.day')) day();
      else drawDay();
    } else enter();
    return s;
  },
};
