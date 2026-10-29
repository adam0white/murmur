import { expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ writes: 0, projections: 0, block: false, owner: undefined as unknown }));
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
    request: async (r: { action: string }) => {
      if (r.action === 'prepareBatch')
        return { inputs: [], blocked: [{ reason: 'A source duty is still open.' }], expectedHeads: {} };
      calls.writes++;
      throw new Error('Unexpected write');
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

it('refuses a blocked whole-cast batch before any ownership write', async () => {
  await expect(freshCanonicalWeek(17, () => true)).rejects.toThrow('source duty');
  expect(calls.writes).toBe(0);
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
