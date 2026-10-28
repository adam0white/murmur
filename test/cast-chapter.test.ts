import {
  type CalendarPersonaSnapshot,
  DEFAULT_NORMS,
  projectCalendarPersona,
} from '@adam0white/human-framework-legacy';
import { createPersona, initialPersonaLife, preparePersonaLife } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { freshCast } from '../src/legacy/canonical-cast.ts';
import { prepareCastChapter, validateCastChapter } from '../src/legacy/cast-chapter.ts';
import { cardView, cloneState, newGame, queueInput, replay, runToCard } from '../src/legacy/game.ts';

async function source() {
  const p = freshCast(93).people.aylin;
  const person = projectCalendarPersona(p, {
    version: 'goodhands-agency-calendar/1',
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
  const envelope = await createPersona({
    format: 'hf-persona/1',
    castId: 'hf.cast.aylin.murmur',
    castRevision: '1',
    branchId: 'control-aylin',
    parentRevision: null,
    source: { game: 'goodhands', build: 'control', engine: '2.17.0', rules: 'goodhands-6' },
    transfer: {
      castPassport: 'goodhands-agency/1',
      sourceRole: 'aylin',
      agencyPerson: person,
      checkpoint: {
        sourceSchema: p.schema,
        sourceNow: p.now,
        sourceRng: p.rng,
        checkpointDigest: 'a'.repeat(64),
      },
      life: initialPersonaLife('hf.cast.aylin.murmur', 'control-aylin', 0),
    },
    limitations: [],
  });
  return preparePersonaLife(envelope, 0);
}
it('retains native Aylin and all four complete actors without awarding a discovery', async () => {
  const input = await source();
  const c = await prepareCastChapter([input], 17);
  expect(c.initial.people.aylin.rng).toEqual(
    input.parent.transfer.agencyPerson &&
      (input.parent.transfer.agencyPerson as CalendarPersonaSnapshot).person.rng,
  );
  expect(c.initial.discoveries).toEqual([]);
  expect(Object.keys(c.initial.people)).toHaveLength(4);
  expect(
    c.initial.people.dilan.agenda.commitments.some((x) => x.toId === 'aylin' && x.status === 'pending'),
  ).toBe(true);
});
it('refuses the whole preparation when another person is only a foreign claim', async () => {
  const input = await source();
  const bad = structuredClone(input);
  bad.parent.castId = 'hf.cast.ece.murmur';
  bad.parent.source.game = 'neighbours';
  bad.parent.source.rules = 'neighbours-cast-1';
  bad.parent.transfer.castPassport = 'hearsay-cast/1';
  bad.parent.transfer.sourceRole = 'ece';
  const { revision: _revision, ...body } = bad.parent;
  bad.parent = await createPersona(body);
  await expect(prepareCastChapter([input, bad], 17)).rejects.toThrow(/native|dialect|passport/i);
});
it('pins life effects and catches tampering rather than consulting a new wall clock', async () => {
  const input = await source();
  const a = await prepareCastChapter([input], 17);
  expect(await prepareCastChapter([input], 17)).toEqual(a);
  const bad = structuredClone(input);
  bad.life.assignment = 1 - bad.life.assignment;
  await expect(prepareCastChapter([bad], 17)).rejects.toThrow(/life/i);
});

it('plays and replays the admitted collection rather than fresh actor defaults', async () => {
  const input = await source();
  const chapter = await prepareCastChapter([input], 17);
  const s = newGame(17, '0.6.0', chapter);
  expect(s.cast?.people.aylin.rng).toEqual(chapter.initial.people.aylin.rng);
  runToCard(s);
  const c = cardView(s);
  if (!c) throw Error('No opening');
  queueInput(s, { kind: 'quiet' });

  expect(cloneState(replay(17, s.inputs, s.minute, '0.6.0', chapter))).toEqual(cloneState(s));
});

it('validates the exact pinned initial cast and claims on load without a shelf', async () => {
  const input = await source(),
    chapter = await prepareCastChapter([input], 17);
  const { revision, ...body } = input.parent;
  chapter.claims = [
    await createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'murmur', build: 'control', rules: '0.6.0', engine: '2.17.0' },
      transfer: { ...body.transfer, life: input.life },
    }),
  ];
  await validateCastChapter(chapter, 17);
  const forged = structuredClone(chapter);
  forged.initial.people.aylin.traits.honesty = 0.01;
  await expect(validateCastChapter(forged, 17)).rejects.toThrow(/initial cast/i);
});

it('admits Ece from the actual published HF3 Neighbours exporter and replays the receiving chapter', async () => {
  const { readFileSync } = await import('node:fs');
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/neighbours-hf3-ece.json', import.meta.url), 'utf8'),
  );
  expect(fixture.rawReplayExact).toBe(true);
  expect(fixture.envelope.source).toEqual({
    game: 'neighbours',
    build: '40ca6b87b310',
    engine: '2.23.0',
    rules: 'neighbours-cast-1',
  });
  const parent = fixture.envelope;
  const input = preparePersonaLife(parent, parent.transfer.life.anchoredAt ?? 0);
  const chapter = await prepareCastChapter([input], 17);
  expect(chapter.initial.people.ece.rng).toEqual(parent.transfer.person.person.rng);
  expect(chapter.initial.people.ece.body.fitness).toBe(parent.transfer.person.person.health.fitness);
  const s = newGame(17, '0.6.0', chapter);
  runToCard(s);
  queueInput(s, { kind: 'quiet' });
  expect(cloneState(replay(17, s.inputs, s.minute, '0.6.0', chapter))).toEqual(cloneState(s));
  const unsupported = structuredClone(input);
  unsupported.parent.source.engine = '2.24.0';
  const { revision: _revision, ...body } = unsupported.parent;
  unsupported.parent = await createPersona(body);
  await expect(prepareCastChapter([unsupported], 17)).rejects.toThrow(/native|dialect|passport/i);
});

it('admits Dilan from the actual published HF3 Hearsay exporter and replays the receiving chapter', async () => {
  const { readFileSync } = await import('node:fs');
  const fixture = JSON.parse(
    readFileSync(new URL('./fixtures/hearsay-hf3-dilan.json', import.meta.url), 'utf8'),
  );
  expect(fixture.rawReplayExact).toBe(true);
  expect(fixture.envelope.source).toEqual({
    game: 'hearsay',
    build: '4967957de13ccd63d84dbbba1c6ca4fbbc686596',
    engine: '2.23.0',
    rules: 'hearsay-cast-6',
  });
  const parent = fixture.envelope;
  const input = preparePersonaLife(parent, parent.transfer.life.anchoredAt ?? 0);
  const chapter = await prepareCastChapter([input], 17);
  expect(chapter.initial.people.dilan.rng).toEqual(parent.transfer.person.person.rng);
  expect(chapter.initial.people.dilan.body.fitness).toBe(parent.transfer.person.person.health.fitness);
  const s = newGame(17, '0.6.0', chapter);
  runToCard(s);
  queueInput(s, { kind: 'quiet' });
  expect(cloneState(replay(17, s.inputs, s.minute, '0.6.0', chapter))).toEqual(cloneState(s));
  const unsupported = structuredClone(input);
  unsupported.parent.source.engine = '2.24.0';
  const { revision: _revision, ...body } = unsupported.parent;
  unsupported.parent = await createPersona(body);
  await expect(prepareCastChapter([unsupported], 17)).rejects.toThrow(/native|dialect|passport/i);
});
