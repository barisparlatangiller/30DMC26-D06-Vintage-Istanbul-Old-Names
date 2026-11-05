"""
Short facts from Wikidata for every renaming that carries a `wikidata` tag: description (EN/TR), inception year,
"named after", and a link back to the item. Shown on the index card with the source; nothing is written into the
names themselves.

  python pipeline/wikidata.py          → docs/data/wikidata.json
"""
import json, time
from pathlib import Path

import requests

W = Path("docs/data")
API = "https://www.wikidata.org/w/api.php"
UA = {"User-Agent": "30DayMapChallenge-Day6-OldNames/1.0 (https://github.com/barisparlatangiller)"}


def year(claims, pid):
    for c in claims.get(pid, []):
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value", {})
        t = v.get("time") if isinstance(v, dict) else None
        if t:
            return int(t[1:5]) * (-1 if t[0] == "-" else 1)
    return None


def items(claims, pid):
    return [c["mainsnak"]["datavalue"]["value"]["id"] for c in claims.get(pid, [])
            if c.get("mainsnak", {}).get("datavalue", {}).get("value", {}).get("id")]


def get(ids, props="labels|descriptions|claims"):
    out = {}
    for k in range(0, len(ids), 50):
        r = requests.get(API, params={"action": "wbgetentities", "ids": "|".join(ids[k:k + 50]), "props": props,
                                      "languages": "en|tr", "format": "json"}, headers=UA, timeout=60)
        r.raise_for_status()
        out.update(r.json().get("entities", {}))
        time.sleep(0.5)
    return out


def main():
    fc = json.loads((W / "names.geojson").read_text())
    ids = sorted({f["properties"]["wd"].split(";")[0] for f in fc["features"] if f["properties"].get("wd")})
    ents = get(ids)
    named = sorted({q for e in ents.values() for q in items(e.get("claims", {}), "P138")})
    nlab = get(named, "labels") if named else {}
    lab = lambda e, l: e.get("labels", {}).get(l, {}).get("value")
    res = {}
    for q, e in ents.items():
        if "missing" in e:
            continue
        c = e.get("claims", {})
        d = {"en": e.get("descriptions", {}).get("en", {}).get("value"),
             "tr": e.get("descriptions", {}).get("tr", {}).get("value"),
             "label_en": lab(e, "en"), "inception": year(c, "P571"), "dissolved": year(c, "P576"),
             "named_after": [lab(nlab.get(x, {}), "en") or lab(nlab.get(x, {}), "tr") for x in items(c, "P138")]}
        res[q] = {k: v for k, v in d.items() if v}
    (W / "wikidata.json").write_text(json.dumps(res, ensure_ascii=False, separators=(",", ":")))
    s = json.loads((W / "stats.json").read_text())
    s["wikidata"] = {"items": len(ids), "with_description": sum(1 for v in res.values() if v.get("en") or v.get("tr")),
                     "with_inception": sum(1 for v in res.values() if v.get("inception")),
                     "fetched": time.strftime("%Y-%m-%d")}
    (W / "stats.json").write_text(json.dumps(s, ensure_ascii=False, indent=1))
    print(s["wikidata"])


if __name__ == "__main__":
    main()
