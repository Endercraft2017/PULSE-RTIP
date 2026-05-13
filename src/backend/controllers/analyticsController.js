/**
 * =============================================================================
 * Analytics Controller
 * =============================================================================
 *
 * Powers the admin Reports & Analytics dashboard (A-11). All handlers require
 * authenticate + requireAdmin at the route layer.
 *
 * Four views:
 *   1. Incidents over time (day / week / month bucketed)
 *   2. Emergency type breakdown
 *   3. Response-time performance (avg / median / p95)
 *   4. Location breakdown by barangay
 *
 * Query SQL branches on config.appMode — SQLite uses strftime(), MySQL uses
 * DATE_FORMAT() — because the server can run in either mode.
 * =============================================================================
 */

const db = require('../config/database');
const config = require('../config');

// Morong, Rizal's 11 barangays. Must match src/frontend/public/js/utils/barangays.js
// (the signup / audience-selector source of truth) — otherwise location analytics
// will bucket barangays that can't be chosen in the UI.
const MORONG_BARANGAYS = [
  'Bombongan',
  'Caingin',
  'Can-Cal-Lay',
  'Cuasay',
  'Lagundi',
  'Maybancal',
  'San Guillermo',
  'San Jose',
  'San Juan',
  'San Pedro',
  'Poblacion',
];

function isProd() {
  return config.appMode === 'production';
}

/* --------------------------------------------------------------------------
 * 1. Incidents Over Time
 * -------------------------------------------------------------------------- */

