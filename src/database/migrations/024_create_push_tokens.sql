-- =============================================================================
-- Migration 024: Create push_tokens table (FCM device registry)
-- =============================================================================
-- U-7 / A-4: each physical device registers its FCM token here so we can
-- fan hazard + announcement broadcasts out as push notifications in
-- addition to the existing SMS path. user_id is nullable so a device can
-- register pre-login; once the user signs in we "claim" the token to
-- attach it to their account.
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_tokens (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    token           VARCHAR(500) NOT NULL UNIQUE,
    user_id         INTEGER DEFAULT NULL,
    platform        VARCHAR(16) DEFAULT 'android',
    barangay        VARCHAR(64) DEFAULT NULL,
    last_seen_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_barangay ON push_tokens(barangay);
