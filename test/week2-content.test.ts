import { advanceAgenda, onFinished } from '@adam0white/human-framework';
import { describe, expect, it } from 'vitest';
import { DAY0, makeDilan } from '../src/sim/dilan.ts';
import { MOMENTS } from '../src/sim/moments.ts';
import type { Ctx, Final, GameState, Moment } from '../src/sim/types.ts';
import {
  FEET_ALONE_FROM,
  upAloneLine,
  WEEK_TWO,
  weekTwoHerLine,
  weekTwoLine,
  weekTwoThreads,
} from '../src/sim/week2.ts';

const closing = {
  send: 'Mum replied with a voice note eleven minutes long.',
  call: 'They talked until the kettle went cold.',
  delete: 'She deleted it. On Sunday she rang anyway.',
};

function final(sent = 'delete', threads: string[] = []): Final {
  return {
    note: 'Mum, it’s me.',
    sent,
    threads,
    line: closing[sent as keyof typeof closing] ?? closing.delete,
    phrases: [],
    unasked: [],
    strip: [],
    hands: { start: { you: 0.5, pull: 0.6 }, end: { you: 0.6, pull: 0.5 } },
  };
}

function context(patch: Partial<Ctx> = {}): Ctx {
  return {
    day: 8,
    weekday: 1,
    week: 2,
    flags: {},
    missedMum: 0,
    tired: false,
    chosen: {},
    note: '',
    phrases: [],
    weekOne: final(),
    ...patch,
  };
}

function state(c = context()): GameState {
  return {
    version: '0.4.0',
    seed: 1,
    day: c.day,
    phase: 'day',
    minute: 0,
    person: makeDilan(1),
    inputs: [],
    applied: 0,
    queue: [],
    card: null,
    answer: null,
    log: [],
    flags: c.flags,
    chosen: c.chosen,
    stats: {
      said: 0,
      insisted: 0,
      heard: 0,
      refused: 0,
      silent: 0,
      pullWon: 0,
      turnedAlone: [],
      borrowedHeard: 0,
      reinforced: [],
      borrowable: 0,
      borrowed: 0,
      learned: [],
      trustYouAtStart: 0.5,
      trustPullAtStart: 0.6,
    },
    pages: [],
    phrases: [],
    hinted: [],
    final: null,
    past: c.weekOne ? [c.weekOne] : [],
  };
}

function moment(id: string): Moment {
  const found = WEEK_TWO.find((m) => m.id === id);
  if (!found) throw new Error(`Missing content: ${id}`);
  return found;
}

const text = (v: string | ((c: Ctx) => string), c: Ctx) => (typeof v === 'string' ? v : v(c));
const options = (m: Moment, c: Ctx) => (typeof m.options === 'function' ? m.options(c) : m.options);
const normIds = new Set([
  'punctuality',
  'lying',
  'backbiting',
  'kindness-to-parents',
  'keep-promise',
  'gratitude',
  'help-neighbor',
  'fairness',
  'harm-others',
  'care-dependents',
  'charity',
  'theft',
]);

const oldThreads = [
  'Ece has her own columns now. She sends Dilan a photo of them every morning.',
  'Ece never asked to shadow her again. She asked Murat.',
  'Ece still thinks it was her scanner.',
  'Ece knows the new estate now. She knows who talked her round it.',
  'Murat stopped asking about the ring road. That was worse.',
  'Murat’s note says late twice. In pen. It also says reliable.',
  'Aylin came round on Saturday for the shelf. There was still cake.',
  'The screws are still in their little bag. March is a long time ago now.',
  'The gym bag is by the door again. On purpose.',
  'She changed the lock screen. The beach can stay in the album.',
  'The beach photo is still the lock screen.',
];

