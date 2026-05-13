-- =============================================================================
-- Migration 001: Create Users Table  (canonical schema, consolidated)
-- =============================================================================
-- Stores citizen and admin accounts. Soft-delete via deleted_at; pending
-- approval queue via admin_request_status; ID verification fields populated
-- during signup and stamped on admin approve. Barangay enables audience-
-- scoped SMS / push broadcasts.
--
-- Successive ALTER TABLE migrations (012, 014, 017, 018) added columns
-- after the original 11-column shape. This file now reflects the current
-- canonical schema; the ALTERs remain in the migration directory but no-op
-- on fresh runs (migrate.js tolerates "duplicate column" errors).
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  VARCHAR(100)  NOT NULL,
    email                 VARCHAR(255)  NOT NULL UNIQUE,
    phone                 VARCHAR(20)   DEFAULT NULL,
    address               VARCHAR(255)  DEFAULT NULL,
    barangay              VARCHAR(64)   DEFAULT NULL,
    avatar                CHAR(1)       DEFAULT 'U',
    role                  VARCHAR(10)   NOT NULL DEFAULT 'citizen',
    password_hash         VARCHAR(255)  NOT NULL,
    admin_request_status  VARCHAR(20)   DEFAULT NULL,
    id_type               VARCHAR(64)   DEFAULT NULL,
    id_number             VARCHAR(64)   DEFAULT NULL,
    id_document_path      VARCHAR(500)  DEFAULT NULL,
    id_verified_at        DATETIME      DEFAULT NULL,
    id_verified_by        INTEGER       DEFAULT NULL,
    deleted_at            DATETIME      DEFAULT NULL,
    joined_date           DATETIME      DEFAULT CURRENT_TIMESTAMP,
    created_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_verified_by) REFERENCES users(id)
);
