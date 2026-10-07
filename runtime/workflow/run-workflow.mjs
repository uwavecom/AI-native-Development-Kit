export const WorkflowStatus = Object.freeze({
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
});

export async function runWorkflow({
  steps,
  executeStep,
  compensateStep,
  audit = async () => {},
}) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('WORKFLOW_STEPS_REQUIRED');

  const completed = [];
  const results = [];

  for (const step of steps) {
    await audit({ event: 'workflow_step_started', step: step.id });
    let result;
    try {
      result = await executeStep(step);
    } catch (error) {
      result = { resolved: false, error: error?.code ?? 'STEP_EXCEPTION' };
    }
    results.push({ step: step.id, result });

    if (result?.resolved === true) {
      completed.push(step);
      await audit({ event: 'workflow_step_succeeded', step: step.id });
      continue;
    }

    await audit({ event: 'workflow_step_failed', step: step.id });

    const compensation = [];
    for (const completedStep of [...completed].reverse()) {
      if (completedStep.compensate !== true || typeof compensateStep !== 'function') continue;
      const compensationResult = await compensateStep(completedStep);
      compensation.push({ step: completedStep.id, result: compensationResult });
      await audit({
        event: compensationResult?.resolved === true ? 'workflow_compensation_succeeded' : 'workflow_compensation_failed',
        step: completedStep.id,
      });
    }

    const compensatable = completed.filter(item => item.compensate === true);
    const uncompensatable = completed.filter(item => item.compensate !== true);
    const allCompensated =
      uncompensatable.length === 0 &&
      compensation.length === compensatable.length &&
      compensation.every(item => item.result?.resolved === true);

    return {
      status: completed.length === 0 ? WorkflowStatus.FAILED : WorkflowStatus.PARTIAL,
      resolved: false,
      failedStep: step.id,
      results,
      compensation,
      uncompensatedSteps: uncompensatable.map(item => item.id),
      allCompensated,
    };
  }

  return {
    status: WorkflowStatus.SUCCEEDED,
    resolved: true,
    results,
    compensation: [],
  };
}
