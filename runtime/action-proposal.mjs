import { createHash } from 'node:crypto';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonicalize(value[key])])
    );
  }
  return value;
}

export function createActionProposal({ toolName, target = null, params = {}, scope = null, provenance = null }) {
  if (!toolName) throw new Error('INVALID_TOOL_NAME');
  const canonical = canonicalize({ toolName, target, params, scope, provenance });
  const actionSignature = createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');

  return Object.freeze({
    ...canonical,
    actionSignature,
  });
}

export function createApprovalReceipt({
  proposal,
  actorId,
  approvedAt,
  expiresAt = null,
  oneShot = true,
}) {
  if (!proposal?.actionSignature) throw new Error('INVALID_PROPOSAL');
  if (!actorId) throw new Error('INVALID_APPROVER');

  return Object.freeze({
    valid: true,
    actorId,
    toolName: proposal.toolName,
    target: proposal.target ?? null,
    actionSignature: proposal.actionSignature,
    approvedAt,
    expiresAt,
    oneShot,
  });
}

export function consumeApprovalReceipt(approval) {
  if (!approval?.valid) throw new Error('INVALID_APPROVAL');
  if (approval.oneShot !== true) return approval;
  return Object.freeze({ ...approval, consumed: true });
}

export function isApprovalFresh(approval, now = Date.now()) {
  if (!approval?.valid) return false;
  if (!approval.expiresAt) return true;
  return now < new Date(approval.expiresAt).getTime();
}
