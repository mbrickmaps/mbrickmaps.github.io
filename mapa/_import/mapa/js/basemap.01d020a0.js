// Basemap drawing, extracted from mapa.js (Phase 1 decomposition): ocean/land/rivers/borders/
// innerlines/coastline/lakes/disputed, plus their winding-fix/ocean-tiling/frame-trim helpers
// (frameLngLatExtent, trimToFrame, bmSimplify, tileOcean, bmRewind), all moved as one unit --
// they are used exclusively by this block. `Layer` and `BASEMAP` are passed in explicitly
// rather than closed over, matching the pattern raster.js/labels.js will need too.
import { d3, turf } from "./vendor.4692b715.js";

// Clip a world-sized polygon layer (the ocean) to the lng/lat area around a framed map, so the frame
// clip can't turn it inside-out. The frame edge (plus margin) is inverted to lng/lat and padded; the
// clipped rings are densified (straight lng/lat edges would otherwise become great-circle arcs) and
// rewound to d3's winding. Returns null when that can't be done safely — part of the frame off the
// globe, crossing the 180° meridian, or near a pole — so the caller falls back.
// The padded lng/lat extent [W,S,E,N] of a framed map: the frame edge (plus margin) inverted to
// lng/lat. null if any of it is off the globe, it wraps the 180° meridian, or it reaches a pole.
function frameLngLatExtent(projection, width, height, margin = 0) {
  if (!projection.invert) return null;
  const x0 = -margin, y0 = -margin, x1 = width + margin, y1 = height + margin, n = 24;
  let W = Infinity, E = -Infinity, S = Infinity, N = -Infinity;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    for (const p of [[x0 + t * (x1 - x0), y0], [x0 + t * (x1 - x0), y1], [x0, y0 + t * (y1 - y0)], [x1, y0 + t * (y1 - y0)]]) {
      const ll = projection.invert(p);
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) return null;
      W = Math.min(W, ll[0]); E = Math.max(E, ll[0]); S = Math.min(S, ll[1]); N = Math.max(N, ll[1]);
    }
  }
  if (E - W > 180) return null; // wraps the 180° meridian
  const pad = Math.max(2, 0.15 * Math.max(E - W, N - S));
  W -= pad; E += pad; S -= pad; N += pad;
  if (W < -180 || E > 180 || S < -89 || N > 89) return null;
  return [W, S, E, N];
}
function trimToFrame(features, projection, width, height, margin = 0) {
  if (!Array.isArray(features)) return null;
  const ext = frameLngLatExtent(projection, width, height, margin);
  if (!ext) return null;
  const [W, S, E, N] = ext;
  const densify = (ring) => {
    const out = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
      const k = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / 0.5));
      for (let j = 0; j < k; j++) out.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
    }
    if (ring.length) out.push(ring[ring.length - 1]);
    return out;
  };
  const out = [];
  for (const f of features) {
    if (!f || !f.geometry) continue;
    const g = turf.bboxClip(f, [W, S, E, N]).geometry;
    if (!g || !g.coordinates) continue;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    const kept = polys.map((rings) => rings.filter((r) => r.length >= 4).map(densify)).filter((rings) => rings.length);
    if (!kept.length) continue;
    out.push(turf.rewind({ type: "Feature", properties: f.properties || {}, geometry: { type: "MultiPolygon", coordinates: kept } }, { reverse: true }));
  }
  return out.length ? out : null;
}

// Simplify one feature PART BY PART (each polygon / line of a Multi*), so one tiny island that
// collapses (a ring under 4 points) keeps its own detail instead of blocking the whole country. Then
// densify: simplifying in lng/lat removes the in-between points of straight lng/lat runs (the 49th
// parallel US–Canada border became one 26° segment), and d3 draws a long segment as a great-circle
// arc — so the border bowed north. Re-adding a point every 0.5° keeps it on the parallel.
function bmSimplify(f, tol) {
  const g = f && f.geometry;
  if (!g) return f;
  const STEP = 0.5;
  const densify = (line) => {
    const out = [];
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, ay] = line[i], [bx, by] = line[i + 1];
      const k = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / STEP));
      for (let j = 0; j < k; j++) out.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
    }
    if (line.length) out.push(line[line.length - 1]);
    return out;
  };
  const simp = (type, coordinates) => {
    try { return turf.simplify({ type: "Feature", properties: {}, geometry: { type, coordinates } }, { tolerance: tol, highQuality: false }).geometry.coordinates; }
    catch (e) { return coordinates; } // this part can't be simplified — keep it as is
  };
  let coordinates;
  if (g.type === "Polygon") coordinates = simp("Polygon", g.coordinates).map(densify);
  else if (g.type === "MultiPolygon") coordinates = g.coordinates.map((p) => simp("Polygon", p).map(densify));
  else if (g.type === "LineString") coordinates = densify(simp("LineString", g.coordinates));
  else if (g.type === "MultiLineString") coordinates = g.coordinates.map((l) => densify(simp("LineString", l)));
  else return f;
  return { ...f, geometry: { type: g.type, coordinates } };
}

