-- =============================================================================
-- Migration 004: Create Hazard Alerts Table
-- =============================================================================
-- Stores active hazard zone alerts created by admin users.
-- Severity values: high, medium, low
-- =============================================================================

CREATE TABLE IF NOT EXISTS hazard_alerts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR(255)    NOT NULL,
    severity        VARCHAR(10)     NOT NULL DEFAULT 'medium',
    location        VARCHAR(255)    DEFAULT NULL,
    description     TEXT            DEFAULT NULL,
    created_by      INTEGER         DEFAULT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
