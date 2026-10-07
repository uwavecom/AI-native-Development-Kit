# OpenAI Agents SDK integration

The OpenAI Agents SDK already supports function tools, tool guardrails, and human-in-the-loop approval.

The Development Kit does not replace those features.

It adds a portable action-governance boundary around the consequential tool call.

## Recommended flow

```text
OpenAI agent proposes tool call
→ SDK needsApproval pauses the run
→ trusted application verifies reviewer/session/ownership
→ application issues Development Kit approval credential
→ adapter executes through ActionGuard
→ provider state is verified
→ audit/recovery semantics apply
```

Use `createOpenAIAgentsToolAdapter()` and pass its callbacks into an `@openai/agents` function tool. The adapter follows the current SDK callback shape: `needsApproval(args)` and `execute(args, context, details)`.

The `getApprovalCredential` callback must exchange a trusted application-side approval decision for a credential. Do not construct credentials from model-controlled data or an untrusted serialized run snapshot.

The adapter intentionally does not import `@openai/agents`, so the Development Kit core remains framework-independent and dependency-free. CI separately installs the pinned SDK in `integration/real-sdk/` and validates that a real function tool can be created with the adapter.
