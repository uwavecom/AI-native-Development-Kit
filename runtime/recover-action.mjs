import { executeAction } from './execute-action.mjs';

export const RecoveryDecision = Object.freeze({
  NO_RECOVERY_NEEDED: 'NO_RECOVERY_NEEDED',
  VERIFY_STATE: 'VERIFY_STATE',
  RETRY_SAFE: 'RETRY_SAFE',
  COMPENSATE: 'COMPENSATE',
  ROLLBACK: 'ROLLBACK',
  HUMAN_INTERVENTION: 'HUMAN_INTERVENTION',
  UNRESOLVED: 'UNRESOLVED',
});

async function runRecoveryOperation(operation, audit) {
  if (!operation) return null;
  return executeAction({ ...operation, audit });
}

export async function recoverAction({
  tool,
  execution,
  inspectState,
  retry,
  compensationAction,
  rollbackAction,
  audit = async () => {},
}) {
  if (!execution) return { decision: RecoveryDecision.UNRESOLVED, reason: 'MISSING_EXECUTION_RESULT' };

  if (execution.status === 'SUCCEEDED') {
    return { decision: RecoveryDecision.NO_RECOVERY_NEEDED, resolved: true };
  }

  if (!['UNKNOWN', 'VERIFICATION_FAILED', 'FAILED'].includes(execution.status)) {
    return { decision: RecoveryDecision.NO_RECOVERY_NEEDED, resolved: true };
  }

  await audit({ event: 'recovery_started', tool: tool?.name, status: execution.status });

  if (typeof inspectState !== 'function') {
    await audit({ event: 'recovery_unresolved', tool: tool?.name, reason: 'STATE_INSPECTION_UNAVAILABLE' });
    return {
      decision: RecoveryDecision.HUMAN_INTERVENTION,
      resolved: false,
      reason: 'STATE_INSPECTION_UNAVAILABLE',
    };
  }

  let state;
  try {
    state = await inspectState();
  } catch (error) {
    await audit({ event: 'recovery_unresolved', tool: tool?.name, reason: error?.code ?? 'STATE_INSPECTION_FAILED' });
    return {
      decision: RecoveryDecision.UNRESOLVED,
      resolved: false,
      reason: error?.code ?? 'STATE_INSPECTION_FAILED',
    };
  }

  if (state?.desiredState === true) {
    await audit({ event: 'recovery_completed', tool: tool?.name, method: 'VERIFY_STATE' });
    return {
      decision: RecoveryDecision.VERIFY_STATE,
      resolved: true,
      recoveredAs: 'SUCCEEDED',
      state,
    };
  }

  if (state?.actionDefinitelyNotApplied === true && tool?.idempotent === true && typeof retry === 'function') {
    const retryResult = await retry();
    await audit({ event: 'recovery_completed', tool: tool?.name, method: 'RETRY_SAFE' });
    return {
      decision: RecoveryDecision.RETRY_SAFE,
      resolved: retryResult?.status === 'SUCCEEDED',
      retryResult,
      state,
    };
  }

  if (state?.canRollback === true && rollbackAction) {
    const rollbackResult = await runRecoveryOperation(rollbackAction, audit);
    const resolved = rollbackResult?.status === 'SUCCEEDED' && rollbackResult?.verified === true;
    await audit({ event: resolved ? 'recovery_completed' : 'recovery_unresolved', tool: tool?.name, method: 'ROLLBACK' });
    return {
      decision: RecoveryDecision.ROLLBACK,
      resolved,
      rollbackResult,
      state,
    };
  }

  if (state?.canCompensate === true && compensationAction) {
    const compensationResult = await runRecoveryOperation(compensationAction, audit);
    const resolved = compensationResult?.status === 'SUCCEEDED' && compensationResult?.verified === true;
    await audit({ event: resolved ? 'recovery_completed' : 'recovery_unresolved', tool: tool?.name, method: 'COMPENSATE' });
    return {
      decision: RecoveryDecision.COMPENSATE,
      resolved,
      compensationResult,
      state,
    };
  }

  await audit({ event: 'recovery_unresolved', tool: tool?.name, reason: 'NO_SAFE_AUTOMATIC_PATH' });
  return {
    decision: RecoveryDecision.HUMAN_INTERVENTION,
    resolved: false,
    reason: 'NO_SAFE_AUTOMATIC_PATH',
    state,
  };
}
