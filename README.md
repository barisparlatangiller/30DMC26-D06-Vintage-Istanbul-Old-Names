# The Names We Left Behind — Istanbul's forgotten place names

**#30DayMapChallenge 2026 · Day 6 · Vintage**
Live map: https://barisparlatangiller.github.io/30DMC26-D06-Vintage-Istanbul-Old-Names/

An atlas sheet of every place in Istanbul where an OpenStreetMap mapper kept the name it used to have
(`old_name`): Byzantine churches that became mosques, Genoese towers, Greek and Armenian village names,
bridges and parks renamed after people and events, stadiums renamed after sponsors.

## Data

* `data/istanbul_old_names_osm_20261105.geojson`: Overpass export of 5 Nov 2026 (261 features, 254 with `old_name`),
  © OpenStreetMap contributors, ODbL.
* Wikidata (CC0): short descriptions, inception year and "named after", fetched in the build for the 65 renamings with a
  `wikidata` tag.

## Method (`pipeline/build_data.py`)

1. Keep features with `old_name`. Leave out records where the old name equals the name, bus stops whose "old name" is
   a nearby landmark, and one old name (Ataköy Baruthane) that was copied onto five unrelated İBB libraries.
2. Merge repeated street segments with the same name pair into one entry (75 segments merged).
3. Sort each renaming into a **kind of renaming**, read from the names and tags only:
   older layers (Byzantine, Latin, community), villages and neighbourhoods, named after people and events, new use, sponsors
   and owners, street renames, shopfronts.
   No dates or motives are inferred. Stories appear only on the nine tour stops, each with its source linked.
4. `pipeline/wikidata.py` adds Wikidata facts, shown with a link to the item.

Result: **161 renamings**.

| Kind | Count |
|---|---|
| Byzantine, Latin and community layers | 19 |
| Villages and neighbourhoods | 37 |
| Named after people and events | 23 |
| New use, new name | 35 |
| Sponsors, brands and owners | 13 |
| Street renames | 18 |
| Shopfronts that changed hands | 16 (hidden at start) |

## Limits

This is a sample of what OSM mappers chose to record, not an inventory. Thousands of renamed streets and villages
in Istanbul carry no `old_name` tag. A kind is a reading of the record, and some renamings fit more than one.

## Build

GitHub Actions (`.github/workflows/build-and-deploy.yml`) runs both scripts and deploys `docs/` to Pages.
MapLibre GL 4.7.1 with CARTO Positron, re-inked at runtime as an atlas sheet. Fonts: Cormorant Garamond and IBM Plex Sans.

Barış Parlatangiller · built with Claude
