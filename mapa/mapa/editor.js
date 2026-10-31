// The Mapa editor's page script (mapa.md loads it via <script type="module" src>, so Observable
// Framework bundles it and its imports -- including node_modules packages -- at build time).
import { renderMap, loadBasemapData, loadInsetData, resolveRefUid, satelliteViewCenter, satelliteProjector, looksLikeRawConfig, BASEMAP_LAYERS, ATLAS_STYLE, setTileRequestGuard, redrawAnnotations } from './js/mapa.js';
import { atlasProjectToMapaSettings, atlasAnnotationsToMapa } from './js/translate.js';
import { worldFileFor } from './js/worldfile.js';
import * as d3 from 'd3'; // same node_modules package as js/vendor.js → one instance; gives d3.zoom/d3.select
import * as topojson from 'topojson-client';
import { rewind as turfRewind } from '@turf/rewind';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const statusEl = $('status'), mapEl = $('map'), downloadEl = $('download');
function fail(m) { statusEl.className = 'statusline err'; statusEl.textContent = m; console.error(m); }
function note(m) { statusEl.className = 'statusline'; statusEl.textContent = m; }


function resolveRef(ref) {
  if (/^https?:\/\//.test(ref) || /^(\.\.?)?\//.test(ref)) return ref;
  return './projects/' + (ref.endsWith('.json') ? ref : ref + '.json');
}
// A search box is not a form: stop the browser's saved-address / history autofill (and password
// managers) from offering entries. Chrome guesses "address" from words like city/country, so the
// placeholders avoid those too.
function noAutofill(el) {
  el.autocomplete = 'off'; el.spellcheck = false;
  el.name = 'q-' + Math.random().toString(36).slice(2, 8);   // no remembered entries for this name
  el.setAttribute('data-lpignore', 'true'); el.setAttribute('data-1p-ignore', ''); el.setAttribute('data-form-type', 'other');
  return el;
}
async function fetchJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error(r.status + ' ' + url); return r.json(); }

// ---- data pointers --------------------------------------------------------
// A project carries POINTERS to its data (`"source": "data/occupied.json"`), never geometry —
// the file stays small and readable, and the data is relocatable. A pointer resolves against
// the loaded project's OWN directory first, so a project folder (project file + its `data/`)
// works wherever it lands in the repo; then it falls back to the flat `./projects/` layout the
// existing files use, so nothing already checked in breaks.
// NEVER a leading `/` — that resolves from the domain root, which differs locally vs
// the hosted site and has broken twice.
// The folder the loaded project lives in, as a URL prefix. Two ref shapes:
//   • a bare/nested name  ("demo", "dark/gctvip126-sahel")  → under ./projects/
//   • a full path         ("./templates/blank.json")        → its own directory
// Templates are a TOP-LEVEL folder (src/atlas/templates/), a sibling of projects/, so they
// come through as the second shape.
function projectBase() {
  const ref = currentProjectRef || '';
  if (!ref) return './projects/';
  if (/^https?:\/\//.test(ref) || /^(\.\.?)?\//.test(ref)) return ref.slice(0, ref.lastIndexOf('/') + 1);
  const i = ref.lastIndexOf('/');
  return './projects/' + (i >= 0 ? ref.slice(0, i + 1) : '');
}
// Candidate URLs for a pointer, most-specific first: the project's own folder, then the flat
// ./projects/ layout the existing files use.
function pointerCandidates(src) {
  if (/^https?:\/\//.test(src) || /^(\.\.?)?\//.test(src)) return [src];
  const bare = src.endsWith('.json') ? src : src + '.json';
  const base = projectBase();
  return base === './projects/' ? [base + bare] : [base + bare, './projects/' + bare];
}
// Fetch a pointer, trying each candidate. Throws listing every path tried, so a missing file is
// diagnosable in the Data panel rather than a silent console warning.
async function fetchPointer(src) {
  const tried = [];
  for (const url of pointerCandidates(src)) {
    try { return { data: await fetchJSON(url), url }; }
    catch (e) { tried.push(url); }
  }
  throw new Error('not found (tried ' + tried.join(', ') + ')');
}
// The pointer a dropped file should carry: the project's own data/ folder, keyed by filename.
function pointerFor(filename) {
  const base = (filename || 'data').replace(/\.(geo|topo)?json$/i, '');
  return 'data/' + (slugify(base) || 'data') + '.json';
}
// Same, for a raster image — keeps the real extension (png/jpg/webp/…).
function pointerForImage(filename) {
  const m = /\.([a-z0-9]+)$/i.exec(filename || '');
  const ext = m ? m[1].toLowerCase() : 'png';
  const base = (filename || 'image').replace(/\.[a-z0-9]+$/i, '');
  return 'data/' + (slugify(base) || 'image') + '.' + ext;
}
// ---- shared head control: opacity -----------------------------------------
// A compact row-head button whose face shows a 0–100% value and opens a slider popover.
// Used by BOTH the Raster rows and the Data rows so they behave identically. The popover is
// appended to <body> (to escape the row's clipping), so it needs the outside-click dismiss below.
const POP_CLASS = 'val-pop';
function closeValuePops() { document.querySelectorAll('.' + POP_CLASS).forEach((n) => n.remove()); }
function opacityButton(get, set, title) {
  const btn = document.createElement('button');
  const face = () => Math.round((get() ?? 1) * 100) + '%';
  btn.textContent = face();
  btn.title = title || 'opacity';
  btn.style.cssText = 'font:11px system-ui,sans-serif; width:44px; padding:0 2px;';
  btn.onclick = (ev) => {
    ev.stopPropagation();
    const open = document.querySelector('.' + POP_CLASS + '[data-kind="op"]');
    closeValuePops(); if (open) return;   // second click on the same button = close
    const pop = document.createElement('div'); pop.className = POP_CLASS; pop.dataset.kind = 'op';
    // fixed + above every board layer (they reach z 91): absolute/z 40 could open behind a panel.
    pop.style.cssText = 'position:fixed; z-index:1000; background:var(--panel); color:var(--fg); border:1px solid var(--border); border-radius:4px; ' +
      'box-shadow:0 2px 8px rgba(0,0,0,.18); padding:6px 8px; display:flex; align-items:center; gap:6px;';
    const sl = document.createElement('input'); sl.type = 'range';
    sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = get() ?? 1; sl.style.width = '110px';
    const val = document.createElement('span');
    val.style.cssText = 'font:11px system-ui,sans-serif; width:34px;'; val.textContent = face();
    sl.oninput = () => { set(Math.max(0, Math.min(1, +sl.value || 0))); val.textContent = face(); btn.textContent = face(); };
    pop.append(sl, val); document.body.append(pop);
    const rect = btn.getBoundingClientRect();
    pop.style.left = Math.min(rect.left, innerWidth - 180) + 'px';
    pop.style.top = (rect.bottom + 2) + 'px';
  };
  return btn;
}
document.addEventListener('click', (e) => {
  if (e.target.closest && e.target.closest('.' + POP_CLASS)) return;
  closeValuePops();
});

// Candidate URLs for an image pointer. Unlike pointerCandidates this never forces `.json`,
// and blob:/data: pass straight through.
function imageCandidates(src) {
  if (/^(https?:|blob:|data:)/.test(src) || /^(\.\.?)?\//.test(src)) return [src];
  const base = projectBase();
  return base === './projects/' ? [base + src] : [base + src, './projects/' + src];
}

// Project name = the identity slug (also the repo folder + project-file base name). Keep it
// filename-safe. setProjectName is the single writer so the variable and the Project-tab field
// never drift apart.
function slugify(s) { return (s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-_]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
function setProjectName(name) {
  projectName = (name || '').trim() || 'map';
  const pn = $('projName'); if (pn && pn.value !== projectName) pn.value = projectName;
  // The export/download filename tracks the project name.
  const dn = $('dlName'); if (dn) dn.value = downloadNameFor(projectName);
}
// Download name = the project name, with any date in it (YYYY-MM-DD) swapped for today's.
// The project name itself keeps its original date.
function downloadNameFor(name) {
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  return name.replace(/\d{4}-\d{2}-\d{2}/, stamp);
}

// The in-memory Atlas project. The panel edits view/export; points/polys/
// annotations are preserved from a loaded ?project= even though Phase 1 has no
// editors for them yet.
let project = {};
let projectName = 'map';
// Old pre-project-file Mapa CONFIG pasted in for view-only import. When set, render() renders it
// verbatim as Mapa settings (proj4/custom preserved) instead of building from the panel; the panel
// is not the source of truth in this mode. Cleared when a normal project loads or on reset.
let rawConfig = null;
// ---- output frames (per-view Map panel) -----------------------------------
// Each frame is its OWN full Map-panel instance: `{ id, name, map }` where `map` is a snapshot of
// every Map-panel control (bbox, size, ratio, buffer, projection, background…). The single Map
// panel edits the ACTIVE frame; switching frames swaps the whole panel (readFrameMap/applyFrameMap).
// Inset / Scalebar / North / Data / Basemap are SHARED across frames. Round-trips as project.frames[].
let frames = [];
let activeFrame = 0;
let frameIdSeq = 0;
// The ref the nav pane (sandbox iframe) should load. Starts from ?project= but the
// in-app picker updates it so the pane can be reloaded to match. null = no fetchable
// ref (e.g. a drag-dropped local file the pane can't re-fetch by URL).
let currentProjectRef = params.get('project') || null;

// ---- basemap layer rows (toggle + colours) --------------------------------
// key = engine basemap sub-layer; kind drives which colour inputs show.
// UI order = render order, top-of-panel is top-of-stack (drawn last / on top).
// Basemap layers, their default styling, which start on, and each layer's data file all come
// from the one config (src/mapa/js/basemap-layers.js) that the render engine's loader also reads.
const LAYERS = BASEMAP_LAYERS;
const DEFAULT_ON = Object.fromEntries(BASEMAP_LAYERS.filter((l) => l.defaultOn).map((l) => [l.key, true]));
// Prod streams the basemap per export extent from the fgb build; local loads the whole JSON once.
// ?fgb forces the fgb streaming path locally, so you can test it against files-fgb/ on localhost.
const IS_PROD = !(['localhost', '127.0.0.1', ''].includes(location.hostname) || location.hostname.endsWith('.local'));
const USE_FGB = IS_PROD || new URLSearchParams(location.search).has('fgb');
// Each basemap panel layer → the one data file it needs, from the shared config.
const LAYER_FILES = Object.fromEntries(BASEMAP_LAYERS.map((l) => [l.key, l.file]));
// Resolves when the MapLibre pane first reports its camera/bounds. Satellite's export extent
// comes from the pane, so the fgb render must wait for this — otherwise the landing render has
// no bbox and flatgeobuf grabs whole files instead of range-streaming the extent.
let paneReadyResolve;
const paneReady = new Promise((res) => { paneReadyResolve = res; });
function enabledBasemapFiles() {
  if (!$('showBasemap').checked) return [];
  const files = new Set();
  for (const L of LAYERS) {
    const el = document.querySelector(`[data-layer="${L.key}"][data-k="show"]`);
    if (el && el.checked && LAYER_FILES[L.key]) files.add(LAYER_FILES[L.key]);
  }
  return [...files];
}
// Generalize row: the tolerance box only in custom mode, and each layer's blank simplify field
// says what it falls back to (off / auto / the custom value). The readout is filled after a render.
function syncBmGen() {
  const mode = $('bmGen').value;
  $('bmGenTol').hidden = mode !== 'custom';
  if (mode !== 'auto') $('bmGenNote').textContent = '';
  const fallback = mode === 'auto' ? 'auto' : mode === 'custom' && num($('bmGenTol').value) > 0 ? String(num($('bmGenTol').value)) : 'off';
  document.querySelectorAll('#layers [data-k="simplify"]').forEach((el) => { el.placeholder = fallback; });
}
document.addEventListener('input', (e) => { if (e.target.id === 'bmGen' || e.target.id === 'bmGenTol') syncBmGen(); });
// Basemap ⇄ rewind buttons toggle `on` and count as a panel edit (render on live / Render).
document.addEventListener('click', (e) => {
  const b = e.target.closest('#layers .rw-btn'); if (!b) return;
  b.classList.toggle('on');
  b.title = b.classList.contains('on') ? 'rewind ON — geojson rewind applied (click to turn off)' : "rewind — apply geojson rewind to this layer's shapes";
  onEdit();
});
// ---- fill patterns: PNG tiles dropped in styles/patterns/ (index.json kept fresh by
// `npm run dev` / `npm run gen:patterns`). A <select> per fill; '' = no pattern.
let PATTERNS = [];
const PATTERN_SIZES = {}; // name → [w, h] px
fetch('./styles/patterns/index.json', { cache: 'no-store' })
  .then((r) => (r.ok ? r.json() : []))
  .catch(() => [])
  .then((list) => {
    PATTERNS = Array.isArray(list) ? list : [];
    document.querySelectorAll('select.pat-sel').forEach(fillPatternOptions);
    // Each PNG's own pixel size, so 100% scale draws a tile as it was made (engine: patterns.sizes).
    for (const n of PATTERNS) {
      const im = new Image();
      im.onload = () => { PATTERN_SIZES[n] = [im.naturalWidth, im.naturalHeight]; };
      im.src = './styles/patterns/' + encodeURIComponent(n) + '.png';
    }
  });
// (Re)fill a pattern <select>, keeping its current/wanted value even if the file is gone.
function fillPatternOptions(sel) {
  const want = sel.dataset.want ?? sel.value;
  const names = PATTERNS.includes(want) || !want ? PATTERNS : [...PATTERNS, want];
  sel.innerHTML = '<option value="">no pattern</option>' +
    names.map((n) => `<option value="${n}">${n}</option>`).join('');
  sel.value = want || '';
  delete sel.dataset.want;
}
let embedPatternsOn = true; // Download ▾ menu → "embed patterns"
let imageScale = 1;         // Download ▾ menu → "image scale" (PNG + world file)
// Pattern tiles render as links to styles/patterns/*.png. On download, "embed patterns" (on by
// default) swaps each link for the PNG as a data URI — a few KB each — so the SVG still has its
// patterns in Illustrator or anywhere styles/patterns/ doesn't exist. href -> data URI cache.
const patternURIs = new Map();
async function embedPatterns(node) {
  const imgs = [...node.querySelectorAll('pattern[id^="pat-"] image')]
    .filter((im) => !(im.getAttribute('href') || '').startsWith('data:'));
  await Promise.all(imgs.map(async (im) => {
    const href = im.getAttribute('href');
    if (!patternURIs.has(href)) {
      try {
        const r = await fetch(href);
        if (!r.ok) return;
        const blob = await r.blob();
        patternURIs.set(href, await new Promise((res) => {
          const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob);
        }));
      } catch { return; } // unreachable tile: leave the link
    }
    im.setAttribute('href', patternURIs.get(href));
  }));
  return node;
}
function setPatternValue(sel, v) {
  sel.dataset.want = v || '';
  fillPatternOptions(sel);
}

function buildLayerRows() {
  const host = $('layers');
  host.innerHTML = '';
  for (const L of LAYERS) {
    const colorK = 'fill' in L ? 'fill' : 'stroke';
    const colorV = 'fill' in L ? L.fill : L.stroke;
    const color = `<input type="color" data-layer="${L.key}" data-k="${colorK}" value="${colorV}" title="${colorK}">`;
    const pattern = ('fill' in L)
      ? `<span class="lc"><label>pattern</label><select class="pat-sel" data-layer="${L.key}" data-k="pattern" title="tile a PNG from styles/patterns/ over the fill"></select></span>` +
        `<span class="lc"><label>pat. op.</label><input type="number" step="0.05" min="0" max="1" data-layer="${L.key}" data-k="pattern-opacity" value="1" title="pattern opacity — the tile only (opacity fades the fill colour under it)"></span>` +
        `<span class="lc"><label>pat. scale</label><input type="number" step="0.1" min="0.05" data-layer="${L.key}" data-k="pattern-scale" value="1" title="pattern scale — 1 draws the PNG at its own size, 0.5 half, 2 double"></span>`
      : '';
    const opacity = `<input type="number" step="0.05" min="0" max="1" data-layer="${L.key}" data-k="opacity" value="1" title="opacity">`;
    // width only for stroked layers; rewind only for filled shapes (line layers get neither).
    const width = ('strokeWidth' in L)
      ? `<span class="lc"><label>width</label><input type="number" step="0.1" min="0" data-layer="${L.key}" data-k="stroke-width" value="${L.strokeWidth}" title="stroke width"></span>`
      : '';
    // rewind lives on the title line (filled shapes only), after the name.
    const rewind = ('fill' in L)
      ? `<button type="button" class="rw-btn" data-layer="${L.key}" data-k="rewind" title="rewind — apply geojson rewind to this layer's shapes">⇄</button>`
      : '';
    const item = document.createElement('div');
    item.className = 'layer-item';
    // Controls on ONE line under the name, each with a small label above it.
    item.innerHTML =
      `<div class="layer-head">` +
        `<button type="button" class="lx-btn" title="show / hide this layer's style controls">▸</button>` +
        `<input type="checkbox" data-layer="${L.key}" data-k="show"${DEFAULT_ON[L.key] ? ' checked' : ''}>` +
        `<label>${L.label}</label>` +
        rewind +
      `</div>` +
      `<div class="layer-ctrls">` +
        `<span class="lc"><label>${colorK}</label>${color}</span>` +
        pattern +
        `<span class="lc"><label>opacity</label>${opacity}</span>` +
        width +
        `<span class="lc lc-right"><label>simplify</label><input type="number" step="0.005" min="0" data-layer="${L.key}" data-k="simplify" value="${L.simplify ?? ''}" placeholder="off" title="simplify tolerance in degrees (e.g. 0.01) — blank = use the generalize setting above"></span>` +
      `</div>`;
    host.append(item);
  }
  host.querySelectorAll('select.pat-sel').forEach(fillPatternOptions);
}
// Collapsible style controls per layer row — Basemap layers and the Inset's colours/lines (collapsed by default).
// Collapsing only hides them; the inputs stay in the DOM, so reading/writing the panel is unchanged.
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.lx-btn'); if (!b) return;
  const open = b.closest('.layer-item').classList.toggle('open');
  b.textContent = open ? '▾' : '▸';
});

// ---- read the panel -> Atlas project object -------------------------------
function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : undefined; }
// Build a project from a frame map (`fm`, the per-view snapshot readFrameMap produces) plus the
// shared panels (basemap/scalebar/north/raster/inset colours/data), read live from the DOM. The
// per-frame inputs -- bbox, projection, size, background, buffer, overrides, satellite params --
// come from `fm`, NOT the DOM, so every frame renders from its own saved state without first
// being loaded into the panel. `base` is the object to overlay onto (defaults to a shallow copy
// of the loaded project, so its points/polys/annotations/data carry through); readPanel() passes
// the module `project` to keep mutating it in place for the save path.
function buildProject(fm, base) {
  const p = base || { ...project };
  // view
  const bboxRaw = (fm.bbox || '').trim();
  const view = {};
  if (bboxRaw) {
    const parts = bboxRaw.split(',').map((s) => parseFloat(s.trim()));
    if (parts.length === 4 && parts.every(Number.isFinite)) view.bbox = parts;
  } else if (fm.trackView !== false && Array.isArray(paneBounds) && paneBounds.length === 4 && paneBounds.every(Number.isFinite)) {
    // Auto (on by default): no drawn bounder → use the Atlas pane's current view as the bbox.
    view.bbox = paneBounds;
  }

  // basemap from layer rows
  const basemap = { show: $('showBasemap').checked };
  for (const L of LAYERS) {
    const on = document.querySelector(`[data-layer="${L.key}"][data-k="show"]`).checked;
    const style = {};
    document.querySelectorAll(`[data-layer="${L.key}"]`).forEach((el) => {
      const k = el.dataset.k;
      if (k === 'show' || k === 'rewind' || k === 'simplify') return;
      if (k === 'pattern' && !el.value) return;
      style[k] = el.type === 'number' ? num(el.value) : el.value;
    });
    basemap[L.key] = { show: on, style };
    if (document.querySelector(`[data-layer="${L.key}"][data-k="rewind"]`)?.classList.contains('on')) basemap[L.key].rewind = true;
    { const sv = num(document.querySelector(`[data-layer="${L.key}"][data-k="simplify"]`)?.value); if (sv > 0) basemap[L.key].simplify = sv; }
  }
  // Basemap-wide generalization: "auto" (engine derives it from the frame's scale) or a tolerance°.
  { const gm = $('bmGen').value, gt = num($('bmGenTol').value);
    if (gm === 'auto') basemap.simplify = 'auto'; else if (gm === 'custom' && gt > 0) basemap.simplify = gt; }

  // Satellite bakes overrides into its build; other projections carry them for the engine to apply.
  let projection = satelliteProjectionFrom(fm);
  if (!projection) { projection = { proj: fm.proj }; const ov = projOverridesFrom(fm.ov); if (Object.keys(ov).length) projection.overrides = ov; }
  const exp = {
    width: num(fm.w),
    height: num(fm.h) ?? null,
    projection,
    graphic: { background: fm.bg },
    clipping: { margin: num(fm.buffer) || 0 },
    basemap
  };

  if ($('showScalebar').checked) {
    exp.scalebar = {
      show: true,
      topValue: num($('sbTopV').value), topUnit: $('sbTopU').value,
      bottomValue: num($('sbBotV').value), bottomUnit: $('sbBotU').value,
      anchor: $('sbAnchor').value,
      offset: [num($('sbOffX').value) ?? 20, num($('sbOffY').value) ?? 40]
    };
  }
  if ($('showNorth').checked) {
    exp.northArrow = { show: true, type: $('naType').value, position: $('naPos').value, size: num($('naSize').value) ?? 40,
      style: { stroke: $('naColor').value, fill: $('naColor').value } };
  }
  if ($('showRaster').checked && rasterData.length) {
    // One list, two render targets by type: tile sources (pmtiles/xyz) → export.tiles;
    // worldfile images → export.raster. Reverse so the top row (index 0) draws on top.
    const ordered = [...rasterData].reverse();
    // One stacking order across BOTH kinds: tiles and images used to be drawn kind by kind, so
    // moving a tile row past an image row (or back) never changed what was on top.
    const orderOf = (r) => ordered.indexOf(r);
    const tiles = ordered.filter((r) => r.kind !== 'image');
    const imgs = ordered.filter((r) => r.kind === 'image');
    if (tiles.length) {
      exp.tiles = { show: true, mime: 'image/png', quality: 1,
        data: tiles.map((r) => {
          const url = mtStrip(r.url);
          const type = /\{z\}/.test(url) ? 'xyz' : 'pmtiles';
          return { show: r.show !== false, id: r.id, name: r.name, type,
            url, delta: num(r.delta) || 0, order: orderOf(r), ...(r.position === 'top' ? { position: 'top' } : {}),
            blendMode: r.blendMode || 'normal', opacity: r.opacity ?? 1 };
        }) };
    }
    if (imgs.length) {
      // image stays a URL string here (JSON-safe); resolveRaster() loads it into an <img>
      // before rendering, since the engine's worldfile warp needs the pixels.
      exp.raster = { show: true, data: imgs.map((r) => ({
        show: r.show !== false, id: r.id, name: r.name, image: mtStrip(r.url), order: orderOf(r),
        ...(r.position === 'top' ? { position: 'top' } : {}),
        worldfile: { ...(r.worldfile || {}) },
        opacity: r.opacity ?? 1, blendMode: r.blendMode || 'normal'
      })) };
    }
  }

  // inset (top-level, like view). Eye-toggle off → no inset. Colours nest under land/ocean/
  // border/bbox.style to match the shared schema the sandbox + drawInset read.
  if ($('showInset').checked) {
    // Merge onto any existing inset so keys the panel doesn't expose (labels/follow/vignette,
    // bbox.refUid) survive an edit rather than being dropped.
    const inset = { ...(p.inset || {}) };
    inset.position = $('insPos').value;
    inset.size = num($('insSize').value) ?? 160;
    inset.radius = $('insRadius').value || '0%';
    inset.projection = $('insProj').value;
    // Each layer's on/off box writes `show: false` (omitted when on, so files stay as they were).
    const shown = (o, id) => { if ($(id).checked) delete o.show; else o.show = false; return o; };
    inset.land = shown({ ...(inset.land || {}), style: { ...(inset.land?.style || {}), fill: $('insLand').value } }, 'insLandOn');
    inset.ocean = shown({ ...(inset.ocean || {}), style: { ...(inset.ocean?.style || {}), fill: $('insOcean').value } }, 'insOceanOn');
    {
      const st = { ...(inset.innerlines?.style || {}), stroke: $('insLines').value,
        'stroke-width': num($('insLinesW').value) ?? 0.4, 'stroke-opacity': num($('insLinesOp').value) ?? 1 };
      if ($('insLinesDash').value) st['stroke-dasharray'] = $('insLinesDash').value; else delete st['stroke-dasharray'];
      inset.innerlines = shown({ ...(inset.innerlines || {}), style: st }, 'insLinesOn');
    }
    inset.border = shown({ ...(inset.border || {}), color: $('insBorder').value, width: num($('insBorderW').value) ?? 1 }, 'insBorderOn');
    if ($('insBorderDash').value) inset.border.dash = $('insBorderDash').value; else delete inset.border.dash;
    const z = num($('insZoom').value); if (z !== undefined) inset.zoom = z;
    // Unlocked = follow the map view (schema `follow`); the centre fields are kept synced to the
    // view by syncInsetFollow, so reading them here captures the current view either way.
    if ($('insLock').checked) delete inset.follow; else inset.follow = true;
    const cx = num($('insCx').value), cy = num($('insCy').value);
    if (cx !== undefined && cy !== undefined) inset.center = [cx, cy];
    // "Follow each frame" (several frames): this frame's OWN extent centres the inset and is the
    // marker — the centre fields only track the active frame, so every inset used to centre on
    // whichever tab was selected. view.bbox is this frame's resolved extent (built above).
    const perFrame = $('insPerFrame').checked;
    if (perFrame) inset.perFrame = true; else delete inset.perFrame;
    const ownBox = Array.isArray(view.bbox) && view.bbox.length === 4 && view.bbox.every(Number.isFinite) ? view.bbox : null;
    if (perFrame && ownBox && fm.proj !== 'geoSatellite') {
      inset.center = [+((ownBox[0] + ownBox[2]) / 2).toFixed(4), +((ownBox[1] + ownBox[3]) / 2).toFixed(4)];
    }
    // "You are here" marker. Typed coords always win. Blank → auto: the current map extent — the
    // drawn bounder when there is one, else the map view (#bbox already holds whichever applies).
    // marker rect|dot|none.
    const kind = $('insBboxKind').value;
    let coords;
    const bbTxt = perFrame ? '' : $('insBbox').value.trim();   // per frame: always the frame's own box
    if (bbTxt) {
      const parts = bbTxt.split(',').map((s) => parseFloat(s.trim()));
      if (parts.length === 4 && parts.every(Number.isFinite)) coords = parts;
    }
    // Flat exports: blank → the current render extent. Reuse view.bbox (resolved above as the drawn
    // bounder, else the live pane view when "Atlas view as bbox" is on) so the marker still shows
    // with no bounder drawn — #bbox stays empty in that mode, so reading the field would drop it.
    // Satellite has NO rectangular bbox, so DON'T fill coords — the engine (drawInset/traceFootprint)
    // inverse-projects the camera footprint instead.
    const satellite = fm.proj === 'geoSatellite';
    if (!coords && !satellite && Array.isArray(view.bbox) && view.bbox.length === 4 && view.bbox.every(Number.isFinite)) {
      coords = view.bbox;
    }
    if (kind === 'none') {
      if (inset.bbox) inset.bbox = { ...inset.bbox, marker: 'none' };
    } else {
      // Keep marker + style even without coords, so the satellite footprint path still renders.
      inset.bbox = { ...(inset.bbox || {}), marker: kind, style: { ...(inset.bbox?.style || {}),
        fill: $('insBboxFill').value, 'fill-opacity': num($('insBboxFillOp').value) ?? 1,
        stroke: $('insBboxStroke').value, 'stroke-width': num($('insBboxSW').value) ?? 1.5
      } };
      if (coords) inset.bbox.coords = coords; else delete inset.bbox.coords;
    }
    p.inset = inset;
  } else {
    delete p.inset;
  }

  // Overlay view/export/inset, preserving points/polys/annotations/data on the base object.
  // buildProject must NOT touch `frames` — frame serialization happens in serializeFrames().
  p.view = view;
  p.export = exp;
  return p;
}
// Active-frame wrapper: build from the live Map-panel DOM (via readFrameMap) and mutate the
// module `project` in place, so the JSON-save path (projectForSave) keeps seeing the current
// project. render()'s per-frame loop calls buildProject(frame.map) directly instead.
function readPanel() { return buildProject(readFrameMap(), project); }


// Snapshot all frames (active one first captured fresh from the DOM) for JSON round-trip.
function serializeFrames() { saveActiveFrame(); return frames.map((f) => ({ name: f.name || '', map: f.map })); }

