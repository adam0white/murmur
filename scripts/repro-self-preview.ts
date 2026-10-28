/** Public API repro: a reached-until run has no usable host hypothetical lane for self preview. */
import { preview } from '@adam0white/human-framework';
import { newGame, openMoment, optionsOf, runToCard } from '../src/sim/game.ts';
import { momentInputs } from '../src/sim/hf4-moment.ts';
import { readDilan } from '../src/sim/hf4-read.ts';

const s = newGame(17);
runToCard(s);
const m = openMoment(s)!;
for (const offset of [0, 1]) {
  const at = readDilan(s.hf.run).at + offset;
  const inputs = momentInputs({
    cardId: `preview-repro:${offset}`,
    at,
    revision: s.hf.offerRevision + 1,
    place: m.place,
    options: optionsOf(s, m),
    pull: { option: m.pull.to, strength: 0.7, borrowed: false },
    said: { option: 'up', insist: false },
    fulfills: {},
  })
    .inputs.filter((e) => e.at === at)
    .map((e) => ({ ...e, source: { type: 'host' as const, id: 'murmur' } }));
  const result = preview(s.hf.run, {
    perspective: { kind: 'person', observer: 'dilan' },
    person: 'dilan',
    until: at + 1,
    inputs,
  });
  console.log(JSON.stringify({ offset, result }));
}
