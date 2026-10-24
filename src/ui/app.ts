/**
 * The Two Voices UI: plain DOM over the pure sim. The UI reads state and queues inputs; it never changes the sim
 * directly. Real time drives sim minutes, continuously: fast between cards (dead time skipped quickly), strongly
 * slowed while a card is open (never a hard pause), then a short readable beat after each answer.
 */
import { FRAMEWORK_VERSION } from '@adam0white/human-framework';
import { telemetryNotice, telemetryToggle } from '@adam0white/lab-kit';
import { castIntroduction } from '../sim/canonical-cast.ts';
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
import { departureReleaseDescription } from '../sim/one-cast.ts';
import type { Answer, Final, GameState, Input, LogLine, Page } from '../sim/types.ts';
import { canonicalPersonControls, freshCanonicalWeek, heldCanonicalWeek } from './cast-chapter.ts';
import { continuityControls, gateContinuity, installContinuity, invalidateContinuity } from './continuity.ts';
import { showFeedback } from './feedback.ts';
import { doneLine, journalLines, type MomentRecord, momentRecords } from './journal.ts';
import { lab } from './lab.ts';
import {
  checkpoint,
  continuityMessage,
  forkDeparture,
  forkPendingReturn,
  heldReturn,
  initOneCast,
  personaFile,
  recordingState,
  releaseAndCheckpoint,
  returnedChapter,
  validateRun,
} from './one-cast.ts';
import { plainEnglish } from './plain-english.ts';
import {
  answerThoughts,
  cardThought,
  conversationWords,
  finalInputWords,
  quotedWords,
} from './presentation.ts';
import { replyWords } from './reply.ts';
import { notebookTally } from './tally.ts';

const labMode = new URLSearchParams(location.search).get('lab') === '1';

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
  state?: GameState;
}

const notice = telemetryNotice();
if (notice) {
  Object.assign(notice.style, {
    position: 'static',
    transform: 'none',
    margin: '0 auto',
    padding: '6px 12px',
    border: '0',
    background: 'transparent',
    color: 'inherit',
    font: '13px/1.4 system-ui',
  });
}

const app = document.getElementById('app') as HTMLElement;
let s: GameState | null = null;
let loadGeneration = 0;
let finishStartup: () => void = () => {};
const startupReady = new Promise<void>((resolve) => {
  finishStartup = resolve;
});
let fast = false;
let pacing: 'automatic' | 'slow' | 'steady' | 'fast' = 'automatic';
let cardVisibleAt = -1e9;
let screen: 'title' | 'day' | 'evening' | 'end' = 'title';
let feedbackOpen = false;
// Presentation preference only; never saved or passed to the simulation.
let raf = 0;
let last = 0;
let carry = 0;
let answeredAt = -1e9;
let hurry = false;
let turnAt = 0;
let view: { key: string; v: CardView } | null = null;
let drawn = { log: '', sheet: '' };
let menuPausedAt: number | null = null;
let clockHolds = 0;
let activePanel: { kind: 'info' | 'menu'; close: () => void } | null = null;
const journalMarkup = new WeakMap<HTMLElement, string>();
let history: { state: GameState; minute: number; applied: number; records: MomentRecord[] } | null = null;
let toast = '';
let wake: { release(): Promise<void> } | null = null;

// Gate is installed before automatic telemetry obtains a run.
lab.setPersonaRecording('initializing-history');
installContinuity(
  () => recordingState(s),
  () => checkpoint(s, writeSave),
);

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
    const text = JSON.stringify({ version: s.version, seed: s.seed, inputs: s.inputs, state: cloneState(s) });
    localStorage.setItem(SAVE, text);
    lab.captureSave(JSON.parse(text));
  } catch {}
}
function clearSave() {
  try {
    localStorage.removeItem(SAVE);
  } catch {}
}

// ---------- helpers ----------

