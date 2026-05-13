-- =============================================================================
-- Migration 029: Soft-Delete (Recycle Bin) for Reports + Hazards
-- =============================================================================
-- Replaces hard-delete with a recoverable bin. A non-null deleted_at means
-- the row is in the bin: it is hidden from normal lists, counters, and the
-- citizen-facing views, but admins can still inspect, restore, or purge it.
--
-- Citizen-side flows are unchanged — citizens still cancel via status update;
-- only the admin "Delete" button now soft-deletes.
-- =============================================================================

ALTER TABLE reports        ADD COLUMN deleted_at DATETIME DEFAULT NULL;
ALTER TABLE hazard_alerts  ADD COLUMN deleted_at DATETIME DEFAULT NULL;

-- Speed up the "is in bin?" filter on every list query.
CREATE INDEX IF NOT EXISTS idx_reports_deleted_at        ON reports(deleted_at);
CREATE INDEX IF NOT EXISTS idx_hazard_alerts_deleted_at  ON hazard_alerts(deleted_at);
