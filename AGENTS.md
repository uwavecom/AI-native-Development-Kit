# AI-native Development Kit — Agent Constitution

## Purpose

This repository is designed for AI-assisted software development.

Your job is not merely to make code work.

Your job is to preserve the architecture, reuse existing patterns, minimize unnecessary complexity, and leave the codebase in a better state than you found it.

The repository is the primary source of truth.

Do not invent new architecture when an existing pattern already solves the problem.

---

# 1. Core Principle

Prefer:

**existing pattern → existing primitive → existing type → existing abstraction → new code**

Never start with new code before checking what already exists.

Before implementing a non-trivial change:

1. inspect the relevant feature;
2. find similar implementations;
3. identify existing types, schemas, services, adapters, utilities, and tests;
4. understand the dependency direction;
5. only then implement.

---

# 2. Architecture First

Follow the architecture defined in:

`.ai/architecture-contract.md`

Do not bypass architectural boundaries for convenience.

If the requested feature appears to conflict with the architecture:

- do not silently work around the architecture;
- identify the conflict;
- prefer extending the architecture coherently;
- document significant architectural decisions.

---

# 3. Canonical Dependency Flow

Unless explicitly defined otherwise by the architecture contract, application behavior should follow the repository's canonical flow.

Typical example:

UI  
→ application/API boundary  
→ authorization + validation  
→ service/use-case  
→ repository/adapter  
→ infrastructure

Do not skip layers merely to reduce code.

Do not add layers that provide no meaningful boundary.

---

# 4. Reuse Before Creation

Before creating any new:

- type;
- schema;
- helper;
- hook;
- service;
- repository;
- adapter;
- permission;
- constant;
- component;
- error type;

search for an existing equivalent.

Avoid parallel implementations of the same concept.

There should normally be one canonical source of truth for each domain concept.

---

# 5. Types

Prefer strict, derived types.

Where possible, derive types from canonical schemas or domain definitions instead of manually duplicating them.

Avoid `any`.

Use `unknown` only at genuinely unknown boundaries and narrow it before use.

Do not use type assertions merely to silence the compiler unless the assertion is justified by an invariant that TypeScript cannot express.

Do not create duplicate domain models.

---

# 6. Validation

Treat all external input as untrusted.

Validate data at system boundaries.

This includes, where applicable:

- API input;
- form submissions;
- URL parameters;
- webhooks;
- external APIs;
- environment variables;
- persisted untrusted data.

Prefer reusable schemas and derived types.

Client-side validation improves UX.

Server-side validation protects the system.

Do not rely on client validation for security.

---

# 7. Authorization

Authentication is not authorization.

Every protected operation must verify the permissions required for that operation.

Authorization must happen on a trusted server-side boundary.

Do not rely on:

- hidden UI;
- disabled buttons;
- client-side checks;
- route visibility;

as security controls.

Reuse the project's canonical authorization mechanism.

Do not implement one-off permission logic if a shared mechanism exists.

---

# 8. External Providers

Do not spread vendor-specific SDK calls throughout feature code.

Access external systems through the project's adapter/provider boundary whenever such a boundary exists.

Examples include:

- authentication providers;
- email;
- storage;
- payments;
- analytics;
- AI models;
- queues;
- third-party APIs.

Feature logic should depend on project interfaces where practical, not directly on vendor implementation details.

For AI-invoked external tools, follow the agent-safe action contracts in `.ai/`: tool contract, action policy, approval contract, execution contract, and recovery contract. Do not execute consequential actions outside the canonical safe-action lifecycle, and do not treat rollback or compensation as a privileged bypass.

---

# 9. Database Access

Database access must follow the architecture contract.

Do not access the database directly from UI code.

Do not introduce additional database access paths without architectural justification.

Business rules should not depend unnecessarily on database implementation details.

---

# 10. Security

Never:

- expose secrets to client code;
- hardcode credentials;
- bypass authorization;
- disable validation to make a feature work;
- weaken security checks to satisfy tests;
- log sensitive secrets;
- trust client-controlled identity or permissions.

Security checks are architectural boundaries, not optional helpers.

---

# 11. Errors

Prefer explicit, meaningful errors.

Errors should help both humans and coding agents identify:

- what rule was violated;
- where it happened;
- what the expected pattern is.

Do not swallow errors silently.

Do not convert every error into a generic success/failure result if meaningful information would be lost.

---

# 12. Implementation Strategy

For simple changes:

- inspect;
- implement;
- verify.

For non-trivial changes:

1. discover;
2. form a plan;
3. identify the canonical pattern;
4. implement the smallest coherent slice;
5. verify;
6. inspect the diff;
7. continue iteratively if needed.

Do not one-shot large features when they can be decomposed into independently verifiable slices.

---

# 13. Scope Control

Make the smallest change that correctly solves the requested problem.

Do not:

- refactor unrelated code;
- rename unrelated files;
- upgrade unrelated dependencies;
- rewrite working architecture without a concrete reason;
- introduce speculative abstractions.

If you encounter unrelated technical debt, leave it unchanged unless it blocks the requested work.

---

# 14. Verification

A task is not complete because the code was written.

A task is complete only after the relevant verification succeeds.

Use the repository's canonical verification command.

Preferred entry point:

`npm run verify`

or the repository equivalent.

Verification may include:

- type checking;
- linting;
- architecture rules;
- unit tests;
- integration tests;
- security checks;
- build.

Do not bypass failing checks.

Fix the underlying cause.

---

# 15. Tests

Add or update tests when behavior changes.

Tests should verify meaningful behavior and boundaries, not merely implementation details.

Prefer tests that protect important invariants.

A bug fix should normally include a regression test when practical.

---

# 16. Git

Do not rewrite history or perform destructive Git operations unless explicitly requested.

Do not revert unrelated user changes.

Prefer working in a dedicated feature branch when the workflow supports it.

Before completion, review the diff for:

- unintended changes;
- duplicate implementations;
- debugging leftovers;
- dead code;
- weakened types;
- bypassed checks.

---

# 17. Documentation

Code should be understandable from its structure, naming, types, tests, and architecture.

Documentation should explain things the code cannot express clearly:

- architectural decisions;
- important invariants;
- external constraints;
- non-obvious tradeoffs.

Do not create documentation as a substitute for enforceable architecture.

When a rule can reasonably be enforced by types, linting, schemas, tests, or build checks, prefer enforcement over prose.

---

# 18. Architectural Decisions

For substantial architectural changes, create or update a record under:

`.ai/decisions/`

Document:

- context;
- decision;
- alternatives considered;
- consequences.

Do not create decision records for trivial implementation choices.

---

# 19. Completion Standard

Before declaring work complete, confirm:

- the requested behavior works;
- architecture boundaries are preserved;
- existing patterns were reused where appropriate;
- inputs are validated;
- authorization is enforced where required;
- types remain strict;
- tests are appropriate;
- verification passes;
- the diff contains no unrelated changes.

---

# 20. Fundamental Rule

Do not ask the model to remember what the repository can enforce.

Whenever repeated AI mistakes reveal a missing architectural constraint, prefer improving the repository's guardrails so that the same class of mistake becomes harder to repeat.
