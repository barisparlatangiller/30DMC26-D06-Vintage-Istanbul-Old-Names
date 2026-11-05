"""
The Names We Left Behind — every OpenStreetMap feature in Istanbul that still carries an `old_name`.

  input   data/istanbul_old_names_osm_20261105.geojson   (Overpass export, 2026-11-05, © OpenStreetMap contributors, ODbL)
  output  docs/data/names.geojson    one feature per renaming (repeated street segments merged)
          docs/data/stats.json       counts per kind of renaming, what was left out and why

Each record is sorted into a *kind of renaming*, decided from the record itself (the names and the OSM tags), never
from a date or a motive we cannot see in the data:

  H  Byzantine, Latin & community layers   Greek, Latin, Genoese, Armenian, Polish … names under today's Turkish ones
  V  Villages & neighbourhoods             settlement names that changed (spelling, meaning, or a new name altogether)
  M  Named after people & events           streets, parks, schools, bridges that now honour a person, an event, a country
  F  New use, new name                     buildings that changed function — prison → hotel, bank → arts centre …
  B  Sponsors, brands & owners             stadiums, malls, companies renamed after sponsors or new owners
  S  Street renames                        other street renames
  T  Shopfronts that changed hands         cafés, shops, restaurants with a new tenant (shown, off by default)

Left out (and counted): records whose old_name equals the name, bus stops whose "old name" is a nearby landmark,
and five İBB libraries across the city that all carry the same old_name of one Ataköy building (a copy-paste in OSM).

  python pipeline/build_data.py
"""
import json, re

import shapely
from shapely.geometry import shape
from collections import Counter, defaultdict
from pathlib import Path

SRC = Path("data/istanbul_old_names_osm_20261105.geojson")
OUT = Path("docs/data")

KINDS = {
    "H": "Byzantine, Latin & community layers",
    "V": "Villages & neighbourhoods",
    "M": "Named after people & events",
    "F": "New use, new name",
    "B": "Sponsors, brands & owners",
    "S": "Street renames",
    "T": "Shopfronts that changed hands",
}

