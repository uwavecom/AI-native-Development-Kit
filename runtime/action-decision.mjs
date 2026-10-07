export const Decision = Object.freeze({
  ALLOW: 'ALLOW',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  DENY: 'DENY',
});

function hasPermissions(actor, required = []) {
  const granted = new Set(actor?.permissions ?? []);
  return required.every(permission => granted.has(permission));
}

import { isApprovalFresh } from './action-proposal.mjs';

function approvalMatches(tool, context) {
  const proposal = context.proposal;
  const approval = context.approval;

  if (!approval?.valid || !proposal) return false;
  if (!isApprovalFresh(approval, context.now ?? Date.now())) return false;
  if (approval.consumed === true) return false;
  if (proposal.toolName !== tool.name) return false;
  if (approval.toolName !== proposal.toolName) return false;

  if ((approval.target ?? null) !== (proposal.target ?? null)) return false;
  if ((approval.actionSignature ?? null) !== (proposal.actionSignature ?? null)) return false;

  return true;
}

export function decideAction(tool, actor = {}, context = {}) {
  const deny = reason => ({ decision: Decision.DENY, reason });
  const requireApproval = reason => ({ decision: Decision.REQUIRE_APPROVAL, reason });
  const allow = reason => ({ decision: Decision.ALLOW, reason });

  if (!tool || typeof tool !== 'object') return deny('INVALID_TOOL_POLICY');
  if (!tool.name || !tool.access || !tool.riskLevel) return deny('INCOMPLETE_TOOL_POLICY');

  if (!hasPermissions(actor, tool.requiredPermissions)) return deny('MISSING_PERMISSION');

  if (context.policy?.deny === true) return deny('PRODUCT_POLICY_DENY');

  if (tool.riskLevel === 'critical') {
    if (context.policy?.allowCritical !== true) return deny('CRITICAL_ACTION_DISABLED');
    return approvalMatches(tool, context)
      ? allow('CRITICAL_ACTION_APPROVED')
      : requireApproval('CRITICAL_ACTION_REQUIRES_BOUND_APPROVAL');
  }

  const consequential =
    tool.access === 'destructive' ||
    tool.riskLevel === 'high' ||
    tool.requiresApproval === true;

  if (consequential) {
    return approvalMatches(tool, context)
      ? allow('BOUND_APPROVAL_SATISFIED')
      : requireApproval('BOUND_APPROVAL_REQUIRED');
  }

  if (tool.access === 'write' && tool.riskLevel === 'medium') {
    if (context.policy?.allowMediumWrite === false) {
      return approvalMatches(tool, context)
        ? allow('BOUND_APPROVAL_SATISFIED')
        : requireApproval('MEDIUM_WRITE_POLICY_REQUIRES_BOUND_APPROVAL');
    }
  }

  return allow('POLICY_ALLOWS');
}
