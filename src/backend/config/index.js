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
    gatewayPhone: process.env.TEXTBEE_GATEWAY_PHONE || '',
  },

  /** Firebase Cloud Messaging (push notifications). The HTTP v1 API uses
   *  service-account credentials — set FIREBASE_SERVICE_ACCOUNT_PATH to the
   *  absolute path of the JSON downloaded from Firebase → Project Settings
   *  → Service accounts. When unset, the push service logs payloads instead
   *  of sending so the broadcast pipeline runs end-to-end in dev. */
  push: {
    serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '',
  },

  /** SMTP / Email config. If SMTP_HOST is unset, the mailer logs to the
   *  console instead of sending — lets the approval flow run end-to-end
   *  in dev without a mail account. */
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: String(process.env.SMTP_SECURE || 'false') === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'PULSE 911 <noreply@afkcube.com>',
  },
};

/* --------------------------------------------------------------------------
 * 3. Exports
 * -------------------------------------------------------------------------- */

module.exports = config;
