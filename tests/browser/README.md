# Browser regressions

Use Node 22 (`nvm use`), install backend dependencies with `npm ci` in
`src/backend`, and install the Python browser runner:

```sh
python3 -m venv /tmp/pulse-browser-venv
/tmp/pulse-browser-venv/bin/pip install -r tests/browser/requirements.txt
/tmp/pulse-browser-venv/bin/python -m playwright install chromium
/tmp/pulse-browser-venv/bin/python -m unittest discover -s tests/browser -v
```

A system Chromium is used when available; `CHROMIUM_EXECUTABLE` can select
another executable. Run commands from the repository root with Node 22 on PATH.

Every run creates an isolated SQLite database, signs in through the real login
API/UI, starts its own server and removes those resources afterward. No demo
seed or production database is used. Test boundaries are synthetic: the normal
unconfigured-territory policy is unchanged. Browser requests to external hosts
are blocked and SMS/Firebase credentials are empty; no real messages are sent.
The Google Maps SDK is mocked for marker and loader/CSP tests, so these tests do
not establish live Google Maps availability or API-key validity.

Coverage includes mobile and desktop navigation, login/session restoration,
report submission using browser GPS, Morong exclusion, resolution and archival,
agency assignments and notes, citizen history, contacts and calls, road
advisories, broadcast status, directory refresh, unsafe text rendering, marker
identity/dragging, main Hazard Zones pin saving/cancellation and citizen
read-only permissions, the original categorized Emergency layout with managed
contacts, and navigation during pending requests. Browser time is set
to New York to verify that incident timelines still use Philippine time.

The runner checks for unhandled browser exceptions. Results are recorded in
`test-results/playwright/results.json`; failed tests also save screenshots and
Playwright traces there. Server logs are in the same ignored directory. Open a
failure trace with `python -m playwright show-trace <trace.zip>`.
