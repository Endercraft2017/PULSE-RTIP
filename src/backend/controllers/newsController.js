/**
 * =============================================================================
 * News & Disaster Controller
 * =============================================================================
 * Two data sources:
 * 1. GDACS (Global Disaster Awareness) — free RSS, no key needed.
 *    Fetches global disaster alerts and filters for Philippines / nearby.
 * 2. NewsAPI — requires free key (100 req/day, localhost only).
 *    Philippines headlines + "Morong OR Rizal" keyword search.
 *
 * Table of Contents:
 * 1. Imports & config
 * 2. getNews          — combined news + disaster feed
 * 3. GDACS fetcher    — parses RSS XML
 * 4. NewsAPI fetcher  — proxies JSON API
 * 5. Helpers
 * =============================================================================
 */

const https = require('https');
const http = require('http');
const newsConfig = require('../config/newsapi');

/* --------------------------------------------------------------------------
 * 1. Cache & constants
 * -------------------------------------------------------------------------- */
const MORONG_LAT = 14.5131;
const MORONG_LNG = 121.2365;
const PROXIMITY_KM = 800; // Show disasters within 800km of Morong

let _newsCache  = { data: null, ts: 0 };
let _gdacsCache = { data: null, ts: 0 };
const CACHE_TTL = 30 * 60 * 1000; // 30 min

/* --------------------------------------------------------------------------
 * 2. getNews — combined endpoint
 * -------------------------------------------------------------------------- */
async function getNews(req, res) {
    try {
        const [disasters, news] = await Promise.all([
            fetchGDACS(),
            fetchNewsAPI(),
        ]);

        res.json({
            success: true,
            data: {
                disasters,
                news,
            },
        });
    } catch (err) {
        console.error('News fetch error:', err.message);
        res.json({
            success: true,
            data: {
                disasters: _gdacsCache.data || [],
                news: _newsCache.data || [],
            },
            stale: true,
        });
    }
}

/* --------------------------------------------------------------------------
 * 3. GDACS RSS Fetcher
 * -------------------------------------------------------------------------- */
async function fetchGDACS() {
    const now = Date.now();
    if (_gdacsCache.data && (now - _gdacsCache.ts) < CACHE_TTL) {
        return _gdacsCache.data;
    }

    const xml = await httpGet('https://www.gdacs.org/xml/rss.xml');

    // Simple XML parsing for RSS items (no dependency needed)
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const get = (tag) => {
            const m = block.match(new RegExp('<' + tag + '[^>]*>([^<]*)</' + tag + '>'));
            return m ? m[1].trim() : '';
        };
        const getAttr = (tag, attr) => {
            const m = block.match(new RegExp('<' + tag + '[^>]*' + attr + '="([^"]*)"'));
            return m ? m[1].trim() : '';
        };

        const country = get('gdacs:country');
        const lat = parseFloat(get('geo:lat'));
        const lng = parseFloat(get('geo:long'));
        const eventType = get('gdacs:eventtype');
        const alertLevel = get('gdacs:alertlevel');

        // Filter: Philippines by country name, ISO code, or proximity to Morong
        const isPH = country.toLowerCase().includes('philippines') ||
                      get('gdacs:iso3') === 'PHL';
        const isNearby = !isNaN(lat) && !isNaN(lng) && haversineKm(MORONG_LAT, MORONG_LNG, lat, lng) <= PROXIMITY_KM;

        if (!isPH && !isNearby) continue;

        const typeMap = { EQ: 'Earthquake', TC: 'Tropical Cyclone', FL: 'Flood', DR: 'Drought', WF: 'Wildfire', VO: 'Volcano', TS: 'Tsunami' };

        items.push({
            id: 'gdacs-' + get('gdacs:eventid'),
            title: get('title'),
            description: get('description'),
            type: typeMap[eventType] || eventType,
            alertLevel: alertLevel,
            severity: getAttr('gdacs:severity', 'value'),
            severityText: get('gdacs:severity'),
            population: get('gdacs:population'),
            country: country,
            lat: lat,
            lng: lng,
            distanceKm: !isNaN(lat) ? Math.round(haversineKm(MORONG_LAT, MORONG_LNG, lat, lng)) : null,
            url: get('link'),
            publishedAt: get('pubDate'),
            fromDate: get('gdacs:fromdate'),
            toDate: get('gdacs:todate'),
            isCurrent: get('gdacs:iscurrent') === 'true',
            icon: get('gdacs:icon'),
            source: 'GDACS',
        });
    }

    // Sort: closest first, then by alert level
    const levelOrder = { Red: 0, Orange: 1, Green: 2 };
    items.sort((a, b) => {
        const la = levelOrder[a.alertLevel] ?? 3;
        const lb = levelOrder[b.alertLevel] ?? 3;
        if (la !== lb) return la - lb;
        return (a.distanceKm || 9999) - (b.distanceKm || 9999);
    });

    _gdacsCache = { data: items, ts: now };
    return items;
}

/* --------------------------------------------------------------------------
 * 4. NewsAPI Fetcher
 * -------------------------------------------------------------------------- */
