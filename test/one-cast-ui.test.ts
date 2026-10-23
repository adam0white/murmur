import {
  admitPersona,
  begin,
  createPerson,
  decide,
  finish,
  projectPersona,
  snapshot,
} from '@adam0white/human-framework';
import { createPersona, type PersonaEnvelope, validatePersona } from '@adam0white/lab-client';
import { beforeEach, expect, it, vi } from 'vitest';
import {
  anotherWeek,
  cloneState,
  fingerprint,
  GAME_VERSION,
  newGame,
  queueInput,
  runToCard,
} from '../src/sim/game.ts';
import { checkpointPerson, createOneCastDeparture } from '../src/sim/one-cast.ts';
import type { GameState } from '../src/sim/types.ts';
import { momentRecords } from '../src/ui/journal.ts';

const transport = vi.hoisted(() => ({
  shelf: { enabled: true, ready: Promise.resolve(true), request: vi.fn() },
  gateContinuity: vi.fn(async () => {}),
  invalidateContinuity: vi.fn(),
  recordingEpochGuard: vi.fn(async () => ({
    generation: 1,
    owner: {},
    authored: true,
    recordingEpoch: 'test-epoch',
  })),
  departureGuardCurrent: vi.fn(() => true),
  publishPersona: vi.fn(async (head: unknown, _options?: { scope?: string; fork?: boolean }) => head),
  claimPersona: vi.fn(),
}));
vi.mock('../src/ui/continuity.ts', () => transport);
vi.mock('../src/ui/lab.ts', () => ({ lab: { milestone: vi.fn() } }));

