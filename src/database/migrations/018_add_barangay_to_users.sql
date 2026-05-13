-- =============================================================================
-- Migration 018: Add Barangay Field to Users
-- =============================================================================
-- Captures which of Morong's 11 barangays the user belongs to. Needed for
-- barangay-scoped SMS broadcasts and per-barangay analytics. Separate from
-- the freeform `address` field so we can do exact-match lookups.
-- =============================================================================

ALTER TABLE users ADD COLUMN barangay VARCHAR(64) DEFAULT NULL;
