CREATE TABLE IF NOT EXISTS agent_audit (
  id TEXT PRIMARY KEY,
  recorded_at TEXT NOT NULL,
  event TEXT,
  actor_id TEXT,
  tool TEXT,
  target TEXT,
  action_signature TEXT,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_audit_signature_time
ON agent_audit(action_signature, recorded_at);

CREATE TABLE IF NOT EXISTS agent_workflows (
  workflow_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  current_step TEXT,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
