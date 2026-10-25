-- Preserve account identity and incident attribution; restrictions are reversible.
ALTER TABLE users ADD COLUMN account_status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN account_reason TEXT;
ALTER TABLE users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reports ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'medium';
ALTER TABLE broadcast_jobs ADD COLUMN event_key VARCHAR(160);
CREATE UNIQUE INDEX idx_broadcast_event_channel ON broadcast_jobs(event_key, channel);
CREATE TABLE IF NOT EXISTS broadcast_recipients (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 job_id INTEGER NOT NULL,
 user_id INTEGER,
 recipient TEXT NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'queued',
 provider_id TEXT,
 last_error TEXT,
 updated_at VARCHAR(30) NOT NULL,
 FOREIGN KEY (job_id) REFERENCES broadcast_jobs(id),
 FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX idx_broadcast_recipient_job ON broadcast_recipients(job_id);
CREATE TABLE IF NOT EXISTS broadcast_events (
 event_key VARCHAR(140) PRIMARY KEY,
 created_at VARCHAR(30) NOT NULL
);