const esc = (x: string) =>
  plainEnglish(x).replace(
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
const header = (_menu = true, when = false) =>
  `<header class="top"><span class="when">${when || screen !== 'title' ? `<span class="dayname notebook-text"><span id="dayname" class="long">${s ? DAY_NAMES[s.day] : ''}</span><span id="dayshort" class="short">${s ? DAY_NAMES[s.day]?.slice(0, 3) : ''}</span></span> <span class="clock" id="clock">${s ? (screen === 'evening' ? '· in bed' : screen === 'end' ? '· week is done' : clock(s.minute)) : ''}</span><span class="week-label" id="week-label" ${!s || weekOf(s.day) !== 2 ? 'hidden' : ''}> · second week</span>` : '<a href="https://human.adamwhite.work/games/">All games</a>'}</span><div class="top-controls"><button class="info-btn" id="info" aria-label="Information">i</button><button class="menu-btn" id="menu" aria-label="Game menu">≡</button></div></header>${when ? `<div class="state-strip" role="status"><span id="state-words"></span><svg class="timer" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true"><path id="timer" pathLength="100" d="${wob(2, 3, 298, 3, 1, 1)}"/></svg></div>` : ''}`;
const RANK: Record<Lean, number> = { yes: 4, 'if pushed': 3, later: 2, 'rather not': 1, no: 0 };
const credit = () =>
  `<p class="credit soft small">Dilan is a person from the <a href="https://human.adamwhite.work/">Human Framework ${FRAMEWORK_VERSION}</a>.</p>`;

function holdClock() {
  clockHolds++;
  if (menuPausedAt === null) menuPausedAt = performance.now();
  drawStatus();
}
function resumeClock() {
  clockHolds = Math.max(0, clockHolds - 1);
  if (clockHolds) return;
  const now = performance.now();
  const paused = now - (menuPausedAt ?? now);
  answeredAt += paused;
  if (turnAt) turnAt += paused;
  last = now;
  menuPausedAt = null;
  drawStatus();
}
function bindHeader() {
  const toggle = (kind: 'info' | 'menu', open: () => void) => {
    const previous = activePanel;
    previous?.close();
    if (previous?.kind !== kind) open();
  };
  document.getElementById('menu')?.addEventListener('click', () => toggle('menu', backPage));
  document.getElementById('info')?.addEventListener('click', () => toggle('info', infoPage));
}
function overlay(markup: string, className: string, onClose?: () => void) {
  holdClock();
  const previous = document.activeElement as HTMLElement | null;
  const background = [...app.children] as HTMLElement[];
  const inert = background.map((node) => node.inert);
  const dayChildren = background.flatMap((node) =>
    node.matches('.day') ? ([...node.children] as HTMLElement[]) : [],
  );
  const childInert = dayChildren.map((node) => node.inert);
  const el = document.createElement('div');
  el.className = className;
  el.innerHTML = markup;
  for (const node of background) {
    if (!node.matches('.top')) node.inert = true;
    // The day contains its header; leave the header available while holding the rest.
    if (node.matches('.day')) {
      node.inert = false;
      for (const child of node.children) if (!child.matches('.top')) (child as HTMLElement).inert = true;
    }
  }
  app.append(el);
  const close = () => {
    if (!el.isConnected) return;
    el.remove();
    background.forEach((node, i) => {
      node.inert = inert[i] ?? false;
    });
    dayChildren.forEach((node, index) => {
      node.inert = childInert[index] ?? false;
    });
    resumeClock();
    previous?.focus();
    onClose?.();
  };
  el.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
    if (event.key !== 'Tab') return;
    const controls = [
      ...el.querySelectorAll<HTMLElement>('button:not(:disabled), a, input, textarea, summary'),
    ].filter((node) => node.getClientRects().length);
    const first = controls[0],
      last = controls.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  });
  el.addEventListener('click', (event) => {
    if (event.target === el) close();
  });
  el.querySelector<HTMLElement>('[data-close]')?.addEventListener('click', close);
  el.querySelector<HTMLElement>('button, textarea')?.focus();
  return { el, close };
}
function infoPage() {
  const content =
    screen === 'title'
      ? '<h2>Dilan</h2><p>Dilan is thirty-three. She delivers parcels through an Istanbul courier depot.</p><p>There are two voices in her head. One is yours. <span class="notebook-text other-voice pencil-inline">The other got there first.</span></p>'
      : screen === 'day'
        ? '<h2>The two voices</h2><p>Tap a line to suggest it. Hold it to insist; it works only while she trusts you, and it costs trust.</p><p>Say nothing and she decides with only the pencil. The pencil is the other voice.</p><p>The words below each choice show how she feels about it.</p><p>Your ink darkens as she trusts you; the pencil grows as she trusts it.</p><p>Her day slows while she decides and hurries between moments.</p><p class="desktop-only">Shift+Enter insists on the focused line.</p>'
        : screen === 'evening'
          ? '<h2>Her page</h2><p>A tick is something she kept today; a struck line is something she missed.</p><p>Tally marks are things she means to keep.</p><p>“In the margin” holds phrases she is taking as her own; larger means more hers.</p>'
          : '<h2>Saturday</h2><p>These lines compare how much she trusted each voice at the start and end of the week.</p><p>The tally counts what you did: suggestions, holds, silences.</p><p>Another week continues with the same Dilan.</p>';
  const panel = overlay(
    `<section class="info-panel" role="dialog" aria-modal="true" aria-label="Information"><button class="overlay-close" data-close aria-label="Close information">×</button>${content}</section>`,
    'info-wrap',
    () => {
      if (activePanel?.close === panel.close) activePanel = null;
    },
  );
  activePanel = { kind: 'info', close: panel.close };
}
function feedback(returnToMenu = false) {
  if (feedbackOpen) return;
  feedbackOpen = true;
  holdClock();
  showFeedback({
    app,
    lab,
    getRun: exportRun,
    download,
    close: () => {
      feedbackOpen = false;
      resumeClock();
      if (returnToMenu) backPage();
    },
  });
}

