/** Prospective paper-reading choices only; no invented tenancy terms or player/owner verdict. */
import { expect, it } from 'vitest';
import { momentsOf } from '../src/sim/moments.ts';
import type { Ctx } from '../src/sim/types.ts';

it('offers reading before signature and gates the later decision on completed reading', () => {
  const ctx: Ctx = {
    day: 8,
    week: 2,
    weekday: 1,
    flags: {},
    chosen: {},
    missedMum: 0,
    tired: false,
    note: '',
    phrases: [],
  };
  for (const version of ['0.9.0', '0.9.1', '0.9.2']) {
    const moments = momentsOf(8, version);
    const letter = moments.find((m) => m.id === 'letter-8')!;
    const options = typeof letter.options === 'function' ? letter.options(ctx) : letter.options;
    const read = options.find((o) => o.id === 'read');
    expect(read?.action).toBe('read-letter');
    expect(read?.duration).toBe(10);
    expect(options.map((o) => o.id)).toEqual(expect.arrayContaining(['read', 'sign', 'unopened', 'bowl']));
    const decision = moments.find((m) => m.id === 'letter-decision-8')!;
    expect(decision).toBeDefined();
    expect(decision.when?.(ctx)).toBe(false);
    expect(decision.when?.({ ...ctx, flags: { w2: { letter: 'read' } } })).toBe(true);
    expect(String(read?.done)).toContain('without signing');
  }
});

it('uses weekday-specific bus and bedtime suggestions in every current route', () => {
  const context: Ctx = {
    day: 8,
    week: 2,
    weekday: 1,
    flags: {},
    chosen: {},
    missedMum: 0,
    tired: false,
    note: '',
    phrases: [],
  };
  for (const version of ['0.9.0', '0.9.1', '0.9.2']) {
    for (const kind of ['bus', 'bed']) {
      const labels = [8, 9].map((day) => {
        const c = { ...context, version, day, weekday: day - 7 };
        const m = momentsOf(day, version).find((m) => m.id === `${kind}-${day}`)!;
        const options = typeof m.options === 'function' ? m.options(c) : m.options;
        const ink = options[0]!.ink;
        return typeof ink === 'function' ? ink(c) : ink;
      });
      expect(labels[0]).not.toBe(labels[1]);
    }
  }
});
