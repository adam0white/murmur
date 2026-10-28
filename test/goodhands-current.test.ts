import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ENGINE_VERSION } from '@adam0white/human-framework-legacy';
import { canonicalPersona, createPersona, preparePersonaLife } from '@adam0white/lab-client';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { prepareCastChapter, validateCastChapter } from '../src/legacy/cast-chapter.ts';
import { createCastSource } from '../src/legacy/cast-source.ts';
import { cloneState, newGame, queueInput, replay, runToCard } from '../src/legacy/game.ts';
import type { GameState } from '../src/legacy/types.ts';
import { validateCanonicalRun } from '../src/legacy/ui/cast-chapter.ts';

vi.mock('../src/ui/continuity.ts', () => ({
  shelf: {},
  departureGuardCurrent: () => true,
  publishPersona: vi.fn(),
  recordingEpochGuard: vi.fn(),
}));

// Actual unchanged signed producer artifact. Negative variants below are synthetic refusal controls.
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/goodhands-hf3-aylin.json', import.meta.url), 'utf8'),
);
const parent = fixture.envelope;
const clock = parent.transfer.life.clock.watermark * 3_600_000;

it('admits the actual signed Good Hands Aylin checkpoint and retains its exact claim on replay', async () => {
  expect(fixture.source).toBe('509386298dfd89026c10bc6011d4f29e3323fb0c');
  expect(parent.source).toEqual({
    game: 'goodhands',
    build: '509386298dfd',
    engine: '2.23.0',
    rules: 'goodhands-6',
  });
  const digest = createHash('sha256').update(canonicalPersona(fixture.raw)).digest('hex');
  expect(digest).toBe('d201962b1d8c892ca0b97fefe904e00d2eb18530278adc877dc1c64f6c7d1140');
  expect(parent.transfer.checkpoint.checkpointDigest).toBe(digest);
  expect(parent.transfer.checkpoint.sourceRng).toEqual(fixture.raw.rng);
  const before = canonicalPersona(fixture);
  const input = preparePersonaLife(parent, clock);
  const chapter = await prepareCastChapter([input], 17);
  expect(chapter.initial.people.aylin.rng).toEqual(fixture.raw.rng);
  expect(chapter.initial.people.aylin.body.fitness).toBe(fixture.raw.body.fitness);
  const cooking = chapter.initial.people.aylin.skills.cooking;
  expect(cooking).toEqual({
    ...fixture.raw.skills.cooking,
    lastPracticed:
      fixture.raw.skills.cooking.lastPracticed + chapter.initial.people.aylin.now - fixture.raw.now,
  });
  const { revision, ...body } = parent;
  chapter.claims = [
    await createPersona({
      ...body,
      parentRevision: revision,
      source: { game: 'murmur', build: 'control', engine: ENGINE_VERSION, rules: '0.6.0' },
      transfer: { ...body.transfer, life: input.life },
    }),
  ];
  await validateCastChapter(chapter, 17);
  const s = newGame(17, '0.6.0', chapter);
  s.castHeads = Object.fromEntries(chapter.claims.map((h) => [h.castId, h]));
  s.castScope = 'shared';
  expect(s.castHeads?.[parent.castId]).toEqual(chapter.claims[0]);
  runToCard(s);
  queueInput(s, { kind: 'quiet' });
  const restored = await validateCanonicalRun(s);
  expect(cloneState(restored)).toEqual(cloneState(s));
  if (!restored.castChapter) throw Error('Missing retained chapter');
  await validateCastChapter(restored.castChapter, 17);
  expect(restored.castHeads?.[parent.castId]).toEqual(chapter.claims[0]);
  expect(canonicalPersona(fixture)).toBe(before);
});

