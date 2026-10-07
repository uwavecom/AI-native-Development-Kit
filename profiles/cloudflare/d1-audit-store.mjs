export class D1AuditStore {
  constructor(db) {
    if (!db?.prepare) throw new Error('D1_BINDING_REQUIRED');
    this.db = db;
  }

  async appendAudit(event) {
    const record = {
      id: event.id ?? crypto.randomUUID(),
      recordedAt: event.recordedAt ?? new Date().toISOString(),
      ...event,
    };

    await this.db
      .prepare(`INSERT INTO agent_audit
        (id, recorded_at, event, actor_id, tool, target, action_signature, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(
        record.id,
        record.recordedAt,
        record.event ?? null,
        record.actorId ?? null,
        record.tool ?? null,
        record.target ?? null,
        record.actionSignature ?? record.proposalSignature ?? null,
        JSON.stringify(record),
      )
      .run();

    return record;
  }

  async listByActionSignature(actionSignature, limit = 100) {
    if (!actionSignature) throw new Error('ACTION_SIGNATURE_REQUIRED');

    const result = await this.db
      .prepare(`SELECT payload_json
        FROM agent_audit
        WHERE action_signature = ?
        ORDER BY recorded_at ASC
        LIMIT ?`)
      .bind(actionSignature, limit)
      .all();

    return (result.results ?? []).map(row => JSON.parse(row.payload_json));
  }
}
