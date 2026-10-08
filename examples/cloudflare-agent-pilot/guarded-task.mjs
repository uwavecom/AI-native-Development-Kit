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
  return {
    propose(id, title) {
      if (typeof id !== 'string' || !id.trim() || typeof title !== 'string' || !title.trim())
        throw new Error('INVALID_TASK');
      return guard.propose({ toolName: 'create_task', target: id, params: { id, title } });
    },
    async execute({ proposal, credential, actor }) {
      if (!proposal || proposal.toolName !== 'create_task') throw new Error('INVALID_PROPOSAL');
      // Do not execute a different set of parameters from those covered by the signature.
      const { id, title } = proposal.params ?? {};
      if (proposal.target !== id || typeof id !== 'string' || !id.trim() ||
          typeof title !== 'string' || !title.trim()) throw new Error('INVALID_TASK');
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
