import { createActionGuard } from '../../runtime/index.mjs';

export const taskTool = Object.freeze({
  name: 'create_task', purpose: 'Create a demo task in an isolated agent store.',
  access: 'write', riskLevel: 'high', requiredPermissions: ['task:create'],
  requiresApproval: true, idempotent: false, audit: true,
  sideEffects: 'Creates a new task in local agent storage.',
  retryPolicy: 'Inspect task state before retrying.',
  verificationStrategy: 'Read back the task using its ID.',
  recoveryStrategy: 'Inspect the task; do not blindly repeat the write.',
});

/**
 * Callable from trusted server-side Agent logic only.
 * The credential MUST originate at a separate authenticated approval boundary.
 * Model messages and HTTP bodies must never mint approval credentials.
 */
export function createGuardedTaskService({ approvalAuthority, store, audit = async () => {} }) {
  if (!approvalAuthority?.verify || !approvalAuthority?.claim) throw new Error('TRUSTED_AUTHORITY_REQUIRED');
  if (!store?.create || !store?.get) throw new Error('TASK_STORE_REQUIRED');
  const guard = createActionGuard({
    tools: [taskTool], approvalAuthority,
    policyVersion: 'cloudflare-pilot-v1',
    toolContractVersion: 'cloudflare-pilot-tools-v1',
  });
  function validateProposal(proposal) {
    if (!proposal || proposal.toolName !== 'create_task') throw new Error('INVALID_PROPOSAL');
    const { id, title } = proposal.params ?? {};
    if (proposal.target !== id || typeof id !== 'string' || !id.trim() ||
        typeof title !== 'string' || !title.trim()) throw new Error('INVALID_TASK');
    // The signature is not a trusted field on an object supplied by the caller.
    const expected = guard.propose({ toolName: 'create_task', target: id,
      params: { id, title }, scope: proposal.scope ?? null });
    if (expected.actionSignature !== proposal.actionSignature)
      throw new Error('PROPOSAL_SIGNATURE_MISMATCH');
    return { id, title };
  }
  return {
    propose(id, title) {
      if (typeof id !== 'string' || !id.trim() || typeof title !== 'string' || !title.trim())
        throw new Error('INVALID_TASK');
      return guard.propose({ toolName: 'create_task', target: id, params: { id, title } });
    },
    async reconcile(proposal) {
      const { id, title } = validateProposal(proposal);
      let outcome;
      try {
        const actual = await store.get(id);
        outcome = actual == null
          ? { status: 'ABSENT', resolved: false }
          : actual.title === title
            ? { status: 'CONFIRMED', resolved: true }
            : { status: 'CONFLICT', resolved: false };
      } catch {
        outcome = { status: 'UNKNOWN', resolved: false };
      }
      // This is an observation, not authorization to retry or a claim of exactly-once.
      await audit({ event: 'task_reconciled', signature: proposal.actionSignature,
        status: outcome.status });
      return { ...outcome, actionSignature: proposal.actionSignature };
    },
    async execute({ proposal, credential, actor }) {
      const { id, title } = validateProposal(proposal);
      const result = await guard.execute({
        actor, proposal, approvalCredential: credential,
        invoke: async () => store.create(id, title),
        verify: async () => ({ verified: (await store.get(id))?.title === title }),
      });
      await audit({ event: 'task_execution_result', status: result.execution.status,
        signature: proposal.actionSignature });
      return result;
    },
  };
}
