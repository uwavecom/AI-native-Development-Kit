# Cloudflare Production Profile

## Status

Reference production profile for AI-native Development Kit v0.2.

This profile maps provider-neutral runtime contracts onto current Cloudflare primitives without making Cloudflare part of the core runtime.

## Mapping

| Development Kit concern | Cloudflare primitive |
| --- | --- |
| Durable approval state | SQLite-backed Durable Objects |
| Per-target serialization / coordination | Durable Object instance |
| Durable audit / workflow history | D1 |
| Execution budgets / rate limits | Workers Rate Limiting binding |
| Async workflow delivery | Cloudflare Queues |
| Retry exhaustion | Dead Letter Queue |
| Edge execution | Workers |

## Architecture

```text
Agent / Product
      ↓
Core safe-action runtime
      ↓
Cloudflare profile ports
      ├─ ApprovalCoordinator → Durable Object
      ├─ AuditStore          → D1
      ├─ BudgetGate          → Rate Limiting binding
      └─ WorkflowQueue       → Queues + DLQ
```

The core runtime must not import Cloudflare-specific modules.

## Why Durable Objects for approvals

Approval consumption and target-level coordination require atomic state changes.

A Durable Object provides one logical coordination point per object identity and durable transactional storage.

Use an object identity derived from a stable scope such as:

```text
tenant + resource + target
```

Do not derive identities from untrusted display labels.

## Why D1 for audit

Audit history is append-oriented and query-oriented rather than a coordination primitive.

D1 is a better fit for:

- audit events;
- workflow history;
- reporting;
- operational investigation.

Coordination-critical approval claims should not depend on eventually racing independent Worker instances.

## Rate limiting

Use Workers Rate Limiting for provider/account/user call gates.

Product budgets and provider limits remain separate concepts even if both use the same underlying adapter shape.

## Queues

Queues are appropriate for asynchronous workflow continuation.

Consumers must be idempotency-aware because retries and batch redelivery can occur.

Configure a Dead Letter Queue for workflows where exhausted retries must remain inspectable instead of disappearing.

## Production requirements

A real implementation must define:

- bindings and Wrangler configuration;
- D1 migrations;
- Durable Object schema and migrations;
- queue names and DLQ;
- observability/logging;
- secrets and OAuth bindings;
- environment separation;
- deployment verification.

This profile intentionally keeps those deployment choices outside the core runtime.
