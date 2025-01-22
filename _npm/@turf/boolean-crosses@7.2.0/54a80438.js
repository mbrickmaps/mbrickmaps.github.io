/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/boolean-crosses@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{lineIntersect as r}from"../line-intersect@7.2.0/f0a0b5a4.js";import{polygonToLine as t}from"../polygon-to-line@7.2.0/f6343f87.js";import{booleanPointInPolygon as e}from"../boolean-point-in-polygon@7.2.0/080fdfef.js";import{getGeom as o}from"../invariant@7.2.0/671cab78.js";import{point as n}from"../helpers@7.2.0/28807c9c.js";function a(t,e){var n=o(t),a=o(e),f=n.type,l=a.type;switch(f){case"MultiPoint":switch(l){case"LineString":return i(n,a);case"Polygon":return u(n,a);default:throw new Error("feature2 "+l+" geometry not supported")}case"LineString":switch(l){case"MultiPoint":return i(a,n);case"LineString":return function(t,e){if(r(t,e).features.length>0)for(var o=0;o<t.coordinates.length-1;o++)for(var n=0;n<e.coordinates.length-1;n++){var a=!0;if(0!==n&&n!==e.coordinates.length-2||(a=!1),c(t.coordinates[o],t.coordinates[o+1],e.coordinates[n],a))return!0}return!1}(n,a);case"Polygon":return s(n,a);default:throw new Error("feature2 "+l+" geometry not supported")}case"Polygon":switch(l){case"MultiPoint":return u(a,n);case"LineString":return s(a,n);default:throw new Error("feature2 "+l+" geometry not supported")}default:throw new Error("feature1 "+f+" geometry not supported")}}function i(r,t){for(var e=!1,o=!1,n=r.coordinates.length,a=0;a<n&&!e&&!o;){for(var i=0;i<t.coordinates.length-1;i++){var s=!0;0!==i&&i!==t.coordinates.length-2||(s=!1),c(t.coordinates[i],t.coordinates[i+1],r.coordinates[a],s)?e=!0:o=!0}a++}return e&&o}function s(e,o){const n=t(o);return r(e,n).features.length>0}function u(r,t){var o=!1,a=!1,i=r.coordinates.length;for(let s=0;s<i&&(!o||!a);s++)e(n(r.coordinates[s]),t)?o=!0:a=!0;return a&&o}function c(r,t,e,o){var n=e[0]-r[0],a=e[1]-r[1],i=t[0]-r[0],s=t[1]-r[1];return 0==n*s-a*i&&(o?Math.abs(i)>=Math.abs(s)?i>0?r[0]<=e[0]&&e[0]<=t[0]:t[0]<=e[0]&&e[0]<=r[0]:s>0?r[1]<=e[1]&&e[1]<=t[1]:t[1]<=e[1]&&e[1]<=r[1]:Math.abs(i)>=Math.abs(s)?i>0?r[0]<e[0]&&e[0]<t[0]:t[0]<e[0]&&e[0]<r[0]:s>0?r[1]<e[1]&&e[1]<t[1]:t[1]<e[1]&&e[1]<r[1])}var f=a;export{a as booleanCrosses,f as default};