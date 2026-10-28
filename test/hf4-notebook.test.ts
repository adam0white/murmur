import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { cloneState, fingerprint, newGame, queueInput, restoreState, runToCard } from '../src/sim/game.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';

it('compresses every current host and HF archive value, then cold restores it exactly', async () => {
  const s = newGame(17);
  runToCard(s);
  queueInput(s, { kind: 'say', option: 'up' });
  const value = { game: 'murmur', version: s.version, seed: s.seed, inputs: s.inputs, state: cloneState(s) };
  const packed = await compactNotebook(value);
  expect(packed.data.length).toBeLessThan(JSON.stringify(value).length);
  const expanded = await expandNotebook(JSON.parse(JSON.stringify(packed)));
  expect(canonicalPersona(expanded)).toBe(canonicalPersona(value));
  expect(fingerprint(restoreState(expanded.state))).toBe(fingerprint(s));
  await expect(expandNotebook({ ...packed, sha256: '0'.repeat(64) })).rejects.toThrow('checksum');
});
