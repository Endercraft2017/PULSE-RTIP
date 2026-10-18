/** Operations API.
 * Table of contents: directory definitions, validated mutations, history,
 * agency assignments, map configuration and delivery status.
 */
const { Router } = require('express');
const { body, param } = require('express-validator');
const validate = require('../middleware/validate');
const { authenticate, requireAdmin, requireAgency } = require('../middleware/auth');
const db = require('../config/database');
const { recordAction } = require('../middleware/auditLog');
const broadcast = require('../services/hazard/broadcast');
const router = Router();
router.use(authenticate);
const departments = ['MDRRMO', 'Bureau of Fire Protection', 'Police Department', 'Health Unit'];
const text = (key, max, required = false) => {
  let rule = body(key);
  if (!required) rule = rule.optional({ nullable: true });
  return rule.isString().trim().isLength({ min: required ? 1 : 0, max });
};
const gps = [body('latitude').isFloat({ min: -90, max: 90 }), body('longitude').isFloat({ min: -180, max: 180 })];
const definitions = {
  barangays: { table: 'barangays', fields: ['name', 'description', 'active'], rules: [text('name', 100, true), text('description', 5000), body('active').optional().isInt({ min: 0, max: 1 })] },
  hotlines: { table: 'emergency_hotlines', fields: ['label', 'number', 'category', 'sort_order'], rules: [text('label', 100, true), body('number').isString().trim().matches(/^[+\d][\d ()-]{1,48}$/), text('category', 100), body('sort_order').optional().isInt({ min: 0 })] },
  calls: { table: 'emergency_calls', fields: ['caller_name', 'contact_number', 'location', 'latitude', 'longitude', 'notes', 'status'], rules: [text('caller_name', 150, true), body('contact_number').optional({ nullable: true, checkFalsy: true }).isString().trim().matches(/^[+\d][\d ()-]{1,48}$/), text('location', 255), body('latitude').optional({ nullable: true }).isFloat({ min: -90, max: 90 }), body('longitude').optional({ nullable: true }).isFloat({ min: -180, max: 180 }), text('notes', 5000), body('status').optional().isIn(['received', 'dispatched', 'closed'])] },
  advisories: { table: 'road_advisories', fields: ['label', 'latitude', 'longitude', 'status', 'active'], rules: [text('label', 255, true), ...gps, body('status').isIn(['not_passable', 'caution', 'clear']), body('active').optional().isInt({ min: 0, max: 1 })] },
};
for (const [resource, def] of Object.entries(definitions)) {
  const guard = resource === 'calls' ? [requireAdmin] : [];
  router.get('/' + resource, ...guard, async (req, res, next) => {
    try {
      const rows = await db.query(`SELECT * FROM ${def.table}${req.user.role !== 'admin' && ['barangays', 'advisories'].includes(resource) ? ' WHERE active = 1' : ''} ORDER BY id`);
      res.json({ success: true, data: rows });
    } catch (error) { next(error); }
  });
  async function save(req, res, next) {
    try {
      const id = req.params.id;
      const result = await db.transaction(async () => {
        const old = id ? (await db.query(`SELECT * FROM ${def.table} WHERE id = ?`, [id]))[0] : null;
        if (id && !old) throw Object.assign(new Error('Record not found.'), { statusCode: 404 });
        if (['advisories', 'calls'].includes(resource)) {
          if (resource === 'advisories') require('../services/geocode/territory').assertLocation({ ...req.body, location: req.body.label });
          else if (req.body.location || req.body.latitude != null || req.body.longitude != null) require('../services/geocode/territory').assertLocation({ ...old, ...req.body });
        }
        const fields = def.fields.filter(k => req.body[k] !== undefined);
        const values = fields.map(k => req.body[k]);
        const now = new Date().toISOString();
        if (resource !== 'hotlines') { fields.push('updated_at'); values.push(now); }
        let recordId = id;
        if (id) await db.query(`UPDATE ${def.table} SET ${fields.map(k => k + ' = ?').join(', ')} WHERE id = ?`, [...values, id]);
        else {
          if (['calls', 'advisories'].includes(resource)) { fields.push('created_by', 'created_at'); values.push(req.user.id, now); }
          const inserted = await db.query(`INSERT INTO ${def.table} (${fields.join(', ')}) VALUES (${fields.map(() => '?').join(', ')})`, values);
          recordId = inserted.insertId;
        }
        if (resource === 'barangays' && old && old.name !== req.body.name) {
          await db.query('UPDATE users SET barangay = ? WHERE barangay = ?', [req.body.name, old.name]);
          await db.query('UPDATE push_tokens SET barangay = ? WHERE barangay = ?', [req.body.name, old.name]);
          const hazards = await db.query('SELECT id, audience_barangays FROM hazard_alerts WHERE audience_barangays IS NOT NULL');
          for (const h of hazards) {
            const list = JSON.parse(h.audience_barangays);
            if (list.includes(old.name)) await db.query('UPDATE hazard_alerts SET audience_barangays = ? WHERE id = ?', [JSON.stringify(list.map(n => n === old.name ? req.body.name : n)), h.id]);
          }
        }
        const updated = (await db.query(`SELECT * FROM ${def.table} WHERE id = ?`, [recordId]))[0];
        await recordAction(req.user.id, resource + (id ? '_updated' : '_created'), resource, Number(recordId), { before: old, after: updated });
        if (resource === 'advisories' && updated.active && updated.status === 'not_passable' && (!old || !old.active || old.status !== updated.status || old.label !== updated.label)) {
          await broadcast.enqueue({ advisory_id: Number(recordId), title: 'Urgent road advisory', message: `${updated.label}\nGPS: ${updated.latitude}, ${updated.longitude}`, critical: true });
        }
        return updated;
      });
      if (resource === 'advisories') broadcast.dispatch().catch(error => console.error('[broadcast]', error.message));
      res.status(id ? 200 : 201).json({ success: true, data: result });
    } catch (error) {
      if (/unique|duplicate/i.test(error.message)) error = Object.assign(new Error('A record with that name already exists.'), { statusCode: 409 });
      next(error);
    }
  }
  router.post('/' + resource, requireAdmin, requireAgency, validate(def.rules), save);
  router.put('/' + resource + '/:id', requireAdmin, requireAgency, validate([param('id').isInt({ min: 1 }), ...def.rules]), save);
}

