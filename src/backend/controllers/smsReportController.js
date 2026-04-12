/**
 * =============================================================================
 * SMS Report Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. list     - List all SMS reports (admin)
 * 3. convert  - Convert an SMS report into a full incident report (admin)
 * 4. dismiss  - Dismiss/ignore an SMS report (admin)
 *
 * Handles admin operations on offline SMS emergency reports.
 * =============================================================================
 */

const SmsReport = require('../models/SmsReport');
const db = require('../config/database');

/* --------------------------------------------------------------------------
 * 2. list
 * -------------------------------------------------------------------------- */

async function list(req, res, next) {
  try {
    const reports = await SmsReport.findAll();
    res.json({ success: true, data: reports });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. convert
 * -------------------------------------------------------------------------- */

async function convert(req, res, next) {
  try {
    const smsReport = await SmsReport.findById(req.params.id);
    if (!smsReport) {
      return res.status(404).json({ success: false, message: 'SMS report not found.' });
    }
    if (smsReport.status === 'converted') {
      return res.status(400).json({ success: false, message: 'Already converted.' });
    }

    // Create a real report from the SMS data
    const result = await db.query(
      `INSERT INTO reports (title, type, description, location, latitude, longitude,
         status, source, submitted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', 'sms', NULL, ?)`,
      [
        `[SMS] ${smsReport.type || 'Emergency Report'}`,
        smsReport.type || 'Others',
        `${smsReport.message || ''}\n\n— Reported via SMS by ${smsReport.sender_name || 'Unknown'} (${smsReport.sender_phone || 'N/A'})`,
        smsReport.latitude && smsReport.longitude
          ? `${smsReport.latitude}, ${smsReport.longitude}`
          : null,
        smsReport.latitude || null,
        smsReport.longitude || null,
        smsReport.received_at || smsReport.created_at,
      ]
    );

    const reportId = result.insertId || result.lastInsertRowid;
    await SmsReport.updateStatus(smsReport.id, 'converted', reportId);

    res.json({
      success: true,
      message: 'SMS report converted to incident report.',
      data: { smsReportId: smsReport.id, reportId },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. dismiss
 * -------------------------------------------------------------------------- */

async function dismiss(req, res, next) {
  try {
    const smsReport = await SmsReport.findById(req.params.id);
    if (!smsReport) {
      return res.status(404).json({ success: false, message: 'SMS report not found.' });
    }

    await SmsReport.updateStatus(smsReport.id, 'dismissed');
    res.json({ success: true, message: 'SMS report dismissed.' });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, convert, dismiss };
