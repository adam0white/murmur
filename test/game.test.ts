import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  fingerprint,
  newGame,
  nextCardAt,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
  trustOf,
} from '../src/legacy/game.ts';
import type { GameState } from '../src/legacy/types.ts';

type Policy = (s: GameState) => { option: string; insist?: boolean } | null;

const opposeFirst: Policy = (s) => {
  const v = cardView(s);
  const o = v?.options.find((x) => !x.isPull);
  return o ? { option: o.id } : null;
};

/** Play a week with a policy; returns the final state. */
function play(seed: number, policy: Policy, untilDay = 99): GameState {
  const s = newGame(seed);
  for (let g = 0; g < 2000 && s.phase !== 'end' && s.day <= untilDay; g++) {
    if (s.phase === 'evening') {
      if (s.day >= untilDay) break;
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    if (!s.card) continue;
    const said = policy(s);
    if (said) queueInput(s, { kind: 'say', ...said });
    else while (s.card) step(s);
  }
  return s;
}

describe('The Two Voices sim', () => {
  it('the first card opens on Monday morning with a pull and options', () => {
    const s = newGame(7);
    runToCard(s);
    const v = cardView(s);
    expect(v?.id).toBe('alarm-1');
    expect(v?.pullLine.length).toBeGreaterThan(0);
    expect(v?.options.length).toBeGreaterThanOrEqual(2);
  });

  it('a week ends with five evening pages and a Saturday page', () => {
    const s = play(3, opposeFirst);
    expect(s.phase).toBe('end');
    expect(s.pages.length).toBe(5);
    expect(s.final?.note.length).toBeGreaterThan(0);
  });

  it('every word she turns down comes back with words of hers', () => {
    for (const seed of [1, 2, 42]) {
      const s = newGame(seed);
      for (let g = 0; s.phase !== 'end' && g < 2000; g++) {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          continue;
        }
        runToCard(s);
        const v = cardView(s);
        if (!v) continue;
        const o = v.options.find((x) => !x.isPull);
        if (!o) continue;
        queueInput(s, { kind: 'say', option: o.id, insist: s.day >= 3 });
        const a = s.answer;
        if (a?.said && a.verdict !== 'assented' && a.verdict !== 'complied') expect(a.says).toBeTruthy();
      }
    }
  });

  it('replays exactly from seed and input log', () => {
    const s = play(11, opposeFirst);
    const r = replay(s.seed, s.inputs, undefined, s.version);
    expect(fingerprint(r)).toBe(fingerprint(s));
  });

  it('reading a card does not change state or randomness', () => {
    const s = newGame(5);
    runToCard(s);
    const before = fingerprint(s);
    const rng = JSON.stringify(s.person.rng);
    cardView(s);
    cardView(s);
    expect(fingerprint(s)).toBe(before);
    expect(JSON.stringify(s.person.rng)).toBe(rng);
  });

  it('a save restored mid-week continues identically', () => {
    const a = play(21, opposeFirst, 2);
    const saved = JSON.parse(JSON.stringify(cloneState(a))) as GameState;
    const b = restoreState(saved);
    for (const s of [a, b]) {
      queueInput(s, { kind: 'next' });
      runToCard(s);
      const said = opposeFirst(s);
      if (said) queueInput(s, { kind: 'say', ...said });
      runToCard(s);
    }
    expect(fingerprint(b)).toBe(fingerprint(a));
  });

  it('insisting all week costs her trust in you, and then a hold stops carrying', () => {
    const insist: Policy = (s) => {
      const o = opposeFirst(s);
      return o ? { ...o, insist: true } : null;
    };
    const loud = play(9, insist);
    const quiet = play(9, opposeFirst);
    expect(trustOf(loud.person, 'you')).toBeLessThan(trustOf(quiet.person, 'you') - 0.05);
    const lost = loud.pages.reduce((n, p) => n + p.missed.length, 0);
    expect(lost).toBeGreaterThan(0);
  });

  it('silence lets the pull win more than speaking does', () => {
    const silent = play(13, () => null);
    const spoken = play(13, opposeFirst);
    const won = (s: GameState) => s.pages.reduce((n, p) => n + p.missed.length, 0);
    expect(won(silent)).toBeGreaterThan(won(spoken));
  });

  it('the pull borrows your ink on some cards, at most once a day, only from Thursday', () => {
    for (const seed of [1, 3, 42]) {
      const s = newGame(seed);
      const borrowedByDay: Record<number, number> = {};
      for (let g = 0; g < 2000 && s.phase !== 'end'; g++) {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          continue;
        }
        runToCard(s);
        if (!s.card) continue;
        if (s.card.borrowed) borrowedByDay[s.day] = (borrowedByDay[s.day] ?? 0) + 1;
        const said = opposeFirst(s);
        if (said) queueInput(s, { kind: 'say', ...said });
        else while (s.card) step(s);
      }
      for (const [day, n] of Object.entries(borrowedByDay)) {
        expect(Number(day)).toBeGreaterThanOrEqual(4);
        expect(n).toBe(1);
      }
    }
  });

  it('a missed commitment is carried into the next day as a resolve', () => {
    const s = play(17, () => null, 1);
    expect(s.phase).toBe('evening');
    expect(s.pages[0]?.missed.length).toBeGreaterThan(0);
    expect(s.pages[0]?.resolves.length).toBeGreaterThan(0);
  });
});

describe('nextCardAt (UI pacing)', () => {
  it('predicts the minute each card opens, through a week', () => {
    const s = newGame(5);
    let checked = 0;
    for (let g = 0; g < 200 && s.phase !== 'end'; g++) {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      const want = nextCardAt(s);
      runToCard(s);
      if (s.card) {
        expect(s.card.openedAt).toBe(want);
        checked += 1;
        const o = cardView(s)?.options.find((x) => !x.isPull);
        if (o && g % 2 === 0) queueInput(s, { kind: 'say', option: o.id });
        else while (s.card) step(s);
      } else expect(want).toBeNull();
    }
    expect(checked).toBeGreaterThan(30);
  });
});
