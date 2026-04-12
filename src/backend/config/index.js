/**
 * =============================================================================
 * PULSE-RTIP Central Configuration
 * =============================================================================
 *
 * Table of Contents:
 * 1. Environment Loading
 * 2. Configuration Object
 * 3. Exports
 *
 * Loads environment variables and exports a unified config object
 * used across the application.
 * =============================================================================
 */

const path = require('path');
const dotenv = require('dotenv');

/* --------------------------------------------------------------------------
 * 1. Environment Loading
 * -------------------------------------------------------------------------- */

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/* --------------------------------------------------------------------------
 * 2. Configuration Object
 * -------------------------------------------------------------------------- */

const config = {
  /** Application mode: 'production' (MySQL) or 'offline' (SQLite) */
  appMode: process.env.APP_MODE || 'offline',

  /** Server port */
  port: parseInt(process.env.PORT, 10) || 3000,

  /** JWT settings */
  jwt: {
    secret: process.env.JWT_SECRET || 'default-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },

  /** MySQL connection settings (production mode) */
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    user: process.env.MYSQL_USER || 'pulse_user',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'pulse_rtip',
  },

  /** SQLite file path (offline mode) */
  sqlitePath: path.resolve(__dirname, '../../database/offline/pulse_rtip.db'),

  /** Upload settings */
  upload: {
    dir: path.resolve(__dirname, '../../../', process.env.UPLOAD_DIR || 'uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,
  },

  /** Path to frontend static files */
  frontendPath: path.resolve(__dirname, '../../frontend'),

  /** TextBee SMS Gateway */
  textbee: {
    apiKey: process.env.TEXTBEE_API_KEY || '',
    deviceId: process.env.TEXTBEE_DEVICE_ID || '',
    apiUrl: process.env.TEXTBEE_API_URL || 'https://api.textbee.dev/api/v1',
  },
};

/* --------------------------------------------------------------------------
 * 3. Exports
 * -------------------------------------------------------------------------- */

module.exports = config;
