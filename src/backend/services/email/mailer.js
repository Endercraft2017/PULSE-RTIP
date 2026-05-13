/**
 * =============================================================================
 * Email Service (nodemailer)
 * =============================================================================
 *
 * Thin wrapper around nodemailer for transactional mail (approval
 * notifications, password reset backup, etc.).
 *
 * Behaviour:
 *   - If SMTP_HOST is configured, sends via that relay.
 *   - If SMTP_HOST is missing, logs the message to the console ("dev mode")
 *     so callers never throw and the approval flow stays testable without
 *     a real mail account.
 *
 * Gmail App Password quickstart (temporary relay until afkcube.com SMTP is
 * wired up via Brevo/SES):
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=your-gmail@gmail.com
 *   SMTP_PASS=<16-char app password — requires 2FA>
 *   SMTP_FROM=PULSE 911 <your-gmail@gmail.com>
 *
 * afkcube.com via Brevo:
 *   SMTP_HOST=smtp-relay.brevo.com
 *   SMTP_PORT=587
 *   SMTP_USER=<brevo login>
 *   SMTP_PASS=<brevo SMTP key>
 *   SMTP_FROM=PULSE 911 <noreply@afkcube.com>
 * =============================================================================
 */

const nodemailer = require('nodemailer');
const config = require('../../config');

let _transporter = null;

function getTransporter() {
  if (_transporter !== null) return _transporter;
  if (!config.smtp.host) {
    _transporter = false; // sentinel — "not configured"
    return _transporter;
  }
  _transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  });
  return _transporter;
}

function isConfigured() {
  return !!config.smtp.host;
}

/**
 * Sends an email. In dev (no SMTP), logs to stdout so callers always succeed.
 *
 * @param {object} opts
 * @param {string} opts.to
 * @param {string} opts.subject
 * @param {string} opts.text   Plain-text body (preferred for transactional)
 * @param {string} [opts.html] Optional HTML body
 * @returns {Promise<{success: boolean, devOnly?: boolean, messageId?: string, error?: string}>}
 */
async function send({ to, subject, text, html }) {
  if (!to) return { success: false, error: 'Recipient missing' };

  const t = getTransporter();
  if (!t) {
    console.log('\n[mailer:dev] SMTP not configured — email would have been:');
    console.log('  to:      ' + to);
    console.log('  subject: ' + subject);
    console.log('  body:    ' + (text || '').replace(/\n/g, '\n           '));
    console.log('');
    return { success: true, devOnly: true };
  }

  try {
    const info = await t.sendMail({
      from: config.smtp.from,
      to,
      subject,
      text,
      html,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] send failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { send, isConfigured };
