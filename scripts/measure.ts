// Headless measure: policy bots x seeds -> who won the moments, what she kept, how the two voices' trust moved.
// Run: npm run measure -- seeds=8 [p=silent,oppose] [v=0.2.1,0.3.0,0.4.0] [json=/absolute/path.json]

import { writeFileSync } from 'node:fs';
import { tick } from '@adam0white/human-framework';
import {
  cardView,
  ctxOf,
  insistCarries,
  newGame,
  optionsOf,
  queueInput,
  runToCard,
  step,
  trustOf,
  WEEK_TWO_EDITION,
} from '../src/sim/game.ts';
import { momentById } from '../src/sim/moments.ts';
import type { GameState } from '../src/sim/types.ts';

type Policy = 'silent' | 'oppose' | 'insist' | 'pull' | 'reader' | 'picky' | 'teach' | 'edge' | 'tap';
const RANK = { yes: 4, 'if pushed': 3, later: 2, 'rather not': 1, no: 0 } as const;

/** What each bot says at a card, or null for silence. */
function choose(s: GameState, policy: Policy): { option: string; insist?: boolean } | null {
  const v = cardView(s);
  if (!v || policy === 'silent') return null;
  const not = v.options.filter((o) => !o.isPull);
  if (policy === 'pull') return { option: v.pullTo };
  // Editions share this algorithm. Legacy has deterministic leans; new cards also expose odds.
  const byChance = <T extends { lean: keyof typeof RANK; likelihood?: number }>(a: T, b: T) =>
    (b.likelihood ?? RANK[b.lean] / 4) - (a.likelihood ?? RANK[a.lean] / 4);
  if (policy === 'tap') {
    const best = [...v.options].sort(byChance)[0];
    return best ? { option: best.id } : null;
  }
  const first = not[0];
  if (!first) return null;
  if (policy === 'oppose') return { option: first.id };
  if (policy === 'teach') return s.day <= 3 ? { option: first.id } : null;
  if (policy === 'insist') return { option: first.id, insist: true };
  // edge: plays the edges a sharp player finds. Sides with the pull where it is right (tired mornings, the
  // first lie), speaks on every card the pull borrows, and holds only where a hold carries and beats a tap.
  if (policy === 'edge') {
    const c = ctxOf(s);
    const late = v.options.some((o) => o.id === 'lie');
    if (late && c.flags.lied === undefined) return { option: 'lie' };
    if (c.tired && ['coffee', 'watch', 'sleep'].includes(v.pullTo)) return { option: v.pullTo };
    const willing = not.filter((o) => o.lean === 'yes').sort(byChance)[0];
    if (willing) return { option: willing.id };
    const push = not.find((o) => RANK[o.pushed] > RANK[o.lean] && RANK[o.pushed] >= 3);
    if (push && insistCarries(s.person)) return { option: push.id, insist: true };
    return v.borrowed ? { option: first.id } : null;
  }
  // reader: says the best non-pull option she leans to; insists only where she would go along if pushed.
  const yes =
    not.filter((o) => o.lean === 'yes').sort(byChance)[0] ??
    not.filter((o) => o.lean === 'later').sort(byChance)[0];
  if (yes) return { option: yes.id };
  if (policy === 'reader') {
    const pushed = not.find((o) => o.pushed === 'if pushed' || o.pushed === 'yes');
    return pushed ? { option: pushed.id, insist: true } : null;
  }
  // picky: speaks only on cards with a tempting option, silent elsewhere.
  const opts = optionsOf(s, momentById(v.id));
  return opts.some((o) => o.tags?.includes('temptation')) ? { option: first.id } : null;
}

