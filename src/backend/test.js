/**
 * =============================================================================
 * PULSE-RTIP API Test Runner
 * =============================================================================
 * Runs all API tests against a running server.
 * Usage: node test.js [port]
 * Default port: 3000
 * =============================================================================
 */

const PORT = process.argv[2] || 3005;
const BASE = `http://localhost:${PORT}/api`;

let pass = 0;
let fail = 0;
let adminToken = '';
let citizenToken = '';

function test(name, expected, actual) {
  if (String(expected) === String(actual)) {
    console.log(`  [PASS] ${name}`);
    pass++;
  } else {
    console.log(`  [FAIL] ${name} (expected: ${expected}, got: ${actual})`);
    fail++;
  }
}

async function api(method, path, body, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

async function run() {
  console.log('============================================');
  console.log('  PULSE-RTIP Full API Test Suite');
  console.log(`  Testing against: ${BASE}`);
  console.log('============================================');

  // --- Health Check ---
  console.log('\n--- Health Check ---');
  let r = await api('GET', '/health');
  test('GET /api/health', true, r.success);

  // --- Authentication ---
  console.log('\n--- Authentication ---');

  r = await api('POST', '/auth/login', { email: 'admin@mdrrmo.gov', password: 'admin123' });
  test('TC-AUTH-01: Admin login success', true, r.success);
  test('TC-AUTH-01: Admin role', 'admin', r.data?.user?.role);
  adminToken = r.data?.token;

  r = await api('POST', '/auth/login', { email: 'ray.lopez@email.com', password: 'citizen123' });
  test('TC-AUTH-02: Citizen login success', true, r.success);
  test('TC-AUTH-02: Citizen role', 'citizen', r.data?.user?.role);
  test('TC-AUTH-02: Citizen has notifications', 4, r.data?.notificationCount);
  citizenToken = r.data?.token;

  r = await api('POST', '/auth/login', { email: 'admin@mdrrmo.gov', password: 'wrong' });
  test('TC-AUTH-03: Wrong password (401)', 401, r.status);

  r = await api('POST', '/auth/login', { email: 'nobody@test.com', password: 'x' });
  test('TC-AUTH-04: Non-existent email (401)', 401, r.status);

  const randEmail = `test${Date.now()}@email.com`;
  r = await api('POST', '/auth/register', { name: 'Test User', email: randEmail, password: 'test123456', phone: '0917-000-0000', address: 'Test Brgy' });
  test('TC-AUTH-05: Register new user (201)', 201, r.status);
  test('TC-AUTH-05: Registered as citizen', 'citizen', r.data?.user?.role);

  r = await api('POST', '/auth/register', { name: 'Dup', email: 'admin@mdrrmo.gov', password: 'test123456' });
  test('TC-AUTH-06: Duplicate email (409)', 409, r.status);

  r = await api('POST', '/auth/register', { name: '', email: 'bad', password: '12' });
  test('TC-AUTH-07: Invalid data (400)', 400, r.status);

  // --- User Profile ---
  console.log('\n--- User Profile ---');

  r = await api('GET', '/users/me', null, adminToken);
  test('TC-USER-01: Get admin profile', true, r.success);
  test('TC-USER-01: Has user data', 'MDRRMO Admin', r.data?.name);

  r = await api('PUT', '/users/me', { phone: '0917-999-9999' }, citizenToken);
  test('TC-USER-02: Update phone', '0917-999-9999', r.data?.phone);

  r = await api('GET', '/users/me');
  test('TC-USER-03: No token (401)', 401, r.status);

  // --- Reports ---
  console.log('\n--- Reports ---');

  r = await api('GET', '/reports', null, adminToken);
  test('TC-REPORT-01: Admin gets all reports', true, r.data?.length >= 3);
  test('TC-REPORT-01: Reports have images', true, Array.isArray(r.data?.[0]?.images));

  r = await api('GET', '/reports', null, citizenToken);
  test('TC-REPORT-02: Citizen gets own reports', true, r.data?.length >= 3);

  r = await api('GET', '/reports?status=investigating', null, adminToken);
  test('TC-REPORT-03: Filter by status', true, r.data?.length >= 1);
  test('TC-REPORT-03: All match filter', true, r.data?.every(x => x.status === 'investigating'));

  r = await api('POST', '/reports', { title: 'API Test Flood', type: 'Flood', description: 'Test flood', location: 'Test Location' }, citizenToken);
  test('TC-REPORT-04: Create report (201)', 201, r.status);
  test('TC-REPORT-04: Status is submitted', 'submitted', r.data?.status);

  r = await api('GET', '/reports/1', null, adminToken);
  test('TC-REPORT-05: Get single report', true, r.success);
  test('TC-REPORT-05: Has title', true, !!r.data?.title);

  r = await api('PUT', '/reports/2/status', { status: 'resolved' }, adminToken);
  test('TC-REPORT-06: Admin update status', true, r.success);
  test('TC-REPORT-06: Status updated', 'resolved', r.data?.status);

  r = await api('PUT', '/reports/1/status', { status: 'resolved' }, citizenToken);
  test('TC-REPORT-07: Citizen cannot update (403)', 403, r.status);

  r = await api('POST', '/reports', { title: 'Bad', type: 'InvalidType', description: 'test' }, citizenToken);
  test('TC-REPORT-08: Invalid type (400)', 400, r.status);

  r = await api('GET', '/reports/99999', null, adminToken);
  test('TC-REPORT-05b: Non-existent report (404)', 404, r.status);

  // --- Hazards ---
  console.log('\n--- Hazards ---');

  r = await api('GET', '/hazards', null, citizenToken);
  test('TC-HAZARD-01: List hazards', true, r.data?.length >= 3);

  r = await api('POST', '/hazards', { title: 'Earthquake Warning', severity: 'high', location: 'Morong Center', description: 'Test quake alert' }, adminToken);
  test('TC-HAZARD-02: Admin create hazard (201)', 201, r.status);

  r = await api('POST', '/hazards', { title: 'Test', severity: 'low', location: 'Test' }, citizenToken);
  test('TC-HAZARD-03: Citizen cannot create (403)', 403, r.status);

  // --- Notifications ---
  console.log('\n--- Notifications ---');

  r = await api('GET', '/notifications', null, citizenToken);
  test('TC-NOTIF-01: Has notifications', true, r.data?.notifications?.length >= 4);
  test('TC-NOTIF-01: Has unread count', true, typeof r.data?.unreadCount === 'number');

  test('TC-NOTIF-02: Latest is status update', 'Report Status Update', r.data?.notifications?.[0]?.title);

  // --- Dashboard ---
  console.log('\n--- Dashboard ---');

  r = await api('GET', '/dashboard/stats', null, adminToken);
  test('TC-DASH-01: Admin gets stats', true, r.success);
  test('TC-DASH-01: Has pendingCount', true, typeof r.data?.pendingCount === 'number');
  test('TC-DASH-01: Has hazardsCount', true, typeof r.data?.hazardsCount === 'number');

  r = await api('GET', '/dashboard/stats', null, citizenToken);
  test('TC-DASH-02: Citizen blocked (403)', 403, r.status);

  // --- Hotlines ---
  console.log('\n--- Hotlines ---');

  r = await api('GET', '/hotlines', null, citizenToken);
  test('TC-HOTLINE-01: List hotlines (8)', 8, r.data?.length);
  test('TC-HOTLINE-01: First is MDRRMO', 'MDRRMO', r.data?.[0]?.category);

  // --- Media ---
  console.log('\n--- Media ---');

  r = await api('POST', '/media/upload', null, citizenToken);
  test('TC-MEDIA-02: No file (400)', 400, r.status);

  // --- Error Scenarios ---
  console.log('\n--- Error Scenarios ---');

  r = await api('GET', '/reports', null, 'invalidtoken123');
  test('TC-ERR-02: Invalid token (401)', 401, r.status);

  // --- SUMMARY ---
  console.log('\n============================================');
  console.log(`  RESULTS: ${pass} passed, ${fail} failed`);
  console.log(`  Total:   ${pass + fail} tests`);
  console.log('============================================');

  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test runner error:', err.message);
  process.exit(1);
});
