# Original Morong boundary extraction

`morong-rizal-ocha-namria-psa.geojson` is an extracted, unsimplified feature from
OCHA Philippines' HDX COD-AB Philippines dataset, sourced from NAMRIA and PSA.
Dataset: https://data.humdata.org/dataset/cod-ab-phl
License: CC BY-IGO 3.0; retain attribution to NAMRIA, PSA, OCHA Philippines and HDX.
License URL: https://creativecommons.org/licenses/by/3.0/igo/

Selection requires adm3_pcode=PH0405809, adm3_name=Morong and adm2_name=Rizal.
The separate Morong, Bataan feature (PH0300808) was rejected. Geometry was not
approximated by a rectangle, drawn by hand or extracted from map imagery.
The resource/member URL, original administrative attributes, feature valid_on,
version, geometry SHA-256 and original member integrity checks are in the file.

Extraction read the source ZIP directory over HTTPS and downloaded only its
phl_admin3.geojson member. Decompression validated its published CRC32 and raw
byte length. The member's SHA-256 is recorded. Independent Shapely/GEOS checks
confirmed valid nonempty geometry: Morong town and the source Morong center
are inside; tested Binangonan, Teresa and Morong-Bataan locations are outside.

This is a published operational dataset, NOT evidence of specific Morong LGU
certification or a legally authoritative cadastral survey. Its catalog dates
and feature valid_on differ; both are preserved rather than invented/reconciled.

This directory preserves the original candidate-only metadata. The application
owner subsequently authorized published operational use. The runtime copy and
its explicit authorization are in src/backend/data/morong-rizal.geojson; this
original extraction is not loaded directly as an authorized policy.
