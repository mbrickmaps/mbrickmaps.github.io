// World file (.pgw) for a Mercator export: EPSG:3857 metres from the artboard corners.
// Web Mercator is affine in 3857, so two corners give the whole transform (no rotation terms).

const R = 6378137;

const toMerc = ([lng, lat]) => [R * lng * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];

// projection: the render's fitted d3 projection (artboard px → lng/lat via invert); width/height:
// artboard px; pxW/pxH: the PNG's pixel size. Returns the .pgw text or null.
export function worldFileFor({ projection, width, height, pxW, pxH }) {
  const nw = projection?.invert?.([0, 0]), se = projection?.invert?.([width, height]);
  if (!nw || !se) return null;
  let [x0, y0] = toMerc(nw), [x1, y1] = toMerc(se);
  if (x1 < x0) x1 += 2 * Math.PI * R; // frame crosses the antimeridian
  const a = (x1 - x0) / pxW, e = (y1 - y0) / pxH; // e < 0: y runs down the image
  // Referenced to the centre of the top-left pixel.
  return [a, 0, 0, e, x0 + a / 2, y0 + e / 2].map((v) => v.toPrecision(15)).join("\n") + "\n";
}
