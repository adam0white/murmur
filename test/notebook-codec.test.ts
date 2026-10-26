import { expect, it } from 'vitest';
import { cloneState, newGame, queueInput, runToCard, step } from '../src/sim/game.ts';
import { compactNotebook, expandNotebook, savedLocation } from '../src/ui/notebook.ts';
import { validateRun } from '../src/ui/one-cast.ts';

it('losslessly carries an unanswered minute, response deadline, raw person and all history', async () => {
  const s = newGame(17);
  runToCard(s);
  step(s);
  const exact = cloneState(s);
  const compact = await compactNotebook({
    game: 'murmur',
    version: s.version,
    seed: s.seed,
    inputs: s.inputs,
    state: exact,
  });
  const full = await expandNotebook(JSON.parse(JSON.stringify(compact)));
  expect(full.state).toEqual(exact);
  expect(JSON.parse(JSON.stringify(await validateRun(full.state)))).toEqual(
    JSON.parse(JSON.stringify(exact)),
  );
  const malformed = structuredClone(exact);
  malformed.inputs.push({ kind: 'future-action', at: malformed.minute } as never);
  await expect(validateRun(malformed)).rejects.toThrow(/input/i);
  await expect(expandNotebook({ state: { ...exact, version: '99.0.0' } })).rejects.toThrow(/unknown/i);
  expect(full.state.card?.closesAt).toBe(s.card?.closesAt);
  expect(savedLocation(full.state)).toContain('still waiting');
  queueInput(s, { kind: 'quiet' });
  step(s);
  const gap = cloneState(s);
  expect((await expandNotebook(await compactNotebook({ state: gap }))).state).toEqual(gap);
  expect(savedLocation(gap)).toContain('between');
  const corrupt = { ...compact, sha256: '0'.repeat(64) };
  await expect(expandNotebook(corrupt)).rejects.toThrow(/checksum/i);
  await expect(expandNotebook({ ...compact, format: 'murmur-notebook/999' })).rejects.toThrow(/format/i);
});
