# Factory Workflow v1.2 — GitHub PR handoff pilot

This pilot delivers a **real, useful read-only feature**: given a Pull Request
and a trusted set of required check names, it prepares an evidence-backed factory
review handoff. It never merges, self-approves, or bypasses branch protections.

## Use
Call `prepareFactoryReview()` from `examples/factory-e2e-pilot.mjs` with
`owner`, `repo`, `prNumber`, `requiredChecks`, `goal`,
`acceptanceCriteria`, and (optionally) a trusted `fetchImpl` for GitHub API
access. Without a supplied fetch function, the verification helper uses native
fetch; private repositories need an authorized host-side implementation.

When all trusted required CI checks pass for the same PR head commit, the
outcome is `AWAITING_HUMAN` with a review URL and a trace of state transitions.
When evidence is missing, failed, or stale, the outcome is `CI_BLOCKED`
with no progress beyond `SPEC`.

## What this proves and does not prove
- Proves an end-to-end software **integration slice** from PR metadata through
  GitHub check-run correlation into the provider-neutral factory state contract.
- Has deterministic tests for success, failed CI, and stale PR commit.
- Does **not** prove an AI coding agent can autonomously implement arbitrary
  features. No coding-agent execution, trusted approval provider, durable state,
  or production merge orchestration is part of this pilot.
- Never use untrusted agent-supplied `requiredChecks` as a policy. A host must
  establish required checks and enforce GitHub rulesets.
- Factory state currently records **references** to evidence; the read-only
  GitHub verifier is responsible for fetching and correlating those references.

## Validation
`npm run verify` covers all tests and repository guardrails.
An actual PR can be inspected read-only via the GitHub API, but automated merge
remains deliberately out of scope.
