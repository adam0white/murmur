/** Browser shelf transport and run-scoped history metadata. Fiction belongs to the adapter. */
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
export const shelf = personaChannel();
let current: () => ContinuityRecordingState | undefined = () => undefined;
let checkpoint: () => void | Promise<void> = () => {};
let teardown: (() => void) | undefined;
let generation = 0;
let gated: ContinuityRecordingState | undefined;
let gatedFile = false;
let known = false;
let statusText = '';
const panels = new Set<HTMLElement>();
const keyOf = (s?: ContinuityRecordingState) =>
  s?.heads
    .map(({ head }) => head.branchId)
    .sort()
    .join(':') || null;
/** Call before run replacement, validated load, reset, or a browser-person continuity change. */
export function invalidateContinuity(): void {
  ++generation;
  gated = undefined;
  gatedFile = false;
  known = false;
  lab.setPersonaRecording('pending-history');
  lab.allowPersonaRecording(false);
  refreshPanels();
}

/** Keep loaded-run metadata; recording linkage needs no separate consent or RPC. */
export async function gateContinuity(
  state: ContinuityRecordingState | undefined,
  file = false,
): Promise<void> {
  ++generation;
  gated = state;
  gatedFile = file;
  known = true;
  lab.setPersonaRecording(keyOf(state));
  refreshPanels();
}
export async function chooseContinuityRecording(_value: boolean): Promise<void> {
  // Compatibility only. The shared recording menu preference applies automatically.
}

export interface DepartureGuard {
  readonly generation: number;
  readonly owner?: object;
  readonly authored: boolean;
}
/** Capture loaded-run ownership before projection and hashing. */
export async function recordingEpochGuard(): Promise<DepartureGuard> {
  const serial = generation;
  const state = current();
  const owner = state?.owner;
  const authored = Boolean(owner && gated?.owner === owner && !gatedFile && !state?.invalidHistory);
  await shelf.ready;
  if (serial !== generation || current()?.owner !== owner)
    throw new Error('The loaded run changed. Try the checkpoint again.');
  return { generation: serial, owner, authored };
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
    throw new Error('The loaded run changed. Try the checkpoint again.');
  if (options.scope && options.scope !== 'shared')
    return acceptLocalPersona(checked, { fork: options.fork, arrival: options.arrival });
  const request = {
    action: 'put' as const,
    envelope: checked,
    fork: options.fork,
    authored: Boolean(options.guard?.authored),
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
  const shelfChanged = () => {
    const state = current();
    const file = gatedFile;
    invalidateContinuity();
    void gateContinuity(state, file).catch(() => {});
  };
  window.addEventListener('hf-persona-preference', shelfChanged);
  window.addEventListener('storage', (event) => {
    if (event.key === null || event.key === 'hf-persona-opt-in') shelfChanged();
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
