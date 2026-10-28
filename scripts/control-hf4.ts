/** Actual current game, complete cold JSON restore and deterministic host replay. */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import {
  anotherWeek,
  canAnotherWeek,
  cardView,
  cloneState,
  fingerprint,
  newGame,
  queueInput,
  replay,
  restoreState,
  runToCard,
  step,
} from '../src/sim/game.ts';
import { verifySessionReplay } from '../src/sim/hf4-session.ts';
import type { GameState } from '../src/sim/types.ts';
export function playCurrent(s: GameState, lastDay: number) {
  let cards = 0;
  let reportedDay = 0;
  for (let n = 0; n < 500; n++) {
    if (s.day !== reportedDay) {
      reportedDay = s.day;
      console.error(
        JSON.stringify({
          stage: 'play',
          clock: new Date().toISOString(),
          day: s.day,
          minute: s.minute,
          cards,
          rss: process.memoryUsage().rss,
        }),
      );
    }
    runToCard(s);
    const card = cardView(s);
    if (card) {
      queueInput(s, { kind: 'say', option: card.options.find((o) => !o.isPull)?.id ?? card.options[0]!.id });
      cards++;
      if (cards % 10 === 0)
        console.error(
          JSON.stringify({
            stage: 'card',
            clock: new Date().toISOString(),
            day: s.day,
            minute: s.minute,
            card: card.id,
            cards,
            rss: process.memoryUsage().rss,
          }),
        );
    } else if (s.phase === 'evening') queueInput(s, { kind: 'next' });
    else if (s.phase === 'end') {
      if (s.day >= lastDay || !canAnotherWeek(s)) break;
      anotherWeek(s);
    } else step(s);
  }
  if (s.phase !== 'end' || s.day !== lastDay) throw new Error(`Unfinished game at ${s.day}/${s.phase}`);
  return cards;
}
const edition = process.argv[2] ?? '0.9.0';
const lastDay = Number(process.argv[3]) || (edition === '0.9.0' ? 13 : 20);
const s = newGame(17, edition);
const cards = playCurrent(s, lastDay);
console.error(
  JSON.stringify({
    stage: 'snapshot',
    clock: new Date().toISOString(),
    day: s.day,
    minute: s.minute,
    cards,
    rss: process.memoryUsage().rss,
  }),
);
const saved = cloneState(s);
const json = JSON.stringify(saved);
await writeFile(`/tmp/murmur-${edition}-full.json`, json);
console.error(
  JSON.stringify({
    stage: 'cold-restore',
    clock: new Date().toISOString(),
    bytes: json.length,
    rss: process.memoryUsage().rss,
  }),
);
let cold: GameState | null = restoreState(JSON.parse(json));
if (fingerprint(cold) !== fingerprint(s)) throw new Error('Cold JSON restore differs');
cold = null;
(globalThis as { gc?: () => void }).gc?.();
console.error(
  JSON.stringify({ stage: 'host-replay', clock: new Date().toISOString(), rss: process.memoryUsage().rss }),
);
let rebuilt: GameState | null = replay(s.seed, s.inputs, s.minute, s.version, s.castChapter, s.plainEnglish);
if (rebuilt.phase === 'day' && s.phase !== 'day') step(rebuilt);
if (fingerprint(rebuilt) !== fingerprint(s)) throw new Error('Complete host replay differs');
rebuilt = null;
(globalThis as { gc?: () => void }).gc?.();
console.error(
  JSON.stringify({ stage: 'hf-replay', clock: new Date().toISOString(), rss: process.memoryUsage().rss }),
);
if (!verifySessionReplay(saved.hf.run)) throw new Error('HF archive replay differs');
console.log(
  JSON.stringify({
    edition,
    engine: saved.hf.run.engine,
    format: saved.hf.run.version,
    rss: process.memoryUsage().rss,
    cards,
    day: s.day,
    phase: s.phase,
    inputs: s.inputs.length,
    bytes: json.length,
    sha256: createHash('sha256').update(json).digest('hex'),
    coldRestore: true,
    hostReplay: true,
    hfReplay: true,
  }),
);
