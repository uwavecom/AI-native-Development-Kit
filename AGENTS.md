# Agent entry point

Read `.ai/architecture-contract.md` before changing application code.
Find the closest existing pattern before creating types, helpers, or layers.
The runnable reference is `examples/reference-feature/`.

- Keep changes within the requested scope.
- Validate untrusted input at the application boundary.
- Derive identity and permissions from a trusted server integration, never request data.
- Keep domain code independent of adapters and transport.
- Access infrastructure through application-owned ports.
- Never expose secrets, bypass authorization, or weaken checks to get a pass.
- Preserve unrelated user changes; do not rewrite Git history.
- For substantial architectural changes, record context and consequences in `.ai/decisions/`.
- Run `npm run verify`, review the diff, and report actual results and limitations.
- Add meaningful behavior or boundary tests when changing those invariants.

This kit has no installed TypeScript compiler, production identity provider, database,
or web framework. Do not describe its current checks as proof of production security.
