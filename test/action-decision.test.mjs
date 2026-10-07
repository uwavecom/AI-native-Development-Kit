import test from 'node:test';
import assert from 'node:assert/strict';
import { decideAction, Decision } from '../runtime/action-decision.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

const byName = (tools, name) => tools.find(tool => tool.name === name);

test('low-risk reads are allowed when permission requirements are satisfied', () => {
  const result = decideAction(byName(githubTools, 'fetch_file'), { permissions: ['repo:read'] });
  assert.equal(result.decision, Decision.ALLOW);
});

test('missing permission denies before approval is considered', () => {
  const result = decideAction(byName(githubTools, 'merge_pull_request'), { permissions: [] }, {
    approval: { valid: true },
  });
  assert.deepEqual(result, { decision: Decision.DENY, reason: 'MISSING_PERMISSION' });
});

test('TradingView create alert requires approval', () => {
  const result = decideAction(byName(tradingViewTools, 'create_alert'), { permissions: ['alert:write'] });
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('TradingView create alert is allowed after valid approval', () => {
  const result = decideAction(byName(tradingViewTools, 'create_alert'), { permissions: ['alert:write'] }, {
    approval: { valid: true },
  });
  assert.equal(result.decision, Decision.ALLOW);
});

test('GitHub update file requires approval', () => {
  const result = decideAction(byName(githubTools, 'update_file'), { permissions: ['repo:write'] });
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});

test('GitHub merge requires approval and proper permission', () => {
  const pending = decideAction(byName(githubTools, 'merge_pull_request'), { permissions: ['repo:merge'] });
  assert.equal(pending.decision, Decision.REQUIRE_APPROVAL);

  const allowed = decideAction(byName(githubTools, 'merge_pull_request'), { permissions: ['repo:merge'] }, {
    approval: { valid: true },
  });
  assert.equal(allowed.decision, Decision.ALLOW);
});

test('product policy can force medium writes to approval', () => {
  const result = decideAction(byName(githubTools, 'create_branch'), { permissions: ['repo:write'] }, {
    policy: { allowMediumWrite: false },
  });
  assert.equal(result.decision, Decision.REQUIRE_APPROVAL);
});
