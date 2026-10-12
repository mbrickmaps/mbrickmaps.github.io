// Layer class + applyStyle helper, extracted from inside Mapa's render() getter (Phase 1
// decomposition). Both close over `defaults` (settings.defaults, the style-defaults schema)
// and are used by basemap, raster, and the general polygon-data-layer rendering, so this
// module exports a factory -- createLayer(defaults) returns a Layer class bound to that
// render call's defaults -- preserving the original closure shape exactly rather than
// threading defaults through every applyStyle call site individually.
import { topojson } from "./vendor.js";

export function createLayer(defaults, patternFill = () => null) {
    const applyStyle = (sel, style = {}, kind = "path") => {
      const d = defaults[kind];
      for (const key in d) sel.attr(key, style[key] ?? d[key]);
      // style.pattern names a tile in the pattern folder; the fill becomes url(#…) to a
      // <pattern> def (with style.fill, if any, painted under the tile).
      // The pattern def carries both opacities (fill-opacity on its colour, pattern-opacity on the
      // tile), so the shape itself draws its fill at 1 — else fill-opacity would fade the tile too.
      const pf = style.pattern ? patternFill(style) : null;
      if (pf) sel.attr("fill", pf).attr("fill-opacity", 1);
      if (style.class) sel.attr("class", style.class);
      // blend-mode: on the layer's own <g> (the one carrying its groupClass), so the layer blends
      // with what's under it as a whole — its own shapes don't blend with each other.
      if (style["blend-mode"] && style["blend-mode"] !== "normal" && style.groupClass) {
        const g = sel.node() && sel.node().parentNode;
        if (g && g.getAttribute && g.getAttribute("class") === style.groupClass) g.style.mixBlendMode = style["blend-mode"];
      }
      return sel;
    };
    class Layer {
      constructor(
        props = {
          geometry: null,
          style: null,
          class: null,
          group: null,
          path: null,
          type: null,
          scale: null
        }
      ) {
        this.geometry = props.geometry ? props.geometry : null;
        this.filter = props.filter
          ? props.filter
          : { show: null, key: null, value: null };
        this.style = props.style
          ? props.style
          : {
              stroke: null,
              "stroke-dasharray": null,
              "stroke-dashoffset": null,
              "stroke-linecap": null,
              "stroke-linejoin": null,
              "stroke-miterlimit": null,
              "stroke-opacity": null,
              "stroke-width": null,
              fill: null,
              radius: null,
              "fill-opacity": null,
              opacity: null,
              type: null
            };
        this.group = props.group ? props.group : null;
        this.path = props.path;
        this.type = props.type ? props.type : null;
        this.scale = props.scale ? props.scale : null;
      }
      get add() {
        const { geometry, style, group, path, type, scale, filter } = this;

        // Fail soft: a layer with no geometry (e.g. a basemap file that failed to load) draws
        // nothing rather than crashing the whole render on `geometry.type`. In prod the files are
        // present; this guards a missing/failed layer (a dev checkout without mapa/files/, or a CDN
        // hiccup on one layer) so the rest of the map still renders.
        if (!geometry) return group;

        if (type === "Point") {
          return applyStyle(
            group
              .append("g")
              .selectAll("circle")
              .data(geometry)
              .enter()
              .append("circle")
              .attr("cx", (d) => projection(d.geometry.coordinates)[0])
              .attr("cy", (d) => projection(d.geometry.coordinates)[1])
              .attr("r", style.radius ?? defaults.point.radius)
              .attr("class", "point"),
            style,
            "point"
          );
        }

        // qtree (scaled circles by count)
        if (type === "qtree") {
          return applyStyle(
            group
              .append("g")
              .selectAll("circle")
              .data(geometry)
              .enter()
              .append("circle")
              .attr("cx", (d) => projection(d.geometry.coordinates)[0])
              .attr("cy", (d) => projection(d.geometry.coordinates)[1])
              .attr("r", (d) => scale(d.properties.count))
              .attr("data-count", (d) => d.properties.count),
            style,
            "point"
          );
        }
        if (geometry.type === "Topology") {
          let data = topojson.feature(
            geometry,
            geometry.objects[Object.keys(geometry.objects)[0]]
          ).features;
          if (filter.show) {
            data = data.filter((d) => d.properties[filter.key] == filter.value);
          }
          return applyStyle(
            group
              .append("g")
              .attr("class", style.groupClass ?? "")
              .selectAll("path")
              .data(data)
              .enter()
              .append("path")
              .attr("d", path),
            style,
            "path"
          );
        }

        if (geometry.type === "FeatureCollection") {
          return applyStyle(
            group.append("path").datum(geometry).attr("d", path),
            style,
            "path"
          );
        }

        return applyStyle(
          group
            .append("g")
            .attr("class", style.groupClass ?? "")
            .selectAll("path")
            .data(geometry)
            .enter()
            .append("path")
            .attr("d", path),
          style,
          "path"
        );
      }
    }
  return Layer;
}
