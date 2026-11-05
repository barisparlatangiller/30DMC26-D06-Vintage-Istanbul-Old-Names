/* The Names We Left Behind — Istanbul · #30DayMapChallenge 2026 Day 6 (Vintage) */
const KIND = {
  H: { c: "#7a1f2b", label: "Byzantine, Latin & community layers", note: "Greek, Latin, Genoese, Armenian, Polish … names beneath today's" },
  V: { c: "#a8741f", label: "Villages & neighbourhoods", note: "settlements whose name changed — spelling, meaning, or entirely" },
  M: { c: "#2f4b6e", label: "Named after people & events", note: "now honouring a person, an event or a country" },
  F: { c: "#56652f", label: "New use, new name", note: "a prison became a hotel, a bank an arts centre …" },
  B: { c: "#6b4470", label: "Sponsors, brands & owners", note: "stadiums, malls and firms renamed by money" },
  S: { c: "#8a6a4a", label: "Street renames", note: "everyday street names that changed" },
  T: { c: "#9a9182", label: "Shopfronts that changed hands", note: "a new tenant, a new sign (hidden at start)" },
};
const ORDER = "HVMFBST".split("");
const TYPE = {
  place_of_worship: "place of worship", village: "village", neighbourhood: "neighbourhood", suburb: "quarter", town: "town",
  city: "city", school: "school", park: "park", hospital: "hospital", stadium: "stadium", library: "library",
  arts_centre: "arts centre", community_centre: "cultural centre", hotel: "hotel", cafe: "café", restaurant: "restaurant",
  primary: "main road", secondary: "road", tertiary: "road", residential: "street", motorway: "motorway bridge",
  river: "stream", university: "university", prison: "prison", islet: "islet", tower: "tower", ship: "museum ship",
  archaeological_site: "castle ruin", bus_station: "bus terminal", stock_exchange: "stock exchange", conference_centre: "congress centre",
};
const SCRIPT_LANG = { el: "Greek", hy: "Armenian", en: "English", tr: "Turkish", ar: "Arabic", bg: "Bulgarian", de: "German", fr: "French",
  it: "Italian", la: "Latin", pl: "Polish", cs: "Czech", hr: "Croatian", sk: "Slovak", zh: "Chinese", eo: "Esperanto", br: "Breton", ca: "Catalan", cv: "Chuvash" };

