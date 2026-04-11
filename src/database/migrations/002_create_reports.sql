-- =============================================================================
-- Migration 002: Create Reports Table
-- =============================================================================
-- Stores incident reports submitted by citizens.
-- Status values: submitted, pending, under-review, investigating, resolved
-- Type values: Flood, Fire, Infrastructure Damage, Earthquake, Landslide, etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS reports (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           VARCHAR(255)    NOT NULL,
    type            VARCHAR(50)     NOT NULL,
    status          VARCHAR(20)     NOT NULL DEFAULT 'submitted',
    description     TEXT            DEFAULT NULL,
    location        VARCHAR(255)    DEFAULT NULL,
    latitude        DECIMAL(10,8)   DEFAULT NULL,
    longitude       DECIMAL(11,8)   DEFAULT NULL,
    submitted_by    INTEGER         NOT NULL,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submitted_by) REFERENCES users(id)
);