// Split a world-sized polygon layer (the ocean) into tiles whose rings all stay under
// TILE_MAX_POINTS — Illustrator drops paths much bigger than ~32k points. Quadtree in lng/lat:
// a piece that's still too detailed is cut into four, recursively. Cut edges are densified (every
// 0.5°, so they don't bow as great-circle arcs) and each tile is rewound to d3's winding (tiles are
// small, so that's safe). Returns null when nothing needs splitting. Cached per source array.
const TILE_MAX_POINTS = 16000;
const tileCache = new WeakMap();
function tileOcean(features) {
  if (!Array.isArray(features)) return null;
  if (tileCache.has(features)) return tileCache.get(features);
  const maxRing = (polys) => polys.reduce((m, rings) => Math.max(m, ...rings.map((r) => r.length)), 0);
  const polysOf = (g) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
  if (!features.some((f) => f && f.geometry && maxRing(polysOf(f.geometry)) > TILE_MAX_POINTS)) {
    tileCache.set(features, null);
    return null;
  }
  const densify = (ring) => {
    const out = [];
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = ring[i], [bx, by] = ring[i + 1];
      const k = Math.max(1, Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay)) / 0.5));
      for (let j = 0; j < k; j++) out.push([ax + (bx - ax) * j / k, ay + (by - ay) * j / k]);
    }
    if (ring.length) out.push(ring[ring.length - 1]);
    return out;
  };
  const out = [];
  const emit = (polys, props) => {
    const kept = polys.map((rings) => rings.filter((r) => r.length >= 4).map(densify)).filter((rings) => rings.length);
    if (kept.length) out.push(turf.rewind({ type: "Feature", properties: props, geometry: { type: "MultiPolygon", coordinates: kept } }, { reverse: true }));
  };
  const split = (polys, [W, S, E, N], props, depth) => {
    if (!polys.length) return;
    if (maxRing(polys) <= TILE_MAX_POINTS || depth > 12) return emit(polys, props);
    const mx = (W + E) / 2, my = (S + N) / 2;
    for (const bb of [[W, S, mx, my], [mx, S, E, my], [W, my, mx, N], [mx, my, E, N]]) {
      const parts = [];
      for (const rings of polys) {
        const c = turf.bboxClip({ type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: rings } }, bb).geometry;
        if (c && c.coordinates) for (const p of polysOf(c)) { const r = p.filter((x) => x.length >= 4); if (r.length) parts.push(r); }
      }
      split(parts, bb, props, depth + 1);
    }
  };
  for (const f of features) {
    if (!f || !f.geometry) continue;
    const polys = polysOf(f.geometry);
    if (maxRing(polys) <= TILE_MAX_POINTS) { out.push(f); continue; }
    split(polys, [-180, -90, 180, 90], f.properties || {}, 0);
  }
  tileCache.set(features, out);
  return out;
}

