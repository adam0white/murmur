/** Current-native authored Friday and prompting controls; no peer custody or player-feel verdict. */
import { exportRun, readRunHistory } from '@adam0white/human-framework';
import { expect, it } from 'vitest';
import { LABEL } from '../src/sim/dilan-content.ts';
import { cloneState, newGame, queueInput, replay, restoreState, runToCard, step } from '../src/sim/game.ts';
import { readDilan } from '../src/sim/hf4-read.ts';
import { momentById, momentsOf } from '../src/sim/moments.ts';
import type { Ctx, GameState } from '../src/sim/types.ts';

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
  for (const version of ['0.9.0', '0.9.1', '0.9.2']) {
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
    for (const option of options.filter((o) => o.action === 'dinner')) {
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
it('settles one real dinner against both duties, then records Friday alternatives and exactly replays', () => {
  const s = newGame(17);
  reach(s, 'dinner-3');
  const at = readDilan(s.hf.run).at;
  queueInput(s, { kind: 'quiet' });
  const kept = readDilan(s.hf.run).agenda.commitments.filter((c) => c.status === 'kept');
  expect(kept.some((c) => c.label === LABEL.aylin)).toBe(true);
  expect(kept.some((c) => c.label === LABEL.mum && c.from <= at && c.until >= at)).toBe(true);
  const entries = readRunHistory(exportRun(s.hf.run)).flatMap((t) => t.inputs);
  expect(entries.some((i) => i.id === 'dinner-3:also:offers')).toBe(false);
  reach(s, 'handover-5');
  const before = cloneState(s);
  const choices = new Set<string>();
  for (const input of [
    { kind: 'quiet' as const },
    { kind: 'say' as const, option: 'handover', insist: true },
  ]) {
    const branch = restoreState(before);
    queueInput(branch, input);
    choices.add(branch.chosen['handover-5']!);
    expect(branch.chosen['handover-5']).toMatch(/handover|board|none/);
    expect(branch.log.at(-1)?.text).not.toContain('Ece took the unchecked sheet');
    // A completed Dilan action cannot invent Ece's joint work, and no diagnostic truncates native inputs.
    if (branch.chosen['handover-5'] === 'handover') {
      expect(branch.flags.w3?.handover).toBe('handover');
      const joint = branch.log.at(-1)?.text?.includes('They checked');
      expect(joint).toBe(
        branch.cast!.encounters.some((e) => e.person === 'ece' && e.action === 'handover-ece'),
      );
    }
    const restored = restoreState(cloneState(branch));
    step(branch);
    step(restored);
    expect(cloneState(restored)).toEqual(cloneState(branch));
    expect(cloneState(replay(branch.seed, branch.inputs, branch.minute, branch.version))).toEqual(
      cloneState(branch),
    );
  }
  expect(choices.has('handover')).toBe(true);
}, 120_000);

it('learns the actual alarm cue and lets HF decay practice without host mutation', async () => {
  const { advanceHost } = await import('../src/sim/hf4-host.ts');
  const { settleMurmur } = await import('../src/sim/hf4-world.ts');
  const s = newGame(17);
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
