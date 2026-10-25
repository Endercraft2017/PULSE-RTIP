# Map availability regression fix

Commit 3758706 coupled Leaflet startup to approved boundary configuration. A
missing/invalid boundary returned configured=false and prevented map creation.
The main hazard map then hid its canvas. The regression test reproduced a
missing map instance before this fix.

Boundary configuration is now separate from map availability. Both report
and hazard maps display existing valid GPS pins when configuration is missing,
invalid, unreachable, or cannot respond within three seconds. Each map keeps
its own boundary snapshot. Configured maps retain the approved viewport and
mask. Reference viewing without a boundary does not assert that a point is
inside Morong; no approximate enforcement polygon has been invented.

An always-visible notice explains unavailable validation. Admins may type or
drag preview coordinates; saving is blocked until the map is reopened with a
usable approved boundary. Direct API writes remain protected by the unchanged
backend validator. Citizens retain read-only markers. Tile errors have their
own status and cannot overwrite/hide the boundary notice.

Validation: 44 Playwright tests passed, with zero unhandled browser errors;
33 backend tests passed. The suite includes initial missing-boundary report
and hazard maps, blocked saves with unchanged stored GPS/history, failed
map-config requests, configured viewport restrictions, stable markers and
actual pointer dragging. External tiles are stubbed; live tile service and
physical phone behavior are not established by these tests.

Hosted clients require the updated frontend deployment. Installed Capacitor
apps package these files and require an updated APK to receive the fix.
