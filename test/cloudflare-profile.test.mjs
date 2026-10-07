import test from 'node:test';
import assert from 'node:assert/strict';

import { DurableApprovalClient } from '../profiles/cloudflare/durable-approval-client.mjs';
import { CloudflareRateLimitBudget } from '../profiles/cloudflare/rate-limit-budget.mjs';
import { CloudflareWorkflowQueue } from '../profiles/cloudflare/queue-workflow.mjs';
import { D1AuditStore } from '../profiles/cloudflare/d1-audit-store.mjs';

test('Durable Approval client routes RPC by stable scope key', async () => {
  const calls = [];
  const stub = {
    async claimApproval(id, signature) {
      calls.push({ id, signature });
      return { claimed: true };
    },
  };
  const namespace = {
    getByName(name) {
      assert.equal(name, 'tenant-1:repo:main');
      return stub;
    },
  };

  const client = new DurableApprovalClient(namespace);
  const result = await client.claim('tenant-1:repo:main', 'approval-1', 'sig-1');

  assert.equal(result.claimed, true);
  assert.deepEqual(calls, [{ id: 'approval-1', signature: 'sig-1' }]);
});

test('Cloudflare rate-limit budget maps provider result to allowed', async () => {
  const budget = new CloudflareRateLimitBudget({
    async limit({ key }) {
      return { success: key === 'allowed' };
    },
  });

  assert.equal((await budget.consume('allowed')).allowed, true);
  assert.equal((await budget.consume('blocked')).allowed, false);
});

test('Cloudflare workflow queue requires workflow identity', async () => {
  const sent = [];
  const queue = new CloudflareWorkflowQueue({
    async send(message) { sent.push(message); },
  });

  await assert.rejects(queue.enqueue({}), { message: 'WORKFLOW_ID_REQUIRED' });
  const result = await queue.enqueue({ workflowId: 'wf-1', step: 'one' });

  assert.equal(result.accepted, true);
  assert.equal(sent[0].workflowId, 'wf-1');
});

test('D1 audit store uses bound prepared statements', async () => {
  const bound = [];
  const db = {
    prepare(sql) {
      return {
        bind(...args) {
          bound.push({ sql, args });
          return {
            async run() { return { success: true }; },
            async all() { return { results: [] }; },
          };
        },
      };
    },
  };

  const store = new D1AuditStore(db);
  const result = await store.appendAudit({
    id: 'audit-1',
    event: 'execution_started',
    actionSignature: 'sig-1',
  });

  assert.equal(result.id, 'audit-1');
  assert.equal(bound.length, 1);
  assert.match(bound[0].sql, /INSERT INTO agent_audit/);
});
