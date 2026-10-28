import { expect, it } from 'vitest';
import { saturdayRoutineEndsAt } from '../src/sim/hf4-companions.ts';
import { freshMurmurHf4 } from '../src/sim/hf4-game.ts';
import { advanceHost } from '../src/sim/hf4-host.ts';
import { readDilan } from '../src/sim/hf4-read.ts';
import { checkpointMurmur, restoreMurmur, verifySessionReplay } from '../src/sim/hf4-session.ts';
import { RECENT_COMPLETIONS, settleMurmur } from '../src/sim/hf4-world.ts';

it('bounds recent host diagnostics while retaining every accepted completion and replaying the full input history', () => {
  const game = freshMurmurHf4(17);
  advanceHost(game, saturdayRoutineEndsAt(readDilan(game.run).at + 24 * 60 * 60000), [], (host, request) =>
    settleMurmur(host, request, []),
  );
  const saved = checkpointMurmur(game);
  const completions = saved.run.history
    .flatMap((t) => t.inputs)
    .filter((i) => i.kind === 'action.resolved' && i.payload.disposition === 'completed');
  expect(completions.length).toBeGreaterThan(RECENT_COMPLETIONS);
  expect(game.host.completed).toHaveLength(RECENT_COMPLETIONS);
  const restored = restoreMurmur(JSON.parse(JSON.stringify(saved)));
  const roundtrip = checkpointMurmur(restored);
  expect(roundtrip.run.history).toEqual(saved.run.history);
  expect(roundtrip.run.hashes.full).toBe(saved.run.hashes.full);
  expect(restored.host.completed).toEqual(game.host.completed);
  expect(verifySessionReplay(saved.run)).toBe(true);
}, 120000);
