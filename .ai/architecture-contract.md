# Architecture Contract

## Status

Version: 0.1

This document defines the architectural boundaries of applications built with the AI-native Development Kit.

The goal is not to prescribe a framework.

The goal is to make dependency direction, ownership, and system boundaries explicit enough that both humans and AI coding agents can work consistently.

---

# 1. Architectural Goal

The architecture must optimize for:

- understandability;
- predictable patterns;
- strict boundaries;
- local reasoning;
- reuse of domain concepts;
- testability;
- security;
- replaceable infrastructure;
- machine-verifiable constraints.

The architecture should reduce the amount of information an AI agent must keep in context in order to make a correct change.

---

# 2. Core Dependency Direction

The default conceptual dependency flow is:

UI  
↓  
Application Boundary  
↓  
Domain / Use Cases  
↓  
Ports  
↓  
Adapters / Infrastructure

Dependencies should point inward toward application and domain concepts.

Infrastructure should implement interfaces required by the application.

Core business behavior should not unnecessarily depend on framework-specific or vendor-specific APIs.

---

# 3. Layer Responsibilities

## UI

Responsible for:

- rendering;
- interaction;
- presentation state;
- collecting user input;
- calling application boundaries;
- presenting domain/application results.

UI must not own authoritative business rules.

UI must not be treated as a security boundary.

UI should not directly access infrastructure such as the database.

## Application Boundary

Examples may include:

- API routes;
- RPC procedures;
- server handlers;
- commands;
- queries;
- server actions;
- controllers.

Responsible for:

- authentication context;
- authorization entry;
- input validation;
- request orchestration;
- mapping transport concerns into application calls;
- mapping application results into transport responses.

The boundary should remain thin.

Business behavior belongs deeper in the system.

## Domain / Use Cases

Responsible for:

- business rules;
- workflows;
- invariants;
- state transitions;
- application decisions.

This layer should express what the system does rather than how infrastructure performs it.

Where practical, domain logic should be testable without network, database, or framework runtime.

## Ports

Ports define capabilities the application requires from the outside world.

Examples:

- repository interfaces;
- mail delivery;
- file storage;
- payment provider;
- queue;
- clock;
- analytics;
- external APIs;
- AI providers.

Ports belong to the application/domain side of the boundary.

They describe what is needed, not which vendor provides it.

## Adapters / Infrastructure

Adapters implement ports.

Examples:

- PostgreSQL repository;
- Supabase adapter;
- Clerk identity adapter;
- Stripe payment adapter;
- Resend email adapter;
- Cloudflare storage adapter;
- OpenAI model adapter.

Vendor-specific code should normally remain here.

Infrastructure may depend on application-defined interfaces.

Application/domain code should not unnecessarily depend on infrastructure implementations.

---

# 4. Canonical Feature Shape

A feature should be organized around a domain capability rather than scattered by technical file type.

Conceptual example:

```text
features/
└── tasks/
    ├── schema
    ├── model
    ├── service
    ├── repository
    ├── api
    ├── ui
    └── tests
```

The exact filenames depend on the implementation stack.

Not every feature requires every file.

Do not create empty architectural ceremony.

The principle is:

**related behavior should be easy to discover locally.**

---

# 5. Source of Truth

Every important domain concept should have an identifiable canonical representation.

Examples:

- permissions;
- roles;
- resources;
- plans;
- feature capabilities;
- domain schemas;
- state values;
- configuration;
- error codes.

Avoid manually maintaining multiple independent representations of the same information.

Prefer deriving secondary representations from the canonical source.

Example: a resource registry derives permission types, navigation visibility,
feature gates, and usage limits rather than maintaining four unrelated lists.

---

# 6. Type Architecture

Types should preferably flow from authoritative definitions.

Examples:

```text
Schema → inferred input type
Database schema → generated persistence types
Resource registry → resource key union
Permission registry → permission type
```

Avoid:

```text
UserTypeA
UserTypeB
UserDTO
AnotherUser
UserModel2
```

unless each represents a genuinely different semantic concept.

Different concepts may have different types.

The rule is against accidental duplication, not purposeful modelling.

---

# 7. Validation Boundary

All untrusted input must cross a validation boundary.

Conceptually:

```text
untrusted input → validation/schema → trusted typed input → application logic
```

Validation should occur as early as practical at the trusted system boundary.

Validation rules that represent domain invariants may also exist deeper in the domain.

---

# 8. Authorization Boundary

Authorization must be enforced on a trusted execution boundary.

Conceptually: identity + requested action + resource + scope → authorization policy → allow / deny.

The preferred architecture centralizes authorization primitives.

Feature code should declare what permission is required rather than reinvent how permissions are checked.

Desired pattern:

```text
operation({
  resource,
  action,
  scope
})
```

