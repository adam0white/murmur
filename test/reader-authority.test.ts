import { expect, it } from 'vitest';
import { prepareCastChapter } from '../src/sim/cast-chapter.ts';
import { createCastSource } from '../src/sim/cast-source.ts';
import { cloneState, newGame, restoreState } from '../src/sim/game.ts';

it('rejects malformed denial metadata before restoring a run', () => {
  const s = cloneState(newGame(17));
  (s as any).castChapter = { blocked: ['hf.cast.unknown.murmur'] };
  expect(() => restoreState(s)).toThrow(/cast|person/i);
});
it('denies skipped source projection before inspecting checkpoint or catalogs', async () => {
  const s = newGame(17);
  s.castChapter = await prepareCastChapter([], 17);
  s.castChapter.blocked = ['hf.cast.aylin.murmur'];
  await expect(createCastSource(s, 'aylin')).rejects.toThrow(/could not join/);
});

it('does not infer publication authority from missing or empty historical fields', async () => {
  const { requireCastPublication, assertCastMetadata } = await import('../src/sim/cast-authority.ts');
  const local = newGame(17);
  expect(() => requireCastPublication(local)).not.toThrow();
  const old = cloneState(local);
  delete old.castAdmission;
  old.castScope = 'shared';
  old.castHeads = {};
  expect(() => requireCastPublication(old)).toThrow(/no captured admission authority/);
  const empty = cloneState(local);
  empty.castChapter = await prepareCastChapter([], 17);
  empty.castScope = 'shared';
  empty.castAdmission = {
    kind: 'shared',
    expectedHeads: Object.fromEntries(
      ['dilan', 'aylin', 'ece', 'murat'].map((role) => [`hf.cast.${role}.murmur`, null]),
    ),
  };
  expect(() => assertCastMetadata(empty)).not.toThrow();
  expect(() => requireCastPublication(empty)).not.toThrow();
  empty.castChapter.blocked = ['hf.cast.aylin.murmur'];
  expect(() => assertCastMetadata(empty)).toThrow(/captured cast parents/);
});

it('denies old publication and preserves missing authority during full validation', async () => {
  const { saveCastPerson, validateCanonicalRun } = await import('../src/ui/cast-chapter.ts');
  const old = cloneState(newGame(17));
  delete old.castAdmission;
  old.castHeads = {};
  old.castScope = 'shared';
  const restored = await validateCanonicalRun(old);
  expect(Object.hasOwn(restored, 'castAdmission')).toBe(false);
  const before = cloneState(restored);
  for (const options of [{}, { fork: true }, { pause: true }])
    await expect(
      saveCastPerson(
        restored,
        'aylin',
        () => {
          throw Error('Save must not run');
        },
        options,
      ),
    ).rejects.toThrow(/no captured admission authority/);
  expect(cloneState(restored)).toEqual(before);
});

it('denies every skipped checkpoint path before activation, recording or source inspection', async () => {
  const { saveCastPerson } = await import('../src/ui/cast-chapter.ts');
  const { recordingState } = await import('../src/ui/one-cast.ts');
  const { assertNotebookState } = await import('../src/ui/notebook.ts');
  const s = newGame(17);
  s.castChapter = await prepareCastChapter([], 17);
  s.castChapter.blocked = ['hf.cast.aylin.murmur'];
  for (const phase of ['day', 'end'] as const) {
    s.phase = phase;
    for (const options of [{}, { fork: true }, { pause: true }])
      await expect(
        saveCastPerson(
          s,
          'aylin',
          () => {
            throw Error('Save must not run');
          },
          options,
        ),
      ).rejects.toThrow(/could not join/);
    await expect(createCastSource(s, 'aylin')).rejects.toThrow(/could not join/);
  }
  s.castChapter.blocked.push('hf.cast.aylin.murmur');
  expect(() => recordingState(s)).toThrow(/skipped person/);
  expect(() => assertNotebookState(cloneState(s))).toThrow(/skipped person/);
});
