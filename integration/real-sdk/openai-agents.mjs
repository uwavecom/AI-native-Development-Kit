import assert from 'node:assert/strict';
import { tool } from '@openai/agents';
import { z } from 'zod';

import {
  createActionGuard,
  createSignedApprovalAuthority,
} from '../../runtime/index.mjs';
import { createOpenAIAgentsToolAdapter } from '../../adapters/openai-agents.mjs';

const toolPolicies = [{
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

const authority = createSignedApprovalAuthority({
  secret: 'real-sdk-validation-secret',
});

const guard = createActionGuard({
  tools: toolPolicies,
  policyVersion: 'integration-policy-v1',
  toolContractVersion: 'integration-tools-v1',
  approvalAuthority: authority,
});

const adapter = createOpenAIAgentsToolAdapter({
  guard,
  toolName: 'delete_resource',
  targetFromArgs: args => args.id,
  getApprovalCredential: async ({ proposal }) =>
    authority.issue(proposal, { approverId: 'integration-reviewer' }),
  execute: async args => ({ deleted: args.id }),
  verify: async ({ providerResult }) => ({
    verified: providerResult.deleted === 'resource-1',
  }),
});

const protectedTool = tool({
  name: 'delete_resource',
  description: 'Delete a resource after governance checks.',
  parameters: z.object({ id: z.string() }),
  needsApproval: adapter.needsApproval,
  execute: adapter.execute,
});

assert.equal(protectedTool.name, 'delete_resource');
assert.equal(await protectedTool.needsApproval({ id: 'resource-1' }), true);

const result = await adapter.execute(
  { id: 'resource-1' },
  { context: { actor: { id: 'agent-1', permissions: ['resource:delete'] } } }
);

assert.deepEqual(result, { deleted: 'resource-1' });
console.log('OpenAI Agents SDK integration: PASS');