async function fetchNewsAPI() {
    const now = Date.now();
    if (_newsCache.data && (now - _newsCache.ts) < CACHE_TTL) {
        return _newsCache.data;
    }

    if (!newsConfig.apiKey || newsConfig.apiKey === 'YOUR_API_KEY_HERE') {
        return [];
    }

    try {
        // PH disaster/calamity coverage with images. /top-headlines?country=ph
        // returns 0 results on the free tier, so we pivot to /everything with
        // explicit calamity keywords scoped to the Philippines, and keep a
        // local-relevance pass for Morong/Rizal.
        const phDisasterQuery = '(Philippines OR Filipino OR Manila OR Luzon OR Visayas OR Mindanao) AND ' +
            '(typhoon OR bagyo OR storm OR flood OR baha OR earthquake OR lindol OR landslide OR ' +
            'volcano OR eruption OR tsunami OR fire OR sunog OR disaster OR calamity OR rescue OR ' +
            'evacuation OR PAGASA OR PHIVOLCS OR NDRRMC OR MDRRMO)';

        const [phDisasters, morong, phHeadlines] = await Promise.all([
            fetchFromNewsAPI('/everything', { q: phDisasterQuery, language: 'en', sortBy: 'publishedAt', pageSize: 50 }),
            fetchFromNewsAPI('/everything', { q: '"Morong" OR "Rizal"', language: 'en', sortBy: 'publishedAt', pageSize: 20 }),
            fetchFromNewsAPI('/top-headlines', { country: 'ph', pageSize: 30 }),
        ]);

        const allArticles = [
            ...(phDisasters.articles || []),
            ...(morong.articles || []),
            ...(phHeadlines.articles || []),
        ];
        const seen = new Set();
        const unique = allArticles.filter(a => {
            if (!a.title || seen.has(a.title)) return false;
            // Drop "[Removed]" placeholder rows NewsAPI returns for purged articles.
            if (a.title === '[Removed]' || a.source?.name === '[Removed]') return false;
            seen.add(a.title);
            return true;
        });

        // Require an image so the news cards in the app aren't empty rectangles.
        // Also require Philippine context — NewsAPI's relevance is loose, so an
        // article about a typhoon hitting Japan or a US drill in Asia will hit
        // disaster keywords without being PH news. We anchor on PH explicitly.
        const phWords = ['philippines', 'philippine', 'filipino', 'pinoy', 'manila',
            'luzon', 'visayas', 'mindanao', 'cebu', 'davao', 'baguio', 'rizal',
            'morong', 'pagasa', 'phivolcs', 'ndrrmc', 'mdrrmc', 'mdrrmo'];
        const isPhContext = (a) => {
            const t = `${a.title || ''} ${a.description || ''}`.toLowerCase();
            return phWords.some(w => t.includes(w));
        };
        const phPool = unique.filter(a => a.urlToImage && isPhContext(a));

        const scored = phPool.map(a => ({ ...a, _score: computeRelevance(a) }));
        scored.sort((a, b) => b._score - a._score || new Date(b.publishedAt) - new Date(a.publishedAt));

        const formatted = scored.slice(0, 30).map(a => ({
            title: a.title,
            description: a.description || '',
            source: a.source ? a.source.name : 'Unknown',
            url: a.url,
            image: a.urlToImage || null,
            publishedAt: a.publishedAt,
            // local = Morong/Rizal/MDRRMO; disaster = PH calamity/risk;
            // national = generic PH coverage with no disaster keyword.
            relevance: a._score >= 12 ? 'local' : (a._score >= 6 ? 'disaster' : 'national'),
        }));

        _newsCache = { data: formatted, ts: now };
        return formatted;
    } catch (err) {
        console.error('NewsAPI error:', err.message);
        return _newsCache.data || [];
    }
}

function fetchFromNewsAPI(endpoint, params) {
    return new Promise((resolve, reject) => {
        const query = Object.entries(params)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');
        const fullUrl = `${newsConfig.baseUrl}${endpoint}?${query}&apiKey=${newsConfig.apiKey}`;
        const parsed = new URL(fullUrl);

        const options = {
            hostname: parsed.hostname,
            path: parsed.pathname + parsed.search,
            headers: { 'User-Agent': 'PULSE-RTIP/1.0 (MDRRMO Morong Rizal)' },
        };

        https.get(options, (response) => {
            let body = '';
            response.on('data', chunk => body += chunk);
            response.on('end', () => {
                try { resolve(JSON.parse(body)); }
                catch (e) { reject(new Error('Invalid JSON from NewsAPI')); }
            });
        }).on('error', reject);
    });
}

/* --------------------------------------------------------------------------
 * 5. Helpers
 * -------------------------------------------------------------------------- */
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const mod = url.startsWith('https') ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'PULSE-RTIP/1.0' } }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeRelevance(article) {
    let score = 0;
    const text = `${article.title || ''} ${article.description || ''}`.toLowerCase();

    // Hyper-local — Morong/Rizal/MDRRMO.
    if (text.includes('morong')) score += 12;
    if (text.includes('rizal')) score += 6;
    if (text.includes('mdrrmo')) score += 15;

    // Disaster / calamity signals — these float PH disaster news above generic
    // headlines so the feed actually feels like a calamity board.
    const disasterTerms = [
        'typhoon', 'bagyo', 'storm', 'flood', 'baha', 'earthquake', 'lindol',
        'landslide', 'volcano', 'eruption', 'tsunami', 'fire', 'sunog',
        'disaster', 'calamity', 'rescue', 'evacuation', 'pagasa', 'phivolcs',
        'ndrrmc', 'mdrrmc', 'state of calamity'
    ];
    let disasterHits = 0;
    for (const term of disasterTerms) {
        if (text.includes(term)) disasterHits += 1;
    }
    if (disasterHits > 0) score += 3 + Math.min(disasterHits, 4);

    // Philippine context boost — anchors disaster keywords to PH instead of
    // any global story that mentioned a typhoon elsewhere.
    if (text.includes('philippines') || text.includes('filipino') ||
        text.includes('manila') || text.includes('luzon') ||
        text.includes('visayas') || text.includes('mindanao')) {
        score += 2;
    }

    return score;
}

module.exports = { getNews };
