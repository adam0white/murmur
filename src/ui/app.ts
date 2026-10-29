import { canonicalPersona } from '@adam0white/lab-client';
import { isHf4Edition, requireCurrentEdition, START_FRESH } from '../sim/edition.ts';
/**
 * The Two Voices UI: plain DOM over the pure sim. The UI reads state and queues inputs; it never changes the sim
 * directly. Real time drives sim minutes, continuously: fast between cards (dead time skipped quickly), strongly
 * slowed while a card is open (never a hard pause), then a short readable beat after each answer.
 */

import { PEOPLE_ACROSS_GAMES, telemetryNotice, telemetryToggle } from '@adam0white/lab-kit';
import { castIntroduction } from '../sim/canonical-cast.ts';
import { PULL, YOU } from '../sim/dilan-content.ts';
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
  NEXT_VERSION,
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
import { weekStanding } from '../sim/standing.ts';
import type { Answer, Final, GameState, GameStateSnapshot, Input, LogLine, Page } from '../sim/types.ts';
import { freshCanonicalWeek } from './cast-chapter.ts';
import { gateContinuity, installContinuity, invalidateContinuity } from './continuity.ts';
import { required } from './dom.ts';
import { showFeedback } from './feedback.ts';
import { doneLine, journalLines, type MomentRecord, momentRecords } from './journal.ts';
import { lab } from './lab.ts';
import { assertNotebookState, compactNotebook, expandNotebook, savedLocation } from './notebook.ts';
import {
  checkpoint,
  continuityMessage,
  initOneCast,
  recordingState,
  releaseAndCheckpoint,
  validateRun,
} from './one-cast.ts';
import {
  answerThoughts,
  attributedWords,
  cardThought,
  conversationWords,
  finalInputWords,
  quotedWords,
  sceneWords,
} from './presentation.ts';
import { replyWords } from './reply.ts';
import { notebookTally } from './tally.ts';

declare const __HUMAN_FRAMEWORK_VERSION__: string;

let diagnosticError = '';

const SAVE = 'murmur-save-v1';
/** Real seconds an open card lasts (its whole window). */
const CARD_SECONDS = 64;
/** Real seconds after an answer when the clock runs slowly, so her words can be read. */
const READ_SECONDS = 3;
/** Between cards: the remaining gap shrinks with this time constant (s), never slower than GAP_FLOOR min/s. */
const GAP_TAU = 1.8;
const GAP_FLOOR = 15;
/** How long the day's last answer stays before the evening page turns (ms). */
const TURN_MS = 3000;
const HOLD_MS = 600;

interface Save {
  format?: 'murmur-save/2';
  version?: string;
  seed: number;
  inputs: Input[];
  state?: GameStateSnapshot;
  /** Fraction of the next simulation minute already shown; never changes HF state. */
  clockFraction?: number;
}

