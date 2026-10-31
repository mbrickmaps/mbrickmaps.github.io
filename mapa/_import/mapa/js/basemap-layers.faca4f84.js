// ============================================================================
//  BASEMAP LAYERS — single source of truth
// ----------------------------------------------------------------------------
//  Add, restyle, reorder or re-toggle a basemap layer by editing THIS list.
//  Two places read it:
//    • the data loader (loadBasemapData, mapa.js) derives which files to fetch
//      from `file`/`fileName`/`rewind`;
//    • the Basemap panel (mapa.md) derives its layer rows, default styling and
//      which layers start on from `key`/`label`/style props/`defaultOn`.
//  Paint order + which loaded geometry each layer draws live in basemap.js
//  (drawBasemap) — that's render logic, not layer definition.
//
//  Fields
//    key         UI/layer id used throughout the editor and export.basemap[key]
//    label       what the Basemap panel shows
//    file        data-file stem to load (the BASEMAP[...] bucket it fills); two
//                layers may share one file (land + border both use `countries`)
//    fileName    actual filename stem if it differs from `file` (disputed)
//    rewind      false to skip the >2π winding-flip heuristic (ocean)
//    defaultOn   layer starts enabled on a fresh/blank project
//    stroke / strokeWidth / fill / fillOpacity   default style
//    simplify    default simplify tolerance in degrees (e.g. 0.01) — omit/blank = use basemap.simplify
//                (the panel's generalize setting: "auto" from the frame scale, a number, or off).
//                A project can still override it per layer; this is just the starting value.
//
//  Order is the panel's top-to-bottom order.
// ============================================================================
export const BASEMAP_LAYERS = [
  { key: "disputed",   label: "disputed",   file: "disputed",   fileName: "disputed_2026", defaultOn: true,  stroke: "#9A9993", strokeWidth: 0.8 },
  { key: "lake",       label: "lake",       file: "lakes",                                 defaultOn: true,  fill: "#c1d5da" },
  { key: "coastline",  label: "coastline",  file: "coastlines",                            defaultOn: false, stroke: "#A7BBC0", strokeWidth: 0.6 },
  { key: "innerlines", label: "innerlines", file: "innerlines",                            defaultOn: true,  stroke: "#9A9993", strokeWidth: 0.5 },
  { key: "border",     label: "border",     file: "countries",                             defaultOn: false, stroke: "#9A9993", strokeWidth: 0.5 },
  { key: "river",      label: "river",      file: "rivers",                                defaultOn: false, stroke: "#c1d5da", strokeWidth: 1 },
  { key: "land",       label: "land",       file: "countries",                             defaultOn: true,  fill: "#efeee8", fillOpacity: 1 },
  { key: "ocean",      label: "ocean",      file: "ocean",      rewind: false,             defaultOn: true,  fill: "#c1d5da" },
];

// Unique data-file stems to fetch (land + border share `countries`, so dedupe).
export const BASEMAP_FILES = [...new Set(BASEMAP_LAYERS.map((l) => l.file))];

// ----------------------------------------------------------------------------
//  ATLAS (navigation pane) BASEMAP STYLE
// ----------------------------------------------------------------------------
//  The SVG export's basemap is the layer list above. The interactive Atlas pane
//  (sandbox.html, MapLibre) draws its own basemap from a style, set here:
//
//    "light" / "dark"              a built-in style (./styles/style-<name>.json)
//    "something.json"              a style file in ./styles
//    "./…/style.json" or URL       any MapLibre style.json, local or remote
//    "./…/x.pmtiles" or URL        a raw PMTiles archive — wrapped as a raster
//                                  basemap automatically (vector PMTiles need a
//                                  style.json that sources them instead)
//
//  Change this value to swap the Atlas basemap. The light/dark toggle in the
//  Atlas pane still works as a runtime override on top of this default.
export const ATLAS_STYLE = "dark";
