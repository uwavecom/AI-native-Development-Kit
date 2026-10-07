# ADR 0002 — Runtime hardening v0.2

## Status

Accepted.

## Context

The v0.1 safe-action runtime protects one AI-initiated external action, including approval, execution, verification, audit, and recovery.

Long-running and multi-agent systems additionally require controls for persistence, concurrency, quotas, capability discovery, and multi-step workflows.

## Decision

Add provider-neutral runtime primitives for:

- durable approval and audit state;
- keyed concurrency coordination;
- explicit execution budgets;
- capability discovery;
- multi-step workflow semantics;
- a hardened safe-action entry point that composes durable approval, audit, locking, budgets, and the existing safe-action lifecycle.

Reference implementations remain zero-dependency and Node.js 22 compatible.

## Boundaries

The file state store and keyed lock are reference adapters, not production distributed infrastructure.

Production profiles must substitute appropriate durable/distributed implementations without changing the core semantics.

## Consequences

The kit can now model repeated and multi-step agent execution without making model memory or one process the source of truth.

The cost is additional runtime policy and the need for deployment-specific adapters in production.
