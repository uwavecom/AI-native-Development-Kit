# AI-native Development Kit

**Portable action governance for AI agents.**

AI agents can call real tools. This kit controls **which actions may execute, which require trusted approval, and how to verify what actually happened** — without replacing your agent framework or workflow engine.

Use it with OpenAI Agents SDK, MCP, custom agents, or existing durable runtimes.

## Why

Authentication tells you whether an agent may access a system.

This kit answers the harder question:

> Can this agent perform this exact action, on this exact target, with these exact parameters, under this policy, with this approval?

It provides:

- canonical action proposals and signatures;
- tool risk/access metadata;
- policy decisions;
- verifiable approval credentials;
- one-shot approval semantics;
- execution budgets;
- post-action verification;
- explicit UNKNOWN execution state;
- recovery rules;
- structured audit;
- policy/tool-contract provenance;
- framework adapters.

It does **not** try to replace Temporal, Restate, Dapr, LangGraph, OpenAI Agents SDK, or your application.

## 10-minute quick start

Requires Node.js 22+.

Clone the repository and run:

```bash
node examples/quickstart.mjs
```

The example protects a destructive `merge_pull_request` action.

The core flow is:

```js
import {
  createActionGuard,
  createSignedApprovalAuthority,
} from './runtime/index.mjs';

const authority = createSignedApprovalAuthority({
  secret: process.env.APPROVAL_SECRET,
});

const guard = createActionGuard({
  tools,
  policyVersion: 'policy-v1',
  toolContractVersion: 'tools-v1',
  approvalAuthority: authority,
});

const proposal = guard.propose({
  toolName: 'merge_pull_request',
  target: 'PR#42',
  params: { prNumber: 42, base: 'main' },
});

// This credential must come from a trusted application/human boundary.
const approvalCredential = await authority.issue(proposal, {
  approverId: 'human-reviewer',
});

const result = await guard.execute({
  actor: { permissions: ['repo:merge'] },
  proposal,
  approvalCredential,
  invoke: () => github.mergePullRequest(42),
  verify: async ({ providerResult }) => ({
    verified: providerResult.merged === true,
  }),
});
```

Possible runtime outcomes include:

```text
PENDING
SUCCEEDED
FAILED
UNKNOWN
VERIFICATION_FAILED
```

## Adapters

### OpenAI Agents SDK

Use `createOpenAIAgentsToolAdapter()` from `./adapters/openai-agents.mjs`.

The adapter is dependency-free: pass its `needsApproval` and `execute` callbacks into an `@openai/agents` function tool.

For sensitive tools, OpenAI's HITL flow may pause the run first. After your trusted application approves the interruption, exchange that decision for a verifiable Development Kit credential. Do not derive trusted approval from model-controlled state.

### MCP

Use `createMcpToolCallGuard()` from `./adapters/mcp.mjs`.

It wraps an MCP-style tool invocation and applies the same proposal, policy, approval, execution, verification, and audit semantics without depending on a specific MCP SDK.

## Architecture

The canonical lifecycle is:

```text
DISCOVER
→ PROPOSE
→ DECIDE
→ REQUEST APPROVAL
→ VERIFY TRUSTED APPROVAL
→ EXECUTE
→ VERIFY
→ AUDIT
→ RECOVER
```

Low-risk reads can execute autonomously when authorized. Consequential actions can require bound approval.

Approval is tied to the canonical action signature, including policy provenance. Changing the target, parameters, scope, or pinned policy identity changes the signature.

## What this project is not

This is **not**:

- an LLM framework;
- an agent loop;
- a durable workflow engine;
- an agent memory system;
- a general observability platform;
- an enterprise agent inventory;
- a sandbox runtime.

Use mature systems for those problems. This project focuses on the semantic control boundary around consequential actions.

## Verify the repository

```bash
npm run verify
```

Verification checks syntax, architectural boundaries, tool-contract guardrails, behavior, runtime hardening, production profiles, and public API/adapters.

## Reference material

- `.ai/architecture-contract.md`
- `.ai/tool-contract.md`
- `.ai/action-policy.md`
- `.ai/approval-contract.md`
- `.ai/execution-contract.md`
- `.ai/recovery-contract.md`
- `.ai/runtime-hardening.md`
- `audits/reference-agent-runtime-2026-10-07.md`
- `audits/market-technical-validation-2026-10-07.md`

Reference domains include GitHub and TradingView. The Cloudflare profile demonstrates how provider-neutral semantics map onto production infrastructure.

## Project status

v0.3 is an early reference release focused on real developer usability.

The next validation target is not more abstractions. It is whether an external developer can protect a real tool call with this kit without needing help from the authors.
