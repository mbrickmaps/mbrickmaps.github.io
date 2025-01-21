/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/@turf/shortest-path@7.2.0/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import{bbox as t}from"../bbox@7.2.0/8d64fe90.js";import{booleanPointInPolygon as n}from"../boolean-point-in-polygon@7.2.0/080fdfef.js";import{distance as o}from"../distance@7.2.0/379bfd17.js";import{transformScale as i}from"../transform-scale@7.2.0/b9cef896.js";import{cleanCoords as r}from"../clean-coords@7.2.0/50050321.js";import{bboxPolygon as e}from"../bbox-polygon@7.2.0/a8f44922.js";import{getCoord as s,getGeom as h}from"../invariant@7.2.0/671cab78.js";import{isObject as u,featureCollection as c,isNumber as a,point as f,lineString as p,feature as l}from"../helpers@7.2.0/28807c9c.js";function g(t){for(var n=t,o=[];n.parent;)o.unshift(n),n=n.parent;return o}var d={search:function(t,n,o,i){var r;t.cleanDirty();var e=(i=i||{}).heuristic||d.heuristics.manhattan,s=null!=(r=i.closest)&&r,h=new v((function(t){return t.f})),u=n;for(n.h=e(n,o),h.push(n);h.size()>0;){var c=h.pop();if(c===o)return g(c);c.closed=!0;for(var a=t.neighbors(c),f=0,p=a.length;f<p;++f){var l=a[f];if(!l.closed&&!l.isWall()){var m=c.g+l.getCost(c),y=l.visited;(!y||m<l.g)&&(l.visited=!0,l.parent=c,l.h=l.h||e(l,o),l.g=m,l.f=l.g+l.h,t.markDirty(l),s&&(l.h<u.h||l.h===u.h&&l.g<u.g)&&(u=l),y?h.rescoreElement(l):h.push(l))}}}return s?g(u):[]},heuristics:{manhattan:function(t,n){return Math.abs(n.x-t.x)+Math.abs(n.y-t.y)},diagonal:function(t,n){var o=Math.sqrt(2),i=Math.abs(n.x-t.x),r=Math.abs(n.y-t.y);return 1*(i+r)+(o-2)*Math.min(i,r)}},cleanNode:function(t){t.f=0,t.g=0,t.h=0,t.visited=!1,t.closed=!1,t.parent=null}};function m(t,n){n=n||{},this.nodes=[],this.diagonal=!!n.diagonal,this.grid=[];for(var o=0;o<t.length;o++){this.grid[o]=[];for(var i=0,r=t[o];i<r.length;i++){var e=new y(o,i,r[i]);this.grid[o][i]=e,this.nodes.push(e)}}this.init()}function y(t,n,o){this.x=t,this.y=n,this.weight=o}function v(t){this.content=[],this.scoreFunction=t}function b(n,g,y={}){if(!u(y=y||{}))throw new Error("options is invalid");let v=y.obstacles||c([]),b=y.resolution||100;if(!n)throw new Error("start is required");if(!g)throw new Error("end is required");if(b&&(!a(b)||b<=0))throw new Error("options.resolution must be a number, greater than 0");const x=s(n),F=s(g);if(n=f(x),g=f(F),"FeatureCollection"===v.type){if(0===v.features.length)return p([x,F])}else{if("Polygon"!==v.type)throw new Error("invalid obstacles");v=c([l(h(v))])}const k=v;k.features.push(n),k.features.push(g);const D=t(i(e(t(k)),1.15)),[E,M,N,q]=D,C=o([E,M],[N,M],y)/b;k.features.pop(),k.features.pop();const U=C/o([E,M],[N,M],y)*(N-E),j=C/o([E,M],[E,q],y)*(q-M),z=N-E,O=q-M,S=Math.floor(z/U),W=Math.floor(O/j),P=(z-S*U)/2,A=[],B=[];let G,H,I=1/0,J=1/0,K=q-(O-W*j)/2,L=0;for(;K>=M;){const t=[],i=[];let r=E+P,e=0;for(;r<=N;){const s=f([r,K]),h=w(s,v);t.push(h?0:1),i.push(r+"|"+K);const u=o(s,n);!h&&u<I&&(I=u,G={x:e,y:L});const c=o(s,g);!h&&c<J&&(J=c,H={x:e,y:L}),r+=U,e++}B.push(t),A.push(i),K-=j,L++}const Q=new m(B,{diagonal:!0}),R=Q.grid[G.y][G.x],T=Q.grid[H.y][H.x],V=d.search(Q,R,T),X=[x];return V.forEach((function(t){const n=A[t.x][t.y].split("|");X.push([+n[0],+n[1]])})),X.push(F),r(p(X))}function w(t,o){for(let i=0;i<o.features.length;i++)if(n(t,o.features[i]))return!0;return!1}m.prototype.init=function(){this.dirtyNodes=[];for(var t=0;t<this.nodes.length;t++)d.cleanNode(this.nodes[t])},m.prototype.cleanDirty=function(){for(var t=0;t<this.dirtyNodes.length;t++)d.cleanNode(this.dirtyNodes[t]);this.dirtyNodes=[]},m.prototype.markDirty=function(t){this.dirtyNodes.push(t)},m.prototype.neighbors=function(t){var n=[],o=t.x,i=t.y,r=this.grid;return r[o-1]&&r[o-1][i]&&n.push(r[o-1][i]),r[o+1]&&r[o+1][i]&&n.push(r[o+1][i]),r[o]&&r[o][i-1]&&n.push(r[o][i-1]),r[o]&&r[o][i+1]&&n.push(r[o][i+1]),this.diagonal&&(r[o-1]&&r[o-1][i-1]&&n.push(r[o-1][i-1]),r[o+1]&&r[o+1][i-1]&&n.push(r[o+1][i-1]),r[o-1]&&r[o-1][i+1]&&n.push(r[o-1][i+1]),r[o+1]&&r[o+1][i+1]&&n.push(r[o+1][i+1])),n},m.prototype.toString=function(){for(var t,n,o,i,r=[],e=this.grid,s=0,h=e.length;s<h;s++){for(t=[],o=0,i=(n=e[s]).length;o<i;o++)t.push(n[o].weight);r.push(t.join(" "))}return r.join("\n")},y.prototype.toString=function(){return"["+this.x+" "+this.y+"]"},y.prototype.getCost=function(t){return t&&t.x!==this.x&&t.y!==this.y?1.41421*this.weight:this.weight},y.prototype.isWall=function(){return 0===this.weight},v.prototype={push:function(t){this.content.push(t),this.sinkDown(this.content.length-1)},pop:function(){var t=this.content[0],n=this.content.pop();return this.content.length>0&&(this.content[0]=n,this.bubbleUp(0)),t},remove:function(t){var n=this.content.indexOf(t),o=this.content.pop();n!==this.content.length-1&&(this.content[n]=o,this.scoreFunction(o)<this.scoreFunction(t)?this.sinkDown(n):this.bubbleUp(n))},size:function(){return this.content.length},rescoreElement:function(t){this.sinkDown(this.content.indexOf(t))},sinkDown:function(t){for(var n=this.content[t];t>0;){var o=(t+1>>1)-1,i=this.content[o];if(!(this.scoreFunction(n)<this.scoreFunction(i)))break;this.content[o]=n,this.content[t]=i,t=o}},bubbleUp:function(t){for(var n=this.content.length,o=this.content[t],i=this.scoreFunction(o);;){var r,e=t+1<<1,s=e-1,h=null;if(s<n){var u=this.content[s];(r=this.scoreFunction(u))<i&&(h=s)}if(e<n){var c=this.content[e];this.scoreFunction(c)<(null===h?i:r)&&(h=e)}if(null===h)break;this.content[t]=this.content[h],this.content[h]=o,t=h}}};var x=b;export{x as default,b as shortestPath};