// ---- write a loaded project -> the panel ----------------------------------
// ---- annotations panel: edits project.annotations.data (Atlas shapes: straight-arrow,
// curved-arrow, text-area, plus Mapa's callout). translate.js turns them into d3-svg-annotation
// callouts in the export's top-most #callouts group. Positions are lng/lat; "edit mode"
// renders in d3-annotation edit mode and each drag comes back as an `annotationmove` event.
// Annotation edits redraw ONLY the annotation layer (#callouts) on each rendered frame, reusing
// that frame's projection — no basemap / data / tiles redraw. Nothing rendered yet → full render.
function annoRender() {
  const svgs = [...($('map')?.querySelectorAll('svg') || [])].filter((sv) => sv.projection);
  if (!svgs.length) { render(); return; }
  resolveAnnoAnchors();
  const ann = atlasAnnotationsToMapa(project.annotations);
  if (annoEditOn) ann.editMode = true;
  for (const it of ann.data) {   // attached annotations: the layer's features as their data
    const src = project.annotations?.data?.[it.src];
    const L = src && src.anchor && anchorLayer(src.anchor);
    if (L) { const fc = drawnFC(L); if (fc.features.length) it.feature = fc; }
  }
  svgs.forEach((sv) => redrawAnnotations(sv, ann, project.fonts?.annotations));
  { const pk = $('jsonPeek'); if (pk) { readPanel(); pk.value = JSON.stringify(projectForSave(), null, 2); } }
}
const ANNO_TYPES = { 'callout': 'callout', 'straight-arrow': 'arrow', 'curved-arrow': 'curve', 'text-area': 'text' };
function annoState() {
  if (!project.annotations || typeof project.annotations !== 'object') project.annotations = { show: true, data: [] };
  if (!Array.isArray(project.annotations.data)) project.annotations.data = [];
  return project.annotations;
}
// Where a new annotation goes: the middle of the last render (via its projection), else the
// middle of the extent. `off` is a px offset (render) mapped to the note / arrow tail.
function annoSpot(off) {
  const svg = $('map')?.querySelector('svg');
  if (svg?.projection?.invert) {
    const w = +svg.getAttribute('width'), h = +svg.getAttribute('height');
    const r = (xy) => svg.projection.invert(xy).map((v) => +v.toFixed(4));
    return { at: r([w / 2, h / 2]), noteAt: r([w / 2 + off[0], h / 2 + off[1]]) };
  }
  const b = (readPanel().view?.bbox) || paneBounds || [-10, -10, 10, 10];
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, k = (b[2] - b[0]) / 1000;
  const r = (v) => +v.toFixed(4);
  return { at: [r(cx), r(cy)], noteAt: [r(cx + off[0] * k), r(cy - off[1] * k)] };
}
function annoAdd(kind) {
  const a = annoState(); a.show = true; $('showAnno').checked = true;
  let item;
  if (kind === 'callout') { const p = annoSpot([60, -50]); item = { type: 'callout', at: p.at, noteAt: p.noteAt, text: 'Callout', style: { stroke: '#000000', 'stroke-width': 1 } }; }
  else if (kind === 'text') { const p = annoSpot([0, 0]); item = { type: 'text-area', position: p.at, text: 'Text', style: { fill: '#ffffff', 'fill-opacity': 0.85, stroke: '#000000', 'stroke-width': 1, color: '#000000' } }; }
  else { const p = annoSpot([-80, -50]); item = { type: kind === 'curve' ? 'curved-arrow' : 'straight-arrow', start: p.noteAt, end: p.at, ...(kind === 'curve' ? { bend: 0.25 } : {}), style: { stroke: '#000000', 'stroke-width': 2 } }; }
  a.data.push(item);
  // Adding is an explicit action — draw it now, live update or not (like Crop to view).
  renderAnnoList(); annoRender();
}
// One row per annotation, same markup as the Basemap layer rows: ▸ · kind · text · × on the head,
// labelled controls underneath (collapsed by default). Callouts expose d3-annotation's own options
// (Susie Lu's API: type, note label/wrap/align/orientation/padding/line, connector end, subject size),
// stored under `d.d3`; arrows and text boxes keep their few settings.
const D3_TYPES = ['circle', 'callout', 'elbow', 'curve', 'rect', 'label', 'badge'];
// An annotation's POINT (what it points at): callout `at`, arrow head `end`, text box `position`.
// Its partner (callout note / arrow tail) moves with it, keeping the same offset.
const annoPoint = (d) => d.type === 'callout' ? d.at : d.type === 'text-area' ? d.position : (d.end || null);
function setAnnoPoint(d, ll) {
  const r = (v) => +(+v).toFixed(4), p = ll.map(r), old = annoPoint(d);
  const shift = (q) => (old && q ? [r(q[0] + p[0] - old[0]), r(q[1] + p[1] - old[1])] : q);
  if (d.type === 'callout') { d.noteAt = shift(d.noteAt); d.at = p; }
  else if (d.type === 'text-area') d.position = p;
  else { d.start = shift(d.start); d.end = p; }
}
// Attach to data: `d.anchor = { source, filter }` names a Data-panel layer (by its pointer + filter,
// which survive save/reload — layer ids don't). The point sits on the centre of that layer's
// (filtered) features, resolved on every render so it follows the data.
const anchorKey = (src, filter) => src + '\u0001' + (filter || '');
function anchorLayer(a) {
  return a && customData.find((x) => x.kind !== 'points' && x.geometry && anchorKey(x.source, x.filter) === anchorKey(a.source, a.filter));
}
// A layer's features exactly as it's drawn (filter + rewind): an inside-out ring's centre is the
// far side of the globe (Demchok's centre came out at -100.7, -32.9), so anchors use these.
function drawnFC(L) {
  return { type: 'FeatureCollection', features: applyRewind(L, filteredFC(L).features) };
}
function resolveAnnoAnchors() {
  for (const d of project.annotations?.data || []) {
    if (!d.anchor) continue;
    const L = anchorLayer(d.anchor); if (!L) continue;   // layer not loaded/removed: keep the last point
    const fc = drawnFC(L); if (!fc.features.length) continue;
    const c = d3.geoCentroid(fc);
    if (c.every(Number.isFinite)) setAnnoPoint(d, c);
  }
}
function renderAnnoList() {
  const host = $('annoList'); if (!host) return;
  const a = project.annotations;
  $('showAnno').checked = a ? a.show !== false : true;
  host.replaceChildren();
  const lc = (label, el) => { const sp = document.createElement('span'); sp.className = 'lc';
    const l = document.createElement('label'); l.textContent = label; sp.append(l, el); return sp; };
  const num = (val, step, min, onv, title) => { const i = document.createElement('input'); i.type = 'number';
    i.step = step; if (min != null) i.min = min; i.value = val; if (title) i.title = title;
    i.oninput = () => { const v = parseFloat(i.value); if (Number.isFinite(v)) onv(v); annoRender(); }; return i; };
  const sel = (opts, val, onv) => { const s = document.createElement('select');
    for (const o of opts) { const [v, t] = Array.isArray(o) ? o : [o, o]; s.append(new Option(t, v)); }
    s.value = val; s.onchange = () => { onv(s.value); annoRender(); }; return s; };
  const color = (val, onv, title) => { const i = document.createElement('input'); i.type = 'color'; i.value = val; i.title = title || '';
    i.oninput = () => { onv(i.value); annoRender(); }; return i; };
  (a?.data || []).forEach((d, i) => {
    d.style = d.style || {};
    const item = document.createElement('div'); item.className = 'layer-item anno-item' + (d._open ? ' open' : '');
    const head = document.createElement('div'); head.className = 'layer-head';
    const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'lx-btn'; tog.textContent = d._open ? '▾' : '▸';
    tog.title = "show / hide this annotation's settings";
    tog.addEventListener('click', () => { d._open = !d._open; });
    const kind = document.createElement('label'); kind.textContent = ANNO_TYPES[d.type] || d.type; kind.style.minWidth = '40px';
    head.append(tog, kind);
    const hasText = d.type === 'callout' || d.type === 'text-area' || 'text' in d;
    if (hasText) {
      // Multi-line: Enter adds a line break, and each typed line is a line on the map.
      const t = document.createElement('textarea'); t.value = d.text || ''; t.placeholder = 'text'; t.className = 'anno-text';
      t.rows = Math.max(1, (d.text || '').split('\n').length); t.spellcheck = false;
      t.oninput = () => { d.text = t.value; t.rows = Math.max(1, t.value.split('\n').length); annoRender(); };
      head.append(t);
    } else { const sp = document.createElement('span'); sp.style.flex = '1'; head.append(sp); }
    const del = document.createElement('button'); del.type = 'button'; del.className = 'anno-del'; del.textContent = '×'; del.title = 'remove';
    del.onclick = () => { a.data.splice(i, 1); renderAnnoList(); annoRender(); };
    head.append(del);

    const ctrls = document.createElement('div'); ctrls.className = 'layer-ctrls anno-ctrls';
    const st = d.style;
    if (d.type === 'text-area') {
      ctrls.append(
        lc('text', color(st.color || '#000000', (v) => { st.color = v; }, 'text colour')),
        lc('size', num(st['text-size'] ?? 12, 1, 6, (v) => { st['text-size'] = v; })),
        lc('box', color(st.fill || '#ffffff', (v) => { st.fill = v; }, 'box fill')),
        lc('box op.', num(st['fill-opacity'] ?? 0.85, 0.05, 0, (v) => { st['fill-opacity'] = v; })),
        lc('border', color(st.stroke || '#000000', (v) => { st.stroke = v; }, 'box border')),
        lc('width', num(st['stroke-width'] ?? 1, 0.5, 0, (v) => { st['stroke-width'] = v; })));
    } else {
      ctrls.append(
        lc('stroke', color(st.stroke || '#000000', (v) => { st.stroke = v; }, 'line colour')),
        lc('width', num(st['stroke-width'] ?? (d.type.endsWith('arrow') ? 2 : 1), 0.5, 0, (v) => { st['stroke-width'] = v; })));
    }
    if (d.type.endsWith('arrow')) ctrls.append(lc('head', sel([['sharp', 'sharp'], ['open', 'open'], ['none', 'none']], d.head || 'sharp', (v) => { if (v === 'sharp') delete d.head; else d.head = v; })));
    if (d.type === 'curved-arrow') ctrls.append(lc('bend', num(d.bend ?? 0.25, 0.05, null, (v) => { d.bend = v; })));
    // Where it points: typed lng/lat (detaches), or attached to a Data layer's feature.
    {
      const p = annoPoint(d) || [0, 0];
      const setLL = (k) => (v) => { const q = [...(annoPoint(d) || [0, 0])]; q[k] = v; delete d.anchor; setAnnoPoint(d, q); aSel.value = ''; };
      const lngI = num(p[0], 0.0001, null, setLL(0), 'longitude'), latI = num(p[1], 0.0001, null, setLL(1), 'latitude');
      lngI.classList.add('anno-ll'); latI.classList.add('anno-ll');
      const layers = customData.filter((x) => x.kind !== 'points' && x.geometry);
      const aSel = sel([['', '— free —'], ...layers.map((x) => [anchorKey(x.source, x.filter), layerLabel(x)])],
        d.anchor ? anchorKey(d.anchor.source, d.anchor.filter) : '', (v) => {
          const L = layers.find((x) => anchorKey(x.source, x.filter) === v);
          if (L) { d.anchor = { source: L.source, ...(L.filter ? { filter: L.filter } : {}) }; resolveAnnoAnchors(); }
          else delete d.anchor;
          renderAnnoList();
        });
      aSel.classList.add('anno-attach'); aSel.title = 'attach to a Data layer — the point sits on its feature (centre) and follows it';
      lngI.disabled = latI.disabled = !!d.anchor;
      ctrls.append(lc(d.type.endsWith('arrow') ? 'head lng' : 'lng', lngI), lc('lat', latI), lc('attach to', aSel));
    }
    if (d.type === 'callout') {
      const o = d.d3 = d.d3 || {};
      const lab = document.createElement('input'); lab.type = 'text'; lab.value = o.label || ''; lab.placeholder = 'second line';
      lab.className = 'anno-label'; lab.oninput = () => { o.label = lab.value || undefined; annoRender(); };
      ctrls.append(
        lc('size', num(st['text-size'] ?? 12, 1, 6, (v) => { st['text-size'] = v; })),
        lc('type', sel(D3_TYPES, o.type || 'circle', (v) => { o.type = v; })),
        lc('label', lab),
        lc('wrap', num(o.wrap ?? 144, 10, 20, (v) => { o.wrap = v; }, 'wrap width (px)')),
        lc('align', sel(['dynamic', 'left', 'middle', 'right', 'top', 'bottom'], o.align || 'dynamic', (v) => { o.align = v; })),
        lc('orient', sel([['topBottom', 'top/bottom'], ['leftRight', 'left/right'], ['fixed', 'fixed']], o.orientation || 'topBottom', (v) => { o.orientation = v; })),
        lc('padding', num(o.padding ?? 5, 1, 0, (v) => { o.padding = v; })),
        lc('note line', sel([['', 'auto'], ['horizontal', 'horizontal'], ['vertical', 'vertical'], ['none', 'none']], o.lineType || '', (v) => { o.lineType = v || undefined; })),
        lc('end', sel([['', 'none'], ['arrow', 'arrow'], ['dot', 'dot']], o.end || '', (v) => { o.end = v || undefined; })),
        lc('subject', num(o.radius ?? 3, 1, 0, (v) => { o.radius = v; }, 'subject size: circle radius / rect half-size / badge radius')));
    }
    item.append(head, ctrls); host.append(item);
  });
}
$('annoAddCallout').onclick = () => annoAdd('callout');
$('annoAddArrow').onclick = () => annoAdd('arrow');
$('annoAddCurve').onclick = () => annoAdd('curve');
$('annoAddText').onclick = () => annoAdd('text');
$('showAnno').onchange = () => { annoState().show = $('showAnno').checked; annoRender(); };
let annoEditOn = true; // on by default — handles only show on the Output, never in a download
$('annoEdit').onchange = () => {
  annoEditOn = $('annoEdit').checked;
  $('map')?.classList.toggle('anno-editing', annoEditOn);
  annoRender(); // handles appear/disappear — only the annotation layer redraws
};
// A drag on the Output (edit mode): write the new lng/lat back to the annotation it came from.
$('map').addEventListener('annotationmove', (e) => {
  const { src, at, noteAt, bend, skew } = e.detail || {};
  const d = project.annotations?.data?.[src];
  if (!d || !at || !noteAt) return;
  const r = (p) => p.map((v) => +v.toFixed(4));
  // Did the POINT itself move (vs only the note / tail)? Compared before anything is written back.
  const before = annoPoint(d), q = r(at);
  const pointMoved = !!before && (Math.abs(before[0] - q[0]) > 1e-3 || Math.abs(before[1] - q[1]) > 1e-3);
  if (d.type === 'straight-arrow' || d.type === 'curved-arrow') {
    d.end = r(at); d.start = r(noteAt);
    if (d.type === 'curved-arrow' && Number.isFinite(bend)) d.bend = bend;
    if (d.type === 'curved-arrow' && Number.isFinite(skew)) { if (skew) d.skew = skew; else delete d.skew; }
  }
  else if (d.type === 'text-area') d.position = r(noteAt);
  else if (d.type === 'callout') { d.at = r(at); d.noteAt = r(noteAt); }
  else if (d.lng != null) { [d.lng, d.lat] = r(at); d.noteAt = r(noteAt); }
  // Dragging an attached annotation's point detaches it — otherwise the next redraw (any edit)
  // snapped it back onto the feature. Dragging only the note keeps it attached.
  if (d.anchor && pointMoved && d.type !== 'text-area') delete d.anchor;
  renderAnnoList();
  readPanel(); $('jsonPeek').value = JSON.stringify(projectForSave(), null, 2);
});

// ---- Fonts panel: one row per kind of text (same rows as Basemap layers). project.fonts =
// { annotations: { family, weight, style }, labels: { … } }; blank fields = the engine default.
const FONT_ROLES = [['annotations', 'annotations'], ['labels', 'labels']];
// Font sources for the family box: fonts installed on this machine (Local Font Access API —
// needs a click + permission, Chrome/Edge only) and Google Fonts (list from the open Fontsource
// API; a picked one is loaded from Google Fonts so the preview is the real font).
let LOCAL_FONTS = [];            // family names
const GOOGLE_FONTS = new Map();  // family → { weights, styles }
let googleFontsP = null;
function fillFontList() {
  const dl = $('fontFamilies'); if (!dl) return;
  const seen = new Set(), opts = [];
  const add = (fam, tag) => { if (!fam || seen.has(fam)) return; seen.add(fam); const o = document.createElement('option'); o.value = fam; o.label = tag; opts.push(o); };
  LOCAL_FONTS.forEach((f) => add(f, 'installed'));
  ['sans-serif', 'serif', 'monospace'].forEach((f) => add(f, 'generic'));
  for (const f of GOOGLE_FONTS.keys()) add(f, LOCAL_FONTS.includes(f) ? 'installed' : 'Google');
  dl.replaceChildren(...opts);
}
function loadGoogleFontList() {
  if (!googleFontsP) googleFontsP = fetch('https://api.fontsource.org/v1/fonts?type=google')
    .then((r) => (r.ok ? r.json() : []))
    .then((list) => { for (const f of list) GOOGLE_FONTS.set(f.family, { weights: f.weights || [400], styles: f.styles || ['normal'] }); fillFontList(); })
    .catch(() => { googleFontsP = null; });
  return googleFontsP;
}
// Load a Google font (all its weights, italic too) for the preview; resolves once it's usable.
const loadedGoogle = new Set();
async function ensureFont(family) {
  if (!family || LOCAL_FONTS.includes(family) || loadedGoogle.has(family)) return false;
  await loadGoogleFontList();
  const meta = GOOGLE_FONTS.get(family); if (!meta) return false;
  loadedGoogle.add(family);
  const ital = meta.styles.includes('italic');
  const axes = meta.weights.flatMap((w) => (ital ? [`0,${w}`, `1,${w}`] : [`${w}`])).sort();
  const link = document.createElement('link'); link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(family).replace(/%20/g, '+') +
    (ital ? ':ital,wght@' : ':wght@') + axes.join(';') + '&display=block';
  document.head.append(link);
  await new Promise((res) => { link.onload = res; link.onerror = res; });
  try { await document.fonts.load(`16px "${family}"`); } catch (e) {}
  return true;
}
// After a font arrives, redraw what uses it (annotation boxes are sized from the text).
// Annotations redraw in place (only when an export exists — never a surprise full render);
// labels follow live update like any other setting.
function fontsChanged(key) {
  if (key === 'annotations') { if ([...($('map')?.querySelectorAll('svg') || [])].some((sv) => sv.projection)) annoRender(); else markStale(true); }
  else requestRender();
}
// ---- font picker: the family box opens a list where every name is drawn in its own font.
// Google fonts load lazily as their rows scroll into view, and only the letters of their name
// (Google Fonts `text=` subset — a few KB each). Installed / generic fonts preview natively.
const previewed = new Set();
function previewFont(fam) {
  if (previewed.has(fam) || !GOOGLE_FONTS.has(fam) || LOCAL_FONTS.includes(fam)) return;
  previewed.add(fam);
  const l = document.createElement('link'); l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=' + encodeURIComponent(fam).replace(/%20/g, '+') +
    '&text=' + encodeURIComponent(fam) + '&display=swap';
  document.head.append(l);
}
function closeFontPicker() { document.querySelectorAll('.font-pick').forEach((n) => n.remove()); }
function openFontPicker(input) {
  closeFontPicker();
  const pop = document.createElement('div'); pop.className = 'font-pick';
  const r = input.getBoundingClientRect();
  pop.style.left = Math.min(r.left, innerWidth - 300) + 'px';
  pop.style.top = (r.bottom + 2) + 'px';
  pop.style.maxHeight = Math.max(160, innerHeight - r.bottom - 12) + 'px';
  document.body.append(pop);
  const io = new IntersectionObserver((ents) => ents.forEach((e) => { if (e.isIntersecting) { previewFont(e.target.dataset.fam); io.unobserve(e.target); } }), { root: pop });
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const all = [...LOCAL_FONTS.map((f) => [f, 'installed']), ['sans-serif', 'generic'], ['serif', 'generic'], ['monospace', 'generic'],
      ...[...GOOGLE_FONTS.keys()].filter((f) => !LOCAL_FONTS.includes(f)).map((f) => [f, 'Google'])];
    const hits = (q ? all.filter(([f]) => f.toLowerCase().includes(q)) : all).slice(0, 400);
    pop.replaceChildren();
    if (!hits.length) { const e = document.createElement('div'); e.className = 'fp-empty'; e.textContent = GOOGLE_FONTS.size ? 'no match' : 'loading fonts…'; pop.append(e); return; }
    for (const [fam, src] of hits) {
      const o = document.createElement('div'); o.className = 'fp-opt'; o.dataset.fam = fam;
      const n = document.createElement('span'); n.className = 'fp-name'; n.textContent = fam; n.style.fontFamily = `"${fam}", ${fam === 'serif' || fam === 'monospace' ? fam : 'sans-serif'}`;
      const t = document.createElement('span'); t.className = 'fp-src'; t.textContent = src;
      o.append(n, t);
      o.onmousedown = (e) => { e.preventDefault(); input.value = fam; closeFontPicker(); input.dispatchEvent(new Event('change')); };
      pop.append(o); io.observe(o);
    }
  };
  input._fpDraw = draw;
  draw();
  loadGoogleFontList().then(() => { if (pop.isConnected) draw(); });
}
document.addEventListener('mousedown', (e) => { if (!e.target.closest('.font-pick, input.font-fam')) closeFontPicker(); });
$('fontLocalBtn')?.addEventListener('click', async () => {
  const note = $('fontLocalNote');
  if (typeof window.queryLocalFonts !== 'function') { note.textContent = 'not supported in this browser — Google Fonts only'; return; }
  try {
    const fonts = await window.queryLocalFonts();
    LOCAL_FONTS = [...new Set(fonts.map((f) => f.family))].sort((a, b) => a.localeCompare(b));
    note.textContent = LOCAL_FONTS.length + ' installed fonts added';
    fillFontList();
  } catch (e) { note.textContent = 'permission denied — Google Fonts only'; }
});
function renderFontRows() {
  const host = $('fontRows'); if (!host) return;
  const F = project.fonts || {};
  host.replaceChildren();
  for (const [key, name] of FONT_ROLES) {
    const f = F[key] || {};
    const item = document.createElement('div'); item.className = 'layer-item open';
    const head = document.createElement('div'); head.className = 'layer-head';
    const tog = document.createElement('button'); tog.type = 'button'; tog.className = 'lx-btn'; tog.textContent = '▾';
    const lab = document.createElement('label'); lab.textContent = name;
    head.append(tog, lab);
    const ctrls = document.createElement('div'); ctrls.className = 'layer-ctrls';
    const lc = (t, el) => { const sp = document.createElement('span'); sp.className = 'lc'; const l = document.createElement('label'); l.textContent = t; sp.append(l, el); return sp; };
    const set = (k, v) => { project.fonts = project.fonts || {}; const r = project.fonts[key] = project.fonts[key] || {};
      if (v) r[k] = v; else delete r[k];
      if (!Object.keys(r).length) delete project.fonts[key];
      fontsChanged(key);
      if (k === 'family' && v) ensureFont(v).then((loaded) => { if (loaded) fontsChanged(key); }); };
    const fam = document.createElement('input'); fam.type = 'text'; fam.setAttribute('list', 'fontFamilies'); fam.className = 'font-fam';
    fam.placeholder = 'default'; fam.value = f.family || ''; fam.spellcheck = false;
    fam.removeAttribute('list');   // our picker, not the browser's text-only suggestions
    fam.addEventListener('focus', () => openFontPicker(fam));
    fam.addEventListener('input', () => fam._fpDraw?.());
    fam.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') { closeFontPicker(); if (e.key === 'Enter') fam.dispatchEvent(new Event('change')); } });
    if (f.family) ensureFont(f.family).then((loaded) => { if (loaded) fontsChanged(key); });   // a loaded project's font
    fam.onchange = () => set('family', fam.value.trim());
    const wt = document.createElement('select');
    for (const [v, t] of [['', 'default'], ['300', 'light'], ['400', 'regular'], ['500', 'medium'], ['600', 'semibold'], ['700', 'bold'], ['800', 'heavy']]) wt.append(new Option(t, v));
    wt.value = f.weight || ''; wt.onchange = () => set('weight', wt.value);
    const it = document.createElement('input'); it.type = 'checkbox'; it.checked = f.style === 'italic'; it.title = 'italic';
    it.onchange = () => set('style', it.checked ? 'italic' : '');
    ctrls.append(lc('family', fam), lc('weight', wt), lc('italic', it));
    item.append(head, ctrls); host.append(item);
  }
}
renderFontRows();

function writePanel(p) {
  renderAnnoList();
  renderFontRows();
  $('bbox').value = Array.isArray(p.view?.bbox) ? p.view.bbox.join(', ') : '';
  // A project/template bbox is the render extent — show it on the pane like a drawn frame.
  bboxShown = !!$('bbox').value; $('bboxShow').classList.toggle('on', bboxShown);
  const e = p.export || {};
  if (e.width != null) $('w').value = e.width;
  if (e.height != null) $('h').value = e.height;
  if (typeof e.projection?.proj === 'string') $('proj').value = e.projection.proj;
  // geoSatellite: read the authored @jjhembd PRIMITIVES (source of truth) into satParams so the
  // export renders them verbatim (scale/yShift/distance derived in buildSatelliteFromParams).
  // A new project brings its own camera — drop any pasted notebook camera so it doesn't stay locked.
  { const ta = $('satPaste'); if (ta) ta.value = ''; const m = $('satPasteMsg'); if (m) m.textContent = ''; }
  if (e.projection?.proj === 'geoSatellite') {
    const p = e.projection;
    // The authored satellite primitives live under projection._params (source of truth);
    // fall back to the top level for older files that stored them there.
    const prim = p._params || p;
    navGlobe = true;
    { const gb = $('mlGlobe'); if (gb) gb.checked = true; }  // globe toggle on for satellite
    syncBounderAvailability(); // satellite defaults to globe → disable the bounder now
    if (Number.isFinite(prim.longitude) || Number.isFinite(prim.altitude)) {
      satParams = {
        longitude: prim.longitude, latitude: prim.latitude, altitude: prim.altitude,
        rotation: prim.rotation, tilt: prim.tilt, fieldOfView: prim.fieldOfView
      };
      if (Number.isFinite(prim.fieldOfView)) { const fs = $('satFov'); if (fs) fs.value = Number.isInteger(+prim.fieldOfView) ? (+prim.fieldOfView).toFixed(1) : String(+prim.fieldOfView); }
      // Seed the pane on the export's TRUE centre (invert the projection at the canvas centre),
      // not the nadir — that's where the pane and export are actually centred. Zoom from altitude.
      const [lookLng, lookLat] = satelliteViewCenter({
        longitude: prim.longitude, latitude: prim.latitude, altitude: prim.altitude,
        rotation: prim.rotation, tilt: prim.tilt, fieldOfView: prim.fieldOfView,
        width: num($('w').value) || 1000, height: num($('h').value) || num($('w').value) || 1000
      });
      satelliteCam = {
        lng: lookLng, lat: lookLat, bearing: prim.rotation || 0, pitch: prim.tilt || 0,
        altitudeKm: Number.isFinite(prim.altitude) ? prim.altitude : null,
        zoom: paneZoomFromAltitude(prim.altitude, lookLat, prim.tilt)
      };
    } else if (Array.isArray(p.rotate)) {
      // Back-compat with the old derived schema (scale/rotate/tilt/distance).
      satelliteCam = {
        lng: -(p.rotate[0] || 0), lat: -(p.rotate[1] || 0), bearing: (p.rotate[2] || 0),
        pitch: p.tilt || 0,
        altitudeKm: Number.isFinite(p.distance) ? (p.distance - 1) * EARTH_RADIUS_KM : null,
        zoom: Number.isFinite(p.scale) ? Math.log2(p.scale * 2 * Math.PI / 512) : null
      };
    }
  }
  if (e.graphic?.background) $('bg').value = e.graphic.background;
  if (e.clipping?.margin != null) $('buffer').value = e.clipping.margin;
  const bm = e.basemap || {};
  $('showBasemap').checked = bm.show !== false;
  $('bmGen').value = bm.simplify === 'auto' ? 'auto' : Number(bm.simplify) > 0 ? 'custom' : '';
  $('bmGenTol').value = Number(bm.simplify) > 0 ? bm.simplify : '';
  syncBmGen();
  for (const L of LAYERS) {
    const seg = bm[L.key];
    const showEl = document.querySelector(`[data-layer="${L.key}"][data-k="show"]`);
    if (seg) showEl.checked = seg.show !== false;
    document.querySelectorAll(`[data-layer="${L.key}"]`).forEach((el) => {
      const k = el.dataset.k; if (k === 'show') return;
      if (k === 'rewind') { el.classList.toggle('on', seg?.rewind === true); return; }
      if (k === 'simplify') { el.value = Number(seg?.simplify) > 0 ? seg.simplify : ''; return; }
      if (k === 'pattern') { setPatternValue(el, seg?.style?.pattern); return; }
      if (seg?.style?.[k] != null) el.value = seg.style[k];
    });
  }
  $('showScalebar').checked = !!e.scalebar?.show;
  if (e.scalebar) {
    if (e.scalebar.topValue != null) $('sbTopV').value = e.scalebar.topValue;
    if (e.scalebar.topUnit) $('sbTopU').value = e.scalebar.topUnit;
    if (e.scalebar.bottomValue != null) $('sbBotV').value = e.scalebar.bottomValue;
    if (e.scalebar.bottomUnit) $('sbBotU').value = e.scalebar.bottomUnit;
    if (e.scalebar.anchor) $('sbAnchor').value = e.scalebar.anchor;
    if (Array.isArray(e.scalebar.offset)) { $('sbOffX').value = e.scalebar.offset[0]; $('sbOffY').value = e.scalebar.offset[1]; }
  }
  $('showNorth').checked = !!e.northArrow?.show;
  if (e.northArrow) {
    $('naType').value = e.northArrow.type || 'arrow';
    if (!$('naType').value) $('naType').value = 'arrow';   // a style that no longer exists
    if (e.northArrow.position) $('naPos').value = e.northArrow.position;
    if (e.northArrow.size != null) $('naSize').value = e.northArrow.size;
    const c = e.northArrow.style?.fill || e.northArrow.style?.stroke; if (c) $('naColor').value = c;
  }
  // inset (top-level, like view). Eye-toggle reflects presence; fields fall back to their HTML
  // defaults for anything the project omits.
  const ins = p.inset;
  $('showInset').checked = !!ins;
  if (ins) {
    if (ins.position) $('insPos').value = ins.position;
    if (ins.size != null) $('insSize').value = ins.size;
    if (ins.radius != null) $('insRadius').value = ins.radius;
    if (ins.projection) $('insProj').value = ins.projection;
    if (Array.isArray(ins.center)) { $('insCx').value = ins.center[0]; $('insCy').value = ins.center[1]; }
    if (ins.zoom != null) $('insZoom').value = ins.zoom;
    // follow:true → unlocked (tracks the view); anything else (e.g. a fixed-centre project) → locked.
    $('insLock').checked = !ins.follow;
    $('insPerFrame').checked = ins.perFrame === true;
    if (ins.land?.style?.fill) $('insLand').value = ins.land.style.fill;
    if (ins.ocean?.style?.fill) $('insOcean').value = ins.ocean.style.fill;
    if (ins.border?.color) $('insBorder').value = ins.border.color;
    $('insBorderW').value = ins.border?.width ?? 1;
    $('insBorderDash').value = ins.border?.dash || '';
    { const il = ins.innerlines?.style || {};
      $('insLinesW').value = il['stroke-width'] ?? 0.4;
      $('insLinesOp').value = il['stroke-opacity'] ?? 1;
      $('insLinesDash').value = il['stroke-dasharray'] || ''; }
    if (ins.innerlines?.style?.stroke) $('insLines').value = ins.innerlines.style.stroke;
    $('insLandOn').checked = ins.land?.show !== false;
    $('insOceanOn').checked = ins.ocean?.show !== false;
    $('insLinesOn').checked = ins.innerlines?.show !== false;
    $('insBorderOn').checked = ins.border?.show !== false && ins.border?.color !== null;
    if (ins.bbox?.marker) $('insBboxKind').value = ins.bbox.marker;
    if (Array.isArray(ins.bbox?.coords)) $('insBbox').value = ins.bbox.coords.join(', ');
    const bs = ins.bbox?.style || {};
    if (bs.fill) $('insBboxFill').value = bs.fill;
    if (bs['fill-opacity'] != null) $('insBboxFillOp').value = bs['fill-opacity'];
    if (bs.stroke) $('insBboxStroke').value = bs.stroke;
    if (bs['stroke-width'] != null) $('insBboxSW').value = bs['stroke-width'];
  }
  syncInsetFollow(); // reflect lock state (disable centre fields + label) after populating
  // One Raster list holds tile layers (export.tiles) AND worldfile images (export.raster).
  // readPanel reverses list → render order, so reverse render → list here.
  $('showRaster').checked = !!(e.tiles?.show || e.raster?.show);
  const tileRows = (e.tiles?.data || []).map((t, i) => ({
    kind: 'tile',
    id: t.id || ('raster-' + (i + 1)),
    name: t.name || t.id || ('raster ' + (i + 1)),   // `name` = the label typed in the row
    url: mtStrip(t.url || ''),
    blendMode: t.blendMode || 'normal',
    opacity: t.opacity ?? 1,
    delta: t.delta ?? 0,
    show: t.show !== false,
    position: t.position === 'top' ? 'top' : 'raster',
    _order: t.order,
    _open: false
  }));
  const imgRows = (e.raster?.data || []).map((t, i) => ({
    kind: 'image',
    id: t.id || ('image-' + (i + 1)),
    name: t.name || t.id || ('image ' + (i + 1)),
    url: typeof t.image === 'string' ? mtStrip(t.image) : '',
    blendMode: t.blendMode || 'normal',
    opacity: t.opacity ?? 1,
    delta: 0,
    worldfile: { xPixelSize: 1, yRotation: 0, xRotation: 0, yPixelSize: -1, xUpperLeft: 0, yUpperLeft: 0, ...(t.worldfile || {}) },
    show: t.show !== false,
    position: t.position === 'top' ? 'top' : 'raster',
    _order: t.order,
    _open: false
  }));
  // Tiles and images are saved in two lists, so their stacking across kinds comes back from each
  // row's saved `order` (0 = bottom).
  const both = [...tileRows, ...imgRows].sort((a, b) => (a._order ?? 0) - (b._order ?? 0));
  both.forEach((r) => delete r._order);
  rasterData = both.reverse();   // the panel lists top-first
  // Seed the default hillshade so it's always in the list to toggle on, even for a project
  // that ships no raster. Hosted URL — hs.pmtiles has no local copy (see rasterData init).
  if (!rasterData.length) {
    rasterData.push({ kind: 'tile', id: 'hillshade', name: 'hillshade', url: 'https://tiles.mbricknell.com/hs.pmtiles',
      blendMode: 'normal', opacity: 1, delta: 0, show: true, _open: false });
  }
  renderRasterList();
  // Output frames: rebuild from project.frames (per-view map snapshots) if present, else capture the
  // single frame from the DOM we just populated. A project with no frames key = one frame, as before.
  if (Array.isArray(p.frames) && p.frames.length && p.frames[0] && p.frames[0].map) {
    frames = p.frames.map((f) => ({ id: 'frm' + (++frameIdSeq), name: f.name || '', map: f.map }));
  } else {
    frames = [{ id: 'frm' + (++frameIdSeq), name: '', map: readFrameMap() }];
  }
  activeFrame = 0;
  applyFrameMap(frames[0].map);
  renderFramesList();
}

// ---- render ---------------------------------------------------------------
function loadImage(url) {
  return new Promise((res, rej) => { const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => res(im); im.onerror = () => rej(new Error('image load failed: ' + url)); im.src = url; });
}
// Load each export.raster image URL into an <img> (the worldfile warp needs pixels). Returns a
// CLONE so the project keeps its URL strings (JSON-safe); the engine gets real Image objects.
async function resolveRaster(p) {
  // MapTiler URLs get this browser's key; without one those rows are skipped.
  const tl = p && p.export && p.export.tiles && p.export.tiles.data;
  if (Array.isArray(tl) && tl.length) {
    let skipped = 0;
    const data = tl.map((r) => { const url = mtResolve(r.url); if (url === null) { skipped++; return { ...r, show: false }; } return { ...r, url }; });
    if (skipped) note('MapTiler layer skipped — no key in the Raster panel');
    p = { ...p, export: { ...p.export, tiles: { ...p.export.tiles, data } } };
  }
  const data = p && p.export && p.export.raster && p.export.raster.data;
  if (!Array.isArray(data) || !data.length) return p;
  const loaded = await Promise.all(data.map(async (r) => {
    // A dev-dropped image renders from its in-memory blob, but the project still stores the
    // POINTER (r.image) — so what gets saved is the repo/hosted path, never a blob: URL.
    const blob = r.id ? rasterBlobs.get(r.id) : null;
    if (blob) {
      try { return { ...r, image: await loadImage(blob) }; }
      catch (e) { console.warn('[mapa]', e.message); return { ...r, show: false }; }
    }
    if (typeof r.image !== 'string' || !r.image) return r;
    if (isMt(r.image)) { const u = mtResolve(r.image); if (!u) return { ...r, show: false }; r = { ...r, image: u }; }
    // Pointer: absolute URLs pass through; a relative path resolves against the project
    // folder first, then flat ./projects/ — the same chain as the data pointers.
    for (const cand of imageCandidates(r.image)) {
      try { return { ...r, image: await loadImage(cand) }; } catch (e) { /* try next */ }
    }
    console.warn('[mapa] raster image failed:', r.image);
    return { ...r, show: false };
  }));
  return { ...p, export: { ...p.export, raster: { ...p.export.raster, data: loaded } } };
}
async function resolvePolys(p) {
  if (!p || !p.polys || !Array.isArray(p.polys.data)) return p;
  const out = [];
  for (const entry of p.polys.data) {
    if (entry.geometry) { out.push(entry); continue; }
    if (entry.refUid) {
      const geometry = resolveRefUid(entry.refUid);
      if (geometry.features.length) out.push({ ...entry, geometry, refUid: undefined });
      else console.warn('[mapa] refUid resolved to no geometry — skipped:', entry.refUid);
      continue;
    }
    if (entry.source) {
      try {
        // Project-relative first, flat ./projects/ as fallback. toFeatureCollection also
        // unwraps TopoJSON and bare Feature[] — both are documented `source` shapes.
        const { data } = await fetchPointer(entry.source);
        out.push({ ...entry, geometry: toFeatureCollection(data), source: undefined });
      } catch (e) { console.warn('[mapa] polys source failed:', entry.source, e.message); }
      continue;
    }
    out.push(entry);
  }
  return { ...p, polys: { ...p.polys, data: out } };
}

// Rendering spinner controller. Counter-based so overlapping renders stay covered; the spinner
// holds a minimum ~500ms from first show so even a fast (preloaded) render is perceptible.
let _spinActive = 0, _spinTimer = 0;
let _spinShownAt = 0;
// ---- tile requests: budget guard + progress (engine: tiles.js queue, "mapa:tiles" events) ----
// Tile layers (MapTiler XYZ, PMTiles) load through one shared queue, a few at a time. Before a
// layer fetches, the engine asks setTileRequestGuard; a big request (likely to burn MapTiler
// quota or trip its rate limit) needs a yes first. Progress shows in the spinner and in
// #tileStatus, which ends on ✓ all N tiles rendered, or how many failed.
const TILE_CONFIRM_OVER = 300;   // tiles in one layer request before asking
let tilesThisSession = 0;
let tileFadeTimer = null;        // every tile requested since the page loaded (quota awareness)
setTileRequestGuard(({ layer, z, count }) => {
  if (count <= TILE_CONFIRM_OVER) return true;
  return confirm(`The “${layer}” tile layer needs ${count} tiles at zoom ${z}.\n\n` +
    `That's a big request — it can eat MapTiler quota or get the key rate-limited. ` +
    `Fetch them? (Cancel renders the map without this layer; lower the layer's detail/delta to need fewer.)`);
});
window.addEventListener('mapa:tile-request', (e) => { tilesThisSession += e.detail?.count || 0; });
window.addEventListener('mapa:tile-error', (e) => {
  const d = e.detail || {}; fail('tiles failing (' + d.layer + '): ' + d.message);
});
window.addEventListener('mapa:tiles', (e) => {
  const { queued, active, total, done, failed, retrying } = e.detail || {};
  const el = $('tileStatus'), lab = document.querySelector('#renderSpinner .spin-label');
  if (!el || !total) return;
  clearTimeout(tileFadeTimer);
  el.hidden = false;
  const settled = done + failed;
  const busy = queued || active || retrying;
  el.title = 'Tile requests for this render · ' + tilesThisSession + ' requested since the page loaded';
  if (busy) {
    el.className = '';
    el.textContent = 'tiles ' + settled + ' / ' + total + (retrying ? ' · ' + retrying + ' retrying' : '') + (failed ? ' · ' + failed + ' failed' : '');
    if (lab) lab.textContent = 'Rendering… tiles ' + settled + ' / ' + total;
  } else {
    el.className = failed ? 'bad' : 'ok';
    el.textContent = failed ? '⚠ ' + failed + ' of ' + total + ' tiles failed' : '✓ all ' + total + ' tiles rendered';
    if (lab) lab.textContent = 'Rendering…';
    // Success fades out after a few seconds; a failure stays up until the next render.
    if (!failed) tileFadeTimer = setTimeout(() => {
      el.classList.add('fade');
      tileFadeTimer = setTimeout(() => { el.hidden = true; el.classList.remove('fade'); }, 700);
    }, 3000);
  }
});
function spinnerShow() {
  _spinActive++;
  clearTimeout(_spinTimer);
  const sp = $('renderSpinner');
  if (sp && sp.hidden) { sp.hidden = false; _spinShownAt = performance.now(); }
}
function spinnerDone() {
  _spinActive = Math.max(0, _spinActive - 1);
  if (_spinActive > 0) return; // another render is still running
  // Hide as soon as the render is done; a very fast render keeps it up ~250ms total so it
  // reads as a blink rather than a flicker.
  clearTimeout(_spinTimer);
  const wait = Math.max(0, 250 - (performance.now() - _spinShownAt));
  _spinTimer = setTimeout(() => { if (_spinActive === 0) { const sp = $('renderSpinner'); if (sp) sp.hidden = true; } }, wait);
}

