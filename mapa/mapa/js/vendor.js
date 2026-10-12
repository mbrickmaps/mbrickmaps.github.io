// Shared third-party dependency bundle for every src/mapa/*.js render-engine module. d3 and turf
// are each spread across several CDN packages; the original de-notebooked mapa.js reassembled
// them into one `d3`/`turf` object per the source Observable notebook's _d3/_turf cells.
// Centralized here so every extracted module imports the exact same instances, rather than each
// re-running its own bundling and risking two different d3/turf instances coexisting.
import * as _d3base from "https://esm.sh/d3@5";
import * as _d3geoproj from "https://esm.sh/d3-geo-projection@2";
import * as _d3geopoly from "https://esm.sh/d3-geo-polygon";
import * as _d3scalebar from "https://esm.sh/d3-geo-scale-bar";
import * as _d3array from "https://esm.sh/d3-array";
// d3-svg-annotation pins d3-selection@1.4.0, but its d3-drag resolves d3-selection@1 (1.4.2) — two
// copies, so the drag event lands on one and the annotation reads null from the other (edit-mode
// drags throw). ?deps= puts it on the same d3-selection/drag/dispatch instances d3@5 uses.
import * as _d3annotation from "https://esm.sh/d3-svg-annotation@2.5.1?deps=d3-selection@1.4.2,d3-drag@1.2.5,d3-dispatch@1.0.6";
export const d3 = Object.assign({}, _d3base, _d3geoproj, _d3geopoly, _d3scalebar, _d3array, _d3annotation);

export const turf = Object.assign(
  {},
  ...(await Promise.all([
    import("https://esm.sh/@turf/bbox@7"),
    import("https://esm.sh/@turf/bezier-spline@7"),
    import("https://esm.sh/@turf/helpers@7"),
    import("https://esm.sh/@turf/simplify@7"),
    import("https://esm.sh/@turf/voronoi@7"),
    import("https://esm.sh/@turf/bbox-polygon@7"),
    import("https://esm.sh/@turf/square-grid@7"),
    import("https://esm.sh/@turf/collect@7"),
    import("https://esm.sh/@turf/buffer@7"),
    import("https://esm.sh/@turf/center-of-mass@7"),
    import("https://esm.sh/@turf/envelope"),
    import("https://esm.sh/@turf/rewind@7"),
    import("https://esm.sh/@turf/boolean-point-in-polygon@7"),
    import("https://esm.sh/@turf/bbox-clip@7"),
    import("https://esm.sh/@turf/great-circle@7"),
    import("https://esm.sh/@turf/centroid@7")
  ]))
);

export * as topojson from "https://esm.sh/topojson-client@3";
export { default as proj4 } from "https://esm.sh/proj4@2.7.5";
export { default as polylabel } from "https://esm.sh/polylabel@1.1.0";
export { PMTiles } from "https://esm.sh/pmtiles@3.0.6";