function run(seed: number, policy: Policy, version: string) {
  const s = newGame(seed, version);
  const taps: {
    moment: string;
    option: string;
    pull: boolean;
    lean: string;
    mood: string;
    likelihood?: number;
    landed: boolean;
    heard: boolean;
    against: boolean;
    stayed: boolean;
  }[] = [];
  let holds = 0;
  let silent = 0;
  let tempting = 0;
  let pullWonTempting = 0;
  let cards = 0;
  let borrowed = 0;
  let weekTwoPrompts = 0;
  let weekTwoPullWon = 0;
  const mornings = new Map<number, { day: number; feetPractice: number; alone: boolean }>();
  const t0 = performance.now();
  for (let guard = 0; guard < 2000; guard++) {
    if (s.phase === 'end') {
      if (version === WEEK_TWO_EDITION && s.day === 6) queueInput(s, { kind: 'next' });
      else break;
    }
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    if (s.day >= 8 && s.day <= 12 && !mornings.has(s.day))
      mornings.set(s.day, {
        day: s.day,
        feetPractice: ctxOf(s).phrases.find((ph) => ph.id === 'feet')?.practice ?? 0,
        alone: false,
      });
    runToCard(s);
    const morning = mornings.get(s.day);
    if (morning && s.stats.gotUpAlone) morning.alone = true;
    // resolve() ticks to the input minute before deciding. Forecast that exact state,
    // without changing the live person or consuming its RNG.
    const decisionState = structuredClone(s);
    if (decisionState.person.now < s.minute) tick(decisionState.person, s.minute);
    const v = cardView(decisionState);
    if (!v) continue;
    cards += 1;
    if (v.borrowed) borrowed += 1;
    const said = choose(decisionState, policy);
    if (said) queueInput(s, { kind: 'say', ...said });
    else while (s.card) step(s);
    const a = s.answer;
    if (said?.insist) holds += 1;
    else if (said) {
      const option = v.options.find((o) => o.id === said.option);
      if (!option) throw new Error(`Policy selected an absent option: ${said.option}`);
      taps.push({
        moment: v.id,
        option: option.id,
        pull: option.isPull,
        lean: option.lean,
        mood: option.mood ?? option.lean,
        likelihood: option.likelihood,
        landed: a?.chosen === said.option,
        heard: a?.verdict === 'assented' || a?.verdict === 'complied',
        against: option.lean !== 'yes',
        stayed: !!a?.stayed,
      });
    } else silent += 1;
    const tempt = (s.person.promptings?.recent ?? []).some((r) => r.at === a?.at);
    if (tempt) {
      tempting += 1;
      if (a?.pullWon) pullWonTempting += 1;
      if (s.day >= 8) {
        weekTwoPrompts += 1;
        if (a?.pullWon) weekTwoPullWon += 1;
      }
    }
  }
  const pages = s.pages;
  return {
    seed,
    policy,
    version,
    ended: s.phase === 'end',
    holds,
    silent,
    taps,
    thoughts: s.thoughts ?? [],
    ms: Math.round(performance.now() - t0),
    cards,
    prompts: tempting,
    pullWonPrompts: pullWonTempting,
    kept: pages.reduce((n, p) => n + p.kept.length, 0),
    missed: pages.reduce((n, p) => n + p.missed.length, 0),
    calls: s.flags.calls ?? 0,
    wrote: s.flags.wrote ?? 0,
    shelf: s.flags.shelf ?? 0,
    borrowed,
    alone: pages.reduce((n, p) => n + p.turnedAlone.length, 0),
    phrases: (s.final?.phrases ?? []).map((p) => `${p.text}:${p.weight.toFixed(2)}`).join('|'),
    you: trustOf(s.person, 'you').toFixed(2),
    pull: trustOf(s.person, 'pull').toFixed(2),
    sent: s.final?.sent,
    about: pages.map((p) => p.aboutYou.slice(0, 18)).join(' / '),
    ...(version === WEEK_TWO_EDITION
      ? {
          weekTwo: {
            prompts: weekTwoPrompts,
            pullWonPrompts: weekTwoPullWon,
            kept: pages.filter((p) => p.day >= 8).reduce((n, p) => n + p.kept.length, 0),
            missed: pages.filter((p) => p.day >= 8).reduce((n, p) => n + p.missed.length, 0),
            morningsAlone: pages.filter((p) => p.day >= 8 && p.gotUpAlone).length,
            mornings: [...mornings.values()],
            flags: { ...s.flags.w2 },
          },
        }
      : {}),
  };
}

