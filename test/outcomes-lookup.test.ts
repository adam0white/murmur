import { expect, it } from 'vitest';
import { dayStart } from '../src/legacy/dilan.ts';
import { anotherWeek, cardView, newGame, nextCardAt, queueInput, runToCard } from '../src/legacy/game.ts';

it('uses the outcomes edition for normal bus timing, displayed bus/bed scenes and completed calls', () => {
  let s = newGame(20, '0.8.0');
  const seen: string[] = [];
  for (let week = 0; week < 3; week++) {
    while (s.phase !== 'end') {
      if (s.phase === 'evening') {
        queueInput(s, { kind: 'next' });
        continue;
      }
      if (week === 2 && s.queue[0] === 'bus-15' && !s.card) {
        expect.soft(nextCardAt(s)).toBe(dayStart(15) + 20 * 60);
      }
      runToCard(s);
      if (!s.card) continue;
      const id = s.card.moment;
      if (/^(bus|bed)-(15|18)$/.test(id)) {
        seen.push(id);
        expect
          .soft(cardView(s)?.scene)
          .toBe(
            id.startsWith('bus-')
              ? 'Her planned work is over for the evening. On the bus, Dilan has time to call Mum or look at her phone.'
              : 'Dilan puts her bag down. She can write about what she actually did, or go to sleep.',
          );
        if (id.startsWith('bus-')) expect.soft(s.card.openedAt).toBe(dayStart(s.day) + 20 * 60);
      }
      queueInput(s, id === 'bus-18' ? { kind: 'say', option: 'call', insist: true } : { kind: 'quiet' });
      if (id === 'bus-18') {
        expect.soft(s.answer?.chosen).toBe('call');
        expect
          .soft(s.log.at(-1)?.text)
          .toBe(
            'Dilan called Mum and told her about her day. She kept the other people’s private details to herself.',
          );
      }
      if (id === 'bed-18') {
        expect(seen).toEqual(['bus-15', 'bed-15', 'bus-18', 'bed-18']);
        return;
      }
    }
    if (week < 2) s = anotherWeek(s);
  }
  throw Error('The ordinary campaign did not reach Thursday bedtime.');
}, 20_000);
