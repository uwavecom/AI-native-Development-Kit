# Tool Contract

## Status

Version: 0.1

This contract defines the minimum metadata and runtime expectations for tools invoked by AI agents.

The goal is to make tool use predictable, reviewable, and safe across vendors and domains.

## 1. Canonical metadata

Every consequential tool should declare, directly or through a registry:

- `name`
- `purpose`
- `input_schema`
- `output_schema`
- `access`: `read | write | destructive`
- `risk_level`: `low | medium | high | critical`
- `required_permissions`
- `requires_approval`
- `side_effects`
- `idempotency`
- `retry_policy`
- `timeout_policy`
- `rate_limit_policy`
- `verification_strategy`
- `rollback_strategy`
- `audit_events`

The registry is the source of truth. Secondary UI labels, approval prompts, audit formatting, and runtime policy should be derived from it where practical.

## 2. Discovery before execution

An agent must not guess vendor-specific identifiers, schemas, enum values, or opaque resource ids when the provider exposes a discovery mechanism.

Preferred flow:

```text
intent
→ discover schema/capabilities
→ validate requested operation
→ execute
→ verify
```

Examples include symbol search, supported column discovery, resource lookup, and provider capability inspection.

## 3. Access classes

### Read

No external mutation. May normally execute autonomously when authorized.

### Write

Changes external or persistent state but is expected to be reversible or low-consequence.

### Destructive

Deletes, publishes, charges, sends, executes, exposes, or otherwise creates a meaningful external effect that may be difficult to reverse.

The access class is not a complete risk model. A read tool may still be high-risk when it exposes sensitive data.

## 4. Approval

Approval policy is defined in `.ai/action-policy.md`.

A tool definition must not silently downgrade an operation that is externally consequential.

Approval should bind to the actual operation being executed: target, action, important parameters, and scope.

## 5. Idempotency and retries

Every write or destructive tool should state whether repeating the same call is safe.

Retry behavior must distinguish:

- transport failure before execution is known;
- provider rejection;
- timeout with unknown execution state;
- partial success;
- confirmed success.

Unknown execution state must not be treated as safe-to-retry by default.

## 6. Verification

Consequential actions should have a verification path where practical.

Examples:

- create resource → fetch resource;
- update state → read state;
- publish/send → obtain provider receipt;
- delete resource → confirm absence;
- alert creation → list or fetch alert.

A tool response that merely reports `success: true` is not always sufficient verification.

## 7. Partial results

Tools must preserve uncertainty.

Do not convert:

- missing data into zero;
- provider errors into empty success;
- partial result sets into complete result sets;
- unresolved identifiers into fabricated identifiers.

Partial success should be represented explicitly.

## 8. Rate limits and backpressure

Rate limits are provider constraints, not business logic.

Adapters should translate provider throttling into stable application/runtime errors such as `RATE_LIMITED`, while retaining retry metadata where available.

Agents should avoid wasteful repeated discovery or polling when stable results can be cached safely.

## 9. Auditability

For write, destructive, security-sensitive, or high-risk tool calls, record enough structured context to reconstruct:

- who or what initiated the call;
- tool name;
- target;
- authorization scope;
- approval reference when required;
- normalized input summary;
- execution outcome;
- verification outcome;
- provider correlation id when available;
- timestamp.

Do not log secrets or sensitive payloads unnecessarily.

## 10. Vendor isolation

Vendor-specific tool names and schemas belong in adapters/integration descriptors.

Application decisions should prefer domain capabilities such as:

```text
MarketResearchPort
AlertManagementPort
RepositoryPort
DeploymentPort
```

rather than allowing vendor tool names to spread through domain logic.

## 11. Agent rule

An AI agent should be able to answer before executing a tool:

1. What capability am I invoking?
2. Is this read, write, or destructive?
3. What permission is required?
4. Does this require approval?
5. Is retry safe?
6. How will I verify success?
7. What should be audited?
8. What uncertainty remains?

If those answers are not discoverable, the integration is incomplete.