# decided one by one from the export (OSM ids, so a re-export keeps the decision)
BY_NAME = {
    # H — older layers
    "Kağıthane Deresi": "H", "Galata Kulesi": "H", "Vefa Kilise Camii": "H", "Arap Camii": "H", "Bodrum Camii": "H",
    "Ceneviz Sarayı": "H", "Hz. Cabir Cami": "H", "Yoros": "H", "Alemdağ Vakıf Cami": "H", "Beyoğlu": "H",
    "İstanbul": "H", "Yeşilköy": "H", "Aya Konstantinos ve Helena": "H", "Binkılıç": "H", "Soho House": "H",
    "Polonezköy": "H", "Kumköy": "H", "Nişantaşı Anadolu Lisesi": "H",
    # M — people, events, countries
    "15 Temmuz Şehitler Köprüsü": "M", "Şehit Yarbay Gökhan Korkmaz Caddesi": "M", "Zeki Müren Sokağı": "M",
    "Şehit Ertuğrul Kabataş Caddesi": "M", "Katar Caddesi": "M", "Melih Cevdet Anday Sokağı": "M",
    "Recep Tayyip Erdoğan Bulvarı": "M", "Şehit Timur Aktemur Ortaokulu": "M", "Şehit Anıl Kaan Aybek Ortaokulu": "M",
    "Dr. Sadık Ahmet Parkı": "M", "Çetin Emeç Parkı": "M", "Aslan Yıldırım Parkı": "M",
    "Prof. Dr. Doğan Cüceloğlu Parkı": "M", "Maltepe Yaşar Kemal Kültür Merkezi": "M",
    "İstanbul Lütfi Kırdar ICEC": "M", "Mahmutşevketpaşa": "M", "Bahçeköy Türkan Efe İlkokulu": "M",
    "15 Temmuz Şehitler Maydanı": "M", "Prof.Dr.Cemil Taşçıoğlu Şehir Hastanesi": "M",
    "Fatih Sultan Mehmet Eğitim ve Araştırma Hastanesi": "M", "Uğur Köken Sokağı": "M",
    "Bezmialem Valide Sultan Camii": "M", "Hacı Sabancı Anadolu Lisesi": "M", "Sabancı Olgunlaştırma Enstitüsü": "F",
    # B — sponsors, brands, owners
    "RAMS Park": "B", "Tüpraş Stadyumu": "B", "RAMS City Haliç": "B", "Wynhouse Istanbul": "B",
    "City's İstanbul Alışveriş Merkezi": "B", "Galata Grand Bazar": "B", "Borsa İstanbul": "B",
    "NCR Bilişim Sistemleri Ltd. Şti.": "B", "Bahçeşehir Koleji Nakkaştepe 50. Yıl Kampüsü": "B",
    "Lokman Hekim Hastanesi": "B", "Özel Bayrampaşa Koleji Anadolu Lisesi": "B", "Kadıköy Sineması": "B",
    "Malva Permakültür Çiftliği": "B",
    # F — new use
    "Four Seasons Hotel": "F", "SALT Galata": "F", "Galata Yolcu Salonu": "F", "Espressolab": "F",
    "Rami Kütüphanesi": "F", "Baruthane Müze": "F", "İBB Baruthane Kütüphane": "F", "Baruthane Sahne": "F",
    "Artistanbul Feshane": "F", "İspirtohane Kültür Merkezi": "F", "Terziler Sinagogu  / Schneidertempel Sanat Merkezi": "F",
    "İstanbul Üniversitesi - Cerrahpaşa Büyükçekmece Yerleşkesi": "F", "İstanbul Galata Üniversitesi D blok": "F",
    "Marmara Kapalı Ceza İnfaz Kurumları Kampüsü": "F", "Bölge Parkı": "F", "TCG Uluçalireis": "F",
    "Vefa Lisesi": "F", "İstanbul Anadolu Lisesi": "F", "Esenler Otogarı": "F", "Trabzonpark Millet Bahçesi": "F",
    "Uydu Haberleşme ve Uzaktan Algılama Uygulama ve Araştırma Merkezi": "F", "İTÜ Afet Yönetimi Enstitüsü": "F",
    "Firuzağa İlkokulu": "F", "Ata-1 Öğrenci Yurdu": "F", "Ata-2 Öğrenci Yurdu": "F", "Yeşilköy Semt Pazarı": "F",
    "Ulus Mezarlığı": "F", "Paşadere Su Kemeri": "F", "Melisa Parkı": "F", "İncir Ada": "F",
    "Şişli Mesleki ve Teknik Anadolu Lisesi": "F",
}
# Espressolab twice: the old Büyükdere pier (F) and a former restaurant (T) — decided by old name
BY_OLD = {"Borsa Lokantası": "T", "Eski Büyükdere İskelesi": "F", "Kamondo Apartmanı": "H", "Reyhanoğlu Apartmanı": "F",
          "Eski Yakacık Çöplüğü": "F"}

SHOP_KEYS = {"shop", "office"}
SHOP_AMENITY = {"cafe", "restaurant", "fast_food", "bar", "pub"}

