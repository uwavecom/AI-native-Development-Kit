import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyRequiredGithubChecks as verify } from '../examples/required-github-checks.mjs';

const sha = 'a'.repeat(40);
const pr = { state: 'open', base: { ref: 'main' }, head: { sha, repo: { full_name: 'org/repo' } } };
const check = (name, overrides = {}) => ({
  id: name === 'verify' ? 1 : 2, name, status: 'completed', conclusion: 'success',
  app: { slug: 'github-actions' }, check_suite: { head_sha: sha },
  html_url: 'https://github.com/org/repo/actions/runs/12/job/22',
  ...overrides,
});
const request = (runs, options = {}) => {
  let prReads = 0;
  return async url => ({
    ok: true,
    json: async () => url.includes('/pulls/')
      ? (++prReads === 2 && options.stale ? { ...pr, head: { ...pr.head, sha: 'b'.repeat(40) } } : pr)
      : { total_count: runs.length, check_runs: runs },
  });
};
const call = (checks, fetchImpl) => verify({
  owner: 'org', repo: 'repo', prNumber: 7, requiredChecks: checks, fetchImpl,
});
test('all named successful checks on the exact head SHA are required', async () => {
  const result = await call(['verify', 'security'], request([check('verify'), check('security')]));
  assert.equal(result.verified, true);
  assert.deepEqual(result.requiredChecks, ['verify', 'security']);
});
test('missing, failed, pending and foreign-SHA checks fail closed', async () => {
  for (const runs of [
    [check('verify')],
    [check('verify'), check('security', { conclusion: 'failure' })],
    [check('verify'), check('security', { status: 'queued', conclusion: null })],
    [check('verify'), check('security', { check_suite: { head_sha: 'b'.repeat(40) } })],
    [check('verify'), check('security', { app: { slug: 'external-app' } })],
    [check('verify'), check('security'), check('security', { id: 3 })],
  ]) {
    assert.equal((await call(['verify', 'security'], request(runs))).verified, false);
  }
});
test('PR head changes invalidate evidence', async () => {
  assert.deepEqual((await call(['verify'], request([check('verify')], { stale: true }))).missingOrFailed, ['STALE_HEAD']);
});
test('empty required-check policy is rejected', async () => {
  await assert.rejects(call([], request([])), /mandatory/);
});
