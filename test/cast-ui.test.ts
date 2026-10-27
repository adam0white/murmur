import { createPerson, DEFAULT_NORMS, projectCalendarPersona } from '@adam0white/human-framework';
import {
  canonicalCast,
  createPersona,
  initialPersonaLife,
  type LifePreparation,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import { cloneState, queueInput, runToCard } from '../src/sim/game.ts';
import {
  automaticCastCheckpoint,
  freshCanonicalWeek,
  heldCanonicalWeek,
  saveCastPerson,
  validateCanonicalRun,
} from '../src/ui/cast-chapter.ts';

const state = vi.hoisted(() => ({
  owner: undefined as object | undefined,
  inputs: [] as LifePreparation[],
  puts: 0,
  stale: false,
  publish: vi.fn(),
  rows: {} as Record<string, unknown>,
  onPut: undefined as undefined | (() => void),
}));
vi.mock('../src/ui/continuity.ts', () => ({
  shelf: {
    enabled: true,
    ready: Promise.resolve(true),
    request: async (r: { action: string; revision?: string }) => {
      if (r.action === 'get') return state.rows[r.revision ?? ''] ?? null;
      if (r.action === 'prepareBatch')
        return {
          inputs: state.inputs,
          blocked: [],
          expectedHeads: Object.fromEntries(
            ['dilan', 'aylin', 'ece', 'murat'].map((role) => {
              const id = `hf.cast.${role}.murmur`;
              return [id, state.inputs.find((i) => i.parent.castId === id)?.parent.revision ?? null];
            }),
          ),
        };
      if (r.action === 'putBatch') {
        if (state.stale) throw Error('stale parent');
        state.puts++;
        state.onPut?.();
        return {};
      }
      throw Error('A loaded run must never read latest shelf.');
    },
  },
  recordingEpochGuard: async () => ({ owner: state.owner }),
  departureGuardCurrent: (guard: { owner?: object }) => guard.owner === state.owner,
  publishPersona: state.publish,
}));
async function nativeAylin() {
  const c = canonicalCast('hf.cast.aylin.murmur');
  const p = createPerson({
    id: 'aylin',
    name: c.name,
    seed: 93,
    now: 510,
    bornAt: 510 - c.age * 525960,
    sex: 'female',
    traits: c.traits,
    values: c.values,
  });
  const person = projectCalendarPersona(p, {
    version: 'goodhands-agency-calendar/1',
    skills: {},
    calendar: {
      version: 'hf-persona-calendar-map/1',
      offset: 0,
      sourceNorms: DEFAULT_NORMS,
      references: {
        commitments: {},
        chains: {},
        actions: {},
        entities: {},
        norms: Object.fromEntries(DEFAULT_NORMS.map((n) => [n.id, n.id])),
      },
    },
  });
  return preparePersonaLife(
    await createPersona({
      format: 'hf-persona/1',
      castId: c.castId,
      castRevision: c.revision,
      branchId: 'ui-control-aylin',
      parentRevision: null,
      source: { game: 'goodhands', build: 'control', engine: '2.17.0', rules: 'goodhands-6' },
      transfer: {
        castPassport: 'goodhands-agency/1',
        sourceRole: 'aylin',
        agencyPerson: person,
        checkpoint: {
          sourceSchema: p.schema,
          sourceNow: p.now,
          sourceRng: p.rng,
          checkpointDigest: 'a'.repeat(64),
        },
        life: initialPersonaLife(c.castId, 'ui-control-aylin', 0),
      },
      limitations: [],
    }),
    0,
  );
}
beforeEach(() => {
  state.owner = undefined;
  state.puts = 0;
  state.inputs = [];
  state.stale = false;
  state.publish.mockReset();
  state.onPut = undefined;
  state.rows = {};
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
  });
});
it('claims a fresh collection once and reloads/replays it with no new shelf claim', async () => {
  state.inputs = [await nativeAylin()];
  const s = await freshCanonicalWeek(17, () => true);
  expect(state.puts).toBe(1);
  runToCard(s);
  queueInput(s, { kind: 'quiet' });
  expect(cloneState(await validateCanonicalRun(cloneState(s)))).toEqual(cloneState(s));
  expect(state.puts).toBe(1);
});
it('refuses all startup on a semantic failure or stale atomic claim', async () => {
  const input = await nativeAylin();
  const { revision, ...body } = input.parent;
  const unsupported = await createPersona({ ...body, source: { ...body.source, game: 'unsupported' } });
  state.inputs = [preparePersonaLife(unsupported, 0)];
  await expect(freshCanonicalWeek(17, () => true)).rejects.toThrow(/native source/i);
  expect(state.puts).toBe(0);
  state.inputs = [input];
  state.stale = true;
  await expect(freshCanonicalWeek(17, () => true)).rejects.toThrow(/stale parent/);
  expect(state.puts).toBe(0);
});
it('does not turn a downloaded receipt into local branch ownership', async () => {
  state.inputs = [await nativeAylin()];
  const s = await freshCanonicalWeek(17, () => true);
  s.fileHistory = true;
  s.castScope = 'file';
  s.castHeadScopes = {};
  await expect(saveCastPerson(s, 'aylin', () => {})).rejects.toThrow(/files do not own/i);
  expect(state.publish).not.toHaveBeenCalled();
});

