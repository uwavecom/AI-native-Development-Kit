// Run from a separate project after installing the Kit package.
import { createActionGuard, createSignedApprovalAuthority } from 'ai-native-development-kit';

const tools = [{
  name: 'delete_demo_record',
  purpose: 'Delete a demo record.',
  access: 'destructive',
  riskLevel: 'high',
  requiredPermissions: ['records:delete'],
  requiresApproval: true,
  idempotent: false,
  audit: true,
  sideEffects: 'Removes a record.',
  retryPolicy: 'Inspect provider state before retry.',
  verificationStrategy: 'Confirm the record is absent.',
  recoveryStrategy: 'Escalate to human review.',
}];

// Demonstration only: real approval credentials must come from a separate
// trusted human/application boundary, never a coding agent.
const authority = createSignedApprovalAuthority({
  secret: 'demo-only-not-a-real-secret-123',
});
const guard = createActionGuard({
  tools,
  policyVersion: 'demo-policy-v1',
  toolContractVersion: 'demo-tools-v1',
  approvalAuthority: authority,
});
const proposal = guard.propose({
  toolName: 'delete_demo_record',
  target: 'record:sample',
  params: { id: 'sample' },
});
let deleted = false;
const invoke = async () => { deleted = true; return { deleted: true }; };
const verify = async () => ({ verified: deleted });
const actor = { id: 'demo-agent', permissions: ['records:delete'] };

// No approval: execution must fail closed and never invoke the provider.
const denied = await guard.execute({ actor, proposal, invoke, verify });
if (denied.execution.executed || deleted) {
  throw new Error('Unsafe: destructive action executed without approval');
}

// A trusted human/application system issues a bound credential in production.
const approvalCredential = await authority.issue(proposal, {
  approverId: 'trusted-demo-human',
});
const accepted = await guard.execute({
  actor, proposal, approvalCredential, invoke, verify,
});
if (accepted.execution.status !== 'SUCCEEDED' || !deleted) {
  throw new Error('Expected verified protected action success');
}
console.log('PASS: unapproved action blocked; approved action verified.');
