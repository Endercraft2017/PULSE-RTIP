/** Append an audit entry; callers await this inside the mutation transaction. */
const AuditLog = require('../models/AuditLog');
async function recordAction(actorUserId, action, targetType, targetId, details) {
  return AuditLog.create({ actor_user_id: actorUserId, action,
    target_type: targetType || null, target_id: targetId || null, details: details || null });
}
async function logAction(...args) {
  try { return await recordAction(...args); }
  catch (error) { console.error('[auditLog]', error.message); }
}
module.exports = { logAction, recordAction };