import {
  checkpoint,
  forkPendingReturn,
  hasPendingReturn,
  heldReturn,
  returnedChapter,
  validateRun,
} from '../src/ui/one-cast.ts';

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  });
  transport.publishPersona.mockReset();
  transport.publishPersona.mockImplementation(async (head: unknown) => validatePersona(head));
  transport.claimPersona.mockReset();
  transport.claimPersona.mockImplementation(
    async (source: PersonaEnvelope, host: PersonaEnvelope['source'], metadata: Record<string, unknown>) => {
      const { revision, ...body } = source;
      return createPersona({
        ...body,
        parentRevision: revision,
        source: host,
        transfer: { ...body.transfer, admission: { ...metadata, claimId: crypto.randomUUID() } },
      });
    },
  );
});
function playedDeparture(): GameState {
  const state = newGame(31);
  for (let n = 0; n < 2000 && state.phase !== 'end'; n++) {
    if (state.phase === 'evening') queueInput(state, { kind: 'next' });
    else {
      runToCard(state);
      if (state.card) queueInput(state, { kind: 'quiet' });
    }
  }
  expect(state.phase).toBe('end');
  queueInput(state, { kind: 'one-cast-release' });
  return state;
}
/** Contract control using real HF admission/action/projection. This is not a live Hearsay journey. */
async function targetReturn(source: PersonaEnvelope): Promise<PersonaEnvelope> {
  const projection = (
    await createOneCastDeparture(
      await validateRun(
        JSON.parse(localStorage.getItem(`murmur-one-cast-prefix:${source.branchId}`) ?? 'null'),
      ),
    )
  ).person;
  const opening = createPerson({
    id: 'dilan-delivery',
    name: 'Dilan',
    sex: 'female',
    seed: 17,
    now: 360,
    bornAt: projection.life.bornAt + 360 - projection.source.now,
  });
  opening.body.fitness = projection.health.fitness;
  const person = admitPersona(projection, opening, {
    mappingVersion: 'murmur-hearsay/1',
    sourceId: 'dilan',
    targetId: 'dilan-delivery',
  }).person;
  const offer = {
    id: 'one-cast-talk',
    action: 'talk',
    label: 'Share one ordinary exchange',
    duration: 0,
    effort: 0.01,
    with: ['hatice'],
    advertises: { belonging: 0.08, meaning: 0.12 },
  };
  const decision = decide(person, [offer], { now: person.now });
  expect(begin(person, offer, decision)).toBeTruthy();
  finish(person, {
    affordanceId: offer.id,
    action: offer.action,
    status: 'completed',
    at: person.now,
    needs: offer.advertises,
    percepts: [
      {
        at: person.now,
        channel: 'social',
        kind: 'one-cast-encounter',
        actorId: 'hatice',
        valence: 0.4,
        salience: 1,
        summary: 'Hatice respected my work and offered a short exchange.',
      },
    ],
  });
  const episode = person.memory.episodes.findLast((e) => e.action === 'one-cast-encounter');
  expect(episode).toBeDefined();
  if (!episode) throw new Error('The HF encounter did not produce a memory.');
  const returning = projectPersona(person, {
    version: 'hearsay-murmur/1',
    skills: {},
    episodes: {
      [episode.id]: { id: 'hearsay-encounter', action: 'talk', actorId: 'hearsay-hatice', tags: [] },
    },
  });
  return createPersona({
    format: 'hf-persona/1',
    castId: source.castId,
    castRevision: '1',
    branchId: source.branchId,
    parentRevision: source.revision,
    source: { game: 'hearsay', build: 'contract-control', engine: person.engine, rules: '4' },
    transfer: {
      person: returning,
      admission: {
        adapter: 'hearsay-one-cast/1',
        mapping: 'hearsay-murmur/1',
        openingMinute: person.now,
        sourceRevision: source.revision,
        sourceCheckpointDigest: (source.transfer.checkpoint as { checkpointDigest: string }).checkpointDigest,
      },
      history: [
        {
          id: 'hearsay-encounter',
          kind: 'hearsay-encounter',
          sourceGame: 'hearsay',
          episodeId: 'hearsay-encounter',
          disclosed: true,
          outcome: 'accepted',
        },
      ],
      checkpoint: await checkpointPerson(person),
    },
    limitations: returning.limitations,
  });
}
async function setupReturn() {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  if (!source.personaHead) throw new Error('Source checkpoint was not accepted.');
  const incoming = await targetReturn(source.personaHead);
  const returned = await returnedChapter(incoming);
  if (!returned) throw new Error('Return was not admitted.');
  return { source, incoming, returned };
}
it('validates an ordinary played source release and retains its exact accepted head', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  const rebuilt = await validateRun(cloneState(source));
  expect(rebuilt.version).toBe(GAME_VERSION);
  expect(snapshot(rebuilt.person)).toEqual(snapshot(source.person));
  expect(rebuilt.oneCastDeparture).toEqual(source.oneCastDeparture);
  expect(rebuilt.personaHead).toEqual(source.personaHead);
  expect(rebuilt.personaScope).toBe('shared');
  expect(fingerprint(rebuilt)).toBe(fingerprint(source));
});
it('validates the pinned returned chapter without replacing the source pin or consulting latest head', async () => {
  const { source, incoming, returned } = await setupReturn();
  const before = cloneState(source);
  const rebuilt = await validateRun(cloneState(returned));
  expect(source).toEqual(before);
  expect(rebuilt.returnChapter?.departure).toEqual(source.personaHead);
  expect(rebuilt.returnChapter?.envelope).toEqual(incoming);
  expect(rebuilt.personaHead?.parentRevision).toBe(incoming.revision);
  expect(rebuilt.inputs).toEqual(source.inputs);
  expect(snapshot(rebuilt.person)).toEqual(snapshot(returned.person));
  expect(transport.shelf.request).not.toHaveBeenCalled();
});
it('replays anotherWeek and ordinary suffix inputs from the returned initial Person', async () => {
  const { returned } = await setupReturn();
  const continuing = anotherWeek(returned);
  runToCard(continuing);
  if (continuing.card) queueInput(continuing, { kind: 'quiet' });
  runToCard(continuing);
  const rebuilt = await validateRun(cloneState(continuing));
  expect(rebuilt.day).toBeGreaterThan(6);
  expect(rebuilt.inputs.length).toBeGreaterThan(rebuilt.returnChapter?.prefixInputs.length ?? Infinity);
  expect(snapshot(rebuilt.person)).toEqual(snapshot(continuing.person));
  expect(fingerprint(rebuilt)).toBe(fingerprint(continuing));
  expect(rebuilt.returnChapter?.initialPerson).toEqual(continuing.returnChapter?.initialPerson);
});
it('rejects a forged pinned admitted initial Person before restoring recording metadata', async () => {
  const { returned } = await setupReturn();
  const forged = cloneState(returned);
  if (!forged.returnChapter) throw new Error('Missing return chapter.');
  forged.returnChapter.initialPerson.body.health = 0.8;
  await expect(validateRun(forged)).rejects.toThrow(/initial person differs/);
});

