import test from 'node:test';
import assert from 'node:assert/strict';
import { createSignedApprovalAuthority } from '../runtime/index.mjs';
import { createGuardedTaskService } from '../examples/cloudflare-agent-pilot/guarded-task.mjs';

const actor = { id: 'demo-agent', permissions: ['task:create'] };
function setup() {
  const tasks = new Map();
  const calls = [];
  const store = {
    async create(id, title) { calls.push({ id, title }); if (tasks.has(id)) throw new Error('DUPLICATE'); tasks.set(id, { id, title }); return { id }; },
    async get(id) { return tasks.get(id) ?? null; },
  };
  const authority = createSignedApprovalAuthority({ secret: 'example-only-private-secret-for-tests' });
  const service = createGuardedTaskService({ approvalAuthority: authority, store });
  return { service, authority, tasks, calls };
}
test('approved task is executed and verified', async () => {
  const { service, authority, tasks } = setup();
  const proposal = service.propose('task1', 'Draft a report');
  const credential = await authority.issue(proposal, { approverId: 'owner' });
  const result = await service.execute({ proposal, credential, actor });
  assert.equal(result.execution.status, 'SUCCEEDED');
  assert.equal(tasks.get('task1').title, 'Draft a report');
});
test('missing approval cannot invoke', async () => {
  const { service, calls } = setup();
  const result = await service.execute({ proposal: service.propose('t1', 'Test'), actor });
  assert.equal(result.execution.executed, false);
  assert.equal(calls.length, 0);
});
test('tampered parameters invalidate signed approval', async () => {
  const { service, authority, calls } = setup();
  const credential = await authority.issue(service.propose('t1', 'Original'), { approverId: 'owner' });
  await assert.rejects(service.execute({ proposal: service.propose('t1', 'Altered'), credential, actor }),
    { message: 'APPROVAL_PROPOSAL_MISMATCH' });
  assert.equal(calls.length, 0);
});
test('same one-shot credential cannot be reused', async () => {
  const { service, authority, calls } = setup();
  const proposal = service.propose('t1', 'Test');
  const credential = await authority.issue(proposal, { approverId: 'owner' });
  await service.execute({ proposal, credential, actor });
  await assert.rejects(service.execute({ proposal, credential, actor }), { message: 'APPROVAL_ALREADY_CONSUMED' });
  assert.equal(calls.length, 1);
});
test('unauthorized agent cannot create task even with approval', async () => {
  const { service, authority, calls } = setup();
  const proposal = service.propose('t1', 'Test');
  const credential = await authority.issue(proposal, { approverId: 'owner' });
  const result = await service.execute({ proposal, credential, actor: { id: 'guest', permissions: [] } });
  assert.equal(result.execution.executed, false);
  assert.equal(calls.length, 0);
});
test('invalid target never calls store', async () => {
  const { service, calls } = setup();
  assert.throws(() => service.propose('', 'Test'), { message: 'INVALID_TASK' });
  assert.equal(calls.length, 0);
});
