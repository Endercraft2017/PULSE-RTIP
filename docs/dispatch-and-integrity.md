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

## Territory policy: Morong, Rizal only

Only positions inside an approved Morong, Rizal boundary are accepted. This
supersedes the previous Morong exclusion; old configurations fail closed.
See [the boundary contract](../config/territory/README.md) for provenance,
required metadata, edge/hole behavior, and the government source investigation.
No certified production polygon was available during this task. Location
writes remain blocked until one is supplied; test fixtures are synthetic.
Typed addresses and reverse geocoding never override GPS validation.

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
  unconfigured categories retain the original fallback contacts. Open screens
  refresh every five seconds. Last successful numbers are cached locally, with
  a warning if updates cannot be checked. Call 911 remains available.
- **Calls:** create a call record, add missing contact details, edit notes and
  move between received, dispatched and closed. Call details are admin-only.
- **Advisories:** publish a coordinate, label and road status (not_passable,
  caution or clear), or deactivate an advisory.
- **Users:** view registered accounts and suspend/deactivate/reactivate citizen
  accounts with a required reason. Existing sessions are revoked permanently;
  reactivation requires a new login. Admin accounts cannot be restricted here.
- **Broadcasts:** inspect provider batches and recipient outcomes. Detailed
  endpoint lists are admin-only; no citizen can access recipient data.

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

Resolving or rejecting an incident requires a reason. Priorities are controlled
values (low, medium, high, critical) with an audited reason; critical cards are
highlighted. Current status is shown directly on each dashboard incident card.
Active records have a shaded Archive bar, and repeated archival cannot create
duplicate history. Timeline/audit rows are protected from UPDATE/DELETE.

Resolving an incident requires a note. Reports originating from SMS can have
no registered owner; they now resolve without trying to insert an invalid
owner notification. Citizens retain the existing permission to cancel their
own eligible reports with a required nonblank cancellation reason. Cancellation
and its history/audit commit together. They cannot resolve another account's report or use admin-only priority and account-control APIs.

## Leaflet maps and GPS editing

Leaflet 1.9.4 and its marker assets are bundled in `public/vendor/leaflet`
under its BSD license. No Google API key or billing account is required.
Basemap images use `https://tile.openstreetmap.org/{z}/{x}/{y}.png`;
OpenStreetMap attribution stays visible. Follow the public tile
[usage policy](https://operations.osmfoundation.org/policies/tiles/):
no bulk downloads or offline prefetching, and preserve normal browser caching.
Public tiles have no uptime guarantee; assess a suitable tile provider before
large deployments. This app does not download tiles for offline use.

The main Hazard Zones Map and report/hazard details use interactive Leaflet
maps. Admins drag pins, enter correction reasons and save; citizens can pan and
view shared locations. All saves still enforce admin permissions, agency
assignment and the approved Morong-only territory boundary.
Manual coordinate fields remain available if basemap tiles are unavailable.

Active road advisories appear as labeled markers with safe text tooltips and
popups. Locations and advisories refresh every five seconds using existing
marker instances and `setLatLng`. Polling does not overwrite unsaved drag edits.
Closing the dialog or leaving the page releases timers, maps and listeners.
Advisories are staff-entered road conditions, not an automatic traffic feed.

## SMS and push delivery

High/critical hazards, hazards first elevated to urgent severity, and newly
issued active not-passable advisories enqueue urgent broadcasts to **all
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
accepted, partial, failed or uncertain. Blocked jobs retain their retry allowance.
Transient failures retry up to five attempts. Successful push recipients are
removed from a partially failed retry batch. Accepted means the provider
accepted a request; it is not a handset receipt. Provider timeouts can have an
ambiguous outcome and are held for review instead of automatically retried. Jobs interrupted by a
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
Map identity, actual pointer dragging and rendering are checked with bundled Leaflet in Chromium;
external tile images are stubbed in tests. Live tile availability, carrier/Firebase delivery, Android background
notifications and live MySQL remain deployment validation tasks.


The repeatable Playwright suite lives in `tests/browser/test_dispatch.py`.
See `tests/browser/README.md` for installation and execution. It uses a fresh
server/database for every run, signs in through the real authentication paths,
blocks external browser requests and writes failure screenshots/traces plus a
JSON result summary under the ignored `test-results/playwright/` directory.

## Delivery integrity and deployment limits

Enqueue is idempotent per source record and urgency phase, in the same transaction
as its domain action. Critical hazards and not-passable advisories target all
active, non-deleted registered users regardless of barangay. Legacy high-severity
hazards retain urgent behavior; explicit critical severity is also supported.
Unclaimed devices and restricted accounts are excluded. Missing phone/device
endpoints are recorded as no_contact rather than silently counted as reached.

Each address has queued/accepted/retry/failed/uncertain/no_contact state and a
provider reference when supplied. Shared phone numbers are deduplicated. Push
partial failures retry only explicitly rejected transient tokens, preserving
accepted recipients. Timeouts and ambiguous exceptions are held uncertain;
blind retry could duplicate a message already accepted by the provider. Safe
rejections have bounded retries; exhausted retries fail visibly. Job summaries
can be partial when other addresses lack contact endpoints or fail.

There is no automatic delivery-receipt integration in this implementation.
Accepted means provider accepted, never handset delivered. Confirming delivery
requires authenticated provider callbacks or controlled handset evidence. Real
provider/handset verification remains unperformed without credentials and test
recipients. Provider acceptance cannot guarantee simultaneous handset arrival.

Run one outbox worker instance for this deployment. Startup recovery treats
in-flight sending jobs as uncertain. A distributed worker lease and automated
reconciliation are not implemented; do not enable multiple startup recovery
workers against a live outbox. A crash after provider acceptance but before DB
commit requires manual provider reconciliation, not a blanket retry.

`GET /api/operations/clock` gives admins server/database UTC samples and the
Manila display convention. It does not verify NTP synchronization. Health
responses expose the Railway/GitHub source commit if the host supplies it.
