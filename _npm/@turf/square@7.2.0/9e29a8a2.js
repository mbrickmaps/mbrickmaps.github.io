/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/square@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{distance as r}from"../distance@7.2.0/379bfd17.js";function e(e){var t=e[0],a=e[1],i=e[2],n=e[3];if(r(e.slice(0,2),[i,a])>=r(e.slice(0,2),[t,n])){var f=(a+n)/2;return[t,f-(i-t)/2,i,f+(i-t)/2]}var s=(t+i)/2;return[s-(n-a)/2,a,s+(n-a)/2,n]}var t=e;export{t as default,e as square};
