# Recovery Contract

## Status

Version: 0.1

This contract defines recovery after failed, unknown, or unverifiable agent-initiated actions.

## 1. Recovery outcomes

A recovery decision resolves to one of:

- `NO_RECOVERY_NEEDED`
- `VERIFY_STATE`
- `RETRY_SAFE`
- `COMPENSATE`
- `ROLLBACK`
- `HUMAN_INTERVENTION`
- `UNRESOLVED`

## 2. Unknown execution state

`UNKNOWN` must never be converted directly into success or failure.

Default order:

```text
UNKNOWN
→ VERIFY_STATE
→ if verified desired state: complete
→ if verified absent and retry is safe: RETRY_SAFE
→ if conflicting/partial state: COMPENSATE or HUMAN_INTERVENTION
→ otherwise: UNRESOLVED
```

## 3. Retry policy

Automatic retry is allowed only when both are true:

- the tool is explicitly idempotent or provider state proves the original action did not occur;
- product policy permits retry.

Destructive actions are never blindly retried from unknown state.

## 4. Compensation and rollback

Rollback restores the previous state directly.

Compensation performs a new action that semantically counteracts the first action.

They are not interchangeable.

Examples:

- delete newly created temporary resource → rollback;
- issue refund after completed charge → compensation.

## 5. Human intervention

Human intervention is required when:

- provider state remains ambiguous;
- recovery would itself be high-risk;
- compensation/rollback cannot be verified;
- the runtime lacks authority to repair the state;
- conflicting side effects occurred.

## 6. Recovery verification

Recovery actions are consequential actions and must themselves pass:

```text
policy → approval when required → execution → verification → audit
```

Recovery is not a privileged bypass around normal guardrails.

## 7. Unresolved state

The runtime must be able to end in `UNRESOLVED`.

An unresolved action must:

- remain visible;
- retain audit history;
- identify the affected target;
- prevent unsafe automatic continuation where appropriate.

## 8. Agent rule

When recovery cannot prove a safe next step, stop and surface the unresolved state rather than improvising.