const notice = telemetryNotice();
// Keep the notice readable and on one line across host platforms; larger root text still wraps.
if (notice) {
  notice.style.fontSize = 'max(14px, 0.8rem)';
  notice.style.fontFamily = 'Arial, "Liberation Sans", sans-serif';
  notice.style.paddingInline = '2px';
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
let failureRetry: (() => void) | null = null;

function recordFailure(error: unknown, message: string, retry: () => void) {
  console.warn('Two Voices could not complete the action.', error);
  diagnosticError = error instanceof Error ? error.message : String(error);
  toast = message;
  failureRetry = retry;
}
let wake: { release(): Promise<void> } | null = null;

// Gate is installed before automatic telemetry obtains a run.
lab.setPersonaRecording('initializing-history');
installContinuity(
  () => recordingState(s),
  () => checkpoint(s, writeSave),
);

// ---------- save ----------

let olderNotebook: string | null = null;
async function readSave(): Promise<Save | null> {
  olderNotebook = null;
  try {
    const raw = localStorage.getItem(SAVE);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed?.host?.version) requireCurrentEdition(parsed.host.version);
    if (parsed?.version) requireCurrentEdition(parsed.version);
    let sv: Save | null = parsed;
    if (parsed?.format === 'murmur-notebook/1') sv = (await expandNotebook(parsed)) as unknown as Save;
    if (parsed?.format === 'murmur-replay-save/1') {
      const host = parsed.host as Omit<GameStateSnapshot, 'hf'>;
      const rebuilt = replay(
        host.seed,
        host.inputs,
        host.minute,
        host.version,
        host.castChapter,
        host.plainEnglish,
      );
      if (host.phase !== 'day' && rebuilt.phase === 'day') step(rebuilt);
      for (const key of ['castHeads', 'castScope', 'castHeadScopes', 'castSources', 'fileHistory'] as const) {
        if (host[key] !== undefined) Object.assign(rebuilt, { [key]: structuredClone(host[key]) });
      }
      const state = cloneState(rebuilt),
        { hf, ...rebuiltHost } = state;
      if (hf.run.hashes.full !== parsed.hfHash || canonicalPersona(rebuiltHost) !== canonicalPersona(host))
        throw new Error('The saved input checkpoint does not reconstruct exactly.');
      sv = {
        format: 'murmur-save/2',
        version: host.version,
        seed: host.seed,
        inputs: host.inputs,
        state,
        clockFraction: parsed.clockFraction,
      };
    }
    if (sv && 'format' in sv && sv.format !== 'murmur-save/2') throw Error('Unsupported save format.');
    if (
      sv?.format &&
      (!sv.state ||
        sv.version !== sv.state.version ||
        sv.seed !== sv.state.seed ||
        JSON.stringify(sv.inputs) !== JSON.stringify(sv.state.inputs))
    )
      throw Error('Malformed saved notebook.');
    if (!sv) return null;
    if (
      sv.clockFraction !== undefined &&
      (!Number.isFinite(sv.clockFraction) || sv.clockFraction < 0 || sv.clockFraction >= 1)
    )
      throw Error('Malformed saved clock boundary.');
    if (sv.state) assertNotebookState(sv.state);
    if (!Number.isSafeInteger(sv.seed) || !Array.isArray(sv.inputs) || (sv.version && !isEdition(sv.version)))
      throw Error('Unknown or malformed saved edition.');
    return sv;
  } catch (error) {
    if (error instanceof Error && error.message === START_FRESH) olderNotebook = localStorage.getItem(SAVE);
    toast =
      error instanceof Error && error.message === START_FRESH
        ? START_FRESH
        : 'This saved notebook could not be read. It remains in this browser.';
    return null;
  }
}
let saveGeneration = 0;
let latestSave: Promise<void> = Promise.resolve();
function writeSave() {
  if (!s) return;
  const generation = ++saveGeneration;
  try {
    const state = cloneState(s);
    const clockFraction = s.phase === 'day' ? carry % 1 : 0;
    const payload = {
      format: 'murmur-save/2',
      version: s.version,
      seed: s.seed,
      inputs: state.inputs,
      state,
      clockFraction,
    };
    if ('hf' in state) {
      // This explicit intermediate format reconstructs every HF value, including the archive hash.
      // It is written synchronously so a reload during compression cannot lose the last input.
      const { hf, ...host } = state;
      localStorage.setItem(
        SAVE,
        JSON.stringify({
          format: 'murmur-replay-save/1',
          host,
          hfHash: hf.run.hashes.full,
          clockFraction,
        }),
      );
      latestSave = compactNotebook(payload)
        .then((compact) => {
          if (generation === saveGeneration) {
            localStorage.setItem(SAVE, JSON.stringify(compact));
            lab.captureSave(compact);
          }
        })
        .catch((error) => {
          if (generation === saveGeneration)
            diagnosticError = `Full archive compression: ${String(error)}. The exact input checkpoint remains saved.`;
        });
    } else {
      localStorage.setItem(SAVE, JSON.stringify(payload));
      lab.captureSave(payload);
    }
  } catch (error) {
    diagnosticError = `Could not save this input: ${String(error)}`;
    toast = 'This choice could not be saved. Download this run before closing the page.';
  }
}
function clearSave() {
  ++saveGeneration;
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
const header = (_menu = true, when = false) =>
  `<header class="top"><span class="when">${when || screen !== 'title' ? `<span class="dayname notebook-text"><span id="dayname" class="long">${s ? DAY_NAMES[s.day] : ''}</span><span id="dayshort" class="short">${s ? DAY_NAMES[s.day]?.slice(0, 3) : ''}</span></span> <span class="clock" id="clock">${s ? (screen === 'evening' ? '· in bed' : screen === 'end' ? '· week is done' : clock(s.minute)) : ''}</span><span class="week-label" id="week-label" ${!s || weekOf(s.day) < 2 ? 'hidden' : ''}> · ${s && weekOf(s.day) === 3 ? 'third' : 'second'} week</span>` : '<a href="https://human.adamwhite.work/games/">All games</a>'}</span><div class="top-controls"><button class="info-btn" id="info" aria-label="Information">i</button><button class="menu-btn" id="menu" aria-label="Game menu">≡</button></div></header>${when ? `<div class="state-strip" role="status"><span id="state-words"></span><svg class="timer" viewBox="0 0 300 6" preserveAspectRatio="none" aria-hidden="true"><path id="timer" pathLength="100" d="${wob(2, 3, 298, 3, 1, 1)}"/></svg></div>` : ''}`;
const RANK: Record<Lean, number> = { yes: 4, 'if pushed': 3, later: 2, 'rather not': 1, no: 0, unknown: -1 };
const credit = () =>
  `<p class="credit soft small">Dilan is a person from the <a href="https://human.adamwhite.work/">Human Framework ${__HUMAN_FRAMEWORK_VERSION__}</a>.</p>`;

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
  const reading = className === 'info-wrap';
  if (!reading) holdClock();
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
    if (!reading) resumeClock();
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
      ? '<h2>Dilan</h2><p>Dilan is thirty-three. She delivers parcels from a courier depot in Istanbul.</p><p>There are two voices in her head. One is yours. <span class="notebook-text other-voice pencil-inline">The other got there first.</span></p>'
      : screen === 'day'
        ? '<h2>The two voices</h2><p>Tap a choice to suggest it. Press and hold a choice to insist. Insisting works only while she trusts you, and it costs trust.</p><p>Choose “Say nothing” to let her decide without your advice. The pencil handwriting shows the other voice.</p><p>The words below each choice show how she feels about it.</p><p>Your handwriting gets darker as she trusts you more. The pencil handwriting gets larger as she trusts the other voice more.</p><p>You have 64 seconds to read and answer each choice. Time passes faster between choices.</p><p class="desktop-only">Press Shift+Enter to insist on the selected choice.</p>'
        : screen === 'evening'
          ? '<h2>Her page</h2><p>A tick marks something she followed through on today. A crossed-out line marks something she missed.</p><p>Tally marks show things she intends to follow through on.</p><p>“Words she is starting to use” lists phrases she is learning. Larger handwriting means a phrase has become more familiar to her.</p>'
          : '<h2>Saturday</h2><p>These lines compare how much she trusted each voice at the start and end of the week.</p><p>The tally counts your suggestions, times you insisted, and times you chose to say nothing.</p><p>Another week continues with the same Dilan.</p>';
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
    getRun: compactRun,
    feedbackChoices: true,
    close: () => {
      feedbackOpen = false;
      resumeClock();
      if (returnToMenu) backPage();
    },
  });
}

