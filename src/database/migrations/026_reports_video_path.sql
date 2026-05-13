-- =============================================================================
-- Migration 026: Add video_path to reports
-- =============================================================================
-- Citizens can attach a video to an incident report alongside images.
-- The frontend already had the upload UI; the backend just dropped it.
-- =============================================================================

ALTER TABLE reports ADD COLUMN video_path VARCHAR(500) DEFAULT NULL;
