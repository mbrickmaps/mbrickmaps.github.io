/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/transform-scale@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{clone as r}from"../clone@7.2.0/5b9e5666.js";import{center as t}from"../center@7.2.0/b0d2e8a2.js";import{centroid as e}from"../centroid@7.2.0/40f66647.js";import{bbox as o}from"../bbox@7.2.0/8d64fe90.js";import{rhumbBearing as n}from"../rhumb-bearing@7.2.0/841df52f.js";import{rhumbDistance as s}from"../rhumb-distance@7.2.0/4567a018.js";import{rhumbDestination as i}from"../rhumb-destination@7.2.0/3f05ec15.js";import{featureEach as m,coordEach as a}from"../meta@7.2.0/c0f2fe64.js";import{isObject as c,point as u}from"../helpers@7.2.0/28807c9c.js";import{getType as f,getCoords as p,getCoord as h}from"../invariant@7.2.0/671cab78.js";function b(t,e,o){if(!c(o=o||{}))throw new Error("options is invalid");const n=o.origin||"centroid",s=o.mutate||!1;if(!t)throw new Error("geojson required");if("number"!=typeof e||e<=0)throw new Error("invalid factor");const i=Array.isArray(n)||"object"==typeof n;return!0!==s&&(t=r(t)),"FeatureCollection"!==t.type||i?l(t,e,n):(m(t,(function(r,o){t.features[o]=l(r,e,n)})),t)}function l(r,m,c){const b="Point"===f(r),l=function(r,n){null==n&&(n="centroid");if(Array.isArray(n)||"object"==typeof n)return h(n);const s=r.bbox?r.bbox:o(r,{recompute:!0}),i=s[0],m=s[1],a=s[2],c=s[3];switch(n){case"sw":case"southwest":case"westsouth":case"bottomleft":return u([i,m]);case"se":case"southeast":case"eastsouth":case"bottomright":return u([a,m]);case"nw":case"northwest":case"westnorth":case"topleft":return u([i,c]);case"ne":case"northeast":case"eastnorth":case"topright":return u([a,c]);case"center":return t(r);case void 0:case null:case"centroid":return e(r);default:throw new Error("invalid origin")}}(r,c);return 1===m||b||(a(r,(function(r){const t=s(l,r),e=n(l,r),o=p(i(l,t*m,e));r[0]=o[0],r[1]=o[1],3===r.length&&(r[2]*=m)})),delete r.bbox),r}var w=b;export{w as default,b as transformScale};