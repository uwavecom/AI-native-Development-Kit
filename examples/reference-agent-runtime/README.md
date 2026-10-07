# Reference Agent Runtime

## Purpose

This example proves that the Development Kit's runtime primitives compose into a coherent end-to-end agent execution model.

It is deliberately provider-simulated and deterministic. The goal is to validate architecture and failure semantics, not external service availability.

## Scenarios

### GitHub change workflow

```text
intent
→ fetch_file
→ create_branch
→ update_file
→ create_pull_request
→ merge_pull_request
```

The merge action requires bound approval.

### TradingView alert workflow

```text
intent
→ search_symbols
→ run_screener
→ propose create_alert
→ bound approval
→ create_alert
→ verify provider state
```

## Failure injection

The example covers:

- timeout after dispatch;
- duplicate approval use;
- budget exhaustion;
- partial workflow completion;
- compensation;
- human-intervention fallback.

## Architectural objective

A reference agent should not contain bespoke safety logic.

It should compose:

- capability discovery;
- canonical proposals;
- authorization/policy;
- approval;
- execution;
- verification;
- audit;
- recovery;
- workflow orchestration.

The example therefore serves as an executable architecture validation case.
