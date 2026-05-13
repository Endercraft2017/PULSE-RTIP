-- =============================================================================
-- Migration 023: Add audience scope + announcement category to hazard_alerts
-- =============================================================================
-- U-8 / A-4 / A-5: hazards can now target all citizens or a subset of
-- barangays. The same table also carries 'announcement' entries (wider
-- advisories like class-suspension notices) so SMS + push broadcasts fan
-- out through the same pipeline and the audit trail stays in one place.
-- =============================================================================

ALTER TABLE hazard_alerts ADD COLUMN audience_type VARCHAR(16) NOT NULL DEFAULT 'all';
ALTER TABLE hazard_alerts ADD COLUMN audience_barangays TEXT DEFAULT NULL;
ALTER TABLE hazard_alerts ADD COLUMN category VARCHAR(20) NOT NULL DEFAULT 'hazard';
ALTER TABLE hazard_alerts ADD COLUMN sound_enabled INTEGER NOT NULL DEFAULT 1;
