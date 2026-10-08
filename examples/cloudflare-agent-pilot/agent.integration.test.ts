import { env, runInDurableObject } from 'cloudflare:test';
import { describe, expect, it } from 'vitest';
import { createSignedApprovalAuthority } from '../../runtime/index.mjs';
import { createGuardedTaskService } from './guarded-task.mjs';
import type { TaskAgent } from './agent';

describe('real Workers runtime / Durable Object agent pilot', () => {
  it('routes HTTP requests to the official SDK Agent', async () => {
    const id = env.TaskAgent.idFromName('http-route-smoke');
    const response = await env.TaskAgent.get(id).fetch('https://example.com/');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ service: 'cloudflare-agent-pilot', status: 'ready' });
  });

  it('persists a guarded approved task inside the Durable Object SQLite database', async () => {
    const stub = env.TaskAgent.get(env.TaskAgent.idFromName('guarded-sqlite-persistence'));
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      agent.sql`CREATE TABLE IF NOT EXISTS pilot_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`;
      const store = {
        create: async (id: string, title: string) => {
          agent.sql`INSERT INTO pilot_tasks (id, title) VALUES (${id}, ${title})`;
          return { id };
        },
        get: async (id: string) =>
          agent.sql<{ id: string; title: string }>`SELECT id, title FROM pilot_tasks WHERE id = ${id}`[0] ?? null,
      };
      const authority = createSignedApprovalAuthority({ secret: 'non-production-test-secret-123456' });
      const service = createGuardedTaskService({ approvalAuthority: authority, store });
      const proposal = service.propose('persisted-1', 'Durable task');
      const credential = await authority.issue(proposal, { approverId: 'test-owner' });
      const result = await service.execute({
        proposal, credential, actor: { id: 'agent-1', permissions: ['task:create'] },
      });
      expect(result.execution.status).toBe('SUCCEEDED');
      await expect(service.execute({
        proposal, credential, actor: { id: 'agent-1', permissions: ['task:create'] },
      })).rejects.toThrow('APPROVAL_ALREADY_CONSUMED');
    });
    await runInDurableObject(stub, async (agent: TaskAgent) => {
      const records = agent.sql<{ title: string }>`SELECT title FROM pilot_tasks WHERE id = ${'persisted-1'}`;
      expect(records[0]?.title).toBe('Durable task');
    });
  });
});