/** Her mood about each option, in a few words: never a number, never odds. */
function cue(lean: Lean, pushed: Lean): string {
  if (lean === 'yes') return 'she’s willing';
  if (lean === 'if pushed') return 'she’d grumble';
  if (pushed === 'yes' || pushed === 'if pushed') return 'only with a push';
  if (lean === 'later') return 'she’d put it off';
  return 'she’s against it';
}

function urlSeed(): number | null {
  if (!labMode) return null;
  const v = new URLSearchParams(location.search).get('seed');
  if (v === null || !/^\d+$/.test(v)) return null;
  return Number(v) >>> 0;
}
const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

// ---------- title ----------

export async function start() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  await initOneCast();
  // Do not allow the title's autosend hook to capture a cached continuing run.
  await gateContinuity(recordingState(s));
  lab.trackRun(() => structuredClone(exportRun()), {
    runKey: () => s?.seed ?? 'title',
    getLogs: () => s?.log.slice(-40).map((line) => line.text) ?? [],
  });
  if (!s) title();
  finishStartup();
}

function expireToast() {
  const alert = app.querySelector('.toast');
  if (alert) setTimeout(() => alert.remove(), 4000);
}

function title() {
  feedbackOpen = false;
  clockHolds = 0;
  menuPausedAt = null;
  activePanel = null;
  cancelAnimationFrame(raf);
  releaseWake();
  screen = 'title';
  lab.screen('title');
  const save = readSave();
  let saved: GameState | null = null;
  try {
    saved =
      save?.state ??
      (save ? replay(save.seed, save.inputs, undefined, save.version ?? LEGACY_VERSION) : null);
  } catch {
    toast = 'This notebook is from an older version; start fresh.';
  }
  app.innerHTML = `${header()}<div class="page title"><div class="page-body">
    <h1>Two Voices</h1>
    <p>You are one of the voices in Dilan’s head. Suggest what she should do during her week, from Monday to Saturday. Your words can change her choices.</p>${labMode ? `<p>${esc(castIntroduction())}</p>` : ''}
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    </div>${labMode ? '<div class="other-ways-wrap"><button class="row" id="other-ways">Lab tools <span aria-hidden="true">▸</span></button></div>' : ''}
    <footer class="title-spacer" id="title-spacer"></footer>
    <div class="page-actions actions">
      ${saved ? `<button class="primary" id="cont">Resume · ${esc(DAY_NAMES[saved!.day]?.slice(0, 3) ?? '')} ${clock(saved!.minute)}</button>` : ''}
      ${
        labMode
          ? `<button id="fresh-authored">Play a fresh local week</button>
      <button id="return-shelf">Continue people from this browser</button><button id="held-cast">Resume a held accepted chapter</button><p id="return-status" class="soft small"></p>`
          : ''
      }
      <button class="${save ? '' : 'primary'}" id="new">${save ? 'New game' : 'Start'}</button>
      <div id="new-confirm" hidden><p>Start a new game? This replaces your saved week.</p><div class="confirm-actions"><button id="confirm-new">Start new game</button><button id="cancel-new">Cancel</button></div></div>
      ${labMode ? credit() : ''}
    </div></div>`;
  toast = '';
  bindHeader();
  expireToast();
  if (notice && !notice.dataset.shown) {
    document.getElementById('title-spacer')?.append(notice);
    notice.dataset.shown = '1';
  }
  document.getElementById('cont')?.addEventListener('click', async () => {
    try {
      if (!saved) return;
      const attempt = ++loadGeneration;
      const loaded = await validateRun(saved);
      if (attempt !== loadGeneration) return;
      invalidateContinuity();
      s = loaded;
      await gateContinuity(recordingState(s));
      enter();
    } catch (error) {
      toast = error instanceof Error ? error.message : 'This notebook could not be loaded.';
      title();
    }
  });
  document.getElementById('held-cast')?.addEventListener('click', async () => {
    const attempt = ++loadGeneration;
    try {
      const held = await heldCanonicalWeek();
      if (!held) throw Error('No accepted held chapter is available.');
      if (attempt !== loadGeneration) return;
      invalidateContinuity();
      s = held;
      await gateContinuity(recordingState(s));
      writeSave();
      enter();
    } catch (e) {
      toast = String(e);
      title();
    }
  });
  document.getElementById('new')?.addEventListener('click', () => {
    if (!save) newWeek(urlSeed() ?? randomSeed());
    else {
      document.getElementById('new-confirm')!.hidden = false;
      document.getElementById('new')!.hidden = true;
    }
  });
  document.getElementById('confirm-new')?.addEventListener('click', () => newWeek(urlSeed() ?? randomSeed()));
  document.getElementById('cancel-new')?.addEventListener('click', () => {
    document.getElementById('new-confirm')!.hidden = true;
    document.getElementById('new')!.hidden = false;
  });
  document
    .getElementById('fresh-authored')
    ?.addEventListener('click', () => newWeek(urlSeed() ?? randomSeed(), GAME_VERSION, false));
  document.getElementById('return-shelf')?.addEventListener('click', async () => {
    try {
      const attempt = ++loadGeneration;
      const arrived = await freshCanonicalWeek(urlSeed() ?? randomSeed(), () => attempt === loadGeneration);
      if (attempt !== loadGeneration) return;
      if (!arrived)
        throw new Error('No supported return is on this browser’s shelf. Fresh play remains available.');
      invalidateContinuity();
      s = arrived;
      await gateContinuity(recordingState(s));
      writeSave();
      enter();
    } catch (error) {
      const message = document.getElementById('return-status');
      if (message) message.textContent = error instanceof Error ? error.message : String(error);
    }
  });
  document.getElementById('held-return')?.addEventListener('click', async () => {
    const attempt = ++loadGeneration;
    try {
      const held = await heldReturn();
      if (attempt !== loadGeneration) return;
      invalidateContinuity();
      s = held;
      await gateContinuity(recordingState(s));
      if (attempt !== loadGeneration) return;
      writeSave();
      enter();
    } catch (error) {
      const message = document.getElementById('return-status');
      if (message) message.textContent = String(error);
    }
  });
  document.getElementById('return-fork')?.addEventListener('click', async () => {
    try {
      const attempt = ++loadGeneration;
      const arrived = await forkPendingReturn(() => attempt === loadGeneration);
      if (attempt !== loadGeneration) return;
      if (!arrived) throw new Error('No supported return is available.');
      invalidateContinuity();
      s = arrived;
      await gateContinuity(recordingState(s));
      writeSave();
      enter();
    } catch (error) {
      const message = document.getElementById('return-status');
      if (message) message.textContent = String(error);
    }
  });
  document.getElementById('other-ways')?.addEventListener('click', () => {
    const { el, close } = overlay(
      `<section class="other-ways" role="dialog" aria-modal="true" aria-label="Other ways in"><button data-close aria-label="Close other ways in">×</button><h2>Other ways in</h2><button id="second">Begin at the second week</button><p class="soft small">Her first week is played for you, by a quiet voice. You start on Monday of the second.</p><button id="load">Load a playtest run</button><input type="file" id="file" accept="application/json,.json" hidden /></section>`,
      'backpage-wrap other-ways-overlay',
    );
    el.querySelector('#second')?.addEventListener('click', () => {
      close();
      invalidateContinuity();
      ++loadGeneration;
      s = anotherWeek(playedFirstWeek(urlSeed() ?? randomSeed()));
      void gateContinuity(recordingState(s)).then(() => {
        writeSave();
        enter();
      });
    });
    bindImport(el.querySelector('#load'), el.querySelector('#file'));
  });
}

