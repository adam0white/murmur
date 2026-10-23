/** Browser shelf transport and historical recording gate. Fiction belongs to the adapter. */
import {
  acceptPersona,
  createPersona,
  type PersonaEnvelope,
  type PersonaShelfState,
  personaChannel,
  validatePersona,
  watchPersonaCheckpoint,
} from '@adam0white/lab-client';
import { personaControls } from '@adam0white/lab-kit';
import { lab } from './lab';

export type ContinuityScope = 'shared' | 'local' | 'file';
export interface RecordingHead {
  head: PersonaEnvelope;
  scope: ContinuityScope;
}
export interface ContinuityRecordingState {
  /** The stable loaded-run object, not the temporary state wrapper. */
  owner: object;
  heads: RecordingHead[];
  invalidHistory?: boolean;
}
interface RecordingReply {
  sameEpoch: boolean;
  branchId?: string;
  revision?: string;
  recordingEpoch?: string | null;
}
export const shelf = personaChannel();
let current: () => ContinuityRecordingState | undefined = () => undefined;
let checkpoint: () => void | Promise<void> = () => {};
let teardown: (() => void) | undefined;
let generation = 0;
let gated: ContinuityRecordingState | undefined;
let gatedFile = false;
let known = false;
let denied: object | undefined;
let choices: Promise<void> = Promise.resolve();
let statusText = '';
const panels = new Set<HTMLElement>();
const keyOf = (s?: ContinuityRecordingState) =>
  s?.heads
    .map(({ head }) => head.branchId)
    .sort()
    .join(':') || null;
const pinOf = (s?: ContinuityRecordingState) =>
  JSON.stringify(s?.heads.map(({ head, scope }) => [head.castId, head.branchId, head.revision, scope]));
const sharedOf = (s: ContinuityRecordingState) => s.heads.filter((h) => h.scope === 'shared');
const echoes = (reply: RecordingReply, head?: PersonaEnvelope) =>
  Boolean(head && reply.branchId === head.branchId && reply.revision === head.revision);
const active = (serial: number, s: ContinuityRecordingState, pin: string) =>
  serial === generation &&
  gated?.owner === s.owner &&
  pinOf(gated) === pin &&
  current()?.owner === s.owner &&
  pinOf(current()) === pin;

/** Call before run replacement, validated load, reset, or a recording identity change. */
export function invalidateContinuity(): void {
  ++generation;
  gated = undefined;
  gatedFile = false;
  known = false;
  lab.setPersonaRecording('pending-history');
  lab.allowPersonaRecording(false);
  refreshPanels();
}

/** Await before attaching ANY persona-derived run/save/log/note/event upload hook. */
export async function gateContinuity(
  state: ContinuityRecordingState | undefined,
  file = false,
): Promise<void> {
  const serial = ++generation;
  gated = state;
  gatedFile = file;
  known = false;
  const key = keyOf(state);
  lab.setPersonaRecording(state?.invalidHistory ? 'invalid-history' : key);
  const localAssociation = lab.personaRecordingAllowed;
  if (key || state?.invalidHistory) lab.allowPersonaRecording(false);
  refreshPanels();
  const pin = pinOf(state);
  await shelf.ready;
  if (serial !== generation || !state || state.invalidHistory || !state.heads.length) return;
  if (file || denied === state.owner) return;
  const shared = sharedOf(state);
  // Never use a central association to approve an imported/local branch after denial or reload.
  if (shared.length !== state.heads.length && !localAssociation) return;
  if (!shared.length) {
    if (localAssociation && active(serial, state, pin)) {
      known = true;
      lab.allowPersonaRecording(true);
      refreshPanels();
    }
    return;
  }
  try {
    const replies = await Promise.all(
      shared.map(({ head }) =>
        shelf.request<RecordingReply>({ action: 'recording', castId: head.castId, envelope: head }),
      ),
    );
    if (!active(serial, state, pin) || denied === state.owner) return;
    if (replies.every((reply, i) => reply.sameEpoch && echoes(reply, shared[i]?.head))) {
      known = true;
      lab.allowPersonaRecording(true);
      refreshPanels();
    }
  } catch {
    // Bridge denial and missing echoes leave all upload paths closed.
  }
}

