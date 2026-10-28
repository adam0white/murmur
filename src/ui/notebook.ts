/** Lossless notebook transport. Gzip carries the entire JSON including Person/RNG, histories and pinned
 * source notebooks; it does not prune or derive semantic data. The declared decode bound is64MiB.
 * Semantic replay/admission stays with validateRun; this codec grants no branch ownership.
 */
import { clock, DAY_NAMES, isEdition } from '../sim/game.ts';
import type { GameState, GameStateSnapshot } from '../sim/types.ts';
export interface Notebook {
  state: GameStateSnapshot;
  [key: string]: unknown;
}
export interface CompactNotebook {
  format: 'murmur-notebook/1';
  encoding: 'gzip-base64';
  bytes: number;
  sha256: string;
  data: string;
}
const MAX_BYTES = 64 * 1024 * 1024;
const digest = async (bytes: Uint8Array<ArrayBuffer>) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
export function assertNotebookState(s: GameStateSnapshot): void {
  if (
    !s ||
    !isEdition(s.version) ||
    !Number.isSafeInteger(s.seed) ||
    !Number.isSafeInteger(s.minute) ||
    !Array.isArray(s.inputs) ||
    !['day', 'evening', 'end'].includes(s.phase)
  )
    throw Error('Unknown or malformed notebook state.');
  let previous = -Infinity;
  for (const input of s.inputs) {
    if (
      !input ||
      !Number.isSafeInteger(input.at) ||
      input.at < previous ||
      input.at > s.minute ||
      !['say', 'quiet', 'next', 'one-cast-release', 'cast-pause'].includes(input.kind)
    )
      throw Error('Malformed notebook input.');
    if (
      input.kind === 'say' &&
      (typeof input.option !== 'string' ||
        !input.option ||
        (input.insist !== undefined && typeof input.insist !== 'boolean'))
    )
      throw Error('Malformed suggestion.');
    if (input.kind === 'cast-pause' && !['dilan', 'aylin', 'ece', 'murat'].includes(input.role))
      throw Error('Malformed person pause.');
    previous = input.at;
  }
}
function notebook(value: unknown): Notebook {
  if (!value || typeof value !== 'object') throw Error('Not a notebook.');
  const n = value as Notebook,
    s = n.state;
  assertNotebookState(s);
  if (n.game !== undefined && n.game !== 'murmur') throw Error('This is another game’s notebook.');
  if (
    (n.version !== undefined && n.version !== s.version) ||
    (n.seed !== undefined && n.seed !== s.seed) ||
    (n.inputs !== undefined && JSON.stringify(n.inputs) !== JSON.stringify(s.inputs))
  )
    throw Error('Conflicting notebook header.');
  return n;
}
export async function compactNotebook(value: unknown): Promise<CompactNotebook> {
  notebook(value);
  const raw = new TextEncoder().encode(JSON.stringify(value));
  if (raw.byteLength > MAX_BYTES)
    throw Error('The complete notebook exceeds the64MiB transport limit. Download the full run instead.');
  const packed = new Uint8Array(
    await new Response(new Response(raw).body!.pipeThrough(new CompressionStream('gzip'))).arrayBuffer(),
  );
  let binary = '';
  for (let i = 0; i < packed.length; i += 8192)
    binary += String.fromCharCode(...packed.subarray(i, i + 8192));
  return {
    format: 'murmur-notebook/1',
    encoding: 'gzip-base64',
    bytes: raw.length,
    sha256: await digest(raw),
    data: btoa(binary),
  };
}
export async function expandNotebook(value: unknown): Promise<Notebook> {
  if (!value || typeof value !== 'object') throw Error('Not a notebook.');
  if (!('format' in value)) return notebook(value);
  const x = value as CompactNotebook;
  if (x.format !== 'murmur-notebook/1' || x.encoding !== 'gzip-base64')
    throw Error('Unsupported notebook format.');
  if (
    !Number.isSafeInteger(x.bytes) ||
    x.bytes < 1 ||
    x.bytes > MAX_BYTES ||
    typeof x.data !== 'string' ||
    x.data.length > MAX_BYTES * 2 ||
    !/^[a-f0-9]{64}$/.test(x.sha256)
  )
    throw Error('Malformed compact notebook.');
  const bytes = Uint8Array.from(atob(x.data), (c) => c.charCodeAt(0));
  const reader = new Response(bytes).body!.pipeThrough(new DecompressionStream('gzip')).getReader();
  const chunks: Uint8Array[] = [];
  let count = 0;
  for (;;) {
    const { done, value: chunk } = await reader.read();
    if (done) break;
    count += chunk.byteLength;
    if (count > x.bytes) {
      await reader.cancel();
      throw Error('Notebook size exceeds declared bound.');
    }
    chunks.push(chunk);
  }
  const raw = new Uint8Array(count);
  let pos = 0;
  for (const chunk of chunks) {
    raw.set(chunk, pos);
    pos += chunk.length;
  }
  if (count !== x.bytes || (await digest(raw)) !== x.sha256)
    throw Error('Notebook checksum or size differs.');
  return notebook(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)));
}
export function savedLocation(s: Pick<GameState, 'day' | 'minute' | 'phase' | 'card'>): string {
  const at = `Saved on ${DAY_NAMES[s.day] ?? 'an unknown day'} at ${clock(s.minute)}`;
  return `${at}${s.phase === 'day' ? (s.card ? ', with her choice still waiting.' : ', between choices.') : s.phase === 'evening' ? ', on her evening page.' : ', at the end of the week.'}`;
}
