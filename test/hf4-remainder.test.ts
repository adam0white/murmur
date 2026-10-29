/** Current-native authored Friday and prompting controls; no peer custody or player-feel verdict. */
import { exportRun, readRunHistory } from '@adam0white/human-framework';
import { beforeAll, describe, expect, it } from 'vitest';
import { castOptions } from '../src/sim/canonical-cast.ts';
import { LABEL } from '../src/sim/dilan-content.ts';
import { cloneState, newGame, queueInput, replay, restoreState, runToCard, step } from '../src/sim/game.ts';
import { ctxOf } from '../src/sim/game-hf4.ts';
import { playEncounter } from '../src/sim/hf4-encounter.ts';
import { readDilan } from '../src/sim/hf4-read.ts';
import { momentById, momentsOf } from '../src/sim/moments.ts';
import type { Ctx, GameState, GameStateSnapshot } from '../src/sim/types.ts';

const context: Ctx = {
  day: 8,
  week: 2,
  weekday: 1,
  flags: {},
  chosen: {},
  missedMum: 0,
  tired: false,
  note: '',
  phrases: [{ id: 'feet', text: 'Feet on the floor', practice: 1 }],
};
it('offers the default Friday obligation and lets every current learned morning reach an HF choice', () => {
  for (const version of ['0.10.0', '0.10.1', '0.10.2']) {
    expect(momentsOf(5, version).some((m) => m.id === 'handover-5')).toBe(true);
    expect(momentsOf(5, version).some((m) => m.id === 'slump-5')).toBe(false);
    expect(
      momentsOf(8, version)
        .find((m) => m.id === 'alarm-8')!
        .when?.(context),
    ).toBe(true);
    expect(momentById('alarm-8', version).when?.(context)).toBe(true);
    const dinner = momentsOf(3, version).find((m) => m.id === 'dinner-3')!;
    const options = typeof dinner.options === 'function' ? dinner.options(context) : dinner.options;
    for (const option of castOptions(newGame(17, version), dinner, options).filter(
      (o) => o.action === 'dinner',
    )) {
      expect(option.alsoDoes).toBeUndefined();
      expect(option.keeps).toContain('mum');
    }
  }
});
function reach(s: GameState, id: string) {
  for (let count = 0; count < 100; count++) {
    if (s.card?.moment === id) return;
    if (s.phase === 'evening' || s.phase === 'end') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card?.moment === id) return;
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  throw new Error(`Did not reach ${id}`);
}
describe('actual dinner and Friday branches', () => {
  let before: GameStateSnapshot;
  let dinner: { keptAylin: boolean; keptMum: boolean; syntheticCall: boolean };
  const choices = new Set<string>();
  // One actually played four-day prefix, reused by both complete branch/replay controls.
  // Each original120s deadline remains; no history, assertion or actor is removed.
  beforeAll(() => {
    const s = newGame(17, '0.10.1');
    reach(s, 'dinner-3');
    const at = readDilan(s.hf.run).at;
    queueInput(s, { kind: 'quiet' });
    const kept = readDilan(s.hf.run).agenda.commitments.filter((c) => c.status === 'kept');
    const entries = readRunHistory(exportRun(s.hf.run)).flatMap((t) => t.inputs);
    dinner = {
      keptAylin: kept.some((c) => c.label === LABEL.aylin),
      keptMum: kept.some((c) => c.label === LABEL.mum && c.from <= at && c.until >= at),
      syntheticCall: entries.some((i) => i.id === 'dinner-3:also:offers'),
    };
    reach(s, 'handover-5');
    before = cloneState(s);
  }, 120_000);
  it('settles one real dinner against both duties without a synthetic call', () => {
    expect(dinner).toEqual({ keptAylin: true, keptMum: true, syntheticCall: false });
  });
  it.each([{ kind: 'quiet' as const }, { kind: 'say' as const, option: 'handover', insist: true }])(
    'records Friday $kind and exactly cold continues/replays its complete prefix',
    (input) => {
      const branch = restoreState(before);
      queueInput(branch, input);
      choices.add(branch.chosen['handover-5']!);
      expect(branch.chosen['handover-5']).toMatch(/handover|board|none/);
      if (branch.chosen['handover-5'] === 'handover') {
        expect(branch.flags.w3?.handover).toBe('handover');
        const joint = branch.log.at(-1)?.text?.includes('Together they found');
        expect(joint).toBe(
          branch.cast!.encounters.some((e) => e.person === 'ece' && e.action === 'handover-ece'),
        );
      }
      const scene = momentById('floor-15', branch.version).scene;
      expect(typeof scene).toBe('function');
      const later = typeof scene === 'function' ? scene(ctxOf(branch)) : scene;
      const joint = branch.cast!.encounters.some((e) => e.person === 'ece' && e.action === 'handover-ece');
      if (branch.flags.w3?.handover === 'handover') {
        expect(later).toContain(
          joint ? 'Ece taps the sheet they fixed together' : 'Dilan remembers the parcel she found',
        );
      } else {
        expect(later).toContain('Ece still has last Friday’s unchecked sheet');
      }
      expect(later).not.toContain('Ece remembers taking the unchecked handover');
      const restored = restoreState(cloneState(branch));
      step(branch);
      step(restored);
      expect(cloneState(restored)).toEqual(cloneState(branch));
      expect(cloneState(replay(branch.seed, branch.inputs, branch.minute, branch.version))).toEqual(
        cloneState(branch),
      );
    },
    120_000,
  );
  it('includes an actual completed handover path without forcing assent', () => {
    expect(choices.has('handover')).toBe(true);
  });
});

it('records Ece choosing her own time in the authored free-opening host fixture', () => {
  const s = newGame(17, '0.10.1');
  // Authored opening fixture, as in hf4-outcome-companions: skip the first routine slot.
  // This does not force Ece's choice and is not a natural Friday player trace.
  s.hf.nextCompanionEvent = 2;
  expect(playEncounter(s, 'ece', 'handover-ece', 20, 'depot')).toBe(false);
  expect(s.cast?.encounters).toEqual([expect.objectContaining({ person: 'ece', action: 'own-time' })]);
});

it('learns the actual alarm cue and lets HF decay practice without host mutation', async () => {
  const { advanceHost } = await import('../src/sim/hf4-host.ts');
  const { settleMurmur } = await import('../src/sim/hf4-world.ts');
  const s = newGame(17, '0.10.0');
  runToCard(s);
  expect(readDilan(s.hf.run).promptings.responses).toHaveLength(0);
  queueInput(s, { kind: 'say', option: 'up', insist: true });
  const learned = readDilan(s.hf.run).promptings.responses.find((r) => r.id === 'feet')!;
  expect(learned).toBeDefined();
  expect(learned.cue).toBe('snooze');
  const before = learned.effectivePractice;
  const at = readDilan(s.hf.run).at;
  advanceHost(s.hf, at + 86_400_000, [], (host, request) => settleMurmur(host, request, []));
  const after = readDilan(s.hf.run).promptings.responses.find((r) => r.id === 'feet')!;
  expect(after.effectivePractice).toBeCloseTo(before * 0.8, 5);
  expect(after.practice).toBe(learned.practice);
  const history = readRunHistory(exportRun(s.hf.run));
  const input = history.flatMap((t) => t.inputs).find((i) => i.kind === 'prompting.response-learned');
  expect(input?.kind === 'prompting.response-learned' && input.payload.response.cue).toBe('snooze');
});