let renderSeq = 0;  // guards against concurrent renders on landing (boot + pane both trigger one)

// The single canonical "something changed, reconsider the output" entry point. Both the editor's
// own field edits (onEdit) and Board's content-change hook (configureBoard refresh, below) route
// through here, so there's one debounced, live-gated render cycle instead of scattered
// setTimeout(render) calls. Does nothing unless live mode is on -- otherwise the user renders
// explicitly with the Render button.
function requestRender() {
  if ($('live')?.checked) { clearTimeout(liveTimer); liveTimer = setTimeout(render, 300); }
  else markStale(true);   // live off: no redraw — the Render buttons show a render is pending
}

async function render() {
  const myRender = ++renderSeq;
  markStale(false);
  resolveAnnoAnchors();   // annotations attached to data follow it
  spinnerShow();
  // Let the browser paint the spinner before the projection work blocks the main thread —
  // otherwise it only appears once the render is already done.
  await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
  if (myRender !== renderSeq) { spinnerDone(); return; }
  try {
    note('rendering…');
    const rendered = [];
    if (rawConfig) {
      // View-only import: render the pasted pre-project-file Mapa config verbatim. proj4/custom
      // projections are preserved (constructor guard in mapa.js). Basemap/data whose geometry didn't
      // paste in won't draw — re-import via the Data panel. The panel is NOT the source of truth here.
      const cfg = JSON.parse(JSON.stringify(rawConfig));
      const s = renderMap(cfg);
      if (s.tilesReady) await s.tilesReady;
      if (myRender !== renderSeq) return;
      rendered.push({ name: projectName || 'map', custom: false, svg: s });
      $('jsonPeek').value = JSON.stringify(rawConfig, null, 2);
    } else {
    // Per-view: each frame is its own Map-panel instance. Build each frame's project straight
    // from its saved map (buildProject, no DOM swap) with the shared Inset/Scalebar/North/Data/
    // Basemap read live, and render it. One <Mapa> render → one export each.
    saveActiveFrame();                      // capture the active frame's live edits first
    const frameList = frames.slice();
    const framesJson = frameList.map((f) => ({ name: f.name || '', map: f.map }));
    for (let fi = 0; fi < frameList.length; fi++) {
      const fm = frameList[fi].map;         // this frame's saved state — the source of truth
      const cfg = await frameRenderCfg(fm);
      if (myRender !== renderSeq) return;   // a newer render superseded this one — abandon it
      const s = renderMap(cfg);
      if (fi === activeFrame && $('bmGen').value === 'auto') {
        $('bmGenNote').textContent = s.basemapSimplify > 0 ? '≈ ' + s.basemapSimplify + '°' : 'full detail';
      }
      // Wait for all tile layers to finish compositing before showing the SVG.
      if (s.tilesReady) await s.tilesReady;
      if (myRender !== renderSeq) return;
      // Buffer panning: expand the tight #content clip by the margin so the bleed is REACHABLE by
      // panning the preview (download re-tightens it in cleanFullClone, so the export is unchanged).
      const marginPx = num(fm.buffer) || 0;
      if (marginPx > 0) {
        const cr = s.querySelector('clipPath[id^="frame-clip-"] rect');
        if (cr) {
          const W = +s.getAttribute('width'), H = +s.getAttribute('height');
          cr.setAttribute('x', -marginPx); cr.setAttribute('y', -marginPx);
          cr.setAttribute('width', W + 2 * marginPx); cr.setAttribute('height', H + 2 * marginPx);
        }
      }
      rendered.push({ name: frameName(fi), custom: !!(frameList[fi].name || '').trim(), svg: s });
    }
    // The DOM was never swapped, so the active frame's editor is already intact. Refresh the
    // module `project` from it (readPanel) and publish the project JSON (with all frames).
    readPanel();
    project.frames = framesJson;
    // Peek shows the SAVEABLE project: panel datasets as pointers, not geometry.
    $('jsonPeek').value = JSON.stringify(projectForSave(), null, 2);
    }

    const dlName = () => (($('dlName') && $('dlName').value.trim()) || projectName || 'map');
    const slug = (s) => (s || '').trim().replace(/\s+/g, '-').replace(/[^\w\-]+/g, '').toLowerCase();
    const saveSvg = async (node, suffix) => {
      if (embedPatternsOn) { await embedPatterns(node); portableSvg(node); } // re-sync xlink:href to the embedded data
      const str = new XMLSerializer().serializeToString(node);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }));
      a.download = dlName() + (suffix ? '-' + suffix : '') + '.svg'; a.click();
    };
    // PNG + world file: the frame's current settings with the projection swapped to geoMercator,
    // rendered off-page (the preview isn't touched) so the .pgw is plain EPSG:3857 metres.
    // Patterns are always embedded (an SVG drawn as an image can't fetch links).
    const savePng = async (fi, suffix) => {
      note('rendering Mercator PNG…');
      saveActiveFrame();
      const svg = renderMap(await frameRenderCfg({ ...frames[fi].map, proj: 'geoMercator' }));
      if (svg.tilesReady) await svg.tilesReady;
      const W = +svg.getAttribute('width'), H = +svg.getAttribute('height'), k = imageScale;
      const node = cleanFullClone(svg);
      await embedPatterns(node); portableSvg(node);
      node.setAttribute('width', W); node.setAttribute('height', H);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(node)], { type: 'image/svg+xml' }));
      const img = new Image();
      try {
        await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('could not rasterise the SVG')); img.src = url; });
        const cv = document.createElement('canvas'); cv.width = Math.round(W * k); cv.height = Math.round(H * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        const png = await new Promise((res) => cv.toBlob(res, 'image/png'));
        if (!png) throw new Error('image too large for the browser canvas — try a smaller scale');
        const base = dlName() + (suffix ? '-' + suffix : '');
        const files = [[base + '.png', png]];
        const wf = worldFileFor({ projection: svg.projection, width: W, height: H, pxW: cv.width, pxH: cv.height });
        if (wf) files.push([base + '.pgw', new Blob([wf], { type: 'text/plain' })]);
        for (const [name, blob] of files) {
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
          await new Promise((res) => setTimeout(res, 150));
        }
        note(wf ? 'PNG + world file (Mercator, EPSG:3857)' : 'PNG saved — no world file (frame corners not on the map)');
      } catch (e) { fail('PNG export: ' + e.message); }
      finally { URL.revokeObjectURL(url); }
    };
    const multi = rendered.length > 1;
    // Append the frame name to the download filename: always for multi-frame (so files don't
    // collide), and for a single frame when it has a custom name. A lone default-named frame keeps
    // today's plain filename.
    const fSuffix = (i) => (multi || rendered[i].custom) ? (slug(rendered[i].name) || String(i + 1)) : '';
    // Wire the download buttons + per-layer menu to a specific rendered SVG (the active tab).
    // One file per frame, staggered so the browser doesn't drop downloads.
    const downloadAll = async () => {
      for (let k = 0; k < rendered.length; k++) {
        await saveSvg(cleanFullClone(rendered[k].svg), fSuffix(k));
        await new Promise((res) => setTimeout(res, 150));
      }
    };
    function wireDownloads(i) {
      const svg = rendered[i].svg, suffix = fSuffix(i);
      // One Download button: every frame when there are several, else this one. "This frame
      // only" and the single layers are in the ▾ menu.
      $('dlBtn').onclick = multi ? downloadAll : () => saveSvg(cleanFullClone(svg), suffix);
      $('dlBtn').title = multi ? 'Download all ' + rendered.length + ' frames (one SVG each)' : 'Download the full-stack SVG';
      const menu = $('dlMenu'); menu.replaceChildren();
      if (multi) {
        const fh = document.createElement('div'); fh.className = 'dl-head'; fh.textContent = 'Frames';
        const one = document.createElement('button'); one.type = 'button';
        one.textContent = 'This frame only (' + frameName(i) + ')'; one.title = 'Download just the frame in the current tab';
        one.onclick = () => { menu.hidden = true; saveSvg(cleanFullClone(svg), suffix); };
        menu.append(fh, one);
      }
      // Used to order the per-layer download menu by the layer's position in the old <details>
      // sidebar. That sidebar is gone (Board panels replace it, with no equivalent ordered-
      // sections concept) -- secs is empty, so every layer ties at 999 and the sort becomes a
      // stable no-op, falling back to LAYER_TARGETS' own declared order.
      const panelEl = $('panel');
      const secs = panelEl ? [...panelEl.querySelectorAll(':scope > details')] : [];
      const secIdx = (t) => { const d = $(t.show) && $(t.show).closest('details'); return d ? secs.indexOf(d) : 999; };
      const layers = LAYER_TARGETS.filter((t) => $(t.show) && $(t.show).checked).sort((a, b) => secIdx(a) - secIdx(b));
      const head = document.createElement('div'); head.className = 'dl-head'; head.textContent = 'Layers';
      menu.append(head);
      for (const t of layers) {
        const b = document.createElement('button');
        b.textContent = t.label; b.title = 'Download only the ' + t.label + ' layer (transparent)';
        b.onclick = () => { menu.hidden = true;
          // Annotations redraw on their own (no full render), so check what's there now.
          if (t.only && !svg.querySelector('#' + t.id + ' .annotation')) { note('no ' + t.label.toLowerCase() + ' to download'); return; }
          const c = cleanFullClone(svg);
          if (t.only) stripToOnly(c, t.id); else stripToLayer(c, t.id);
          saveSvg(c, suffix ? suffix + '-' + t.suffix : t.suffix); };
        menu.append(b);
      }
      const ih = document.createElement('div'); ih.className = 'dl-head'; ih.textContent = 'Image';
      const pngBtn = document.createElement('button'); pngBtn.type = 'button';
      pngBtn.textContent = 'PNG + world file'; pngBtn.title = 'Mercator raster of the full export with a .pgw world file (EPSG:3857), for GIS';
      pngBtn.onclick = () => { menu.hidden = true; savePng(i, suffix); };
      menu.append(ih, pngBtn);
      // Download options live in this menu, not the crowded footer.
      const sopt = document.createElement('label'); sopt.className = 'dl-opt'; sopt.title = 'PNG pixels per export pixel';
      const ssel = document.createElement('select');
      for (const v of [1, 2, 4]) ssel.add(new Option(v + '×', v, false, v === imageScale));
      ssel.onchange = () => { imageScale = +ssel.value; };
      ssel.onclick = (e) => e.stopPropagation();
      sopt.append('image scale ', ssel);
      const opt = document.createElement('label'); opt.className = 'dl-opt';
      opt.title = 'Put pattern fills inside the SVG (as encoded PNGs) so it opens anywhere — off links styles/patterns/ instead';
      const ocb = document.createElement('input'); ocb.type = 'checkbox'; ocb.checked = embedPatternsOn;
      ocb.onchange = () => { embedPatternsOn = ocb.checked; };
      opt.append(ocb, ' embed patterns');
      const oh = document.createElement('div'); oh.className = 'dl-head'; oh.textContent = 'Options';
      menu.append(oh, opt, sopt);
      $('dlArrow').style.display = 'inline-flex'; // always: the options are in here
    }
    // Tab bar above the output — one tab per frame; hidden when there's only one.
    let tabsEl = $('frameTabs');
    if (!tabsEl) {
      tabsEl = document.createElement('div'); tabsEl.id = 'frameTabs';
      tabsEl.style.cssText = 'display:flex; gap:2px; padding:4px 6px 0; flex-wrap:wrap;';
      const ms = $('mapscroll'); ms.parentNode.insertBefore(tabsEl, ms);
    }
    function showFrame(i) {
      const r = rendered[i]; if (!r) return;
      mapEl.replaceChildren(r.svg);
      setOutDims(r.svg);       // true size (auto-height resolved by the engine at render time)
      // scroll to zoom, drag to pan (strokes preserved). Attach ONCE per SVG — re-clicking a tab
      // must not re-wrap an already-instrumented node (it would nest zoom layers).
      if (!r._zoomed) { attachOutputZoom(r.svg); r._zoomed = true; }
      wireDownloads(i);
      [...tabsEl.children].forEach((b, j) => {
        b.style.background = (j === i) ? 'var(--chrome)' : '#ece7e0';
        b.style.color = (j === i) ? '#fff' : 'var(--chrome)';
      });
    }
    tabsEl.replaceChildren();
    tabsEl.style.display = multi ? 'flex' : 'none';
    rendered.forEach((r, i) => {
      const b = document.createElement('button'); b.type = 'button';
      b.textContent = r.name; b.title = 'Show ' + r.name;
      b.style.cssText = 'font:11px system-ui,sans-serif; padding:3px 10px; border:1px solid #cfc8bf; cursor:pointer;';
      b.onclick = () => showFrame(i);
      tabsEl.append(b);
    });
    $('dlBtn').textContent = 'Download';

    showFrame(0);
    { const eg = $('exportGroup'); if (eg) eg.style.display = 'inline-flex'; } // reveal the file-name + download only after a render
    note('rendered: ' + projectName + (multi ? ' · ' + rendered.length + ' frames' : ''));
  } catch (e) { fail('render error: ' + e.message); }
  finally { spinnerDone(); }
}

// ---- custom data loading (GeoJSON / TopoJSON) -----------------------------
// Panel-owned datasets. `source` is the POINTER the project file stores; `geometry` is the
// resolved bytes, held only for this session's renders (never saved). `missing` = the pointer
// didn't resolve, so the row offers a relink.
const customData = [];            // { id, name, source, geometry (FeatureCollection|null), style, show, missing }
let dataSeq = 0;
const POLY_STYLE = { fill: '#3b82f6', 'fill-opacity': 0.35, stroke: '#1e3a8a', 'stroke-width': 1 };
const LINE_STYLE = { fill: 'none', stroke: '#1e3a8a', 'stroke-width': 1.5 };
// Polygon vs polyline: a line dataset inherits stroke-only styling (no fill).
function datasetKind(fc) {
  let line = false;
  for (const f of fc.features) {
    const t = f && f.geometry && f.geometry.type;
    if (t === 'Polygon' || t === 'MultiPolygon') return 'poly';
    if (t === 'LineString' || t === 'MultiLineString') line = true;
  }
  return line ? 'line' : 'poly';
}

// Normalize any supported input to a GeoJSON FeatureCollection.
function toFeatureCollection(json) {
  if (json && json.type === 'Topology' && json.objects) {
    const features = [];
    for (const k of Object.keys(json.objects)) {
      const g = topojson.feature(json, json.objects[k]);
      if (g.type === 'FeatureCollection') features.push(...g.features); else features.push(g);
    }
    return { type: 'FeatureCollection', features };
  }
  if (json && json.type === 'FeatureCollection') return json;
  if (json && json.type === 'Feature') return { type: 'FeatureCollection', features: [json] };
  if (Array.isArray(json)) return { type: 'FeatureCollection', features: json };
  if (json && json.type === 'GeometryCollection' && Array.isArray(json.geometries))
    return { type: 'FeatureCollection', features: json.geometries.map((g) => ({ type: 'Feature', geometry: g, properties: {} })) };
  if (json && json.type && json.coordinates) return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: json, properties: {} }] };
  if (json && Array.isArray(json.features)) return { type: 'FeatureCollection', features: json.features };
  // An API wrapper around the GeoJSON, at any depth (e.g. { id, map: FeatureCollection, datetime }
  // or { status, data: { result: … } }): search the nested keys for the first GeoJSON / TopoJSON.
  const inner = findGeo(json);
  if (inner) return toFeatureCollection(inner);
  throw new Error('unrecognized data (need GeoJSON or TopoJSON)');
}
const GEOM_TYPES = /^(Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon|GeometryCollection)$/;
function isGeo(v) {
  return v && typeof v === 'object' && !Array.isArray(v) && (
    (v.type === 'Topology' && v.objects) || v.type === 'FeatureCollection' || v.type === 'Feature' ||
    (GEOM_TYPES.test(v.type) && (v.coordinates || v.geometries)) ||
    (Array.isArray(v.features) && v.features.some((f) => f && f.type === 'Feature')));
}
// Breadth-first over the nested keys (and arrays of objects), so the shallowest match wins.
function findGeo(json) {
  let level = [json];
  for (let d = 0; d < 6 && level.length; d++) {
    const next = [];
    for (const node of level) {
      for (const v of Array.isArray(node) ? node : Object.values(node || {})) {
        if (!v || typeof v !== 'object') continue;
        if (isGeo(v)) return v;
        next.push(v);
      }
    }
    level = next;
  }
  return null;
}

function addDataset(name, text) {
  let json;
  try { json = JSON.parse(text); } catch { note(name + ': not valid JSON'); return; }
  let fc;
  try { fc = toFeatureCollection(json); } catch (e) { note(name + ': ' + e.message); return; }
  if (!fc.features || !fc.features.length) { note(name + ': no features'); return; }
  // All-point GeoJSON → a points group (labelled markers), not a poly layer.
  if (isPointFC(fc)) {
    const labelProp = guessLabelProp(fc);
    addPointsGroup(name.replace(/\.(geo|topo)?json$/i, ''), pointsFromFC(fc, labelProp), { features: fc, labelProp });
    return;
  }
  const kind = datasetKind(fc);
  // The dataset gets a pointer into the project's own data/ folder immediately, so it survives
  // ⬇ JSON. The geometry renders now; filing the file at that path makes it resolve on reload.
  customData.unshift({ id: ++dataSeq, name, source: pointerFor(name), geometry: fc, kind,   // new datasets go to the top of the list
    style: { ...(kind === 'line' ? LINE_STYLE : POLY_STYLE) }, show: true, missing: false });
  renderDataList();
  requestRender();
}

// ---- POI groups ----------------------------------------------------------------
// A POI group lives in customData with kind 'points'. Its source of truth is a CSV text area,
// one point per line:  lat, lng, name, dir, type   (dir/type optional; dir defaults to E).
// Points are saved INLINE in the project's `points.data`, each tagged `set: <group name>` so the
// grouping survives a reload. The LOOK comes from POINT_TYPE_STYLES (below) by `type`, applied at
// render time — the file stores only `type`, so editing the presets restyles every project. A point
// loaded from an older project keeps any custom style it carries (matched by lat/lng/name).

// POI type styles — the style guide presets live in mapa/poi-types.json (edit THAT file; its
// `_about` key documents the keys). Loaded once at boot by loadPoiTypes(). This fallback is used
// only if the file can't be read, so points still draw.
let POINT_TYPE_STYLES = { default: { shape: 'circle', size: 4, fill: '#412c26', 'label-size': 12, 'label-color': '#000000' } };
async function loadPoiTypes() {
  try {
    const r = await fetch('./mapa/poi-types.json', { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    const types = {};
    for (const [k, v] of Object.entries(j)) if (!k.startsWith('_') && v && typeof v === 'object') types[k] = v;
    if (!types.default) types.default = POINT_TYPE_STYLES.default;
    POINT_TYPE_STYLES = types;
  } catch (e) { console.warn('[mapa] poi-types.json not loaded (' + e.message + ') — using the built-in fallback'); }
}

const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'C'];   // C = centred on the coordinate
// A CSV `type` can also just name a marker shape (e.g. `diamond`) on top of the default look.
const SHAPES = ['circle', 'star-dot', 'square', 'triangle', 'diamond', 'star', 'cross', 'wye'];
const isStyledType = (t) => !!t && (Object.hasOwn(POINT_TYPE_STYLES, t) || SHAPES.includes(t));
function pointStyleFor(type) {
  return { ...POINT_TYPE_STYLES.default, ...((type && Object.hasOwn(POINT_TYPE_STYLES, type) && POINT_TYPE_STYLES[type]) || {}),
    ...(SHAPES.includes(type) ? { shape: type } : {}) };
}
function isPointFC(fc) {
  return fc.features.length > 0 && fc.features.every((f) => f && f.geometry && /^(Multi)?Point$/.test(f.geometry.type));
}
// Best guess at the label property: a name-ish key, else the first string-valued one.
function guessLabelProp(fc) {
  const props = fc.features[0]?.properties || {};
  const keys = Object.keys(props);
  return keys.find((k) => /^(name|name_en|label|title)$/i.test(k)) ||
    keys.find((k) => typeof props[k] === 'string') || '';
}
function pointsFromFC(fc, labelProp) {
  const out = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const coords = g.type === 'Point' ? [g.coordinates] : g.coordinates;
    for (const [lng, lat] of coords) {
      const v = labelProp && f.properties ? f.properties[labelProp] : '';
      out.push({ name: v == null ? '' : String(v), lng, lat, dir: 'E' });
    }
  }
  return out;
}
// CSV fields, honouring "quoted, names".
function csvFields(line) {
  const out = []; let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ',') { out.push(cur.trim()); cur = ''; }
    else cur += c;
  }
  out.push(cur.trim());
  return out;
}
// 2 decimals (~1 km) — same precision the CSV is written at, so a reloaded line still matches its key.
const ptKey = (lat, lng, name) => (+lat).toFixed(2) + ',' + (+lng).toFixed(2) + ',' + (name || '');
// CSV text → points. Blank lines and #comments are ignored; a non-numeric first line is a header.
// Returns the 1-based numbers of lines that couldn't be read.
function parsePoiCsv(text) {
  const points = [], bad = [];
  String(text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const f = csvFields(line);
    const lat = parseFloat(f[0]), lng = parseFloat(f[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      if (!(points.length === 0 && bad.length === 0 && /[a-z]/i.test(f[0]))) bad.push(i + 1);
      return;
    }
    const dir = (f[3] || '').toUpperCase();
    const type = (f[4] || '').toLowerCase();
    const color = f[5] && CSS.supports('color', f[5]) ? f[5] : '';
    points.push({ lat, lng, name: f[2] || '', dir: DIRS.includes(dir) ? dir : 'E',
      ...(type ? { type } : {}), ...(color ? { color } : {}) });
  });
  return { points, bad };
}
function pointsToCsv(points) {
  const q = (v) => (/[",]/.test(v) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  return points.map((p) => {
    // lat, lng, name, dir, type, color — trailing empty columns dropped.
    const cols = [+(+p.lat).toFixed(2), +(+p.lng).toFixed(2), q(p.name || ''),
      p.dir && p.dir !== 'E' ? p.dir : '', p.type ? q(p.type) : '', p.color ? q(p.color) : ''];
    while (cols.length > 3 && cols[cols.length - 1] === '') cols.pop();
    if (cols.length > 3 && cols[3] === '') cols[3] = 'E';
    return cols.join(', ');
  }).join('\n');
}
function setPoiCsv(g, text) {
  g.csv = text;
  const { points, bad } = parsePoiCsv(text);
  g.points = points; g._bad = bad;
}
function addPointsGroup(name, points = [], src = null) {
  const n = customData.filter((d) => d.kind === 'points').length + 1;
  const g = { id: ++dataSeq, kind: 'points', name: name || ('poi ' + n), show: true,
    _keep: new Map(), _src: src, _open: true };
  setPoiCsv(g, pointsToCsv(points));
  customData.unshift(g);   // new groups go to the top of the list
  renderDataList(); dataRender();
}

// ---- place search (POI groups): cities by name, or a country's capital / top 5 cities -------
// gazetteer.json is generated from the basemap places by scripts/gen-gazetteer.mjs; rows arrive
// sorted by population, largest first. Loaded on first search.
let gazetteerP = null;
function loadGazetteer() {
  if (!gazetteerP) gazetteerP = fetch('./mapa/files/gazetteer.json').then((r) => r.json()).then((g) => {
    const rows = g.rows.map(([name, iso2, country, capital, pop, lng, lat]) => ({ name, iso2, country, capital, pop, lng, lat }));
    const countries = [...new Set(rows.map((r) => r.country).filter(Boolean))];
    // Country label points (one per country — see scripts/gen-gazetteer.mjs), centred labels.
    const labels = (g.countries || []).map(([name, iso3, lng, lat]) => ({ name, iso3, lng, lat, type: 'country', dir: 'C' }));
    // Regions (e.g. Americas): bulk-add every country/territory label, or every capital, at once.
    const byIso3 = new Map(labels.map((l) => [l.iso3, l]));
    const regions = Object.entries(g.regions || {}).map(([name, r]) => ({
      name,
      labels: (r.labels || []).map((iso) => byIso3.get(iso)).filter(Boolean),
      capitals: (r.capitals || []).map(([cname, country, lng, lat]) => ({ name: cname, country, lng, lat, capital: 1 })),
    }));
    return { rows, countries, labels, regions };
  }).catch((e) => { gazetteerP = null; note('place search: ' + e.message); throw e; });
  return gazetteerP;
}
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Suggestions for a query: each matching country → "capital" + "top 5 cities", then matching
// cities (name starts-with first, then contains; population order within each).
function placeSuggestions(gz, query) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const rank = (s) => (s.startsWith(q) ? 0 : s.includes(q) ? 1 : -1);
  const out = [];
  const countries = gz.countries.map((c) => ({ c, r: rank(fold(c)) })).filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.c.length - b.c.length).slice(0, 2);
  for (const { c } of countries) {
    const inC = gz.rows.filter((r) => r.country === c);
    const cap = inC.filter((r) => r.capital);
    if (cap.length) out.push({ label: c + ' · capital', rows: cap });
    if (inC.length) out.push({ label: c + ' · top 5 cities', rows: inC.slice(0, 5) });
  }
  // Regions: "<region> · all country & territory labels (n)" / "· all capitals (n)" / both.
  for (const R of (gz.regions || [])) {
    if (rank(fold(R.name)) < 0) continue;
    out.push({ label: R.name + ' · all country & territory labels (' + R.labels.length + ')', rows: R.labels });
    out.push({ label: R.name + ' · all capitals (' + R.capitals.length + ')', rows: R.capitals });
    out.push({ label: R.name + ' · labels + capitals (' + (R.labels.length + R.capitals.length) + ')', rows: [...R.labels, ...R.capitals] });
  }
  // Country labels: "<country> · country label" adds the name at the country's label point.
  const labels = (gz.labels || []).map((l) => ({ l, r: rank(fold(l.name)) })).filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.l.name.length - b.l.name.length).slice(0, 3);
  for (const { l } of labels) out.unshift({ label: l.name + ' · country label', rows: [l] });
  const starts = [], contains = [];
  for (const r of gz.rows) {
    const k = rank(fold(r.name));
    if (k === 0) starts.push(r); else if (k === 1) contains.push(r);
    if (starts.length >= 8) break;
  }
  for (const r of [...starts, ...contains].slice(0, 8)) {
    out.push({ label: r.name + ' — ' + r.country + (r.capital ? ' (capital)' : ''), rows: [r] });
  }
  return out;
}
// "In view" picks: every country whose label point sits inside the current render frame
// (extentBbox — the drawn bbox, else the live Atlas view), and the capitals inside it. Offered
// on an empty search box or when the query mentions "view". A frame crossing the antimeridian
// (W > E) wraps.
function viewSuggestions(gz) {
  const b = extentBbox();
  if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite)) return [];
  const [w, s, e, n] = b;
  const inFrame = (p) => p.lat >= s && p.lat <= n && (w <= e ? p.lng >= w && p.lng <= e : p.lng >= w || p.lng <= e);
  const labels = (gz.labels || []).filter(inFrame);
  const capitals = gz.rows.filter((r) => r.capital && inFrame(r));
  if (!labels.length) return [];
  return [
    { label: 'In view · country labels (' + labels.length + ')', rows: labels },
    { label: 'In view · labels + capitals (' + (labels.length + capitals.length) + ')', rows: [...labels, ...capitals] },
  ];
}
// Append gazetteer rows to a POI group's CSV as "lat, lng, name" lines (skips exact duplicates).
function appendPlaces(g, rows) {
  const have = new Set(g.points.map((p) => ptKey(p.lat, p.lng, p.name)));
  const add = rows.filter((r) => !have.has(ptKey(r.lat, r.lng, r.name)));
  if (!add.length) { note('already in the list'); return 0; }
  const lines = pointsToCsv(add.map((r) => ({ lat: r.lat, lng: r.lng, name: r.name, dir: r.dir || 'E', type: r.type || (r.capital ? 'capital' : 'city') })));
  const base = (g.csv || '').replace(/\s+$/, '');
  setPoiCsv(g, base ? base + '\n' + lines : lines);
  return add.length;
}

const validPoint = (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng);
// Point entries for a group (the shape translate.js atlasPointToMapa reads).
// forRender: the type preset is merged in. For saving it's left out, so the file stores only
// `type` (+ `color`, + any custom style an older file carried) and follows preset changes.
function groupPointEntries(g, forRender) {
  return g.points.filter(validPoint).map((p) => {
    const kept = g._keep && g._keep.get(ptKey(p.lat, p.lng, p.name));
    // A CSV colour fills the marker only — the label keeps its preset colour.
    const style = { ...(forRender ? pointStyleFor(p.type) : {}), ...(kept ? kept.style : {}),
      ...(p.color ? { fill: p.color } : {}) };
    return {
      ...(kept ? kept.extra : {}),
      name: p.name || '', lng: p.lng, lat: p.lat, dir: p.dir || 'E', set: g.name,
      ...(p.type ? { type: p.type } : {}),
      ...(p.color ? { color: p.color } : {}),   // round-trips the CSV column
      ...(Object.keys(style).length ? { style } : {}),
      // Render only: the engine puts each `group` in its own <g> inside #annotations, so this gives
      // one layer group per type (blank type → "default"). Sanitised — it becomes an element id.
      ...(forRender ? { group: String(p.type || 'default').replace(/[^\w-]/g, '-') } : {}),
      ...(g.show ? {} : { show: false })
    };
  });
}
// Loaded project points → POI groups (by `set`). Per-point style/extra keys are kept aside and
// re-attached while the line is unchanged.
function adoptProjectPoints(p) {
  const data = p && p.points && Array.isArray(p.points.data) ? p.points.data : null;
  if (!data || !data.length) return;
  const groups = new Map();
  for (const e of data) {
    const key = e.set || 'poi';
    if (!groups.has(key)) groups.set(key, { pts: [], keep: new Map(), hidden: 0 });
    const G = groups.get(key);
    let lat = e.lat, lng = e.lng;
    if ((lat == null || lng == null) && typeof e.latlng === 'string') [lat, lng] = e.latlng.split(',').map((s) => +s.trim());
    if (!Number.isFinite(+lat) || !Number.isFinite(+lng)) continue;
    const { name, lng: _a, lat: _b, latlng: _c, dir, set: _d, type, color, style, show, ...extra } = e;
    G.pts.push({ lat: +lat, lng: +lng, name: name || '', dir: dir || 'E', ...(type ? { type } : {}), ...(color ? { color } : {}) });
    // The CSV colour column owns fill/label-colour for that point — don't let the saved copy override edits.
    const kept = { ...(style || {}) };
    if (color) { delete kept.fill; delete kept['label-color']; }
    if (isStyledType(type)) delete kept.shape;   // the type decides the shape
    G.keep.set(ptKey(lat, lng, name), { style: kept, extra });
    if (show === false) G.hidden++;
  }
  for (const [key, G] of groups) {
    const g = { id: ++dataSeq, kind: 'points', name: key, show: G.hidden < G.pts.length, _keep: G.keep, _open: false };
    setPoiCsv(g, pointsToCsv(G.pts));
    customData.unshift(g);   // file order is bottom-first; the list is top-first
  }
  // The panel owns them now; projectForSave re-emits them. Keep any other points settings.
  p.points = { ...p.points, data: [] };
}

// Re-resolve a dataset's pointer after its path changed (typed into the row).
async function relinkDataset(d) {
  d.missing = false; d.error = null; d.geometry = null;
  renderDataList();
  try {
    const { data } = await fetchPointer(d.source);
    d.geometry = toFeatureCollection(data);
    if (!d.geometry.features.length) throw new Error('no features');
    d.kind = datasetKind(d.geometry);
    note('relinked ' + d.source);
  } catch (e) {
    d.missing = true; d.error = e.message;
    note(d.source + ': ' + e.message);
  }
  renderDataList();
  dataRender();
}

// Point a dataset at a local file instead: load its geometry now and rewrite the pointer to the
// project's own data/ folder. Saving the project + filing the file there makes it resolve next load.
function pickReplacementFor(d) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.geojson,.json,.topojson';
  inp.onchange = () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let fc;
      try { fc = toFeatureCollection(JSON.parse(r.result)); }
      catch (e) { note(f.name + ': ' + e.message); return; }
      if (!fc.features.length) { note(f.name + ': no features'); return; }
      d.geometry = fc; d.kind = datasetKind(fc); d.name = f.name;
      d.source = pointerFor(f.name); d.missing = false; d.error = null;
      note('pointed at ' + d.source + ' — save the file there so it resolves on load');
      renderDataList(); dataRender();
    };
    r.readAsText(f);
  };
  inp.click();
}

// ---- project data pointers <-> the Data panel ------------------------------
// Adopt a loaded project's data POINTERS into the panel so they're visible, toggleable,
// restylable and relinkable. Only `source` entries are adopted: inline `geometry` is
// hand-authored and `refUid` is curated basemap, so both stay project-owned and render through
// resolvePolys as before. Adopted entries are REMOVED from project.polys.data — the panel owns
// them now, and projectForSave() re-emits them as pointers — so nothing renders twice.
async function adoptProjectData(p) {
  customData.length = 0;
  adoptProjectPoints(p);
  const data = p && p.polys && Array.isArray(p.polys.data) ? p.polys.data : null;
  if (!data) { renderDataList(); return; }
  const keep = [], adopt = [];
  for (const entry of data) (entry && entry.source && !entry.geometry ? adopt : keep).push(entry);
  if (!adopt.length) { renderDataList(); return; }
  p.polys.data = keep;
  for (const entry of adopt) {
    const rec = {
      id: ++dataSeq, name: String(entry.source).split('/').pop(), source: entry.source,
      geometry: null, kind: 'poly', style: { ...(entry.style || POLY_STYLE) },
      show: entry.show !== false, missing: false, _entry: entry
    };
    // Rewind is on | off | 'invert'. Unset (and the retired 'auto') = on.
    if (entry.rewind === false || entry.rewind === 'invert') rec.rewind = entry.rewind;
    if (typeof entry.fillFrom === 'string' && entry.fillFrom) rec.fillFrom = entry.fillFrom;
    if (typeof entry.filter === 'string') rec.filter = entry.filter;
    else if (entry.filter && typeof entry.filter === 'object') {
      console.warn('[mapa] ' + rec.name + ': the { show, key, value } filter is retired and ignored — use a filter expression, e.g. "d.type == \'claim\'"');
    }
    customData.unshift(rec);   // file order is bottom-first; the list is top-first
  }
  renderDataList();
  // Resolve them in parallel; the list re-renders as each lands (or fails to). Layers that point at
  // the same source share ONE fetch (and one feature array).
  const shared = new Map();
  await Promise.all(customData.filter((rec) => rec.kind !== 'points').map(async (rec) => {
    try {
      if (!shared.has(rec.source)) shared.set(rec.source, fetchPointer(rec.source).then(({ data }) => toFeatureCollection(data)));
      rec.geometry = await shared.get(rec.source);
      rec.kind = datasetKind(rec.geometry);
    } catch (e) { rec.missing = true; rec.error = e.message; }
    renderDataList();
  }));
}

