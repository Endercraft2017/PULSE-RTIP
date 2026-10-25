# Morong dispatch correctness review — 25 October 2026

## Follow-up

The initial boundary blocker described below was subsequently resolved with
the application owner's explicit authorization to use published operational
data. See verification-operational-boundary.md for the activated data, tests
and deployment evidence. The earlier matrix is a historical baseline.

## Scope and interpretation

Work is on `dev/frontend-webapp`, based on `554128078fba1c112d0065afc91bd283ad0e226f`.
The initial implementation is recorded in commit 3758706. A subsequent map
availability regression fix is documented in verification-map-display-fix.md. Production
deployment has not been verified. Leaflet is retained;
no Google Maps key, billing account, or provider migration was introduced.
“Verified” below means the named local evidence, not a production or phone claim.
The user authorized independent source selection; no approximate geometry has
been represented as LGU-approved. Production location readiness remains blocked.

## Baseline and reproduced failures

Before changes, 17 backend tests and 34 Playwright tests passed. Three new
regressions failed against that baseline: a blank cancellation reason was
accepted; account-control endpoints were absent; incident-priority endpoints
were absent. The existing territory validator explicitly rejected Morong and
required its exclusion polygon, contradicting the new authoritative policy.
That validator and its tests/configuration contract have been replaced.

## Requirement-to-evidence matrix

| Requirement | Status | Implemented behavior and independent evidence | Remaining limit / deployment dependency |
| --- | --- | --- | --- |
| 1. Morong-only GPS and map territory | **Blocked** for production; validator locally verified | Real HTTP tests reject outside/denied GPS on report, hazard, advisory, call and SMS-conversion paths; Morong text cannot override GPS. Tests cover edges, holes, MultiPolygon, missing GPS, missing provenance, and obsolete exclusion policy. Playwright tests constrained panning and hides the map when configuration is unavailable. | A certified Morong boundary is not installed. All new location writes remain closed until the approved file and metadata are supplied. Viewport bounds/masking are presentation; backend polygon checks enforce eligibility. |
| 2. Archive controls and retained records | **Verified (local)** | Shaded Archive bars apply to active and terminal incidents. Tests retain rows, attachments/dependencies and history; permanent-delete API/model/SQL attempts fail. Repeated archive/restore attempts cannot add duplicate history. | Apply migrations 034–035 and rebuild clients; do not grant the application permission to drop retention triggers. |
| 3. Append notes with actor and agency | **Verified (local)** | Report and hazard detail forms append notes. HTTP and browser tests retain older notes and verify agency snapshots after agency reassignment. | Agency assignment must be configured. Notes are visible to authorized report owners/admins or shared-hazard readers; do not use shared notes for private medical information. |
| 4. Atomic changes and authorized history | **Verified (local)** | Injected audit/history failures roll back status, cancellation, priority and account changes. SMS conversion now commits report, staging link, event and audit together. Concurrent duplicate status requests yield one event and one status notification. Unrelated citizens cannot read report history. | MySQL execution is unverified; local transaction/concurrency evidence uses SQLite. In-flight requests already authorized before a suspension are not cancellable remote operations. |
| 5. Philippine timeline | **Verified (local)** | Millisecond UTC instants, explicit Asia/Manila display and event-ID ordering. Browser tests run in America/New_York and confirm Philippine display. Admin clock diagnostics compare server/DB samples and report storage/display conventions. | NTP/host synchronization is not established by a timezone or sample comparison. Historical entered-event time is not inferred from logging time. |
| 6. GPS editing, stable pins and advisories | **Verified (local)** | Playwright exercises real pointer dragging for report and hazard pins, manual coordinate saving, audited reasons, stable marker identity, unsaved edits across polling, safe advisory labels, cancellation and citizen read-only controls. | Actual LGU geometry and live basemap/physical phone interaction remain unverified. Boundary configuration is required; an old backend map-config is incompatible with the new boundary-gated client. |
| 7. Critical SMS/push dispatcher | **Implemented but unverified** for real delivery | Critical/high hazards and not-passable advisories enqueue all active registered users transactionally. Duplicate enqueue tests create one event; per-address rows identify no_contact, queued, accepted, retry, failed and uncertain outcomes. Controlled provider stubs prove partial retries exclude accepted devices and ambiguous timeouts are not blindly resent. Recipient details are admin-only. | No real broadcast was sent. Credentials, controlled test endpoints and provider/handset evidence are unavailable. There is no delivery-receipt webhook: accepted is not delivered. No exact simultaneous arrival guarantee. Run one recovery worker per database; ambiguous sends require manual provider reconciliation. |
| 8. Editable live hotlines with original layout | **Verified (local)** | Admin contact CRUD and original MDRRMO/category/carrier/911 layout remain. Playwright changes a contact while the screen is open, observes its five-second refresh, then verifies cached updated numbers and a stale-data warning offline. | Built-in fallback numbers are not independently certified here. Offline copies can become stale and are labelled accordingly. |
| 9. Account control and existing sessions | **Verified (local)** | Admins list accounts, require a reason and suspend/deactivate/reactivate citizens. Tests reject unauthorized/admin-target/blank-reason actions, block existing sessions and login, and prove reactivation does not revive an old token. Identity/history are retained. | Reactivated users must log in again. Controls deliberately cannot suspend admin accounts or self-assign agency/role. |
| 10. Priority levels and critical highlight | **Verified (local)** | Controlled low/medium/high/critical values, admin-only assignment with reason, append-only priority history, red critical card highlight. HTTP/Playwright tests inspect persisted priority and history. | Apply migration 034 and use updated frontend/APK. Critical incident priority itself does not create an unrequested all-user broadcast. |
| 11. Current status in the list | **Verified (local)** | Incident cards have a directly visible status box alongside priority; it is not arbitrary editable status text. Playwright verifies it without opening Details. | Requires refreshed web assets or rebuilt APK. |
| 12. Required cancellation reason | **Verified (local)** | A required textarea blocks blank/whitespace notes, preserves form input on errors, and submits one reason with an eligible owner cancellation. UI and direct API tests inspect stored cancellation/history; another user and invalid status cannot cancel. | Only submitted/pending/investigating reports are cancellable. Backend and client must be deployed together. |

