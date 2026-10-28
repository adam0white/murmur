import {
  canonicalPersona,
  createPersona,
  initialPersonaLife,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { beforeAll, describe, expect, it } from 'vitest';
import { prepareCastChapter } from '../src/legacy/cast-chapter.ts';
import { createCastSource } from '../src/legacy/cast-source.ts';
import { cloneState, newGame, queueInput, runToCard } from '../src/legacy/game.ts';
import type { GameState } from '../src/legacy/types.ts';
import { momentRecords } from '../src/legacy/ui/journal.ts';

it('observes a played native boundary without clearing state to make a passport', async () => {
  const s = newGame(17, '0.6.0');
  await expect(createCastSource(s, 'ece')).rejects.toThrow(/boundary/i);
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    if (s.card) queueInput(s, { kind: 'quiet' });
  }
  await expect(createCastSource(s, 'ece')).rejects.toThrow(/goal|purpose|project/i);
  queueInput(s, { kind: 'cast-pause', role: 'ece' });
  const before = canonicalPersona(cloneState(s));
  const source = await createCastSource(s, 'ece');
  expect(source.transfer.castPassport).toBe('murmur-cast/1');
  expect(source.transfer.person.person.rng).toEqual(s.cast?.people.ece.rng);
  expect(source.transfer.checkpoint.sourceMinute).toBe(s.cast?.people.ece.now);
  expect(canonicalPersona(cloneState(s))).toBe(before);
  await expect(createCastSource(s, 'dilan')).rejects.toThrow(/goal|purpose|project/i);
  const achievedBefore = s.person.agenda.goals.filter((g) => g.status === 'achieved');
  const sourceNow = s.person.now;
  queueInput(s, { kind: 'cast-pause', role: 'dilan' });
  const paused = await createCastSource(s, 'dilan');
  expect(s.cast?.pauses?.dilan?.purposes.length).toBeGreaterThan(0);
  expect(paused.raw.now).toBe(sourceNow);
  expect(paused.raw.agenda.goals.filter((g) => g.status === 'achieved')).toEqual(achievedBefore);
});

describe('exact native return', () => {
  let source: GameState;
  let native: Awaited<ReturnType<typeof createCastSource>>;
  let head: Awaited<ReturnType<typeof createPersona>>;
  let returned: GameState;
  let continued: GameState;

  // Play the source once. Each test below keeps the normal per-test deadline
  // while exercising a distinct replay path with the same pinned source.
  beforeAll(async () => {
    const { cardView } = await import('../src/legacy/game.ts');
    const s = newGame(17, '0.6.1');
    s.castScope = 'shared';
    while (s.phase !== 'end') {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      runToCard(s);
      const c = cardView(s);
      if (!c) continue;
      const o =
        c.options.find((o) => o.id === 'repair-with-aylin') ??
        c.options.find((o) => o.id.startsWith('reveal-'));
      queueInput(s, o ? { kind: 'say', option: o.id, insist: true } : { kind: 'quiet' });
    }
    queueInput(s, { kind: 'cast-pause', role: 'dilan' });
    source = s;
    native = await createCastSource(s, 'dilan');
    head = await createPersona({
      format: 'hf-persona/1',
      castId: 'hf.cast.dilan.murmur',
      castRevision: '2',
      branchId: 'native-return-control',
      parentRevision: null,
      source: { game: 'murmur', build: 'control', engine: '2.17.0', rules: '0.6.0' },
      transfer: {
        ...native.transfer,
        life: initialPersonaLife('hf.cast.dilan.murmur', 'native-return-control', 0),
      },
      limitations: native.limitations,
    });
    const chapter = await prepareCastChapter([preparePersonaLife(head, 0)], 17, {
      [head.revision]: cloneState(s),
    });
    const { revision, ...body } = head;
    chapter.claims = [await createPersona({ ...body, parentRevision: revision })];
    returned = newGame(chapter.seed, '0.6.0', chapter);
    continued = cloneState(returned);
    queueInput(continued, { kind: 'next' });
  });

  it('restores the physical outcomes and continues the same native week', () => {
    expect(returned.version).toBe('0.6.1');
    expect(returned.flags.shelf).toBe(2);
    expect(returned.cast?.discoveries).toEqual(source.cast?.discoveries);
    expect(returned.chosen).toEqual(source.chosen);
    expect(continued.day).toBe(8);
    expect(continued.flags.shelf).toBe(2);
  });

  it('retains physical outcomes after a foreign visit and rejects missing lineage', async () => {
    const { revision: _revision, ...body } = head;
    const { admitCalendarPersona, createPerson, DEFAULT_NORMS, projectCalendarPersona, snapshot, tick } =
      await import('@adam0white/human-framework-legacy');
    const shifted = structuredClone(native.transfer.person),
      offset = 20160 - shifted.person.source.now;
    shifted.calendar.offset = offset;
    for (const c of shifted.calendar.commitments) {
      c.from += offset;
      c.until += offset;
      if (c.recurUntil !== undefined) c.recurUntil += offset;
    }
    const host = createPerson({
      id: 'dilan',
      name: 'Dilan',
      seed: 93,
      now: 20160,
      bornAt: shifted.person.life.bornAt + offset,
      sex: 'female',
    });
    host.body.fitness = shifted.person.health.fitness;
    const visited = admitCalendarPersona(shifted, host, {
      mappingVersion: 'murmur-calendar/1',
      sourceId: 'dilan',
      targetId: 'dilan',
      targetNorms: DEFAULT_NORMS,
    }).person;
    tick(visited, visited.now + 15);
    const portable = projectCalendarPersona(visited, {
      version: 'hearsay-calendar/1',
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
    const claim = await createPersona({
      ...body,
      parentRevision: head.revision,
      source: { game: 'hearsay', build: 'control', engine: '2.17.0', rules: 'hearsay-cast-6' },
    });
    const { castDigest } = await import('../src/legacy/cast-source.ts');
    const remote = await createPersona({
      ...body,
      parentRevision: claim.revision,
      source: claim.source,
      transfer: {
        castPassport: 'hearsay-cast/1',
        sourceRole: 'dilan',
        person: portable,
        checkpoint: {
          schema: visited.schema,
          sourceMinute: visited.now,
          rng: visited.rng,
          sha256: await castDigest(snapshot(visited)),
        },
        life: head.transfer.life,
      },
    });
    const archive = { source: cloneState(source), departure: head, lineage: [claim, head] };
    const returnChapter = await prepareCastChapter([preparePersonaLife(remote, 0)], 17, {
      [remote.revision]: archive,
    });
    const afterVisit = newGame(returnChapter.seed, '0.6.0', returnChapter);
    expect(afterVisit.flags.shelf).toBe(2);
    expect(momentRecords(afterVisit)).toEqual(momentRecords(source));
    expect(afterVisit.cast?.discoveries).toEqual(source.cast?.discoveries);
    await expect(
      prepareCastChapter([preparePersonaLife(remote, 0)], 17, {
        [remote.revision]: { ...archive, lineage: [] },
      }),
    ).rejects.toThrow(/lineage/i);
  });

  it('validates the continued notebook against its exact replayed native source', async () => {
    const { validateCanonicalRun } = await import('../src/legacy/ui/cast-chapter.ts');
    expect(cloneState(await validateCanonicalRun(cloneState(continued)))).toEqual(cloneState(continued));
  });
});
