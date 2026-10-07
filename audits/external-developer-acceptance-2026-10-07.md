# External Developer Acceptance Review — 2026-10-07

## Goal

Evaluate the repository as if a developer with no prior project context opened it for the first time.

The acceptance question is:

> Can a developer understand the value, run the project, discover the public API, and protect a consequential tool call without reading the internal architecture history?

## What works

- README now leads with the user problem and product value.
- The executable quickstart runs without runtime dependencies.
- The public API is small: `createActionGuard()` and `createSignedApprovalAuthority()`.
- OpenAI Agents SDK and MCP adapters expose framework interoperability without adding framework dependencies.
- Security boundaries are explicit.
- Consequential actions have clear execution and verification semantics.
- Package exports are now tested through Node package self-reference, approximating how a consumer imports the package.

## Adoption blockers found

### 1. The repository/package is not publicly distributable yet

The package is intentionally still `private: true`.

There is no open-source license.

This is correct for now, but it means external adoption cannot begin yet.

**Release gate:** choose a license, make the repository accessible, then decide whether to publish to npm.

### 2. A repository clone was the only concrete install path

The README described the API but did not clearly state that npm installation is not available yet.

**Fixed:** README and getting-started documentation now make distribution status explicit.

### 3. Package exports were not consumer-tested

CI exercised source-relative imports, but that does not prove the documented package export map works.

**Fixed:** `test/package-surface.test.mjs` imports:

- `ai-native-development-kit`
- `ai-native-development-kit/openai-agents`
- `ai-native-development-kit/mcp`

using Node package self-reference.

### 4. Production boundaries needed to be visible earlier

The signed approval authority is intentionally single-process. A user could otherwise mistake it for a distributed production approval service.

**Fixed:** README now links the production warning prominently and the getting-started guide includes a production checklist.

## Current acceptance status

### Understand value

PASS.

A new developer can identify the project as a portable action-governance layer rather than another agent framework.

### Run locally

PASS.

`node examples/quickstart.mjs` and `npm run verify` form a minimal zero-dependency path.

### Import public API

PASS, subject to CI.

Package self-reference now validates the documented export surface.

### Protect a tool call

PASS at reference-library level.

The quickstart demonstrates proposal → trusted approval → execute → verify.

### Integrate with a framework

PASS at adapter-contract level.

OpenAI Agents SDK and MCP adapters are present and documented.

A real external application remains the next validation step.

### Production-ready out of the box

NO — intentionally.

Remaining deployment responsibilities include durable approval authority, real identity/session binding, durable audit state where needed, provider verification, and concurrency guarantees.

## Release gates before external adoption

1. Select an open-source license.
2. Make the intended repository or OSS core publicly accessible.
3. Decide whether npm publication is useful.
4. Run one real external integration using the OpenAI adapter.
5. Run one real MCP integration.
6. Give the repository to at least one developer who has not worked on it and observe whether they can complete the quickstart without assistance.

## Verdict

The repository is no longer merely an architecture notebook.

It has a coherent public API, executable onboarding path, security model, framework adapters, and acceptance tests.

The remaining barrier to external value is now primarily **distribution and real-world user validation**, not missing core architecture.