async function getIncidentsOverTime(req, res, next) {
  try {
    const granularity = ['day', 'week', 'month'].includes(req.query.granularity)
      ? req.query.granularity
      : 'day';
    const days = Math.max(1, Math.min(365, parseInt(req.query.days, 10) || 30));

    let bucketExpr;
    let sinceClause;
    const params = [];

    if (isProd()) {
      // MySQL
      if (granularity === 'day')   bucketExpr = "DATE_FORMAT(created_at, '%Y-%m-%d')";
      if (granularity === 'week')  bucketExpr = "DATE_FORMAT(created_at, '%Y-W%u')";
      if (granularity === 'month') bucketExpr = "DATE_FORMAT(created_at, '%Y-%m')";
      sinceClause = `created_at >= (NOW() - INTERVAL ${days} DAY)`;
    } else {
      // SQLite
      if (granularity === 'day')   bucketExpr = "strftime('%Y-%m-%d', created_at)";
      if (granularity === 'week')  bucketExpr = "strftime('%Y-W%W', created_at)";
      if (granularity === 'month') bucketExpr = "strftime('%Y-%m', created_at)";
      sinceClause = `created_at >= date('now', '-${days} days')`;
    }

    const sql = `
      SELECT ${bucketExpr} AS bucket, COUNT(*) AS count
      FROM reports
      WHERE ${sinceClause}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const rows = await db.query(sql, params);
    res.json({
      success: true,
      data: rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 2. Type Breakdown
 * -------------------------------------------------------------------------- */

async function getTypeBreakdown(req, res, next) {
  try {
    const rows = await db.query(
      `SELECT type, COUNT(*) AS count
       FROM reports
       GROUP BY type
       ORDER BY count DESC`
    );
    res.json({
      success: true,
      data: rows.map((r) => ({ type: r.type, count: Number(r.count) })),
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 3. Response Time
 * -------------------------------------------------------------------------- */

// No dedicated resolved_at column — updated_at on resolved rows is the closest
// proxy. Good enough for ops dashboards; swap to a real column once added.
async function getResponseTime(req, res, next) {
  try {
    let avgSql;
    let durationsSql;

    if (isProd()) {
      avgSql = `
        SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, updated_at)) / 3600.0 AS avg_hours,
               COUNT(*) AS samples
        FROM reports
        WHERE status = 'resolved' AND updated_at IS NOT NULL
      `;
      durationsSql = `
        SELECT TIMESTAMPDIFF(SECOND, created_at, updated_at) / 3600.0 AS hours
        FROM reports
        WHERE status = 'resolved' AND updated_at IS NOT NULL
        ORDER BY hours ASC
        LIMIT 5000
      `;
    } else {
      // SQLite: strftime('%s', ...) gives unix seconds as string; cast to real.
      avgSql = `
        SELECT AVG((CAST(strftime('%s', updated_at) AS REAL) - CAST(strftime('%s', created_at) AS REAL)) / 3600.0) AS avg_hours,
               COUNT(*) AS samples
        FROM reports
        WHERE status = 'resolved' AND updated_at IS NOT NULL
      `;
      durationsSql = `
        SELECT (CAST(strftime('%s', updated_at) AS REAL) - CAST(strftime('%s', created_at) AS REAL)) / 3600.0 AS hours
        FROM reports
        WHERE status = 'resolved' AND updated_at IS NOT NULL
        ORDER BY hours ASC
        LIMIT 5000
      `;
    }

    const [summary] = await db.query(avgSql);
    const rows = await db.query(durationsSql);

    const durations = rows.map((r) => Number(r.hours)).filter((n) => Number.isFinite(n) && n >= 0);
    const samples = Number((summary && summary.samples) || durations.length || 0);

    let medianHours = null;
    let p95Hours = null;
    if (durations.length > 0) {
      const mid = Math.floor(durations.length / 2);
      medianHours = durations.length % 2 === 0
        ? (durations[mid - 1] + durations[mid]) / 2
        : durations[mid];
      const p95Idx = Math.min(durations.length - 1, Math.floor(0.95 * (durations.length - 1)));
      p95Hours = durations[p95Idx];
    }

    const avgHours = summary && summary.avg_hours != null ? Number(summary.avg_hours) : null;

    res.json({
      success: true,
      data: {
        avgHours: avgHours != null && Number.isFinite(avgHours) ? avgHours : null,
        medianHours: medianHours != null && Number.isFinite(medianHours) ? medianHours : null,
        p95Hours: p95Hours != null && Number.isFinite(p95Hours) ? p95Hours : null,
        samples,
      },
    });
  } catch (err) {
    next(err);
  }
}

/* --------------------------------------------------------------------------
 * 4. Location Breakdown (by Barangay)
 * -------------------------------------------------------------------------- */

// Prefer user.barangay when submitted_by resolves to a user. For SMS-origin
// reports (submitted_by NULL) fall back to scanning reports.location for a
// known barangay substring. Anything we can't attribute goes to "Unknown".
async function getLocationBreakdown(req, res, next) {
  try {
    const rows = await db.query(`
      SELECT r.location AS location, u.barangay AS user_barangay
      FROM reports r
      LEFT JOIN users u ON u.id = r.submitted_by
    `);

    const counts = Object.create(null);
    for (const b of MORONG_BARANGAYS) counts[b] = 0;
    counts['Unknown'] = 0;

    const lowered = MORONG_BARANGAYS.map((b) => ({ name: b, lc: b.toLowerCase() }));

    for (const row of rows) {
      let bucket = null;

      if (row.user_barangay) {
        // Match case-insensitively to canonical spelling when possible.
        const hit = lowered.find((x) => x.lc === String(row.user_barangay).toLowerCase());
        bucket = hit ? hit.name : row.user_barangay;
      } else if (row.location) {
        const locLc = String(row.location).toLowerCase();
        const hit = lowered.find((x) => locLc.includes(x.lc));
        if (hit) bucket = hit.name;
      }

      if (!bucket) bucket = 'Unknown';
      counts[bucket] = (counts[bucket] || 0) + 1;
    }

    const data = Object.entries(counts)
      .map(([barangay, count]) => ({ barangay, count }))
      .filter((r) => r.count > 0 || MORONG_BARANGAYS.includes(r.barangay))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getIncidentsOverTime,
  getTypeBreakdown,
  getResponseTime,
  getLocationBreakdown,
};
