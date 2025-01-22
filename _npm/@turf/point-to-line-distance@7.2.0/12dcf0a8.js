/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/point-to-line-distance@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{point as r,feature as e,lineString as t,convertLength as n}from"../helpers@7.2.0/28807c9c.js";import{nearestPointOnLine as i}from"../nearest-point-on-line@7.2.0/84873fda.js";import{featureOf as o}from"../invariant@7.2.0/671cab78.js";import{segmentEach as s}from"../meta@7.2.0/c0f2fe64.js";import{rhumbDistance as m}from"../rhumb-distance@7.2.0/4567a018.js";function u(u,p,d={}){var a,c;const g=null!=(a=d.method)?a:"geodesic",l=null!=(c=d.units)?c:"kilometers";if(!u)throw new Error("pt is required");if(Array.isArray(u)?u=r(u):"Point"===u.type?u=e(u):o(u,"Point","point"),!p)throw new Error("line is required");Array.isArray(p)?p=t(p):"LineString"===p.type?p=e(p):o(p,"LineString","line");let y=1/0;const h=u.geometry.coordinates;return s(p,(r=>{if(r){const e=r.geometry.coordinates[0],n=r.geometry.coordinates[1],o=function(r,e,n,o){if("geodesic"===o.method){return i(t([e,n]).geometry,r,{units:"degrees"}).properties.dist}const s=[n[0]-e[0],n[1]-e[1]],u=[r[0]-e[0],r[1]-e[1]],p=f(u,s);if(p<=0)return m(r,e,{units:"degrees"});const d=f(s,s);if(d<=p)return m(r,n,{units:"degrees"});const a=p/d,c=[e[0]+a*s[0],e[1]+a*s[1]];return m(r,c,{units:"degrees"})}(h,e,n,{method:g});o<y&&(y=o)}})),n(y,"degrees",l)}function f(r,e){return r[0]*e[0]+r[1]*e[1]}var p=u;export{p as default,u as pointToLineDistance};