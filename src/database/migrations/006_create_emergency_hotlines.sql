-- =============================================================================
-- Migration 006: Create Emergency Hotlines Table
-- =============================================================================
-- Stores emergency contact numbers for MDRRMO and other agencies.
-- =============================================================================

CREATE TABLE IF NOT EXISTS emergency_hotlines (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    category        VARCHAR(100)    DEFAULT NULL,
    label           VARCHAR(100)    NOT NULL,
    number          VARCHAR(50)     NOT NULL,
    sort_order      INTEGER         DEFAULT 0
);