/** All combinations of the thread lines the content reads, plus both phrase extremes and each authored flag branch. */
function contexts(): Ctx[] {
  const out: Ctx[] = [];
  const readThreads = [oldThreads[0], oldThreads[1], oldThreads[2], oldThreads[6], oldThreads[9]] as string[];
  for (const sent of Object.keys(closing))
    for (let mask = 0; mask < 2 ** readThreads.length; mask++) {
      for (const learned of [false, true]) {
        out.push(
          context({
            weekOne: final(
              sent,
              readThreads.filter((_, i) => (mask & (1 << i)) !== 0),
            ),
            flags: {
              late: learned,
              lateDays: learned ? 3 : 0,
              lied: learned ? 8 : undefined,
              gossiped: learned ? 1 : undefined,
              eceBlamed: learned,
              gym: learned,
              shelf: learned ? 2 : 0,
            },
            phrases: learned
              ? [
                  { id: 'plain', text: 'Just say it plainly', practice: 0.8 },
                  { id: 'feet', text: 'Feet on the floor', practice: 0.6 },
                  { id: 'walk', text: 'Walk away from it', practice: 0.4 },
                  { id: 'ten', text: 'It’s ten minutes', practice: 0.2 },
                ]
              : [],
            tired: learned,
            missedMum: learned ? 3 : 0,
            chosen: learned ? { 'shadow-4': 'stay', 'shelf-4': 'aylin', 'lunch-1': 'defend' } : {},
          }),
        );
      }
    }
  for (const practice of ['no', 'tomorrow', 'thursday'])
    for (const board of ['leave', 'together', 'restore'])
      for (const close of ['stay', 'open', 'slip'])
        for (const adviceId of ['plain', 'feet', 'walk', 'ten', 'own']) {
          for (const advice of ['stand', 'soften', 'ask'])
            out.push(
              context({
                flags: {
                  w2: {
                    practice,
                    board,
                    close,
                    advice,
                    adviceId,
                    adviceText: 'Feet on the floor',
                    practised: practice !== 'no',
                    earlyBus: close !== 'stay',
                    bag: close === 'stay' ? 'shelf' : 'ready',
                    ...(practice === 'no' ? {} : { closePromise: 'test-promise' }),
                  },
                },
                phrases: [{ id: adviceId, text: 'Feet on the floor', practice: 0.2 }],
              }),
            );
        }
  for (const thread of oldThreads) out.push(context({ weekOne: final('delete', [thread]) }));
  for (const [key, values] of Object.entries({
    returns: ['let', 'redo'],
    room: ['shelf', 'rest'],
    letter: ['sign', 'unopened', 'bowl'],
    family: ['nice', 'salt', 'sit'],
    evening: ['practice', 'own', 'sit'],
    saturday: ['answer', 'offer', 'down'],
  }))
    for (const value of values) out.push(context({ flags: { w2: { [key]: value } } }));
  for (const chosen of [{ 'shadow-4': 'go' }, { 'lunch-1': 'defend' }] as Record<string, string>[])
    out.push(context({ chosen }));
  return out;
}

