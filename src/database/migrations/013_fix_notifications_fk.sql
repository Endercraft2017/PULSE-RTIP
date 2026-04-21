-- =============================================================================
-- Migration 013: Fix stale FK on notifications.report_id -> reports_old
-- =============================================================================
-- An earlier migration left notifications.report_id referencing a renamed
-- (and now nonexistent) reports_old table. This blocks INSERTs whenever
-- SQLite enforces FKs. Rebuild the table with the correct FK.
-- =============================================================================

PRAGMA foreign_keys=OFF;

CREATE TABLE notifications_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER         NOT NULL,
    report_id       INTEGER         DEFAULT NULL,
    title           VARCHAR(255)    NOT NULL,
    text            TEXT            DEFAULT NULL,
    status          VARCHAR(20)     DEFAULT NULL,
    is_read         INTEGER         DEFAULT 0,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,
    type            VARCHAR(30)     DEFAULT NULL,
    actor_user_id   INTEGER         DEFAULT NULL,
    FOREIGN KEY (user_id)   REFERENCES users(id),
    FOREIGN KEY (report_id) REFERENCES reports(id)
);

INSERT INTO notifications_new
    (id, user_id, report_id, title, text, status, is_read, created_at, type, actor_user_id)
    SELECT id, user_id, report_id, title, text, status, is_read, created_at, type, actor_user_id
    FROM notifications;

DROP TABLE notifications;
ALTER TABLE notifications_new RENAME TO notifications;

PRAGMA foreign_keys=ON;
