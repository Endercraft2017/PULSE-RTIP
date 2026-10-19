# Dispatch, retention and territory configuration

Table of contents: setup, territory policy, admin workflow, maps, delivery,
timekeeping, verification, and deployment limits.

## Setup and schema upgrades

Use Node.js 22 (`.nvmrc`; the deployment image already uses Node 22). The
SQLite driver's native binary must be installed using the same Node major
version used to run the server. From `src/backend`:

```sh
npm ci
npm run migrate
npm test
npm start
```

Back up existing databases before deployment. The migration ledger prevents
replaying destructive legacy table rebuilds; the report rebuild is also
skipped on older databases that already contain its `source` column.
Container startup now applies pending SQLite migrations to existing databases.
Do not seed a live database.

For an **existing MySQL installation with the pre-dispatch schema (through
migration 030) already applied**, run:

```sh
APP_MODE=production node ../database/migrations/migrate.js --upgrade-dispatch
```

This applies only migrations 031 onward and uses MySQL syntax for retention
triggers, primary keys and millisecond datetime columns. It requires schema
migration privileges, including CREATE TRIGGER. The old bootstrap migrations
contain SQLite-specific statements and are not a fresh MySQL bootstrap path.
MySQL execution has not been validated against a live server in this task.

## Territory policy: submissions are blocked until configured

The requested policy explicitly excludes **Morong**. The allowed territory is
unknown, so no production boundary has been guessed or included. Existing
records remain readable, resolvable and archivable. New reports, hazards,
road advisories, GPS corrections and newly supplied call locations require a
valid configured territory. Calls without a location may still be recorded
and have their phone numbers added later. Raw inbound SMS remains in staging;
it cannot be promoted to an incident without an approved GPS location.

Set `TERRITORY_GEOJSON_PATH` to an administrator-controlled local GeoJSON file.
It must contain a FeatureCollection with at least one Polygon or MultiPolygon
whose `properties.mode` is `allow`, and a `deny` feature named Morong. Supply
authoritative boundaries for the actual allowed territory and the Morong
exclusion. Test polygons in the regression suite are synthetic and must not
be used for deployment. Coordinates use GeoJSON order: **longitude, latitude**.
Polygon holes are respected. Denials take precedence over allowed polygons.
A location text containing the word Morong is rejected even if its supplied
GPS is elsewhere. Missing, malformed or unreadable boundaries fail closed.
GPS is required; an address alone never establishes territorial eligibility.

An administrator should supply this file through deployment configuration;
there is deliberately no public boundary-editing endpoint. Restart the
server after changing environment bindings; boundary file contents are read
at validation time. This rule does not remove or rewrite historical records.

## Admin and citizen workflows

Open **Dashboard → Directories, calls & road advisories**:

- **Responders:** assign each admin to MDRRMO, Bureau of Fire Protection,
  Police Department or Health Unit. An unassigned admin must select an agency
  before performing operational changes. Assignments can be managed here;
  citizen profile updates cannot self-assign an agency.
- **Barangays:** add, rename, describe or deactivate directory profiles. Rename
  updates user, device and hazard audience associations in one transaction.
  Free-text historical report addresses are preserved. Online forms refresh
  the directory; offline use retains the last successful directory cache.
- **Emergency contacts:** add or correct hotline numbers. The citizen Emergency
  page keeps its original MDRRMO hotline card, category tabs, carrier badges
  and contact-card layout. Managed numbers update their matching categories;
  unconfigured categories retain the original fallback contacts. Call 911 remains available.
- **Calls:** create a call record, add missing contact details, edit notes and
  move between received, dispatched and closed. Call details are admin-only.
- **Advisories:** publish a coordinate, label and road status (not_passable,
  caution or clear), or deactivate an advisory.
- **Broadcasts:** inspect queued provider batches and their outcomes. Payloads
  and recipient phone/device lists are not exposed by this endpoint.

Report and hazard detail dialogs show processing history. Admins can add
progress notes without changing status, including after resolution. Citizens
can read notes on their own reports and the shared hazard history. All notes
are public to those authorized readers; do not enter private medical details
in shared notes. Each action stores the actor, agency snapshot and timestamp.
Later staff reassignment does not rewrite previous agency associations.
Privileged mutations, history and audit writes commit atomically in the new
workflows. A failed history/audit write rolls the mutation back.

Reports and hazards are **archived**, never purged. Their files, event rows,
notifications and promoted-post associations are retained. The Archive tab
supports restoration. Legacy `/permanent` DELETE requests receive HTTP 405;
model compatibility methods reject purge attempts, and database triggers
block direct DELETE statements on report/hazard tables. Keep application DB
credentials unable to drop retention triggers or tables.

Resolving an incident requires a note. Reports originating from SMS can have
no registered owner; they now resolve without trying to insert an invalid
owner notification. Citizens retain the existing permission to cancel their
own eligible reports; they cannot mark incidents resolved as an admin.

## Google Maps and GPS editing

