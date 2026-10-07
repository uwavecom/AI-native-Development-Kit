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

## Next experiment

Give a coding agent this short task: “Add task completion following the reference.”
Review whether it discovers the pattern, preserves boundaries, adds meaningful tests,
and passes verify. This is an experiment to run, not an already demonstrated result.
