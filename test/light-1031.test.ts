/** One fixed Monday of real holds: wording for failed and costly holds. Headless; no browser, no player verdict. */

import { replay as nativeReplay } from '@adam0white/human-framework';
import { canonicalPersona } from '@adam0white/lab-client';
import { describe, expect, it } from 'vitest';
import {
  cardView,
  cloneState,
  fingerprint,
  HOLD_NOT_CARRIED,
  insistCarries,
  newGame,
  queueInput,
  runToCard,
} from '../src/sim/game.ts';
import { validateCanonicalRun } from '../src/ui/cast-chapter.ts';
import { momentRecords } from '../src/ui/journal.ts';
import { compactNotebook, expandNotebook } from '../src/ui/notebook.ts';
import { replyWords } from '../src/ui/reply.ts';

function holdMonday() {
  const s = newGame(3, '0.10.0');
  const ties: string[] = [];
  for (let i = 0; i < 12 && s.phase === 'day'; i++) {
    runToCard(s);
    const view = s.card ? cardView(s) : null;
    if (!s.card || !view) break;
    const rank = ['no', 'rather not', 'later', 'if pushed', 'yes'];
    const sore = view.options.some((o) => rank.indexOf(o.pushed) < rank.indexOf(o.lean));
    if (!insistCarries(s) && !sore) ties.push(view.id);
    const pick = view.options.find((o) => !o.isPull) ?? view.options[0];
    if (!pick) break;
    queueInput(s, { kind: 'say', option: pick.id, insist: true });
  }
  return { s, ties };
}

describe('held choices on one fixed Monday', () => {
  const { s, ties } = holdMonday();
  const records = momentRecords(s);

  it('keeps the stored refusal exactly, so exports and fingerprints do not change', () => {
    const stored = records.filter((r) => r.answer.says === HOLD_NOT_CARRIED);
    expect(HOLD_NOT_CARRIED).toBe('You keep pushing me. I’m not listening to that today.');
    expect(stored.length).toBeGreaterThanOrEqual(3);
  });

  it('shows each failed hold in different words that count the real holds and keep the refusal', () => {
    const replies = records
      .filter((r) => r.answer.says === HOLD_NOT_CARRIED)
      .map((r) => replyWords(s, r.answer));
    expect(new Set(replies).size).toBe(replies.length);
    for (const reply of replies) {
      expect(reply).toMatch(/not listening/);
      expect(reply).toMatch(/pushed me (?:once|twice|\w+ times) today/);
    }
  });

  it('says out loud that a hold she gave in to was done under protest', () => {
    const complied = records.filter(
      (r) => r.answer.verdict === 'complied' && r.answer.said === r.answer.chosen,
    );
    expect(complied.length).toBeGreaterThan(0);
    for (const r of complied) expect(replyWords(s, r.answer)).toMatch(/because you pushed me/);
  });

  it('has cards where a hold does not carry but no option ranks worse, which the old note missed', () => {
    expect(ties.length).toBeGreaterThan(0);
  });

  // The raw minute-only replay cannot reach the zero-minute evening phase, so this uses the canonical validator.
  it('keeps an evening notebook exact through the real validator and the real next alarm input', async () => {
    expect(s.phase).toBe('evening');
    const exported = JSON.parse(
      JSON.stringify({
        game: 'murmur',
        version: s.version,
        seed: s.seed,
        inputs: s.inputs,
        state: cloneState(s),
      }),
    );
    const packed = await compactNotebook(exported);
    const expanded = await expandNotebook(JSON.parse(JSON.stringify(packed)));
    expect(canonicalPersona(expanded)).toBe(canonicalPersona(exported));
    const rebuilt = await validateCanonicalRun(expanded.state);
    expect(fingerprint(rebuilt)).toBe(fingerprint(s));
    for (const game of [s, rebuilt]) {
      queueInput(game, { kind: 'next' });
      runToCard(game);
    }
    const next = cardView(s);
    expect(next?.id).toBe('alarm-2');
    expect(cardView(rebuilt)?.id).toBe('alarm-2');
    const option = next?.options.find((o) => !o.isPull) ?? next?.options[0];
    const input = { kind: 'say' as const, option: option?.id ?? '', insist: true };
    queueInput(s, input);
    queueInput(rebuilt, input);
    expect(fingerprint(rebuilt)).toBe(fingerprint(s));
    const native = nativeReplay(cloneState(rebuilt).hf.run);
    expect(native.ok && native.value.verified).toBe(true);
  });

  it('words a failed hold by the recorded verdict, never by ink', () => {
    const verdicts = new Set(
      records.filter((r) => r.insisted && r.said?.id !== r.chosen.id).map((r) => r.answer.verdict),
    );
    expect(verdicts.has('modified') && verdicts.has('deferred')).toBe(true);
    expect(verdicts.has('refused')).toBe(false);
  });
});
