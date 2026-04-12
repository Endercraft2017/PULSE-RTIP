-- =============================================================================
-- Migration 008: Create SMS Reports Table
-- =============================================================================
-- Stages emergency reports received via SMS (offline citizen reports).
-- These are parsed from structured PULSE911 SMS messages received by the
-- TextBee gateway, then optionally converted to full reports by admins.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sms_reports (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_message         TEXT        NOT NULL,
    sender_phone        VARCHAR(20),
    type                VARCHAR(50),
    severity            VARCHAR(10) DEFAULT 'medium',
    message             TEXT,
    sender_name         VARCHAR(100),
    latitude            DECIMAL(10,8)   DEFAULT NULL,
    longitude           DECIMAL(11,8)   DEFAULT NULL,
    status              VARCHAR(20)     DEFAULT 'pending',
    converted_report_id INTEGER         DEFAULT NULL,
    textbee_sms_id      VARCHAR(100),
    received_at         DATETIME,
    created_at          DATETIME        DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (converted_report_id) REFERENCES reports(id)
);
