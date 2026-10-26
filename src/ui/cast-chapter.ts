import { assertNotebookState } from './notebook.ts';
/** Current canonical UI transport. Only explicit new chapters claim; files never acquire ownership by loading. */

import { ENGINE_VERSION } from '@adam0white/human-framework';
import {
  anchorPersonaLife,
  canonicalCast,
  canonicalPersona,
  claimCastChapterBatch,
  closePersonaBranch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaLife,
  type PersonaRequest,
  validatePersona,
} from '@adam0white/lab-client';
import { CAST, CAST_VERSION, type CastRole, roleOf } from '../sim/canonical-cast.ts';
import { type CastReturnArchive, prepareCastChapter, validateCastChapter } from '../sim/cast-chapter.ts';
import { createCastHistorySource, createCastSource } from '../sim/cast-source.ts';
import { cloneState, newGame, queueInput, replay, step } from '../sim/game.ts';
import type { GameState } from '../sim/types.ts';
import { departureGuardCurrent, publishPersona, recordingEpochGuard, shelf } from './continuity.ts';

declare const __MURMUR_BUILD__: string;
const source = { game: 'murmur', build: __MURMUR_BUILD__, engine: ENGINE_VERSION, rules: CAST_VERSION };
export interface CastSourceRecord {
  head: PersonaEnvelope;
  inputCount: number;
  minute: number;
  clockMs: number;
  explicitFork: boolean;
}
export async function freshCanonicalWeek(seed: number, isCurrent: () => boolean): Promise<GameState> {
  await shelf.ready;
  if (!isCurrent()) throw Error('The selected chapter changed. Choose again.');
  if (!shelf.enabled) {
    const s = newGame(seed);
    s.castScope = 'local';
    return s;
  }
  let prepared: Awaited<ReturnType<typeof prepareCastChapter>> | undefined;
  const journalShelf = {
    request: async <T>(request: PersonaRequest): Promise<T> => {
      if (request.action !== 'putBatch' || !prepared || !request.envelopes?.length)
        return shelf.request<T>(request);
      const chapter = structuredClone(prepared);
      chapter.claims = request.envelopes;
      const run = newGame(chapter.seed, CAST_VERSION, chapter);
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
      const archives: Record<string, GameState | CastReturnArchive> = {};
      for (const input of inputs) {
        if (input.parent.source.game === 'murmur' && input.parent.transfer.castPassport === 'murmur-cast/1') {
          const raw = localStorage.getItem(`murmur-cast-source:${input.parent.revision}`);
          if (raw) {
            const entry = JSON.parse(raw) as GameState | CastReturnArchive;
            archives[input.parent.revision] = entry;
          }
        } else if (input.parent.castId === 'hf.cast.dilan.murmur' && input.parent.source.game === 'hearsay') {
          const index = JSON.parse(
            localStorage.getItem(`murmur-cast-branch:${input.parent.branchId}`) ?? 'null',
          ) as { accepted: boolean; key: string } | null;
          if (index && !index.accepted)
            throw Error(
              'The native source receipt is pending. Preserve or recover its local notebook before returning.',
            );
          let archive = index
            ? (JSON.parse(localStorage.getItem(index.key) ?? 'null') as CastReturnArchive | null)
            : null;
          const lineage: PersonaEnvelope[] = [];
          let revision = input.parent.parentRevision;
          for (let count = 0; revision && count < 80; count++) {
            const raw = await shelf.request<PersonaEnvelope | null>({
              action: 'get',
              castId: input.parent.castId,
              revision,
            });
            if (!raw)
              throw Error(
                'Retained return ancestry is missing. Preserve this chapter or play a separate local story.',
              );
            const row = await validatePersona(raw);
            if (
              row.revision !== revision ||
              row.castId !== input.parent.castId ||
              row.branchId !== input.parent.branchId
            )
              throw Error('Retained return ancestry conflicts.');
            lineage.push(row);
            if (row.source.game === 'murmur' && row.transfer.castPassport === 'murmur-cast/1') {
              if (!archive)
                archive = JSON.parse(
                  localStorage.getItem(`murmur-cast-source:${row.revision}`) ?? 'null',
                ) as CastReturnArchive | null;
              if (!archive || archive.departure.revision !== row.revision)
                throw Error(
                  'The source-bound notebook is missing. Export this return or play a separate local story.',
                );
              revision = null;
              break;
            }
            revision = row.parentRevision;
          }
          if (revision)
            throw Error(
              'Retained return ancestry exceeds this host’s bounded inspection. Keep this chapter or play a separate local story.',
            );
          if (index && !archive)
            throw Error(
              'The source-bound notebook is missing. Export this return or play a separate local story.',
            );
          if (archive) archives[input.parent.revision] = { ...archive, lineage };
        }
      }
      prepared = await prepareCastChapter(inputs, seed, archives);
      return prepared.initial;
    },
    { isCurrent },
  );
  if (!isCurrent()) throw Error('The selected chapter changed. Choose again.');
  if (result && prepared) {
    prepared.claims = result.claims;
    const s = newGame(prepared.seed, CAST_VERSION, prepared);
    s.castHeads = Object.fromEntries(result.claims.map((h) => [h.castId, h]));
    s.castScope = 'shared';
    return s;
  }
  const s = newGame(seed);
  s.castScope = 'shared';
  return s;
}
function simulationOnly(s: GameState) {
  const copy = cloneState(s);
  delete copy.fileHistory;
  delete copy.castHeads;
  delete copy.castScope;
  delete copy.castHeadScopes;
  delete copy.castSources;
  return copy;
}
export async function validateCanonicalRun(json: GameState): Promise<GameState> {
  assertNotebookState(json);
  if ((json.version !== CAST_VERSION && json.version !== '0.7.0' && json.version !== '0.8.0') || !json.cast)
    throw Error('This notebook uses an older cast edition. Start fresh.');
  if (json.castChapter) await validateCastChapter(json.castChapter, json.seed);
  const rebuilt = replay(
    json.seed,
    json.inputs,
    json.minute,
    json.version,
    json.castChapter,
    json.person.lexicon?.plainEnglish ?? false,
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
      head.source.rules !== CAST_VERSION ||
      !['2.17.0', '2.21.0', ENGINE_VERSION].includes(head.source.engine) ||
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
      json.person.lexicon?.plainEnglish ?? false,
    );
    if (prefix.phase === 'day' && prefix.queue.length === 0) step(prefix);
    if (head.terminal) {
      if (prefix.cast?.people[roleOf(id)].body.alive) throw Error('Terminal receipt has no actual death.');
    } else {
      const projected = await createCastSource(prefix, roleOf(id));
      for (const key of ['castPassport', 'sourceRole', 'person', 'checkpoint'])
        if (
          canonicalPersona(head.transfer[key]) !==
          canonicalPersona(projected.transfer[key as keyof typeof projected.transfer])
        )
          throw Error('Native checkpoint differs from its actual played prefix.');
    }
  }
  if (json.castHeads) rebuilt.castHeads = structuredClone(json.castHeads);
  rebuilt.castScope = json.castScope;
  if (json.castHeadScopes) rebuilt.castHeadScopes = structuredClone(json.castHeadScopes);
  if (json.castSources) rebuilt.castSources = structuredClone(json.castSources);
  if (json.fileHistory) rebuilt.fileHistory = true;
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
): Promise<PersonaEnvelope> {
  if (pending) throw Error('A person checkpoint is already being saved.');
  const guard = await recordingEpochGuard();
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
    source,
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
  localStorage.setItem(archiveKey, JSON.stringify({ source: prefix, departure: head }));
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
/** Visibility saves never pause purposes or invent eligibility. Only actual owned deaths publish automatically. */
export function automaticCastCheckpoint(s: GameState | null, save: () => void): Promise<void> {
  if (!s?.cast || !shelf.enabled || pending || saving) return pending ?? Promise.resolve();
  pending = (async () => {
    for (const c of CAST) {
      const role = roleOf(c.castId),
        p = s.cast?.people[role],
        head = s.castHeads?.[c.castId];
      if (!p || !head) continue;
      const scope = s.castHeadScopes?.[c.castId] ?? s.castScope;
      if (scope !== 'shared') continue;
      if (!p.body.alive && !head.terminal) {
        const guard = await recordingEpochGuard(),
          closed = await closePersonaBranch(head, source, p.now);
        localStorage.setItem(`murmur-cast-source:${closed.revision}`, JSON.stringify(cloneState(s)));
        const accepted = await publishPersona(closed, { guard });
        if (!departureGuardCurrent(guard)) return;
        s.castHeads ??= {};
        s.castHeads[c.castId] = accepted;
        s.castSources ??= {};
        s.castSources[accepted.revision] = {
          head: accepted,
          inputCount: s.inputs.length,
          minute: s.minute,
          clockMs: Date.now(),
          explicitFork: false,
        };
        save();
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
    '<h3>People in this chapter</h3><p>The whole cast arrives together. A checkpoint observes an eligible completed Saturday; it does not clear work or promises.</p><label>Person <select id="cast-person">' +
    CAST.map((c) => `<option value="${roleOf(c.castId)}">${c.name}</option>`).join('') +
    '</select></label><button id="cast-pause">Pause this person’s supported unfinished purposes</button><button id="cast-save">Save this person’s finished chapter</button><button id="cast-alternate">Save an explicit alternate branch for this person</button><button id="cast-download">Download this person’s accepted passport</button><button id="cast-history-download">Download Aylin’s eight-episode source archive</button><p id="cast-status" role="status"></p>';
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
        source,
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
        producer: source,
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
      state: GameState;
    } | null;
    if (entry?.accepted) return validateCanonicalRun(entry.state);
  }
  return null;
}