describe('week-two content contract', () => {
  it('has six ordinary cards each weekday, a conditional late card, and Saturday morning', () => {
    expect([...new Set(WEEK_TWO.map((m) => m.day))]).toEqual([8, 9, 10, 11, 12, 13]);
    for (let day = 8; day <= 12; day++) {
      const c = context({ day, weekday: day - 7 });
      expect(WEEK_TWO.filter((m) => m.day === day && (!m.when || m.when(c)))).toHaveLength(6);
      expect(moment(`late-${day}`).when?.(c)).toBe(false);
      expect(moment(`late-${day}`).when?.({ ...c, flags: { late: true } })).toBe(true);
    }
    expect(WEEK_TWO.filter((m) => m.day === 13)).toHaveLength(1);
  });

  it('uses unique ids distinct from week one', () => {
    const old = new Set(MOMENTS.filter((m) => m.day <= 6).map((m) => m.id));
    expect(new Set(WEEK_TWO.map((m) => m.id)).size).toBe(WEEK_TWO.length);
    for (const m of WEEK_TWO) expect(old.has(m.id)).toBe(false);
  });

  it('closes each evening in her own words', () => {
    const s = state();
    for (const c of contexts())
      for (let day = 8; day <= 13; day++) {
        s.day = day;
        s.flags = c.flags;
        s.chosen = c.chosen;
        s.past = c.weekOne ? [c.weekOne] : [];
        expect(weekTwoHerLine(s).trim()).not.toBe('');
        expect(weekTwoThreads(s).length).toBeGreaterThan(0);
        expect(weekTwoThreads(s).every((line) => line.trim().length > 0)).toBe(true);
        expect(weekTwoLine(s).trim()).not.toBe('');
      }
  });

  it('renders every text function, pull target, scene and catalog norm across the branch range', () => {
    for (const base of contexts())
      for (const m of WEEK_TWO) {
        const c = { ...base, day: m.day, weekday: m.day - 7 };
        const scene = text(m.scene, c);
        expect(scene.trim(), m.id).not.toBe('');
        expect(scene.split('\n').length, m.id).toBeLessThanOrEqual(2);
        expect(text(m.pull.line, c).trim(), m.id).not.toBe('');
        if (m.pull.borrow !== undefined) expect(m.pull.borrow.trim()).not.toBe('');
        if (m.when) expect(typeof m.when(c)).toBe('boolean');
        const when = typeof m.at === 'function' ? m.at(c) : m.at;
        expect(Number.isFinite(when), m.id).toBe(true);
        expect(when, m.id).toBeGreaterThanOrEqual(0);
        expect(when, m.id).toBeLessThan(1440);
        const opts = options(m, c);
        expect(
          opts.map((o) => o.id),
          m.id,
        ).toContain(m.pull.to);
        expect(new Set(opts.map((o) => o.id)).size, m.id).toBe(opts.length);
        for (const o of opts) {
          expect(text(o.ink, c).trim(), `${m.id}/${o.id}`).not.toBe('');
          expect(text(o.done, c).trim(), `${m.id}/${o.id}`).not.toBe('');
          if (typeof o.gives === 'function') expect(o.gives(c)).toBeTypeOf('object');
          for (const norm of o.norms ?? []) expect(normIds.has(norm.normId), `${m.id}/${o.id}`).toBe(true);
          if (o.tags?.includes('temptation')) expect(o.norms?.length, `${m.id}/${o.id}`).toBeGreaterThan(0);
        }
      }
  });

  it('uses the weekday for recurring text and suppresses only the learned alarm', () => {
    for (let day = 8; day <= 12; day++) {
      const m = moment(`alarm-${day}`);
      for (const practice of [0, FEET_ALONE_FROM - 0.001, FEET_ALONE_FROM, 0.8]) {
        const c = context({
          day,
          weekday: day - 7,
          phrases: [{ id: 'feet', text: 'Feet on the floor', practice }],
        });
        expect(m.when?.(c)).toBe(practice < FEET_ALONE_FROM);
      }
    }
    expect(upAloneLine).toMatch(/herself/);
    const mondayBus = text(moment('bus-8').scene, context());
    const tuesdayBus = text(moment('bus-9').scene, context({ day: 9, weekday: 2 }));
    expect(mondayBus).not.toBe(tuesdayBus);
  });

  it('preserves the recurring option ids, actions and side effects the engine reads', () => {
    for (let day = 8; day <= 12; day++) {
      const c = context({ day, weekday: day - 7 });
      const s = state(c);
      expect(options(moment(`alarm-${day}`), c).map((o) => [o.id, o.action])).toEqual([
        ['up', 'get-up'],
        ['snooze', 'snooze'],
      ]);
      moment(`alarm-${day}`).after?.(s, 'snooze');
      expect(s.flags.late).toBe(true);
      moment(`alarm-${day}`).after?.(s, 'up');
      expect(s.flags.late).toBe(false);
      moment(`late-${day}`).after?.(s, 'lie');
      expect(s.flags.lateDays).toBe(1);
      expect(s.flags.lied).toBe(day);
      moment(`late-${day}`).after?.(s, 'truth');
      expect(s.flags.lateDays).toBe(2);
      expect(options(moment(`bus-${day}`), c).map((o) => [o.id, o.action])).toEqual([
        ['call', 'call-mum'],
        ['scroll', 'scroll'],
        ['text', 'text-mum'],
      ]);
      moment(`bus-${day}`).after?.(s, 'call');
      expect(s.flags.calls).toBe(1);
      moment(`bus-${day}`).after?.(s, 'text');
      expect(s.flags.calls).toBe(1);
      expect(options(moment(`bed-${day}`), c).map((o) => o.id)).toEqual(['write', 'scroll', 'sleep']);
      moment(`bed-${day}`).after?.(s, 'write');
      expect(s.flags.wrote).toBe(1);
      expect(s.flags.wroteTonight).toBe(true);
    }
  });

  it('adds at most one phrase and keeps existing phrase ids for their original words', () => {
    const old = new Map<string, string>();
    for (const m of MOMENTS.filter((m) => m.day <= 6))
      for (const o of options(m, context())) {
        if (o.phrase) old.set(o.phrase.id, o.phrase.text);
      }
    const added = new Set<string>();
    for (const c of contexts())
      for (const m of WEEK_TWO)
        for (const o of options(m, c)) {
          if (!o.phrase) continue;
          if (old.has(o.phrase.id)) expect(o.phrase.text).toBe(old.get(o.phrase.id));
          else added.add(o.phrase.id);
        }
    expect(added.size).toBeLessThanOrEqual(1);
  });

  it('puts her strongest learned words in Ece’s mouth and gives risky advice an actual cost', () => {
    const c = context({
      day: 9,
      weekday: 2,
      phrases: [
        { id: 'walk', text: 'Walk away from it', practice: 0.7 },
        { id: 'plain', text: 'Just say it plainly', practice: 0.3 },
      ],
    });
    expect(text(moment('words-9').scene, c)).toContain('“Walk away from it.”');
    const stand = options(moment('words-9'), c).find((o) => o.id === 'stand');
    const gives = stand?.gives;
    expect(typeof gives === 'function' ? gives(c).competence : undefined).toBeLessThan(0);
    expect(text(moment('words-9').scene, { ...c, phrases: [] })).toContain('“Tell him when it will arrive.”');
    expect(text(moment('answer-11').scene, context({ flags: { w2: { advice: 'soften' } } }))).toContain(
      'before his parcel',
    );
  });
});

