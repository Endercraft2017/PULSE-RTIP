-- =============================================================================
-- Migration 008: Create otp_verifications table
-- =============================================================================
-- Tracks one-time-password codes sent via SMS for phone verification during
-- signup, login, or password reset.
-- =============================================================================

CREATE TABLE IF NOT EXISTS otp_verifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    phone       VARCHAR(20) NOT NULL,
    code        VARCHAR(6) NOT NULL,
    purpose     VARCHAR(20) NOT NULL DEFAULT 'signup',
    attempts    INTEGER NOT NULL DEFAULT 0,
    verified    INTEGER NOT NULL DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_verifications(phone);
CREATE INDEX IF NOT EXISTS idx_otp_created ON otp_verifications(created_at);
