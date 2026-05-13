-- =============================================================================
-- Migration 009: Allow NULL submitted_by + add source column to reports
-- =============================================================================
-- SMS-based offline reports may not have a registered user account, so
-- submitted_by becomes nullable. The source column tracks origin: 'web'
-- (default) or 'sms'.
--
-- Why the swap-via-tmp pattern instead of ALTER TABLE ... RENAME TO:
--   SQLite captures FK target names at table-creation time. ALTER TABLE
--   reports RENAME TO reports_old updates references in dependent tables
--   (report_images, sms_reports) to point at "reports_old". Subsequently
--   dropping reports_old leaves those FKs dangling. We avoid the rename
--   path entirely: create the new table under a tmp name, copy rows, drop
--   the original, then rename the tmp to the original name. Dependent FKs
--   continue to resolve to "reports" the entire time.
-- =============================================================================

PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS reports_v2_tmp (
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

INSERT INTO reports_v2_tmp (id, title, type, status, description, location, latitude, longitude, submitted_by, source, created_at, updated_at)
    SELECT id, title, type, status, description, location, latitude, longitude, submitted_by, 'web', created_at, updated_at
    FROM reports;

DROP TABLE reports;

ALTER TABLE reports_v2_tmp RENAME TO reports;

PRAGMA foreign_keys=ON;
