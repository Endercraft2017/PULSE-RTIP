-- =============================================================================
-- Migration 015: Add source_type to sms_reports
-- =============================================================================
-- Differentiates offline SMS messages staged in sms_reports:
--   'sos'    - PULSE911-formatted emergency SOS reports
--   'report' - REPORT-formatted general incident reports
-- Existing rows default to 'sos' since that was the only format prior.
-- =============================================================================

ALTER TABLE sms_reports ADD COLUMN source_type VARCHAR(10) NOT NULL DEFAULT 'sos';
