# AI-native Development Kit

A small, agent-independent development foundation. Version 0.1 demonstrates
enforceable import boundaries and tested application behavior without vendor SDKs.

## Run

Install Node.js 22 or newer, then run `npm run verify`. No dependency install is required.
Verification checks syntax, architecture, behavior, and the guard itself. Each stage
prints a JSON PASS/FAIL record and exits nonzero on failure.

`npm test` runs behavior tests plus guard tests with the VM flag configured below.
`npm run check:architecture` runs the import guard alone.

## Reference

Read `AGENTS.md` and `.ai/architecture-contract.md`, then inspect
`examples/reference-feature/composition/app.mjs` and `test/tasks.test.mjs`.
The full agent constitution and architecture contract each contain 20 sections.
`.ai/node-reference-profile.md` defines the executable reference's layer rules,
runtime-versus-source dependency direction, implemented checks, and limitations.
The example creates a task, validates input, checks permission, derives ownership
from trusted context, and writes through a repository port into a memory adapter.

The neutral architecture contract and this Node.js implementation are distinct:
future framework profiles must provide actual typecheck, lint, build, authentication,
database, and deployment checks. None of those are claimed by this version.
The memory adapter is a demo; it is not durable storage. No UI or HTTP endpoint is supplied.

## Task completion experiment

`app.complete(trustedContext, { taskId })` requires `task:complete` and the task's
owner. Other users and missing tasks receive `NOT_FOUND`. Repeated completion is
idempotent. The memory adapter checks ownership and changes state atomically;
future database adapters must preserve this contract with a scoped atomic write.

Local verification covers 18 tests, including permission denial, ownership,
malformed input, repeated completion, and concurrent calls to the memory adapter.
The shared authorization helper avoids duplicating permission checks.
Import checks protect dependency direction; behavior tests protect the demonstrated
security rules. There is still no static guarantee that every future entry point
uses authorization, and no compiler check for the documented repository port.
This change was made with existing conversation context, so it is not a blind test
of a fresh agent discovering the kit from a short prompt.

## Next experiment

Give a fresh coding agent this short task: “Add task reopening following the reference.”
Review whether it discovers the pattern, preserves boundaries, adds meaningful tests,
and passes verify. This is an experiment to run, not an already demonstrated result.
