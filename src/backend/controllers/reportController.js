/**
 * =============================================================================
 * Report Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. getReports       - List reports with filters
 * 3. getReport        - Get a single report by ID
 * 4. createReport     - Create a new incident report
 * 5. updateReportStatus - Update report status (admin only)
 *
 * Handles incident report CRUD operations.
 * =============================================================================
 */

const Report = require('../models/Report');
const ReportImage = require('../models/ReportImage');
const ReportEvent = require('../models/ReportEvent');
const Notification = require('../models/Notification');
const User = require('../models/User');
const PushToken = require('../models/PushToken');
const fcm = require('../services/push/fcm');
const { logAction } = require('../middleware/auditLog');

/* --------------------------------------------------------------------------
 * 2. getReports
 * -------------------------------------------------------------------------- */

/**
 * Lists reports. Citizens see only their own reports.
 * Admins see all reports. Supports status, type, and search filters.
 *
 * @param {object} req - Express request (query: { status?, type?, search? })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getReports(req, res, next) {
  try {
    const { status, type, search } = req.query;
    let reports;

    if (req.user.role === 'admin') {
      reports = await Report.findAll({ status, type, search });
    } else {
      reports = await Report.findByUserId(req.user.id, { status });
    }

    const reportsWithImages = await Promise.all(
      reports.map(async (report) => {
        const images = await ReportImage.findByReportId(report.id);
        return { ...report, images };
      })
    );

    res.json({
      success: true,
      data: reportsWithImages,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. getReport
 * -------------------------------------------------------------------------- */

/**
 * Gets a single report by ID with its images.
 *
 * @param {object} req - Express request (params: { id })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function getReport(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.',
      });
    }

    if (req.user.role !== 'admin' && report.submitted_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied.',
      });
    }

    const images = await ReportImage.findByReportId(report.id);
    res.json({
      success: true,
      data: { ...report, images },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. createReport
 * -------------------------------------------------------------------------- */

/**
 * Creates a new incident report.
 *
 * @param {object} req - Express request (body: { title, type, description, location, latitude?, longitude? })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function createReport(req, res, next) {
  try {
    const { title, type, description, location, latitude, longitude } = req.body;

    // upload.fields(...) returns req.files keyed by field name. Grab video
    // first so we can persist its path on the report row itself.
    const imageFiles = (req.files && req.files.images) || [];
    const videoFile  = (req.files && req.files.video && req.files.video[0]) || null;
    const video_path = videoFile ? `/uploads/${videoFile.filename}` : null;

    const report = await Report.create({
      title,
      type,
      description,
      location,
      latitude,
      longitude,
      video_path,
      submitted_by: req.user.id,
    });

    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        await ReportImage.create(report.id, `/uploads/${file.filename}`);
      }
    }

    const images = await ReportImage.findByReportId(report.id);

    // Notify all admin users about the new report (in-app inbox row).
    let adminIds = [];
    try {
      const admins = await User.findByRole('admin');
      adminIds = admins.map(a => a.id);
      for (const admin of admins) {
        await Notification.create({
          user_id: admin.id,
          report_id: report.id,
          title: 'New Incident Report',
          text: `"${title}" — a new ${type} incident has been submitted and needs review.`,
          status: 'pending',
        });
      }
    } catch (notifErr) {
      console.error('Failed to notify admins:', notifErr);
    }

    // Fire-and-forget push fan-out so every admin's device buzzes the
    // moment a citizen submits an incident report. Best-effort — never
    // blocks the API response. Skips if no admin tokens are registered.
    if (adminIds.length > 0) {
      Promise.all(adminIds.map(uid => PushToken.findByUserId(uid)))
        .then(tokenLists => {
          const tokens = []
            .concat(...tokenLists)
            .map(r => r && r.token)
            .filter(Boolean);
          if (tokens.length === 0) return null;
          return fcm.send(tokens, {
            title: 'New incident report',
            body: `${type}: "${title}" — tap to review.`,
            sound: true,
            data: {
              reportId: String(report.id),
              kind: 'incident_report',
            },
          });
        })
        .then(r => {
          if (r) console.log(`[push] new-report admin broadcast (batches=${r.batches ?? (r.devOnly ? 'dev' : 0)})`);
        })
        .catch(err => console.error('[push] new-report fan-out failed:', err.message));
    }

    res.status(201).json({
      success: true,
      data: { ...report, images },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 5. updateReportStatus
 * -------------------------------------------------------------------------- */

