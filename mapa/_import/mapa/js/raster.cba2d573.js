// Raster/tile rendering, extracted from mapa.js (Phase 1 decomposition) -- the single
// riskiest extraction: a quadtree tile visitor + canvas-pixel compositing (geoTile, nested
// inside drawTileLayers exactly as it was nested inside render()), elevation color-ramping,
// and PMTiles/XYZ/custom/debug tile-type dispatch (getTiles, same). Also the separate
// image+worldfile raster reprojection path (drawWorldfileRaster). Both moved verbatim --
// no internal restructuring of geoTile/getTiles, only the outer this.X -> params change.
import { d3 } from "./vendor.4692b715.js";
import { pmtilesReader, cachedTile, tileQ, tileQueueAdd, tileQueueRun, getTileRequestGuard, imgTileGet, imgTileHas, imgTilePut, compositeGet, compositePut } from "./tiles.f3cbd7a7.js";

function drawTileLayers({ parent, layerGroup, tilesLayer, projection, width, height, margin = 0, uid, tilePromises }) {
    if (!tilesLayer.show) return;
    {
      let filter = null;
      let url = null;
      let format = null;
      let tiles = tilesLayer.data;
      const tileMime = tilesLayer.mime ?? "image/png";
      const tileQuality = tilesLayer.quality ?? 0.5;
      for (let t in tiles) {
        if (tiles[t].show) {
          // position "top": over the basemap (in #layers), like worldfile images; default under it.
          let raster = (tiles[t].position === "top" && layerGroup ? layerGroup : parent)
            .append("g")
            .attr("id", "tiles-" + uid + "-" + tiles[t].id)
            .attr("data-raster-order", tiles[t].order ?? null)
            .style("mix-blend-mode", tiles[t].blendMode ?? "normal")
            .style("opacity", tiles[t].opacity ?? 1);

          if (typeof tiles[t].filter !== undefined) {
            filter = tiles[t].filter;
          }
          url = tiles[t].url ? tiles[t].url : null;
          format = tiles[t].format ? tiles[t].format : null;
          let zoom = tiles[t].zoom ? tiles[t].zoom : null;
          // Pass this layer's url/format in: tiles now load later through the shared queue, so a
          // source() reading the loop's shared `url` got whichever layer was set LAST (mixed URLs).
          let tileset = getTiles(tiles[t].type, zoom, filter, url, format);
          let slippy = geoTile(null, tiles[t])
            .size([width, height])
            .tileSet(tileset);

          if (typeof tiles[t].delta == "number") {
            slippy = geoTile(tiles[t].delta, tiles[t])
              .size([width, height])
              .tileSet(tileset);
          }
          if (tiles[t].colorRamp) slippy.colorRamp(tiles[t].colorRamp);
          slippy.projection(projection);
          slippy.margin(margin);
          // A PMTiles archive stops at its header's maxZoom — asking past it returns nothing for
          // every tile, so a big or tightly framed export (z9+ against hs.pmtiles' z8) lost the
          // whole layer. Cap the depth there; the deepest tiles are stretched to fill instead.
          const _tp = tiles[t].type == "pmtiles" && !zoom
            ? pmtilesReader(url).getHeader()
                .then((hdr) => { slippy.tileSet({ ...tileset, minDepth: hdr.minZoom, maxDepth: hdr.maxZoom }); })
                .catch(() => {})
                .then(() => slippy.tile(raster))
            : slippy.tile(raster);
          if (_tp && _tp.then) tilePromises.push(_tp);
        }
      }
      //all the tile credit goes to Andrew Reid, 2018
      function getTiles(type, zoom, filter, url, format) {
        let tileset = "";
        if (type == "url") {
          tileset = {
            type: "tileset",
            attribution: "",
            source: function (d) {
              return url + "/" + d.z + "/" + d.x + "/" + d.y + "." + format;
            }
          };
        }
        if (type.split("-")[0] == "custom") {
          let dir = type.split("-");
          dir = dir.join("/");
          tileset = {
            type: "tileset",
            attribution: "",
            source: function (d) {
              if (zoom) {
                d.z = zoom;
              } else {
                d.z = d.z;
              }
              return (
                "https://raw.githubusercontent.com/mbrickmaps/" +
                dir.replace("custom", "") +
                "/" +
                d.z +
                "/" +
                d.x +
                "/" +
                ((1 << d.z) - d.y - 1) +
                ".png"
              );
            }
          };
        }
        if (type == "debug") {
          tileset = {
            source: function (d) {
              return `https://dummyimage.com/256x256/a8a8a8/0011ff.png&text=${
                d.z
              }/${d.x}/${(1 << d.z) - d.y - 1}`;
            }
          };
        }

        if (type == "xyz") {
          // A standard {z}/{x}/{y} raster tile template (e.g. MapTiler maps/…/{z}/{x}/{y}.jpg?key=…).
          // Not a PMTiles archive — substitute the tile coords directly.
          tileset = {
            type: "tileset",
            attribution: "",
            source: function (d) {
              return url
                .replace(/\{z\}/g, d.z)
                .replace(/\{x\}/g, d.x)
                .replace(/\{y\}/g, d.y);
            }
          };
        }

        if (type == "pmtiles") {
          const p = pmtilesReader(url);
          tileset = {
            type: "tileset",
            attribution: "",
            source: async function (d) {
              // Tiles are cached across renders (TILE_CACHE) — a re-render doesn't re-download them.
              const tile = await cachedTile(url, p, d.z, d.x, d.y);
              if (!tile) return null;
              const blob = new Blob([tile], { type: "image/png" });
              return URL.createObjectURL(blob);
            }
          };
        }
        return tileset;
      }
      function geoTile(delta, tileConfig) {
        const tau = Math.PI * 2;
        var lim = 85.05113;
        var tileSize = 256;

        var w = width;
        var h = height;
        var m = 0; // buffer (bleed) in px: the composite covers [-m, w+m] × [-m, h+m], not just the frame

        var pk = w / tau;
        var pc = [0, 0];
        var pr = 0;

        var tk = 2;
        var tx = w / 2;
        var ty = h / 2;

        var p = d3.geoMercator().scale(pk).center(pc);

        var z0 = 0;
        var z1 = 15;
        var extent = function () {
          return { left: -179.99999, top: lim, right: 179.9999, bottom: -lim };
        };
        var wrap = true;

        var tileWidth = 256;
        var tileHeight = 256;
        var xyz = true;

        var source = function (d) {
          return (
            "http://" +
            "abc"[d.y % 3] +
            ".tile.openstreetmap.org/" +
            d.z +
            "/" +
            d.x +
            "/" +
            d.y +
            ".png"
          );
        };
        var a = "Tiles © OpenStreetMap contributors";
        geoTile.xyz = function (_) {
          return arguments.length ? ((xyz = _), geoTile) : xyz;
        };

        function geoTile(_) {
          return p(_);
        }

        geoTile.width = function (_) {
          return arguments.length ? ((w = _), geoTile) : w;
        };
        geoTile.height = function (_) {
          return arguments.length ? ((h = _), geoTile) : h;
        };
        geoTile.margin = function (_) {
          return arguments.length ? ((m = +_ || 0), geoTile) : m;
        };
        geoTile.size = function (_) {
          if (arguments.length) {
            _ instanceof d3.selection
              ? ((w = _.attr("width")),
                (h = _.attr("height")),
                (tx = w / 2),
                (ty = h / 2))
              : ((w = _[0]), (h = _[1]));
            return geoTile;
          } else return [w, h];
        };
        geoTile.source = function (_) {
          return arguments.length ? ((source = _), geoTile) : source;
        };
        geoTile.projection = function (_) {
          return arguments.length
            ? ((p = _), (pk = _.scale()), (pc = _.center()), geoTile)
            : p;
        };
        geoTile.attribution = function (_) {
          return arguments.length ? ((a = _), geoTile) : a;
        };
        geoTile.wrap = function (_) {
          return arguments.length ? ((wrap = _), geoTile) : wrap;
        };
        geoTile.tileWidth = function (_) {};
        geoTile.tileHeight = function (_) {};
        var colorRamp = null;
        geoTile.colorRamp = function (_) {
          if (!arguments.length) return colorRamp;
          if (typeof _ === "function") {
            colorRamp = _;
            return geoTile;
          }

          const toRGB = (interp, f) => {
            const c = d3.color(interp(Math.max(0, Math.min(1, f))));
            return [c.r, c.g, c.b];
          };

          if (Array.isArray(_[0])) {
            const [bathyColors, topoColors, opts = {}] = _;
            const seaFloor = opts.min ?? -8000;
            const split = opts.split ?? 0; // where blue→land happens
            const peak = opts.max ?? 4000;
            const b = d3.interpolateRgbBasis(bathyColors);
            const t = d3.interpolateRgbBasis(topoColors);
            colorRamp = (e) =>
              e <= split
                ? toRGB(b, (e - seaFloor) / (split - seaFloor))
                : toRGB(t, (e - split) / (peak - split));
          } else {
            const r = d3.interpolateRgbBasis(_);
            colorRamp = (e) => toRGB(r, e / 4000);
          }
          return geoTile;
        };
        geoTile.invert = function (_) {
          return p.invert(_);
        };
        geoTile.center = function (_) {
          var rotate = d3.geoRotation(p.rotate());
          if (arguments.length) {
            pc = rotate(_);
            p.center(pc);
            return geoTile;
          } else {
            return rotate.invert(pc);
          }
        };
        geoTile.scale = function (_) {
          return arguments.length ? ((pk = _), p.scale(pk), geoTile) : pk;
        };
        geoTile.rotate = function (_) {
          return arguments.length ? ((pr = _), p.rotate([pr, 0]), geoTile) : pr;
        };
        geoTile.fit = function (_) {
          return arguments.length
            ? (p.fitSize([w, h], _),
              (tx = p.translate()[0]),
              (ty = p.translate()[1]),
              (pk = p.scale()),
              geoTile)
            : "n/a";
        };
        geoTile.fitMargin = function (m, f) {
          return arguments.length > 1
            ? (p.fitExtent(
                [
                  [m, m],
                  [w - m, h - m]
                ],
                f
              ),
              (tx = p.translate()[0]),
              (ty = p.translate()[1]),
              (pk = p.scale()),
              geoTile)
            : "n/a";
        };

        geoTile.zoomScale = function (_) {
          return arguments.length ? ((tk = _), p.scale(pk * tk), geoTile) : tk;
        };
        geoTile.zoomTranslate = function (_) {
          return arguments.length
            ? ((tx = _[0]), (ty = _[1]), p.translate([tx, ty]), geoTile)
            : [tx, ty];
        };
        geoTile.zoomIdentity = function () {
          return d3.zoomIdentity.translate(tx, ty).scale(tk).translate(0, 0);
        };
        geoTile.zoomTransform = function (t) {
          return (
            (tx = t.x),
            (ty = t.y),
            (tk = t.k),
            p.translate([tx, ty]),
            p.scale(pk * tk),
            geoTile
          );
        };

        // The zoom that matches the frame's scale at its centre (before the tile-count cap).
        const baseDepth = function () {
          var a = [w / 2 - 1, h / 2];
          var b = [w / 2 + 1, h / 2];
          var dx = d3.geoDistance(p.invert(a), p.invert(b));
          var scale = ((20 / dx) * tk * pk) / 200;
          var z = Math.max(Math.log(scale) / Math.LN2 - 8, 2);
          return Math.min(z, 15) | 0;
        };
        geoTile.tileDepth = function () {
          var z = baseDepth();
          var maxTiles = (w * h) / 256 / 128;

          while (d3quadTiles(p, z).length > maxTiles) {
            z--;
          }

          if (delta) {
            z = z + delta;
          }
          return z;
        };
        geoTile.zoomTranslateExtent = function (_) {
          var e = extent();
          if (arguments.length) {
            e.left = _[0][0];
            e.top = _[0][1];
            e.right = _[1][0];
            e.bottom = _[1][1];
            return geoTile;
          } else {
            var x0 = p([e.left - pr, e.top])[0] - tx;
            var y0 = p([e.left - pr, e.top])[1] - ty;
            var x1 = p([e.right - pr, e.bottom])[0] - tx;
            var y1 = p([e.right - pr, e.bottom])[1] - ty;
            return [
              [x0, y0],
              [x1, y1]
            ];
          }
        };
        geoTile.zoomTranslateConstrain = function () {
          var e = extent();
          e.left = p.invert([0, 0])[0];
          e.top = p.invert([0, 0])[1];
          e.right = p.invert([w, h])[0];
          e.bottom = p.invert([w, h])[1];

          var x0 = p([e.left - pr, e.top])[0] - tx;
          var y0 = p([e.left - pr, e.top])[1] - ty;
          var x1 = p([e.right - pr, e.bottom])[0] - tx;
          var y1 = p([e.right - pr, e.bottom])[1] - ty;
          return [
            [x0, y0],
            [x1, y1]
          ];
        };

        geoTile.tiles = function () {
          var z = geoTile.tileDepth();
          var set = d3quadTiles(p, Math.max(z0, Math.min(z, z1)));
          // The port clips framed maps to the frame (clipExtent); the original Mapa didn't. For a
          // circle-clipped projection (orthographic) that frame clip leaves the tile search empty, so
          // search on the unframed projection, as the original did. Coarser — raise `delta` for detail.
          // That used to drop the frame and search the whole visible hemisphere — so the zoom fell
          // to ~2 (blurry) and raising delta multiplied tiles all over the globe. frameQuadTiles
          // keeps the frame: a tile counts only if it really shows inside the w×h export.
          if (!set.length) {
            const maxTiles = (w * h) / 256 / 128;
            z = baseDepth();
            while (z > 2 && frameQuadTiles(p, z, w, h, m).length > maxTiles) z--;
            if (delta) z = z + delta;
            set = frameQuadTiles(p, Math.max(z0, Math.min(z, z1)), w, h, m);
          }
          return set;
        };
        geoTile.tile = function (g) {
          // Returns a promise that resolves once all tiles have loaded and the single composite
          // image is drawn — so the caller can wait for the layer before showing the SVG.
          let _resolve;
          const _done = new Promise((r) => (_resolve = r));
          const type = g.attr("id").split("-")[2];
          const path = d3.geoPath(p);
          const tileList = geoTile.tiles();

          const decoded = [];
          let lo = Infinity,
            hi = -Infinity;
          let pending = tileList.length;
          // Diagnostics: which zoom level was requested and how many tiles came back empty (e.g. the
          // requested z is past the archive's maxzoom). Read by the page's per-frame log.
          const tileZ = tileList.length ? tileList[0].key[2] : null;
          let tileEmpty = 0, tileFailed = 0;
          g.attr("data-tile-z", tileZ).attr("data-tile-count", tileList.length);
          if (!pending) { _resolve(); return _done; }  // nothing to load

          // Same layer, same tiles, same projection and size as an earlier render → reuse that
          // render's finished composite: no tile requests, no queue, no reprojection.
          const compKey = compositeKey();
          const hit = compKey && compositeGet(compKey);
          if (hit) {
            window._lo = hit.lo;
            window._hi = hit.hi;
            g.attr("data-tile-fresh", 0).attr("data-tile-cached", "composite")
              .attr("data-tile-empty", hit.tileEmpty).attr("data-tile-failed", 0);
            g.selectAll("image.tile").remove();
            g.append("image")
              .attr("class", "tile")
              .attr("xlink:href", hit.href)
              .attr("x", -m)
              .attr("y", -m)
              .attr("width", w + 2 * m)
              .attr("height", h + 2 * m);
            _resolve();
            return _done;
          }
          // Everything the composite's pixels depend on. The projection is fingerprinted by where a
          // grid of lon/lat points lands plus its clip, so any change to type, rotate, scale,
          // translate or parallels gives a new key.
          function compositeKey() {
            try {
              const cfg = tileConfig || {};
              const grid = [];
              for (let lon = -180; lon <= 180; lon += 30)
                for (let lat = -80; lat <= 80; lat += 20) {
                  const q = p([lon, lat]);
                  grid.push(q ? q.map((v) => Math.round(v * 1000) / 1000).join(",") : "x");
                }
              return JSON.stringify([
                cfg.type, cfg.url, cfg.format, cfg.zoom, cfg.delta, cfg.filter,
                cfg.colorRamp, tileMime, tileQuality, w, h, m,
                p.clipExtent ? p.clipExtent() : null, p.clipAngle ? p.clipAngle() : null,
                grid.join(";"), tileList.map((d) => d.key.join("/")).join(" ")
              ], (k, v) => typeof v === "function" ? String(v) : v);
            } catch (e) { return null; }
          }

          // Each tile gets up to TILE_TRIES attempts (fetch, image load, decode) with a backoff —
          // a CDN hiccup, a 429 or a momentary canvas-memory squeeze shouldn't leave a hole. Every
          // attempt goes through the shared tile queue, so only a few requests are in flight.
          const TILE_TRIES = 3;
          // When a remote tile fails, probe ONE failing URL per layer with fetch() to find out
          // why, and tell the page ("mapa:tile-error"). A server error WITHOUT CORS headers
          // (MapTiler's 429 "Too many requests" / bad-key replies) can't be read by the browser
          // at all — fetch throws — so that case is reported as such.
          let probe = null;
          const hideKey = (u) => String(u).replace(/([?&]key=)[^&]+/, "$1…");
          const probeError = (url) => probe || (probe = fetch(url, { cache: "no-store" }).then(
            async (r) => {
              if (r.ok) return "image arrived but could not be decoded";
              // HTTP/2 replies carry no statusText — name the usual suspects.
              const name = r.statusText || ({ 401: "Unauthorized (check the API key)", 403: "Forbidden (key invalid or not allowed for this site)",
                404: "Not Found (tile or tileset doesn't exist)", 429: "Too Many Requests (rate-limited)" })[r.status] || "";
              const body = (await r.text().catch(() => "")).slice(0, 160).trim();
              return "HTTP " + r.status + (name ? " " + name : "") + (body ? " — " + body : "");
            },
            () => "request blocked — the server returned an error without CORS headers, so the browser can't read it " +
              "(MapTiler does this for 429 \"Too many requests\" rate limits and invalid keys)"
          ).then((msg) => {
            console.warn("[mapa] " + type + " tiles failing: " + msg + " — e.g. " + hideKey(url));
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("mapa:tile-error", { detail: { layer: type, message: msg, url: hideKey(url) } }));
            }
            return msg;
          }));
          const start = () => {
            tileQueueAdd(tileList.length);
            // Tell the page how big this layer's request is (it warns on large ones).
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("mapa:tile-request", {
                detail: { layer: type, z: tileZ, count: fresh, cached: tileList.length - fresh }
              }));
            }
            tileList.forEach((d) => {
              const loc = { x: d.key[0], y: d.key[1], z: d.key[2] };
              const tag = "[mapa] tile " + loc.z + "/" + loc.x + "/" + loc.y;

              const attempt = (n) => tileQueueRun(() => new Promise((finish) => {
                const done = () => {
                  finish();
                  tileQ.done++;
                  if (--pending === 0) paintAll();
                };
                const fail = (why) => {
                  finish();
                  if (n < TILE_TRIES) {
                    tileQ.retrying++;
                    setTimeout(() => { tileQ.retrying--; attempt(n + 1); }, 1500 * n);
                    return;
                  }
                  tileQ.failed++;
                  tileFailed++;
                  console.warn(tag + " " + why + " (after " + TILE_TRIES + " tries)");
                  if (--pending === 0) paintAll();
                };
                // Pixels of one loaded tile image → decoded[] (shared by fresh loads and cache hits).
                const decodeImg = (img) => {
                  try {
                    const c = d3
                      .create("canvas")
                      .attr("width", tileWidth)
                      .attr("height", tileHeight);
                    const ctx = c.node().getContext("2d");  // null under canvas-memory pressure → caught below
                    ctx.drawImage(img, 0, 0, tileWidth, tileHeight);
                    const data = ctx.getImageData(0, 0, tileWidth, tileHeight).data;
                    decoded.push({ d, data });
                  } catch (e) {
                    fail("could not be decoded: " + (e && e.message));
                    return;
                  }
                  done();
                };
                const handle = (url) => {
                  if (!url) { tileEmpty++; done(); return; }
                  const remote = typeof url === "string" && /^https?:/.test(url);
                  const hit = remote && imgTileGet(url);
                  if (hit) { decodeImg(hit); return; }   // already loaded — no request
                  const img = new Image();
                  img.crossOrigin = true;
                  // Release the per-tile blob URL (pmtiles) once the image has decoded or failed — they
                  // were leaking on every render.
                  const release = () => { if (typeof url === "string" && url.startsWith("blob:")) URL.revokeObjectURL(url); };
                  img.onload = () => {
                    release();
                    if (remote) imgTilePut(url, img);
                    decodeImg(img);
                  };
                  img.onerror = () => {
                    // A tile that arrived but won't load (incl. a 429, which shows up as a CORS
                    // error) is a failure, not an empty tile.
                    release();
                    if (typeof url === "string" && /^https?:/.test(url)) {
                      probeError(url).then((why) => fail("image failed to load: " + why));
                    } else fail("image failed to load");
                  };
                  img.src = url;
                };
                // A rejected tile fetch must still count down `pending` (via fail) — otherwise
                // tilesReady never resolves and the whole render hangs on "Rendering…".
                let result;
                try { result = source(loc); } catch (e) { fail("failed: " + (e && e.message)); return; }
                if (result instanceof Promise) result.then(handle, (e) => fail("failed: " + (e && e.message)));
                else handle(result);
              }));
              attempt(1);
            });
          };
          // How many tiles this render actually has to FETCH: URL tiles already loaded (same view
          // re-rendered) cost nothing. Only sync URL sources can be checked; PMTiles (async source,
          // own byte cache) count in full.
          const syncUrls = source && source.constructor && source.constructor.name !== "AsyncFunction";
          const fresh = syncUrls ? tileList.filter((d) => {
            try { const u = source({ x: d.key[0], y: d.key[1], z: d.key[2] }); return !(typeof u === "string" && imgTileHas(u)); }
            catch (e) { return true; }
          }).length : tileList.length;
          g.attr("data-tile-fresh", fresh);
          // Ask the page first (big requests are slow and can get a MapTiler key rate-limited) —
          // only about tiles that will really be requested.
          const ask = fresh && getTileRequestGuard() ? getTileRequestGuard()({ layer: type, z: tileZ, count: fresh }) : true;
          Promise.resolve(ask).catch(() => false).then((ok) => {
            if (ok) { start(); return; }
            g.attr("data-tile-skipped", "true");
            console.warn("[mapa] " + type + " tile request (" + tileList.length + " tiles, z" + tileZ + ") skipped");
            _resolve();
          });

          function paintAll() {
            let lo = Infinity,
              hi = -Infinity;
            decoded.forEach(({ data }) => {
              for (let s = 0; s < data.length; s += 4) {
                const e =
                  data[s] * 256 + data[s + 1] + data[s + 2] / 256 - 32768;
                if (e <= -32768) continue;
                if (e < lo) lo = e;
                if (e > hi) hi = e;
              }
            });
            window._lo = lo;
            window._hi = hi;
            // Composite every reprojected tile onto ONE full-frame canvas and emit a single
            // <image>, instead of one <image> per tile (keeps the SVG light + one object in
            // Illustrator). The per-tile reprojection math below is unchanged.
            const comp = document.createElement("canvas");
            comp.width = w + 2 * m;
            comp.height = h + 2 * m;
            const compCtx = comp.getContext("2d");

            decoded.forEach(function ({ d, data }) {
              const k = d.key;
              const tilesAcross = 1 << k[2];
              const webMercator = d3
                .geoMercator()
                .scale(tilesAcross / Math.PI / 2)
                .translate([0, 0])
                .center([0, 0]);

              const b = path.bounds(d),
                x0 = b[0][0] | 0,
                y0 = b[0][1] | 0,
                x1 = (b[1][0] + 1) | 0,
                y1 = (b[1][1] + 1) | 0;

              const λ0 = (k[0] / tilesAcross) * 360 - 180,
                λ1 = ((k[0] + 1) / tilesAcross) * 360 - 180,
                φ1 = webMercator.invert([0, k[1] - tilesAcross / 2])[1],
                φ0 = webMercator.invert([0, k[1] + 1 - tilesAcross / 2])[1];

              const newCanvas = d3.create("canvas").node();
              newCanvas.width = x1 - x0;
              newCanvas.height = y1 - y0;
              const newContext = newCanvas.getContext("2d");

              if (newCanvas.width > 0 && newCanvas.height > 0) {
                const target = newContext.createImageData(
                  newCanvas.width,
                  newCanvas.height
                );
                const td = target.data;

                for (let y = y0, i = -1; y < y1; ++y) {
                  for (let x = x0; x < x1; ++x) {
                    const pt = p.invert([x, y]),
                      λ = pt[0],
                      φ = pt[1];
                    if (λ > λ1 || λ < λ0 || φ > φ1 || φ < φ0) {
                      i += 4;
                      td[i] = 0;
                      continue;
                    }
                    const top =
                      ((((tilesAcross + webMercator([0, φ])[1]) * tileHeight) |
                        0) %
                        256 |
                        0) *
                      tileWidth;
                    const q =
                      (((((λ - λ0) / (λ1 - λ0)) * tileWidth) | 0) + top) * 4;
                    const r = data[q],
                      gg = data[q + 1],
                      bb = data[q + 2];

                    if (colorRamp) {
                      const elev = r * 256 + gg + bb / 256 - 32768;
                      if (elev > -32768) {
                        if (elev < window._lo) window._lo = elev;
                        if (elev > window._hi) window._hi = elev;
                      }
                      const [cr, cg, cb] = colorRamp(elev);
                      td[++i] = cr;
                      td[++i] = cg;
                      td[++i] = cb;
                      td[++i] = colorRamp ? (elev <= -32768 ? 0 : 255) : 255;
                    } else {
                      td[++i] = r;
                      td[++i] = gg;
                      td[++i] = bb;
                      td[++i] = r < 2 && gg < 2 && bb < 2 ? 0 : 255;
                    }
                  }
                }
                newContext.clearRect(0, 0, newCanvas.width, newCanvas.height);

                newContext.putImageData(target, 0, 0);
                // Draw this reprojected tile into the shared full-frame canvas at its screen
                // position (transparent nodata pixels don't overwrite neighbours).
                compCtx.drawImage(newCanvas, x0 + m, y0 + m);
              }
            });

            // Under canvas-memory pressure toDataURL returns an empty "data:," — the hillshade would
            // silently vanish. Count that as every tile failing (and warn).
            let href = "";
            try { href = comp.toDataURL(tileMime, tileQuality); } catch (e) { href = ""; }
            if (!href || href.length < 32) {
              tileFailed = tileList.length;
              console.warn("[mapa] raster composite came out blank (" + w + "×" + h + ") — counted as failed");
            }
            g.attr("data-tile-empty", tileEmpty).attr("data-tile-failed", tileFailed);
            // Keep only complete composites — one with holes should retry its tiles next render.
            if (compKey && !tileFailed) compositePut(compKey, { href, tileEmpty, lo: window._lo, hi: window._hi });
            g.selectAll("image.tile").remove();
            g.append("image")
              .attr("class", "tile")
              .attr("xlink:href", href)
              .attr("x", -m)
              .attr("y", -m)
              .attr("width", w + 2 * m)
              .attr("height", h + 2 * m);
            _resolve();  // composite drawn — this tile layer is ready
          }
          return _done;
        };

        geoTile.tileSet = function (_) {
          if (arguments.length) {
            a = _.attribution ? _.attribution : "Unknown";
            source = _.source
              ? _.source
              : (
                (a = "Tiles © OpenStreetMap contributors"),
                function (d) {
                  return (
                    "http://" +
                    "abc"[d.y % 3] +
                    ".tile.openstreetmap.org/" +
                    d.z +
                    "/" +
                    d.x +
                    "/" +
                    d.y +
                    ".png"
                  );
                });
            lim = _.limit ? _.limit : 85.05113;
            tileSize = _.tileSize ? _.tileSize : 256;
            z0 = _.minDepth ? _.minDepth : 1;
            z1 = _.maxDepth ? _.maxDepth : 20;
            wrap = _.wrap ? _.wrap : false;
            xyz = _.xyz ? _.xyz : true;
          }
          return geoTile;
        };
        return geoTile;
      }
      // Tiles that show inside a w×h frame, found by sampling instead of streaming through the
      // projection's clip (which comes back empty for globe projections with a frame clip). A tile
      // is in when one of its points lands in the frame on the visible side, or a frame point lands
      // in it (a tile bigger than the frame). Same tile objects as d3quadTiles.
      function frameQuadTiles(projection, zoom, w, h, m = 0) {
        const n = 1 << (zoom = Math.max(0, zoom));
        const step = Math.max(0.2, Math.min(1, zoom * 0.01));
        const front = (ll, xy) => {   // projected point is real, not the far side folded over
          const back = projection.invert(xy);
          return back && isFinite(back[0]) && d3.geoDistance(back, ll) < 1e-6;
        };
        const inFrame = (xy) => xy && isFinite(xy[0]) && isFinite(xy[1]) && xy[0] >= -m && xy[0] <= w + m && xy[1] >= -m && xy[1] <= h + m;
        // Frame samples every ~48 px, inverted to lng/lat once (null where off the globe).
        const fs = [];
        const gx = Math.max(2, Math.ceil((w + 2 * m) / 48)), gy = Math.max(2, Math.ceil((h + 2 * m) / 48));
        for (let i = 0; i <= gx; i++) for (let j = 0; j <= gy; j++) {
          const xy = [-m + (i / gx) * (w + 2 * m), -m + (j / gy) * (h + 2 * m)];
          const ll = projection.invert(xy);
          if (!ll || !isFinite(ll[0]) || !isFinite(ll[1])) continue;
          const re = projection(ll);
          if (re && Math.abs(re[0] - xy[0]) < 0.5 && Math.abs(re[1] - xy[1]) < 0.5) fs.push(ll);
        }
        const tiles = [];
        visit(-180, -180, 180, 180);
        return tiles;

        function visible(x1, y1, x2, y2) {
          const latN = mercatorφ(y1), latS = mercatorφ(y2);
          for (const [lon, lat] of fs) if (lon >= x1 && lon <= x2 && lat <= latN && lat >= latS) return true;
          const K = 6;
          for (let i = 0; i <= K; i++) for (let j = 0; j <= K; j++) {
            const ll = [x1 + (i / K) * (x2 - x1), latS + (j / K) * (latN - latS)];
            const xy = projection(ll);
            if (inFrame(xy) && front(ll, xy)) return true;
          }
          return false;
        }
        function visit(x1, y1, x2, y2) {
          if (tiles.length >= 8192 || !visible(x1, y1, x2, y2)) return;
          const tw = x2 - x1, δ = step * tw;
          if (tw <= 360 / n) {
            tiles.push({
              type: "Polygon",
              coordinates: [
                d3.range(x1, x2 + δ / 2, δ).map((x) => [x, y1])
                  .concat([[x2, 0.5 * (y1 + y2)]])
                  .concat(d3.range(x2, x1 - δ / 2, -δ).map((x) => [x, y2]))
                  .concat([[x1, 0.5 * (y1 + y2)]])
                  .concat([[x1, y1]])
                  .map((d) => [d[0], mercatorφ(d[1])])
              ],
              key: [(((180 + x1) / 360) * n) | 0, (((180 + y1) / 360) * n) | 0, zoom],
              centroid: [0.5 * (x1 + x2), 0.5 * (mercatorφ(y1) + mercatorφ(y2))]
            });
            return;
          }
          const x = 0.5 * (x1 + x2), y = 0.5 * (y1 + y2);
          visit(x1, y1, x, y); visit(x, y1, x2, y); visit(x1, y, x, y2); visit(x, y, x2, y2);
        }
      }
      function d3quadTiles(projection, zoom) {
        var tiles = [],
          width = 1 << (zoom = Math.max(0, zoom)),
          step = Math.max(0.2, Math.min(1, zoom * 0.01)),
          invisible,
          precision = projection.precision(),
          stream = projection.precision(960).stream({
            point: function () {
              invisible = false;
            },
            lineStart: noop,
            lineEnd: noop,
            polygonStart: noop,
            polygonEnd: noop
          });

        visit(-180, -180, 180, 180);

        projection.precision(precision);

        return tiles;

        function visit(x1, y1, x2, y2) {
          // Hard cap on subdivision. A tilted/wide (satellite) view sees a huge slice of the globe,
          // so an unbounded quadtree would enumerate hundreds of millions of tiles and hang. The cap
          // never changes the chosen zoom: tileDepth only accepts a z whose count ≤ maxTiles (~tens),
          // far below this cap, so any level that hits the cap was going to be rejected anyway.
          if (tiles.length >= 8192) return;
          var w = x2 - x1,
            m1 = mercatorφ(y1),
            m2 = mercatorφ(y2),
            δ = step * w;
          invisible = true;
          stream.polygonStart(), stream.lineStart();
          for (var x = x1; x < x2 + δ / 2 && invisible; x += δ)
            stream.point(x, m1);
          for (var y = m1; (y += δ) < m2 && invisible; ) stream.point(x2, y);
          for (var x = x2; x > x1 - δ / 2 && invisible; x -= δ)
            stream.point(x, m2);
          for (var y = m2; (y -= δ) > m1 && invisible; ) stream.point(x1, y);
          if (invisible) stream.point(x1, m1);
          stream.lineEnd(), stream.polygonEnd();
          if (w <= 360 / width) {
            if (!invisible) {
              tiles.push({
                type: "Polygon",
                coordinates: [
                  d3
                    .range(x1, x2 + δ / 2, δ)
                    .map(function (x) {
                      return [x, y1];
                    })
                    .concat([[x2, 0.5 * (y1 + y2)]])
                    .concat(
                      d3.range(x2, x1 - δ / 2, -δ).map(function (x) {
                        return [x, y2];
                      })
                    )
                    .concat([[x1, 0.5 * (y1 + y2)]])
                    .concat([[x1, y1]])
                    .map(function (d) {
                      return [d[0], mercatorφ(d[1])];
                    })
                ],
                key: [
                  (((180 + x1) / 360) * width) | 0,
                  (((180 + y1) / 360) * width) | 0,
                  zoom
                ],
                centroid: [0.5 * (x1 + x2), 0.5 * (m1 + m2)]
              });
            }
          } else if (!invisible) {
            var x = 0.5 * (x1 + x2),
              y = 0.5 * (y1 + y2);
            visit(x1, y1, x, y);
            visit(x, y1, x2, y);
            visit(x1, y, x, y2);
            visit(x, y, x2, y2);
          }
        }
      }
      function mercatorφ(y) {
        return (Math.atan(Math.exp((-y * Math.PI) / 180)) * 360) / Math.PI - 90;
      }
      function noop() {}
    }
}

