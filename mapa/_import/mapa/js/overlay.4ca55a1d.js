// Overlay-image inlining + one-time global stylesheet injection, extracted from mapa.js
// (Phase 1 decomposition) -- the last two things render() did before returning its node.

export function ensureGlobalStyles(styles) {
    if (!document.getElementById("mapa-styles")) {
      const s = styles.cloneNode(true);
      s.id = "mapa-styles";
      document.head.appendChild(s);
    }
}

export function drawOverlay({ graphicSelection, parent, overlay, width, height }) {
    if (overlay?.show) {
      const items = overlay.items || [];
      const getDims = (svgEl, item) => [
        item.width ||
          +svgEl.getAttribute("width") ||
          svgEl.viewBox?.baseVal?.width,
        item.height ||
          +svgEl.getAttribute("height") ||
          svgEl.viewBox?.baseVal?.height
      ];

      const getPos = (anchor, offset, w, h) => {
        const [ox, oy] = offset || [0, 0];
        const cx = (width - w) / 2,
          cy = (height - h) / 2;
        const pos = {
          "top-left": [ox, oy],
          "top-right": [width - w - ox, oy],
          "top-center": [cx, oy],
          "bottom-left": [ox, height - h - oy],
          "bottom-right": [width - w - ox, height - h - oy],
          "bottom-center": [cx, height - h - oy],
          center: [cx, cy]
        };
        return pos[anchor] || [ox, oy];
      };

      const inline = (svgEl, g) => {
        [...svgEl.children].forEach((c) => {
          if (c.tagName === "defs") {
            const parentDefs = graphicSelection.select("defs").node();
            [...c.children].forEach((def) =>
              parentDefs.appendChild(def.cloneNode(true))
            );
          } else {
            g.node().appendChild(c.cloneNode(true));
          }
        });
      };
      items.forEach((item) => {
        const [w, h] = getDims(item.src, item);
        const [x, y] = getPos(item.anchor, item.offset, w, h);
        const g = parent
          .append("g")
          .attr("id", item.id)
          .attr("transform", `translate(${x},${y})`)
          .style("mix-blend-mode", item.blendMode ?? "normal");
        if (item.show) inline(item.src, g);
      });
    }
}
