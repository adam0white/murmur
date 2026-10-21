import { createHash } from 'node:crypto';
import { promise, releaseCommitment } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { dayStart, LABEL, WAKE } from '../src/sim/dilan.ts';
import {
  anotherWeek,
  canAnotherWeek,
  cardView,
  cloneState,
  ctxOf,
  fingerprint,
  insistCarries,
  listens,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import * as weekTwo from '../src/sim/week2.ts';

const canonical = (x: unknown): unknown =>
  Array.isArray(x)
    ? x.map(canonical)
    : x && typeof x === 'object'
      ? Object.fromEntries(
          Object.entries(x)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([k, v]) => [k, canonical(v)]),
        )
      : x;
function hash(s: GameState, normalizeVersion = false): string {
  const saved = cloneState(s);
  if (normalizeVersion) saved.version = '0.3.0';
  return createHash('sha256')
    .update(JSON.stringify(canonical(saved)))
    .digest('hex');
}

type Policy = 'silent' | 'tap' | 'insist' | 'edge';
const RANK = { yes: 4, 'if pushed': 3, later: 2, 'rather not': 1, no: 0 } as const;
function answer(s: GameState, policy: Policy) {
  const v = cardView(s);
  if (!v) return;
  if (policy === 'silent') {
    // Exercise timeout as well as explicit silence in the replay corpus.
    if (s.day % 2 === 0) queueInput(s, { kind: 'quiet' });
    else while (s.card) step(s);
    return;
  }
  const first = v.options.find((o) => !o.isPull) ?? v.options[0];
  if (!first) throw new Error(`No options on ${v.id}`);
  if (policy === 'insist') {
    queueInput(s, { kind: 'say', option: first.id, insist: true });
    return;
  }
  if (policy === 'edge') {
    const c = ctxOf(s);
    if (v.options.some((o) => o.id === 'lie') && c.flags.lied === undefined) {
      queueInput(s, { kind: 'say', option: 'lie' });
      return;
    }
    if (c.tired && ['coffee', 'watch', 'sleep'].includes(v.pullTo)) {
      queueInput(s, { kind: 'say', option: v.pullTo });
      return;
    }
    const push = v.options.find((o) => !o.isPull && RANK[o.pushed] > RANK[o.lean] && RANK[o.pushed] >= 3);
    if (push && insistCarries(s.person)) {
      queueInput(s, { kind: 'say', option: push.id, insist: true });
      return;
    }
  }
  const best = [...v.options].sort(
    (a, b) => (b.likelihood ?? RANK[b.lean] / 4) - (a.likelihood ?? RANK[a.lean] / 4),
  )[0];
  queueInput(s, { kind: 'say', option: best?.id ?? first.id });
}

/** Stop at the requested evening or the week's ending, never automatically start another week. */
function play(s: GameState, policy: Policy, stopDay = 99): GameState {
  for (let guard = 0; guard < 1000; guard++) {
    if (s.phase === 'end' || (s.phase === 'evening' && s.day >= stopDay)) return s;
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) answer(s, policy);
    }
  }
  throw new Error(`Play did not finish: day ${s.day}, ${s.phase}`);
}

function expectRebuilt(s: GameState) {
  const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
  // A final answer and endDay can share a minute. Complete that boundary without advancing time.
  if (s.phase !== 'day') while (rebuilt.phase === 'day') step(rebuilt);
  expect(hash(rebuilt)).toBe(hash(s));
  const restored = restoreState(JSON.parse(JSON.stringify(cloneState(s))));
  expect(hash(restored)).toBe(hash(s));
  return restored;
}

