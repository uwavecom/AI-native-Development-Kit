import test from 'node:test';
import assert from 'node:assert/strict';
import { decideAction, Decision } from '../runtime/action-decision.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

const byName = (tools, name) => tools.find(tool => tool.name === name);
const bound = (toolName, target, actionSignature) => ({
  proposal: { toolName, target, actionSignature },
  approval: { valid: true, toolName, target, actionSignature },
});

test('low-risk reads are allowed when permission requirements are satisfied', () => {
  const result = decideAction(byName(githubTools, 'fetch_file'), { permissions: ['repo:read'] });
  assert.equal(result.decision, Decision.ALLOW);
});

test('missing permission denies before approval is considered', () => {
  const result = decideAction(
    byName(githubTools, 'merge_pull_request'),
    { permissions: [] },
    bound('merge_pull_request', 'PR#2', 'merge:PR#2:main')
  );
  assert.deepEqual(result, { decision: Decision.DENY, reason: 'MISSING_PERMISSION' });
});

test('TradingView create alert requires bound approval', () => {
  const result = decideAction(byName(tradingViewTools, 'create_alert'), { permissions: ['alert:write'] });
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('TradingView create alert is allowed after matching approval', () => {
  const result = decideAction(
    byName(tradingViewTools, 'create_alert'),
    { permissions: ['alert:write'] },
    bound('create_alert', 'NASDAQ:NVDA', 'cross_up:150')
  );
  assert.equal(result.decision, Decision.ALLOW);
});

test('approval for another target cannot be laundered', () => {
  const result = decideAction(
    byName(tradingViewTools, 'create_alert'),
    { permissions: ['alert:write'] },
    {
      proposal: { toolName: 'create_alert', target: 'NASDAQ:NVDA', actionSignature: 'cross_up:150' },
      approval: { valid: true, toolName: 'create_alert', target: 'NASDAQ:AAPL', actionSignature: 'cross_up:150' },
    }
  );
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('approval for another tool cannot be laundered', () => {
  const result = decideAction(
    byName(githubTools, 'merge_pull_request'),
    { permissions: ['repo:merge'] },
    {
      proposal: { toolName: 'merge_pull_request', target: 'PR#2', actionSignature: 'merge:PR#2:main' },
      approval: { valid: true, toolName: 'update_file', target: 'PR#2', actionSignature: 'merge:PR#2:main' },
    }
  );
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('GitHub update file requires approval', () => {
  const result = decideAction(byName(githubTools, 'update_file'), { permissions: ['repo:write'] });
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('GitHub merge requires approval and proper permission', () => {
  const tool = byName(githubTools, 'merge_pull_request');
  const actor = { permissions: ['repo:merge'] };

  const pending = decideAction(tool, actor);
  assert.equal(pending.decision, Decision.REQUIRE_APPROVAL);

  const allowed = decideAction(tool, actor, bound('merge_pull_request', 'PR#2', 'merge:PR#2:main'));
  assert.equal(allowed.decision, Decision.ALLOW);
});

test('product policy can force medium writes to bound approval', () => {
  const tool = byName(githubTools, 'create_branch');
  const actor = { permissions: ['repo:write'] };

  const pending = decideAction(tool, actor, { policy: { allowMediumWrite: false } });
  assert.equal(pending.decision, Decision.REQUIRE_APPROVAL);

  const allowed = decideAction(tool, actor, {
    policy: { allowMediumWrite: false },
    ...bound('create_branch', 'feat/test', 'base:main'),
  });
  assert.equal(allowed.decision, Decision.ALLOW);
});
