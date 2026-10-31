// Locator inset rendering, extracted from mapa.js (Phase 1 decomposition). drawInset takes
// `d3` as an explicit parameter (unchanged from before this move) rather than importing it,
// since its one call site already had it in scope.
import { turf } from "./vendor.4692b715.js";

// A lng/lat bbox [W,S,E,N] as a densified polygon ring, so its edges curve correctly under any
// projection (a 4-point rect would draw as straight screen lines on a globe).
function bboxToDensePolygon([w, s, e, n], step = 2) {
  const ring = [];
  for (let x = w; x < e; x += step) ring.push([x, s]);
  for (let y = s; y < n; y += step) ring.push([e, y]);
  for (let x = e; x > w; x -= step) ring.push([x, n]);
  for (let y = n; y > s; y -= step) ring.push([w, y]);
  ring.push([w, s]);
  return { type: "Polygon", coordinates: [ring] };
}

// Trace a projection's viewport footprint as a lng/lat ring by INVERSE-PROJECTING points along the
// canvas edges. Used for the inset "you are here" marker when the export has no rectangular bbox
// (satellite / tilted camera): the visible extent is exactly what the projection inverts to. Points
// in "sky" (off the facing surface) invert to null and are skipped. Returns a closed ring or null.
function traceFootprint(proj, w, h, per = 24) {
  if (!proj || typeof proj.invert !== "function") return null;
  const pts = [];
  const edge = (x0, y0, x1, y1) => {
    for (let i = 0; i < per; i++) {
      const t = i / per;
      const ll = proj.invert([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
      if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) pts.push(ll);
    }
  };
  edge(0, 0, w, 0); edge(w, 0, w, h); edge(w, h, 0, h); edge(0, h, 0, 0);
  if (pts.length < 3) return null;
  pts.push(pts[0]); // close the ring
  return pts;
}

// Draw the locator inset into `parent` (the bounder-clipped content group). Self-contained: its
// own d3 projection + the coarse insetBasemap world. v1 scope — ocean + innerlines geometry, an
// optional "you are here" rectangle from inset.bbox.coords, border/radius/vignette. Deferred to a
// follow-up (see dev/BACKLOG.md): labels, `follow` framing, and bbox.refUid resolution.
export function drawInset({ parent, inset, d3, width, height, defs, uid, mainProjection, isSatellite, insetBasemap }) {
  const size = +inset.size || 160;
  const margin = Number.isFinite(inset.margin) ? inset.margin : 12;
  const pos = inset.position || "bottom-right";
  // Top-left corner of the size×size inset box, anchored to the requested viewport corner.
  let bx = width - size - margin, by = height - size - margin;
  if (String(pos).includes("top")) by = margin;
  if (String(pos).includes("left")) bx = margin;

  // Wrapper carries the corner translate + the id; the map is a clipped child and the border a
  // sibling, so the whole inset (map + border) moves/pins as one unit under the output zoom.
  const wrap = parent.append("g").attr("id", "inset").attr("transform", `translate(${bx}, ${by})`);
  const g = wrap.append("g");

  // Clip the map content to the inset box (rounded per inset.radius; "%" is of the half-size).
  const clipId = `inset-clip-${uid}`;
  const r = typeof inset.radius === "string" && inset.radius.trim().endsWith("%")
    ? (parseFloat(inset.radius) / 100) * (size / 2)
    : (+inset.radius || 0);
  defs.append("clipPath").attr("id", clipId).append("rect")
    .attr("width", size).attr("height", size).attr("rx", r).attr("ry", r);
  g.attr("clip-path", `url(#${clipId})`);

  const cx = size / 2, cy = size / 2;
  const isGlobe = inset.projection === "globe" || inset.projection === "orthographic";
  const center = Array.isArray(inset.center) ? inset.center : [0, 0];
  const zoom = Number.isFinite(inset.zoom) ? inset.zoom : (isGlobe ? null : 1);
  // MapLibre zoom → d3 projection scale k: world width (2π·k) equals MapLibre's 256·2^zoom.
  const kFromZoom = (z) => (256 * Math.pow(2, z)) / (2 * Math.PI);

  let projection;
  if (isGlobe) {
    // v1 globe: orthographic, rotated to `center`. zoom scale is approximate (same k as flat);
    // no zoom = whole hemisphere fills the box.
    // zoom is relative to the box (calibrated at the default 160px), so a bigger inset frames the
    // same view, just larger — in absolute px a 400px box at zoom 2 drew a 163px-radius globe inside
    // a 200px ring. Never smaller than the box: the sphere always reaches the round frame.
    const gscale = zoom == null ? size / 2 : Math.max(size / 2, kFromZoom(zoom) * (size / 160));
    // Clip to the visible cap sized to the box's corner radius, so the sphere fills the frame when
    // zoomed in and shows a hemisphere (90°) when zoomed out. Land is drawn from proper polygons
    // (inset-land) that render stably at any clip, so no cap is needed.
    const gclip = (Math.asin(Math.min(1, ((size / 2) * Math.SQRT2) / gscale)) * 180) / Math.PI;
    projection = d3.geoOrthographic()
      .rotate([-center[0], -center[1]])
      .translate([cx, cy])
      .scale(gscale)
      .clipAngle(gclip);
  } else {
    projection = d3.geoMercator()
      .center(center)
      .translate([cx, cy])
      .scale(kFromZoom(zoom));
  }
  const path = d3.geoPath(projection);

  // Layering: background = LAND (so land areas show as the base colour), then the ocean polygon
  // painted ON TOP in blue carves out the seas — with only ocean+innerlines (no land polygon), the
  // land IS the background. Globe: fill the projected sphere so only the disk is coloured; flat:
  // fill the whole box.
  // `show: false` on land / ocean / innerlines / border hides that layer (a hidden fill → "none").
  const landFill = inset.land?.show === false ? "none" : (inset.land?.style?.fill || "#efeee8");
  const oceanFill = inset.ocean?.show === false ? "none" : (inset.ocean?.style?.fill || "#c1d5da");
  if (isGlobe) {
    // Globe: sphere = OCEAN, coarse land polygons (inset-land, world-atlas land-110m) on top. Proper
    // polygons render stably at any rotation/zoom; the flat sea-inside ocean sheet drops island holes
    // non-deterministically under the spherical clip, so it's NOT used on the globe.
    g.append("path").attr("d", path({ type: "Sphere" })).attr("fill", oceanFill).attr("stroke", "none");
    if (Array.isArray(insetBasemap.land) && insetBasemap.land.length) {
      g.append("path").datum({ type: "FeatureCollection", features: insetBasemap.land })
        .attr("d", path).attr("fill", landFill).attr("stroke", "none");
    }
  } else {
    // Flat mercator: land background + the sea-inside ocean sheet on top (renders correctly on a flat
    // projection, where there's no spherical clip to re-close the sheet's winding).
    g.append("rect").attr("width", size).attr("height", size).attr("fill", landFill);
    if (Array.isArray(insetBasemap.ocean) && insetBasemap.ocean.length) {
      g.append("path").datum({ type: "FeatureCollection", features: insetBasemap.ocean })
        .attr("d", path).attr("fill", oceanFill).attr("stroke", "none");
    }
  }
  // Coarse boundaries (innerlines). Lines by default (fill:none) — a plain ocean-and-borders locator.
  if (inset.innerlines?.show !== false && Array.isArray(insetBasemap.innerlines) && insetBasemap.innerlines.length) {
    const il = inset.innerlines?.style || {};
    g.append("path").datum({ type: "FeatureCollection", features: insetBasemap.innerlines })
      .attr("d", path)
      .attr("fill", il.fill || "none")
      .attr("stroke", il.stroke || "#9A9993")
      .attr("stroke-width", il["stroke-width"] ?? 0.4)
      .attr("stroke-dasharray", il["stroke-dasharray"] || null)
      .attr("stroke-opacity", il["stroke-opacity"] ?? null)
      .attr("stroke-linecap", il["stroke-dasharray"] ? "round" : null);
  }

  // "You are here" marker. marker: "rect" (default) | "dot" | "none".
  const bb = inset.bbox;
  const marker = bb && bb.marker ? bb.marker : "rect";
  if (bb && marker !== "none") {
    const s = bb.style || {};
    const dot = (p) => { if (p && Number.isFinite(p[0]) && Number.isFinite(p[1]))
      g.append("circle").attr("cx", p[0]).attr("cy", p[1]).attr("r", s.r ?? 4)
        .attr("fill", s.fill || "#f42f2f").attr("fill-opacity", s["fill-opacity"] ?? 1)
        .attr("stroke", s.stroke || "#f42f2f").attr("stroke-width", s["stroke-width"] ?? 1.5)
        .attr("opacity", s.opacity ?? 1); };
    const styleShape = (sel) => sel.attr("fill", s.fill || "none").attr("fill-opacity", s["fill-opacity"] ?? 1)
      .attr("stroke", s.stroke || "#f42f2f").attr("stroke-width", s["stroke-width"] ?? 1.5).attr("opacity", s.opacity ?? 1);

    if (Array.isArray(bb.coords) && bb.coords.length === 4) {
      // Flat export: rect from the bbox, drawn via geoPath so its edges curve under the inset projection.
      if (marker === "dot") dot(projection([(bb.coords[0] + bb.coords[2]) / 2, (bb.coords[1] + bb.coords[3]) / 2]));
      else styleShape(g.append("path").datum(turf.rewind({ type: "Feature", properties: {}, geometry: bboxToDensePolygon(bb.coords) }, { reverse: true })).attr("d", path));
    } else if (isSatellite && mainProjection) {
      // Satellite/tilted: no rectangular bbox — inverse-project the canvas footprint, PROJECT the
      // points into the inset, then take the convex hull. A perspective footprint is convex, so the
      // hull is the true outline and drops limb/ordering artifacts (the stray "buttout" spike).
      const geo = traceFootprint(mainProjection, width, height);
      const scr = (geo || []).map((ll) => projection(ll)).filter((p) => p && Number.isFinite(p[0]) && Number.isFinite(p[1]));
      const hull = scr.length >= 3 ? d3.polygonHull(scr) : null;
      if (hull) {
        if (marker === "dot") dot(d3.polygonCentroid(hull));
        else styleShape(g.append("path").attr("d", "M" + hull.map((p) => p[0].toFixed(2) + "," + p[1].toFixed(2)).join("L") + "Z"));
      }
    } else if (bb.refUid) {
      console.warn("[inset] bbox.refUid is not supported in v1 — use bbox.coords");
    }
  }
  // NB: `follow` is handled UI-side — the panel writes the live view centre into inset.center when
  // unlocked — so drawInset just consumes inset.center regardless.

  // Edge vignette (inner darkening), drawn over the map but inside the clip.
  const vg = inset.vignette;
  if (vg && vg.show !== false && (vg.color || vg.opacity != null)) {
    const vgId = `inset-vg-${uid}`;
    const grad = defs.append("radialGradient").attr("id", vgId)
      .attr("cx", "50%").attr("cy", "50%").attr("r", "50%");
    grad.append("stop").attr("offset", "60%").attr("stop-color", vg.color || "#000").attr("stop-opacity", 0);
    grad.append("stop").attr("offset", "100%").attr("stop-color", vg.color || "#000").attr("stop-opacity", vg.opacity ?? 0.35);
    g.append("rect").attr("width", size).attr("height", size).attr("fill", `url(#${vgId})`).attr("pointer-events", "none");
  }

  // Border, drawn OUTSIDE the clip (on parent) so the full stroke width shows.
  const bd = inset.border;
  if (bd && bd.color !== null && bd.show !== false) {
    wrap.append("rect")
      .attr("x", 0).attr("y", 0).attr("width", size).attr("height", size)
      .attr("rx", r).attr("ry", r)
      .attr("fill", "none")
      .attr("stroke", bd?.color || "#000")
      .attr("stroke-width", bd?.width ?? 1)
      .attr("stroke-dasharray", bd?.dash || null);
  }
}
