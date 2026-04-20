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

const BASE_POLL_INTERVAL = 60 * 1000; // 60 seconds when healthy
const MAX_BACKOFF = 15 * 60 * 1000;   // cap at 15 minutes between polls when gateway is down

let consecutiveFailures = 0;
let pollTimer = null;
let lastErrorLoggedAt = 0;

function nextDelay() {
  if (consecutiveFailures === 0) return BASE_POLL_INTERVAL;
  const backoff = Math.min(BASE_POLL_INTERVAL * Math.pow(2, consecutiveFailures), MAX_BACKOFF);
  return backoff;
}

async function pollAndProcess() {
  if (!textbee.isConfigured()) return;

  try {
    const result = await textbee.getReceived({ page: 1, limit: 50 });
    const messages = (result && result.data) || [];

    if (consecutiveFailures > 0) {
      console.log(`[SMS Poller] Recovered after ${consecutiveFailures} failure(s).`);
      consecutiveFailures = 0;
    }

    for (const msg of messages) {
      const smsId = msg._id;
      if (!smsId) continue;
      const existing = await SmsReport.findByTextbeeSmsId(smsId);
      if (existing) continue;
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
    consecutiveFailures += 1;
    // Log only the first failure of a streak, then once every 10 minutes
    const now = Date.now();
    if (consecutiveFailures === 1 || now - lastErrorLoggedAt > 10 * 60 * 1000) {
      console.error(`[SMS Poller] Error (${consecutiveFailures} consecutive): ${err.message}`);
      lastErrorLoggedAt = now;
    }
  } finally {
    schedule();
  }
}

function schedule() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = setTimeout(pollAndProcess, nextDelay());
}

function start() {
  if (!textbee.isConfigured()) {
    console.log('[SMS Poller] TextBee not configured, skipping.');
    return;
  }

  console.log(`[SMS Poller] Started (base interval ${BASE_POLL_INTERVAL / 1000}s, exp backoff to ${MAX_BACKOFF / 60000}min on errors)`);
  pollTimer = setTimeout(pollAndProcess, 5000);
}

module.exports = { start, pollAndProcess };
