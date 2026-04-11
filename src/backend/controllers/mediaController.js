/**
 * =============================================================================
 * Media Controller
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports
 * 2. Multer Configuration
 * 3. uploadFile - Handle file upload
 *
 * Handles media file uploads (images and videos) for incident reports.
 * =============================================================================
 */

const multer = require('multer');
const path = require('path');
const config = require('../config');

/* --------------------------------------------------------------------------
 * 2. Multer Configuration
 * -------------------------------------------------------------------------- */

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'video/mp4'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.upload.dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSize },
});

/* --------------------------------------------------------------------------
 * 3. uploadFile
 * -------------------------------------------------------------------------- */

/**
 * Handles single or multiple file uploads.
 * Returns the file path(s) for the uploaded files.
 *
 * @param {object} req - Express request (multipart form with 'files' field)
 * @param {object} res - Express response
 * @param {function} next - Express next function
 */
function uploadFile(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No files uploaded.',
    });
  }

  const files = req.files.map(file => ({
    filename: file.filename,
    path: `/uploads/${file.filename}`,
    mimetype: file.mimetype,
    size: file.size,
  }));

  res.status(201).json({
    success: true,
    data: files,
  });
}

module.exports = { upload, uploadFile };
