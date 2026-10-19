// Headless measure: policy bots x seeds -> who won the moments, what she kept, how the two voices' trust moved.
// Run: npm run measure [-- seeds=6] [p=silent,oppose]
import { cardView, newGame, optionsOf, queueInput, runToCard, step, trustOf } from '../src/sim/game.ts';
import { momentById } from '../src/sim/moments.ts';
import type { GameState } from '../src/sim/types.ts';

type Policy = 'silent' | 'oppose' | 'insist' | 'pull' | 'reader' | 'picky' | 'teach';

/** What each bot says at a card, or null for silence. */
function choose(s: GameState, policy: Policy): { option: string; insist?: boolean } | null {
  const v = cardView(s);
  if (!v || policy === 'silent') return null;
  const not = v.options.filter((o) => !o.isPull);
  if (policy === 'pull') return { option: v.pullTo };
  const first = not[0];
  if (!first) return null;
  if (policy === 'oppose') return { option: first.id };
  if (policy === 'teach') return s.day <= 3 ? { option: first.id } : null;
  if (policy === 'insist') return { option: first.id, insist: true };
  // reader: says the best non-pull option she leans to; insists only where she would go along if pushed.
  const yes = not.find((o) => o.lean === 'yes') ?? not.find((o) => o.lean === 'later');
  if (yes) return { option: yes.id };
  if (policy === 'reader') {
    const pushed = not.find((o) => o.pushed === 'if pushed' || o.pushed === 'yes');
    return pushed ? { option: pushed.id, insist: true } : null;
  }
  // picky: speaks only on cards with a tempting option, silent elsewhere.
  const opts = optionsOf(s, momentById(v.id));
  return opts.some((o) => o.tags?.includes('temptation')) ? { option: first.id } : null;
}

function run(seed: number, policy: Policy) {
  const s = newGame(seed);
  let tempting = 0;
  let pullWonTempting = 0;
  let cards = 0;
  let borrowed = 0;
  const t0 = performance.now();
  for (let guard = 0; s.phase !== 'end' && guard < 2000; guard++) {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    const v = cardView(s);
    if (!v) continue;
    cards += 1;
    if (v.borrowed) borrowed += 1;
    const said = choose(s, policy);
    if (said) queueInput(s, { kind: 'say', ...said });
    else while (s.card) step(s);
    const a = s.answer;
    const tempt = (s.person.promptings?.recent ?? []).some((r) => r.at === a?.at);
    if (tempt) {
      tempting += 1;
      if (a?.pullWon) pullWonTempting += 1;
    }
  }
  const pages = s.pages;
  return {
    seed,
    policy,
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
  };
}

const seeds = Number(process.argv.find((a) => a.startsWith('seeds='))?.slice(6) ?? 4);
const policies = (process.argv
  .find((a) => a.startsWith('p='))
  ?.slice(2)
  .split(',') ?? ['silent', 'oppose', 'insist', 'pull', 'reader', 'picky', 'teach']) as Policy[];
for (const policy of policies) {
  const rows = Array.from({ length: seeds }, (_, i) => run(1000 + i, policy));
  const avg = (k: keyof (typeof rows)[number]) =>
    (rows.reduce((n, r) => n + Number(r[k]), 0) / rows.length).toFixed(1);
  console.log(
    `${policy.padEnd(7)} prompts ${avg('prompts')} pullWon ${avg('pullWonPrompts')} kept ${avg('kept')} missed ${avg('missed')} calls ${avg('calls')} wrote ${avg('wrote')} shelf ${avg('shelf')} borrowed ${avg('borrowed')} alone ${avg('alone')} you ${avg('you')} pull ${avg('pull')} ms ${avg('ms')}`,
  );
  if (process.argv.includes('rows')) for (const r of rows) console.log('  ', JSON.stringify(r));
}
