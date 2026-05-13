-- =============================================================================
-- Migration 016: App Settings (runtime-editable key-value config)
-- =============================================================================
-- Stores admin-editable configuration that overrides .env values at runtime.
-- Primary consumer: TextBee SMS gateway credentials (api key, device id, etc.)
-- so admins can rotate credentials without restarting the server.
--
-- `key` is a reserved word in MySQL — backticks keep the DDL portable between
-- SQLite (offline) and MySQL (production). updated_by is the admin user id
-- (nullable for seeded rows / future programmatic writes).
-- =============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
    `key` VARCHAR(64) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER NULL
);
