# Default Morong, Rizal operational boundary

Attribution: NAMRIA and Philippine Statistics Authority (PSA); contributed by
OCHA Philippines, quality-assured/published by OCHA FIS and HDX.
Source: https://data.humdata.org/dataset/cod-ab-phl
License: Creative Commons Attribution for Intergovernmental Organisations,
CC BY-IGO 3.0: https://creativecommons.org/licenses/by/3.0/igo/

Morong feature PH0405809, Rizal PH04058; Morong Bataan PH0300808 is excluded.
Geometry was extracted without simplification from phl_admin3.geojson in the
published archive. Full source URL, original attributes, archive member CRC32,
member SHA-256, geometry SHA-256 and dates are preserved in the GeoJSON.

The application owner explicitly authorized this published operational boundary
on 25 October 2026. It is NOT represented as specifically LGU-certified or as a
legally authoritative cadastral survey. Do not relabel operational authorization
as LGU certification. Dataset metadata/version and feature valid_on are retained
as published; they are not an assertion that the survey was updated today.

This file is shipped by the Dockerfile's existing COPY src/backend command.
It is the default when TERRITORY_GEOJSON_PATH is unset. An explicit custom path
still takes precedence; an unreadable/invalid override fails closed rather than
silently replacing the operator's chosen policy with this default.
