// translate.js — turn an Atlas project file into Mapa (D3/SVG) settings.
//
// Atlas is the single source of truth for a reference map. Its embed (sandbox.html
// / index.html) renders the project via MapLibre; Mapa renders the SAME project as
// a static vector export. Atlas deliberately reused Mapa's points/polys vocabulary
// (see dev/specs/2026-08-04-sandbox-reference-maps-design.md §"Relationship to
// Mapa"), so much of this is a light key-rename — but three places are genuine
// adapters, not identity, because Mapa's internal contracts differ:
//
//   1. points  — Mapa's addPoints() reads FLAT props (d.color = marker fill, d.size,
//                d.fontSize, d.dir), not Atlas's nested style:{fill,size,'label-*'}.
//   2. polys   — style keys differ: stroke-dash -> stroke-dasharray, line-join ->
//                stroke-linejoin; pattern -> SVG <defs> <pattern>. refUid/source
//                must already be resolved to `geometry` before we get here (Mapa
//                can't query PMTiles); mapa.html resolves `source` files, same as
//                sandbox's resolvePolysData(). refUid is not supported in v1.
//   3. annotations — Atlas's straight-arrow/curved-arrow/text-area become
//                d3-svg-annotation callouts; see atlasAnnotationsToMapa() below.
//
// The merge is three-tier, mirroring Mapa's own deepmerge and Atlas's compositing
// tiers:  Mapa defaults  <-  Atlas project file  <-  per-export overrides.

// NOTE: we return a PARTIAL props object (only the keys we set), not a full
// settings object. The Mapa constructor deep-merges props over its own
// defaultSettings(). Returning a full defaultSettings() here would make the
// constructor re-merge it and recurse into defaults.style (a live <style> DOM
// node) → stack overflow.
import { deepmerge, resolveProjection } from "./mapa.f5ada0a3.js";

// ---------------------------------------------------------------------------
// Style-key normalization (Atlas paint keys -> Mapa SVG presentation attrs).
// DASH_PRESETS / toDashArray mirror sandbox.html exactly so both tools agree.
// ---------------------------------------------------------------------------
const DASH_PRESETS = { solid: null, dashed: [3, 2], dotted: [0, 2] };
function toDashArray(value) {
  if (Array.isArray(value)) return value;
  return DASH_PRESETS[value] ?? null;
}
function dashToSvg(value) {
  const arr = toDashArray(value);
  return arr ? arr.join(' ') : null; // null => no stroke-dasharray (solid)
}

// Atlas poly/annotation style -> SVG attrs. Renames the keys MapLibre and SVG
// spell differently; passes the rest through untouched.
function normalizePolyStyle(s = {}) {
  const style = { ...s };
  if ('stroke-dash' in style) {
    const dash = dashToSvg(style['stroke-dash']);
    if (dash) style['stroke-dasharray'] = dash;
    delete style['stroke-dash'];
  }
  if ('line-join' in style) {
    style['stroke-linejoin'] = style['line-join'];
    delete style['line-join'];
  }
  // pattern / pattern-opacity pass through: Mapa turns style.pattern into a <defs>
  // <pattern> tiling styles/patterns/<name>.png (see settings.patterns).
  return style;
}

