import { isHf4Edition, sourceRules } from '../sim/edition.ts';
import { assertNotebookState, compactNotebook } from './notebook.ts';
import { storeSourceArchive } from './source-archive.ts';

/** Current canonical UI transport. Only explicit new chapters claim; files never acquire ownership by loading. */

declare const __HUMAN_FRAMEWORK_VERSION__: string;
const ENGINE_VERSION = __HUMAN_FRAMEWORK_VERSION__;

import {
  anchorPersonaLife,
  canonicalCast,
  canonicalPersona,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaLife,
  type PersonaRequest,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, type CastRole, roleOf } from '../sim/canonical-cast.ts';
import { prepareCastChapter, validateCastChapter } from '../sim/cast-chapter.ts';
import { createCastHistorySource, createCastSource } from '../sim/cast-source.ts';
import { cloneState, GAME_VERSION, newGame, queueInput, replay, restoreState, step } from '../sim/game.ts';
import type { GameState, GameStateSnapshot } from '../sim/types.ts';
import {
  type DepartureGuard,
  departureGuardCurrent,
  publishPersona,
  recordingEpochGuard,
  requireSharedWrite,
  shelf,
} from './continuity.ts';

declare const __MURMUR_BUILD__: string;
const sourceFor = (version: string) => ({
  game: 'murmur',
  build: __MURMUR_BUILD__,
  engine: ENGINE_VERSION,
  rules: sourceRules(version),
});
const source = sourceFor(GAME_VERSION);
export interface CastSourceRecord {
  head: PersonaEnvelope;
  inputCount: number;
  minute: number;
  clockMs: number;
  explicitFork: boolean;
}
export async function freshCanonicalWeek(
  seed: number,
  isCurrent: () => boolean,
  version = GAME_VERSION,
): Promise<GameState> {
  await shelf.ready;
  if (!isCurrent()) throw Error('The selected chapter changed. Choose again.');
  if (!shelf.enabled) {
    const s = newGame(seed, version);
    s.castScope = 'local';
    return s;
  }
  let candidateIds: string[] = [];
  let prepared: Awaited<ReturnType<typeof prepareCastChapter>> | undefined;
  const journalShelf = {
    request: async <T>(request: PersonaRequest): Promise<T> => {
      if (request.action === 'prepareBatch') {
        const batch = await shelf.request<{
          inputs: { parent: { castId: string } }[];
          blocked: { castId: string; reason: string }[];
        }>(request);
        candidateIds = [...batch.inputs.map((i) => i.parent.castId), ...batch.blocked.map((p) => p.castId)];
        return batch as T;
      }
      if (request.action !== 'putBatch' || !prepared || !request.envelopes?.length)
        return shelf.request<T>(request);
      const chapter = structuredClone(prepared);
      chapter.claims = request.envelopes;
      const run = newGame(chapter.seed, version, chapter);
      run.castHeads = Object.fromEntries(chapter.claims.map((h) => [h.castId, h]));
      run.castScope = 'shared';
      const key = `murmur-held-cast:${crypto.randomUUID()}`;
      const entry = { accepted: false, state: cloneState(run) };
      localStorage.setItem(key, JSON.stringify(entry));
      const keys = JSON.parse(localStorage.getItem('murmur-held-cast-index') ?? '[]') as string[];
      keys.unshift(key);
      localStorage.setItem('murmur-held-cast-index', JSON.stringify(keys));
      const result = await shelf.request<T>(request);
      entry.accepted = true;
      localStorage.setItem(key, JSON.stringify(entry));
      return result;
    },
  };
  const result = await claimCastChapterBatch(
    journalShelf,
    CAST.map((c) => c.castId),
    source,
    async (inputs) => {
      prepared = await prepareCastChapter(inputs, seed, {}, version);
      prepared.blocked = [
        ...new Set(candidateIds.filter((id) => !inputs.some((i) => i.parent.castId === id))),
      ];
      return prepared.initial;
    },
    {
      isCurrent,
      admitPerson: async (input) => {
        requireSharedWrite(input.parent.castId);
        await prepareCastChapter([input], seed, {}, version);
      },
    },
  );
  if (!isCurrent()) throw Error('The selected chapter changed. Choose again.');
  if (result && prepared) {
    prepared.claims = result.claims;
    const s = newGame(prepared.seed, version, prepared);
    s.castHeads = Object.fromEntries(result.claims.map((h) => [h.castId, h]));
    s.castScope = 'shared';
    return s;
  }
  const s = newGame(seed, version);
  s.castScope = 'shared';
  return s;
}
function simulationOnly(s: GameState | GameStateSnapshot) {
  const copy = 'host' in s.hf ? cloneState(s as GameState) : structuredClone(s);
  delete copy.fileHistory;
  delete copy.castHeads;
  delete copy.castScope;
  delete copy.castHeadScopes;
  delete copy.castSources;
  return copy;
}
export async function validateCanonicalRun(json: GameStateSnapshot): Promise<GameState> {
  assertNotebookState(json);
  restoreState(json); // Validate complete HF archive and host ingress before replay.

  if (!isHf4Edition(json.version) || !json.cast)
    throw Error('This notebook uses an older cast edition. Start fresh.');
  if (json.castChapter) {
    if (json.castChapter.edition !== sourceRules(json.version))
      throw Error('Cast chapter rules conflict with the notebook edition.');
    await validateCastChapter(json.castChapter, json.seed);
  }
  const rebuilt = replay(
    json.seed,
    json.inputs,
    json.minute,
    json.version,
    json.castChapter,
    json.plainEnglish,
  );
  if (json.phase !== 'day' && rebuilt.phase === 'day') step(rebuilt);
  if (canonicalPersona(simulationOnly(rebuilt)) !== canonicalPersona(simulationOnly(json)))
    throw Error('The pinned cast notebook does not replay exactly.');
  const claims = json.castChapter?.claims ?? [];
  for (const [id, head] of Object.entries(json.castHeads ?? {})) {
    await validatePersona(head);
    if (id !== head.castId || !CAST.some((c) => c.castId === id)) throw Error('Unrelated owned person.');
    if (claims.some((c) => c.revision === head.revision)) continue;
    const record = json.castSources?.[head.revision];
    if (!record || record.head.revision !== head.revision || record.inputCount > json.inputs.length)
      throw Error('Native head has no exact replayed source prefix.');
    if (
      !Number.isSafeInteger(record.inputCount) ||
      record.inputCount < 0 ||
      !Number.isFinite(record.minute) ||
      !Number.isSafeInteger(record.clockMs) ||
      head.source.game !== 'murmur' ||
      head.source.rules !== sourceRules(json.version) ||
      head.source.engine !== ENGINE_VERSION ||
      head.castRevision !== canonicalCast(id).revision
    )
      throw Error('Invalid native source receipt.');
    const previous =
      claims.find((h) => h.revision === head.parentRevision) ??
      (head.parentRevision ? json.castSources?.[head.parentRevision]?.head : undefined);
    if (record.explicitFork ? head.parentRevision !== null : head.parentRevision !== null && !previous)
      throw Error('Native source parent is not pinned.');
    if (previous && (previous.castId !== id || previous.branchId !== head.branchId))
      throw Error('Native source branch conflicts.');
    if (!head.terminal) {
      const old = previous?.transfer.life as PersonaLife | undefined;
      const life =
        old && !record.explicitFork
          ? anchorPersonaLife(old, id, record.clockMs)
          : initialPersonaLife(id, head.branchId, record.clockMs);
      if (canonicalPersona(life) !== canonicalPersona(head.transfer.life))
        throw Error('Native life anchor differs from its captured source clock.');
    }
    const prefix = replay(
      json.seed,
      json.inputs.slice(0, record.inputCount),
      record.minute,
      json.version,
      json.castChapter,
      json.plainEnglish,
    );
    if (prefix.phase === 'day' && prefix.queue.length === 0) step(prefix);
    if (head.terminal) {
      throw Error('Terminal history requires its original source notebook.');
    } else {
      const projected = await createCastSource(prefix, roleOf(id));
      for (const key of ['castPassport', 'sourceRole', 'portable', 'checkpoint'])
        if (
          canonicalPersona(head.transfer[key]) !==
          canonicalPersona(projected.transfer[key as keyof typeof projected.transfer])
        )
          throw Error('Native checkpoint differs from its actual played prefix.');
    }
  }
  // Preserve the exact captured ownership metadata, including absence and explicit false.
  for (const key of ['castHeads', 'castScope', 'castHeadScopes', 'castSources', 'fileHistory'] as const) {
    if (Object.hasOwn(json, key)) Object.assign(rebuilt, { [key]: structuredClone(json[key]) });
  }
  return rebuilt;
}
let pending: Promise<void> | undefined;
let saving = false;
export async function saveCastPerson(
  s: GameState,
  role: CastRole,
  save: () => void,
  options: { pause?: boolean; fork?: boolean } = {},
): Promise<PersonaEnvelope> {
  if (saving || pending) throw Error('A checkpoint is already being saved.');
  saving = true;
  try {
    return await saveCastPersonNow(s, role, save, options);
  } finally {
    saving = false;
  }
}
async function saveCastPersonNow(
  s: GameState,
  role: CastRole,
  save: () => void,
  options: { pause?: boolean; fork?: boolean },
  fixedGuard?: DepartureGuard,
): Promise<PersonaEnvelope> {
  const guard = fixedGuard ?? (await recordingEpochGuard());
  if (fixedGuard && (guard.owner !== s || !departureGuardCurrent(guard)))
    throw Error('The loaded run changed before its checkpoint.');
  const selected = canonicalCast(`hf.cast.${role}.murmur`);
  const selectedScope = s.castHeadScopes?.[selected.castId] ?? s.castScope ?? 'local';
  if (s.castChapter?.blocked?.includes(selected.castId))
    throw Error('This person could not join this chapter. Continue their saved chapter first.');
  if (options.fork || selectedScope === 'shared') requireSharedWrite(selected.castId);
  if (options.pause) queueInput(s, { kind: 'cast-pause', role });
  const prefix = cloneState(s),
    cast = canonicalCast(`hf.cast.${role}.murmur`),
    parent = prefix.castHeads?.[cast.castId];
  const scope = prefix.castHeadScopes?.[cast.castId] ?? prefix.castScope ?? 'local';
  if ((prefix.fileHistory || scope === 'file') && scope !== 'shared' && !options.fork)
    throw Error(
      'Imported files do not own browser branches. Export locally or choose an explicit alternate branch for this person.',
    );
  const clockMs = Date.now();
  const native = await createCastSource(prefix, role);
  const life = parent?.transfer.life as PersonaLife | undefined;
  const branchId = options.fork ? crypto.randomUUID() : (parent?.branchId ?? crypto.randomUUID());
  const head = await createPersona({
    format: 'hf-persona/1',
    castId: cast.castId,
    castRevision: cast.revision,
    branchId,
    parentRevision: options.fork ? null : (parent?.revision ?? null),
    source: sourceFor(s.version),
    transfer: {
      ...native.transfer,
      life:
        life && !options.fork
          ? anchorPersonaLife(life, cast.castId, clockMs)
          : initialPersonaLife(cast.castId, branchId, clockMs),
    },
    limitations: native.limitations,
  });
  // Keep the complete prefix BEFORE a central write. Quota errors must not publish a source whose archive was lost.
  const archiveKey = `murmur-cast-source:${head.revision}`;
  const archive = await compactNotebook({ state: prefix, departure: head });
  const archiveReceipt = await storeSourceArchive(head.revision, archive);
  localStorage.setItem(archiveKey, JSON.stringify(archiveReceipt));
  localStorage.setItem(
    `murmur-cast-branch:${head.branchId}`,
    JSON.stringify({ accepted: false, key: archiveKey }),
  );
  const accepted = await publishPersona(head, {
    scope: options.fork ? 'shared' : scope,
    fork: options.fork,
    guard,
  });
  localStorage.setItem(
    `murmur-cast-branch:${head.branchId}`,
    JSON.stringify({ accepted: true, key: archiveKey }),
  );
  if (!departureGuardCurrent(guard))
    throw Error('The earlier source receipt is retained locally; the loaded run changed.');
  s.castHeads ??= {};
  s.castHeads[cast.castId] = accepted;
  s.castHeadScopes ??= {};
  s.castHeadScopes[cast.castId] = options.fork ? 'shared' : scope;
  s.castSources ??= {};
  s.castSources[accepted.revision] = {
    head: accepted,
    inputCount: prefix.inputs.length,
    minute: prefix.minute,
    clockMs,
    explicitFork: Boolean(options.fork),
  };
  save();
  return accepted;
}
/** Observe eligible shared chapters automatically. Never pause purposes, fork conflicts, or publish imported files. */
export function automaticCastCheckpoint(s: GameState | null, save: () => void): Promise<void> {
  if (!s?.cast || !shelf.enabled || pending || saving) return pending ?? Promise.resolve();
  pending = (async () => {
    const guard = await recordingEpochGuard();
    if (guard.owner !== s || !departureGuardCurrent(guard)) return;
    for (const c of CAST) {
      if (!departureGuardCurrent(guard)) return;
      const role = roleOf(c.castId),
        head = s.castHeads?.[c.castId];
      const scope = s.castHeadScopes?.[c.castId] ?? s.castScope;
      if (scope !== 'shared' || s.castChapter?.blocked?.includes(c.castId)) continue;
      if (s.phase === 'end') {
        const saved = head && s.castSources?.[head.revision];
        if (saved?.inputCount === s.inputs.length && saved.minute === s.minute) continue;
        // Check the shared-write policy before creating a portable projection.
        requireSharedWrite(c.castId);
        try {
          await createCastSource(s, role);
        } catch {
          continue;
        }
        if (!departureGuardCurrent(guard)) return;
        await saveCastPersonNow(s, role, save, {}, guard);
      }
    }
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
export function canonicalPersonControls(s: GameState, save: () => void): HTMLElement {
  const el = document.createElement('section');
  el.innerHTML =
    '<h3>People in this chapter</h3><p>Available people arrive together. A checkpoint observes an eligible completed Saturday; it does not clear work or promises.</p><label>Person <select id="cast-person">' +
    CAST.map((c) => `<option value="${roleOf(c.castId)}">${c.name}</option>`).join('') +
    '</select></label><button id="cast-save">Save this person’s finished chapter</button><button id="cast-alternate">Save an explicit alternate branch for this person</button><button id="cast-download">Download this person’s accepted passport</button><button id="cast-history-download">Download Aylin’s complete source archive</button><p id="cast-status" role="status"></p>';
  const role = () => (el.querySelector('select') as HTMLSelectElement).value as CastRole;
  const status = (text: string) => {
    const p = el.querySelector('#cast-status');
    if (p) p.textContent = text;
  };
  const run = (fn: () => Promise<unknown>) =>
    void fn()
      .then(() => status('The selected checkpoint was accepted.'))
      .catch((e) => status(e instanceof Error ? e.message : String(e)));
  el.querySelector('#cast-pause')?.addEventListener('click', () => {
    try {
      queueInput(s, { kind: 'cast-pause', role: role() });
      save();
      status('This local pause is recorded. No browser head was changed.');
    } catch (e) {
      status(String(e));
    }
  });
  el.querySelector('#cast-save')?.addEventListener('click', () => run(() => saveCastPerson(s, role(), save)));
  el.querySelector('#cast-alternate')?.addEventListener('click', () =>
    run(() => saveCastPerson(s, role(), save, { fork: true })),
  );
  el.querySelector('#cast-history-download')?.addEventListener('click', () => {
    void (async () => {
      const notebook = cloneState(s);
      const native = await createCastHistorySource(notebook);
      const cast = canonicalCast('hf.cast.aylin.murmur');
      const parent = notebook.castHeads?.[cast.castId];
      const branchId = parent?.branchId ?? crypto.randomUUID();
      const envelope = await createPersona({
        format: 'hf-persona/1',
        castId: cast.castId,
        castRevision: cast.revision,
        branchId,
        parentRevision: parent?.revision ?? null,
        source: sourceFor(notebook.version),
        transfer: {
          ...native.transfer,
          life: parent?.transfer.life ?? initialPersonaLife(cast.castId, branchId, Date.now()),
        },
        limitations: native.limitations,
      });
      const payload = {
        format: 'murmur-history-archive/1',
        notebook,
        native,
        envelope,
        sourceBuildBasis: notebook.fileHistory
          ? 'Imported notebook; original build is not recorded here.'
          : source.build,
        producer: sourceFor(notebook.version),
        ownership: 'file export; no shelf claim or upload',
      };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: 'application/json' }));
      a.download = 'murmur-aylin-history.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      status('The complete source archive was downloaded locally. No chapter was claimed.');
    })().catch((e) => status(String(e)));
  });
  el.querySelector('#cast-download')?.addEventListener('click', () => {
    const head = s.castHeads?.[`hf.cast.${role()}.murmur`];
    if (!head) {
      status('No accepted checkpoint for this person yet.');
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(head)], { type: 'application/json' }));
    a.download = `${head.castId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  return el;
}

/** Accepted CAS receipts survive a late selection change. Reading a held local chapter never claims latest heads. */
export async function heldCanonicalWeek(): Promise<GameState | null> {
  const keys = JSON.parse(localStorage.getItem('murmur-held-cast-index') ?? '[]') as string[];
  for (const key of keys) {
    const entry = JSON.parse(localStorage.getItem(key) ?? 'null') as {
      accepted: boolean;
      state: GameStateSnapshot;
    } | null;
    if (entry?.accepted) return validateCanonicalRun(entry.state);
  }
  return null;
}
