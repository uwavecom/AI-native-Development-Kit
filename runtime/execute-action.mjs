import { decideAction, Decision } from './action-decision.mjs';

export const ExecutionStatus = Object.freeze({
  PENDING: 'PENDING',
  EXECUTING: 'EXECUTING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  UNKNOWN: 'UNKNOWN',
  VERIFICATION_FAILED: 'VERIFICATION_FAILED',
});

export async function executeAction({
  tool,
  actor,
  context = {},
  input,
  invoke,
  verify,
  audit = async () => {},
}) {
  const decision = decideAction(tool, actor, context);

  const auditContext = {
    tool: tool?.name,
    target: context.proposal?.target ?? null,
    actionSignature: context.proposal?.actionSignature ?? null,
  };

  await audit({
    event: 'policy_decided',
    ...auditContext,
    decision: decision.decision,
    reason: decision.reason,
  });

  if (decision.decision !== Decision.ALLOW) {
    return {
      status: ExecutionStatus.PENDING,
      decision,
      executed: false,
    };
  }

  if (context.approval?.valid === true) await audit({ event: 'approval_satisfied', ...auditContext });
  await audit({ event: 'execution_started', ...auditContext });

  let providerResult;
  try {
    providerResult = await invoke(input);
  } catch (error) {
    if (error?.code === 'TIMEOUT_AFTER_DISPATCH') {
      await audit({ event: 'execution_unknown', ...auditContext, reason: 'TIMEOUT_AFTER_DISPATCH' });
      return {
        status: ExecutionStatus.UNKNOWN,
        decision,
        executed: true,
        error: 'UNKNOWN_EXECUTION_STATE',
        retrySafe: tool.idempotent === true,
      };
    }

    await audit({ event: 'execution_failed', ...auditContext, reason: error?.code ?? 'DEPENDENCY_ERROR' });
    return {
      status: ExecutionStatus.FAILED,
      decision,
      executed: false,
      error: error?.code ?? 'DEPENDENCY_ERROR',
      retrySafe: tool.idempotent === true,
    };
  }

  await audit({ event: 'execution_succeeded', tool: tool.name });

  if (typeof verify !== 'function') {
    if (tool.access === 'read') {
      return {
        status: ExecutionStatus.SUCCEEDED,
        decision,
        executed: true,
        providerResult,
        verified: false,
      };
    }

    await audit({ event: 'verification_failed', ...auditContext, reason: 'VERIFIER_MISSING' });
    return {
      status: ExecutionStatus.VERIFICATION_FAILED,
      decision,
      executed: true,
      providerResult,
      verified: false,
      error: 'VERIFICATION_FAILED',
    };
  }

  try {
    const verification = await verify({ input, providerResult });

    if (verification?.verified === true) {
      await audit({ event: 'verification_succeeded', tool: tool.name });
      return {
        status: ExecutionStatus.SUCCEEDED,
        decision,
        executed: true,
        providerResult,
        verified: true,
        verification,
      };
    }

    await audit({ event: 'verification_failed', ...auditContext, reason: verification?.reason ?? 'INCONCLUSIVE' });
    return {
      status: ExecutionStatus.VERIFICATION_FAILED,
      decision,
      executed: true,
      providerResult,
      verified: false,
      verification,
      error: 'VERIFICATION_FAILED',
    };
  } catch (error) {
    await audit({ event: 'verification_failed', ...auditContext, reason: error?.code ?? 'DEPENDENCY_ERROR' });
    return {
      status: ExecutionStatus.VERIFICATION_FAILED,
      decision,
      executed: true,
      providerResult,
      verified: false,
      error: error?.code ?? 'VERIFICATION_FAILED',
    };
  }
}
