# Architecture Validation Report — Reference Agent Runtime

## Scope

This validation composes the Development Kit end to end using deterministic GitHub and TradingView provider simulations.

The objective is to test architectural composition, not network/provider availability.

## Scenarios validated

### TradingView

```text
symbol discovery
→ market analysis
→ action proposal
→ external approval service
→ create alert
→ verification
→ audit/recovery
```

### GitHub

```text
read file
→ create branch
→ update file
→ create pull request
→ request merge approval
→ merge
```

## Failure injection validated

- timeout after dispatch with provider state already mutated;
- missing approval at a consequential workflow step;
- action-budget exhaustion;
- partial workflow state.

## Important architecture finding

The first reference-agent implementation incorrectly minted `ApprovalReceipt` objects inside the agent itself.

That violated the trust model: an agent must be able to request approval, but must not be the authority that issues trusted human approval.

The reference was corrected so approval issuance now lives behind an external `requestApproval(proposal)` boundary.

The agent:

- creates the canonical proposal;
- presents/requests that proposal for approval;
- receives either a bound approval receipt or no approval;
- cannot manufacture the receipt itself.

This is a material validation result and should become a permanent architecture invariant.

## What held up

The following v0.1/v0.2 primitives composed without domain-specific safety branches:

- canonical action signatures;
- tool metadata;
- permission checks;
- risk policy;
- bound approvals;
- execution;
- verification;
- unknown-state recovery;
- audit;
- budgets;
- workflow stopping semantics.

The same runtime works across market-data and source-control domains.

## Remaining gaps

The reference demonstrates semantics but not:

- real human approval UI/session binding;
- cryptographic or server-issued approval authenticity;
- durable workflow resume after process restart;
- distributed tracing/correlation ids;
- policy versioning;
- multi-party approvals;
- real provider capability drift.

These are candidates for future versions only if justified by production validation.

## Conclusion

The architecture passes the first composition test with one important correction: approval issuance must be outside the agent trust boundary.

The kit is ready for continued validation against real deployment profiles without adding new core abstractions prematurely.