// ---------------------------------------------------------------------------
// points: Atlas {name,lng,lat,dir,style:{...}} -> Mapa flat point object.
// ---------------------------------------------------------------------------
function atlasPointToMapa(pt) {
  const s = pt.style || {};
  const lng = pt.lng ?? (pt.latlng ? Number(pt.latlng.split(',')[1].trim()) : undefined);
  const lat = pt.lat ?? (pt.latlng ? Number(pt.latlng.split(',')[0].trim()) : undefined);
  // `size` is a radius for every shape here. Mapa draws a circle with r = size but other shapes via
  // d3.symbol, whose size is an AREA — convert so a star at size 5 matches a circle at size 5.
  // shape "" or "none" = no marker (label only). Missing = circle.
  const shape = s.shape === '' || s.shape === 'none' ? 'none' : (s.shape ?? 'circle');
  // star-dot (capital: a dot with a star knocked out) is drawn as a circle, so it keeps the radius.
  const size = shape === 'circle' || shape === 'star-dot' ? s.size : Math.PI * Math.pow(s.size ?? 5, 2);
  return {
    name: pt.name ?? '',
    lng,
    lat,
    dir: pt.dir ?? 'E',
    type: pt.type,
    group: pt.group ?? pt.class,
    shape,
    size,
    // Mapa addPoints reads d.color as the MARKER fill; label color is set
    // independently via d.label.labelColor so the two don't collapse together.
    color: s.fill,
    stroke: s.stroke,
    'stroke-width': s['stroke-width'],
    opacity: s.opacity,
    fontSize: s['label-size'],
    label: {
      labelColor: s['label-color'],
      haloColor: s['label-halo-color'],
      haloWidth: s['label-halo-width'],
      // Typeface: `label-font` (family), `label-style` (normal | italic), `label-weight` (e.g. 500).
      fontFamily: s['label-font'],
      fontStyle: s['label-style'],
      fontWeight: s['label-weight'],
      // `label-case: "upper"` shows the label in capitals (the CSV keeps the name as typed).
      textCase: s['label-case']
    }
  };
}

// ---------------------------------------------------------------------------
// polys: Atlas {geometry|source(resolved),style,filter} -> Mapa poly config.
// `geometry` must already be resolved (mapa.html expands `source`; `refUid` is
// unsupported here). A bare GeoJSON geometry is wrapped into a FeatureCollection
// so Mapa's Layer.add takes the single-path branch.
// ---------------------------------------------------------------------------
function atlasPolyToMapa(item) {
  let geometry = item.geometry;
  if (
    geometry &&
    geometry.type &&
    geometry.type !== 'FeatureCollection' &&
    geometry.type !== 'Topology' &&
    geometry.coordinates
  ) {
    geometry = {
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry }]
    };
  }
  // `filter` is applied by mapa.html (a property expression) before the geometry gets here, so the
  // engine's old { show, key, value } filter is always off — that form is retired.
  if (item.filter && typeof item.filter === 'object' && item.filter.show) {
    console.warn('[mapa] the { show, key, value } poly filter is retired and ignored — use a filter expression string');
  }
  return {
    geometry,
    style: normalizePolyStyle(item.style),
    filter: { show: false },
    show: item.show,
    ...(item.simplify != null ? { simplify: item.simplify } : {})
  };
}

// ---------------------------------------------------------------------------
// annotations: Atlas straight-arrow / curved-arrow / text-area -> d3-svg-annotation
// items (Mapa's addAnnotations, drawn in the top-most #callouts group). Items already
// in Mapa's own shape (lng/lat + a d3-annotation type) pass through untouched.
//   straight-arrow {start,end}      -> "arrow": zero-radius circle callout, subject (the
//                                      head) at end, empty note at start (the tail).
//   curved-arrow   {start,end,bend} -> "curve-arrow", the same with a bowed connector.
//   text-area      {position,text}  -> "label" with no connector/subject, boxed note.
//   callout        {at,noteAt,text} -> "circle" callout: a small ring at the point, a
//                                      leader to an underlined note (Mapa-only; Atlas skips it).
// ---------------------------------------------------------------------------
// Typed line breaks: d3-annotation's wrap splits on whitespace and re-joins up to the wrap width,
// so "\n" was lost. Split on newlines with a 1px wrap instead → exactly one line per typed line.
// Text without breaks keeps the normal auto-wrap.
// A typed "\n" (backslash-n as text, the way Atlas files write it) counts as a line break too.
const annoText = (text) => String(text || '').replace(/\\n/g, '\n');
const hardBreaks = (text) => (/\n/.test(annoText(text)) ? { wrapSplitter: /\n/, wrap: 1 } : {});

