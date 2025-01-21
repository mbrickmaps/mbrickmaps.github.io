/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/parse-headers@2.0.5/parse-headers.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var r=function(r){return r.replace(/^\s+|\s+$/g,"")},e=function(e){if(!e)return{};for(var t,n={},o=r(e).split("\n"),a=0;a<o.length;a++){var i=o[a],c=i.indexOf(":"),l=r(i.slice(0,c)).toLowerCase(),s=r(i.slice(c+1));void 0===n[l]?n[l]=s:(t=n[l],"[object Array]"===Object.prototype.toString.call(t)?n[l].push(s):n[l]=[n[l],s])}return n};export{e as default};
