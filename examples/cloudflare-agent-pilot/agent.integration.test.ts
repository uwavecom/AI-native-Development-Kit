import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createSignedApprovalAuthority } from '../../runtime/index.mjs';
import type { TaskAgent } from './agent';

describe('real Workers runtime / Durable Object agent pilot', () => {
  it('routes HTTP requests to the official SDK Agent', async () => {
    const response = await env.TaskAgent.get(env.TaskAgent.idFromName('http-route-smoke')).fetch('https://example.com/');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ service: 'cloudflare-agent-pilot', status: 'ready' });
  });

  it('persists approved tasks and blocks replay across independent agent interactions', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('durable-claims-and-tasks'));
    const signer = () => createSignedApprovalAuthority({ secret: 'non-production-test-secret-123456' });
    let credential: Awaited<ReturnType<ReturnType<typeof signer>['issue']>>;
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      // Prepare a proposal through the same public contract as the guarded service.
      const { createGuardedTaskService } = await import('./guarded-task.mjs');
      const service = createGuardedTaskService({
        approvalAuthority: signer(),
        store: { create: async () => ({}), get: async () => null },
      });
      const proposal = service.propose('persisted-2', 'Durable task');
      credential = await signer().issue(proposal, { approverId: 'test-owner' });
      const result = await agent.executeTrustedTask({
        id: 'persisted-2', title: 'Durable task',
        actor: { id: 'agent-1', permissions: ['task:create'] },
        approvalCredential: credential, approvalAuthority: signer(),
      });
      expect(result.execution.status).toBe('SUCCEEDED');
    });
    // A new wrapper and a freshly constructed verifier cannot reset the persisted claim.
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      const rows = agent.sql<{ title: string }>`SELECT title FROM pilot_tasks WHERE id = ${'persisted-2'}`;
      expect(rows[0]?.title).toBe('Durable task');
      const replay = await agent.executeTrustedTask({
        id: 'persisted-2', title: 'Durable task',
        actor: { id: 'agent-1', permissions: ['task:create'] },
        approvalCredential: credential, approvalAuthority: signer(),
      });
      expect(replay.execution.status).toBe('FAILED');
      expect(replay.execution.executed).toBe(false);
      expect(replay.execution.error).toBe('APPROVAL_ALREADY_CONSUMED');
      const count = agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'persisted-2'}`;
      expect(count[0]?.total).toBe(1);
    });
  });

  it('cannot execute a tampered task with a valid signed approval for another title', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('tamper-boundary'));
    const authority = createSignedApprovalAuthority({ secret: 'non-production-test-secret-123456' });
    const { createGuardedTaskService } = await import('./guarded-task.mjs');
    const probe = createGuardedTaskService({
      approvalAuthority: authority,
      store: { create: async () => ({}), get: async () => null },
    });
    const credential = await authority.issue(probe.propose('changed', 'Original'), { approverId: 'owner' });
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      await expect(agent.executeTrustedTask({
        id: 'changed', title: 'Modified',
        actor: { id: 'agent-1', permissions: ['task:create'] },
        approvalCredential: credential,
        approvalAuthority: createSignedApprovalAuthority({ secret: 'non-production-test-secret-123456' }),
      })).rejects.toThrow('APPROVAL_PROPOSAL_MISMATCH');
      expect(agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'changed'}`[0]?.total).toBe(0);
    });
  });
});
