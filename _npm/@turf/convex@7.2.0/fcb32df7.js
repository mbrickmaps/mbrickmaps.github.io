/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/convex@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{polygon as n}from"../helpers@7.2.0/28807c9c.js";import{coordEach as t}from"../meta@7.2.0/c0f2fe64.js";import r from"../../concaveman@1.2.1/429c7c90.js";function m(m,o={}){o.concavity=o.concavity||1/0;const e=[];if(t(m,(n=>{e.push([n[0],n[1]])})),!e.length)return null;const c=r(e,o.concavity);return c.length>3?n([c]):null}var o=m;export{m as convex,o as default};
