# Approval Contract

## Status

Version: 0.1

This contract defines how approval is represented and evaluated for AI-initiated actions.

## 1. Decision outcomes

Every proposed external action must resolve to exactly one of:

- `ALLOW`
- `REQUIRE_APPROVAL`
- `DENY`

The decision must be explainable from policy inputs.

## 2. Approval scope

An approval must bind to the concrete action being authorized.

At minimum:

- actor;
- tool/capability;
- action;
- target;
- material parameters;
- scope;
- expiration or one-shot semantics where applicable.

Material changes invalidate the approval.

## 3. Separation of recommendation and execution

Analysis, recommendation, preview, planning, and drafting do not imply permission to execute.

Execution authority must be evaluated independently.

## 4. Default policy

Default behavior:

- low-risk read → ALLOW;
- medium-risk read/write → ALLOW only if product policy permits;
- high-risk write/destructive → REQUIRE_APPROVAL;
- critical actions → REQUIRE_APPROVAL or DENY according to product policy;
- missing permission → DENY;
- malformed/unknown tool policy → DENY.

## 5. Approval freshness

Approvals should be consumed as close as practical to execution.

Long-lived or reusable approvals must be explicit and narrowly scoped.

## 6. Unknown execution state

If execution state is unknown after timeout/failure:

- do not ask for approval again blindly;
- verify current provider state first;
- do not retry destructive actions automatically.

## 7. Audit

Every approval decision for write/destructive/high-risk actions should emit an audit record containing:

- decision;
- reason;
- actor;
- capability;
- target;
- approval reference if used;
- timestamp.

## 8. Product policy precedence

Product-specific policy may be stricter than this contract.

It must not silently weaken high-risk defaults without an explicit architecture decision.
