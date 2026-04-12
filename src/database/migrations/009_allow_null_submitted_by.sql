-- =============================================================================
-- Migration 009: Allow NULL submitted_by and add source column to reports
-- =============================================================================
-- SMS-based offline reports may not have a registered user account.
-- The source column tracks report origin: 'web' (default) or 'sms'.
-- =============================================================================

PRAGMA foreign_keys=OFF;

ALTER TABLE reports RENAME TO reports_old;

CREATE TABLE reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR(255)    NOT NULL,
    type            VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'submitted',
    description     TEXT            DEFAULT NULL,
    location        VARCHAR(255)    DEFAULT NULL,
    latitude        DECIMAL(10,8)   DEFAULT NULL,
    longitude       DECIMAL(11,8)   DEFAULT NULL,
    submitted_by    INTEGER         DEFAULT NULL,
    source          VARCHAR(10)     DEFAULT 'web',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);

INSERT INTO reports (id, title, type, status, description, location, latitude, longitude, submitted_by, source, created_at, updated_at)
    SELECT id, title, type, status, description, location, latitude, longitude, submitted_by, 'web', created_at, updated_at
    FROM reports_old;

DROP TABLE reports_old;

PRAGMA foreign_keys=ON;
