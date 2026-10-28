import { expect, it } from 'vitest';
import * as old from '../src/legacy/game.ts';
import * as game from '../src/sim/game.ts';

it('dispatches historical starts and complete snapshots to the pinned legacy engine', () => {
  const a = game.newGame(17, '0.6.1');
  const b = old.newGame(17, '0.6.1');
  expect(game.cloneState(a)).toEqual(old.cloneState(b));
  game.runToCard(a);
  old.runToCard(b);
  expect(game.cloneState(a)).toEqual(old.cloneState(b));
  expect(game.cloneState(game.restoreState(JSON.parse(JSON.stringify(game.cloneState(a)))))).toEqual(
    old.cloneState(b),
  );
});

it('starts the new HF4 edition', () => {
  const state = game.newGame(17);
  expect(state.version).toBe('0.9.0');
  expect(state.hf.run).toBeDefined();
});

it('plays the first card through the new game host', () => {
  const state = game.newGame(17);
  game.runToCard(state);
  const card = game.cardView(state);
  expect(card).not.toBeNull();
  const option = card?.options[0];
  if (!option) throw new Error('Missing opening option');
  game.queueInput(state, { kind: 'say', option: option.id });
  game.runToCard(state);
  expect(state.inputs.length).toBeGreaterThan(0);
});

it('renders the new edition journal after an actual choice', async () => {
  const { momentRecords } = await import('../src/ui/journal.ts');
  const { replyWords } = await import('../src/ui/reply.ts');
  const state = game.newGame(17);
  game.runToCard(state);
  const option = game.cardView(state)?.options[0];
  if (!option) throw new Error('Missing opening option');
  game.queueInput(state, { kind: 'say', option: option.id });
  expect(momentRecords(state).length).toBe(1);
  if (state.answer) expect(typeof replyWords(state, state.answer)).toBe('string');
});

it('previews the offered choice through HF without changing any full state value', () => {
  const state = game.newGame(17);
  game.runToCard(state);
  const before = game.fingerprint(state);
  const view = game.cardView(state)!;
  expect(view.options.every((o) => o.lean !== 'unknown' && o.pushed !== 'unknown')).toBe(true);
  expect(game.fingerprint(state)).toBe(before);
});

it('previews low-trust insistence with the same suggestion that holding submits', () => {
  const state = game.newGame(17);
  for (let card = 0; card < 4; card++) {
    game.runToCard(state);
    const view = game.cardView(state)!;
    const option = view.options.find((choice) => !choice.isPull) ?? view.options[0]!;
    game.queueInput(state, { kind: 'say', option: option.id, insist: true });
  }
  game.runToCard(state);
  expect(game.insistCarries(state)).toBe(false);
  const before = game.fingerprint(state);
  const view = game.cardView(state)!;
  const readings = {
    assented: 'yes',
    complied: 'if pushed',
    deferred: 'later',
    modified: 'rather not',
    refused: 'no',
    commanded: 'no',
  };
  for (const option of view.options) {
    const held = game.restoreState(game.cloneState(state));
    game.queueInput(held, { kind: 'say', option: option.id, insist: true });
    expect(option.pushed).toBe(readings[held.answer!.verdict!]);
  }
  expect(game.fingerprint(state)).toBe(before);
});
