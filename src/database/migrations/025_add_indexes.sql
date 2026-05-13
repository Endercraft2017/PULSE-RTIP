-- =============================================================================
-- Migration 025: Add Performance Indexes
-- =============================================================================
-- Adds covering indexes on hot-path columns identified during the schema
-- consolidation audit. All `CREATE INDEX IF NOT EXISTS`, so safe to re-run.
--
-- Hot paths covered:
--   users.deleted_at        — every authenticated query filters this out
--   users.role              — admin lookup for approval notifications
--   users.phone             — login OTP flow
--   users.barangay          — audience-scoped SMS / push broadcasts
--   users.admin_request_status — pending-review queue (partial index)
--
--   reports.status          — dashboard counts + filters
--   reports.submitted_by    — "my reports" page
--   reports.created_at      — analytics + list ordering
--
--   notifications.user_id + is_read — fetch unread count + recent items
--   notifications.type      — per-type filters
--
--   hazard_alerts.created_at — active hazards list
--
--   community_posts.created_at — feed ordering
--   community_posts.category   — category filter
--   community_posts.user_id    — author posts
--
--   sms_reports.status         — pending count
--   sms_reports.textbee_sms_id — dedup on poll (UNIQUE partial index)
--
--   report_images.report_id    — joins on report detail fetch
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_users_deleted_at      ON users(deleted_at);
CREATE INDEX IF NOT EXISTS idx_users_role            ON users(role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_phone           ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_barangay        ON users(barangay) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_pending         ON users(admin_request_status) WHERE admin_request_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_status        ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_submitted_by  ON reports(submitted_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_created_at    ON reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type        ON notifications(type);

CREATE INDEX IF NOT EXISTS idx_hazards_created_at    ON hazard_alerts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_created_at      ON community_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_category        ON community_posts(category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id         ON community_posts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sms_reports_status    ON sms_reports(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_reports_textbee ON sms_reports(textbee_sms_id) WHERE textbee_sms_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_report_images_report_id ON report_images(report_id);
