import { inspect, type PersonView } from '@adam0white/human-framework';
import {
  canonicalCast,
  claimCastChapterBatch,
  createPersona,
  initialPersonaLife,
  type PersonaEnvelope,
  type PersonaRequest,
  preparePersonaLife,
} from '@adam0white/lab-client';
import { expect, it } from 'vitest';
import { prepareCastChapter, validateCastChapter } from '../src/sim/cast-chapter.ts';
import { cloneState, fingerprint, newGame, replay, restoreState } from '../src/sim/game.ts';
import { MURMUR_ACTIONS } from '../src/sim/hf4-actions.ts';
import { createMurmurOpening } from '../src/sim/hf4-opening.ts';
import { readPerson } from '../src/sim/hf4-read.ts';

async function source(withDuty = false) {
  const run = createMurmurOpening(17, MURMUR_ACTIONS);
  const cast = canonicalCast('hf.cast.aylin.murmur');
  const result = inspect(run, {
    perspective: { kind: 'host' },
    people: ['aylin'],
    select: ['persona', 'calendar'],
    portable: { person: 'aylin', castId: cast.castId, castRevision: cast.revision },
  });
  if (!result.ok) throw new Error(result.error.message);
  const view = result.value.people[0] as Extract<PersonView, { kind: 'host' }>;
  const portable = view.parts.find((p) => p.select === 'persona')?.value;
  if (!portable || !('format' in portable) || portable.version !== 2)
    throw new Error('Missing retained passport');
  const retained = structuredClone(portable);
  if (withDuty)
    retained.retained.agenda.commitments = [
      {
        id: 'source-duty',
        kind: 'promise',
        toId: 'self',
        label: 'finish the source dinner',
        actions: ['dinner'],
        from: retained.retained.at,
        until: retained.retained.at + 3600000,
        importance: 0.7,
        status: 'pending',
      },
    ];
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: cast.castId,
    castRevision: cast.revision,
    branchId: 'fixture-aylin',
    parentRevision: null,
    source: { game: 'murmur', build: 'fixture', engine: portable.source.engine, rules: '0.9.0' },
    transfer: {
      castPassport: 'hf-portable-person/2',
      portable: retained,
      life: initialPersonaLife(cast.castId, 'fixture-aylin', 1_800_000_000_000),
    },
    limitations: [],
  });
  return { parent, portable };
}
it('admits a complete retained person before an atomic exact-parent cast claim', async () => {
  const { parent } = await source();
  const input = preparePersonaLife(parent, 1_800_000_000_000);
  const prepared = await prepareCastChapter([input], 17);
  let writes = 0;
  const shelf = {
    request: async <T>(r: PersonaRequest): Promise<T> => {
      if (r.action === 'prepareBatch')
        return { inputs: [input], blocked: [], expectedHeads: { [parent.castId]: parent.revision } } as T;
      if (r.action === 'putBatch') {
        writes++;
        expect(r.expectedHeads?.[parent.castId]).toBe(parent.revision);
        return {} as T;
      }
      throw new Error('Unexpected request');
    },
  };
  const result = await claimCastChapterBatch(
    shelf,
    [parent.castId],
    { game: 'murmur', build: 'fixture', engine: parent.source.engine, rules: '0.9.0' },
    async () => prepared.initial,
  );
  if (!result) throw new Error('Missing cast claim');
  prepared.claims = result.claims;
  await validateCastChapter(prepared, 17);
  expect(writes).toBe(1);
  const s = newGame(17, '0.9.0', prepared, false);
  expect(fingerprint(replay(s.seed, s.inputs, s.minute, s.version, prepared, false))).toBe(fingerprint(s));
  expect(readPerson(s.hf.run, 'aylin').body.state.health).toBe(1);
  expect(s.castChapter?.inputs[0]?.parent.revision).toBe(parent.revision);
  expect(fingerprint(restoreState(JSON.parse(JSON.stringify(cloneState(s)))))).toBe(fingerprint(s));
});
it('refuses an old passport and altered captured life before any chapter starts', async () => {
  const { parent } = await source();
  const input = preparePersonaLife(parent, 1_800_000_000_000);
  const { revision: _revision, ...body } = parent;
  const old = await createPersona({
    ...body,
    transfer: { ...parent.transfer, castPassport: 'murmur-cast/1' },
  });
  await expect(prepareCastChapter([preparePersonaLife(old, 1_800_000_000_000)], 17)).rejects.toThrow(
    /source notebook/,
  );
  input.clockMs += 86_400_000;
  await expect(prepareCastChapter([input], 17)).rejects.toThrow(/captured life/);
});

