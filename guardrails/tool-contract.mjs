const ACCESS = new Set(['read', 'write', 'destructive']);
const RISK = new Set(['low', 'medium', 'high', 'critical']);

export function validateToolRegistry(tools) {
  const errors = [];
  const seen = new Set();

  if (!Array.isArray(tools)) {
    return [{ code: 'TOOL000', message: 'Tool registry must be an array.' }];
  }

  for (const [index, tool] of tools.entries()) {
    const at = `tool[${index}]`;
    const fail = (code, message) => errors.push({ code, tool: tool?.name ?? at, message });

    if (!tool || typeof tool !== 'object') {
      fail('TOOL001', 'Tool entry must be an object.');
      continue;
    }

    for (const key of ['name', 'purpose', 'access', 'riskLevel']) {
      if (typeof tool[key] !== 'string' || !tool[key].trim()) fail('TOOL002', `Missing or invalid ${key}.`);
    }

    if (tool.name) {
      if (seen.has(tool.name)) fail('TOOL003', 'Tool names must be unique.');
      seen.add(tool.name);
    }

    if (!ACCESS.has(tool.access)) fail('TOOL004', `access must be one of: ${[...ACCESS].join(', ')}.`);
    if (!RISK.has(tool.riskLevel)) fail('TOOL005', `riskLevel must be one of: ${[...RISK].join(', ')}.`);

    if (!Array.isArray(tool.requiredPermissions)) fail('TOOL006', 'requiredPermissions must be an array.');
    if (typeof tool.requiresApproval !== 'boolean') fail('TOOL007', 'requiresApproval must be boolean.');
    if (typeof tool.idempotent !== 'boolean') fail('TOOL008', 'idempotent must be boolean.');
    if (typeof tool.audit !== 'boolean') fail('TOOL009', 'audit must be boolean.');

    const consequential = tool.access === 'destructive' || ['high', 'critical'].includes(tool.riskLevel);
    if (consequential && tool.requiresApproval !== true) fail('TOOL010', 'High-risk or destructive tools must require approval.');
    if (consequential && tool.audit !== true) fail('TOOL011', 'High-risk or destructive tools must be audited.');
    if (consequential && (typeof tool.verificationStrategy !== 'string' || !tool.verificationStrategy.trim())) {
      fail('TOOL012', 'High-risk or destructive tools require a verificationStrategy.');
    }

    if (tool.access !== 'read' && (typeof tool.sideEffects !== 'string' || !tool.sideEffects.trim())) {
      fail('TOOL013', 'Write/destructive tools must declare sideEffects.');
    }

    if (tool.access !== 'read' && typeof tool.retryPolicy !== 'string') {
      fail('TOOL014', 'Write/destructive tools must declare retryPolicy.');
    }

    if (tool.access !== 'read' && (typeof tool.recoveryStrategy !== 'string' || !tool.recoveryStrategy.trim())) {
      fail('TOOL015', 'Write/destructive tools must declare recoveryStrategy.');
    }
  }

  return errors;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { tradingViewTools } = await import('../examples/tradingview-mcp/tools.mjs');
  const errors = validateToolRegistry(tradingViewTools);
  for (const error of errors) console.error(JSON.stringify(error));
  process.exitCode = errors.length ? 1 : 0;
}
