-- =============================================================================
-- Migration 012: Admin Account Requests
-- =============================================================================
-- Adds:
--   * users.admin_request_status   - NULL | 'pending' | 'approved' | 'rejected'
--   * notifications.type           - NULL (default) | 'admin_request' | etc.
--   * notifications.actor_user_id  - the user who triggered the notification
-- =============================================================================

ALTER TABLE users ADD COLUMN admin_request_status VARCHAR(20) DEFAULT NULL;
ALTER TABLE notifications ADD COLUMN type VARCHAR(30) DEFAULT NULL;
ALTER TABLE notifications ADD COLUMN actor_user_id INTEGER DEFAULT NULL;
