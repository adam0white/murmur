import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import {
  anotherWeek,
  cardView,
  cloneState,
  newGame,
  queueInput,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import { momentsOf } from '../src/sim/moments.ts';
import type { GameState } from '../src/sim/types.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';
import { validateRun } from '../src/ui/one-cast.ts';

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const choices: Record<string, string> = {
  'old-record-15': 'discuss',
  'old-answer-15': 'boundary',
  'dance-invite-16': 'invite',
  'dance-outing-16': 'attend',
  'map-check-17': 'check',
  'map-permission-18': 'permission',
  'map-place-18': 'place',
  'allocation-open-19': 'review',
  'allocation-correct-19': 'correct',
  'route-trial-20': 'trial',
};
function campaign(seed: number, keepOldRecordPrivate = false) {
  let s = newGame(seed, '0.8.0');
  const cards: Record<string, GameState> = {};
  for (let week = 0; week < 3; week++) {
    while (s.phase !== 'end') {
      if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      else {
        runToCard(s);
        if (!s.card) continue;
        const id = s.card.moment;
        if (choices[id]) cards[id] = cloneState(s);
        const target = keepOldRecordPrivate && id.startsWith('old-') ? 'leave' : choices[id];
        const selected = cardView(s)?.options.find((o) => o.id === target);
        queueInput(s, selected ? { kind: 'say', option: selected.id, insist: true } : { kind: 'quiet' });
      }
    }
    if (week < 2) s = anotherWeek(s);
  }
  return { s, cards };
}
let played: ReturnType<typeof campaign>;
beforeAll(() => {
  played = campaign(20);
}, 20_000);

it('offers a distinct optional outcomes week while keeping the existing editions', () => {
  expect(newGame(17).version).toBe('0.6.1');
  expect(momentsOf(15, '0.8.0').map((m) => m.id)).toContain('old-record-15');
  expect(momentsOf(15, '0.7.0').map((m) => m.id)).toContain('floor-15');
  expect(momentsOf(15, '0.7.0').map((m) => m.id)).not.toContain('old-record-15');
});
it('discusses the old covered delivery without inventing Ece’s promise or forgiveness', () => {
  expect(played.s.flags.outcomes?.grievance).toBe('boundary-agreed');
  expect(played.s.log.some((r) => r.text.includes('I covered your missed delivery'))).toBe(true);
  expect(played.s.log.some((r) => r.text.includes('never agreed to'))).toBe(true);
  const disputed = restoreState(cloneState(played.cards['old-answer-15']!));
  queueInput(disputed, { kind: 'say', option: 'insist', insist: true });
  expect(disputed.flags.outcomes?.grievance).toBe('disputed');
});
it('attends the actual dance night with Aylin’s assent and the paid route forgone', () => {
  expect(played.s.flags.outcomes?.dance).toBe('attended');
  const night = played.s.log.find((r) => r.text.includes('Dilan declined the paid route'));
  expect(night?.text).toContain('Nobody asked Dilan to dance');
  const p = played.s.cast!.people.aylin;
  expect(p.will.temperature).toBe(0);
  expect(p.now).toBeGreaterThan(played.cards['dance-outing-16']!.minute + 120);
});
it('does not publish or move a bench when Ece declines publication', () => {
  expect(played.s.flags.outcomes?.map).toBe('checked');
  expect(played.s.flags.outcomes?.['map-permission-18']).toBe('declined');
  expect(played.s.flags.outcomes?.publication).toBeUndefined();
  expect(played.s.flags.outcomes?.bench).toBeUndefined();
  expect(cardView(played.cards['map-place-18']!)?.options.map((o) => o.id)).toEqual(['leave']);
});
it('publishes checked public hours with permission and actually moves the existing depot bench', () => {
  // Same authored week, choosing not to discuss the old slip. No consent flags or RNG are injected.
  const { s } = campaign(20, true);
  const f = s.flags.outcomes!;
  expect(f.publication).toBe('posted');
  expect(f.publicHours).toBe('dawn to dusk');
  expect(f.privatePlaces).toBe('excluded');
  expect(f.publishedAt).toBeGreaterThan(f.checkedAt as number);
  expect(f.bench).toBe('shaded-break-area');
  expect(s.log.some((r) => r.text.includes('left the doorway clear'))).toBe(true);
}, 20_000);
it('records an actual public allocation correction and a completed bounded smaller-route trial', () => {
  const f = played.s.flags.outcomes!;
  expect(f.correction).toBe('posted');
  expect(f.allocationRecord).toContain('Murat assigned difficult stops');
  expect(f.trial).toBe('completed');
  expect(f.trialAt).toBeLessThan(f.trialPlannedReturn as number);
  expect(f.trialSecondRound).toBe('remaining work recorded');
  expect(played.s.log.some((r) => r.text.includes('left both versions visible'))).toBe(true);
});
it('replays full and compact current exports with complete raw history/RNG and actual continuation', async () => {
  const s = played.cards['allocation-correct-19']!;
  const raw = cloneState(s);
  const full = { game: 'murmur', version: s.version, seed: s.seed, inputs: s.inputs, state: raw };
  const decoded = await expandNotebook(JSON.parse(JSON.stringify(await compactNotebook(full))));
  expect(JSON.stringify(decoded.state)).toBe(JSON.stringify(raw));
  const importedFull = await validateRun(JSON.parse(JSON.stringify(full)).state);
  const importedCompact = await validateRun(decoded.state);
  expect(hash(cloneState(importedFull))).toBe(hash(raw));
  expect(hash(cloneState(importedCompact))).toBe(hash(raw));
  for (const state of [s, importedFull, importedCompact]) {
    queueInput(state, { kind: 'say', option: 'correct', insist: true });
    for (let n = 0; n < 37; n++) step(state);
    runToCard(state);
  }
  expect(hash(cloneState(importedFull))).toBe(hash(cloneState(s)));
  expect(hash(cloneState(importedCompact))).toBe(hash(cloneState(s)));
}, 20_000);
