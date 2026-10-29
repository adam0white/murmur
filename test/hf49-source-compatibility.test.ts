/** Genuine397 native source and offline exact-parent claim; no shared/peer acceptance. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';

vi.mock('../src/ui/continuity.ts', () => ({
  shelf: { ready: Promise.resolve(), enabled: false },
  recordingEpochGuard: () => ({}),
  requireSharedWrite: () => {
    throw Error('No shared writes in compatibility control');
  },
}));

import { type CastChapter, prepareCastChapter, validateCastChapter } from '../src/sim/cast-chapter.ts';
import { cloneState, replay, restoreState, step } from '../src/sim/game.ts';
import type { GameStateSnapshot } from '../src/sim/types.ts';
import { validateRun } from '../src/ui/one-cast.ts';

const read = (name: string) =>
  JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString());
it('validates a genuine397 complete native source prefix and retained owned head without changing one field', async () => {
  const book = read('hf49-397-aylin-owned-book.json.gz') as GameStateSnapshot;
  expect(book.castHeads?.['hf.cast.aylin.murmur']?.source.build).toBe(
    '397d5facd81f49312fdbc7ff1d4a753d886b35b1',
  );
  expect(cloneState(await validateRun(book))).toEqual(book);
}, 600_000);
it('keeps397 retained-reference/admission/claim rules exact and declares new rules separately', async () => {
  const chapter = read('hf49-397-aylin-claimed-chapter.json.gz') as CastChapter;
  // This is a synthetic local exact-parent claim over a genuine source, not a shared CAS receipt or partially admitted live game.
  await validateCastChapter(chapter, 17);
  expect(await prepareCastChapter(chapter.inputs, 17)).toEqual({ ...chapter, claims: [] });
  const next = await prepareCastChapter(chapter.inputs, 17, {}, '0.10.0');
  expect(next.edition).toBe('0.10.0');
  expect(
    next.portable.aylin?.mapping.references.some(
      (r) => r.kind === 'action' && r.source === 'read-letter' && r.target === 'read-letter',
    ),
  ).toBe(true);
  expect(chapter.portable.aylin?.mapping.references.some((r) => r.source === 'read-letter')).toBe(false);
});

it('matches the actual397 old-record-15 full snapshot and its cold next step', () => {
  const v = JSON.parse(
    readFileSync(new URL('./fixtures/hf49-397-outcomes-day15.json', import.meta.url), 'utf8'),
  );
  const hash = (x: unknown) => createHash('sha256').update(canonicalPersona(x)).digest('hex');
  const s = replay(v.seed, v.inputs, undefined, v.version);
  expect(s.card?.moment).toBe('old-record-15');
  const raw = cloneState(s);
  expect(hash(raw)).toBe(v.hash);
  const cold = restoreState(raw);
  step(cold);
  expect(hash(cloneState(cold))).toBe(v.nextHash);
}, 600_000);
