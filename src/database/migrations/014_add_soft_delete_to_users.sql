-- =============================================================================
-- Migration 014: Add Soft Delete to Users
-- =============================================================================
-- Soft-delete column so citizens/admins can leave the platform without
-- cascading-away their authored reports, hazards, and community posts.
-- A non-null deleted_at means the account is inactive: login/auth reject it
-- and admin user lists hide it, but foreign-key joins still surface the
-- original author name on historical content.
-- =============================================================================

ALTER TABLE users ADD COLUMN deleted_at DATETIME DEFAULT NULL;
