// Coordinator policies: random choices (15% quiet, 30% insist), and measure.ts edge.
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { tick } from '@adam0white/human-framework';
import { anotherWeek, cardView, cloneState, newGame, queueInput, runToCard, step } from '../src/sim/game.ts';
import type { GameState } from '../src/sim/types.ts';
import { choose } from './measure.ts';
export function playWeek(s: GameState, policy: 'careless' | 'careful') {
  let random = s.seed >>> 0;
  const rnd = () => {
    random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
    return random / 4294967296;
  };
  for (let g = 0; g < 2000 && s.phase !== 'end'; g++) {
    if (s.phase === 'evening') {
      queueInput(s, { kind: 'next' });
      continue;
    }
    runToCard(s);
    const v = cardView(s);
    if (!v) continue;
    if (policy === 'careless') {
      if (rnd() < 0.15) queueInput(s, { kind: 'quiet' });
      else {
        const option = v.options[Math.floor(rnd() * v.options.length)];
        if (!option) throw Error('No careless option');
        queueInput(s, {
          kind: 'say',
          option: option.id,
          insist: rnd() < 0.3,
        });
      }
    } else {
      const decision = cloneState(s);
      if (decision.person.now < decision.minute) tick(decision.person, decision.minute);
      const said = choose(decision, 'edge');
      if (said) queueInput(s, { kind: 'say', ...said });
      else while (s.card) step(s);
    }
  }
  if (s.phase !== 'end') throw Error('Incomplete week');
  return s;
}
export const hash = (s: GameState) =>
  createHash('sha256')
    .update(JSON.stringify(cloneState(s)))
    .digest('hex');
if (process.argv[1]?.endsWith('measure-promises.ts')) {
  const versions = (process.argv[2] ?? '0.6.0').split(',');
  const rows: {
    version: string;
    policy: string;
    seed: number;
    firstHash: string;
    finalHash: string;
    weeks: {
      week: number;
      kept: number;
      missed: number;
      labels: { day: number; kept: string[]; missed: string[] }[];
    }[];
  }[] = [];
  for (const version of versions)
    for (const policy of ['careless', 'careful'] as const)
      for (let seed = 2000; seed < 2020; seed++) {
        const s = playWeek(newGame(seed, version), policy);
        const firstHash = hash({ ...s, version: '0.6.0' });
        anotherWeek(s);
        playWeek(s, policy);
        rows.push({
          version,
          policy,
          seed,
          firstHash,
          finalHash: hash(s),
          weeks: [1, 2].map((week) => {
            const pages = s.pages.filter((p) => Math.floor((p.day - 1) / 7) + 1 === week);
            return {
              week,
              kept: pages.reduce((n, p) => n + p.kept.length, 0),
              missed: pages.reduce((n, p) => n + p.missed.length, 0),
              labels: pages.map((p) => ({ day: p.day, kept: p.kept, missed: p.missed })),
            };
          }),
        });
      }
  const summaries = versions.flatMap((version) =>
    ['careless', 'careful'].flatMap((policy) =>
      [1, 2].map((week) => {
        const rs = rows
          .filter((r) => r.version === version && r.policy === policy)
          .map((r) => {
            const data = r.weeks[week - 1];
            if (!data) throw Error('Missing week');
            return data;
          });
        const kept = rs.reduce((n, r) => n + r.kept, 0),
          missed = rs.reduce((n, r) => n + r.missed, 0);
        return {
          version,
          policy,
          week,
          seeds: rs.length,
          kept,
          missed,
          missedPercent: (100 * missed) / (kept + missed),
          slipped: rs.filter((r) => r.missed / (r.kept + r.missed) >= 0.45).length,
          missedRange: [Math.min(...rs.map((r) => r.missed)), Math.max(...rs.map((r) => r.missed))],
        };
      }),
    ),
  );
  if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify({ summaries, rows }, null, 2) + '\n');
  console.log(JSON.stringify(summaries, null, 2));
}