/** Her mood about each option, in a few words: never a number, never odds. */
function cue(lean: Lean, pushed: Lean): string {
  if (lean === 'unknown') return 'She has not formed a view yet.';
  if (lean === 'yes') return 'She is willing.';
  if (lean === 'if pushed') return 'She might agree, but she would not like it.';
  if (pushed === 'yes' || pushed === 'if pushed') return 'She would agree only if you insist.';
  if (lean === 'later') return 'She wants to do it later.';
  return 'She is against it.';
}

let debugSeed = '';
function selectedSeed(): number | null {
  if (!/^\d+$/.test(debugSeed)) return null;
  const seed = Number(debugSeed);
  return Number.isSafeInteger(seed) && seed <= 0xffff_ffff ? seed : null;
}
const randomSeed = () => (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;

// ---------- title ----------

export async function start() {
  if ('serviceWorker' in navigator && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1')
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  await initOneCast();
  // Do not allow the title's autosend hook to capture a cached continuing run.
  await gateContinuity(recordingState(s));
  lab.trackRun(() => compactRun(), {
    runKey: () => s?.seed ?? 'title',
    getLogs: () => s?.log.slice(-40).map((line) => line.text) ?? [],
  });
  if (!s) await title();
  finishStartup();
}

function expireToast() {
  const alert = app.querySelector('.toast');
  if (alert) setTimeout(() => alert.remove(), 4000);
}

async function title() {
  feedbackOpen = false;
  clockHolds = 0;
  menuPausedAt = null;
  activePanel = null;
  cancelAnimationFrame(raf);
  releaseWake();
  screen = 'title';
  lab.screen('title');
  const save = await readSave();
  let saved: GameState | GameStateSnapshot | null = null;
  try {
    saved =
      save?.state ??
      (save
        ? replay(save.seed, save.inputs, undefined, save.version ?? LEGACY_VERSION, undefined, false)
        : null);
  } catch (error) {
    recordFailure(error, 'We could not open your saved week. Your saved week is still here.', title);
  }
  app.innerHTML = `${header()}<div class="page title"><div class="page-body">
    <h1>Two Voices</h1>
    <p>You are one of the voices in Dilan’s head. Suggest what she should do from Monday to Saturday. Your words can change her choices. On Saturday, she looks back at her week.</p><p>${esc(castIntroduction())}</p>
    ${toast ? `<div class="${failureRetry ? 'start-error' : 'toast'}" role="alert"><p>${esc(toast)}</p>${failureRetry ? '<div class="failure-actions"><button id="start-retry">Try again</button><button id="start-feedback">Feedback</button></div>' : ''}</div>` : ''}
    </div><div class="other-ways-wrap"><button class="row" id="other-ways">Other ways to begin <span aria-hidden="true">▸</span></button></div>
    <div class="title-spacer" id="title-spacer"></div>
    <div class="page-actions actions">
      ${saved ? `<p class="soft small">${esc(save?.state ? savedLocation(saved) : 'This older save keeps your answers, but not the exact saved minute. Resume opens its next choice.')}</p><button class="primary" id="cont">Resume · ${esc(DAY_NAMES[saved.day]?.slice(0, 3) ?? '')} ${clock(saved.minute)}</button>` : ''}
      ${olderNotebook ? '<button id="download-old">Download old notebook</button>' : ''}
      <label class="soft small"><input type="checkbox" id="next-edition" /> Play a third week.</label><label class="soft small"><input type="checkbox" id="outcomes-edition" /> Play the outcomes week instead of the third week.</label><button class="${save ? '' : 'primary'}" id="new">${save ? 'New game' : 'Start'}</button>
      <div id="new-confirm" hidden><p>Start a new game? This replaces your saved week.</p><div class="confirm-actions"><button id="confirm-new">Start new game</button><button id="cancel-new">Cancel</button></div></div>
      ${credit()}
    </div></div>`;
  toast = '';
  const retry = failureRetry;
  failureRetry = null;
  bindHeader();
  document.getElementById('download-old')?.addEventListener('click', () => {
    if (olderNotebook) downloadJSON(JSON.parse(olderNotebook), 'two-voices-old-notebook.json');
  });
  document.getElementById('start-retry')?.addEventListener('click', (event) => {
    (event.currentTarget as HTMLButtonElement).disabled = true;
    retry?.();
  });
  document.getElementById('start-feedback')?.addEventListener('click', () => feedback());
  expireToast();
  if (notice && !notice.dataset.shown) {
    document.getElementById('title-spacer')?.append(notice);
    notice.dataset.shown = '1';
  }
  document.getElementById('cont')?.addEventListener('click', async () => {
    try {
      if (!saved) return;
      const attempt = ++loadGeneration;
      const loaded = await validateRun(save?.state ?? cloneState(saved as GameState));
      if (attempt !== loadGeneration) return;
      invalidateContinuity();
      s = loaded;
      await gateContinuity(recordingState(s));
      enter();
      carry = save?.clockFraction ?? 0;
      drawStatus();
    } catch (error) {
      recordFailure(error, 'We could not resume your saved week. Your saved week is still here.', () => {
        document.getElementById('cont')?.click();
      });
      title();
    }
  });
  document.getElementById('new')?.addEventListener('click', () => {
    if (!save) newWeek(selectedSeed() ?? randomSeed(), selectedEdition());
    else {
      required(document.getElementById('new-confirm')).hidden = false;
      required(document.getElementById('new')).hidden = true;
    }
  });
  document
    .getElementById('confirm-new')
    ?.addEventListener('click', () => newWeek(selectedSeed() ?? randomSeed(), selectedEdition()));
  document.getElementById('cancel-new')?.addEventListener('click', () => {
    required(document.getElementById('new-confirm')).hidden = true;
    required(document.getElementById('new')).hidden = false;
  });
  document.getElementById('other-ways')?.addEventListener('click', () => {
    const { el, close } = overlay(
      `<section class="other-ways" role="dialog" aria-modal="true" aria-label="Other ways to begin"><button data-close aria-label="Close other ways in">×</button><h2>Other ways to begin</h2><button id="second">Begin at the second week</button><p class="soft small">Her first week is played for you. You start on Monday of the second week.</p><div id="second-confirm" hidden><p>Start at the second week? This replaces your saved week.</p><button id="second-confirm-new">Start at week two</button><button id="second-cancel">Cancel</button></div></section>`,
      'backpage-wrap other-ways-overlay',
    );
    const beginSecondWeek = () => {
      close();
      invalidateContinuity();
      ++loadGeneration;
      s = anotherWeek(playedFirstWeek(selectedSeed() ?? randomSeed()));
      carry = 0;
      void gateContinuity(recordingState(s)).then(() => {
        writeSave();
        enter();
      });
    };
    el.querySelector('#second')?.addEventListener('click', () => {
      if (save) required(el.querySelector<HTMLElement>('#second-confirm')).hidden = false;
      else beginSecondWeek();
    });
    el.querySelector('#second-confirm-new')?.addEventListener('click', beginSecondWeek);
    el.querySelector('#second-cancel')?.addEventListener('click', () => {
      required(el.querySelector<HTMLElement>('#second-confirm')).hidden = true;
    });
  });
}

function selectedEdition() {
  if (document.querySelector<HTMLInputElement>('#outcomes-edition')?.checked) return '0.10.2';
  return document.querySelector<HTMLInputElement>('#next-edition')?.checked ? NEXT_VERSION : GAME_VERSION;
}
async function newWeek(seed: number, version = GAME_VERSION, useShelf = true) {
  const attempt = ++loadGeneration;
  invalidateContinuity();
  // Only creation may inspect the shelf. A loaded run never changes underneath play.
  let next: GameState;
  const localDevelopment = ['localhost', '127.0.0.1'].includes(location.hostname);
  try {
    next =
      useShelf && !localDevelopment
        ? await freshCanonicalWeek(seed, () => attempt === loadGeneration, version)
        : newGame(seed, version);
  } catch (error) {
    if (attempt === loadGeneration) {
      recordFailure(
        error,
        (await readSave())
          ? 'We could not start a new game. Your saved week is still here.'
          : 'We could not start the game. You can try again or send Feedback.',
        () => {
          void newWeek(seed, version, useShelf);
        },
      );
      title();
    }
    return;
  }
  if (attempt !== loadGeneration) return;
  clearSave();
  s = next;
  carry = 0;
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
      const parsed = JSON.parse(await f.text());
      const ex = (parsed && ('format' in parsed || parsed.state) ? await expandNotebook(parsed) : parsed) as {
        game?: string;
        version?: string;
        seed: number;
        inputs: Input[];
        state?: GameStateSnapshot;
      };
      if (typeof ex.seed !== 'number' || !Array.isArray(ex.inputs)) throw new Error('not a run');
      const version = ex.version ?? ex.state?.version ?? LEGACY_VERSION;
      requireCurrentEdition(version);
      if (!isEdition(version) || (ex.version && ex.state?.version && ex.version !== ex.state.version))
        throw new Error('unknown or conflicting edition');
      if (
        ex.state &&
        (ex.seed !== ex.state.seed || JSON.stringify(ex.inputs) !== JSON.stringify(ex.state.inputs))
      )
        throw Error('Conflicting notebook prefix.');
      const until = ex.state?.minute;
      const r = ex.state
        ? await validateRun(ex.state)
        : replay(ex.seed, ex.inputs, until, version, undefined, false);
      // A timeout can end a day without advancing its minute. Include that boundary.
      if (ex.state && ex.state.phase !== 'day' && r.phase === 'day' && r.minute === until) step(r);
      let note = 'The saved run was replayed.';
      if (ex.state) {
        // validateRun already cold-restores and compares the complete current snapshot.
        // Compare its full JSON here without creating another HF run for a status line.
        const want = isHf4Edition(version) ? canonicalPersona(ex.state) : fingerprint(restoreState(ex.state));
        note =
          fingerprint(r) === want
            ? 'The saved run was replayed. It matches the file.'
            : 'The saved run was replayed, but it differs from the file.';
      }
      invalidateContinuity();
      if (attempt !== loadGeneration) return;
      s = r;
      carry = 0;
      s.fileHistory = true;
      if (s.cast) {
        s.castScope = 'file';
        s.castHeadScopes = {};
      }
      await gateContinuity(recordingState(s), Boolean(r.personaHead));
      writeSave();
      toast = note;
      enter();
    } catch (error) {
      toast =
        error instanceof Error && error.message === START_FRESH
          ? START_FRESH
          : 'This file could not be loaded. It may come from an older version of The Two Voices. Start a new game instead.';
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
  if (activePanel?.kind === 'info')
    return Math.min(0.05, s.card ? (s.card.closesAt - s.card.openedAt) / CARD_SECONDS : 1);
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
  if (week) {
    week.hidden = weekOf(s.day) < 2;
    week.textContent = ` · ${weekOf(s.day) === 3 ? 'third' : 'second'} week`;
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
    ? `You ${record.insisted ? 'insisted on' : 'suggested'} ${esc(quotedWords(record.said.ink))}${record.said.ink === record.chosen.ink ? ' ✓' : ` She chose ${esc(quotedWords(record.chosen.ink))}`}`
    : `You said nothing${record.quiet === 'timeout' ? ' because time ran out' : ''}. She chose ${esc(quotedWords(record.chosen.ink))}`;
  const a = record.answer;
  const reply = s ? replyWords(s, a) : undefined;
  return `<p class="record-yours">${yours}</p>${reply ? `<p class="record-reply her notebook-text">${esc(attributedWords(reply))} <span class="who">she says.</span></p>` : ''}${thoughtHtml(a)}${a.learned ? `<p class="margin notebook-text">She keeps these words in mind: “${esc(a.learned)}.”</p>` : ''}`;
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
        html: `${away ? '<p class="away">This happened while you were away.</p>' : ''}<p class="jl jscene">${stamp}${esc(sceneWords(s, l.text, l.at))}</p>`,
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
  const tYou = trustOf(s, YOU);
  const tPull = trustOf(s, PULL);
  const first = s.day === 1 && v.id === 'alarm-1';
  // Holding helps only while she trusts you enough; when a hold would land worse than a tap, say so in words.
  const pushSore = v.options.some((o) => RANK[o.pushed] < RANK[o.lean]);
  const hint = pushSore
    ? 'She resists pressure now. Holding a choice works worse than tapping it.'
    : (v.hint ?? (first ? 'Tap a choice to suggest it.' : undefined));
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
      <p class="scene">${esc(sceneWords(s, v.scene, s.card?.openedAt ?? s.minute))}</p>
      ${resolve}${forecast}${pull}${recalled ? `<p class="stayed notebook-text">${esc(attributedWords(recalled))} <span class="who">she thinks.</span></p>` : ''}
      ${first && !v.borrowed ? '<p class="caption notebook-text other-voice">The pencil handwriting shows the other voice.</p>' : ''}
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
      ? 'Time is paused.'
      : activePanel?.kind === 'info'
        ? 'Time is passing slowly while you read. Her choice can still pass.'
        : s.phase !== 'day'
          ? 'The day is done.'
          : s.card
            ? left * CARD_SECONDS <= 8
              ? `She decides in ${Math.ceil(left * CARD_SECONDS)} seconds.`
              : `${Math.ceil(left * CARD_SECONDS)} seconds to answer.`
            : hurry
              ? 'Time is passing quickly.'
              : (performance.now() - answeredAt) / 1000 < READ_SECONDS
                ? 'She is answering.'
                : '';
}

function gapHtml(a: Answer | null): string {
  if (!s) return '';
  if (!a || !journalLines(s).some((line) => line.who === 'scene')) {
    return `<div class="gap"><p class="soft">${s.day === 1 ? 'Her alarm is about to ring.' : 'The day starts.'}</p></div>`;
  }
  return '<div class="gap-actions"><p class="soft desktop-only">Her day continues. Her next choice will appear here.</p><button class="quiet" id="hurry" aria-label="Skip to the next event">Skip ahead ⏩</button></div>';
}

/** These are her reported thoughts, not a promise to agree next time. */
function thoughtHtml(answer: Answer): string {
  return (s ? answerThoughts(s, answer, records()) : [])
    .map(
      (line) =>
        `<p class="stayed notebook-text">${esc(attributedWords(line))} <span class="who">she thinks.</span></p>`,
    )
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
  carry = 0;
  writeSave();
  answeredAt = performance.now();
  const a = s.answer;
  if (fast) runToCard(s);
  drawDay();
  return a;
}

function sayIt(option: string, insist: boolean): Answer | null {
  if (menuPausedAt !== null || s?.phase !== 'day' || !s.card) return null;
  queueInput(s, insist ? { kind: 'say', option, insist: true } : { kind: 'say', option });
  carry = 0;
  writeSave();
  answeredAt = performance.now();
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
    <div class="page-actions actions"><button class="primary" id="next">Continue to ${esc(DAY_NAMES[s.day + 1] ?? 'Saturday')}</button></div>
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
    .map((x) => `<p class="notebook-text her">I did that without your advice. “${esc(x)}.”</p>`)
    .join('');
  return `<h2 class="notebook-text dayhead">${esc(DAY_NAMES[pg.day] ?? '')}, in bed</h2>
    ${rule(k)}
    ${pg.review ? `<p class="review notebook-text">${esc(pg.review)}</p>` : ''}
    <p class="notebook-text her">${esc(pg.herLine)}</p>
    ${alone}
    ${kept || missed ? `<ul class="km">${kept}${missed}</ul>` : ''}
    ${resolves ? `<div class="block"><p class="label">Her intentions</p><ul class="resolves">${resolves}</ul></div>` : ''}
    <div class="block"><p class="label">What she thinks of you</p><p class="notebook-text to-you${pg.aboutYou === 'Some of what I heard today wasn’t you.' ? ' other-voice' : ''}">${esc(pg.aboutYou)}</p></div>
    ${phrases ? `<div class="block margin-list"><p class="label">Words she is starting to use</p><div class="phrases">${phrases}</div></div>` : ''}`;
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
  const standing = weekStanding(s);
  if (standing) lab.milestone(`week ${standing.kind}`);
  app.innerHTML = `${header()}<div class="page notebook">
    ${toast ? `<div class="toast">${esc(toast)}</div>` : ''}
    <div class="page-body">${finalHtml(f)}
    ${
      s.returnChapter
        ? `<section><h2 class="notebook-text">Back from the garden</h2><p>${esc(s.log.findLast((line) => line.text.startsWith('I am back from the garden.'))?.text ?? '')}</p><p>The previous week stays in this notebook. Another week continues from her visit.</p></section>`
        : s.version === '0.5.0'
          ? `<section><h2 class="notebook-text">A short visit</h2><p>Her week of deliveries is over. Dilan can visit Hatice’s tea garden in Istanbul. The people there are separate from the people in this story, even when they share a name. Aylin is still her sister. Mum, Ece and Murat from the depot remain part of her life.</p><p>She will pause these unfinished plans for the visit: ${esc(
              departureReleaseDescription(s).join(', ') || 'none',
            )}. The unfinished shelf stays at home for this visit. When she returns, she will start these plans again. This week’s record keeps her earlier progress and any promises tied to a date. She cannot leave while an alarm, dinner or call promise remains unresolved. Paused work does not count as finished.</p><button id="depart">Pause unfinished plans and visit</button><p id="departure-status" role="status">${esc(continuityMessage())}</p><a href="https://hearsay.adamwhite.work/">Visit Hearsay</a></section>`
          : ''
    }
    <details class="final-tally"><summary>See the tally</summary><div id="notebook-tally">${notebookTally(s, true)}</div></details>
    ${canAnotherWeek(s) ? '<p class="notebook-text soft">Monday will come again.</p>' : ''}</div>
    <div class="page-actions actions end-actions">
      <div class="action-pair"><button id="send">Feedback</button></div>
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
      required(document.getElementById('departure-status')).textContent =
        continuityMessage() || 'Her visit is saved. Continue to the tea garden to meet her there.';
    } catch (error) {
      required(document.getElementById('departure-status')).textContent = String(error);
    }
  });
  void checkpoint(s, writeSave).catch((error) => {
    diagnosticError = error instanceof Error ? error.message : String(error);
  });
  document.getElementById('another')?.addEventListener('click', () => {
    if (!s || !canAnotherWeek(s)) return;
    s = anotherWeek(s);
    carry = 0;
    void gateContinuity(recordingState(s));
    writeSave();
    enter();
  });
  document.getElementById('again')?.addEventListener('click', () => {
    required(document.getElementById('end-confirm')).hidden = false;
  });
  document.getElementById('end-cancel-new')?.addEventListener('click', () => {
    required(document.getElementById('end-confirm')).hidden = true;
  });
  document
    .getElementById('end-confirm-new')
    ?.addEventListener('click', () => newWeek(selectedSeed() ?? randomSeed()));
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
  const sentWord = f.sent === 'send' ? 'sent' : f.sent === 'call' ? 'called her instead' : 'deleted';
  const standing = s ? weekStanding(s) : null;
  return `<h2 class="notebook-text dayhead">Saturday</h2>
    ${rule(61)}
    ${standing ? `<div class="standing standing-${standing.kind}" role="status"><p class="standing-title">${esc(standing.title)}</p><p class="n">${esc(standing.line)}</p></div>` : ''}
    ${f.note ? `<div class="voicenote"><p class="label">voice note to Mum, ${sentWord}</p><p class="note">“${esc(f.note)}”</p></div>` : ''}
    ${finalInput ? `<p class="final-input notebook-text">${esc(finalInput)}</p>` : ''}
    <p class="n">${esc(f.line)}</p>
    ${(f.threads ?? []).length > 0 ? `<div class="block threads"><p class="label">What else happened</p>${(f.threads ?? []).map((x) => `<p class="n">${esc(x)}</p>`).join('')}</div>` : ''}
    ${
      firstWeek
        ? `<div class="week-pages"><div class="block first-week"><p class="label">the first week</p><p class="n">${esc(firstWeek.line)}</p>${stripHtml(firstWeek)}</div><div class="block current-week"><p class="label">the second week</p>${stripHtml(f)}</div></div>`
        : `<div class="block current-week"><p class="label">the week</p>${stripHtml(f)}</div>`
    }
    ${phrases ? `<div class="block margin-list"><p class="label">Words she now uses herself</p><div class="phrases">${phrases}</div></div>` : ''}
    ${unasked ? `<div class="block"><p class="label">What she did without your advice</p>${unasked}</div>` : ''}
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
    (firstWeek ? line('Two weeks ago', firstWeek.hands.start) : '') +
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
    ${screen === 'day' ? '<p class="soft small">Time is paused while this menu is open.</p>' : ''}
    ${`<fieldset class="menu-speed"><legend>Pace between moments</legend><p class="caption">Every choice allows 64 seconds. Slow changes only the time between choices.</p>${(['automatic', 'slow', 'steady', 'fast'] as const).map((value) => `<button class="chip" data-speed="${value}" aria-pressed="${pacing === value}">${value.charAt(0).toUpperCase() + value.slice(1)}</button>`).join('')}</fieldset>`}
    <button class="row" id="bp-send">Feedback <span aria-hidden="true">▸</span></button>
    <button class="row" id="bp-fullscreen">Full screen</button>
    <button class="row" id="bp-new">New game</button><div id="bp-confirm" hidden><p>Start a new game? This replaces your saved week.</p><button id="bp-confirm-new">Start new game</button><button id="bp-cancel-new">Cancel</button></div>
    ${screen !== 'title' ? '<button class="row" id="bp-title">To the title page</button>' : ''}
    <a class="row" href="https://human.adamwhite.work/games/">All games</a>
    <a class="row" href="https://human.adamwhite.work/lab/people/">${esc(PEOPLE_ACROSS_GAMES)}</a>
    ${s ? '<button class="row" id="bp-export">Download this run</button>' : ''}
    <div class="menu-footer"><div id="menu-recording"></div><div class="menu-links"><a href="https://human.adamwhite.work/lab/privacy/">Lab privacy</a><details><summary>Debug</summary><div class="debug-content">
      <p class="soft small provenance">${s ? `Week ${weekOf(s.day)} · run ${s.seed} · edition ${s.version} · ` : ''}Human Framework ${__HUMAN_FRAMEWORK_VERSION__}</p>
      <label>Seed for next game <input id="debug-seed" inputmode="numeric" pattern="[0-9]*" value="${esc(debugSeed)}" placeholder="Random" /></label>
      <button id="load">Load a playtest run</button><input type="file" id="file" accept="application/json,.json" hidden />
      ${s ? '<button id="bp-replay">Verify replay</button>' : ''}<p id="debug-status" role="status"></p>
      <pre>${esc(diagnosticError)}</pre>
    </div></details></div></div>
    <button class="primary" id="bp-close">${screen === 'title' ? 'Close' : 'Resume'}</button>
  </section>`,
    'backpage-wrap',
    () => {
      if (activePanel?.close === close) activePanel = null;
    },
  );
  activePanel = { kind: 'menu', close };
  el.querySelector('#menu-recording')?.append(telemetryToggle(lab));
  el.querySelector<HTMLInputElement>('#debug-seed')?.addEventListener('input', (event) => {
    debugSeed = (event.currentTarget as HTMLInputElement).value;
  });
  bindImport(el.querySelector('#load'), el.querySelector('#file'));
  el.querySelector('#bp-export')?.addEventListener('click', download);
  el.querySelector('#bp-replay')?.addEventListener('click', async () => {
    if (!s) return;
    try {
      const pinned = cloneState(s);
      const rebuilt = await validateRun(pinned);
      required(el.querySelector('#debug-status')).textContent =
        fingerprint(rebuilt) ===
        (isHf4Edition(pinned.version) ? canonicalPersona(pinned) : fingerprint(restoreState(pinned)))
          ? 'Replay matches this run.'
          : 'Replay differs from this run.';
    } catch (error) {
      required(el.querySelector('#debug-status')).textContent = String(error);
    }
  });
  el.querySelector('#bp-new')?.addEventListener('click', () => {
    required(el.querySelector<HTMLElement>('#bp-confirm')).hidden = false;
  });
  el.querySelector('#bp-cancel-new')?.addEventListener('click', () => {
    required(el.querySelector<HTMLElement>('#bp-confirm')).hidden = true;
  });
  el.querySelector('#bp-confirm-new')?.addEventListener('click', () => {
    close();
    void newWeek(selectedSeed() ?? randomSeed());
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

async function compactRun() {
  const run = exportRun();
  return run ? compactNotebook(run) : null;
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
window.addEventListener('pagehide', writeSave);
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
  async flushSave() {
    await latestSave;
  },
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
    s = newGame(seed ?? selectedSeed() ?? randomSeed(), version);
    carry = 0;
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
