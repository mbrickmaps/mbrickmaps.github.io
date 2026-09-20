/*  FIDGETS — small games to play with, as panels.

    Board kinds like the props (see registerKind in board.js): add as many as
    you like from 🧰, each set up its own way with its ⚙, and removing one
    deletes it. A fidget remembers where you were in it.

    Load after board.js, before the page starts the board:

      <link rel="stylesheet" href="fidgets.css">
      <script src="fidgets.js"></script> */

/* --------------------------------------------------------------------------
   TOGGLE GRID — press a light and it flips, along with its neighbours.
   Turn them all off.
   -------------------------------------------------------------------------- */
/*  Which lights a press flips, as offsets from the one pressed. The pressed
    light always flips; "plus" is the classic game. */
const TG_PATTERNS = {
  plus:  [[0, -1], [0, 1], [-1, 0], [1, 0]],
  x:     [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  box:   [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]],
  line:  null,   // the whole row and the whole column
};
//  Hex cells sit in offset rows, so "plus" there means the six that touch.
const TG_HEX_EVEN = [[-1, 0], [1, 0], [-1, -1], [0, -1], [-1, 1], [0, 1]];
const TG_HEX_ODD  = [[-1, 0], [1, 0], [0, -1], [1, -1], [0, 1], [1, 1]];

function tgFlips(s, c, r) {
  const cols = s.cols, rows = s.rows, out = [[c, r]];
  const add = (x, y) => {
    if (s.wrap) { x = (x + cols) % cols; y = (y + rows) % rows; }
    if (x >= 0 && x < cols && y >= 0 && y < rows && !(x === c && y === r)) out.push([x, y]);
  };
  if (s.pattern === "line") {
    for (let x = 0; x < cols; x++) add(x, r);
    for (let y = 0; y < rows; y++) add(c, y);
  } else {
    const offs = s.shape === "hex" && s.pattern === "plus"
      ? (r % 2 ? TG_HEX_ODD : TG_HEX_EVEN)
      : TG_PATTERNS[s.pattern] || TG_PATTERNS.plus;
    for (const [dx, dy] of offs) add(c + dx, r + dy);
  }
  //  Wrapping on a small grid can reach the same light twice; it flips once.
  const seen = new Set();
  return out.filter(([x, y]) => { const k = x + "," + y; if (seen.has(k)) return false; seen.add(k); return true; });
}

//  Where each copy is in its game, kept apart from its settings so a move
//  does not count as changing them.
const TG_KEY = id => BOARD_NS + "fidget:" + id;
const tgShapeKey = s => [s.cols, s.rows, s.shape, s.pattern, !!s.wrap].join("|");

/*  A new puzzle is the solved board with random presses applied to it, so
    every puzzle can be solved, whatever the grid, shape or pattern. Presses
    that cancel out are allowed; a board that comes out already solved is
    scrambled again. */
function tgScramble(s) {
  const n = s.cols * s.rows;
  for (let tries = 0; tries < 20; tries++) {
    const lit = new Array(n).fill(false);
    //  About a third of the cells' worth of presses: enough to be a puzzle,
    //  scaled to the grid rather than set by hand.
    const presses = Math.max(2, Math.round(s.cols * s.rows * 0.35));
    for (let i = 0; i < presses; i++) {
      const c = Math.floor(Math.random() * s.cols), r = Math.floor(Math.random() * s.rows);
      for (const [x, y] of tgFlips(s, c, r)) lit[y * s.cols + x] = !lit[y * s.cols + x];
    }
    if (lit.some(Boolean)) return lit;
  }
  const lit = new Array(n).fill(false);
  lit[0] = true;
  for (const [x, y] of tgFlips(s, 0, 0)) lit[y * s.cols + x] = true;
  return lit;
}

