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
    case "pulse": return { frames: [{ opacity: 0.15 }, { opacity: 1 }, { opacity: 0.15 }], ms: period * 2, easing: "ease-in-out" };
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
const PROP_AR = { pill: 2.1, panel: 1.7, triangle: 1.12, hex: 1.15, coin: 0.62 };
function propFitText(text, shape) {
  if (!text) return 30;
  const ar = PROP_AR[shape] || 1;
  //  The share of the lamp the words may use: the face, or less where the
  //  shape narrows (a triangle's point, the coin's strip under the slot).
  const box = shape === "coin" ? [0.84, 0.3] : shape === "triangle" ? [0.56, 0.46] : [0.82, 0.8];
  const W = ar * 100 * box[0], H = 100 * box[1];
  const chars = s => [...s].length;
  const words = String(text).trim().split(/\s+/);
  const oneLine = Math.min(W / (0.64 * chars(text)), H * 0.72);
  const stacked = Math.min(W / (0.64 * Math.max(...words.map(chars))), H / (0.98 * words.length));
  return Math.max(8, Math.min(60, Math.floor(words.length > 1 ? Math.max(oneLine, stacked) : oneLine)));
}

registerKind({
  kind: "light", title: "Signal light", group: "Props", w: 1, h: 1,
  help: "A lamp that blinks, pulses, flickers or spells Morse, with words cut into its face if you like.",
  //  KEPT SHORT ON PURPOSE: what it looks like, what it says, how it moves.
  //  Everything else follows from those (the glow from the brightness, the
  //  size of the words from the lamp they are on).
  settings: [
    { key: "shape", label: "Shape", type: "select", default: "round",
      options: ["round", "square", "pill", "triangle", "octagon", ["coin", "coin slot"]] },
    { key: "lens", label: "Lens", type: "select", default: "fresnel",
      options: ["arcade", "fresnel", "frosted", ["led", "LED"]] },
    { key: "color", label: "Color", type: "color", default: "theme", theme: "--accent2" },
    { key: "pattern", label: "Pattern", type: "select", default: "blink",
      options: ["steady", "blink", "pulse", "flicker", "morse"] },
    { key: "text", label: "Morse", type: "text", default: "SOS", max: 40, when: s => s.pattern === "morse" },
    { key: "face", label: "Words", type: "text", default: "", max: 24 },
    { key: "lettering", label: "Lettering", type: "select", default: "cutout",
      options: [["cutout", "cut out"], "inverted"], when: s => !!s.face },
    { key: "speed", label: "Speed", type: "range", min: 0.2, max: 4, step: 0.1, default: 1,
      when: s => s.pattern !== "steady" },
    { key: "size", label: "Size", type: "range", min: 15, max: 90, step: 1, default: 45 },
    //  Past 1 it is overdriven: brighter than full, washing toward white. The
    //  glow round it follows.
    { key: "power", label: "Bright", type: "range", min: 0.1, max: 1.6, step: 0.05, default: 1 },
    { key: "grime", label: "Grime", type: "range", min: 0, max: 1, step: 0.05, default: 0 },
  ],
  render(body, s, id) {
    if (body._propAnim) { body._propAnim.cancel(); body._propAnim = null; }
    //  Back to front: the light thrown round it, the bezel, the unlit face,
    //  the lit face, then any lettering.
    //  A coin slot says what it takes unless you say otherwise, and its
    //  lettering is molded into the plastic.
    const coin = s.shape === "coin";
    const words = s.face || (coin ? "25\u00a2" : "");
    const lettering = s.face ? (s.lettering || "cutout") : coin ? "embossed" : "";
    const face = words ? '<span class="pl-text">' + bEsc(words) + "</span>" : "";
    body.innerHTML =
      '<div class="prop prop-light">' +
        '<div class="pl-lamp" data-shape="' + bEsc(s.shape || "round") + '" data-lens="' + bEsc(s.lens || "fresnel") + '"' +
          (lettering ? ' data-lettering="' + bEsc(lettering) + '"' : "") + ">" +
          '<i class="pl-halo"></i><i class="pl-bezel"></i><i class="pl-face"></i>' +
          (coin ? '<i class="pl-slot"></i>' : "") +
          '<i class="pl-lit"></i>' + face + '<i class="pl-lens"></i><i class="pl-gloss"></i>' +
          (s.grime > 0 ? '<i class="pl-grime"></i><i class="pl-dust"></i>' : "") +
        "</div>" +
        (s.label ? '<span class="pl-label">' + bEsc(s.label) + "</span>" : "") +
      "</div>";
    body.firstElementChild.style.setProperty("--size", s.size + "%");
    body.firstElementChild.style.setProperty("--tsize", String(propFitText(words, s.shape)));
    //  Every copy is dirty in its own way: the same dirt, shifted by an
    //  amount taken from the copy's id.
    const lamp = body.querySelector(".pl-lamp");
    lamp.style.setProperty("--grime", String(s.grime || 0));
    let h = 0;
    for (const ch of String(id || "")) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    lamp.style.setProperty("--dirt-x", (h % 97) + "cqmin");
    lamp.style.setProperty("--dirt-y", ((h >> 8) % 89) + "cqmin");
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
    panel.style.setProperty("--light-glow", String(Math.min(1, 0.15 + 0.55 * (s.power == null ? 1 : s.power))));
    panel.style.setProperty("--light-power", String(s.power == null ? 1 : s.power));
    panel.style.setProperty("--lit", "1");
    const f = propLightFrames(s);
    //  With reduced motion asked for, a light is simply on.
    if (f && !PROP_REDUCED()) {
      body._propAnim = panel.animate(f.frames.map(k => {
        const o = { "--lit": String(k.opacity) };
        if (k.offset !== undefined) o.offset = k.offset;
        return o;
      }), { duration: f.ms, iterations: Infinity, easing: f.easing });
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
  brick: { size: [48, 24], mask: propSvgMask(48, 24,
    '<path d="M0 0.75H48M0 12.75H48M0.75 0V12M24.75 12V24" stroke="#fff" stroke-width="1.5" fill="none"/>') },
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

registerKind({
  kind: "material", title: "Material", group: "Props", w: 1, h: 1,
  help: "A surface to fill a gap: brick, grid, blueprint, dots, stripes, paper or contour lines.",
  settings: [
    { key: "pattern", label: "Pattern", type: "select", default: "grid",
      options: ["brick", "grid", "blueprint", "dots", "stripes", "paper", "contours"] },
    { key: "ink", label: "Lines", type: "color", default: "theme", theme: "--border" },
    { key: "ground", label: "Ground", type: "color", default: "theme", theme: "--panel" },
    { key: "scale", label: "Scale", type: "range", min: 0.5, max: 3, step: 0.1, default: 1 },
    { key: "strength", label: "Strength", type: "range", min: 0.1, max: 1, step: 0.05, default: 0.8 },
  ],
  render(body, s) {
    const m = PROP_MATERIALS[s.pattern] || PROP_MATERIALS.grid;
    body.innerHTML = '<div class="prop prop-material"><i class="pm-ink"></i></div>';
    const root = body.firstElementChild, ink = root.firstElementChild;
    root.style.background = propColor(s.ground, "--panel");
    ink.style.background = propColor(s.ink, "--border");
    ink.style.opacity = String(s.strength);
    ink.style.maskImage = ink.style.webkitMaskImage = m.mask;
    if (m.size) {
      const sz = Math.round(m.size[0] * s.scale) + "px " + Math.round(m.size[1] * s.scale) + "px";
      ink.style.maskSize = ink.style.webkitMaskSize = sz;
    } else {
      //  Gradient rings scale by zooming the whole mask.
      ink.style.maskSize = ink.style.webkitMaskSize = (100 * s.scale) + "% " + (100 * s.scale) + "%";
    }
  },
});
