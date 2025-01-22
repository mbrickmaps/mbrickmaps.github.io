/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/along@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{bearing as t}from"../bearing@7.2.0/1c0dd5b9.js";import{destination as r}from"../destination@7.2.0/2cf8d83b.js";import{distance as n}from"../distance@7.2.0/379bfd17.js";import{point as e}from"../helpers@7.2.0/28807c9c.js";import{getGeom as m}from"../invariant@7.2.0/671cab78.js";function o(o,f,i={}){const s=m(o).coordinates;let p=0;for(let m=0;m<s.length&&!(f>=p&&m===s.length-1);m++){if(p>=f){const n=f-p;if(n){const e=t(s[m],s[m-1])-180;return r(s[m],n,e,i)}return e(s[m])}p+=n(s[m],s[m+1],i)}return e(s[s.length-1])}var f=o;export{o as along,f as default};
