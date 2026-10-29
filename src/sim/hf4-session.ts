/** Cold checkpoints keep HF's complete archive and validate Murmur's own world data. */
import {
  type DeepReadonly,
  exportRun,
  type Run,
  type RunArchive,
  readRunHistory,
  replay,
  restoreRun,
} from '@adam0white/human-framework';
import { decodeMurmurWorld } from './hf4-world.ts';

export interface MurmurSession<H> {
  run: Run;
  host: H;
}

/** `decodeHost` must validate the edition-specific data written in world.hostState. */
export function restoreSession<H>(
  archive: unknown,
  decodeHost: (archive: DeepReadonly<RunArchive>) => H,
): MurmurSession<H> {
  const restored = restoreRun(archive);
  if (!restored.ok)
    throw new Error(`Cannot restore this notebook: ${restored.error.code} ${restored.error.message}`);
  const canonical = exportRun(restored.value);
  return { run: restored.value, host: decodeHost(canonical) };
}

/** Replay validates the recorded HF input batches; the game also replays its own choices. */
export function checkpointSession(run: Run): DeepReadonly<RunArchive> {
  return exportRun(run);
}

export function verifySessionReplay(archive: DeepReadonly<RunArchive>): boolean {
  const verified = replay(archive);
  return verified.ok && verified.value.verified && verified.value.fullHash === archive.hashes.full;
}

/** Persist the host's ingress counters beside the complete framework archive. */
export interface MurmurSessionArchive {
  format: 'murmur-hf4-session/1';
  run: DeepReadonly<RunArchive>;
  offerRevision: number;
  nextCommand: number;
  nextCompanionEvent: number;
  companionRevisions: Record<string, number>;
}
export function checkpointMurmur(game: import('./hf4-game.ts').MurmurHf4): MurmurSessionArchive {
  return {
    format: 'murmur-hf4-session/1',
    run: exportRun(game.run),
    offerRevision: game.offerRevision,
    nextCommand: game.nextCommand,
    nextCompanionEvent: game.nextCompanionEvent,
    companionRevisions: { ...game.companionRevisions },
  };
}
export function restoreMurmur(input: unknown): import('./hf4-game.ts').MurmurHf4 {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid Murmur session');
  const x = input as Record<string, unknown>;
  if (
    Object.keys(x).sort().join(',') !==
      'companionRevisions,format,nextCommand,nextCompanionEvent,offerRevision,run' ||
    x.format !== 'murmur-hf4-session/1' ||
    !Number.isSafeInteger(x.offerRevision) ||
    (x.offerRevision as number) < 0 ||
    !Number.isSafeInteger(x.nextCommand) ||
    (x.nextCommand as number) < 0 ||
    !Number.isSafeInteger(x.nextCompanionEvent) ||
    (x.nextCompanionEvent as number) < 0 ||
    (x.nextCompanionEvent as number) > 20 * 48 * 2
  )
    throw new Error('Unsupported Murmur session');
  const revisions = x.companionRevisions as Record<string, number> | undefined;
  if (
    !revisions ||
    Object.keys(revisions).sort().join(',') !== 'aylin,ece,murat' ||
    Object.values(revisions).some((n) => !Number.isSafeInteger(n) || n < 0)
  )
    throw new Error('Invalid companion offer counters');
  const session = restoreSession(x.run, decodeMurmurWorld);
  const archive = exportRun(session.run);
  for (const role of ['aylin', 'ece', 'murat'])
    if ((archive.current.offers[role]?.revision ?? 0) !== revisions[role])
      throw new Error('Companion revision differs from run');
  const currentRevision = archive.current.offers.dilan?.revision ?? 0;
  if (currentRevision !== x.offerRevision) throw new Error('Murmur offer revision disagrees with its run');
  const history = readRunHistory(archive);
  const commands = history
    .flatMap((transaction) => transaction.inputs)
    .map((entry) => /^murmur:agenda:(\d+)$/.exec(entry.id))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => Number(match[1]));
  if (commands.length !== x.nextCommand || commands.some((n, index) => n !== index))
    throw new Error('Murmur command sequence disagrees with its run');
  const snapshots = history
    .flatMap((transaction) => transaction.inputs)
    .filter((entry) => /^companion:(aylin|ece|murat):snapshot:\d+$/.test(entry.id));
  if (snapshots.length !== (x.nextCompanionEvent as number) * 3)
    throw new Error('Murmur companion sequence disagrees with its run');
  const ids = new Set(snapshots.map((entry) => entry.id));
  for (let i = 0; i < (x.nextCompanionEvent as number); i++)
    for (const person of ['aylin', 'ece', 'murat'])
      if (!ids.has(`companion:${person}:snapshot:${i}`))
        throw new Error('Murmur companion sequence has a gap');
  return {
    ...session,
    offerRevision: x.offerRevision as number,
    nextCommand: x.nextCommand as number,
    nextCompanionEvent: x.nextCompanionEvent as number,
    companionRevisions: { ...revisions },
  };
}
