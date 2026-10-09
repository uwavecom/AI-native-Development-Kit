# Cloudflare Agent Pilot — architecture review (2026-10-08)

## Decision

**Reference prototype, not production or a reusable plug-and-play SDK adapter.**
The pilot establishes compatibility with the official Cloudflare Agents SDK and
tests guarded local SQLite changes in Workers, but is not ready for use on
sensitive or external operations.

## Verified by tests

- Official `Agent` subclass starts in the local Workers runtime.
- A trusted server-side call can create and verify a SQLite task.
- A signed approval is bound to canonical proposal parameters.
- Replaying an already claimed approval does not rerun the write.
- Simulated lost acknowledgement does not cause automatic repeat.
- Read-only reconciliation distinguishes exact match, absence, mismatch,
  and failed inspection.

## Security review findings

1. **Fixed in this PR — proposal payload substitution (HIGH):**
   Previously, a caller could preserve an actionSignature while modifying
   proposal.params in a plain JavaScript object. The approval check compared
   only the supplied signature, while the invocation used modified params.
   The pilot now recalculates the canonical proposal signature and rejects
   mismatches before execution **and** reconciliation. Regression test added.
2. **Partially fixed — trust establishment and RPC (BLOCKER for public integration):**
   `executeTrustedTask` now constructs the signing verifier from server-side
   environment bindings, authenticates a shared demonstration service token,
   and derives a fixed service principal rather than accepting function objects
   or caller-supplied permission lists. Unauthenticated RPC is rejected.
   **Remaining gap:** a shared bearer token is not per-principal identity or
   scoped authorization. A real deployment must use authenticated, scoped,
   rotation-ready principals and must not make an LLM or user-controlled input
   a trusted caller.
3. **Open — distributed approval scope (BLOCKER for real external writes):**
   SQLite claim uniqueness applies only within one named Durable Object.
   A production integration must prove that every request for the same
   security principal/action is routed to the same coordinator, or delegate
   to a separately protected durable authority.
4. **Open — no atomic external exactly-once (BLOCKER for external writes):**
   Claiming an approval and calling an external API cannot be made atomic
   merely by recording a local SQLite claim. External side effects need an
   idempotency key and provider-specific reconciliation; conflicts and
   uncertain outcomes must stay available for human review.
5. **Open — deployment and lifecycle validation:** No restart/crash injection
   at the process level, authenticated HTTP write path, deployment, or live
   Cloudflare service integration is tested.
6. **Open — reproducible dependency resolution:** The CI demo installs the
   current SDK/tooling without a pinned lockfile. Before promoting this
   example, add a lockfile and a fixed compatible dependency matrix.

## Required promotion criteria

- No caller-supplied function objects or untrusted actor permissions crossing RPC.
- Protected secrets and explicit server-side caller identity.
- Coordinated durable approvals across all relevant agents/scopes.
- Recovery/idempotency contract for at least one real external operation.
- Restart and concurrency tests, deterministic dependency lockfile.
- Security review and documented deployment configuration.

No deployment or merge was performed during this audit.

## Named-agent scope check (2026-10-08)

The pilot now constructs write proposals with `scope.agentId` derived from the
server-side Durable Object `this.name`. A signed credential issued for one
named agent cannot authorize another named agent's write. A Workers integration
test attempts this cross-agent replay. This is *approval scope binding*, not
full distributed coordination or revocation: there is still a shared demo
service token and separate per-object SQLite claim records. A centrally
coordinated revocation mechanism and server-authenticated per-principal access
must be designed before production use.

## Shared coordinator prototype (2026-10-08)

A single `PilotApprovalCoordinator` Durable Object now owns global credential proof claims and pre-claim revocations across all named agents in this pilot. Its SQLite unique key decides claim vs revoke. Tests cover a revoked-but-unclaimed approval rejected by the target agent. **Still blocked for production:** authenticated per-principal administration and revocation, hardened separation of caller/revoker authority, a safe approval issuance UI, external provider idempotency, and a complete restart/concurrency evaluation. The test bearer token alone is not acceptable governance.

## Capability separation and concurrency check (2026-10-08)

The coordinator now uses separate test-only tokens for claims and revocation. These tokens intentionally demonstrate two distinct privileges and do not implement end-user authentication, principal-scoped policies, or issuance workflows. Workers integration tests concurrently claim the same proof and race a claim against revocation. Exactly one of claim/revoke can win for an unclaimed proof. **This remains a prototype:** the single global coordinator can become a scalability bottleneck; no full process restart, abuse rate limit, credential issuance governance or provider-integrated idempotency tests have been completed. Promotion to production remains blocked.

## Publication gate (2026-10-08)

**Disposition: NO MERGE into the recommended public reference yet. No
deployment.** A successful CI run verifies this example's current tests;
it does not substitute for a production security assessment.

- **Done:** one concrete GitHub Issues adapter, strict allowed repository,
  bound signed proposal, guarded execution, post-write verification, mocked
  loss-of-acknowledgement tests, and wiring into trusted Agent RPC.
- **Done:** centralized proof claim/revocation coordinator, separate
  demonstration claim/revocation tokens, named-agent scope checks, and
  concurrency tests within local Workers runtime.
- **Done:** `QUICKSTART.md` explains clean-checkout verification and secret
  boundaries, and `README.md` has been aligned with the code.
- **Addressed — dependency resolution:** Cloudflare CI now uses `npm ci`
  against a committed npm lockfile. Remaining supply-chain security work
  includes dependency auditing, version compatibility policy, and GitHub
  Actions pinning to immutable commits.
- **Blocking — security identity:** shared bearer credentials are not
  principal-scoped authorization or an audited human approval workflow.
- **Blocking — live provider semantics:** no end-to-end GitHub App installation
  token lifecycle, fully authenticated issuance, or provider-specific
  recovery protocol has been verified.
- **Blocking — lifecycle:** no worker process restart or real crash recovery
  testing of a live external operation has been completed.

It is suitable for local evaluation in isolation, not for trusted external
writes. The existing PR should remain open until these gates are addressed.

## Dependency lockfile update (2026-10-09)

GitHub Actions generated the pilot's npm v3 lockfile in a one-off workflow.
That write-capable bootstrap workflow was removed immediately afterward.
The normal CI now runs `npm ci --ignore-scripts --no-audit --no-fund` and uses
versioned package scripts. This addresses repeatable dependency resolution,
but not a security review of the transitive dependency tree. The approval
identity and external-provider recovery gates above remain blocking.
