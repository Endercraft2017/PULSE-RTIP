# PULSE-RTIP

**Real-Time Incident Reporting Platform for MDRRMO Morong, Rizal**

[**⬇ Download the Android app (debug APK)**](https://github.com/Endercraft2017/PULSE-RTIP/releases/download/debug-latest/pulse-911-debug.apk)

## What this is

PULSE-RTIP is a disaster-response and emergency-reporting system built for the
Municipal Disaster Risk Reduction and Management Office (MDRRMO) of Morong,
Rizal. It gives citizens a fast, accurate way to report incidents — with
text, photos, videos, and GPS location — and gives MDRRMO staff a central
dashboard to validate those reports and coordinate a response.

The core problem it addresses: incident reports in a disaster are often
delayed, hard to verify, or impossible to send at all once cell data drops.
PULSE-RTIP covers both cases — a full online reporting flow when the citizen
has a connection, and a plain-SMS fallback (routed through an SMS gateway)
for when they don't.

**Who uses it:**
- **Citizens** — report incidents, browse community posts, receive hazard
  alerts and status updates on their own reports.
- **MDRRMO administrators** — review and validate incoming reports, broadcast
  hazard alerts, manage users, and view analytics on incident trends.

**Ships as:**
- An Android app (built with Capacitor)
- A web app (same codebase, runs in the browser)
- An optional Windows desktop build (Electron)

## How it works

```
Citizen / Admin (Android app or browser)
        |
        v
Node.js + Express REST API  --->  MySQL (production) or SQLite (offline/local)
        |
        +--> SMS gateway (Android device running TextBee) for offline reports
        +--> Push notifications (Firebase Cloud Messaging)
        +--> Weather / hazard feeds (GDACS, NewsAPI)
```

- **Frontend** (`src/frontend`) is a vanilla HTML/CSS/JavaScript single-page
  app — no framework. A small hash-based router swaps between page modules,
  and a `Store` module handles API calls and local session state. The same
  frontend is bundled into the Android app via Capacitor and can also run
  standalone in any browser.
- **Backend** (`src/backend`) is a Node.js + Express REST API. It has two
  database modes controlled by `APP_MODE` in `.env`:
  - `production` — connects to MySQL
  - `offline` — uses a local SQLite file (`src/database/offline/`), so the
    whole system can run on a single machine with no external services
  Auth is JWT-based; passwords are hashed with bcrypt.
- **Mobile app** (`android/`) is a Capacitor wrapper around the same
  frontend. Because the backend it talks to can change (a locally-hosted
  server's address isn't fixed the way a hosted domain is), the app checks
  connectivity on launch and lets you point it at a different server address
  on the fly if the default one isn't reachable — no rebuild required.
- **SMS channel**: citizens with no data connection can text a report in a
  fixed format to a number relayed by an Android device running TextBee; the
  backend polls for and parses those messages into normal reports.

## Project structure

```
src/
  frontend/     the SPA — HTML, CSS, JS, assets (shared by web + mobile + desktop)
  backend/      Express API, routes, controllers, services, migrations runner
  database/     migrations, seed data, and the offline SQLite file
android/        Capacitor Android project (Gradle)
electron/       optional Windows desktop wrapper
docs/           API reference, testing guide, thesis documentation
reference/      design references, icons, UI mockups
scripts/        one-off maintenance scripts (schema consolidation, icon gen)
```

## Getting started

See `instruction.txt` for step-by-step setup and run instructions.

## Further documentation

- `docs/backend-api-guide.md` — full REST API reference
- `docs/manual-testing-guide.md` — manual test checklist
- `docs/THESIS-DOCUMENTATION.txt` — architecture and stack reference
- `Requirements.md` — project requirements and scope