// Per-layer basemap prep for the export:
//   `basemap.<layer>.simplify: <tolerance°>` — turf.simplify the layer (0 / unset = full detail);
//   `basemap.<layer>.rewind: true` — geojson rewind to d3's winding (reverse:true = clockwise
//   exterior), same as the Data panel's ⇄.
// Results are cached per source array + settings, so re-renders don't redo the work.
const bmPrepCache = new WeakMap();
function bmRewind(seg, geom, globalTol = 0) {
  if (!seg || !Array.isArray(geom)) return geom;
  //  A layer's own tolerance wins; blank falls back to the basemap-wide one (a number or auto).
  const tol = Number(seg.simplify) > 0 ? Number(seg.simplify) : globalTol;
  const rw = seg.rewind === true;
  if (!tol && !rw) return geom;
  const key = tol + "|" + rw;
  let byKey = bmPrepCache.get(geom);
  if (!byKey) bmPrepCache.set(geom, (byKey = new Map()));
  if (byKey.has(key)) return byKey.get(key);
  let out = geom.filter((f) => f && f.geometry && f.geometry.type);
  if (tol) out = out.map((f) => bmSimplify(f, tol));
  if (rw) out = out.map((f) => turf.rewind(f, { reverse: true }));
  byKey.set(key, out);
  return out;
}

// AUTO GENERALIZATION: a tolerance from the frame's own scale. One output pixel at the frame centre
// is inverted to lng/lat (the same projection the scalebar measures), and the tolerance is half of
// that span — detail finer than half a pixel can't show — snapped DOWN to a 1-2-5 step so small
// pans/zooms reuse the cached result instead of re-simplifying every render. 0 = can't tell
// (centre off the globe), which means full detail.
const AUTO_PX = 0.5;
export function autoSimplifyTolerance(projection, width, height) {
  if (!projection || !projection.invert || !(width > 0) || !(height > 0)) return 0;
  const cx = width / 2, cy = height / 2;
  const c = projection.invert([cx, cy]), dx = projection.invert([cx + 1, cy]), dy = projection.invert([cx, cy + 1]);
  if (![c, dx, dy].every((q) => q && Number.isFinite(q[0]) && Number.isFinite(q[1]))) return 0;
  const degPerPx = Math.max(d3.geoDistance(c, dx), d3.geoDistance(c, dy)) * 180 / Math.PI;
  const raw = degPerPx * AUTO_PX;
  if (!(raw > 0)) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [5, 2, 1].find((k) => k * mag <= raw) * mag;
  return +step.toPrecision(1);
}

// `basemap.simplify` — the basemap-wide tolerance: "auto" (from the scale, above), a number in
// degrees, or unset/0 for full detail. A layer's own `simplify` overrides it.
export function basemapSimplifyTolerance(basemap, projection, width, height) {
  const g = basemap && basemap.simplify;
  if (g === "auto") return autoSimplifyTolerance(projection, width, height);
  return Number(g) > 0 ? Number(g) : 0;
}

