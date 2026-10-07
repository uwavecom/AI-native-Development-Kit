import {
  createActionGuard,
  createSignedApprovalAuthority,
} from '../runtime/index.mjs';

const tools = [{
  name: 'merge_pull_request',
  purpose: 'Merge a pull request.',
  access: 'destructive',
  riskLevel: 'high',
  requiredPermissions: ['repo:merge'],
  requiresApproval: true,
  idempotent: false,
  audit: true,
  sideEffects: 'Changes canonical repository history.',
  retryPolicy: 'Never retry blindly after unknown state.',
  verificationStrategy: 'Confirm PR is merged.',
  recoveryStrategy: 'Require an explicit revert action.',
}];

const authority = createSignedApprovalAuthority({
  secret: 'replace-with-server-secret-at-least-16-chars',
});

const guard = createActionGuard({
  tools,
  policyVersion: 'policy-2026-10-07',
  toolContractVersion: 'tools-v1',
  approvalAuthority: authority,
});

const proposal = guard.propose({
  toolName: 'merge_pull_request',
  target: 'PR#42',
  params: { prNumber: 42, base: 'main' },
});

console.log('Proposal:', proposal.actionSignature);

const approvalCredential = await authority.issue(proposal, {
  approverId: 'human-reviewer',
});

const result = await guard.execute({
  actor: { id: 'agent-1', permissions: ['repo:merge'] },
  proposal,
  approvalCredential,
  invoke: async () => ({ merged: true, sha: 'demo-sha' }),
  verify: async ({ providerResult }) => ({
    verified: providerResult.merged === true,
  }),
});

console.log('Status:', result.execution.status);