registerKind({
  kind: "togglegrid", aliases: ["lightsout"], title: "Toggle Grid", group: "Fidgets", w: 1, h: 1,
  help: "Press a light to flip it and its neighbours; turn them all off, on a phosphor screen. Choose the grid, the cell shape and which neighbours flip.",
  settings: [
    { key: "shape", label: "Shape", type: "select", default: "square",
      options: ["square", "hex"] },
    { key: "pattern", label: "Flips", type: "select", default: "plus",
      options: [["plus", "+ plus"], ["x", "× corners"], ["box", "▦ all eight"], ["line", "row & column"]] },
    { key: "on", label: "Color", type: "color", default: "theme", theme: "--accent2" },
    { key: "cols", label: "Columns", type: "range", min: 3, max: 20, step: 1, default: 5 },
    { key: "rows", label: "Rows", type: "range", min: 3, max: 20, step: 1, default: 5 },
    { key: "wrap", label: "Wrap edges", type: "check", default: false },
    //  RANDOM PLAY: it presses lights by itself, and deals a new puzzle when
    //  it happens to clear one. Something to watch rather than play; you can
    //  still press lights while it runs, but no best score is kept.
    { key: "auto", label: "Random play", type: "check", default: false },
    { key: "rate", label: "Presses/s", type: "range", min: 0.5, max: 25, step: 0.5, default: 2,
      when: s => s.auto },
  ],

  render(body, s, id) {
    if (body._tgTimer) { clearInterval(body._tgTimer); body._tgTimer = null; }
    //  The position survives a settings change that leaves the puzzle the same
    //  (a color); a new grid, shape or pattern deals a new one.
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(TG_KEY(id)) || "null"); } catch (e) { saved = null; }
    const g = saved && saved.k === tgShapeKey(s) && Array.isArray(saved.lit) && saved.lit.length === s.cols * s.rows
      ? { lit: saved.lit.map(Boolean), moves: saved.moves | 0, best: saved.best || null }
      : { lit: tgScramble(s), moves: 0, best: saved && saved.k === tgShapeKey(s) ? saved.best : null };
    const save = () => {
      try { localStorage.setItem(TG_KEY(id), JSON.stringify({ k: tgShapeKey(s), lit: g.lit, moves: g.moves, best: g.best })); }
      catch (e) { /* unavailable */ }
    };
    save();

    const hex = s.shape === "hex";
    body.innerHTML =
      //  One look: a phosphor screen. Lights on a dark glass face.
      '<div class="prop fidget fg-tg" data-shape="' + bEsc(s.shape) + '" data-look="crt">' +
        '<div class="fg-stage"><div class="tg-grid" role="grid" aria-label="toggle grid"></div></div>' +
        '<div class="fg-bar"><span class="fg-moves"></span>' +
          '<button type="button" class="fg-new" title="deal a new puzzle">new</button></div>' +
      "</div>";
    const root = body.firstElementChild;
    root.style.setProperty("--on", s.on === "theme" ? "var(--accent2)" : s.on);
    root.style.setProperty("--off", !s.off || s.off === "theme" ? "var(--field)" : s.off);
    const grid = root.querySelector(".tg-grid");
    //  The board keeps its proportions and fits the space it is given.
    const aspect = hex ? ((s.cols + 0.5) / (s.rows * 0.75 + 0.25)) / 1.1547 : s.cols / s.rows;
    grid.style.setProperty("--aspect", aspect);
    grid.style.gridTemplateColumns = hex ? "repeat(" + (s.cols * 2 + 1) + ", 1fr)" : "repeat(" + s.cols + ", 1fr)";

    const cells = [];
    for (let r = 0; r < s.rows; r++) {
      for (let c = 0; c < s.cols; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "tg-cell";
        b.dataset.c = c; b.dataset.r = r;
        if (hex) {
          b.style.gridColumn = (c * 2 + (r % 2 ? 2 : 1)) + " / span 2";
          b.style.gridRow = String(r + 1);
          //  Honeycomb rows overlap by a quarter of a cell's height. A grid
          //  item's percentage margin is of its area's width, which is the
          //  cell's own width here: 1.1547 / 4 of it.
          if (r) b.style.marginTop = "-28.87%";
        }
        grid.appendChild(b);
        cells.push(b);
      }
    }
    const moves = root.querySelector(".fg-moves");
    const paint = won => {
      cells.forEach((b, i) => {
        b.classList.toggle("lit", g.lit[i]);
        b.setAttribute("aria-pressed", g.lit[i]);
      });
      root.classList.toggle("won", !!won);
      moves.textContent = won
        ? "cleared in " + g.moves + (g.best ? " · best " + g.best : "")
        : g.moves + (g.moves === 1 ? " move" : " moves") + (s.auto ? " · random" : g.best ? " · best " + g.best : "");
    };
    paint(!g.lit.some(Boolean));

    const press = (c, r) => {
      if (!g.lit.some(Boolean)) return false;        // solved: "new" deals again
      for (const [x, y] of tgFlips(s, c, r)) {
        const i = y * s.cols + x;
        g.lit[i] = !g.lit[i];
      }
      g.moves++;
      const won = !g.lit.some(Boolean);
      //  A best score is yours alone: nothing counts while random play is on.
      if (won && !s.auto && (!g.best || g.moves < g.best)) g.best = g.moves;
      save();
      paint(won);
      //  The pressed light flashes, so you can follow random play.
      const hit = cells[r * s.cols + c];
      hit.classList.remove("pressed"); void hit.offsetWidth; hit.classList.add("pressed");
      return won;
    };
    grid.addEventListener("click", e => {
      const b = e.target.closest(".tg-cell");
      if (b) press(+b.dataset.c, +b.dataset.r);
    });

    if (s.auto) {
      root.classList.add("auto");
      let rest = 0;                                  // ticks to wait after a clear
      body._tgTimer = setInterval(() => {
        //  Stops itself once the panel is gone from the page.
        if (!body.isConnected) { clearInterval(body._tgTimer); body._tgTimer = null; return; }
        if (rest > 0) {
          if (--rest === 0) { g.lit = tgScramble(s); g.moves = 0; save(); paint(false); }
          return;
        }
        if (!g.lit.some(Boolean)) { rest = Math.max(1, Math.round(1.5 * s.rate)); return; }
        const won = press(Math.floor(Math.random() * s.cols), Math.floor(Math.random() * s.rows));
        if (won) rest = Math.max(1, Math.round(1.5 * s.rate));  // a moment to see it, then deal again
      }, 1000 / Math.max(0.5, s.rate));
    }
    root.querySelector(".fg-new").addEventListener("click", () => {
      g.lit = tgScramble(s);
      g.moves = 0;
      save();
      paint(false);
    });
  },

  forget(id) { try { localStorage.removeItem(TG_KEY(id)); } catch (e) { /* unavailable */ } },
});
