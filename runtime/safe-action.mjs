import { consumeApprovalReceipt } from './action-proposal.mjs';
import { executeAction } from './execute-action.mjs';
import { recoverAction } from './recover-action.mjs';

export async function runSafeAction({
  tool,
  actor,
  proposal,
  approval,
  policy,
  input,
  invoke,
  verify,
  inspectState,
  retry,
  compensationAction,
  rollbackAction,
  audit = async () => {},
}) {
  const context = { proposal, approval, policy };

  const execution = await executeAction({
    tool,
    actor,
    context,
    input,
    invoke,
    verify,
    audit,
  });

  const approvalReceipt = execution.executed === true && approval?.oneShot === true
    ? consumeApprovalReceipt(approval)
    : approval ?? null;

  if (!['UNKNOWN', 'VERIFICATION_FAILED', 'FAILED'].includes(execution.status)) {
    return {
      execution,
      recovery: null,
      approvalReceipt,
      resolved: execution.status === 'SUCCEEDED' || execution.status === 'PENDING',
    };
  }

  const recovery = await recoverAction({
    tool,
    execution,
    inspectState,
    retry,
    compensationAction,
    rollbackAction,
    audit,
  });

  return {
    execution,
    recovery,
    approvalReceipt,
    resolved: recovery.resolved === true,
  };
}