## Geography source decision

Selected source of record: certified Morong LGU/municipal planning boundary data
with an approval record. Government reference catalog inspected:
https://www.geoportal.gov.ph/ . Its WMS advertised
`municipalbndry_20210504`, **Municipal Boundary (APPROXIMATE)**, updated
2021-05-04. The WFS schema request returned 401. This does not establish LGU
approval or a legally accurate enforcement polygon. No geometry was extracted
from pixels or fabricated. See `config/territory/source-review.json` for URLs,
response digest, observations and decision, and `config/territory/README.md`
for the install contract. Metadata strings are operator attestation, not a
substitute for verifying the actual approval document.

## Production observations

Read-only requests to `https://pulse.afkcube.com` succeeded on 25 October 2026.
Health returned UTC `2026-10-25T10:28:51.351Z`; the local observation was
`2026-10-25T10:28:51.704067+00:00`, including request/processing time. This
single sample is not proof of NTP synchronization. The deployed
`public/js/components/incident-map.js` was byte-identical to commit `381638a`.
The old health response did not expose a build commit, so the full deployed
server revision is not established. New health responses expose the host's
Railway/GitHub commit when supplied. No production records were modified,
no live authenticated admin session was used, and no provider blast was sent.

## Verification artifacts and rollout

Final verification:

- Backend: **33 passed, 0 failed** (`test-results/verification/backend-tests.log`).
- Playwright: **41 passed, 0 failed**, no unhandled browser errors
  (`test-results/verification/playwright-full-results.json`). A subsequent
  focused archive/priority check also passed after the final Archive tab label
  and shading adjustment (`playwright-archive-smoke.json`).
- Android: `:app:assembleDebug` succeeded. APK v2 signature verification passed;
  unpacked frontend files byte-match the reviewed source. The APK includes a
  build-info manifest distinguishing the local worktree from its base commit.
- APK: `/workspace/artifacts/PULSE-911-morong-review-debug.apk` (8,098,530 bytes).
- APK SHA-256: `3c1dca5e2ffdbe4984e1f159fedefaf5a1fa0646109c943e3fc7a5fadfda8298`.
- Packaged runtime fingerprint:
  `7e5fefb4218aa11fd3b7e0c9b0876491baa9eccd84d7a9428ddeef22b214dce8`.
- `git diff --check` and affected JavaScript syntax checks passed.
- Evidence artifacts are ignored local outputs, not source-controlled production
  data. Browser screens/traces use synthetic accounts and locations.
- Physical phone, live SMS/FCM delivery, MySQL, certified-boundary accuracy and
  host NTP synchronization are **not verified**.
Tests use isolated databases and synthetic geometry, blank provider bindings,
and mocked external tile images. This evidence must not be described as a
live-boundary, carrier/Firebase, NTP, MySQL or physical-device certification.

Before rollout: back up the database; apply pending migrations; configure the
approved boundary and admin agencies; deploy backend and web assets together;
rebuild/reinstall the APK using the existing signing identity where applicable;
then verify account control, GPS, history and controlled notifications on a
physical device. Do not uninstall an app containing unsynced data merely to
bypass a signing mismatch. Do not publish a production-readiness claim while
boundary or delivery evidence is missing.