for (const [label, mutate] of [
  [
    'engine',
    (p: typeof parent) => {
      p.source.engine = '2.24.0';
    },
  ],
  [
    'rules',
    (p: typeof parent) => {
      p.source.rules = 'goodhands-7';
    },
  ],
  [
    'passport',
    (p: typeof parent) => {
      p.transfer.castPassport = 'goodhands-agency/2';
    },
  ],
  [
    'role',
    (p: typeof parent) => {
      p.transfer.sourceRole = 'zeynep-pass';
    },
  ],
  [
    'checkpoint',
    (p: typeof parent) => {
      p.transfer.checkpoint.sourceRng.a++;
    },
  ],
  [
    'body',
    (p: typeof parent) => {
      p.transfer.agencyPerson.person.health.health = 0.2;
    },
  ],
  [
    'calendar',
    (p: typeof parent) => {
      p.transfer.agencyPerson.calendar.commitments.push({
        id: 'foreign-care',
        kind: 'promise',
        label: 'Care at source',
        status: 'pending',
        from: 520,
        until: 600,
        importance: 0.8,
        normId: 'keep-promise',
        actions: ['care'],
        toId: 'dependent',
      });
    },
  ],
] as const) {
  it(`refuses synthetic unsupported ${label} without changing the actual source`, async () => {
    const before = canonicalPersona(fixture);
    const changed = structuredClone(parent);
    mutate(changed);
    const { revision: _revision, ...body } = changed;
    const forged = await createPersona(body);
    await expect(prepareCastChapter([preparePersonaLife(forged, clock)], 17)).rejects.toThrow(
      label === 'calendar' ? /a source duty needs its actual source chapter/ : undefined,
    );
    expect(canonicalPersona(fixture)).toBe(before);
  });
}

// In-memory owned-claim control; no shared server ownership receipt is asserted.
describe('actual Aylin receiving source retained for native re-entry', () => {
  let source: GameState;
  let chapter: Awaited<ReturnType<typeof prepareCastChapter>>;
  beforeAll(async () => {
    const input = preparePersonaLife(parent, clock);
    const initial = await prepareCastChapter([input], 17);
    const { revision, ...body } = parent;
    initial.claims = [
      await createPersona({
        ...body,
        parentRevision: revision,
        source: { game: 'murmur', build: 'control', engine: ENGINE_VERSION, rules: '0.6.0' },
        transfer: { ...body.transfer, life: input.life },
      }),
    ];
    source = newGame(17, '0.6.0', initial);
    source.castHeads = Object.fromEntries(initial.claims.map((h) => [h.castId, h]));
    source.castScope = 'shared';
    while (source.phase !== 'end') {
      if (source.phase === 'evening') queueInput(source, { kind: 'next' });
      else {
        runToCard(source);
        if (source.card) queueInput(source, { kind: 'quiet' });
      }
    }
    queueInput(source, { kind: 'cast-pause', role: 'aylin' });
    const native = await createCastSource(source, 'aylin');
    const departure = await createPersona({
      ...body,
      parentRevision: initial.claims[0]?.revision,
      source: { game: 'murmur', build: 'control', engine: ENGINE_VERSION, rules: '0.6.0' },
      transfer: { ...native.transfer, life: input.life },
      limitations: native.limitations,
    });
    chapter = await prepareCastChapter([preparePersonaLife(departure, clock)], 17, {
      [departure.revision]: cloneState(source),
    });
    const { revision: departureRevision, ...departureBody } = departure;
    chapter.claims = [await createPersona({ ...departureBody, parentRevision: departureRevision })];
  });
  it('re-enters the exact owned notebook and preserves complete actors and source claims', async () => {
    await validateCastChapter(chapter, 17);
    const s = newGame(17, '0.6.0', chapter);
    expect(s.cast?.people).toEqual(source.cast?.people);
    expect(s.castChapter?.claims).toEqual(chapter.claims);
    expect(chapter.resume?.source.castChapter?.inputs[0]?.parent).toEqual(parent);
    expect(cloneState(replay(17, s.inputs, s.minute, '0.6.0', chapter))).toEqual(cloneState(s));
  });
  it('refuses re-entry without the exact retained source notebook', async () => {
    await expect(prepareCastChapter(chapter.inputs, 17)).rejects.toThrow(/notebook/i);
  });
});
