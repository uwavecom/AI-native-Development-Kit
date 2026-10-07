# TradingView MCP Reference Case

## Purpose

This is a live external-system case study used to stress-test the AI-native Development Kit.

It is not a trading product and does not endorse autonomous trading.

The case is based on TradingView's official MCP server documentation as reviewed on 2026-10-07.

Official server:

```text
https://mcp.tradingview.com/mcp
```

Authentication: OAuth 2.1.

## Why this case matters

TradingView exposes a useful mix of:

- schema/capability discovery;
- read-only research tools;
- reversible write actions;
- deletions;
- rate limits;
- partial results;
- provider-owned identifiers;
- user-owned resources.

That combination makes it a strong reference for designing generic agent/tool guardrails.

## Representative workflow

```text
user intent
→ resolve symbol
→ discover available fields when needed
→ fetch market/fundamental/news/document data
→ reason over evidence
→ propose optional action
→ policy check
→ approval when required
→ execute
→ verify
→ audit
```

## Reference agent

A minimal Market Research Agent can answer:

> Analyze NVDA and tell me whether anything unusual is happening.

Possible read-only tool sequence:

1. `search_symbols`
2. `get_ohlcv`
3. `get_technicals_rating`
4. `get_financials`
5. `get_forecasts`
6. `get_news`
7. `get_documents`

If it proposes creating an alert, the workflow crosses from analysis into an external write action and must pass the Action Policy.

## Boundaries

This reference case intentionally separates:

```text
evidence acquisition
→ reasoning
→ proposed action
→ approved execution
```

The LLM must not blur provider data, model inference, and executed side effects.

## Findings for the Development Kit

The existing Architecture Contract already covers:

- external systems as infrastructure;
- explicit side effects;
- authorization;
- observability;
- controlled error taxonomies.

The TradingView case exposed missing first-class guidance for:

- tool risk metadata;
- approval binding;
- idempotency;
- retry semantics;
- post-action verification;
- partial/unknown execution state;
- audit requirements for agent actions.

Those concerns are now defined in:

- `.ai/tool-contract.md`
- `.ai/action-policy.md`

See `tool-taxonomy.md` and `failure-modes.md` for the concrete mapping.