/** Central choices are FIFO. A newer choice blocks older callbacks immediately. */
export function chooseContinuityRecording(value: boolean): Promise<void> {
  const serial = ++generation;
  const state = current();
  gated = state;
  known = false;
  if (!state?.heads.length || state.invalidHistory) return Promise.resolve();
  denied = value ? undefined : state.owner;
  lab.setPersonaRecording(keyOf(state));
  lab.allowPersonaRecording(false);
  refreshPanels();
  const pin = pinOf(state);
  const valid = () => active(serial, state, pin);
  const task = choices
    .catch(() => {})
    .then(async () => {
      if (!valid()) return;
      await shelf.ready;
      if (!valid()) return;
      for (const { head } of sharedOf(state)) {
        const epoch = await shelf.request<RecordingReply>({
          action: 'recording',
          castId: head.castId,
          envelope: head,
        });
        if (!valid()) return;
        if (!echoes(epoch, head) || !('recordingEpoch' in epoch))
          throw new Error('Recording choice could not verify this pinned history.');
        const request = {
          action: 'recording' as const,
          castId: head.castId,
          envelope: head,
          allowRecording: value,
          recordingEpoch: epoch.recordingEpoch,
        };
        const reply = await shelf.request<RecordingReply>(request);
        if (!valid()) return;
        if (!echoes(reply, head) || reply.sameEpoch !== value)
          throw new Error('Recording identity changed. Choose again.');
      }
      if (!valid()) return;
      known = value;
      lab.allowPersonaRecording(value);
      refreshPanels();
    });
  choices = task.catch(() => {});
  return task;
}

export interface DepartureGuard {
  readonly generation: number;
  readonly owner?: object;
  readonly recordingEpoch?: string | null;
  readonly authored: boolean;
}
/** Capture BEFORE projection/hashing. The opaque epoch is checked atomically by central. */
export async function recordingEpochGuard(): Promise<DepartureGuard> {
  const serial = generation;
  const owner = current()?.owner;
  const authored = Boolean(owner && gated?.owner === owner && lab.personaRecordingAllowed && lab.telemetryOn);
  await shelf.ready;
  if (serial !== generation || current()?.owner !== owner)
    throw new Error('The loaded run or recording preference changed. Try the checkpoint again.');
  const epoch = shelf.enabled
    ? await shelf.request<{ recordingEpoch?: string | null }>({ action: 'recording' })
    : undefined;
  if (serial !== generation || current()?.owner !== owner)
    throw new Error('The loaded run or recording preference changed. Try the checkpoint again.');
  return {
    generation: serial,
    owner,
    recordingEpoch: epoch?.recordingEpoch,
    authored: Boolean(authored && epoch && 'recordingEpoch' in epoch),
  };
}
export function departureGuardCurrent(guard: DepartureGuard): boolean {
  return guard.generation === generation && guard.owner === current()?.owner;
}
/** Returns only a validated accepted receipt. A conflict never retries or forks implicitly. */
export async function publishPersona(
  envelope: PersonaEnvelope,
  options: {
    scope?: ContinuityScope;
    fork?: boolean;
    guard?: DepartureGuard;
    arrival?: PersonaEnvelope;
  } = {},
): Promise<PersonaEnvelope> {
  const checked = await validatePersona(envelope);
  await shelf.ready;
  if (options.guard && !departureGuardCurrent(options.guard))
    throw new Error('The loaded run or recording preference changed. Try the checkpoint again.');
  if (options.scope && options.scope !== 'shared')
    return acceptLocalPersona(checked, { fork: options.fork, arrival: options.arrival });
  const request = {
    action: 'put' as const,
    envelope: checked,
    fork: options.fork,
    authored: Boolean(options.guard?.authored),
    recordingEpoch: options.guard?.recordingEpoch,
  };
  const accepted = await validatePersona(await shelf.request<PersonaEnvelope>(request));
  if (accepted.revision !== checked.revision)
    throw new Error('The shelf did not accept the selected checkpoint.');
  return accepted;
}
/** Fresh claim ids distinguish separate admission attempts of the same old source. */
export async function claimPersona(
  source: PersonaEnvelope,
  host: PersonaEnvelope['source'],
  metadata: Record<string, unknown>,
  scope: ContinuityScope = 'shared',
): Promise<PersonaEnvelope> {
  const { revision, ...body } = await validatePersona(source);
  const claim = await createPersona({
    ...body,
    parentRevision: revision,
    source: host,
    transfer: { ...body.transfer, admission: { ...metadata, claimId: crypto.randomUUID() } },
  });
  return publishPersona(claim, { scope, arrival: source });
}

