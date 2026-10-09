# Cloudflare Agent Pilot — reproducible usage guide

## What you can verify today

This is a **development-only** reference. It is not a ready-to-deploy service,
nor a UI for granting human approvals. It has **zero live external API calls**
in its automated tests.

Use Node.js 24 and an ordinary repository checkout.

```sh
# Repository root: portable runtime, guardrails, and mocked GitHub API behavior
npm run verify

# Cloudflare pilot: install the integration dependencies used by GitHub CI
cd examples/cloudflare-agent-pilot
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
```

**Important:** the pilot now commits an npm lockfile and CI uses `npm ci`.
This makes package resolution repeatable; it does not, by itself, establish
supply-chain trust, pin GitHub Actions by immutable SHA, or audit dependencies.
The separate `integration/real-sdk` project has its own dependencies and
verification workflow.

## What the example does

- `TaskAgent` extends the official Cloudflare Agents SDK class.
- SQLite records demo tasks; the shared `PilotApprovalCoordinator` handles
  single-use approvals and pre-claim revocation.
- The task operation is high-risk, signed, tied to a named agent, and verified
  after a write.
- `github-issue.mjs` demonstrates how to send a GitHub Issues POST and verify
  the response using GET, with repository allowlisting.
- Node tests inject a **fake fetch**. They do not create issues on GitHub.
- `executeTrustedGitHubIssue` is a protected *server-side method*, not an
  authenticated public HTTP write endpoint.

## Secrets, identity, and boundaries

`wrangler.test.jsonc` contains **test-only values**. Never copy them into a
live service.

A live design would need privately configured secrets
`PILOT_SIGNING_SECRET`, `PILOT_CALLER_TOKEN`,
`PILOT_REVOKER_TOKEN`, `GITHUB_ISSUES_TOKEN`, and
`GITHUB_ALLOWED_REPOSITORY`. The GitHub token should be a short-lived GitHub
App installation token limited to a dedicated test repository, never a broad
personal token. None of these secrets are necessary to run the mocked tests.

The built-in caller/revoker tokens are shared demonstration capabilities,
**not scoped user identity or production authorization**. The demo can
construct an approval verifier, but it does not provide a safe real-world
human approval issuance or account-administration workflow.

Never run the example against real repositories until the blocking risks in
`AUDIT.md` are resolved, reviewed, and authorized.

## Troubleshooting

- `UNAUTHORIZED_RPC`: missing or incorrect test caller token.
- `GITHUB_INTEGRATION_NOT_CONFIGURED`: required GitHub bindings not supplied.
- `APPROVAL_PROPOSAL_MISMATCH`: credential is signed for a different payload
  or named agent.
- `APPROVAL_ALREADY_CONSUMED`: this approval has already been claimed.
  Do not retry the external POST.
- `APPROVAL_REVOKED`: coordinator revoked approval before the claim.
- `UNKNOWN`: the observed final state could not be reliably established.
  Inspection and human review are needed, not automatic retries.

No deployment or GitHub issue creation is required for this quickstart.
