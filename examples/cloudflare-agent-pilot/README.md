# Cloudflare Agents SDK pilot (no deployment)

This example uses the official [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/runtime/agents-api/) `Agent` subclass with an embedded SQLite task store, plus the AI-native Development Kit's permission/approval/verification boundary.

## Scope and security

- `agent.ts` is the Cloudflare SDK integration; `guarded-task.mjs` is independently testable without a Cloudflare account.
- HTTP only serves a read-only status. The mutation entrypoint `executeTrustedTask` is for **trusted server-side calls**, not public RPC or an LLM tool.
- The caller must obtain a signed approval from a **separate authenticated authority** and supply it without letting a model forge it. No public approval endpoint is provided.
- The reference signed authority has in-memory replay state and is NOT suitable for horizontally scaled or restarted production execution. Use a durable single-use credential authority (for example a properly integrated Durable Object) before shipping.
- `this.sql` stores only demo tasks. No user identity/authentication or real external tools are bundled.
- Node crypto compatibility may be required for the current reference authority. A production deployment must validate Workers compatibility, dependency bundling, secret management, and storage security separately.

## Verification

From repository root:

```sh
node --test test/cloudflare-agent-pilot.test.mjs
npm run verify
```

A separate CI job installs the official `agents` SDK and runs `tsc` against the adapter.

No production deployment, Wrangler configuration, AI model, or Cloudflare credentials are included.

## Architecture

```text
Trusted server application / authenticated approval authority
    | approved, action-bound credential
    v
Cloudflare TaskAgent (official Agents SDK / Durable Object / SQLite)
    | executeTrustedTask()
    v
AI-native Development Kit guard -> checked invocation -> read-after-write verify
```

This is an **SDK integration pilot**, not a complete autonomous agent application or production-ready approval system.
