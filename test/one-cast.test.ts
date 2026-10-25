import { admitPersona, createPerson, projectPersona, promise, snapshot } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { fingerprint, newGame, queueInput, replay, runToCard } from '../src/sim/game.ts';
import {
  checkpointPerson,
  createOneCastDeparture,
  type DilanTransfer,
  installOneCastReturn,
  prepareOneCastReturn,
  RETURN_MAPPING,
  releaseOneCastDeparture,
} from '../src/sim/one-cast.ts';
import type { GameState } from '../src/sim/types.ts';

function playedSaturday(seed = 31): GameState {
  const s = newGame(seed, '0.5.0');
  for (let i = 0; i < 2000 && s.phase !== 'end'; i++) {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  expect(s.phase).toBe('end');
  return s;
}
function departure() {
  const s = playedSaturday();
  queueInput(s, { kind: 'one-cast-release' });
  return s;
}

/** Focused adapter control, explicitly not live target journey evidence. */
async function returnControl(prefix: GameState, accepted = true): Promise<DilanTransfer> {
  const from = (await createOneCastDeparture(prefix)).person;
  const opening = createPerson({
    id: 'dilan-delivery',
    name: 'Dilan',
    sex: 'female',
    seed: 17,
    now: 360,
    bornAt: from.life.bornAt + 360 - from.source.now,
  });
  opening.body.fitness = from.health.fitness;
  const p = admitPersona(from, opening, {
    mappingVersion: 'murmur-hearsay/1',
    sourceId: 'dilan',
    targetId: 'dilan-delivery',
  }).person;
  p.body.fitness -= 0.001;
  p.memory.episodes.push({
    id: 'exchange',
    at: p.now,
    kind: 'witnessed',
    action: accepted ? 'talk' : 'leave',
    actorId: 'hatice',
    valence: accepted ? 0.12 : -0.01,
    salience: 0.4,
    summary: accepted ? 'Hatice respected my work and offered a short exchange.' : 'I ended the exchange.',
    tags: [],
  });
  const person = projectPersona(p, {
    version: RETURN_MAPPING,
    skills: {},
    episodes: {
      exchange: {
        id: 'hearsay-encounter',
        action: accepted ? 'talk' : 'leave',
        actorId: 'hearsay-hatice',
        tags: [],
      },
    },
  });
  return {
    person,
    history: [
      {
        id: 'hearsay-encounter',
        kind: 'hearsay-encounter',
        sourceGame: 'hearsay',
        episodeId: 'hearsay-encounter',
        disclosed: true,
        outcome: accepted ? 'accepted' : 'declined',
      },
    ],
    checkpoint: await checkpointPerson(p),
  };
}

describe('Dilan source and return chapter', () => {
  it('requires a real chapter boundary and explicit replayed release', async () => {
    expect(() => releaseOneCastDeparture(newGame(31))).toThrow(/Saturday/);
    await expect(createOneCastDeparture(playedSaturday())).rejects.toThrow(/explicit/);
    const s = departure();
    const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
    expect(fingerprint(rebuilt)).toBe(fingerprint(s));
    expect(snapshot(rebuilt.person)).toEqual(snapshot(s.person));
    expect(rebuilt.oneCastDeparture).toEqual(s.oneCastDeparture);
    expect(s.oneCastDeparture?.purposes.some((g) => g.label === 'earn-respect')).toBe(true);
    expect(s.log.some((l) => l.text.includes('earning respect') && l.text.includes('not finished'))).toBe(
      true,
    );
  });

  it('uses the real attended delivery, no invented skill, and complete checkpoint SHA256', async () => {
    const s = departure();
    expect(s.chosen['route-3']).toBe('route');
    const transfer = await createOneCastDeparture(s);
    expect(transfer.person.skills).toEqual({});
    expect(transfer.history).toEqual([
      {
        id: 'murmur-attended-route',
        kind: 'delivery-work',
        sourceGame: 'murmur',
        episodeId: 'delivery-work',
        disclosed: false,
      },
    ]);
    expect(transfer.person.episodes[0]?.summary).toBe('take the evening route: completed');
    expect(transfer.person.commitments).toEqual([]);
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(canonicalPersona(snapshot(s.person))),
    );
    expect(transfer.checkpoint.checkpointDigest).toBe(
      Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(''),
    );
    expect(transfer).not.toHaveProperty('world');
    expect(transfer).not.toHaveProperty('save');
    expect(s.person.agenda.commitments.some((c) => c.status === 'broken')).toBe(true);
  });

  it('refuses unresolved promises and unknown purposes atomically', () => {
    const s = playedSaturday();
    promise(s.person, {
      kind: 'promise',
      toId: 'mum',
      label: 'tomorrow’s call',
      actions: ['call-mum'],
      from: s.person.now,
      until: s.person.now + 10,
      importance: 0.5,
    });
    const before = snapshot(s.person);
    expect(() => releaseOneCastDeparture(s)).toThrow(/promise/);
    expect(snapshot(s.person)).toEqual(before);
    const other = playedSaturday();
    other.person.agenda.goals.push({
      id: 'private-project',
      label: 'private project',
      serves: ['meaning'],
      progress: 0.2,
      advancedBy: [],
      importance: 0.5,
      status: 'active',
      adoptedAt: other.person.now,
      lastAdvancedAt: other.person.now,
    });
    const beforeOther = snapshot(other.person);
    expect(() => releaseOneCastDeparture(other)).toThrow(/goal/);
    expect(snapshot(other.person)).toEqual(beforeOther);
  });

  it('never fabricates a delivery memory when its episode is no longer retained', async () => {
    const s = departure();
    s.person.memory.episodes = s.person.memory.episodes.filter((e) => e.action !== 'route');
    const transfer = await createOneCastDeparture(s);
    expect(transfer.history).toEqual([]);
    expect(transfer.person.episodes).toEqual([]);
  });

  it('returns onto the exact local prefix with actual accepted and rejected history', async () => {
    for (const accepted of [true, false]) {
      const prefix = departure();
      const before = structuredClone(prefix);
      const transfer = await returnControl(prefix, accepted);
      const chapter = installOneCastReturn(prefix, transfer);
      expect(prefix).toEqual(before);
      expect(chapter.inputs).toEqual(prefix.inputs);
      expect(chapter.chosen).toEqual(prefix.chosen);
      expect(chapter.pages).toEqual(prefix.pages);
      expect(chapter.final).toEqual(prefix.final);
      expect(chapter.minute).toBe(prefix.minute);
      expect(chapter.person.memory.episodes.find((e) => e.id === 'hearsay-encounter')?.action).toBe(
        accepted ? 'talk' : 'leave',
      );
      expect(chapter.person.body.fitness).toBe(transfer.person.health.fitness);
      expect(
        chapter.person.agenda.goals.some(
          (g) => g.status === 'active' && g.label === 'take up earn-respect again',
        ),
      ).toBe(true);
      expect(chapter.log.at(-1)?.text).toContain(accepted ? 'talked briefly' : 'did not stay');
      expect(installOneCastReturn(prefix, transfer)).toEqual(chapter);
    }
  });

  it('blocks missing local prefix, incompatible clinical health, wrong identity and mismatched stamps', async () => {
    const s = departure();
    const incoming = await returnControl(s);
    expect(() => prepareOneCastReturn(playedSaturday(), incoming)).toThrow(/prefix/);
    const sick = structuredClone(incoming);
    sick.person.health.health = 0.9;
    expect(() => prepareOneCastReturn(s, sick)).toThrow(/clinical/);
    const wrong = structuredClone(incoming);
    wrong.person.source.id = 'murat';
    expect(() => prepareOneCastReturn(s, wrong)).toThrow(/mapping/);
    const mismatch = structuredClone(incoming);
    mismatch.checkpoint.sourceNow++;
    expect(() => prepareOneCastReturn(s, mismatch)).toThrow(/stamps/);
    const absent = structuredClone(incoming);
    absent.history = [];
    expect(() => prepareOneCastReturn(s, absent)).toThrow(/actual attended/);
  });

  it('keeps archived actual encounter receipt without inventing an evicted episode', async () => {
    const s = departure();
    const incoming = await returnControl(s);
    incoming.person.episodes = [];
    const fact = incoming.history[0];
    if (!fact) throw new Error('Expected encounter fixture');
    fact.episodeId = 'e99';
    const result = prepareOneCastReturn(s, incoming);
    expect(result.history[0]?.outcome).toBe('accepted');
    expect(result.person.memory.episodes).toEqual([]);
  });
});
