# Admin GPS corrections — 26 October 2026

Validated locally on `dev/frontend-webapp`, starting from the restored
`3758706` application tree. The existing free Leaflet/OpenStreetMap provider
is retained; no Google browser key or billing account is required.

## Behavior

Open an incident's **Details** as an administrator. Drag the report pin or
type latitude and longitude, enter a correction reason, and select
**Save coordinates**. Valid typed coordinates preview the existing marker;
previews do not write to the database. Saving appends history/audit records.
GPS controls are disabled during the save request.

On **Hazard Zones → Map**, drag a hazard pin to open its coordinate editor.
Coordinates can also be typed there. **Cancel repositioning** restores the
stored position. Citizens can view/pan maps but receive no admin pin controls.

The missing-boundary error in the restored version previously prevented map
creation. Maps now remain visible through configuration/connection failures.
Each save is independently authorized and validated by the backend; failure
never produces a successful-save message or a stored correction.

The previously authorized published Morong, Rizal polygon is bundled with
source attribution, municipality identity and geometry digest. It uses
NAMRIA/PSA-sourced data published by OCHA/HDX, explicitly labelled operational
and not LGU-certified. It excludes tested locations in Binangonan, Teresa and
Morong, Bataan. An explicit invalid policy override still fails closed.

## Checks

- `npm --prefix src/backend test`: **35 passed**.
- `python3 -m unittest discover -s tests/browser -v`: **52 passed**, no
  unhandled browser errors in the final run.
- JavaScript syntax checks for both map components and `git diff --check`
  passed.

The browser suite runs real bundled Leaflet in Chromium against an isolated
SQLite database. It performs mouse-pointer dragging, saves and reloads a report
using the published Morong polygon, checks persisted coordinates and agency
history, rejects outside-town coordinates without adding an event, verifies
marker reuse across polling, and exercises manual previews, cancellation,
read-only citizen controls and unauthorized direct API requests.

Configuration recovery is tested on the same open map/marker. Missing boundary
and failed tile cases preserve the map/editor and reject unavailable validation
without changing stored coordinates. External basemap tiles are stubbed in
these tests, so this does not measure OpenStreetMap service availability.

Local browser evidence: `test-results/playwright/results.json` and screenshots
in that directory. Final execution logs: `/tmp/pulse-gps-playwright-final.log`
and `/tmp/pulse-gps-backend.log`. These are local checks, not confirmation of a
Railway deployment or rebuilt Android package.
