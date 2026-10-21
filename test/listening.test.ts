import { dischargeAdvice, rememberedTerms } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { cardView, cloneState, newGame, queueInput, runToCard } from '../src/sim/game.ts';
import { landingChance, moodOf } from '../src/sim/listening.ts';

describe('gentle suggestions', () => {
  it('makes Monday a close call and sometimes hears an against-leaning tap', () => {
    let lands = 0;
    let stays = 0;
    for (let seed = 1; seed <= 64; seed++) {
      const s = newGame(seed);
      runToCard(s);
      const o = cardView(s)?.options.find((o) => o.id === 'up');
      expect(o?.likelihood).toBeGreaterThan(0.1);
      expect(o?.likelihood).toBeLessThan(0.5);
      expect(o?.mood).toBe("she's against it, but she's listening");
      queueInput(s, { kind: 'say', option: 'up' });
      if (s.answer?.chosen === 'up') lands++;
      else if (s.answer?.stayed) stays++;
    }
    expect(lands).toBeGreaterThan(6);
    expect(lands).toBeLessThan(40);
    expect(lands + stays).toBe(64);
  });
  it('listens more with trust and less under pressure, without reading consuming RNG', () => {
    const s = newGame(9);
    runToCard(s);
    const you = s.person.will.voices.find((v) => v.voiceId === 'you');
    if (!you) throw new Error('missing voice');
    you.trust = 0.3;
    const low = cardView(s)?.options.find((o) => o.id === 'up')?.likelihood ?? 0;
    you.trust = 0.8;
    const high = cardView(s)?.options.find((o) => o.id === 'up')?.likelihood ?? 0;
    expect(high).toBeGreaterThan(low);
    you.pressure = 0.95;
    const nagged = cardView(s)?.options.find((o) => o.id === 'up')?.likelihood ?? 0;
    expect(nagged).toBeLessThan(high);
    const before = cloneState(s);
    cardView(s);
    cardView(s);
    expect(cloneState(s)).toEqual(before);
  });
  it('keeps real exhaustion and held conviction outside the draw', () => {
    for (const mode of ['exhaustion', 'conviction'])
      for (let seed = 1; seed <= 16; seed++) {
        const s = newGame(seed);
        runToCard(s);
        if (mode === 'exhaustion') s.person.body.downed = { since: s.minute, reason: 'exhaustion' };
        else {
          const norm = s.person.conscience.norms.find((n) => n.normId === 'punctuality');
          if (!norm) throw new Error('missing norm');
          norm.conviction = 1;
          norm.standing = 'forbidden';
        }
        const option = mode === 'exhaustion' ? 'up' : 'snooze';
        const hint = cardView(s)?.options.find((o) => o.id === option);
        expect(hint?.likelihood).toBe(0);
        expect(hint?.mood).toMatch(/can't|won't/);
        queueInput(s, { kind: 'say', option });
        expect(s.answer?.chosen).not.toBe(option);
        expect(s.answer?.stayed).toBeUndefined();
      }
  });
  it('does not narrate a vetoed option when HF finds no available choice', () => {
    const s = newGame(9);
    runToCard(s);
    s.person.body.downed = { since: s.minute, reason: 'exhaustion' };
    queueInput(s, { kind: 'say', option: 'snooze' });
    expect(s.answer?.chosen).toBe('none');
    expect(s.answer?.pullWon).toBe(false);
    expect(s.answer?.stayed).toBeUndefined();
    expect(s.log.some((l) => l.text.includes('slept through the second alarm'))).toBe(false);
  });
  it('stores a refused gentle suggestion in HF and surfaces it at the next related moment', () => {
    let found = false;
    for (let seed = 1; seed <= 16 && !found; seed++) {
      const s = newGame(seed);
      runToCard(s);
      queueInput(s, { kind: 'say', option: 'up' });
      if (s.answer?.chosen === 'up') continue;
      expect(s.answer?.stayed).toBeTruthy();
      expect(
        rememberedTerms(
          s.person,
          { id: 'up', label: 'get up', action: 'get-up', duration: 15, effort: 0.15, advertises: {} },
          s.person.now,
        ).some((t) => t.value > 0),
      ).toBe(true);
      while (s.day === 1) {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          break;
        }
        runToCard(s);
        if (s.card) queueInput(s, { kind: 'quiet' });
      }
      runToCard(s);
      expect(cardView(s)?.recalled).toMatch(/get up|feet|alarm/i);
      const withoutAdvice = cloneState(s);
      dischargeAdvice(withoutAdvice.person, 'get-up');
      expect(cardView(withoutAdvice)?.recalled).toBeUndefined();
      queueInput(withoutAdvice, { kind: 'quiet' });
      queueInput(s, { kind: 'quiet' });
      const decision = s.person.trace.findLast((r) => r.at === s.answer?.at);
      const counterfactual = withoutAdvice.person.trace.findLast((r) => r.at === withoutAdvice.answer?.at);
      const remembered = decision?.considered.find((o) => o.affordanceId === 'up');
      expect(remembered?.terms.some((t) => t.source === 'suggestion:remembered:you' && t.value > 0)).toBe(
        true,
      );
      expect(remembered?.utility ?? 0).toBeGreaterThan(
        counterfactual?.considered.find((o) => o.affordanceId === 'up')?.utility ?? 0,
      );
      expect(s.answer?.recalled).toBeTruthy();
      expect(s.pages[0]?.stayed?.length).toBeGreaterThan(0);
      found = true;
    }
    expect(found).toBe(true);
  });
  it('does not describe a possible option as a certain refusal when HF refuses voice credit', () => {
    const resolution = {
      voiceId: 'you',
      verdict: 'refused' as const,
      kind: 'willNot' as const,
      reason: 'distrust',
      says: '',
      likelihood: 0.2,
    };
    expect(landingChance(resolution)).toBe(0.2);
    expect(moodOf(resolution)).toContain("she's listening");
  });
  it('matches each uncertain mood to observed seeded landings in self-play', () => {
    const bands = new Map<string, { n: number; landed: number; expected: number; variance: number }>();
    for (let seed = 100; seed < 116; seed++) {
      const s = newGame(seed);
      while (s.phase !== 'end') {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          continue;
        }
        runToCard(s);
        const view = cardView(s);
        if (!view) continue;
        for (const o of view.options) {
          const trial = cloneState(s);
          queueInput(trial, { kind: 'say', option: o.id });
          const p = o.likelihood ?? 0;
          const band = bands.get(o.mood ?? '') ?? { n: 0, landed: 0, expected: 0, variance: 0 };
          band.n++;
          band.landed += Number(trial.answer?.chosen === o.id);
          band.expected += p;
          band.variance += p * (1 - p);
          bands.set(o.mood ?? '', band);
          if (p === 0) expect(trial.answer?.chosen).not.toBe(o.id);
          if (p === 1) expect(trial.answer?.chosen).toBe(o.id);
        }
        queueInput(s, { kind: 'quiet' });
      }
    }
    for (const [mood, b] of bands) {
      expect(Math.abs(b.landed - b.expected)).toBeLessThan(5 * Math.sqrt(b.variance) + 2);
      if (mood.includes('leans toward')) expect(b.landed / b.n).toBeGreaterThan(0.5);
      if (mood.includes('firmly against')) expect(b.landed / b.n).toBeLessThan(0.1);
      if (mood.includes("but she's listening")) {
        expect(b.landed / b.n).toBeGreaterThan(0.1);
        expect(b.landed / b.n).toBeLessThan(0.5);
      }
    }
    expect(bands.size).toBeGreaterThanOrEqual(3);
  }, 30_000);
  it('refreshes repeated gentle advice without stacking its score', () => {
    let repeated = false;
    for (let seed = 1; seed < 17 && !repeated; seed++) {
      const s = newGame(seed);
      while (s.day <= 2 && s.phase !== 'end') {
        if (s.phase === 'evening') {
          queueInput(s, { kind: 'next' });
          continue;
        }
        runToCard(s);
        if (!s.card) continue;
        if (s.card.moment.startsWith('alarm-')) {
          queueInput(s, { kind: 'say', option: 'up' });
          expect(
            (s.person.will.advice ?? []).filter((a) => a.sourceId === 'you' && a.action === 'get-up').length,
          ).toBeLessThanOrEqual(1);
          if ((s.thoughts ?? []).filter((t) => t.action === 'get-up').length === 2) {
            expect(
              (s.person.will.advice ?? []).filter((a) => a.sourceId === 'you' && a.action === 'get-up'),
            ).toHaveLength(1);
            repeated = true;
            break;
          }
        } else queueInput(s, { kind: 'quiet' });
      }
    }
    expect(repeated).toBe(true);
  });
  it('does not keep a pushed refusal', () => {
    const s = newGame(9);
    runToCard(s);
    const you = s.person.will.voices.find((v) => v.voiceId === 'you');
    if (you) {
      you.trust = 0.1;
      you.pressure = 1;
    }
    queueInput(s, { kind: 'say', option: 'up', insist: true });
    expect(s.answer?.stayed).toBeUndefined();
    expect(s.person.will.advice?.length ?? 0).toBe(0);
  });
});
