/** Agenda changes are timestamped HF inputs, with a persisted ingress sequence. */
import { exportRun, type Input, inspect, readRunHistory } from '@adam0white/human-framework';
import type { MurmurHf4 } from './hf4-game.ts';
import { advanceHost } from './hf4-host.ts';
import { type MurmurWorld, settleMurmur } from './hf4-world.ts';

function submit(game: MurmurHf4, make: (at: number, id: string) => Input): string {
  const reading = inspect(game.run, {
    perspective: { kind: 'host' },
    people: ['dilan'],
    select: ['summary'],
  });
  if (!reading.ok) throw new Error(`${reading.error.code} ${reading.error.path}: ${reading.error.message}`);
  const at = reading.value.at + 1;
  if (!Number.isSafeInteger(at)) throw new Error('Murmur input clock exhausted');
  const id = `murmur:agenda:${game.nextCommand}`;
  const input = make(at, id);
  try {
    advanceHost(game, at, [input], (host: MurmurWorld, request) => settleMurmur(host, request, []));
  } catch (error) {
    // A reached world boundary can fail after HF has already accepted this command.
    const accepted = readRunHistory(exportRun(game.run)).some((transaction) =>
      transaction.inputs.some((entry) => entry.id === id),
    );
    if (accepted) game.nextCommand++;
    throw error;
  }
  game.nextCommand++;
  return id;
}

/** A promise identity is generated once from the recorded host input sequence. */
export function requestPromise(
  game: MurmurHf4,
  promise: {
    kind: 'promise';
    toId: string;
    label: string;
    actions: string[];
    from: number;
    until: number;
    importance: number;
    recurEvery?: number;
    recurUntil?: number;
  },
): string {
  let commitmentId = '';
  const { recurEvery, recurUntil, ...base } = promise;
  submit(game, (at, id) => {
    commitmentId = `${id}:commitment`;
    return {
      id,
      at,
      source: { type: 'host', id: 'murmur' },
      kind: 'agenda.requested',
      payload: {
        person: 'dilan',
        request: {
          type: 'commit',
          commitment: {
            ...base,
            id: commitmentId,
            ...(recurEvery === undefined ? {} : { recurEveryMs: recurEvery * 60_000 }),
            ...(recurUntil === undefined ? {} : { recurUntil: recurUntil * 60_000 }),
            from: promise.from * 60_000,
            until: promise.until * 60_000,
          },
        },
      },
    };
  });
  return commitmentId;
}
export function releasePromise(game: MurmurHf4, commitmentId: string): void {
  submit(game, (at, id) => ({
    id,
    at,
    source: { type: 'host', id: 'murmur' },
    kind: 'agenda.requested',
    payload: { person: 'dilan', request: { type: 'release', commitmentId, authority: 'dilan' } },
  }));
}

/** A phrase is learned only after the played choice actually completes. */
export function learnResponse(
  game: MurmurHf4,
  response: { id: string; kind: 'refuge' | 'redirect' | 'leave'; cue?: string },
): void {
  submit(game, (at, id) => ({
    id,
    at,
    source: { type: 'host', id: 'murmur' },
    kind: 'prompting.response-learned',
    payload: { person: 'dilan', response: { ...response, practice: 0.1 } },
  }));
}
export function changeReviewStyle(game: MurmurHf4, style: 'accounting' | 'ruminating' | 'none'): void {
  submit(game, (at, id) => ({
    id,
    at,
    source: { type: 'host', id: 'murmur' },
    kind: 'review.style-changed',
    payload: { person: 'dilan', style },
  }));
}
export function requestReview(game: MurmurHf4, reason: string): void {
  submit(game, (at, id) => ({
    id,
    at,
    source: { type: 'host', id: 'murmur' },
    kind: 'review.requested',
    payload: { person: 'dilan', reason },
  }));
}
