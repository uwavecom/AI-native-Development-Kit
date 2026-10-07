# Agent Action Policy

## Status

Version: 0.1

This policy defines default execution rules for AI-initiated actions.

It complements the Architecture Contract and Tool Contract.

## 1. Default decision model

```text
READ
→ may execute autonomously when authorized

ANALYZE
→ may execute autonomously when authorized

WRITE / REVERSIBLE
→ execute according to product policy

WRITE / CONSEQUENTIAL
→ require explicit approval

DESTRUCTIVE / EXTERNAL EFFECT
→ explicit approval + verification + audit
```

## 2. Risk levels

### Low

Examples:

- fetch public market data;
- search documentation;
- run a read-only screener.

Default: autonomous.

### Medium

Examples:

- create or modify a private watchlist;
- create a reversible alert;
- update non-critical metadata.

Default: may be autonomous only when product policy explicitly allows it.

### High

Examples:

- delete user-created resources;
- publish externally;
- modify access or authorization state;
- trigger deployments or financially meaningful actions.

Default: explicit human approval.

### Critical

Examples:

- execute trades;
- transfer funds;
- expose secrets;
- irreversibly delete high-value data;
- change security controls.

Default: explicit approval immediately before execution, narrow scope, strong verification, full audit. Some products may prohibit autonomous execution entirely.

## 3. Approval binding

Approval must bind to the important semantics of the action.

At minimum:

- action;
- target;
- scope;
- material parameters;
- expected side effect.

Changing those after approval invalidates the approval.

## 4. No approval laundering

An agent must not convert a request to analyze, recommend, preview, or prepare into permission to execute.

Examples:

- “find good alerts” does not mean “create alerts”;
- “show deployment changes” does not mean “deploy”;
- “prepare a trade” does not mean “place a trade”.

## 5. Multi-step workflows

Approval should happen at the last practical point before the consequential side effect.

Read-only preparation may happen before approval.

Preferred:

```text
discover → analyze → prepare exact action → approve → execute → verify → audit
```

## 6. Reversibility is not enough

A reversible action may still require approval when it is:

- externally visible;
- security-sensitive;
- financially meaningful;
- high-volume;
- likely to surprise the user.

## 7. Failure handling

If execution returns an unknown state:

- do not claim success;
- do not retry destructive operations automatically;
- verify state first when possible;
- surface uncertainty explicitly.

## 8. Policy precedence

Product-specific policy may be stricter than this document.

It must not silently weaken high-risk defaults without an explicit architecture decision.
