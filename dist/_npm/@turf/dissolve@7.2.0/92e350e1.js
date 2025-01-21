/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/dissolve@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{isObject as r,multiPolygon as t,featureCollection as o}from"../helpers@7.2.0/28807c9c.js";import{collectionOf as e}from"../invariant@7.2.0/671cab78.js";import{featureEach as p}from"../meta@7.2.0/c0f2fe64.js";import{flatten as n}from"../flatten@7.2.0/0b0c0de3.js";import*as s from"../../polyclip-ts@0.16.8/800c7e0e.js";function i(i,m={}){if(!r(m=m||{}))throw new Error("options is invalid");const{propertyName:u}=m;e(i,"Polygon","dissolve");const a=[];if(!u)return n(t(s.union.apply(null,i.features.map((function(r){return r.geometry.coordinates})))));{const r={};p(i,(function(t){t.properties&&(Object.prototype.hasOwnProperty.call(r,t.properties[u])||(r[t.properties[u]]=[]),r[t.properties[u]].push(t))}));const o=Object.keys(r);for(let e=0;e<o.length;e++){const p=t(s.union.apply(null,r[o[e]].map((function(r){return r.geometry.coordinates}))));p&&p.properties&&(p.properties[u]=o[e],a.push(p))}}return n(o(a))}var m=i;export{m as default,i as dissolve};
