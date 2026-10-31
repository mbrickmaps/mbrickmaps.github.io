// Tile fetch/cache primitives, extracted from mapa.js (Phase 1 decomposition): PMTiles
// reading + a cross-render LRU cache (tiles already downloaded do not re-download on a
// re-render), and PNG elevation/DEM decoding for the tiles colorRamp path.
import { PMTiles } from "./vendor.4692b715.js";

export const decodeUint16PNG = async function decodeUint16PNG(buffer) {
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  }
  const bytes = new Uint8Array(buffer);

  // parse IHDR
  const width =
    (bytes[16] << 24) | (bytes[17] << 16) | (bytes[18] << 8) | bytes[19];
  const height =
    (bytes[20] << 24) | (bytes[21] << 16) | (bytes[22] << 8) | bytes[23];
  const bitDepth = bytes[24];

  // collect IDAT chunks
  let idatBytes = [];
  let offset = 8;
  while (offset < bytes.length) {
    const length =
      (bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3];
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    if (type === "IDAT") {
      idatBytes.push(...bytes.slice(offset + 8, offset + 8 + length));
    }
    if (type === "IEND") break;
    offset += 12 + length;
  }

  // decompress
  const compressed = new Uint8Array(idatBytes);
  const ds = new DecompressionStream("deflate");
  const writer = ds.writable.getWriter();
  writer.write(compressed);
  writer.close();
  const raw = await new Response(ds.readable).arrayBuffer();
  const scanlines = new Uint8Array(raw);

  const bytesPerPixel = bitDepth === 16 ? 2 : 1;
  const stride = width * bytesPerPixel + 1;
  const pixels = new Uint16Array(width * height);
  const recon = new Uint8Array(height * width * bytesPerPixel);

  for (let y = 0; y < height; y++) {
    const filterType = scanlines[y * stride];
    const row = y * width * bytesPerPixel;
    const prevRow = (y - 1) * width * bytesPerPixel;

    for (let x = 0; x < width * bytesPerPixel; x++) {
      const raw = scanlines[y * stride + 1 + x];
      const a = x >= bytesPerPixel ? recon[row + x - bytesPerPixel] : 0;
      const b = y > 0 ? recon[prevRow + x] : 0;
      const c =
        x >= bytesPerPixel && y > 0 ? recon[prevRow + x - bytesPerPixel] : 0;

      let val;
      switch (filterType) {
        case 0:
          val = raw;
          break;
        case 1:
          val = (raw + a) & 0xff;
          break;
        case 2:
          val = (raw + b) & 0xff;
          break;
        case 3:
          val = (raw + Math.floor((a + b) / 2)) & 0xff;
          break;
        case 4:
          val = (raw + paeth(a, b, c)) & 0xff;
          break;
        default:
          val = raw;
      }
      recon[row + x] = val;
    }

    for (let x = 0; x < width; x++) {
      const i = row + x * bytesPerPixel;
      pixels[y * width + x] =
        bitDepth === 16 ? (recon[i] << 8) | recon[i + 1] : recon[i];
    }
  }

  return { width, height, pixels };
};

const PMTILES_READERS = new Map();
export function pmtilesReader(url) {
  if (!PMTILES_READERS.has(url)) PMTILES_READERS.set(url, new PMTiles(url));
  return PMTILES_READERS.get(url);
}
const TILE_CACHE = new Map();      // "url|z/x/y" → Promise<ArrayBuffer | null>
const TILE_CACHE_MAX = 2000;       // oldest-first eviction beyond this
export function cachedTile(url, p, z, x, y) {
  const key = url + "|" + z + "/" + x + "/" + y;
  if (TILE_CACHE.has(key)) {
    const hit = TILE_CACHE.get(key);
    TILE_CACHE.delete(key); TILE_CACHE.set(key, hit);   // mark as recently used
    return hit;
  }
  const pr = (async () => {
    // One retry: the CDN range fetch intermittently fails ("Failed to fetch").
    let tile;
    try { tile = await p.getZxy(z, x, y); }
    catch (e) { await new Promise((r) => setTimeout(r, 400)); tile = await p.getZxy(z, x, y); }
    return tile ? tile.data : null;
  })();
  TILE_CACHE.set(key, pr);
  pr.catch(() => TILE_CACHE.delete(key));   // don't cache a failure
  while (TILE_CACHE.size > TILE_CACHE_MAX) TILE_CACHE.delete(TILE_CACHE.keys().next().value);
  return pr;
}

