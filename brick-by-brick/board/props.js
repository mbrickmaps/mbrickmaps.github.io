/*  PROPS — panels that are decoration and nothing else.

    A prop does not read your data or change anything on the page. It blinks,
    or it is a surface, and you can put as many on the board as you like, each
    set up its own way with the ⚙ in its corner. They are board kinds (see
    registerKind in board.js): adding one from 🧰 makes a new copy every time,
    and removing a copy deletes it.

    Load after board.js, before the page starts the board:

      <link rel="stylesheet" href="props.css">
      <script src="props.js"></script>

    Colors marked "theme" follow the page's own variables, so a prop changes
    with the Theme panel unless you pick a color of your own. */

const PROP_REDUCED = () => window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const propColor = (v, themeVar) => (v === "theme" ? "var(" + themeVar + ")" : v);

/* --------------------------------------------------------------------------
   SIGNAL LIGHT — one lamp, blinking to a pattern
   -------------------------------------------------------------------------- */
/*  Morse, so a light can spell something. Letters and digits only; anything
    else is a gap. */
const PROP_MORSE = {
  a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..",
  j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.",
  s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..",
  0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....",
  6: "-....", 7: "--...", 8: "---..", 9: "----.",
};
//  On and off as a list of [lit?, units]: dot 1, dash 3, 1 between marks,
//  3 between letters, 7 between words — the standard spacing.
function propMorseRuns(text) {
  const runs = [];
  const words = String(text || "").toLowerCase().split(/\s+/).filter(Boolean);
  words.forEach((w, wi) => {
    const letters = [...w].filter(ch => PROP_MORSE[ch]);
    letters.forEach((ch, li) => {
      [...PROP_MORSE[ch]].forEach((m, mi) => {
        runs.push([true, m === "." ? 1 : 3]);
        if (mi < PROP_MORSE[ch].length - 1) runs.push([false, 1]);
      });
      if (li < letters.length - 1) runs.push([false, 3]);
    });
    runs.push([false, wi < words.length - 1 ? 7 : 10]);
  });
  return runs.length ? runs : [[true, 1], [false, 1]];
}

const PROP_OFF = 0.07;   // how much a lamp shows when it is off: dark, not gone
//  Keyframes for the lit layer's opacity, and how long one round takes.
function propLightFrames(s) {
  const speed = Math.max(0.1, Number(s.speed) || 1);
  const period = 1000 / speed;
  const hard = (runs, unit) => {
    const total = runs.reduce((n, r) => n + r[1], 0);
    const frames = [];
    let at = 0;
    for (const [lit, n] of runs) {
      const o = lit ? 1 : PROP_OFF;
      frames.push({ opacity: o, offset: at / total });
      at += n;
      frames.push({ opacity: o, offset: at / total });
    }
    return { frames, ms: total * unit, easing: "linear" };
  };
  switch (s.pattern) {
    case "steady": return null;
    //  One round per beat, the same as blink: at Speed 1 that is a second up
    //  and down, not two.
    case "pulse": return { frames: [{ opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }], ms: period, easing: "ease-in-out" };
    case "breathe": return { frames: [{ opacity: PROP_OFF }, { opacity: 1, offset: 0.4 }, { opacity: 1, offset: 0.55 }, { opacity: PROP_OFF }], ms: period * 4, easing: "ease-in-out" };
    case "heartbeat": return {
      frames: [
        { opacity: 0.12, offset: 0 }, { opacity: 1, offset: 0.06 }, { opacity: 0.3, offset: 0.16 },
        { opacity: 1, offset: 0.24 }, { opacity: 0.12, offset: 0.42 }, { opacity: 0.12, offset: 1 },
      ], ms: period * 1.4, easing: "ease-out" };
    case "flicker": {
      //  A failing tube: mostly on, with a stutter. Fixed rather than random so
      //  it does not change every time the panel is drawn.
      const runs = [[true, 9], [false, 1], [true, 2], [false, 1], [true, 14], [false, 2], [true, 1], [false, 1], [true, 6]];
      return hard(runs, period / 20);
    }
    case "morse": return hard(propMorseRuns(s.text), 180 / speed);
    default: return hard([[true, 1], [false, 1]], period / 2);   // blink
  }
}

/*  WORDS THAT FIT THE LAMP. The biggest size (in hundredths of the lamp's
    height) at which the words fit its face: on one line if that is bigger,
    otherwise a word to a line. Monospaced capitals are about 0.64 of their
    size wide, spacing included. */
function propFitText(text) {
  if (!text) return 30;
  //  The share of the round face the words may use.
  const W = 100 * 0.82, H = 100 * 0.8;
  const chars = s => [...s].length;
  const words = String(text).trim().split(/\s+/);
  const oneLine = Math.min(W / (0.64 * chars(text)), H * 0.72);
  const stacked = Math.min(W / (0.64 * Math.max(...words.map(chars))), H / (0.98 * words.length));
  return Math.max(8, Math.min(60, Math.floor(words.length > 1 ? Math.max(oneLine, stacked) : oneLine)));
}

