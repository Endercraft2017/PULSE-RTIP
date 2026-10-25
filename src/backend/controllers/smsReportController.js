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

    require('../services/geocode/territory').assertLocation({ latitude: smsReport.latitude, longitude: smsReport.longitude, location: smsReport.message });

    const reportId=await db.transaction(async()=>{
      const result=await db.query(
        `INSERT INTO reports (title,type,description,location,latitude,longitude,status,source,submitted_by,created_at)
         VALUES (?,?,?,?,?,?,'pending','sms',NULL,?)`,
        [`[SMS] ${smsReport.type||'Emergency Report'}`,smsReport.type||'Others',`${smsReport.message||''}\n\n— Reported via SMS by ${smsReport.sender_name||'Unknown'} (${smsReport.sender_phone||'N/A'})`,`${smsReport.latitude}, ${smsReport.longitude}`,smsReport.latitude,smsReport.longitude,smsReport.received_at||smsReport.created_at]);
      const reportId=result.insertId;
      const changed=await db.query("UPDATE sms_reports SET status='converted',converted_report_id=? WHERE id=? AND status<> 'converted'",[reportId,smsReport.id]);
      if(!changed.affectedRows)throw Object.assign(new Error('SMS report already converted.'),{statusCode:409});
      await require('../models/ReportEvent').create({report_id:reportId,actor_user_id:req.user.id,actor_department:req.user.department,action:'created',note:'Converted from SMS staging after Morong GPS validation.'});
      await require('../middleware/auditLog').recordAction(req.user.id,'sms_report_converted','report',reportId,{sms_report_id:smsReport.id});
      return reportId;
    });

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
