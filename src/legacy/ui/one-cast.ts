import { isCanonicalEdition } from '../edition.ts';
import { automaticCastCheckpoint, validateCanonicalRun } from './cast-chapter.ts';
import { assertNotebookState } from './notebook.ts';
/** Murmur's authored crossing. Transport and recording remain separate from the deterministic week. */

import { snapshot } from '@adam0white/human-framework-legacy';
import {
  canonicalPersona,
  createPersona,
  type PersonaEnvelope,
  validatePersona,
} from '@adam0white/lab-client';
import {
  claimPersona,
  departureGuardCurrent,
  gateContinuity,
  invalidateContinuity,
  publishPersona,
  recordingEpochGuard,
  shelf,
} from '../../ui/continuity.ts';
import { lab } from '../../ui/lab.ts';
import { cloneState, fingerprint, queueInput, replay, step } from '../game.ts';
import { createOneCastDeparture, installOneCastReturn } from '../one-cast.ts';
import type { GameState, OneCastRow } from '../types.ts';

const CAST = 'hf.cast.dilan.murmur';
const PREFIX = 'murmur-one-cast-prefix:';
let checkpointTask: Promise<void> | null = null;
let status = '';
declare const __MURMUR_BUILD__: string;
// Pin the executing bundle, even when an offline service worker retains older assets.
const build = __MURMUR_BUILD__;
let pendingReturn: { envelope: PersonaEnvelope; scope: OneCastRow['scope'] } | undefined;
export function hasPendingReturn() {
  return Boolean(pendingReturn);
}
export async function forkPendingReturn(isCurrent: () => boolean = () => true) {
  if (!pendingReturn) throw new Error('No competing return was selected.');
  return returnedChapter(pendingReturn.envelope, pendingReturn.scope, true, isCurrent);
}
export function continuityMessage() {
  return status;
}
export async function initOneCast() {
  await shelf.ready;
}
export function recordingState(s: GameState | null) {
  if (s?.cast)
    return {
      owner: s,
      heads: Object.values(s.castHeads ?? {}).map((head) => ({
        head,
        scope: s.castHeadScopes?.[head.castId] ?? s.castScope ?? ('local' as const),
      })),
      invalidHistory: Boolean(s.fileHistory),
    };
  return s
    ? {
        owner: s,
        invalidHistory: Boolean(s.fileHistory && !s.personaHead),
        heads: s.personaHead ? [{ head: s.personaHead, scope: s.personaScope ?? 'local' }] : [],
      }
    : undefined;
}
function row(s: GameState, head: PersonaEnvelope, stage: string, scope: OneCastRow['scope']) {
  s.oneCast ??= [];
  if (!s.oneCast.some((r) => r.revision === head.revision && r.stage === stage))
    s.oneCast.push({
      v: 1,
      probe: 'dilan',
      arm: 'continuing',
      scope,
      castId: CAST,
      branchId: head.branchId,
      revision: head.revision,
      parentRevision: head.parentRevision,
      stage,
      outcome: 'accepted',
    });
}
function storePrefix(s: GameState) {
  if (!s.personaHead) return;
  localStorage.setItem(PREFIX + s.personaHead.branchId, JSON.stringify(cloneState(s)));
}
function requireReturnEnvelope(incoming: PersonaEnvelope): void {
  if (
    incoming.castId !== CAST ||
    incoming.castRevision !== '1' ||
    incoming.source.game !== 'hearsay' ||
    !['4', '5'].includes(incoming.source.rules) ||
    !['2.14.1', '2.17.0', '2.21.0'].includes(incoming.source.engine)
  )
    throw new Error('This return is from an unsupported edition. Start a fresh week.');
}
/** Validate all pinned envelopes before restoring a run; never read the current shelf head. */
export async function validateRun(json: GameState): Promise<GameState> {
  assertNotebookState(json);
  if (!json || !Array.isArray(json.inputs)) throw new Error('Not a notebook run.');
  if (isCanonicalEdition(json.version) || json.version === '0.7.0' || json.version === '0.8.0')
    return validateCanonicalRun(json);
  if (json.personaHead) await validatePersona(json.personaHead);
  let rebuilt: GameState;
  if (json.returnChapter) {
    const chapter = json.returnChapter;
    await validatePersona(chapter.envelope);
    requireReturnEnvelope(chapter.envelope);
    await validatePersona(chapter.departure);
    const prefix = replay(
      json.seed,
      chapter.prefixInputs,
      chapter.prefixMinute,
      json.version,
      undefined,
      json.person.lexicon?.plainEnglish ?? false,
    );
    if (prefix.phase === 'day') step(prefix);
    if (!prefix.oneCastDeparture) throw new Error('Return departure was not replayed.');
    if (
      chapter.departure.castId !== CAST ||
      chapter.departure.castRevision !== '1' ||
      chapter.departure.source.game !== 'murmur' ||
      chapter.departure.branchId !== chapter.envelope.branchId ||
      canonicalPersona(chapter.departure.transfer) !== canonicalPersona(await createOneCastDeparture(prefix))
    )
      throw new Error('Pinned departure does not match the replayed source week.');
    const provenance = chapter.envelope.transfer.admission as
      | { sourceRevision?: string; sourceCheckpointDigest?: string }
      | undefined;
    const checkpoint = chapter.departure.transfer.checkpoint as { checkpointDigest?: string } | undefined;
    if (
      provenance?.sourceRevision !== chapter.departure.revision ||
      provenance.sourceCheckpointDigest !== checkpoint?.checkpointDigest
    )
      throw new Error('Return source checkpoint stamps do not match the pinned departure.');
    rebuilt = installOneCastReturn(prefix, chapter.envelope.transfer);
    if (canonicalPersona(snapshot(rebuilt.person)) !== canonicalPersona(chapter.initialPerson))
      throw new Error('Return initial person differs from pinned admission.');
    rebuilt.returnChapter = structuredClone(chapter);
    // Replay suffix from the admitted chapter, never from a fresh opening.
    for (const input of json.inputs.slice(chapter.prefixInputs.length)) {
      while (rebuilt.phase === 'day' && (rebuilt.minute < input.at || input.kind === 'next')) step(rebuilt);
      queueInput(rebuilt, input);
    }
    while (rebuilt.phase === 'day' && rebuilt.minute < json.minute) step(rebuilt);
  } else
    rebuilt = replay(
      json.seed,
      json.inputs,
      json.minute,
      json.version,
      undefined,
      json.person.lexicon?.plainEnglish ?? false,
    );
  if (json.phase !== 'day' && rebuilt.phase === 'day' && rebuilt.minute === json.minute) step(rebuilt);
  if (
    fingerprint(rebuilt) !== fingerprint(json) ||
    canonicalPersona(snapshot(rebuilt.person)) !== canonicalPersona(snapshot(json.person))
  )
    throw new Error('This notebook does not replay exactly.');
  if (json.personaHead) {
    const head = json.personaHead;
    if (
      head.castId !== CAST ||
      head.castRevision !== '1' ||
      head.source.game !== 'murmur' ||
      head.source.rules !== '0.5.0'
    )
      throw new Error('This notebook has an unrelated pinned person.');
    if (json.returnChapter) {
      const arrival = json.returnChapter.envelope;
      if (
        canonicalPersona(head.transfer.person) !== canonicalPersona(arrival.transfer.person) ||
        canonicalPersona(head.transfer.checkpoint) !== canonicalPersona(arrival.transfer.checkpoint) ||
        (head.parentRevision !== arrival.revision && head.parentRevision !== null)
      )
        throw new Error('Return claim does not match its pinned arrival.');
    } else {
      const departureIndex = json.inputs.findLastIndex((input) => input.kind === 'one-cast-release');
      const release = json.inputs[departureIndex];
      if (!release) throw new Error('Pinned source has no replayed departure.');
      const departurePrefix = replay(
        json.seed,
        json.inputs.slice(0, departureIndex + 1),
        release.at,
        json.version,
        undefined,
        json.person.lexicon?.plainEnglish ?? false,
      );
      if (canonicalPersona(head.transfer) !== canonicalPersona(await createOneCastDeparture(departurePrefix)))
        throw new Error('Source checkpoint differs from the replayed departure prefix.');
    }
  }
  if (json.fileHistory) rebuilt.fileHistory = true;
  if (json.personaHead) rebuilt.personaHead = structuredClone(json.personaHead);
  if (json.personaScope) rebuilt.personaScope = json.personaScope;
  if (json.oneCast) rebuilt.oneCast = structuredClone(json.oneCast);
  return rebuilt;
}
/** Source writes retain their accepted head and complete departure prefix in their own export. */
export function checkpoint(s: GameState | null, save: () => void): Promise<void> {
  if (s?.cast) return automaticCastCheckpoint(s, save);
  if (
    !s ||
    !shelf.enabled ||
    !s.oneCastDeparture ||
    s.phase !== 'end' ||
    s.oneCastDeparture.boundaryDay !== s.day ||
    s.returnChapter ||
    s.version !== '0.5.0'
  )
    return Promise.resolve();
  if (checkpointTask) return checkpointTask;
  checkpointTask = (async () => {
    const guard = await recordingEpochGuard();
    const prefix = cloneState(s);
    const transfer = await createOneCastDeparture(prefix);
    const unchanged =
      prefix.personaHead?.source.game === 'murmur' &&
      canonicalPersona(prefix.personaHead.transfer.checkpoint) === canonicalPersona(transfer.checkpoint);
    // Even a retained duplicate must pass current-head CAS; a historical receipt is not active authority.
    const head =
      unchanged && prefix.personaHead
        ? prefix.personaHead
        : await createPersona({
            format: 'hf-persona/1',
            castId: CAST,
            castRevision: '1',
            branchId: prefix.personaHead?.branchId ?? crypto.randomUUID(),
            parentRevision: prefix.personaHead?.revision ?? null,
            source: { game: 'murmur', build, engine: prefix.person.engine, rules: '0.5.0' },
            transfer: { ...transfer },
            limitations: transfer.person.limitations.slice(0, 64),
          });
    const accepted = await publishPersona(head, {
      guard: prefix.fileHistory || prefix.personaHead ? { ...guard, authored: false } : guard,
    });
    prefix.personaHead = accepted;
    prefix.personaScope = 'shared';
    row(prefix, accepted, 'checkpoint', prefix.fileHistory ? 'file' : 'shared');
    storePrefix(prefix);
    if (!departureGuardCurrent(guard)) {
      status = 'The earlier departure receipt is kept locally. The active run has not changed.';
      return;
    }
    s.personaHead = accepted;
    s.personaScope = 'shared';
    s.oneCast = structuredClone(prefix.oneCast);
    await gateContinuity(recordingState(s));
    save();
    lab.milestone('one-cast-source-complete');
    status = 'Dilan is on this browser’s shelf. Her remembered delivery travels as biography only.';
  })()
    .catch((error) => {
      status = error instanceof Error ? error.message : String(error);
      lab.milestone('one-cast-bridgefail');
    })
    .finally(() => {
      checkpointTask = null;
    });
  return checkpointTask;
}
export async function releaseAndCheckpoint(s: GameState, save: () => void) {
  if (!s.oneCastDeparture) queueInput(s, { kind: 'one-cast-release' });
  save();
  await checkpoint(s, save);
}
/** Fresh-run admission only. A missing local prefix cannot be substituted with a fresh week. */
export async function returnedChapter(
  envelope?: PersonaEnvelope,
  scope: OneCastRow['scope'] = 'shared',
  fork = false,
  isCurrent: () => boolean = () => true,
): Promise<GameState | null> {
  await shelf.ready;
  const incoming =
    envelope ??
    (shelf.enabled ? await shelf.request<PersonaEnvelope | null>({ action: 'get', castId: CAST }) : null);
  if (incoming?.source.game !== 'hearsay') return null;
  await validatePersona(incoming);
  requireReturnEnvelope(incoming);
  const raw = localStorage.getItem(PREFIX + incoming.branchId);
  if (!raw)
    throw new Error(
      'The local departure week is unavailable. Dilan cannot return to an erased week. A fresh authored week remains available.',
    );
  const prefix = await validateRun(JSON.parse(raw) as GameState);
  const departure = prefix.personaHead;
  if (!departure || departure.branchId !== incoming.branchId || departure.source.game !== 'murmur')
    throw new Error('Local source departure does not match this branch.');
  const provenance = incoming.transfer.admission as
    | { sourceRevision?: string; sourceCheckpointDigest?: string }
    | undefined;
  const sourceCheckpoint = departure.transfer.checkpoint as { checkpointDigest?: string } | undefined;
  if (
    provenance?.sourceRevision !== departure.revision ||
    provenance.sourceCheckpointDigest !== sourceCheckpoint?.checkpointDigest
  )
    throw new Error(
      'This return does not name the exact saved departure checkpoint. Keep this history local or start fresh.',
    );
  if (!isCurrent()) throw new Error('The loaded week changed. The arrival was not claimed.');
  const prepared = installOneCastReturn(prefix, incoming.transfer);
  prepared.returnChapter = {
    prefixInputs: structuredClone(prefix.inputs),
    prefixMinute: prefix.minute,
    envelope: structuredClone(incoming),
    departure: structuredClone(departure),
    initialPerson: snapshot(prepared.person),
  };
  pendingReturn = { envelope: structuredClone(incoming), scope };
  const { revision: _incomingRevision, ...incomingBody } = incoming;
  const host = { game: 'murmur', build, engine: prefix.person.engine, rules: '0.5.0' };
  const metadata = {
    adapter: 'murmur-one-cast/1',
    mapping: 'hearsay-murmur/1',
    openingMinute: prepared.person.now,
  };
  if (!isCurrent()) throw new Error('The loaded week changed. The arrival was not claimed.');
  const claim = fork
    ? await publishPersona(
        await createPersona({
          ...incomingBody,
          branchId: crypto.randomUUID(),
          parentRevision: null,
          source: host,
          transfer: { ...incoming.transfer, admission: { ...metadata, claimId: crypto.randomUUID() } },
        }),
        { scope, fork: true },
      )
    : await claimPersona(incoming, host, metadata, scope);
  pendingReturn = undefined;
  prepared.personaHead = claim;
  prepared.personaScope = scope;
  row(prepared, claim, 'admitted', scope);
  if (!isCurrent()) {
    localStorage.setItem('murmur-pending-claimed-return', JSON.stringify(prepared));
    throw new Error(
      'The loaded week changed. The claimed return is kept locally; the current week stays loaded.',
    );
  }
  invalidateContinuity();
  status = 'A new return chapter continues the saved week, with Dilan’s actual garden encounter.';
  return prepared;
}
export async function personaFile(s: GameState): Promise<PersonaEnvelope> {
  if (s.personaHead) return s.personaHead;
  if (!s.oneCastDeparture) throw new Error('Finish the week and explicitly set aside unfinished work first.');
  const transfer = await createOneCastDeparture(s);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST,
    castRevision: '1',
    branchId: crypto.randomUUID(),
    parentRevision: null,
    source: { game: 'murmur', build, engine: s.person.engine, rules: '0.5.0' },
    transfer: { ...transfer },
    limitations: transfer.person.limitations.slice(0, 64),
  });
  // A local passport is provenance, never a claim of central acceptance.
  s.personaHead = envelope;
  s.personaScope = 'file';
  row(s, envelope, 'checkpoint', 'file');
  storePrefix(s);
  await gateContinuity(recordingState(s), true);
  return envelope;
}

