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
