import { readFileSync } from 'node:fs';
import {
  admitCalendarPersona,
  DEFAULT_NORMS,
  projectCalendarPersona,
  snapshot,
} from '@adam0white/human-framework-legacy';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import {
  castDigest,
  createCastHistorySource,
  createCastSource,
  createHistoryProjection,
} from '../src/legacy/cast-source.ts';
import { cloneState, newGame, replay, step } from '../src/legacy/game.ts';

it('projects eight exact signed source episodes and discloses the other192 without changing source', async () => {
  const source = JSON.parse(
    readFileSync(new URL('./fixtures/aylin-history-source-92cdebd.json', import.meta.url), 'utf8'),
  );
  const before = canonicalPersona(source);
  const rebuilt = replay(
    source.notebook.seed,
    source.notebook.inputs,
    source.notebook.minute,
    source.notebook.version,
  );
  if (rebuilt.phase === 'day') step(rebuilt);
  expect(cloneState(rebuilt)).toEqual(source.notebook);
  const old = await createCastSource(rebuilt, 'aylin');
  expect(old).toEqual(source.native);
  const out = await createHistoryProjection(source.native.raw);
  expect(out.person.person.mappingVersion).toBe('murmur-calendar/2');
  expect(out.selection.ids).toEqual(
    source.native.raw.memory.episodes.slice(-8).map((e: { id: string }) => e.id),
  );
  expect(out.selection.omittedEpisodeIds).toHaveLength(192);
  expect(out.person.person.episodes).toEqual(source.native.raw.memory.episodes.slice(-8));
  expect(out.checkpoint.sha256).toBe(await castDigest(source.native.raw));
  expect(out.checkpoint.rng).toEqual(source.native.raw.rng);
  expect(canonicalPersona(source)).toBe(before);
  const target = newGame(17).cast!.people.aylin;
  const offset = target.now - source.native.raw.now;
  target.life.bornAt = source.native.raw.life.bornAt + offset;
  target.body.fitness = source.native.raw.body.fitness;
  const portable = structuredClone(out.person);
  portable.calendar.offset = offset;
  const policy = {
    mappingVersion: 'murmur-calendar/2',
    sourceId: 'aylin',
    targetId: 'aylin',
    targetNorms: DEFAULT_NORMS,
  };
  const admitted = admitCalendarPersona(portable, target, policy).person;
  const expected = source.native.raw.memory.episodes
    .slice(-8)
    .map((e: { at: number; recalledAt?: number }) => ({
      ...e,
      at: e.at + offset,
      ...(e.recalledAt === undefined ? {} : { recalledAt: e.recalledAt + offset }),
    }));
  expect(snapshot(admitted).memory.episodes).toEqual(expected);
  expect(admitted.rng).toEqual(source.native.raw.rng);
  const wrong = structuredClone(portable);
  wrong.calendar.offset++;
  expect(() => admitCalendarPersona(wrong, target, policy)).toThrow();
  const missing = structuredClone(out.selection.map);
  const id = out.selection.ids[0]!;
  if (source.native.raw.memory.episodes.slice(-8)[0].action !== undefined) {
    delete missing.episodes[id]!.action;
    expect(() => projectCalendarPersona(source.native.raw, missing)).toThrow();
  }

  await expect(createCastHistorySource(newGame(17, '0.7.0'))).rejects.toThrow(/three-week.*no supported/i);
  const dead = structuredClone(source.native.raw);
  dead.body.alive = false;
  await expect(createHistoryProjection(dead)).rejects.toThrow();
});