# the curated tour: facts checked against the sources linked in each entry (see README)
TOUR = [
    {"today": "Galata Kulesi", "title": "Galata Tower — once the Tower of Christ",
     "text": "The Genoese, settled in Galata since 1267, rebuilt the tower in 1348–49 and called it Christea Turris, the Tower of Christ.",
     "src": "https://galata-tower.com/history"},
    {"today": "Bodrum Camii", "title": "Bodrum Mosque — the Myrelaion",
     "text": "Emperor Romanos I Lekapenos built the Myrelaion as his family's burial church (first burial 922). Around 1500 Grand Vizier Mesih Pasha made it a mosque.",
     "src": "https://www.wikiwand.com/en/articles/Myrelaion"},
    {"today": "Arap Camii", "title": "Arap Mosque — San Paolo e Domenico",
     "text": "A Dominican church of the Latin community in Galata, enlarged in 1307. The Dominicans left in 1475; the name 'Arap' most likely comes from the Moors resettled here after 1492.",
     "src": "https://mcid.mcah.columbia.edu/istanbul-documentation-project/arap-camii"},
    {"today": "Beyoğlu", "title": "Beyoğlu — Pera, 'the other side'",
     "text": "OSM still keeps Pera, the old name of the district across the Golden Horn from the historic peninsula.",
     "src": None},
    {"today": "SALT Galata", "title": "SALT Galata — the Imperial Ottoman Bank",
     "text": "Designed by Alexandre Vallaury as the headquarters of the Imperial Ottoman Bank, which used it from 1892 to 1999. Reopened as SALT Galata in November 2011.",
     "src": "https://saltonline.org/en/salt-galata"},
    {"today": "Four Seasons Hotel", "title": "Four Seasons Sultanahmet — the Sultanahmet Jail",
     "text": "Built as a prison in 1918–19, abandoned in 1969, opened as a hotel in 1996.",
     "src": "https://www.wikiwand.com/en/articles/Sultanahmet_Jail"},
    {"today": "15 Temmuz Şehitler Köprüsü", "title": "15 July Martyrs' Bridge — the Bosphorus Bridge",
     "text": "On 25 July 2016 the cabinet renamed the Bosphorus Bridge to commemorate the civilians killed opposing the 15 July coup attempt.",
     "src": "https://www.foxnews.com/world/turkey-renames-bosporus-bridge-15th-july-martyrs-bridge.amp"},
    {"today": "Yeşilköy", "title": "Yeşilköy — Ayastefanos, San Stefano",
     "text": "In 1924 the poet Halid Ziya Uşaklıgil proposed 'Yeşilköy', green village, for the suburb known as Ayastefanos / San Stefano.",
     "src": "https://ajammc.com/2020/03/07/scars-ottoman-san-stefano/"},
    {"today": "Polonezköy", "title": "Polonezköy — Adampol",
     "text": "Founded in 1842 on the initiative of Prince Adam Czartoryski for Polish émigrés, and named Adampol after him.",
     "src": "https://www.wikiwand.com/en/articles/Adampol"},
]

SCRIPTS = [("Greek", r"[Ͱ-Ͽἀ-῿]"), ("Armenian", r"[԰-֏]"), ("Cyrillic", r"[Ѐ-ӿ]"),
           ("Arabic", r"[؀-ۿ]"), ("CJK", r"[一-鿿]")]


def kind_of(p):
    n, o = p.get("name"), p["old_name"]
    if o in BY_OLD:
        return BY_OLD[o]
    if n in BY_NAME:
        return BY_NAME[n]
    if not n:
        return "F"                                  # the name is gone, the building or place is still there
    if any(k in p for k in SHOP_KEYS) or p.get("amenity") in SHOP_AMENITY or p.get("building") == "house":
        return "T"
    if "place" in p:
        return "V"
    if "highway" in p:
        return "M" if re.match(r"(Şehit|15 Temmuz|Prof|Dr\.)", n or "") else "S"
    return "F" if n else "T"


def ftype(p):
    for k in ("place", "highway", "amenity", "leisure", "building", "historic", "tourism", "shop", "waterway", "landuse", "office", "natural"):
        if k in p:
            return k, p[k]
    return "", ""


