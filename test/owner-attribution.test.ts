import { expect, it } from 'vitest';
import { cardView, queueInput, replay } from '../src/sim/game.ts';
import type { Input } from '../src/sim/types.ts';

// Owner's minimal prefix to Friday's car-park call. No private replay fixture required.
const inputs = [
  { kind: 'say', option: 'up', insist: true, at: 576404 },
  { kind: 'say', option: 'reply', at: 576437 },
  { kind: 'say', option: 'pin', at: 576645 },
  { kind: 'say', option: 'defend', insist: true, at: 576761 },
  { kind: 'quiet', at: 576922 },
  { kind: 'say', option: 'call', at: 577092 },
  { kind: 'quiet', at: 577292 },
  { kind: 'next', at: 577292 },
  { kind: 'say', option: 'up', at: 577842 },
  { kind: 'say', option: 'own', insist: true, at: 578112 },
  { kind: 'say', option: 'sit', insist: true, at: 578202 },
  { kind: 'say', option: 'walk', insist: true, at: 578362 },
  { kind: 'say', option: 'call', at: 578531 },
  { kind: 'quiet', at: 578732 },
  { kind: 'next', at: 578732 },
  { kind: 'say', option: 'up', at: 579281 },
  { kind: 'say', option: 'reply', at: 579316 },
  { kind: 'say', option: 'defend', insist: true, at: 579642 },
  { kind: 'say', option: 'no', insist: true, at: 579892 },
  { kind: 'say', option: 'truth', at: 580066 },
  { kind: 'quiet', at: 580182 },
  { kind: 'next', at: 580182 },
  { kind: 'say', option: 'up', at: 580721 },
  { kind: 'say', option: 'yes', insist: true, at: 580891 },
  { kind: 'say', option: 'defend', at: 581081 },
  { kind: 'say', option: 'walk', at: 581242 },
  { kind: 'say', option: 'stay', at: 581387 },
  { kind: 'say', option: 'call', at: 581429 },
  { kind: 'say', option: 'aylin', insist: true, at: 581508 },
  { kind: 'say', option: 'write', at: 581612 },
  { kind: 'next', at: 581612 },
  { kind: 'say', option: 'up', at: 582161 },
  { kind: 'say', option: 'cancel', at: 582197 },
  { kind: 'say', option: 'bowl', at: 582522 },
  { kind: 'say', option: 'walk', at: 582682 },
] satisfies Input[];
it('does not quote the alarm phrase as the reason for calling Mum', () => {
  const s = replay(1180171606, inputs, 582934, '0.4.2');
  expect(cardView(s)?.id).toBe('bowl-5');
  queueInput(s, { kind: 'quiet' });
  expect(s.answer?.chosen).toBe('call');
  expect(s.answer?.turnedAlone).toBeUndefined();
});
