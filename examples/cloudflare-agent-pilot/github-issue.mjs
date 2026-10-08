import { createActionGuard } from '../../runtime/index.mjs';

export const githubIssueTool = Object.freeze({
  name: 'github_create_issue', purpose: 'Create one GitHub issue in an explicitly allowed repository.',
  access: 'write', riskLevel: 'high', requiredPermissions: ['github:issues:write'],
  requiresApproval: true, idempotent: false, audit: true,
  sideEffects: 'Creates an issue using the GitHub REST API.',
  retryPolicy: 'Never retry POST after an ambiguous outcome; reconcile manually.',
  verificationStrategy: 'GET the returned issue URL and compare title and body.',
  recoveryStrategy: 'Return UNKNOWN on lost response and require human review.',
});

const ownerPattern = /^[a-zA-Z0-9-]{1,39}$/;
const repoPattern = /^[a-zA-Z0-9_.-]{1,100}$/;
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);

/**
 * Production integration requires a private installation token bound to the
 * repository and a separately authenticated approval issuer. Never expose
 * this adapter directly to an LLM, untrusted HTTP route, or user-provided URL.
 */
export function createGitHubIssueService({
  approvalAuthority, githubToken, allowedRepository, fetchImpl = fetch,
  audit = async () => {},
}) {
  if (!approvalAuthority?.verify || !approvalAuthority?.claim) throw new Error('APPROVAL_AUTHORITY_REQUIRED');
  if (typeof githubToken !== 'string' || !githubToken.trim()) throw new Error('GITHUB_TOKEN_REQUIRED');
  if (typeof fetchImpl !== 'function') throw new Error('FETCH_REQUIRED');
  const [owner, repo, ...rest] = String(allowedRepository ?? '').split('/');
  if (rest.length || !ownerPattern.test(owner ?? '') || !repoPattern.test(repo ?? ''))
    throw new Error('INVALID_ALLOWED_REPOSITORY');
  const fullRepo = `${owner}/${repo}`;
  const guard = createActionGuard({
    tools: [githubIssueTool], approvalAuthority, policyVersion: 'github-issue-pilot-v1',
    toolContractVersion: 'github-issue-pilot-v1',
  });
  const api = `https://api.github.com/repos/${owner}/${repo}/issues`;
  async function githubRequest(url, init = {}) {
    const response = await fetchImpl(url, {
      ...init, headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ai-native-development-kit-pilot',
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error(`GITHUB_HTTP_${response.status}`);
    return response.json();
  }
  function validate(issue) {
    if (!issue || issue.repository !== fullRepo || !safeId(issue.operationId) ||
      typeof issue.title !== 'string' || !issue.title.trim() || issue.title.length > 200 ||
      typeof issue.body !== 'string' || issue.body.length > 10000)
      throw new Error('INVALID_ISSUE_REQUEST');
    return { repository: fullRepo, operationId: issue.operationId,
      title: issue.title, body: issue.body };
  }
  function makeProposal(issue, scope = null) {
    const params = validate(issue);
    return guard.propose({
      toolName: githubIssueTool.name,
      target: `${fullRepo}#${params.operationId}`, params, scope,
    });
  }
  function verifyProposal(proposal) {
    if (proposal?.toolName !== githubIssueTool.name) throw new Error('INVALID_PROPOSAL');
    const canonical = makeProposal(proposal.params, proposal.scope ?? null);
    if (proposal.target !== canonical.target ||
      proposal.actionSignature !== canonical.actionSignature)
      throw new Error('PROPOSAL_SIGNATURE_MISMATCH');
    return canonical.params;
  }
  return {
    propose: makeProposal,
    async execute({ proposal, credential, actor }) {
      const { title, body } = verifyProposal(proposal);
      let created = null;
      const result = await guard.execute({
        actor, proposal, approvalCredential: credential,
        invoke: async () => {
          created = await githubRequest(api, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, body }),
          });
          return { number: created.number, html_url: created.html_url };
        },
        verify: async () => {
          if (!Number.isSafeInteger(created?.number) || created.number <= 0) return { verified: false };
          const saved = await githubRequest(`${api}/${created.number}`);
          return { verified: saved.title === title && saved.body === body &&
            saved.number === created.number };
        },
      });
      await audit({ event: 'github_issue_result', signature: proposal.actionSignature,
        status: result.execution.status });
      return result;
    },
  };
}
