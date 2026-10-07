export class ApprovalCoordinator {
  constructor(ctx) {
    if (!ctx?.storage?.sql?.exec) throw new Error('DURABLE_OBJECT_SQLITE_STORAGE_REQUIRED');
    this.ctx = ctx;

    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id TEXT PRIMARY KEY,
        action_signature TEXT NOT NULL,
        receipt_json TEXT NOT NULL,
        claimed_at TEXT,
        consumed_at TEXT
      )
    `);
  }

  putApproval(id, receipt) {
    if (!id || !receipt?.actionSignature) throw new Error('INVALID_APPROVAL');

    this.ctx.storage.sql.exec(
      `INSERT INTO approvals (id, action_signature, receipt_json)
       VALUES (?, ?, ?)`,
      id,
      receipt.actionSignature,
      JSON.stringify(receipt),
    );

    return { id };
  }

  getApproval(id) {
    const row = this.ctx.storage.sql.exec(
      `SELECT receipt_json, claimed_at, consumed_at
       FROM approvals WHERE id = ?`,
      id,
    ).toArray()[0];

    if (!row) return null;

    return {
      ...JSON.parse(row.receipt_json),
      claimed: Boolean(row.claimed_at),
      consumed: Boolean(row.consumed_at),
    };
  }

  claimApproval(id, expectedSignature) {
    const row = this.ctx.storage.sql.exec(
      `SELECT action_signature, receipt_json, claimed_at, consumed_at
       FROM approvals WHERE id = ?`,
      id,
    ).toArray()[0];

    if (!row || row.consumed_at) return { claimed: false, reason: 'UNAVAILABLE' };
    if (row.action_signature !== expectedSignature) {
      return { claimed: false, reason: 'SIGNATURE_MISMATCH' };
    }
    if (row.claimed_at) return { claimed: false, reason: 'ALREADY_CLAIMED' };

    this.ctx.storage.sql.exec(
      `UPDATE approvals SET claimed_at = ? WHERE id = ?`,
      new Date().toISOString(),
      id,
    );

    return { claimed: true, approval: JSON.parse(row.receipt_json) };
  }

  consumeApproval(id) {
    const now = new Date().toISOString();
    this.ctx.storage.sql.exec(
      `UPDATE approvals SET consumed_at = ? WHERE id = ?`,
      now,
      id,
    );
    return { id, consumed: true, consumedAt: now };
  }
}