router.get('/hazards/:id/events', validate([param('id').isInt({ min: 1 })]), async (req, res, next) => {
  try {
    const events = await db.query('SELECT e.*, u.name AS actor_name FROM hazard_events e LEFT JOIN users u ON u.id = e.actor_user_id WHERE e.hazard_id = ? ORDER BY e.id', [req.params.id]);
    res.json({ success: true, data: events });
  } catch (error) { next(error); }
});
router.post('/hazards/:id/events', requireAdmin, requireAgency, validate([param('id').isInt({ min: 1 }), text('note', 5000, true)]), async (req, res, next) => {
  try {
    const result = await db.transaction(async () => {
      const hazard = (await db.query('SELECT * FROM hazard_alerts WHERE id = ?', [req.params.id]))[0];
      if (!hazard) throw Object.assign(new Error('Hazard not found.'), { statusCode: 404 });
      if (hazard.deleted_at) throw Object.assign(new Error('Restore the archived hazard first.'), { statusCode: 409 });
      const event = await db.query('INSERT INTO hazard_events (hazard_id, actor_user_id, actor_department, action, note, created_at) VALUES (?, ?, ?, ?, ?, ?)', [hazard.id, req.user.id, req.user.department || null, 'note', req.body.note, new Date().toISOString()]);
      await recordAction(req.user.id, 'hazard_note', 'hazard', hazard.id, { note: req.body.note });
      return event;
    });
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) { next(error); }
});
router.get('/responders', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await db.query("SELECT id, name, department FROM users WHERE role = 'admin' AND deleted_at IS NULL"), departments }); }
  catch (error) { next(error); }
});
router.put('/responders/:id', requireAdmin, validate([param('id').isInt({ min: 1 }), body('department').isIn(departments)]), async (req, res, next) => {
  try {
    await db.transaction(async () => {
      const users = await db.query("SELECT department FROM users WHERE id = ? AND role = 'admin' AND deleted_at IS NULL", [req.params.id]);
      if (!users.length) throw Object.assign(new Error('Responder not found.'), { statusCode: 404 });
      await db.query('UPDATE users SET department = ? WHERE id = ?', [req.body.department, req.params.id]);
      await recordAction(req.user.id, 'department_assigned', 'user', Number(req.params.id), { before: users[0].department, after: req.body.department });
    });
    res.json({ success: true });
  } catch (error) { next(error); }
});
router.get('/map-config', (req, res) => res.json({ success: true, data: { googleMapsKey: process.env.GOOGLE_MAPS_BROWSER_KEY || '', timezone: 'Asia/Manila' } }));
router.get('/broadcasts', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await db.query('SELECT id, hazard_id, advisory_id, channel, status, attempts, last_error, created_at, updated_at FROM broadcast_jobs ORDER BY id DESC LIMIT 200') }); }
  catch (error) { next(error); }
});
module.exports = router;