function atlasAnnotationToMapa(a) {
  const s = a.style || {};
  const dash = dashToSvg(s['stroke-dash']);
  const lineStyle = { 'stroke-width': s['stroke-width'] ?? 2, ...(dash ? { 'stroke-dasharray': dash } : {}) };
  if (a.type === 'straight-arrow' || a.type === 'curved-arrow') {
    const [lng, lat] = a.end, curved = a.type === 'curved-arrow';
    return {
      type: curved ? 'curve-arrow' : 'arrow', lng, lat, noteAt: a.start, name: '',
      color: s.stroke || '#000',
      subject: { radius: 0.01, radiusPadding: 0 }, // not 0: d3-annotation treats 0 as unset (default ring)
      ...(a.head ? { head: a.head } : {}),
      ...(curved ? { bend: a.bend ?? 0.25, ...(a.skew ? { skew: a.skew } : {}) } : {}),
      style: lineStyle
    };
  }
  if (a.type === 'callout') {
    const [lng, lat] = a.at;
    // d3-annotation options from the panel (a.d3). Default type is the circle callout: its small
    // ring at the point is what edit mode lets you drag (a plain "callout" has no subject handle).
    const o = a.d3 || {};
    const type = o.type || 'circle';
    const r = o.radius ?? s.radius ?? 3;
    const subject = type === 'rect' ? { width: r * 2, height: r * 2 }
      : type === 'badge' ? { radius: Math.max(r, 8), text: o.badge || '' }
      : { radius: r, radiusPadding: 0 };
    return {
      type, lng, lat, noteAt: a.noteAt, name: annoText(a.text), label: o.label || a.label || null,
      ...(s['text-size'] ? { fontSize: +s['text-size'] } : {}),
      wrap: o.wrap ?? (s['text-max-width'] ?? 12) * 12, color: s.stroke || '#000',
      ...(o.align ? { align: o.align } : {}), ...(o.orientation ? { orientation: o.orientation } : {}),
      ...(o.padding != null ? { padding: o.padding } : {}),
      ...(o.lineType ? { lineType: o.lineType === 'none' ? 'none' : o.lineType } : {}),
      ...(o.end ? { connector: { end: o.end } } : {}),
      subject,
      ...hardBreaks(a.text),
      style: { 'stroke-width': s['stroke-width'] ?? 1, ...(s.color ? { color: s.color } : {}) }
    };
  }
  if (a.type === 'text-area') {
    const [lng, lat] = a.position;
    return {
      type: 'label', lng, lat, dx: 0, dy: 0, name: annoText(a.text),
      ...(s['text-size'] ? { fontSize: +s['text-size'] } : {}),
      wrap: (s['text-max-width'] ?? 10) * 12, align: s.align || 'middle', bgPadding: 6,
      ...hardBreaks(a.text),
      color: s.color || '#000',
      disable: ['connector', 'subject'],
      style: { color: s.color || '#000', fill: s.fill || '#fff', 'fill-opacity': s['fill-opacity'] ?? 1,
        'box-stroke': s.stroke || 'none', 'box-stroke-width': s['stroke-width'] ?? 1 }
    };
  }
  return a.lng != null && a.lat != null ? a : null; // already Mapa-shaped, else unknown: drop
}

export function atlasAnnotationsToMapa(annotations) {
  if (!annotations || !annotations.show) return { show: false, data: [] };
  // src = index in the project's list, so an edit-mode drag can be written back to its entry.
  const data = (annotations.data || [])
    .map((a, i) => { const m = atlasAnnotationToMapa(a); return m && { ...m, src: i }; })
    .filter(Boolean);
  return { show: data.length > 0, data };
}