describe('the second week edition', () => {
  // Captured before 0.4.1 copy changes. Whole-state hashes include the authored journal and replies.
  it.each([
    [
      'silent',
      '49bd23a4dae54ed0c7f79976c24945dfde4dbafe62483733bb7f780b7d193d01',
      '20589e61f4a69603f13bd7fbe0b9e8ca99135ec7e294795a853ce63539378216',
      'f442355a516d8503e958d8432d0eea720856de37e883cf8de9e4a0146e9e6b54',
    ],
    [
      'tap',
      '202c423b479b15a0f680a9c5bca195227e75e736ce45fac737b61b1b8ac91ced',
      '2f73cee1d03d3a1b0c2cb04335911fe2d055ef1ee72631e37c6c8f66c4daf6d8',
      '26cb9f69b93b7755cd46f6cd7586253458e91095ba8feb9e73f56809c313b02a',
    ],
    [
      'insist',
      'd65383a76f6b6bde56a87c8c4767becfefc8553274876cc1f7a9cfe446fb3957',
      '2d0b7c2663d5cd448f2b07aad7b135585dff660c62065beb4ae91423acb8eb80',
      '1bb26087f3be51cda5e6c5df14b731c3a50c411c3d3a0c5acca94c1a4df66138',
    ],
    [
      'edge',
      'cd490c81082120348d7d63811cad31d828c5992148e894f0bda95ac28238680a',
      '8b181df8fdd236aeb2ff586d2557a498a7c5275468ca6914818740d18ed29a52',
      '0faef056e622981591c45f63459f3d760369c114ca39a1753c1becba78153870',
    ],
  ] as const)(
    'preserves 0.4.0 export, replay, and restored continuation: %s',
    (policy, first, checkpoint, final) => {
      const s = play(newGame(1000, '0.4.0'), policy);
      expect(hash(s)).toBe(first);
      expectRebuilt(s);
      expect(anotherWeek(s)).toBe(s);
      expect(s.version).toBe('0.4.0');
      play(s, policy, 10);
      expect(hash(s)).toBe(checkpoint);
      const restored = expectRebuilt(s);
      play(s, policy);
      play(restored, policy);
      expect(hash(s)).toBe(final);
      expect(hash(restored)).toBe(final);
      expectRebuilt(s);
    },
    30_000,
  );

  it.each(['silent', 'tap', 'insist', 'edge'] as const)(
    'replays and restores the 0.4.1 second week: %s',
    (policy) => {
      const s = play(newGame(1000), policy);
      expect(s.version).toBe('0.4.1');
      anotherWeek(s);
      play(s, policy, 10);
      const restored = expectRebuilt(s);
      play(s, policy);
      play(restored, policy);
      expect(hash(restored)).toBe(hash(s));
      expectRebuilt(s);
    },
    30_000,
  );

  it('shares listening rules across editions 0.3.0, 0.4.0, and 0.4.1', () => {
    expect(listens({ version: '0.3.0' })).toBe(true);
    expect(listens({ version: '0.4.0' })).toBe(true);
    expect(listens({ version: '0.4.1' })).toBe(true);
    expect(listens({ version: '0.2.1' })).toBe(false);
    expect(listens({ version: 'unknown' })).toBe(false);
  });
  for (const seed of [1000, 1001, 1002, 1003]) {
    for (const policy of ['silent', 'tap', 'insist', 'edge'] as const) {
      it(`keeps all week-one state identical to 0.3.0: ${seed}/${policy}`, () => {
        const old = newGame(seed, '0.3.0');
        const current = newGame(seed, '0.4.0');
        expect(hash(current, true)).toBe(hash(old));
        for (const day of [1, 3, 5, 6]) {
          play(old, policy, day);
          play(current, policy, day);
          expect(hash(current, true)).toBe(hash(old));
        }
        expect(current.phase).toBe('end');
        expect(current.day).toBe(6);
      }, 30_000);
    }
  }

  it('offers continuation only at the first Saturday ending in listening editions', () => {
    for (const edition of ['0.2.1', '0.3.0', '0.4.0', '0.4.1']) {
      const s = newGame(1000, edition);
      expect(canAnotherWeek(s)).toBe(false);
      play(s, 'tap', 5);
      expect(canAnotherWeek(s)).toBe(false);
      play(s, 'tap');
      expect(canAnotherWeek(s)).toBe(edition !== '0.2.1');
      for (const phase of ['day', 'evening'] as const) {
        expect(canAnotherWeek({ ...s, phase })).toBe(false);
      }
      expect(canAnotherWeek({ ...s, day: 13 })).toBe(false);
    }
  }, 30_000);

  it('leaves old-edition endings unchanged when next is logged', () => {
    for (const edition of ['0.2.1', '0.3.0']) {
      const s = play(newGame(1001, edition), 'tap');
      const before = cloneState(s);
      queueInput(s, { kind: 'next' });
      expect(s.inputs.at(-1)).toEqual({ kind: 'next', at: before.minute });
      const expected = { ...before, inputs: s.inputs, applied: s.applied };
      expect(hash(s)).toBe(hash(expected));
      expect(s.applied).toBe(before.applied + 1);
    }
  }, 30_000);

  it('upgrades a finished 0.3.0 run by replay without modifying its original export', () => {
    const old = play(newGame(1002, '0.3.0'), 'edge');
    const before = hash(old);
    const equivalent = play(replay(old.seed, old.inputs, old.minute, '0.4.1'), 'edge');
    expect(hash(equivalent, true)).toBe(hash(old));
    expect(fingerprint(equivalent)).toBe(fingerprint(old));
    const upgraded = anotherWeek(old);
    expect(upgraded).not.toBe(old);
    expect(hash(old)).toBe(before);
    expect(upgraded.version).toBe('0.4.1');
    expect(anotherWeek(equivalent)).toBe(equivalent);
    expect(hash(upgraded)).toBe(hash(equivalent));
    expectRebuilt(upgraded);
  }, 30_000);

  it('rejects a finished 0.3.0 state whose fingerprint no longer matches its input replay', () => {
    const s = play(newGame(1000, '0.3.0'), 'tap');
    const voice = s.person.will.voices.find((v) => v.voiceId === 'you');
    if (!voice) throw new Error('Expected the player voice');
    voice.trust = voice.trust > 0.5 ? 0.1 : 0.9;
    const before = hash(s);
    expect(() => anotherWeek(s)).toThrow(/replay|match/i);
    expect(hash(s)).toBe(before);
  }, 30_000);

  it('next preserves Saturday canon and crosses the offstage weekend to Monday waking', () => {
    const s = play(newGame(1000, '0.4.0'), 'tap');
    const final = structuredClone(s.final);
    const pages = structuredClone(s.pages);
    const before = s.minute;
    queueInput(s, { kind: 'next' });
    expect(s.day).toBe(8);
    expect(s.phase).toBe('day');
    expect(s.minute).toBe(dayStart(8) + WAKE - 1);
    expect(s.person.now).toBe(s.minute);
    expect(s.minute - before).toBeGreaterThan(1440);
    expect(s.card).toBeNull();
    expect(s.final).toBeNull();
    expect(s.past).toEqual([final]);
    expect(ctxOf(s).weekOne).toEqual(final);
    expect(s.pages).toEqual(pages);
    expect(s.pages.some((p) => p.day === 7)).toBe(false);
    expect(canAnotherWeek(s)).toBe(false);
    const weekend = s.person.trace.filter((r) => r.at >= before && r.at < s.minute);
    expect(weekend.filter((r) => r.chosenAction === 'sleep')).toHaveLength(2);
    for (const day of [6, 7]) {
      const actions = weekend
        .filter((r) => r.at >= dayStart(day) && r.at < dayStart(day + 1))
        .map((r) => r.chosenAction);
      expect(actions).toContain('meal');
      expect(actions).toContain('home');
      expect(actions).not.toContain('dispatch');
    }
    const recurring = s.person.agenda.commitments.filter((c) =>
      [LABEL.alarm, LABEL.mum].includes(c.label as typeof LABEL.alarm | typeof LABEL.mum),
    );
    for (const label of [LABEL.alarm, LABEL.mum]) {
      const renewed = recurring.filter((c) => c.label === label && c.from >= dayStart(8));
      expect(renewed.length).toBeGreaterThan(0);
      expect(renewed.some((c) => c.from < dayStart(9))).toBe(true);
      expect(renewed.some((c) => (c.recurUntil ?? c.until) >= dayStart(12))).toBe(true);
    }
    expect(
      s.person.agenda.commitments.filter((c) => c.label === LABEL.aylin && c.from >= dayStart(8)),
    ).toEqual([]);
    expectRebuilt(s);
  }, 30_000);

  it('fades unused practice on both offstage nights and releases Saturday reinforcement on Sunday', () => {
    const s = play(newGame(1001, '0.4.0'), 'tap');
    const responses = s.person.promptings?.responses;
    if (!responses) throw new Error('Dilan must have HF promptings enabled');
    responses.push(
      { id: 'unused-test-phrase', kind: 'leave', practice: 0.7, lastUsedAt: s.minute },
      { id: 'reinforced-test-phrase', kind: 'leave', practice: 0.7, lastUsedAt: s.minute },
    );
    s.stats.reinforced = ['reinforced-test-phrase'];
    queueInput(s, { kind: 'next' });
    expect(responses.find((r) => r.id === 'unused-test-phrase')?.practice).toBeCloseTo(0.7 * 0.8 * 0.8);
    expect(responses.find((r) => r.id === 'reinforced-test-phrase')?.practice).toBeCloseTo(0.7 * 0.8);
  }, 30_000);

  it('counts missed Mum calls within the current week', () => {
    const s = play(newGame(1003, '0.4.0'), 'silent');
    const firstWeek = s.pages.filter((p) => p.missed.includes(LABEL.mum)).length;
    expect(firstWeek).toBeGreaterThan(0);
    expect(ctxOf(s).missedMum).toBe(firstWeek);
    anotherWeek(s);
    expect(ctxOf(s).missedMum).toBe(0);
    play(s, 'silent', 9);
    expect(ctxOf(s).missedMum).toBe(s.pages.filter((p) => p.day >= 8 && p.missed.includes(LABEL.mum)).length);
  }, 30_000);

  it('lets an explicit HF release remove an Ece promise from the evening accounting', () => {
    const held = play(newGame(1002, '0.4.0'), 'tap');
    queueInput(held, { kind: 'next' });
    const label = 'my test word to Ece';
    const commitment = promise(held.person, {
      kind: 'promise',
      toId: 'ece',
      label,
      actions: ['test-practice-with-ece'],
      from: dayStart(8) + 18 * 60,
      until: dayStart(8) + 21 * 60,
      importance: 0.6,
    });
    const withdrawn = restoreState(cloneState(held));
    expect(releaseCommitment(withdrawn.person, commitment.id)).toBe(true);
    play(held, 'silent', 8);
    play(withdrawn, 'silent', 8);
    expect(held.pages.find((p) => p.day === 8)?.missed).toContain(label);
    const page = withdrawn.pages.find((p) => p.day === 8);
    expect(page?.missed).not.toContain(label);
    expect(page?.kept).not.toContain(label);
    expect(withdrawn.person.agenda.commitments.find((c) => c.id === commitment.id)?.status).toBe('released');
  }, 30_000);

  it.skipIf(!weekTwo.WEEK_TWO.some((m) => m.day === 8 && m.id.startsWith('alarm-')))(
    'uses strong Feet practice for an unprompted morning and records it in the evening',
    () => {
      const alarm = weekTwo.WEEK_TWO.find((m) => m.day === 8 && m.id.startsWith('alarm-'));
      if (!alarm) throw new Error('Expected the authored Monday alarm');
      const threshold = (weekTwo as typeof weekTwo & { FEET_ALONE_FROM?: number }).FEET_ALONE_FROM ?? 0.35;
      const strong = play(newGame(1000, '0.4.0'), 'tap');
      queueInput(strong, { kind: 'next' });
      const weak = restoreState(cloneState(strong));
      for (const [s, practice] of [
        [strong, threshold],
        [weak, threshold - 0.001],
      ] as const) {
        s.phrases = [...s.phrases.filter((p) => p.id !== 'feet'), { id: 'feet', text: 'Feet on the floor' }];
        const promptings = s.person.promptings;
        if (!promptings) throw new Error('Dilan must have HF promptings enabled');
        promptings.responses = [
          ...promptings.responses.filter((r) => r.id !== 'feet'),
          { id: 'feet', kind: 'leave', practice, lastUsedAt: s.minute },
        ];
        runToCard(s);
      }
      expect(weak.card?.moment).toBe(alarm.id);
      expect(weak.stats.gotUpAlone).toBeUndefined();
      expect(strong.card?.moment).not.toBe(alarm.id);
      expect(strong.chosen[alarm.id]).toBeTruthy();
      expect(strong.stats.gotUpAlone).toBe(true);
      expect(strong.inputs.some((i) => i.kind === 'say' && i.at >= dayStart(8))).toBe(false);
      expect(strong.log.some((line) => line.at >= dayStart(8) && /feet|floor/i.test(line.text))).toBe(true);
      play(strong, 'silent', 8);
      expect(strong.pages.find((p) => p.day === 8)?.gotUpAlone).toBe(true);
    },
    30_000,
  );

  for (const seed of [1000, 1001, 1002, 1003]) {
    for (const policy of ['silent', 'tap', 'insist'] as const) {
      it(`finishes and reconstructs both weeks: ${seed}/${policy}`, () => {
        const s = play(newGame(seed, '0.4.0'), policy);
        anotherWeek(s);
        const restoredAtWake = expectRebuilt(s);
        for (const day of [8, 10, 12, 13]) {
          play(s, policy, day);
          play(restoredAtWake, policy, day);
          expect(hash(restoredAtWake)).toBe(hash(s));
          const restored = expectRebuilt(s);
          const direct = restoreState(cloneState(s));
          if (s.phase === 'evening') {
            for (const branch of [direct, restored]) {
              queueInput(branch, { kind: 'next' });
              runToCard(branch);
              expectRebuilt(branch);
              for (let i = 0; i < 37; i++) step(branch);
            }
            expect(hash(restored)).toBe(hash(direct));
          }
        }
        expect(s.phase).toBe('end');
        expect(s.day).toBe(13);
        expect(s.pages.map((p) => p.day)).toEqual([1, 2, 3, 4, 5, 8, 9, 10, 11, 12]);
        expect(s.past).toHaveLength(1);
        expect(s.final).not.toBeNull();
        const secondWeek = s.pages.filter((p) => p.day >= 8);
        expect(s.final?.strip).toEqual(
          secondWeek.map((p) => ({ day: p.day, kept: p.kept, missed: p.missed })),
        );
        expect(s.final?.hands.start).toEqual(secondWeek[0]?.hands);
        expect(s.final?.hands.end).toEqual({
          you: s.person.will.voices.find((v) => v.voiceId === 'you')?.trust,
          pull: s.person.will.voices.find((v) => v.voiceId === 'pull')?.trust,
        });
        for (const day of [8, 9, 10, 11, 12]) {
          for (const [label, from, until] of [
            [LABEL.alarm, WAKE - 5, WAKE + 20],
            [LABEL.mum, 17 * 60 + 30, 21 * 60 + 30],
          ] as const) {
            expect(
              s.person.agenda.commitments.some(
                (c) =>
                  c.label === label && c.from === dayStart(day) + from && c.until === dayStart(day) + until,
              ),
            ).toBe(true);
          }
        }
        expect(canAnotherWeek(s)).toBe(false);
      }, 60_000);
    }
  }
});
