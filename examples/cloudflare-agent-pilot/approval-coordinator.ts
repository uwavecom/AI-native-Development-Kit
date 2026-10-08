import { DurableObject } from 'cloudflare:workers';

type Env = { PILOT_CALLER_TOKEN?: string; PILOT_REVOKER_TOKEN?: string };

/** Demonstration coordinator, deliberately one global security scope.
 * Authentication is a test service token, NOT end-user identity.
 */
export class PilotApprovalCoordinator extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS pilot_decisions (
      proof TEXT PRIMARY KEY,
      action_signature TEXT,
      state TEXT NOT NULL CHECK(state IN ('CLAIMED', 'REVOKED'))
    )`);
  }

  private authenticateExecutor(token: string) {
    if (!this.env.PILOT_CALLER_TOKEN || this.env.PILOT_CALLER_TOKEN.length < 16 ||
      token !== this.env.PILOT_CALLER_TOKEN) throw new Error('UNAUTHORIZED_COORDINATOR');
  }

  async claim(proof: string, signature: string, token: string) {
    this.authenticateExecutor(token);
    if (!/^[a-f0-9]{64}$/.test(proof) || !/^[a-f0-9]{64}$/.test(signature))
      throw new Error('INVALID_CLAIM');
    // One atomic INSERT; a preceding REVOKED or CLAIMED row always wins.
    const inserted = this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO pilot_decisions(proof, action_signature, state)
       VALUES (?, ?, 'CLAIMED') RETURNING proof`, proof, signature).toArray();
    if (inserted.length) return { valid: true };
    const row = this.ctx.storage.sql.exec(
      'SELECT state FROM pilot_decisions WHERE proof = ?', proof).toArray()[0];
    return { valid: false, reason: row?.state === 'REVOKED'
      ? 'APPROVAL_REVOKED' : 'APPROVAL_ALREADY_CONSUMED' };
  }

  async revoke(proof: string, token: string) {
    this.authenticate(token);
    if (!/^[a-f0-9]{64}$/.test(proof)) throw new Error('INVALID_PROOF');
    // Revocation only applies to credentials not already claimed.
    const changed = this.ctx.storage.sql.exec(
      `INSERT OR IGNORE INTO pilot_decisions(proof, state) VALUES (?, 'REVOKED')
       RETURNING proof`, proof).toArray().length;
    return { revoked: Boolean(changed) };
  }
}
