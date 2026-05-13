-- =============================================================================
-- Migration 028: Performance indexes + UNIQUE on promoted_from_report_id
-- =============================================================================
-- Adds three indexes for common join/filter paths and one UNIQUE index that
-- enforces the controller-level invariant ("a report can only be promoted
-- once") at the DB layer too.
-- Verified ahead of time: zero duplicate promoted_from_report_id rows exist.
-- =============================================================================

-- Each report can only have one promoted community post.
CREATE UNIQUE INDEX IF NOT EXISTS uq_posts_promoted_from_report
  ON community_posts(promoted_from_report_id)
  WHERE promoted_from_report_id IS NOT NULL;

-- Reposts: BASE_SELECT in Post.findAll left-joins on this column.
CREATE INDEX IF NOT EXISTS idx_posts_reposted_from
  ON community_posts(reposted_from_post_id);

-- Notifications inbox path: ORDER BY created_at DESC after WHERE user_id = ?.
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

-- Processing-history "events by this admin" lookups.
CREATE INDEX IF NOT EXISTS idx_report_events_actor
  ON report_events(actor_user_id);