registerKind({
  kind: "light", title: "Signal light", group: "Props", w: 1, h: 1,
  help: "A lamp that blinks, pulses, flickers or spells Morse, with words cut into its face if you like.",
  //  KEPT SHORT ON PURPOSE: what it looks like, what it says, how it moves,
  //  and how far its light carries. (The size of the words follows from the
  //  lamp they are on.)
  settings: [
    { key: "lens", label: "Lens", type: "select", default: "fresnel",
      options: ["fresnel", "frosted", ["led", "LED"]] },
    { key: "color", label: "Color", type: "color", default: "theme", theme: "--accent2" },
    { key: "pattern", label: "Pattern", type: "select", default: "blink",
      options: ["steady", "blink", "pulse", "flicker", "morse"] },
    { key: "text", label: "Morse", type: "text", default: "SOS", max: 40, when: s => s.pattern === "morse" },
    { key: "face", label: "Words", type: "text", default: "", max: 24 },
    { key: "facefont", label: "Font", type: "font", default: "", when: s => !!s.face },
    { key: "lettering", label: "Lettering", type: "select", default: "cutout",
      options: [["cutout", "cut out"], "inverted"], when: s => !!s.face },
    { key: "speed", label: "Speed", type: "range", min: 0.2, max: 12, step: 0.1, default: 1,
      when: s => s.pattern !== "steady" },
    //  ONE LAMP, OR A RACK OF THEM: a row of indicators, a grid of
    //  annunciators, a strip over a door — the same lamp, lit together.
    /*  LABELS, one per lamp. Typed as a list — PWR, RDY, FAULT — and handed
        out along the rack in order; run out and the rest go unlabelled. */
    { key: "labels", label: "Labels", type: "text", default: "", max: 160 },
    { key: "labelat", label: "Labels at", type: "select", default: "below",
      options: [["below", "below"], ["left", "left"], ["right", "right"], ["above", "above"]],
      when: s => !!s.labels },
    { key: "across", label: "Across", type: "range", min: 1, max: 10, step: 1, default: 1 },
    { key: "down", label: "Down", type: "range", min: 1, max: 8, step: 1, default: 1 },
    { key: "size", label: "Size", type: "range", min: 15, max: 100, step: 1, default: 45 },
    //  Past 1 it is overdriven: brighter than full, washing toward white. The
    //  glow round it follows.
    { key: "power", label: "Intensity", type: "range", min: 0.1, max: 3, step: 0.05, default: 1 },
    //  How far the light carries into the panel around the lamp.
    { key: "glow", label: "Reach", type: "range", min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: "grime", label: "Grime", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
  ],
  render(body, s, id) {
    if (body._propAnim) { body._propAnim.cancel(); body._propAnim = null; }
    if (body._lampAnims) { for (const a of body._lampAnims) a.cancel(); body._lampAnims = null; }
    //  Back to front: the light thrown round it, the bezel, the unlit face,
    //  the lit face, then any lettering.
    const words = s.face || "";
    const lettering = s.face ? (s.lettering || "cutout") : "";
    const across = Math.max(1, Math.round(s.across || 1)), down = Math.max(1, Math.round(s.down || 1));
    //  One label per lamp, in the order they were typed.
    const given = String(s.labels || "").split(",").map(t => t.trim());
    const tags = Array.from({ length: across * down }, (_, i) => given[i] || "");
    //  Words belong on a lamp, not on forty of them.
    const one = across * down === 1;
    const face = words && one ? '<span class="pl-text">' + bEsc(words) + "</span>" : "";
    const lamp =
      '<div class="pl-lamp" data-lens="' + bEsc(s.lens === "arcade" || !s.lens ? "fresnel" : s.lens) + '"' +
        (face && lettering ? ' data-lettering="' + bEsc(lettering) + '"' : "") + ">" +
        //  The halo is a blurred copy of THIS lamp, so the light comes off its
        //  shape rather than out of a circle at its middle.
        '<i class="pl-halo"><i></i></i><i class="pl-bezel"></i><i class="pl-face"></i>' +
        '<i class="pl-lit"></i>' + face + '<i class="pl-lens"></i><i class="pl-gloss"></i>' +
        (s.grime > 0 ? '<i class="pl-grime"></i><i class="pl-dust"></i>' : "") +
      "</div>";
    body.innerHTML =
      '<div class="prop prop-light">' +
        '<div class="pl-rack" data-labels="' + bEsc(s.labelat || "below") + '">' +
          tags.map(t => '<i class="pl-cell">' + lamp +
            (t ? '<span class="pl-tag">' + bEsc(t) + "</span>" : "") + "</i>").join("") +
        "</div>" +
      "</div>";
    body.firstElementChild.style.setProperty("--across", String(across));
    body.firstElementChild.style.setProperty("--down", String(down));
    body.firstElementChild.style.setProperty("--size", String(s.size));
    body.firstElementChild.style.setProperty("--tsize", String(propFitText(words)));
    const faceEl = body.querySelector(".pl-text");
    if (faceEl && s.facefont) faceEl.style.fontFamily = boardFontCss(s.facefont);
    //  Every copy is dirty in its own way — and every lamp in a rack in its
    //  own way again, so a row of them does not read as one lamp repeated.
    let h = 0;
    for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const lampEls = [...body.querySelectorAll(".pl-lamp")];
    lampEls.forEach((el, i) => {
      el.style.setProperty("--grime", String(s.grime || 0));
      el.style.setProperty("--dirt-x", ((h + i * 37) % 97) + "cqmin");
      el.style.setProperty("--dirt-y", (((h >> 8) + i * 53) % 89) + "cqmin");
      /*  NO TWO LAMPS BURN THE SAME, and no two racks either. A rack is a
          rack of separate bulbs — some newer, some tired, none of them
          matched — so each takes a share of the Intensity setting at random,
          drawn afresh rather than fixed to the lamp's place: a rack that
          comes back identical is a pattern, and this is not meant to be one. */
      if (lampEls.length > 1) {
        const base = s.power == null ? 1 : s.power;
        el.style.setProperty("--power", String(base * (0.55 + Math.random() * 0.75)));
      }
    });
    /*  ON THE PANEL, not just the lamp: how lit it is right now (--lit), its
        color and its glow. A frosted or smoked cover over the panel reads the
        same three, so the glass glows with the lamp and in step with it. */
    const panel = body.closest(".panel") || body;
    panel.classList.add("has-light");
    //  A masked face lets out only what the letters do, so a cover over it
    //  glows much less.
    panel.classList.toggle("light-masked", lettering === "cutout");
    panel.style.setProperty("--light-c", propColor(s.color, "--accent2"));
    //  The glow follows the brightness; it is not a setting of its own.
    panel.style.setProperty("--light-glow", String(s.glow == null ? 0.6 : s.glow));
    panel.style.setProperty("--light-power", String(s.power == null ? 1 : s.power));
    panel.style.setProperty("--lit", "1");
    const f = propLightFrames(s);
    //  With reduced motion asked for, a light is simply on.
    if (f && !PROP_REDUCED()) {
      const frames = f.frames.map(k => {
        const o = { "--lit": String(k.opacity) };
        if (k.offset !== undefined) o.offset = k.offset;
        return o;
      });
      const opts = { duration: f.ms, iterations: Infinity, easing: f.easing };
      /*  THE PANEL keeps the beat, because a cover over it reads --lit from
          here and has to glow with something. */
      body._propAnim = panel.animate(frames, opts);
      /*  EACH LAMP IN A RACK RUNS ON ITS OWN. Real indicator lamps are not
          wired to one switch: they wink out of step. Every lamp gets a
          standing start of its own, taken from its place in the rack and
          this copy's number, so the rack is never in lockstep and never
          different from one visit to the next. */
      const lamps = [...body.querySelectorAll(".pl-lamp")];
      if (lamps.length > 1) {
        body._lampAnims = lamps.map((el, i) => {
          const a = el.animate(frames, Object.assign({ delay: -Math.random() * f.ms }, opts));
          /*  Its own speed as well as its own start, both at random: offsets
              alone still read as one pattern shifted along the rack, with
              every lamp coming round again at the same moment. */
          a.playbackRate = 0.55 + Math.random() * 1.2;
          return a;
        });
      }
    }
  },
});

/* --------------------------------------------------------------------------
   MATERIAL — a surface to fill a gap in the board
   -------------------------------------------------------------------------- */
/*  Each pattern is a MASK over a layer of ink, not a picture with colors in
    it. A mask can take its color from a CSS variable, so a material set to
    "theme" changes with the Theme panel without being redrawn. The shapes are
    white on transparent; only their shape matters. */
const propSvgMask = (w, h, inner) =>
  'url("data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' + inner + "</svg>") + '")';