const seeds = Number(process.argv.find((a) => a.startsWith('seeds='))?.slice(6) ?? 8);
if (!Number.isInteger(seeds) || seeds < 1) throw new Error('seeds must be a positive integer');
const policies = (process.argv
  .find((a) => a.startsWith('p='))
  ?.slice(2)
  .split(',') ?? [
  'silent',
  'oppose',
  'insist',
  'pull',
  'reader',
  'picky',
  'teach',
  'edge',
  'tap',
]) as Policy[];
const versions = process.argv
  .find((a) => a.startsWith('v='))
  ?.slice(2)
  .split(',') ?? ['0.2.1', '0.3.0', WEEK_TWO_EDITION];
const rows = versions.flatMap((version) =>
  policies.flatMap((policy) => Array.from({ length: seeds }, (_, i) => run(1000 + i, policy, version))),
);
const definitions = {
  againstLeanTap:
    'A plain (not insisted) suggestion whose cardView lean is not yes. Lean is the deterministic forecast verdict classification at the decision minute, not the sampled result. The forecast uses a cloned state ticked to s.minute exactly as resolve does; policies read that same clone. Includes pull-aligned suggestions; nonPullAgainst is reported separately.',
  landed:
    'answer.chosen equals suggested option. heard additionally requires verdict assented or complied; the two counts are separate.',
  calibration:
    'Only naturally selected ordinary taps with finite likelihood, including zero vetoes. Expected=sum(likelihood), residual=actual-expected; Brier=mean((landed-likelihood)^2). No claim of independent trials, unbiased card coverage, or causal edition effect.',
  surfaced:
    'A retained thought has surfacedAt strictly later than its original at. All thoughts remain in per-run JSON, including those with no later matching opportunity.',
  policy:
    'Same code for both editions. tap selects highest likelihood across every option, ties in card order; legacy falls back to lean rank. reader and edge preserve their historical decision rules, using likelihood only to break equal-lean choices when available.',
};
const mean = (
  rs: typeof rows,
  key: 'kept' | 'missed' | 'prompts' | 'pullWonPrompts' | 'alone' | 'borrowed' | 'holds' | 'silent',
) => rs.reduce((n, r) => n + r[key], 0) / rs.length;
const rate = (n: number, d: number) => (d ? n / d : null);
const calibration = (taps: (typeof rows)[number]['taps']) => {
  const ts = taps.filter((t) => t.likelihood !== undefined && Number.isFinite(t.likelihood));
  const expected = ts.reduce((n, t) => n + Number(t.likelihood), 0);
  const actual = ts.filter((t) => t.landed).length;
  return {
    n: ts.length,
    actual,
    expected,
    residual: actual - expected,
    rate: rate(actual, ts.length),
    brier: rate(
      ts.reduce((n, t) => n + (Number(t.landed) - Number(t.likelihood)) ** 2, 0),
      ts.length,
    ),
  };
};
const summaries = versions.flatMap((version) =>
  policies.map((policy) => {
    const rs = rows.filter((r) => r.version === version && r.policy === policy);
    const taps = rs.flatMap((r) => r.taps);
    const against = taps.filter((t) => t.against);
    const thoughts = rs.flatMap((r) => r.thoughts);
    const moods = [...new Set(taps.map((t) => t.mood))].map((mood) => {
      const ts = taps.filter((t) => t.mood === mood);
      return {
        mood,
        n: ts.length,
        landed: ts.filter((t) => t.landed).length,
        heard: ts.filter((t) => t.heard).length,
        calibration: calibration(ts),
      };
    });
    return {
      version,
      policy,
      runs: rs.length,
      ended: rs.every((r) => r.ended),
      kept: mean(rs, 'kept'),
      missed: mean(rs, 'missed'),
      prompts: mean(rs, 'prompts'),
      pullWonPrompts: mean(rs, 'pullWonPrompts'),
      alone: mean(rs, 'alone'),
      borrowed: mean(rs, 'borrowed'),
      holds: mean(rs, 'holds'),
      silent: mean(rs, 'silent'),
      taps: taps.length,
      landed: taps.filter((t) => t.landed).length,
      heard: taps.filter((t) => t.heard).length,
      against: against.length,
      againstLanded: against.filter((t) => t.landed).length,
      againstAssentedAndLanded: against.filter((t) => t.landed && t.heard).length,
      againstLandingShare: rate(against.filter((t) => t.landed).length, against.length),
      nonPullAgainst: against.filter((t) => !t.pull).length,
      nonPullAgainstLanded: against.filter((t) => !t.pull && t.landed).length,
      nonPullAgainstAssentedAndLanded: against.filter((t) => !t.pull && t.landed && t.heard).length,
      gentleRefusals: taps.filter((t) => !t.landed).length,
      retained: thoughts.length,
      surfaced: thoughts.filter((t) => t.surfacedAt !== undefined && t.surfacedAt > t.at).length,
      calibration: calibration(taps),
      probabilityBands: [
        { label: '0 (veto or impossible)', min: 0, max: 0 },
        { label: '(0, .1)', min: 0, max: 0.1 },
        { label: '[.1, .5)', min: 0.1, max: 0.5 },
        { label: '[.5, 1)', min: 0.5, max: 1 },
        { label: '1 (certain)', min: 1, max: 1 },
      ].map((band) => ({
        band: band.label,
        ...calibration(
          taps.filter((t) => {
            const p = t.likelihood;
            return (
              p !== undefined &&
              (band.min === band.max
                ? p === band.min
                : p < band.max && (band.min === 0 ? p > 0 : p >= band.min))
            );
          }),
        ),
      })),
      moods,
      ...(version === WEEK_TWO_EDITION
        ? {
            weekTwo: {
              prompts: rs.reduce((n, r) => n + (r.weekTwo?.prompts ?? 0), 0) / rs.length,
              pullWonPrompts: rs.reduce((n, r) => n + (r.weekTwo?.pullWonPrompts ?? 0), 0) / rs.length,
              kept: rs.reduce((n, r) => n + (r.weekTwo?.kept ?? 0), 0) / rs.length,
              missed: rs.reduce((n, r) => n + (r.weekTwo?.missed ?? 0), 0) / rs.length,
              morningsAlone: rs.reduce((n, r) => n + (r.weekTwo?.morningsAlone ?? 0), 0) / rs.length,
              flags: Object.fromEntries(
                [...new Set(rs.flatMap((r) => Object.keys(r.weekTwo?.flags ?? {})))].sort().map((key) => {
                  const counts: Record<string, number> = {};
                  for (const r of rs) {
                    const value = JSON.stringify(r.weekTwo?.flags[key]) ?? '(absent)';
                    counts[value] = (counts[value] ?? 0) + 1;
                  }
                  return [key, counts];
                }),
              ),
            },
          }
        : {}),
    };
  }),
);
console.log('edition policy  kept missed prompts pullWon holds taps against land% retained surfaced');
for (const s of summaries)
  console.log(
    `${s.version} ${s.policy.padEnd(7)} ${s.kept.toFixed(1)} ${s.missed.toFixed(1)} ${s.prompts.toFixed(1)} ${s.pullWonPrompts.toFixed(1)} ${s.holds.toFixed(1)} ${s.taps} ${s.against} ${s.againstLandingShare === null ? '-' : (100 * s.againstLandingShare).toFixed(1)} ${s.retained} ${s.surfaced}`,
  );
if (versions.includes(WEEK_TWO_EDITION)) {
  console.log('week two: edition policy prompts pullWon kept missed morningsAlone flags(value:count)');
  for (const s of summaries) {
    const w = s.weekTwo;
    if (!w) continue;
    console.log(
      `${s.version} ${s.policy.padEnd(7)} ${w.prompts.toFixed(1)} ${w.pullWonPrompts.toFixed(1)} ${w.kept.toFixed(1)} ${w.missed.toFixed(1)} ${w.morningsAlone.toFixed(1)} ${JSON.stringify(w.flags)}`,
    );
  }
}
if (process.argv.includes('rows')) for (const r of rows) console.log(JSON.stringify(r));
const jsonPath = process.argv.find((a) => a.startsWith('json='))?.slice(5);
if (jsonPath)
  writeFileSync(jsonPath, `${JSON.stringify({ definitions, seeds, summaries, rows }, null, 2)}\n`);