// ---------------------------------------------------------------------------
// view -> Mapa projection framing.
// Atlas view is a slippy (web-mercator zoom) camera; Mapa fits a d3 projection.
//   - view.bbox      -> a bounds fit (Mapa frames the extent). Accurate for extents.
//   - view.center/zoom -> an exact web-mercator match: d3.geoMercator with
//       scale = 256 * 2^zoom / (2*PI), centred on [lng,lat], translated to canvas
//       centre. This reproduces MapLibre's mercator framing at that zoom/centre
//       (fit:'none' + explicit height so the engine's auto-fit doesn't clobber it).
// If export.projection was already set (applyExportBlock runs first), we don't
// override it — the author opted into a specific projection and should frame via
// view.bbox or export settings.
// ---------------------------------------------------------------------------
// The bbox ring, densified along its parallels. d3-geo draws polygon edges as great circles, so
// a bare 4-corner ring bows its N/S edges poleward and fitSize frames that bulge, not the drawn
// box (a 39°-wide frame at 70°N came out ~1° taller and wider). Vertices every ≤0.5° of
// longitude keep the N/S edges on their parallels; W/E edges are meridians (already great
// circles). Same clockwise order as before; lngs normalised to [-180, 180] so an
// antimeridian-crossing box (W > E) walks east across the seam.
const BBOX_EDGE_STEP = 0.5;
function bboxRing([W, S, E, N]) {
  let span = E - W; if (span < 0) span += 360;
  const n = Math.max(1, Math.ceil(span / BBOX_EDGE_STEP));
  const wrap = (x) => (x > 180 ? x - 360 : x);
  const ring = [[W, S], [W, N]];
  for (let i = 1; i < n; i++) ring.push([wrap(W + (span * i) / n), N]);
  ring.push([E, N], [E, S]);
  for (let i = n - 1; i > 0; i--) ring.push([wrap(W + (span * i) / n), S]);
  ring.push([W, S]);
  return ring;
}
function bboxFeature(bbox) {
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [bboxRing(bbox)] }
  };
}

// Resolve the frame's bbox from a project's view. Atlas treats view.bbox as a fit
// (camera); Mapa treats it as the CLIP boundary. center/zoom is the fallback — it's
// converted to the equivalent web-mercator bbox by inverting the canvas corners.
function bboxFromView(view, props) {
  if (!view) return null;
  if (Array.isArray(view.bbox) && view.bbox.length === 4) return view.bbox;
  if (Array.isArray(view.center) && view.zoom != null) {
    const [lng, lat] = view.center;
    const w = props.width || 1152;
    const h = props.height || Math.round(w * 0.66);
    const k = (256 * Math.pow(2, view.zoom)) / (2 * Math.PI);
    const m = resolveProjection('geoMercator').scale(k).center([lng, lat]).translate([w / 2, h / 2]);
    const nw = m.invert([0, 0]);
    const se = m.invert([w, h]);
    if (nw && se) {
      props.height = h;
      return [nw[0], se[1], se[0], nw[1]];
    }
  }
  return null;
}

// Hand the bbox to the engine's bounds/bounder path (fitSize to the bbox feature).
// The engine fits the projection and clips it to the canvas, so the export comes out
// clipped to this bbox.
function frameToBbox(props, bbox) {
  props.bounds = props.bounds || {};
  // The engine fits the projection to bounds.feature (mapa.js:3965) — set it directly.
  // It also rebuilds the feature from bounds.coordinates, so both get the densified ring.
  props.bounds.feature = bboxFeature(bbox);
  props.bounds.coordinates = [bboxRing(bbox)];
  props.bounds.bounder = true;
}

// ---------------------------------------------------------------------------
// export block -> Mapa top-level settings (projection/basemap/graticule/scalebar/
// graphic/width/height/simplify). These are the sections MapLibre provides the
// embed natively and that Atlas's project format intentionally omits, so they live
// under a dedicated `export` key that the embed ignores. projection.proj is a
// STRING name here (JSON can't hold d3.geoMiller()); resolveProjection() turns it
// into the d3 factory.
// ---------------------------------------------------------------------------
function applyExportBlock(exp, props) {
  if (!exp) return;
  // tiles/raster/grids live under Mapa's `layer.*`, not top-level — route them
  // there. Everything else (basemap/scalebar/graticule/graphic/width/height/
  // simplify) is a top-level Mapa setting and copies straight across.
  const { projection, tiles, raster, grids, ...rest } = exp;
  Object.assign(props, rest);

  if (projection) {
    props.projection = { ...projection };
    if (typeof props.projection.proj === 'string') {
      // Keep the name — mapa.js render() reads projection.name to detect azimuthal projections
      // that must be centred by rotating the globe. Resolving to a function here would otherwise
      // erase the identity before the engine's constructor could capture it.
      props.projection.name = props.projection.proj;
      props.projection.proj = resolveProjection(props.projection.proj);
    }
    // The `custom` render path (mapa.js) reads projection.translate directly — a
    // MapLibre-driven satellite camera supplies scale/rotate/tilt/distance but not
    // translate, so center it on the canvas here (width/height are in `rest`, already
    // assigned above).
    if (props.projection.type === 'custom' && !props.projection.translate) {
      props.projection.translate = [(props.width || 960) / 2, (props.height || 600) / 2];
    }
  }

  // Raster tile layers (XYZ / custom / debug / PMTiles) and image+worldfile
  // overlays. `export.tiles` reads the same PMTiles the embed uses — point a
  // { "type": "pmtiles", "url": "./pmtiles/<file>.pmtiles" } entry at it instead
  // of checking in TopoJSON. Shapes pass through to Mapa's layer.tiles/raster
  // verbatim (see defaultSettings: tiles{show,mime,quality,data:[{id,type,url,
  // zoom,delta,colorRamp,blendMode,...}]}, raster{show,data:[{image,worldfile}]}).
  props.layer = props.layer || {};
  if (tiles) props.layer.tiles = tiles;
  if (raster) props.layer.raster = raster;
  if (grids) props.layer.grids = grids;
}

