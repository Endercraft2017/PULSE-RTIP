/**
 * =============================================================================
 * News Controller
 * =============================================================================
 * Proxies NewsAPI requests through our backend so:
 * - API key stays hidden from the frontend
 * - CSP connect-src 'self' isn't violated
 * - Results are cached to stay within the 100 req/day free limit
 * - Articles are filtered for Morong/Rizal relevance
 *
 * Table of Contents:
 * 1. Imports & cache
 * 2. getNews - Fetch and return filtered news
 * 3. Helpers
 * =============================================================================
 */

const https = require('https');
const newsConfig = require('../config/newsapi');

/* --------------------------------------------------------------------------
 * 1. Cache
 * -------------------------------------------------------------------------- */
let _cache = { data: null, timestamp: 0 };

/* --------------------------------------------------------------------------
 * 2. getNews
 * -------------------------------------------------------------------------- */

/**
 * GET /api/news
 * Returns Philippines news filtered for Morong/Rizal relevance.
 * Results are cached for 30 minutes to conserve the 100 req/day limit.
 */
async function getNews(req, res) {
    try {
        const now = Date.now();

        // Return cached data if still fresh
        if (_cache.data && (now - _cache.timestamp) < newsConfig.cacheTtl) {
            return res.json({ success: true, data: _cache.data, cached: true });
        }

        // Check if API key is configured
        if (!newsConfig.apiKey || newsConfig.apiKey === 'YOUR_API_KEY_HERE') {
            return res.json({
                success: true,
                data: [],
                message: 'NewsAPI key not configured. Add your key in src/backend/config/newsapi.js',
            });
        }

        // Fetch from NewsAPI — Philippines top headlines + Morong/Rizal keyword search
        const [headlines, morong] = await Promise.all([
            fetchFromNewsAPI('/top-headlines', { country: 'ph', pageSize: 50 }),
            fetchFromNewsAPI('/everything', { q: '"Morong" OR "Rizal"', language: 'en', sortBy: 'publishedAt', pageSize: 30 }),
        ]);

        // Merge and deduplicate
        const allArticles = [...(headlines.articles || []), ...(morong.articles || [])];
        const seen = new Set();
        const unique = allArticles.filter(a => {
            if (!a.title || seen.has(a.title)) return false;
            seen.add(a.title);
            return true;
        });

        // Score and sort by relevance to Morong/Rizal
        const scored = unique.map(a => ({
            ...a,
            _score: computeRelevance(a),
        }));
        scored.sort((a, b) => b._score - a._score || new Date(b.publishedAt) - new Date(a.publishedAt));

        // Format for frontend
        const formatted = scored.slice(0, 20).map(a => ({
            title: a.title,
            description: a.description || '',
            source: a.source ? a.source.name : 'Unknown',
            author: a.author || a.source?.name || 'Unknown',
            url: a.url,
            image: a.urlToImage || null,
            publishedAt: a.publishedAt,
            relevance: a._score > 0 ? 'local' : 'national',
        }));

        // Cache
        _cache = { data: formatted, timestamp: now };

        res.json({ success: true, data: formatted });
    } catch (err) {
        console.error('NewsAPI error:', err.message);
        // Return cached data if available, even if stale
        if (_cache.data) {
            return res.json({ success: true, data: _cache.data, cached: true, stale: true });
        }
        res.status(500).json({ success: false, message: 'Failed to fetch news.' });
    }
}

/* --------------------------------------------------------------------------
 * 3. Helpers
 * -------------------------------------------------------------------------- */

/**
 * Makes an HTTPS GET request to NewsAPI.
 */
function fetchFromNewsAPI(endpoint, params) {
    return new Promise((resolve, reject) => {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        const url = `${newsConfig.baseUrl}${endpoint}?${query}&apiKey=${newsConfig.apiKey}`;

        https.get(url, (response) => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('Invalid JSON from NewsAPI'));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Scores an article's relevance to Morong/Rizal.
 * Higher score = more relevant.
 */
function computeRelevance(article) {
    let score = 0;
    const text = `${article.title || ''} ${article.description || ''} ${article.content || ''}`.toLowerCase();

    if (text.includes('morong')) score += 10;
    if (text.includes('rizal')) score += 5;
    if (text.includes('mdrrmo')) score += 15;
    if (text.includes('morong, rizal')) score += 10;
    if (text.includes('disaster') || text.includes('flood') || text.includes('typhoon')) score += 3;
    if (text.includes('emergency') || text.includes('evacuation')) score += 3;

    return score;
}

module.exports = { getNews };