async function newWeek(seed: number, version = GAME_VERSION, useShelf = true) {
  const attempt = ++loadGeneration;
  invalidateContinuity();
  // Only creation may inspect the shelf. A loaded run never changes underneath play.
  let next: GameState;
  const localDevelopment = ['localhost', '127.0.0.1'].includes(location.hostname);
  try {
    next =
      useShelf && !localDevelopment && version === GAME_VERSION
        ? await freshCanonicalWeek(seed, () => attempt === loadGeneration)
        : newGame(seed, version);
  } catch (error) {
    if (attempt === loadGeneration) {
      toast = error instanceof Error ? error.message : String(error);
      title();
    }
    return;
  }
  if (attempt !== loadGeneration) return;
  clearSave();
  s = next;
  if (!useShelf || localDevelopment) s.castScope = 'local';
  await gateContinuity(recordingState(s));
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
    const attempt = ++loadGeneration;
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
      const r = ex.state ? await validateRun(ex.state) : replay(ex.seed, ex.inputs, until, version);
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
      invalidateContinuity();
      if (attempt !== loadGeneration) return;
      s = r;
      s.fileHistory = true;
      if (s.cast) {
        s.castScope = 'file';
        s.castHeadScopes = {};
      }
      await gateContinuity(recordingState(s), Boolean(r.personaHead));
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
  notice?.remove();
  if (!s) return;
  view = null;
  feedbackOpen = false;
  menuPausedAt = null;
  clockHolds = 0;
  activePanel = null;
  turnAt = 0;
  if (s.phase === 'day') day();
  else if (s.phase === 'evening') evening();
  else ending();
}

