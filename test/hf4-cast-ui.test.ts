import { expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => ({ writes: 0 }));
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
  recordingEpochGuard: () => {},
}));

import { cloneState, fingerprint, newGame } from '../src/sim/game.ts';
import { freshCanonicalWeek, validateCanonicalRun } from '../src/ui/cast-chapter.ts';

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
