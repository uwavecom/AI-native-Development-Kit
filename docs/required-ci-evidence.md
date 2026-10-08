# Factory Workflow v1.1: Required GitHub checks pilot

The earlier example accepts a single successful workflow run. That is insufficient
for release gates: a repository may require several distinct CI check runs.

`verifyRequiredGithubChecks` in `examples/required-github-checks.mjs` reads a
same-repository PR, checks named GitHub Actions check runs on the exact PR head SHA,
rejects missing/failed/pending/ambiguous checks, then re-reads the PR to catch
a changed head. The set of required check names MUST be supplied by a trusted
repository configuration, not by a model or an untrusted PR author.

**Limitations:** This is read-only evidence, not merge permission. It is not a
replacement for GitHub branch protection/rulesets or the existing ActionGuard
trusted-approval lifecycle. A merge adapter must revalidate checks and expected
head SHA at the final provider operation. Check-run names can be duplicated and
the demo conservatively rejects duplicates. The current pilot supports at most
1000 check runs and only same-repository PRs targeting main. It does not attest
workflow file provenance or establish trusted human identity.

Run `npm run verify` for deterministic tests; GitHub CI also exercises the
integrated project checks.