Set `GOOGLE_MAPS_BROWSER_KEY` to a browser key with Maps JavaScript API enabled,
billing configured, and HTTP-referrer restrictions for the deployed origins.
This is a public browser key, not a private server credential. Permit access
to `maps.googleapis.com` and the Google Maps asset hosts (including
`maps.gstatic.com`) in the deployment's egress/browser policy as required.
Never place service-account credentials in this variable.

The main Hazard Zones Map view now uses Google Maps rather than the static
Morong image. Admins can drag a hazard pin, provide a correction reason and
save or cancel the repositioning inline. Citizens can pan/view the map but
cannot edit shared hazard locations. Hazard details also include an editable
map for admins. Without a Google Maps key, the main view explains the missing
configuration and links to Details for manual coordinate entry.

Report details include a map. Admins can drag a report marker or enter
coordinates, provide a correction reason and save. The API enforces admin
permissions and territory validation. Coordinate fields remain usable when
Google Maps is unavailable; the map panel explains the missing configuration.
Active road advisories appear as labeled markers. Report/advisory updates are
polled every five seconds while the dialog is open. Marker instances are
updated with `setPosition`, not rebuilt. Unsaved or active drag edits are not
overwritten by polling. Closing the dialog releases timers and listeners.
Advisories represent staff-entered local road conditions, not an official
Google road closure or traffic feed.

## SMS and push delivery

High-severity hazards, hazards elevated to high severity, and newly issued or
changed active not-passable advisories enqueue urgent broadcasts to **all
registered active users**, including responders. Lower-severity alerts respect
the chosen audience. In-app notifications are also created transactionally.
The outbox persists across restarts and dispatch starts after commit; pending
work is checked every 30 seconds. New jobs take priority, and blocked/retry
batches rotate by their last attempt so an unavailable SMS channel cannot
starve later push work. Batches run with bounded parallelism (four
provider calls), 50 SMS recipients or 500 push tokens per batch. Provider and
carrier rate limits mean delivery cannot be literally simultaneous.

Configure TextBee in **App Settings** or through `TEXTBEE_API_KEY` and
`TEXTBEE_DEVICE_ID`. The gateway phone needs its TextBee app running, network
access, a working SIM and sufficient SMS service/credit. The default API host
is `api.textbee.dev`. SMS can reach recipients without Internet when they have
cellular service; it cannot guarantee delivery where there is no signal.

Configure Firebase using `FIREBASE_SERVICE_ACCOUNT_PATH` (a securely mounted
service-account file) or the existing `FIREBASE_SERVICE_ACCOUNT_JSON` binding.
Do not commit either value. Allow the configured Firebase/Google OAuth and FCM
endpoints, including `oauth2.googleapis.com` and `fcm.googleapis.com`. Devices
must register tokens and permit notifications. Push requires Internet access;
mobile background behavior still depends on the app and operating system.

Job statuses are pending, blocked (credentials missing), sending, retry,
accepted, failed or uncertain. Blocked jobs retain their retry allowance.
Transient failures retry up to five attempts. Successful push recipients are
removed from a partially failed retry batch. Accepted means the provider
accepted a request; it is not a handset receipt. Provider timeouts can have an
ambiguous outcome and may produce duplicates on retry. Jobs interrupted by a
server restart are marked uncertain rather than automatically resent. Verify
provider records before manually retrying uncertain/failed work. This version
has no dashboard retry button or delivery-receipt webhook. Run one broadcast
worker instance per database; scaling multiple worker processes requires a
lease/heartbeat design for crash recovery.

No real SMS or Firebase delivery was verified in this environment. Tests use
unconfigured providers or deterministic mocks and never send emergency blasts.

## Timekeeping

The Node process uses `Asia/Manila`; MySQL connections use UTC sessions and
both databases persist UTC instants. Millisecond history timestamps and
monotonic event IDs preserve the order in which actions were logged.
Display formatting explicitly uses `Asia/Manila`, even when a browser uses a
different timezone. Legacy naive database timestamps are interpreted as UTC.
Do not convert stored historical UTC data to local clock strings. Hosts and
the database server must maintain a synchronized clock (NTP or equivalent);
application timezone handling cannot repair a host clock or infer the real
occurrence time of an event entered later.

## Verification

`cd src/backend && npm test` runs isolated HTTP/database regression tests:
territory denials, null-owner resolution, mandatory resolution notes,
transaction rollback, role permissions, agency snapshots, coordinate audits,
archive retention guards, directory rename associations, calls/contacts,
critical broadcast scope, provider retry behavior and repeatable migrations.
It uses synthetic boundary fixtures and creates no live messages.

Chromium smoke checks cover directory/call forms, report/hazard notes,
citizen history access and Philippine timestamps from another device timezone.
Map marker identity and dragging were checked with a mocked Google SDK.
Live Google Maps rendering, carrier/Firebase delivery, Android background
notifications and live MySQL remain deployment validation tasks.


The repeatable Playwright suite lives in `tests/browser/test_dispatch.py`.
See `tests/browser/README.md` for installation and execution. It uses a fresh
server/database for every run, signs in through the real authentication paths,
blocks external browser requests and writes failure screenshots/traces plus a
JSON result summary under the ignored `test-results/playwright/` directory.
