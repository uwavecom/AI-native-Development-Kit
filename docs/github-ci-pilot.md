# GitHub CI evidence pilot

This is a read-only proof of concept that retrieves a real GitHub Pull Request
and checks that a completed successful pull_request GitHub Actions workflow run
belongs to the *exact same head SHA, branch and repository*.

Run the test suite with `npm run verify`.

It intentionally does **not** merge, deploy, authenticate a human, or attest
the security of every check. The caller must independently define which
required workflow checks count and enforce branch protection, reviewer identity,
and durable state before using this in production.

The existing Factory Workflow state machine only records evidence references.
Do not allow LLM-authored strings to impersonate authenticated CI results.
A production adapter must verify evidence at a trusted boundary.

Pilot acceptance:
- A successful check for the PR's current head produces an evidence reference.
- Results tied to another commit, pending runs, or foreign repositories fail closed.
- No GitHub write permissions are needed.