const S = { feats: [], kinds: new Set(ORDER.filter(k => k !== "T")), q: "", sel: null, wd: {}, stats: {}, tour: [], ti: -1 };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const norm = s => String(s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

// ---------- basemap: CARTO Positron, re-inked as an old atlas sheet
const INK = {
  bg: "#ece2c9", water: "#c3ccbb", waterLine: "#aebaa7", green: "#dfd6b2", land: "#e6dcc0", bld: "#ddcfae", bldTop: "#e4d7b8",
  road: "#f6eedb", roadMaj: "#f3e4c3", casing: "#cdb991", rail: "#b9a483", bound: "#a8936f", text: "#6b5a44", textW: "#6f8070", halo: "#ece2c9",
};
function reink(style) {
  for (const l of style.layers) {
    const id = l.id, p = (l.paint = l.paint || {});
    if (l.type === "background") p["background-color"] = INK.bg;
    else if (l.type === "fill") {
      p["fill-color"] = /water/.test(id) ? INK.water : /building-top/.test(id) ? INK.bldTop : /building/.test(id) ? INK.bld
        : /park|landcover|wood|grass/.test(id) ? INK.green : /aeroway/.test(id) ? INK.road : INK.land;
      if (/water_shadow/.test(id)) p["fill-color"] = INK.waterLine;
      delete p["fill-pattern"];
    } else if (l.type === "line") {
      p["line-color"] = /water/.test(id) ? INK.waterLine : /rail/.test(id) ? INK.rail : /boundary/.test(id) ? INK.bound
        : /casing|case/.test(id) ? INK.casing : /motorway|trunk|primary/.test(id) ? INK.roadMaj : INK.road;
    } else if (l.type === "symbol") {
      p["text-color"] = /water/.test(id) ? INK.textW : INK.text;
      p["text-halo-color"] = INK.halo;
      if (/poi/.test(id)) l.layout = { ...(l.layout || {}), visibility: "none" };
    }
  }
  return style;
}

async function firstFont(glyphs, list) {
  for (const f of list) {
    try {
      const r = await fetch(glyphs.replace("{fontstack}", encodeURIComponent(f)).replace("{range}", "0-255"));
      if (r.ok && (await r.arrayBuffer()).byteLength > 200) return f;
    } catch (e) { /* next */ }
  }
  return null;
}

async function init() {
  const [style, fc, stats] = await Promise.all([
    fetch("https://basemaps.cartocdn.com/gl/positron-gl-style/style.json").then(r => r.json()),
    fetch("data/names.geojson?v=1").then(r => r.json()),
    fetch("data/stats.json?v=1").then(r => r.json()),
  ]);
  fetch("data/wikidata.json?v=1").then(r => r.ok ? r.json() : {}).then(j => { S.wd = j || {}; if (S.sel != null) openCard(S.sel, false); }).catch(() => {});
  S.feats = fc.features; S.stats = stats; S.tour = stats.tour || [];
  const fontIt = await firstFont(style.glyphs, ["Montserrat Medium Italic", "Open Sans Italic", "Noto Sans Italic"]);
  const fontRg = await firstFont(style.glyphs, ["Montserrat Medium", "Open Sans Regular", "Noto Sans Regular"]) || "Open Sans Regular";
  reink(style);

  const map = (S.map = new maplibregl.Map({
    container: "map", style, center: [29.0, 41.06], zoom: 9.6, minZoom: 8, maxZoom: 18, attributionControl: false,
    maxBounds: [[27.6, 40.55], [30.3, 41.65]],
  }));
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 110 }), "bottom-right");
  map.addControl(new maplibregl.AttributionControl({ compact: true, customAttribution: "© OpenStreetMap contributors · © CARTO" }), "bottom-right");

  const pins = { type: "FeatureCollection", features: S.feats.map(f => ({ type: "Feature", properties: f.properties, geometry: { type: "Point", coordinates: [f.properties.x, f.properties.y] } })) };
  const color = ["match", ["get", "k"], ...ORDER.flatMap(k => [k, KIND[k].c]), "#777"];
  const setup = () => {
    if (map.getSource("names")) return;
    map.addSource("names", { type: "geojson", data: fc });
    map.addSource("pins", { type: "geojson", data: pins });
    const firstSym = map.getStyle().layers.find(l => l.type === "symbol")?.id;
    map.addLayer({ id: "n-fill", type: "fill", source: "names", filter: ["==", ["geometry-type"], "Polygon"], minzoom: 12,
      paint: { "fill-color": color, "fill-opacity": 0.32 } }, firstSym);
    map.addLayer({ id: "n-outline", type: "line", source: "names", filter: ["==", ["geometry-type"], "Polygon"], minzoom: 12,
      paint: { "line-color": color, "line-width": 1.2 } }, firstSym);
    map.addLayer({ id: "n-case", type: "line", source: "names", filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": "#fbf6ea", "line-width": ["interpolate", ["linear"], ["zoom"], 9, 2.5, 15, 9] } }, firstSym);
    map.addLayer({ id: "n-line", type: "line", source: "names", filter: ["==", ["geometry-type"], "LineString"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": color, "line-width": ["interpolate", ["linear"], ["zoom"], 9, 1.2, 15, 4.5] } }, firstSym);
    map.addLayer({ id: "p-sel", type: "circle", source: "pins", filter: ["==", ["get", "i"], -1],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 11, 15, 17], "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": "#7a1f2b", "circle-stroke-width": 2 } });
    map.addLayer({ id: "p-tour", type: "circle", source: "pins", filter: ["has", "tour"],
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 6.5, 15, 11], "circle-color": "rgba(0,0,0,0)",
        "circle-stroke-color": color, "circle-stroke-width": 1, "circle-stroke-opacity": 0.8 } });
    map.addLayer({ id: "pins", type: "circle", source: "pins",
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, ["match", ["get", "k"], "T", 2.2, 3.4], 15, ["match", ["get", "k"], "T", 4.5, 7]],
        "circle-color": color, "circle-stroke-color": "#fbf6ea", "circle-stroke-width": 1.4 } });
    const label = ["format", ["coalesce", ["get", "o"], ""], { "text-font": ["literal", [fontIt || fontRg]], "font-scale": 1.12 },
      "\n", {}, ["case", [">", ["length", ["get", "n"]], 0], ["concat", "now ", ["get", "n"]], ""], { "text-font": ["literal", [fontRg]], "font-scale": 0.78 }];
    map.addLayer({ id: "labels", type: "symbol", source: "pins",
      filter: ["any", ["has", "tour"], [">=", ["zoom"], 12.4]],
      layout: { "text-field": label, "text-size": ["interpolate", ["linear"], ["zoom"], 9, 11, 15, 14], "text-anchor": "top",
        "text-offset": [0, 0.75], "text-max-width": 11, "text-padding": 3, "symbol-sort-key": ["case", ["has", "tour"], 0, 1] },
      paint: { "text-color": color, "text-halo-color": "#f3ead6", "text-halo-width": 1.6 } });
    applyFilter();

    const hov = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 10, className: "hov" });
    for (const id of ["pins", "n-line", "n-fill"]) {
      map.on("mouseenter", id, () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mousemove", id, e => {
        const p = e.features[0].properties;
        hov.setLngLat(e.lngLat).setHTML(`<div>${esc(p.n || "unnamed today")}</div><div class="o">${esc(p.o)}</div>`).addTo(map);
      });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; hov.remove(); });
      map.on("click", id, e => { hov.remove(); openCard(+e.features[0].properties.i, false); });
    }
  };
  map.on("load", setup);
  map.on("styledata", () => { if (map.style && map.style._loaded) setup(); });
  const poll = setInterval(() => { if (map.style && map.style._loaded) { setup(); clearInterval(poll); } }, 200);

  buildLegend(); buildList(); intro();
  $("#q").addEventListener("input", e => { S.q = norm(e.target.value); buildList(); });
  $("#tourBtn").onclick = () => tour(0);
  $("#tPrev").onclick = () => tour(S.ti - 1);
  $("#tNext").onclick = () => tour(S.ti + 1);
  $("#tEnd").onclick = endTour;
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closeCard(); endTour(); }
    if (S.ti >= 0 && e.key === "ArrowRight") tour(S.ti + 1);
    if (S.ti >= 0 && e.key === "ArrowLeft") tour(S.ti - 1);
  });
}

