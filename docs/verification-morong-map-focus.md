# Morong map focus — 26 October 2026

## Current display

The purple boundary and **Focus on Morong** control were subsequently removed
at the user's request. Hazard Zones Map still initially centers Morong, using
the territory's bounds without adding its geometry to the map. Free navigation,
existing pins, admin correction controls and server-side GPS validation remain.

Seven targeted Playwright checks verify the absent boundary/control, initial
Morong viewport, free panning, historical outside pins, unsaved GPS inputs,
actual pin dragging, saved corrections after reload, read-only citizen access
and boundary recovery. Log: `/tmp/pulse-remove-map-border-tests.log`.

## Earlier border-and-focus verification (superseded display)

The map keeps the full basemap, unrestricted panning and zooming, and a distinct
purple Morong outline without fill, cutouts or excluded-area masks. Existing
GPS pins can be displayed outside Morong; server-side location eligibility is
unchanged. Opening Hazard Zones Map focuses the municipality. Clicking its
outline or the **Focus on Morong** button returns to the outline bounds.
Report details initially show the report position and provide the same button.

Focus changes the viewport only. It preserves marker instances, unsaved GPS
edits, polling and stored coordinates. If boundary loading fails, the map and
button remain usable; focus falls back to the Morong town center.

Verification:

- Full Chromium Playwright suite: **54 passed**.
- Final affected checks after removing the browser's rectangular SVG focus
  outline: **5 passed**. They exercise free navigation, the focus button, real
  mouse clicks on the published Morong border, visible historical outside pins,
  unsaved report edits, actual pin dragging, save/reload and outside GPS rejection.
- Backend suite: **35 passed**; no backend policy changes.
- Visual screenshot review confirmed an unfilled border with no rectangular
  focus outline. Keyboard focus remains visible through a darker, thicker stroke
  and an outlined focus button.
- `git diff --check` and JavaScript syntax validation passed.

Browser tests use an isolated database and stub external basemap tile images.
They do not verify tile-provider uptime or a physical Android device.
Execution logs: `/tmp/pulse-morong-focus-playwright.log`,
`/tmp/pulse-morong-focus-final-checks.log`, `/tmp/pulse-morong-focus-backend.log`.
Screenshot: `test-results/playwright/morong-border-with-surroundings.png`.
