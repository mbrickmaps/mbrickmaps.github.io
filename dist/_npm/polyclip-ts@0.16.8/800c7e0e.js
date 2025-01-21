/**
 * Bundled by jsDelivr using Rollup v2.79.2 and Terser v5.37.0.
 * Original file: /npm/polyclip-ts@0.16.8/dist/esm/index.js
 *
 * Do NOT use SRI with dynamically generated files! More information: https://www.jsdelivr.com/using-sri-with-dynamic-files
 */
import t from"../bignumber.js@9.1.2/87ba5c5f.js";import{SplayTreeSet as e}from"../splaytree-ts@1.0.2/6ce28fb5.js";var s=t=>()=>t,n=t=>{const e=t?(e,s)=>s.minus(e).abs().isLessThanOrEqualTo(t):s(!1);return(t,s)=>e(t,s)?0:t.comparedTo(s)};function i(t){const e=t?(e,s,n,i,r)=>e.exponentiatedBy(2).isLessThanOrEqualTo(i.minus(s).exponentiatedBy(2).plus(r.minus(n).exponentiatedBy(2)).times(t)):s(!1);return(t,s,n)=>{const i=t.x,r=t.y,o=n.x,l=n.y,h=r.minus(l).times(s.x.minus(o)).minus(i.minus(o).times(s.y.minus(l)));return e(h,i,r,o,l)?0:h.comparedTo(0)}}var r=t=>t,o=s=>{if(s){const i=new e(n(s)),r=new e(n(s)),o=(t,e)=>e.addAndReturn(t),l=t=>({x:o(t.x,i),y:o(t.y,r)});return l({x:new t(0),y:new t(0)}),l}return r},l=t=>({set:t=>{h=l(t)},reset:()=>l(t),compare:n(t),snap:o(t),orient:i(t)}),h=l(),u=(t,e)=>t.ll.x.isLessThanOrEqualTo(e.x)&&e.x.isLessThanOrEqualTo(t.ur.x)&&t.ll.y.isLessThanOrEqualTo(e.y)&&e.y.isLessThanOrEqualTo(t.ur.y),g=(t,e)=>{if(e.ur.x.isLessThan(t.ll.x)||t.ur.x.isLessThan(e.ll.x)||e.ur.y.isLessThan(t.ll.y)||t.ur.y.isLessThan(e.ll.y))return null;const s=t.ll.x.isLessThan(e.ll.x)?e.ll.x:t.ll.x,n=t.ur.x.isLessThan(e.ur.x)?t.ur.x:e.ur.x;return{ll:{x:s,y:t.ll.y.isLessThan(e.ll.y)?e.ll.y:t.ll.y},ur:{x:n,y:t.ur.y.isLessThan(e.ur.y)?t.ur.y:e.ur.y}}},p=(t,e)=>t.x.times(e.y).minus(t.y.times(e.x)),a=(t,e)=>t.x.times(e.x).plus(t.y.times(e.y)),c=t=>a(t,t).sqrt(),f=(t,e,s)=>{const n={x:e.x.minus(t.x),y:e.y.minus(t.y)},i={x:s.x.minus(t.x),y:s.y.minus(t.y)};return p(i,n).div(c(i)).div(c(n))},x=(t,e,s)=>{const n={x:e.x.minus(t.x),y:e.y.minus(t.y)},i={x:s.x.minus(t.x),y:s.y.minus(t.y)};return a(i,n).div(c(i)).div(c(n))},y=(t,e,s)=>e.y.isZero()?null:{x:t.x.plus(e.x.div(e.y).times(s.minus(t.y))),y:s},m=(t,e,s)=>e.x.isZero()?null:{x:s,y:t.y.plus(e.y.div(e.x).times(s.minus(t.x)))},b=class t{point;isLeft;segment;otherSE;consumedBy;static compare(e,s){const n=t.comparePoints(e.point,s.point);return 0!==n?n:(e.point!==s.point&&e.link(s),e.isLeft!==s.isLeft?e.isLeft?1:-1:L.compare(e.segment,s.segment))}static comparePoints(t,e){return t.x.isLessThan(e.x)?-1:t.x.isGreaterThan(e.x)?1:t.y.isLessThan(e.y)?-1:t.y.isGreaterThan(e.y)?1:0}constructor(t,e){void 0===t.events?t.events=[this]:t.events.push(this),this.point=t,this.isLeft=e}link(t){if(t.point===this.point)throw new Error("Tried to link already linked events");const e=t.point.events;for(let t=0,s=e.length;t<s;t++){const s=e[t];this.point.events.push(s),s.point=this.point}this.checkForConsuming()}checkForConsuming(){const t=this.point.events.length;for(let e=0;e<t;e++){const s=this.point.events[e];if(void 0===s.segment.consumedBy)for(let n=e+1;n<t;n++){const t=this.point.events[n];void 0===t.consumedBy&&(s.otherSE.point.events===t.otherSE.point.events&&s.segment.consume(t.segment))}}}getAvailableLinkedEvents(){const t=[];for(let e=0,s=this.point.events.length;e<s;e++){const s=this.point.events[e];s!==this&&!s.segment.ringOut&&s.segment.isInResult()&&t.push(s)}return t}getLeftmostComparator(t){const e=new Map,s=s=>{const n=s.otherSE;e.set(s,{sine:f(this.point,t.point,n.point),cosine:x(this.point,t.point,n.point)})};return(t,n)=>{e.has(t)||s(t),e.has(n)||s(n);const{sine:i,cosine:r}=e.get(t),{sine:o,cosine:l}=e.get(n);return i.isGreaterThanOrEqualTo(0)&&o.isGreaterThanOrEqualTo(0)?r.isLessThan(l)?1:r.isGreaterThan(l)?-1:0:i.isLessThan(0)&&o.isLessThan(0)?r.isLessThan(l)?-1:r.isGreaterThan(l)?1:0:o.isLessThan(i)?-1:o.isGreaterThan(i)?1:0}}},E=class t{events;poly;_isExteriorRing;_enclosingRing;static factory(e){const s=[];for(let n=0,i=e.length;n<i;n++){const i=e[n];if(!i.isInResult()||i.ringOut)continue;let r=null,o=i.leftSE,l=i.rightSE;const h=[o],u=o.point,g=[];for(;r=o,o=l,h.push(o),o.point!==u;)for(;;){const e=o.getAvailableLinkedEvents();if(0===e.length){const t=h[0].point,e=h[h.length-1].point;throw new Error(`Unable to complete output ring starting at [${t.x}, ${t.y}]. Last matching segment found ends at [${e.x}, ${e.y}].`)}if(1===e.length){l=e[0].otherSE;break}let n=null;for(let t=0,e=g.length;t<e;t++)if(g[t].point===o.point){n=t;break}if(null!==n){const e=g.splice(n)[0],i=h.splice(e.index);i.unshift(i[0].otherSE),s.push(new t(i.reverse()));continue}g.push({index:h.length,point:o.point});const i=o.getLeftmostComparator(r);l=e.sort(i)[0].otherSE;break}s.push(new t(h))}return s}constructor(t){this.events=t;for(let e=0,s=t.length;e<s;e++)t[e].segment.ringOut=this;this.poly=null}getGeom(){let t=this.events[0].point;const e=[t];for(let s=1,n=this.events.length-1;s<n;s++){const n=this.events[s].point,i=this.events[s+1].point;0!==h.orient(n,t,i)&&(e.push(n),t=n)}if(1===e.length)return null;const s=e[0],n=e[1];0===h.orient(s,t,n)&&e.shift(),e.push(e[0]);const i=this.isExteriorRing()?1:-1,r=this.isExteriorRing()?0:e.length-1,o=this.isExteriorRing()?e.length:-1,l=[];for(let t=r;t!=o;t+=i)l.push([e[t].x.toNumber(),e[t].y.toNumber()]);return l}isExteriorRing(){if(void 0===this._isExteriorRing){const t=this.enclosingRing();this._isExteriorRing=!t||!t.isExteriorRing()}return this._isExteriorRing}enclosingRing(){return void 0===this._enclosingRing&&(this._enclosingRing=this._calcEnclosingRing()),this._enclosingRing}_calcEnclosingRing(){let t=this.events[0];for(let e=1,s=this.events.length;e<s;e++){const s=this.events[e];b.compare(t,s)>0&&(t=s)}let e=t.segment.prevInResult(),s=e?e.prevInResult():null;for(;;){if(!e)return null;if(!s)return e.ringOut;if(s.ringOut!==e.ringOut)return s.ringOut?.enclosingRing()!==e.ringOut?e.ringOut:e.ringOut?.enclosingRing();e=s.prevInResult(),s=e?e.prevInResult():null}}},d=class{exteriorRing;interiorRings;constructor(t){this.exteriorRing=t,t.poly=this,this.interiorRings=[]}addInterior(t){this.interiorRings.push(t),t.poly=this}getGeom(){const t=this.exteriorRing.getGeom();if(null===t)return null;const e=[t];for(let t=0,s=this.interiorRings.length;t<s;t++){const s=this.interiorRings[t].getGeom();null!==s&&e.push(s)}return e}},S=class{rings;polys;constructor(t){this.rings=t,this.polys=this._composePolys(t)}getGeom(){const t=[];for(let e=0,s=this.polys.length;e<s;e++){const s=this.polys[e].getGeom();null!==s&&t.push(s)}return t}_composePolys(t){const e=[];for(let s=0,n=t.length;s<n;s++){const n=t[s];if(!n.poly)if(n.isExteriorRing())e.push(new d(n));else{const t=n.enclosingRing();t?.poly||e.push(new d(t)),t?.poly?.addInterior(n)}}return e}},v=class{queue;tree;segments;constructor(t,s=L.compare){this.queue=t,this.tree=new e(s),this.segments=[]}process(t){const e=t.segment,s=[];if(t.consumedBy)return t.isLeft?this.queue.delete(t.otherSE):this.tree.delete(e),s;t.isLeft&&this.tree.add(e);let n=e,i=e;do{n=this.tree.lastBefore(n)}while(null!=n&&null!=n.consumedBy);do{i=this.tree.firstAfter(i)}while(null!=i&&null!=i.consumedBy);if(t.isLeft){let r=null;if(n){const t=n.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(r=t),!n.isAnEndpoint(t))){const e=this._splitSafely(n,t);for(let t=0,n=e.length;t<n;t++)s.push(e[t])}}let o=null;if(i){const t=i.getIntersection(e);if(null!==t&&(e.isAnEndpoint(t)||(o=t),!i.isAnEndpoint(t))){const e=this._splitSafely(i,t);for(let t=0,n=e.length;t<n;t++)s.push(e[t])}}if(null!==r||null!==o){let t=null;if(null===r)t=o;else if(null===o)t=r;else{t=b.comparePoints(r,o)<=0?r:o}this.queue.delete(e.rightSE),s.push(e.rightSE);const n=e.split(t);for(let t=0,e=n.length;t<e;t++)s.push(n[t])}s.length>0?(this.tree.delete(e),s.push(t)):(this.segments.push(e),e.prev=n)}else{if(n&&i){const t=n.getIntersection(i);if(null!==t){if(!n.isAnEndpoint(t)){const e=this._splitSafely(n,t);for(let t=0,n=e.length;t<n;t++)s.push(e[t])}if(!i.isAnEndpoint(t)){const e=this._splitSafely(i,t);for(let t=0,n=e.length;t<n;t++)s.push(e[t])}}}this.tree.delete(e)}return s}_splitSafely(t,e){this.tree.delete(t);const s=t.rightSE;this.queue.delete(s);const n=t.split(e);return n.push(s),void 0===t.consumedBy&&this.tree.add(t),n}},T=new class{type;numMultiPolys;run(t,s,n){T.type=t;const i=[new P(s,!0)];for(let t=0,e=n.length;t<e;t++)i.push(new P(n[t],!1));if(T.numMultiPolys=i.length,"difference"===T.type){const t=i[0];let e=1;for(;e<i.length;)null!==g(i[e].bbox,t.bbox)?e++:i.splice(e,1)}if("intersection"===T.type)for(let t=0,e=i.length;t<e;t++){const e=i[t];for(let s=t+1,n=i.length;s<n;s++)if(null===g(e.bbox,i[s].bbox))return[]}const r=new e(b.compare);for(let t=0,e=i.length;t<e;t++){const e=i[t].getSweepEvents();for(let t=0,s=e.length;t<s;t++)r.add(e[t])}const o=new v(r);let l=null;for(0!=r.size&&(l=r.first(),r.delete(l));l;){const t=o.process(l);for(let e=0,s=t.length;e<s;e++){const s=t[e];void 0===s.consumedBy&&r.add(s)}0!=r.size?(l=r.first(),r.delete(l)):l=null}h.reset();const u=E.factory(o.segments);return new S(u).getGeom()}},w=T,R=0,L=class t{id;leftSE;rightSE;rings;windings;ringOut;consumedBy;prev;_prevInResult;_beforeState;_afterState;_isInResult;static compare(t,e){const s=t.leftSE.point.x,n=e.leftSE.point.x,i=t.rightSE.point.x,r=e.rightSE.point.x;if(r.isLessThan(s))return 1;if(i.isLessThan(n))return-1;const o=t.leftSE.point.y,l=e.leftSE.point.y,h=t.rightSE.point.y,u=e.rightSE.point.y;if(s.isLessThan(n)){if(l.isLessThan(o)&&l.isLessThan(h))return 1;if(l.isGreaterThan(o)&&l.isGreaterThan(h))return-1;const s=t.comparePoint(e.leftSE.point);if(s<0)return 1;if(s>0)return-1;const n=e.comparePoint(t.rightSE.point);return 0!==n?n:-1}if(s.isGreaterThan(n)){if(o.isLessThan(l)&&o.isLessThan(u))return-1;if(o.isGreaterThan(l)&&o.isGreaterThan(u))return 1;const s=e.comparePoint(t.leftSE.point);if(0!==s)return s;const n=t.comparePoint(e.rightSE.point);return n<0?1:n>0?-1:1}if(o.isLessThan(l))return-1;if(o.isGreaterThan(l))return 1;if(i.isLessThan(r)){const s=e.comparePoint(t.rightSE.point);if(0!==s)return s}if(i.isGreaterThan(r)){const s=t.comparePoint(e.rightSE.point);if(s<0)return 1;if(s>0)return-1}if(!i.eq(r)){const t=h.minus(o),e=i.minus(s),g=u.minus(l),p=r.minus(n);if(t.isGreaterThan(e)&&g.isLessThan(p))return 1;if(t.isLessThan(e)&&g.isGreaterThan(p))return-1}return i.isGreaterThan(r)?1:i.isLessThan(r)||h.isLessThan(u)?-1:h.isGreaterThan(u)?1:t.id<e.id?-1:t.id>e.id?1:0}constructor(t,e,s,n){this.id=++R,this.leftSE=t,t.segment=this,t.otherSE=e,this.rightSE=e,e.segment=this,e.otherSE=t,this.rings=s,this.windings=n}static fromRing(e,s,n){let i,r,o;const l=b.comparePoints(e,s);if(l<0)i=e,r=s,o=1;else{if(!(l>0))throw new Error(`Tried to create degenerate segment at [${e.x}, ${e.y}]`);i=s,r=e,o=-1}const h=new b(i,!0),u=new b(r,!1);return new t(h,u,[n],[o])}replaceRightSE(t){this.rightSE=t,this.rightSE.segment=this,this.rightSE.otherSE=this.leftSE,this.leftSE.otherSE=this.rightSE}bbox(){const t=this.leftSE.point.y,e=this.rightSE.point.y;return{ll:{x:this.leftSE.point.x,y:t.isLessThan(e)?t:e},ur:{x:this.rightSE.point.x,y:t.isGreaterThan(e)?t:e}}}vector(){return{x:this.rightSE.point.x.minus(this.leftSE.point.x),y:this.rightSE.point.y.minus(this.leftSE.point.y)}}isAnEndpoint(t){return t.x.eq(this.leftSE.point.x)&&t.y.eq(this.leftSE.point.y)||t.x.eq(this.rightSE.point.x)&&t.y.eq(this.rightSE.point.y)}comparePoint(t){return h.orient(this.leftSE.point,t,this.rightSE.point)}getIntersection(t){const e=this.bbox(),s=t.bbox(),n=g(e,s);if(null===n)return null;const i=this.leftSE.point,r=this.rightSE.point,o=t.leftSE.point,l=t.rightSE.point,a=u(e,o)&&0===this.comparePoint(o),c=u(s,i)&&0===t.comparePoint(i),f=u(e,l)&&0===this.comparePoint(l),x=u(s,r)&&0===t.comparePoint(r);if(c&&a)return x&&!f?r:!x&&f?l:null;if(c)return f&&i.x.eq(l.x)&&i.y.eq(l.y)?null:i;if(a)return x&&r.x.eq(o.x)&&r.y.eq(o.y)?null:o;if(x&&f)return null;if(x)return r;if(f)return l;const b=((t,e,s,n)=>{if(e.x.isZero())return m(s,n,t.x);if(n.x.isZero())return m(t,e,s.x);if(e.y.isZero())return y(s,n,t.y);if(n.y.isZero())return y(t,e,s.y);const i=p(e,n);if(i.isZero())return null;const r={x:s.x.minus(t.x),y:s.y.minus(t.y)},o=p(r,e).div(i),l=p(r,n).div(i),h=t.x.plus(l.times(e.x)),u=s.x.plus(o.times(n.x)),g=t.y.plus(l.times(e.y)),a=s.y.plus(o.times(n.y));return{x:h.plus(u).div(2),y:g.plus(a).div(2)}})(i,this.vector(),o,t.vector());return null===b?null:u(n,b)?h.snap(b):null}split(e){const s=[],n=void 0!==e.events,i=new b(e,!0),r=new b(e,!1),o=this.rightSE;this.replaceRightSE(r),s.push(r),s.push(i);const l=new t(i,o,this.rings.slice(),this.windings.slice());return b.comparePoints(l.leftSE.point,l.rightSE.point)>0&&l.swapEvents(),b.comparePoints(this.leftSE.point,this.rightSE.point)>0&&this.swapEvents(),n&&(i.checkForConsuming(),r.checkForConsuming()),s}swapEvents(){const t=this.rightSE;this.rightSE=this.leftSE,this.leftSE=t,this.leftSE.isLeft=!0,this.rightSE.isLeft=!1;for(let t=0,e=this.windings.length;t<e;t++)this.windings[t]*=-1}consume(e){let s=this,n=e;for(;s.consumedBy;)s=s.consumedBy;for(;n.consumedBy;)n=n.consumedBy;const i=t.compare(s,n);if(0!==i){if(i>0){const t=s;s=n,n=t}if(s.prev===n){const t=s;s=n,n=t}for(let t=0,e=n.rings.length;t<e;t++){const e=n.rings[t],i=n.windings[t],r=s.rings.indexOf(e);-1===r?(s.rings.push(e),s.windings.push(i)):s.windings[r]+=i}n.rings=null,n.windings=null,n.consumedBy=s,n.leftSE.consumedBy=s.leftSE,n.rightSE.consumedBy=s.rightSE}}prevInResult(){return void 0!==this._prevInResult||(this.prev?this.prev.isInResult()?this._prevInResult=this.prev:this._prevInResult=this.prev.prevInResult():this._prevInResult=null),this._prevInResult}beforeState(){if(void 0!==this._beforeState)return this._beforeState;if(this.prev){const t=this.prev.consumedBy||this.prev;this._beforeState=t.afterState()}else this._beforeState={rings:[],windings:[],multiPolys:[]};return this._beforeState}afterState(){if(void 0!==this._afterState)return this._afterState;const t=this.beforeState();this._afterState={rings:t.rings.slice(0),windings:t.windings.slice(0),multiPolys:[]};const e=this._afterState.rings,s=this._afterState.windings,n=this._afterState.multiPolys;for(let t=0,n=this.rings.length;t<n;t++){const n=this.rings[t],i=this.windings[t],r=e.indexOf(n);-1===r?(e.push(n),s.push(i)):s[r]+=i}const i=[],r=[];for(let t=0,n=e.length;t<n;t++){if(0===s[t])continue;const n=e[t],o=n.poly;if(-1===r.indexOf(o))if(n.isExterior)i.push(o);else{-1===r.indexOf(o)&&r.push(o);const t=i.indexOf(n.poly);-1!==t&&i.splice(t,1)}}for(let t=0,e=i.length;t<e;t++){const e=i[t].multiPoly;-1===n.indexOf(e)&&n.push(e)}return this._afterState}isInResult(){if(this.consumedBy)return!1;if(void 0!==this._isInResult)return this._isInResult;const t=this.beforeState().multiPolys,e=this.afterState().multiPolys;switch(w.type){case"union":{const s=0===t.length,n=0===e.length;this._isInResult=s!==n;break}case"intersection":{let s,n;t.length<e.length?(s=t.length,n=e.length):(s=e.length,n=t.length),this._isInResult=n===w.numMultiPolys&&s<n;break}case"xor":{const s=Math.abs(t.length-e.length);this._isInResult=s%2==1;break}case"difference":{const s=t=>1===t.length&&t[0].isSubject;this._isInResult=s(t)!==s(e);break}}return this._isInResult}},I=class{poly;isExterior;segments;bbox;constructor(e,s,n){if(!Array.isArray(e)||0===e.length)throw new Error("Input geometry is not a valid Polygon or MultiPolygon");if(this.poly=s,this.isExterior=n,this.segments=[],"number"!=typeof e[0][0]||"number"!=typeof e[0][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const i=h.snap({x:new t(e[0][0]),y:new t(e[0][1])});this.bbox={ll:{x:i.x,y:i.y},ur:{x:i.x,y:i.y}};let r=i;for(let s=1,n=e.length;s<n;s++){if("number"!=typeof e[s][0]||"number"!=typeof e[s][1])throw new Error("Input geometry is not a valid Polygon or MultiPolygon");const n=h.snap({x:new t(e[s][0]),y:new t(e[s][1])});n.x.eq(r.x)&&n.y.eq(r.y)||(this.segments.push(L.fromRing(r,n,this)),n.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=n.x),n.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=n.y),n.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=n.x),n.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=n.y),r=n)}i.x.eq(r.x)&&i.y.eq(r.y)||this.segments.push(L.fromRing(r,i,this))}getSweepEvents(){const t=[];for(let e=0,s=this.segments.length;e<s;e++){const s=this.segments[e];t.push(s.leftSE),t.push(s.rightSE)}return t}},_=class{multiPoly;exteriorRing;interiorRings;bbox;constructor(t,e){if(!Array.isArray(t))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");this.exteriorRing=new I(t[0],this,!0),this.bbox={ll:{x:this.exteriorRing.bbox.ll.x,y:this.exteriorRing.bbox.ll.y},ur:{x:this.exteriorRing.bbox.ur.x,y:this.exteriorRing.bbox.ur.y}},this.interiorRings=[];for(let e=1,s=t.length;e<s;e++){const s=new I(t[e],this,!1);s.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=s.bbox.ll.x),s.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=s.bbox.ll.y),s.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=s.bbox.ur.x),s.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=s.bbox.ur.y),this.interiorRings.push(s)}this.multiPoly=e}getSweepEvents(){const t=this.exteriorRing.getSweepEvents();for(let e=0,s=this.interiorRings.length;e<s;e++){const s=this.interiorRings[e].getSweepEvents();for(let e=0,n=s.length;e<n;e++)t.push(s[e])}return t}},P=class{isSubject;polys;bbox;constructor(e,s){if(!Array.isArray(e))throw new Error("Input geometry is not a valid Polygon or MultiPolygon");try{"number"==typeof e[0][0][0]&&(e=[e])}catch(t){}this.polys=[],this.bbox={ll:{x:new t(Number.POSITIVE_INFINITY),y:new t(Number.POSITIVE_INFINITY)},ur:{x:new t(Number.NEGATIVE_INFINITY),y:new t(Number.NEGATIVE_INFINITY)}};for(let t=0,s=e.length;t<s;t++){const s=new _(e[t],this);s.bbox.ll.x.isLessThan(this.bbox.ll.x)&&(this.bbox.ll.x=s.bbox.ll.x),s.bbox.ll.y.isLessThan(this.bbox.ll.y)&&(this.bbox.ll.y=s.bbox.ll.y),s.bbox.ur.x.isGreaterThan(this.bbox.ur.x)&&(this.bbox.ur.x=s.bbox.ur.x),s.bbox.ur.y.isGreaterThan(this.bbox.ur.y)&&(this.bbox.ur.y=s.bbox.ur.y),this.polys.push(s)}this.isSubject=s}getSweepEvents(){const t=[];for(let e=0,s=this.polys.length;e<s;e++){const s=this.polys[e].getSweepEvents();for(let e=0,n=s.length;e<n;e++)t.push(s[e])}return t}},G=(t,...e)=>w.run("union",t,e),q=(t,...e)=>w.run("intersection",t,e),O=(t,...e)=>w.run("xor",t,e),B=(t,...e)=>w.run("difference",t,e),A=h.set;export{B as difference,q as intersection,A as setPrecision,G as union,O as xor};export default null;