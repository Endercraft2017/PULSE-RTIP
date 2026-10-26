# Morong, Rizal operational boundary

The application ships `src/backend/data/morong-rizal.geojson` as its default
boundary. The application owner explicitly authorized using this published
operational outline instead of requiring specific LGU certification on
25 October 2026. No Railway variable or network download is needed to activate
it. The existing Dockerfile copies the backend data directory into the image.

Attribution: NAMRIA and PSA; contributed by OCHA Philippines and published by
OCHA FIS/HDX. Source: https://data.humdata.org/dataset/cod-ab-phl
License: CC BY-IGO 3.0, https://creativecommons.org/licenses/by/3.0/igo/ .
This is NOT represented as an LGU-certified or cadastral survey boundary.
Source dates and limitations are retained; they are not a claim of a new survey.

Selection is the unsimplified municipal feature PH0405809 (Morong, Rizal,
province PH04058), not PH0300808 (Morong, Bataan). Source URL, original feature
attributes, source-member CRC32/SHA-256 and geometry SHA-256 are recorded in the
file. Shapely/GEOS independently checked geometry validity. Backend and browser
tests exercise actual Morong points and reject tested Binangonan, Teresa and
Morong-Bataan points. No rectangle or hand-drawn polygon is used for enforcement.

TERRITORY_GEOJSON_PATH is an optional operator override. Explicit missing,
malformed or unauthorized overrides fail closed; they do not silently fall
back to a different policy. Remove the override to use the bundled default.
A new override must retain source/version/jurisdiction provenance, valid closed
WGS84 Polygon/MultiPolygon rings, and either a real approval attestation or an
explicit published-operational authorization with municipality identity and
geometry digest. Metadata strings cannot independently prove a survey's accuracy.
There is no public API for changing the policy file.

Outer edges are included; holes and deny areas, including their edges, are
excluded. A valid GPS pair is required for location writes. Text addresses and
reverse geocoding never override polygon validation. The obsolete Morong-deny
configuration is rejected. Existing records are retained, including historical
out-of-bound records; their coordinates can be corrected to an eligible point.

Every save is checked by the backend, even when the map-config request failed.
The client does not retain an obsolete save lock. Maps keep their marker/map
instances and can adopt a recovered boundary without reopening. Approved or
operationally authorized bounds constrain the map, with excluded areas masked.
If map configuration cannot be retrieved, existing GPS pins remain visible as
reference and the backend still decides whether a correction can be saved.

Raw inbound SMS is unverified staging material. Promotion requires validated
GPS and atomically records incident, source link, history and audit. Statuses,
notes, priorities, accounts, contacts and archival never need a new location.

`candidates/` preserves the original extracted source for provenance. Its
historical candidate-only metadata is not itself used as runtime authorization;
the activated, explicitly authorized copy is in the backend data directory.
Never install the synthetic geometry from the regression tests in production.
