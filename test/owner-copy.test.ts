import { describe, expect, it } from 'vitest';
import { ctxOf, newGame } from '../src/sim/game.ts';
import { momentById } from '../src/sim/moments.ts';
import type { Answer, Ctx, Opt } from '../src/sim/types.ts';
import { replyWords } from '../src/ui/reply.ts';

function completion(option: Opt, c: Ctx) {
  return typeof option.done === 'function' ? option.done(c) : option.done;
}

describe('owner copy regressions', () => {
  it('gives each first-week call its own conversation in the new edition', () => {
    const c = ctxOf(newGame(1, '0.4.1'));
    c.version = '0.4.2';
    const lines = [1, 2, 4].map((day) => {
      c.day = day;
      const options = momentById(`bus-${day}`).options;
      const call = (typeof options === 'function' ? options(c) : options).find((o) => o.id === 'call');
      if (!call) throw new Error('Expected call');
      return completion(call, c);
    });
    expect(new Set(lines).size).toBe(3);
    c.version = '0.4.1';
    const options = momentById('bus-2').options;
    const call = (typeof options === 'function' ? options(c) : options).find((o) => o.id === 'call');
    if (!call) throw new Error('Expected call');
    expect(completion(call, c)).toContain('neighbour’s roof');
  });

  it('explains how she kept the birthday visit after the extra route', () => {
    const c = ctxOf(newGame(1, '0.4.1'));
    c.version = '0.4.2';
    c.flags.route = true;
    const scene = momentById('dinner-3').scene;
    const words = typeof scene === 'function' ? scene(c) : scene;
    expect(words).toMatch(/fifteen minutes late/);
    expect(words).toMatch(/saved.*plate/);
    expect(words).toMatch(/route/);
  });

  it.each([
    ['gym-5', 'cancel', 'keep', 'I’m leaving the membership as it is. It renews this morning.'],
    ['error-10', 'aside', 'room', 'The van is moving. I’m calling the number across the room.'],
  ])('explains %s without promising to do rejected advice afterwards', (moment, said, chosen, words) => {
    const s = newGame(1, '0.4.1');
    s.version = '0.4.2';
    const a = {
      moment,
      said,
      chosen,
      at: s.minute,
      verdict: 'deferred',
      says: 'Not now. After I leave it for now.',
    } as Answer;
    expect(replyWords(s, a)).toBe(words);
    s.version = '0.4.1';
    expect(replyWords(s, a)).toContain(a.says);
  });
});
