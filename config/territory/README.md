# Morong, Rizal boundary contract

No production geometry is bundled. Only Morong, Rizal is eligible; the old
Morong exclusion is obsolete and is deliberately rejected by the loader.

The selected source of record is a certified municipal boundary supplied by
Morong's municipal planning/LGU office, with an identified dataset version and
approval record. The national NAMRIA Geoportal is the government reference
catalog: https://www.geoportal.gov.ph/ . On 2026-10-25 its public WMS advertised
`municipalbndry_20210504` as **Municipal Boundary (APPROXIMATE)**, updated
2021-05-04. This is not evidence of an LGU-approved enforcement polygon.
Its WFS DescribeFeatureType endpoint returned HTTP 401 during inspection.
Do not scrape rendered map pixels, infer a rectangle, or relabel an approximate
layer as certified. Neither a text address nor reverse geocoding grants access.

After obtaining the actual approved file, set TERRITORY_GEOJSON_PATH to its
absolute path on the persistent volume. The application loads the file for
every validation and map-config request; environment changes require restart.
A syntactically valid metadata declaration is operator attestation, not proof
that the source itself is accurate. Verify the approval record before install.

The UTF-8 GeoJSON must have:

- `type: FeatureCollection`.
- Top-level `properties.jurisdiction: PH-RIZ-MORONG`.
- Nonblank top-level properties `source`, `approved_by`, `approved_at` (parseable
  date), and `version`, referring to the real source and approval record.
- At least one Polygon/MultiPolygon feature with `properties.mode: allow`
  and a `properties.name` identifying Morong.
- Optional `mode: deny` features for specific excluded areas. A deny feature
  named Morong is rejected as the obsolete opposite policy.
- Closed, nondegenerate polygon rings with finite WGS84 coordinates in
  longitude, latitude order. Geometry must be valid and checked before install.

Outer edges are included. Interior holes and deny areas, including their edges,
are excluded. Missing/invalid GPS is rejected. Missing/invalid/unapproved-schema
boundary configuration returns 503 for location writes. Polygon approval and
accuracy cannot be established by the schema validator alone.

Existing records remain accessible according to their permissions. Statuses,
notes, priorities, account controls, archival, and contacts do not require a new
location. New reports/hazards/advisories, GPS changes, SMS promotion, and calls
with newly supplied locations remain blocked until the boundary is configured.
Raw inbound SMS is unverified staging material; it does not become an accepted
incident until location validation and conversion complete transactionally.

The authenticated map-config API supplies the actual geometry, provenance,
and SHA-256 of the installed file. Maps constrain their viewport to its bounds
and mask excluded areas; backend validation remains authoritative. Existing
out-of-bound records are not plotted as eligible pins. Correct coordinates
through the audited editor after reviewing those historical records.

Never install the synthetic shapes from tests as a production boundary.
