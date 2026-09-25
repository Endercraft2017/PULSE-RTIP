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

  /** SQLite file path (offline mode). SQLITE_PATH lets hosted deploys
   *  (Railway) keep the DB on a persistent volume instead of the
   *  container's ephemeral filesystem. */
  sqlitePath: process.env.SQLITE_PATH
    ? path.resolve(process.env.SQLITE_PATH)
    : path.resolve(__dirname, '../../database/offline/pulse_rtip.db'),

  /** Number of reverse-proxy hops in front of Express (nginx or Railway's
   *  edge = 1). Needed so req.ip / rate limiting see the real client IP
   *  instead of the proxy's. Set TRUST_PROXY=0 when running with no proxy. */
  trustProxy: process.env.TRUST_PROXY !== undefined
    ? parseInt(process.env.TRUST_PROXY, 10) || 0
    : 1,

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
    /** Alternative for hosts without a writable secrets dir (Railway):
     *  the service-account JSON itself, raw or base64-encoded. Takes
     *  precedence over the path when both are set. */
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '',
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