function drawWorldfileRaster({ parent, layerGroup, rasterLayer, projection, width, height, margin = 0 }) {
    // The warp covers the buffer (bleed) too: canvas pixel (x, y) is map point (x - m, y - m).
    const m = margin, W = width + 2 * margin, H = height + 2 * margin;
    if (!(rasterLayer && rasterLayer.show)) return;
    {
      for (let r of rasterLayer.data) {
        if (!r.show) continue;
        const mime = r.format ?? "image/png"; // not webp: Figma (and older Illustrator) can't read WebP in an SVG
        const quality = r.quality ?? 0.8;
        const wf = r.worldfile;
        const img = r.image;

        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d");

        const src = document.createElement("canvas");
        src.width = img.naturalWidth;
        src.height = img.naturalHeight;
        const sctx = src.getContext("2d");
        sctx.drawImage(img, 0, 0);
        const sourceData = sctx.getImageData(
          0,
          0,
          img.naturalWidth,
          img.naturalHeight
        ).data;

        const target = ctx.createImageData(W, H);
        const td = target.data;
        const isGeographic = Math.abs(wf.xPixelSize) < 1;

        for (let y = 0, i = -1; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const pt = projection.invert([x - m, y - m]);
            if (!pt || isNaN(pt[0]) || isNaN(pt[1])) {
              i += 4;
              continue;
            }
            const [lon, lat] = pt;
            const check = projection([lon, lat]);
            if (
              !check ||
              Math.abs(check[0] - (x - m)) > 1 ||
              Math.abs(check[1] - (y - m)) > 1
            ) {
              i += 4;
              continue;
            }
            const sx = isGeographic
              ? Math.round(
                  (lon - (wf.xUpperLeft + wf.xPixelSize / 2)) / wf.xPixelSize
                )
              : Math.round(
                  ((lon * 20037508.34) / 180 -
                    (wf.xUpperLeft + wf.xPixelSize / 2)) /
                    wf.xPixelSize
                );
            const sy = isGeographic
              ? Math.round(
                  (lat - (wf.yUpperLeft + wf.yPixelSize / 2)) / wf.yPixelSize
                )
              : Math.round(
                  (((Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) /
                    (Math.PI / 180)) *
                    20037508.34) /
                    180 -
                    (wf.yUpperLeft + wf.yPixelSize / 2)) /
                    wf.yPixelSize
                );
            if (
              sx < 0 ||
              sx >= img.naturalWidth ||
              sy < 0 ||
              sy >= img.naturalHeight
            ) {
              i += 4;
              continue;
            }
            const q = (sy * img.naturalWidth + sx) * 4;

            td[++i] = sourceData[q];
            td[++i] = sourceData[q + 1];
            td[++i] = sourceData[q + 2];
            td[++i] = sourceData[q + 3];
          }
        }

        ctx.putImageData(target, 0, 0);
        // Worldfile images sit in the raster stack (#tilelayer), just above the tile layers and under
        // the basemap. position: "top" draws them in #layers (over the basemap), as the original did.
        (r.position === "top" ? layerGroup : parent)
          .append("image")
          .attr("id", r.id || "raster")
          .attr("data-raster-order", r.order ?? null)
          .attr("href", canvas.toDataURL(mime, quality))
          .attr("x", -m)
          .attr("y", -m)
          .attr("width", W)
          .attr("height", H)
          .attr("opacity", r.opacity ?? 1) // ?? not ||: opacity 0 is a real setting
          .attr("mask", r.mask ? `url(#${r.mask})` : null)
          .style("mix-blend-mode", r.blendMode ?? "normal");
      }
    }
}

