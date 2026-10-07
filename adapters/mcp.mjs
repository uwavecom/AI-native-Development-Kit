// Generic MCP tool-call governance adapter.
//
// It wraps an MCP-style tool invocation without depending on a specific SDK.

export function createMcpToolCallGuard({
  guard,
  resolveToolName = request => request?.params?.name,
  resolveArgs = request => request?.params?.arguments ?? {},
  resolveTarget = () => null,
  resolveScope = () => null,
  requestApproval = null,
}) {
  if (!guard?.propose || !guard?.execute) throw new Error('ACTION_GUARD_REQUIRED');

  return async function governMcpToolCall({ request, actor, invoke, verify, inspectState }) {
    const toolName = resolveToolName(request);
    const args = resolveArgs(request);

    const proposal = guard.propose({
      toolName,
      target: resolveTarget({ request, args, actor }),
      params: args,
      scope: resolveScope({ request, args, actor }),
    });

    const approvalCredential = requestApproval
      ? await requestApproval({ proposal, request, actor, args })
      : null;

    return guard.execute({
      actor,
      proposal,
      approvalCredential,
      invoke: () => invoke({ request, args, proposal }),
      verify: verify
        ? ({ providerResult }) => verify({ request, args, proposal, providerResult })
        : undefined,
      inspectState: inspectState
        ? () => inspectState({ request, args, proposal })
        : undefined,
    });
  };
}
