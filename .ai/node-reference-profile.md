# Node.js Reference Profile v0.1

This profile supplements `.ai/architecture-contract.md`; it does not replace the
framework-independent contract. It describes only the current runnable reference.

The principles are framework independent; the executable reference uses JavaScript
ES modules and Node.js 22+. A future TypeScript profile must supply its own compiler
and type checks rather than reporting a placeholder success.

## Runtime flow versus source dependencies

At runtime: boundary → use case → injected repository → storage.
In source: adapters depend on domain contracts; domain never imports adapters.
The composition root creates adapters and injects them into application code.

| Directory | Responsibility | Allowed local imports |
| --- | --- | --- |
| domain | Models, invariants, repository port, use case | domain |
| boundary | Input validation, authorization, application entry | domain, boundary |
| adapters | Implement domain ports | domain, adapters |
| composition | Wire boundary and adapters | all reference layers |

Production integrations must establish trusted identity before calling the boundary.
The demo identity is a test fixture, not an authentication implementation.
All protected entry points check permissions. The create-task input accepts only a
title; owner identity comes from trusted context. Stored task records are copies.
Completion requires `task:complete`, accepts only `taskId`, and is idempotent.
The repository's `completeOwned` operation must atomically check owner scope and
complete the task. Missing tasks and tasks owned by others both return `NOT_FOUND`.

The import guard checks static imports and re-exports through Node's module linker.
Dynamic imports and CommonJS require are prohibited in this reference profile.
External modules are prohibited except Node built-ins in composition/adapters.
These checks cover this reference directory only, not arbitrary future apps.
Tests protect validation, authorization, ownership, and adapter isolation.
They do not prove absence of all security defects.

Do not add an abstraction without a concrete boundary or recurring need.
Extend this contract and its checks together when introducing a new layer.
