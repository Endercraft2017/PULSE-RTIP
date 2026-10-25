# Published Morong boundary activation

The application owner explicitly authorized using the published NAMRIA/PSA-
sourced Morong, Rizal outline for operational validation instead of requiring
specific LGU certification. The bundled file is accurately labelled
`not-lgu-certified`; no approval by an LGU or cadastral authority is invented.

Default runtime file: `src/backend/data/morong-rizal.geojson`.
Source: https://data.humdata.org/dataset/cod-ab-phl
Attribution: NAMRIA, PSA, OCHA Philippines / OCHA FIS and HDX.
License: CC BY-IGO 3.0, https://creativecommons.org/licenses/by/3.0/igo/ .

The selected original feature is PH0405809, Morong, province Rizal PH04058.
Morong, Bataan PH0300808 is not eligible. The feature was extracted without
simplification from the source ZIP's phl_admin3.geojson member. Original
attributes, dates, source-resource URL, member CRC32/SHA-256 and geometry
SHA-256 are in the file. Shapely/GEOS independently validated its geometry.
The member CRC32 and full decompressed length were verified during extraction.

When TERRITORY_GEOJSON_PATH is unset, the backend loads this packaged file;
Docker already copies src/backend, including data. Startup does not require
an external GIS service, a download or extra Railway setup. Explicit operator
overrides remain authoritative and fail closed if missing or invalid. The
new public health response exposes boundary readiness, jurisdiction, source,
version, certification label and data digest, without exposing account data.

Each location save is validated server-side. The client no longer maintains a
stale save lock after a map-config failure. An open map can recover without
reopening or replacing its map/marker instances. Saving manually entered first
coordinates now creates a marker immediately instead of waiting for polling.
Admin role/agency checks, audit/history transactions, edge/hole treatment and
outside-Morong rejection remain enforced. A genuine server-side policy failure
still rejects a write; it never silently saves outside the operational polygon.

Validation:

- 49 Playwright cases passed with no unhandled browser errors.
- 35 backend cases passed.
- The real published polygon was used in dedicated HTTP/browser cases, not
  replaced by the synthetic suite geometry for these checks.
- Playwright performed an actual pointer drag on a Morong report pin, received
  HTTP 200, inspected the saved coordinates and agency-attributed history,
  reloaded the page and confirmed persistence.
- A subsequent outside-town correction received HTTP 422 and preserved both
  the last saved GPS and history count.
- A hazard correction saved inside Morong. Citizen submissions inside Morong
  succeeded; tested Binangonan, Teresa and Morong-Bataan points were rejected.
- Direct citizen hazard GPS updates remained forbidden.
- The default loader was tested with no custom boundary variable. Malformed
  or unreadable explicit overrides still fail closed.

Provider delivery, physical-phone behavior and live MySQL were not established
by these tests. Browser tile images are stubbed. Production health/source
verification is performed after deployment; it does not substitute for a live
authenticated write test. No real production incidents or emergency broadcasts
are created by verification.
