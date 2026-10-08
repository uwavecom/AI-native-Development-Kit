# v0.3.0 Release Notes

AI-native Development Kit v0.3.0 is the first public OSS-ready release.

The release focuses on one problem:

> How do you let an AI agent perform real actions while keeping those actions policy-controlled, approval-bound, verifiable, and auditable?

## Start here

```bash
git clone https://github.com/uwavecom/AI-native-Development-Kit.git
cd AI-native-Development-Kit
npm run verify
node examples/quickstart.mjs
```

## Main public API

- `createActionGuard()`
- `createSignedApprovalAuthority()`
- `createOpenAIAgentsToolAdapter()`
- `createMcpToolCallGuard()`

## Verified integrations

CI validates the adapters against pinned real SDK packages for:

- OpenAI Agents SDK;
- MCP TypeScript SDK v2.

## Security note

The bundled signed approval authority is a single-process reference implementation.

For distributed production deployments, provide a durable approval authority with trusted identity and atomic claim/consume semantics.

See `SECURITY.md` before production use.

## Distribution

The repository is Apache-2.0 licensed and package metadata is prepared for npm publication.

The first GitHub release may be published independently of npm. npm publication should happen only after the public repository and release surface have been reviewed.
