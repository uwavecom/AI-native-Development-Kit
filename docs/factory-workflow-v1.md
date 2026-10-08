# Factory Workflow v1 — optional workflow contract

## Scope
This is **not** a workflow engine or agent fleet. The Development Kit remains a portable
governance boundary for consequential tool actions. A host orchestrator (Claude, Codex,
GitHub Actions, etc.) drives the workflow and uses existing action-guard contracts for
consequential operations such as merging or deploying.

## Stages
SPEC → BUILD → VERIFY → REVIEW → APPROVAL → READY_TO_MERGE → MERGED.
VERIFY and REVIEW may return to BUILD. APPROVAL can route to NEEDS_HUMAN.
NEEDS_HUMAN can return to BUILD or advance with trusted approval evidence.

Each transition requires a reference to inspectable evidence; revision checks prevent
silent stale updates in a single host. Hosts must persist job state and use atomic
compare-and-swap for concurrency; the pure module does **not** persist state.

## Required integration boundaries
- **Specification:** explicit goal and acceptance criteria, recorded in the issue/PR.
- **Build:** isolated branch or Git worktree; no direct writes to main.
- **Verify:** run deterministic tests, lint, build, policy checks and preserve CI run URL.
  Only CI evidence attested by the host may authorize VERIFY → REVIEW.
- **Review:** record findings; a model verdict alone cannot override failing CI.
- **Approval:** consequential merge/deploy operations must use existing
  `createActionGuard` proposal, policy, trusted credential and provider verification.
  A string in a Markdown file is **not** trusted human approval.
- **Evidence:** references are pointers, not validated credentials; the host verifies
  CI status, identity, signature, branch/head SHA and policy before advancing.
- **Audit:** preserve stage transitions, action proposals, decisions and verification;
  record UNKNOWN outcomes and recover through the existing action lifecycle.
- **Concurrency:** use atomic persistence plus branch protections. A revision counter
  alone is not a cross-process lock.
- **After merge:** deployment, production monitoring and rollback are explicitly
  out of scope for v1.

## Minimal invocation
```js
import { createFactoryJob, transitionFactoryJob } from './runtime/factory-workflow.mjs';
let job = createFactoryJob({
  id: 'issue-42', goal: 'Add reading time to articles',
  acceptanceCriteria: ['Existing tests pass', 'Rendering is accessible'],
});
job = transitionFactoryJob(job, 'BUILD', {
  expectedRevision: 0,
  evidence: { kind: 'spec', reference: 'https://github.com/org/repo/issues/42' },
});
```

This optional component has no mandatory GlassFlow, Claude Code or other provider.
Production adopters must implement durable state and evidence attestation.