// The project as it should be SAVED: panel-owned datasets go back in as pointers (source +
// style + view state), never geometry. This is what ⬇ JSON and the JSON peek emit.
function projectForSave() {
  const out = JSON.parse(JSON.stringify(project));
  if (!customData.length) return out;
  // Points groups → inline project points (after any the panel didn't adopt).
  // Saved in draw order (bottom first) — the list is top-first, so reversed.
  const pointGroups = customData.filter((d) => d.kind === 'points').reverse();
  if (pointGroups.length) {
    const basePts = out.points || {};
    out.points = { ...basePts, show: true, data: [...(basePts.data || []), ...pointGroups.flatMap((g) => groupPointEntries(g, false))] };
  }
  const polyData = customData.filter((d) => d.kind !== 'points').reverse();
  if (!polyData.length) return out;
  const entries = polyData.map((d) => {
    const base = d._entry ? JSON.parse(JSON.stringify(d._entry)) : {};
    delete base.geometry;
    const e = { ...base, source: d.source, style: { ...d.style } };
    if (d.show) delete e.show; else e.show = false;
    // Unset = on (the default), so only an explicit choice is written: false | 'invert'.
    if (d.rewind === false || d.rewind === 'invert') e.rewind = d.rewind; else delete e.rewind;
    if (d.fillFrom) e.fillFrom = d.fillFrom; else delete e.fillFrom;
    // The filter expression (a retired object-form filter on the base entry is dropped).
    if (d.filter && d.filter.trim()) e.filter = d.filter; else delete e.filter;
    return e;
  });
  const basePolys = out.polys || {};
  out.polys = { ...basePolys, show: true, data: [...(basePolys.data || []), ...entries] };
  return out;
}

let styleClipboard = null; // Data panel: copy style → paste style onto another layer
// Drag a layer by its header row to reorder a list whose children are 1:1, in order, with `arr`
// (Data: customData, Raster: rasterData). A line shows where it will land; `after` re-renders.
function wireDragSort(list, arr, after) {
  const items = [...list.children];
  const clear = () => items.forEach((x) => x.classList.remove('drop-above', 'drop-below'));
  items.forEach((el, idx) => {
    const handle = el.querySelector(':scope > .data-head') || el;
    handle.draggable = true;
    handle.classList.add('row-drag'); // not 'drag-handle': that's Board's 17px panel grip class
    handle.ondragstart = (e) => {
      if (e.target.closest && e.target.closest('input, select, textarea')) { e.preventDefault(); return; }
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-mapa-row', String(idx));
      el.classList.add('dragging'); list.dataset.dragFrom = idx;
    };
    handle.ondragend = () => { el.classList.remove('dragging'); clear(); delete list.dataset.dragFrom; };
    el.ondragover = (e) => {
      if (list.dataset.dragFrom == null) return;   // only rows of THIS list
      e.preventDefault(); clear();
      const r = el.getBoundingClientRect();
      el.classList.add(e.clientY > r.top + r.height / 2 ? 'drop-below' : 'drop-above');
    };
    el.ondrop = (e) => {
      if (list.dataset.dragFrom == null) return;
      e.preventDefault();
      const from = +list.dataset.dragFrom;
      let to = idx + (el.classList.contains('drop-below') ? 1 : 0);
      clear();
      if (from < to) to--;
      if (from === to) return;
      const [moved] = arr.splice(from, 1); arr.splice(to, 0, moved);
      after();
    };
  });
}
// Fill a data-layer row as [toggle | label | controls] (the .g3 grid). No toggle → an empty cell.
function gridRow(row, toggle, label, ...ctrls) {
  row.classList.add('g3');
  const c = document.createElement('div'); c.className = 'ctrls'; c.append(...ctrls);
  row.append(toggle || document.createElement('span'), label, c);
  return row;
}
let dataRenderTimer;
// Data-panel edits follow the live-update setting like every other panel (they used to redraw always).
const dataRender = () => requestRender();

// Bounding box [W,S,E,N] of any geometry (walks nested coordinate arrays).
function geomBbox(geom) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const walk = (c) => {
    if (typeof c[0] === 'number') {
      if (c[0] < minX) minX = c[0]; if (c[1] < minY) minY = c[1];
      if (c[0] > maxX) maxX = c[0]; if (c[1] > maxY) maxY = c[1];
    } else for (const x of c) walk(x);
  };
  if (geom && geom.type === 'GeometryCollection') (geom.geometries || []).forEach((g) => { const b = geomBbox(g); if (b) { minX = Math.min(minX, b[0]); minY = Math.min(minY, b[1]); maxX = Math.max(maxX, b[2]); maxY = Math.max(maxY, b[3]); } });
  else if (geom && geom.coordinates) walk(geom.coordinates);
  return Number.isFinite(minX) ? [minX, minY, maxX, maxY] : null;
}
// The current render frame [W,S,E,N]: the bbox field if set, else the live pane view bounds
// (satellite has no bbox field, so fall back to what the pane is actually showing).
function extentBbox() {
  const p = $('bbox').value.split(',').map((s) => parseFloat(s.trim()));
  if (p.length === 4 && p.every(Number.isFinite)) return p;
  return paneBounds;
}
// The visible lng/lat bbox of a satellite view — invert a grid of canvas points and take the
// extent of the ones on the facing surface. Used to bbox-stream the basemap for satellite
// (which has no rectangular bbox field). Returns null off-satellite or if it can't invert.
function satelliteBbox(fm) {
  fm = fm || { proj: $('proj').value, satParams, w: $('w').value, h: $('h').value };
  if (fm.proj !== 'geoSatellite') return null;
  const sp = fm.satParams || camToSatParams();
  if (!sp) return null;
  const width = num(fm.w) || 1000, height = num(fm.h) || width;
  let proj; try { proj = satelliteProjector({ ...sp, width, height }); } catch (e) { return null; }
  if (!proj || !proj.invert) return null;
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity, n = 0;
  const N = 16;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const ll = proj.invert([width * i / N, height * j / N]);
    if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
    minLng = Math.min(minLng, ll[0]); maxLng = Math.max(maxLng, ll[0]);
    minLat = Math.min(minLat, ll[1]); maxLat = Math.max(maxLat, ll[1]); n++;
  }
  if (!n) return null;
  // antimeridian-spanning view → give up on a tight box (would be inverted); stream global.
  if (maxLng - minLng > 350) return null;
  const pad = 2;
  return [minLng - pad, Math.max(-90, minLat - pad), maxLng + pad, Math.min(90, maxLat + pad)];
}
const bboxTouches = (a, b) => !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);

// Satellite "facing surface" test: a point is visible only if its great-circle angle from the
// nadir is within the horizon (acos(1/P), P = 1 + alt/R). Returns {horizon, ang(lng,lat)} or null.
function satelliteHorizon() {
  const sp = satParams || camToSatParams();
  const nadLng = sp.longitude, nadLat = sp.latitude, alt = sp.altitude;
  if (!Number.isFinite(nadLng) || !Number.isFinite(nadLat) || !(alt > 0)) return null;
  const R = 6371, rad = Math.PI / 180;
  const horizon = Math.acos(1 / (1 + alt / R));
  const f1 = nadLat * rad;
  const ang = (lng, lat) => {
    const f2 = lat * rad;
    const c = Math.sin(f1) * Math.sin(f2) + Math.cos(f1) * Math.cos(f2) * Math.cos((lng - nadLng) * rad);
    return Math.acos(Math.max(-1, Math.min(1, c)));
  };
  return { horizon, ang };
}

// The FeatureCollection actually rendered: the layer's property filter, then (optionally) drop
// anything whose bounds don't touch the current extent.
// ---- layer filter expressions ------------------------------------------------------
// A poly/line layer's `filter` is a condition on each feature's PROPERTIES, e.g.
//   d.type == 'claim' AND d.date >= '2025-01'
// `d` is the feature; d.x reads properties.x (nothing else is reachable). Operators:
// == != < <= > >=, CONTAINS (text includes the term, any case), AND/&& OR/|| NOT/! ( ),
// values d.x / d['a key'] / 'text' / numbers. e.g.  d.name CONTAINS 'occupied'
// It is PARSED into a tree and evaluated here — never eval'd — so a project loaded from any
// URL can't run code. See dev/specs/2026-09-18-data-loading-and-layer-sources-design.md.
function compileFilter(src) {
  const text = String(src || '');
  const toks = [];
  const re = /\s+|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\d+(?:\.\d+)?)|(===|!==|==|!=|<=|>=|&&|\|\||[<>!()\[\].-])|([A-Za-z_$][\w$]*)|(\S)/y;
  let m;
  while (re.lastIndex < text.length && (m = re.exec(text))) {
    const at = m.index;
    if (m[1] != null) toks.push({ t: 'str', v: m[1].slice(1, -1).replace(/\\(.)/g, '$1'), at });
    else if (m[2] != null) toks.push({ t: 'num', v: +m[2], at });
    else if (m[3] != null) {
      if (m[3] === '===' || m[3] === '!==') throw new Error('use ' + m[3].slice(0, 2) + ' (not ' + m[3] + ') at ' + (at + 1));
      toks.push({ t: 'op', v: m[3], at });
    } else if (m[4] != null) {
      const w = m[4];
      if (w === 'AND' || w === 'OR' || w === 'NOT' || w === 'CONTAINS') toks.push({ t: 'op', v: w, at });
      else if (/^(and|or|not|contains)$/i.test(w)) throw new Error('write ' + w.toUpperCase() + ' in capitals (at ' + (at + 1) + ')');
      else toks.push({ t: 'name', v: w, at });
    } else if (m[5] != null) throw new Error("unexpected '" + m[5] + "' at " + (at + 1));
  }
  let i = 0;
  const peek = () => toks[i], next = () => toks[i++];
  const isOp = (...vs) => peek() && peek().t === 'op' && vs.includes(peek().v);
  const where = () => (peek() ? ' at ' + (peek().at + 1) : ' at the end');
  const expect = (v) => { if (!isOp(v)) throw new Error("expected '" + v + "'" + where()); next(); };
  const parseOr = () => { let a = parseAnd(); while (isOp('||', 'OR')) { next(); a = { k: 'or', a, b: parseAnd() }; } return a; };
  const parseAnd = () => { let a = parseNot(); while (isOp('&&', 'AND')) { next(); a = { k: 'and', a, b: parseNot() }; } return a; };
  const parseNot = () => { if (isOp('!', 'NOT')) { next(); return { k: 'not', a: parseNot() }; } return parseCmp(); };
  const parseCmp = () => {
    const a = parseValue();
    if (isOp('==', '!=', '<', '<=', '>', '>=', 'CONTAINS')) { const op = next().v; return { k: 'cmp', op, a, b: parseValue() }; }
    return { k: 'truthy', a };
  };
  const parseValue = () => {
    const tk = peek();
    if (!tk) throw new Error('expected a value at the end');
    if (isOp('(')) { next(); const e = parseOr(); expect(')'); return e; }
    if (tk.t === 'str') { next(); return { k: 'lit', v: tk.v }; }
    if (tk.t === 'num') { next(); return { k: 'lit', v: tk.v }; }
    if (isOp('-')) { next(); const n = next(); if (!n || n.t !== 'num') throw new Error("expected a number after '-'" + where()); return { k: 'lit', v: -n.v }; }
    if (tk.t === 'name') {
      if (tk.v !== 'd') throw new Error("unknown name '" + tk.v + "' at " + (tk.at + 1) + " — use d.<property>");
      next();
      if (isOp('.')) {
        next(); const n = next();
        if (!n || n.t !== 'name') throw new Error("expected a property name after 'd.'" + where());
        return { k: 'prop', key: n.v };
      }
      if (isOp('[')) {
        next(); const n = next();
        if (!n || n.t !== 'str') throw new Error("expected d['property']" + where());
        expect(']'); return { k: 'prop', key: n.v };
      }
      throw new Error("use d.<property> (at " + (tk.at + 1) + ")");
    }
    throw new Error("unexpected '" + tk.v + "' at " + (tk.at + 1));
  };
  if (!toks.length) return null;                 // empty filter = no filter
  const tree = parseOr();
  if (peek()) throw new Error("unexpected '" + peek().v + "' at " + (peek().at + 1));
  const numLike = (v) => typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && isFinite(Number(v)));
  const missing = (v) => v === undefined || v === null;
  const ev = (n, p) => {
    switch (n.k) {
      case 'or': return ev(n.a, p) || ev(n.b, p);
      case 'and': return ev(n.a, p) && ev(n.b, p);
      case 'not': return !ev(n.a, p);
      case 'lit': return n.v;
      case 'prop': return Object.prototype.hasOwnProperty.call(p, n.key) ? p[n.key] : undefined; // own data only
      case 'truthy': { const v = ev(n.a, p); return !missing(v) && v !== '' && v !== false && v !== 0; }
      case 'cmp': {
        const a = ev(n.a, p), b = ev(n.b, p);
        if (missing(a) || missing(b)) return n.op === '!=' ? !(missing(a) && missing(b)) : false;
        if (n.op === 'CONTAINS') return String(a).toLowerCase().includes(String(b).toLowerCase());
        const num = numLike(a) && numLike(b);
        const x = num ? Number(a) : String(a), y = num ? Number(b) : String(b);
        switch (n.op) {
          case '==': return x === y; case '!=': return x !== y;
          case '<': return x < y; case '<=': return x <= y; case '>': return x > y; case '>=': return x >= y;
        }
      }
    }
    return false;
  };
  return (props) => !!ev(tree, props || {});
}
// A layer's compiled filter, cached until its text changes: { test: fn|null, error: string|null }.
function layerFilter(d) {
  if (d._fsrc !== d.filter) {
    d._fsrc = d.filter;
    try { d._fc = { test: compileFilter(d.filter), error: null }; }
    catch (e) { d._fc = { test: null, error: e.message }; }
  }
  return d._fc || { test: null, error: null };
}

function filteredFC(d) {
  let features = d.geometry.features;
  // The layer's property filter (an invalid one draws everything — the row shows the error).
  const lf = layerFilter(d);
  if (lf.test) features = features.filter((f) => lf.test(f && f.properties));
  const mode = $('limitExtent') ? $('limitExtent').value : 'off';
  if (mode !== 'off') {
    if ($('proj').value === 'geoSatellite') {
      const sp = satParams || camToSatParams();
      const width = num($('w').value) || 1000, height = num($('h').value) || width;
      const h = satelliteHorizon();
      let proj = null;
      try { proj = satelliteProjector({ ...sp, width, height }); } catch (e) {}
      if (h && proj) {
        // Visible = on the facing surface (within horizon) AND lands inside the canvas frame.
        const visible = (lng, lat) => {
          if (h.ang(lng, lat) > h.horizon) return false;
          const p = proj([lng, lat]);
          return p && p[0] >= 0 && p[0] <= width && p[1] >= 0 && p[1] <= height;
        };
        features = features.filter((f) => {
          const b = f.geometry && geomBbox(f.geometry);
          if (!b) return false;
          const pts = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]];
          const ins = pts.map((c) => visible(c[0], c[1]));
          return mode === 'within' ? ins.every(Boolean) : ins.some(Boolean);
        });
      }
    } else {
      const ext = extentBbox();
      if (ext) features = features.filter((f) => {
        const b = f.geometry && geomBbox(f.geometry);
        if (!b) return false;
        return mode === 'within'
          ? (b[0] >= ext[0] && b[1] >= ext[1] && b[2] <= ext[2] && b[3] <= ext[3])
          : bboxTouches(b, ext);
      });
    }
  }
  return features === d.geometry.features ? d.geometry : { type: 'FeatureCollection', features };
}

// A dataset renders as one poly entry with its single style.
// Row label: name + feature count; "shown / total" when a valid filter is set.
// The filter, as a word for the row title: the value of a simple `d.KEY == 'value'` filter (what
// the shape search writes), else the filter text itself. Lets layers of the same file be told apart.
function filterTerm(d) {
  const f = (d.filter || '').trim();
  if (!f) return '';
  const m = /^d(?:\.[A-Za-z_$][\w$]*|\[(['"]).*?\1\])\s*===?\s*(['"])((?:\\.|(?!\2).)*)\2$/.exec(f);
  return m ? m[3].replace(/\\(.)/g, '$1') : f;
}
function layerLabel(d) {
  const total = d.geometry.features.length, lf = layerFilter(d);
  const term = lf.test ? filterTerm(d) : '';
  const name = term && !d.name.includes(term) ? term + ' · ' + d.name : d.name;
  return name + ' (' + (lf.test ? filteredFC(d).features.length + ' / ' + total : total) + ')';
}
// Handed to the engine as a FEATURE ARRAY: for an array mapa.js draws one path per feature with
// the feature bound (Inspect reads it); a FeatureCollection would be one path for the whole layer.
// simplify: 0 keeps the data at full detail (the engine only simplifies arrays, default 0.01°).
// groupClass tags the layer's <g> so Inspect can name the layer a hovered feature belongs to.
// d.rewind — one of three, set by the ⇄ button:
//   on (unset, the default): geojson rewind to d3's winding (reverse:true = clockwise exterior),
//     same as loadInsetData — every shape fills its inside, whichever way the file wound it.
//   false: off — the file's own winding, untouched.
//   'invert': rewind the other way (reverse:false, RFC 7946) — d3 fills the OUTSIDE of every
//     shape (a mask: everything but these polygons).
// Cached per source feature so a re-render doesn't re-wind the whole file.
const rewoundCache = new WeakMap(), invertedCache = new WeakMap();
function rewound(f) {
  if (!rewoundCache.has(f)) rewoundCache.set(f, turfRewind(f, { reverse: true }));
  return rewoundCache.get(f);
}
function inverted(f) {
  if (!f || !f.geometry || !/Polygon/.test(f.geometry.type)) return f;
  if (!invertedCache.has(f)) invertedCache.set(f, turfRewind(f, { reverse: false }));
  return invertedCache.get(f);
}
const rewindMode = (d) => d.rewind === false ? 'off' : d.rewind === 'invert' ? 'invert' : 'on';
function applyRewind(d, features) {
  const m = rewindMode(d);
  return m === 'on' ? features.map(rewound) : m === 'invert' ? features.map(inverted) : features;
}
// d.fillFrom: take each feature's fill from a COLOUR attribute (e.g. DeepState's `fill`). Features
// are grouped by that colour — one entry per colour; ones without a valid colour keep the layer fill.
const COLOR_RE = /^(#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|(rgb|rgba|hsl|hsla)\([^)]*\))$/i;
// Attributes whose every non-empty value is a colour — the only ones "fill from" offers.
function colorKeys(d) {
  if (!d.geometry) return [];
  const ok = new Map();
  for (const f of d.geometry.features) {
    for (const [k, v] of Object.entries((f && f.properties) || {})) {
      if (v == null || v === '') continue;
      ok.set(k, (ok.get(k) ?? true) && typeof v === 'string' && COLOR_RE.test(v.trim()));
    }
  }
  return [...ok].filter(([, y]) => y).map(([k]) => k);
}
function datasetEntries(d) {
  const features = applyRewind(d, filteredFC(d).features);
  const style = { ...d.style, groupClass: 'ds-' + d.id };
  if (!d.fillFrom || d.style.fill === 'none') return [{ geometry: features, style, simplify: 0 }];
  const groups = new Map();
  for (const f of features) {
    const v = f && f.properties && f.properties[d.fillFrom];
    const c = typeof v === 'string' && COLOR_RE.test(v.trim()) ? v.trim() : d.style.fill;
    if (!groups.has(c)) groups.set(c, []);
    groups.get(c).push(f);
  }
  return [...groups].map(([fill, g]) => ({ geometry: g, style: { ...style, fill }, simplify: 0 }));
}

function renderDataList() {
  const list = $('dataList'); if (!list) return;
  list.replaceChildren();
  for (const d of customData) {
    if (d.kind === 'points') { list.append(pointsItem(d)); continue; }
    const item = document.createElement('div'); item.className = 'data-item';
    const head = document.createElement('div'); head.className = 'data-head';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = d.show;
    cb.onchange = () => { d.show = cb.checked; dataRender(); };
    const nm = document.createElement('span'); nm.className = 'nm';
    // A pointer that didn't resolve stays listed (so it can be relinked) rather than vanishing.
    if (d.missing) { nm.textContent = d.name + ' — missing'; nm.style.color = '#b23'; }
    else if (!d.geometry) { nm.textContent = d.name + ' …'; nm.style.color = '#5b636b'; }
    else nm.textContent = layerLabel(d);
    nm.title = nm.textContent;   // full name on hover — the row cuts long names off with …
    const exp = document.createElement('button'); exp.textContent = d._open ? '▾' : '▸'; exp.title = 'style & filter';
    exp.style.fontSize = '24px'; exp.style.width = '22px';
    exp.onclick = () => { d._open = !d._open; renderDataList(); };
    const del = document.createElement('button'); del.textContent = '✕'; del.title = 'remove'; del.style.color = '#b23';
    del.onclick = () => { const i = customData.indexOf(d); if (i >= 0) customData.splice(i, 1); renderDataList(); dataRender(); };
    // The HEAD % is the whole layer's opacity (fill, pattern and line together), same control
    // as the Raster rows. Fill, line and pattern each have their own % on their own row. (It used
    // to be fill-opacity, switching to stroke-opacity when there was no fill — confusing.)
    const opBtn = opacityButton(
      () => d.style.opacity ?? 1,
      (v) => { if (v >= 1) delete d.style.opacity; else d.style.opacity = v; dataRender(); },
      'layer opacity — everything in this layer'
    );
    // Reorder — higher in the list = drawn on top (render + save hand layers over reversed).
    const i0 = customData.indexOf(d);
    const move = (delta) => {
      const i = customData.indexOf(d), j = i + delta;
      if (j < 0 || j >= customData.length) return;
      customData.splice(i, 1); customData.splice(j, 0, d);
      renderDataList(); dataRender();
    };
    const up = document.createElement('button'); up.textContent = '↑'; up.title = 'move up';
    up.disabled = i0 === 0; up.onclick = () => move(-1);
    const dn = document.createElement('button'); dn.textContent = '↓'; dn.title = 'move down';
    dn.disabled = i0 === customData.length - 1; dn.onclick = () => move(1);
    // Duplicate: same source + style, placed right below — then give it its own filter/style.
    const dup = document.createElement('button'); dup.textContent = '⧉'; dup.title = 'duplicate layer (same data — change its filter and style)';
    dup.onclick = () => {
      const copy = { ...d, id: ++dataSeq, style: { ...d.style }, _fsrc: undefined, _fc: undefined, _open: true,
        _entry: d._entry ? JSON.parse(JSON.stringify({ ...d._entry, geometry: undefined })) : undefined };
      customData.splice(customData.indexOf(d) + 1, 0, copy);
      renderDataList(); dataRender();
    };
    // Rewind: cycles on → invert → off (see applyRewind). On fixes inside-out polygons.
    const rwMode = rewindMode(d);
    const rw = document.createElement('button'); rw.textContent = rwMode === 'invert' ? '⇄ inv' : '⇄';
    rw.className = 'rw-btn' + (rwMode === 'on' ? ' on' : rwMode === 'invert' ? ' inv' : '');
    rw.title = {
      on: 'rewind ON — every shape wound to fill its inside (click to invert)',
      invert: 'rewind INVERT — every shape fills its outside (click to turn off)',
      off: "rewind off — the file's own winding (click to turn on)"
    }[rwMode];
    rw.onclick = () => {
      const next = { on: 'invert', invert: false, off: undefined }[rwMode];
      if (next === undefined) delete d.rewind; else d.rewind = next;
      renderDataList(); dataRender();
    };
    // A URL layer is live: ↻ re-fetches it now (bypassing the browser cache).
    const live = /^https?:\/\//i.test(d.source || '');
    if (live) {
      const rf = document.createElement('button'); rf.textContent = '↻';
      rf.title = 'live URL — refresh now' + (d.fetchedAt ? ' (last fetched ' + d.fetchedAt.toLocaleTimeString() + ')' : '');
      rf.onclick = () => loadPointerLayer(d, true);
      head.append(cb, exp, nm, opBtn, rf, rw, dup, up, dn, del);
    } else head.append(cb, exp, nm, opBtn, rw, dup, up, dn, del);
    item.append(head);

    if (d._open) {
      const body = document.createElement('div'); body.className = 'data-body';
      // Pointer row — this path is what the project file stores. Editable, so data that moved
      // can be re-pointed here instead of by hand-editing the JSON; '…' picks a local file.
      const r0 = document.createElement('div'); r0.className = 'r';
      const pL = document.createElement('label'); pL.textContent = 'data';
      const pIn = document.createElement('input'); pIn.type = 'text'; pIn.value = d.source || '';
      pIn.style.flex = '1'; pIn.title = 'Pointer stored in the project file — resolved against the project folder, then ./projects/';
      pIn.onchange = () => { const v = pIn.value.trim(); if (v && v !== d.source) { d.source = v; relinkDataset(d); } };
      const br = document.createElement('button'); br.textContent = '…'; br.title = 'point at a local file';
      br.onclick = () => pickReplacementFor(d);
      gridRow(r0, null, pL, pIn, br);
      body.append(r0);
      if (d.missing) {
        const warn = document.createElement('div'); warn.className = 'r';
        warn.style.cssText = 'color:#b23; font-size:11px;';
        warn.textContent = d.error || 'not found';
        body.append(warn);
      }
      // Style/filter controls all read the geometry, so an unresolved pointer stops here.
      if (!d.geometry) { item.append(body); list.append(item); continue; }
      // Two rows: fill (colour + pattern; polygons only, a polyline has nothing to fill) and
      // line (colour, width, dash). Opacity lives in the head (opBtn).
      const r2 = document.createElement('div'); r2.className = 'r';
      // Each of fill / line has an on-off box. Off writes the SVG keyword 'none' and parks the
      // previous colour on the record, so switching back restores what you picked rather than
      // the default. Re-renders the row: the head's opacity button follows whichever is live.
      const toggle = (on, onChange) => {
        const t = document.createElement('input'); t.type = 'checkbox'; t.checked = on;
        t.style.margin = '0 2px 0 0'; t.onchange = () => onChange(t.checked);
        return t;
      };
      if (d.kind !== 'line') {
        const fillOn = d.style.fill !== 'none';
        const ft = toggle(fillOn, (on) => {
          if (on) d.style.fill = d._fillPrev || '#3b82f6';
          else { d._fillPrev = d.style.fill; d.style.fill = 'none'; }
          renderDataList(); dataRender();
        });
        ft.title = 'draw the fill';
        const fl = document.createElement('label'); fl.textContent = 'fill';
        const fillC = document.createElement('input'); fillC.type = 'color';
        fillC.value = fillOn ? (d.style.fill || '#3b82f6') : (d._fillPrev || '#3b82f6');
        fillC.disabled = !fillOn;
        fillC.oninput = () => { d.style.fill = fillC.value; dataRender(); };
        const patS = document.createElement('select'); patS.className = 'pat-sel';
        patS.title = 'pattern — tile a PNG from styles/patterns/ over the fill';
        setPatternValue(patS, d.style.pattern);
        patS.onchange = () => {
          if (patS.value) d.style.pattern = patS.value; else delete d.style.pattern;
          renderDataList(); dataRender();
        };
        patS.style.flex = '1';
        const fOp = opacityButton(() => d.style['fill-opacity'] ?? 1,
          (v) => { d.style['fill-opacity'] = v; dataRender(); }, 'fill opacity');
        fOp.disabled = !fillOn;
        gridRow(r2, ft, fl, fillC, fOp);
        // Pattern gets its own row: tile, its own opacity (the head's % is the fill colour's,
        // under the tile) and its scale (tile size in px).
        const rp = document.createElement('div'); rp.className = 'r';
        const pl = document.createElement('label'); pl.textContent = 'pattern';
        const rpCtrls = [patS];
        if (d.style.pattern) {
          const pOp = opacityButton(() => d.style['pattern-opacity'] ?? 1,
            (v) => { d.style['pattern-opacity'] = v; dataRender(); }, 'pattern opacity');
          const szL = document.createElement('label'); szL.className = 'inline'; szL.textContent = 'scale';
          const sz = document.createElement('input'); sz.type = 'number'; sz.min = 0.05; sz.step = 0.1; sz.className = 'w-sm';
          sz.title = 'pattern scale — 1 draws the PNG at its own size, 0.5 half, 2 double';
          sz.value = d.style['pattern-scale'] ?? 1;
          sz.oninput = () => { const v = +sz.value; if (v > 0) { d.style['pattern-scale'] = v; dataRender(); } };
          rpCtrls.push(pOp, szL, sz);
        }
        gridRow(rp, null, pl, ...rpCtrls);
        body.append(r2, rp);
      }
      // Line gets its own row (it shared one with fill and got crushed): colour, width, dash.
      const r3 = document.createElement('div'); r3.className = 'r';
      const strokeOn = d.style.stroke !== 'none';
      const st = toggle(strokeOn, (on) => {
        if (on) d.style.stroke = d._strokePrev || '#1e3a8a';
        else { d._strokePrev = d.style.stroke; d.style.stroke = 'none'; }
        renderDataList(); dataRender();
      });
      st.title = 'draw the outline';
      const sl = document.createElement('label'); sl.textContent = 'line';
      const strC = document.createElement('input'); strC.type = 'color';
      strC.value = strokeOn ? (d.style.stroke || '#1e3a8a') : (d._strokePrev || '#1e3a8a');
      strC.disabled = !strokeOn;
      strC.oninput = () => { d.style.stroke = strC.value; dataRender(); };
      const wL = document.createElement('label'); wL.textContent = 'w'; wL.className = 'inline';
      const w = document.createElement('input'); w.type = 'number'; w.min = 0; w.step = 0.5;
      w.className = 'w-sm'; w.title = 'line width';
      w.value = d.style['stroke-width'] ?? 1; w.disabled = !strokeOn;
      w.oninput = () => { d.style['stroke-width'] = +w.value; dataRender(); };
      // Dash: presets, or "custom" for any SVG stroke-dasharray ("6 3", "8 3 1 3", …).
      const DASHES = { solid: '', dashed: '6 4', dotted: '1 3', 'dash-dot': '8 3 1 3', 'long dash': '12 6' };
      const curDash = d.style['stroke-dasharray'] || '';
      const preset = Object.keys(DASHES).find((k) => DASHES[k] === curDash);
      const dashS = document.createElement('select'); dashS.title = 'line dash';
      dashS.append(...Object.keys(DASHES).map((k) => new Option(k, k)), new Option('custom…', 'custom'));
      dashS.value = preset || 'custom'; dashS.disabled = !strokeOn;
      const dashT = document.createElement('input'); dashT.type = 'text'; dashT.className = 'w-dash';
      dashT.placeholder = 'e.g. 6 3'; dashT.title = 'stroke-dasharray — dash and gap lengths in px';
      dashT.value = curDash; dashT.hidden = !!preset; dashT.disabled = !strokeOn;
      const setDash = (v) => {
        v = v.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
        if (v) d.style['stroke-dasharray'] = v; else delete d.style['stroke-dasharray'];
        dataRender();
      };
      dashS.onchange = () => {
        const custom = dashS.value === 'custom';
        dashT.hidden = !custom;
        if (custom) dashT.focus(); else { dashT.value = DASHES[dashS.value]; setDash(dashT.value); }
      };
      dashT.oninput = () => setDash(dashT.value);
      const sOp = opacityButton(() => d.style['stroke-opacity'] ?? 1,
        (v) => { d.style['stroke-opacity'] = v; dataRender(); }, 'line opacity');
      sOp.disabled = !strokeOn;
      gridRow(r3, st, sl, strC, sOp, wL, w, dashS, dashT);
      body.append(r3);
      // fill from — a colour attribute in the data drives each feature's fill (shown only if one exists).
      const cks = d.kind !== 'line' ? colorKeys(d) : [];
      if (d.fillFrom && !cks.includes(d.fillFrom)) cks.unshift(d.fillFrom); // keep a saved choice visible
      if (cks.length) {
        const rc = document.createElement('div'); rc.className = 'r';
        const cl = document.createElement('label'); cl.textContent = 'fill from';
        const sel = document.createElement('select'); sel.style.flex = '1';
        sel.title = 'Colour each shape from a colour attribute in the data';
        sel.append(new Option('— one colour —', ''), ...cks.map((k) => new Option(k, k)));
        sel.value = d.fillFrom || '';
        sel.onchange = () => { if (sel.value) d.fillFrom = sel.value; else delete d.fillFrom; renderDataList(); dataRender(); };
        gridRow(rc, null, cl, sel);
        body.append(rc);
        if (d.fillFrom) { const fc = r2.querySelector('input[type=color]'); if (fc) { fc.disabled = true; fc.title = 'fill comes from ' + d.fillFrom; } }
      }
      // filter — a property expression; the count and any error update as you type
      const rf = document.createElement('div'); rf.className = 'r';
      const fl = document.createElement('label'); fl.textContent = 'filter';
      const fIn = document.createElement('input'); fIn.type = 'text'; fIn.className = 'ds-filter';
      fIn.value = d.filter || ''; fIn.placeholder = "d.type == 'claim' AND d.name CONTAINS 'occupied'"; fIn.spellcheck = false;
      const fCount = document.createElement('span'); fCount.className = 'ds-count muted';
      const fErr = document.createElement('div'); fErr.className = 'ds-ferr';
      const showFilter = () => {
        const lf = layerFilter(d);
        fCount.textContent = lf.test ? filteredFC(d).features.length + ' / ' + d.geometry.features.length : '';
        fErr.textContent = lf.error ? '⚠ ' + lf.error + ' — drawing all features' : '';
        fErr.hidden = !lf.error;
        fIn.classList.toggle('bad', !!lf.error);
        nm.textContent = layerLabel(d);
      };
      // Applied on submit (Enter or the Apply button), not per keypress.
      const applyFilter = () => { d.filter = fIn.value; showFilter(); dataRender(); };
      fIn.onkeydown = (e) => { if (e.key === 'Enter') applyFilter(); };
      const fApply = document.createElement('button'); fApply.type = 'button'; fApply.textContent = 'Apply';
      fApply.onclick = applyFilter;
      gridRow(rf, null, fl, fIn, fApply, fCount);
      body.append(rf, fErr);
      showFilter();
      // Copy / paste style between layers: everything on the style rows (fill, line, dash,
      // pattern + scale, every opacity) — not the data, filter or fill-from.
      const rs = document.createElement('div'); rs.className = 'r';
      const sp = document.createElement('label'); sp.textContent = 'style';
      const cp = document.createElement('button'); cp.type = 'button'; cp.textContent = 'copy';
      cp.title = 'Copy this layer\'s style';
      cp.onclick = () => {
        styleClipboard = JSON.parse(JSON.stringify(d.style));
        delete styleClipboard.groupClass;
        note('style copied from ' + d.name); renderDataList();
      };
      const ps = document.createElement('button'); ps.type = 'button'; ps.textContent = 'paste';
      ps.disabled = !styleClipboard;
      ps.title = styleClipboard ? 'Give this layer the copied style' : 'Copy a style from another layer first';
      ps.onclick = () => {
        if (!styleClipboard) return;
        d.style = JSON.parse(JSON.stringify(styleClipboard));
        delete d._fillPrev; delete d._strokePrev;
        note('style pasted onto ' + d.name); renderDataList(); dataRender();
      };
      // Blend mode for the whole layer (same modes as the Raster rows).
      const bl = document.createElement('label'); bl.className = 'inline'; bl.textContent = 'blend';
      const bs = document.createElement('select'); bs.title = 'blend mode — how this layer mixes with what is under it';
      bs.append(...BLEND_MODES.map((m) => new Option(m, m)));
      bs.value = d.style['blend-mode'] || 'normal';
      bs.onchange = () => { if (bs.value === 'normal') delete d.style['blend-mode']; else d.style['blend-mode'] = bs.value; dataRender(); };
      gridRow(rs, null, sp, cp, ps, bl, bs);
      body.append(rs);
      item.append(body);
    }
    list.append(item);
  }
  wireDragSort(list, customData, () => { renderDataList(); dataRender(); });
}

// One POI group: head (show / expand / name / reorder / remove) + body (name, collapsed style,
// the CSV text area). CSV edits re-render the MAP only (dataRender), not the list, so typing
// keeps focus.
function pointsItem(g) {
  const count = () => g.name + ' (' + g.points.length + ')';
  const item = document.createElement('div'); item.className = 'data-item';
  const head = document.createElement('div'); head.className = 'data-head';
  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = g.show;
  cb.onchange = () => { g.show = cb.checked; dataRender(); };
  const exp = document.createElement('button'); exp.textContent = g._open ? '▾' : '▸'; exp.title = 'edit points';
  exp.style.fontSize = '24px'; exp.style.width = '22px';
  exp.onclick = () => {
    g._open = !g._open; renderDataList();
  };
  const nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = count();
  const i0 = customData.indexOf(g);
  const move = (delta) => {
    const i = customData.indexOf(g), j = i + delta;
    if (j < 0 || j >= customData.length) return;
    customData.splice(i, 1); customData.splice(j, 0, g);
    renderDataList(); dataRender();
  };
  const up = document.createElement('button'); up.textContent = '↑'; up.title = 'move up';
  up.disabled = i0 === 0; up.onclick = () => move(-1);
  const dn = document.createElement('button'); dn.textContent = '↓'; dn.title = 'move down';
  dn.disabled = i0 === customData.length - 1; dn.onclick = () => move(1);
  const del = document.createElement('button'); del.textContent = '✕'; del.title = 'remove'; del.style.color = '#b23';
  del.onclick = () => {
    const i = customData.indexOf(g); if (i >= 0) customData.splice(i, 1);
    renderDataList(); dataRender();
  };
  head.append(cb, exp, nm, up, dn, del); item.append(head);
  if (!g._open) return item;

  const body = document.createElement('div'); body.className = 'data-body';
  const row = (parent, ...els) => { const r = document.createElement('div'); r.className = 'r'; r.append(...els); parent.append(r); return r; };
  const lab = (t) => { const l = document.createElement('label'); l.textContent = t; return l; };

  // group name (saved as each point's `set`)
  const nIn = document.createElement('input'); nIn.type = 'text'; nIn.value = g.name; nIn.style.flex = '1';
  nIn.onchange = () => { g.name = nIn.value.trim() || g.name; nm.textContent = count(); dataRender(); };
  row(body, lab('name'), nIn);

  // loaded from a GeoJSON file → which property becomes the name (rewrites the CSV)
  if (g._src) {
    const sel = document.createElement('select');
    sel.append(new Option('(no label)', ''));
    for (const k of Object.keys(g._src.features.features[0]?.properties || {})) sel.append(new Option(k, k));
    sel.value = g._src.labelProp || '';
    sel.onchange = () => { g._src.labelProp = sel.value; setPoiCsv(g, pointsToCsv(pointsFromFC(g._src.features, sel.value))); renderDataList(); dataRender(); };
    row(body, lab('label from'), sel);
  }

  // the CSV
  const hint = document.createElement('div'); hint.className = 'muted poi-hint';
  hint.textContent = 'lat, lng, name, dir, type, color — one per line; the last three are optional. dir: N NE E SE S SW W NW, or C (centred). type: city, capital, or a shape (circle, square, triangle, diamond, star, cross, wye). color: #hex or a CSS name.';
  body.append(hint);
  const ta = document.createElement('textarea'); ta.className = 'poi-csv'; ta.spellcheck = false;
  ta.placeholder = '23.114, -82.366, Havana\n17.971, -76.793, Kingston, S';
  ta.value = g.csv || '';
  const status = document.createElement('div'); status.className = 'muted poi-status';
  const showStatus = () => {
    status.textContent = g._bad && g._bad.length ? 'skipped line ' + g._bad.join(', ') + ' (need lat, lng)' : '';
    status.style.color = g._bad && g._bad.length ? '#b23' : '';
  };
  // Applied on submit (the Apply button or ⌘/Ctrl+Enter), not per keystroke.
  const applyCsv = () => { setPoiCsv(g, ta.value); nm.textContent = count(); showStatus(); dataRender(); };
  ta.onkeydown = (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); applyCsv(); } };
  const taApply = document.createElement('button'); taApply.type = 'button'; taApply.textContent = 'Apply';
  taApply.title = 'Apply the list (⌘/Ctrl+Enter)';
  taApply.onclick = applyCsv;

  // place search → appends CSV lines. Arrow keys + Enter, or click; Esc closes.
  const sWrap = document.createElement('div'); sWrap.className = 'poi-search';
  const sIn = document.createElement('input'); sIn.type = 'search'; sIn.placeholder = 'search places by name — empty shows “in view”…';
  noAutofill(sIn);
  const sList = document.createElement('div'); sList.className = 'poi-sugg'; sList.hidden = true;
  let sugg = [], active = 0;
  const drawSugg = () => {
    sList.replaceChildren();
    sugg.forEach((s, i) => {
      const o = document.createElement('div'); o.textContent = s.label;
      o.className = 'opt' + (i === active ? ' on' : '');
      o.onmousedown = (e) => { e.preventDefault(); pickSugg(i); };   // mousedown: before the input blurs
      sList.append(o);
    });
    sList.hidden = !sugg.length;
  };
  const pickSugg = (i) => {
    const s = sugg[i]; if (!s) return;
    if (ta.value !== g.csv) setPoiCsv(g, ta.value);   // keep typed-but-unapplied lines
    const n = appendPlaces(g, s.rows);
    if (n) {
      ta.value = g.csv; ta.scrollTop = ta.scrollHeight;
      nm.textContent = count(); showStatus(); dataRender();
      note('added ' + s.label);
    }
    sIn.value = ''; sugg = []; drawSugg(); sIn.focus();
  };
  sIn.oninput = async () => {
    const q = sIn.value;
    let gz; try { gz = await loadGazetteer(); } catch { return; }
    if (sIn.value !== q) return;   // a newer keystroke superseded this one
    const fq = fold(q).trim();
    sugg = !fq ? viewSuggestions(gz)
      : 'in view'.startsWith(fq) || fq.includes('view') ? [...viewSuggestions(gz), ...placeSuggestions(gz, q)]
      : placeSuggestions(gz, q);
    active = 0; drawSugg();
  };
  sIn.onfocus = () => { if (!sIn.value) sIn.oninput(); };   // empty box → the "In view" picks
  sIn.onkeydown = (e) => {
    if (e.key === 'ArrowDown') { active = Math.min(active + 1, sugg.length - 1); drawSugg(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); drawSugg(); e.preventDefault(); }
    else if (e.key === 'Enter') { pickSugg(active); e.preventDefault(); }
    else if (e.key === 'Escape') { sugg = []; drawSugg(); }
  };
  sIn.onblur = () => { sugg = []; drawSugg(); };
  sWrap.append(sIn, sList);
  body.insertBefore(sWrap, hint);
  body.append(ta, taApply, status);
  showStatus();
  item.append(body);
  return item;
}

// ---- pointer layers: shape search + live URLs -------------------------------------------------
// Both add a Data layer that POINTS at its data (a basemap/data file + filter, or a URL) — the
// project file stores the pointer, never the geometry, and every load re-fetches it. So a URL
// layer is LIVE: reload the project (or press ↻ on the row) and it shows the endpoint's latest.
// Basemap/data files are cached per session (admin2 is big); URLs never are.
const pointerFCs = new Map();
const isUrl = (src) => /^https?:\/\//i.test(src || '');
async function loadPointerLayer(rec, fresh) {
  rec.missing = false; rec.error = null; renderDataList();
  try {
    let fc = !isUrl(rec.source) && pointerFCs.get(rec.source);
    if (!fc) {
      let data;
      if (isUrl(rec.source)) {
        const r = await fetch(rec.source, { cache: fresh ? 'reload' : 'default' });
        if (!r.ok) throw new Error(r.status + ' ' + rec.source);
        data = await r.json();
      } else data = (await fetchPointer(rec.source)).data;
      fc = toFeatureCollection(data);
      if (!isUrl(rec.source)) pointerFCs.set(rec.source, fc);
    }
    if (!fc.features.length) throw new Error('no features');
    rec.geometry = fc; rec.kind = datasetKind(fc);
    if (isUrl(rec.source)) rec.fetchedAt = new Date();
  } catch (e) { rec.missing = true; rec.error = e.message; note(rec.name + ': ' + e.message); }
  renderDataList(); dataRender();
}
function addPointerLayer({ name, source, filter }) {
  const rec = { id: ++dataSeq, name, source, geometry: null, kind: 'poly', style: { ...POLY_STYLE },
    show: true, missing: false };
  if (filter) rec.filter = filter;
  customData.unshift(rec);   // new layers go to the top of the list
  renderDataList();
  return loadPointerLayer(rec);
}
// A filter expression selecting features whose `key` equals `value` (quoted for compileFilter).
function eqFilter(key, value) {
  const q = (v) => "'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  return (/^[A-Za-z_$][\w$]*$/.test(key) ? 'd.' + key : 'd[' + q(key) + ']') + ' == ' + q(value);
}

// Shape search index (scripts/gen-shape-index.mjs): one row per (file, property, value) + feature count.
let shapeIndexP = null;
function loadShapeIndex() {
  if (!shapeIndexP) shapeIndexP = fetch('./mapa/files/shape-index.json').then((r) => { if (!r.ok) throw new Error(r.status + ' shape-index.json — run npm run gen:shapes'); return r.json(); })
    .then((ix) => { ix.folded = ix.rows.map((r) => fold(r[2])); return ix; })
    .catch((e) => { shapeIndexP = null; note('shape search: ' + e.message); throw e; });
  return shapeIndexP;
}
// Name-ish keys rank first, so "Iraq" lists the country before attributes that merely mention it.
const NAME_KEY = /^(shapeName|name|name_en|NAME|NAME_EN|SUB_REGION|LEVEL_\d|REGION)$/;
function shapeSuggestions(ix, query) {
  const q = fold(query).trim();
  if (q.length < 2) return [];
  const hits = [];
  for (let i = 0; i < ix.rows.length; i++) {
    const f = ix.folded[i];
    const r = f === q ? 0 : f.startsWith(q) ? 1 : f.includes(q) ? 2 : -1;
    if (r >= 0) hits.push([r, i]);
  }
  hits.sort((a, b) => a[0] - b[0]
    || (NAME_KEY.test(ix.rows[b[1]][1]) - NAME_KEY.test(ix.rows[a[1]][1]))
    || ix.rows[a[1]][0] - ix.rows[b[1]][0]
    || ix.rows[a[1]][2].length - ix.rows[b[1]][2].length);
  // One row per (file, name): the index has a row per field, so a feature whose BRK_NAME,
  // BRK_GROUP and NAME_SORT all say "Jammu and Kashmir" listed three times. The sort above
  // puts the best field (name-ish keys first) ahead, so keep the first of each.
  const seen = new Set();
  const uniq = hits.filter(([, i]) => {
    const k = ix.rows[i][0] + '\u0000' + ix.folded[i];
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
  return uniq.slice(0, 14).map(([, i]) => {
    const [fi, key, value, n] = ix.rows[i];
    const [source, fileLabel] = ix.files[fi];
    return { key, value, n, source, fileLabel };
  });
}
{
  const sIn = $('shapeSearchIn'), sList = $('shapeSugg');
  let sugg = [], active = 0;
  const draw = () => {
    sList.replaceChildren();
    sugg.forEach((s, i) => {
      const o = document.createElement('div'); o.className = 'opt' + (i === active ? ' on' : '');
      o.title = s.fileLabel + ' · ' + s.key + ' = ' + s.value + ' (' + s.n + ' shape' + (s.n === 1 ? '' : 's') + ')';
      const m = document.createElement('span'); m.className = 'muted';
      m.textContent = ' — ' + s.fileLabel + ' · ' + s.key + (s.n > 1 ? ' (' + s.n + ')' : '');
      o.append(s.value.replace(/\s+/g, ' '), m);   // some data names carry line breaks
      o.onmousedown = (e) => { e.preventDefault(); pick(i); };
      sList.append(o);
    });
    // A short list (2–9) gets an "add all" row at the end — reachable with ↓ / Enter too.
    if (canAddAll()) {
      const o = document.createElement('div'); o.className = 'opt opt-all' + (active === sugg.length ? ' on' : '');
      o.textContent = '+ add all ' + sugg.length;
      o.title = 'Add every result above as its own data layer';
      o.onmousedown = (e) => { e.preventDefault(); pick(sugg.length); };
      sList.append(o);
    }
    sList.hidden = !sugg.length;
  };
  const canAddAll = () => sugg.length > 1 && sugg.length < 10;
  const pick = (i) => {
    if (i === sugg.length && canAddAll()) {
      for (const s of sugg) addPointerLayer({ name: s.value + ' · ' + s.fileLabel, source: s.source, filter: eqFilter(s.key, s.value) });
      note('added ' + sugg.length + ' shapes');
      sIn.value = ''; sugg = []; draw();
      return;
    }
    const s = sugg[i]; if (!s) return;
    addPointerLayer({ name: s.value + ' · ' + s.fileLabel, source: s.source, filter: eqFilter(s.key, s.value) });
    note('added ' + s.value + ' (' + s.fileLabel + ')');
    sIn.value = ''; sugg = []; draw();
  };
  if (sIn && sList) {
    sIn.oninput = async () => {
      const q = sIn.value;
      let ix; try { ix = await loadShapeIndex(); } catch { return; }
      if (sIn.value !== q) return;   // a newer keystroke superseded this one
      sugg = shapeSuggestions(ix, q); active = 0; draw();
    };
    sIn.onkeydown = (e) => {
      if (e.key === 'ArrowDown') { active = Math.min(active + 1, sugg.length - (canAddAll() ? 0 : 1)); draw(); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { active = Math.max(active - 1, 0); draw(); e.preventDefault(); }
      else if (e.key === 'Enter') { pick(active); e.preventDefault(); }
      else if (e.key === 'Escape') { sugg = []; draw(); }
    };
    sIn.onblur = () => { sugg = []; draw(); };
  }
  // + url: a LIVE layer — the URL is the pointer, re-fetched on every load.
  const row = $('dataUrlRow'), uIn = $('dataUrl');
  const addUrl = () => {
    const url = (uIn.value || '').trim();
    if (!isUrl(url)) { note('enter a full http(s) URL'); return; }
    let name = url; try { const u = new URL(url); name = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''); } catch {}
    addPointerLayer({ name, source: url });
    uIn.value = ''; row.hidden = true;
  };
  { const b = $('dataAddUrl'); if (b) b.addEventListener('click', () => { row.hidden = !row.hidden; if (!row.hidden) uIn.focus(); }); }
  { const b = $('dataUrlAdd'); if (b) b.addEventListener('click', addUrl); }
  if (uIn) uIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } });
}

function readDataFiles(files) {
  for (const f of files) { const r = new FileReader(); r.onload = () => addDataset(f.name, r.result); r.readAsText(f); }
}

{
  const drop = $('dataDrop'), file = $('dataFile');
  { const ap = $('dataAddPoints'); if (ap) ap.addEventListener('click', () => addPointsGroup()); }
  { const apl = $('dataAddPolys'); if (apl && file) apl.addEventListener('click', () => file.click()); }
  if (drop && file) {
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { readDataFiles(file.files); file.value = ''; });
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('drag')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files.length) readDataFiles(e.dataTransfer.files); });
  }
}
{ const sc = $('showCustom'); if (sc) sc.addEventListener('change', render); }
{ const le = $('limitExtent'); if (le) le.addEventListener('change', () => { renderDataList(); requestRender(); }); }

