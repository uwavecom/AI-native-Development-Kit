import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedApprovalAuthority } from '../runtime/index.mjs';
import { createGitHubIssueService } from '../examples/cloudflare-agent-pilot/github-issue.mjs';

const actor = { id: 'test-operator', permissions: ['github:issues:write'] };
const issue = { repository: 'example-org/example-repo', operationId: 'operation-001', title: 'Demo issue', body: 'Only a mocked request' };
function fixture({ failPost = false, failGet = false } = {}) {
  const authority = createSignedApprovalAuthority({ secret: 'test-only-github-issue-signing-secret' });
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (init.method === 'POST') {
      if (failPost) throw new Error('SIMULATED_LOST_RESPONSE');
      return { ok: true, json: async () => ({ number: 42, html_url: 'https://github.com/example-org/example-repo/issues/42' }) };
    }
    if (failGet) throw new Error('SIMULATED_VERIFY_OUTAGE');
    return { ok: true, json: async () => ({ number: 42, title: issue.title, body: issue.body }) };
  };
  const service = createGitHubIssueService({
    approvalAuthority: authority, githubToken: 'private-test-token',
    allowedRepository: issue.repository, fetchImpl,
  });
  return { authority, calls, service };
}
async function authorize(fixture, proposed = issue) {
  const proposal = fixture.service.propose(proposed);
  const credential = await fixture.authority.issue(proposal, { approverId: 'human-approver' });
  return { proposal, credential };
}

test('approved GitHub issue uses only the configured API host and verifies GET', async () => {
  const f = fixture();
  const { proposal, credential } = await authorize(f);
  const result = await f.service.execute({ proposal, credential, actor });
  assert.equal(result.execution.status, 'SUCCEEDED');
  assert.equal(f.calls.length, 2);
  assert.equal(f.calls[0].url, 'https://api.github.com/repos/example-org/example-repo/issues');
  assert.equal(f.calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(f.calls[0].init.body), { title: issue.title, body: issue.body });
  assert.equal(f.calls[1].url, 'https://api.github.com/repos/example-org/example-repo/issues/42');
});

test('missing approval never calls GitHub', async () => {
  const f = fixture();
  const result = await f.service.execute({ proposal: f.service.propose(issue), credential: null, actor });
  assert.equal(result.execution.executed, false);
  assert.equal(f.calls.length, 0);
});

test('wrong repository is rejected before any GitHub request', async () => {
  const f = fixture();
  assert.throws(() => f.service.propose({ ...issue, repository: 'attacker/repo' }), /INVALID_ISSUE_REQUEST/);
  assert.equal(f.calls.length, 0);
});

test('tampered title with previously approved signature is rejected', async () => {
  const f = fixture();
  const { proposal, credential } = await authorize(f);
  await assert.rejects(f.service.execute({
    proposal: { ...proposal, params: { ...proposal.params, title: 'Unauthorised change' } },
    credential, actor,
  }), /PROPOSAL_SIGNATURE_MISMATCH/);
  assert.equal(f.calls.length, 0);
});

test('ambiguous POST failure is not automatically retried', async () => {
  const f = fixture({ failPost: true });
  const { proposal, credential } = await authorize(f);
  const first = await f.service.execute({ proposal, credential, actor });
  assert.notEqual(first.execution.status, 'SUCCEEDED');
  await assert.rejects(f.service.execute({ proposal, credential, actor }),
    /APPROVAL_ALREADY_CONSUMED/);
  assert.equal(f.calls.filter(x => x.init.method === 'POST').length, 1);
});

test('verification outage cannot report successful execution', async () => {
  const f = fixture({ failGet: true });
  const { proposal, credential } = await authorize(f);
  const result = await f.service.execute({ proposal, credential, actor });
  assert.notEqual(result.execution.status, 'SUCCEEDED');
  assert.equal(f.calls.length, 2);
});
