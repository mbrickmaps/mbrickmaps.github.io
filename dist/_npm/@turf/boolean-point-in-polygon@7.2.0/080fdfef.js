/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/boolean-point-in-polygon@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import r from"../../point-in-polygon-hao@1.2.4/7fcd18e4.js";import{getCoord as o,getGeom as n}from"../invariant@7.2.0/671cab78.js";function t(t,e,i={}){if(!t)throw new Error("point is required");if(!e)throw new Error("polygon is required");const f=o(t),u=n(e),p=u.type,a=e.bbox;let m=u.coordinates;if(a&&!1===function(r,o){return o[0]<=r[0]&&o[1]<=r[1]&&o[2]>=r[0]&&o[3]>=r[1]}(f,a))return!1;"Polygon"===p&&(m=[m]);let s=!1;for(var l=0;l<m.length;++l){const o=r(f,m[l]);if(0===o)return!i.ignoreBoundary;o&&(s=!0)}return s}var e=t;export{t as booleanPointInPolygon,e as default};
