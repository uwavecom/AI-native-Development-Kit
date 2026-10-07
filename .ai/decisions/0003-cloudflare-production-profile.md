# ADR 0003 — Cloudflare production profile

## Status

Accepted as a reference production profile.

## Context

The v0.2 runtime defines provider-neutral semantics for durable state, coordination, budgets, capability discovery, and multi-step workflows.

A production-like deployment profile is needed to prove that those contracts map onto real distributed infrastructure without leaking vendor APIs into the core runtime.

## Decision

Use Cloudflare as the first reference production profile.

Mapping:

- SQLite-backed Durable Objects for approval consumption and per-target coordination;
- D1 for durable audit/workflow query state;
- Workers Rate Limiting binding for execution/provider call budgets;
- Cloudflare Queues for asynchronous workflow continuation;
- Dead Letter Queues for exhausted retries;
- Workers as the execution environment.

Cloudflare-specific code lives under `profiles/cloudflare/`.

The core runtime must remain provider-neutral.

## Consequences

This validates the architecture against a real distributed platform while preserving portability.

It also makes explicit that the zero-dependency reference adapters in core are semantic examples, not production infrastructure.

## Non-goals

This ADR does not select:

- a specific Cloudflare account topology;
- production database names;
- secrets;
- OAuth credentials;
- deployment regions;
- pricing plan;
- customer-specific quotas.

Those belong to deployment configuration, not the Development Kit architecture.
