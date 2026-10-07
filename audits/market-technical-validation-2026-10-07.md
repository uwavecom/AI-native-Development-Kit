# Market and Technical Validation — 2026-10-07

## Executive conclusion

The Development Kit should **not** become another durable agent framework or workflow orchestrator.

That market is already strongly served by:

- OpenAI Agents SDK integrations with Dapr, Temporal, and Restate;
- Temporal durable execution;
- Restate durable agents and human-approval workflows;
- Dapr Agents and Dapr Workflows;
- LangGraph persistence, interrupts, and durable execution.

The more defensible opportunity is narrower:

> a framework-independent action governance and execution-policy layer that sits between an agent and consequential tools.

This layer should integrate with durable runtimes rather than replace them.

## What the market already solves well

### Agent orchestration and durable execution

OpenAI Agents SDK supports human approval, serializable run state, and integrations with Dapr, Temporal, and Restate for long-running durable execution.

Temporal is explicitly a durable execution platform and supports AI agents that wait for humans and resume after failure.

Restate provides durable functions/workflows/objects, durable promises for human approval, retries, concurrency control, and version-pinned execution.

Dapr Agents provides workflow-backed durable agents with persistent state, retries, identities, observability, and MCP support.

LangGraph provides persisted graph state, interrupts, and resume semantics.

**Decision:** do not build our own general durable workflow engine.

## What enterprise platforms already solve

### Broad agent governance

Microsoft Agent 365 is a centralized control plane for observing, governing, securing, registering, and assigning ownership to agents across an organization.

AWS AgentCore Policy intercepts tool calls at a Gateway and evaluates deterministic Cedar/Dogwood policies in real time.

NVIDIA OpenShell provides restrictive sandbox policy enforcement for filesystem, process, and network access.

Commercial governance/control-plane products are also emerging around inline policy gates, approvals, budgets, audit, identity, and MCP gateways.

**Decision:** do not position the project as a full enterprise agent-governance suite at this stage.

## What MCP solves — and what it does not

MCP authorization is increasingly mature around OAuth, client identity, enterprise-managed authorization, protected tools, and protocol-level authorization hardening.

However, authentication/authorization to an MCP server is not the same as application-level semantic permission to perform a consequential action.

A user may be authorized to access a server while a specific action still requires:

- action-specific policy;
- human approval;
- parameter/target binding;
- budget checks;
- verification;
- unknown-state handling;
- audit;
- recovery semantics.

This remains the most relevant layer for the Development Kit.

## The remaining opportunity

The project is strongest when framed as:

> **a portable action-control contract for agentic software**

It should answer:

```text
Can this agent perform this exact action,
on this exact target,
with these exact parameters,
under this policy,
with this approval,
and how do we prove what happened?
```

That is narrower than an agent framework and narrower than an enterprise governance suite.

It can sit inside or in front of:

- OpenAI Agents SDK;
- LangGraph;
- Temporal;
- Restate;
- Dapr;
- custom agents;
- MCP clients/gateways;
- coding agents.

## Differentiating primitives worth keeping

The current project already has several useful pieces that are not tied to a particular orchestrator:

- canonical action proposal/signature;
- tool risk/access metadata;
- policy decision model;
- bound approvals;
- one-shot approval semantics;
- verification requirements;
- UNKNOWN execution state;
- recovery rules;
- budgets;
- audit events;
- provider-neutral adapters.

The distinctive value is the **semantic boundary around the action**, not workflow scheduling.

## Revised v0.3 recommendation

### Build

1. **Approval Authority / trusted decision boundary**
   - approval authenticity;
   - issuer authority;
   - replay protection;
   - proposal binding;
   - server-side verification.

2. **Policy provenance**
   - policy identity/version;
   - tool-contract identity/version;
   - decision evidence;
   - audit reproducibility.

3. **Framework adapters**
   - thin integrations that wrap existing tool execution paths;
   - start with OpenAI Agents SDK and MCP;
   - later evaluate LangGraph if useful.

### Do not build

- durable workflow engine;
- queue scheduler;
- distributed workflow replay;
- agent memory;
- multi-agent orchestration;
- generic observability platform;
- enterprise agent inventory;
- sandbox runtime.

Use Temporal, Restate, Dapr, LangGraph, Cloudflare Workflows/Queues, or product-native infrastructure for those concerns.

## Product hypothesis

The external-product hypothesis is now:

> Teams already have agents and tools. They need a small, portable layer that makes consequential tool calls policy-controlled, approval-bound, verifiable, and auditable without replacing their agent framework or durable runtime.

Potential form factors:

- TypeScript/Python library;
- MCP middleware/gateway;
- policy sidecar/service;
- hosted control plane later, only if adoption proves demand.

## Validation threshold before SaaS

Do not build a hosted control plane until at least one of these is true:

- external developers adopt the library;
- two or more real projects need the same cross-framework policy layer;
- MCP users ask for central policy/approval/audit;
- a company needs shared rules across multiple agent frameworks.

Until then, optimize for a small open-source/reference core.

## Final recommendation

The project remains useful for us even if it never becomes a standalone business.

For external users, the opportunity is plausible but crowded.

The strongest strategy is therefore:

```text
NOT another agent framework
NOT another Temporal
NOT another enterprise governance suite

YES:
portable action governance
+ trusted approvals
+ policy provenance
+ verification/recovery semantics
+ adapters to existing runtimes
```

This is the scope that should guide v0.3.
