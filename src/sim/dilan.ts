/**
 * Dilan as an HF person. Who she is lives in the PersonSpec, a few habits and her commitments; the game reads her
 * back through HF (decide, predict, promptings, review, bodyForecast) and keeps no parallel model of her mind.
 */
import { createPerson, MINUTES_PER_YEAR, type Person, promise } from '@adam0white/human-framework';

export const YOU = 'you';
export const PULL = 'pull';
/** Day 1 (Monday) starts at this absolute minute: day 400 of the sim calendar. */
export const DAY0 = 400 * 1440;
export const dayStart = (day: number) => DAY0 + (day - 1) * 1440;
export const WAKE = 6 * 60 + 40;
export const REVIEW_AT = 22 * 60;

/** Labels HF uses in its own sentences ("I didn't keep my call to Mum."). */
export const LABEL = {
  alarm: 'my alarm',
  mum: 'my call to Mum',
  aylin: 'my word to Aylin',
} as const;

/** A small, seed-fixed difference between runs (±0.06): no two weeks start from quite the same Dilan. */
function jitter(seed: number, salt: number): number {
  let x = (seed * 2654435761 + salt * 40503) >>> 0;
  x = Math.imul(x ^ (x >>> 15), 0x2c1b3c6d) >>> 0;
  return ((x % 1000) / 1000 - 0.5) * 0.12;
}

export function makeDilan(seed: number): Person {
  const now = dayStart(1) + WAKE - 1;
  const p = createPerson({
    id: 'dilan',
    name: 'Dilan',
    seed: seed ^ 0xd11a,
    now,
    bornAt: now - 33 * MINUTES_PER_YEAR,
    sex: 'female',
    traits: {
      honesty: 0.68,
      conscientiousness: 0.48,
      emotionality: 0.62,
      extraversion: 0.45,
      agreeableness: 0.6,
    },
    norms: [
      { normId: 'punctuality', standing: 'recommended', conviction: 0.6 },
      { normId: 'lying', standing: 'forbidden', conviction: 0.28 },
      { normId: 'backbiting', standing: 'forbidden', conviction: 0.28 },
      { normId: 'kindness-to-parents', standing: 'obligatory', conviction: 0.5 },
      { normId: 'keep-promise', standing: 'obligatory', conviction: 0.3 },
      { normId: 'help-neighbor', standing: 'recommended', conviction: 0.5 },
      { normId: 'gratitude', standing: 'recommended', conviction: 0.5 },
    ],
    // The pull has been with her longer than you have.
    voices: [
      { voiceId: YOU, trust: 0.5 },
      { voiceId: PULL, trust: 0.6 },
    ],
    enable: {
      fatigueStore: true,
      promptings: { reading: 'inclination', readingSource: 'host:dilan' },
      review: { style: 'ruminating', at: REVIEW_AT, styleSource: 'host:dilan' },
    },
  });
  // An ordinary person: she mostly does what weighs most, not always.
  p.will.temperature = 0.15;
  // Habits she brought back with her. Cued by place; last done yesterday.
  const y = now - 1440;
  p.habits.push(
    {
      cue: { placeId: 'bed' },
      action: 'snooze',
      strength: 0.9 + jitter(seed, 1),
      repetitions: 400,
      lastAt: y,
    },
    {
      cue: { placeId: 'phone' },
      action: 'scroll',
      strength: 0.85 + jitter(seed, 2),
      repetitions: 900,
      lastAt: y,
    },
    {
      cue: { placeId: 'depot' },
      action: 'coffee',
      strength: 0.45 + jitter(seed, 3),
      repetitions: 300,
      lastAt: y,
    },
  );
  const until = dayStart(5) + 1439;
  promise(p, {
    kind: 'promise',
    toId: 'self',
    label: LABEL.alarm,
    actions: ['get-up'],
    from: dayStart(1) + WAKE - 5,
    until: dayStart(1) + WAKE + 20,
    importance: 0.5,
    recurEvery: 1440,
    recurUntil: until,
  });
  // Sunday night Aylin made her promise: one call a day this week.
  promise(p, {
    kind: 'promise',
    toId: 'mum',
    label: LABEL.mum,
    actions: ['call-mum'],
    from: dayStart(1) + 17 * 60 + 30,
    until: dayStart(1) + 21 * 60 + 30,
    importance: 0.55,
    recurEvery: 1440,
    recurUntil: until,
  });
  promise(p, {
    kind: 'promise',
    toId: 'aylin',
    label: LABEL.aylin,
    actions: ['dinner'],
    from: dayStart(3) + 19 * 60 + 30,
    until: dayStart(3) + 21 * 60,
    importance: 0.6,
  });
  // The shelf she started in March.
  p.agenda.goals.push({
    id: 'shelf',
    label: 'the shelf',
    serves: ['competence', 'meaning'],
    progress: 0.1,
    advancedBy: [{ action: 'shelf', amount: 0.45 }],
    importance: 0.35,
    status: 'active',
    adoptedAt: now - 200 * 1440,
    lastAdvancedAt: now - 200 * 1440,
  });
  return p;
}
