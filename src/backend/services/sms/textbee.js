/**
 * =============================================================================
 * TextBee SMS Service
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports & effective-config resolver
 * 2. isConfigured  - Check if TextBee credentials are set (sync)
 * 3. sendSMS       - Send an SMS to one or more recipients
 * 4. sendBulkSMS   - Send the same message to many recipients
 * 5. getReceived   - Fetch received SMS messages
 * 6. getStatus     - Check if the gateway device is reachable
 *
 * Thin wrapper around the TextBee REST API.
 * Docs: https://api.textbee.dev
 *
 * Credentials resolve at call-time from the app_settings table first, then
 * fall back to .env. This lets admins rotate keys via the Settings UI
 * without a server restart. A small in-memory cache of the DB values keeps
 * `isConfigured()` synchronous (existing callers aren't async).
 * =============================================================================
 */

const axios = require('axios');
const config = require('../../config');
const AppSetting = require('../../models/AppSetting');

/* --------------------------------------------------------------------------
 * 1. Effective config + HTTP client
 * -------------------------------------------------------------------------- */

// Cached DB overrides so sync callers (isConfigured) can see current values
// without awaiting. Invalidated by invalidateCache() whenever the admin saves
// the settings form.
let _dbCache = null;

async function loadDbCache() {
    _dbCache = await AppSetting.getMany([
        'textbee_api_key',
        'textbee_device_id',
        'textbee_api_url',
        'textbee_gateway_phone',
    ]);
    return _dbCache;
}

/**
 * Drops the cached DB overrides. Call after writing app_settings so the next
 * getEffectiveConfig() / isConfigured() sees fresh values.
 */
function invalidateCache() {
    _dbCache = null;
}

/**
 * Resolves the currently-effective TextBee credentials. DB values (from the
 * app_settings table) take precedence; any field left unset in the DB falls
 * back to the env-loaded config. Always await this for send-time calls so
 * edits apply immediately.
 *
 * @returns {Promise<{apiKey:string, deviceId:string, apiUrl:string, gatewayPhone:string}>}
 */
async function getEffectiveConfig() {
    const overrides = _dbCache || (await loadDbCache());
    return {
        apiKey:       overrides.textbee_api_key       || config.textbee.apiKey       || '',
        deviceId:     overrides.textbee_device_id     || config.textbee.deviceId     || '',
        apiUrl:       overrides.textbee_api_url       || config.textbee.apiUrl       || 'https://api.textbee.dev/api/v1',
        gatewayPhone: overrides.textbee_gateway_phone || config.textbee.gatewayPhone || '',
    };
}

function buildClient(cfg) {
    return axios.create({
        baseURL: cfg.apiUrl,
        headers: { 'x-api-key': cfg.apiKey },
        timeout: 15000,
    });
}

function deviceUrl(cfg, path = '') {
    return `/gateway/devices/${cfg.deviceId}${path}`;
}

/* --------------------------------------------------------------------------
 * 2. isConfigured
 * -------------------------------------------------------------------------- */

/**
 * Synchronous check: returns true when both API key and device ID are
 * present in the current effective config. Uses the cached DB overrides
 * (populated on first send/status call); falls back to env-only until then
 * so existing sync callers keep their contract. For the authoritative
 * check, await getEffectiveConfig().
 */
function isConfigured() {
    const apiKey   = (_dbCache && _dbCache.textbee_api_key)   || config.textbee.apiKey;
    const deviceId = (_dbCache && _dbCache.textbee_device_id) || config.textbee.deviceId;
    return !!(apiKey && deviceId);
}

/* --------------------------------------------------------------------------
 * 3. sendSMS
 * -------------------------------------------------------------------------- */

/**
 * Wraps an axios error into a more descriptive Error with:
 *   - err.upstreamStatus  (HTTP status from TextBee, if any)
 *   - err.isRateLimit     (true if TextBee returned 429)
 *   - err.isGatewayError  (true for 5xx upstream)
 * so callers can branch without re-parsing axios internals.
 */
function tagSmsError(err) {
    const upstreamStatus = err.response?.status;
    const upstreamBody = err.response?.data || {};
    const upstreamMessage = upstreamBody.message || err.message;
    const tagged = new Error(`TextBee: ${upstreamMessage}`);
    tagged.upstreamStatus = upstreamStatus;
    tagged.isRateLimit = upstreamStatus === 429;
    tagged.isGatewayError = upstreamStatus >= 500 && upstreamStatus < 600;
    // TextBee returns these fields on its 429 response when the daily/monthly
    // quota is blown — preserve them so the admin UI can show the exact
    // remaining balance instead of a generic "try again later".
    if (upstreamBody.hasReachedLimit !== undefined) {
        tagged.quota = {
            hasReachedLimit: upstreamBody.hasReachedLimit,
            dailyLimit: upstreamBody.dailyLimit,
            dailyRemaining: upstreamBody.dailyRemaining,
            monthlyLimit: upstreamBody.monthlyLimit,
            monthlyRemaining: upstreamBody.monthlyRemaining,
            bulkSendLimit: upstreamBody.bulkSendLimit,
        };
    }
    tagged.cause = err;
    return tagged;
}

