/**
 * =============================================================================
 * Audit Log Helper
 * =============================================================================
 *
 * Fire-and-forget wrapper around AuditLog.create. Call from controllers
 * after the underlying admin action has committed. Swallows all errors —
 * a failed audit write must never block or fail the parent request.
 * =============================================================================
 */

const AuditLog = require('../models/AuditLog');

async function logAction(actorUserId, action, targetType, targetId, details) {
  try {
    await AuditLog.create({
      actor_user_id: actorUserId,
      action,
      target_type: targetType || null,
      target_id: targetId || null,
      details: details || null,
    });
  } catch (e) {
    console.error('[auditLog]', e.message);
  }
}

module.exports = { logAction };
