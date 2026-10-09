import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createActionGuard } from '../runtime/action-guard.mjs';
import { createActionProposal, createApprovalReceipt } from '../runtime/action-proposal.mjs';
import { FileStateStore } from '../runtime/state/file-state-store.mjs';
import { runHardenedSafeAction } from '../runtime/hardened-safe-action.mjs';

const tool = {
  name: 'write_record', purpose: 'Record a value for test',
  access: 'write', riskLevel: 'high', requiredPermissions: ['record:write'],
  requiresApproval: true, idempotent: false, audit: true,
  sideEffects: 'Writes a test record.', retryPolicy: 'Do not blindly retry.',
  verificationStrategy: 'Inspect saved record.', recoveryStrategy: 'Human review.',
};
const actor = { id: 'operator', permissions: ['record:write'] };

test('guard rejects mismatched input A -> B before approval or tool dispatch', async () => {
  let invoked = 0;
  const guard = createActionGuard({ tools: [tool] });
  const proposal = guard.propose({ toolName: 'write_record', target: 'record', params: { id: 'A' } });
  await assert.rejects(guard.execute({
    actor, proposal, input: { id: 'B' },
    invoke: async () => { invoked++; },
    verify: async () => ({ verified: true }),
  }), /ACTION_INPUT_MISMATCH/);
  assert.equal(invoked, 0);
});

test('guard rejects changes to proposal params with an unchanged signature', async () => {
  let invoked = 0;
  const guard = createActionGuard({ tools: [tool] });
  const proposal = guard.propose({ toolName: 'write_record', target: 'record', params: { id: 'A' } });
  await assert.rejects(guard.execute({
    actor, proposal: { ...proposal, params: { id: 'B' } },
    invoke: async () => { invoked++; },
  }), /ACTION_INPUT_MISMATCH/);
  assert.equal(invoked, 0);
});

test('durable one-shot approval survives budget denial and can be used later', async () => {
  const root = await mkdtemp(join(tmpdir(), 'kit-approval-budget-'));
  try {
    const store = new FileStateStore(root);
    const proposal = createActionProposal({
      toolName: 'write_record', target: 'record', params: { id: 'A' },
    });
    await store.putApproval('approved-A', createApprovalReceipt({
      proposal, actorId: 'human', approvedAt: new Date().toISOString(), oneShot: true,
    }));
    let invoked = 0;
    const base = {
      tool, actor, proposal, approvalId: 'approved-A',
      stateStore: store, input: proposal.params,
      invoke: async () => { invoked++; return { saved: true }; },
      verify: async () => ({ verified: true }),
    };
    const denied = await runHardenedSafeAction({
      ...base, budget: { consume: () => ({ allowed: false, remaining: 0 }) },
    });
    assert.equal(denied.execution.decision.reason, 'BUDGET_EXHAUSTED');
    assert.equal(invoked, 0);
    const allowed = await runHardenedSafeAction({
      ...base, budget: { consume: () => ({ allowed: true, remaining: 1 }) },
    });
    assert.equal(allowed.execution.status, 'SUCCEEDED');
    assert.equal(invoked, 1);
    const replay = await runHardenedSafeAction({ ...base });
    assert.equal(replay.execution.executed, false);
    assert.equal(replay.execution.decision.decision, 'REQUIRE_APPROVAL');
    assert.equal(invoked, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
