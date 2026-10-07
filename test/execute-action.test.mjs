import test from 'node:test';
import assert from 'node:assert/strict';
import { executeAction, ExecutionStatus } from '../runtime/execute-action.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

const byName = (tools, name) => tools.find(tool => tool.name === name);
const bound = (toolName, target, actionSignature) => ({
  proposal: { toolName, target, actionSignature },
  approval: { valid: true, toolName, target, actionSignature },
});

test('policy blocks execution before provider invocation', async () => {
  let invoked = false;
  const result = await executeAction({
    tool: byName(githubTools, 'merge_pull_request'),
    actor: { permissions: ['repo:merge'] },
    input: {},
    invoke: async () => { invoked = true; },
  });

  assert.equal(result.status, ExecutionStatus.PENDING);
  assert.equal(invoked, false);
});

test('verified TradingView write succeeds', async () => {
  const tool = byName(tradingViewTools, 'create_alert');
  const result = await executeAction({
    tool,
    actor: { permissions: ['alert:write'] },
    context: bound('create_alert', 'NASDAQ:NVDA', 'cross_up:150'),
    input: { symbol: 'NASDAQ:NVDA', threshold: 150 },
    invoke: async input => ({ id: 'alert-1', ...input }),
    verify: async ({ providerResult }) => ({
      verified: providerResult.id === 'alert-1',
    }),
  });

  assert.equal(result.status, ExecutionStatus.SUCCEEDED);
  assert.equal(result.verified, true);
});

test('timeout after dispatch becomes UNKNOWN for non-idempotent write', async () => {
  const tool = byName(githubTools, 'update_file');
  const error = new Error('timeout');
  error.code = 'TIMEOUT_AFTER_DISPATCH';

  const result = await executeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    context: bound('update_file', 'README.md', 'sha:abc→def'),
    input: {},
    invoke: async () => { throw error; },
    verify: async () => ({ verified: true }),
  });

  assert.equal(result.status, ExecutionStatus.UNKNOWN);
  assert.equal(result.error, 'UNKNOWN_EXECUTION_STATE');
  assert.equal(result.retrySafe, false);
});

test('write without verifier cannot claim success', async () => {
  const tool = byName(githubTools, 'create_branch');
  const result = await executeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    input: { branch: 'feat/x' },
    invoke: async () => ({ branch: 'feat/x' }),
  });

  assert.equal(result.status, ExecutionStatus.VERIFICATION_FAILED);
  assert.equal(result.verified, false);
});

test('failed verification is explicit', async () => {
  const tool = byName(githubTools, 'update_file');
  const result = await executeAction({
    tool,
    actor: { permissions: ['repo:write'] },
    context: bound('update_file', 'README.md', 'sha:abc→def'),
    input: {},
    invoke: async () => ({ commit: '123' }),
    verify: async () => ({ verified: false, reason: 'BLOB_MISMATCH' }),
  });

  assert.equal(result.status, ExecutionStatus.VERIFICATION_FAILED);
  assert.equal(result.verification.reason, 'BLOB_MISMATCH');
});

test('audit captures decision and execution lifecycle', async () => {
  const events = [];
  const tool = byName(tradingViewTools, 'create_alert');

  await executeAction({
    tool,
    actor: { permissions: ['alert:write'] },
    context: bound('create_alert', 'NASDAQ:NVDA', 'cross_up:150'),
    input: {},
    invoke: async () => ({ id: 'a1' }),
    verify: async () => ({ verified: true }),
    audit: async event => events.push(event.event),
  });

  assert.deepEqual(events, [
    'policy_decided',
    'approval_satisfied',
    'execution_started',
    'execution_succeeded',
    'verification_succeeded',
  ]);
});
