/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/line-arc@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{circle as r}from"../circle@7.2.0/38962922.js";import{destination as t}from"../destination@7.2.0/2cf8d83b.js";import{lineString as e}from"../helpers@7.2.0/28807c9c.js";function o(o,s,m,i,p={}){const f=p.steps||64,u=n(m),c=n(i),a=Array.isArray(o)||"Feature"!==o.type?{}:o.properties;if(u===c)return e(r(o,s,p).geometry.coordinates[0],a);const l=u,y=u<c?c:c+360;let d=l;const g=[];let h=0;const A=(y-l)/f;for(;d<=y;)g.push(t(o,s,d,p).geometry.coordinates),h++,d=l+h*A;return e(g,a)}function n(r){let t=r%360;return t<0&&(t+=360),t}var s=o;export{s as default,o as lineArc};
