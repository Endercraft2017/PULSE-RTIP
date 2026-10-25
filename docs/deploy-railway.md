# Deploying PULSE-RTIP to Railway

One Railway service runs the Express backend and serves the web frontend.
It uses SQLite (the same mode the migrations are written for) on a
persistent Railway **volume**, which also holds uploaded photos and videos.

Repo files involved: `Dockerfile`, `.dockerignore`, `railway.json`,
`scripts/railway-start.sh`.

## 1. Create the service

1. Push this branch to GitHub.
2. Railway → **New Project** → **Deploy from GitHub repo** → `Endercraft2017/PULSE-RTIP`.
3. Service **Settings → Source**: pick the branch to deploy. Leave **Root Directory** empty (the repo root).
   Railway reads `railway.json` and builds with the `Dockerfile`.

## 2. Add a volume (required)

The container's disk is wiped on every deploy. Without a volume you lose
the database and all uploads on each deploy.

Service → **Settings → Volumes → New Volume**, mount path: `/data`

## 3. Variables

Service → **Variables**:

| Variable | Value |
|---|---|
| `APP_MODE` | `offline` (SQLite; do not use `production`, the migrations are SQLite-only) |
| `SQLITE_PATH` | `/data/pulse_rtip.db` |
| `UPLOAD_DIR` | `/data/uploads` |
| `JWT_SECRET` | a long random string (**do not** reuse the example value) |
| `JWT_EXPIRES_IN` | `24h` |
| `MAX_FILE_SIZE` | `5242880` |
| `TEXTBEE_API_KEY`, `TEXTBEE_DEVICE_ID`, `TEXTBEE_GATEWAY_PHONE` | copy from the current server's `.env` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | contents of the Firebase service-account JSON (paste as-is, or base64) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | if email is used |
| `NEWSAPI_KEY` | optional |
| `TERRITORY_GEOJSON_PATH` | Optional custom boundary file; leave unset to use the bundled, user-authorized published Morong polygon |

Do not set `PORT`. Railway injects it and the server reads it.

## 4. First deploy

The start script applies pending migrations on every boot. A migration ledger
prevents re-running completed migrations, and the legacy report-table rebuild
is skipped when its `source` column already exists. **Back up the database
before deploying this upgrade.** Do not seed a database containing real users.
See [dispatch and integrity configuration](dispatch-and-integrity.md) for the
separate upgrade command for an existing MySQL installation.

Create the first admin with the Railway CLI (`npm i -g @railway/cli`, `railway login`, `railway link`):

```sh
railway ssh
cd /app/src/backend
npm run provision-admin -- --email "admin@mdrrmo.gov" --name "MDRRMO Admin" --phone "09171234567" --password "<strong password>"
```

Check it's up: `https://<service>.up.railway.app/api/health` should return 200.

### Loading the demo accounts without SSH

To load the demo data (`admin@mdrrmo.gov` / `admin123`,
`ray.lopez@email.com` / `citizen123`, plus sample reports, hazards and
posts), set the service variable `SEED_DEMO=1` and redeploy. The start
script runs `npm run seed` only while the `users` table is empty, and
otherwise logs `skipping seed`. The seed inserts rows with hard-coded user
IDs, so it must never run against real accounts. Delete the variable once
the deploy logs show `[Seed] Database seeded successfully.`

Change the demo passwords before real people use the site.

### Bringing over the existing data instead

To keep the current users and reports, copy the live
`pulse_rtip.db` and the `uploads/` folder from the Hostinger server into the
volume **before** the first real use. Stop the old backend first so the
SQLite file is consistent (or run `sqlite3 pulse_rtip.db ".backup copy.db"`).
Then place the file at `/data/pulse_rtip.db` and the images under
`/data/uploads/`, and redeploy. On startup, pending migrations are applied to the copied database; take and
retain a recoverable backup before performing the upgrade.

## 5. Domain (keeps the Android app working)

