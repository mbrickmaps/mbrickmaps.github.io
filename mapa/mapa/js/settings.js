// Settings construction, extracted from mapa.js (Phase 1 decomposition): the recursive merge
// used to layer user settings over defaultSettings(), the string-projection-name resolver,
// and buildSettings(props, defaults) -- the Mapa constructor's logic (deepmerge + the
// bounds.coordinates -> bounds.feature derivation + projection-name resolution), now
// returning a plain settings object instead of assigning onto `this`. `defaults` (the
// defaultSettings() result) is passed in rather than computed here, since defaultSettings()
// itself closes over mapa.js's BASEMAP/styles module state and stays there.
import { d3 } from "./vendor.js";

export function resolveProjection(name) {
  const factories = {
    geoMiller: d3.geoMiller,
    geoMercator: d3.geoMercator,
    geoEqualEarth: d3.geoEqualEarth,
    geoNaturalEarth1: d3.geoNaturalEarth1,
    geoOrthographic: d3.geoOrthographic,
    geoAzimuthalEqualArea: d3.geoAzimuthalEqualArea,
    geoAzimuthalEquidistant: d3.geoAzimuthalEquidistant,
    geoConicConformal: d3.geoConicConformal,
    geoConicEqualArea: d3.geoConicEqualArea,
    geoConicEquidistant: d3.geoConicEquidistant,
    geoAlbers: d3.geoAlbers,
    geoStereographic: d3.geoStereographic,
    geoEquirectangular: d3.geoEquirectangular,
    geoGnomonic: d3.geoGnomonic,
    geoTransverseMercator: d3.geoTransverseMercator,
    geoSatellite: d3.geoSatellite
  };
  const f = factories[name];
  if (!f) throw new Error("Unknown projection: " + name);
  return f();
}

export const deepmerge = function deepmerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (key === "geometry" || key === "image" || key === "worldfile") {
      result[key] = source[key];
    } else if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      key !== "coordinates"
    ) {
      result[key] = deepmerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
};

export function buildSettings(props, defaults) {
  const settings = deepmerge(defaults, props, {
    arrayMerge: (_, b) => b,
    customMerge: (key) => {
      if (["geometry", "image", "worldfile"].includes(key))
        return (_, b) => b;
    }
  });
  if (settings.bounds.coordinates) {
    settings.bounds.feature = {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: settings.bounds.coordinates
      }
    };
  }
  // A string proj is a named d3 projection (geoMiller, …) → resolve to its factory. EXCEPT for
  // proj4/raw/custom, whose render paths read projection.proj as a raw "+proj=…" string / function;
  // resolveProjection() would throw "Unknown projection" on those, so leave them untouched.
  if (typeof settings.projection.proj === "string" && !["proj4", "raw", "custom"].includes(settings.projection.type)) {
    // Keep the name — render() reads it to detect azimuthal projections that need centring by rotate.
    settings.projection.name = settings.projection.proj;
    settings.projection.proj = resolveProjection(settings.projection.proj);
  }
  return settings;
}
