-- =============================================================================
-- Migration 001: Create Users Table
-- =============================================================================
-- Stores citizen and admin user accounts for the PULSE-RTIP system.
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            VARCHAR(100)    NOT NULL,
    email           VARCHAR(255)    NOT NULL UNIQUE,
    phone           VARCHAR(20)     DEFAULT NULL,
    address         VARCHAR(255)    DEFAULT NULL,
    avatar          CHAR(1)         DEFAULT 'U',
    role            VARCHAR(10)     NOT NULL DEFAULT 'citizen',
    password_hash   VARCHAR(255)    NOT NULL,
    joined_date     DATETIME        DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME        DEFAULT CURRENT_TIMESTAMP
);
