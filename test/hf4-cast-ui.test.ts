import { inspect, type PersonView } from '@adam0white/human-framework';
import {
  canonicalCast,
  createPersona,
  initialPersonaLife,
  type LifePreparation,
  type PersonaRequest,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';
import { MURMUR_ACTIONS } from '../src/sim/hf4-actions.ts';
import { createMurmurOpening } from '../src/sim/hf4-opening.ts';
import { readPerson } from '../src/sim/hf4-read.ts';

const calls = vi.hoisted(() => ({
  writes: 0,
  projections: 0,
  block: false,
  owner: undefined as unknown,
  batch: undefined as unknown,
  lastWrite: undefined as unknown,
}));
vi.mock('../src/sim/cast-source.ts', async (original) => {
  const actual = await original<typeof import('../src/sim/cast-source.ts')>();
  return {
    ...actual,
    createCastSource: (...args: Parameters<typeof actual.createCastSource>) => {
      calls.projections++;
      return actual.createCastSource(...args);
    },
  };
});
vi.mock('../src/ui/continuity.ts', () => ({
  shelf: {
    enabled: true,
    ready: Promise.resolve(),
    request: async (r: PersonaRequest) => {
      if (r.action === 'prepareBatch')
        return (
          calls.batch ?? {
            inputs: [],
            blocked: [{ castId: 'hf.cast.aylin.murmur', reason: 'A source duty is still open.' }],
            expectedHeads: Object.fromEntries(
              ['dilan', 'aylin', 'ece', 'murat'].map((id) => [`hf.cast.${id}.murmur`, null]),
            ),
          }
        );
      calls.writes++;
      calls.lastWrite = structuredClone(r);
      return {};
    },
  },
  departureGuardCurrent: () => true,
  publishPersona: () => {},
  recordingEpochGuard: () => ({ owner: calls.owner }),
  requireSharedWrite: () => {
    if (calls.block) throw new Error('Shared write blocked by peer');
  },
}));

import { cloneState, fingerprint, newGame } from '../src/sim/game.ts';
import {
  automaticCastCheckpoint,
  freshCanonicalWeek,
  saveCastPerson,
  validateCanonicalRun,
} from '../src/ui/cast-chapter.ts';

it('starts with other people and prevents writes for a skipped person', async () => {
  const state = await freshCanonicalWeek(17, () => true);
  expect(state.castChapter?.blocked).toEqual(['hf.cast.aylin.murmur']);
  await expect(saveCastPerson(state, 'aylin', () => {}, { fork: true })).rejects.toThrow(/could not join/);
  expect(calls.writes).toBe(1);
});

it('validates a complete current notebook without adding or dropping ownership metadata', async () => {
  for (const explicitFalse of [false, true]) {
    const state = newGame(17);
    if (explicitFalse) state.fileHistory = false;
    const before = cloneState(state);
    const restored = await validateCanonicalRun(before);
    expect(cloneState(restored)).toStrictEqual(before);
    expect(fingerprint(restored)).toBe(fingerprint(state));
  }
});

it('blocks explicit and automatic shared checkpoints before projection or mutation', async () => {
  const state = newGame(17);
  state.castScope = 'shared';
  state.phase = 'end';
  const before = cloneState(state);
  calls.owner = state;
  calls.block = true;
  calls.projections = 0;
  const save = vi.fn();
  await expect(saveCastPerson(state, 'dilan', save, { pause: true })).rejects.toThrow('blocked by peer');
  await expect(saveCastPerson(state, 'aylin', save, { fork: true })).rejects.toThrow('blocked by peer');
  await expect(automaticCastCheckpoint(state, save)).rejects.toThrow('blocked by peer');
  expect(calls.projections).toBe(0);
  expect(save).not.toHaveBeenCalled();
  expect(cloneState(state)).toStrictEqual(before);
  calls.block = false;
});

it('claims the eligible person and skips an incompatible person in the same batch', async () => {
  // Exercise the future eligible path with a test-only peer certification.
  const { PORTABLE_READERS } = await import(
    '../node_modules/@adam0white/lab-client/dist/portable-readers.js'
  );
  Object.assign(
    PORTABLE_READERS,
    Object.fromEntries(
      ['hearsay', 'goodhands', 'neighbours'].map((game) => [game, { client: '0.5.8', perPersonSkips: true }]),
    ),
  );
  const run = createMurmurOpening(17, MURMUR_ACTIONS);
  const inputs: LifePreparation[] = [];
  for (const role of ['aylin', 'ece'] as const) {
    const cast = canonicalCast(`hf.cast.${role}.murmur`);
    const result = inspect(run, {
      perspective: { kind: 'host' },
      people: [role],
      select: ['persona'],
      portable: { person: role, castId: cast.castId, castRevision: cast.revision },
    });
    if (!result.ok) throw new Error(result.error.message);
    const passport = (result.value.people[0] as Extract<PersonView, { kind: 'host' }>).parts.find(
      (p) => p.select === 'persona',
    )?.value;
    if (!passport || !('format' in passport) || passport.version !== 2) throw new Error('Missing passport');
    const retained = structuredClone(passport);
    if (role === 'aylin')
      retained.retained.agenda.commitments.push({
        id: 'test-retained-duty',
        kind: 'promise',
        toId: 'self',
        label: 'finish dinner',
        actions: ['dinner'],
        from: retained.retained.at,
        until: retained.retained.at + 3600000,
        importance: 0.7,
        status: 'pending',
      });
    const branchId = `test-${role}`;
    const parent = await createPersona({
      format: 'hf-persona/1',
      castId: cast.castId,
      castRevision: cast.revision,
      branchId,
      parentRevision: null,
      source: {
        game: 'murmur',
        build: 'fixture',
        engine: passport.source.engine,
        rules: role === 'ece' ? '0.9.0' : '0.10.0',
      },
      transfer: {
        castPassport: 'hf-portable-person/2',
        portable: retained,
        life: initialPersonaLife(cast.castId, branchId, 1_800_000_000_000),
      },
      limitations: [],
    });
    inputs.push(preparePersonaLife(parent, 1_800_000_000_000));
  }
  calls.batch = {
    inputs,
    blocked: [],
    expectedHeads: Object.fromEntries(
      ['dilan', 'aylin', 'ece', 'murat'].map((role) => {
        const id = `hf.cast.${role}.murmur`;
        return [id, inputs.find((input) => input.parent.castId === id)?.parent.revision ?? null];
      }),
    ),
  };
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  try {
    const state = await freshCanonicalWeek(17, () => true);
    const write = calls.lastWrite as PersonaRequest;
    expect(write.action).toBe('putBatch');
    expect(write.envelopes?.map((p) => p.castId)).toEqual(['hf.cast.aylin.murmur']);
    expect(state.castChapter?.blocked).toEqual(['hf.cast.ece.murmur']);
    expect(state.castChapter?.inputs.map((input) => input.parent.castId)).toEqual(['hf.cast.aylin.murmur']);
    expect(readPerson(state.hf.run, 'aylin').agenda.commitments).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'test-retained-duty', status: 'pending' })]),
    );
    await expect(saveCastPerson(state, 'ece', () => {}, { fork: true })).rejects.toThrow(/could not join/);
    await validateCanonicalRun(cloneState(state));
  } finally {
    for (const game of ['hearsay', 'goodhands', 'neighbours'])
      delete (PORTABLE_READERS as Record<string, unknown>)[game];
    calls.batch = undefined;
    vi.unstubAllGlobals();
  }
});
