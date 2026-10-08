/**
 * Official Cloudflare Agents SDK integration.
 * This intentionally exposes only a read-only HTTP endpoint. The guarded action
 * is a server-side method and must be called by trusted application code with
 * an externally issued approval credential (never by unauthenticated HTTP).
 */
import { Agent, routeAgentRequest } from 'agents';
import { createGuardedTaskService } from './guarded-task.mjs';
import { createDurableApprovalAuthority } from './durable-approval-authority.mjs';

interface Env { TaskAgent: DurableObjectNamespace; }
interface CredentialAuthority {
  verify: (credential: unknown, proposal: unknown) => Promise<unknown>;
  claim: (credential: unknown, proposal: unknown) => Promise<unknown>;
}

export class TaskAgent extends Agent<Env> {
  private prepare() {
    this.sql`CREATE TABLE IF NOT EXISTS pilot_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`;
  }

  async onRequest(request: Request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return Response.json({ service: 'cloudflare-agent-pilot', status: 'ready' });
  }

  // Trusted server-side invocation. The authority must be independent of the model.
  async executeTrustedTask(input: {
    id: string; title: string; actor: { id: string; permissions: string[] };
    approvalCredential: unknown; approvalAuthority: CredentialAuthority;
  }) {
    this.prepare();
    const store = {
      create: async (id: string, title: string) => {
        this.sql`INSERT INTO pilot_tasks (id, title) VALUES (${id}, ${title})`;
        return { id };
      },
      get: async (id: string) =>
        this.sql<{ id: string; title: string }>`SELECT id, title FROM pilot_tasks WHERE id = ${id}`[0] ?? null,
    };
    const approvalAuthority = createDurableApprovalAuthority({
      sql: (strings: TemplateStringsArray, ...values: unknown[]) => this.sql(strings, ...values),
      signer: input.approvalAuthority,
    });
    const service = createGuardedTaskService({ approvalAuthority, store });
    return service.execute({
      proposal: service.propose(input.id, input.title),
      credential: input.approvalCredential,
      actor: input.actor,
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
};
