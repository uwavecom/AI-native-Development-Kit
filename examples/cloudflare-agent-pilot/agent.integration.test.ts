import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createSignedApprovalAuthority } from '../../runtime/index.mjs';
import type { TaskAgent } from './agent';
import { createGuardedTaskService } from './guarded-task.mjs';
import { createDurableApprovalAuthority } from './durable-approval-authority.mjs';

describe('real Workers runtime / Durable Object agent pilot', () => {
  it('routes HTTP requests to the official SDK Agent', async () => {
    const response = await env.TaskAgent.get(env.TaskAgent.idFromName('http-route-smoke')).fetch('https://example.com/');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ service: 'cloudflare-agent-pilot', status: 'ready' });
  });

  it('persists approved tasks and blocks replay across independent agent interactions', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('durable-claims-and-tasks'));
    const signer = () => createSignedApprovalAuthority({ secret: 'integration-test-only-signing-secret-2026' });
    let credential: Awaited<ReturnType<ReturnType<typeof signer>['issue']>>;
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      // Prepare a proposal through the same public contract as the guarded service.
      const { createGuardedTaskService } = await import('./guarded-task.mjs');
      const service = createGuardedTaskService({
        approvalAuthority: signer(),
        store: { create: async () => ({}), get: async () => null },
      });
      const proposal = service.propose('persisted-2', 'Durable task', { agentId: 'durable-claims-and-tasks' });
      credential = await signer().issue(proposal, { approverId: 'test-owner' });
      const result = await agent.executeTrustedTask({
        id: 'persisted-2', title: 'Durable task',
        approvalCredential: credential, callerToken: 'integration-test-only-caller-token-2026',
      });
      expect(result.execution.status).toBe('SUCCEEDED');
    });
    // A new wrapper and a freshly constructed verifier cannot reset the persisted claim.
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      const rows = agent.sql<{ title: string }>`SELECT title FROM pilot_tasks WHERE id = ${'persisted-2'}`;
      expect(rows[0]?.title).toBe('Durable task');
      const replay = await agent.executeTrustedTask({
        id: 'persisted-2', title: 'Durable task',
        approvalCredential: credential, callerToken: 'integration-test-only-caller-token-2026',
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
    const authority = createSignedApprovalAuthority({ secret: 'integration-test-only-signing-secret-2026' });
    const { createGuardedTaskService } = await import('./guarded-task.mjs');
    const probe = createGuardedTaskService({
      approvalAuthority: authority,
      store: { create: async () => ({}), get: async () => null },
    });
    const credential = await authority.issue(probe.propose('changed', 'Original', { agentId: 'tamper-boundary' }), { approverId: 'owner' });
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      await expect(agent.executeTrustedTask({
        id: 'changed', title: 'Modified',
        approvalCredential: credential, callerToken: 'integration-test-only-caller-token-2026',
      })).rejects.toThrow('APPROVAL_PROPOSAL_MISMATCH');
      expect(agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'changed'}`[0]?.total).toBe(0);
    });
  });
  it('does not repeat a write if execution is interrupted after the side effect', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('crash-after-write'));
    const signer = () => createSignedApprovalAuthority({ secret: 'integration-test-only-signing-secret-2026' });
    let credential: Awaited<ReturnType<ReturnType<typeof signer>['issue']>>;
    let observedStatus: string;
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      agent.sql`CREATE TABLE IF NOT EXISTS pilot_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`;
      const authority = createDurableApprovalAuthority({
        sql: (strings: TemplateStringsArray, ...values: (string | number | boolean | null)[]) =>
          agent.sql(strings, ...values),
        signer: signer(),
        coordinator: {
          claim: (proof: string, signature: string) => agent.env.ApprovalCoordinator
            .getByName('pilot-global').claim(proof, signature, 'integration-test-only-caller-token-2026'),
        },
      });
      // Fault injection: the SQLite write commits, then the provider throws
      // before returning an acknowledgement to the guarded runtime.
      const service = createGuardedTaskService({
        approvalAuthority: authority,
        store: {
          create: async (id: string, title: string) => {
            agent.sql`INSERT INTO pilot_tasks (id, title) VALUES (${id}, ${title})`;
            throw new Error('SIMULATED_LOST_ACK');
          },
          get: async (id: string) =>
            agent.sql<{ title: string }>`SELECT title FROM pilot_tasks WHERE id = ${id}`[0] ?? null,
        },
      });
      const proposal = service.propose('crash-1', 'One task only', { agentId: 'crash-after-write' });
      credential = await signer().issue(proposal, { approverId: 'test-owner' });
      const result = await service.execute({
        proposal, credential, actor: { id: 'agent-1', permissions: ['task:create'] },
      });
      observedStatus = result.execution.status;
      expect(result.execution.status).not.toBe('SUCCEEDED');
      expect(agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'crash-1'}`[0]?.total).toBe(1);
    });
    // A separate interaction with a fresh signer must not invoke the write.
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      const retry = await agent.executeTrustedTask({
        id: 'crash-1', title: 'One task only',
        approvalCredential: credential, callerToken: 'integration-test-only-caller-token-2026',
      });
      expect(retry.execution.executed).toBe(false);
      expect(retry.execution.error).toBe('APPROVAL_ALREADY_CONSUMED');
      expect(agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'crash-1'}`[0]?.total).toBe(1);
      // Explicit state inspection can establish that the original write exists.
      expect(agent.sql<{ title: string }>`SELECT title FROM pilot_tasks WHERE id = ${'crash-1'}`[0]?.title).toBe('One task only');
    });
    expect(observedStatus).not.toBe('SUCCEEDED');
  });
  it('reconciles confirmed, absent and conflicting outcomes without writing again', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('read-only-reconciliation'));
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      agent.sql`CREATE TABLE IF NOT EXISTS pilot_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`;
      agent.sql`INSERT INTO pilot_tasks (id, title) VALUES (${'existing'}, ${'Original'})`;
      expect((await agent.reconcileTrustedTask('existing', 'Original')).status).toBe('CONFIRMED');
      expect((await agent.reconcileTrustedTask('existing', 'Modified')).status).toBe('CONFLICT');
      const absent = await agent.reconcileTrustedTask('missing', 'New task');
      expect(absent.status).toBe('ABSENT');
      expect(absent.resolved).toBe(false);
      expect(agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks`[0]?.total).toBe(1);
    });
  });

  it('does not infer success when state inspection fails', async () => {
    const service = createGuardedTaskService({
      approvalAuthority: { verify: async () => ({ valid: false }), claim: async () => ({ valid: false }) },
      store: {
        create: async () => { throw new Error('SHOULD_NOT_RUN'); },
        get: async () => { throw new Error('READ_FAILED'); },
      },
    });
    const result = await service.reconcile(service.propose('unknown', 'Task'));
    expect(result.status).toBe('UNKNOWN');
    expect(result.resolved).toBe(false);
  });
  it('rejects unauthenticated RPC before modifying SQLite', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('rpc-identity-test'));
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      await expect(agent.executeTrustedTask({
        id: 'forbidden', title: 'Must not persist',
        approvalCredential: null, callerToken: 'untrusted-client-token',
      })).rejects.toThrow('UNAUTHORIZED_RPC');
    });
  });
  it('refuses to execute an approval granted to a different named agent', async () => {
    const signer = createSignedApprovalAuthority({ secret: 'integration-test-only-signing-secret-2026' });
    const probe = createGuardedTaskService({
      approvalAuthority: signer,
      store: { create: async () => ({}), get: async () => null },
    });
    const proposal = probe.propose('cross-agent', 'Private task', { agentId: 'agent-alpha' });
    const credential = await signer.issue(proposal, { approverId: 'test-owner' });
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('agent-beta'));
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      await expect(agent.executeTrustedTask({
        id: 'cross-agent', title: 'Private task',
        approvalCredential: credential,
        callerToken: 'integration-test-only-caller-token-2026',
      })).rejects.toThrow('APPROVAL_PROPOSAL_MISMATCH');
      const rows = agent.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks WHERE id = ${'cross-agent'}`;
      expect(rows[0]?.total).toBe(0);
    });
  });
  it('central coordinator revokes an unclaimed approval across named agents', async () => {
    const signer = createSignedApprovalAuthority({ secret: 'integration-test-only-signing-secret-2026' });
    const probe = createGuardedTaskService({
      approvalAuthority: signer,
      store: { create: async () => ({}), get: async () => null },
    });
    const proposal = probe.propose('revoke-demo', 'Blocked task', { agentId: 'agent-revoked' });
    const credential = await signer.issue(proposal, { approverId: 'owner' });
    const coordinator = env.ApprovalCoordinator.getByName('pilot-global');
    const revoked = await coordinator.revoke(credential.proof, 'integration-test-only-revoker-token-2026');
    expect(revoked.revoked).toBe(true);
    const agent = env.TaskAgent.get(env.TaskAgent.idFromName('agent-revoked'));
    await runInDurableObject(agent, async (instance: TaskAgent) => {
      const result = await instance.executeTrustedTask({
        id: 'revoke-demo', title: 'Blocked task',
        approvalCredential: credential, callerToken: 'integration-test-only-caller-token-2026',
      });
      expect(result.execution.executed).toBe(false);
      expect(result.execution.error).toBe('APPROVAL_REVOKED');
      expect(instance.sql<{ total: number }>`SELECT COUNT(*) AS total FROM pilot_tasks`[0]?.total).toBe(0);
    });
  });
  it('separates execute and revoke authority', async () => {
    const coordinator = env.ApprovalCoordinator.getByName('pilot-global');
    await runInDurableObject(coordinator, async (instance) => {
      await expect(instance.claim('a'.repeat(64), 'b'.repeat(64),
        'integration-test-only-revoker-token-2026')).rejects.toThrow('UNAUTHORIZED_COORDINATOR');
      await expect(instance.revoke('c'.repeat(64),
        'integration-test-only-caller-token-2026')).rejects.toThrow('UNAUTHORIZED_REVOKER');
    });
  });

  it('arbitrates concurrent claims for one approval exactly once', async () => {
    const coordinator = env.ApprovalCoordinator.getByName('pilot-global');
    const proof = 'd'.repeat(64);
    const signature = 'e'.repeat(64);
    const responses = await Promise.all(Array.from({length: 12}, () =>
      coordinator.claim(proof, signature, 'integration-test-only-caller-token-2026')));
    expect(responses.filter(result => result.valid).length).toBe(1);
    expect(responses.filter(result => result.reason === 'APPROVAL_ALREADY_CONSUMED').length).toBe(11);
    const revoke = await coordinator.revoke(proof, 'integration-test-only-revoker-token-2026');
    expect(revoke.revoked).toBe(false);
  });

  it('arbitrates concurrent revoke and claim without ambiguous double outcome', async () => {
    const coordinator = env.ApprovalCoordinator.getByName('pilot-global');
    const proof = 'f'.repeat(64);
    const results = await Promise.all([
      coordinator.revoke(proof, 'integration-test-only-revoker-token-2026'),
      coordinator.claim(proof, '1'.repeat(64), 'integration-test-only-caller-token-2026'),
    ]);
    const [revoke, claim] = results;
    expect(Number(revoke.revoked) + Number(claim.valid)).toBe(1);
    expect(claim.valid || claim.reason === 'APPROVAL_REVOKED').toBe(true);
  });
  it('fails closed if GitHub installation is not configured on the Worker', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('unconfigured-github-rpc'));
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      await expect(agent.executeTrustedGitHubIssue({
        repository: 'example-org/example-repo',
        operationId: 'unconfigured-case',
        title: 'Must not create', body: 'No GitHub token provided',
        approvalCredential: null,
        callerToken: 'integration-test-only-caller-token-2026',
      })).rejects.toThrow('GITHUB_INTEGRATION_NOT_CONFIGURED');
    });
  });
});
