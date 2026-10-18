/** Durable alert outbox. One provider-sized batch per job, retried independently.
 * Table of contents: enqueue, dispatch, worker lifecycle.
 * Provider acceptance is recorded; it is not a handset delivery receipt.
 */
const db = require('../../config/database');
const textbee = require('../sms/textbee');
const fcm = require('../push/fcm');
const PushToken = require('../../models/PushToken');

async function enqueue({ hazard_id = null, advisory_id = null, title, message, audience_type = 'all', audience_barangays = [], critical = false }) {
  // Critical alerts always reach every registered user, including responders.
  const scoped = !critical && audience_type === 'barangay';
  if (scoped && !audience_barangays.length) throw Object.assign(new Error('Select at least one barangay.'), { statusCode: 400 });
  const params = scoped ? audience_barangays : [];
  const users = await db.query(`SELECT id, phone FROM users WHERE deleted_at IS NULL${scoped ? ` AND barangay IN (${params.map(() => '?').join(',')})` : ''}`, params);
  for (const user of users) await db.query(
    'INSERT INTO notifications (user_id, title, text, type) VALUES (?, ?, ?, ?)',
    [user.id, title, message, 'emergency_alert']);
  const phones = [...new Set(users.map(u => String(u.phone || '').replace(/[^+\d]/g, '')).filter(Boolean))];
  const tokenRows = await PushToken.findTokensForAudience(critical ? {} : { audience_type, audience_barangays });
  const tokens = [...new Set(tokenRows.map(t => t.token).filter(Boolean))];
  for (const [channel, recipients, size] of [['sms', phones, 50], ['push', tokens, 500]]) {
    for (let i = 0; i < recipients.length; i += size) {
      const now = new Date().toISOString();
      await db.query('INSERT INTO broadcast_jobs (hazard_id, advisory_id, channel, payload, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [hazard_id, advisory_id, channel, JSON.stringify({ recipients: recipients.slice(i, i + size), title, message }), now, now]);
    }
  }
}
let running = false;
async function dispatch() {
  if (running) return;
  running = true;
  try {
    // New alerts take priority; rotate blocked/retry batches by their last
    // attempt so an unavailable channel cannot starve later ready work.
    const jobs = await db.query("SELECT * FROM broadcast_jobs WHERE status IN ('pending', 'blocked', 'retry') AND attempts < 5 ORDER BY CASE WHEN status = 'pending' THEN 0 ELSE 1 END, updated_at, id LIMIT 20");
    // Bounded parallelism across batches; no full-population blocking loop.
    for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(async job => {
      const payload = JSON.parse(job.payload);
      const configured = job.channel === 'sms'
        ? await textbee.getEffectiveConfig().then(c => !!(c.apiKey && c.deviceId)) : fcm.isConfigured();
      if (!configured) {
        await db.query("UPDATE broadcast_jobs SET status = 'blocked', last_error = ?, updated_at = ? WHERE id = ?",
          ['Provider credentials are not configured.', new Date().toISOString(), job.id]);
        return;
      }
      const claim = await db.query("UPDATE broadcast_jobs SET status = 'sending', attempts = attempts + 1, updated_at = ? WHERE id = ? AND status IN ('pending', 'blocked', 'retry')", [new Date().toISOString(), job.id]);
      if (!claim.affectedRows) return;
      try {
        if (job.channel === 'sms') await textbee.sendSMS(payload.recipients, payload.message);
        else {
          const result = await fcm.send(payload.recipients, { title: payload.title, body: payload.message, sound: true,
            data: { hazardId: job.hazard_id, advisoryId: job.advisory_id, kind: 'emergency_alert' } });
          if (result.retryTokens?.length) {
            // Retry only transient failures, never devices already accepted.
            payload.recipients = result.retryTokens;
            await db.query('UPDATE broadcast_jobs SET payload = ? WHERE id = ?', [JSON.stringify(payload), job.id]);
            throw new Error('Push provider reported transient failures; only failed devices will be retried.');
          }
          if (result.devOnly) throw new Error('Push provider not configured.');
          if (result.failed) {
            await db.query("UPDATE broadcast_jobs SET status = 'failed', last_error = ?, updated_at = ? WHERE id = ?", ['Some device tokens are invalid; successful devices were accepted.', new Date().toISOString(), job.id]);
            return;
          }
        }
        await db.query("UPDATE broadcast_jobs SET status = 'accepted', last_error = NULL, updated_at = ? WHERE id = ?", [new Date().toISOString(), job.id]);
      } catch (error) {
        await db.query("UPDATE broadcast_jobs SET status = ?, last_error = ?, updated_at = ? WHERE id = ?", [job.attempts >= 4 ? 'failed' : 'retry', String(error.message).slice(0, 500), new Date().toISOString(), job.id]);
      }
    }));
  } finally { running = false; }
}
function start() {
  // A crash during a provider request has ambiguous acceptance. Preserve it for
  // manual review rather than automatically duplicating an emergency blast.
  db.query("UPDATE broadcast_jobs SET status = 'uncertain', last_error = 'Worker restarted during dispatch; verify provider before retry.' WHERE status = 'sending'")
    .then(() => dispatch()).catch(error => console.error('[broadcast]', error.message));
  const timer = setInterval(() => dispatch().catch(error => console.error('[broadcast]', error.message)), 30000);
  timer.unref();
}
module.exports = { enqueue, dispatch, start };