// ---- Raster layers (pmtiles) ----------------------------------------------
// A dynamic list of pmtiles raster sources, each with blend mode, opacity, and an optional
// hillshade delta. A single MapTiler key is substituted into any URL that needs it (mtResolve).
// Seeded with the default hillshade so it's always present in the list.
// writePanel replaces this when a project loads.
// Each row has an explicit kind: 'tile' (pmtiles / xyz) or 'image' (worldfile).
// hs.pmtiles is hosted on tiles.mbricknell.com (the `hs` source in styles/style-*.json).
let rasterData = [{ kind: 'tile', id: 'hillshade', name: 'hillshade', url: 'https://tiles.mbricknell.com/hs.pmtiles',
  blendMode: 'normal', opacity: 1, delta: 0, show: true, _open: false }];
let rasterSeq = 0;
// Dev-dropped raster images, keyed by row id: blob: URLs used for rendering ONLY. Never
// serialized — the project always stores the pointer in the row's `url`.
const rasterBlobs = new Map();
// color-dodge / color-burn commonly reset to Normal on Illustrator's SVG import, so they're
// omitted. The colour-family modes (hue … luminosity) render in browsers; their Illustrator
// round-trip hasn't been checked.
const BLEND_MODES = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten',
  'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
// MapTiler key: one per browser (the Raster panel's key field, localStorage), never in a
// project. Rows and saved files carry `?key={key}`; a literal key pasted into a URL (or found
// in an old file) is lifted into the field and replaced by the placeholder. Rendering fills
// the placeholder in (resolveRaster); with no key, MapTiler rows are skipped.
const MT_KEY_STORE = 'mapa:maptiler-key';
const isMt = (u) => /^https?:\/\/api\.maptiler\.com\//i.test(u || '');
function mtKey() { try { return localStorage.getItem(MT_KEY_STORE) || ''; } catch { return ''; } }
function setMtKey(k) {
  try { k ? localStorage.setItem(MT_KEY_STORE, k) : localStorage.removeItem(MT_KEY_STORE); } catch {}
  const f = $('mtKey'); if (f && f.value !== k) f.value = k;
}
function mtStrip(url) {
  if (!isMt(url)) return url;
  if (!/[?&]key=/i.test(url)) return url + (url.includes('?') ? '&' : '?') + 'key={key}';
  return url.replace(/([?&]key=)([^&#]*)/i, (m, pre, k) => {
    const lit = decodeURIComponent(k);
    if (lit && lit !== '{key}' && !mtKey()) setMtKey(lit);
    return pre + '{key}';
  });
}
function mtResolve(url) {
  if (!isMt(url)) return url;
  const k = mtKey(); if (!k) return null;
  return url.replace(/\{key\}/g, encodeURIComponent(k));
}
{
  const f = $('mtKey');
  if (f) { f.value = mtKey(); f.addEventListener('change', () => { setMtKey(f.value.trim()); onEdit(); }); }
}
// Friendly name from a raster URL: the /maps/<name>/ segment (MapTiler) or the .pmtiles filename.
function deriveRasterName(url) {
  if (!url) return '';
  const m = url.match(/\/maps\/([^\/?#]+)/i);
  if (m) return m[1];
  const f = url.split(/[?#]/)[0].split('/').pop();
  if (f && /\.pmtiles$/i.test(f)) return f.replace(/\.pmtiles$/i, '');
  return f || '';
}
// kind: 'tile' (pmtiles / xyz) or 'image' (worldfile-georeferenced image).
function addRaster(kind) {
  const row = {
    kind,
    id: (kind === 'image' ? 'image-' : 'raster-') + (++rasterSeq),
    name: kind === 'image' ? ('image ' + rasterSeq) : ('raster ' + rasterSeq),
    url: '',
    blendMode: 'normal',
    opacity: 1,
    delta: 0,
    show: true,
    _autoName: true,  // auto-fill name from URL until renamed
    _open: true
  };
  // A new worldfile image goes OVER the basemap: under it, the land fill hides it completely.
  // A new layer draws OVER the basemap: under it, the land fill hides it completely.
  row.position = 'top';
  if (kind === 'image') row.worldfile = { xPixelSize: 1, yRotation: 0, xRotation: 0, yPixelSize: -1, xUpperLeft: 0, yUpperLeft: 0 };
  rasterData.unshift(row);
  // Adding a layer means you want to see it — "show raster" defaults off, which made a new
  // layer silently not draw.
  { const sr = $('showRaster'); if (sr) sr.checked = true; }
  renderRasterList(); onEdit();
}
function renderRasterList() {
  const list = $('rasterList'); if (!list) return;
  list.replaceChildren();
  for (const r of rasterData) {
    const item = document.createElement('div'); item.className = 'data-item';
    const head = document.createElement('div'); head.className = 'data-head';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = r.show;
    cb.onchange = () => { r.show = cb.checked; onEdit(); };
    const exp = document.createElement('button'); exp.textContent = r._open ? '▾' : '▸'; exp.title = 'settings';
    exp.className = 'ex';
    exp.onclick = () => { r._open = !r._open; renderRasterList(); };
    const nm = document.createElement('input'); nm.type = 'text'; nm.className = 'nm'; nm.value = r.name;
    nm.title = 'layer name';
    nm.oninput = () => { r.name = nm.value; r._autoName = false; };
    // Move up/down in the list (higher in the list = drawn on top).
    const i0 = rasterData.indexOf(r);
    const move = (delta) => { const i = rasterData.indexOf(r), j = i + delta;
      if (j < 0 || j >= rasterData.length) return;
      rasterData.splice(i, 1); rasterData.splice(j, 0, r); renderRasterList(); onEdit(); };
    const up = document.createElement('button'); up.textContent = '↑'; up.title = 'move up';
    up.disabled = i0 === 0; up.onclick = () => move(-1);
    const dn = document.createElement('button'); dn.textContent = '↓'; dn.title = 'move down';
    dn.disabled = i0 === rasterData.length - 1; dn.onclick = () => move(1);
    const del = document.createElement('button'); del.textContent = '✕'; del.title = 'remove'; del.style.color = '#b23';
    del.onclick = () => { const i = rasterData.indexOf(r); if (i >= 0) rasterData.splice(i, 1); renderRasterList(); onEdit(); };
    // Blend + opacity live in the HEAD, next to the arrows — they're the two you reach for
    // constantly, so they shouldn't need the row expanded. Each is a button that opens a
    // small popover; the button face shows the current value.
    const popStyle = 'position:fixed; z-index:1000; background:var(--panel); border:1px solid var(--border); color:var(--fg); ' +
      'box-shadow:0 2px 10px rgba(0,0,0,.28); padding:4px; display:flex; flex-direction:column; gap:2px; border-radius:4px;';
    const closePops = closeValuePops;
    const blendBtn = document.createElement('button');
    blendBtn.textContent = '◐';   // blend-mode glyph; exact mode is in the tooltip + popover
    blendBtn.title = 'blend mode: ' + (r.blendMode || 'normal');
    blendBtn.className = 'mini blend-btn' + (r.blendMode && r.blendMode !== 'normal' ? ' on' : '');
    blendBtn.onclick = (ev) => {
      ev.stopPropagation();
      const open = document.querySelector('.' + POP_CLASS + '[data-kind="blend"]'); closePops(); if (open) return;
      const pop = document.createElement('div'); pop.className = POP_CLASS; pop.dataset.kind = 'blend';
      pop.style.cssText = popStyle;
      for (const m of BLEND_MODES) {
        const b = document.createElement('button'); b.textContent = m;
        b.style.cssText = 'font:11px system-ui,sans-serif; text-align:left; padding:3px 10px; background:none; border:none; color:inherit; cursor:pointer; border-radius:3px;';
        if (m === r.blendMode) { b.style.background = 'var(--accent)'; b.style.color = '#fff'; }
        b.onclick = () => { r.blendMode = m; closePops(); renderRasterList(); onEdit(); };
        pop.append(b);
      }
      document.body.append(pop);
      const rect = blendBtn.getBoundingClientRect();
      pop.style.left = Math.min(rect.left, innerWidth - 140) + 'px';
      pop.style.top = (rect.bottom + 2) + 'px';
    };
    const opBtn = opacityButton(() => r.opacity, (v) => { r.opacity = v; onEdit(); });
    head.append(cb, exp, nm, blendBtn, opBtn, up, dn, del); item.append(head);
    if (r._open) {
      const body = document.createElement('div'); body.className = 'data-body';
      // URL row (label differs by kind)
      const ru = document.createElement('div'); ru.className = 'r';
      const ul = document.createElement('label'); ul.textContent = r.kind === 'image' ? 'image' : 'tiles';
      const uin = document.createElement('input'); uin.type = 'text'; uin.value = r.url;
      uin.placeholder = r.kind === 'image' ? 'https://…/overlay.png' : 'https://…/x.pmtiles or …/{z}/{x}/{y}.png';
      uin.onchange = () => { const s = mtStrip(uin.value); if (s !== uin.value) { r.url = s; uin.value = s; } };
      uin.oninput = () => { r.url = uin.value;
        if (r._autoName) { const dn = deriveRasterName(r.url); if (dn) { r.name = dn; nm.value = dn; } }
        onEdit(); };
      ru.append(ul, uin);
      // blend + opacity now live in the row head (see blendBtn / opBtn above).
      body.append(ru);

      // draw: under the basemap (its opaque land fill hides the layer) or over it, under the data.
      // Both kinds: tile layers (satellite, hillshade) and worldfile images.
      {
        const rd = document.createElement('div'); rd.className = 'r';
        const dl = document.createElement('label'); dl.textContent = 'draw';
        const dsel = document.createElement('select');
        dsel.append(new Option('under basemap', 'raster'), new Option('over basemap', 'top'));
        dsel.value = r.position === 'top' ? 'top' : 'raster';
        dsel.onchange = () => { r.position = dsel.value; onEdit(); };
        rd.append(dl, dsel); body.append(rd);
      }
      if (r.kind === 'image') {
        // worldfile: .wld/.pgw/.jgw drop zone + the 6 typed values
        if (!r.worldfile) r.worldfile = { xPixelSize: 1, yRotation: 0, xRotation: 0, yPixelSize: -1, xUpperLeft: 0, yUpperLeft: 0 };
        const drop = document.createElement('div'); drop.className = 'wf-drop';
        drop.textContent = 'drop the image and/or its .wld here';
        const fillWf = (wf) => { if (!wf) return; r.worldfile = { ...r.worldfile, ...wf }; renderRasterList(); onEdit(); };
        const readWld = (file) => { const rd = new FileReader(); rd.onload = () => fillWf(parseWld(rd.result)); rd.readAsText(file); };
        // Dropping the image itself: render it from a blob now, but point the project at
        // data/<name>.<ext> so the saved file references the hosted/repo copy, not the blob.
        const readImg = (file) => {
          const old = rasterBlobs.get(r.id); if (old) URL.revokeObjectURL(old);
          rasterBlobs.set(r.id, URL.createObjectURL(file));
          r.url = pointerForImage(file.name);
          if (r._autoName) { const dn = deriveRasterName(r.url); if (dn) r.name = dn; }
          note('using ' + file.name + ' — project points at ' + r.url);
          renderRasterList(); onEdit();
        };
        // Route by file type: an image is the raster, anything else is the worldfile sidecar.
        const isImage = (f) => /^image\//.test(f.type || '') || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name || '');
        const takeFiles = (files) => { for (const f of files) (isImage(f) ? readImg : readWld)(f); };
        const hidden = document.createElement('input'); hidden.type = 'file'; hidden.multiple = true;
        hidden.accept = '.wld,.pgw,.jgw,.tfw,.txt,image/*'; hidden.style.display = 'none';
        hidden.addEventListener('change', () => { takeFiles(hidden.files); hidden.value = ''; });
        drop.addEventListener('click', () => hidden.click());
        ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
        ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('drag')));
        drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files.length) takeFiles(e.dataTransfer.files); });
        body.append(drop, hidden);
        for (const [key, lab] of WF_FIELDS) {
          const wr = document.createElement('div'); wr.className = 'r';
          const wl = document.createElement('label'); wl.textContent = lab;
          const wi = document.createElement('input'); wi.type = 'number'; wi.step = 'any'; wi.value = r.worldfile[key];
          wi.oninput = () => { r.worldfile[key] = +wi.value || 0; onEdit(); };
          wr.append(wl, wi); body.append(wr);
        }
      } else {
        // pmtiles/xyz: hillshade delta — on the same line as the tiles URL.
        const dl = document.createElement('label'); dl.textContent = 'delta'; dl.title = 'hillshade azimuth offset'; dl.className = 'inline';
        const din = document.createElement('input'); din.type = 'number'; din.value = r.delta; din.step = 1; din.className = 'w-sm';
        din.oninput = () => { r.delta = +din.value || 0; onEdit(); };
        ru.append(dl, din);
      }
      item.append(body);
    }
    list.append(item);
  }
  wireDragSort(list, rasterData, () => { renderRasterList(); onEdit(); });
}
// A world file is 6 numeric lines in this exact order (A, D, B, E, C, F).
const WF_FIELDS = [
  ['xPixelSize', 'x px size'], ['yRotation', 'y rot'], ['xRotation', 'x rot'],
  ['yPixelSize', 'y px size'], ['xUpperLeft', 'x upper-left'], ['yUpperLeft', 'y upper-left']
];
function parseWld(text) {
  const n = String(text).split(/\r?\n/).map((s) => parseFloat(s.trim())).filter((v) => Number.isFinite(v));
  if (n.length < 6) return null;
  return { xPixelSize: n[0], yRotation: n[1], xRotation: n[2], yPixelSize: n[3], xUpperLeft: n[4], yUpperLeft: n[5] };
}
{ const ra = $('rasterAddTile'); if (ra) ra.addEventListener('click', () => addRaster('tile')); }
{ const ra = $('rasterAddWf'); if (ra) ra.addEventListener('click', () => addRaster('image')); }
{ const sr = $('showRaster'); if (sr) sr.addEventListener('change', onEdit); }
renderRasterList(); // show the seeded default on first load (no project ref = writePanel never runs)

// ---- wiring ---------------------------------------------------------------
// Live edit is only offered when the view is zoomed in enough — the D3 render is
// slow over wide areas (full-res basemap), so a whole-world/large bbox would make
// every keystroke lag. Tune LIVE_MAX_SPAN (degrees) to taste.
const LIVE_MAX_SPAN = 40;
function currentSpan() {
  const parts = $('bbox').value.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    return Math.max(Math.abs(parts[2] - parts[0]), Math.abs(parts[3] - parts[1]));
  }
  return Infinity; // no bbox = whole world = slowest
}
function updateLiveAvailability() {
  // The live toggle lives in the Output panel — absent when that panel isn't on the board,
  // so guard before touching it (an edit shouldn't throw just because Output is parked).
  const live = $('live'); if (!live) return;
  // Never lock the toggle — just warn. The old hard-disable created a catch-22:
  // live edit needs a bbox, but the bbox field doesn't reframe on its own.
  live.disabled = false;
  // Tooltip on the checkbox: tile quota, plus a lag warning at large spans.
  const tip = 'Renders on every edit. Tile layers refetch when the view moves — watch your tile quota.' +
    (currentSpan() <= LIVE_MAX_SPAN ? '' : '\nMay lag at this span.');
  live.title = tip;
  const label = $('liveLabel'); if (label) label.title = tip;
}

// Per-pane Render buttons only make sense when live edit is off (live = auto-render on every edit).
// With live update off, edits don't redraw; they flag the Render buttons instead, cleared by a render.
function markStale(on) {
  document.querySelectorAll('#mapRender, #panelRender, .render-near').forEach((b) => {
    if (!('baseTitle' in b.dataset)) b.dataset.baseTitle = b.title || b.dataset.tip || '';
    b.classList.toggle('stale', !!on);
    b.title = on ? 'Settings changed — render to update the export (Ctrl+Enter)' : b.dataset.baseTitle;
  });
}
// With live update off the export can be behind the panels. Download / Preview must never save
// or show a stale render: if anything changed since the last render, render first, then carry on.
const isStale = () => !!document.querySelector('#mapRender.stale, #panelRender.stale, .render-near.stale');
$('download')?.addEventListener('click', async (e) => {
  if (e.target.closest('#dlArrow') || e.target.closest('.dl-opt')) return;   // opening the menu / options isn't a download
  const btn = e.target.closest('button'); if (!btn || !isStale()) return;
  e.stopPropagation(); e.preventDefault();
  const which = btn.id === 'dlBtn' ? null : btn.textContent;   // a menu item: find it again after the re-render
  note('settings changed — rendering before download…');
  await render();
  if (!which) $('dlBtn').click();
  else { $('dlArrow').click(); [...$('dlMenu').querySelectorAll('button')].find((b) => b.textContent === which)?.click(); }
}, true);
$('previewView')?.addEventListener('click', async (e) => {
  if (!isStale()) return;
  e.stopImmediatePropagation();
  await render(); openPreview();
}, true);
function syncRenderButtons() {
  const show = !$('live')?.checked;
  document.querySelectorAll('.render-near').forEach((b) => { b.style.display = show ? '' : 'none'; });
}

