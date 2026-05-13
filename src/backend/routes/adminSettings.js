/**
 * =============================================================================
 * Admin Settings Routes — Runtime App Configuration
 * =============================================================================
 *
 * Mounted under /api/admin/settings. All routes require admin auth.
 *
 *   GET  /sms           - Current effective TextBee creds (api key masked)
 *   PUT  /sms           - Upsert a subset of TextBee creds, returns masked view
 *   POST /sms/test      - Send a test SMS using the current effective creds
 *
 * The DB-backed app_settings table overrides .env at runtime so admins can
 * rotate the TextBee gateway credentials without restarting the server.
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const config = require('../config');
const AppSetting = require('../models/AppSetting');
const textbee = require('../services/sms/textbee');
const { logAction } = require('../middleware/auditLog');

const router = Router();

/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

const TEXTBEE_KEYS = [
    'textbee_api_key',
    'textbee_device_id',
    'textbee_api_url',
    'textbee_gateway_phone',
];

/**
 * Masks a sensitive string for list-view display. Keeps the last 5 chars
 * visible so admins can still distinguish which key is active; shows "not
 * set" when empty.
 */
function maskKey(value) {
    if (!value) return '';
    const tail = value.slice(-5);
    return '••••••' + tail;
}

/**
 * Builds the response payload: full values for non-sensitive fields, masked
 * api key, plus a per-field `source` indicating whether the value came from
 * the DB (admin-edited) or from env.
 */
async function buildSmsView() {
    const overrides = await AppSetting.getMany(TEXTBEE_KEYS);
    const envCfg = config.textbee;

    const pick = (dbKey, envVal) => ({
        value: overrides[dbKey] || envVal || '',
        source: overrides[dbKey] ? 'db' : (envVal ? 'env' : 'unset'),
    });

    const apiKey       = pick('textbee_api_key',       envCfg.apiKey);
    const deviceId     = pick('textbee_device_id',     envCfg.deviceId);
    const apiUrl       = pick('textbee_api_url',       envCfg.apiUrl);
    const gatewayPhone = pick('textbee_gateway_phone', envCfg.gatewayPhone);

    return {
        apiKey: {
            value: maskKey(apiKey.value),
            hasValue: !!apiKey.value,
            source: apiKey.source,
        },
        deviceId:     { value: deviceId.value,     source: deviceId.source },
        apiUrl:       { value: apiUrl.value,       source: apiUrl.source },
        gatewayPhone: { value: gatewayPhone.value, source: gatewayPhone.source },
    };
}

/* --------------------------------------------------------------------------
 * GET /api/admin/settings/sms
 * -------------------------------------------------------------------------- */

router.get('/sms', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const view = await buildSmsView();
        res.json({ success: true, data: view });
    } catch (err) {
        next(err);
    }
});

/* --------------------------------------------------------------------------
 * PUT /api/admin/settings/sms
 * -------------------------------------------------------------------------- */

router.put('/sms', authenticate, requireAdmin, async (req, res, next) => {
    try {
        const { apiKey, deviceId, apiUrl, gatewayPhone } = req.body || {};
        const userId = req.user && req.user.id;

        // Only upsert fields explicitly present in the body. An empty string
        // clears the DB override (stored as '' → get() returns null → env
        // fallback kicks in). `undefined` means "don't touch".
        const pairs = [
            ['textbee_api_key',       apiKey],
            ['textbee_device_id',     deviceId],
            ['textbee_api_url',       apiUrl],
            ['textbee_gateway_phone', gatewayPhone],
        ];

        const changed = [];
        for (const [key, val] of pairs) {
            if (val === undefined) continue;
            await AppSetting.set(key, val == null ? '' : String(val), userId);
            changed.push(key);
        }

        // Drop the in-memory cache so the next textbee call picks up edits.
        textbee.invalidateCache();

        if (changed.length && userId) {
            // Never log the secret value — just the field names that moved.
            logAction(userId, 'sms_settings_updated', 'app_setting', null, { fields: changed });
        }

        const view = await buildSmsView();
        res.json({ success: true, message: 'SMS gateway settings updated.', data: view });
    } catch (err) {
        next(err);
    }
});

/* --------------------------------------------------------------------------
 * POST /api/admin/settings/sms/test
 * -------------------------------------------------------------------------- */

router.post('/sms/test', authenticate, requireAdmin, async (req, res) => {
    const phone = (req.body && req.body.phone ? String(req.body.phone) : '').trim();
    if (!phone) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    try {
        // Ensure we use the freshest creds (in case the admin just saved).
        textbee.invalidateCache();
        const result = await textbee.sendSMS(phone, 'PULSE 911 admin test ✓');
        res.json({
            success: true,
            message: `Test SMS dispatched to ${phone}.`,
            data: result,
        });
    } catch (err) {
        if (err.isRateLimit) {
            const q = err.quota;
            const isQuota = q && q.hasReachedLimit;
            return res.status(429).json({
                success: false,
                code: isQuota ? 'SMS_QUOTA_EXCEEDED' : 'SMS_RATE_LIMITED',
                message: isQuota
                    ? `TextBee daily SMS limit reached (${q.dailyRemaining}/${q.dailyLimit} today, ${q.monthlyRemaining}/${q.monthlyLimit} this month). Resets at 00:00 UTC.`
                    : 'TextBee gateway is rate-limited right now. Wait ~1 minute and try again.',
                ...(q ? { quota: q } : {}),
            });
        }
        const reason = err.message || 'Unknown error';
        res.status(502).json({
            success: false,
            code: 'SMS_GATEWAY_ERROR',
            message: `Test SMS failed: ${reason}`,
        });
    }
});

module.exports = router;
