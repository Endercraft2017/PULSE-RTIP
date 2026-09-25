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

Do not set `PORT`. Railway injects it and the server reads it.

## 4. First deploy

On first boot `scripts/railway-start.sh` sees there is no database at
`SQLITE_PATH` and runs the migrations to create an empty schema. On later
boots it skips them.

> **Never run `npm run migrate` against an existing database.** Migrations
> 009 and 013 rebuild tables from a fixed column list and would drop
> columns added later (`video_path`, `deleted_at`, ...).

Create the first admin with the Railway CLI (`npm i -g @railway/cli`, `railway login`, `railway link`):

```sh
railway ssh
cd /app/src/backend
npm run provision-admin -- --email "admin@mdrrmo.gov" --name "MDRRMO Admin" --phone "09171234567" --password "<strong password>"
```

Check it's up: `https://<service>.up.railway.app/api/health` should return 200.

### Bringing over the existing data instead

To keep the current users and reports, copy the live
`pulse_rtip.db` and the `uploads/` folder from the Hostinger server into the
volume **before** the first real use. Stop the old backend first so the
SQLite file is consistent (or run `sqlite3 pulse_rtip.db ".backup copy.db"`).
Then place the file at `/data/pulse_rtip.db` and the images under
`/data/uploads/`, and redeploy. Because the file now exists, no migrations
run.

## 5. Domain (keeps the Android app working)

The APK has `https://pulse.afkcube.com` hard-coded (`DEFAULT_SERVER_URL` in
`src/frontend/public/js/utils/store.js`, `allowNavigation` in
`capacitor.config.ts`). Keep that hostname so no new APK is needed:

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
