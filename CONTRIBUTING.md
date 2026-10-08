# Contributing

Contributions are welcome.

## Before changing core semantics

Please keep the project focused on portable action governance.

The core should not become:

- an agent framework;
- a workflow scheduler;
- a model abstraction layer;
- an observability platform;
- a provider-specific application.

New abstractions should solve a demonstrated cross-provider safety or interoperability problem.

## Development

Requires Node.js 22+.

Run:

```bash
npm run verify
```

A change should not be considered complete until the full verification suite passes.

## Security-sensitive changes

Changes involving approvals, authorization, replay protection, unknown execution state, retries, recovery, or external side effects should include regression tests.

Read `SECURITY.md` and the contracts under `.ai/` before changing these areas.

## Framework adapters

Keep core runtime dependencies minimal.

Framework-specific dependencies should normally live in isolated integration fixtures rather than becoming runtime dependencies.

## Pull requests

Prefer small changes with:

- the problem being solved;
- why it belongs in this project;
- tests;
- any security or compatibility implications.