// `parent` is the pre-created <g id="tilelayer"> group (same early-creation requirement as
// basemap/scalebar -- see their modules). Sets up the inner raster sub-group + the satellite/
// custom-projection terrain clip (unconditional, matches the original code which ran before any
// show-flag check), then draws tile layers and worldfile-image layers in their original order.
export function drawRasterLayers({ parent, layerGroup, tilesLayer, rasterLayer, projection, path, width, height, margin = 0, uid, defs, isCustomProjection, tilePromises }) {
  parent.append("g").attr("id", "raster");

  if (isCustomProjection) {
    const terrainClipId = `terrain-clip-${uid}`;
    defs
      .append("clipPath")
      .attr("id", terrainClipId)
      .append("path")
      .attr("d", path({ type: "Sphere" }));
    parent.attr("clip-path", `url(#${terrainClipId})`);
  }

  drawTileLayers({ parent, layerGroup, tilesLayer, projection, width, height, margin, uid, tilePromises });
  drawWorldfileRaster({ parent, layerGroup, rasterLayer, projection, width, height, margin });
  // Tiles and images are drawn kind by kind; restack them by their shared `order` (the panel's list,
  // bottom first) within each group they landed in, keeping the stack where it sits in that group.
  for (const grp of [parent, layerGroup]) {
    const el = grp && grp.node && grp.node();
    if (!el) continue;
    const nodes = [...el.children].filter((n) => n.getAttribute("data-raster-order") != null);
    if (nodes.length < 2) continue;
    const anchor = nodes[nodes.length - 1].nextSibling;
    nodes.sort((a, b) => +a.getAttribute("data-raster-order") - +b.getAttribute("data-raster-order"))
      .forEach((n) => el.insertBefore(n, anchor));
  }
}