const PROP_MATERIALS = {
  grid: { size: [20, 20], mask: propSvgMask(20, 20,
    '<path d="M0 0.5H20M0.5 0V20" stroke="#fff" stroke-width="1" fill="none"/>') },
  blueprint: { size: [100, 100], mask: propSvgMask(100, 100,
    '<path d="M0 20.5H100M0 40.5H100M0 60.5H100M0 80.5H100M20.5 0V100M40.5 0V100M60.5 0V100M80.5 0V100" stroke="#fff" stroke-opacity="0.45" stroke-width="1" fill="none"/>' +
    '<path d="M0 0.75H100M0.75 0V100" stroke="#fff" stroke-width="1.5" fill="none"/>') },
  dots: { size: [16, 16], mask: propSvgMask(16, 16, '<circle cx="8" cy="8" r="1.5" fill="#fff"/>') },
  stripes: { size: [16, 16], mask: propSvgMask(16, 16,
    '<path d="M-4 4L4 -4M0 16L16 0M12 20L20 12" stroke="#fff" stroke-width="3" fill="none"/>') },
  paper: { size: [160, 160], mask: propSvgMask(160, 160,
    '<filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>' +
    '<feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1.4 -0.45"/></filter>' +
    '<rect width="160" height="160" filter="url(#n)"/>') },
  //  Contour lines: two sets of rings around off-centre summits. Gradients
  //  rather than a tile, so the rings are not cut off at a repeat.
  contours: { size: null, mask:
    "repeating-radial-gradient(circle at 28% 38%, #000 0 1px, transparent 1.5px 13px)," +
    "repeating-radial-gradient(circle at 78% 72%, #000 0 1px, transparent 1.5px 17px)" },
};

/*  THE BRICKS THEMSELVES, one by one.

    A wall is not one colour: bricks come out of the kiln lighter and darker,
    redder and greyer, and that mottle is most of what makes brickwork read as
    brickwork. So the ground under a brick pattern is not a flat colour but a
    tile of actual bricks, each filled a little off the colour you chose, laid
    in whichever bond is set. Four courses' worth, so the eye does not catch
    the repeat.

    The mortar lines are drawn over it exactly as before. */
/*  EVERY BOND AS ONE THING: where each brick sits in a tile that repeats.
    The mortar is then the bricks' own edges, drawn from this same list, so
    the joints cannot land anywhere but on a joint.

    A brick is 24 long and 12 high; laid on its end (a header) it shows 12.
    A brick that runs off the left of a tile is given its other half on the
    right, so the wall carries on across the repeat.

      running   stretchers, every course half a brick over — the common wall
      stack     every joint above the one below, no lap at all
      header    all headers, lapped by half a header
      english   a course of stretchers, a course of headers, turn about, the
                headers centred on the joints above them (a quarter-brick lap)
      flemish   stretcher, header, stretcher, header along every course, each
                course moved half a repeat so a header sits over a stretcher
      basket    pairs laid square to each other, turn and turn about  */
