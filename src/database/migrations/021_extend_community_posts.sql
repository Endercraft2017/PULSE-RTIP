-- =============================================================================
-- Migration 021: Extend community_posts with video, location, repost, promote
-- =============================================================================
-- U-5: posts gain a separate video_path slot (so image uploads and video
-- uploads can coexist) and a free-text location column (defaults to the
-- author's barangay at create time).
-- U-9: reposted_from_post_id lets us attribute a share back to the original.
-- A-14: promoted_from_report_id links an admin-promoted post to the report
-- it was spun out of, so the feed card can deep-link to progress.
-- =============================================================================

ALTER TABLE community_posts ADD COLUMN video_path VARCHAR(500) DEFAULT NULL;
ALTER TABLE community_posts ADD COLUMN location VARCHAR(255) DEFAULT NULL;
ALTER TABLE community_posts ADD COLUMN reposted_from_post_id INTEGER DEFAULT NULL;
ALTER TABLE community_posts ADD COLUMN promoted_from_report_id INTEGER DEFAULT NULL;
