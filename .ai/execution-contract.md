# Execution Contract

## Status

Version: 0.1

This contract defines the runtime behavior after an AI-initiated action has been authorized.

The purpose is to make external side effects safe, observable, verifiable, and recoverable.

## 1. Canonical execution lifecycle

```text
DECIDE
→ APPROVE
→ EXECUTE
→ VERIFY
→ AUDIT
→ RECOVER
```

Execution must not bypass the decision layer.

## 2. Execution states

A consequential action should resolve through explicit runtime states:

- `PENDING`
- `EXECUTING`
- `SUCCEEDED`
- `FAILED`
- `UNKNOWN`
- `VERIFICATION_FAILED`

`UNKNOWN` is a first-class state.

It means the runtime cannot determine whether the provider executed the side effect.

## 3. Retry safety

Retries must depend on both:

- tool idempotency metadata;
- observed execution state.

Rules:

- confirmed provider rejection may be retried according to policy;
- transport failure before request dispatch may be retried according to policy;
- timeout after dispatch must be treated as `UNKNOWN`;
- non-idempotent writes in `UNKNOWN` state must not be retried blindly;
- destructive actions must not be automatically retried from unknown state.

## 4. Verification

Write/destructive/high-risk operations should define a verification strategy.

Preferred pattern:

```text
execute
→ provider response
→ independent state read
→ compare with intended state
```

Verification may return:

- verified success;
- verified failure;
- unknown/inconclusive.

## 5. Audit

A consequential execution should emit structured events:

- proposed;
- policy_decided;
- approval_required;
- approved;
- execution_started;
- execution_succeeded;
- execution_failed;
- execution_unknown;
- verification_succeeded;
- verification_failed;
- recovery_started;
- recovery_completed.

Audit must not expose secrets unnecessarily.

## 6. Recovery

Recovery is not synonymous with rollback.

Possible recovery strategies include:

- verify current state;
- retry safely;
- compensate;
- rollback;
- request human intervention;
- mark unresolved.

Every write/destructive tool should declare enough policy to choose a safe recovery path.

## 7. Provider truth

The runtime must not claim success based only on model intent.

Provider-observed state is authoritative for external side effects.

## 8. Partial completion

Multi-step actions must preserve partial completion.

Do not report an aggregate success when only some external steps succeeded.

## 9. Error normalization

Provider-specific errors should be translated into stable runtime classes where useful:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `RATE_LIMITED`
- `DEPENDENCY_ERROR`
- `TIMEOUT`
- `UNKNOWN_EXECUTION_STATE`
- `VERIFICATION_FAILED`
- `INTERNAL_ERROR`

## 10. Agent rule

An agent must never convert:

- timeout into failure;
- timeout into success;
- missing verification into success;
- partial completion into total completion;
- model expectation into provider truth.
