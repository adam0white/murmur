import { describe, expect, it } from 'vitest';
import { cloneState, newGame, queueInput, replay, runToCard } from '../src/sim/game.ts';
import { validateRun } from '../src/ui/one-cast.ts';

describe('published plain narration', () => {
  it.each(['0.2.1', '0.3.0', '0.4.2', '0.6.0'])('opts every fresh %s person in', (version) => {
    const s = newGame(7, version);
    for (const p of Object.values(s.cast?.people ?? { dilan: s.person }))
      expect(p.lexicon).toMatchObject({ plainEnglish: true });
  });

  it('replays a current canonical export with all pinned people exactly', async () => {
    const s = newGame(7);
    runToCard(s);
    queueInput(s, { kind: 'say', option: 'up' });
    runToCard(s);
    expect(cloneState(await validateRun(cloneState(s)))).toEqual(cloneState(s));
  });

  it.each(['0.3.0', '0.6.0'])('preserves saved legacy narration for every %s person', async (version) => {
    const s = newGame(7, version, undefined, false);
    runToCard(s);
    queueInput(s, { kind: 'quiet' });
    runToCard(s);
    const loaded = await validateRun(cloneState(s));
    for (const p of Object.values(loaded.cast?.people ?? { dilan: loaded.person }))
      expect(p.lexicon?.plainEnglish).toBe(false);
    expect(cloneState(loaded)).toEqual(cloneState(s));
    expect(cloneState(replay(s.seed, s.inputs, s.minute, s.version, undefined, false))).toEqual(
      cloneState(s),
    );
  });
});

it('keeps inherited journal answers once when a native chapter resumes', async () => {
  const { momentRecords } = await import('../src/ui/journal.ts');
  const source = newGame(7);
  runToCard(source);
  queueInput(source, { kind: 'quiet' });
  runToCard(source);
  if (!source.cast) throw Error('Missing cast');
  const chapter = {
    edition: '0.6.0' as const,
    seed: source.seed,
    inputs: [],
    claims: [],
    initial: structuredClone(source.cast),
    mapping: 'murmur-calendar/1' as const,
    // The journal consumes the simulation snapshot; envelope validation belongs to the importer.
    resume: { source: cloneState(source), departure: {} as never },
  };
  const resumed = newGame(7, '0.6.0', chapter);
  queueInput(resumed, { kind: 'quiet' });
  expect(momentRecords(resumed).map((r) => r.answer)).toEqual([
    ...momentRecords(source).map((r) => r.answer),
    resumed.answer,
  ]);
});

it('renders an inherited refused reply using its original pinned source chapter', async () => {
  const { replyWords } = await import('../src/ui/reply.ts');
  const source = newGame(7);
  runToCard(source);
  queueInput(source, { kind: 'say', option: 'up' });
  const answer = source.answer;
  if (!source.cast || !answer) throw Error('Missing answer');
  expect(answer.said).not.toBe(answer.chosen);
  runToCard(source);
  const chapter = {
    edition: '0.6.0' as const,
    seed: source.seed,
    inputs: [],
    claims: [],
    initial: structuredClone(source.cast),
    mapping: 'murmur-calendar/1' as const,
    resume: { source: cloneState(source), departure: {} as never },
  };
  const resumed = newGame(7, '0.6.0', chapter);
  expect(replyWords(resumed, answer)).toBe(replyWords(source, answer));
});
