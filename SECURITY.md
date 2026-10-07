# Security Model

## Trust boundary

The agent is **not** a trusted approval authority.

An agent may:

- discover capabilities;
- construct a canonical proposal;
- request approval;
- receive a verified credential;
- execute an approved action.

An agent must not:

- mint its own trusted approval;
- modify approved target/parameters after approval;
- replay a one-shot approval;
- treat model output as provider truth.

## Approval authorities

`createSignedApprovalAuthority()` is a **reference single-process authority**.

It demonstrates:

- issuer identity;
- tamper-evident approval credentials;
- proposal binding;
- expiry;
- one-shot replay prevention.

Its in-memory replay set is not a distributed production store.

Production systems should implement the same authority port using trusted server-side or durable infrastructure with atomic claim/consume semantics.

Examples include:

- a server database transaction;
- a Durable Object;
- another strongly consistent approval service.

The authority secret must never be available to the model or untrusted client code.

## External side effects

Consequential actions should define:

- authorization requirements;
- approval requirements;
- retry behavior;
- verification;
- recovery;
- audit.

A timeout after request dispatch is an `UNKNOWN` execution state, not automatic failure or success.

## Framework state is not authorization

Serialized agent state, MCP authorization, OAuth access, a run ID, or a tool call ID do not by themselves prove that the current human/application actor authorized a consequential action.

Application identity, ownership, proposal binding, replay prevention, and policy must still be enforced at a trusted boundary.

## Reporting

This repository is currently an early reference implementation. Do not treat it as a certified security product.

When evaluating it for production, review the trust boundary, authority adapter, state store, and deployment-specific concurrency guarantees.
