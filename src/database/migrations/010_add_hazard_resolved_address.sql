-- =============================================================================
-- Migration 010: Reverse-geocoded address for hazards
-- =============================================================================
-- Stores the best-effort human-readable address resolved from the
-- latitude/longitude at hazard creation time (via Nominatim/OSM).
-- Cached so we don't re-geocode on every read.
-- =============================================================================

ALTER TABLE hazard_alerts ADD COLUMN resolved_address VARCHAR(500) DEFAULT NULL;
