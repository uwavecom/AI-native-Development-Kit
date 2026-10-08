import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareFactoryReview } from '../examples/factory-e2e-pilot.mjs';

const sha = 'a'.repeat(40);
const pr = { state: 'open', base: { ref: 'main' },
  head: { sha, ref: 'feature/one', repo: { full_name: 'acme/demo' } } };
const suite = 110;
const run = { id: 222, event: 'pull_request', head_sha: sha,
  head_branch: 'feature/one', repository: { full_name: 'acme/demo' },
  check_suite_id: suite, status: 'completed', conclusion: 'success' };
const check = { id: 333, name: 'verify', head_sha: sha,
  app: { slug: 'github-actions' }, check_suite: { id: suite },
  status: 'completed', conclusion: 'success',
  html_url: 'https://github.com/acme/demo/actions/runs/222/job/333' };

function fixture({ conclusion = 'success', stale = false } = {}) {
  let reads = 0;
  return async url => ({
    ok: true,
    json: async () => {
      if (url.includes('/pulls/')) {
        reads++;
        return stale && reads > 1
          ? { ...pr, head: { ...pr.head, sha: 'b'.repeat(40) } } : pr;
      }
      if (url.includes('/check-runs')) {
        return { total_count: 1, check_runs: [{ ...check, conclusion }] };
      }
      if (url.includes('/actions/runs')) {
        return { total_count: 1, workflow_runs: [run] };
      }
      throw new Error('Unexpected endpoint');
    },
  });
}
const args = (fetchImpl) => ({
  owner: 'acme', repo: 'demo', prNumber: 5, requiredChecks: ['verify'],
  goal: 'Implement a documented user-facing feature',
  acceptanceCriteria: ['Tests pass', 'Review completed'], fetchImpl,
});
test('read-only pilot reaches human review with exact GitHub CI evidence', async () => {
  const result = await prepareFactoryReview(args(fixture()));
  assert.equal(result.status, 'AWAITING_HUMAN');
  assert.equal(result.job.stage, 'NEEDS_HUMAN');
  assert.equal(result.checkedHeadSha, sha);
  assert.equal(result.job.evidence.find(e => e.to === 'REVIEW').kind, 'ci-passed');
  assert.equal(result.job.evidence.length, 5);
});
test('failed CI does not advance beyond specification', async () => {
  const result = await prepareFactoryReview(args(fixture({ conclusion: 'failure' })));
  assert.equal(result.status, 'CI_BLOCKED');
  assert.equal(result.job.stage, 'SPEC');
  assert.equal(result.job.evidence.length, 0);
});
test('stale PR head fails closed', async () => {
  const result = await prepareFactoryReview(args(fixture({ stale: true })));
  assert.equal(result.status, 'CI_BLOCKED');
  assert.deepEqual(result.failures, ['STALE_HEAD']);
});
