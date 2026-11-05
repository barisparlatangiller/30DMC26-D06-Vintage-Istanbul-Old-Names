// Renders the hub thumbnail and three LinkedIn images (1080×1350) straight from the live map code.
//   python -m http.server -d docs 8000 &  node pipeline/shots.mjs     → media/*.jpg|png
import { chromium } from "playwright";
import fs from "node:fs";

const URL = process.env.URL || "http://localhost:8000/";
const OUT = "media"; fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(w, h, scale = 1) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  page.on("console", m => m.type() === "error" && console.log("console:", m.text()));
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.S && S.map && S.map.getLayer && S.map.getLayer("labels"), null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  return page;
}
async function settle(page) {
  await page.waitForFunction(() => S.map.loaded() && S.map.areTilesLoaded(), null, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

// ---- hub thumbnail: the page as it opens
{
  const page = await open(1440, 1080, 1);
  await settle(page);
  await page.screenshot({ path: `${OUT}/thumb_full.jpg`, type: "jpeg", quality: 88 });
  await page.close();
}

const POSTER_CSS = `
  #panel, .maplibregl-ctrl-top-left, .rose, #tourbar, #card, .cartouche { display: none !important; }
  .maplibregl-ctrl-bottom-right { bottom: 26px; right: 28px; }
  .ov { position: absolute; z-index: 5; left: 40px; right: 40px; font-family: "IBM Plex Sans"; color: #2f2418; }
  .ov.top { top: 40px; background: rgba(246,239,223,.93); border: 1px solid rgba(47,36,24,.55); outline: 1px solid rgba(47,36,24,.3); outline-offset: 4px; padding: 26px 32px 22px; }
  .ov .eb { font-size: 19px; letter-spacing: .14em; text-transform: uppercase; color: #7a1f2b; font-weight: 600; }
  .ov h1 { font-family: "Cormorant Garamond"; font-weight: 700; font-size: 76px; line-height: .95; margin: 10px 0 8px; }
  .ov .s { font-family: "Cormorant Garamond"; font-style: italic; font-size: 30px; color: #6b5a44; line-height: 1.15; }
  .ov.bot { bottom: 40px; background: rgba(246,239,223,.93); border: 1px solid rgba(47,36,24,.55); padding: 16px 24px; font-size: 21px; display: flex; gap: 18px; flex-wrap: wrap; align-items: center; }
  .ov.bot .k { display: inline-flex; align-items: center; gap: 8px; }
  .ov.bot .k i { width: 15px; height: 15px; border-radius: 50%; display: inline-block; border: 2px solid #fbf6ea; box-shadow: 0 0 0 1px currentColor; }
  .ov.bot .url { margin-left: auto; font-weight: 600; color: #7a1f2b; }
`;

async function poster(name, view, top, bottom, extra = "") {
  const page = await open(1080, 1350, 1);
  await page.addStyleTag({ content: POSTER_CSS + extra });
  await page.evaluate(({ view, top, bottom }) => {
    document.querySelector("#mapwrap").insertAdjacentHTML("beforeend", `<div class="ov top">${top}</div>${bottom ? `<div class="ov bot">${bottom}</div>` : ""}`);
    S.map.resize(); S.map.jumpTo(view);
  }, { view, top, bottom });
  await settle(page);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  await page.close();
}

const stats = JSON.parse(fs.readFileSync("docs/data/stats.json", "utf8"));
const K = stats.kinds;
const legend = [["H", "#7a1f2b"], ["V", "#a8741f"], ["M", "#2f4b6e"], ["F", "#56652f"], ["B", "#6b4470"], ["S", "#8a6a4a"]]
  .map(([k, c]) => `<span class="k" style="color:${c}"><i style="background:${c}"></i><span style="color:#2f2418">${K[k].label.replace(" & ", " &amp; ")} ${K[k].n}</span></span>`).join("");

await poster("day6_1_atlas", { center: [29.02, 41.1], zoom: 9.55 },
  `<div class="eb">#30DayMapChallenge · Day 6 · Vintage</div><h1>The Names We Left Behind</h1>
   <div class="s">${stats.renamings} places in Istanbul still remember a name they no longer use — kept only as <span style="font-style:normal;font-family:'IBM Plex Mono';font-size:23px">old_name</span> in OpenStreetMap.</div>`,
  `${legend}`, `.ov.bot { font-size: 18px; gap: 8px 18px; }`);

await poster("day6_2_galata", { center: [28.9665, 41.0185], zoom: 14.15 },
  `<div class="eb">Galata · Pera · the historic peninsula</div><h1 style="font-size:64px">Under today's names</h1>
   <div class="s">Christea Turris is the Galata Tower, San Paolo the Arap Mosque, the Osmanlı Bankası is SALT Galata, Pera is Beyoğlu.</div>`,
  `<span>Italic: the old name · below: today's</span><span class="url">barisparlatangiller.github.io</span>`,
  `.ov.top { top: 40px } `);

// ---- index cards: today ← once, typeset like a card catalogue
{
  const page = await open(1080, 1350, 1);
  const fc = JSON.parse(fs.readFileSync("docs/data/names.geojson", "utf8"));
  const pick = ["Galata Kulesi", "Bodrum Camii", "İstanbul", "Polonezköy", "15 Temmuz Şehitler Köprüsü", "Four Seasons Hotel", "Yeşilköy", "RAMS Park"];
  const KC = { H: "#7a1f2b", V: "#a8741f", M: "#2f4b6e", F: "#56652f", B: "#6b4470", S: "#8a6a4a" };
  const cards = pick.map(n => fc.features.find(f => f.properties.n === n)?.properties).filter(Boolean)
    .map(p => `<div class="ic" style="--c:${KC[p.k]}"><div class="kd">${K[p.k].label.replace(" & ", " &amp; ")}</div>
      <div class="lb">Today</div><div class="td">${p.n}</div><div class="lb">Once known as</div><div class="on">${p.o}</div></div>`).join("");
  await page.evaluate(cards => {
    document.body.innerHTML = `<div class="sheet"><div class="eb">#30DayMapChallenge · Day 6 · Vintage · Istanbul</div>
      <h1>Eight names, two lives</h1><div class="grid">${cards}</div>
      <div class="ft">OpenStreetMap old_name tags, export 5 Nov 2026 · interactive map: barisparlatangiller.github.io</div></div>`;
  }, cards);
  await page.addStyleTag({ content: `
    body { background: #efe5cf; display: block; overflow: hidden; }
    .sheet { padding: 48px 48px; font-family: "IBM Plex Sans"; color: #2f2418; height: 1350px; box-sizing: border-box;
      background: radial-gradient(ellipse at center, transparent 60%, rgba(110,80,35,.22) 100%); }
    .eb { font-size: 19px; letter-spacing: .14em; text-transform: uppercase; color: #7a1f2b; font-weight: 600; }
    h1 { font-family: "Cormorant Garamond"; font-weight: 700; font-size: 72px; margin: 8px 0 26px; line-height: 1; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
    .ic { background: #fbf6ea; border: 1px solid #b9a37b; padding: 16px 20px 18px; height: 222px; box-sizing: border-box;
      background-image: repeating-linear-gradient(#fbf6ea 0 29px, rgba(122,31,43,.08) 29px 30px); box-shadow: 0 8px 18px -10px rgba(60,40,10,.5); }
    .kd { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; font-weight: 600; color: var(--c); border-bottom: 2px solid var(--c); display: inline-block; }
    .lb { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #9a8669; margin-top: 12px; }
    .td { font-size: 25px; font-weight: 600; line-height: 1.1; }
    .on { font-family: "Cormorant Garamond"; font-style: italic; font-size: 40px; line-height: 1; color: #7a1f2b; }
    .ft { margin-top: 26px; font-size: 17px; color: #6b5a44; }` });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/day6_3_cards.png` });
  await page.close();
}
await browser.close();
console.log(fs.readdirSync(OUT));
