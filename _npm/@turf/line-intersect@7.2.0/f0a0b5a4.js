/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/line-intersect@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{feature as e,featureCollection as t,point as n}from"../helpers@7.2.0/28807c9c.js";import o from"../../sweepline-intersections@1.5.0/96af2410.js";var p=o;function r(o,r,i={}){const{removeDuplicates:s=!0,ignoreSelfIntersections:l=!0}=i;let u=[];"FeatureCollection"===o.type?u=u.concat(o.features):"Feature"===o.type?u.push(o):"LineString"!==o.type&&"Polygon"!==o.type&&"MultiLineString"!==o.type&&"MultiPolygon"!==o.type||u.push(e(o)),"FeatureCollection"===r.type?u=u.concat(r.features):"Feature"===r.type?u.push(r):"LineString"!==r.type&&"Polygon"!==r.type&&"MultiLineString"!==r.type&&"MultiPolygon"!==r.type||u.push(e(r));const y=p(t(u),l);let a=[];if(s){const e={};y.forEach((t=>{const n=t.join(",");e[n]||(e[n]=!0,a.push(t))}))}else a=y;return t(a.map((e=>n(e))))}var i=r;export{i as default,r as lineIntersect};