/** A competing source stays blocked until the player explicitly chooses a new branch. */
export async function forkDeparture(s: GameState, save: () => void) {
  const guard = await recordingEpochGuard();
  const prefix = cloneState(s);
  const transfer = await createOneCastDeparture(prefix);
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: CAST,
    castRevision: '1',
    branchId: crypto.randomUUID(),
    parentRevision: null,
    source: { game: 'murmur', build, engine: prefix.person.engine, rules: '0.5.0' },
    transfer: { ...transfer },
    limitations: transfer.person.limitations.slice(0, 64),
  });
  const accepted = await publishPersona(envelope, { fork: true, guard: { ...guard, authored: false } });
  prefix.personaHead = accepted;
  prefix.personaScope = 'shared';
  row(prefix, accepted, 'checkpoint', prefix.fileHistory ? 'file' : 'shared');
  storePrefix(prefix);
  if (!departureGuardCurrent(guard)) {
    status = 'The earlier fork receipt is kept locally. The active run has not changed.';
    return;
  }
  s.personaHead = accepted;
  s.personaScope = 'shared';
  s.oneCast = structuredClone(prefix.oneCast);
  await gateContinuity(recordingState(s));
  save();
  status = 'An explicit new branch is on the shelf. The competing continuation stays separate.';
}

/** A late accepted claim remains recoverable without querying any newer shelf head. */
export async function heldReturn(): Promise<GameState> {
  const raw = localStorage.getItem('murmur-pending-claimed-return');
  if (!raw) throw new Error('No locally held return is available.');
  return validateRun(JSON.parse(raw) as GameState);
}
