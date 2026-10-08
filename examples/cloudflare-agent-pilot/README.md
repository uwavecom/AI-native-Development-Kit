# Cloudflare Agents SDK pilot (no deployment)

This example uses the official [Cloudflare Agents SDK](https://developers.cloudflare.com/agents/runtime/agents-api/) `Agent` subclass with an embedded SQLite task store, plus the AI-native Development Kit's permission/approval/verification boundary.

## Scope and security

- `agent.ts` is the Cloudflare SDK integration; `guarded-task.mjs` is independently testable without a Cloudflare account.
- HTTP only serves a read-only status. The mutation entrypoint `executeTrustedTask` is an authenticated RPC experiment for **trusted server-side calls**, not a public HTTP tool or a model-facing action. It rejects calls without the test service token; it constructs its approval verifier from server-side environment bindings and derives an internal service principal rather than trusting caller-supplied permissions.
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

## RPC experiment and limitations

`PILOT_CALLER_TOKEN` and `PILOT_SIGNING_SECRET` are required server-side bindings for trusted task execution; neither is provided in the deployable `wrangler.jsonc`. Test-only sample values live in `wrangler.test.jsonc` and MUST NOT be reused outside tests. The single shared caller token demonstrates rejection of unauthenticated RPC but is **not** a per-user authentication/authorization solution. Do not expose the RPC method to untrusted Workers or to AI-generated inputs; production requires a scoped principal-bound authenticated invocation and server-controlled authorization. The signing key and approval issuance must stay on a separate trusted path.

## Centralized approval coordinator (pilot)

All named agents route one-shot claims to a single named `PilotApprovalCoordinator` Durable Object. A trusted coordinator RPC can mark a credential proof as `REVOKED` before it is claimed. A rejected or already-claimed proof cannot execute a new operation. The coordinator accepts only a test service token, not per-user identities; it does **not** provide production issuer authentication, role management, key rotation or end-to-end audit. Revocation after a claim does **not** reverse work already started, and revocation/claim races are ordered by coordinator storage, not by a human-facing approval UI. Never reuse the test token or secrets in production.

## Real provider example: GitHub Issues (mocked CI)

The standalone `github-issue.mjs` adapter demonstrates one real external REST
operation. It uses the official GitHub Issues endpoint, a repository allowlist,
a signed high-risk action proposal, one-shot approval claim, and read-after-write
verification via GET. Run `node --test test/cloudflare-github-issue.test.mjs`
from the repository root. All automated tests replace `fetch` with a mock:
**they do not create any real GitHub issue or use any live token**.

The adapter is wired into the TaskAgent's **trusted server-side RPC** method
`executeTrustedGitHubIssue`, but is not exposed as a public HTTP mutation route.
It refuses to run unless the Worker has `GITHUB_ISSUES_TOKEN` and
`GITHUB_ALLOWED_REPOSITORY` server-side bindings, in addition to its signing
secret and pilot caller credential. Nothing in CI provides these real secrets.
A production integration would still require a short-lived, repository-scoped
GitHub App installation token, authenticated caller identity, and review of
external API failure semantics. GitHub Issues creation is not
guaranteed idempotent: after a lost POST acknowledgement, never blindly retry;
use provider-specific reconciliation with human review. An `operationId` binds
approval intent only, and GitHub does not automatically deduplicate on that ID.
