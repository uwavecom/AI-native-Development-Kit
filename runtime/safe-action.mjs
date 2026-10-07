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

  if (!['UNKNOWN', 'VERIFICATION_FAILED', 'FAILED'].includes(execution.status)) {
    return {
      execution,
      recovery: null,
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
    resolved: recovery.resolved === true,
  };
}
