// Adapter helpers for @openai/agents function tools.
//
// The adapter intentionally does not import @openai/agents. Consumers pass the
// returned callbacks into tool({...}), keeping this package dependency-free.

export function createOpenAIAgentsToolAdapter({
  guard,
  toolName,
  targetFromArgs = () => null,
  scopeFromArgs = () => null,
  getApprovalCredential = null,
  execute,
  verify,
  inspectState,
}) {
  if (!guard?.propose || !guard?.execute) throw new Error('ACTION_GUARD_REQUIRED');
  if (!toolName) throw new Error('TOOL_NAME_REQUIRED');
  if (typeof execute !== 'function') throw new Error('EXECUTE_REQUIRED');

  return {
    needsApproval: async (runContext, args, callId) => {
      const proposal = guard.propose({
        toolName,
        target: targetFromArgs(args),
        params: args,
        scope: scopeFromArgs(args),
      });
      const tool = guard.getTool(toolName);

      return tool.requiresApproval === true ||
        tool.access === 'destructive' ||
        tool.riskLevel === 'high' ||
        tool.riskLevel === 'critical';
    },

    execute: async (args, runContext, details) => {
      const proposal = guard.propose({
        toolName,
        target: targetFromArgs(args),
        params: args,
        scope: scopeFromArgs(args),
      });

      // For sensitive tools the OpenAI Agents SDK may already have paused and
      // collected a human decision via needsApproval. This callback exchanges
      // that trusted application-side decision for a verifiable credential.
      // Do not mint credentials from model-controlled state.
      const approvalCredential = getApprovalCredential
        ? await getApprovalCredential({ proposal, runContext, args, details })
        : null;

      const result = await guard.execute({
        actor: runContext?.context?.actor ?? runContext?.actor ?? {},
        proposal,
        approvalCredential,
        invoke: () => execute(args, runContext, details),
        verify: verify
          ? ({ providerResult }) => verify({ args, providerResult, runContext, details, proposal })
          : undefined,
        inspectState: inspectState
          ? () => inspectState({ args, runContext, details, proposal })
          : undefined,
      });

      if (result.execution?.status !== 'SUCCEEDED') {
        const error = new Error(`ACTION_NOT_COMPLETED:${result.execution?.status ?? 'UNKNOWN'}`);
        error.result = result;
        throw error;
      }

      return result.execution.providerResult;
    },
  };
}
