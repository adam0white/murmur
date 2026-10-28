import { practiceAt, responseCueMatches } from '@adam0white/human-framework-legacy';
import { expect, it } from 'vitest';
import { LABEL } from '../src/legacy/dilan.ts';
import { newGame, PRACTICE_HALF_LIFE_DAYS, queueInput, runToCard } from '../src/legacy/game.ts';

it('one completed birthday dinner keeps both real promises without a synthetic call', () => {
  const s = newGame(17, '0.7.0');
  while (s.card?.moment !== 'dinner-3') {
    if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else {
      runToCard(s);
      if (s.card?.moment !== 'dinner-3' && s.card) queueInput(s, { kind: 'quiet' });
    }
  }
  const before = s.minute;
  queueInput(s, { kind: 'quiet' });
  expect(s.person.now - before).toBe(90);
  const kept = s.person.agenda.commitments.filter((c) => c.status === 'kept').map((c) => c.label);
  expect(kept).toContain(LABEL.aylin);
  expect(kept).toContain(LABEL.mum);
  expect(s.person.trace.at(-1)?.chosenAffordanceId).not.toBe('call-mum');
});
it('an actual learned alarm response cannot serve gossip and uses only the public continuous decay', () => {
  const s = newGame(17, '0.7.0');
  runToCard(s);
  queueInput(s, { kind: 'say', option: 'up', insist: true });
  const r = s.person.promptings?.responses.find((r) => r.id === 'feet');
  expect(r?.cue).toBe('snooze');
  expect(responseCueMatches(r!.cue!, { action: 'gossip', opposedBy: 'norm:backbiting' })).toBe(false);
  expect(s.person.promptings?.practiceHalfLifeDays).toBe(PRACTICE_HALF_LIFE_DAYS);
  expect(practiceAt(r!, r!.lastUsedAt + 1440, PRACTICE_HALF_LIFE_DAYS)).toBeCloseTo(r!.practice * 0.8, 12);
});

it('does not turn a late meal into keeping the new arrival deadline', async () => {
  const { WEEK_THREE } = await import('../src/legacy/week3.ts');
  const { dayStart } = await import('../src/legacy/dilan.ts');
  const { advanceAgenda, onFinished } = await import('@adam0white/human-framework-legacy');
  const s = newGame(17, '0.7.0');
  WEEK_THREE.find((m) => m.id === 'arrival-17')!.after!(s, 'promise');
  const c = s.person.agenda.commitments.find((c) => c.label === 'my six o’clock help for Aylin')!;
  advanceAgenda(s.person, dayStart(17) + 19 * 60 + 45);
  onFinished(
    s.person,
    {
      affordanceId: 'late-help',
      action: 'help-aylin',
      status: 'completed',
      at: dayStart(17) + 20 * 60,
      fulfills: [c.id],
    },
    dayStart(17) + 19 * 60 + 45,
  );
  expect(c.status).not.toBe('kept');
});
