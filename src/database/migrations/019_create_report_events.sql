-- Report processing history (A-8/A-13).
-- One row per status change on a report so citizens and admins can
-- see who did what, when, and why.

CREATE TABLE IF NOT EXISTS report_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  action VARCHAR(50) NOT NULL,
  from_status VARCHAR(30) DEFAULT NULL,
  to_status VARCHAR(30) DEFAULT NULL,
  note TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (report_id) REFERENCES reports(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_report_events_report ON report_events(report_id, created_at);
