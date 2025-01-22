/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/boolean-parallel@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{cleanCoords as r}from"../clean-coords@7.2.0/50050321.js";import{lineSegment as e}from"../line-segment@7.2.0/b4b7acd8.js";import{rhumbBearing as t}from"../rhumb-bearing@7.2.0/841df52f.js";import{bearingToAzimuth as n}from"../helpers@7.2.0/28807c9c.js";function i(t,n){if(!t)throw new Error("line1 is required");if(!n)throw new Error("line2 is required");if("LineString"!==m(t,"line1"))throw new Error("line1 must be a LineString");if("LineString"!==m(n,"line2"))throw new Error("line2 must be a LineString");for(var i=e(r(t)).features,f=e(r(n)).features,u=0;u<i.length;u++){var a=i[u].geometry.coordinates;if(!f[u])break;if(!o(a,f[u].geometry.coordinates))return!1}return!0}function o(r,e){var i=n(t(r[0],r[1])),o=n(t(e[0],e[1]));return i===o||(o-i)%180==0}function m(r,e){if(r.geometry&&r.geometry.type)return r.geometry.type;if(r.type)return r.type;throw new Error("Invalid GeoJSON object for "+e)}var f=i;export{i as booleanParallel,f as default};