describe('week-one canon', () => {
  it('keeps the changed lock screen changed and the unchanged one on the phone', () => {
    for (const sent of ['send', 'call', 'delete']) {
      const c = context({ weekOne: final(sent) });
      const texts = [
        text(moment('bed-8').scene, c),
        text(moment('photo-9').scene, { ...c, day: 9, weekday: 2 }),
      ];
      if (sent === 'delete')
        expect(texts.every((s) => s.includes('beach') && s.includes('lock screen'))).toBe(true);
      else {
        expect(texts.join(' ')).not.toMatch(/beach.*still the lock screen/i);
        expect(texts[1]).toContain('album');
      }
    }
  });

  it('extends Ece’s existing columns to the shared board', () => {
    const c = context({ weekOne: final('send', [oldThreads[0] as string]) });
    expect(text(moment('returns-8').scene, c)).toContain('morning photo');
    expect(text(moment('board-11').scene, c)).toContain('spread to the shared board');
  });

  it('never rebuilds a completed shelf, including Aylin’s offstage Saturday visit', () => {
    for (const c of [
      context({ flags: { shelf: 2 } }),
      context({ chosen: { 'shelf-4': 'aylin' } }),
      context({ weekOne: final('delete', [oldThreads[6] as string]) }),
    ]) {
      const room = moment('room-8');
      expect(text(room.scene, c)).toContain('stands');
      expect(options(room, c).some((o) => o.action === 'shelf')).toBe(false);
      expect(options(moment('evening-11'), c).some((o) => o.action === 'shelf')).toBe(false);
      expect(weekTwoThreads(state(c)).join(' ')).not.toContain('shelf parts');
    }
  });

  it('opens Monday from the actual Mum ending, even when the alarm is skipped', () => {
    for (const [sent, recall] of [
      ['delete', 'Sunday'],
      ['send', 'eleven minutes'],
      ['call', 'outlasted the kettle'],
    ]) {
      for (const practice of [0, 0.8]) {
        const c = context({
          weekOne: final(sent),
          phrases: [{ id: 'feet', text: 'Feet on the floor', practice }],
        });
        const first = WEEK_TWO.find((m) => m.day === 8 && (!m.when || m.when(c)));
        expect(first).toBeDefined();
        expect(text((first as Moment).scene, c)).toContain(recall);
      }
    }
  });
});

