/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/geojson-rbush@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import r from"../../rbush@3.0.1/d425f52b.js";import{featureCollection as t}from"../helpers@7.2.0/28807c9c.js";import{featureEach as o}from"../meta@7.2.0/c0f2fe64.js";import{bbox as e}from"../bbox@7.2.0/8d64fe90.js";function n(n){var i=new r(n);return i.insert=function(t){if("Feature"!==t.type)throw new Error("invalid feature");return t.bbox=t.bbox?t.bbox:e(t),r.prototype.insert.call(this,t)},i.load=function(t){var n=[];return Array.isArray(t)?t.forEach((function(r){if("Feature"!==r.type)throw new Error("invalid features");r.bbox=r.bbox?r.bbox:e(r),n.push(r)})):o(t,(function(r){if("Feature"!==r.type)throw new Error("invalid features");r.bbox=r.bbox?r.bbox:e(r),n.push(r)})),r.prototype.load.call(this,n)},i.remove=function(t,o){if("Feature"!==t.type)throw new Error("invalid feature");return t.bbox=t.bbox?t.bbox:e(t),r.prototype.remove.call(this,t,o)},i.clear=function(){return r.prototype.clear.call(this)},i.search=function(o){var e=r.prototype.search.call(this,this.toBBox(o));return t(e)},i.collides=function(t){return r.prototype.collides.call(this,this.toBBox(t))},i.all=function(){var o=r.prototype.all.call(this);return t(o)},i.toJSON=function(){return r.prototype.toJSON.call(this)},i.fromJSON=function(t){return r.prototype.fromJSON.call(this,t)},i.toBBox=function(r){var t;if(r.bbox)t=r.bbox;else if(Array.isArray(r)&&4===r.length)t=r;else if(Array.isArray(r)&&6===r.length)t=[r[0],r[1],r[3],r[4]];else if("Feature"===r.type)t=e(r);else{if("FeatureCollection"!==r.type)throw new Error("invalid geojson");t=e(r)}return{minX:t[0],minY:t[1],maxX:t[2],maxY:t[3]}},i}var i=n;export{i as default,n as geojsonRbush};