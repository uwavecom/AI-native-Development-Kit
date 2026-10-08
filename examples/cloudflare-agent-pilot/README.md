# Cloudflare Agents SDK pilot (no deployment)

This example uses the official [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/runtime/agents-api/) `Agent` subclass with an embedded SQLite task store, plus the AI-native Development Kit's permission/approval/verification boundary.

## Scope and security

- `agent.ts` is the Cloudflare SDK integration; `guarded-task.mjs` is independently testable without a Cloudflare account.
- HTTP only serves a read-only status. The mutation entrypoint `executeTrustedTask` is for **trusted server-side calls**, not public RPC or an LLM tool.
- The caller must obtain a signed approval from a **separate authenticated authority** and supply it without letting a model forge it. No public approval endpoint is provided.
- The pilot now wraps signed proof validation with atomic SQLite-backed one-shot claims inside the named Durable Object. The SQLite unique key survives authority reconstruction and is shared by calls routed to the same instance. Production use still requires routing all claims in a security scope to the same trusted Durable Object, authenticated issuer configuration, protected credential secrets, and an independently tested recovery protocol.
- The bundled signing authority uses a demo secret and in-memory replay tracking. Its replay protection is **not** relied upon for the Durable Object path; the persisted SQLite claim is. It is still not a production-grade credential service.
- `this.sql` stores only demo tasks. No user identity/authentication or real external tools are bundled.
- Node crypto compatibility may be required for the current reference authority. A production deployment must validate Workers compatibility, dependency bundling, secret management, and storage security separately.

## Verification

From repository root:

```sh
node --test test/cloudflare-agent-pilot.test.mjs
npm run verify
# In examples/cloudflare-agent-pilot after installing agents, vitest, wrangler and @cloudflare/vitest-plugin:
npx vitest run --config vitest.config.mts
```

A separate CI job installs the official `agents` SDK, runs `tsc`, and executes the integration specs in the Cloudflare Workers runtime with Vitest. The integration tests exercise HTTP handling, SQLite persistence across independent Durable Object interactions, and one-shot approval rejection. They exercise independent Agent calls and recreated signing authorities, but do not prove persistence across a full worker process restart, robust distributed approval coordination, or end-to-end recovery of partially executed external side effects.

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

## Lost acknowledgement fault injection

The Workers integration suite also simulates a committed SQLite write followed by a thrown `SIMULATED_LOST_ACK` before the caller receives a success response. It verifies that the execution is **not** reported as `SUCCEEDED`, the durable approval claim prevents a blind repeat on a separate interaction, and an explicit SQLite read can establish whether the side effect occurred. This simulation is **not** an actual Worker process kill; it does not establish durable recovery from every crash point or exactly-once semantics for external service calls. Such operations need provider-side idempotency and a separate reconciliation protocol.

## Read-only reconciliation

`reconcileTrustedTask(id, title)` inspects the Durable Object SQLite record without creating or changing any task. It returns `CONFIRMED` for an exact match, `ABSENT` if no row exists, `CONFLICT` for a different title, and `UNKNOWN` when inspection fails. Only `CONFIRMED` is resolved. Neither `ABSENT` nor `UNKNOWN` authorizes automatic retry: the approval may already be claimed, and external providers need independent idempotency/recovery contracts. A matching record is evidence of current state, not cryptographic proof that a particular attempt created it. This is a limited local-data reconciliation example, not a general recovery engine.