instead of:

```text
if (user.role === ...)
```

repeated throughout the codebase.

---

# 9. Data Access Boundary

The database is infrastructure.

Canonical flow:

```text
application/use-case → repository/port → database adapter → database
```

Small applications may collapse repository and adapter layers when an additional abstraction would provide no practical value.

However:

UI must never become the canonical location for data-access logic.

Authorization and domain invariants must not depend on the UI performing the correct sequence of calls.

---

# 10. External Systems

External providers must be treated as replaceable infrastructure where replacement or isolation provides meaningful value.

Preferred:

```text
feature → MailPort → ResendAdapter
```

rather than:

```text
feature A → Resend SDK
feature B → Resend SDK
feature C → Resend SDK
```

Do not create adapter abstractions solely for theoretical portability.

Use them when they protect domain code, centralize policy, simplify testing, or contain vendor-specific behavior.

---

# 11. Side Effects

Side effects should be explicit.

Examples:

- sending email;
- charging money;
- writing files;
- calling external APIs;
- publishing events;
- changing persistent data.

A function that performs a consequential side effect should make that behavior discoverable through naming, structure, or type.

Avoid hidden side effects in generic utilities.

---

# 12. Security Invariants

The architecture must make the following classes of mistakes difficult:

- unauthenticated protected access;
- authorization bypass;
- cross-tenant data access;
- unvalidated external input;
- client exposure of secrets;
- direct infrastructure access from inappropriate layers;
- accidental use of privileged SDKs in client code.

Where possible, enforce these constraints automatically.

---

# 13. Tenant / Scope Isolation

For multi-tenant systems, tenant scope must be explicit.

Never trust a client-provided tenant identifier without confirming that the authenticated identity is authorized for that tenant.

Queries and mutations affecting tenant-owned data should carry trusted scope derived from the server-side identity/authorization context.

Cross-tenant access is considered an architectural violation.

---

# 14. Errors

Errors should belong to a controlled taxonomy where useful.

Examples:

```text
VALIDATION_ERROR
UNAUTHENTICATED
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
DEPENDENCY_ERROR
INTERNAL_ERROR
```

Infrastructure errors should not leak sensitive implementation details to users.

Application code may translate vendor/database errors into stable application errors.

---

# 15. Observability

Important operations should be observable.

Depending on system needs, this may include:

- structured logs;
- audit events;
- traces;
- metrics;
- error reporting.

Observability should be centralized where possible rather than manually implemented independently in every feature.

Security-sensitive and destructive operations should be candidates for audit logging.

---

# 16. Architecture Fitness Functions

Architectural rules should progressively become executable.

Candidate rules include:

```text
UI cannot import database clients.
Client code cannot import server-only modules.
Domain code cannot import framework UI packages.
Feature code cannot access privileged vendor SDKs directly.
Protected mutations require authorization metadata.
External inputs require validation schemas.
Cross-tenant queries require trusted tenant scope.
```

The repository should implement these rules through suitable mechanisms such as:

- ESLint;
- TypeScript;
- dependency rules;
- custom static analysis;
- schemas;
- tests;
- build-time verification.

Documentation is the initial contract.

Executable enforcement is the target state.

---

# 17. Reference Patterns

At least one feature should serve as a canonical reference implementation.

A reference feature should demonstrate:

- input validation;
- types;
- authorization;
- application logic;
- persistence;
- errors;
- tests;
- UI integration where applicable.

AI agents should prefer copying the architectural pattern of the reference feature over inventing a new structure.

---

# 18. Architecture Evolution

The architecture is allowed to evolve.

It should not drift accidentally.

When a new pattern is materially better than the existing canonical pattern:

1. evaluate it explicitly;
2. decide whether it should become canonical;
3. record the decision if significant;
4. migrate representative code;
5. update guardrails;
6. remove competing obsolete patterns when practical.

Do not leave multiple architectural generations active indefinitely without a reason.

---

# 19. Simplicity Rule

Guardrails exist to reduce entropy, not to maximize abstraction.

Do not introduce:

- repositories;
- factories;
- interfaces;
- adapters;
- event buses;
- dependency injection;
- generic frameworks;

merely because they are considered "clean architecture".

Every abstraction must solve a concrete recurring problem or protect a meaningful boundary.

The preferred architecture is the simplest architecture that reliably preserves the required invariants.

---

# 20. AI-native Principle

A good AI-native architecture should allow a coding agent to answer these questions by inspecting the repository:

1. Where does this kind of code belong?
2. What existing pattern should I follow?
3. Which source of truth already exists?
4. Which boundaries may I not cross?
5. What must be validated?
6. What permission is required?
7. How do I verify that my implementation is correct?

If the repository cannot answer these questions clearly, the architecture or its guardrails should be improved.
