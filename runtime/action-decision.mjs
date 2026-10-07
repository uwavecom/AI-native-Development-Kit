export const Decision = Object.freeze({
  ALLOW: 'ALLOW',
  REQUIRE_APPROVAL: 'REQUIRE_APPROVAL',
  DENY: 'DENY',
});

function hasPermissions(actor, required = []) {
  const granted = new Set(actor?.permissions ?? []);
  return required.every(permission => granted.has(permission));
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
    return context.approval?.valid === true
      ? allow('CRITICAL_ACTION_APPROVED')
      : requireApproval('CRITICAL_ACTION_REQUIRES_APPROVAL');
  }

  const consequential =
    tool.access === 'destructive' ||
    tool.riskLevel === 'high' ||
    tool.requiresApproval === true;

  if (consequential) {
    return context.approval?.valid === true
      ? allow('APPROVAL_SATISFIED')
      : requireApproval('APPROVAL_REQUIRED');
  }

  if (tool.access === 'write' && tool.riskLevel === 'medium') {
    if (context.policy?.allowMediumWrite === false) return requireApproval('MEDIUM_WRITE_POLICY_REQUIRES_APPROVAL');
  }

  return allow('POLICY_ALLOWS');
}
