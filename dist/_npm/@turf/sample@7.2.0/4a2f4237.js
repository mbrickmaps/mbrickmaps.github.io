/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/sample@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{featureCollection as r}from"../helpers@7.2.0/28807c9c.js";function e(e,n){if(!e)throw new Error("fc is required");if(null==n)throw new Error("num is required");if("number"!=typeof n)throw new Error("num must be a number");return r(function(r,e){var n,t,o=r.slice(0),u=r.length,f=u-e;for(;u-- >f;)n=o[t=Math.floor((u+1)*Math.random())],o[t]=o[u],o[u]=n;return o.slice(f)}(e.features,n))}var n=e;export{n as default,e as sample};