The APK has `https://pulse.afkcube.com` hard-coded (`DEFAULT_SERVER_URL` in
`src/frontend/public/js/utils/store.js`, `allowNavigation` in
`capacitor.config.ts`). Keep that hostname so the existing API address continues working:

1. Service → **Settings → Networking → Custom Domain** → `pulse.afkcube.com`.
2. At the DNS provider for `afkcube.com`, replace the current `A` record for
   `pulse` with the `CNAME` (and TXT verification record, if shown) that Railway gives you.
3. Wait for Railway to show the certificate as issued, then test `/api/health` on the domain.

The old server stops getting traffic once DNS switches over. Shut it down only after the
Railway service is confirmed working.

## Notes

- **Single replica only.** SQLite on a volume cannot be shared across
  replicas. Keep the service at 1 instance.
- The SMS poller runs inside the web process, so it moves to Railway with it.
- Backups: Railway volumes support backups (service → Volumes → Backups). Turn on a schedule.


## 6. Activate the interactive map

Deploy the latest `dev/frontend-webapp` revision containing the Leaflet migration for the interactive
Hazard Zones map and restored categorized Emergency screen. A Git push alone
is not proof of deployment: verify the service source branch and deployment
logs. The provided Dockerfile uses Node 22 and serves the API and web frontend
in the same service; a separate map server is not needed.

1. Leaflet 1.9.4 is bundled with the frontend. No Google API key, Google Cloud
   account, billing setup or separate map service is required.
2. Allow browser/WebView HTTPS image requests to `tile.openstreetmap.org`.
   Standard OpenStreetMap tiles require visible attribution and compliance with
   https://operations.osmfoundation.org/policies/tiles/ (no bulk downloads or
   offline prefetching). The app keeps attribution visible and uses normal browser
   caching. Public tiles have no SLA; review capacity before a large rollout.
3. In **Dashboard → Directories, calls & road advisories → Responders**, assign
   an agency to the admin who will save coordinate changes.
4. The Morong, Rizal operational boundary is bundled with the backend. Leave
   `TERRITORY_GEOJSON_PATH` unset to use it. Its NAMRIA/PSA/OCHA/HDX provenance
   and non-LGU-certified status are displayed accurately. No GIS server, extra
   download, or separate certificate is required for operational saves.
   An explicit custom override still takes precedence and must be valid; remove
   a stale override to use the bundled default. See the
   [boundary contract](../config/territory/README.md). Every location save is
   validated server-side; outside-Morong GPS remains rejected.

The main Hazard Zones **Map** view should load Leaflet with OpenStreetMap tiles and show current
hazards at their saved GPS positions. Admins drag a pin, enter a reason and
save the correction; citizens can pan/view but cannot alter shared pins.
If tiles cannot load, the app displays a connection message; pin and manual coordinate editing remain available.

## 7. Update installed Android apps

`capacitor.config.ts` has `webDir: 'src/frontend'` and no remote `server.url`.
That means JavaScript, page layouts and map components are packaged in the APK.
Updating the server or keeping the same domain does **not** update these assets
inside an already installed app.

From the updated checkout on a machine with Node, JDK and the Android SDK:

```sh
npm ci
npx cap sync android
cd android
./gradlew assembleDebug
```

On Windows, `install-on-phone.bat` runs the sync, build and USB-install workflow;
the direct Gradle command is `gradlew.bat assembleDebug`. Install the resulting
`android/app/build/outputs/apk/debug/app-debug.apk` on test phones. Use the
existing signing key for updates to a previously signed app; this debug build
is for testing. Do not uninstall an app with unsynced data merely to bypass a
signing mismatch. For release distribution, use the project's existing signing
and release procedure.

Confirm the installed version shows the categorized Emergency cards and the
interactive Hazard Zones map, then verify a permitted coordinate correction is
still present after reloading. Web-browser users need the updated server
frontend rather than an APK rebuild.
