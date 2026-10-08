import { createFactoryJob, transitionFactoryJob } from '../runtime/factory-workflow.mjs';
import { createActionGuard, createSignedApprovalAuthority } from '../runtime/index.mjs';

// In-memory demonstration only. Production must attest CI runs, persist workflow
// state atomically and obtain credentials from a separate trusted human boundary.
export async function runFactoryScenario({ approve = false } = {}) {
  const authority = createSignedApprovalAuthority({
    secret: 'demonstration-only-secret-not-for-production',
  });
  const guard = createActionGuard({
    tools: [{
      name: 'merge_pull_request',
      purpose: 'Merge a verified pull request.',
      access: 'destructive', riskLevel: 'high',
      requiredPermissions: ['repo:merge'], requiresApproval: true,
      idempotent: false, audit: true,
      sideEffects: 'Changes repository history.',
      retryPolicy: 'Inspect before retry.',
      verificationStrategy: 'Confirm merge using provider state.',
      recoveryStrategy: 'Explicit revert through governed action.',
    }],
    approvalAuthority: authority,
    policyVersion: 'factory-demo-v1',
    toolContractVersion: 'factory-demo-tools-v1',
  });
  let job = createFactoryJob({
    id: 'demo-pr-42',
    goal: 'Add article reading time',
    acceptanceCriteria: ['All tests pass', 'UI remains accessible'],
  });
  const step = (next, kind, reference) => {
    job = transitionFactoryJob(job, next, {
      expectedRevision: job.revision, evidence: { kind, reference },
    });
  };
  step('BUILD', 'spec', 'demo://spec');
  step('VERIFY', 'commit', 'demo://sha');
  step('REVIEW', 'ci-passed', 'demo://ci-passed');
  step('APPROVAL', 'review', 'demo://review');
  if (!approve) {
    step('NEEDS_HUMAN', 'escalation', 'demo://approval-required');
    return { job, execution: null, invoked: false };
  }

  const proposal = guard.propose({
    toolName: 'merge_pull_request',
    target: 'PR#42',
    params: { prNumber: 42, base: 'main' },
  });
  // A trusted application/human service must issue this credential.
  const credential = await authority.issue(proposal, { approverId: 'demo-human' });
  let invoked = false;
  const execution = await guard.execute({
    actor: { permissions: ['repo:merge'] },
    proposal, approvalCredential: credential,
    invoke: async () => {
      invoked = true;
      return { merged: true, sha: 'demo-merge-sha' };
    },
    verify: async ({ providerResult }) => ({
      verified: providerResult.merged === true && providerResult.sha === 'demo-merge-sha',
    }),
  });
  if (execution.execution.status !== 'SUCCEEDED') {
    step('NEEDS_HUMAN', 'execution-failure', 'demo://inspect-execution');
    return { job, execution, invoked };
  }
  step('READY_TO_MERGE', 'trusted-approval', proposal.actionSignature);
  step('MERGED', 'verified-merge', 'demo://verified-merge-sha');
  return { job, execution, invoked };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const { job, execution } = await runFactoryScenario({ approve: false });
  console.log(JSON.stringify({ stage: job.stage, execution: execution?.execution?.status ?? null }));
}
