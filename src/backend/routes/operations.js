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
        if(id)await db.lockRow(def.table,id);
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
router.get('/clock',requireAdmin,async(req,res,next)=>{
  try {
    const mysql=require('../config').appMode==='production';
    const rows=await db.query(mysql?"SELECT UTC_TIMESTAMP(3) AS utc_now, @@session.time_zone AS session_timezone":"SELECT strftime('%Y-%m-%dT%H:%M:%fZ','now') AS utc_now");
    res.json({success:true,data:{serverTime:new Date().toISOString(),databaseTime:rows[0].utc_now,databaseTimezone:mysql?rows[0].session_timezone:'UTC',displayTimezone:'Asia/Manila',processTimezone:process.env.TZ,sequence:'event id',clockSynchronization:'not verified by this endpoint'}});
  }catch(e){next(e);}
});
router.get('/map-config', (req,res,next)=>{
  try { const territory=require('../services/geocode/territory').loadPolicy(); res.json({success:true,data:{provider:'leaflet',timezone:'Asia/Manila',configured:true,territory}}); }
  catch(error) { if(error.statusCode!==503) return next(error); res.json({success:true,data:{provider:'leaflet',configured:false,message:error.message}}); }
});
router.get('/users',requireAdmin,async(req,res,next)=>{
  try{res.json({success:true,data:await db.query('SELECT id,name,email,role,account_status,account_reason FROM users WHERE deleted_at IS NULL ORDER BY id')});}catch(e){next(e);}
});
router.put('/users/:id',requireAdmin,requireAgency,validate([param('id').isInt({min:1}),body('account_status').isIn(['active','suspended','deactivated']),text('account_reason',5000,true)]),async(req,res,next)=>{
  try {
    const result=await db.transaction(async()=>{
      const old=(await db.query('SELECT id,role,account_status,account_reason FROM users WHERE id=? AND deleted_at IS NULL',[req.params.id]))[0];
      if(!old) throw Object.assign(new Error('Account not found.'),{statusCode:404});
      if(old.role!=='citizen') throw Object.assign(new Error('Account controls apply to citizen accounts only.'),{statusCode:403});
      if(old.account_status===req.body.account_status) throw Object.assign(new Error('This account state is already saved.'),{statusCode:409});
      const changed=await db.query('UPDATE users SET account_status=?,account_reason=?,auth_version=auth_version+1 WHERE id=? AND account_status=?',[req.body.account_status,req.body.account_reason,old.id,old.account_status]);
      if(!changed.affectedRows) throw Object.assign(new Error('Account changed. Refresh and retry.'),{statusCode:409});
      await recordAction(req.user.id,'account_status_changed','user',old.id,{from:old.account_status,to:req.body.account_status,reason:req.body.account_reason});
      return {id:old.id,account_status:req.body.account_status};
    });res.json({success:true,data:result});
  }catch(e){next(e);}
});
router.get('/broadcasts/:id/recipients', requireAdmin, validate([param('id').isInt({min:1})]),async(req,res,next)=>{try{res.json({success:true,data:await db.query('SELECT id,user_id,recipient,status,provider_id,last_error,updated_at FROM broadcast_recipients WHERE job_id=? ORDER BY id',[req.params.id])});}catch(e){next(e);}});
router.get('/broadcasts', requireAdmin, async (req, res, next) => {
  try { res.json({ success: true, data: await db.query('SELECT j.id,j.hazard_id,j.advisory_id,j.channel,j.status,j.attempts,j.last_error,j.created_at,j.updated_at,(SELECT COUNT(*) FROM broadcast_recipients r WHERE r.job_id=j.id) AS recipients FROM broadcast_jobs j ORDER BY j.id DESC LIMIT 200') }); }
  catch (error) { next(error); }
});
module.exports = router;
