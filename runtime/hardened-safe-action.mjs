import { runSafeAction } from './safe-action.mjs';

export async function runHardenedSafeAction({
  tool,
  actor,
  proposal,
  approval,
  approvalId,
  policy,
  input,
  invoke,
  verify,
  inspectState,
  retry,
  compensationAction,
  rollbackAction,
  stateStore,
  lock,
  budget,
  budgetKey,
}) {
  if (!tool?.name) throw new Error('TOOL_REQUIRED');
  if (!proposal?.actionSignature) throw new Error('PROPOSAL_REQUIRED');

  let durableApproval = approval ??
    (approvalId && stateStore ? await stateStore.getApproval(approvalId) : null);

  if (approvalId && stateStore && durableApproval?.oneShot === true) {
    const claim = await stateStore.claimApproval(approvalId, proposal.actionSignature);
    if (!claim.claimed) {
      return {
        execution: {
          status: 'PENDING',
          decision: { decision: 'DENY', reason: `APPROVAL_${claim.reason}` },
          executed: false,
        },
        recovery: null,
        approvalReceipt: durableApproval,
        resolved: false,
      };
    }
    durableApproval = claim.approval;
  }

  const audit = stateStore
    ? event => stateStore.appendAudit({
        ...event,
        actorId: actor?.id ?? actor?.userId ?? null,
        proposalSignature: proposal.actionSignature,
      })
    : async () => {};

  const execute = async () => {
    if (budget) {
      const result = budget.consume(budgetKey ?? actor?.id ?? actor?.userId ?? 'anonymous');
      await audit({
        event: result.allowed ? 'budget_consumed' : 'budget_exhausted',
        remaining: result.remaining,
        resetAt: result.resetAt,
      });
      if (!result.allowed) {
        return {
          execution: {
            status: 'PENDING',
            decision: { decision: 'DENY', reason: 'BUDGET_EXHAUSTED' },
            executed: false,
          },
          recovery: null,
          approvalReceipt: durableApproval,
          resolved: false,
        };
      }
    }

    const result = await runSafeAction({
      tool,
      actor,
      proposal,
      approval: durableApproval,
      policy,
      input,
      invoke,
      verify,
      inspectState,
      retry,
      compensationAction,
      rollbackAction,
      audit,
    });

    if (
      approvalId &&
      stateStore &&
      result.execution?.executed === true &&
      durableApproval?.oneShot === true
    ) {
      await stateStore.consumeApproval(approvalId);
    }

    return result;
  };

  if (!lock) return execute();

  const lockKey = proposal.target
    ? `${tool.name}:${proposal.target}`
    : `${tool.name}:${proposal.actionSignature}`;

  return lock.run(lockKey, execute);
}