let liveTimer;
// Centre of the current map view — bbox field first (it already mirrors the pane), else the live
// pane bounds. null if neither is set yet.
function insetViewCenter() {
  const p = $('bbox').value.split(',').map((s) => parseFloat(s.trim()));
  if (p.length === 4 && p.every(Number.isFinite)) return [(p[0] + p[2]) / 2, (p[1] + p[3]) / 2];
  if (Array.isArray(paneBounds) && paneBounds.length === 4) return [(paneBounds[0] + paneBounds[2]) / 2, (paneBounds[1] + paneBounds[3]) / 2];
  return null;
}
// Inset follows the map view unless locked. Unlocked → fill centre from the view and disable the
// fields (they're auto). Locked → editable, frozen at whatever's typed. Icon reflects the state.
function syncInsetFollow() {
  const following = $('showInset').checked && !$('insLock').checked;
  const cx = $('insCx'), cy = $('insCy');
  if (following) {
    const vc = insetViewCenter();
    if (vc) { cx.value = +vc[0].toFixed(4); cy.value = +vc[1].toFixed(4); }
  }
  cx.disabled = cy.disabled = following;
}
// Live reminder of the export size in the output header. Height is engine-computed from the frame
// (or sphere) aspect when left "auto", so we can't know it until render — show "auto" until then.
// A render calls setOutDims() with the true SVG dimensions.
function updateOutDims() {
  const el = $('outDims'); if (!el || el.classList.contains('editing')) return;
  const w = num($('w').value) || 1000, h = num($('h').value);
  el.dataset.text = w + ' × ' + (h || 'auto') + ' px';
  el.textContent = el.dataset.text;
}
// The actual rendered size, read off the produced SVG's width/height attributes. When height is
// on auto, show the RESOLVED pixel height the engine worked out, tagged "(auto)" — the number is
// what you actually get, and the tag says you didn't type it.
function setOutDims(svg) {
  const el = $('outDims'); if (!el || !svg) return;
  const w = Math.round(+svg.getAttribute('width')), h = Math.round(+svg.getAttribute('height'));
  if (!Number.isFinite(w) || !Number.isFinite(h)) return;
  const auto = !num($('h').value);
  el.dataset.text = w + ' × ' + h + ' px' + (auto ? ' (auto)' : '');
  if (!el.classList.contains('editing')) el.textContent = el.dataset.text;
}
// Click the readout to edit the size in place. Writes through to the Size fields (#w/#h) and
// fires their input/change events, so render gating and frame sizes behave as if typed there.
// Height left blank = auto. Enter/blur applies, Esc cancels.
{
  const el = $('outDims');
  if (el) el.addEventListener('click', () => {
    if (el.classList.contains('editing')) return;
    el.classList.add('editing');
    el.innerHTML = '<input type="number" min="1" class="od-w"> × <input type="number" min="1" class="od-h" placeholder="auto"> px';
    const wi = el.querySelector('.od-w'), hi = el.querySelector('.od-h');
    wi.value = $('w').value; hi.value = $('h').value;
    let done = false;
    const close = (apply) => {
      if (done) return; done = true;
      el.classList.remove('editing');
      const changed = apply && (wi.value !== $('w').value || hi.value !== $('h').value);
      el.textContent = el.dataset.text || '';
      if (!changed) return;
      for (const [src, dst] of [[wi, $('w')], [hi, $('h')]]) {
        if (src.value === dst.value) continue;
        dst.value = src.value;
        dst.dispatchEvent(new Event('input', { bubbles: true }));
        dst.dispatchEvent(new Event('change', { bubbles: true }));
      }
      updateOutDims();   // typed size until the next render reports the real one
    };
    const key = (e) => { if (e.key === 'Enter') close(true); else if (e.key === 'Escape') close(false); };
    wi.addEventListener('keydown', key); hi.addEventListener('keydown', key);
    // Blur to anywhere outside the readout applies; tabbing between the two boxes doesn't.
    el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) close(true); });
    wi.focus(); wi.select();
  });
}

// Zoom + pan the rendered export: wrap the SVG's contents in a <g> and drive it with d3.zoom.
// Strokes stay crisp via vector-effect:non-scaling-stroke (CSS on .zoom-layer). Each render
// starts fit (identity). scaleExtent min 1 = can't zoom out past fit; ⌘/ctrl+wheel or wheel to zoom.
// Chrome overlays that stay pinned to the artboard corners (don't zoom/pan with the map).
const FIXED_IDS = ['scalebar', 'gradient', 'inset', 'north-arrow'];
let outZoom = null;
// Remember the current zoom/pan so a re-render (e.g. a live edit while zoomed in) keeps your view
// instead of snapping back to fit. Cleared on crop-to-view and project load (see those callers).
let lastZoom = null;
// ---- Inspect: hover a data-layer feature → its properties ---------------------------------
// d3 binds each feature to its <path> (datasetEntries hands the engine a feature array), so the
// tooltip just reads path.__data__.properties; the layer comes from its <g class="ds-<id>">.
let inspectOn = false, inspectHit = null;
function inspectClear() {
  if (inspectHit) { inspectHit.classList.remove('inspect-hit'); inspectHit = null; }
  const tip = $('inspectTip'); if (tip) tip.hidden = true;
}
function inspectAt(e) {
  const t = e.target;
  const g = t && t.closest && t.closest('g[class*="ds-"]');
  const feat = t && t.tagName === 'path' && g ? t.__data__ : null;
  if (!feat || !feat.properties) { inspectClear(); return; }
  if (inspectHit !== t) { inspectClear(); inspectHit = t; t.classList.add('inspect-hit'); }
  let tip = $('inspectTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'inspectTip'; document.body.append(tip); }
  const id = +((/(?:^|\s)ds-(\d+)/.exec(g.getAttribute('class') || '') || [])[1]);
  const layer = customData.find((d) => d.id === id);
  tip.replaceChildren();
  const h = document.createElement('div'); h.className = 'it-layer'; h.textContent = layer ? layer.name : 'data layer';
  const tb = document.createElement('div'); tb.className = 'it-grid';
  const keys = Object.keys(feat.properties);
  const MAX_ROWS = 24; // 12 lines × 2 columns — a glance, not a dump
  for (const k of keys.slice(0, MAX_ROWS)) {
    const kc = document.createElement('span'); kc.className = 'k'; kc.textContent = k;
    const v = feat.properties[k];
    const vc = document.createElement('span'); vc.className = 'v';
    const txt = v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v);
    vc.textContent = txt; // one line each; CSS ellipsises the overflow
    tb.append(kc, vc);
  }
  tip.append(h, keys.length ? tb : Object.assign(document.createElement('div'), { className: 'muted', textContent: '(no properties)' }));
  if (keys.length > MAX_ROWS) tip.append(Object.assign(document.createElement('div'), { className: 'muted', textContent: '+ ' + (keys.length - MAX_ROWS) + ' more' }));
  tip.hidden = false;
  // Below-right of the pointer; flip to the other side rather than cover what's under it.
  const pad = 12, w = tip.offsetWidth, hgt = tip.offsetHeight;
  const x = e.clientX + pad + w > innerWidth - 4 ? e.clientX - pad - w : e.clientX + pad;
  const y = e.clientY + pad + hgt > innerHeight - 4 ? e.clientY - pad - hgt : e.clientY + pad;
  tip.style.left = Math.max(4, x) + 'px';
  tip.style.top = Math.max(4, y) + 'px';
}
{
  const iv = $('inspectView');
  if (iv) iv.addEventListener('click', () => {
    inspectOn = !inspectOn;
    iv.classList.toggle('on', inspectOn);
    mapEl.classList.toggle('inspecting', inspectOn);
    if (!inspectOn) inspectClear();
  });
  mapEl.addEventListener('pointermove', (e) => { if (inspectOn) inspectAt(e); });
  mapEl.addEventListener('pointerleave', inspectClear);
}
// ---- Measure: click points on the Output → great-circle length --------------------------------
// Points are kept as lng/lat (inverted through the render's own projection, so tilted satellite
// views measure true ground distance). The line just joins the markers on screen; the length is
// the great-circle distance between their lng/lat. It sits in the zoom layer so it pans/zooms
// with the map; #measure never reaches a
// download (cleanFullClone strips it). Pan/zoom keeps working — a drag isn't a click.
let measureOn = false, measurePts = [], measureHover = null, measureDone = false;
const MEASURE_KM = 6371.0088;
const measureSvg = () => [...$('map').querySelectorAll('svg')].find((s) => s.projection && s.getClientRects().length);
function measureLngLat(e) {
  const svg = measureSvg(); if (!svg) return null;
  const layer = svg.querySelector(':scope > .zoom-layer') || svg;
  const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
  const p = pt.matrixTransform(layer.getScreenCTM().inverse());
  const ll = svg.projection.invert && svg.projection.invert([p.x, p.y]);
  return ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1]) ? ll : null;
}
function measureFmt(km) {
  const mi = km / 1.609344;
  const f = (v) => v >= 100 ? Math.round(v).toLocaleString() : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return f(km) + ' km · ' + f(mi) + ' mi';
}
function measureDraw() {
  const svg = measureSvg(); if (!svg) return;
  const layer = svg.querySelector(':scope > .zoom-layer') || svg;
  let g = layer.querySelector(':scope > #measure');
  const pts = measureDone || !measureHover ? measurePts : [...measurePts, measureHover];
  if (!measureOn || !pts.length) { g?.remove(); measureBadge(null); return; }
  if (!g) { g = document.createElementNS('http://www.w3.org/2000/svg', 'g'); g.id = 'measure'; }
  layer.appendChild(g);   // keep it on top
  const k = d3.zoomTransform(svg).k || 1;
  const xy = pts.map((p) => svg.projection(p)).filter(Boolean);
  const line = xy.length > 1 ? 'M' + xy.map(([x, y]) => x + ',' + y).join('L') : null;
  g.innerHTML =
    (line ? '<path class="m-halo" d="' + line + '"/><path class="m-line" d="' + line + '"/>' : '') +
    xy.map(([x, y]) => '<circle class="m-pt" cx="' + x + '" cy="' + y + '" r="' + (3.5 / k) + '"/>').join('');
  let km = 0; for (let i = 1; i < pts.length; i++) km += d3.geoDistance(pts[i - 1], pts[i]) * MEASURE_KM;
  measureBadge(pts.length > 1 ? measureFmt(km) + (pts.length > 2 ? '  (' + (pts.length - 1) + ' legs)' : '') : 'click the next point');
}
function measureBadge(text) {
  let b = $('measureBadge');
  if (!text) { if (b) b.hidden = true; return; }
  if (!b) { b = document.createElement('div'); b.id = 'measureBadge'; $('mapscroll').parentNode.append(b); }
  b.textContent = text; b.hidden = false;
}
function measureReset() { measurePts = []; measureHover = null; measureDone = false; measureDraw(); }
function measureToggle(on) {
  measureOn = on;
  $('measureView')?.classList.toggle('on', on);
  mapEl.classList.toggle('measuring', on);
  if (on && inspectOn) $('inspectView')?.click();   // one tool at a time
  measureReset();
}
{
  $('measureView')?.addEventListener('click', () => measureToggle(!measureOn));
  $('inspectView')?.addEventListener('click', () => { if (inspectOn && measureOn) measureToggle(false); });
  mapEl.addEventListener('click', (e) => {
    if (!measureOn || e.detail > 1) return;
    const ll = measureLngLat(e); if (!ll) return;
    if (measureDone) { measurePts = []; measureDone = false; }
    measurePts.push(ll); measureDraw();
  });
  mapEl.addEventListener('dblclick', (e) => { if (measureOn) { e.preventDefault(); measureDone = true; measureHover = null; measureDraw(); } });
  mapEl.addEventListener('pointermove', (e) => {
    if (!measureOn || measureDone || !measurePts.length) return;
    measureHover = measureLngLat(e); measureDraw();
  });
  document.addEventListener('keydown', (e) => {
    if (!measureOn || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'Escape') measureReset();
    else if (e.key === 'Enter' && !e.ctrlKey) { measureDone = true; measureHover = null; measureDraw(); }
    else if (e.key === 'Backspace') { e.preventDefault(); measurePts.pop(); measureDone = false; measureDraw(); }
  });
}
// ---- Preview: the current export alone, full screen, on a darkened page --------------------------
// A clean clone (zoom/pan undone, frame clip re-tightened — what Download saves), scaled to fit.
function openPreview() {
  const live = [...$('map').querySelectorAll('svg')].find((s) => s.getClientRects().length && s.projection !== undefined)
    || $('map').querySelector('svg');
  if (!live) return;
  const clone = cleanFullClone(live);
  clone.querySelectorAll('#callouts .handle').forEach((el) => el.remove());
  let m = $('previewModal');
  if (!m) {
    m = document.createElement('div'); m.id = 'previewModal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('.pv-close')) closePreview(); });
    document.body.append(m);
  }
  const w = live.getAttribute('width'), h = live.getAttribute('height');
  clone.removeAttribute('style');
  clone.setAttribute('width', w); clone.setAttribute('height', h);
  const frame = document.createElement('div'); frame.className = 'pv-frame'; frame.append(clone);
  const close = Object.assign(document.createElement('button'), { className: 'pv-close', type: 'button', title: 'Close (Esc)', textContent: '×' });
  const dims = Object.assign(document.createElement('div'), { className: 'pv-dims', textContent: w + ' × ' + h + ' px' });
  m.replaceChildren(dims, close, frame);
  m.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  close.focus();
}
function closePreview() {
  const m = $('previewModal'); if (!m || m.hidden) return;
  m.hidden = true; m.replaceChildren();
  document.documentElement.style.overflow = '';
}
$('previewView')?.addEventListener('click', openPreview);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePreview(); });

function attachOutputZoom(svg) {
  const NS = 'http://www.w3.org/2000/svg';
  const layer = document.createElementNS(NS, 'g');
  layer.setAttribute('class', 'zoom-layer');
  while (svg.firstChild) layer.appendChild(svg.firstChild);
  svg.appendChild(layer);
  // Stash each chrome group's authored transform so we can counter the zoom to keep it in place.
  const fixed = FIXED_IDS.map((id) => layer.querySelector('#' + id)).filter(Boolean)
    .map((el) => { const orig = el.getAttribute('transform') || ''; el.setAttribute('data-orig-transform', orig); return { el, orig }; });
  const sel = d3.select(svg), g = d3.select(layer);
  outZoom = d3.zoom().scaleExtent([1, 40]).on('zoom', () => {
    const t = d3.event.transform;
    lastZoom = t; // preserve across re-renders
    g.attr('transform', t);
    // Counter-transform chrome: effective = T · (T⁻¹ · orig) = orig, so it stays put on screen.
    const inv = 'translate(' + (-t.x / t.k) + ',' + (-t.y / t.k) + ') scale(' + (1 / t.k) + ') ';
    for (const f of fixed) f.el.setAttribute('transform', inv + f.orig);
    svg.classList.toggle('zoomed', t.k > 1);
    setZoomPct(t.k);
    // Reset view goes orange while the output is zoomed or panned off the fitted view.
    $('resetView')?.classList.toggle('off-fit', t.k !== 1 || Math.abs(t.x) > 0.5 || Math.abs(t.y) > 0.5);
    if (measureOn) measureDraw();
  });
  { const base = outZoom.filter(); outZoom.filter(function () { return !inspectOn && base.apply(this, arguments); }); } // Inspect pauses pan/zoom (annotation handles stop their own events, so edit mode doesn't need to)
  svg.__outZoom = outZoom; // stash per-svg so Reset view acts on THIS frame's zoom, not just the last-attached one
  sel.call(outZoom).on('dblclick.zoom', null); // no double-click zoom (it fights inspection)
  // Restore the prior zoom if the user was zoomed in; a fresh/fit view starts at identity.
  const start = (lastZoom && lastZoom.k > 1)
    ? d3.zoomIdentity.translate(lastZoom.x, lastZoom.y).scale(lastZoom.k) : d3.zoomIdentity;
  sel.call(outZoom.transform, start);
  setZoomPct(start.k);
  { const rv = $('resetView'); if (rv) rv.style.display = 'inline-flex'; }
  { const iv = $('inspectView'); if (iv) iv.style.display = 'inline-flex'; }
  { const mv = $('measureView'); if (mv) mv.style.display = 'inline-flex'; }
  { const pv = $('previewView'); if (pv) pv.style.display = 'inline-flex'; }
  syncViewAction();
  { const zp = $('zoomPct'); if (zp) zp.style.display = 'inline-block'; }
}
// The view-action button next to Reset view. Flat/regional: "Crop to view" writes the zoom rect as
// the [W,S,E,N] extent. Satellite is camera-driven (no bbox), so there it's "Update Atlas" — push
// the output view back to the Atlas (MapLibre) camera and let it re-derive the satellite export.
function syncViewAction() {
  const sat = $('proj').value === 'geoSatellite';
  { const po = $('projOverWrap'); if (po) { po.style.display = 'none'; const pm = $('projOverMenu'); if (pm) pm.hidden = true; } } // fine-tune disabled
  const cv = $('cropView'); if (!cv) return;
  cv.style.display = 'inline-flex';
  cv.textContent = sat ? 'Update Atlas' : 'Crop to view';
  cv.title = sat
    ? 'Move the Atlas camera to the current output view and re-render the satellite export'
    : 'Set the project extent to the current zoomed view and re-render (recomputes scalebar/inset/north)';
}
function setZoomPct(k) {
  const zp = $('zoomPct'); if (zp) zp.textContent = Math.round(k * 100) + '%';
}
// Crop to view: turn the current output zoom rectangle into a geographic bbox (by inverse-
// projecting the visible artboard corners through the render's own projection), write it back into
// the project extent, reset the zoom, and re-render — so the scalebar/inset/north-arrow recompute
// for the new extent instead of being a stale screenshot.
// Satellite: push the current output zoom to the Atlas (MapLibre pane) camera. The visible-rect
// centre inverse-projects to a lng/lat; the output zoom factor k adds log2(k) to the pane zoom.
// The pane moves, reports its camera back, and the satellite export re-derives (existing flow).
function updateAtlas() {
  const svg = $('map') && $('map').querySelector('svg');
  if (!svg || !outZoom) return;
  const t = d3.zoomTransform(svg);
  if (t.k <= 1.001) { note('zoom in first, then Update Atlas'); return; }
  const proj = svg.projection;
  if (!proj || typeof proj.invert !== 'function') { note('can’t update Atlas from this view'); return; }
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const cx = (-t.x / t.k) + (W / t.k) / 2, cy = (-t.y / t.k) + (H / t.k) / 2; // visible-rect centre (px)
  const ll = proj.invert([cx, cy]);
  if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) { note('couldn’t read a centre from this view'); return; }
  const c = satelliteCam || {};
  const newZoom = (Number.isFinite(c.zoom) ? c.zoom : 3) + Math.log2(t.k);
  openNavPane();
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaSetCamera',
    lng: ll[0], lat: ll[1], zoom: newZoom, pitch: c.pitch, bearing: c.bearing }, '*');
  lastZoom = null;
  d3.select(svg).call(outZoom.transform, d3.zoomIdentity); // the pane's camera post drives the re-render
  note('updating Atlas view…');
}
function cropToView() {
  const svg = $('map') && $('map').querySelector('svg');
  if (!svg || !outZoom) return;
  if ($('proj').value === 'geoSatellite') { updateAtlas(); return; } // satellite has no bbox → move the Atlas camera
  const t = d3.zoomTransform(svg);
  if (t.k <= 1.001) { note('zoom in first, then Crop to view'); return; }
  const proj = svg.projection;
  if (!proj || typeof proj.invert !== 'function') { note('this projection can’t be cropped to view'); return; }
  const W = +svg.getAttribute('width'), H = +svg.getAttribute('height');
  const vx = -t.x / t.k, vy = -t.y / t.k, vw = W / t.k, vh = H / t.k;
  // Sample the visible rect edges (not just corners) so curved projections still bound correctly.
  const N = 8, pts = [];
  for (let i = 0; i <= N; i++) {
    const fx = vx + (vw * i) / N, fy = vy + (vh * i) / N;
    pts.push([fx, vy], [fx, vy + vh], [vx, fy], [vx + vw, fy]);
  }
  let W_ = Infinity, S_ = Infinity, E_ = -Infinity, N_ = -Infinity;
  for (const p of pts) {
    const ll = proj.invert(p);
    if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue;
    W_ = Math.min(W_, ll[0]); E_ = Math.max(E_, ll[0]);
    S_ = Math.min(S_, ll[1]); N_ = Math.max(N_, ll[1]);
  }
  if (!Number.isFinite(W_) || !Number.isFinite(S_)) { note('couldn’t derive an extent from this view'); return; }
  $('bbox').value = [W_, S_, E_, N_].map((v) => +v.toFixed(4)).join(', ');
  bboxShown = true; $('bboxShow').classList.add('on'); postShowBbox(); // the crop IS the drawn extent
  lastZoom = null; // reframing to the crop → the re-render should sit at fit, not the old zoom
  d3.select(svg).call(outZoom.transform, d3.zoomIdentity);
  render();
}
// One frame's saved Map-panel state → engine settings (shared panels read live). Used by the
// render loop and by PNG + world file, which passes a copy with proj: 'geoMercator'.
async function frameRenderCfg(fm) {
  const fp = buildProject(fm);          // project for THIS frame + the shared panels
  // fgb mode (prod / ?fgb): stream just this frame's extent. Satellite waits for the pane bbox.
  if (USE_FGB) {
    const extent = (fp.view && fp.view.bbox) || paneBounds;
    if (fm.proj === 'geoSatellite' && !extent) {
      note('waiting for map…'); openNavPane(); await paneReady;
    }
    note('streaming basemap…');
    await loadBasemapData('./mapa/files/', extent || satelliteBbox(fm), true, enabledBasemapFiles());
  }
  // Merge loaded custom datasets (Data panel, shared) as poly layers on a CLONE.
  let toRender = fp;
  // `d.geometry` is null for a pointer that hasn't resolved (or is missing) — skip those.
  const dataOn = $('showCustom')?.checked !== false;
  // Top of the Data list draws on top: SVG paints later elements over earlier, so hand the
  // layers over bottom row first (reversed list order).
  const shownCustom = dataOn ? customData.filter((d) => d.kind !== 'points' && d.show && d.geometry).reverse() : [];
  if (shownCustom.length) {
    const base = fp.polys?.data || [];
    toRender = { ...fp, polys: { ...(fp.polys || {}), show: true,
      data: [...base, ...shownCustom.flatMap((d) => datasetEntries(d))] } };
  }
  // Reversed per group so the FIRST CSV line draws on top (SVG paints later elements over earlier).
  // Render-only — the saved file keeps CSV order so a reload gives back the same text.
  // Groups reversed too, so the top POI group draws over the ones below it.
  const shownPoints = dataOn ? customData.filter((d) => d.kind === 'points' && d.show).reverse().flatMap((g) => groupPointEntries(g, true).reverse()) : [];
  if (shownPoints.length) {
    const base = fp.points?.data || [];
    toRender = { ...toRender, points: { ...(fp.points || {}), show: true, data: [...base, ...shownPoints] } };
  }
  const resolved = await resolveRaster(await resolvePolys(toRender));
  const cfg = atlasProjectToMapaSettings(resolved, {});
  cfg.patterns = { ...(cfg.patterns || {}), sizes: PATTERN_SIZES };
  // Annotations attached to a Data layer: hand the engine that layer's (filtered) features as
  // the annotation's data — d3-annotation's accessors place it on their centre. Render-only:
  // the project file keeps just the pointer (anchor: { source, filter }).
  for (const it of cfg.layer?.annotations?.data || []) {
    const src = project.annotations?.data?.[it.src];
    const L = src && src.anchor && anchorLayer(src.anchor);
    if (L) { const fc = drawnFC(L); if (fc.features.length) it.feature = fc; }
  }
  if (annoEditOn && cfg.layer?.annotations) cfg.layer.annotations.editMode = true;
  return cfg;
}
// A clone of the rendered SVG reset to the full artboard at fit: drop the interactive zoom
// transform and restore each chrome overlay to its authored corner position. The basis for every
// export (full stack + per-layer).
function cleanFullClone(svg) {
  const clean = svg.cloneNode(true);
  const zl = clean.querySelector('.zoom-layer'); if (zl) zl.removeAttribute('transform');
  clean.querySelectorAll('[data-orig-transform]').forEach((el) => {
    const o = el.getAttribute('data-orig-transform');
    if (o) el.setAttribute('transform', o); else el.removeAttribute('transform');
    el.removeAttribute('data-orig-transform');
  });
  clean.setAttribute('viewBox', '0 0 ' + svg.getAttribute('width') + ' ' + svg.getAttribute('height'));
  // The preview may have expanded the frame clip for buffer panning — re-tighten it to width×height
  // so the downloaded crop is exactly the frame (the bleed stays in the file, clipped, "to release").
  const cr = clean.querySelector('clipPath[id^="frame-clip-"] rect');
  if (cr) { cr.setAttribute('x', 0); cr.setAttribute('y', 0);
    cr.setAttribute('width', svg.getAttribute('width')); cr.setAttribute('height', svg.getAttribute('height')); }
  clean.querySelectorAll('#callouts .handle').forEach((el) => el.remove()); // edit-mode drag handles
  clean.querySelectorAll('#measure').forEach((el) => el.remove());          // measure line (view-only)
  dedupeIds(clean);
  portableSvg(clean);
  return clean;
}
// Make an export open the same in Figma / Illustrator as in the browser:
//  · images: one proper xlink:href (+ href). d3's attr("xlink:href") came out as `ns1:href`,
//    which Figma doesn't read — the tile layers imported empty.
//  · text: em offsets (d3 axis/scalebar: dy="0.71em", y="1.3em") → px from the font size;
//    Figma placed em-positioned labels wrongly, throwing the scalebar off.
//  · defs: drop gradients/masks/patterns/filters nothing references (the engine writes its
//    whole catalogue into every SVG; 100%-sized mask rects confused importers).
function portableSvg(root) {
  nameLayers(root);
  const XL = 'http://www.w3.org/1999/xlink';
  root.querySelectorAll('image').forEach((im) => {
    const v = im.getAttribute('href') || im.getAttributeNS(XL, 'href') || '';
    for (const a of [...im.attributes]) if (a.localName === 'href') im.removeAttributeNode(a);
    if (v) { im.setAttributeNS(XL, 'xlink:href', v); im.setAttribute('href', v); }
  });
  const fontPx = (el) => {
    for (let n = el; n && n.getAttribute; n = n.parentNode) {
      const f = parseFloat(n.getAttribute('font-size'));
      if (Number.isFinite(f)) return f;
    }
    return 16;
  };
  root.querySelectorAll('text, tspan').forEach((t) => {
    for (const a of ['x', 'y', 'dx', 'dy']) {
      const v = t.getAttribute(a);
      if (v && /^-?[\d.]+em$/.test(v.trim())) t.setAttribute(a, +(parseFloat(v) * fontPx(t)).toFixed(2));
    }
  });
  const defs = [...root.querySelectorAll('defs > *')].filter((d) => d.id);
  if (defs.length) {
    const refsIn = (el) => {
      const out = new Set(), txt = el.outerHTML;
      for (const m of txt.matchAll(/url\(#([^)]+)\)|href="#([^"]+)"/g)) out.add(m[1] || m[2]);
      return out;
    };
    const content = root.cloneNode(true); content.querySelectorAll('defs').forEach((d) => d.remove());
    const keep = refsIn(content), byId = new Map(defs.map((d) => [d.id, d]));
    const queue = [...keep];
    while (queue.length) {   // defs can reference other defs (a mask's gradient, a pattern's image)
      const d = byId.get(queue.pop()); if (!d) continue;
      for (const r of refsIn(d)) if (!keep.has(r)) { keep.add(r); queue.push(r); }
    }
    defs.forEach((d) => { if (!keep.has(d.id)) d.remove(); });
  }
  return root;
}
// Figma and Illustrator name layers from the `id`. Give the export readable layer names:
//  · unwrap the Output pane's pan/zoom `.zoom-layer` group (Figma showed one unnamed Group on top)
//  · data layers: `<g class="ds-N">` had no id → the layer's filter term / name from the Data panel
//  · raster: `tiles-<render-uid>-<row id>` / `image-N` → the row's name from the Raster panel
//  · the background rect and the inset's inner groups get plain names
// Ids stay unique (suffix -2, -3…) and never touch defs that something references.
function nameLayers(root) {
  const zl = root.querySelector(':scope > g.zoom-layer');
  if (zl) { while (zl.firstChild) root.insertBefore(zl.firstChild, zl); zl.remove(); }
  const used = new Set([...root.querySelectorAll('[id]')].map((e) => e.id));
  const slug = (t) => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/[^\w\s-]+/g, ' ').trim().replace(/\s+/g, '-').toLowerCase() || 'layer';
  const setId = (el, name) => {
    if (!el) return;
    let base = slug(name), id = base, n = 2;
    used.delete(el.id);
    while (used.has(id)) id = base + '-' + n++;
    el.id = id; used.add(id);
  };
  const bg = root.querySelector(':scope > rect, :scope > path');
  if (bg && !bg.id) setId(bg, 'background');
  root.querySelectorAll('g[class*="ds-"]').forEach((g) => {
    const m = /(?:^|\s)ds-(\d+)/.exec(g.getAttribute('class') || ''); if (!m || (g.id && !/^ds-/.test(g.id))) return;
    const d = customData.find((x) => x.id === +m[1]);
    setId(g, d ? (filterTerm(d) || d.name) : 'data-' + m[1]);
  });
  root.querySelectorAll('g[id^="tiles-"]').forEach((g) => {
    const m = /^tiles-[a-z0-9]+-(.+)$/.exec(g.id); if (!m) return;
    const r = rasterData.find((x) => x.id === m[1]);
    setId(g, r ? (r.name || r.id) : m[1]);
  });
  root.querySelectorAll('image[data-raster-order]').forEach((im) => {
    const r = rasterData.find((x) => x.id === im.id);
    if (r) setId(im, r.name || r.id);
  });
  const ins = root.querySelector('#inset');
  if (ins) {
    const map = ins.querySelector(':scope > g:not([id])'); if (map) setId(map, 'inset-map');
    const fr = ins.querySelector(':scope > rect:not([id]), :scope > circle:not([id]), :scope > path:not([id])'); if (fr) setId(fr, 'inset-frame');
  }
  const sb = root.querySelector('#scalebar > g:not([id])'); if (sb) setId(sb, 'scalebar-bars');
}
// Duplicate ids are invalid SVG — the basemap's <g id="ocean"> collided with the "ocean" fill
// <pattern> in defs, and Illustrator mangled/dropped the ocean. Keep the layer groups' ids (they
// become Illustrator layer names) and rename the OTHER element (pattern, gradient, …) to
// "<id>-<tag>", updating every url(#id) / href="#id" that points at it.
function dedupeIds(root) {
  const byId = new Map();
  root.querySelectorAll('[id]').forEach((el) => { const id = el.id; if (!byId.has(id)) byId.set(id, []); byId.get(id).push(el); });
  for (const [id, els] of byId) {
    if (els.length < 2) continue;
    const keep = els.find((el) => el.tagName.toLowerCase() === 'g') || els[0];
    for (const el of els) {
      if (el === keep) continue;
      let next = id + '-' + el.tagName.toLowerCase(), n = 2;
      while (root.querySelector('[id="' + next + '"]')) next = id + '-' + el.tagName.toLowerCase() + '-' + n++;
      el.id = next;
      // Only defs (patterns, gradients, clips…) are referenced by url(#…) / href — repoint those.
      if (el.closest('defs')) {
        const from = 'url(#' + id + ')', to = 'url(#' + next + ')';
        root.querySelectorAll('*').forEach((x) => {
          for (const at of ['fill', 'stroke', 'clip-path', 'mask', 'filter', 'style']) {
            const v = x.getAttribute(at); if (v && v.includes(from)) x.setAttribute(at, v.split(from).join(to));
          }
          for (const at of ['href', 'xlink:href']) if (x.getAttribute(at) === '#' + id) x.setAttribute(at, '#' + next);
        });
      }
    }
  }
}
// Reduce a clone to a single layer: keep <defs> (patterns/clips/filters) and the #content wrapper
// (so the frame clip still applies), drop the painted background (transparent for compositing),
// and remove every content group except the target.
function stripToLayer(clone, targetId) {
  const layer = clone.querySelector('.zoom-layer') || clone;
  Array.from(layer.children).forEach((ch) => { // drop the background rect/path
    if (ch.tagName === 'rect' || ch.tagName === 'path') ch.remove();
  });
  const content = clone.querySelector('#content');
  if (content) Array.from(content.children).forEach((g) => { if (g.id !== targetId) g.remove(); });
}
// Keep only one group (and its ancestors), wherever it sits — for groups outside #content, like
// the annotation callouts. <defs>/<style> stay so markers, filters and fonts still resolve.
function stripToOnly(clone, id) {
  const keep = clone.querySelector('#' + id); if (!keep) return false;
  for (let el = keep; el && el !== clone; el = el.parentNode) {
    for (const sib of [...el.parentNode.children]) {
      if (sib !== el && !/^(defs|style)$/i.test(sib.tagName)) sib.remove();
    }
  }
  return true;
}
// id → { suffix, show } for the per-layer exports. `show` is the section's eye-toggle checkbox —
// a layer is only offered in the Download menu when its eye is on (visible).
// Listed top-down, in the order they stack on the map.
const LAYER_TARGETS = [
  { id: 'callouts', suffix: 'annotations', label: 'Annotations', show: 'showAnno', only: true },
  { id: 'inset', suffix: 'inset', label: 'Inset', show: 'showInset' },
  { id: 'layers', suffix: 'data', label: 'Data', show: 'showCustom' },
  { id: 'basemap', suffix: 'basemap', label: 'Basemap', show: 'showBasemap' },
  { id: 'tilelayer', suffix: 'raster', label: 'Raster', show: 'showRaster' },
];

// Snap the output zoom/pan back to fit.
function resetOutputView() {
  const svg = $('map') && $('map').querySelector('svg');
  const z = svg && (svg.__outZoom || outZoom); // the zoom bound to THIS svg (frame tabs each have their own)
  if (svg && z) d3.select(svg).transition().duration(200).call(z.transform, d3.zoomIdentity);
}

function onEdit(e) {
  if (e?.target?.id === 'live') return;   // toggling live update isn't an edit — don't render
  if (e?.target?.closest?.('#boardFlyoutWrap, .board-empty')) return;   // board chrome, not map settings
  updateLiveAvailability();
  updateOutDims();
  syncRenderButtons();
  syncInsetFollow(); // keep the inset centre tracking the map view (unless locked)
  if (bboxShown) postShowBbox(); // keep the extent rectangle updating with the bbox until locked
  requestRender();
}

// Route Board's "content changed" hook through the editor's render cycle. Board calls refresh()
// only on genuine content changes -- setBoardState() and full panel (re)builds -- NOT on moves,
// swaps, docks or resizes (those pass { content: false }), so this won't re-render the map just
// because a tile was dragged. Keep Board's default per-panel body redraw, then kick the same
// debounced, live-gated render the field edits use. This makes configureBoard the single spine
// that any future setBoardState()-driven panel feeds into.
{ const _defaultRefresh = BOARD_HOOKS.refresh.bind(BOARD_HOOKS);
  configureBoard({ refresh() { _defaultRefresh(); requestRender(); } }); }

$('mapRender').addEventListener('click', render);
// Render shortcut: Ctrl+Enter. The field being typed in gets its change event first, so the
// render sees the value. The Atlas pane (iframe) forwards the same key.
const isRenderKey = (e) => e.key === 'Enter' && e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey;
function renderFromKey() {
  const a = document.activeElement;
  if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT'))
    a.dispatchEvent(new Event('change', { bubbles: true }));
  render();
}
// App tooltip: any element with a title shows a styled tip instead of the slow native one.
// On hover the title is parked in data-tip (so the browser doesn't show its own) and put back
// on leave, so code that reads or rewrites .title keeps working.
{
  const tipEl = document.createElement('div'); tipEl.id = 'appTip'; document.body.appendChild(tipEl);
  let cur = null, timer = 0;
  const hide = () => {
    clearTimeout(timer); tipEl.classList.remove('on');
    if (cur) { if (cur.dataset.tip != null && !cur.hasAttribute('title')) cur.setAttribute('title', cur.dataset.tip); delete cur.dataset.tip; cur = null; }
  };
  const place = (el) => {
    const r = el.getBoundingClientRect(), tr = tipEl.getBoundingClientRect();
    let x = Math.min(Math.max(8, r.left + r.width / 2 - tr.width / 2), innerWidth - tr.width - 8);
    let y = r.bottom + 6; if (y + tr.height > innerHeight - 8) y = r.top - tr.height - 6;
    tipEl.style.left = x + 'px'; tipEl.style.top = Math.max(8, y) + 'px';
  };
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest?.('[title]');
    if (!el || el === cur) return;
    hide();
    const text = el.getAttribute('title'); if (!text) return;
    cur = el; el.dataset.tip = text; el.removeAttribute('title');
    timer = setTimeout(() => { if (cur !== el) return; tipEl.textContent = text; tipEl.classList.add('on'); place(el); }, 250);
  });
  document.addEventListener('mouseout', (e) => { if (cur && !cur.contains(e.relatedTarget)) hide(); });
  document.addEventListener('mousedown', hide, true);
  document.addEventListener('scroll', hide, true);
}
document.addEventListener('keydown', (e) => {
  if (!isRenderKey(e) || e.repeat) return;
  e.preventDefault();
  renderFromKey();
});
{ const rv = $('resetView'); if (rv) rv.addEventListener('click', resetOutputView); }
{ const pr = $('panelRender'); if (pr) pr.addEventListener('click', render); } // the standalone Render panel
{ const cv = $('cropView'); if (cv) cv.addEventListener('click', cropToView); }
// Fine-tune control: toggle the popover; slider↔number pairs stay synced; edits re-render (debounced)
// and highlight the button when any override is active. Close on outside click.
{ const pb = $('projOverBtn'), menu = $('projOverMenu');
  if (pb && menu) {
    pb.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#projOverWrap')) menu.hidden = true; });
    const onTune = () => {
      pb.classList.toggle('active', Object.keys(projOverrides()).length > 0);
      requestRender();
    };
    // Keep each slider and its number box in lockstep, then re-render.
    const pair = (rangeId, numId) => {
      const r = $(rangeId), nEl = $(numId); if (!r || !nEl) return;
      r.addEventListener('input', () => { nEl.value = r.value; onTune(); });
      nEl.addEventListener('input', () => { if (nEl.value !== '') r.value = nEl.value; onTune(); });
    };
    pair('ovTiltR', 'ovTilt'); pair('ovFovR', 'ovFov'); pair('ovRotR', 'ovRot');
    { const a = $('ovAlt'); if (a) a.addEventListener('input', onTune); }
    { const rb = $('ovReset'); if (rb) rb.addEventListener('click', () => {
      ['ovTilt', 'ovFov', 'ovRot', 'ovAlt', 'ovTiltR', 'ovFovR', 'ovRotR'].forEach((id) => { const el = $(id); if (el) el.value = ''; });
      onTune();
    }); }
  } }
