import { expect, it } from 'vitest';
import { type CheckRun, trustedCi, type WorkflowRun } from '../scripts/deploy-guard.ts';

const workflow: WorkflowRun = {
  id: 10,
  name: 'CI',
  path: '.github/workflows/ci.yml',
  head_sha: 'source',
  head_branch: 'main',
  event: 'push',
  status: 'completed',
  conclusion: 'success',
  check_suite_id: 20,
};
const check: CheckRun = {
  id: 30,
  name: 'ci',
  head_sha: 'source',
  status: 'completed',
  conclusion: 'success',
  check_suite: { id: 20 },
};
it('accepts the exact push workflow and its matching successful job', () => {
  expect(trustedCi('source', [workflow], [check])).toBe(10);
});
for (const change of [
  { head_sha: 'stale' },
  { head_branch: 'other' },
  { event: 'pull_request' },
  { status: 'in_progress' },
  { conclusion: 'failure' },
  { path: '.github/workflows/other.yml' },
])
  it(`refuses an unsuitable workflow ${JSON.stringify(change)}`, () => {
    expect(() => trustedCi('source', [{ ...workflow, ...change }], [check])).toThrow();
  });
it('refuses a newer failed push rather than trusting an older green run', () => {
  expect(() =>
    trustedCi('source', [workflow, { ...workflow, id: 11, conclusion: 'failure' }], [check]),
  ).toThrow();
});
it('refuses a foreign suite and a newer failed rerun of the matching job', () => {
  expect(() => trustedCi('source', [workflow], [{ ...check, check_suite: { id: 21 } }])).toThrow();
  expect(() =>
    trustedCi('source', [workflow], [check, { ...check, id: 31, conclusion: 'failure' }]),
  ).toThrow();
});
it('refuses missing workflow or job evidence', () => {
  expect(() => trustedCi('source', [], [check])).toThrow();
  expect(() => trustedCi('source', [workflow], [])).toThrow();
});
