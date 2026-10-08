import test from 'node:test';
import assert from 'node:assert/strict';
import { createFactoryJob, transitionFactoryJob } from '../runtime/factory-workflow.mjs';

const begin = () => createFactoryJob({ id: 'issue-42', goal: 'Add feature', acceptanceCriteria: ['Tests pass'] });
const advance = (job, next, kind = 'artifact') => transitionFactoryJob(job, next, {
  expectedRevision: job.revision, evidence: { kind, reference: 'https://example.test/evidence' }
});

test('factory advances only via explicit evidence-backed stages', () => {
  let job = begin();
  job = advance(job, 'BUILD');
  job = advance(job, 'VERIFY');
  assert.throws(() => advance(job, 'REVIEW'), /passing CI/);
  job = advance(job, 'REVIEW', 'ci-passed');
  job = advance(job, 'APPROVAL');
  assert.throws(() => advance(job, 'READY_TO_MERGE'), /trusted approval/);
  job = advance(job, 'NEEDS_HUMAN');
  job = advance(job, 'READY_TO_MERGE', 'trusted-approval');
  assert.throws(() => advance(job, 'MERGED'), /verified merge/);
  job = advance(job, 'MERGED', 'verified-merge');
  assert.equal(job.stage, 'MERGED');
  assert.equal(job.evidence.length, 7);
});

test('invalid jobs, skipped stages and stale concurrent updates fail closed', () => {
  assert.throws(() => createFactoryJob({ id: '', goal: 'x', acceptanceCriteria: [] }), /needs id/);
  const job = begin();
  assert.throws(() => advance(job, 'MERGED'), /Invalid factory transition/);
  assert.throws(() => transitionFactoryJob(job, 'BUILD', {
    expectedRevision: 1, evidence: { kind: 'artifact', reference: 'ref' }
  }), /Stale factory revision/);
  assert.throws(() => transitionFactoryJob(job, 'BUILD', {
    expectedRevision: 0, evidence: { kind: 'artifact' }
  }), /requires evidence/);
  assert.equal(job.stage, 'SPEC');
});
