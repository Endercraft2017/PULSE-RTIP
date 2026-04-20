/**
 * =============================================================================
 * NewsAPI Configuration
 * =============================================================================
 * Free tier limits:
 * - 100 requests/day
 * - Works on localhost ONLY (blocked on production domains)
 * - Results delayed by ~15 min
 *
 * On production (pulse.afkcube.com), NewsAPI will fail silently.
 * GDACS disaster alerts work everywhere — no key, no restrictions.
 * =============================================================================
 */

module.exports = {
    apiKey: process.env.NEWSAPI_KEY || '2b384c53021f4ca48d63deec9b2ab1f0',
    baseUrl: 'https://newsapi.org/v2',
    /** Cache TTL in milliseconds (30 min — saves API calls) */
    cacheTtl: 30 * 60 * 1000,
};
