// Scalebar rendering, extracted from mapa.js (Phase 1 decomposition). Mirrors the original
// render() block exactly -- same anchor/offset math, same tick formatting, same right-anchor
// width measurement workaround (see its inline comment below for why it's synchronous).
import { d3 } from "./vendor.js";

// `group` must be the already-created <g id="scalebar"> element, inserted into the DOM at the
// correct point *before* basemap/raster are drawn (SVG paint order is DOM order) -- even though
// its content is only filled in here, later. Appending the group lazily inside this function
// would place it after basemap/raster in the DOM and silently change layer stacking order.
export function drawScaleBar({ group: gscalebar, scalebar, projection, width, height }) {
  if (!scalebar?.show) return;

  const mapUnits = {
    km: d3.geoScaleKilometers,
    mi: d3.geoScaleMiles,
    ft: d3.geoScaleFeet,
    m: d3.geoScaleMeters,
    kilometers: d3.geoScaleKilometers,
    miles: d3.geoScaleMiles,
    feet: d3.geoScaleFeet,
    meters: d3.geoScaleMeters
  };

  let x, y;
  let anchor;

  if (scalebar.position && !scalebar.offset) {
    x = width - scalebar.position[0];
    y = height - scalebar.position[1];
    anchor = "bottom-right";
  } else {
    const offsetX = scalebar.offset ? scalebar.offset[0] : 20;
    const offsetY = scalebar.offset ? scalebar.offset[1] : 20;
    anchor = scalebar.anchor || "bottom-right";

    switch (anchor) {
      case "bottom-right":
        x = width - offsetX;
        y = height - offsetY;
        break;
      case "bottom-left":
        x = offsetX;
        y = height - offsetY;
        break;
      case "top-right":
        x = width - offsetX;
        y = offsetY;
        break;
      case "top-left":
        x = offsetX;
        y = offsetY;
        break;
      default:
        x = width - offsetX;
        y = height - offsetY;
    }
  }

  const mapScale = gscalebar
    .append("g")
    .attr("transform", `translate(${x}, ${y})`);

  var stop = 0;
  var sleft = 0;

  const scaleBarTop = d3
    .geoScaleBar()
    .projection(projection)
    .size([width, height])
    .orient(d3.geoScaleTop)
    .units(mapUnits[scalebar.topUnit])
    .distance(scalebar.topValue)
    .left(sleft)
    .top(stop)
    .label(null)
    .tickPadding(3)
    .tickFormat((d, i, e) =>
      i === e.length - 1 ? `${d} ${scalebar.topUnit}` : d
    )
    .tickValues([0, scalebar.topValue]);

  const scaleBarBottom = d3
    .geoScaleBar()
    .projection(projection)
    .size([width, height])
    .units(mapUnits[scalebar.bottomUnit])
    .orient(d3.geoScaleBottom)
    .distance(scalebar.bottomValue)
    .left(sleft)
    .top(stop)
    .label(null)
    .tickPadding(3)
    .tickFormat((d, i, e) =>
      i === e.length - 1 ? `${d} ${scalebar.bottomUnit}` : d
    )
    .tickValues([0, scalebar.bottomValue]);

  const myscaleTop = mapScale
    .append("g")
    .attr("id", "scalebart")
    .attr("transform", "translate(0, -5)");

  const myscaleBottom = mapScale
    .append("g")
    .attr("id", "scalebarb")
    .attr("transform", "translate(0, 5)");

  myscaleTop.call(scaleBarTop);
  myscaleBottom.call(scaleBarBottom);

  myscaleTop.selectAll("rect").remove();
  myscaleBottom.selectAll("rect").remove();

  const strokeColor = scalebar.style?.stroke || "#4B535D";
  const fillColor = scalebar.style?.fill || "#4B535D";
  const fontSize = scalebar.style?.fontSize || "12px";

  myscaleTop.selectAll("path, line").attr("stroke", strokeColor);
  myscaleBottom.selectAll("path, line").attr("stroke", strokeColor);

  myscaleTop
    .selectAll(".tick")
    .select("text")
    .attr("text-anchor", "start")
    .attr("dx", function (d, i) {
      if (d < 1) {
        return -3.5;
      } else {
        return -4 * +d.toString().length;
      }
    })
    .attr("font-size", fontSize)
    .attr("fill", fillColor);

  myscaleBottom
    .selectAll(".tick")
    .select("text")
    .attr("text-anchor", "start")
    .attr("dx", function (d, i) {
      if (d < 1) {
        return -3.5;
      } else {
        return -4 * +d.toString().length;
      }
    })
    .attr("font-size", fontSize)
    .attr("fill", fillColor);
  // Right-anchored bars grow rightward from their origin, so they must be shifted LEFT by their own
  // width to sit inside the frame. Measure that width SYNCHRONOUSLY from the rendered tick positions
  // (+ the end label) — NOT getBBox in a setTimeout: the export SVG is detached during render (getBBox
  // → 0), and a deferred callback fires after the async multi-frame loop has moved on, so the shift
  // silently never happened and the bar ran off the right edge (only the "0" tick visible).
  if (anchor.includes("right")) {
    const measure = (sel) => {
      let end = 0, labelPad = 0;
      sel.selectAll(".tick").each(function () {
        const m = /translate\(\s*([-\d.]+)/.exec(this.getAttribute("transform") || "");
        const tx = m ? Math.abs(parseFloat(m[1])) : 0;
        if (tx >= end) {
          end = tx;
          const t = this.querySelector("text");
          labelPad = t ? (t.textContent || "").length * (parseFloat(fontSize) || 12) * 0.55 : 0;
        }
      });
      return end + labelPad;
    };
    const barW = Math.max(measure(myscaleTop), measure(myscaleBottom));
    if (barW > 0) mapScale.attr("transform", `translate(${x - barW}, ${y})`);
  }
}
