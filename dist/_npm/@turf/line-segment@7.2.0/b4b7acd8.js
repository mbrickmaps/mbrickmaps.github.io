/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/line-segment@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{featureCollection as r,lineString as t}from"../helpers@7.2.0/28807c9c.js";import{getCoords as n}from"../invariant@7.2.0/671cab78.js";import{flattenEach as e}from"../meta@7.2.0/c0f2fe64.js";function o(o){if(!o)throw new Error("geojson is required");const s=[];return e(o,(r=>{!function(r,e){let o=[];const s=r.geometry;if(null!==s){switch(s.type){case"Polygon":o=n(s);break;case"LineString":o=[n(s)]}o.forEach((n=>{const o=function(r,n){const e=[];return r.reduce(((r,o)=>{const s=t([r,o],n);return s.bbox=function(r,t){const n=r[0],e=r[1],o=t[0],s=t[1];return[n<o?n:o,e<s?e:s,n>o?n:o,e>s?e:s]}(r,o),e.push(s),o})),e}(n,r.properties);o.forEach((r=>{r.id=e.length,e.push(r)}))}))}}(r,s)})),r(s)}var s=o;export{s as default,o as lineSegment};
