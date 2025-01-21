/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/geojson-rewind@0.1.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import e from"../geojson-area@0.1.0/be7de90b.js";var r=e,t=function e(r,t){switch(r&&r.type||null){case"FeatureCollection":return r.features=r.features.map(n(e,t)),r;case"Feature":return r.geometry=e(r.geometry,t),r;case"Polygon":case"MultiPolygon":return function(e,r){"Polygon"===e.type?e.coordinates=o(e.coordinates,r):"MultiPolygon"===e.type&&(e.coordinates=e.coordinates.map(n(o,r)));return e}(r,t);default:return r}};function n(e,r){return function(t){return e(t,r)}}function o(e,r){r=!!r,e[0]=u(e[0],!r);for(var t=1;t<e.length;t++)e[t]=u(e[t],r);return e}function u(e,t){return function(e){return r.ring(e)>=0}(e)===t?e:e.reverse()}export{t as default};