/*  A grain for the joints seen THROUGH paint. Paint fills a joint unevenly:
    it bridges some of it, sinks into the rest, and what you see afterwards is
    a broken line rather than a drawn one. */
const PROP_RELIEF_GRAIN = propSvgMask(120, 120,
  "<filter id='rg'><feTurbulence type='fractalNoise' baseFrequency='0.16' numOctaves='3' seed='23' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 2.1 -0.55'/></filter>" +
  "<rect width='120' height='120' filter='url(#rg)'/>");
const PROP_BONDS = {
  //  [tile width, tile height, [x, y, w, h] for each brick]
  running: [48, 24, [
    [0, 0, 24, 12], [24, 0, 24, 12],
    [-12, 12, 24, 12], [12, 12, 24, 12], [36, 12, 24, 12]]],
  stack: [24, 24, [[0, 0, 24, 12], [0, 12, 24, 12]]],
  header: [24, 24, [
    [0, 0, 12, 12], [12, 0, 12, 12],
    [-6, 12, 12, 12], [6, 12, 12, 12], [18, 12, 12, 12]]],
  english: [48, 24, [
    [0, 0, 24, 12], [24, 0, 24, 12],
    [-6, 12, 12, 12], [6, 12, 12, 12], [18, 12, 12, 12], [30, 12, 12, 12], [42, 12, 12, 12]]],
  flemish: [72, 24, [
    [0, 0, 24, 12], [24, 0, 12, 12], [36, 0, 24, 12], [60, 0, 12, 12],
    [-18, 12, 24, 12], [6, 12, 12, 12], [18, 12, 24, 12], [42, 12, 12, 12], [54, 12, 24, 12]]],
  basket: [24, 24, [
    [0, 0, 12, 6], [0, 6, 12, 6], [12, 0, 6, 12], [18, 0, 6, 12],
    [0, 12, 6, 12], [6, 12, 6, 12], [12, 12, 12, 6], [12, 18, 12, 6]]],
};
//  A colour as numbers, so bricks can be mixed around it.
function propRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return [128, 110, 100];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const propHex = rgb => "#" + rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
//  A fixed shuffle: the same wall every time, not a new one on every render.
function propNoise(i) { const x = Math.sin(i * 12.9898) * 43758.5453; return x - Math.floor(x); }

/*  The mortar: every brick drawn as its outline, in the joint's thickness.
    Only the joints are painted and everything else is left clear, because
    this is a mask — the ink shows where the mask is solid. Two bricks share
    an edge, and so share the line between them. */
function propBondMask(bond) {
  const [w, h, bricks] = PROP_BONDS[bond] || PROP_BONDS.running;
  const j = 1.3;                                  // the joint, in brick units
  const rects = bricks.map(([x, y, bw, bh]) =>
    "<rect x='" + x + "' y='" + y + "' width='" + bw + "' height='" + bh + "'/>").join("");
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "'>" +
    "<g fill='none' stroke='#fff' stroke-width='" + j + "'>" + rects + "</g></svg>";
  return { size: [w, h], mask: 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")' };
}

/*  THE WALL ITSELF: the same bricks, each filled a little off the colour you
    chose — lighter or darker, warmer or cooler.

    TWO LAYERS, FOR TWO REASONS. The colours must not visibly repeat, so they
    are drawn over a big field — dozens of tiles across, which at any ordinary
    size is wider and taller than the panel, so no brick you can see has a
    twin. The shading down each brick is the same on every brick, so it is a
    single tile laid over the top and costs nothing however big the wall is.

    A BRICK THAT CROSSES A SEAM IS STILL ONE BRICK: bonds carry a brick that
    runs off the left of the tile and its other half on the right, and both
    halves take the colour of the brick they belong to.  */
/*  Tiles across and down in the field. Courses are short, so it takes a lot
    of them down the wall: this covers about 600 x 1000 pixels at the default
    scale, which is bigger than a panel. */
const PROP_FIELD = [13, 42];
function propBrickGround(bond, ground, mix, seed) {
  const [w, h, bricks] = PROP_BONDS[bond] || PROP_BONDS.running;
  const base = propRgb(ground);
  const [cols, rows] = PROP_FIELD;
  const own = bricks.map(([x, y, bw, bh], i) => {
    if (x >= 0) return { i, shift: 0 };
    const j = bricks.findIndex(([x2, y2, w2, h2]) => y2 === y && w2 === bw && h2 === bh && x2 === x + w);
    return j < 0 ? { i, shift: 0 } : { i: j, shift: -1 };
  });
  const wrapCol = n => ((n % cols) + cols) % cols;
  let out = "";
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      bricks.forEach(([x, y, bw, bh], bi) => {
        //  The same brick gets the same number wherever it is drawn.
        const k = seed + own[bi].i * 131 + wrapCol(tx + own[bi].shift) * 1777 + ty * 5701;
        const n1 = propNoise(k), n2 = propNoise(k + 97);
        const light = (n1 - 0.5) * 2 * mix * 60;          // lighter or darker
        const warm = (n2 - 0.5) * 2 * mix * 26;           // redder or greyer
        const c = propHex([base[0] + light + warm, base[1] + light - warm * 0.4, base[2] + light - warm]);
        out += "<rect x='" + (x + tx * w) + "' y='" + (y + ty * h) + "' width='" + bw +
          "' height='" + bh + "' fill='" + c + "'/>";
      });
    }
  }
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + w * cols + "' height='" + h * rows +
    "'><rect width='100%' height='100%' fill='" + propHex(base) + "'/>" + out + "</svg>";
  return { url: 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")', tiles: [cols, rows] };
}
/*  A slow stain across the wall: weathering, damp, soot — a few big soft
    blotches that fall wherever they fall, at a size that has nothing to do
    with the bricks, so the eye stops finding the repeat in them. */