/**
 * Updates a report's status (admin only).
 * Creates a notification for the report's submitter.
 *
 * @param {object} req - Express request (params: { id }, body: { status })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function updateReportStatus(req, res, next) {
  try {
    const { status } = req.body;

    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Report not found.',
      });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = existing.submitted_by === req.user.id;

    // Citizens can only cancel their own reports, and only if still actionable
    if (!isAdmin) {
      if (!isOwner) {
        return res.status(403).json({ success: false, message: 'Access denied.' });
      }
      if (status !== 'cancelled') {
        return res.status(403).json({ success: false, message: 'Citizens can only cancel their own reports.' });
      }
      const cancellable = ['submitted', 'pending', 'investigating'];
      if (!cancellable.includes(existing.status)) {
        return res.status(400).json({ success: false, message: 'This report can no longer be cancelled.' });
      }
    }

    const report = await Report.updateStatus(req.params.id, status);

    // Record processing history (A-8). Best-effort, never blocks.
    try {
      await ReportEvent.create({
        report_id: existing.id,
        actor_user_id: req.user.id,
        action: 'status_change',
        from_status: existing.status || null,
        to_status: status,
        note: (req.body && req.body.note) || null,
      });
    } catch (histErr) {
      console.error('[report-event]', histErr.message);
    }

    // Admin-initiated status changes get logged for MDRRMO accountability.
    if (isAdmin) {
      logAction(req.user.id, 'report_status_changed', 'report', existing.id, {
        from: existing.status,
        to: status,
        title: existing.title,
      });

      // Clear the inbox: mark every unread notification tied to this
      // report as read across all admins, so the bell badge counts
      // only items that still need attention.
      try {
        await Notification.markReadByReportId(existing.id);
      } catch (e) {
        console.error('[updateReportStatus] failed to clear notifications:', e.message);
      }
    }

    // Notify the report owner (only when admin changes status)
    if (isAdmin) {
      await Notification.create({
        user_id: existing.submitted_by,
        report_id: existing.id,
        title: 'Report Status Update',
        text: `Your report "${existing.title}" has been updated to: ${status.replace(/_/g, ' ')}.`,
        status,
      });

      // U-5b: also push to the submitter's device(s). Best-effort —
      // never blocks or fails the status update.
      try {
        const note = (req.body && req.body.note) ? String(req.body.note).trim() : '';
        const prettyStatus = String(status).replace(/_/g, ' ');
        const bodyText = status === 'resolved'
          ? `Resolved: ${note || 'no details'}`
          : `Your "${existing.title}" is now ${prettyStatus}.`;

        const tokenRows = await PushToken.findByUserId(existing.submitted_by);
        const tokens = (tokenRows || []).map(r => r.token).filter(Boolean);
        if (tokens.length > 0) {
          fcm.send(tokens, {
            title: 'Report status updated',
            body: bodyText,
            sound: true,
            data: {
              type: 'report_status',
              reportId: existing.id,
              status,
            },
          }).catch(err => console.error('[push] report status failed:', err && err.message));
        }
      } catch (pushErr) {
        console.error('[push] report status hook error:', pushErr.message);
      }
    }

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. getReportEvents
 * -------------------------------------------------------------------------- */

/**
 * Returns the processing history (status changes, etc.) for a report.
 * Citizens may only view history for reports they own; admins see all.
 */
async function getReportEvents(req, res, next) {
  try {
    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    if (req.user.role !== 'admin' && report.submitted_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    const events = await ReportEvent.findByReport(report.id);
    res.json({ success: true, data: events });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 6. updateReport — citizen edits their own report (restricted statuses)
 * -------------------------------------------------------------------------- */

async function updateReport(req, res, next) {
  try {
    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const isAdmin = req.user.role === 'admin';
    const isOwner = existing.submitted_by === req.user.id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Once an admin has moved the report past the early stages, the citizen
    // shouldn't be able to rewrite the contents underneath them.
    const editable = ['submitted', 'pending', 'investigating'];
    if (!isAdmin && !editable.includes(existing.status)) {
      return res.status(400).json({ success: false, message: 'This report can no longer be edited.' });
    }

    const { title, type, description, location, latitude, longitude } = req.body;
    const updated = await Report.update(req.params.id, {
      title,
      type,
      description,
      location,
      latitude: latitude != null && latitude !== '' ? Number(latitude) : undefined,
      longitude: longitude != null && longitude !== '' ? Number(longitude) : undefined,
    });

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 7. deleteReport — admin-only soft-delete (move to bin)
 * -------------------------------------------------------------------------- */

/**
 * Soft-deletes a report (moves it to the recycle bin). Admin-only. The row
 * is preserved with deleted_at stamped so it can be restored or purged
 * later from the Bin view. Citizen views and dashboard counters filter
 * binned rows out automatically.
 *
 * @param {object} req - Express request (params: { id })
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
async function deleteReport(req, res, next) {
  try {
    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    await Report.remove(existing.id);

    logAction(req.user.id, 'report_binned', 'report', existing.id, {
      title: existing.title,
      status: existing.status,
      type: existing.type,
    });

    res.json({ success: true, message: 'Report moved to bin.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 8. restoreReport — admin-only restore from bin
 * -------------------------------------------------------------------------- */

/**
 * Restores a soft-deleted report from the bin. Admin-only.
 */
async function restoreReport(req, res, next) {
  try {
    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    if (existing.deleted_at == null) {
      return res.status(400).json({ success: false, message: 'Report is not in the bin.' });
    }

    await Report.restore(existing.id);

    logAction(req.user.id, 'report_restored', 'report', existing.id, {
      title: existing.title,
    });

    res.json({ success: true, message: 'Report restored.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 9. permanentDeleteReport — admin-only purge from bin
 * -------------------------------------------------------------------------- */

/**
 * Permanently deletes a report and all its dependent rows. Admin-only.
 * Intended to be called from the Bin view after a confirm prompt.
 */
async function permanentDeleteReport(req, res, next) {
  try {
    const existing = await Report.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    await Report.permanentRemove(existing.id);

    logAction(req.user.id, 'report_permanently_deleted', 'report', existing.id, {
      title: existing.title,
      status: existing.status,
      type: existing.type,
    });

    res.json({ success: true, message: 'Report permanently deleted.' });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 10. getBinReports — admin-only Bin view
 * -------------------------------------------------------------------------- */

/**
 * Returns all soft-deleted reports for the admin Bin view. Includes images
 * so the bin card can show context.
 */
async function getBinReports(req, res, next) {
  try {
    const reports = await Report.findDeleted();
    const reportsWithImages = await Promise.all(
      reports.map(async (report) => {
        const images = await ReportImage.findByReportId(report.id);
        return { ...report, images };
      })
    );
    res.json({ success: true, data: reportsWithImages });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getReports,
  getReport,
  createReport,
  updateReport,
  updateReportStatus,
  getReportEvents,
  deleteReport,
  restoreReport,
  permanentDeleteReport,
  getBinReports,
};
