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
const Notification = require('../models/Notification');
const User = require('../models/User');

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

    const report = await Report.create({
      title,
      type,
      description,
      location,
      latitude,
      longitude,
      submitted_by: req.user.id,
    });

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await ReportImage.create(report.id, `/uploads/${file.filename}`);
      }
    }

    const images = await ReportImage.findByReportId(report.id);

    // Notify all admin users about the new report
    try {
      const admins = await User.findByRole('admin');
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

    const report = await Report.updateStatus(req.params.id, status);

    await Notification.create({
      user_id: existing.submitted_by,
      report_id: existing.id,
      title: 'Report Status Update',
      text: `Your report "${existing.title}" has been updated to: ${status}.`,
      status,
    });

    res.json({
      success: true,
      data: report,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReports, getReport, createReport, updateReportStatus };
