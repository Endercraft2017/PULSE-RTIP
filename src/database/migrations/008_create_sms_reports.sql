-- =============================================================================
-- Migration 008: Create SMS Reports Table  (canonical schema, consolidated)
-- =============================================================================
-- Stages emergency reports received via SMS (offline citizen reports). The
-- TextBee Android gateway polls inbound SMS and the backend smsPoller stores
-- recognized payloads here, awaiting admin review for conversion into a
-- formal incident report.
--
-- source_type discriminates the SMS protocol:
--   'sos'    — PULSE911|TYPE|SEV|LAT,LNG|NAME|PHONE|MSG  (emergency SOS)
--   'report' — REPORT|TITLE|LAT,LNG|NAME|PHONE|MSG       (general incident)
--
-- Migration 015 added source_type. This file now reflects the canonical
-- schema; the ALTER remains and no-ops on fresh runs.
-- =============================================================================

CREATE TABLE IF NOT EXISTS sms_reports (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_message         TEXT          NOT NULL,
    source_type         VARCHAR(10)   NOT NULL DEFAULT 'sos',
    sender_phone        VARCHAR(20)   DEFAULT NULL,
    sender_name         VARCHAR(100)  DEFAULT NULL,
    type                VARCHAR(50)   DEFAULT NULL,
    severity            VARCHAR(10)   DEFAULT 'medium',
    message             TEXT          DEFAULT NULL,
    latitude            DECIMAL(10,8) DEFAULT NULL,
    longitude           DECIMAL(11,8) DEFAULT NULL,
    status              VARCHAR(20)   DEFAULT 'pending',
    converted_report_id INTEGER       DEFAULT NULL,
    textbee_sms_id      VARCHAR(100)  DEFAULT NULL,
    received_at         DATETIME      DEFAULT NULL,
    created_at          DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (converted_report_id) REFERENCES reports(id)
);
