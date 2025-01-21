/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/@mapbox/geojson-area@0.2.2/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import e from"../../wgs84@0.0.0/307a0e2e.js";var t={},r=e,n=t.geometry=function e(t){var r,n=0;switch(t.type){case"Polygon":return i(t.coordinates);case"MultiPolygon":for(r=0;r<t.coordinates.length;r++)n+=i(t.coordinates[r]);return n;case"Point":case"MultiPoint":case"LineString":case"MultiLineString":return 0;case"GeometryCollection":for(r=0;r<t.geometries.length;r++)n+=e(t.geometries[r]);return n}},o=t.ring=a;function i(e){var t=0;if(e&&e.length>0){t+=Math.abs(a(e[0]));for(var r=1;r<e.length;r++)t-=Math.abs(a(e[r]))}return t}function a(e){var t,n,o,i,a,c,g=0,u=e.length;if(u>2){for(c=0;c<u;c++)c===u-2?(o=u-2,i=u-1,a=0):c===u-1?(o=u-1,i=0,a=1):(o=c,i=c+1,a=c+2),t=e[o],n=e[i],g+=(s(e[a][0])-s(t[0]))*Math.sin(s(n[1]));g=g*r.RADIUS*r.RADIUS/2}return g}function s(e){return e*Math.PI/180}export{t as default,n as geometry,o as ring};
