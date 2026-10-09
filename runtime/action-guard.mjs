import { createActionProposal, assertBoundActionInput } from './action-proposal.mjs';
import { runHardenedSafeAction } from './hardened-safe-action.mjs';

export function createActionGuard({
  tools,
  policy = {},
  policyVersion = 'unversioned',
  toolContractVersion = 'unversioned',
  runtimeVersion = '0.3.0',
  approvalAuthority = null,
  stateStore = null,
  lock = null,
  budget = null,
}) {
  const registry = new Map((tools ?? []).map(tool => [tool.name, tool]));

  function getTool(name) {
    const tool = registry.get(name);
    if (!tool) throw new Error(`UNKNOWN_TOOL:${name}`);
    return tool;
  }

  function propose({ toolName, target = null, params = {}, scope = null }) {
    getTool(toolName);
    return createActionProposal({
      toolName,
      target,
      params,
      scope,
      provenance: {
        policyVersion,
        toolContractVersion,
        runtimeVersion,
      },
    });
  }

  async function verifyApproval(approvalCredential, proposal) {
    if (!approvalCredential) return null;
    if (!approvalAuthority?.verify) {
      throw new Error('APPROVAL_AUTHORITY_REQUIRED');
    }

    const verified = await approvalAuthority.verify(approvalCredential, proposal);
    if (!verified.valid) {
      const error = new Error(verified.reason ?? 'INVALID_APPROVAL_CREDENTIAL');
      error.code = verified.reason ?? 'INVALID_APPROVAL_CREDENTIAL';
      throw error;
    }
    return verified.receipt;
  }

  async function execute({
    actor,
    proposal,
    approvalCredential = null,
    input = proposal?.params,
    invoke,
    verify,
    inspectState,
    retry,
    compensationAction,
    rollbackAction,
    budgetKey,
  }) {
    const tool = getTool(proposal?.toolName);
    assertBoundActionInput(proposal, input);
    const approval = await verifyApproval(approvalCredential, proposal);

    const guardedInvoke = approvalCredential && approvalAuthority?.claim
      ? async (...args) => {
          const claimed = await approvalAuthority.claim(approvalCredential, proposal);
          if (!claimed.valid) {
            const error = new Error(claimed.reason ?? 'INVALID_APPROVAL_CREDENTIAL');
            error.code = claimed.reason ?? 'INVALID_APPROVAL_CREDENTIAL';
            throw error;
          }
          return invoke(...args);
        }
      : invoke;

    return runHardenedSafeAction({
      tool,
      actor,
      proposal,
      approval,
      policy,
      input,
      invoke: guardedInvoke,
      verify,
      inspectState,
      retry,
      compensationAction,
      rollbackAction,
      stateStore,
      lock,
      budget,
      budgetKey,
    });
  }

  return Object.freeze({
    propose,
    execute,
    getTool,
    provenance: Object.freeze({
      policyVersion,
      toolContractVersion,
      runtimeVersion,
    }),
  });
}
