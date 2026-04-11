-- =============================================================================
-- Migration 003: Create Report Images Table
-- =============================================================================
-- Stores file paths for images/media attached to incident reports.
-- =============================================================================

CREATE TABLE IF NOT EXISTS report_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id       INTEGER         NOT NULL,
    file_path       VARCHAR(500)    NOT NULL,
    uploaded_at     DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
);
