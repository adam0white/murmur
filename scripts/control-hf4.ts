/** Actual current game, complete cold JSON restore and deterministic host replay. */
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { exportRun } from '@adam0white/human-framework';
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
import { readDilanEvents } from '../src/sim/hf4-read.ts';
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
await writeFile(process.env.MURMUR_CONTROL_NOTEBOOK ?? `/tmp/murmur-${edition}-full.json`, json);
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
const beforeRead = JSON.stringify(exportRun(cold.hf.run));
const events = readDilanEvents(cold.hf.run);
const reviewDays = [...new Set(events.flatMap((e) => (e.data.kind === 'review' ? [e.data.record.day] : [])))];
const advice = events.filter((e) => e.data.kind === 'suggestion-resolved');
const voices = [
  ...new Set(
    advice.flatMap((e) => (e.data.kind === 'suggestion-resolved' ? [e.data.resolution.voiceId] : [])),
  ),
];
const verdicts = Object.fromEntries(
  [
    ...new Set(
      advice.flatMap((e) => (e.data.kind === 'suggestion-resolved' ? [e.data.resolution.verdict] : [])),
    ),
  ].map((verdict) => [
    verdict,
    advice.filter((e) => e.data.kind === 'suggestion-resolved' && e.data.resolution.verdict === verdict)
      .length,
  ]),
);
const narration = events.flatMap((e) => e.narration.map((line) => line.text));
if (JSON.stringify(exportRun(cold.hf.run)) !== beforeRead)
  throw new Error('Narration inspection changed the run');
if (reviewDays.length < 7) throw new Error(`Only ${reviewDays.length} reflection days`);
if (!voices.includes('you') || !voices.includes('pull')) throw new Error('Both voices were not exercised');
if (narration.some((line) => /I assented the advice|I (?:got uped|coffee|shelf)\./.test(line)))
  throw new Error('Raw narration escaped');
const narrationReceipt = {
  reviewDays,
  voices,
  verdicts,
  readUnchanged: true,
  examples: [...new Set(advice.flatMap((e) => e.narration.map((line) => line.text)))].slice(0, 12),
};
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
    narration: narrationReceipt,
  }),
);
