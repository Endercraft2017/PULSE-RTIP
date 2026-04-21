-- =============================================================================
-- Migration 009: Add GPS coordinates to hazard_alerts
-- =============================================================================
-- Adds optional latitude/longitude fields so admins can pin hazards on the
-- map and include coordinates in the SMS broadcast (plus a Google Maps link).
-- =============================================================================

ALTER TABLE hazard_alerts ADD COLUMN latitude DECIMAL(10,8) DEFAULT NULL;
ALTER TABLE hazard_alerts ADD COLUMN longitude DECIMAL(11,8) DEFAULT NULL;
