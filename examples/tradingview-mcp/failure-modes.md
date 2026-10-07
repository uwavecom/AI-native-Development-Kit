# TradingView MCP Failure Modes

The purpose of this file is to convert a real MCP integration into reusable runtime rules.

## 1. Unresolved symbol

Risk: the agent guesses an exchange-qualified ticker.

Rule:

```text
unresolved identity → search/resolve → use returned identifier
```

Never silently substitute a similarly named asset.

## 2. Invalid screener field

Risk: model invents a field name.

Rule: use `get_screener_columns` before advanced screener queries when the field is not already known from trusted schema.

## 3. Opaque document identifier

Risk: model fabricates or edits a document view id.

Rule: only use ids returned by the provider.

## 4. Rate limiting

Risk: repeated research loops trigger throttling.

Runtime behavior:

- map to `RATE_LIMITED`;
- preserve retry metadata if available;
- avoid immediate uncontrolled retries;
- cache stable discovery results when safe.

## 5. Partial data

TradingView can return partial or missing screener results.

Rule:

```text
partial != complete
missing != zero
provider unavailable != asset absent
```

Agent conclusions must carry that uncertainty forward.

## 6. Timeout on write

Risk: create/update request times out after the provider may already have executed it.

Rule:

1. mark execution state unknown;
2. do not blindly retry;
3. query current state;
4. decide whether a retry is safe from observed state.

## 7. Delete operations

Deletion of watchlists or alerts is treated as destructive.

Required:

- trusted authorization;
- explicit approval unless product policy is stricter/prohibits;
- target-specific approval;
- verification of absence;
- audit event.

## 8. Successful response without verification

Risk: the provider acknowledges a mutation but state differs from expectation.

Rule: for consequential actions, prefer read-after-write verification.

## 9. Model inference presented as provider fact

Risk: the agent merges market data and interpretation.

Required output separation:

```text
Observed
Inferred
Recommended
Executed
```

This distinction should be reusable across all tool-driven domains.

## 10. Capability drift

MCP servers can add or change tools.

Rule:

- discover capabilities when the client supports it;
- treat provider tool schemas as versioned external contracts;
- keep application policy in our own Tool Contract and Action Policy;
- never infer that a newly available write tool is automatically allowed.
