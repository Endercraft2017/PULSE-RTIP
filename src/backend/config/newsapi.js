/**
 * =============================================================================
 * NewsAPI Configuration
 * =============================================================================
 * Paste your free NewsAPI key below.
 * Get one at: https://newsapi.org/register
 *
 * Free tier limits:
 * - 100 requests/day
 * - Works on localhost only (dev mode)
 * - Results delayed by ~15 min
 * =============================================================================
 */

module.exports = {
    apiKey: process.env.NEWSAPI_KEY || '2b384c53021f4ca48d63deec9b2ab1f0',
    baseUrl: 'https://newsapi.org/v2',
    /** Cache TTL in milliseconds (30 min — saves API calls) */
    cacheTtl: 30 * 60 * 1000,
    /** Keywords to filter Philippines news for Morong/Rizal relevance */
    keywords: ['Morong', 'Rizal', 'MDRRMO', 'Morong Rizal'],
};
