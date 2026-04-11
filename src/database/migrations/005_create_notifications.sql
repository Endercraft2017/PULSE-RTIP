-- =============================================================================
-- Migration 005: Create Notifications Table
-- =============================================================================
-- Stores notifications sent to users when their report status changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER         NOT NULL,
    report_id       INTEGER         DEFAULT NULL,
    title           VARCHAR(255)    NOT NULL,
    text            TEXT            DEFAULT NULL,
    status          VARCHAR(20)     DEFAULT NULL,
    is_read         INTEGER         DEFAULT 0,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (report_id) REFERENCES reports(id)
);
