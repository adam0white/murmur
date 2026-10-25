export interface WorkflowRun {
  id: number;
  name: string;
  path: string;
  head_sha: string;
  head_branch: string;
  event: string;
  status: string;
  conclusion: string;
  check_suite_id: number;
}
export interface CheckRun {
  id: number;
  name: string;
  head_sha: string;
  status: string;
  conclusion: string;
  check_suite?: { id: number };
}
/** Trust only the latest push workflow and its matching latest ci job for this exact source. */
export function trustedCi(head: string, runs: WorkflowRun[], checks: CheckRun[]): number {
  const ci = runs
    .filter(
      (r) =>
        r.name === 'CI' &&
        r.path === '.github/workflows/ci.yml' &&
        r.head_sha === head &&
        r.head_branch === 'main' &&
        r.event === 'push',
    )
    .sort((a, b) => b.id - a.id)[0];
  if (ci?.status !== 'completed' || ci.conclusion !== 'success' || !Number.isSafeInteger(ci.check_suite_id))
    throw Error('Exact main push CI must succeed before deployment.');
  const check = checks
    .filter((c) => c.name === 'ci' && c.head_sha === head && c.check_suite?.id === ci.check_suite_id)
    .sort((a, b) => b.id - a.id)[0];
  if (check?.status !== 'completed' || check.conclusion !== 'success')
    throw Error('The matching CI check suite must succeed.');
  return ci.id;
}
