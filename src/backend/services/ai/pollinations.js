/**
 * =============================================================================
 * Pollinations.ai Image Generator
 * =============================================================================
 *
 * Table of Contents:
 * 1. Config
 * 2. buildPrompt           — assembles a short, safe prompt under 200 chars
 * 3. generateIncidentImage — async({type, location, title}) -> public path|null
 * 4. _fetchToFile          — internal: stream Pollinations bytes to disk
 *
 * Uses the free Pollinations.ai endpoint (no API key, no signup):
 *   https://image.pollinations.ai/prompt/<encoded>?width=1024&height=576
 *     &nologo=true&safe=true
 *
 * Best-effort: every failure (timeout, non-200, network, disk) resolves to
 * null so the caller — usually promoteReportToPost — can continue without
 * an illustrative image. Callers should treat this as decorative metadata.
 * =============================================================================
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let config;
try {
  config = require('../../config');
} catch (_) {
  config = null;
}

/* --------------------------------------------------------------------------
 * 1. Config
 * -------------------------------------------------------------------------- */

const TIMEOUT_MS = 30000;
const WIDTH = 1024;
const HEIGHT = 576;
const MAX_PROMPT_CHARS = 200;
const MAX_REDIRECTS = 3;

const UPLOAD_DIR =
  (config && config.upload && config.upload.dir)
    ? config.upload.dir
    : path.resolve(__dirname, '../../../../uploads');

/* --------------------------------------------------------------------------
 * 2. buildPrompt
 * -------------------------------------------------------------------------- */

/**
 * Builds a short, descriptive, safe prompt. We deliberately keep it tight
 * because the prompt is URL-encoded into the path component — long prompts
 * with weird characters can cause 414s or odd Pollinations behavior.
 */
function buildPrompt({ type, location, title }) {
  const incident = (type || title || 'emergency incident').toString().trim();
  const where = (location || 'the community').toString().trim();
  let prompt = `${incident} emergency response in ${where}, photojournalism style, news photo, realistic`;
  if (prompt.length > MAX_PROMPT_CHARS) {
    prompt = prompt.slice(0, MAX_PROMPT_CHARS);
  }
  return prompt;
}

/* --------------------------------------------------------------------------
 * 4. _fetchToFile (internal)
 * -------------------------------------------------------------------------- */

/**
 * GETs `url` and streams the response bytes into `destPath`. Resolves true
 * on a 2xx that successfully wrote bytes; resolves false otherwise. Follows
 * up to MAX_REDIRECTS HTTP redirects (Pollinations sometimes 302s through
 * a CDN).
 */
function _fetchToFile(url, destPath, redirectsLeft = MAX_REDIRECTS) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    let req;
    try {
      req = https.get(url, { timeout: TIMEOUT_MS }, (res) => {
        // Follow redirects without consuming the body.
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location &&
          redirectsLeft > 0
        ) {
          res.resume(); // drain
          const next = new URL(res.headers.location, url).toString();
          _fetchToFile(next, destPath, redirectsLeft - 1).then(finish);
          return;
        }

        if (res.statusCode !== 200) {
          res.resume();
          return finish(false);
        }

        const file = fs.createWriteStream(destPath);
        let bytes = 0;
        res.on('data', (chunk) => { bytes += chunk.length; });
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => finish(bytes > 0));
        });
        file.on('error', () => {
          try { fs.unlinkSync(destPath); } catch (_) {}
          finish(false);
        });
        res.on('error', () => {
          try { fs.unlinkSync(destPath); } catch (_) {}
          finish(false);
        });
      });
    } catch (_) {
      return finish(false);
    }

    req.on('error', () => finish(false));
    req.on('timeout', () => {
      try { req.destroy(); } catch (_) {}
      finish(false);
    });
  });
}

/* --------------------------------------------------------------------------
 * 3. generateIncidentImage
 * -------------------------------------------------------------------------- */

/**
 * Generates an illustrative image for a promoted report and stores it in
 * the upload directory. Returns the public URL (e.g.
 * "/uploads/ai-1714510000000-ab12cd.jpg") or null if anything went wrong.
 *
 * @param {Object}  args
 * @param {string} [args.type]     Incident type (e.g. "fire", "flood")
 * @param {string} [args.location] Human-readable location string
 * @param {string} [args.title]    Report title — fallback when type is empty
 * @returns {Promise<string|null>}
 */
async function generateIncidentImage({ type, location, title } = {}) {
  try {
    // Make sure the upload dir exists — first run on a fresh server
    // wouldn't have it.
    try {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    } catch (_) {
      // mkdirSync with recursive should be idempotent; swallow anyway.
    }

    const prompt = buildPrompt({ type, location, title });
    const encoded = encodeURIComponent(prompt);
    const url =
      `https://image.pollinations.ai/prompt/${encoded}` +
      `?width=${WIDTH}&height=${HEIGHT}&nologo=true&safe=true`;

    const stamp = Date.now();
    const rand = crypto.randomBytes(4).toString('hex');
    const filename = `ai-${stamp}-${rand}.jpg`;
    const destPath = path.join(UPLOAD_DIR, filename);

    const ok = await _fetchToFile(url, destPath);
    if (!ok) {
      try { fs.unlinkSync(destPath); } catch (_) {}
      return null;
    }
    return `/uploads/${filename}`;
  } catch (err) {
    // Defensive: never let this throw to the caller.
    try { console.warn('[pollinations] generateIncidentImage failed:', err && err.message); } catch (_) {}
    return null;
  }
}

module.exports = { generateIncidentImage, buildPrompt };
