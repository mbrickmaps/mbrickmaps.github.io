/**
 * Bundled by jsDelivr using Rollup v2.79.1 and Terser v5.19.2.
 * Original file: /npm/util-deprecate@1.0.2/browser.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{},r=function(e,r){if(n("noDeprecation"))return e;var o=!1;return function(){if(!o){if(n("throwDeprecation"))throw new Error(r);n("traceDeprecation")?console.trace(r):console.warn(r),o=!0}return e.apply(this,arguments)}};function n(r){try{if(!e.localStorage)return!1}catch(e){return!1}var n=e.localStorage[r];return null!=n&&"true"===String(n).toLowerCase()}export{r as default};
