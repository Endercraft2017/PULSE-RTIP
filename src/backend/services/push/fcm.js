/**
 * =============================================================================
 * FCM Push Service
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports & lazy SDK init
 * 2. isConfigured - Whether a service-account JSON is loadable
 * 3. send         - Multicast a notification payload to device tokens
 *
 * Uses the modern Firebase Cloud Messaging HTTP v1 API via the official
 * firebase-admin SDK. Legacy server keys are no longer issued for new
 * projects — only service-account credentials work now.
 *
 * Configuration:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=/opt/PULSE-RTIP/secrets/firebase-service-account.json
 *
 *   (The owner downloads this JSON from Firebase Console → Project Settings
 *    → Service accounts → Generate new private key. Place it OUTSIDE the
 *    repo and point the env var at it. NEVER commit it.)
 *
 * Without the credentials file, calls fall through to a dev-mode console
 * log so the broadcast pipeline runs end-to-end without push delivery.
 * =============================================================================
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../config/database');

let _admin = null;        // The firebase-admin SDK module (lazy required)
let _initialized = false; // Whether admin.initializeApp() has run successfully
let _initFailed = false;  // Cache failure so we don't retry on every call

function loadServiceAccount() {
  const p = config.push.serviceAccountPath;
  if (!p) return null;
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) {
    console.warn('[push] service account file not found at', abs);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error('[push] failed to parse service account JSON:', err.message);
    return null;
  }
}

function ensureInit() {
  if (_initialized || _initFailed) return _initialized;
  const creds = loadServiceAccount();
  if (!creds) {
    _initFailed = true;
    return false;
  }
  try {
    _admin = require('firebase-admin');
    if (_admin.apps.length === 0) {
      _admin.initializeApp({ credential: _admin.credential.cert(creds) });
    }
    _initialized = true;
    return true;
  } catch (err) {
    console.error('[push] firebase-admin init failed:', err.message);
    _initFailed = true;
    return false;
  }
}

/* --------------------------------------------------------------------------
 * 2. isConfigured
 * -------------------------------------------------------------------------- */

function isConfigured() {
  // Don't actually init here — just check whether the credentials file is
  // present and parseable. Saves a costly require() on every check.
  if (_initialized) return true;
  if (_initFailed) return false;
  return !!loadServiceAccount();
}

/* --------------------------------------------------------------------------
 * 3. send
 * -------------------------------------------------------------------------- */

/**
 * Sends a notification to an array of FCM registration tokens.
 * Uses sendEachForMulticast (HTTP v1 multicast) which handles up to 500
 * tokens per call. Larger batches are chunked.
 *
 * @param {string[]} tokens
 * @param {object}   opts
 * @param {string}   opts.title
 * @param {string}   opts.body
 * @param {object}   [opts.data]   Arbitrary key/value data payload (string-only values)
 * @param {boolean}  [opts.sound]  When true, sets sound='default' on the notification
 * @returns {Promise<{success: boolean, devOnly?: boolean, sent?: number, failed?: number}>}
 */
async function send(tokens, { title, body, data, sound } = {}) {
  const list = Array.isArray(tokens) ? tokens.filter(Boolean) : [];
  if (list.length === 0) return { success: true, sent: 0 };

  if (!ensureInit()) {
    // Loud, unambiguous: a future operator scanning pm2 logs needs to know
    // immediately why pushes aren't going out. The two failure modes are:
    //   (a) FIREBASE_SERVICE_ACCOUNT_PATH not set in env, or
    //   (b) the path is set but the JSON is missing/unparseable.
    // loadServiceAccount() already prints details for (b); here we summarise.
    const hint = config.push.serviceAccountPath
      ? `path=${config.push.serviceAccountPath} (file unreadable or invalid — see earlier [push] warnings)`
      : 'FIREBASE_SERVICE_ACCOUNT_PATH env var is not set';
    console.warn(`[push:dev] FCM NOT CONFIGURED — ${hint}. Skipping send to ${list.length} device(s). title="${title}"`);
    return { success: true, devOnly: true, sent: 0, skipped: list.length };
  }

  // FCM data payload values must be strings.
  const stringData = {};
  if (data) {
    for (const [k, v] of Object.entries(data)) {
      if (v == null) continue;
      stringData[k] = String(v);
    }
  }

  const BATCH = 500; // FCM v1 multicast cap
  let sent = 0;
  let failed = 0;
  let batches = 0;
  // Tokens FCM tells us are dead — we prune these from the DB so future
  // broadcasts skip them. Without this, every reinstall / app-data-clear
  // leaves an orphaned token that fails forever.
  const deadTokens = [];
  const DEAD_CODES = new Set([
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
    'messaging/mismatched-credential',
  ]);
  const messaging = _admin.messaging();

  for (let i = 0; i < list.length; i += BATCH) {
    batches += 1;
    const batch = list.slice(i, i + BATCH);
    try {
      const res = await messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title, body },
        data: stringData,
        android: {
          priority: 'high',
          notification: {
            sound: sound ? 'default' : undefined,
            channelId: 'pulse-911-alerts',
          },
        },
      });
      sent += res.successCount;
      failed += res.failureCount;
      res.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code || '';
        if (DEAD_CODES.has(code)) {
          deadTokens.push(batch[idx]);
        }
        if (idx < 3) {
          console.warn('[push] token', batch[idx].slice(0, 16) + '...', 'failed:', r.error?.message, code);
        }
      });
    } catch (err) {
      console.error('[push] batch failed:', err.message);
      failed += batch.length;
    }
  }

  // Best-effort prune of dead tokens — never fails the dispatch.
  if (deadTokens.length > 0) {
    try {
      const placeholders = deadTokens.map(() => '?').join(',');
      await db.query(`DELETE FROM push_tokens WHERE token IN (${placeholders})`, deadTokens);
      console.log(`[push] pruned ${deadTokens.length} dead token(s) from DB`);
    } catch (pruneErr) {
      console.error('[push] dead-token prune failed:', pruneErr.message);
    }
  }

  console.log(`[push] FCM dispatch: sent=${sent} failed=${failed} batches=${batches} total=${list.length}`);
  return { success: failed === 0, sent, failed, batches, pruned: deadTokens.length };
}

module.exports = { send, isConfigured };
