/**
 * =============================================================================
 * SMS Report Model
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. create             - Insert a parsed SMS report
 * 3. findAll            - List all SMS reports
 * 4. findById           - Get a single SMS report
 * 5. updateStatus       - Update status (pending → converted / dismissed)
 * 6. findByTextbeeSmsId - Lookup by TextBee message ID (dedup)
 *
 * Data access layer for the sms_reports staging table.
 * =============================================================================
 */

const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. create
 * -------------------------------------------------------------------------- */

async function create(data) {
  const {
    raw_message, sender_phone, type, severity, message,
    sender_name, latitude, longitude, textbee_sms_id, received_at,
  } = data;

  const result = await db.query(
    `INSERT INTO sms_reports
       (raw_message, sender_phone, type, severity, message, sender_name,
        latitude, longitude, textbee_sms_id, received_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      raw_message, sender_phone || null, type || null, severity || 'medium',
      message || null, sender_name || null, latitude || null, longitude || null,
      textbee_sms_id || null, received_at || null,
    ]
  );

  const insertId = result.insertId || result.lastInsertRowid;
  return findById(insertId);
}

/* --------------------------------------------------------------------------
 * 3. findAll
 * -------------------------------------------------------------------------- */

async function findAll() {
  return db.query('SELECT * FROM sms_reports ORDER BY created_at DESC');
}

/* --------------------------------------------------------------------------
 * 4. findById
 * -------------------------------------------------------------------------- */

async function findById(id) {
  const rows = await db.query('SELECT * FROM sms_reports WHERE id = ?', [id]);
  return rows[0] || null;
}

/* --------------------------------------------------------------------------
 * 5. updateStatus
 * -------------------------------------------------------------------------- */

async function updateStatus(id, status, convertedReportId = null) {
  await db.query(
    'UPDATE sms_reports SET status = ?, converted_report_id = ? WHERE id = ?',
    [status, convertedReportId, id]
  );
  return findById(id);
}

/* --------------------------------------------------------------------------
 * 6. findByTextbeeSmsId
 * -------------------------------------------------------------------------- */

async function findByTextbeeSmsId(smsId) {
  const rows = await db.query(
    'SELECT * FROM sms_reports WHERE textbee_sms_id = ?',
    [smsId]
  );
  return rows[0] || null;
}

module.exports = { create, findAll, findById, updateStatus, findByTextbeeSmsId };
