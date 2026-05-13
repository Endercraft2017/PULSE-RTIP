-- =============================================================================
-- Migration 017: Add Manual ID Verification Fields to Users
-- =============================================================================
-- Captures the government-issued ID submitted at signup so admins can
-- eyeball it during the approval step. id_verified_at / id_verified_by
-- are stamped by the approve action — one click approves account AND ID.
-- =============================================================================

ALTER TABLE users ADD COLUMN id_type VARCHAR(64) DEFAULT NULL;
ALTER TABLE users ADD COLUMN id_number VARCHAR(64) DEFAULT NULL;
ALTER TABLE users ADD COLUMN id_document_path VARCHAR(500) DEFAULT NULL;
ALTER TABLE users ADD COLUMN id_verified_at DATETIME DEFAULT NULL;
ALTER TABLE users ADD COLUMN id_verified_by INTEGER DEFAULT NULL;
