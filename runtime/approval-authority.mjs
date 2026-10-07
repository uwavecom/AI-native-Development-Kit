import { createHmac, timingSafeEqual } from 'node:crypto';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
  }
  return value;
}

function sign(secret, payload) {
  return createHmac('sha256', secret)
    .update(JSON.stringify(canonical(payload)))
    .digest('hex');
}

export function createSignedApprovalAuthority({
  secret,
  issuer = 'local-approval-authority',
}) {
  if (!secret || String(secret).length < 16) {
    throw new Error('APPROVAL_AUTHORITY_SECRET_TOO_SHORT');
  }

  const consumed = new Set();

  async function verifyCredential(credential, proposal) {
    if (!credential?.receipt || !credential?.proof || !proposal?.actionSignature) {
      return { valid: false, reason: 'MALFORMED_APPROVAL_CREDENTIAL' };
    }

    const receipt = credential.receipt;
    if (receipt.issuer !== issuer) return { valid: false, reason: 'UNTRUSTED_APPROVAL_ISSUER' };
    if (receipt.actionSignature !== proposal.actionSignature) {
      return { valid: false, reason: 'APPROVAL_PROPOSAL_MISMATCH' };
    }

    const expected = Buffer.from(sign(secret, receipt), 'hex');
    const actual = Buffer.from(String(credential.proof), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      return { valid: false, reason: 'INVALID_APPROVAL_PROOF' };
    }

    if (receipt.expiresAt && Date.now() >= new Date(receipt.expiresAt).getTime()) {
      return { valid: false, reason: 'APPROVAL_EXPIRED' };
    }

    if (receipt.oneShot === true && consumed.has(credential.proof)) {
      return { valid: false, reason: 'APPROVAL_ALREADY_CONSUMED' };
    }

    return { valid: true, receipt };
  }

  return Object.freeze({
    issuer,

    async issue(proposal, {
      approverId,
      approvedAt = new Date().toISOString(),
      expiresAt = null,
      oneShot = true,
    }) {
      if (!proposal?.actionSignature) throw new Error('INVALID_PROPOSAL');
      if (!approverId) throw new Error('INVALID_APPROVER');

      const receipt = {
        valid: true,
        issuer,
        actorId: approverId,
        toolName: proposal.toolName,
        target: proposal.target ?? null,
        actionSignature: proposal.actionSignature,
        approvedAt,
        expiresAt,
        oneShot,
      };

      return Object.freeze({
        receipt: Object.freeze(receipt),
        proof: sign(secret, receipt),
      });
    },

    verify: verifyCredential,

    async claim(credential, proposal) {
      const verified = await verifyCredential(credential, proposal);
      if (!verified.valid) return verified;
      if (verified.receipt.oneShot === true) consumed.add(credential.proof);
      return verified;
    },
  });
}
