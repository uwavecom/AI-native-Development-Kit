# TradingView MCP Tool Taxonomy

This document maps representative TradingView MCP capabilities into the generic Tool Contract.

## Read-only discovery and research

| Capability | Representative tools | Access | Default risk |
| --- | --- | --- | --- |
| Symbol resolution | `search_symbols` | read | low |
| Screener schema discovery | `get_screener_columns` | read | low |
| Economic symbol discovery | `get_economic_symbols` | read | low |
| Market data | `get_ohlcv` | read | low |
| Screener | `run_screener`, `get_symbol_data` | read | low |
| Technicals | `get_technicals_rating` | read | low |
| Fundamentals | `get_financials`, `get_financial_history` | read | low |
| Forecasts | `get_forecasts` | read | low |
| News | `get_news`, `get_news_story` | read | low-medium |
| Documents | `get_documents`, `get_document_view` | read | low-medium |
| Calendars | earnings/economic/dividends calendar tools | read | low |
| Watchlist reads | list/get/active watchlist | read | low |

## Writes

| Capability | Representative tools | Access | Default risk | Verification |
| --- | --- | --- | --- | --- |
| Create watchlist | `create_watchlist` | write | medium | fetch/list watchlists |
| Modify watchlist | add/remove/update tools | write | medium | fetch watchlist |
| Delete watchlist | `delete_watchlist` | destructive | high | confirm absence |
| Create alert | alert creation tool | write | medium | list/fetch alert |
| Pause/restart/update alert | alert mutation tools | write | medium | fetch alert state |
| Delete alert | alert deletion tool | destructive | high | confirm absence |

## Discovery rule

Do not guess:

- `EXCHANGE:TICKER` identifiers;
- screener columns;
- economic symbols;
- document view ids.

Use provider discovery and returned opaque identifiers.

## Evidence rule

The agent should preserve provenance between:

- TradingView market/fundamental/news/document data;
- model-generated interpretation;
- user-approved external actions.

## Rate limit

The official documentation states a rate limit of approximately 100 tool calls per minute per user.

This should be represented as provider runtime policy, not embedded into domain logic.
