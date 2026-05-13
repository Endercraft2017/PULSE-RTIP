-- =============================================================================
-- Migration 027: Index community_posts.promoted_from_report_id
-- =============================================================================
-- This column is joined on by every Report.findAll / findByUserId / getStats
-- (the resolved+promoted declutter rule) and Post.findByPromotedReport. With
-- no index it does a full scan of community_posts on every report list query.
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_posts_promoted_from_report
  ON community_posts(promoted_from_report_id);
