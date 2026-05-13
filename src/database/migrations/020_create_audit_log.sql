-- Admin accountability / audit log (A-12).
-- Records privileged actions performed by staff so MDRRMO leadership can
-- reconstruct who approved, rejected, deleted, or reconfigured what.

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) DEFAULT NULL,
  target_id INTEGER DEFAULT NULL,
  details TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_user_id, created_at DESC);