it('keeps an accepted batch recoverable when selection changes during the atomic write', async () => {
  state.inputs = [await nativeAylin()];
  let current = true;
  state.onPut = () => {
    current = false;
  };
  await expect(freshCanonicalWeek(17, () => current)).rejects.toThrow(/changed/i);
  const held = await heldCanonicalWeek();
  expect(held?.castHeads?.['hf.cast.aylin.murmur']).toBeDefined();
  expect(state.puts).toBe(1);
});

it('publishes an eligible native source only after archiving its played prefix and validates its reload', async () => {
  state.publish.mockImplementation(async (value: unknown) => value);
  const s = await freshCanonicalWeek(17, () => true);
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    if (s.card) queueInput(s, { kind: 'quiet' });
  }
  queueInput(s, { kind: 'cast-pause', role: 'dilan' });
  const head = await saveCastPerson(s, 'dilan', () => {});
  expect(localStorage.getItem(`murmur-cast-source:${head.revision}`)).toBeTruthy();
  expect(cloneState(await validateCanonicalRun(cloneState(s)))).toEqual(cloneState(s));
});

it('refuses a returning Hearsay Dilan whose native source index and archive are missing', async () => {
  const input = await nativeAylin();
  const { revision, ...body } = input.parent;
  const departure = await createPersona({
    ...body,
    castId: 'hf.cast.dilan.murmur',
    castRevision: canonicalCast('hf.cast.dilan.murmur').revision,
    source: { ...body.source, game: 'murmur', rules: '0.6.0' },
    transfer: {
      ...body.transfer,
      castPassport: 'murmur-cast/1',
      life: initialPersonaLife('hf.cast.dilan.murmur', body.branchId, 0),
    },
  });
  const returned = await createPersona({
    ...body,
    castId: departure.castId,
    castRevision: canonicalCast('hf.cast.dilan.murmur').revision,
    transfer: departure.transfer,
    parentRevision: departure.revision,
    source: { ...body.source, game: 'hearsay', rules: 'hearsay-cast-6' },
  });
  state.rows[departure.revision] = departure;
  state.inputs = [{ ...input, parent: returned }];
  await expect(freshCanonicalWeek(17, () => true)).rejects.toThrow(/source-bound notebook is missing/i);
  expect(state.puts).toBe(0);
});

it('automatically publishes an eligible owned living chapter once and leaves local files alone', async () => {
  state.publish.mockImplementation(async (value: unknown) => value);
  const s = await freshCanonicalWeek(17, () => true);
  while (s.phase !== 'end') {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  // Explicit source choice resolves supported purposes; automatic publication must never make it.
  queueInput(s, { kind: 'cast-pause', role: 'dilan' });
  const before = structuredClone(s.inputs);
  state.owner = s;
  const castId = 'hf.cast.dilan.murmur';
  await automaticCastCheckpoint(s, () => {});
  expect(s.castHeads?.[castId]?.source.game).toBe('murmur');
  expect(state.publish).toHaveBeenCalled();
  expect(s.inputs).toEqual(before);
  const writes = state.publish.mock.calls.length;
  await automaticCastCheckpoint(s, () => {});
  expect(state.publish).toHaveBeenCalledTimes(writes);
  s.fileHistory = true;
  s.castScope = 'file';
  s.castHeadScopes = {};
  await automaticCastCheckpoint(s, () => {});
  expect(state.publish).toHaveBeenCalledTimes(writes);
}, 15000);
