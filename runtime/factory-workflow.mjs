/**
 * A small, deterministic factory state contract; not an agent runner.
 * All effects (CI, GitHub merges, agent calls) happen outside this module.
 */
export const FACTORY_STAGES = Object.freeze([
  'SPEC', 'BUILD', 'VERIFY', 'REVIEW', 'APPROVAL', 'READY_TO_MERGE', 'NEEDS_HUMAN', 'MERGED'
]);

const transitions = Object.freeze({
  SPEC: ['BUILD'],
  BUILD: ['VERIFY'],
  VERIFY: ['REVIEW', 'BUILD'],
  REVIEW: ['APPROVAL', 'BUILD'],
  APPROVAL: ['READY_TO_MERGE', 'NEEDS_HUMAN'],
  READY_TO_MERGE: ['MERGED', 'NEEDS_HUMAN'],
  NEEDS_HUMAN: ['READY_TO_MERGE', 'BUILD'],
  MERGED: [],
});

const nonempty = (x) => typeof x === 'string' && x.trim().length > 0;

export function createFactoryJob({ id, goal, acceptanceCriteria }) {
  if (!nonempty(id) || !nonempty(goal) ||
      !Array.isArray(acceptanceCriteria) || acceptanceCriteria.length === 0 ||
      !acceptanceCriteria.every(nonempty)) {
    throw new TypeError('Factory job needs id, goal and nonempty acceptance criteria');
  }
  return Object.freeze({
    id, goal, acceptanceCriteria: Object.freeze([...acceptanceCriteria]),
    stage: 'SPEC', revision: 0, evidence: Object.freeze([]),
  });
}

/** Evidence must be externally generated and verified by the integrating host. */
export function transitionFactoryJob(job, next, { evidence, expectedRevision } = {}) {
  if (!job || !nonempty(job.id) || !FACTORY_STAGES.includes(job.stage) ||
      !Number.isSafeInteger(job.revision) || job.revision < 0) {
    throw new TypeError('Invalid factory job');
  }
  if (expectedRevision !== job.revision) throw new Error('Stale factory revision');
  if (!transitions[job.stage].includes(next)) throw new Error('Invalid factory transition');
  if (!evidence || !nonempty(evidence.kind) || !nonempty(evidence.reference)) {
    throw new TypeError('Transition requires evidence kind and reference');
  }
  if (next === 'READY_TO_MERGE' && evidence.kind !== 'trusted-approval') {
    throw new Error('Ready-to-merge requires trusted approval evidence');
  }
  if (next === 'MERGED' && evidence.kind !== 'verified-merge') {
    throw new Error('Merged requires provider-verified merge evidence');
  }
  if (next === 'REVIEW' && evidence.kind !== 'ci-passed') {
    throw new Error('Review requires passing CI evidence');
  }
  return Object.freeze({
    ...job, stage: next, revision: job.revision + 1,
    evidence: Object.freeze([...job.evidence, Object.freeze({
      from: job.stage, to: next, kind: evidence.kind, reference: evidence.reference,
    })]),
  });
}
