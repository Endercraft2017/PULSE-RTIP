-- =============================================================================
-- Migration 005: Create Notifications Table  (canonical schema, consolidated)
-- =============================================================================
-- In-app notifications addressed to a specific user. Used for:
--   - Report status updates (report_id + status fields populated)
--   - Admin approval requests / outcomes (type='admin_request' /
--     'admin_request_approved' / 'admin_request_rejected'; actor_user_id
--     points at the applicant)
--   - Hazard / announcement broadcasts and other system notifications
--
-- Migration 012 added type + actor_user_id; this file now reflects the
-- canonical schema. The ALTERs remain and no-op on fresh runs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER       NOT NULL,
    type            VARCHAR(30)   DEFAULT NULL,
    title           VARCHAR(255)  NOT NULL,
    text            TEXT          DEFAULT NULL,
    status          VARCHAR(20)   DEFAULT NULL,
    actor_user_id   INTEGER       DEFAULT NULL,
    report_id       INTEGER       DEFAULT NULL,
    is_read         INTEGER       DEFAULT 0,
    created_at      DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)        REFERENCES users(id),
    FOREIGN KEY (actor_user_id)  REFERENCES users(id),
    FOREIGN KEY (report_id)      REFERENCES reports(id)
);
