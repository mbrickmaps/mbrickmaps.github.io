// North arrow rendering, extracted from mapa.js (Phase 1 decomposition). Already took an
// explicit params object before this move -- near pure relocation, no logic change.

// Corner-anchored north arrow. Rotates to TRUE north at its own anchor point: invert the anchor to
// lng/lat, project a point slightly north, and take the screen angle from "up" to that direction.
// For a flat, unrotated map that angle is 0 (arrow points up); for satellite/rotated it tilts.
export function drawNorthArrow({ parent, cfg, projection, width, height }) {
  const size = +cfg.size || 40;
  const margin = Number.isFinite(cfg.margin) ? cfg.margin : 16;
  const pos = cfg.position || "top-right";
  let cx = width - margin - size / 2, cy = margin + size / 2;
  if (String(pos).includes("bottom")) cy = height - margin - size / 2;
  if (String(pos).includes("left")) cx = margin + size / 2;

  let angle = 0; // degrees clockwise; 0 = up
  if (projection && typeof projection.invert === "function") {
    const ll = projection.invert([cx, cy]);
    if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) {
      const np = projection([ll[0], Math.min(89.9, ll[1] + 0.5)]);
      if (np && Number.isFinite(np[0]) && Number.isFinite(np[1])) {
        angle = Math.atan2(np[0] - cx, -(np[1] - cy)) * 180 / Math.PI; // rotate "up" onto the north dir
      }
    }
  }

  const st = cfg.style || {};
  const stroke = st.stroke || "#333", fill = st.fill || "#333";
  const sw = st["stroke-width"] ?? 1.5;
  const h = size / 2, hw = h * 0.3, fs = st.fontSize || size * 0.32;
  const g = parent.append("g").attr("id", "north-arrow").attr("data-type", cfg.type || "arrow")
    .attr("transform", `translate(${cx.toFixed(2)},${cy.toFixed(2)}) rotate(${angle.toFixed(2)})`);
  const N = (y, s = fs) => g.append("text").attr("x", 0).attr("y", y)
    .attr("text-anchor", "middle").attr("font-family", "system-ui, sans-serif")
    .attr("font-size", s).attr("font-weight", 600).attr("fill", fill).text("N");
  // Light half of the two-tone designs: the page shows through, outlined in the arrow colour.
  const light = "#ffffff";

  switch (cfg.type) {
    case "half": {          // split arrowhead: left half filled, right half light
      const bw = h * 0.42;
      g.append("path").attr("d", `M0,${-h} L${bw},${h * 0.55} L0,${h * 0.25} Z`)
        .attr("fill", light).attr("stroke", stroke).attr("stroke-width", sw * 0.6).attr("stroke-linejoin", "round");
      g.append("path").attr("d", `M0,${-h} L${-bw},${h * 0.55} L0,${h * 0.25} Z`)
        .attr("fill", fill).attr("stroke", stroke).attr("stroke-width", sw * 0.6).attr("stroke-linejoin", "round");
      N(-h - fs * 0.25);
      break;
    }
    case "compass": {       // four-point star, north point dark; N above
      const r = h * 0.8, k = r * 0.32;
      const pt = (ang) => { const s = Math.sin(ang * Math.PI / 180), c = -Math.cos(ang * Math.PI / 180); return [s, c]; };
      for (const ang of [0, 90, 180, 270]) {
        const [sx, sy] = pt(ang), [lx, ly] = pt(ang - 45), [rx, ry] = pt(ang + 45);
        const tip = `${(sx * r).toFixed(2)},${(sy * r).toFixed(2)}`;
        const L = `${(lx * k).toFixed(2)},${(ly * k).toFixed(2)}`, R = `${(rx * k).toFixed(2)},${(ry * k).toFixed(2)}`;
        g.append("path").attr("d", `M0,0 L${L} L${tip} Z`).attr("fill", ang === 0 ? fill : light)
          .attr("stroke", stroke).attr("stroke-width", sw * 0.5).attr("stroke-linejoin", "round");
        g.append("path").attr("d", `M0,0 L${R} L${tip} Z`).attr("fill", ang === 0 ? light : fill)
          .attr("stroke", stroke).attr("stroke-width", sw * 0.5).attr("stroke-linejoin", "round");
      }
      N(-r - fs * 0.3);
      break;
    }
    case "chevron": {       // open chevron over N
      g.append("path").attr("d", `M${-h * 0.45},${-h * 0.1} L0,${-h * 0.6} L${h * 0.45},${-h * 0.1}`)
        .attr("fill", "none").attr("stroke", stroke).attr("stroke-width", sw * 1.6)
        .attr("stroke-linecap", "round").attr("stroke-linejoin", "round");
      N(h * 0.55, fs * 1.15);
      break;
    }
    case "circle": {        // ring with a pointer, N inside
      g.append("circle").attr("r", h * 0.85).attr("fill", "none").attr("stroke", stroke).attr("stroke-width", sw);
      g.append("path").attr("d", `M0,${-h * 1.12} L${hw},${-h * 0.62} L${-hw},${-h * 0.62} Z`).attr("fill", fill);
      N(fs * 0.36, fs * 1.1);
      break;
    }
    default: {              // "arrow": line + filled head + N
      g.append("line").attr("x1", 0).attr("y1", h).attr("x2", 0).attr("y2", -h * 0.55)
        .attr("stroke", stroke).attr("stroke-width", sw);
      g.append("path").attr("d", `M0,${-h} L${hw},${-h * 0.45} L${-hw},${-h * 0.45} Z`).attr("fill", fill);
      N(h + fs);
    }
  }
}