function intro() {
  const k = S.stats.kinds || {};
  const n = x => k[x]?.n ?? 0;
  $("#lead").innerHTML = `<b>${S.stats.renamings}</b> places in Istanbul still remember a name they no longer use —
    from Byzantine churches that became mosques (<b>${n("H")}</b> older layers) and <b>${n("V")}</b> renamed villages
    to bridges and parks named after people and events (<b>${n("M")}</b>) and stadiums named after sponsors.`;
  const d = S.stats.dropped || {};
  const left = Object.values(d).reduce((a, b) => a + b, 0) - (d["no old_name"] || 0);
  $("#method").innerHTML = `Overpass export of ${(S.stats.exported || "").slice(0, 10)}: ${S.stats.osm_features} features,
    ${S.stats.segments_merged} repeated street segments merged into one entry each, ${left} records left out
    (old name equal to the name, bus stops named after a landmark, one old name copied onto five unrelated libraries, nameless leftovers).`;
}

function buildLegend() {
  const cnt = S.stats.kinds || {};
  $("#legend").innerHTML = ORDER.map(k => `<li data-k="${k}" class="${S.kinds.has(k) ? "" : "off"}" title="${esc(KIND[k].note)}" style="color:${KIND[k].c}">
    <span class="sw" style="background:${KIND[k].c}"></span><span style="color:var(--ink)">${KIND[k].label}</span><span class="n">${cnt[k]?.n ?? ""}</span></li>`).join("");
  $("#legend").querySelectorAll("li").forEach(li => li.onclick = () => {
    const k = li.dataset.k;
    S.kinds.has(k) ? S.kinds.delete(k) : S.kinds.add(k);
    li.classList.toggle("off", !S.kinds.has(k));
    applyFilter(); buildList();
  });
}

function matches(p) {
  if (!S.q) return true;
  return [p.n, p.o, ...(p.o2 || []), ...Object.values(p.oa || {}), p.en, p.el].some(s => norm(s).includes(S.q));
}

function applyFilter() {
  const m = S.map;
  if (!m || !m.getLayer("pins")) return;
  const f = ["in", ["get", "k"], ["literal", [...S.kinds]]];
  for (const id of ["pins", "p-tour"]) m.setFilter(id, id === "p-tour" ? ["all", ["has", "tour"], f] : f);
  m.setFilter("labels", ["all", f, ["any", ["has", "tour"], [">=", ["zoom"], 12.4]]]);
  m.setFilter("n-fill", ["all", f, ["==", ["geometry-type"], "Polygon"]]);
  m.setFilter("n-outline", ["all", f, ["==", ["geometry-type"], "Polygon"]]);
  m.setFilter("n-line", ["all", f, ["==", ["geometry-type"], "LineString"]]);
  m.setFilter("n-case", ["all", f, ["==", ["geometry-type"], "LineString"]]);
}

function buildList() {
  const rows = S.feats.map(f => f.properties).filter(p => (S.q || S.kinds.has(p.k)) && matches(p));
  $("#list").innerHTML = rows.map(p => `<li data-i="${p.i}" style="--c:${KIND[p.k].c}">
      <div class="t">${esc(p.n || "unnamed today")}</div><div class="o">${esc([p.o, ...(p.o2 || [])].join(" · "))}</div></li>`).join("")
    || `<li class="more">No match. Try an old name — Pera, Myrelaion, Ayastefanos …</li>`;
  $("#list").querySelectorAll("li[data-i]").forEach(li => li.onclick = () => openCard(+li.dataset.i, true));
}

