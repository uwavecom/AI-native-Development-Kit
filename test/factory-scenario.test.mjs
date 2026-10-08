import test from 'node:test';
import assert from 'node:assert/strict';
import { runFactoryScenario } from '../examples/factory-workflow.mjs';

test('factory scenario fails closed without human approval', async () => {
  const outcome = await runFactoryScenario();
  assert.equal(outcome.job.stage, 'NEEDS_HUMAN');
  assert.equal(outcome.invoked, false);
  assert.equal(outcome.execution, null);
});

test('approved demonstration merges only after action guard verifies', async () => {
  const outcome = await runFactoryScenario({ approve: true });
  assert.equal(outcome.execution.execution.status, 'SUCCEEDED');
  assert.equal(outcome.job.stage, 'MERGED');
  assert.equal(outcome.invoked, true);
  assert.equal(outcome.job.evidence.at(-1).kind, 'verified-merge');
});
