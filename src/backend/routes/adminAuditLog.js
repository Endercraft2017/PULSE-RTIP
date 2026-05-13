/**
 * =============================================================================
 * Admin Audit Log Route
 * =============================================================================
 *
 * GET /api/admin/audit-log?limit=50&offset=0
 *   Paginated listing of privileged admin actions. requireAdmin.
 * =============================================================================
 */

const { Router } = require('express');
const { authenticate, requireAdmin } = require('../middleware/auth');
const AuditLog = require('../models/AuditLog');

const router = Router();

router.get('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const limit = Math.max(1, Math.min(200, parseInt(req.query.limit, 10) || 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const [entries, total] = await Promise.all([
      AuditLog.findRecent({ limit, offset }),
      AuditLog.countAll(),
    ]);

    res.json({
      success: true,
      data: entries,
      pagination: { limit, offset, total },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