function zoomFor(p) {
  if (p.tv === "city") return 9.6;
  if (["village", "town", "suburb", "neighbourhood"].includes(p.tv)) return 12.5;
  if (p.tk === "highway" || p.tk === "waterway") return 14;
  return 16;
}

function openCard(i, fly) {
  const f = S.feats[i]; if (!f) return;
  const p = f.properties, k = KIND[p.k];
  S.sel = i;
  S.map?.getLayer("p-sel") && S.map.setFilter("p-sel", ["==", ["get", "i"], i]);
  if (fly && S.map) S.map.flyTo({ center: [p.x, p.y], zoom: zoomFor(p), speed: 0.9, essential: true });
  const t = S.tour.find(x => x.i === i);
  const wd = p.wd ? S.wd[p.wd.split(";")[0]] : null;
  const alt = Object.entries(p.oa || {}).filter(([l]) => l !== "tr");
  const typ = TYPE[p.tv] || (p.tv && p.tv !== "yes" ? p.tv.replace(/_/g, " ") : p.tk);
  const wdTxt = wd ? [wd.en || wd.tr, wd.inception ? `since ${wd.inception < 0 ? -wd.inception + " BC" : wd.inception}` : "",
    wd.named_after?.length ? `named after ${wd.named_after.join(", ")}` : ""].filter(Boolean).join(" · ") : "";
  $("#card").style.setProperty("--c", k.c);
  $("#card").innerHTML = `<button class="x" aria-label="Close">×</button>
    <span class="kind">${esc(k.label)}</span><span class="no">№ ${String(i + 1).padStart(3, "0")}</span>
    <div class="lbl">Today</div><div class="today">${esc(p.n || "— no name today —")}</div>
    <div class="lbl">Once known as</div><div class="once">${esc(p.o)}</div>
    ${p.o2?.length ? `<div class="alts">also ${p.o2.map(esc).join(" · ")}</div>` : ""}
    ${alt.length ? `<div class="lbl">The old name in other languages</div><div class="chips">${alt.slice(0, 18).map(([l, v]) =>
      `<span><i>${esc(SCRIPT_LANG[l] || l)}</i>${esc(v.split(";")[0])}</span>`).join("")}</div>` : ""}
    ${t ? `<div class="story"><b>${esc(t.title)}</b>${esc(t.text)}${t.src ? ` <a href="${esc(t.src)}" target="_blank" rel="noopener">source</a>` : ""}</div>` : ""}
    ${wdTxt ? `<div class="wd">${esc(wdTxt)} <a href="https://www.wikidata.org/wiki/${esc(p.wd.split(";")[0])}" target="_blank" rel="noopener">Wikidata</a></div>` : ""}
    <div class="meta"><span>${esc(typ || "")}${p.seg > 1 ? ` · ${p.seg} OSM segments` : ""}${p.sd ? ` · built ${esc(p.sd)}` : ""}</span>
      <a href="https://www.openstreetmap.org/${esc(p.id)}" target="_blank" rel="noopener">OSM ${esc(p.id)}</a>
      ${p.wp ? `<a href="https://${esc(p.wp.split(":")[0])}.wikipedia.org/wiki/${encodeURIComponent(p.wp.split(":").slice(1).join(":"))}" target="_blank" rel="noopener">Wikipedia</a>` : ""}</div>`;
  $("#card").classList.remove("hidden");
  $("#card .x").onclick = () => { closeCard(); endTour(); };
}

function closeCard() {
  $("#card").classList.add("hidden"); S.sel = null;
  S.map?.getLayer("p-sel") && S.map.setFilter("p-sel", ["==", ["get", "i"], -1]);
}

function tour(n) {
  if (!S.tour.length) return;
  S.ti = (n + S.tour.length) % S.tour.length;
  const t = S.tour[S.ti];
  if (!S.kinds.has(S.feats[t.i].properties.k)) { S.kinds.add(S.feats[t.i].properties.k); buildLegend(); applyFilter(); buildList(); }
  openCard(t.i, true);
  $("#tourbar").classList.remove("hidden");
  $("#tPos").textContent = `${S.ti + 1} / ${S.tour.length}`;
}
function endTour() { S.ti = -1; $("#tourbar").classList.add("hidden"); }

init().catch(e => { console.error(e); document.body.insertAdjacentHTML("beforeend", `<div style="position:fixed;bottom:10px;left:10px;background:#fff;padding:8px">Map failed to load: ${esc(e.message)}</div>`); });
