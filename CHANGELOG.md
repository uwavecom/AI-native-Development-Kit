# Changelog

## v0.3.0

First public OSS-ready release.

### Added

- `createActionGuard()` as the primary public API for governed agent actions.
- trusted approval authority with signed credentials and one-shot replay protection.
- policy and tool-contract provenance bound into canonical action signatures.
- OpenAI Agents SDK adapter.
- MCP tool-call governance adapter.
- executable quickstart and getting-started guide.
- security model and production trust-boundary guidance.
- package exports for core, OpenAI Agents, and MCP adapters.
- real SDK CI validation against pinned OpenAI Agents SDK and MCP TypeScript SDK v2 packages.
- Cloudflare reference production profile.
- end-to-end GitHub and TradingView reference-agent validation.

### Runtime semantics

- ALLOW / REQUIRE_APPROVAL / DENY decisions.
- explicit UNKNOWN execution state.
- post-action verification.
- safe recovery semantics.
- budgets and concurrency controls.
- durable reference approval/audit state.
- multi-step workflow semantics.

### Positioning

The project is a portable action-governance layer for consequential AI tool calls.

It is intentionally not an agent framework, durable workflow engine, memory system, or general observability platform.
