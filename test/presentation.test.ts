import { describe, expect, it } from 'vitest';
import { cardView, cloneState, newGame, queueInput, replay, runToCard, step } from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import { momentRecords } from '../src/ui/journal.ts';
import { answerThoughts, cardThought, finalInputWords, keptWords } from '../src/ui/presentation.ts';
import { replyWords } from '../src/ui/reply.ts';

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Expected value');
  return value;
}

function nextAlarm(s: GameState) {
  const day = s.day;
  while (s.day === day) {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  runToCard(s);
}

function retained() {
  const s = newGame(2, '0.3.0');
  runToCard(s);
  queueInput(s, { kind: 'say', option: 'up' });
  expect(s.answer?.stayed).toBeTruthy();
  return s;
}

describe('follow-up b presentation, with exact edition state', () => {
  it('recalls a thought once, reports its next result, and rests it across later days and replay', () => {
    const s = retained();
    nextAlarm(s);
    const view = required(cardView(s));
    const recall = cardThought(s, view);
    expect(recall).toMatch(/feet|floor|get up/i);
    queueInput(s, { kind: 'quiet' });
    const answer = required(s.answer);
    const before = JSON.stringify(cloneState(s));
    answerThoughts(s, answer, momentRecords(s));
    expect(JSON.stringify(cloneState(s))).toBe(before);
    // A past-tense result waits for the action's completion on the visible clock.
    while (!momentRecords(s).find((r) => r.moment === answer.moment)?.completed) step(s);
    const result = answerThoughts(s, answer, momentRecords(s));
    expect(result).toHaveLength(1);
    expect(result[0]).not.toBe(recall);
    expect(result[0]).toMatch(s.answer?.chosen === 'up' ? /got up|feet.*floor/i : /didn’t|five|bed/i);
    nextAlarm(s);
    expect(cardThought(s, required(cardView(s)))).toBeUndefined();
    const restored = replay(s.seed, s.inputs, s.minute, s.version);
    expect(cardThought(restored, required(cardView(restored)))).toBeUndefined();
    expect(cloneState(restored)).toEqual(cloneState(s));
  });

  it('waits for the visible completion before reporting a successful recalled action', () => {
    const s = retained();
    nextAlarm(s);
    queueInput(s, { kind: 'say', option: 'up', insist: true });
    const answer = required(s.answer);
    expect(answer.chosen).toBe('up');
    expect(answerThoughts(s, answer, momentRecords(s))).toEqual([]);
    while (!momentRecords(s).find((r) => r.moment === answer.moment)?.completed) step(s);
    expect(answerThoughts(s, answer, momentRecords(s))).toEqual(['I got up this time. Feet on the floor.']);
  });

  it('varies retained words and refusals by the actual action and situation', () => {
    const s = retained();
    const lines: string[] = [];
    const replies: string[] = [];
    while (s.day === 1 && s.phase === 'day') {
      if (s.answer?.stayed) lines.push(...answerThoughts(s, s.answer, momentRecords(s)));
      if (s.answer?.said && s.answer.chosen !== s.answer.said)
        replies.push(required(replyWords(s, s.answer)));
      runToCard(s);
      const view = cardView(s);
      if (view) queueInput(s, { kind: 'say', option: required(view.options.find((o) => !o.isPull)).id });
    }
    expect(lines.length).toBeGreaterThanOrEqual(3);
    expect(new Set(lines).size).toBe(lines.length);
    expect(lines.join(' ')).not.toContain('still thinking about it');
    expect(replies.join(' ')).toMatch(/table/);
    expect(new Set(replies).size).toBe(replies.length);
  });

  it('does not reuse a recall sentence when the player renews the same advice on later days', () => {
    for (let seed = 1000; seed < 1008; seed++) {
      const s = newGame(seed, '0.3.0');
      const seen = new Set<string>();
      while (s.phase !== 'end') {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          continue;
        }
        runToCard(s);
        const view = cardView(s);
        if (!view) continue;
        const line = cardThought(s, view);
        if (line) {
          expect(seen.has(line)).toBe(false);
          seen.add(line);
        }
        queueInput(s, { kind: 'say', option: required(view.options.find((o) => !o.isPull)).id });
      }
    }
  });

  it('shows a kept phrase quietly without inventing a number or changing state', () => {
    const s = newGame(1, '0.3.0');
    runToCard(s);
    queueInput(s, { kind: 'say', option: 'up', insist: true });
    const before = JSON.stringify(cloneState(s));
    expect(keptWords(s)).toBe('Feet on the floor');
    expect(JSON.stringify(cloneState(s))).toBe(before);
  });

  it('names Mum in her conditional message and Murat when Ece is laughing at him', () => {
    const s = newGame(1, '0.3.0');
    while (s.phase !== 'end') {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      runToCard(s);
      if (!s.card) continue;
      if (s.card.moment === 'note-3' || s.card.moment === 'lunch-4') {
        const mum = s.card.moment === 'note-3';
        queueInput(s, { kind: 'say', option: mum ? 'call' : 'defend' });
        const words = replyWords(s, required(s.answer));
        expect(words).toContain(mum ? 'Mum' : 'Murat');
        expect(words).not.toContain(mum ? 'Aylin' : 'Ece means');
      } else queueInput(s, { kind: 'quiet' });
    }
  });

  it('uses Saturday’s own input for pressure, suggestion, explicit silence and timeout', () => {
    const base = newGame(42, '0.3.0');
    while (base.day < 6) {
      if (base.phase === 'evening') queueInput(base, { kind: 'next' });
      else {
        runToCard(base);
        if (base.card) queueInput(base, { kind: 'quiet' });
      }
    }
    runToCard(base);
    for (const insist of [false, true]) {
      for (const option of ['send', 'delete', 'call']) {
        const s = cloneState(base);
        queueInput(s, { kind: 'say', option, insist });
        const words = finalInputWords(s, momentRecords(s));
        expect(words).toMatch(insist ? /pressed/ : /suggested/);
        expect(words).toContain(
          required(s.answer).chosen === option ? (insist ? 'went along' : 'chose') : 'chose',
        );
        expect(words).toContain(required(required(cardView(base)).options.find((o) => o.id === option)).ink);
      }
    }
    const quiet = cloneState(base);
    queueInput(quiet, { kind: 'quiet' });
    expect(finalInputWords(quiet, momentRecords(quiet))).toMatch(/left.*her|said nothing/i);
    const timed = replay(base.seed, base.inputs, required(base.card).closesAt + 1, base.version);
    expect(finalInputWords(timed, momentRecords(timed))).toMatch(/time ran out/);
  });
});
