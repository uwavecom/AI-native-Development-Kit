# Getting started

This repository is currently a **reference release**, not a published npm package.

Until an open-source license and package publication are selected, use it by cloning the repository.

## 1. Clone and verify

Requirements:

- Node.js 22 or newer.

Run:

```bash
npm run verify
```

No runtime dependencies are required.

## 2. Run the executable quickstart

```bash
node examples/quickstart.mjs
```

The example protects a destructive pull-request merge using:

- a canonical proposal;
- policy/tool provenance;
- a trusted signed approval;
- permission checks;
- execution;
- independent verification.

## 3. Define a governed tool

A tool declaration describes the security and recovery semantics of a capability.

```js
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
  retryPolicy: 'Inspect provider state before retry.',
  verificationStrategy: 'Confirm the resource no longer exists.',
  recoveryStrategy: 'Escalate to human intervention.',
}];
```

## 4. Create the guard

```js
import {
  createActionGuard,
  createSignedApprovalAuthority,
} from './runtime/index.mjs';

const approvalAuthority = createSignedApprovalAuthority({
  secret: process.env.APPROVAL_SECRET,
});

const guard = createActionGuard({
  tools,
  policyVersion: 'policy-v1',
  toolContractVersion: 'tools-v1',
  approvalAuthority,
});
```

The reference signed authority is single-process. For distributed production systems, replace it with a durable trusted authority that preserves the same `issue / verify / claim` semantics.

## 5. Protect an action

```js
const proposal = guard.propose({
  toolName: 'delete_resource',
  target: 'customer:123',
  params: { id: '123' },
});

const approvalCredential = await approvalAuthority.issue(proposal, {
  approverId: 'reviewer-42',
});

const result = await guard.execute({
  actor: {
    id: 'agent-7',
    permissions: ['resource:delete'],
  },
  proposal,
  approvalCredential,
  invoke: () => provider.deleteResource('123'),
  verify: async () => ({
    verified: !(await provider.resourceExists('123')),
  }),
});
```

## 6. Use an integration adapter

For OpenAI Agents SDK, see [openai-agents.md](./openai-agents.md).

For MCP-style tool calls, see [mcp.md](./mcp.md).

## Production checklist

Before production use, provide:

- a durable approval authority;
- trusted actor identity;
- durable audit storage where required;
- provider-specific verification;
- deployment-specific concurrency guarantees;
- explicit product policy;
- secret management outside model/client control.

Read [../SECURITY.md](../SECURITY.md) before using consequential actions.