// ---------- the day ----------

function day() {
  if (!s) return;
  screen = 'day';
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
  bindHeader();
  expireToast();
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
      carry +=
        dt *
        rate(t) *
        (s.card || hurry || (t - answeredAt) / 1000 < READ_SECONDS
          ? 1
          : { automatic: 1, slow: 0.5, steady: 1, fast: 2 }[pacing]);
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
  fitCard();
  drawStatus();
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
    ? `You${record.insisted ? ' insisted' : ''}: ${esc(quotedWords(record.said.ink))}${record.said.ink === record.chosen.ink ? ' ✓' : ` She chose ${esc(quotedWords(record.chosen.ink))}`}`
    : `You said nothing${record.quiet === 'timeout' ? ' · time ran out' : ''}. She chose ${esc(quotedWords(record.chosen.ink))}`;
  const a = record.answer;
  const reply = s ? replyWords(s, a) : undefined;
  return `<p class="record-yours">${yours}</p>${reply ? `<p class="record-reply her notebook-text">“${esc(reply)}” <span class="who">she says</span></p>` : ''}${thoughtHtml(a)}${a.learned ? `<p class="margin notebook-text">She took it as “${esc(a.learned)}.” She kept that one.</p>` : ''}`;
}

function drawJournal(lines: LogLine[]) {
  if (!s) return;
  const el = document.getElementById('journal');
  if (!el) return;
  const scenes = lines.filter((l) => l.who === 'scene').map((l) => l.at);
  const past = new Map(records().map((record) => [record.sceneAt, record]));
  const entries: { key: string; html: string }[] = [];
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
            ? `<p class="jl notebook-text her">“${esc(plainEnglish(l.text).replace(/\.$/, ''))}.”</p>`
            : `<p class="jl ${l.who === 'you' ? 'yours' : 'n'}"><span class="jt">${clock(l.at)}</span> ${esc(l.who === 'narrator' ? conversationWords(s, l.text) : l.text)}</p>`;
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

function fitCard() {
  if (!s?.card || !matchMedia('(max-width: 699px)').matches) return;
  const journal = document.getElementById('journal');
  const text = app.querySelector<HTMLElement>('.card-text');
  if (!journal || !text) return;
  const overflow = text.scrollHeight - text.clientHeight;
  if (overflow > 0) {
    journal.style.flexBasis = `${clamp(journal.getBoundingClientRect().height - overflow, 64, 112)}px`;
  }
}

function drawSheet() {
  document.getElementById('journal')?.style.removeProperty('flex-basis');
  if (!s) return;
  const el = document.getElementById('sheet');
  if (!el) return;
  const v = currentView();
  if (v && s.card) {
    el.className = 'sheet open';
    cardVisibleAt = performance.now();
    el.innerHTML = cardHtml(v);
    for (const b of el.querySelectorAll<HTMLButtonElement>('button.opt')) bindHold(b);
    const silence = document.getElementById('hush');
    if (silence) bindSilence(silence);
    return;
  }
  el.className = 'sheet';
  el.innerHTML = gapHtml(s.answer);
  document.getElementById('hurry')?.addEventListener('click', () => {
    if (s?.card || s?.phase !== 'day') return;
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
    ? 'She resists pressure now. Holding a choice works worse than tapping it.'
    : (v.hint ?? (first ? 'Tap one to say it.' : undefined));
  const pull = `<p class="pull notebook-text other-voice${v.borrowed ? ' borrowed' : ''}" style="${pencilStyle(tPull, 6)}">${esc(v.pullLine)}</p>`;
  const resolve = v.resolve
    ? `<p class="resolve">${tally(v.resolve.marks, v.id.length)}<span class="notebook-text">${esc(v.resolve.line)}</span></p>`
    : '';
  const forecast = v.forecast ? `<p class="thought notebook-text">${esc(v.forecast)}</p>` : '';
  const opts = v.options
    .map(
      (o) =>
        `<button class="opt" data-o="${esc(o.id)}" aria-keyshortcuts="Shift+Enter" title="Tap to suggest; hold or Shift+Enter to insist."><span class="fill"></span><span class="ink" style="${inkStyle(tYou)}">${esc(o.ink)}</span><span class="lean notebook-text">${esc(o.mood ?? cue(o.lean, o.pushed))}</span>${first && RANK[o.pushed] > RANK[o.lean] ? '<span class="gesture">Hold to insist. This costs trust.</span>' : ''}</button>`,
    )
    .join('');
  return `<div class="card ink-in">
    <div class="card-text">
      <p class="scene">${esc(v.scene)}</p>
      ${resolve}${forecast}${pull}${recalled ? `<p class="stayed notebook-text">“${esc(recalled)}” <span class="who">she thinks</span></p>` : ''}
      ${first && !v.borrowed ? '<p class="caption notebook-text other-voice">The handwriting shows the other voice.</p>' : ''}
      ${hint ? `<p class="hint">${esc(hint)}</p>` : ''}
    </div>
    <div class="opts card-actions">${first ? '<p class="caption right">Below each choice, you can see how she feels about it.</p>' : ''}${opts}
      <button class="hush" id="hush">Say nothing</button>
    </div>
  </div>`;
}

function drawStatus() {
  const words = document.getElementById('state-words');
  const el = document.getElementById('timer');
  if (!words || !el || !s) return;
  let left = 0;
  if (s.card) {
    const win = Math.max(1, s.card.closesAt - s.card.openedAt);
    left = clamp((s.card.closesAt - s.minute + 1 - (fast ? 0 : carry)) / win, 0, 1);
  }
  el.setAttribute('stroke-dasharray', `${(left * 100).toFixed(1)} 100`);
  el.closest('svg')?.toggleAttribute('hidden', !s.card);
  el.classList.toggle('urgent', left * CARD_SECONDS <= 8);
  words.textContent =
    menuPausedAt !== null
      ? 'Her day waits'
      : s.phase !== 'day'
        ? 'The day is done'
        : s.card
          ? left * CARD_SECONDS <= 8
            ? "She's about to decide"
            : "She's deciding"
          : hurry
            ? 'Her day is moving quickly'
            : (performance.now() - answeredAt) / 1000 < READ_SECONDS
              ? "She's answering"
              : '';
}

function gapHtml(a: Answer | null): string {
  if (!s) return '';
  if (!a || !journalLines(s).some((line) => line.who === 'scene')) {
    return `<div class="gap"><p class="soft">${s.day === 1 ? 'Her alarm is about to go.' : 'The day starts.'}</p></div>`;
  }
  return '<div class="gap-actions"><p class="soft desktop-only">Her day runs on. The next moment will open here.</p><button class="quiet" id="hurry" aria-label="Skip to the next event">Skip ⏩</button></div>';
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
  const current = () => button.isConnected && s?.card === card && performance.now() - cardVisibleAt >= 300;
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
  const current = () => b.isConnected && s?.card === card && performance.now() - cardVisibleAt >= 300;
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
  screen = 'evening';
  lab.screen(`day ${s.day}: evening`);
  lab.milestone(`day ${s.day} done`);
  app.innerHTML = `${header()}<div class="page notebook">
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    <div class="page-body">${pageHtml(pg)}</div>
    <div class="page-actions actions"><button class="primary" id="next">On to ${esc(DAY_NAMES[s.day + 1] ?? 'Saturday')}</button></div>
  </div>`;
  toast = '';
  bindHeader();
  expireToast();
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
  screen = 'end';
  lab.screen('ending');
  lab.milestone('ending reached');
  app.innerHTML = `${header()}<div class="page notebook">
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    <div class="page-body">${finalHtml(f)}
    ${
      s.returnChapter
        ? `<section><h2 class="notebook-text">Back from the garden</h2><p>${esc(s.log.findLast((line) => line.text.startsWith('Back from the garden.'))?.text ?? '')}</p><p>The previous week stays in this notebook. Another week continues from this new chapter.</p></section>`
        : s.version === '0.5.0'
          ? `<section><h2 class="notebook-text">A short visit</h2><p>The route week is over. Dilan can visit Hatice’s tea garden in Istanbul. Aylin is still her sister; Mum, Ece and depot Murat remain her own relations, distinct from the garden’s namesakes.</p><p>She will explicitly set aside these unfinished purposes for the visit: ${esc(
              departureReleaseDescription(s).join(', ') || 'none',
            )}. The unfinished shelf stays at home for this visit. These purposes become new intentions on her return; their earlier progress stays in this week’s record. Dated alarm, dinner and call promises remain in the week’s record; unresolved promises block departure. No success is invented.</p><button id="depart">Set aside unfinished purposes and make the visit</button>${labMode ? '<button id="depart-fork">Explicitly fork this competing departure</button>' : ''}<p id="departure-status" role="status">${esc(continuityMessage())}</p><a href="https://hearsay.adamwhite.work/">Visit Hearsay</a></section>`
          : ''
    }
    <details class="final-tally"><summary>See the tally</summary><div id="notebook-tally">${notebookTally(s, true)}</div></details>
    ${canAnotherWeek(s) ? '<p class="notebook-text soft">Monday will come round again.</p>' : ''}</div>
    <div class="page-actions actions end-actions">
      <div class="action-pair"><button id="send">Feedback</button>${labMode ? '<button id="export">Download this run</button>' : ''}</div>
      <button class="${canAnotherWeek(s) ? '' : 'primary'}" id="again">New game</button><div id="end-confirm" hidden><p>Start a new game? This replaces your saved week.</p><button id="end-confirm-new">Start new game</button><button id="end-cancel-new">Cancel</button></div>
      ${canAnotherWeek(s) ? '<button class="primary" id="another">Another week</button>' : ''}
    </div></div>`;
  bindHeader();
  expireToast();
  toast = '';
  document.getElementById('depart')?.addEventListener('click', async () => {
    try {
      if (!s) return;
      await releaseAndCheckpoint(s, writeSave);
      document.getElementById('departure-status')!.textContent =
        continuityMessage() || 'Her visit is saved. Continue to the tea garden to meet her there.';
    } catch (error) {
      document.getElementById('departure-status')!.textContent = String(error);
    }
  });
  document.getElementById('depart-fork')?.addEventListener('click', async () => {
    try {
      if (!s) return;
      await forkDeparture(s, writeSave);
      document.getElementById('departure-status')!.textContent = continuityMessage();
    } catch (error) {
      document.getElementById('departure-status')!.textContent = String(error);
    }
  });
  void checkpoint(s, writeSave);
  document.getElementById('another')?.addEventListener('click', () => {
    if (!s || !canAnotherWeek(s)) return;
    s = anotherWeek(s);
    void gateContinuity(recordingState(s));
    writeSave();
    enter();
  });
  document.getElementById('again')?.addEventListener('click', () => {
    document.getElementById('end-confirm')!.hidden = false;
  });
  document.getElementById('end-cancel-new')?.addEventListener('click', () => {
    document.getElementById('end-confirm')!.hidden = true;
  });
  document.getElementById('end-confirm-new')?.addEventListener('click', () => newWeek(randomSeed()));
  document.getElementById('export')?.addEventListener('click', download);
  document.getElementById('send')?.addEventListener('click', () => feedback());
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
    <div class="block hands"><p class="label">Trust in the two voices</p>${handsHtml(f)}</div>`;
}

/** Two lines whose size shows how the two voices changed over the week. Never a number. */
function handsHtml(f: Final): string {
  const side = (h: { you: number; pull: number }) => {
    const d = pos(h.pull) - pos(h.you);
    return d > 0.08 ? 'pencil' : d < -0.08 ? 'you' : 'even';
  };
  const line = (when: string, h: { you: number; pull: number }, then?: { you: number; pull: number }) => {
    const pencil = `<span class="notebook-text other-voice pencil-inline" style="${pencilStyle(h.pull)}">the other voice</span>`;
    const you = `<span class="ink" style="${inkStyle(h.you)}">you</span>`;
    const now = side(h);
    const still = then && side(then) === now ? ' still' : '';
    const rel =
      now === 'pencil'
        ? `she${still} trusted ${pencil} more than ${you}`
        : now === 'you'
          ? `she${still} trusted ${you} more than ${pencil}`
          : `she${still} trusted ${pencil} and ${you} about the same`;
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
  lab.screen('back page');
  const { el, close } = overlay(
    `<section class="backpage" role="dialog" aria-modal="true" aria-label="Game menu">
    <div class="menu-heading"><h2>Game menu${s && screen !== 'title' ? ` · ${esc(DAY_NAMES[s.day]?.slice(0, 3) ?? '')} ${clock(s.minute)}` : ''}</h2><button data-close aria-label="Close game menu">×</button></div>
    ${screen === 'day' ? '<p class="soft small">Her day waits while this is open.</p>' : ''}
    ${labMode ? `<fieldset class="menu-speed"><legend>Pace between moments</legend>${(['automatic', 'slow', 'steady', 'fast'] as const).map((value) => `<button class="chip" data-speed="${value}" aria-pressed="${pacing === value}">${value.charAt(0).toUpperCase() + value.slice(1)}</button>`).join('')}</fieldset>` : ''}
    <button class="row" id="bp-send">Feedback <span aria-hidden="true">▸</span></button>
    <button class="row" id="bp-fullscreen">Full screen</button>
    ${s ? '<button class="row" id="bp-new">New game</button><div id="bp-confirm" hidden><p>Start a new game? This replaces your saved week.</p><button id="bp-confirm-new">Start new game</button><button id="bp-cancel-new">Cancel</button></div>' : ''}
    ${labMode && screen !== 'title' ? '<button class="row" id="bp-title">To the title page</button>' : ''}
    <a class="row" href="https://human.adamwhite.work/games/">All games</a>
    ${labMode ? `<p class="soft small provenance">${s ? `Week ${weekOf(s.day)} · run ${s.seed} · edition ${s.version} · ` : ''}Dilan is from the <a href="https://human.adamwhite.work/">Human Framework ${FRAMEWORK_VERSION}</a></p>` : ''}
    <div class="menu-footer"><div id="menu-recording"></div><a href="https://human.adamwhite.work/lab/privacy/">Lab privacy</a></div>
    <button class="primary" id="bp-close">${screen === 'title' ? 'Close' : 'Resume'}</button>
  </section>`,
    'backpage-wrap',
    () => {
      if (activePanel?.close === close) activePanel = null;
    },
  );
  activePanel = { kind: 'menu', close };
  el.querySelector('#menu-recording')?.append(telemetryToggle(lab));
  if (labMode) el.querySelector('#menu-recording')?.append(continuityControls());
  if (labMode && s?.cast) el.querySelector('#menu-recording')?.append(canonicalPersonControls(s, writeSave));
  const passport = document.createElement('div');
  passport.innerHTML =
    '<button id="passport-export">Download Dilan’s passport</button><button id="passport-import">Import a returned passport</button><button id="passport-fork">Explicitly fork the selected competing return</button><input type="file" id="passport-file" accept=".json" hidden><p id="passport-status" role="status"></p>';
  if (labMode && !s?.cast) el.querySelector('#menu-recording')?.append(passport);
  passport.querySelector('#passport-export')?.addEventListener('click', async () => {
    try {
      if (!s) throw new Error('Play Dilan’s week first.');
      const envelope = await personaFile(s);
      writeSave();
      downloadJSON(envelope, 'dilan-passport.json');
    } catch (error) {
      passport.querySelector('#passport-status')!.textContent = String(error);
    }
  });
  passport
    .querySelector('#passport-import')
    ?.addEventListener('click', () => (passport.querySelector('#passport-file') as HTMLInputElement).click());
  passport.querySelector('#passport-fork')?.addEventListener('click', async () => {
    const attempt = ++loadGeneration;
    try {
      const returned = await forkPendingReturn(() => attempt === loadGeneration);
      if (attempt !== loadGeneration) return;
      if (!returned) throw new Error('No selected competing return.');
      invalidateContinuity();
      s = returned;
      await gateContinuity(recordingState(s), true);
      if (attempt !== loadGeneration) return;
      writeSave();
      close();
      enter();
    } catch (error) {
      const message = passport.querySelector('#passport-status');
      if (message) message.textContent = String(error);
    }
  });
  passport.querySelector('#passport-file')?.addEventListener('change', async (event) => {
    try {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const attempt = ++loadGeneration;
      const returned = await returnedChapter(
        JSON.parse(await file.text()),
        'file',
        false,
        () => attempt === loadGeneration,
      );
      if (attempt !== loadGeneration) return;
      if (!returned) throw new Error('This is not a returned Dilan passport.');
      invalidateContinuity();
      s = returned;
      await gateContinuity(recordingState(s), true);
      writeSave();
      close();
      enter();
    } catch (error) {
      passport.querySelector('#passport-status')!.textContent = String(error);
    }
  });
  el.querySelector('#bp-new')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#bp-confirm')!.hidden = false;
  });
  el.querySelector('#bp-cancel-new')?.addEventListener('click', () => {
    el.querySelector<HTMLElement>('#bp-confirm')!.hidden = true;
  });
  el.querySelector('#bp-confirm-new')?.addEventListener('click', () => {
    close();
    void newWeek(randomSeed());
  });
  el.querySelector('#bp-close')?.addEventListener('click', close);
  el.querySelector('#bp-send')?.addEventListener('click', () => {
    close();
    feedback(true);
  });
  el.querySelector('#bp-title')?.addEventListener('click', () => {
    close();
    writeSave();
    title();
  });
  el.querySelector('#bp-fullscreen')?.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  for (const button of el.querySelectorAll<HTMLButtonElement>('[data-speed]'))
    button.addEventListener('click', () => {
      pacing = button.dataset.speed as typeof pacing;
      for (const item of el.querySelectorAll('[data-speed]'))
        item.setAttribute('aria-pressed', String(item === button));
    });
}

function exportRun() {
  if (!s) return null;
  return {
    game: 'murmur',
    version: s.version,
    seed: s.seed,
    inputs: s.inputs,
    state: cloneState(s),
    oneCast: s.oneCast ?? [],
  };
}

function downloadJSON(value: unknown, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(value)], { type: 'application/json' }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
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
  get ready() {
    return startupReady;
  },
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
    ++loadGeneration;
    // The documented tester start is an explicit fresh authored run, never an automatic arrival.
    invalidateContinuity();
    clearSave();
    s = newGame(seed ?? urlSeed() ?? randomSeed(), version);
    void gateContinuity(recordingState(s));
    writeSave();
    enter();
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
