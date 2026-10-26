/** Offline ordinary file producer after signed clean delivery. It preserves the actual92cdebd source
 * notebook verbatim and stamps only the new projection producer. No publication, owner storage or shelf claim.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { canonicalCast, canonicalPersona, createPersona, validatePersona } from '@adam0white/lab-client';
import { castDigest, createCastHistorySource, createCastSource } from '../src/sim/cast-source.ts';
import { cloneState, replay, step } from '../src/sim/game.ts';

const [input, output] = process.argv.slice(2);
if (!input || !output)
  throw Error('Usage: node scripts/export-history.ts <actual-source-archive.json> <output.json>');
const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw Error('Export requires a clean source tree.');
if (
  !execFileSync('git', ['show', 'HEAD:scripts/export-history.ts']).equals(
    readFileSync(new URL(import.meta.url)),
  )
)
  throw Error('The signed producer commit must contain this exact exporter.');
const build = git('rev-parse', 'HEAD');
if (git('log', '-1', '--format=%G?') !== 'G') throw Error('Export requires the signed producer commit.');
const source = JSON.parse(readFileSync(input, 'utf8'));
if (
  source.sourceBuildBasis !== '92cdebd9fe73d59ccf40c7bdcbd66e8ed310b27e' &&
  source.envelope?.source?.build !== '92cdebd9fe73'
)
  throw Error('This control requires the actual signed92cdebd source archive.');
const n = source.notebook;
const rebuilt = replay(
  n.seed,
  n.inputs,
  n.minute,
  n.version,
  n.castChapter,
  n.person.lexicon?.plainEnglish ?? false,
);
if (rebuilt.phase === 'day' && n.phase !== 'day') step(rebuilt);
if (canonicalPersona(cloneState(rebuilt)) !== canonicalPersona(n))
  throw Error('Original source notebook differs from replay.');
if (
  (await castDigest(source.native.raw)) !== 'f86d09bd4f0e0e9a04074273e9039876ebb046d0e00ba190373491ed4ffe8d18'
)
  throw Error('Original raw source differs.');
const native = await createCastHistorySource(rebuilt);
if (canonicalPersona(native.raw) !== canonicalPersona(source.native.raw))
  throw Error('Raw source differs from the notebook.');
const old = await validatePersona(source.envelope);
if (
  old.castId !== 'hf.cast.aylin.murmur' ||
  old.castRevision !== canonicalCast(old.castId).revision ||
  old.source.game !== 'murmur' ||
  old.source.build !== '92cdebd9fe73' ||
  old.source.engine !== '2.23.0' ||
  old.source.rules !== '0.6.0'
)
  throw Error('Original source identity or edition differs.');
const original = await createCastSource(rebuilt, 'aylin');
for (const key of ['castPassport', 'sourceRole', 'person', 'checkpoint'] as const)
  if (canonicalPersona(old.transfer[key]) !== canonicalPersona(original.transfer[key]))
    throw Error('Original envelope does not match its replayed source.');
const producer = { game: 'murmur', build, engine: '2.23.0', rules: '0.6.0' };
const envelope = await createPersona({
  format: 'hf-persona/1',
  castId: old.castId,
  castRevision: old.castRevision,
  branchId: old.branchId,
  parentRevision: old.revision,
  source: producer,
  transfer: {
    ...native.transfer,
    life: old.transfer.life,
    provenance: { originalSource: old.source, originalRevision: old.revision },
  },
  limitations: native.limitations,
});
writeFileSync(
  output,
  JSON.stringify(
    {
      format: 'murmur-history-archive/1',
      sourceBuildBasis: source.sourceBuildBasis,
      originalEnvelope: old,
      notebook: n,
      native,
      envelope,
      producer,
      ownership: 'ordinary file; no shelf claim or upload',
    },
    null,
    2,
  ) + '\n',
);
writeFileSync(`${output}.passport.json`, JSON.stringify(envelope, null, 2) + '\n');
console.log(
  `Wrote complete source archive with${native.transfer.selection.ids.length} mapped episodes;${native.transfer.selection.omittedEpisodeIds.length} archived omissions.`,
);
