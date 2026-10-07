import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createActionGuard,
  createSignedApprovalAuthority,
} from '../runtime/index.mjs';
import { createOpenAIAgentsToolAdapter } from '../adapters/openai-agents.mjs';
import { createMcpToolCallGuard } from '../adapters/mcp.mjs';

const tools = [{
  name: 'delete_resource',
  purpose: 'Delete a resource.',
  access: 'destructive',
  riskLevel: 'high',
  requiredPermissions: ['resource:delete'],
  requiresApproval: true,
  idempotent: false,
  audit: true,
  sideEffects: 'Deletes provider state.',
  retryPolicy: 'Inspect before retry.',
  verificationStrategy: 'Confirm absence.',
  recoveryStrategy: 'Human intervention.',
}];

test('ActionGuard rejects forged approval credentials', async () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const guard = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });

  const proposal = guard.propose({
    toolName: 'delete_resource',
    target: 'resource-1',
    params: { id: 'resource-1' },
  });

  await assert.rejects(
    guard.execute({
      actor: { permissions: ['resource:delete'] },
      proposal,
      approvalCredential: {
        receipt: {
          valid: true,
          issuer: authority.issuer,
          actorId: 'human-1',
          toolName: proposal.toolName,
          target: proposal.target,
          actionSignature: proposal.actionSignature,
          oneShot: true,
        },
        proof: '00',
      },
      invoke: async () => ({ deleted: true }),
      verify: async () => ({ verified: true }),
    }),
    /INVALID_APPROVAL_PROOF/
  );
});

test('policy provenance changes the action signature', () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const a = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });
  const b = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p2',
    toolContractVersion: 't1',
  });

  const one = a.propose({ toolName: 'delete_resource', target: 'r1' });
  const two = b.propose({ toolName: 'delete_resource', target: 'r1' });

  assert.notEqual(one.actionSignature, two.actionSignature);
});

test('signed approval executes the exact approved action', async () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const guard = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });
  const proposal = guard.propose({
    toolName: 'delete_resource',
    target: 'r1',
    params: { id: 'r1' },
  });
  const credential = await authority.issue(proposal, { approverId: 'human-1' });

  const result = await guard.execute({
    actor: { permissions: ['resource:delete'] },
    proposal,
    approvalCredential: credential,
    invoke: async () => ({ deleted: true }),
    verify: async () => ({ verified: true }),
  });

  assert.equal(result.execution.status, 'SUCCEEDED');
});

test('MCP adapter governs a tool call through ActionGuard', async () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const guard = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });

  const govern = createMcpToolCallGuard({
    guard,
    resolveTarget: ({ args }) => args.id,
    requestApproval: async ({ proposal }) =>
      authority.issue(proposal, { approverId: 'human-1' }),
  });

  const result = await govern({
    request: {
      params: {
        name: 'delete_resource',
        arguments: { id: 'r1' },
      },
    },
    actor: { permissions: ['resource:delete'] },
    invoke: async () => ({ deleted: true }),
    verify: async () => ({ verified: true }),
  });

  assert.equal(result.execution.status, 'SUCCEEDED');
});

test('OpenAI adapter exposes needsApproval and executes via ActionGuard', async () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const guard = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });

  const adapter = createOpenAIAgentsToolAdapter({
    guard,
    toolName: 'delete_resource',
    targetFromArgs: args => args.id,
    getApprovalCredential: async ({ proposal }) =>
      authority.issue(proposal, { approverId: 'human-1' }),
    execute: async args => ({ deleted: args.id }),
    verify: async ({ providerResult }) => ({
      verified: providerResult.deleted === 'r1',
    }),
  });

  assert.equal(await adapter.needsApproval({}, { id: 'r1' }), true);
  const result = await adapter.execute(
    { id: 'r1' },
    { actor: { permissions: ['resource:delete'] } }
  );
  assert.deepEqual(result, { deleted: 'r1' });
});


test('one-shot signed approval cannot be replayed', async () => {
  const authority = createSignedApprovalAuthority({ secret: '0123456789abcdef' });
  const guard = createActionGuard({
    tools,
    approvalAuthority: authority,
    policyVersion: 'p1',
    toolContractVersion: 't1',
  });
  const proposal = guard.propose({
    toolName: 'delete_resource',
    target: 'r1',
    params: { id: 'r1' },
  });
  const credential = await authority.issue(proposal, { approverId: 'human-1' });

  const first = await guard.execute({
    actor: { permissions: ['resource:delete'] },
    proposal,
    approvalCredential: credential,
    invoke: async () => ({ deleted: true }),
    verify: async () => ({ verified: true }),
  });
  assert.equal(first.execution.status, 'SUCCEEDED');

  await assert.rejects(
    guard.execute({
      actor: { permissions: ['resource:delete'] },
      proposal,
      approvalCredential: credential,
      invoke: async () => ({ deleted: true }),
      verify: async () => ({ verified: true }),
    }),
    /APPROVAL_ALREADY_CONSUMED/
  );
});
