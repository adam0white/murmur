/** Deploy only a clean, signed origin/main whose exact push workflow passed. */
import { execFileSync } from 'node:child_process';
import { type CheckRun, trustedCi, type WorkflowRun } from './deploy-guard.ts';

const run = (command: string, args: string[], quiet = false) =>
  execFileSync(command, args, {
    encoding: 'utf8',
    stdio: quiet ? ['ignore', 'pipe', 'inherit'] : 'inherit',
  }) ?? '';
const git = (...args: string[]) => run('git', args, true).trim();
if (git('status', '--porcelain')) throw Error('Deployment requires a clean checkout.');
const head = git('rev-parse', 'HEAD');
git('verify-commit', head);
git('fetch', 'origin', 'main');
if (head !== git('rev-parse', 'origin/main')) throw Error('Deployment requires exact current origin/main.');
const runs = JSON.parse(
  run('gh', ['api', `repos/adam0white/murmur/actions/runs?head_sha=${head}&per_page=100`], true),
).workflow_runs as WorkflowRun[];
const checks = JSON.parse(
  run('gh', ['api', `repos/adam0white/murmur/commits/${head}/check-runs?filter=all&per_page=100`], true),
).check_runs as CheckRun[];
console.log(`Verified CI run ${trustedCi(head, runs, checks)} for ${head}.`);
run('pnpm', ['run', 'build']);
if (git('status', '--porcelain')) throw Error('Build changed tracked source.');
git('fetch', 'origin', 'main');
if (head !== git('rev-parse', 'origin/main')) throw Error('Origin advanced during build.');
run('pnpm', ['exec', 'wrangler', 'deploy']);
