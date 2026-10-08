/**
 * Official Cloudflare Agents SDK integration.
 * This intentionally exposes only a read-only HTTP endpoint. The guarded action
 * is a server-side method and must be called by trusted application code with
 * an externally issued approval credential (never by unauthenticated HTTP).
 */
import { Agent, routeAgentRequest } from 'agents';
import { createGuardedTaskService } from './guarded-task.mjs';
import { createDurableApprovalAuthority } from './durable-approval-authority.mjs';
import { createSignedApprovalAuthority } from '../../runtime/index.mjs';

interface Env {
  TaskAgent: DurableObjectNamespace;
  PILOT_SIGNING_SECRET?: string;
  PILOT_CALLER_TOKEN?: string;
}

export class TaskAgent extends Agent<Env> {
  private prepare() {
    this.sql`CREATE TABLE IF NOT EXISTS pilot_tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL)`;
  }

  async onRequest(request: Request) {
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
    return Response.json({ service: 'cloudflare-agent-pilot', status: 'ready' });
  }

  // Read-only reconciliation. Callable only from trusted server code; never
  // interprets absence as permission to retry an already claimed operation.
  async reconcileTrustedTask(id: string, title: string) {
    this.prepare();
    const service = createGuardedTaskService({
      approvalAuthority: { verify: async () => ({ valid: false }), claim: async () => ({ valid: false }) },
      store: {
        create: async () => { throw new Error('RECONCILIATION_IS_READ_ONLY'); },
        get: async (taskId: string) =>
          this.sql<{ id: string; title: string }>`SELECT id, title FROM pilot_tasks WHERE id = ${taskId}`[0] ?? null,
      },
    });
    return service.reconcile(service.propose(id, title));
  }

  // This RPC cannot trust caller-supplied identity or function objects.
  // Authentication is deliberately a single test-only service principal;
  // multi-user deployments need identity-bound signed requests.
  async executeTrustedTask(input: {
    id: string; title: string; approvalCredential: unknown; callerToken: string;
  }) {
    const token = this.env.PILOT_CALLER_TOKEN;
    const secret = this.env.PILOT_SIGNING_SECRET;
    if (!token || !secret || token.length < 16 || secret.length < 16 ||
        input?.callerToken !== token) throw new Error('UNAUTHORIZED_RPC');
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
      sql: (strings: TemplateStringsArray, ...values: (string | number | boolean | null)[]) => this.sql(strings, ...values),
      signer: createSignedApprovalAuthority({ secret }),
    });
    const service = createGuardedTaskService({ approvalAuthority, store });
    return service.execute({
      proposal: service.propose(input.id, input.title),
      credential: input.approvalCredential,
      actor: { id: 'pilot-service-principal', permissions: ['task:create'] },
    });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return (await routeAgentRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
};
