-- Agency snapshots, shared hazard history, directories, emergency calls,
-- and durable delivery jobs. UTC instants are displayed in Asia/Manila.
ALTER TABLE users ADD COLUMN department VARCHAR(100) DEFAULT NULL;
ALTER TABLE report_events ADD COLUMN actor_department VARCHAR(100) DEFAULT NULL;
ALTER TABLE audit_log ADD COLUMN actor_department VARCHAR(100) DEFAULT NULL;
CREATE TABLE IF NOT EXISTS hazard_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hazard_id INTEGER NOT NULL,
  actor_user_id INTEGER NOT NULL,
  actor_department VARCHAR(100),
  action VARCHAR(64) NOT NULL,
  note TEXT,
  created_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (hazard_id) REFERENCES hazard_alerts(id),
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS barangays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  updated_at VARCHAR(30) NOT NULL
);
CREATE TABLE IF NOT EXISTS emergency_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caller_name VARCHAR(150) NOT NULL,
  contact_number VARCHAR(50),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  location VARCHAR(255),
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'received',
  created_by INTEGER NOT NULL,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS road_advisories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  status VARCHAR(30) NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER NOT NULL,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS broadcast_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  hazard_id INTEGER,
  advisory_id INTEGER,
  channel VARCHAR(10) NOT NULL,
  payload TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at VARCHAR(30) NOT NULL,
  updated_at VARCHAR(30) NOT NULL,
  FOREIGN KEY (hazard_id) REFERENCES hazard_alerts(id),
  FOREIGN KEY (advisory_id) REFERENCES road_advisories(id)
);
