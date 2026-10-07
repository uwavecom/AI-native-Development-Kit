import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { FileStateStore } from '../runtime/state/file-state-store.mjs';
import { KeyedLock } from '../runtime/concurrency/keyed-lock.mjs';
import { FixedWindowBudget } from '../runtime/budget/fixed-window-budget.mjs';
import { createReferenceAgent } from '../examples/reference-agent-runtime/reference-agent.mjs';
import { FakeGitHubProvider, FakeTradingViewProvider } from '../examples/reference-agent-runtime/fake-providers.mjs';

async function fixture(limit = 100) {
  const root = await mkdtemp(join(tmpdir(), 'kit-reference-agent-'));
  const stateStore = new FileStateStore(root);
  const github = new FakeGitHubProvider();
  const tradingView = new FakeTradingViewProvider();
  const agent = createReferenceAgent({
    stateStore,
    lock: new KeyedLock(),
    budget: new FixedWindowBudget({ limit, windowMs: 60_000 }),
    github,
    tradingView,
  });
  return { root, stateStore, github, tradingView, agent };
}

test('TradingView scenario completes through proposal, approval, execution and verification', async () => {
  const x = await fixture();
  try {
    const result = await x.agent.analyzeAndCreateAlert({
      actor: { id: 'agent-1', permissions: ['alert:write'] },
      threshold: 150,
    });
    assert.equal(result.resolved, true);
    assert.equal(result.resolvedSymbol, 'NASDAQ:NVDA');
    assert.equal(result.action.execution.status, 'SUCCEEDED');
    assert.ok(x.tradingView.findAlert(result.proposal.params));
  } finally {
    await rm(x.root, { recursive: true, force: true });
  }
});

test('timeout-after-dispatch is recovered by provider-state inspection', async () => {
  const x = await fixture();
  try {
    x.tradingView.inject('create_alert', 'timeout_after_dispatch');
    const result = await x.agent.analyzeAndCreateAlert({
      actor: { id: 'agent-1', permissions: ['alert:write'] },
      threshold: 151,
    });
    assert.equal(result.action.execution.status, 'UNKNOWN');
    assert.equal(result.action.recovery.decision, 'VERIFY_STATE');
    assert.equal(result.resolved, true);
  } finally {
    await rm(x.root, { recursive: true, force: true });
  }
});

test('GitHub workflow stops before merge without merge approval', async () => {
  const x = await fixture();
  try {
    const result = await x.agent.githubChangeWorkflow({
      actor: {
        id: 'agent-1',
        permissions: ['repo:read', 'repo:write', 'repo:merge'],
      },
      content: 'changed',
      approveMerge: false,
    });

    assert.equal(result.status, 'PARTIAL');
    assert.equal(result.failedStep, 'merge');
    assert.equal(x.github.pullRequests.get(result.prNumber).merged, false);
  } finally {
    await rm(x.root, { recursive: true, force: true });
  }
});

test('GitHub workflow completes when merge has bound approval', async () => {
  const x = await fixture();
  try {
    const result = await x.agent.githubChangeWorkflow({
      actor: {
        id: 'agent-1',
        permissions: ['repo:read', 'repo:write', 'repo:merge'],
      },
      content: 'changed',
      approveMerge: true,
    });

    assert.equal(result.status, 'SUCCEEDED');
    assert.equal(result.resolved, true);
    assert.equal(x.github.pullRequests.get(result.prNumber).merged, true);
  } finally {
    await rm(x.root, { recursive: true, force: true });
  }
});

test('budget exhaustion prevents uncontrolled agent execution', async () => {
  const x = await fixture(1);
  try {
    const result = await x.agent.githubChangeWorkflow({
      actor: {
        id: 'agent-1',
        permissions: ['repo:read', 'repo:write', 'repo:merge'],
      },
      content: 'changed',
      approveMerge: true,
    });

    assert.equal(result.status, 'PARTIAL');
    assert.equal(result.failedStep, 'branch');
  } finally {
    await rm(x.root, { recursive: true, force: true });
  }
});