export function installContinuity(
  getState: () => ContinuityRecordingState | undefined,
  saveCheckpoint: () => void | Promise<void>,
): () => void {
  current = getState;
  checkpoint = saveCheckpoint;
  teardown?.();
  teardown = watchPersonaCheckpoint(() => checkpoint());
  return () => {
    teardown?.();
    teardown = undefined;
  };
}
export function setContinuityStatus(text: string): void {
  statusText = text;
  refreshPanels();
}
function refreshPanels(): void {
  for (const panel of panels) {
    if (!panel.isConnected) {
      panels.delete(panel);
      continue;
    }
    renderControls(panel);
  }
}
function renderControls(panel: HTMLElement): void {
  const state = current();
  const controls = personaControls({
    enabled: shelf.enabled,
    setEnabled(value) {
      shelf.setEnabled(value);
      refreshPanels();
      if (value) void checkpoint();
    },
    recordingAllowed:
      (!state?.heads.length && !state?.invalidHistory) || known || lab.personaRecordingAllowed,
    allowRecording(value) {
      void chooseContinuityRecording(value).catch((error) => {
        setContinuityStatus(
          error instanceof Error ? error.message : 'Recording choice unavailable. History stays local.',
        );
      });
    },
  });
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = statusText || 'Continuity uses this browser. A fresh game is always available.';
  panel.replaceChildren(controls, status);
}
export function continuityControls(): HTMLElement {
  const panel = document.createElement('section');
  panel.className = 'continuity-panel';
  renderControls(panel);
  panels.add(panel);
  void shelf.ready.then(() => renderControls(panel));
  return panel;
}
if (typeof window !== 'undefined') {
  const identityChanged = () => {
    const state = current();
    const file = gatedFile;
    invalidateContinuity();
    void gateContinuity(state, file).catch(() => {});
  };
  window.addEventListener('hf-lab-preference', identityChanged);
  window.addEventListener('storage', (event) => {
    if (
      event.key === null ||
      ['hf-lab-player', 'hf-lab-recording-off', 'hf-lab-events-off:murmur'].includes(event.key)
    )
      identityChanged();
  });
}

/** Local file continuity uses one atomic IndexedDB read/check/write transaction. */
const DB = 'murmur-persona-files';
const STORE = 'continuity';
let connection: Promise<IDBDatabase> | undefined;
function openLocal(): Promise<IDBDatabase> {
  if (!connection)
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => {
          db.close();
          connection = undefined;
        };
        resolve(db);
      };
    });
  return connection;
}
export interface LocalPersonaOptions {
  arrival?: PersonaEnvelope;
  fork?: boolean;
}
export function reduceLocalPersona(
  previous: PersonaShelfState | undefined,
  envelope: PersonaEnvelope,
  options: LocalPersonaOptions = {},
): PersonaShelfState {
  let state: PersonaShelfState = previous ?? { revisions: [], heads: {} };
  const arrival = options.arrival;
  if (arrival) {
    if (
      options.fork ||
      arrival.castId !== envelope.castId ||
      arrival.branchId !== envelope.branchId ||
      envelope.parentRevision !== arrival.revision
    )
      throw new Error('The file claim does not continue its selected arrival.');
    if (state.heads[envelope.castId] === envelope.revision) return acceptPersona(state, envelope);
    if (!Object.hasOwn(state.heads, arrival.castId) && arrival.parentRevision !== null)
      state = {
        revisions: state.revisions,
        heads: { ...state.heads, [arrival.castId]: arrival.parentRevision },
      };
    state = acceptPersona(state, arrival);
  }
  return acceptPersona(state, envelope, options.fork);
}
export async function acceptLocalPersona(
  input: PersonaEnvelope,
  options: LocalPersonaOptions = {},
): Promise<PersonaEnvelope> {
  const envelope = await validatePersona(input);
  const arrival = options.arrival ? await validatePersona(options.arrival) : undefined;
  const db = await openLocal();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    const read = store.get('shelf');
    let failure: unknown;
    read.onsuccess = () => {
      try {
        store.put(reduceLocalPersona(read.result, envelope, { arrival, fork: options.fork }), 'shelf');
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(envelope);
    tx.onerror = () => reject(failure ?? tx.error ?? new Error('File continuity storage failed.'));
    tx.onabort = () => reject(failure ?? tx.error ?? new Error('File continuity storage was interrupted.'));
  });
}
