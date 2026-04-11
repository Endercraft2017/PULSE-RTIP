# PULSE-RTIP Manual Testing Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Authentication Tests](#authentication-tests)
4. [User Profile Tests](#user-profile-tests)
5. [Incident Report Tests](#incident-report-tests)
6. [Hazard Alert Tests](#hazard-alert-tests)
7. [Notification Tests](#notification-tests)
8. [Dashboard Tests](#dashboard-tests)
9. [Media Upload Tests](#media-upload-tests)
10. [Emergency Hotline Tests](#emergency-hotline-tests)
11. [Error Scenario Tests](#error-scenario-tests)
12. [Frontend Integration Tests](#frontend-integration-tests)
13. [Offline Mode Tests](#offline-mode-tests)

---

## Prerequisites

- Node.js v18+ installed
- curl or Postman for API testing
- A web browser for frontend testing

---

## Setup

```bash
# 1. Install dependencies
cd src/backend && npm install

# 2. Run migrations
npm run migrate

# 3. Seed demo data
npm run seed

# 4. Start server
npm start
```

**Server URL:** http://localhost:3000
**API Base:** http://localhost:3000/api

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@mdrrmo.gov | admin123 |
| Citizen | ray.lopez@email.com | citizen123 |

---

## Authentication Tests

### TC-AUTH-01: Admin Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mdrrmo.gov","password":"admin123"}'
```
**Expected:** `success: true`, token returned, `role: "admin"`

### TC-AUTH-02: Citizen Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ray.lopez@email.com","password":"citizen123"}'
```
**Expected:** `success: true`, token returned, `role: "citizen"`, `notificationCount: 4`

### TC-AUTH-03: Login with Wrong Password
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mdrrmo.gov","password":"wrongpassword"}'
```
**Expected:** `success: false`, status 401, message "Invalid email or password."

### TC-AUTH-04: Login with Non-existent Email
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nobody@test.com","password":"test123"}'
```
**Expected:** `success: false`, status 401

### TC-AUTH-05: Register New Citizen
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@email.com","password":"test123456","phone":"0917-000-0000","address":"Test Barangay"}'
```
**Expected:** `success: true`, status 201, token returned, `role: "citizen"`

### TC-AUTH-06: Register with Duplicate Email
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Duplicate","email":"admin@mdrrmo.gov","password":"test123456"}'
```
**Expected:** `success: false`, status 409, message about existing email

### TC-AUTH-07: Register with Invalid Data
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"","email":"notanemail","password":"12"}'
```
**Expected:** `success: false`, status 400, validation errors

---

## User Profile Tests

> **Note:** Save the admin token from TC-AUTH-01 as `$ADMIN_TOKEN` and citizen token from TC-AUTH-02 as `$CITIZEN_TOKEN` for subsequent tests.

### TC-USER-01: Get Own Profile
```bash
curl http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `success: true`, returns admin user data (no password_hash)

### TC-USER-02: Update Profile
```bash
curl -X PUT http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","phone":"0917-999-9999"}'
```
**Expected:** `success: true`, name and phone updated, avatar updated to "U"

### TC-USER-03: Access Without Token
```bash
curl http://localhost:3000/api/users/me
```
**Expected:** `success: false`, status 401, "No token provided"

---

## Incident Report Tests

### TC-REPORT-01: List All Reports (Admin)
```bash
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `success: true`, array of 3 reports (from seed data), each with images array

### TC-REPORT-02: List Own Reports (Citizen)
```bash
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: true`, array of reports submitted by the citizen only

### TC-REPORT-03: Filter Reports by Status
```bash
curl "http://localhost:3000/api/reports?status=investigating" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** Only reports with status "investigating"

### TC-REPORT-04: Create Report
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"New Flood Report","type":"Flood","description":"Flooding near the school","location":"Brgy. San Pedro, Morong"}'
```
**Expected:** `success: true`, status 201, report created with status "submitted"

### TC-REPORT-05: Get Single Report
```bash
curl http://localhost:3000/api/reports/1 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `success: true`, single report object with images array

### TC-REPORT-06: Update Report Status (Admin)
```bash
curl -X PUT http://localhost:3000/api/reports/2/status \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"investigating"}'
```
**Expected:** `success: true`, status updated. **Also check:** notification created for citizen (TC-NOTIF-01)

### TC-REPORT-07: Citizen Cannot Update Status
```bash
curl -X PUT http://localhost:3000/api/reports/1/status \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved"}'
```
**Expected:** `success: false`, status 403, "Admin privileges required"

### TC-REPORT-08: Create Report with Invalid Type
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","type":"InvalidType","description":"test"}'
```
**Expected:** `success: false`, status 400, validation error on type

---

## Hazard Alert Tests

### TC-HAZARD-01: List Hazards
```bash
curl http://localhost:3000/api/hazards \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: true`, array of 3 hazard alerts (from seed data)

### TC-HAZARD-02: Create Hazard (Admin)
```bash
curl -X POST http://localhost:3000/api/hazards \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Earthquake Warning","severity":"high","location":"Morong Center","description":"Magnitude 4.5 detected"}'
```
**Expected:** `success: true`, status 201, hazard created

### TC-HAZARD-03: Citizen Cannot Create Hazard
```bash
curl -X POST http://localhost:3000/api/hazards \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","severity":"low","location":"Test"}'
```
**Expected:** `success: false`, status 403

---

## Notification Tests

### TC-NOTIF-01: Get Citizen Notifications
```bash
curl http://localhost:3000/api/notifications \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: true`, array of notifications with unreadCount

### TC-NOTIF-02: Auto-Generated Notification
1. First update a report status as admin (TC-REPORT-06)
2. Then get citizen notifications (TC-NOTIF-01)

**Expected:** New notification with title "Report Status Update" and the new status

---

## Dashboard Tests

### TC-DASH-01: Get Stats (Admin)
```bash
curl http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `success: true`, data with pendingCount, investigatingCount, resolvedCount, hazardsCount

### TC-DASH-02: Citizen Cannot Access Stats
```bash
curl http://localhost:3000/api/dashboard/stats \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: false`, status 403

---

## Media Upload Tests

### TC-MEDIA-01: Upload Image
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer $CITIZEN_TOKEN" \
  -F "files=@/path/to/test-image.jpg"
```
**Expected:** `success: true`, status 201, file info with path

### TC-MEDIA-02: Upload Without File
```bash
curl -X POST http://localhost:3000/api/media/upload \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: false`, status 400, "No files uploaded"

---

## Emergency Hotline Tests

### TC-HOTLINE-01: List Hotlines
```bash
curl http://localhost:3000/api/hotlines \
  -H "Authorization: Bearer $CITIZEN_TOKEN"
```
**Expected:** `success: true`, array of 8 hotlines sorted by sort_order

---

## Error Scenario Tests

### TC-ERR-01: Invalid JSON Body
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d 'not json'
```
**Expected:** Status 400, JSON parse error

### TC-ERR-02: Expired/Invalid Token
```bash
curl http://localhost:3000/api/reports \
  -H "Authorization: Bearer invalidtoken123"
```
**Expected:** `success: false`, status 401, "Invalid token"

### TC-ERR-03: Non-existent Report
```bash
curl http://localhost:3000/api/reports/99999 \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```
**Expected:** `success: false`, status 404, "Report not found"

### TC-ERR-04: Rate Limiting
```bash
# Send 101 rapid requests
for i in $(seq 1 101); do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/health
done
```
**Expected:** First 100 return 200, subsequent return 429

---

## Frontend Integration Tests

### TC-FE-01: Login Flow
1. Open http://localhost:3000 in browser
2. Enter `admin@mdrrmo.gov` / `admin123`
3. Click "Log in"

**Expected:** Redirected to admin-home page, welcome message shows "MDRRMO Admin"

### TC-FE-02: Citizen Login Flow
1. Open http://localhost:3000
2. Enter `ray.lopez@email.com` / `citizen123`
3. Click "Log in"

**Expected:** Redirected to citizen-home, hazard alerts loaded from API, stats show real counts

### TC-FE-03: Admin Dashboard
1. Login as admin
2. Navigate to Dashboard (bottom nav)

**Expected:** Stats loaded (Pending/Investigating/Resolved/Hazards counts), incident list populated from API

### TC-FE-04: My Reports Page
1. Login as citizen
2. Navigate to Reports (bottom nav)

**Expected:** Reports list loaded from API with real data, filter tabs work

### TC-FE-05: Hazard Zones Page
1. Login as any user
2. Navigate to Hazards

**Expected:** Hazard alerts loaded from API with severity badges and descriptions

### TC-FE-06: Notifications Page
1. Login as citizen
2. Click notification bell

**Expected:** Notifications loaded from API, unread count badge updates

### TC-FE-07: Emergency Page
1. Login as citizen
2. Navigate to Emergency

**Expected:** Hotline numbers displayed (currently static in frontend)

### TC-FE-08: Logout
1. Navigate to Profile
2. Click "Logout"

**Expected:** Redirected to login, token cleared from localStorage

---

## Offline Mode Tests

### TC-OFFLINE-01: SQLite Mode
1. Set `APP_MODE=offline` in `.env`
2. Run migrations and seed
3. Start server

**Expected:** Server starts with "[DB] SQLite database at..." message

### TC-OFFLINE-02: Full Workflow in Offline Mode
1. Register a new user
2. Login
3. Create a report
4. View reports list
5. (As admin) Update report status
6. Check notifications

**Expected:** All operations work identically to production mode

---

## Test Checklist Summary

| # | Test | Status |
|---|------|--------|
| TC-AUTH-01 | Admin Login | [ ] |
| TC-AUTH-02 | Citizen Login | [ ] |
| TC-AUTH-03 | Wrong Password | [ ] |
| TC-AUTH-04 | Non-existent Email | [ ] |
| TC-AUTH-05 | Register New Citizen | [ ] |
| TC-AUTH-06 | Duplicate Email | [ ] |
| TC-AUTH-07 | Invalid Registration Data | [ ] |
| TC-USER-01 | Get Profile | [ ] |
| TC-USER-02 | Update Profile | [ ] |
| TC-USER-03 | Access Without Token | [ ] |
| TC-REPORT-01 | List Reports (Admin) | [ ] |
| TC-REPORT-02 | List Reports (Citizen) | [ ] |
| TC-REPORT-03 | Filter by Status | [ ] |
| TC-REPORT-04 | Create Report | [ ] |
| TC-REPORT-05 | Get Single Report | [ ] |
| TC-REPORT-06 | Update Status (Admin) | [ ] |
| TC-REPORT-07 | Citizen Cannot Update | [ ] |
| TC-REPORT-08 | Invalid Report Type | [ ] |
| TC-HAZARD-01 | List Hazards | [ ] |
| TC-HAZARD-02 | Create Hazard (Admin) | [ ] |
| TC-HAZARD-03 | Citizen Cannot Create | [ ] |
| TC-NOTIF-01 | Get Notifications | [ ] |
| TC-NOTIF-02 | Auto-Generated Notification | [ ] |
| TC-DASH-01 | Dashboard Stats | [ ] |
| TC-DASH-02 | Citizen Cannot Access | [ ] |
| TC-MEDIA-01 | Upload Image | [ ] |
| TC-MEDIA-02 | Upload Without File | [ ] |
| TC-HOTLINE-01 | List Hotlines | [ ] |
| TC-ERR-01 | Invalid JSON | [ ] |
| TC-ERR-02 | Invalid Token | [ ] |
| TC-ERR-03 | Non-existent Report | [ ] |
| TC-ERR-04 | Rate Limiting | [ ] |
| TC-FE-01 | Admin Login Flow | [ ] |
| TC-FE-02 | Citizen Login Flow | [ ] |
| TC-FE-03 | Admin Dashboard | [ ] |
| TC-FE-04 | My Reports Page | [ ] |
| TC-FE-05 | Hazard Zones Page | [ ] |
| TC-FE-06 | Notifications Page | [ ] |
| TC-FE-07 | Emergency Page | [ ] |
| TC-FE-08 | Logout | [ ] |
| TC-OFFLINE-01 | SQLite Mode | [ ] |
| TC-OFFLINE-02 | Full Offline Workflow | [ ] |