// ---------------------------------------------------------------------------
// The crux. Deep-merge the three tiers, then adapt to Mapa's settings shape.
//   base      = Mapa defaultSettings()
//   project   = the Atlas project file (points/polys/annotations/view/export)
//   overrides = per-export tweaks, deep-merged LAST (win over the file)
// Returns a plain settings object ready for `renderMap(settings)`.
// ---------------------------------------------------------------------------
export function atlasProjectToMapaSettings(project = {}, overrides = {}) {
  // Merge project <- overrides first so an override can retarget e.g. view.bbox or
  // export.projection before we translate. Arrays replace (not concat), matching
  // Mapa's own deepmerge config.
  const merged = deepmerge(project, overrides);

  // Partial props — only the keys we set. The Mapa constructor deep-merges this
  // over defaultSettings(), so unset sections keep their engine defaults.
  const props = { layer: {} };

  // Shared sections (Atlas mirrors Mapa's names) ---------------------------
  props.layer.points = {
    show: merged.points?.show ?? false,
    dirDefaults: merged.points?.dirDefaults ?? {},
    data: (merged.points?.data || []).map(atlasPointToMapa)
  };
  props.layer.polys = {
    show: merged.polys?.show ?? false,
    data: (merged.polys?.data || []).map(atlasPolyToMapa)
  };
  props.layer.annotations = atlasAnnotationsToMapa(merged.annotations);
  // Fonts panel: { annotations: {family, weight, style}, labels: {…} } — passed straight through.
  if (merged.fonts && typeof merged.fonts === 'object') props.fonts = merged.fonts;

  // Export-only settings first (may set width/height/basemap/etc), then framing.
  applyExportBlock(merged.export, props);

  // Satellite is a self-contained tilted-perspective camera (rotate/tilt/distance/
  // scale come straight from the MapLibre nav pane) — it must NOT be reframed to a
  // bbox (fitExtent/clipExtent would clobber the camera). It also needs an explicit
  // height, since a bbox-less render would otherwise auto-fit to the sphere.
  const isSatellite = merged.export?.projection?.proj === 'geoSatellite';
  if (isSatellite && props.height == null) props.height = props.width;

  // Framing = clipping for Mapa. If the project is framed (view.bbox, or center/zoom
  // as a fallback), fit the projection to that bbox AND clipExtent to it — the bbox
  // is the clip. No bbox = whole-world export, no clip. The projection name comes
  // from export.projection.proj if given, else the engine default (geoMiller).
  const bbox = isSatellite ? null : bboxFromView(merged.view, props);
  if (bbox) frameToBbox(props, bbox);

  // Locator inset — top-level `inset` in the Atlas project (sibling of points/polys/view), passed
  // straight to Mapa's inset renderer. Schema is shared verbatim (position/size/center/zoom/
  // projection/bbox/border/radius/vignette); see mapa.js drawInset for what v1 renders.
  if (merged.inset) props.inset = merged.inset;

  return props;
}

export default atlasProjectToMapaSettings;
