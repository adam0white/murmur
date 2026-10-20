import { tick } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  fingerprint,
  insistCarries,
  newGame,
  queueInput,
  replay,
  runToCard,
} from '../src/sim/game.ts';
import type { Answer, GameState } from '../src/sim/types.ts';
import { replyWords } from '../src/ui/reply.ts';

function answer(s: GameState): Answer {
  expect(s.answer).not.toBeNull();
  return s.answer as Answer;
}

function first(option: string, insist = false): GameState {
  const s = newGame(9);
  runToCard(s);
  queueInput(s, { kind: 'say', option, insist });
  return s;
}

describe('refusal recovery in her words', () => {
  it('answers each Monday refusal with a possible change specific to that moment', () => {
    const s = newGame(9);
    const route = [
      ['alarm-1', 'up', /next.*alarm.*hold.*feet/i],
      ['note-1', 'reply', /Aylin.*bus.*hold/i],
      ['late-1', 'truth', /Murat.*overslept.*hold/i],
      ['ece-1', 'talk', /already late.*Ece.*hold/i],
      ['lunch-1', 'defend', /Ece.*speak up.*hold/i],
      ['slump-1', 'coffee', null],
      ['bus-1', 'call', /Mum.*bus.*hold/i],
    ] as const;
    const recoveries: string[] = [];
    for (const [moment, option, context] of route) {
      runToCard(s);
      expect(s.card?.moment).toBe(moment);
      queueInput(s, { kind: 'say', option });
      if (!context) continue;
      const a = answer(s);
      expect(a.chosen).not.toBe(option);
      const words = replyWords(s, a) as string;
      expect(words).toContain(a.says);
      const recovery = words.slice(a.says?.length ?? 0).trim();
      expect(recovery).toMatch(context);
      expect(recovery).toMatch(/might|could/i);
      expect(recovery).toMatch(/next|another time/i);
      recoveries.push(recovery);
    }
    expect(new Set(recoveries).size).toBe(6);
  });

  it('remembers her tiredness when she refuses the next alarm', () => {
    const s = newGame(9);
    while (s.day === 1) {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
      } else {
        runToCard(s);
        queueInput(s, { kind: 'quiet' });
      }
    }
    runToCard(s);
    expect(s.card?.moment).toBe('alarm-2');
    queueInput(s, { kind: 'say', option: 'up' });
    expect(answer(s).chosen).toBe('snooze');
    expect(replyWords(s, answer(s))).toMatch(/still tired/i);
    const rested = first('up');
    expect(replyWords(rested, answer(rested))).not.toMatch(/still tired/i);
  });

  it('offers a hold next time when a tap refused but insisting could carry at the decision', () => {
    const s = first('up');
    const a = answer(s);
    expect(a.chosen).toBe('snooze');
    const words = replyWords(s, a);
    expect(words).toContain(a.says);
    expect(words).toMatch(/another time|next time/i);
    expect(words).toMatch(/hold/i);
    expect(words).toMatch(/might/i);
  });

  it('suggests plain words or silence at the next moment after pushing loses her trust', () => {
    const s = newGame(9);
    while (s.card?.moment !== 'slump-1') {
      runToCard(s);
      if (s.card?.moment === 'slump-1') break;
      const o = cardView(s)?.options.find((x) => !x.isPull);
      if (!o) throw new Error('Expected an option');
      queueInput(s, { kind: 'say', option: o.id, insist: true });
    }
    queueInput(s, { kind: 'say', option: 'walk', insist: true });
    expect(answer(s).chosen).toBe('coffee');
    const words = replyWords(s, answer(s));
    expect(words).toContain(answer(s).says);
    expect(words).toMatch(/next moment/i);
    expect(words).toMatch(/plain|quiet|say nothing/i);
    expect(words).not.toMatch(/hold/i);
  });

  it('names a willing alternative when a firmer version would still refuse', () => {
    const s = newGame(2);
    for (let g = 0; g < 100; g++) {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      runToCard(s);
      if (s.card?.moment === 'ece-4') break;
      const v = cardView(s);
      if (!v) continue;
      const o = v.options[(2 * 31 + g * 17) % v.options.length];
      if (!o) throw new Error('Expected an option');
      queueInput(s, { kind: 'say', option: o.id, insist: g % 3 === 0 });
    }
    const before = cloneState(s);
    tick(before.person, before.minute);
    expect(insistCarries(before.person)).toBe(true);
    expect(cardView(before)?.options.find((o) => o.id === 'yes')?.pushed).toBe('no');
    queueInput(s, { kind: 'say', option: 'yes' });
    expect(answer(s).chosen).toBe('let');
    const words = replyWords(s, answer(s));
    expect(words).toContain(answer(s).says);
    expect(words).toContain('Say next week.');
    expect(words).toMatch(/next moment/i);
    expect(words).not.toMatch(/hold/i);
  });

  it('leaves agreement and silence unchanged', () => {
    const s = first('snooze');
    expect(answer(s).chosen).toBe('snooze');
    expect(replyWords(s, answer(s))).toBe(answer(s).says);
    const quiet = newGame(9);
    runToCard(quiet);
    queueInput(quiet, { kind: 'quiet' });
    expect(replyWords(quiet, answer(quiet))).toBe(answer(quiet).says);
  });

  it('does not mutate the answer, state, RNG, export, or replay continuation', () => {
    const s = first('up');
    const before = fingerprint(s);
    const exported = JSON.stringify(cloneState(s));
    const rng = JSON.stringify(s.person.rng);
    replyWords(s, answer(s));
    replyWords(s, answer(s));
    expect(fingerprint(s)).toBe(before);
    expect(JSON.stringify(s.person.rng)).toBe(rng);
    expect(JSON.stringify(cloneState(s))).toBe(exported);
    expect(fingerprint(replay(s.seed, s.inputs, s.minute))).toBe(before);
    const continued = replay(s.seed, s.inputs, s.minute);
    runToCard(s);
    runToCard(continued);
    expect(fingerprint(continued)).toBe(fingerprint(s));
  });
});
