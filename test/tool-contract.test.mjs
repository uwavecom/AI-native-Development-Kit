import test from 'node:test';
import assert from 'node:assert/strict';
import { validateToolRegistry } from '../guardrails/tool-contract.mjs';
import { tradingViewTools } from '../examples/tradingview-mcp/tools.mjs';
import { githubTools } from '../examples/github-actions/tools.mjs';

test('reference registries satisfy the executable tool contract', () => {
  assert.deepEqual(validateToolRegistry(tradingViewTools), []);
  assert.deepEqual(validateToolRegistry(githubTools), []);
});

test('guard rejects destructive tool without approval, audit, or verification', () => {
  const errors = validateToolRegistry([{
    name: 'delete_thing',
    purpose: 'Delete a thing.',
    access: 'destructive',
    riskLevel: 'high',
    requiredPermissions: ['thing:delete'],
    requiresApproval: false,
    idempotent: false,
    audit: false,
    sideEffects: 'Deletes persistent data.',
    retryPolicy: 'Do not retry blindly.',
  }]);

  const codes = errors.map(error => error.code);
  assert.ok(codes.includes('TOOL010'));
  assert.ok(codes.includes('TOOL011'));
  assert.ok(codes.includes('TOOL012'));
});

test('guard rejects write tool that hides side effects or retry semantics', () => {
  const errors = validateToolRegistry([{
    name: 'create_thing',
    purpose: 'Create a thing.',
    access: 'write',
    riskLevel: 'medium',
    requiredPermissions: ['thing:create'],
    requiresApproval: false,
    idempotent: false,
    audit: true,
    verificationStrategy: 'Read after write.',
  }]);

  const codes = errors.map(error => error.code);
  assert.ok(codes.includes('TOOL013'));
  assert.ok(codes.includes('TOOL014'));
});
