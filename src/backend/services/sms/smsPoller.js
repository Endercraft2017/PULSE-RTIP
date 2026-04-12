/**
 * =============================================================================
 * SMS Report Poller
 * =============================================================================
 *
 * Background service that polls the TextBee gateway for new SMS messages
 * every 60 seconds, parses PULSE911-formatted reports, and stores them
 * in the sms_reports staging table for admin review.
 *
 * Started from server.js after DB initialization.
 * =============================================================================
 */

const textbee = require('./textbee');
const smsParser = require('./smsParser');
const SmsReport = require('../../models/SmsReport');

const POLL_INTERVAL = 60 * 1000; // 60 seconds

/**
 * Polls for received SMS, parses PULSE911 reports, and stores new ones.
 */
async function pollAndProcess() {
  if (!textbee.isConfigured()) return;

  try {
    const result = await textbee.getReceived({ page: 1, limit: 50 });
    const messages = (result && result.data) || [];

    for (const msg of messages) {
      const smsId = msg._id;
      if (!smsId) continue;

      // Skip if already processed
      const existing = await SmsReport.findByTextbeeSmsId(smsId);
      if (existing) continue;

      // Only parse PULSE911 messages
      if (!smsParser.isPulse911(msg.message)) continue;

      const parsed = smsParser.parse(msg.message);
      if (!parsed) continue;

      await SmsReport.create({
        raw_message: msg.message,
        sender_phone: msg.sender || null,
        type: parsed.type,
        severity: parsed.severity,
        message: parsed.message,
        sender_name: parsed.sender_name,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        textbee_sms_id: smsId,
        received_at: msg.receivedAt || msg.createdAt || null,
      });

      console.log(`[SMS Poller] New PULSE911 report from ${parsed.sender_name} (${msg.sender})`);
    }
  } catch (err) {
    console.error('[SMS Poller] Error:', err.message);
  }
}

/**
 * Starts the background polling loop.
 */
function start() {
  if (!textbee.isConfigured()) {
    console.log('[SMS Poller] TextBee not configured, skipping.');
    return;
  }

  console.log(`[SMS Poller] Started (polling every ${POLL_INTERVAL / 1000}s)`);

  // Run once immediately, then on interval
  setTimeout(pollAndProcess, 5000);
  setInterval(pollAndProcess, POLL_INTERVAL);
}

module.exports = { start, pollAndProcess };
