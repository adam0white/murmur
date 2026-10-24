import { canonicalCast } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import { cardView, cloneState, newGame, queueInput, replay, runToCard, step } from '../src/sim/game.ts';

describe('canonical chapter fiction', () => {
  it('starts four actual people with canonical profiles and no imported secrets', () => {
    const s = newGame(17, '0.6.0');
    if (!s.cast) throw Error('Missing cast');
    expect(Object.keys(s.cast.people).sort()).toEqual(['aylin', 'dilan', 'ece', 'murat']);
    for (const [id, person] of Object.entries(s.cast.people)) {
      const c = canonicalCast(`hf.cast.${id}.murmur`);
      expect(person.traits).toEqual(c.traits);
      expect(person.values).toEqual(c.values);
    }
    expect(s.cast?.discoveries).toEqual([]);
    expect(s.person).toBe(s.cast?.people.dilan);
  });

  it('earns four scoped clues through completed choices and replays them', () => {
    const s = newGame(17, '0.6.0');
    while (s.phase !== 'end') {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      runToCard(s);
      const card = cardView(s);
      if (!card) continue;
      const reveal = card.options.find((o) => o.id.startsWith('reveal-'));
      queueInput(s, reveal ? { kind: 'say', option: reveal.id, insist: true } : { kind: 'quiet' });
    }
    expect(s.cast?.discoveries.map((x) => x.person).sort()).toEqual(['aylin', 'dilan', 'ece', 'murat']);
    const rebuilt = replay(s.seed, s.inputs, s.minute, s.version);
    if (rebuilt.phase === 'day') step(rebuilt);
    expect(cloneState(rebuilt)).toEqual(cloneState(s));
    const untouched = newGame(17, '0.6.0');
    expect(untouched.cast?.discoveries).toEqual([]);
  });
});

it('keeps the agreed shelf visit playable and completes it only through shared work', () => {
  const s = newGame(17, '0.6.0');
  while (s.phase !== 'end') {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    const c = cardView(s);
    if (!c) continue;
    const choice =
      c.options.find((o) => o.id === 'repair-with-aylin') ?? c.options.find((o) => o.id === 'reveal-dilan');
    queueInput(s, choice ? { kind: 'say', option: choice.id, insist: true } : { kind: 'quiet' });
  }
  expect(s.chosen['shelf-visit-6']).toBe('repair-with-aylin');
  expect(s.final?.threads.some((line) => line.includes('Aylin') && line.includes('together'))).toBe(true);
  expect(s.flags.shelf).toBe(2);
});
it('uses reserved versus free extra-work input in the actual route offer (mechanism control)', () => {
  const free = newGame(17, '0.6.0'),
    reserved = newGame(17, '0.6.0');
  if (!free.cast || !reserved.cast) throw Error('Missing cast');
  free.cast.extraWork.dilan = true;
  reserved.cast.extraWork.dilan = false;
  for (const s of [free, reserved]) {
    for (let i = 0; i < 100; i++) {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      runToCard(s);
      if (s.card?.moment === 'route-3') break;
      if (s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  expect(cardView(free)?.options.some((o) => o.id === 'route')).toBe(true);
  expect(cardView(reserved)?.options.some((o) => o.id === 'route')).toBe(false);
});