/**
 * Sends an SMS to one or more phone numbers. Fails fast — callers who can
 * tolerate retries should use sendSMSWithRetry() instead.
 *
 * @param {string|string[]} recipients - Phone number(s) in E.164 or local PH format
 * @param {string} message - Message body (max ~160 chars per SMS segment)
 * @returns {Promise<object>} TextBee API response data
 * @throws {Error} Tagged with .upstreamStatus, .isRateLimit, .isGatewayError
 */
async function sendSMS(recipients, message) {
    const cfg = await getEffectiveConfig();
    if (!(cfg.apiKey && cfg.deviceId)) {
        throw new Error('TextBee SMS is not configured. Set credentials in Admin Settings or TEXTBEE_API_KEY / TEXTBEE_DEVICE_ID in .env');
    }

    const numbers = Array.isArray(recipients) ? recipients : [recipients];

    try {
        const { data } = await buildClient(cfg).post(deviceUrl(cfg, '/send-sms'), {
            recipients: numbers,
            message,
        });
        return data;
    } catch (err) {
        throw tagSmsError(err);
    }
}

/* --------------------------------------------------------------------------
 * 3b. sendSMSWithRetry
 * -------------------------------------------------------------------------- */

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Like sendSMS() but retries with exponential backoff on 429 (rate-limit)
 * and 5xx (upstream gateway) errors. Use for background / best-effort sends
 * like approval notifications and hazard broadcasts — NOT for OTPs, whose
 * TTL means a delayed send is worse than a fast failure.
 *
 * Default policy: 3 retries, starting at 2s delay, doubling each attempt
 * (2s, 4s, 8s) — total worst-case wait ≈14s before giving up.
 *
 * @param {string|string[]} recipients
 * @param {string} message
 * @param {object} [opts]
 * @param {number} [opts.maxRetries=3]
 * @param {number} [opts.initialDelayMs=2000]
 * @returns {Promise<object>} TextBee API response data from whichever attempt succeeded
 * @throws The final tagged error if all attempts fail
 */
async function sendSMSWithRetry(recipients, message, opts = {}) {
    const { maxRetries = 3, initialDelayMs = 2000 } = opts;
    let lastErr;
    let delay = initialDelayMs;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await sendSMS(recipients, message);
        } catch (err) {
            lastErr = err;
            const retriable = err.isRateLimit || err.isGatewayError;
            if (!retriable || attempt === maxRetries) throw err;
            // Back off before the next attempt. The upstream rate limiter
            // resets in the low single-digit seconds for TextBee free tier.
            await sleep(delay);
            delay *= 2;
        }
    }
    throw lastErr;
}

/* --------------------------------------------------------------------------
 * 4. sendBulkSMS
 * -------------------------------------------------------------------------- */

/**
 * Sends the same message to a large list of recipients. TextBee accepts
 * multiple recipients per call, so this is a convenience wrapper that chunks
 * into batches of 50 to stay under rate limits. Each batch retries on 429
 * via sendSMSWithRetry since bulk sends are inherently non-interactive.
 *
 * @param {string[]} recipients - Array of phone numbers
 * @param {string} message - Message body
 * @returns {Promise<object[]>} Array of API responses per batch
 */
async function sendBulkSMS(recipients, message) {
    const BATCH_SIZE = 50;
    const results = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const batch = recipients.slice(i, i + BATCH_SIZE);
        const result = await sendSMSWithRetry(batch, message);
        results.push(result);
    }

    return results;
}

/* --------------------------------------------------------------------------
 * 5. getReceived
 * -------------------------------------------------------------------------- */

/**
 * Fetches SMS messages received by the gateway device.
 *
 * @param {object} [options]
 * @param {number} [options.page=1]  - Page number
 * @param {number} [options.limit=20] - Results per page
 * @returns {Promise<object>} { data: [...messages], pagination }
 */
async function getReceived(options = {}) {
    const cfg = await getEffectiveConfig();
    if (!(cfg.apiKey && cfg.deviceId)) {
        throw new Error('TextBee SMS is not configured.');
    }

    const { page = 1, limit = 20 } = options;

    const { data } = await buildClient(cfg).get(deviceUrl(cfg, '/get-received-sms'), {
        params: { page, limit },
    });

    return data;
}

/* --------------------------------------------------------------------------
 * 6. getStatus
 * -------------------------------------------------------------------------- */

/**
 * Checks whether the TextBee gateway is configured and the device is reachable.
 *
 * @returns {Promise<object>} { configured, connected, device? }
 */
async function getStatus() {
    const cfg = await getEffectiveConfig();
    if (!(cfg.apiKey && cfg.deviceId)) {
        return { configured: false, connected: false };
    }

    try {
        const { data } = await buildClient(cfg).get(deviceUrl(cfg));
        return {
            configured: true,
            connected: true,
            device: data,
        };
    } catch (err) {
        return {
            configured: true,
            connected: false,
            error: err.response?.data?.message || err.message,
        };
    }
}

module.exports = {
    isConfigured,
    sendSMS,
    sendSMSWithRetry,
    sendBulkSMS,
    getReceived,
    getStatus,
    getEffectiveConfig,
    invalidateCache,
};