// Export split button: the ▾ arrow toggles the alternatives menu; close on outside-click (the main
// "Download SVG" button and each menu item do their own download, set per-render in render()).
{ const arrow = $('dlArrow'), menu = $('dlMenu');
  if (arrow && menu) {
    arrow.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#download')) menu.hidden = true; });
  } }
// #live lives in the output pane footer, outside #panel, so the panel-wide change listener
// never fires for it — wire it directly so toggling shows/hides the Render buttons. Switching
// live on doesn't render by itself; the next edit does.
$('live').addEventListener('change', () => { syncRenderButtons(); updateLiveAvailability(); });
{ const ph = $('mapPlaceholder'); if (ph) ph.addEventListener('click', render); }
$('mlRender').addEventListener('click', render);
$('downloadJson').addEventListener('click', () => {
  readPanel();
  project.frames = serializeFrames();
  // A frame following the Atlas view has a blank bbox — saved as-is it reloads to wherever the
  // pane happens to open, so the extent you were looking at was lost. Freeze it into the file.
  const live = Array.isArray(paneBounds) && paneBounds.every(Number.isFinite)
    ? paneBounds.map((v) => +(+v).toFixed(4)) : null;
  for (const f of project.frames) {
    // A copy: serializeFrames shares each frame's live map object, and the session must keep following.
    if (f.map && !(f.map.bbox || '').trim() && f.map.trackView !== false && live) f.map = { ...f.map, bbox: live.join(', ') };
  }
  if (live && project.view && !($('bbox').value || '').trim() && $('trackView')?.checked !== false) project.view.bbox = live;
  const a = document.createElement('a');
  // Data goes out as POINTERS (see projectForSave) — the geometry stays in the repo, not the file.
  a.href = URL.createObjectURL(new Blob([JSON.stringify(projectForSave(), null, 2)], { type: 'application/json' }));
  a.download = projectName + '.json'; a.click();
});

// ---- MapLibre nav pane: an embedded sandbox (?mapa mode) showing the project's data layers ---
// The pane IS the sandbox embed — it renders the same points/polys/annotations, stays navigable
// (?mapa skips the project's view/lock/inset/overlays), and is framed by the current bbox.
let navStyle = ATLAS_STYLE; // Atlas basemap — set in src/mapa/js/basemap-layers.js (name, style.json or .pmtiles)
let navInited = false;
let navViewBbox = null; // the pane's current view, reported by the sandbox — kept across reloads
let paneBounds = null;  // the pane's CURRENT view bounds (updated on every move, used as the extent)
let resizingPane = false; // true while dragging the splitter — suppresses bbox writes + render
let bboxShown = false;    // when on, the pane draws the current bbox as a dashed rectangle overlay
let satelliteCam = null;  // last MapLibre camera pose posted by the nav pane (drives geoSatellite)

// Build a d3.geoSatellite export projection from a MapLibre camera pose. Returns null
// unless the projection dropdown is on geoSatellite. The nav pane's MapLibre camera is
// the source of truth (Option B): center->rotate, bearing->roll, pitch->tilt, camera
// altitude->distance (Snyder P = 1 + alt/R), zoom->scale. It's inspiration-level, not a
// 1:1 port — the two camera models differ, so eyeball and nudge if needed.
const EARTH_RADIUS_KM = 6371;
// fieldOfView (deg): mapa-side, mirrors MapLibre's default vertical FOV.
const SAT_FOV_DEG = 36.87;
// Seed the nav pane's zoom from the authored satellite altitude (the primitive schema carries no
// zoom). MapLibre: cameraToCenterDistance = 0.5*h/tan(0.5*fov); altitude = camDist_px * m/px *
// cos(pitch). Invert for zoom. Pane height is unknown at seed time, so assume ~700px — this only
// frames the nav preview; the D3 export is driven by the primitives, not this zoom.
function paneZoomFromAltitude(altKm, lat, pitch) {
  if (!(altKm > 0)) return null;
  const h = 700, fov = 0.6435011; // MapLibre default vertical fov (rad)
  const camPx = 0.5 * h / Math.tan(fov / 2);
  const cosLat = Math.cos((lat || 0) * Math.PI / 180);
  const cosPitch = Math.cos((pitch || 0) * Math.PI / 180);
  const two = camPx * 40075016.686 * cosLat * cosPitch / (512 * altKm * 1000);
  return two > 0 ? Math.log2(two) : null;
}
// ---- geoSatellite via @jjhembd/tilting-the-satellite PRIMITIVES ----------------------------
// The projection is defined by 6 primitives: longitude/latitude (sub-satellite / nadir point),
// altitude (km), rotation, tilt, fieldOfView (deg). scale/yShift/distance/translate/preclip are
// DERIVED here exactly like the notebook — so authoring the primitives reproduces it verbatim.
// Authored in the project file (satParams); the pane can also derive them (camToSatParams) as a
// convenience, but the authored primitives are the source of truth.
let satParams = null;
function buildSatelliteFromParams(p) {
  const degrees = 180 / Math.PI;
  const numPixelsY = num($('h').value) || num($('w').value) || 600; // export height
  const width = num($('w').value) || 1000;
  const R = EARTH_RADIUS_KM;
  const altitude = (Number.isFinite(p.altitude) && p.altitude > 0) ? p.altitude : 1024;
  const tilt = Math.max(0, Math.min(85, Number.isFinite(p.tilt) ? p.tilt : 0));
  const rotation = Number.isFinite(p.rotation) ? p.rotation : 0;
  const fieldOfView = (Number.isFinite(p.fieldOfView) && p.fieldOfView > 0) ? p.fieldOfView : SAT_FOV_DEG;
  const lng = Number.isFinite(p.longitude) ? p.longitude : 0;
  const lat = Number.isFinite(p.latitude) ? p.latitude : 0;
  const tiltRad = tilt / degrees, fovRad = fieldOfView / degrees;
  const dZ = altitude * Math.cos(tiltRad), dY = altitude * Math.sin(tiltRad);
  const visibleYextent = 2 * dZ * Math.tan(0.5 * fovRad); // authored (nadir) framing → yShift
  // Scale: explicit p.scale wins. For the pane crosswalk (centerIsLookAt), scale off the SLANT range
  // to the look-at (altitude / cos(tilt)) — the pane already bakes cos(pitch) into altitude, so this
  // cancels it and keeps the centre coverage CONSTANT with tilt (no runaway zoom-in). Authored
  // (nadir) framing keeps the notebook's dZ = altitude·cos(tilt).
  const cosT = Math.max(0.0871, Math.cos(tiltRad)); // clamp at ~85° so slant doesn't diverge
  const scaleRefDist = p.centerIsLookAt ? (altitude / cosT) : dZ;
  const scaleYextent = 2 * scaleRefDist * Math.tan(0.5 * fovRad);
  const scale = (Number.isFinite(p.scale) && p.scale > 0) ? p.scale : R * numPixelsY / scaleYextent;
  // Two framings: authored notebook primitives give the SUB-SATELLITE point → yShift places the
  // look-at at centre. The pane crosswalk gives the LOOK-AT directly (centerIsLookAt) → no yShift;
  // geoSatellite pins that point to translate and tilts around it, exactly like MapLibre's camera.
  const yShift = p.centerIsLookAt ? 0 : (dY * numPixelsY / visibleYextent);
  const distance = Math.max(1.0001, 1 + altitude / R);
  return {
    proj: 'geoSatellite', type: 'custom', fit: 'none',
    scale, translate: [width / 2, yShift + numPixelsY / 2], center: [0, 0],
    rotate: [-lng, -lat, rotation], tilt, distance, fieldOfView, precision: 0.1,
    _params: { longitude: lng, latitude: lat, altitude, rotation, tilt, fieldOfView }
  };
}
// Crosswalk: MapLibre pane camera → geoSatellite. Use the LOOK-AT (getCenter) as the projection
// centre (centerIsLookAt → no yShift), so the pane's centre lands at the export centre and the
// view tilts around it — matching MapLibre. Avoids the globe's broken free-camera nadir entirely.
// pitch→tilt, bearing→rotation, altitude→altitude; fov from the slider (the zoom-match knob).
function camToSatParams() {
  const c = satelliteCam || {};
  const fovEl = num($('satFov')?.value);
  const fov = (Number.isFinite(fovEl) && fovEl > 0) ? fovEl : SAT_FOV_DEG;
  // Use the LOOK-AT (getCenter) as the projection centre with centerIsLookAt → yShift = 0, so the
  // export translate is the canvas centre and the look-at sits dead-centre (not pushed to the
  // bottom by the nadir+yShift framing). Tilt then pivots around the look-at, matching MapLibre.
  // pitch→tilt, bearing→rotation, altitude→altitude, fov from the slider.
  const lng = Number.isFinite(c.lng) ? c.lng : 0;
  const lat = Number.isFinite(c.lat) ? c.lat : 0;
  return {
    longitude: lng,
    latitude: lat,
    altitude: (Number.isFinite(c.altitudeKm) && c.altitudeKm > 0) ? c.altitudeKm : 1024,
    rotation: c.bearing || 0,
    tilt: Math.max(0, Math.min(85, c.pitch || 0)),
    fieldOfView: fov,
    centerIsLookAt: true
  };
}
// Projection fine-tuning overrides (JSON from the output-side ⚙ control). For geoSatellite these
// merge into the primitives BEFORE the build, so tilt/fov/etc. re-derive scale/yShift/preclip. For
// other projections they're carried on projection.overrides and applied as d3 setters in the engine.
// Projection overrides from an ov value bag ({ovTilt,ovFov,ovRot,ovAlt}, the keys readFrameMap
// stores) rather than the live DOM, so a non-active frame builds its own overrides from its
// saved map. projOverrides() is the active-frame wrapper (reads the DOM fields).
function projOverridesFrom(ov) {
  ov = ov || {};
  const o = {};
  const t = num(ov.ovTilt); if (Number.isFinite(t)) o.tilt = t;
  const f = num(ov.ovFov); if (Number.isFinite(f)) o.fieldOfView = f;
  const r = num(ov.ovRot); if (Number.isFinite(r)) o.rotation = r;
  const a = num(ov.ovAlt); if (Number.isFinite(a) && a > 0) o.altitude = a;
  return o;
}
function projOverrides() {
  return projOverridesFrom({ ovTilt: $('ovTilt')?.value, ovFov: $('ovFov')?.value, ovRot: $('ovRot')?.value, ovAlt: $('ovAlt')?.value });
}
// Satellite projection from a frame map ({proj, satParams, ov}) rather than the DOM/module
// satParams, so each frame renders its own camera without being loaded into the panel first.
function satelliteProjectionFrom(fm) {
  if (fm.proj !== 'geoSatellite') return null;
  return buildSatelliteFromParams({ ...(fm.satParams || camToSatParams()), ...projOverridesFrom(fm.ov) });
}
function satelliteProjection() {
  return satelliteProjectionFrom({ proj: $('proj').value, satParams,
    ov: { ovTilt: $('ovTilt')?.value, ovFov: $('ovFov')?.value, ovRot: $('ovRot')?.value, ovAlt: $('ovAlt')?.value } });
}
// Diagnostic readout: shows the nav-pane camera pose and the geoSatellite params derived
// from it, so a "renders but wrong" report can be pinned to cam-not-arriving vs. bad formula.
function updateSatInfo() {
  const isSat = $('proj').value === 'geoSatellite';
  { const row = $('satFovRow'); if (row) row.style.display = isSat ? '' : 'none'; }
  { const row = $('satPasteRow'); if (row) row.style.display = isSat ? '' : 'none'; }
}
// fov is a direct knob — re-render on drag regardless of the "live update" gate (debounced), so it
// always responds. Updates the authored primitive when a project set it; the crosswalk reads the
// slider live in camToSatParams.
{ const fs = $('satFov'); if (fs) fs.addEventListener('input', () => { if (satParams) satParams.fieldOfView = num(fs.value); updateSatInfo(); requestRender(); }); }
// Paste the six primitives straight from @cfr-design/mapa-sata ("Copy me" = JSON.stringify(saveSettings)).
// They become satParams verbatim — the notebook is the editor, mapa just renders what it made.
// Clearing the box hands control back to the nav pane.
{ const ta = $('satPaste');
  if (ta) ta.addEventListener('input', () => {
    const msg = $('satPasteMsg'), txt = ta.value.trim();
    if (!txt) { satParams = null; if (msg) msg.textContent = 'cleared — the nav pane drives the view'; requestRender(); return; }
    // Observable shows the "Copy me" string cell wrapped in quotes/backticks (sometimes with \" escapes),
    // so accept the raw object, a JSON string of it, or the quoted display text.
    const parseCam = (s) => {
      try { const v = JSON.parse(s); return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) {}
      const m = s.match(/\{[\s\S]*\}/); if (!m) return null;
      try { return JSON.parse(m[0].replace(/\\"/g, '"')); } catch (e) { return null; }
    };
    const o = parseCam(txt);
    if (!o || typeof o !== 'object') { if (msg) msg.textContent = 'not valid JSON yet'; return; }
    const keys = ['longitude', 'latitude', 'altitude', 'rotation', 'tilt', 'fieldOfView'];
    const missing = keys.filter((k) => !Number.isFinite(+o?.[k]));
    if (missing.length) { if (msg) msg.textContent = 'missing: ' + missing.join(', '); return; }
    satParams = Object.fromEntries(keys.map((k) => [k, +o[k]]));
    $('satFov').value = String(satParams.fieldOfView);
    // Move the pane to where the export looks (display only — it can't override satParams now).
    const [lookLng, lookLat] = satelliteViewCenter({ ...satParams,
      width: num($('w').value) || 1000, height: num($('h').value) || num($('w').value) || 1000 });
    satelliteCam = { lng: lookLng, lat: lookLat, bearing: satParams.rotation, pitch: satParams.tilt,
      altitudeKm: satParams.altitude, zoom: paneZoomFromAltitude(satParams.altitude, lookLat, satParams.tilt) };
    postPaneCamera();
    if (msg) msg.textContent = 'using notebook camera';
    requestRender();
  });
}
// Ask the pane for its current camera (used when the projection switches to satellite so
// it renders immediately, before the first pan/tilt).
function requestNavCamera() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaRequestCamera' }, '*');
}
// Tell the nav pane whether to allow pitch/rotate (satellite projection only).
function postSatelliteMode() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaSatelliteMode', on: $('proj').value === 'geoSatellite' }, '*');
}
function postTilt() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaTilt', on: $('mlTilt').checked }, '*');
}
// Nav-pane globe vs flat (mercator) — pane-only, does NOT change the export projection.
let navGlobe = false;
let skyCustom = false;   // nav-pane sky gradient picked (else the pane's auto sky) — see postSky
let lastReadyLoaded = 'ready'; // last prefix passed to showReady(), re-used when flat/globe flips the hint
function postGlobe() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaGlobe', on: navGlobe }, '*');
  syncBounderAvailability();
}
// The bounder is a rectangular crop in projected screen space — meaningless on the globe. Disable
// the ▭ button (and its ▾ ratio menu) whenever the pane is in globe mode, and clear any active box.
function syncBounderAvailability() {
  const off = !!navGlobe;
  { const b = $('bboxShow'); if (b) {
    if (b.dataset.title == null) b.dataset.title = b.title; // stash the original once
    b.disabled = off;
    b.title = off ? 'Drawing a frame is unavailable in globe view — switch the pane to Flat (frames you already have are kept)' : b.dataset.title;
  } }
  // Adding stays available in globe view: a new frame COPIES the active frame's extent, so it's
  // useful even when you can't draw. Only drawing a fresh extent needs Flat.
  { const b = $('paneAddFrame'); if (b) b.title = off ? "Add a new output frame (copies the current frame's extent) — drawing a new extent needs Flat" : 'Add a new output frame — then shift-drag on the map to draw its extent'; }
  if (off && bboxShown) { bboxShown = false; const b = $('bboxShow'); if (b) b.classList.remove('on'); postShowBbox(); }
  showReady(); // the shift-drag part of the hint depends on flat/globe
}
// Drive the nav pane's camera FROM the authored projection (the project is the source of truth):
// centre/zoom/pitch/bearing come from satelliteCam (reconstructed from export.projection).
function postPaneCamera() {
  if (!satelliteCam) return;
  const c = satelliteCam;
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaSetCamera',
    lng: c.lng, lat: c.lat, zoom: c.zoom, pitch: c.pitch, bearing: c.bearing }, '*');
}
$('proj').addEventListener('change', () => {
  updateSatInfo();
  syncViewAction();
  postSatelliteMode();
  if ($('proj').value === 'geoSatellite') {
    // Open the pane, read its current camera, and enable tilt — satellite needs pitch+bearing to
    // author the pose, so turn tilt on automatically when the projection is picked.
    openNavPane(); requestNavCamera();
    const t = $('mlTilt'); if (t && !t.checked) t.checked = true;
    postTilt();
  }
});
// The pane posts its live view bbox; hold it so a reload (light/dark switch) reframes to where
// the user is looking, not back to the project bbox.
window.addEventListener('message', (e) => {
  const d = e.data;
  if (d && d.type === 'mapaStatus' && typeof d.msg === 'string') { note(d.msg); return; }
  if (d && d.type === 'mapaRenderKey') { renderFromKey(); return; }
  if (d && d.type === 'mapaCamera') {
    // The nav pane's MapLibre camera moved. Keep it, and if the export is on satellite,
    // re-render (respecting live edit / Render buttons via onEdit). The project file's authored
    // primitives are just a SEED: once the live pane reports a camera (with its true nadir), the
    // pane drives the projection — clear satParams so satelliteProjection() uses camToSatParams.
    // Same loop guard as mapaBounds: an unchanged pose (the pane echoing after a render) is not an edit.
    const poseKey = (c) => c ? [c.lng, c.lat, c.zoom, c.pitch, c.bearing, c.altitudeKm].map((v) => Number.isFinite(v) ? +v.toFixed(4) : v).join() : '';
    const poseChanged = poseKey(satelliteCam) !== poseKey(d);
    satelliteCam = d;
    if (paneReadyResolve) { paneReadyResolve(); paneReadyResolve = null; }
    // A pasted notebook camera (#satPaste) is locked — the pane can't override it.
    if (d.user && Number.isFinite(d.nadirLng) && !$('satPaste')?.value.trim()) satParams = null;
    updateSatInfo();
    if ($('proj').value === 'geoSatellite' && poseChanged) onEdit();
    return;
  }
  if (d && d.type === 'mapaDrawnBbox' && Array.isArray(d.bbox) && d.bbox.length === 4) {
    // A shift-drawn rectangle IS the active frame's render extent (#bbox = the active frame). Pane
    // navigation never overwrites it (behavior A), so there's no lock; redraw to change it.
    $('bbox').value = d.bbox.join(', ');
    applyRatio();                     // snap the drawn rect to the locked ratio, if set
    bboxShown = true; $('bboxShow').classList.add('on');
    postShowBbox();
    onEdit();
    return;
  }
  if (d && d.type === 'mapaBounds' && Array.isArray(d.bbox) && d.bbox.length === 4) {
    // Ignore bounds while the pane is parked off the board: collapsing it to 0×0 posts a
    // degenerate getBounds() that would otherwise clobber #bbox.
    if (!isOnBoard('navPanel')) return;
    // The pane re-posts the SAME bounds after every render (render → mapaShowBbox → pane → bounds),
    // so only a real view change may re-render — otherwise live mode loops and the spinner never clears.
    const boundsChanged = String(paneBounds) !== String(d.bbox);
    paneBounds = d.bbox; // always track the live pane view — the extent filter uses this
    updateViewReadout();  // live "Atlas view" readout in the Map panel (display only, not a trigger)
    syncInsetFollow();    // unlocked inset follows the pane — refresh centre fields to the new view
    if (paneReadyResolve) { paneReadyResolve(); paneReadyResolve = null; }
    // When the Atlas view IS the bbox (auto) and live update is on, a pane move changes the crop,
    // so re-render immediately (bounds fire once on 'moveend', so no debounce needed — zero delay).
    if (boundsChanged && $('trackView')?.checked && !bboxShown && $('live')?.checked) { clearTimeout(liveTimer); render(); }
    // Behavior A: navigating the pane does NOT change the render extent — only drawing a box or
    // editing the bbox field does. We still remember the pane's own view (navViewBbox) so an
    // iframe reload re-frames where you left off. Programmatic bounds (d.user === false) are skipped.
    if (d.user === false) return;
    navViewBbox = d.bbox;
  }
});
function navIframeSrc() {
  const proj = currentProjectRef;
  let src = 'sandbox.html?embed&mapa&style=' + encodeURIComponent(navStyle);
  if (proj) src += '&project=' + encodeURIComponent(proj);
  // Prefer the pane's current view (kept across a reload) over the project's #bbox field.
  const b = (navViewBbox || $('bbox').value.split(',').map((s) => s.trim()).filter(Boolean).map(Number))
    .filter((n) => Number.isFinite(n)).join(',');
  if (b.split(',').length === 4) src += '&bbox=' + encodeURIComponent(b);
  if (navGlobe) src += '&globe'; // persist globe across pane reloads (basemap switch etc.)
  if ($('mlTerrain')?.checked) src += '&terrain&exaggeration=' + encodeURIComponent($('mlTerrainExag').value || 1.5); // same for terrain
  if (skyCustom) src += '&sky=' + $('mlSky').value.slice(1) + '&horizon=' + $('mlHorizon').value.slice(1);   // no '#' in params
  if ($('mlLight')?.checked) src += '&lighting&sun=' + encodeURIComponent($('mlSun').value) + '&shade=' + encodeURIComponent($('mlShade').value) +
    '&shadow=' + $('mlShadow').value.slice(1) + '&hilite=' + $('mlHighlight').value.slice(1);
  // Landing camera for geoSatellite: hand the pane the full pose (center/zoom/tilt/rotation)
  // so it frames itself on its own map-load — deterministic, not a postMessage race.
  if ($('proj').value === 'geoSatellite' && satelliteCam) {
    const c = satelliteCam;
    if (Number.isFinite(c.lng) && Number.isFinite(c.lat)) src += '&center=' + c.lng + ',' + c.lat;
    if (Number.isFinite(c.zoom)) src += '&zoom=' + c.zoom;
    if (Number.isFinite(c.pitch)) src += '&pitch=' + c.pitch;
    if (Number.isFinite(c.bearing)) src += '&bearing=' + c.bearing;
  }
  return src;
}
function initNavPane() {
  const host = $('mlmap');
  let frame = host.querySelector('iframe');
  // Drop the loading placeholder and add the iframe, but DON'T replaceChildren — that would
  // also wipe the #mlSize overlay. Keep the badge; the iframe sits under it (badge is z-indexed).
  if (!frame) { frame = document.createElement('iframe'); host.querySelector('.placeholder')?.remove(); host.prepend(frame); }
  // Globe + camera are seeded via the iframe URL (deterministic). Do NOT re-post them here: those
  // posts bounce postCamera() back from the pane before it has framed, overwriting the seed with
  // the [0,20] default. Only restore the things the URL can't carry (ratio/overlay/interactions).
  frame.onload = () => { postRatio(); if (bboxShown) postShowBbox(); postSatelliteMode(); postTilt(); };
  const src = navIframeSrc();
  console.log('[nav] iframe src =', src);
  frame.src = src;
  navInited = true;
}
// Bridge for the (classic-script) navPanel render: inject the iframe on first mount by any
// path. Guarded like openNavPane so a refresh/re-render never reloads a live pane.
window.__mapaInitNav = () => { if (!navInited) initNavPane(); };
// "Open"/"closed" now means "on the board" / "parked in the 🧰 tray" -- removeTile()
// parks the panel's DOM (into #panelStore) rather than destroying it, so the iframe and its
// navInited state survive a close/reopen cycle exactly like the old classList toggle did.
function openNavPane() {
  if (!isOnBoard('navPanel')) { const slot = findFreeSlot(4, 3); addTile('navPanel', slot.x, slot.y, 4, 3); }
  if (!navInited) initNavPane();
}
function closeNavPane() { removeTile('navPanel'); }
// The Atlas pane is a Board panel now; add/remove it from the 🧰 flyout. (The old header
// "◧ Atlas" toggle was removed.) openNavPane/closeNavPane remain for the programmatic callers
// (boot, "+ frame", camera requests).
function installSplitter() {
  const stage = $('stage'), splitter = $('splitter');
  // #stage/#splitter no longer exist -- nav-pane and output-viewport are independent Board
  // panels now, each resized via Board's own per-panel handles, not a shared splitter.
  if (!stage || !splitter) return;
  let dragging = false, raf = 0, pendingW = 0;
  const apply = () => { raf = 0; stage.style.setProperty('--mlw', pendingW + 'px'); };
  const onMove = (e) => {
    if (!dragging) return;
    const r = stage.getBoundingClientRect();
    // Pane width grows toward its own edge — measure from the correct side when it's on the right.
    const raw = stage.classList.contains('pane-right') ? (r.right - e.clientX) : (e.clientX - r.left);
    pendingW = Math.max(220, Math.min(r.width - 260, raw));
    if (!raf) raf = requestAnimationFrame(apply); // one width update per frame, not per event
  };
  const stop = (e) => {
    if (!dragging) return;
    dragging = false; resizingPane = false;
    splitter.classList.remove('dragging'); stage.classList.remove('dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    stage.style.setProperty('--mlw', pendingW + 'px');
    try { splitter.releasePointerCapture(e.pointerId); } catch {}
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', stop);
  };
  splitter.addEventListener('pointerdown', (e) => {
    dragging = true; resizingPane = true;
    splitter.classList.add('dragging'); stage.classList.add('dragging');
    // Pointer capture routes moves to the splitter even over the iframe, so the drag can't stick.
    try { splitter.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', stop);
  });
}
// Drag the left panel wider/narrower — sets --panelw on <body> (the first grid column).
function installPanelSplitter() {
  const handle = $('panelSplitter');
  if (!handle) return;
  let dragging = false, raf = 0, pendingW = 0;
  const apply = () => { raf = 0; document.body.style.setProperty('--panelw', pendingW + 'px'); };
  const onMove = (e) => {
    if (!dragging) return;
    pendingW = Math.max(240, Math.min(window.innerWidth - 360, e.clientX));
    if (!raf) raf = requestAnimationFrame(apply);
  };
  const stop = (e) => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    document.body.style.setProperty('--panelw', pendingW + 'px');
    try { handle.releasePointerCapture(e.pointerId); } catch {}
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', stop);
  };
  handle.addEventListener('pointerdown', (e) => {
    dragging = true;
    handle.classList.add('dragging');
    try { handle.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', stop);
  });
}
// Live viewport-size badge: #mlmap holds the iframe at 100%×100%, so its client box IS the
// MapLibre viewport. A ResizeObserver keeps it current through splitter drags, window resizes,
// and pane open/close (it also fires once on observe(), so the badge populates on load).
function updateMlSize() {
  const host = $('mlmap'), el = $('mlSizePx');
  if (!host || !el) return;
  el.textContent = Math.round(host.clientWidth) + ' × ' + Math.round(host.clientHeight) + ' px';
}
{ const host = $('mlmap'); if (host && window.ResizeObserver) new ResizeObserver(updateMlSize).observe(host); }
// The pane's own ✕ close and ⇄ swap-side buttons are gone -- the Atlas pane is a Board panel
// now, closed from its own tile header (✕) and re-added from the 🧰 tray; there's no fixed
// two-pane split to swap sides of. closeNavPane stays for the programmatic callers.
// Dark mode / Globe are switches; Tilt drives the pane's pitch/bearing over postMessage.
$('mlBasemap').checked = navStyle === 'dark'; // switch starts on the default (ATLAS_STYLE)
$('mlBasemap').addEventListener('change', () => { navStyle = $('mlBasemap').checked ? 'dark' : 'light'; initNavPane(); });
$('mlGlobe').addEventListener('change', () => {
  navGlobe = $('mlGlobe').checked; postGlobe();
  note(navGlobe ? 'globe view — existing frames kept; switch to Flat to draw a new one' : 'flat view — frames available');
});
syncBounderAvailability(); // reflect the initial globe/flat state (satellite projects default to globe)
$('mlTilt').addEventListener('change', postTilt);
// Terrain: 3D relief in the pane from the rgb height tiles (pane-only, like Globe).
function postTerrain() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaTerrain', on: $('mlTerrain').checked,
    exaggeration: parseFloat($('mlTerrainExag').value) }, '*');
}
$('mlTerrain').addEventListener('change', postTerrain);
$('mlTerrainExag').addEventListener('input', postTerrain);
// Sky gradient (top → horizon). Untouched = auto (the pane's default); picking a colour makes it
// custom, the auto button goes back. The menu stays open: it only closes on buttons, so auto's
// click is stopped before the menu's handler sees it.
function postSky() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaSky',
    top: skyCustom ? $('mlSky').value : null, horizon: skyCustom ? $('mlHorizon').value : null }, '*');
  $('mlSkyState').textContent = skyCustom ? 'custom' : 'auto';
  $('mlSkyAuto').disabled = !skyCustom;
}
for (const id of ['mlSky', 'mlHorizon']) $(id).addEventListener('input', () => { skyCustom = true; postSky(); });
$('mlSkyAuto').addEventListener('click', (e) => { e.stopPropagation(); skyCustom = false; postSky(); });
$('mlSkyAuto').disabled = true;
// Lighting: live hillshade from the rgb height tiles; the settings apply as you change them.
function postLighting() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaLighting', on: $('mlLight').checked,
    sun: parseFloat($('mlSun').value), shade: parseFloat($('mlShade').value),
    shadow: $('mlShadow').value, highlight: $('mlHighlight').value }, '*');
}
for (const id of ['mlLight', 'mlSun', 'mlShade', 'mlShadow', 'mlHighlight']) $(id).addEventListener('input', postLighting);
$('mlLight').addEventListener('change', postLighting);
// Hex code beside each colour picker (sky, horizon, shadow, highlight), shown without the '#'
// so it can go straight into a URL param. Typing a hex (3 or 6 digits, '#' optional) sets the picker.
for (const picker of document.querySelectorAll('#mlMenu .ml-field input[type=color]')) {
  const hex = document.createElement('input');
  Object.assign(hex, { type: 'text', className: 'ml-hex', maxLength: 7, spellcheck: false, title: 'Hex colour (the # is optional)' });
  const show = () => { hex.value = picker.value.slice(1); };
  show();
  picker.addEventListener('input', show);
  hex.addEventListener('input', () => {
    const v = hex.value.trim().replace(/^#/, '');
    if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) return;
    picker.value = '#' + (v.length === 3 ? [...v].map((c) => c + c).join('') : v).toLowerCase();
    picker.dispatchEvent(new Event('input', { bubbles: true }));
  });
  hex.addEventListener('blur', show);
  picker.after(hex);
}
// ☰ overflow menu: open/close; close on outside-click or after an ACTION (button), but NOT when
// toggling a switch inside it.
{ const mb = $('mlMenuBtn'), menu = $('mlMenu');
  if (mb && menu) {
    mb.addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
    document.addEventListener('click', (e) => { if (!menu.hidden && !e.target.closest('#mlMenuWrap')) menu.hidden = true; });
    menu.addEventListener('click', (e) => { if (e.target.closest('button')) menu.hidden = true; });
  } }
