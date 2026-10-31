// Shared third-party dependency bundle for every src/mapa/*.js render-engine module. d3 and turf
// are each spread across several npm packages; the original de-notebooked mapa.js reassembled
// them into one `d3`/`turf` object per the source Observable notebook's _d3/_turf cells.
// Centralized here so every extracted module imports the exact same instances, rather than each
// re-running its own bundling and risking two different d3/turf instances coexisting.
import * as _d3base from "d3";
import * as _d3geoproj from "d3-geo-projection";
import * as _d3geopoly from "d3-geo-polygon";
import * as _d3scalebar from "d3-geo-scale-bar";
import * as _d3array from "d3-array";
// d3-svg-annotation pins d3-selection@1.4.0, but d3@5's d3-drag uses d3-selection@1.4.2 — two
// copies, so the drag event lands on one and the annotation reads null from the other (edit-mode
// drags throw). package.json "overrides" puts it on the same d3-selection/drag/dispatch/transition.
import * as _d3annotation from "d3-svg-annotation";
export const d3 = Object.assign({}, _d3base, _d3geoproj, _d3geopoly, _d3scalebar, _d3array, _d3annotation);

import * as _bbox from "@turf/bbox";
import * as _bezierSpline from "@turf/bezier-spline";
import * as _helpers from "@turf/helpers";
import * as _simplify from "@turf/simplify";
import * as _voronoi from "@turf/voronoi";
import * as _bboxPolygon from "@turf/bbox-polygon";
import * as _squareGrid from "@turf/square-grid";
import * as _collect from "@turf/collect";
import * as _buffer from "@turf/buffer";
import * as _centerOfMass from "@turf/center-of-mass";
import * as _envelope from "@turf/envelope";
import * as _rewind from "@turf/rewind";
import * as _booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import * as _bboxClip from "@turf/bbox-clip";
import * as _greatCircle from "@turf/great-circle";
import * as _centroid from "@turf/centroid";
export const turf = Object.assign({}, _bbox, _bezierSpline, _helpers, _simplify, _voronoi, _bboxPolygon,
  _squareGrid, _collect, _buffer, _centerOfMass, _envelope, _rewind, _booleanPointInPolygon, _bboxClip,
  _greatCircle, _centroid);

export * as topojson from "topojson-client";
export { default as proj4 } from "proj4";
export { default as polylabel } from "polylabel";
export { PMTiles } from "pmtiles";