export function drawBasemap({ parent, basemap, BASEMAP, Layer, projection, path, width, height, margin }) {
  if (!basemap.show) return;
  const globalTol = basemapSimplifyTolerance(basemap, projection, width, height);
      if (basemap.ocean.show) {
        // Ocean = the real world-ocean polygon (ocean.json, loaded with rewind disabled so
        // its winding stays sea-inside). Fills water only; land draws on top.
        let oceanGeom = bmRewind(basemap.ocean, basemap.ocean.geometry ?? BASEMAP.ocean, globalTol);
        // The port clips framed maps to the frame (clipExtent); the original Mapa didn't. On a
        // circle-clipped projection (orthographic…) that frame clip turns the world-sized ocean
        // inside-out (the Black Sea lost its fill). So clip the ocean to the area around the frame
        // FIRST — a small polygon frame-clips cleanly. If it can't be (pole / 180° in view), draw it
        // without the frame clip, as the original did.
        const framed = projection.clipExtent && projection.clipExtent();
        const circle = projection.clipAngle && projection.clipAngle();
        let unframe = false;
        if (framed && circle) {
          const trimmed = trimToFrame(oceanGeom, projection, width, height, margin || 0);
          if (trimmed) oceanGeom = trimmed; else unframe = true;
        }
        // Tile the ocean so no outline is too big for Illustrator: as ONE path its coastline ring has up
        // to ~195k points, and Illustrator silently drops a path that large (only the island holes
        // survived). Each tile is its own path, every ring under TILE_MAX_POINTS.
        let tiled = tileOcean(oceanGeom);
        if (tiled && framed) {
          // d3's frame clip mishandles some tiles (they flood the frame) — so draw tiles WITHOUT it,
          // keeping only the tiles near the frame; the export's frame clip-path crops the rest.
          const ext = frameLngLatExtent(projection, width, height, margin || 0);
          if (ext) {
            const [W, S, E, N] = ext;
            tiled = tiled.filter((f) => { const [a, b, c, d] = turf.bbox(f); return a <= E && c >= W && b <= N && d >= S; });
          }
          unframe = true;
        }
        const gocean = parent.append("g").attr("id", "ocean");
        if (unframe) projection.clipExtent(null);
        try {
          new Layer({
            geometry: tiled || oceanGeom,
            group: gocean,
            style: basemap.ocean.style,
            path: path
          }).add;
        } finally { if (unframe) projection.clipExtent(framed); }
        // Holes (land) explicit as even-odd, so Illustrator reads each tile as a compound path.
        gocean.selectAll("path").attr("fill-rule", "evenodd");
      }
      if (basemap.land.show) {
        new Layer({
          geometry: bmRewind(basemap.land, basemap.land.geometry ?? BASEMAP.countries, globalTol),
          group: parent.append("g").attr("id", "land"),
          style: basemap.land.style,
          path: path
        }).add;
      }
      if (basemap.river.show) {
        let rivers = bmRewind(basemap.river, basemap.river.geometry ?? BASEMAP.rivers, globalTol);
        // Scale-dependent detail: drop rivers whose Natural Earth `min_zoom` is above the
        // frame's effective zoom, so a wide view shows only major rivers and a tight view
        // reveals tributaries. effZoom is derived from the framed longitude span (+1 bias so
        // it isn't too bare).
        if (Array.isArray(rivers)) {
          const ring = this.bounds?.feature?.geometry?.coordinates?.[0];
          let span = 360;
          if (Array.isArray(ring) && ring.length) {
            const lons = ring.map((p) => p[0]);
            span = Math.max(...lons) - Math.min(...lons) || 360;
          }
          const effZoom = Math.log2(360 / Math.max(span, 1)) + 1;
          rivers = rivers.filter((d) => (Number(d?.properties?.min_zoom) || 0) <= effZoom);
        }
        const rSel = new Layer({
          geometry: rivers,
          group: parent.append("g").attr("id", "river"),
          style: basemap.river.style,
          path: path
        }).add;
        // Width driven per-feature by Natural Earth `strokeweig` (0.15 tributary → 2.0 major),
        // × the width control (default 1).
        if (rSel && rSel.attr) {
          const m = Number(basemap.river.style?.["stroke-width"]);
          const k = Number.isFinite(m) && m > 0 ? m : 1;
          rSel.attr("stroke-width", (d) => {
            const w = Number(d?.properties?.strokeweig);
            return (Number.isFinite(w) ? w : 0.2) * k;
          });
        }
      }
      if (basemap.border.show) {
        new Layer({
          geometry: bmRewind(basemap.border, basemap.border.geometry ?? BASEMAP.countries, globalTol),
          group: parent.append("g").attr("id", "border"),
          style: basemap.border.style,
          path: path
        }).add;
      }
      if (basemap.innerlines?.show && (basemap.innerlines.geometry ?? BASEMAP.innerlines)) {
        new Layer({
          geometry: bmRewind(basemap.innerlines, basemap.innerlines.geometry ?? BASEMAP.innerlines, globalTol),
          group: parent.append("g").attr("id", "innerlines"),
          style: basemap.innerlines.style,
          path: path
        }).add;
      }
      if (basemap.coastline.show) {
        new Layer({
          geometry: bmRewind(basemap.coastline, basemap.coastline.geometry ?? BASEMAP.coastlines, globalTol),
          group: parent.append("g").attr("id", "coastline"),
          style: basemap.coastline.style,
          path: path
        }).add;
      }
      if (basemap.lake.show) {
        new Layer({
          geometry: bmRewind(basemap.lake, basemap.lake.geometry ?? BASEMAP.lakes, globalTol),
          group: parent.append("g").attr("id", "lakes"),
          style: basemap.lake.style,
          path: path
        }).add;
      }
      // disputed borders draw last so they sit above land/border/coastline.
      if (basemap.disputed?.show && (basemap.disputed.geometry ?? BASEMAP.disputed)) {
        new Layer({
          geometry: bmRewind(basemap.disputed, basemap.disputed.geometry ?? BASEMAP.disputed, globalTol),
          group: parent.append("g").attr("id", "disputed"),
          style: basemap.disputed.style,
          path: path
        }).add;
      }
}
