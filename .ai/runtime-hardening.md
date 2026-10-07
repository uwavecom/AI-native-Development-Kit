# Runtime Hardening Profile

## Status

Version: 0.2 reference profile.

The v0.1 agent-safe lifecycle defines correctness of a single consequential action.

The v0.2 hardening profile adds operational controls needed when many actions execute over time.

## Durable state

Approvals and audit events must be persistable outside model context and process memory.

The reference adapter is `runtime/state/file-state-store.mjs`.

It is intentionally simple. Production profiles may replace it with PostgreSQL, D1, durable objects, Redis-compatible storage, or another system while preserving the same semantics.

## Concurrency

Operations affecting the same external target should be serializable when concurrent mutation could create conflicting state.

The reference `KeyedLock` is process-local and is not a distributed lock.

Production distributed runtimes must provide an appropriate distributed coordination adapter.

## Budgets and rate limits

Agent execution should be constrained by explicit budgets rather than uncontrolled loops.

Budgets may represent:

- tool calls;
- write operations;
- provider quota;
- token/cost budgets;
- workflow steps;
- retries.

The reference implementation is a fixed-window counter.

Provider rate limits and product budgets are related but distinct.

## Capability discovery

Available external capabilities should be discoverable without hardcoding every provider into domain logic.

The capability registry is provider-neutral and supports filtering by tool metadata.

A newly discovered provider capability is not automatically authorized.

## Multi-step workflows

A workflow is a sequence of individually safe actions.

Workflow orchestration does not weaken per-step safety.

Each consequential step still requires its normal policy, approval, execution, verification, audit, and recovery semantics.

When a later step fails:

- preserve completed state;
- compensate in reverse order where explicitly supported;
- never assume compensation is equivalent to rollback;
- surface unresolved partial state.

## Production boundary

The v0.2 reference implementation proves semantics, not distributed-systems guarantees.

A production profile must explicitly choose durable storage, distributed locking, clock source, quota backend, and workflow persistence appropriate to its deployment environment.
