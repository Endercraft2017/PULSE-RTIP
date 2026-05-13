-- =============================================================================
-- Migration 004: Create Hazard Alerts Table  (canonical schema, consolidated)
-- =============================================================================
-- MDRRMO-issued hazard advisories and announcements broadcast to citizens
-- via SMS + push notifications. Audience can be everyone or a subset of
-- barangays; sound_enabled controls the push-notification audible alert.
-- Severity values: high, medium, low.  Category values: hazard, announcement.
--
-- Subsequent ALTER migrations (009 coords, 010 resolved_address, 023 audience
-- + category + sound) added columns. This file now reflects the canonical
-- schema; the ALTERs remain and no-op on fresh runs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS hazard_alerts (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               VARCHAR(255)  NOT NULL,
    category            VARCHAR(20)   NOT NULL DEFAULT 'hazard',
    severity            VARCHAR(10)   NOT NULL DEFAULT 'medium',
    location            VARCHAR(255)  DEFAULT NULL,
    latitude            DECIMAL(10,8) DEFAULT NULL,
    longitude           DECIMAL(11,8) DEFAULT NULL,
    resolved_address    VARCHAR(500)  DEFAULT NULL,
    description         TEXT          DEFAULT NULL,
    audience_type       VARCHAR(16)   NOT NULL DEFAULT 'all',
    audience_barangays  TEXT          DEFAULT NULL,
    sound_enabled       INTEGER       NOT NULL DEFAULT 1,
    created_by          INTEGER       DEFAULT NULL,
    created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