const PROP_STAIN = propSvgMask(220, 220,
  "<filter id='s'><feTurbulence type='fractalNoise' baseFrequency='0.012' numOctaves='3' seed='11' stitchTiles='stitch'/>" +
  "<feColorMatrix values='0 0 0 0 0.1  0 0 0 0 0.09  0 0 0 0 0.08  0 0 0 0.42 -0.06'/></filter>" +
  "<rect width='220' height='220' filter='url(#s)'/>");

/*  The face of a brick is not flat: a lit top edge and a shaded foot. One
    tile's worth, laid over the colours. */
function propBrickShade(bond) {
  const [w, h, bricks] = PROP_BONDS[bond] || PROP_BONDS.running;
  let out = "";
  for (const [x, y, bw, bh] of bricks) {
    out += "<rect x='" + x + "' y='" + y + "' width='" + bw + "' height='1' fill='#fff' opacity='0.10'/>";
    out += "<rect x='" + x + "' y='" + (y + bh - 1.2) + "' width='" + bw + "' height='1.2' fill='#000' opacity='0.16'/>";
  }
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' width='" + w + "' height='" + h + "'>" + out + "</svg>";
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")';
}

registerKind({
  kind: "material", title: "Material", group: "Props", w: 1, h: 1,
  help: "A surface to fill a gap: brick, grid, blueprint, dots, stripes, paper or contour lines.",
  settings: [
    { key: "pattern", label: "Pattern", type: "select", default: "grid",
      options: ["brick", "grid", "blueprint", "dots", "stripes", "paper", "contours"] },
    //  Which way the bricks are laid, when they are bricks.
    { key: "bond", label: "Bond", type: "select", default: "running",
      options: ["running", "stack", "header", "english", "flemish", ["basket", "basketweave"]],
      when: s => s.pattern === "brick" },
    //  How much the bricks differ from one another.
    { key: "mix", label: "Mixed", type: "range", min: 0, max: 1, step: 0.05, default: 0.4,
      when: s => s.pattern === "brick" },
    { key: "ink", label: "Lines", type: "color", default: "theme", theme: "--border" },
    { key: "ground", label: "Ground", type: "color", default: "theme", theme: "--panel" },
    { key: "scale", label: "Scale", type: "range", min: 0.5, max: 8, step: 0.1, default: 1 },
    { key: "strength", label: "Strength", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.8 },
    //  Words on the wall: painted on, or cut into it.
    { key: "words", label: "Words", type: "text", default: "", max: 24 },
    //  Any font on this computer, typed or picked from the list the browser
    //  hands over; empty means the page's own monospace.
    { key: "font", label: "Font", type: "font", default: "", when: s => !!s.words },
    { key: "wordink", label: "Word color", type: "color", default: "theme", theme: "--fg",
      when: s => !!s.words },
    { key: "tsize", label: "Text size", type: "range", min: 4, max: 40, step: 1, default: 12,
      when: s => !!s.words },
    //  The can in the corner: what comes out of it, and how wide.
    //  The can's colour and nozzle are chosen on the panel, beside the can
    //  itself — not in here, where you cannot see what they do.
    { key: "paint", label: "Paint", type: "color", default: "#d6316e" },
  ],
  //  The paint goes with the panel.
  forget(id) { try { localStorage.removeItem(BOARD_NS + "paint:" + id); } catch (e) { /* unavailable */ } },
  render(body, s, id) {
    //  This copy's own number, taken from its id: the same wall every time
    //  you come back to it, a different one from the panel beside it.
    let seed = 0;
    for (const ch of String(id || "")) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    seed %= 100000;
    //  Brickwork draws its own mortar from the bond; everything else has a
    //  pattern of its own.
    const m = s.pattern === "brick" ? propBondMask(s.bond || "running")
      : PROP_MATERIALS[s.pattern] || PROP_MATERIALS.grid;
    const words = String(s.words || "").trim();
    const lines = words ? words.split(/\s+/) : [];
    body.innerHTML = '<div class="prop prop-material"><i class="pm-ink"></i>' +
      '<canvas class="pm-paint"></canvas>' +
      //  A hint of the joints over the paint: see below.
      '<i class="pm-relief"></i>' +
      //  A ring showing how wide the can is set to spray.
      '<i class="pm-ring"></i>' +
      /*  A CAN OF PAINT LEANING AGAINST THE WALL, drawn rather than a button
          with a picture on it: body, label, neck, cap and nozzle, wearing
          whatever colour it is loaded with. Press it to pick it up — it
          tilts, and the nozzle puffs — and press it again to put it down. */
      //  The colours you can load, shown beside the can once it is in your
      //  hand: picking paint should not mean going into the settings.
      //  Nozzles: how wide the can sprays, shown as what they spray, in a row
      //  along the bottom of the wall beside the can.
      '<div class="pm-nozzles">' +
        //  From a fine line to a wide cone.
        [2, 6, 16, 40].map(n =>
          '<button type="button" class="pm-nozzle" data-brush="' + n +
            '" title="' + n + ' wide"><i style="width:' + Math.round(4 + n / 5) +
            "px;height:" + Math.round(4 + n / 5) + 'px"></i></button>').join("") +
      "</div>" +
      '<div class="pm-colors">' +
        //  Paint, not neon: the colours a can actually comes in.
        ["#d6316e", "#3fa65f", "#e0b32c", "#3d7fc1", "#d4622a", "#e8e4dc", "#17161a"]
          .map(col => '<button type="button" class="pm-swatch" data-col="' + col +
            '" title="' + col + '" style="background:' + col + '"></button>').join("") +
      "</div>" +
      '<button type="button" class="pm-can" title="spray paint: press to pick up the can, ' +
        'drag on the wall to spray, right-click to wipe it off">' +
        '<svg viewBox="0 0 40 78" aria-hidden="true">' +
          '<ellipse class="can-shadow" cx="21" cy="74" rx="13" ry="3.4"/>' +
          '<rect class="can-body" x="8" y="20" width="24" height="52" rx="4"/>' +
          '<rect class="can-shade" x="25" y="20" width="7" height="52" rx="3"/>' +
          '<rect class="can-shine" x="11" y="24" width="3.4" height="44" rx="1.7"/>' +
          '<rect class="can-label" x="8" y="38" width="24" height="15"/>' +
          '<rect class="can-neck" x="15" y="13" width="10" height="7"/>' +
          '<rect class="can-cap" x="13" y="6" width="14" height="8" rx="2"/>' +
          '<rect class="can-nozzle" x="17" y="2" width="6" height="4" rx="1.4"/>' +
          '<g class="can-puff">' +
            '<circle cx="31" cy="5" r="2.6"/><circle cx="35.5" cy="9" r="1.8"/>' +
            '<circle cx="34" cy="1.6" r="1.4"/>' +
          "</g>" +
        "</svg></button>" +
      (words ? '<span class="pm-text">' +
        lines.map(w => "<span>" + bEsc(w) + "</span>").join("") + "</span>" : "") + "</div>";
    const root = body.firstElementChild, ink = root.firstElementChild;
    //  The size you set, as a share of the panel's shorter side.
    if (words) {
      root.style.setProperty("--tsize", String(s.tsize == null ? 12 : s.tsize));
      const t = root.querySelector(".pm-text");
      //  Painted words are the color you pick; carved ones take the ground's
      //  color, because a groove is the material itself in shadow.
      root.style.setProperty("--pm-word", propColor(s.wordink || "theme", "--fg"));
      //  Whatever family you named, with the page's monospace behind it.
      t.style.fontFamily = s.font ? boardFontCss(s.font) : "";
    }
    ink.style.background = propColor(s.ink, "--border");
    ink.style.opacity = String(s.strength);
    ink.style.maskImage = ink.style.webkitMaskImage = m.mask;
    /*  PAINT COVERS THE WALL, BUT THE WALL IS STILL UNDER IT. The joints are
        drawn once more above the paint, faintly: not enough to uncover the
        brick, enough that a sprayed wall still feels like a wall rather than
        a sheet of colour. Over bare brick it does nothing you would notice. */
    const relief = body.querySelector(".pm-relief");
    //  The joints, cut by the grain: kept only where both are solid, so the
    //  line through the paint comes and goes instead of running unbroken.
    relief.style.maskImage = relief.style.webkitMaskImage = m.mask + ", " + PROP_RELIEF_GRAIN;
    relief.style.maskComposite = "intersect";
    relief.style.webkitMaskComposite = "source-in";
    /*  THE MORTAR AND THE BRICKS ARE ONE WALL, so one sum sizes both. The
        mortar tile is rounded to whole pixels first, and the brick tile is
        then exactly twice it — rounding the two separately let them drift
        apart, and the lines stopped landing on the joints. */
    let tile = null;
    if (m.size) {
      tile = [Math.max(2, Math.round(m.size[0] * s.scale)), Math.max(2, Math.round(m.size[1] * s.scale))];
      ink.style.maskSize = ink.style.webkitMaskSize = tile[0] + "px " + tile[1] + "px";
      relief.style.maskSize = relief.style.webkitMaskSize =
        tile[0] + "px " + tile[1] + "px, " + Math.round(tile[0] * 2.4) + "px " + Math.round(tile[1] * 3.1) + "px";
    } else {
      //  Gradient rings scale by zooming the whole mask.
      ink.style.maskSize = ink.style.webkitMaskSize = (100 * s.scale) + "% " + (100 * s.scale) + "%";
      relief.style.maskSize = relief.style.webkitMaskSize =
        (100 * s.scale) + "% " + (100 * s.scale) + "%, 40% 40%";
    }
    //  Brickwork: a tile of individually coloured bricks under the mortar,
    //  laid on the mortar's own grid. Anything else: the flat ground.
    if (s.pattern === "brick" && tile && (s.mix == null ? 0.4 : s.mix) > 0) {
      const hex = s.ground === "theme" || !s.ground
        ? getComputedStyle(document.documentElement).getPropertyValue("--panel").trim() || "#8a6a58"
        : s.ground;
      const bondName = s.bond || "running";
      const field = propBrickGround(bondName, hex, s.mix == null ? 0.4 : s.mix, seed);
      //  Shading on top, one tile; colours underneath, a field of them.
      /*  Three layers: the shading on each brick (one tile), a slow stain
          over the whole wall, which breaks up whatever repeat is left, and
          the bricks' own colours underneath. */
      root.style.background =
        propBrickShade(bondName) + " 0 0 / " + tile[0] + "px " + tile[1] + "px repeat, " +
        PROP_STAIN + " 0 0 / " + Math.round(tile[0] * 7.3) + "px " + Math.round(tile[1] * 11.7) + "px repeat, " +
        field.url + " 0 0 / " + (tile[0] * field.tiles[0]) + "px " + (tile[1] * field.tiles[1]) + "px repeat";
    } else {
      root.style.background = propColor(s.ground, "--panel");
    }

    /*  SPRAY PAINT.

        The can in the bottom left picks itself up when you press it; then
        dragging over the wall sprays, right-click wipes it off, and pressing
        the can again puts it down so you can use the panel normally. What you
        spray is kept beside the panel's settings (it is not a setting: a
        setting is a decision, this is a drawing) and comes back with it.

        A stroke is where the pointer went, as fractions of the panel, so it
        stays on the same bricks when the panel is resized. The speckle is
        worked out from the stroke's own number rather than at random, so
        redrawing it gives the same spray rather than a new one. */
    const canvas = body.querySelector(".pm-paint");
    const can = body.querySelector(".pm-can");
    //  The can shows what it is loaded with.
    can.style.setProperty("--pm-paint", s.paint || "#d6316e");
    const key = BOARD_NS + "paint:" + id;
    let strokes = [];
    try { strokes = JSON.parse(localStorage.getItem(key) || "[]") || []; } catch (e) { strokes = []; }
    const save = () => {
      try {
        if (strokes.length) localStorage.setItem(key, JSON.stringify(strokes));
        else localStorage.removeItem(key);
      } catch (e) { /* unavailable */ }
    };
    const ctx = canvas.getContext("2d");
    /*  WHAT A CAN DOES. It sprays while the button is held, whether your hand
        is moving or not, so paint BUILDS where you linger: every pass lays
        more on, the colour goes from a haze to solid, and if you hold it too
        long in one place it runs down the wall. The cone is dense in the
        middle and speckled at the edge.

        A stroke is what the can did: where it went, in fractions of the panel
        so it keeps its place when the panel is resized, and where it ran. The
        speckle comes from the stroke's own number rather than from chance, so
        drawing it again gives the same paint. */
    /*  A proper shuffle. The sine trick used elsewhere in this file repeats
        in patterns when you walk its input, which is how the mist ended up
        looking like halftone; this one does not. */
    const rnd = seedN => {
      let a = (seedN >>> 0) + 0x6D2B79F5;
      return () => {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    };
    const spray = (st, from) => {
      const W = canvas.width, H = canvas.height;
      const dpr = W / Math.max(1, canvas.getBoundingClientRect().width || W);
      const r = st.r * Math.min(W, H);
      /*  WHAT COMES OUT OF A CAN IS DROPLETS — nothing else. No disc, no
          gradient: a disc has an edge and paint does not. Each stamp throws a
          few hundred droplets, thickest at the middle and thinning away to
          nothing, each one landing where it lands. Passes build: one is a
          haze, five is solid, and the edge stays ragged however many you do.
          The throw is random but seeded, so drawing the same stroke again
          gives the same paint rather than a new one. */
      ctx.fillStyle = st.c;
      for (let i = from; i < st.p.length; i += 2) {
        const x = st.p[i] * W, y = st.p[i + 1] * H;
        const rand = rnd(st.k * 7919 + i);
        /*  A PRESS LAYS PAINT. One press of the button should put a solid
            spot on the wall, not a suggestion of one — a can does not need
            four passes to show up. Enough droplets to cover the cone at
            once, and each one carrying real colour. */
        const drops = Math.max(140, Math.round(r * r * 4.5));
        for (let d = 0; d < drops; d++) {
          /*  SPREAD BY AREA, NOT BY DISTANCE. Throwing droplets at an even
              spread of radius crowds them all into the middle — a ring of
              wall has more room in it the further out it is — and the cone
              comes out as a pin hole with a halo. The square root spreads
              them evenly across the circle; the softness at the edge then
              comes from the paint thinning, not from running out of drops. */
          const u = rand();
          const t = Math.sqrt(u) * 1.06;
          if (t > 1.04) continue;                 // the few that go wide
          const a = rand() * Math.PI * 2;
          const px = x + Math.cos(a) * t * r, py = y + Math.sin(a) * t * r;
          const size = (0.5 + rand() * 0.8) * dpr;
          /*  FLAT, THEN SOFT AT THE RIM. The cone is one strength across
              its face — a can does not paint a bullseye — and only the last
              quarter of it fades out, which is the overspray at the edge of
              the fan. */
          const fade = t < 0.72 ? 1 : 1 - (t - 0.72) / 0.34;
          ctx.globalAlpha = 0.2 * Math.max(0, fade);
          ctx.fillRect(px, py, size, size);
        }
      }
      ctx.globalAlpha = 1;
    };
    const paintStroke = st => spray(st, 0);
    const redraw = () => {
      //  Measured off the box it is drawn in. A canvas keeps its own 300 x 150
      //  until it is told otherwise, and a wall painted at that size and then
      //  stretched over the panel is a smear.
      const r = canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;       // not laid out yet
      const dpr = window.devicePixelRatio || 1;
      const w2 = Math.round(r.width * dpr), h2 = Math.round(r.height * dpr);
      if (canvas.width !== w2 || canvas.height !== h2) { canvas.width = w2; canvas.height = h2; }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of strokes) paintStroke(st);
    };
    redraw();
    requestAnimationFrame(redraw);                   // once the panel has a box
    if (body._paintRo) body._paintRo.disconnect();
    body._paintRo = new ResizeObserver(redraw);
    body._paintRo.observe(canvas);

    let armed = false, live = null, at = null, timer = null;
    const colors = body.querySelector(".pm-colors");
    const nozzles = body.querySelector(".pm-nozzles");
    /*  THE RING: what the can will cover, before you press. It follows the
        pointer while the can is in your hand, and flashes in the middle of
        the wall when you change nozzle, so picking a size shows you the size. */
    const ring = body.querySelector(".pm-ring");
    let ringTimer = null;
    const ringAt = (px, py) => {
      const r = canvas.getBoundingClientRect();
      const d = (s.brush == null ? 14 : s.brush) / 200 * Math.min(r.width, r.height) * 2;
      ring.style.width = ring.style.height = Math.round(d) + "px";
      ring.style.left = Math.round(px) + "px";
      ring.style.top = Math.round(py) + "px";
    };
    const flashRing = () => {
      const r = canvas.getBoundingClientRect();
      ringAt(r.width / 2, r.height / 2);
      ring.classList.add("on");
      clearTimeout(ringTimer);
      ringTimer = setTimeout(() => ring.classList.remove("on"), 900);
    };
    /*  THE CAN STAYS IN YOUR HAND. Changing a setting draws the panel again,
        and putting the can down every time you turned the brush knob made the
        knob look broken: you turned it, sprayed, and nothing came out. */
    const arm = on => {
      armed = on;
      body._canArmed = on;
      can.classList.toggle("on", on);
      colors.classList.toggle("on", on);
      nozzles.classList.toggle("on", on);
      canvas.classList.toggle("armed", on);
      if (!on) { ring.classList.remove("on"); clearTimeout(ringTimer); }
    };
    if (body._canArmed) arm(true);
    can.addEventListener("click", e => { e.stopPropagation(); arm(!armed); });
    //  Loading a different colour: the can wears it, and the next stroke uses
    //  it. What is already on the wall keeps the colour it was sprayed in.
    const markPicked = () => {
      colors.querySelectorAll(".pm-swatch").forEach(b =>
        b.classList.toggle("on", b.dataset.col.toLowerCase() === String(s.paint || "").toLowerCase()));
      nozzles.querySelectorAll(".pm-nozzle").forEach(b =>
        b.classList.toggle("on", Number(b.dataset.brush) === Number(s.brush == null ? 14 : s.brush)));
    };
    markPicked();
    nozzles.addEventListener("click", e => {
      const noz = e.target.closest(".pm-nozzle");
      if (!noz) return;
      e.stopPropagation();
      s.brush = Number(noz.dataset.brush);
      saveInstances();
      markPicked();
      arm(true);
      flashRing();
    });
    colors.addEventListener("click", e => {
      const sw = e.target.closest(".pm-swatch");
      if (!sw) return;
      e.stopPropagation();
      s.paint = sw.dataset.col;
      saveInstances();
      can.style.setProperty("--pm-paint", s.paint);
      markPicked();
      arm(true);
    });
    const wipe = e => { e.preventDefault(); strokes = []; save(); redraw(); };
    can.addEventListener("contextmenu", wipe);
    canvas.addEventListener("contextmenu", wipe);

    const puff = () => {
      if (!live || !at) return;
      const from = live.p.length;
      live.p.push(at[0], at[1]);
      spray(live, from);
      //  Holding still builds the paint up, and that is all it does: no runs
      //  down the wall.
      //  Enough is enough: a panel is not a canvas to fill with a million dots.
      if (live.p.length > 4000) stop();
    };
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null; }
      if (live) { live = null; at = null; save(); }
    };
    canvas.addEventListener("pointerdown", e => {
      if (!armed || e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      const r = canvas.getBoundingClientRect();
      at = [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
      live = { c: s.paint || "#d6316e", r: (s.brush || 14) / 200, k: Math.floor(Math.random() * 99999),
               p: [at[0], at[1]] };
      strokes.push(live);
      spray(live, 0);
      timer = setInterval(puff, 32);                 // it keeps spraying
    });
    //  The ring tracks the pointer whenever the can is in your hand.
    canvas.addEventListener("pointerenter", () => { if (armed) ring.classList.add("on"); });
    canvas.addEventListener("pointerleave", () => { if (!live) ring.classList.remove("on"); });
    canvas.addEventListener("pointermove", e => {
      if (armed) {
        const r = canvas.getBoundingClientRect();
        ringAt(e.clientX - r.left, e.clientY - r.top);
        ring.classList.add("on");
      }
      if (!live) return;
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      /*  A hand moves faster than the pointer reports, so the gap between one
          report and the next is filled in: a can leaves a line, not a row of
          dots. */
      const from = live.p.length;
      const px = live.p[from - 2], py = live.p[from - 1];
      const dx = x - px, dy = y - py;
      const step = Math.max(live.r / 3, 0.004);
      const n = Math.min(60, Math.ceil(Math.hypot(dx, dy) / step));
      for (let i = 1; i < n; i++) live.p.push(px + dx * i / n, py + dy * i / n);
      live.p.push(x, y);
      spray(live, from);
      at = [x, y];
    });
    canvas.addEventListener("pointerup", stop);
    canvas.addEventListener("pointercancel", stop);
  },
});
