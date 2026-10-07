import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createActionProposal,
  createApprovalReceipt,
} from '../runtime/action-proposal.mjs';
import { runSafeAction } from '../runtime/safe-action.mjs';
import { decideAction, Decision } from '../runtime/action-decision.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

const byName = (tools, name) => tools.find(tool => tool.name === name);

test('canonical proposal binds approval to exact parameters', () => {
  const a = createActionProposal({
    toolName: 'create_alert',
    target: 'NASDAQ:NVDA',
    params: { threshold: 150, condition: 'cross_up' },
  });
  const b = createActionProposal({
    toolName: 'create_alert',
    target: 'NASDAQ:NVDA',
    params: { condition: 'cross_up', threshold: 150 },
  });
  const c = createActionProposal({
    toolName: 'create_alert',
    target: 'NASDAQ:NVDA',
    params: { condition: 'cross_up', threshold: 151 },
  });

  assert.equal(a.actionSignature, b.actionSignature);
  assert.notEqual(a.actionSignature, c.actionSignature);
});

test('expired approval cannot authorize execution', () => {
  const tool = byName(tradingViewTools, 'create_alert');
  const proposal = createActionProposal({
    toolName: tool.name,
    target: 'NASDAQ:NVDA',
    params: { threshold: 150 },
  });
  const approval = createApprovalReceipt({
    proposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
    expiresAt: '2026-10-07T10:05:00Z',
  });

  const result = decideAction(tool, { permissions: ['alert:write'] }, {
    proposal,
    approval,
    now: new Date('2026-10-07T10:06:00Z').getTime(),
  });

  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('one-shot approval is consumed after execution', async () => {
  const tool = byName(tradingViewTools, 'create_alert');
  const proposal = createActionProposal({
    toolName: tool.name,
    target: 'NASDAQ:NVDA',
    params: { threshold: 150 },
  });
  const approval = createApprovalReceipt({
    proposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
    oneShot: true,
  });

  const result = await runSafeAction({
    tool,
    actor: { permissions: ['alert:write'] },
    proposal,
    approval,
    input: proposal.params,
    invoke: async () => ({ id: 'a1' }),
    verify: async () => ({ verified: true }),
  });

  assert.equal(result.execution.status, 'SUCCEEDED');
  assert.equal(result.approvalReceipt.consumed, true);

  const secondDecision = decideAction(tool, { permissions: ['alert:write'] }, {
    proposal,
    approval: result.approvalReceipt,
  });
  assert.equal(secondDecision.decision, Decision.REQUIRE_APPROVAL);
});

test('unknown execution is resolved by provider-state inspection', async () => {
  const tool = byName(githubTools, 'update_file');
  const proposal = createActionProposal({
    toolName: tool.name,
    target: 'README.md',
    params: { expectedSha: 'abc', contentHash: 'def' },
  });
  const approval = createApprovalReceipt({
    proposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
  });
  const timeout = Object.assign(new Error('timeout'), { code: 'TIMEOUT_AFTER_DISPATCH' });

  const result = await runSafeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    proposal,
    approval,
    input: proposal.params,
    invoke: async () => { throw timeout; },
    verify: async () => ({ verified: true }),
    inspectState: async () => ({ desiredState: true }),
  });

  assert.equal(result.execution.status, 'UNKNOWN');
  assert.equal(result.recovery.decision, 'VERIFY_STATE');
  assert.equal(result.recovery.recoveredAs, 'SUCCEEDED');
  assert.equal(result.resolved, true);
});

test('rollback itself cannot bypass approval policy', async () => {
  const original = byName(githubTools, 'update_file');
  const originalProposal = createActionProposal({
    toolName: original.name,
    target: 'README.md',
    params: { contentHash: 'bad' },
  });
  const originalApproval = createApprovalReceipt({
    proposal: originalProposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
  });

  const rollbackProposal = createActionProposal({
    toolName: original.name,
    target: 'README.md',
    params: { contentHash: 'previous' },
  });

  const result = await runSafeAction({
    tool: original,
    actor: { permissions: ['repo:write'] },
    proposal: originalProposal,
    approval: originalApproval,
    input: originalProposal.params,
    invoke: async () => ({ commit: 'bad-commit' }),
    verify: async () => ({ verified: false, reason: 'BLOB_MISMATCH' }),
    inspectState: async () => ({ canRollback: true }),
    rollbackAction: {
      tool: original,
      actor: { permissions: ['repo:write'] },
      context: { proposal: rollbackProposal },
      input: rollbackProposal.params,
      invoke: async () => ({ commit: 'revert-commit' }),
      verify: async () => ({ verified: true }),
    },
  });

  assert.equal(result.recovery.decision, 'ROLLBACK');
  assert.equal(result.recovery.rollbackResult.status, 'PENDING');
  assert.equal(result.resolved, false);
});

test('approved rollback passes the same execution pipeline and resolves', async () => {
  const tool = byName(githubTools, 'update_file');
  const originalProposal = createActionProposal({
    toolName: tool.name,
    target: 'README.md',
    params: { contentHash: 'bad' },
  });
  const originalApproval = createApprovalReceipt({
    proposal: originalProposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
  });

  const rollbackProposal = createActionProposal({
    toolName: tool.name,
    target: 'README.md',
    params: { contentHash: 'previous' },
  });
  const rollbackApproval = createApprovalReceipt({
    proposal: rollbackProposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:01:00Z',
  });

  const result = await runSafeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    proposal: originalProposal,
    approval: originalApproval,
    input: originalProposal.params,
    invoke: async () => ({ commit: 'bad-commit' }),
    verify: async () => ({ verified: false, reason: 'BLOB_MISMATCH' }),
    inspectState: async () => ({ canRollback: true }),
    rollbackAction: {
      tool,
      actor: { permissions: ['repo:write'] },
      context: { proposal: rollbackProposal, approval: rollbackApproval },
      input: rollbackProposal.params,
      invoke: async () => ({ commit: 'revert-commit' }),
      verify: async () => ({ verified: true }),
    },
  });

  assert.equal(result.recovery.rollbackResult.status, 'SUCCEEDED');
  assert.equal(result.recovery.rollbackResult.verified, true);
  assert.equal(result.resolved, true);
});

test('no safe recovery path ends in human intervention', async () => {
  const tool = byName(githubTools, 'update_file');
  const proposal = createActionProposal({
    toolName: tool.name,
    target: 'README.md',
    params: { contentHash: 'x' },
  });
  const approval = createApprovalReceipt({
    proposal,
    actorId: 'human-1',
    approvedAt: '2026-10-07T10:00:00Z',
  });

  const result = await runSafeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    proposal,
    approval,
    input: proposal.params,
    invoke: async () => ({ commit: '1' }),
    verify: async () => ({ verified: false }),
    inspectState: async () => ({ desiredState: false }),
  });

  assert.equal(result.recovery.decision, 'HUMAN_INTERVENTION');
  assert.equal(result.resolved, false);
});
