// Shared third-party dependency bundle for every src/mapa/*.js render-engine module. d3 and turf
// are each spread across several npm packages; the original de-notebooked mapa.js reassembled
// them into one `d3`/`turf` object per the source Observable notebook's _d3/_turf cells.
// Centralized here so every extracted module imports the exact same instances, rather than each
// re-running its own bundling and risking two different d3/turf instances coexisting.
import * as _d3base from "../../../_node/d3@5.16.0/index.a480ae5e.js";
import * as _d3geoproj from "../../../_node/d3-geo-projection@2.9.0/index.db467fe7.js";
import * as _d3geopoly from "../../../_node/d3-geo-polygon@2.0.1/index.73600ba0.js";
import * as _d3scalebar from "../../../_node/d3-geo-scale-bar@1.2.5/index.bb796098.js";
import * as _d3array from "../../../_node/d3-array@3.2.4/index.bdb0a72c.js";
// d3-svg-annotation pins d3-selection@1.4.0, but d3@5's d3-drag uses d3-selection@1.4.2 — two
// copies, so the drag event lands on one and the annotation reads null from the other (edit-mode
// drags throw). package.json "overrides" puts it on the same d3-selection/drag/dispatch/transition.
import * as _d3annotation from "../../../_node/d3-svg-annotation@2.5.1/index.5bd207e6.js";
export const d3 = Object.assign({}, _d3base, _d3geoproj, _d3geopoly, _d3scalebar, _d3array, _d3annotation);

import * as _bbox from "../../../_node/@turf/bbox@7.4.0/index.19fd36ca.js";
import * as _bezierSpline from "../../../_node/@turf/bezier-spline@7.4.0/index.c3da304a.js";
import * as _helpers from "../../../_node/@turf/helpers@7.4.0/index.0c2a8294.js";
import * as _simplify from "../../../_node/@turf/simplify@7.4.0/index.26d152b2.js";
import * as _voronoi from "../../../_node/@turf/voronoi@7.4.0/index.2a64ef3b.js";
import * as _bboxPolygon from "../../../_node/@turf/bbox-polygon@7.4.0/index.06a7f815.js";
import * as _squareGrid from "../../../_node/@turf/square-grid@7.4.0/index.b7482a85.js";
import * as _collect from "../../../_node/@turf/collect@7.4.0/index.5c4609cf.js";
import * as _buffer from "../../../_node/@turf/buffer@7.4.0/index.6a51fdcb.js";
import * as _centerOfMass from "../../../_node/@turf/center-of-mass@7.4.0/index.05ef21cd.js";
import * as _envelope from "../../../_node/@turf/envelope@7.4.0/index.6e4b2438.js";
import * as _rewind from "../../../_node/@turf/rewind@7.4.0/index.39e385a1.js";
import * as _booleanPointInPolygon from "../../../_node/@turf/boolean-point-in-polygon@7.4.0/index.b7fb7a40.js";
import * as _bboxClip from "../../../_node/@turf/bbox-clip@7.4.0/index.0301c126.js";
import * as _greatCircle from "../../../_node/@turf/great-circle@7.4.0/index.de9a33fb.js";
import * as _centroid from "../../../_node/@turf/centroid@7.4.0/index.ef93ebe9.js";
export const turf = Object.assign({}, _bbox, _bezierSpline, _helpers, _simplify, _voronoi, _bboxPolygon,
  _squareGrid, _collect, _buffer, _centerOfMass, _envelope, _rewind, _booleanPointInPolygon, _bboxClip,
  _greatCircle, _centroid);

export * as topojson from "../../../_node/topojson-client@3.1.0/index.a55369bb.js";
export { default as proj4 } from "../../../_node/proj4@2.7.5/index.a19c44e2.js";
export { default as polylabel } from "../../../_node/polylabel@1.1.0/index.2a22dd52.js";
export { PMTiles } from "../../../_node/pmtiles@3.0.6/index.ee91aa13.js";
