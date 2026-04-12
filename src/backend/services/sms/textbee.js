/**
 * =============================================================================
 * TextBee SMS Service
 * =============================================================================
 *
 * Table of Contents:
 * 1. Imports & Config
 * 2. isConfigured  - Check if TextBee credentials are set
 * 3. sendSMS       - Send an SMS to one or more recipients
 * 4. sendBulkSMS   - Send the same message to many recipients
 * 5. getReceived   - Fetch received SMS messages
 * 6. getStatus     - Check if the gateway device is reachable
 *
 * Thin wrapper around the TextBee REST API.
 * Docs: https://api.textbee.dev
 * =============================================================================
 */

const axios = require('axios');
const config = require('../../config');

/* --------------------------------------------------------------------------
 * 1. HTTP client setup
 * -------------------------------------------------------------------------- */

function getClient() {
  return axios.create({
    baseURL: config.textbee.apiUrl,
    headers: { 'x-api-key': config.textbee.apiKey },
    timeout: 15000,
  });
}

function deviceUrl(path = '') {
  return `/gateway/devices/${config.textbee.deviceId}${path}`;
}

/* --------------------------------------------------------------------------
 * 2. isConfigured
 * -------------------------------------------------------------------------- */

/**
 * Returns true when both API key and device ID are present.
 * Call this before attempting to send so the app degrades gracefully
 * when TextBee is not set up yet.
 */
function isConfigured() {
  return !!(config.textbee.apiKey && config.textbee.deviceId);
}

/* --------------------------------------------------------------------------
 * 3. sendSMS
 * -------------------------------------------------------------------------- */

/**
 * Sends an SMS to one or more phone numbers.
 *
 * @param {string|string[]} recipients - Phone number(s) in E.164 or local PH format
 * @param {string} message - Message body (max ~160 chars per SMS segment)
 * @returns {Promise<object>} TextBee API response data
 */
async function sendSMS(recipients, message) {
  if (!isConfigured()) {
    throw new Error('TextBee SMS is not configured. Set TEXTBEE_API_KEY and TEXTBEE_DEVICE_ID in .env');
  }

  const numbers = Array.isArray(recipients) ? recipients : [recipients];

  const { data } = await getClient().post(deviceUrl('/send-sms'), {
    recipients: numbers,
    message,
  });

  return data;
}

/* --------------------------------------------------------------------------
 * 4. sendBulkSMS
 * -------------------------------------------------------------------------- */

/**
 * Sends the same message to a large list of recipients.
 * TextBee accepts multiple recipients per call, so this is a convenience
 * wrapper that chunks into batches of 50 to stay under rate limits.
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
    const result = await sendSMS(batch, message);
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
  if (!isConfigured()) {
    throw new Error('TextBee SMS is not configured.');
  }

  const { page = 1, limit = 20 } = options;

  const { data } = await getClient().get(deviceUrl('/get-received-sms'), {
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
  if (!isConfigured()) {
    return { configured: false, connected: false };
  }

  try {
    const { data } = await getClient().get(deviceUrl());
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

module.exports = { isConfigured, sendSMS, sendBulkSMS, getReceived, getStatus };