it('preserves an incoming source duty with its exact recipient and clock', async () => {
  const { parent } = await source(true);
  const chapter = await prepareCastChapter([preparePersonaLife(parent, 1_800_000_000_000)], 17);
  const s = newGame(17, '0.9.0', chapter);
  const duty = readPerson(s.hf.run, 'aylin').agenda.commitments.find((c) => c.id === 'source-duty');
  expect(duty).toMatchObject({ status: 'pending', toId: 'aylin', actions: ['dinner'] });
  expect(duty?.until).toBe(
    chapter.portable.aylin!.person.version === 2 ? chapter.portable.aylin!.person.retained.at + 3600000 : 0,
  );
});

it('admits actual played memories with their declared place reference', async () => {
  const { freshMurmurHf4 } = await import('../src/sim/hf4-game.ts');
  const { advanceHost } = await import('../src/sim/hf4-host.ts');
  const { settleMurmur } = await import('../src/sim/hf4-world.ts');
  const { saturdayRoutineEndsAt } = await import('../src/sim/hf4-companions.ts');
  const game = freshMurmurHf4(17);
  const end = saturdayRoutineEndsAt(readPerson(game.run, 'aylin').at);
  advanceHost(game, end, [], (host, request) => settleMurmur(host, request, []));
  expect(game.host.active.some((a) => a.person === 'aylin')).toBe(false);
  const cast = canonicalCast('hf.cast.aylin.murmur');
  const projected = inspect(game.run, {
    perspective: { kind: 'host' },
    people: ['aylin'],
    select: ['persona', 'calendar'],
    portable: { person: 'aylin', castId: cast.castId, castRevision: cast.revision },
  });
  if (!projected.ok) throw new Error(projected.error.message);
  const view = projected.value.people[0] as Extract<PersonView, { kind: 'host' }>;
  const portable = view.parts.find((p) => p.select === 'persona')?.value;
  if (!portable || !('format' in portable) || portable.version !== 2)
    throw new Error('Missing played passport');
  expect(portable.retained.memory.episodes.some((e) => e.placeId === 'home')).toBe(true);
  const parent = await createPersona({
    format: 'hf-persona/1',
    castId: cast.castId,
    castRevision: cast.revision,
    branchId: 'played-aylin',
    parentRevision: null,
    source: { game: 'murmur', build: 'fixture', engine: portable.source.engine, rules: '0.9.0' },
    transfer: {
      castPassport: 'hf-portable-person/2',
      portable,
      life: initialPersonaLife(cast.castId, 'played-aylin', 1_800_000_000_000),
    },
    limitations: [],
  });
  const chapter = await prepareCastChapter([preparePersonaLife(parent, 1_800_000_000_000)], 17);
  const s = newGame(17, '0.9.0', chapter);
  const arrival = inspect(s.hf.run, {
    perspective: { kind: 'host' },
    people: ['aylin'],
    select: ['persona', 'calendar'],
    portable: { person: 'aylin', castId: cast.castId, castRevision: cast.revision },
  });
  if (!arrival.ok) throw new Error(arrival.error.message);
  const current = (arrival.value.people[0] as Extract<PersonView, { kind: 'host' }>).parts.find(
    (p) => p.select === 'persona',
  )?.value;
  if (!current || !('format' in current) || current.version !== 2)
    throw new Error('Missing admitted passport');
  expect(current.retained.memory.episodes.map((e) => e.placeId)).toEqual(
    portable.retained.memory.episodes.map((e) => e.placeId),
  );
  expect(current.retained.memory.episodes.length).toBe(portable.retained.memory.episodes.length);
});
