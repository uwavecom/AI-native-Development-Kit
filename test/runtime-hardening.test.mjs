import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileStateStore } from '../runtime/state/file-state-store.mjs';
import { KeyedLock } from '../runtime/concurrency/keyed-lock.mjs';
import { FixedWindowBudget } from '../runtime/budget/fixed-window-budget.mjs';
import { CapabilityRegistry } from '../runtime/capabilities/capability-registry.mjs';
import { runWorkflow } from '../runtime/workflow/run-workflow.mjs';
import { runHardenedSafeAction } from '../runtime/hardened-safe-action.mjs';
import { createActionProposal, createApprovalReceipt } from '../runtime/action-proposal.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

const byName = (tools, name) => tools.find(tool => tool.name === name);

test('file state store persists approvals and append-only audit records', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kit-state-'));
  try {
    const store = new FileStateStore(root);
    await store.putApproval('a1', { valid: true, oneShot: true });
    assert.equal((await store.getApproval('a1')).valid, true);
    assert.equal((await store.consumeApproval('a1')).consumed, true);
    await store.appendAudit({ event: 'x', value: 1 });
    await store.appendAudit({ event: 'y', value: 2 });
    assert.deepEqual((await store.readAudit()).map(x => x.event), ['x', 'y']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('keyed lock serializes actions targeting the same key', async () => {
  const lock = new KeyedLock();
  const order = [];
  let releaseFirst;
  const gate = new Promise(resolve => { releaseFirst = resolve; });

  const first = lock.run('same', async () => {
    order.push('first:start');
    await gate;
    order.push('first:end');
  });
  const second = lock.run('same', async () => {
    order.push('second:start');
    order.push('second:end');
  });

  await Promise.resolve();
  assert.deepEqual(order, ['first:start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start', 'second:end']);
});

test('fixed-window budget denies over-limit activity and resets', () => {
  let now = 0;
  const budget = new FixedWindowBudget({ limit: 2, windowMs: 1000, now: () => now });
  assert.equal(budget.consume('u').allowed, true);
  assert.equal(budget.consume('u').allowed, true);
  assert.equal(budget.consume('u').allowed, false);
  now = 1001;
  assert.equal(budget.consume('u').allowed, true);
});

test('capability registry discovers provider-neutral tools', () => {
  const registry = new CapabilityRegistry();
  registry.register('tradingview', { tools: tradingViewTools });
  registry.register('github', { tools: githubTools });

  assert.deepEqual(registry.listProviders(), ['github', 'tradingview']);
  assert.equal(registry.findTool('create_alert')[0].provider, 'tradingview');
  assert.ok(registry.discover(({ tool }) => tool.access === 'destructive').length >= 2);
});

test('workflow stops on failure and compensates completed steps in reverse order', async () => {
  const compensated = [];
  const result = await runWorkflow({
    steps: [
      { id: 'one', compensate: true },
      { id: 'two', compensate: true },
      { id: 'three', compensate: false },
    ],
    executeStep: async step => ({ resolved: step.id !== 'three' }),
    compensateStep: async step => {
      compensated.push(step.id);
      return { resolved: true };
    },
  });

  assert.equal(result.status, 'PARTIAL');
  assert.deepEqual(compensated, ['two', 'one']);
  assert.equal(result.allCompensated, true);
});

test('hardened action loads durable approval, audits, consumes budget, and persists one-shot consumption', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kit-hardened-'));
  try {
    const store = new FileStateStore(root);
    const lock = new KeyedLock();
    const budget = new FixedWindowBudget({ limit: 2, windowMs: 60_000 });
    const tool = byName(tradingViewTools, 'create_alert');
    const proposal = createActionProposal({
      toolName: tool.name,
      target: 'NASDAQ:NVDA',
      params: { threshold: 150 },
    });
    const approval = createApprovalReceipt({
      proposal,
      actorId: 'human-1',
      approvedAt: new Date().toISOString(),
      oneShot: true,
    });

    await store.putApproval('approval-1', approval);

    const result = await runHardenedSafeAction({
      tool,
      actor: { id: 'agent-1', permissions: ['alert:write'] },
      proposal,
      approvalId: 'approval-1',
      input: proposal.params,
      invoke: async () => ({ id: 'alert-1' }),
      verify: async () => ({ verified: true }),
      stateStore: store,
      lock,
      budget,
    });

    assert.equal(result.execution.status, 'SUCCEEDED');
    assert.equal((await store.getApproval('approval-1')).consumed, true);

    const events = (await store.readAudit()).map(x => x.event);
    assert.ok(events.includes('budget_consumed'));
    assert.ok(events.includes('policy_decided'));
    assert.ok(events.includes('verification_succeeded'));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('hardened action denies execution when budget is exhausted', async () => {
  const budget = new FixedWindowBudget({ limit: 1, windowMs: 60_000 });
  budget.consume('agent-1');

  const tool = byName(githubTools, 'fetch_file');
  const proposal = createActionProposal({
    toolName: tool.name,
    target: 'README.md',
  });

  let invoked = false;
  const result = await runHardenedSafeAction({
    tool,
    actor: { id: 'agent-1', permissions: ['repo:read'] },
    proposal,
    invoke: async () => { invoked = true; },
    budget,
  });

  assert.equal(result.execution.decision.reason, 'BUDGET_EXHAUSTED');
  assert.equal(invoked, false);
});
