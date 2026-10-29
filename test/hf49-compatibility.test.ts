/** Exact397 HF4.9 continuation. Frozen vectors come from immutable Git source, not relabelled current runs. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { canonicalPersona } from '@adam0white/lab-client';
import { expect, it, vi } from 'vitest';

vi.mock('../src/ui/continuity.ts', () => ({
  shelf: { ready: Promise.resolve(), enabled: false },
  recordingEpochGuard: () => ({}),
  requireSharedWrite: () => {
    throw Error('No shared writes in compatibility control');
  },
}));

import { prepareCastChapter, validateCastChapter } from '../src/sim/cast-chapter.ts';
import { sourceRules } from '../src/sim/edition.ts';
import {
  anotherWeek,
  canAnotherWeek,
  cardView,
  cloneState,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import { actionsForEdition } from '../src/sim/hf4-actions.ts';
import type { GameState, GameStateSnapshot } from '../src/sim/types.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';
import { validateRun } from '../src/ui/one-cast.ts';

const fixture = () =>
  JSON.parse(readFileSync(new URL('./fixtures/hf49-397-vectors.json', import.meta.url), 'utf8'));
const hash = (s: unknown) => createHash('sha256').update(canonicalPersona(s)).digest('hex');
it.each(['0.9.0', '0.9.1', '0.9.2'])(
  'continues every field of immutable397 %s through its complete horizon',
  (version) => {
    const v = fixture().vectors.find((v: { version: string }) => v.version === version);
    const s = newGame(v.seed, version);
    let first = true;
    const checked: string[] = [];
    const capture = (label: string) => {
      const c = v.checkpoints.find((c: { label: string }) => c.label === label);
      expect(c, label).toBeDefined();
      const saved = cloneState(s);
      expect(hash(saved), label).toBe(c.hash);
      const cold = restoreState(JSON.parse(JSON.stringify(saved)));
      expect(cloneState(cold)).toEqual(saved);
      step(cold);
      expect(hash(cloneState(cold)), label + ' next').toBe(c.nextHash);
      checked.push(label);
    };
    capture('opening');
    for (let n = 0; n < 500; n++) {
      runToCard(s);
      const card = cardView(s);
      if (card) {
        if (first) {
          capture('day1');
          first = false;
        }
        if (['slump-5', 'handover-5', 'letter-8', 'floor-15', 'grievance-15'].includes(card.id))
          capture(card.id);
        const input = v.inputs[s.inputs.length];
        expect(input.at).toBe(s.minute);
        const { at, ...choice } = input;
        queueInput(s, choice);
      } else if (s.phase === 'evening') queueInput(s, { kind: 'next' });
      else if (s.phase === 'end') {
        capture('end-' + s.day);
        if (s.day === (version === '0.9.0' ? 13 : 20)) break;
        expect(canAnotherWeek(s)).toBe(true);
        anotherWeek(s);
      } else step(s);
    }
    expect(checked).toEqual(v.checkpoints.map((c: { label: string }) => c.label));
    expect(s.inputs).toEqual(v.inputs);
    expect(hash(cloneState(s))).toBe(v.endHash);
    const rebuilt = replay(v.seed, v.inputs, v.minute, version);
    if (rebuilt.phase === 'day') step(rebuilt);
    expect(cloneState(rebuilt)).toEqual(cloneState(s));
  },
  600_000,
);
it('reads an actual397 saved notebook through the Resume/import validator and lossless codec', async () => {
  const raw = JSON.parse(
    gunzipSync(readFileSync(new URL('./fixtures/hf49-397-day1.json.gz', import.meta.url))).toString(),
  ) as GameStateSnapshot;
  const validated = await validateRun(raw);
  expect(cloneState(validated)).toEqual(raw);
  const file = await compactNotebook({
    state: raw,
    version: raw.version,
    seed: raw.seed,
    inputs: raw.inputs,
  });
  const expanded = await expandNotebook(file);
  expect(expanded.state).toEqual(raw);
  expect(cloneState(await validateRun(expanded.state))).toEqual(raw);
});
it.each(['0.10.0', '0.10.1', '0.10.2'])(
  'records opt-in %s and its opening, cold notebook and source rules',
  async (version) => {
    const s = newGame(17, version);
    runToCard(s);
    expect(cardView(s)).not.toBeNull();
    expect(actionsForEdition(version)).toContain('read-letter');
    expect(actionsForEdition('0.9.0')).not.toContain('read-letter');
    const raw = cloneState(s);
    expect(cloneState(await validateRun(raw))).toEqual(raw);
    const file = await compactNotebook({ state: raw });
    expect((await expandNotebook(file)).state).toEqual(raw);
    expect(sourceRules(version)).toBe('0.10.0');
    const chapter = await prepareCastChapter([], 17, {}, version);
    expect(chapter.edition).toBe('0.10.0');
    await validateCastChapter(chapter, 17);
    expect(() => newGame(17, '0.9.0', chapter)).toThrow('pinned cast');
  },
);
