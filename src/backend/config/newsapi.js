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
    apiKey: process.env.NEWSAPI_KEY || 'YOUR_API_KEY_HERE',
    baseUrl: 'https://newsapi.org/v2',
    /** Cache TTL in milliseconds (30 min — saves API calls) */
    cacheTtl: 30 * 60 * 1000,
    /** Keywords to filter Philippines news for Morong/Rizal relevance */
    keywords: ['Morong', 'Rizal', 'MDRRMO', 'Morong Rizal'],
};