// ---- Tile request queue (shared across layers, frames and renders) ----
// Firing every tile request at once (thousands on a big frame) gets a free MapTiler key banned
// with 429s, and the refused tiles leave holes. Run at most TILE_QUEUE_MAX tile loads at a time;
// the rest wait their turn. Progress is broadcast as a "mapa:tiles" window event for the page.
const TILE_QUEUE_MAX = 6;
export const tileQ = { waiting: [], active: 0, total: 0, done: 0, failed: 0, retrying: 0 };
function tileQueueEmit() {
  if (typeof window === "undefined") return;
  const { waiting, active, total, done, failed, retrying } = tileQ;
  window.dispatchEvent(new CustomEvent("mapa:tiles", {
    detail: { queued: waiting.length, active, total, done, failed, retrying }
  }));
}
// A new batch after the queue has drained starts the counters fresh.
export function tileQueueAdd(n) {
  if (!tileQ.active && !tileQ.waiting.length && !tileQ.retrying) {
    tileQ.total = tileQ.done = tileQ.failed = 0;
  }
  tileQ.total += n;
  tileQueueEmit();
}
// Optional page hook asked before a tile layer starts fetching: ({ layer, z, count }) →
// boolean | Promise<boolean>. false skips that layer (the rest of the map still renders).
let tileRequestGuard = null;
export function setTileRequestGuard(fn) { tileRequestGuard = fn; }
export function getTileRequestGuard() { return tileRequestGuard; }
// job: () => Promise that settles when one tile attempt has finished (loaded or failed).
export function tileQueueRun(job) {
  tileQ.waiting.push(job);
  tileQueuePump();
}
function tileQueuePump() {
  while (tileQ.active < TILE_QUEUE_MAX && tileQ.waiting.length) {
    const job = tileQ.waiting.shift();
    tileQ.active++;
    Promise.resolve().then(job).catch(() => {}).finally(() => {
      tileQ.active--;
      tileQueueEmit();
      tileQueuePump();
    });
  }
  tileQueueEmit();
}

// ---- Loaded XYZ tile images (shared across renders) ----
// URL tiles (MapTiler, OSM, …) are kept as decoded <img>s, so a re-render of the same view reuses
// them with NO request, whatever cache headers the server sends; only tiles a changed bbox newly
// needs are fetched. PMTiles tiles have their own byte cache (TILE_CACHE). Oldest-first eviction.
const IMG_TILE_CACHE = new Map();   // url → HTMLImageElement
const IMG_TILE_CACHE_MAX = 600;    // a big frame needs a few hundred; each decoded 256px tile is ~256 KB
                                   // (300 was smaller than one large view, so it evicted its own tiles
                                   // and every re-render fetched them all again)
export function imgTileGet(url) {
  const hit = IMG_TILE_CACHE.get(url);
  if (hit) { IMG_TILE_CACHE.delete(url); IMG_TILE_CACHE.set(url, hit); }   // mark recently used
  return hit;
}
export function imgTileHas(url) { return IMG_TILE_CACHE.has(url); }
export function imgTilePut(url, img) {
  IMG_TILE_CACHE.set(url, img);
  while (IMG_TILE_CACHE.size > IMG_TILE_CACHE_MAX) IMG_TILE_CACHE.delete(IMG_TILE_CACHE.keys().next().value);
}

// ---- Finished tile-layer composites (shared across renders) ----
// One entry per tile layer + tile set + projection + size (key built in raster.js): a re-render
// where nothing about the layer changed reuses the composite image as is. Each is a full-frame
// data URL (a few MB on big frames), so only a handful are kept, oldest-first eviction.
const COMPOSITE_CACHE = new Map();
const COMPOSITE_CACHE_MAX = 12;
export function compositeGet(key) {
  const hit = COMPOSITE_CACHE.get(key);
  if (hit) { COMPOSITE_CACHE.delete(key); COMPOSITE_CACHE.set(key, hit); }
  return hit;
}
export function compositePut(key, entry) {
  COMPOSITE_CACHE.set(key, entry);
  while (COMPOSITE_CACHE.size > COMPOSITE_CACHE_MAX) COMPOSITE_CACHE.delete(COMPOSITE_CACHE.keys().next().value);
}