def main():
    d = json.loads(SRC.read_text())
    stamp = d.get("timestamp")
    groups, dropped = defaultdict(list), Counter()
    for f in d["features"]:
        p = f["properties"]
        o = p.get("old_name")
        if not o:
            dropped["no old_name"] += 1; continue
        n = p.get("name")
        if n == o:
            dropped["old name = name"] += 1; continue
        if p.get("highway") == "bus_stop" and n not in BY_NAME:
            dropped["bus stop named after a landmark"] += 1; continue
        if o == "Ataköy Baruthane-i Âmire Kalhane" and (n or "").startswith("İBB") and "Baruthane" not in (n or ""):
            dropped["old name copied onto unrelated libraries"] += 1; continue
        if not n and not any(k in p for k in ("building", "natural", "historic")):
            dropped["no current name, no feature"] += 1; continue
        key = (n, o) if f["geometry"]["type"] in ("LineString", "MultiLineString") else (p["@id"],)
        groups[key].append(f)

    feats = []
    for key, fs in groups.items():
        p = fs[0]["properties"]
        k = kind_of(p)
        geoms = [x["geometry"] for x in fs]
        if len(geoms) > 1:
            lines = [g["coordinates"] for g in geoms if g["type"] == "LineString"] + \
                    [c for g in geoms if g["type"] == "MultiLineString" for c in g["coordinates"]]
            geom = {"type": "MultiLineString", "coordinates": lines}
        else:
            geom = geoms[0]
        tk, tv = ftype(p)
        olds = [s.strip() for s in p["old_name"].split(";") if s.strip()]
        alt = {kk.split(":", 1)[1]: v for kk, v in p.items() if kk.startswith("old_name:")}
        scripts = sorted({nm for nm, rx in SCRIPTS for s in olds + list(alt.values()) if re.search(rx, s)})
        g = shape(geom)
        if g.geom_type in ("LineString", "MultiLineString"):
            ln = max(getattr(g, "geoms", [g]), key=lambda x: x.length)
            pt = ln.interpolate(0.5, normalized=True)
        else:
            pt = g.representative_point()
        props = {"id": p["@id"], "x": round(pt.x, 6), "y": round(pt.y, 6), "k": k, "n": p.get("name") or "", "o": olds[0], "o2": olds[1:], "tk": tk, "tv": tv,
                 "seg": len(fs)}
        if alt: props["oa"] = alt
        if scripts: props["sc"] = scripts
        for src, dst in (("wikidata", "wd"), ("wikipedia", "wp"), ("start_date", "sd"), ("name:en", "en"),
                         ("name:el", "el"), ("old_name:en", "oen")):
            if p.get(src): props[dst] = p[src]
        feats.append({"type": "Feature", "properties": props, "geometry": geom})

    order = "HVMFBST"
    feats.sort(key=lambda f: (order.index(f["properties"]["k"]), f["properties"]["n"] or "~"))
    for i, f in enumerate(feats):
        f["properties"]["i"] = i

    tour = []
    for t in TOUR:
        hit = next((f for f in feats if f["properties"]["n"] == t["today"]), None)
        if hit:
            t = dict(t, i=hit["properties"]["i"]); tour.append(t)
            hit["properties"]["tour"] = len(tour)
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "names.geojson").write_text(json.dumps({"type": "FeatureCollection", "features": feats},
                                                   ensure_ascii=False, separators=(",", ":")))
    cnt = Counter(f["properties"]["k"] for f in feats)
    stats = {"source": "OpenStreetMap contributors (ODbL), Overpass export", "exported": stamp,
             "osm_features": len(d["features"]), "renamings": len(feats),
             "segments_merged": sum(len(v) - 1 for v in groups.values()),
             "kinds": {k: {"label": v, "n": cnt.get(k, 0)} for k, v in KINDS.items()},
             "dropped": dict(dropped),
             "geometry": dict(Counter(f["geometry"]["type"] for f in feats)),
             "with_wikidata": sum("wd" in f["properties"] for f in feats),
             "tour": tour}
    p = OUT / "stats.json"
    old = json.loads(p.read_text()) if p.exists() else {}
    old.update(stats)
    p.write_text(json.dumps(old, ensure_ascii=False, indent=1))
    print(json.dumps({k: stats[k] for k in ("renamings", "segments_merged", "kinds", "dropped", "geometry", "with_wikidata")},
                     ensure_ascii=False, indent=1))
    print("tour:", [t["today"] for t in tour])
    for k in order:
        print(k, [f["properties"]["n"] or f["properties"]["o"] for f in feats if f["properties"]["k"] == k][:80])


if __name__ == "__main__":
    main()