it('forks the exact competing file return with a new valid checksum and preserves file scope', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  if (!source.personaHead) throw new Error('Missing accepted source checkpoint.');
  const selected = await targetReturn(source.personaHead);
  transport.claimPersona.mockRejectedValueOnce(new Error('Persona revision conflict.'));
  await expect(returnedChapter(selected, 'file')).rejects.toThrow(/conflict/);
  expect(hasPendingReturn()).toBe(true);
  transport.shelf.request.mockImplementation(async () => {
    throw new Error('Must not read a newer shelf head.');
  });
  const forked = await forkPendingReturn();
  expect(forked?.returnChapter?.envelope).toEqual(selected);
  expect(forked?.returnChapter?.departure).toEqual(source.personaHead);
  expect(forked?.personaScope).toBe('file');
  expect(forked?.personaHead?.parentRevision).toBeNull();
  expect(forked?.personaHead?.branchId).not.toBe(selected.branchId);
  await expect(validatePersona(forked?.personaHead)).resolves.toEqual(forked?.personaHead);
  expect(transport.publishPersona.mock.lastCall?.[1]).toMatchObject({ scope: 'file', fork: true });
  expect(hasPendingReturn()).toBe(false);
  expect(transport.shelf.request).not.toHaveBeenCalled();
});

it('keeps a source checkpoint pinned while its own ordinary second week continues', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  const original = source.personaHead;
  anotherWeek(source);
  runToCard(source);
  if (source.card) queueInput(source, { kind: 'quiet' });
  const restored = await validateRun(cloneState(source));
  expect(restored.personaHead).toEqual(original);
  expect(snapshot(restored.person)).toEqual(snapshot(source.person));
});

it('keeps file-origin source measurement separate even when continuity is published centrally', async () => {
  const source = playedDeparture();
  source.fileHistory = true;
  await checkpoint(source, () => {});
  expect(source.personaScope).toBe('shared');
  expect(source.oneCast?.find((row) => row.stage === 'checkpoint')?.scope).toBe('file');
  expect(transport.publishPersona.mock.calls.at(-1)?.[1]).toMatchObject({ guard: { authored: false } });
});

it('rejects a return bound to a different source checkpoint before claiming it', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  const incoming = await targetReturn(source.personaHead!);
  const { revision, ...body } = incoming;
  const invalid = await createPersona({
    ...body,
    transfer: {
      ...body.transfer,
      admission: { ...(body.transfer.admission as object), sourceCheckpointDigest: '0'.repeat(64) },
    },
  });
  await expect(returnedChapter(invalid)).rejects.toThrow('exact saved departure');
  expect(transport.claimPersona).not.toHaveBeenCalled();
});

it('retains a late accepted claim for validated local resume instead of loading it', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  const incoming = await targetReturn(source.personaHead!);
  let current = true;
  const claim = transport.claimPersona.getMockImplementation()!;
  transport.claimPersona.mockImplementationOnce(async (...args) => {
    const accepted = await claim(...args);
    current = false;
    return accepted;
  });
  await expect(returnedChapter(incoming, 'shared', false, () => current)).rejects.toThrow('kept locally');
  const held = await heldReturn();
  expect(held.returnChapter?.envelope).toEqual(incoming);
  expect(held.personaHead?.parentRevision).toBe(incoming.revision);
});

it('renders source departure history and the actual admitted suffix without replaying a fresh person', async () => {
  const { source, returned } = await setupReturn();
  expect(() => momentRecords(source)).not.toThrow();
  anotherWeek(returned);
  runToCard(returned);
  if (returned.card) queueInput(returned, { kind: 'quiet' });
  const records = momentRecords(returned);
  expect(records.findLast((row) => row.moment === returned.answer?.moment)?.answer.chosen).toBe(
    returned.answer?.chosen,
  );
});

it('accepts the declared Hearsay4/5 contract and refuses other return editions', async () => {
  const source = playedDeparture();
  await checkpoint(source, () => {});
  const incoming = await targetReturn(source.personaHead!);
  const { revision, ...body } = incoming;
  const future = await createPersona({ ...body, source: { ...body.source, rules: '6' } });
  await expect(returnedChapter(future)).rejects.toThrow('unsupported edition');
  const edition5 = await createPersona({ ...body, source: { ...body.source, rules: '5' } });
  const returned = await returnedChapter(edition5);
  expect(returned?.returnChapter?.envelope.source.rules).toBe('5');
  if (!returned) throw new Error('Missing returned chapter');
  await expect(validateRun(cloneState(returned))).resolves.toMatchObject({
    returnChapter: { envelope: { source: { rules: '5' } } },
  });
});
