import test from 'node:test';
import assert from 'node:assert/strict';
import { runFactoryScenario } from '../examples/factory-workflow.mjs';

test('factory scenario fails closed without human approval', async () => {
  const outcome = await runFactoryScenario();
  assert.equal(outcome.job.stage, 'NEEDS_HUMAN');
  assert.equal(outcome.invoked, false);
  assert.equal(outcome.execution, null);
});

test('approved demonstration merges only after action guard verifies', async () => {
  const outcome = await runFactoryScenario({ approve: true });
  assert.equal(outcome.execution.execution.status, 'SUCCEEDED');
  assert.equal(outcome.job.stage, 'MERGED');
  assert.equal(outcome.invoked, true);
  assert.equal(outcome.job.evidence.at(-1).kind, 'verified-merge');
});

test('forged approval cannot invoke the governed merge action', async () => {
  const { createActionGuard, createSignedApprovalAuthority } = await import('../runtime/index.mjs');
  const authority = createSignedApprovalAuthority({ secret: 'independent-test-secret-0001' });
  const guard = createActionGuard({
    tools: [{
      name: 'merge_pull_request', purpose: 'Merge PR', access: 'destructive',
      riskLevel: 'high', requiredPermissions: ['repo:merge'],
      requiresApproval: true, idempotent: false, audit: true,
      sideEffects: 'Changes repository history.',
      retryPolicy: 'Inspect before retry.',
      verificationStrategy: 'Confirm merged state.',
      recoveryStrategy: 'Explicit revert.',
    }],
    approvalAuthority: authority,
    policyVersion: 'factory-test-v1',
    toolContractVersion: 'factory-test-tools-v1',
  });
  const proposal = guard.propose({
    toolName: 'merge_pull_request', target: 'PR#42',
    params: { prNumber: 42, base: 'main' },
  });
  let invoked = false;
  await assert.rejects(
    guard.execute({
      actor: { permissions: ['repo:merge'] }, proposal,
      approvalCredential: {
        receipt: {
          issuer: authority.issuer, actionSignature: proposal.actionSignature,
          toolName: proposal.toolName, target: proposal.target,
        },
        proof: '00',
      },
      invoke: async () => { invoked = true; return { merged: true }; },
      verify: async () => ({ verified: true }),
    }),
    /INVALID_APPROVAL_PROOF/
  );
  assert.equal(invoked, false);
});

test('approval for another PR cannot authorize this PR', async () => {
  const { createActionGuard, createSignedApprovalAuthority } = await import('../runtime/index.mjs');
  const authority = createSignedApprovalAuthority({ secret: 'independent-test-secret-0002' });
  const guard = createActionGuard({
    tools: [{
      name: 'merge_pull_request', purpose: 'Merge PR', access: 'destructive',
      riskLevel: 'high', requiredPermissions: ['repo:merge'],
      requiresApproval: true, idempotent: false, audit: true,
      sideEffects: 'Changes repository history.',
      retryPolicy: 'Inspect before retry.',
      verificationStrategy: 'Confirm merged state.',
      recoveryStrategy: 'Explicit revert.',
    }],
    approvalAuthority: authority,
    policyVersion: 'factory-test-v1',
    toolContractVersion: 'factory-test-tools-v1',
  });
  const approved = guard.propose({
    toolName: 'merge_pull_request', target: 'PR#41',
    params: { prNumber: 41, base: 'main' },
  });
  const attempted = guard.propose({
    toolName: 'merge_pull_request', target: 'PR#42',
    params: { prNumber: 42, base: 'main' },
  });
  const credential = await authority.issue(approved, { approverId: 'test-human' });
  let invoked = false;
  await assert.rejects(
    guard.execute({
      actor: { permissions: ['repo:merge'] }, proposal: attempted,
      approvalCredential: credential,
      invoke: async () => { invoked = true; return { merged: true }; },
      verify: async () => ({ verified: true }),
    }),
    /APPROVAL_PROPOSAL_MISMATCH/
  );
  assert.equal(invoked, false);
});
