import { createFactoryJob, transitionFactoryJob } from '../runtime/factory-workflow.mjs';
import { verifyRequiredGithubChecks } from './required-github-checks.mjs';

/**
 * Read-only, end-to-end factory intake → CI → review handoff.
 * This deliberately cannot merge or manufacture human approval.
 * requiredChecks MUST come from a trusted, externally maintained policy.
 */
export async function prepareFactoryReview({
  owner, repo, prNumber, requiredChecks, goal, acceptanceCriteria, fetchImpl,
}) {
  let job = createFactoryJob({
    id: `${owner}/${repo}#${prNumber}`,
    goal,
    acceptanceCriteria,
  });
  const move = (stage, evidence) => {
    job = transitionFactoryJob(job, stage, {
      expectedRevision: job.revision,
      evidence,
    });
  };
  const check = await verifyRequiredGithubChecks({
    owner, repo, prNumber, requiredChecks, fetchImpl,
  });
  if (!check.verified) {
    return Object.freeze({
      status: 'CI_BLOCKED',
      job,
      checkedHeadSha: check.headSha,
      failures: check.missingOrFailed ?? Object.freeze(['CI_EVIDENCE_MISSING']),
    });
  }
  move('BUILD', { kind: 'spec', reference: `https://github.com/${owner}/${repo}/pull/${prNumber}` });
  move('VERIFY', { kind: 'commit', reference: check.headSha });
  move('REVIEW', check.evidence);
  move('APPROVAL', { kind: 'review-needed', reference: `https://github.com/${owner}/${repo}/pull/${prNumber}` });
  move('NEEDS_HUMAN', { kind: 'escalation', reference: `https://github.com/${owner}/${repo}/pull/${prNumber}` });
  return Object.freeze({
    status: 'AWAITING_HUMAN',
    job,
    checkedHeadSha: check.headSha,
    reviewUrl: `https://github.com/${owner}/${repo}/pull/${prNumber}`,
  });
}
