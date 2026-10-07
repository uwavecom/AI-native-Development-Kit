import assert from 'node:assert/strict';
import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import {
  createActionGuard,
  createSignedApprovalAuthority,
} from '../../runtime/index.mjs';
import { createMcpToolCallGuard } from '../../adapters/mcp.mjs';

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

const govern = createMcpToolCallGuard({
  guard,
  resolveTarget: ({ args }) => args.id,
  requestApproval: async ({ proposal }) =>
    authority.issue(proposal, { approverId: 'integration-reviewer' }),
});

const server = new McpServer({
  name: 'governed-tools',
  version: '0.3.0',
});

const registered = server.registerTool(
  'delete_resource',
  {
    description: 'Delete a resource after governance checks.',
    inputSchema: z.object({ id: z.string() }),
  },
  async args => {
    const governed = await govern({
      request: {
        params: {
          name: 'delete_resource',
          arguments: args,
        },
      },
      actor: {
        id: 'agent-1',
        permissions: ['resource:delete'],
      },
      invoke: async () => ({ deleted: args.id }),
      verify: async ({ providerResult }) => ({
        verified: providerResult.deleted === args.id,
      }),
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(governed.execution.providerResult),
      }],
    };
  }
);

assert.equal(registered.enabled, true);
assert.equal(typeof registered.handler, 'function');
console.log('MCP TypeScript SDK v2 integration: PASS');