describe('Ece’s actual promises', () => {
  it('advertises both commitments before creating practice and Friday windows', () => {
    for (const choice of ['tomorrow', 'thursday']) {
      const c = context({ day: 9, weekday: 2 });
      const s = state(c);
      const opt = options(moment('word-9'), c).find((o) => o.id === choice);
      expect(text(opt?.ink ?? '', c)).toContain('Friday');
      moment('word-9').after?.(s, choice);
      const commitments = s.person.agenda.commitments.filter((p) => p.toId === 'ece');
      expect(commitments).toHaveLength(2);
      expect(commitments.map((p) => p.actions)).toEqual([['practice-ece'], ['close-with-ece']]);
      const practice = commitments[0];
      expect(practice?.from).toBe(choice === 'tomorrow' ? DAY0 + 9 * 1440 + 790 : DAY0 + 10 * 1440 + 1160);
      const keep = moment(choice === 'tomorrow' ? 'reading-10' : 'evening-11');
      const keepCtx = context({ day: keep.day, weekday: keep.day - 7, flags: s.flags });
      const optKeep = options(keep, keepCtx).find((o) => o.action === 'practice-ece');
      expect(optKeep).toBeDefined();
      const at = typeof keep.at === 'function' ? keep.at(keepCtx) : keep.at;
      const start = DAY0 + (keep.day - 1) * 1440 + at + (keep.window ?? 5);
      const end = start + (optKeep?.duration ?? 0);
      expect(end).toBeLessThanOrEqual(practice?.until ?? 0);
      onFinished(
        s.person,
        { affordanceId: 'content-practice', action: optKeep?.action ?? '', status: 'completed', at: end },
        start,
      );
      expect(s.person.agenda.commitments.find((p) => p.id === s.flags.w2?.practicePromise)?.status).toBe(
        'kept',
      );
    }
  });

  it('makes no promise for a refusal and invents no earlier word in Friday’s reply', () => {
    const s = state();
    moment('word-9').after?.(s, 'no');
    expect(s.person.agenda.commitments.filter((p) => p.toId === 'ece')).toHaveLength(0);
    const c = context({ flags: s.flags, day: 12, weekday: 5 });
    expect(text(options(moment('close-12'), c).find((o) => o.id === 'open')?.done ?? '', c)).not.toContain(
      'I know what I said',
    );
  });

  it('releases the pending Friday word only for openly withdrawing, and records the early bus', () => {
    for (const choice of ['open', 'slip', 'stay']) {
      const s = state();
      moment('word-9').after?.(s, 'thursday');
      const id = s.flags.w2?.closePromise;
      moment('close-12').after?.(s, choice);
      const p = s.person.agenda.commitments.find((p) => p.id === id);
      expect(p?.status).toBe(choice === 'open' ? 'released' : 'pending');
      expect(s.flags.w2?.earlyBus).toBe(choice !== 'stay');
      if (choice === 'slip') {
        advanceAgenda(s.person, DAY0 + 11 * 1440 + 1200);
        expect(s.person.agenda.commitments.find((p) => p.id === id)?.status).toBe('broken');
      }
    }
  });
});