// Show/hide the bbox rectangle on the nav map — lets you navigate away and still see the render
// frame. Posts to the sandbox iframe.
function bboxParts() {
  const p = $('bbox').value.split(',').map((s) => parseFloat(s.trim()));
  return (p.length === 4 && p.every(Number.isFinite)) ? p : null;
}
// ---- output frames (per-view) --------------------------------------------
// The Map panel edits the ACTIVE frame; #bbox is the active frame's extent (the orange bounder).
// Each frame owns a full Map-panel snapshot (`map`). Switching frames swaps the whole panel.
const OV_IDS = ['ovTilt', 'ovFov', 'ovRot', 'ovAlt'];
function readFrameMap() {
  const ov = {}; for (const id of OV_IDS) ov[id] = $(id) ? $(id).value : '';
  return {
    bbox: $('bbox').value,
    bboxShown: bboxShown,   // whether this frame's bounder is drawn/visible (per-frame, not global)
    trackView: $('trackView') ? $('trackView').checked : true,
    buffer: $('buffer') ? $('buffer').value : '0',
    proj: $('proj').value,
    satFov: $('satFov') ? $('satFov').value : '',
    w: $('w').value,
    h: $('h').value,
    bg: $('bg').value,
    ratio: $('bboxRatio') ? $('bboxRatio').value : '',
    ov,
    satParams: satParams ? JSON.parse(JSON.stringify(satParams)) : null
  };
}
function applyFrameMap(m) {
  m = m || {};
  $('bbox').value = m.bbox ?? '';
  // Restore this frame's bounder-shown state (per-frame). Force off if the frame has no bbox,
  // so a map-frame never inherits the previous frame's box on the pane.
  bboxShown = (m.bboxShown === true) && !!((m.bbox || '').trim());
  if ($('bboxShow')) $('bboxShow').classList.toggle('on', bboxShown);
  if ($('trackView')) $('trackView').checked = m.trackView !== false;
  if ($('buffer')) $('buffer').value = m.buffer ?? '0';
  if (typeof m.proj === 'string') $('proj').value = m.proj;
  if ($('satFov') && m.satFov != null) $('satFov').value = m.satFov;
  $('w').value = m.w ?? '';
  $('h').value = m.h ?? '';
  if (m.bg) $('bg').value = m.bg;
  if ($('bboxRatio')) $('bboxRatio').value = m.ratio ?? '';
  if (m.ov) for (const id of OV_IDS) { if ($(id)) $(id).value = m.ov[id] ?? ''; }
  satParams = m.satParams ? JSON.parse(JSON.stringify(m.satParams)) : null;
  updateSatInfo();
  if (typeof syncRatioActive === 'function') syncRatioActive();
  // Tell the pane this frame's ratio too: without it the shift-drag box kept the PREVIOUS
  // frame's ratio, so with several frames the drawable box flipped orientation on every switch.
  postRatio();
  postShowBbox();
}
function saveActiveFrame() { if (frames[activeFrame]) frames[activeFrame].map = readFrameMap(); }
// Display name for a frame index, used for tab labels + download suffixes.
function frameName(i) { const f = frames[i]; return ((f && f.name) || '').trim() || ('Frame ' + (i + 1)); }
function frameSizeText(i) {
  const m = frames[i] && frames[i].map || {};
  const w = (i === activeFrame ? $('w').value : m.w) || '';
  const h = (i === activeFrame ? $('h').value : m.h) || '';
  return (String(w).trim() || '?') + '×' + (String(h).trim() || 'auto');
}
function updateActiveFrameSizeLabel() { const el = $('activeFrameSize'); if (el) el.textContent = frameSizeText(activeFrame); }
// Map-panel frame picker as a horizontal tab strip (mirrors the output-preview #frameTabs).
// Click a tab to edit that frame in the Map panel; double-click to rename inline; ✕ on the
// active tab (when >1) removes it. A size line under the strip tracks the active frame.
// Expose the view set as shared Board state so any panel can read the current frames/active
// index (the read handle the frames redesign is built on). Published at this single chokepoint:
// renderFramesList() runs after every frame mutation (add/remove/switch/rename/load/seed). A
// direct assignment, NOT setBoardState() -- the frames array is mutated in place elsewhere and
// routing this through the board's refresh loop would recurse. The editor still edits the ACTIVE
// frame via the DOM (readFrameMap/applyFrameMap); the DOM-free export path lands with the
// readPanel->buildSettings refactor.
function publishFrames() { boardState.frames = frames; boardState.activeFrame = activeFrame; }
function renderFramesList() {
  publishFrames();
  { const r = $('insPerFrameRow'); if (r) r.hidden = frames.length < 2; }
  const list = $('framesList'); if (!list) return;
  list.replaceChildren();
  const strip = document.createElement('div');
  strip.style.cssText = 'display:flex; gap:2px; flex-wrap:wrap; padding:4px 6px;';
  frames.forEach((f, i) => {
    const active = (i === activeFrame);
    const tab = document.createElement('button'); tab.type = 'button';
    tab.title = 'Edit this frame in the Map panel — double-click to rename';
    tab.style.cssText = 'display:inline-flex; align-items:center; gap:5px; font:11px system-ui,sans-serif; ' +
      'padding:3px 8px; cursor:pointer; ' +
      (active ? 'background:var(--render); color:#fff; border:1px solid var(--render);' : 'background:#ece7e0; color:var(--chrome); border:1px solid #cfc8bf;');
    const lbl = document.createElement('span'); lbl.textContent = frameName(i);
    tab.append(lbl);
    tab.onclick = () => setActiveFrame(i);
    // Swap the tab into an inline rename input, committed on blur/Enter.
    const startRename = (ev) => {
      if (ev) ev.stopPropagation();
      const nm = document.createElement('input'); nm.type = 'text';
      nm.placeholder = 'Frame ' + (i + 1); nm.value = f.name || '';
      nm.style.cssText = 'font:11px system-ui,sans-serif; width:70px; padding:0 2px;';
      const commit = () => { f.name = nm.value.trim(); postFrames(); renderFramesList(); };
      nm.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } else if (e.key === 'Escape') renderFramesList(); };
      nm.onblur = commit;
      nm.onclick = (e) => e.stopPropagation();
      tab.replaceChildren(nm); nm.focus(); nm.select();
    };
    tab.ondblclick = startRename;   // double-click anywhere on the tab renames
    if (active) {
      const edit = document.createElement('span'); edit.textContent = '✎'; edit.title = 'Rename this frame';
      edit.style.cssText = 'color:#ffe6d9; cursor:pointer; font-size:11px;';
      edit.onclick = startRename;
      tab.append(edit);
    }
    {
      const del = document.createElement('span'); del.textContent = '✕';
      del.title = frames.length > 1 ? 'Remove this frame' : 'Reset this frame';
      // Pad the ✕ out to the tab's right edge and full height (cancelling the tab's padding) so
      // the whole right end of the tab is its click area, not just the glyph.
      del.style.cssText = 'cursor:pointer; font-size:10px; padding:3px 8px 3px 4px; margin:-3px -8px -3px 0; align-self:stretch; display:inline-flex; align-items:center; color:' + (active ? '#ffd3c2' : '#a5564a') + ';';
      del.onclick = (ev) => { ev.stopPropagation(); removeFrame(i); };
      tab.append(del);
    }
    strip.append(tab);
  });
  list.append(strip);
  const szLine = document.createElement('div');
  szLine.style.cssText = 'padding:0 8px 4px; font:11px system-ui,sans-serif; color:#888;';
  const sz = document.createElement('span'); sz.id = 'activeFrameSize'; sz.textContent = frameSizeText(activeFrame);
  szLine.append(sz);
  list.append(szLine);
}
function setActiveFrame(i) {
  if (i === activeFrame || !frames[i]) return;
  saveActiveFrame();
  activeFrame = i;
  applyFrameMap(frames[i].map);   // swaps the whole Map panel to this frame; postShowBbox runs inside
  renderFramesList();
}
function addFrameRow() {
  saveActiveFrame();
  const base = frames[activeFrame] ? JSON.parse(JSON.stringify(frames[activeFrame].map)) : readFrameMap();
  // A new frame defaults to the MAP FRAME (track the current Atlas view), not an explicit bbox.
  // So: clear the bbox, turn Atlas-view tracking on, and leave the bounder off (which also keeps
  // the invert button hidden until the user actually draws a box for this frame).
  base.bbox = '';
  base.trackView = true;
  base.ratio = '';
  frames.push({ id: 'frm' + (++frameIdSeq), name: '', map: base });
  activeFrame = frames.length - 1;
  bboxShown = false; $('bboxShow').classList.remove('on');
  applyFrameMap(frames[activeFrame].map);
  renderFramesList();
  onEdit();
}
function removeFrame(idx) {
  saveActiveFrame();
  if (frames.length <= 1) {
    // Last frame: don't leave zero views — re-seed a fresh default Frame 1 (clears bbox/size/buffer,
    // back to Atlas-view tracking).
    frames = [{ id: 'frm' + (++frameIdSeq), name: '', map: { bbox: '', trackView: true, buffer: '0', w: '1000', h: '', ratio: '' } }];
    activeFrame = 0;
    bboxShown = false; if ($('bboxShow')) $('bboxShow').classList.remove('on');
    applyFrameMap(frames[0].map);
    renderFramesList();
    onEdit();
    return;
  }
  frames.splice(idx, 1);
  if (activeFrame > idx) activeFrame--;
  if (activeFrame >= frames.length) activeFrame = frames.length - 1;
  applyFrameMap(frames[activeFrame].map);
  renderFramesList();
  onEdit();
}
{ const b = $('addFrame'); if (b) b.addEventListener('click', addFrameRow); }
// Pane-bar "+ frame": add a new output frame, then prompt the shift-drag that draws its extent.
{ const b = $('paneAddFrame'); if (b) b.addEventListener('click', () => { addFrameRow(); openNavPane(); note('shift-drag on the map to draw the new frame'); }); }
{ const w = $('w'), h = $('h'); if (w) w.addEventListener('input', updateActiveFrameSizeLabel); if (h) h.addEventListener('input', updateActiveFrameSizeLabel); }
// Seed a single frame from the initial DOM defaults, then draw the list.
frames = [{ id: 'frm' + (++frameIdSeq), name: '', map: readFrameMap() }];
activeFrame = 0;
renderFramesList();
// "Atlas view" readout (display only) + "use as bbox" (promotes the pane view to the render extent
// on demand, so panning the pane isn't itself a trigger — behavior A).
function updateViewReadout() {
  const el = $('mlView'); if (!el) return; // shown under the px badge in the pane, bottom-right
  el.textContent = Array.isArray(paneBounds) ? paneBounds.map((v) => +(+v).toFixed(3)).join(', ') : '';
  // The bbox field's placeholder shows the extent actually in use when it's blank (the Atlas
  // view) — it used to be static example text that looked like a real, saved bbox.
  const bb = $('bbox');
  if (bb) bb.placeholder = Array.isArray(paneBounds) && $('trackView')?.checked !== false
    ? paneBounds.map((v) => +(+v).toFixed(4)).join(', ') + '  (Atlas view)' : 'W, S, E, N';
}
// The `auto` toggle: on = Atlas view is the bbox (when no bounder), off = whole world. Re-render
// immediately so unchecking shows the world map (and re-checking returns to the Atlas view).
{ const pf = $('insPerFrame'); if (pf) pf.addEventListener('change', onEdit); }
{ const tv = $('trackView'); if (tv) tv.addEventListener('change', () => { updateViewReadout(); requestRender(); }); }
function bufferFrac() {
  const m = num($('buffer').value) || 0, w = num($('w').value) || 1000;
  return m > 0 ? m / w : 0;   // margin as a fraction of the export width
}
// On-map shortcuts only make sense once there's a drawn extent — show them with it.
// postShowBbox() fires on every extent visibility change.
function updateExtentShortcuts() {
  // Invert (swap w/h) now lives in the Map panel as a persistent option under the bbox — always
  // visible; its click handler no-ops gracefully when there's no extent to swap.
  const inv = $('bboxInvert'); if (inv) inv.style.display = '';
}
function postShowBbox() {
  updateExtentShortcuts();
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaShowBbox', show: bboxShown, bbox: bboxParts(), buffer: bufferFrac() }, '*');
  postFrames();
}
// Push the INACTIVE frames to the pane as static labelled outlines (the active one = the live #bbox
// bounder). Each inactive frame's extent comes from its stored map snapshot.
function postFrames() {
  const frame = $('mlmap').querySelector('iframe');
  if (!frame || !frame.contentWindow) return;
  const others = [];
  frames.forEach((f, i) => {
    if (i === activeFrame) return;
    const p = ((f.map && f.map.bbox) || '').split(',').map((x) => parseFloat(x.trim()));
    if (p.length === 4 && p.every(Number.isFinite)) others.push({ name: frameName(i), bbox: p });
  });
  frame.contentWindow.postMessage({ type: 'mapaFrames', frames: others }, '*');
}
$('bboxShow').addEventListener('click', () => {
  bboxShown = !bboxShown;
  $('bboxShow').classList.toggle('on', bboxShown);
  postShowBbox();
  // Left part = enter draw mode: prompt the shift-drag that draws the frame on the pane.
  if (bboxShown) { openNavPane(); note('shift-drag on the map to draw the frame'); }
});
// Extent aspect-ratio lock. "w:h" (or a single number) → snap the bbox to that ratio in Web
// Mercator (what the nav pane shows), keeping the lng width and center. Blank = free.
function parseRatio() {
  const v = $('bboxRatio').value.trim();
  if (!v) return null;
  const parts = v.split(/[:/x ]+/).map(Number).filter(Number.isFinite);
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) return parts[0] / parts[1];
  return (parts.length === 1 && parts[0] > 0) ? parts[0] : null;
}
const mercY = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI / 180) / 2));
const invMercY = (y) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
// Reframe the nav pane to the BUFFERED render extent: the drawn bbox grown by the buffer
// (same Web-Mercator growth as the pane's buffer band). Fires on buffer change so the pane
// shows exactly what the export — bleed included — will cover. No bbox = nothing to fit.
function postFitBuffer() {
  const bb = bboxParts(); if (!bb) return;
  const frac = bufferFrac();
  const [w, s, e, n] = bb;
  const fx = (e - w) * frac, my0 = mercY(s), my1 = mercY(n), fy = (my1 - my0) * frac;
  const outer = [w - fx, invMercY(my0 - fy), e + fx, invMercY(my1 + fy)];
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaFitBuffer', bbox: outer }, '*');
}
{ const bf = $('buffer'); if (bf) bf.addEventListener('change', postFitBuffer); }
// Snap the active frame's bbox (#bbox = the active frame) to the locked ratio: keep lng width,
// derive lat span. Because the DOM IS the active frame, this can never touch another frame.
function applyRatio() {
  const r = parseRatio(), bb = bboxParts();
  if (!r || !bb) return;
  const [w, s, e, n] = bb;
  const ySpan = ((e - w) * Math.PI / 180) / r;   // required Mercator-y span for this ratio
  const cy = (mercY(s) + mercY(n)) / 2;
  $('bbox').value = [w, +invMercY(cy - ySpan / 2).toFixed(4), e, +invMercY(cy + ySpan / 2).toFixed(4)].join(', ');
}
function postRatio() {
  const frame = $('mlmap').querySelector('iframe');
  if (frame && frame.contentWindow) frame.contentWindow.postMessage({ type: 'mapaRatio', ratio: parseRatio() }, '*');
}
// Highlight the preset matching the current ratio ("" = free by default); a custom w:h that matches
// no preset leaves them all off (the custom field holds it instead).
function syncRatioActive() {
  const cur = $('bboxRatio').value.trim();
  document.querySelectorAll('#bboxRatioPresets button').forEach((b) => b.classList.toggle('active', b.dataset.ratio === cur));
}
$('bboxRatio').addEventListener('change', () => {
  postRatio();                                 // lock the shift-drag drawing box to this ratio
  if (bboxParts()) { bboxShown = true; $('bboxShow').classList.add('on'); }
  applyRatio(); postShowBbox(); syncRatioActive(); onEdit();  // and re-snap an already-drawn box to it
});
syncRatioActive();
// Ratio presets (Map panel): radio-like — one active at a time; clicking the active one again clears
// back to free (blank ratio). Sets the custom field → its change handler does the work.
document.querySelectorAll('#bboxRatioPresets button').forEach((b) => b.addEventListener('click', () => {
  const cur = $('bboxRatio').value.trim();
  $('bboxRatio').value = (cur === b.dataset.ratio) ? '' : b.dataset.ratio; // toggle active → free
  $('bboxRatio').dispatchEvent(new Event('change', { bubbles: true }));
}));
$('bboxInvert').addEventListener('click', () => {
  // Invert = swap the ACTIVE frame's projected width×height about its centroid. The pane is Web
  // Mercator, so a swap in mercator space (x = lng·π/180, y = mercY(lat)) IS the project→swap→
  // unproject the user expects. Always a straight swap — no "keep width" special case.
  const bb = bboxParts();
  if (!bb) return;
  const [w, s, e, n] = bb;
  const cxLng = (w + e) / 2;
  const my0 = mercY(s), my1 = mercY(n), cyMerc = (my0 + my1) / 2;
  const newLngWidthDeg = (my1 - my0) * 180 / Math.PI;   // new width  = old (projected) height
  const newMercHeight = (e - w) * Math.PI / 180;        // new height = old (projected) width
  $('bbox').value = [
    +(cxLng - newLngWidthDeg / 2).toFixed(4), +invMercY(cyMerc - newMercHeight / 2).toFixed(4),
    +(cxLng + newLngWidthDeg / 2).toFixed(4), +invMercY(cyMerc + newMercHeight / 2).toFixed(4)
  ].join(', ');
  // If a ratio lock is set, flip it too so the lock matches the box's new orientation (else the
  // next resize would snap the swap right back).
  const p = $('bboxRatio').value.trim().split(/[:/x ]+/).filter(Boolean);
  if (p.length === 2 || (p.length === 1 && Number(p[0]) > 0)) {
    $('bboxRatio').value = p.length === 2 ? p[1] + ':' + p[0] : '1:' + p[0];
    postRatio(); syncRatioActive();
  }
  bboxShown = true; $('bboxShow').classList.add('on');
  postShowBbox(); onEdit();
});
// ? help popover: toggle open, close on outside click.
{ const hb = $('helpBtn'), pop = $('helpPop');
  if (hb && pop) {
    hb.addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    document.addEventListener('click', (e) => { if (!pop.hidden && !e.target.closest('#helpWrap')) pop.hidden = true; });
  } }
installSplitter();
installPanelSplitter();
updateOutDims();

// ---- project loading (dropdown + local file) ------------------------------
// Apply an already-parsed Atlas project object into the panel. Mirrors what boot()
// does after a ?project= fetch, minus the one-time bbox handoff / nav-pane init.
// The bottom-of-page prompt shown once a map is loaded. The shift-drag hint only
// applies in flat view — the bounder is disabled on the globe (syncBounderAvailability).
function readyPrompt(loaded) {
  const bbox = navGlobe ? '' : ' or shift-drag to draw a bounding box (bbox)';
  return loaded + ' — click Render' + bbox;
}
// Show the ready/shift-drag prompt in the Atlas panel (where the shift-drag actually happens),
// not the global status line. Re-rendered on load and whenever flat/globe changes the hint.
// (lastReadyLoaded is declared up with navGlobe so showReady() is safe to call during boot.)
function showReady(loaded) {
  if (loaded != null) lastReadyLoaded = loaded;
  const el = $('navHint'); if (el) el.textContent = readyPrompt(lastReadyLoaded);
}
// ---- view-only import of an old (pre-project-file) Mapa CONFIG -------------
// These predate the Atlas project format: they're raw Mapa `settings` objects (top-level
// projection/basemap/clipping/bounds/…), not view/export/points/polys. We render them verbatim
// for viewing + export; the panel does not edit them, and data layers are re-imported separately.
// looksLikeRawConfig() is imported from mapa.js so the visual-regression harness (test/harness.html)
// branches on fixture shape the exact same way, instead of duplicating this logic.
function showConfigProjection(cfg) {
  const sel = $('proj'); if (!sel) return;
  const pj = cfg.projection || {};
  const label = pj.type === 'proj4' ? ('proj4: ' + (pj.proj || ''))
    : (typeof pj.proj === 'string' ? pj.proj : (pj.type || 'custom'));
  let opt = sel.querySelector('option[data-imported]');
  if (!opt) { opt = document.createElement('option'); opt.dataset.imported = '1'; sel.appendChild(opt); }
  opt.value = '__imported__'; opt.textContent = label;
  sel.value = '__imported__'; sel.disabled = true;
  sel.title = 'Imported config projection (read-only): ' + label;
}
function clearConfigViewMode() {
  rawConfig = null;
  const sel = $('proj'); if (sel) { const opt = sel.querySelector('option[data-imported]'); if (opt) opt.remove(); sel.disabled = false; sel.title = ''; }
}
function enterConfigViewMode(cfg, name) {
  rawConfig = cfg;
  setProjectName(name);
  lastZoom = null;
  { const dn = $('dlName'); if (dn) dn.value = downloadNameFor(projectName); }
  showConfigProjection(cfg);
  note('view-only import — config loaded (re-import data via the Data panel)');
  if ($('live')?.checked) render(); else markStale(true);
}
function loadPastedConfig() {
  const ta = $('pasteConfig'); if (!ta) return;
  const text = (ta.value || '').trim();
  if (!text) { note('paste an old Mapa config first'); return; }
  let obj;
  try { obj = JSON.parse(text); }
  catch (e1) {
    // Fall back to a JS object literal (unquoted keys / trailing commas from a notebook cell).
    try { obj = (new Function('return (' + text + ')'))(); }
    catch (e2) { fail('could not parse pasted config: ' + e1.message); return; }
  }
  if (!obj || typeof obj !== 'object') { fail('pasted config is not an object'); return; }
  if (looksLikeRawConfig(obj)) { enterConfigViewMode(obj, 'pasted-config'); }
  else { clearConfigViewMode(); currentProjectRef = null; applyProject(obj, 'pasted'); } // a normal project → load it normally
}
async function applyProject(obj, name) {
  clearConfigViewMode();   // a normal project load exits view-only config mode
  project = obj || {};
  setProjectName(name);
  syncProjectPick();  // reflect the load in the picker (a dropped local file clears it)
  lastZoom = null; // a new project → start the output at fit, not the previous project's zoom
  { const dn = $('dlName'); if (dn) dn.value = downloadNameFor(projectName); }
  writePanel(project);
  // Pull the project's data pointers into the Data panel and resolve them BEFORE the first
  // render, so the data is on the map rather than appearing a beat later.
  await adoptProjectData(project);
  updateSatInfo();
  syncRenderButtons();
  updateLiveAvailability();
  // The nav pane loads its data via the iframe URL (?project=), so a project change
  // means reloading the iframe — postMessage can't swap the pane's data layers.
  reloadNavPane();
  // writePanel sets .value directly (no input/change events), so live mode won't
  // auto-refresh on its own — kick a render explicitly. Otherwise wait for Render.
  if ($('live')?.checked) render(); else showReady('loaded ' + projectName);
}
// Rebuild the nav-pane iframe against currentProjectRef, but only if it's open —
// otherwise it inits lazily (with the right ref) when the user opens it. Reset the
// kept view so the pane frames the NEW project's bbox, not the old project's view.
function reloadNavPane() {
  if (!navInited) return;
  navViewBbox = null;
  initNavPane();
}
// ---- project / template picker --------------------------------------------
// projects/index.json is the only way to list the folder — a browser can't readdir over fetch
// on S3. `npm run atlas` regenerates it on every change; `npm run projects` does it one-off.
// Every name already taken in the picker (templates + mapa projects), so a NEW project derived
// from one doesn't silently reuse its name. Filled by buildProjectPicker().
const knownNames = new Set();
// A name that isn't already in the list. Collision → append today's date, then a counter if
// even that is taken (two projects off the same template on the same day).
// A name that already carries a date (YYYY-MM-DD) is kept as-is — the DOWNLOAD name gets
// today's date instead (downloadNameFor), the project name doesn't.
function uniqueProjectName(base) {
  if (!knownNames.has(base)) return base;
  if (/\d{4}-\d{2}-\d{2}/.test(base)) return base;
  const d = new Date();
  const stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
  let name = base + '-' + stamp;
  for (let n = 2; knownNames.has(name); n++) name = base + '-' + stamp + '-' + n;
  return name;
}
function syncProjectPick() {
  const sel = $('projPick'); if (!sel) return;
  sel.value = currentProjectRef && [...sel.options].some((o) => o.value === currentProjectRef)
    ? currentProjectRef : '';
}
async function buildProjectPicker() {
  const sel = $('projPick'); if (!sel) return;
  let man;
  try { man = await fetchJSON('./projects/index.json'); }
  catch (e) { console.warn('[mapa] no project manifest:', e.message); return; }
  // Manifest: { projects: [...], mapa: [...], templates: [...] }.
  // The picker lists MAPA's own files only — mapa/projects/ and mapa/templates/. The `projects`
  // list is ATLAS projects (sandbox/index/examples read those); they are deliberately NOT
  // offered here. Values are full paths, which resolveRef passes through untouched and
  // projectBase() reads as their own directory, so data pointers resolve beside the file.
  // archive/ is excluded by the generator, so retired files never reach this list either.
  const mapaProjects = Array.isArray(man) ? [] : (man.mapa || []);
  const templates = Array.isArray(man) ? [] : (man.templates || []);
  const groups = [
    ['Templates', templates.map((t) => [t, './mapa/templates/' + t + '.json'])],
    ['Projects', mapaProjects.map((r) => [r, './mapa/projects/' + r + '.json'])],
  ];
  // Names already in use, so loading a template proposes a fresh one (see uniqueProjectName).
  knownNames.clear();
  for (const r of [...templates, ...mapaProjects]) knownNames.add(r.split('/').pop());
  sel.replaceChildren(new Option('— choose a project or template —', ''));
  for (const [label, list] of groups) {
    if (!list.length) continue;
    const og = document.createElement('optgroup'); og.label = label;
    for (const [text, value] of list) og.append(new Option(text, value));
    sel.append(og);
  }
  syncProjectPick();
  sel.onchange = () => { if (sel.value) loadProjectRef(sel.value); };
  buildBoardPicker(Array.isArray(man) ? [] : (man.boards || []));
}

// Board layouts in mapa/templates/boards/ (save one with "download board", drop it there),
// plus "from file…". Picking one replaces the current layout and reloads (board.js).
function buildBoardPicker(boards) {
  const sel = $('boardLoadPick'), file = $('boardLoadFile'); if (!sel) return;
  sel.replaceChildren(new Option('load board…', ''));
  for (const b of boards) sel.append(new Option(b, './mapa/templates/boards/' + b + '.json'));
  sel.append(new Option('from file…', '#file'));
  sel.onchange = async () => {
    const v = sel.value; sel.value = '';
    if (!v) return;
    if (v === '#file') { file?.click(); return; }
    try { if (!applyBoardData(await fetchJSON(v))) alert('Not a board layout file: ' + v); }
    catch (e) { alert('Could not load ' + v + ': ' + e.message); }
  };
  if (file) file.onchange = () => { loadBoardFile(file.files[0]); file.value = ''; };
}

// Fetch a checked-in project by ref (bare name or path, e.g. "dark/gctvip126-kashmir").
async function loadProjectRef(ref) {
  if (!ref) return;
  try {
    note('loading ' + ref + '…');
    const obj = await fetchJSON(resolveRef(ref));
    currentProjectRef = ref;              // pane can re-fetch this by URL
    const base = ref.replace(/\.json$/, '').split('/').pop();
    // A TEMPLATE is a starting point, not the thing you're editing — so it must not keep the
    // template's name and overwrite it on save. Propose a free name (date-suffixed on
    // collision). An existing project keeps its own name; it IS that project.
    const isTemplate = /\/mapa\/templates\//.test(ref);
    await applyProject(obj, isTemplate ? uniqueProjectName(base) : base);
    if (isTemplate) note('started from template ' + base + ' — saving as ' + projectName);
  } catch (e) { fail('load error: ' + e.message); }
}
// Read a local project .json off disk (file picker / drag-drop). The nav pane fetches
// its data by URL, so it can't show a local file's layers — clear the ref so the pane
// reloads to a bare basemap rather than lying about which project it's showing.
function readProjectFile(file) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const obj = JSON.parse(r.result);
      currentProjectRef = null;
      applyProject(obj, file.name.replace(/\.json$/i, ''));
    } catch (e) { fail('bad project JSON in ' + file.name + ': ' + e.message); }
  };
  r.readAsText(file);
}

{
  { const pn = $('projName');
    if (pn) {
      // Type freely; the name is the identity/slug source of truth. Normalize to a filename-safe
      // slug on commit (blur / Enter) so it matches the repo folder + project-file base name.
      pn.addEventListener('input', () => { projectName = pn.value.trim() || 'map'; const dn = $('dlName'); if (dn) dn.value = downloadNameFor(projectName); });
      pn.addEventListener('change', () => { setProjectName(slugify(pn.value)); });
      pn.addEventListener('keydown', (e) => { if (e.key === 'Enter') pn.blur(); });
    }
  }
  { const lp = $('loadPaste'); if (lp) lp.addEventListener('click', loadPastedConfig); }
  const drop = $('projDrop'), file = $('projFile');
  if (drop && file) {
    drop.addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files[0]) readProjectFile(file.files[0]); file.value = ''; });
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
    ['dragleave', 'dragend'].forEach((ev) => drop.addEventListener(ev, () => drop.classList.remove('drag')));
    drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files[0]) readProjectFile(e.dataTransfer.files[0]); });
  }
}

// Drag-to-reorder the panel's <details> sections. A grip in each summary is the drag source; the
// section moves live on dragover. Order persists to localStorage (a per-user UI pref, NOT project
// data). Section identity = the summary's leading text, which is stable across reloads.
function initPanelSort() {
  const panel = $('panel');
  if (!panel) return;
  const ORDER_KEY = 'mapa.panelOrder', OPEN_KEY = 'mapa.panelOpen', SAVE_KEY = 'mapa.saveLayout';
  const sections = () => [...panel.querySelectorAll(':scope > details')];
  // Stamp a STABLE section key onto each <details> from its summary's leading text — BEFORE we
  // insert the drag grip (which would otherwise become the summary's firstChild and make every
  // key resolve to '⠿'). keyOf then reads the stamped key, so save/restore stay consistent.
  for (const d of sections()) {
    if (!d.dataset.sec) d.dataset.sec = (d.querySelector(':scope > summary')?.firstChild?.textContent || '').trim();
  }
  const keyOf = (d) => d.dataset.sec || '';
  let dragged = null;

  // "save layout" toggle (on by default): gates BOTH persisting and restoring the layout.
  let enabled = true;
  try { const v = localStorage.getItem(SAVE_KEY); enabled = v === null ? true : v === '1'; } catch (e) {}
  const saveEl = $('saveLayout'); if (saveEl) saveEl.checked = enabled;

  // Restore saved order + open/closed state — only when enabled (unknown sections keep defaults).
  if (enabled) {
    try {
      const order = JSON.parse(localStorage.getItem(ORDER_KEY) || 'null');
      if (Array.isArray(order)) {
        const byKey = new Map(sections().map((d) => [keyOf(d), d]));
        for (const k of order) { const d = byKey.get(k); if (d) panel.appendChild(d); }
      }
    } catch (e) { /* ignore a corrupt pref */ }
    try {
      const open = JSON.parse(localStorage.getItem(OPEN_KEY) || 'null');
      if (open) for (const d of sections()) { const k = keyOf(d); if (k in open) d.open = open[k]; }
    } catch (e) { /* ignore a corrupt pref */ }
  }

  const save = () => { if (!enabled) return; try { localStorage.setItem(ORDER_KEY, JSON.stringify(sections().map(keyOf))); } catch (e) {} };
  const saveOpen = () => { if (!enabled) return; try { const o = {}; for (const d of sections()) o[keyOf(d)] = d.open; localStorage.setItem(OPEN_KEY, JSON.stringify(o)); } catch (e) {} };
  panel.addEventListener('toggle', saveOpen, true); // 'toggle' doesn't bubble → capture phase
  if (saveEl) saveEl.addEventListener('change', () => {
    enabled = saveEl.checked;
    try { localStorage.setItem(SAVE_KEY, enabled ? '1' : '0'); } catch (e) {}
    if (enabled) { save(); saveOpen(); } // start persisting from the current arrangement
  });

  for (const d of sections()) {
    const summary = d.querySelector(':scope > summary');
    if (!summary || summary.querySelector('.drag-handle')) continue;
    const h = document.createElement('span');
    h.className = 'drag-handle'; h.textContent = '⠿'; h.title = 'Drag to reorder'; h.setAttribute('draggable', 'true');
    h.addEventListener('click', (e) => e.preventDefault());       // don't toggle the section
    h.addEventListener('dragstart', (e) => {
      dragged = d; d.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', keyOf(d)); } catch (err) {}
    });
    h.addEventListener('dragend', () => {
      d.classList.remove('dragging');
      panel.querySelectorAll('details.drag-over').forEach((x) => x.classList.remove('drag-over'));
      dragged = null; save();
    });
    summary.insertBefore(h, summary.firstChild);
  }

  panel.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('details');
    if (!target || target === dragged || target.parentElement !== panel) return;
    panel.querySelectorAll('details.drag-over').forEach((x) => x.classList.remove('drag-over'));
    target.classList.add('drag-over');
    const rect = target.getBoundingClientRect();
    if ((e.clientY - rect.top) > rect.height / 2) target.after(dragged); else target.before(dragged);
  });
}
async function boot() {
  buildLayerRows();
  initPanelSort();
  // Delegated on document, not a single #panel container: Board's panels can be dragged into a
  // dock or cover, moving their DOM out of #board -- a listener on #board alone would miss
  // input/change events from a docked panel. document-level delegation catches them regardless
  // of where Board has currently placed a panel's body.
  document.addEventListener('input', onEdit);
  document.addEventListener('change', onEdit);
  // Globe inset reads as a circle (matches the disk), flat as a square — default the corner radius to
  // match when the projection is switched. Fires before the panel's delegated onEdit (target before
  // bubble), so the render below picks up the new radius.
  { const ip = $('insProj'); if (ip) ip.addEventListener('change', () => { $('insRadius').value = ip.value === 'globe' ? '100%' : '0%'; }); }

  const ref = params.get('project');
  const bbox = params.get('bbox');
  setProjectName(ref ? ref.replace(/\.json$/, '').split('/').pop() : '');
  { const dn = $('dlName'); if (dn) dn.value = downloadNameFor(projectName); } // download name inherits the project

  // Populate the picker first — it only needs the small manifest, and shouldn't wait behind
  // the basemap load. Fire-and-forget so it never delays first paint.
  buildProjectPicker();
  try {
    note('loading basemap…');
    // JSON mode: load the whole basemap once. fgb mode (prod, or ?fgb locally): skip here —
    // render() streams only the export extent from the fgb build.
    if (!USE_FGB) await loadBasemapData('./mapa/files/');
    await loadPoiTypes();   // POI type presets (mapa/poi-types.json) before anything renders
    // Locator inset uses its own coarse world (always JSON, dev + prod). Load once, up front,
    // so it's ready by the time the user clicks Render — fire-and-forget, never blocks landing.
    loadInsetData('./mapa/files/');
    // Boot seed (?project=). currentProjectRef is already this ref, so the project's data
    // pointers resolve project-relative.
    if (ref) { project = await fetchJSON(resolveRef(ref)); writePanel(project); await adoptProjectData(project); }
  } catch (e) { fail('load error: ' + e.message); return; }

  // ?bbox= handoff from the sandbox seeds the View field (wins over project view). Turn the extent
  // overlay on so the ▭ toggle reads active. Navigating the pane won't change it (behavior A).
  if (bbox) {
    $('bbox').value = bbox.split(',').map((s) => s.trim()).join(', ');
    bboxShown = true; $('bboxShow').classList.add('on');
    postShowBbox(); // reveal on-map shortcuts now; frame.onload re-posts to draw the extent
  }

  updateLiveAvailability();
  syncRenderButtons();
  updateSatInfo(); // reveal the fov row immediately for a geoSatellite project (before the pane reports back)
  if (isOnBoard('navPanel')) initNavPane(); // pane is open by default
  // Don't auto-render on landing — the export draws only when the user clicks Render.
  showReady(ref ? 'loaded ' + projectName : 'ready'); // standing hint in the Atlas panel
  note(''); // boot done: clear the transient 'loading basemap…' status (the ready hint lives in the Atlas panel now)
}
boot();
