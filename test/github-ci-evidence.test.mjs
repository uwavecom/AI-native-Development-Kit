import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyGithubPrCi } from '../examples/github-ci-evidence.mjs';
import { createFactoryJob, transitionFactoryJob } from '../runtime/factory-workflow.mjs';

const sha = 'a'.repeat(40);
const repoName = 'example/kit';
const pr = { state: 'open', head: { sha, ref: 'pilot/demo', repo: { full_name: repoName } }, base: { ref: 'main' } };
const passing = { workflow_runs: [{
  head_sha: sha, head_branch: 'pilot/demo', status: 'completed',
  conclusion: 'success', event: 'pull_request',
  repository: { full_name: repoName },
  html_url: 'https://github.com/example/kit/actions/runs/123',
}] };
function mocked(prResponse = pr, runs = passing) {
  return async url => ({
    ok: true,
    json: async () => url.includes('/pulls/') ? prResponse : runs,
  });
}
test('uses GitHub-attested commit-matching CI evidence in factory workflow', async () => {
  const result = await verifyGithubPrCi({
    owner: 'example', repo: 'kit', prNumber: 7, fetchImpl: mocked(),
  });
  assert.equal(result.verified, true);
  let job = createFactoryJob({ id: '7', goal: 'Pilot', acceptanceCriteria: ['CI passes'] });
  job = transitionFactoryJob(job, 'BUILD', { expectedRevision: job.revision, evidence: { kind: 'spec', reference: 'issue-7' } });
  job = transitionFactoryJob(job, 'VERIFY', { expectedRevision: job.revision, evidence: { kind: 'commit', reference: sha } });
  job = transitionFactoryJob(job, 'REVIEW', { expectedRevision: job.revision, evidence: result.evidence });
  assert.equal(job.stage, 'REVIEW');
});
test('a green run for another commit is not valid evidence', async () => {
  const wrong = { workflow_runs: [{ ...passing.workflow_runs[0], head_sha: 'b'.repeat(40) }] };
  const result = await verifyGithubPrCi({
    owner: 'example', repo: 'kit', prNumber: 7, fetchImpl: mocked(pr, wrong),
  });
  assert.equal(result.verified, false);
  assert.equal(result.evidence, null);
});
test('failed or incomplete checks cannot authorize review', async () => {
  const wrong = { workflow_runs: [{ ...passing.workflow_runs[0], status: 'in_progress', conclusion: null }] };
  const result = await verifyGithubPrCi({
    owner: 'example', repo: 'kit', prNumber: 7, fetchImpl: mocked(pr, wrong),
  });
  assert.equal(result.verified, false);
});
test('rejects foreign fork identity and invalid PR identifiers', async () => {
  await assert.rejects(
    verifyGithubPrCi({ owner: 'example', repo: 'kit', prNumber: 7,
      fetchImpl: mocked({ ...pr, head: { ...pr.head, repo: { full_name: 'attacker/fork' } } }),
    }),
    /Unsupported PR identity/
  );
  await assert.rejects(verifyGithubPrCi({ owner: '../bad', repo: 'kit', prNumber: 1 }), /Valid owner/);
});
