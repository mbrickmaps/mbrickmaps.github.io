/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/geojson-area@0.1.0/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import t from"../wgs84@0.0.0/307a0e2e.js";var r={},n=t,e=r.geometry=function(t){if("Polygon"===t.type)return a(t.coordinates);if("MultiPolygon"===t.type){for(var r=0,n=0;n<t.coordinates.length;n++)r+=a(t.coordinates[n]);return r}return null},o=r.ring=i;function a(t){var r=0;if(t&&t.length>0){r+=Math.abs(i(t[0]));for(var n=1;n<t.length;n++)r-=Math.abs(i(t[n]))}return r}function i(t){var r=0;if(t.length>2){for(var e,o,a=0;a<t.length-1;a++)e=t[a],r+=f((o=t[a+1])[0]-e[0])*(2+Math.sin(f(e[1]))+Math.sin(f(o[1])));r=r*n.RADIUS*n.RADIUS/2}return r}function f(t){return t*Math.PI/180}export{r as default,e as geometry,o as ring};
