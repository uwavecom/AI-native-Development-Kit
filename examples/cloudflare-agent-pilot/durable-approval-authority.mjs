/**
 * Durable one-shot claim adapter for a single named Cloudflare Durable Object.
 * Signature verification is delegated to a trusted signing authority.
 * The SQLite UNIQUE constraint is the final arbiter of replay protection.
 * All calls for a given approval scope MUST route to the same named object.
 */
export function createDurableApprovalAuthority({ sql, signer }) {
  if (typeof sql !== 'function' || !signer?.verify) throw new Error('DURABLE_AUTHORITY_DEPENDENCIES_REQUIRED');
  sql`CREATE TABLE IF NOT EXISTS pilot_approval_claims (
    proof TEXT PRIMARY KEY,
    action_signature TEXT NOT NULL
  )`;
  return {
    verify: (credential, proposal) => signer.verify(credential, proposal),
    async claim(credential, proposal) {
      const checked = await signer.verify(credential, proposal);
      if (!checked.valid) return checked;
      if (checked.receipt.oneShot !== true) return checked;
      if (typeof credential?.proof !== 'string' || !credential.proof) {
        return { valid: false, reason: 'MALFORMED_APPROVAL_CREDENTIAL' };
      }
      // No async boundary between the write and RETURNING; SQLite arbitrates
      // duplicate claims even if the authority is recreated after a restart.
      const inserted = sql`INSERT OR IGNORE INTO pilot_approval_claims (proof, action_signature)
        VALUES (${credential.proof}, ${proposal.actionSignature}) RETURNING proof`;
      return inserted.length
        ? checked
        : { valid: false, reason: 'APPROVAL_ALREADY_CONSUMED' };
    },
  };
}
