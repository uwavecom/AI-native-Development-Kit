# ADR 0001 — Agent-safe action runtime

## Status

Accepted.

## Context

The original Development Kit defined architectural boundaries, authorization, explicit side effects, observability, and replaceable external providers.

Testing the architecture against TradingView MCP and GitHub actions exposed a missing class of invariants specific to AI-initiated tool use:

- tool risk metadata;
- distinction between read/write/destructive actions;
- approval binding;
- approval freshness and one-shot use;
- safe handling of non-idempotent retries;
- unknown execution state after dispatch timeout;
- independent post-action verification;
- recovery without bypassing policy;
- structured audit events.

A documentation-only rule would not be sufficient because these failures can arise dynamically at runtime.

## Decision

The Development Kit adopts a generic agent-safe action lifecycle:

```text
PROPOSE
→ DECIDE
→ APPROVE
→ EXECUTE
→ VERIFY
→ AUDIT
→ RECOVER
→ RESOLVE or HUMAN_INTERVENTION
```

The implementation is provider-neutral.

Canonical runtime primitives:

- `runtime/action-proposal.mjs`
- `runtime/action-decision.mjs`
- `runtime/execute-action.mjs`
- `runtime/recover-action.mjs`
- `runtime/safe-action.mjs`

Canonical policy documents:

- `.ai/tool-contract.md`
- `.ai/action-policy.md`
- `.ai/approval-contract.md`
- `.ai/execution-contract.md`
- `.ai/recovery-contract.md`

The executable Tool Contract guard is enforced in `npm run verify`.

Recovery actions such as rollback or compensation are not privileged. They must pass the same policy, approval, execution, verification, and audit path as ordinary actions.

## Alternatives considered

### Documentation only

Rejected because it cannot prevent approval laundering, unsafe retry, or policy-bypassing recovery.

### Vendor-specific runtimes

Rejected because the same invariants apply to TradingView, GitHub, Cloudflare, payments, messaging, and other external systems.

### Autonomous retry/rollback framework

Rejected as the default because unknown provider state and non-idempotent actions make unconditional automation unsafe.

## Consequences

Positive:

- one policy model can govern multiple domains;
- consequential actions become machine-checkable;
- timeout ambiguity is preserved rather than guessed away;
- approvals are bound to canonical action proposals;
- recovery cannot bypass the normal security path;
- AI agents have one predictable action lifecycle.

Costs:

- integrations must declare more metadata;
- write operations require verification and recovery design;
- some unresolved cases intentionally end in human intervention;
- persistent products still need their own durable approval/audit stores.

## Non-goals

This runtime does not provide:

- durable workflow storage;
- distributed transactions;
- a universal rollback mechanism;
- vendor authentication;
- a UI for approvals;
- autonomous authorization escalation.

Those remain product/runtime-profile concerns.
