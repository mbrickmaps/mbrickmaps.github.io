// Points/annotations/label rendering, extracted from mapa.js (Phase 1 decomposition)
// createAnnotationGroups/addPoints/addAnnotations close over the same render-call state
// (gannotation group, uid, projection, width, height, path), so this module exports a
// factory -- createLabelRenderer(deps) returns the three functions bound to that state --
// preserving the original closure shape exactly, same pattern as layer.js/createLayer.
import { d3 } from "./vendor.4692b715.js";

export function createLabelRenderer({ gannotation, uid, projection, width, height, path, defs }) {
    function createAnnotationGroups(groups) {
      for (let g of groups) {
        gannotation.append("g").attr("id", "group-" + uid + "-" + g);
      }
    }
    function addPoints(data, options = {}) {
      // An unnamed point is just a marker with no label — don't drop the whole layer for it.
      if (!data.length) return;

      const dirDefaults = {
        N: { halign: "middle", valign: "bottom" },
        NE: { halign: "start", valign: "bottom" },
        E: { halign: "start", valign: "mid" },
        SE: { halign: "start", valign: "top" },
        S: { halign: "middle", valign: "top" },
        SW: { halign: "end", valign: "top" },
        W: { halign: "end", valign: "mid" },
        NW: { halign: "end", valign: "bottom" },
        C: { halign: "middle", valign: "mid" }, // centred on the coordinate (no offset — see offsetMap)
        ...options.dirDefaults
      };

      const symbolMap = {
        circle: null,
        square: d3.symbolSquare,
        triangle: d3.symbolTriangle,
        cross: d3.symbolCross,
        diamond: d3.symbolDiamond,
        star: d3.symbolStar,
        wye: d3.symbolWye
      };

      const defaultSymbol = {
        shape: "circle",
        size: 5,
        fill: "#412c26",
        stroke: "none",
        strokeWidth: 0,
        opacity: 1
      };

      const defaultLabel = {
        dir: "E",
        offset: 6,
        dx: 0,
        dy: 0,
        unit: 1,
        valign: "baseline",
        haloWidth: 0, // no halos by default (set label.haloWidth > 0 to add one)
        haloColor: "white",
        labelColor: "black",
        fontSize: null
      };

      const anchorMap = {
        start: "start",
        middle: "middle",
        end: "end"
      };

      function getFontMetrics(text, fontSize) {
        const ctx = document.createElement("canvas").getContext("2d");
        ctx.font = `${fontSize}px sans-serif`;
        const m = ctx.measureText(text);
        return {
          ascent: m.actualBoundingBoxAscent,
          descent: m.actualBoundingBoxDescent,
          width: m.width
        };
      }

      const filter = defs
        .append("filter")
        .attr("id", `halo-${uid}`)
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");
      filter
        .append("feGaussianBlur")
        .attr("stdDeviation", 1)
        .attr("result", "blur");
      const merge = filter.append("feMerge");
      merge.append("feMergeNode").attr("in", "blur");
      merge.append("feMergeNode").attr("in", "blur");
      for (let z in data) {
        const d = data[z];

        if (d.x && d.y) {
          d.lng = d.x;
          d.lat = d.y;
        }
        if (d.latlng) {
          [d.lat, d.lng] = d.latlng.split(",").map((s) => +s.trim());
        }

        const type = d.type?.trim();
        const groupText = gannotation.select(
          "#group-" + uid + "-" + (d.group ?? d.class ?? "default")
        );

        const [px, py] = projection([d.lng, d.lat]);

        const pointGroup = groupText
          .append("g")
          .attr("class", "point-group")
          .attr("transform", `translate(${px},${py})`);

        const sym = {
          ...defaultSymbol,
          ...d.symbol,
          shape: d.shape || d.symbol?.shape || defaultSymbol.shape,
          size: +(d.size || d.symbol?.size || defaultSymbol.size),
          fill: d.color || d.symbol?.fill || defaultSymbol.fill,
          stroke: d.stroke || d.symbol?.stroke || defaultSymbol.stroke,
          strokeWidth:
            d["stroke-width"] ||
            d.symbol?.strokeWidth ||
            defaultSymbol.strokeWidth,
          opacity: d.opacity || d.symbol?.opacity || defaultSymbol.opacity
        };

        sym.class = d.class || d.symbol?.class || null; // applies to both by default
        sym.symbolClass = d.symbolClass || sym.class; // overrides symbol only
        sym.labelClass = d.labelClass || sym.class; // overrides label only

        const rawDir = d.dir?.split("-")[0] || d.label?.dir || defaultLabel.dir;
        const lbl = {
          ...defaultLabel,
          ...dirDefaults[rawDir],
          ...d.label,
          dir: rawDir,
          halign: d.label?.halign ?? dirDefaults[rawDir]?.halign ?? "start",
          valign: d.label?.valign ?? dirDefaults[rawDir]?.valign ?? "baseline",
          fontSize:
            d.fontSize ??
            d.label?.fontSize ??
            dirDefaults[rawDir]?.fontSize ??
            12,
          // An explicit label colour wins; otherwise the label follows the marker colour.
          labelColor:
            d.label?.labelColor ??
            d.color ??
            dirDefaults[rawDir]?.labelColor ??
            defaultLabel.labelColor,
          haloWidth:
            d.label?.haloWidth ??
            dirDefaults[rawDir]?.haloWidth ??
            defaultLabel.haloWidth,
          haloColor:
            d.label?.haloColor ??
            dirDefaults[rawDir]?.haloColor ??
            defaultLabel.haloColor,
          // Typeface (water labels italic). Unset = inherit, as before.
          fontFamily: d.label?.fontFamily ?? null,
          fontStyle: d.label?.fontStyle ?? null,
          fontWeight: d.label?.fontWeight ?? null,
          textCase: d.label?.textCase ?? null,
          dx: d.dx ?? d.label?.dx ?? dirDefaults[rawDir]?.dx ?? defaultLabel.dx,
          dy: d.dy ?? d.label?.dy ?? dirDefaults[rawDir]?.dy ?? defaultLabel.dy,
          offset:
            d.label?.offset ??
            dirDefaults[rawDir]?.offset ??
            defaultLabel.offset,
          unit:
            d.dir?.indexOf("-") > -1
              ? +d.dir.split("-")[1]
              : d.fontSize
              ? parseInt(d.fontSize) / 3
              : d.label?.unit ?? defaultLabel.unit
        };

        const labelClass = d.class ?? d.group ?? "v-text-contextual-city";

        if (sym.shape === "circle") {
          pointGroup
            .append("circle")
            .attr("r", sym.size)
            .attr("class", sym.symbolClass ?? "")
            .attr("fill", sym.fill)
            .attr("stroke", sym.stroke)
            .attr("stroke-width", sym.strokeWidth)
            .attr("opacity", sym.opacity);
        } else if (sym.shape === "star-dot") {
          // Capital-city marker (style guide "filled star dot"): a filled dot with a light star
          // inside. Star geometry is the style guide's icon (a 12×12 box, dot r = 6), scaled to size.
          const k = +sym.size / 6;
          pointGroup
            .append("circle")
            .attr("r", sym.size)
            .attr("class", sym.symbolClass ?? "")
            .attr("fill", sym.fill)
            .attr("stroke", sym.stroke)
            .attr("stroke-width", sym.strokeWidth)
            .attr("opacity", sym.opacity);
          pointGroup
            .append("path")
            .attr("d", "M5.99919 0.479818L7.2385 4.29404H11.249L8.00444 6.65137L9.24376 10.4656L5.99919 8.10827L2.75461 10.4656L3.99393 6.65137L0.749355 4.29404H4.75987L5.99919 0.479818Z")
            .attr("transform", `scale(${k}) translate(-6,-6)`)
            .attr("fill", d.starFill ?? "#ECECEC")
            .attr("opacity", sym.opacity);
        } else if (symbolMap[sym.shape]) {
          pointGroup
            .append("path")
            .attr("class", sym.symbolClass ?? "")
            .attr("d", d3.symbol().type(symbolMap[sym.shape]).size(sym.size)())
            .attr("fill", sym.fill)
            .attr("stroke", sym.stroke)
            .attr("stroke-width", sym.strokeWidth)
            .attr("opacity", sym.opacity);
        }

        if (!d.name?.length) continue;

        // Distance from the point to the label: the marker's radius (0 when there's no marker —
        // shape "none"/"", which draws nothing above) plus the label offset.
        const markerR = sym.shape === "circle" || sym.shape === "star-dot" ? +sym.size : symbolMap[sym.shape] ? Math.sqrt(+sym.size / Math.PI) : 0;
        const h = markerR + lbl.offset;
        const diag = h * 0.707;
        const offsetMap = {
          N: [0, -h],
          NE: [diag, -diag],
          E: [h, 0],
          SE: [diag, diag],
          S: [0, h],
          SW: [-diag, diag],
          W: [-h, 0],
          NW: [-diag, -diag],
          C: [0, 0] // centre horizontally + vertically on the coordinate
        };
        const [odx, ody] = offsetMap[lbl.dir] || [h, 0];
        const lx = odx + lbl.dx * lbl.unit;
        const ly = ody + lbl.dy * lbl.unit;

        // Displayed text: capitals when the type asks for them (style guide: area labels are caps).
        const shown = lbl.textCase === "upper" ? String(d.name).toUpperCase() : d.name;
        const metrics = getFontMetrics(shown, lbl.fontSize);
        const dyShift =
          lbl.valign === "top"
            ? metrics.ascent
            : lbl.valign === "mid"
            ? metrics.ascent - (metrics.ascent + metrics.descent) / 2
            : lbl.valign === "bottom"
            ? -metrics.descent
            : /* baseline */ 0;

        if (lbl.haloWidth > 0) {
          const filterId = `halo-${uid}`;
          pointGroup
            .append("text")
            .attr("x", lx)
            .attr("y", ly + dyShift)
            .attr(
              "class",
              [sym.labelClass, labelClass].filter(Boolean).join(" ")
            )
            .attr("text-anchor", anchorMap[lbl.halign])
            .attr("fill", lbl.haloColor)
            .attr("fill-opacity", 1)
            .style("filter", `url(#halo-${uid})`)
            .style("font-size", lbl.fontSize ? `${lbl.fontSize}px` : null)
            .style("font-family", lbl.fontFamily)
            .style("font-style", lbl.fontStyle)
            .style("font-weight", lbl.fontWeight)
            .text(shown);
        }

        pointGroup
          .append("text")
          .attr("id", d.name.replace(/ /g, "_"))
          .attr("class", [sym.labelClass, labelClass].filter(Boolean).join(" "))
          .attr("text-anchor", anchorMap[lbl.halign])
          .attr("x", lx)
          .attr("y", ly + dyShift)
          .style("fill", lbl.labelColor)
          .style("font-size", lbl.fontSize ? `${lbl.fontSize}px` : null)
          .style("font-family", lbl.fontFamily)
          .style("font-style", lbl.fontStyle)
          .style("font-weight", lbl.fontWeight)
          .text(shown);
      }
    }
    // d3-svg-annotation (Susie Lu) callouts, drawn into `target` — the render's top-most group.
    // Each item: { type, lng, lat, name, label, dx, dy | noteAt:[lng,lat], bend, connector,
    // subject, disable, wrap, color, style:{ stroke, stroke-width, stroke-dasharray, fill,
    // fill-opacity, color } }. noteAt places the note at a coordinate instead of a px offset;
    // bend (fraction of the length, ± sides) bows a "curve" connector.
    // An annotation's data → [lng, lat]: an attached feature's centre, else its own lng/lat.
    function annoLngLat(dd) {
      if (dd && dd.feature) { const c = d3.geoCentroid(dd.feature); if (c.every(Number.isFinite)) return c; }
      return [dd.lng, dd.lat];
    }
    // font: { family, weight, style } from the Fonts panel's Annotations row (optional).
    function addAnnotations(data, editMode, target, font) {
      const typeMap = {
        circle: d3.annotationCalloutCircle,
        callout: d3.annotationCallout,
        elbow: d3.annotationCalloutElbow,
        curve: d3.annotationCalloutCurve,
        label: d3.annotationLabel,
        badge: d3.annotationBadge,
        rect: d3.annotationCalloutRect,
        // Arrows: a zero-radius circle callout, so the head (the subject) gets its own edit
        // handle — a disabled subject left the head pinned where it was placed. The circle callout's
        // own connector is an elbow (45° then flat), so a straight arrow asks for a plain line.
        arrow: d3.annotationCustomType(d3.annotationCalloutCircle,
          { connector: { type: "line", end: "arrow" }, note: { lineType: null } }),
        "curve-arrow": d3.annotationCustomType(d3.annotationCalloutCircle,
          { connector: { type: "curve", end: "arrow" }, note: { lineType: null } })
      };
      target.selectAll("*").remove();

      // Group by type AND text size: d3-annotation lays notes out by measuring their text, so the
      // size has to be on the group before .call() — per-note restyling afterwards left the boxes sized
      // for the default text.
      const byType = d3.group(data, (d) => (d.type || "default") + "|" + (+d.fontSize || ""));

      // d3-annotation measures note text with getBBox, which is all zeros on a detached SVG — so
      // lay out while the render is briefly in the document (hidden), then take it back out.
      const svgNode = target.node().ownerSVGElement;
      const parked = !svgNode.isConnected, cssBefore = svgNode.style.cssText;
      if (parked) {
        svgNode.style.cssText += ";position:absolute;left:-99999px;top:0;visibility:hidden";
        document.body.appendChild(svgNode);
      }

      for (const [key, group] of byType) {
        const [type, fs] = key.split("|");
        const annotationType = typeMap[type] || d3.annotationCalloutCircle;
        const annotations = group.map((d) => {
          // Position comes from DATA via d3-annotation accessors (below): lng/lat, or a GeoJSON
          // feature (its centre) when the annotation is attached to a layer. px/py here only turn
          // noteAt (a coordinate) into the note's px offset.
          const [px, py] = projection(annoLngLat({ lng: d.lng, lat: d.lat, feature: d.feature }));
          const poi = d.poi ?? {};
          let dx = d.dx ?? 20, dy = d.dy ?? -20;
          if (Array.isArray(d.noteAt)) {
            const [nx, ny] = projection(d.noteAt);
            dx = nx - px; dy = ny - py;
          }
          let connector = d.connector;
          if ((d.bend || d.skew) && (type === "curve" || type === "curve-arrow")) {
            // One control point off the midpoint: bend × length across the chord, skew × length along it.
            const b = d.bend || 0, k = d.skew || 0;
            connector = { type: "curve", ...(connector || {}),
              points: [[dx / 2 - dy * b + dx * k, dy / 2 + dx * b + dy * k]] };
          }
          return {
            note: {
              title: d.name,
              label: d.label || null,
              wrap: d.wrap ?? 150,
              ...(d.wrapSplitter ? { wrapSplitter: d.wrapSplitter } : {}),
              padding: d.type === "poi" ? d.padding ?? 0 : d.padding ?? 5,
              align: d.align || "dynamic",
              ...(d.orientation ? { orientation: d.orientation } : {}),
              // "none" = no note line; unset = the type's own default
              lineType: d.lineType === "none" ? null : d.lineType || undefined,
              bgPadding: d.bgPadding ?? 0
            },
            dx,
            dy,
            color: d.color || d.style?.stroke || "#000",
            ...(connector ? { connector } : {}),
            disable: d.type === "poi" ? [] : d.disable || [],
            subject:
              d.type === "poi"
                ? {
                    radius: d.poi?.radius ?? d.subject?.radius ?? 5,
                    radiusPadding: 0
                  }
                : d.subject || {
                    radius: d.radius ?? 5,
                    radiusPadding: d.radiusPadding ?? 2
                  },
            data: { lng: d.lng, lat: d.lat, ...(d.feature ? { feature: d.feature } : {}), poi, src: d.src }
          };
        });

        const makeAnnotation = d3
          .annotation()
          .type(annotationType)
          .editMode(editMode ?? false)
          .annotations(annotations)
          // d3-annotation's data binding: data → x/y through the map projection, and in edit mode a
          // dragged subject → data (lng/lat) through the inverse. A dragged point leaves its feature.
          .accessors({
            x: (dd) => projection(annoLngLat(dd))[0],
            y: (dd) => projection(annoLngLat(dd))[1]
          })
          .accessorsInverse({
            lng: (a) => projection.invert([a.x, a.y])[0],
            lat: (a) => projection.invert([a.x, a.y])[1],
            feature: () => undefined
          });

        const ag = target
          .append("g")
          .attr("id", "annotation-layer-" + type + (fs ? "-" + fs : ""))
          .attr("font-size", fs || 12)
          // Family / italic on the layer BEFORE layout, so d3-annotation measures the real font.
          .attr("font-family", font?.family || null)
          .attr("font-style", font?.style || null);
        ag.call(makeAnnotation);

        // d3-annotation's arrowhead is a short, wide triangle at one fixed size, and the line runs to
        // its tip. Redraw it from the stock head's tip + direction, one fixed size:
        // head "sharp" (slender, filled; default) | "open" (chevron) | "none". The line stops inside
        // the head so its butt end doesn't poke through the point. Re-applied after any redraw.
        const scaleArrows = () => group.forEach((d, i) => {
          const sw = +(d.style?.["stroke-width"] ?? 1);
          const head = d.head || "sharp";
          const sel = ag.select(`.annotation:nth-child(${i + 1})`);
          sel.selectAll("path.connector-arrow").each(function () {
            const n = (this.getAttribute("d") || "").match(/-?[\d.]+(?:e-?\d+)?/g)?.map(Number);
            if (!n || n.length < 6) return;
            const [tx, ty, ax, ay, bx, by] = n;
            const L = 10, W = head === "open" ? 4.5 : 3.5;
            // Aim along the line itself (a head's length back from the tip), so a curve's head
            // follows the bow; the stock head's own direction is the fallback.
            const line = this.parentNode?.querySelector("path.connector");
            let ux = tx - (ax + bx) / 2, uy = ty - (ay + by) / 2;
            try {
              const q = line.getPointAtLength(Math.min(L, line.getTotalLength()));
              if (Math.hypot(tx - q.x, ty - q.y) > 0.5) { ux = tx - q.x; uy = ty - q.y; }
            } catch (e) { /* not laid out: keep the stock direction */ }
            const ul = Math.hypot(ux, uy) || 1; ux /= ul; uy /= ul;
            const p = (along, across) => [tx - ux * along - uy * across, ty - uy * along + ux * across];
            const [l, r] = [p(L, W), p(L, -W)];
            this.removeAttribute("transform");
            if (head === "none") { this.setAttribute("d", ""); }
            else if (head === "open") {
              this.setAttribute("d", `M${l}L${tx},${ty}L${r}`);
              this.style.fill = "none"; this.style.strokeWidth = sw;
              this.style.strokeLinecap = "round"; this.style.strokeLinejoin = "round";
            } else {
              this.setAttribute("d", `M${tx},${ty}L${l}L${p(L * 0.82, 0)}L${r}Z`);
              this.style.strokeWidth = 0;
            }
            // Pull the line back from the tip (a zero-length dash, then a gap) unless it's dashed.
            if (line && !d.style?.["stroke-dasharray"]) {
              const cut = head === "none" ? 0 : head === "open" ? sw / 2 : L * 0.7;
              line.style.strokeDasharray = cut ? `0 ${cut} 1e6` : null;   // 1e6: still whole while a drag lengthens it
            }
          });
        });
        group.forEach((d, i) => {
          const sel = ag.select(`.annotation:nth-child(${i + 1})`);
          // Arrows borrow the circle subject only for its move handle; drop its radius handle
          // (drawn first, on the same spot at radius 0) so a grab on the head always moves it.
          if (type === "arrow" || type === "curve-arrow") {
            const hs = sel.selectAll(".annotation-subject .handle").nodes();
            hs.slice(0, -1).forEach((h) => h.remove());
          }
          const st = d.style;
          if (st) {
            const lines = sel.selectAll(".annotation-connector path, .annotation-subject path, .annotation-note-line");
            if (st["stroke-width"] != null) lines.style("stroke-width", st["stroke-width"]);
            if (st["stroke-dasharray"]) sel.selectAll(".annotation-connector path:not(.connector-end)").style("stroke-dasharray", st["stroke-dasharray"]);
            if (st.fill) sel.select(".annotation-note-bg")
              .attr("fill", st.fill).attr("fill-opacity", st["fill-opacity"] ?? 1)
              .attr("stroke", st["box-stroke"] ?? "none").attr("stroke-width", st["box-stroke-width"] ?? 1);
            if (st.color) sel.selectAll(".annotation-note-content text").style("fill", st.color);
          }
          if (type !== "poi") return;
          const poi = d.poi ?? {};
          sel
            .select(".annotation-subject path.subject")
            .style("fill", poi.solid ?? true ? poi.fill ?? "#000" : "none")
            .style("fill-opacity", "1")
            .style("stroke", poi.stroke ?? poi.fill ?? "#000")
            .style("stroke-width", poi.strokeWidth ?? 1.5);
          sel
            .select(".annotation-connector path")
            .style("stroke", poi.leader ?? true ? null : "none");
          sel.select(".annotation-note-line").style("stroke", "none");
          sel.attr("class", (sel.attr("class") || "") + " " + (d.class ?? ""));
          sel
            .select(".annotation-note-content")
            .attr("transform", `translate(${d.ndx ?? 0}, ${d.ndy ?? 0})`);
        });

        // Edit mode: report each drag as geography so the caller can store it — `at` is the
        // subject (the thing pointed at), `noteAt` the note / arrow tail. Bubbles from the <svg>.
        scaleArrows();
        // Title weight: d3-annotation writes font-weight="bold" on every title; use the panel's.
        if (font?.weight) ag.selectAll(".annotation-note-title").attr("font-weight", font.weight);
        // Arrows: dragging the head (subject) moves it alone. d3-annotation moves the whole
        // annotation with its subject, so remember where the tail was and put it back.
        const isArrow = type === "arrow" || type === "curve-arrow";
        let tail = null;
        makeAnnotation.on("dragstart", function (d) {
          tail = isArrow ? { x: d.x, y: d.y, tx: d.x + d.dx, ty: d.y + d.dy } : null;
        });
        makeAnnotation.on("dragend", function (d) {
          const inv = (xy) => (projection.invert ? projection.invert(xy) : null);
          const headMoved = tail && (d.x !== tail.x || d.y !== tail.y);
          // A curve's control point (relative to the subject) back to a bend: its offset from the
          // chord's midpoint as fractions of the chord length: across it (bend) and along it (skew).
          let bend, skew;
          const cp = d.connector?.points?.[0];
          if (cp && (type === "curve" || type === "curve-arrow")) {
            const len2 = d.dx * d.dx + d.dy * d.dy || 1;
            bend = +(((cp[0] - d.dx / 2) * -d.dy + (cp[1] - d.dy / 2) * d.dx) / len2).toFixed(3);
            skew = +(((cp[0] - d.dx / 2) * d.dx + (cp[1] - d.dy / 2) * d.dy) / len2).toFixed(3);
          }
          if (headMoved) {
            d.offset = { x: tail.tx - d.x, y: tail.ty - d.y };
            if (cp && bend != null) // re-bow the curve over the new chord with the same bend
              d.connector.points = [[d.dx / 2 - d.dy * bend + d.dx * skew, d.dy / 2 + d.dx * bend + d.dy * skew]];
            makeAnnotation.update();
            ag.selectAll(".annotation-subject .handle").each(function () {
              const hs = this.parentNode.querySelectorAll(".handle");
              if (hs.length > 1 && this !== hs[hs.length - 1]) this.remove();
            });
          }
          scaleArrows();   // the drag redrew the connector at stock size
          // d.data is the datum bound to this annotation — src is its entry in the project list.
          svgNode.dispatchEvent(new CustomEvent("annotationmove", { bubbles: true, detail: {
            src: d.data?.src, type, bend, skew,
            at: inv([d.x, d.y]),
            noteAt: inv([d.x + d.dx, d.y + d.dy])
          } }));
        });
      }

      if (parked) {
        svgNode.remove();
        svgNode.style.cssText = cssBefore;
      }
    }
  return { createAnnotationGroups, addPoints, addAnnotations };
}
