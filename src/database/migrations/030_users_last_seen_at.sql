-- =============================================================================
-- Migration 030: users.last_seen_at
-- =============================================================================
-- Tracks when each user last hit an authenticated endpoint, so the analytics
-- page can show "logged in (active in last 5 min)" alongside total registered.
-- Updated by the authenticate middleware, throttled to one write / 60s / user
-- so high-traffic users don't generate hot writes.
-- =============================================================================

ALTER TABLE users ADD COLUMN last_seen_at DATETIME DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_users_last_seen
  ON users(last_seen_at)
  WHERE deleted_at IS NULL;
