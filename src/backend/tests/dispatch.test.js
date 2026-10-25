/** Integration regression tests: isolated SQLite database, real HTTP auth/routes,
 * and deterministic boundary fixtures. External geocoding/provider delivery are
 * stubbed or unconfigured; no real emergency messages are sent by this suite.
 */
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const folder = mkdtempSync(path.join(tmpdir(), 'pulse-dispatch-'));
process.env.SQLITE_PATH = path.join(folder, 'test.db');
process.env.APP_MODE = 'offline';
process.env.JWT_SECRET = 'isolated-test-signing-key';
process.env.TERRITORY_GEOJSON_PATH = path.join(folder, 'boundary.json');
for (const name of ['TEXTBEE_API_KEY', 'TEXTBEE_DEVICE_ID', 'FIREBASE_SERVICE_ACCOUNT_PATH', 'FIREBASE_SERVICE_ACCOUNT_JSON']) process.env[name] = '';
const rectangle = (x1, y1, x2, y2) => ({ type: 'Polygon', coordinates: [[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]] });
writeFileSync(process.env.TERRITORY_GEOJSON_PATH, JSON.stringify({ type: 'FeatureCollection', properties:{jurisdiction:'PH-RIZ-MORONG',source:'synthetic test fixture, not for deployment',approved_by:'TEST ONLY',approved_at:'2026-10-25',version:'test-1'}, features: [
  { type: 'Feature', properties: { mode: 'allow', name: 'Morong synthetic test territory' }, geometry: rectangle(120, 13, 123, 16) },
  { type: 'Feature', properties: { mode: 'deny', name: 'Excluded synthetic area' }, geometry: rectangle(121, 14, 122, 15) }
] }));
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const tokens = {};
let server, base, reportId, smsId, hazardId;
async function api(method, route, payload, user = 'admin') {
  const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: 'Bearer ' + tokens[user] } : {}) }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
  return { status: response.status, ...await response.json() };
}
const valid = { title: 'Test incident', type: 'Flood', location: 'Accepted test area', latitude: 120.5, longitude: 14.5 };
// Correct axis order in request fixtures (latitude, longitude).
valid.latitude = 14.5; valid.longitude = 120.5;
before(async () => {
  execFileSync(process.execPath, [path.resolve(__dirname, '../../database/migrations/migrate.js')], { env: process.env, stdio: 'pipe' });
  for (const [i, name, role, department] of [[1,'admin','admin','MDRRMO'],[2,'citizen','citizen',null],[3,'other','citizen',null]]) {
    await db.query('INSERT INTO users (id, name, email, password_hash, role, department, phone) VALUES (?, ?, ?, ?, ?, ?, ?)', [i, name, name+'@test.invalid', 'unused-test-hash', role, department, '0917000000'+i]);
    tokens[name] = jwt.sign({ sub: i }, process.env.JWT_SECRET);
  }
  await db.query('INSERT INTO push_tokens (token, user_id) VALUES (?, ?)', ['test-device-token', 2]);
  const port = 18000 + Math.floor(Math.random() * 10000);
  base = 'http://127.0.0.1:' + port + '/api';
  const geocodePath = path.resolve(__dirname, '../services/geocode/nominatim.js');
  const boot = `require.cache[require.resolve(${JSON.stringify(geocodePath)})]={exports:{reverseGeocode:async()=>null}};require(${JSON.stringify(path.resolve(__dirname, '../server.js'))});`;
  server = spawn(process.execPath, ['-e', boot], { env: { ...process.env, PORT: String(port), TRUST_PROXY: '0' }, stdio: 'pipe' });
  let output = ''; server.stdout.on('data', chunk => { output += chunk; }); server.stderr.on('data', chunk => { output += chunk; });
  for (let i=0;i<100;i++) {
    if (server.exitCode != null) throw new Error(output);
    try { const response = await fetch(base + '/health'); if (response.ok) return; } catch (_) {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready: ' + output);
});
after(async () => {
  if (server && server.exitCode == null) { server.kill('SIGTERM'); await new Promise(resolve => server.once('exit', resolve)); }
  await db.close(); rmSync(folder, { recursive: true, force: true });
});

test('territory rules reject denied GPS, outside Morong, and missing coordinates', async () => {
  for (const payload of [{...valid, longitude:121.5}, {...valid, longitude:125}, {...valid, latitude:null}, {...valid, longitude:undefined}]) {
    const response = await api('POST','/reports',payload,'citizen');
    assert.ok([400,422].includes(response.status), JSON.stringify(response));
  }
});
test('missing policy fails closed; polygon holes and bounds are respected', () => {
  const { assertLocation, contains } = require('../services/geocode/territory');
  const saved = process.env.TERRITORY_GEOJSON_PATH; process.env.TERRITORY_GEOJSON_PATH=path.join(folder,'missing-boundary.json');
  assert.throws(() => assertLocation(valid), error => error.statusCode === 503);
  process.env.TERRITORY_GEOJSON_PATH = saved;
  const shape = rectangle(0,0,10,10); shape.coordinates.push(rectangle(2,2,4,4).coordinates[0]);
  assert.equal(contains(shape,[3,3]),false); assert.equal(contains(shape,[1,1]),true); assert.equal(contains(shape,[0,0]),true);
});
test('report creation records history; resolution is atomic and requires a note', async () => {
  const created = await api('POST','/reports',valid,'citizen'); assert.equal(created.status,201,JSON.stringify(created)); reportId=created.data.id;
  assert.equal((await api('PUT',`/reports/${reportId}/status`,{status:'resolved'})).status,400);
  const result = await api('PUT',`/reports/${reportId}/status`,{status:'resolved',note:'Rescued safely at 14:30.'}); assert.equal(result.status,200,JSON.stringify(result));
  const events = await api('GET',`/reports/${reportId}/events`,undefined,'citizen');
  assert.equal(events.data.length,2); assert.equal(events.data[1].actor_department,'MDRRMO'); assert.match(events.data[1].created_at,/\.\d{3}Z$/);
  assert.ok((await db.query('SELECT * FROM notifications WHERE user_id = 2 AND report_id = ?', [reportId])).length);
});
test('SMS-origin resolution succeeds with a NULL report owner', async () => {
  const inserted = await db.query("INSERT INTO reports (title,type,status,submitted_by,source) VALUES ('SMS rescue','Others','pending_confirmation',NULL,'sms')"); smsId=inserted.insertId;
  const result = await api('PUT',`/reports/${smsId}/status`,{status:'resolved',note:'Rescue complete.'}); assert.equal(result.status,200,JSON.stringify(result));
});
test('failed history or audit inserts roll back status and inbox', async () => {
  const raw = db.getSQLiteDb();
  for (const table of ['report_events', 'audit_log']) {
    raw.exec(`CREATE TRIGGER fail_history BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'injected test failure'); END`);
    const result = await api('PUT',`/reports/${smsId}/status`,{status:'in_progress',note:'Testing rollback'}); assert.equal(result.status,500);
    assert.equal((await db.query('SELECT status FROM reports WHERE id = ?', [smsId]))[0].status,'resolved');
    raw.exec('DROP TRIGGER fail_history');
  }
});
test('history permissions and agency snapshots are enforced', async () => {
  assert.equal((await api('GET',`/reports/${reportId}/events`,undefined,'other')).status,403);
  assert.equal((await api('POST',`/reports/${reportId}/events`,{note:'Fake admin note'},'citizen')).status,403);
  assert.equal((await api('PUT',`/reports/${reportId}/status`,{status:'resolved',note:'Fake resolution'},'citizen')).status,403);
  assert.equal((await api('PUT','/operations/responders/1',{department:'Bureau of Fire Protection'})).status,200);
  assert.equal((await api('POST',`/reports/${reportId}/events`,{note:'Follow-up inspection.'})).status,201);
  const events = (await api('GET',`/reports/${reportId}/events`)).data;
  assert.equal(events[1].actor_department,'MDRRMO'); assert.equal(events[2].actor_department,'Bureau of Fire Protection');
});
test('coordinate corrections are authorized, territory validated, and audited', async () => {
  assert.equal((await api('PUT',`/reports/${reportId}`,{latitude:14.6,longitude:120.6,note:'Pin correction'})).status,200);
  assert.equal((await api('PUT',`/reports/${reportId}`,{latitude:14.6,longitude:121.6,note:'Outside territory'})).status,422);
  const audit = await db.query("SELECT details FROM audit_log WHERE action = 'report_updated' AND target_id = ?",[reportId]);
  assert.equal(JSON.parse(audit[0].details).changes.longitude.to,120.6);
});
test('hazards queue all-user SMS/push broadcasts and citizen-visible notes', async () => {
  const result = await api('POST','/hazards',{...valid,severity:'high',audience_type:'barangay',audience_barangays:['Unmatched']});
  assert.equal(result.status,201,JSON.stringify(result)); hazardId=result.data.id;
  const jobs=await db.query('SELECT * FROM broadcast_jobs WHERE hazard_id = ?',[hazardId]);
  assert.deepEqual(jobs.map(j=>j.channel).sort(),['push','sms']);
  assert.equal(JSON.parse(jobs.find(j=>j.channel==='sms').payload).recipients.length,3);
  assert.equal((await api('POST',`/operations/hazards/${hazardId}/events`,{note:'Water is receding.'})).status,201);
  const events=(await api('GET',`/operations/hazards/${hazardId}/events`,undefined,'citizen')).data; assert.equal(events.length,2);
  assert.equal(events[1].note,'Water is receding.');
  await require('../services/hazard/broadcast').dispatch();
  assert.ok((await db.query('SELECT status FROM broadcast_jobs')).every(j=>j.status==='blocked'));
});
test('archive preserves dependencies; permanent deletion blocked at API, model, database', async () => {
  for (const [resource,id,table,model] of [['reports',reportId,'reports','Report'],['hazards',hazardId,'hazard_alerts','Hazard']]) {
    assert.equal((await api('DELETE',`/${resource}/${id}/permanent`)).status,405);
    await assert.rejects(require('../models/'+model).permanentRemove(id));
    await assert.rejects(db.query(`DELETE FROM ${table} WHERE id = ?`,[id]),/Archive/);
    assert.equal((await api('DELETE',`/${resource}/${id}`)).status,200);
    assert.ok((await db.query(`SELECT deleted_at FROM ${table} WHERE id = ?`,[id]))[0].deleted_at);
    assert.ok(!(await api('GET','/'+resource,undefined,'citizen')).data.some(r=>r.id===id));
    assert.equal((await api('PUT',`/${resource}/${id}/restore`,{})).status,200);
  }
  assert.equal((await db.query('SELECT * FROM report_events WHERE report_id = ?',[reportId])).length,6);
});
test('barangay directory rename preserves user associations; only admins edit', async () => {
  const created = await api('POST','/operations/barangays',{name:'Example Barangay',description:'Test profile',active:1}); assert.equal(created.status,201);
  await db.query('UPDATE users SET barangay = ? WHERE id = 2',['Example Barangay']);
  assert.equal((await api('PUT',`/operations/barangays/${created.data.id}`,{name:'Renamed Barangay',description:'Updated profile',active:1})).status,200);
  assert.equal((await db.query('SELECT barangay FROM users WHERE id = 2'))[0].barangay,'Renamed Barangay');
  const publicDirectory = await api('GET', '/barangays', undefined, null);
  assert.equal(publicDirectory.status, 200);
  assert.ok(publicDirectory.data.some(b => b.name === 'Renamed Barangay'));
  assert.equal((await api('POST','/operations/barangays',{name:'Fake'},'citizen')).status,403);
});
test('emergency calls accept a missing phone then a later correction; contacts editable', async () => {
  const call=await api('POST','/operations/calls',{caller_name:'Caller',notes:'Needs assistance'}); assert.equal(call.status,201);
  const updated=await api('PUT',`/operations/calls/${call.data.id}`,{caller_name:'Caller',contact_number:'09170000004',status:'dispatched'}); assert.equal(updated.data.contact_number,'09170000004');
  assert.equal((await api('GET','/operations/calls',undefined,'citizen')).status,403);
  const contact=await api('POST','/operations/hotlines',{label:'Rescue',number:'911'}); assert.equal(contact.status,201);
  assert.equal((await api('PUT',`/operations/hotlines/${contact.data.id}`,{label:'Rescue dispatch',number:'09170000005'})).status,200);
});
test('road advisories are live, audited, and critical warnings queue broadcasts', async () => {
  const created=await api('POST','/operations/advisories',{label:'NOT PASSABLE - BINABAHA NA YUNG LUGAR',latitude:14.5,longitude:120.5,status:'not_passable',active:1}); assert.equal(created.status,201,JSON.stringify(created));
  assert.equal((await db.query('SELECT * FROM broadcast_jobs WHERE advisory_id = ?',[created.data.id])).length,2);
  const result=await api('PUT',`/operations/advisories/${created.data.id}`,{label:'Road clear',latitude:14.5,longitude:120.5,status:'clear',active:0}); assert.equal(result.status,200);
  assert.ok(!(await api('GET','/operations/advisories',undefined,'citizen')).data.some(a=>a.id===created.data.id));
});
test('migration reruns preserve existing reports and delivery records', async () => {
  const count=(await db.query('SELECT COUNT(*) AS total FROM report_events'))[0].total;
  execFileSync(process.execPath,[path.resolve(__dirname,'../../database/migrations/migrate.js')],{env:process.env,stdio:'pipe'});
  assert.equal((await db.query('SELECT COUNT(*) AS total FROM report_events'))[0].total,count);
  assert.equal((await db.query('SELECT department FROM users WHERE id = 1'))[0].department,'Bureau of Fire Protection');
});

test('provider failures retry independent batches and success records acceptance', async () => {
  const textbee = require('../services/sms/textbee');
  const originalConfig = textbee.getEffectiveConfig, originalSend = textbee.sendSMS;
  let attempts = 0;
  textbee.getEffectiveConfig = async () => ({ apiKey: 'test-only', deviceId: 'test-only' });
  textbee.sendSMS = async (recipients, message) => {
    if (message === 'isolated retry fixture' && ++attempts === 1) throw Object.assign(new Error('Explicit provider rejection'),{safeRetry:true});
    return { accepted: true };
  };
  try {
    const now = new Date().toISOString();
    const inserted = await db.query('INSERT INTO broadcast_jobs (channel, payload, created_at, updated_at) VALUES (?, ?, ?, ?)',
      ['sms', JSON.stringify({ recipients: ['09170000000'], title: 'Test', message: 'isolated retry fixture' }), now, now]);
    const worker = require('../services/hazard/broadcast');
    await worker.dispatch();
    let job = (await db.query('SELECT * FROM broadcast_jobs WHERE id = ?', [inserted.insertId]))[0];
    assert.equal(job.status, 'retry'); assert.equal(job.attempts, 1);
    await worker.dispatch();
    job = (await db.query('SELECT * FROM broadcast_jobs WHERE id = ?', [inserted.insertId]))[0];
    assert.equal(job.status, 'accepted'); assert.equal(job.attempts, 2); assert.equal(job.last_error, null);
  } finally { textbee.getEffectiveConfig = originalConfig; textbee.sendSMS = originalSend; }
});
test('unassigned responder must choose an agency before operational writes', async () => {
  await db.query('UPDATE users SET department = NULL WHERE id = 1');
  assert.equal((await api('POST', `/reports/${reportId}/events`, { note: 'Unassigned action' })).status, 409);
  assert.equal((await api('PUT', '/operations/responders/1', { department: 'Health Unit' })).status, 200);
  assert.equal((await api('POST', `/reports/${reportId}/events`, { note: 'Assigned action' })).status, 201);
});

test('blocked SMS batches do not starve later push batches', async () => {
  const textbee = require('../services/sms/textbee');
  const fcm = require('../services/push/fcm');
  const originalConfig = textbee.getEffectiveConfig;
  const originalConfigured = fcm.isConfigured, originalSend = fcm.send;
  textbee.getEffectiveConfig = async () => ({});
  fcm.isConfigured = () => true;
  let sent = 0;
  fcm.send = async tokens => { sent += tokens.length; return { sent: tokens.length, failed: 0 }; };
  try {
    const old = '2000-01-01T00:00:00.000Z';
    for (let i = 0; i < 25; i++) await db.query(
      "INSERT INTO broadcast_jobs (channel, payload, status, created_at, updated_at) VALUES (?, ?, 'blocked', ?, ?)",
      ['sms', JSON.stringify({ recipients: ['09170000000'], message: 'blocked fixture' }), old, old]);
    const inserted = await db.query(
      "INSERT INTO broadcast_jobs (channel, payload, status, created_at, updated_at) VALUES (?, ?, 'blocked', ?, ?)",
      ['push', JSON.stringify({ recipients: ['isolated-test-device'], title: 'Test', message: 'reachable push fixture' }), old, old]);
    const worker = require('../services/hazard/broadcast');
    await worker.dispatch();
    await worker.dispatch();
    assert.equal((await db.query('SELECT status FROM broadcast_jobs WHERE id = ?', [inserted.insertId]))[0].status, 'accepted');
    assert.ok(sent >= 1);
  } finally {
    textbee.getEffectiveConfig = originalConfig;
    fcm.isConfigured = originalConfigured; fcm.send = originalSend;
  }
});

test('hazard pin corrections require admin permission, a reason and approved GPS', async () => {
  const url = `/hazards/${hazardId}/location`;
  const correction = { latitude: 14.6, longitude: 120.6, note: 'Main map pin correction' };
  assert.equal((await api('PUT', url, correction, 'citizen')).status, 403);
  assert.equal((await api('PUT', url, { latitude: 14.6, longitude: 120.6 })).status, 400);
  const response = await api('PUT', url, correction);
  assert.equal(response.status, 200, JSON.stringify(response));
  assert.equal(Number(response.data.latitude), 14.6);
  const event = (await api('GET', `/operations/hazards/${hazardId}/events`)).data.at(-1);
  assert.equal(event.note, correction.note);
  assert.equal(event.actor_department, 'Health Unit');
  assert.equal((await api('PUT', url, { ...correction, longitude: 121.6 })).status, 422);
  assert.equal(Number((await api('GET', `/hazards/${hazardId}`)).data.longitude), 120.6);
});

test('cancellation rejects blank reasons and commits one owner history entry', async () => {
  const created = await api('POST','/reports',valid,'citizen'); const id=created.data.id;
  assert.equal((await api('PUT',`/reports/${id}/status`,{status:'cancelled',note:'   '},'citizen')).status,400);
  assert.equal((await api('PUT',`/reports/${id}/status`,{status:'cancelled',note:'Duplicate report'},'other')).status,403);
  assert.equal((await api('PUT',`/reports/${id}/status`,{status:'cancelled',note:'Duplicate report'},'citizen')).status,200);
  assert.equal((await api('PUT',`/reports/${id}/status`,{status:'cancelled',note:'Repeated'},'citizen')).status,400);
  const events=(await api('GET',`/reports/${id}/events`,undefined,'citizen')).data;
  assert.equal(events.filter(e=>e.to_status==='cancelled').length,1); assert.equal(events.at(-1).note,'Duplicate report');
});
test('admin account control revokes existing sessions without erasing attribution', async () => {
  assert.equal((await api('GET','/operations/users')).status,200);
  assert.equal((await api('PUT','/operations/users/3',{account_status:'suspended',account_reason:'Repeated misleading reports'})).status,200);
  assert.equal((await api('GET','/users/me',undefined,'other')).status,403);
  assert.ok((await db.query('SELECT * FROM users WHERE id=3'))[0]);
  assert.equal((await api('PUT','/operations/users/3',{account_status:'active',account_reason:'Review complete'})).status,200);
  assert.equal((await api('GET','/users/me',undefined,'other')).status,401,'Reactivation must not revive an old token');
});
test('incident priority is admin-only, controlled and appended to history', async () => {
  const created=await api('POST','/reports',valid,'citizen');const id=created.data.id;
  assert.equal((await api('PUT',`/reports/${id}/priority`,{priority:'critical',note:'Immediate rescue required'},'citizen')).status,403);
  assert.equal((await api('PUT',`/reports/${id}/priority`,{priority:'critical',note:'Immediate rescue required'})).status,200);
  assert.equal((await api('PUT',`/reports/${id}/priority`,{priority:'arbitrary',note:'Invalid'})).status,400);
  assert.equal((await api('GET',`/reports/${id}`)).data.priority,'critical');
  assert.equal((await api('GET',`/reports/${id}/events`)).data.at(-1).action,'priority_changed');
});

test('Morong labels are accepted only by geometry; obsolete policy and missing provenance fail closed', async()=>{
  const original=require('fs').readFileSync(process.env.TERRITORY_GEOJSON_PATH,'utf8');
  assert.equal((await api('POST','/reports',{...valid,location:'Morong, Rizal'},'citizen')).status,201);
  assert.equal((await api('POST','/reports',{...valid,location:'Morong, Rizal',longitude:125},'citizen')).status,422);
  try{
    const policy=JSON.parse(original);delete policy.properties;writeFileSync(process.env.TERRITORY_GEOJSON_PATH,JSON.stringify(policy));
    assert.equal((await api('POST','/reports',valid,'citizen')).status,503);
    policy.properties=JSON.parse(original).properties;policy.features[1].properties.name='Morong exclusion';writeFileSync(process.env.TERRITORY_GEOJSON_PATH,JSON.stringify(policy));
    assert.equal((await api('POST','/reports',valid,'citizen')).status,503);
  }finally{writeFileSync(process.env.TERRITORY_GEOJSON_PATH,original);}
});
test('all accepted-location paths reject outside Morong coordinates',async()=>{
  const outside={latitude:14.5,longitude:125};
  assert.equal((await api('POST','/hazards',{...valid,...outside,severity:'low'})).status,422);
  assert.equal((await api('POST','/operations/advisories',{...outside,label:'Outside Morong',active:1,status:'caution'})).status,422);
  assert.equal((await api('POST','/operations/calls',{...outside,caller_name:'Outside',location:'Morong'})).status,422);
  assert.equal((await api('PUT',`/hazards/${hazardId}/location`,{...outside,note:'Outside GPS'})).status,422);
  assert.equal((await api('PUT',`/reports/${reportId}`,{...outside,note:'Outside GPS'})).status,422);
  assert.equal((await api('PUT',`/reports/${reportId}`,{latitude:14.6,longitude:120.6})).status,400);
});
test('outer boundary accepted, holes and excluded boundary rejected',()=>{
  const {contains}=require('../services/geocode/territory');
  const g=rectangle(0,0,10,10);g.coordinates.push(rectangle(2,2,4,4).coordinates[0]);
  assert.equal(contains(g,[0,5]),true);assert.equal(contains(g,[2,3]),false);assert.equal(contains(g,[4,4]),false);
  assert.equal(contains({type:'MultiPolygon',coordinates:[rectangle(0,0,1,1).coordinates,rectangle(3,3,4,4).coordinates]},[3.5,3.5]),true);
});
test('simultaneous repeated status writes create one transition and one notification',async()=>{
  const created=await api('POST','/reports',valid,'citizen');const id=created.data.id;
  const results=await Promise.all([1,2].map(()=>api('PUT',`/reports/${id}/status`,{status:'investigating',note:'Dispatch review'})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const events=(await api('GET',`/reports/${id}/events`)).data;
  assert.equal(events.filter(e=>e.to_status==='investigating').length,1);
  assert.equal((await db.query("SELECT id FROM notifications WHERE report_id=? AND title='Report Status Update'",[id])).length,1);
});
test('cancellation, priority and account actions roll back when their audit fails',async()=>{
  const created=await api('POST','/reports',valid,'citizen');const id=created.data.id;
  const raw=db.getSQLiteDb();raw.exec("CREATE TRIGGER fail_new_actions BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'injected failure'); END");
  try{
    assert.equal((await api('PUT',`/reports/${id}/status`,{status:'cancelled',note:'Duplicate'},'citizen')).status,500);
    assert.equal((await api('PUT',`/reports/${id}/priority`,{priority:'critical',note:'Emergency'})).status,500);
    assert.equal((await api('PUT','/operations/users/3',{account_status:'deactivated',account_reason:'Repeated false reports'})).status,500);
    const report=(await api('GET',`/reports/${id}`)).data;
    assert.equal(report.status,'submitted');assert.equal(report.priority,'medium');
    assert.equal((await api('GET',`/reports/${id}/events`)).data.length,1);
    assert.equal((await db.query('SELECT account_status FROM users WHERE id=3'))[0].account_status,'active');
  }finally{raw.exec('DROP TRIGGER fail_new_actions');}
});
test('account control cannot restrict admins, omit reasons or be used by citizens',async()=>{
  assert.equal((await api('PUT','/operations/users/1',{account_status:'suspended',account_reason:'Bad target'})).status,403);
  assert.equal((await api('PUT','/operations/users/3',{account_status:'suspended',account_reason:'  '})).status,400);
  assert.equal((await api('PUT','/operations/users/3',{account_status:'suspended',account_reason:'Unauthorized'},'citizen')).status,403);
  assert.equal((await api('GET','/operations/users',undefined,'citizen')).status,403);
});
test('history cannot be overwritten or removed with direct SQL',async()=>{
  for(const table of ['report_events','hazard_events','audit_log']){
    await assert.rejects(db.query(`UPDATE ${table} SET created_at='2000-01-01' WHERE id IN (SELECT id FROM ${table} LIMIT 1)`),/append-only/);
    await assert.rejects(db.query(`DELETE FROM ${table} WHERE id IN (SELECT id FROM ${table} LIMIT 1)`),/append-only/);
  }
});
test('broadcast enqueue is idempotent and missing endpoints are explicit',async()=>{
  const worker=require('../services/hazard/broadcast');
  const event_key='isolated-dedup-event';const args={event_key,title:'Test',message:'Controlled test only',critical:true};
  await db.query("UPDATE users SET phone=NULL WHERE id=3");
  try{
    await Promise.all([worker.enqueue(args),worker.enqueue(args)]);
    assert.equal((await db.query('SELECT * FROM broadcast_events WHERE event_key=?',[event_key])).length,1);
    const jobs=await db.query('SELECT * FROM broadcast_jobs WHERE event_key LIKE ?',[event_key+':%']);assert.equal(jobs.length,2);
    const rows=await db.query('SELECT r.* FROM broadcast_recipients r JOIN broadcast_jobs j ON j.id=r.job_id WHERE j.event_key LIKE ?',[event_key+':%']);
    assert.equal(rows.filter(r=>r.user_id===3&&r.status==='no_contact').length,2);
    assert.equal(rows.filter(r=>r.user_id===2&&r.status==='queued').length,2);
  }finally{await db.query("UPDATE users SET phone='09170000003' WHERE id=3");}
});
test('partial push retries exclude already accepted devices; provider timeouts are held uncertain',async()=>{
  const worker=require('../services/hazard/broadcast');const fcm=require('../services/push/fcm');const textbee=require('../services/sms/textbee');
  const original={configured:fcm.isConfigured,send:fcm.send,sms:textbee.getEffectiveConfig};const seen=[];
  fcm.isConfigured=()=>true;textbee.getEffectiveConfig=async()=>({});
  fcm.send=async recipients=>{seen.push([...recipients]);return {outcomes:recipients.map(recipient=>({recipient,status:recipient==='retry-device'&&seen.length===1?'retry':'accepted'}))};};
  const now=new Date().toISOString();const inserted=await db.query('INSERT INTO broadcast_jobs (channel,payload,created_at,updated_at) VALUES (?,?,?,?)',['push',JSON.stringify({recipients:['accepted-device','retry-device'],title:'Test',message:'Isolated partial fixture'}),now,now]);
  for(const address of ['accepted-device','retry-device'])await db.query('INSERT INTO broadcast_recipients (job_id,user_id,recipient,status,updated_at) VALUES (?,2,?,\'queued\',?)',[inserted.insertId,address,now]);
  try{
    // Isolate fixture work from older pending provider-test jobs.
    await db.query("UPDATE broadcast_jobs SET status='failed' WHERE id<>? AND status IN ('pending','blocked','retry')",[inserted.insertId]);
    await worker.dispatch();await worker.dispatch();
    assert.deepEqual(seen,[['accepted-device','retry-device'],['retry-device']]);
    assert.ok((await db.query('SELECT status FROM broadcast_recipients WHERE job_id=?',[inserted.insertId])).every(r=>r.status==='accepted'));
    fcm.send=async()=>{throw new Error('Provider timed out after write');};
    const uncertain=await db.query('INSERT INTO broadcast_jobs (channel,payload,created_at,updated_at) VALUES (?,?,?,?)',['push',JSON.stringify({recipients:['unknown-device'],title:'Test',message:'Isolated uncertain fixture'}),now,now]);
    await worker.dispatch();assert.equal((await db.query('SELECT status FROM broadcast_jobs WHERE id=?',[uncertain.insertId]))[0].status,'uncertain');
  }finally{fcm.isConfigured=original.configured;fcm.send=original.send;textbee.getEffectiveConfig=original.sms;}
});

test('clock diagnostics expose UTC storage and Manila display without promising NTP synchronization',async()=>{
  const response=await api('GET','/operations/clock');assert.equal(response.status,200);
  assert.equal(response.data.databaseTimezone,'UTC');assert.equal(response.data.displayTimezone,'Asia/Manila');
  assert.ok(Math.abs(Date.parse(response.data.databaseTime)-Date.parse(response.data.serverTime))<1000);
  assert.equal((await api('GET','/operations/clock',undefined,'citizen')).status,403);
});
test('archive retries do not duplicate history and active reports can be archived',async()=>{
  const created=await api('POST','/reports',valid,'citizen');const id=created.data.id;
  assert.equal((await api('DELETE',`/reports/${id}`)).status,200);
  assert.equal((await api('DELETE',`/reports/${id}`)).status,409);
  assert.equal((await api('GET',`/reports/${id}/events`)).data.filter(e=>e.action==='archived').length,1);
  assert.equal((await api('PUT',`/reports/${id}/restore`,{})).status,200);
  assert.equal((await api('PUT',`/reports/${id}/restore`,{})).status,400);
  assert.equal((await api('GET',`/reports/${id}/events`)).data.filter(e=>e.action==='restored').length,1);
});

test('SMS promotion validates Morong GPS, retains sender context and records one conversion',async()=>{
  const insert=async longitude=>(await db.query('INSERT INTO sms_reports (raw_message,sender_phone,sender_name,type,message,latitude,longitude) VALUES (?,?,?,?,?,?,?)',['raw test SMS','09170000000','Test sender','Flood','Needs assistance',14.5,longitude])).insertId;
  const outside=await insert(125);assert.equal((await api('POST',`/sms-reports/${outside}/convert`,{})).status,422);
  const id=await insert(120.5);const raw=db.getSQLiteDb();
  raw.exec("CREATE TRIGGER fail_sms_audit BEFORE INSERT ON audit_log BEGIN SELECT RAISE(ABORT,'injected SMS audit failure'); END");
  try{assert.equal((await api('POST',`/sms-reports/${id}/convert`,{})).status,500);assert.equal((await db.query('SELECT status FROM sms_reports WHERE id=?',[id]))[0].status,'pending');}finally{raw.exec('DROP TRIGGER fail_sms_audit');}
  const results=await Promise.all([1,2].map(()=>api('POST',`/sms-reports/${id}/convert`,{})));
  assert.equal(results.filter(r=>r.status===200).length,1);
  const reportId=(await db.query('SELECT converted_report_id FROM sms_reports WHERE id=?',[id]))[0].converted_report_id;
  const report=(await api('GET',`/reports/${reportId}`)).data;assert.match(report.description,/Test sender/);assert.equal(report.submitted_by,null);
  assert.equal((await api('GET',`/reports/${reportId}/events`)).data.length,1);
});
test('critical severity creates an all-active-user broadcast with admin-only recipient visibility',async()=>{
  const created=await api('POST','/hazards',{...valid,severity:'critical',audience_type:'barangay',audience_barangays:['Unmatched']});
  assert.equal(created.status,201);const jobs=await db.query('SELECT * FROM broadcast_jobs WHERE hazard_id=?',[created.data.id]);assert.equal(jobs.length,2);
  const recipients=await api('GET',`/operations/broadcasts/${jobs.find(j=>j.channel==='sms').id}/recipients`);
  assert.equal(recipients.data.length,3);
  assert.equal((await api('GET',`/operations/broadcasts/${jobs[0].id}/recipients`,undefined,'citizen')).status,403);
});

test('published boundary candidate is Morong Rizal, not Morong Bataan or nearby municipalities',()=>{
  const {readFileSync}=require('node:fs');
  const candidate=JSON.parse(readFileSync(path.resolve(__dirname,'../../../config/territory/candidates/morong-rizal-ocha-namria-psa.geojson'),'utf8'));
  assert.equal(candidate.features.length,1);
  const feature=candidate.features[0];
  assert.equal(feature.properties.adm3_pcode,'PH0405809');assert.equal(feature.properties.adm2_name,'Rizal');
  const {contains,loadPolicy}=require('../services/geocode/territory');
  assert.equal(contains(feature.geometry,[121.239,14.515]),true,'Morong town');
  assert.equal(contains(feature.geometry,[121.24328548,14.54258742]),true,'published Morong center');
  assert.equal(contains(feature.geometry,[121.191,14.465]),false,'Binangonan');
  assert.equal(contains(feature.geometry,[121.208,14.561]),false,'Teresa');
  assert.equal(contains(feature.geometry,[120.32067693,14.70204547]),false,'Morong Bataan');
  const old=process.env.TERRITORY_GEOJSON_PATH;
  try{
    process.env.TERRITORY_GEOJSON_PATH=path.resolve(__dirname,'../../../config/territory/candidates/morong-rizal-ocha-namria-psa.geojson');
    assert.throws(loadPolicy,e=>e.statusCode===503,'A candidate is not an LGU approval attestation');
  }finally{process.env.TERRITORY_GEOJSON_PATH=old;}
});


test('bundled operational boundary enables Morong GPS without a custom path and rejects other towns',()=>{
  const {loadPolicy,assertLocation}=require('../services/geocode/territory');const old=process.env.TERRITORY_GEOJSON_PATH;
  try{
    delete process.env.TERRITORY_GEOJSON_PATH;
    const p=loadPolicy();assert.equal(p.properties.approval_kind,'published-operational');assert.equal(p.properties.certification,'not-lgu-certified');
    assert.doesNotThrow(()=>assertLocation({latitude:14.515,longitude:121.239}));
    for(const [latitude,longitude] of [[14.465,121.191],[14.561,121.208],[14.70204547,120.32067693]])assert.throws(()=>assertLocation({latitude,longitude}),e=>e.statusCode===422);
  }finally{process.env.TERRITORY_GEOJSON_PATH=old;}
});
