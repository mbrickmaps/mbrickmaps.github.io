/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/nearest-point@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{clone as r}from"../clone@7.2.0/5b9e5666.js";import{distance as e}from"../distance@7.2.0/379bfd17.js";import{featureEach as t}from"../meta@7.2.0/c0f2fe64.js";var o=Object.defineProperty,n=Object.defineProperties,i=Object.getOwnPropertyDescriptors,p=Object.getOwnPropertySymbols,a=Object.prototype.hasOwnProperty,s=Object.prototype.propertyIsEnumerable,f=(r,e,t)=>e in r?o(r,e,{enumerable:!0,configurable:!0,writable:!0,value:t}):r[e]=t,c=(r,e)=>{for(var t in e||(e={}))a.call(e,t)&&f(r,t,e[t]);if(p)for(var t of p(e))s.call(e,t)&&f(r,t,e[t]);return r},m=(r,e)=>n(r,i(e));function u(o,n,i={}){if(!o)throw new Error("targetPoint is required");if(!n)throw new Error("points is required");let p=1/0,a=0;t(n,((r,t)=>{const n=e(o,r,i);n<p&&(a=t,p=n)}));const s=r(n.features[a]);return m(c({},s),{properties:m(c({},s.properties),{featureIndex:a,distanceToPoint:p})})}var l=u;export{l as default,u as nearestPoint};
