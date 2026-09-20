/* ==========================================================================
   BOARD — a grid of panels you can place, resize, dock, cover and reload
   --------------------------------------------------------------------------
   Taken out of Brick by Brick so another page can use the same board.

   A classic script, not a module: it shares the page's global scope, and the
   page supplies what the board calls but does not own — bEl(), bEsc(), the panel
   registry (panels, FOOTPRINTS, definePanel), BOARD_KEY / FOOTPRINT_KEY and the
   refresh the board asks for after a change. Load it BEFORE the page's own
   script, which calls into it while starting up.

   Storage keys are prefixed with window.BOARD_NS, set by the page before this
   file loads, so Brick by Brick keeps every key it has always had.
   -------------------------------------------------------------------------- */
const BOARD_NS = window.BOARD_NS || "board:";

/*  THE BOARD'S OWN SMALL HELPERS, under names of their own so they never
    collide with a page's. */
const bEl = id => document.getElementById(id);
const bEsc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/*  THE PANEL REGISTRY. Every panel the board can place, by id, and its
    footprint (name, description, size) for the panel list. A page fills it
    with registerPanel(), or writes to it directly. */
const panels = new Map();       // id -> { id, title, help, tpl, render, … }
const FOOTPRINTS = {};          // id -> { name, desc, w, h, group, role, wip }
const BOARD_KEY = BOARD_NS + "board:v2";
const FOOTPRINT_KEY = BOARD_NS + "footprints:v2";

function registerPanel(cfg) {
  const def = Object.assign({ help: "" }, cfg);
  panels.set(cfg.id, def);
  FOOTPRINTS[cfg.id] = { name: cfg.title, desc: cfg.help || "", w: cfg.w || 1, h: cfg.h || 1,
                         group: cfg.group, role: cfg.role, wip: !!cfg.wip };
  return cfg.id;
}

/*  KINDS: PANELS YOU CAN PLACE MORE THAN ONCE.

    A registered panel is one thing with one id, so it is on the board once or
    not at all. A kind is a recipe instead: every time you add it, the board
    makes a new copy (an instance) with its own id and its own settings, so
    the same kind can be on the board five times, five different ways.

      registerKind({
        kind: "light", title: "Signal light", help: "…", w: 1, h: 1,
        group: "Props",                      // its heading in 🧰
        settings: [                          // the ⚙ form, drawn by the board
          { key: "color", label: "Color", type: "color", default: "theme", theme: "--accent2" },
          { key: "speed", label: "Speed", type: "range", min: 0.2, max: 4, step: 0.1, default: 1 },
          { key: "pattern", label: "Pattern", type: "select", options: ["blink", "pulse"], default: "blink" },
          { key: "text", label: "Text", type: "text", default: "",
            when: s => s.pattern === "morse" },  // shown only when it applies
          { key: "on", label: "On", type: "check", text: "switched on", default: true },
        ],
        render(body, s, id) { … },           // s: this copy's settings
        forget(id) { … },                    // optional: the copy was deleted
      });

    render() runs when the copy is first drawn and again whenever its settings
    change, never on an ordinary board refresh, so a copy can build once and
    animate. Every copy also gets a Name and a "title bar" switch.

    Removing a copy from the board deletes it and its settings. The copies are
    saved under BOARD_NS + "instances:v1". */
const KINDS = new Map();                 // kind -> cfg
const INSTANCES = new Map();             // instance id -> { kind, s }
const INSTANCE_KEY = BOARD_NS + "instances:v1";
const KIND_PREFIX = "kind:";             // a kind's card in 🧰, not a panel

/*  Old names for a kind, so renaming one never drops the copies people have
    already placed: registerKind({ kind: "new", aliases: ["old"], … }). */
const KIND_ALIASES = new Map();
function registerKind(cfg) {
  KINDS.set(cfg.kind, cfg);
  for (const a of cfg.aliases || []) KIND_ALIASES.set(a, cfg.kind);
  FOOTPRINTS[KIND_PREFIX + cfg.kind] = {
    name: cfg.title, desc: cfg.help || "", w: cfg.w || 1, h: cfg.h || 1,
    group: cfg.group || "Props", isKind: true, kind: cfg.kind,
  };
  return cfg.kind;
}
function kindDefaults(k) {
  const s = { _name: "", _bare: false };
  for (const f of k.settings || []) s[f.key] = f.default;
  return s;
}
function registerInstance(id, kind, settings) {
  if (!KINDS.has(kind) && KIND_ALIASES.has(kind)) kind = KIND_ALIASES.get(kind);
  const k = KINDS.get(kind);
  if (!k) return null;
  INSTANCES.set(id, { kind, s: Object.assign(kindDefaults(k), settings || {}) });
  const fp = FOOTPRINTS[KIND_PREFIX + kind];
  registerPanel({
    id, title: k.title, help: k.help, w: fp.w, h: fp.h,
    roles: [],                           // no W/F/R badge: a prop does not touch state
    render(body) { renderInstance(id, body); },
  });
  FOOTPRINTS[id].instance = true;
  return id;
}
function newInstance(kind) {
  const id = "prop-" + kind + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  if (!registerInstance(id, kind)) return null;
  saveInstances();
  return id;
}
function saveInstances() {
  try {
    if (!INSTANCES.size) localStorage.removeItem(INSTANCE_KEY);
    else localStorage.setItem(INSTANCE_KEY, JSON.stringify([...INSTANCES.entries()]));
  } catch (e) { /* unavailable */ }
}
let instancesLoaded = false;
function loadInstances() {
  if (instancesLoaded) return;
  instancesLoaded = true;
  let raw;
  try { raw = JSON.parse(localStorage.getItem(INSTANCE_KEY) || "null"); } catch (e) { return; }
  if (!Array.isArray(raw)) return;
  for (const [id, v] of raw) {
    if (typeof id === "string" && v && typeof v.kind === "string" && v.s && typeof v.s === "object") {
      registerInstance(id, v.kind, v.s);
    }
  }
}
//  Gone for good: its settings, its panel, and any cover it had.
function forgetInstance(id) {
  if (!INSTANCES.has(id)) return;
  //  A kind that keeps things of its own (a game's position) clears them.
  const kd = KINDS.get(INSTANCES.get(id).kind);
  if (kd && kd.forget) { try { kd.forget(id); } catch (e) { /* its problem, not the board's */ } }
  INSTANCES.delete(id);
  panels.delete(id);
  delete FOOTPRINTS[id];
  const node = PANEL_NODES.get(id) || document.getElementById(id);
  if (node) node.remove();
  PANEL_NODES.delete(id);
  if (OPEN_DECK && OPEN_DECK.id === id) closeInstanceDeck();
  if (COVERS.delete(id)) saveCovers();
  if (COVER_PREFS.delete(id)) {
    try { localStorage.setItem(COVER_PREF_KEY, JSON.stringify([...COVER_PREFS.entries()])); } catch (e) { /* unavailable */ }
  }
  saveInstances();
}
//  Copies that are no longer on the board (after a reset, or a saved board
//  that lost them) are deleted rather than left behind unseen.
function pruneInstances() {
  for (const id of [...INSTANCES.keys()]) if (!isOnBoard(id)) forgetInstance(id);
}

/*  Drawn only when the settings change. Brick by Brick refreshes every panel
    on each keystroke, and rebuilding a blinking light that often would restart
    its blink on every letter typed. */
function renderInstance(id, body, force) {
  const inst = INSTANCES.get(id), k = inst && KINDS.get(inst.kind);
  if (!k) return;
  const panel = body.closest(".panel");
  if (panel) {
    panel.classList.add("is-instance");
    /*  THE ⚙ IS PART OF THE PROP, NOT THE TITLE BAR. It sits in the panel's
        bottom-right corner, under anything laid over the panel, so a cover
        hides a prop's settings along with the prop. The title bar stays above
        covers, which is right for ↻ and ✕ and wrong for this. */
    if (!panel.querySelector(":scope > .inst-gear")) {
      const g = document.createElement("button");
      g.type = "button";
      g.className = "inst-gear";
      g.textContent = "\u2699";
      g.title = "settings for this " + k.title.toLowerCase();
      g.addEventListener("pointerdown", e => e.stopPropagation());
      g.addEventListener("click", e => { e.stopPropagation(); toggleInstanceSettings(id); });
      panel.appendChild(g);
    }
    panel.classList.toggle("inst-bare", !!inst.s._bare);
    const h2 = panel.querySelector(".panel-head h2");
    if (h2) h2.textContent = inst.s._name || k.title;
  }
  const sig = JSON.stringify(inst.s);
  if (!force && body._instSig === sig) return;
  body._instSig = sig;
  k.render(body, inst.s, id);
}

/*  THE ⚙ DECK: a copy's settings as a control panel of its own.

    It opens BESIDE the panel, never over it, so you watch the prop change as
    you turn things: to the right if there is room, else to the left, else
    underneath. It follows the panel if the page scrolls.

    The controls are built for turning, not typing, in the spirit of HUI (one
    control, one setting):
      range   a KNOB. Drag up or right to turn it up, down or left to turn it
              down (Shift for fine), scroll the wheel, or use the arrow keys.
              Double-click puts it back to where the kind starts.
      check   a SWITCH that flips.
      select  a row of KEYS, one lit.
      color   a swatch, plus "theme" where the kind allows it.
      text    a text box.

    ⚙ again, "done", Esc, or a press anywhere outside the deck and the panel
    puts it away. One deck at a time. */
let OPEN_DECK = null;     // { id, deck, panel, off }

function closeInstanceDeck() {
  if (!OPEN_DECK) return;
  const { deck, panel, off } = OPEN_DECK;
  OPEN_DECK = null;
  off();
  deck.remove();
  panel.classList.remove("inst-editing");
  const btn = panel.querySelector(":scope > .inst-gear");
  if (btn) btn.classList.remove("on");
}

function toggleInstanceSettings(id) {
  if (OPEN_DECK && OPEN_DECK.id === id) { closeInstanceDeck(); return; }
  closeInstanceDeck();
  const panel = document.getElementById(id);
  const inst = INSTANCES.get(id), k = inst && KINDS.get(inst.kind);
  if (!panel || !k) return;
  const body = panel.querySelector(".panel-body");
  const btn = panel.querySelector(":scope > .inst-gear");
  if (btn) btn.classList.add("on");
  panel.classList.add("inst-editing");

  const all = [
    { key: "_name", label: "Name", type: "text", placeholder: k.title },
    ...(k.settings || []),
    { key: "_bare", label: "Hide title bar", type: "check" },
  ];
  //  Knobs gather in one row, the way they would on a real panel; everything
  //  else keeps the kind's order above them, and the switches sit below.
  const knobs = all.filter(f => f.type === "range");
  const checks = all.filter(f => f.type === "check");
  const rest = all.filter(f => f.type !== "range" && f.type !== "check");

  const deck = document.createElement("div");
  deck.className = "inst-deck";
  deck.setAttribute("role", "dialog");
  deck.setAttribute("aria-label", "settings for " + (inst.s._name || k.title));

  const at = f => ' data-key="' + bEsc(f.key) + '"';
  const wrap = (f, inner, cls) =>
    '<div class="deck-field ' + (cls || "") + '" data-row="' + bEsc(f.key) + '">' + inner + "</div>";
  const lbl = f => '<span class="deck-lbl">' + bEsc(f.label) + "</span>";
  const fmt = (f, v) => {
    const st = f.step || 1;
    const dp = st >= 1 ? 0 : Math.min(3, String(st).split(".")[1].length);
    return Number(v).toFixed(dp);
  };

  const htmlFor = f => {
    const v = inst.s[f.key];
    if (f.type === "range") {
      const p = (v - f.min) / (f.max - f.min);
      return wrap(f,
        '<div class="deck-knob" tabindex="0" role="slider"' + at(f) +
          ' aria-label="' + bEsc(f.label) + '" aria-valuemin="' + f.min + '" aria-valuemax="' + f.max +
          '" aria-valuenow="' + v + '" title="drag, scroll or use the arrow keys; double-click to reset"' +
          ' style="--p:' + p + '">' +
          '<i class="knob-ring"></i><i class="knob-arc"></i>' +
          '<i class="knob-cap"><i class="knob-mark"></i></i>' +
        "</div>" +
        '<span class="knob-val">' + fmt(f, v) + "</span>" + lbl(f), "is-knob");
    }
    if (f.type === "check") {
      return wrap(f,
        '<button type="button" class="deck-switch" role="switch" aria-checked="' + !!v + '"' + at(f) + ">" +
          '<i class="sw-track"><i class="sw-lever"></i></i></button>' + lbl(f), "is-switch");
    }
    if (f.type === "select") {
      return wrap(f, lbl(f) + '<div class="deck-keys" role="radiogroup">' + f.options.map(o => {
        const [val, txt] = Array.isArray(o) ? o : [o, o];
        return '<button type="button" role="radio" aria-checked="' + (val === v) + '"' + at(f) +
          ' data-val="' + bEsc(val) + '"' + (val === v ? ' class="on"' : "") + ">" + bEsc(txt) + "</button>";
      }).join("") + "</div>", "is-keys");
    }
    if (f.type === "color") {
      const theme = v === "theme";
      return wrap(f, lbl(f) + '<span class="deck-color">' +
        '<input type="color"' + at(f) + ' value="' + bEsc(theme ? themeColor(f.theme) : v) + '"' +
          (theme ? ' class="off"' : "") + ">" +
        (f.theme ? '<button type="button" class="deck-theme' + (theme ? " on" : "") + '"' + at(f) +
          ' title="follow the page theme">theme</button>' : "") + "</span>", "is-color");
    }
    if (f.type === "font") {
      const name = v ? (BOARD_FONT_PRESETS.find(p => p.family === v) || {}).label || v : "the page's own";
      return wrap(f, lbl(f) +
        '<button type="button" class="deck-fontbtn"' + at(f) +
          ' title="pick a font" style="font-family:' + bEsc(boardFontCss(v)) + '">' +
          bEsc(name) + "</button>", "is-font");
    }
    return wrap(f, lbl(f) + '<input type="text"' + at(f) + ' value="' + bEsc(v == null ? "" : v) + '"' +
      (f.placeholder ? ' placeholder="' + bEsc(f.placeholder) + '"' : "") +
      (f.max ? ' maxlength="' + f.max + '"' : "") + ' spellcheck="false">', "is-text");
  };

  deck.innerHTML =
    '<div class="deck-head"><span class="deck-title">' + bEsc(k.title) + "</span>" +
      '<button type="button" data-act="done" title="put the settings away (Esc)">done</button></div>' +
    '<div class="deck-rest">' + rest.map(htmlFor).join("") + "</div>" +
    (knobs.length ? '<div class="deck-knobs">' + knobs.map(htmlFor).join("") + "</div>" : "") +
    (checks.length ? '<div class="deck-switches">' + checks.map(htmlFor).join("") + "</div>" : "") +
    '<div class="deck-foot"><button type="button" data-act="reset" title="back to how this kind starts">reset</button></div>';
  document.body.appendChild(deck);

  const showWhen = () => {
    for (const f of all) {
      if (!f.when) continue;
      const r = deck.querySelector('[data-row="' + f.key + '"]');
      if (r) r.hidden = !f.when(inst.s);
    }
  };
  const apply = () => {
    saveInstances(); renderInstance(id, body); showWhen();
    const t = deck.querySelector(".deck-title");
    if (t) t.textContent = k.title;
  };
  const setKnob = (el, f, v) => {
    const st = f.step || 1;
    v = Math.min(f.max, Math.max(f.min, Math.round((v - f.min) / st) * st + f.min));
    v = Number(v.toFixed(6));
    if (v === inst.s[f.key]) return;
    inst.s[f.key] = v;
    el.style.setProperty("--p", (v - f.min) / (f.max - f.min));
    el.setAttribute("aria-valuenow", v);
    el.parentElement.querySelector(".knob-val").textContent = fmt(f, v);
    apply();
  };

  /* ---- knobs ---- */
  for (const el of deck.querySelectorAll(".deck-knob")) {
    const f = all.find(x => x.key === el.dataset.key);
    const span = f.max - f.min;
    el.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      e.preventDefault();
      el.focus();
      el.setPointerCapture(e.pointerId);
      el.classList.add("turning");
      const x0 = e.clientX, y0 = e.clientY, v0 = inst.s[f.key];
      const move = ev => {
        //  Up and right both turn it up: about 160px of travel for the whole
        //  sweep, a tenth of that speed with Shift held.
        const d = (ev.clientX - x0) - (ev.clientY - y0);
        setKnob(el, f, v0 + d / 160 * span * (ev.shiftKey ? 0.1 : 1));
      };
      const up = () => {
        el.classList.remove("turning");
        el.removeEventListener("pointermove", move);
        el.removeEventListener("pointerup", up);
        el.removeEventListener("pointercancel", up);
      };
      el.addEventListener("pointermove", move);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
    });
    el.addEventListener("wheel", e => {
      e.preventDefault();
      setKnob(el, f, inst.s[f.key] + (e.deltaY < 0 ? 1 : -1) * (f.step || 1) * (e.shiftKey ? 1 : 2));
    }, { passive: false });
    el.addEventListener("keydown", e => {
      const st = f.step || 1;
      const by = { ArrowUp: st, ArrowRight: st, ArrowDown: -st, ArrowLeft: -st,
                   PageUp: st * 10, PageDown: -st * 10 }[e.key];
      if (by !== undefined) { e.preventDefault(); setKnob(el, f, inst.s[f.key] + by); }
      else if (e.key === "Home") { e.preventDefault(); setKnob(el, f, f.min); }
      else if (e.key === "End") { e.preventDefault(); setKnob(el, f, f.max); }
    });
    el.addEventListener("dblclick", () => setKnob(el, f, f.default));
  }

  /* ---- text and color ---- */
  deck.addEventListener("input", e => {
    const t = e.target, key = t.dataset && t.dataset.key;
    if (!key || t.classList.contains("deck-knob")) return;
    inst.s[key] = t.value;
    if (t.type === "color") {
      t.classList.remove("off");
      const tb = deck.querySelector('.deck-theme[data-key="' + key + '"]');
      if (tb) tb.classList.remove("on");
    }
    apply();
  });

  /*  A font field opens the picker (fonts.js) under its button: search, the
      fonts on this computer, and all of Google Fonts, each name drawn in its
      own face. */
  for (const btn of deck.querySelectorAll(".deck-fontbtn")) {
    btn.addEventListener("click", () => {
      const open = btn.parentElement.querySelector(":scope > .fontpick");
      if (open) { open.remove(); return; }
      if (typeof boardFontPicker !== "function") return;   // fonts.js not loaded
      boardFontPicker(btn.parentElement, inst.s[btn.dataset.key], family => {
        inst.s[btn.dataset.key] = family;
        btn.style.fontFamily = boardFontCss(family);
        btn.textContent = family
          ? ((BOARD_FONT_PRESETS.find(p => p.family === family) || {}).label || family)
          : "the page's own";
        apply();
      });
    });
  }

  /* ---- keys, switches, theme, done, reset ---- */
  deck.addEventListener("click", e => {
    const key = e.target.closest(".deck-keys button");
    if (key) {
      inst.s[key.dataset.key] = key.dataset.val;
      for (const b of key.parentElement.children) {
        const on = b === key;
        b.classList.toggle("on", on);
        b.setAttribute("aria-checked", on);
      }
      apply();
      return;
    }
    const sw = e.target.closest(".deck-switch");
    if (sw) {
      const on = !inst.s[sw.dataset.key];
      inst.s[sw.dataset.key] = on;
      sw.setAttribute("aria-checked", on);
      apply();
      return;
    }
    const tb = e.target.closest(".deck-theme");
    if (tb) {
      const k2 = tb.dataset.key;
      const swatch = deck.querySelector('input[type="color"][data-key="' + k2 + '"]');
      if (inst.s[k2] === "theme") { inst.s[k2] = swatch.value; tb.classList.remove("on"); swatch.classList.remove("off"); }
      else { inst.s[k2] = "theme"; tb.classList.add("on"); swatch.classList.add("off"); }
      apply();
      return;
    }
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    if (b.dataset.act === "done") { closeInstanceDeck(); return; }
    if (b.dataset.act === "reset") {
      inst.s = Object.assign(kindDefaults(k), { _name: inst.s._name, _bare: inst.s._bare });
      apply();
      closeInstanceDeck();
      toggleInstanceSettings(id);   // drawn again, showing the defaults
    }
  });

  /* ---- where it sits ---- */
  const place = () => {
    if (!panel.isConnected) { closeInstanceDeck(); return; }
    const r = panel.getBoundingClientRect();
    const W = deck.offsetWidth, H = deck.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let left, top;
    if (r.right + 10 + W <= vw - 8) { left = r.right + 10; top = r.top; }
    else if (r.left - 10 - W >= 8) { left = r.left - 10 - W; top = r.top; }
    else { left = r.left; top = r.bottom + 10; }
    left = Math.max(8, Math.min(vw - W - 8, left));
    top = Math.max(8, Math.min(vh - H - 8, top));
    deck.style.left = Math.round(left) + "px";
    deck.style.top = Math.round(top) + "px";
  };
  const onKey = e => { if (e.key === "Escape") closeInstanceDeck(); };
  const onDown = e => {
    if (deck.contains(e.target) || panel.contains(e.target)) return;
    closeInstanceDeck();
  };
  const ro = new ResizeObserver(place);
  ro.observe(panel);
  ro.observe(deck);
  window.addEventListener("scroll", place, true);
  window.addEventListener("resize", place);
  document.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onDown, true);
  OPEN_DECK = { id, deck, panel, off() {
    ro.disconnect();
    window.removeEventListener("scroll", place, true);
    window.removeEventListener("resize", place);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("pointerdown", onDown, true);
  } };
  showWhen();
  place();
}
//  A theme variable as a hex, for the swatch to show while "theme" is on.
function themeColor(v) {
  if (!v) return "#888888";
  const c = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#888888";
}

/*  WHAT THE PAGE TELLS THE BOARD.

    Everything the board needs from the page it sits in, and a do-nothing
    default for each, so a page that passes nothing still gets a working
    board. Set once with configureBoard({ … }) before loadBoard().

      refresh()             a content change: redraw what the panels show
      refreshPanel(id)      one panel was rebuilt from nothing (↻)
      resized(soon)         panel boxes changed size — canvas panels remeasure.
                            soon = true after a re-layout (wait a frame)
      wireBody(def, body)   the page's own wiring for a panel body, once
      headAction(def, act, btn, body)   a header button was pressed
      badges(def)           HTML to put before the title
      docHref(id)           a help page for the panel, or nothing
      groups()              [{ role, title }] to group the panel list by
                            FOOTPRINTS[id].role; nothing = one plain list */
const BOARD_HOOKS = {
  //  By default: draw every panel that is on screen with its own render().
  refresh() { for (const n of document.querySelectorAll(".board-tile > .panel, .dock > .panel")) renderMounted(n.id); },
  refreshPanel(id) { renderMounted(id); },
  resized(soon) {},
  wireBody(def, body) {},
  headAction(def, act, btn, body) {},
  badges(def) { return ""; },
  docHref(id) { return null; },
  groups() { return null; },
};
function configureBoard(opts) { Object.assign(BOARD_HOOKS, opts); }

/*  SHARED STATE — one object every panel on the page can read.

    Panels are independent by default: each keeps its own variables and redraws
    only itself (BOARD_HOOKS.refreshPanel). To connect panels, keep what they
    share here instead. setBoardState() changes it and redraws every panel on
    the board, so anything that reads it in render() stays in step — a panel
    that writes and panels that read never need to know about each other.

    Brick by Brick has its own central state (the pile and the model built from
    it) and its own refresh, so it does not use this; a new page can. */
const boardState = {};
function setBoardState(patch) {
  Object.assign(boardState, patch);
  BOARD_HOOKS.refresh();
}

//  One panel, drawn with its own render(), if it is mounted on the board or a dock.
function renderMounted(id) {
  const def = panels.get(id), node = document.getElementById(id);
  if (!def || !node || !def.render) return;
  if (!node.closest(".board-tile") && !node.closest(".dock")) return;
  const body = node.querySelector(".panel-body");
  if (body) def.render(body);
}

/*  EVERYTHING A PAGE NEEDS TO CALL, ONCE, after it has registered its panels
    and set its default layout. The same steps, in the same order, that Brick
    by Brick runs at its own start-up. */
function startBoard() {
  if (!bEl("boardGhost")) {
    const g = document.createElement("div");
    g.id = "boardGhost";
    g.hidden = true;
    boardEl().appendChild(g);
  }
  loadCovers();
  loadCoverPrefs();
  loadFootprints();
  loadBoard();
  renderBoard();
  renderBoardCardList();
  wireBoard();
}

/* --------------------------------------------------------------------------
   THE BOARD
   -------------------------------------------------------------------------- */
/*  THE STARTING LAYOUT. Empty here; the page using the board hands over its
    own with setDefaultBoard() before it calls loadBoard(). */
let DEFAULT_BOARD = { cols: 4, rowUnit: 220, tiles: [] };
let board = JSON.parse(JSON.stringify(DEFAULT_BOARD));
function setDefaultBoard(def) {
  DEFAULT_BOARD = def;
  board = JSON.parse(JSON.stringify(def));
}

const boardEl = () => bEl("board");
const ghostEl = () => bEl("boardGhost");

function loadBoard() {
  loadInstances();          // the copies are panels, and must exist before their tiles
  let raw;
  try { raw = JSON.parse(localStorage.getItem(BOARD_KEY) || "null"); } catch (e) { raw = null; }
  if (!raw || typeof raw !== "object") return;
  const cols = Math.max(1, Math.min(12, Math.round(raw.cols) || 4));
  const rowUnit = Math.max(80, Math.min(600, Math.round(raw.rowUnit) || 220));
  const seen = new Set(), tiles = [];
  for (const t of Array.isArray(raw.tiles) ? raw.tiles : []) {
    if (!t || !FOOTPRINTS[t.id] || seen.has(t.id)) continue;
    const w = Math.max(1, Math.min(cols, Math.round(t.w) || FOOTPRINTS[t.id].w));
    const h = Math.max(1, Math.round(t.h) || FOOTPRINTS[t.id].h);
    const x = Math.max(0, Math.min(cols - w, Math.round(t.x) || 0));
    const y = Math.max(0, Math.round(t.y) || 0);
    // A corrupt board degrades to a partial one: an overlap is dropped rather
    // than repaired, never left to render on top of another tile.
    if (tiles.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + h > o.y)) continue;
    seen.add(t.id);
    /*  AND WHERE IT IS DOCKED. Rebuilding the tile from its id, position and
        size alone dropped these, so every docked panel came back on the grid
        after a reload — the dock was saved, and thrown away on the way in. */
    const keep = { id: t.id, x, y, w, h };
    if (DOCK_SIDES.includes(t.dock)) keep.dock = t.dock;
    if (Number.isFinite(t.dockSize)) keep.dockSize = t.dockSize;
    if (Number.isFinite(t.dockGrow)) keep.dockGrow = t.dockGrow;
    tiles.push(keep);
  }
  board = { cols, rowUnit, tiles };
  pruneInstances();
}

function saveBoard() {
  try { localStorage.setItem(BOARD_KEY, JSON.stringify(board)); } catch (e) { /* unavailable */ }
}
function saveFootprints() {
  try {
    const out = {};
    for (const id in FOOTPRINTS) out[id] = { w: FOOTPRINTS[id].w, h: FOOTPRINTS[id].h };
    localStorage.setItem(FOOTPRINT_KEY, JSON.stringify(out));
  } catch (e) { /* unavailable */ }
}
function loadFootprints() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(FOOTPRINT_KEY) || "null"); } catch (e) { return; }
  if (!raw) return;
  for (const id in raw) {
    if (!FOOTPRINTS[id]) continue;
    FOOTPRINTS[id].w = Math.max(1, Math.min(12, Math.round(raw[id].w) || FOOTPRINTS[id].w));
    FOOTPRINTS[id].h = Math.max(1, Math.min(12, Math.round(raw[id].h) || FOOTPRINTS[id].h));
  }
}

function isOnBoard(id) { return board.tiles.some(t => t.id === id); }
function boardRows() { return board.tiles.reduce((m, t) => Math.max(m, t.y + t.h), 0) + 2; }
function overlaps(a, x, y, w, h) {
  return board.tiles.some(t => t !== a && x < t.x + t.w && x + w > t.x && y < t.y + t.h && y + h > t.y);
}

/* Cols shrinking can strand a tile past the new edge. Repacked in reading order
   with a simple skyline scan — first free slot wins — rather than trying to
   preserve exact positions that no longer fit. Only on an explicit column
   change, never on an ordinary drop. */
function repackForCols(cols) {
  const ordered = [...board.tiles].sort((a, b) => a.y - b.y || a.x - b.x);
  const placed = [];
  for (const t of ordered) {
    const w = Math.min(t.w, cols);
    let x = 0, y = 0;
    outer:
    for (y = 0; y < 999; y++) {
      for (x = 0; x <= cols - w; x++) {
        if (!placed.some(o => x < o.x + o.w && x + w > o.x && y < o.y + o.h && y + t.h > o.y)) break outer;
      }
    }
    placed.push({ id: t.id, x, y, w, h: t.h });
  }
  board.tiles = placed;
}

// Builds the panel element once; afterwards it is moved between tiles and the
// store, never rebuilt, so an off-board panel keeps its scroll and its input.
/*  EVERY PANEL EVER BUILT, WHETHER IT IS IN THE DOCUMENT OR NOT.

    getElementById cannot see a detached node, and a board render detaches
    plenty of them: tearing down a tile wrapper takes the panel inside it out
    of the document in the same call. renderBoardTiles already knew that — it
    looks every panel up BEFORE it removes anything, and says so in a comment.

    renderDocks did not. So docking a panel ran the board render first, which
    detached the panel along with its wrapper, and then asked getElementById
    for it: nothing. It built a fresh, empty one and hung that in the rail,
    dropping the live panel on the floor — for the Promenade that is a Pixi
    renderer, a ticker and the whole cast, gone, leaving a blank rectangle.

    One map fixes the class of bug rather than that one instance of it: a
    panel's node is looked up here, and a detached node is still the panel. */
const PANEL_NODES = new Map();
function panelNode(id) {
  const live = document.getElementById(id);
  if (live) return live;
  const kept = PANEL_NODES.get(id);
  if (kept) return kept;
  const def = panels.get(id);
  return def ? buildPanel(def) : null;
}

function buildPanel(def) {
  let node = document.getElementById(def.id) || PANEL_NODES.get(def.id);
  if (node) return node;

  node = document.createElement("section");
  node.className = "panel";
  node.id = def.id;

  const head = document.createElement("div");
  head.className = "panel-head";
  head.innerHTML =
    '<span class="panel-head-lead">' +
      '<span class="drag-handle" title="drag to move this tile">\u2725</span>' +
      /*  BEFORE the title, not after it.

          The badge is the only coloured thing in a panel header — W in the
          verified colour for one that writes to your pile, F in the active
          colour for one that can narrow every other panel. That is the fact
          you scan a board for: which of these can change what I am looking at.
          Trailing the name it was found by reading; leading it, the whole
          column of headers can be read down in one pass.

          It also stops the title's own truncation from eating it, which it did
          on any panel narrow enough to ellipsise. */
      BOARD_HOOKS.badges(def) +
      "<h2>" + bEsc(def.title) + "</h2>" +
      (def.wip ? '<span class="wip-badge" title="work in progress: may be incomplete or change">\u{1F6A7}</span>' : "") +
      // …and, where one exists, the way to the panel's own write-up.
      /*  The word was "help"; the mark is "?". The title attribute still spells
          it out, because a lone glyph has to say what it is on hover. */
      (BOARD_HOOKS.docHref(def.id) ? '<a class="panel-doc" href="' + BOARD_HOOKS.docHref(def.id) + '"' +
        ' target="_blank" rel="noopener" aria-label="how ' + bEsc(def.title) +
        ' works" title="how ' + bEsc(def.title) + ' works">?</a>' : "") +
    "</span>" +
    // Panel-declared controls share the header row with the × rather than
    // costing the body a bar of its own.
    (def.headButtons || []).map(b =>
      '<button class="panel-head-btn" data-act="' + b.act + '"' +
      (b.hidden ? " hidden" : "") + ' title="' + bEsc(b.title) + '">' +
      b.label + "</button>").join("");
  node.appendChild(head);

  const body = document.createElement("div");
  body.className = "panel-body";
  // A panel whose template is missing must fail as one broken tile, not as a
  // blank page — the board is the only way back to everything else.
  if (def.tpl) {
    const tpl = bEl(def.tpl);
    if (tpl) body.appendChild(tpl.content.cloneNode(true));
    else body.innerHTML = '<p class="hint" style="color:var(--bad)">missing template “' + bEsc(def.tpl) + '”</p>';
  }
  node.appendChild(body);

  // Header buttons sit outside .panel-body, so the body-scoped wiring below
  // cannot see them; route them through the same action handler.
  head.querySelectorAll(".panel-head-btn").forEach(btn => {
    btn.onclick = () => def.headAction
      ? def.headAction(btn.dataset.act, btn, body)
      : BOARD_HOOKS.headAction(def, btn.dataset.act, btn, body);
  });

  wirePanelBody(def, body);
  PANEL_NODES.set(def.id, node);
  return node;
}

// Body wiring that must survive re-renders lives here, once per panel.
function wirePanelBody(def, body) {
  BOARD_HOOKS.wireBody(def, body);
}

function renderBoardCells() {
  const b = boardEl();
  [...b.querySelectorAll(".board-cell")].forEach(c => c.remove());
  const rows = boardRows();
  const frag = document.createDocumentFragment();
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const cell = document.createElement("div");
      cell.className = "board-cell";
      cell.style.gridColumn = (x + 1) + " / span 1";
      cell.style.gridRow = (y + 1) + " / span 1";
      cell.textContent = "+";
      cell.title = "add a panel here";
      if (boardPick && boardPick.x === x && boardPick.y === y) cell.classList.add("picked");
      //  The cell you pressed is where the next panel added from the list goes.
      cell.addEventListener("click", () => {
        boardPick = { x, y };
        b.querySelectorAll(".board-cell.picked").forEach(c => c.classList.remove("picked"));
        cell.classList.add("picked");
        bEl("boardFlyoutWrap").classList.add("open");
      });
      frag.appendChild(cell);
    }
  }
  b.insertBefore(frag, b.firstChild);
}

function renderBoardTiles() {
  const b = boardEl();
  /* Every placed panel is looked up BEFORE any wrapper is torn down. .remove()
     detaches the wrapper and the panel living inside it in the same call — a
     detached node is invisible to getElementById even though the object is
     still alive — so looking a panel up afterwards silently loses it on every
     render past the first. */
  const nodes = new Map(board.tiles.map(t => [t.id, panelNode(t.id)]));
  [...b.querySelectorAll(".board-tile")].forEach(t => t.remove());
  b.style.setProperty("--board-cols", board.cols);
  b.style.setProperty("--board-row", board.rowUnit + "px");

  /*  Appended in visual order (top row first, then left to right), not in the
      order the array happens to hold. Tiles all share z-index:1, so DOM order
      decides who paints over whom — and a cartouche overhangs UP into the tile
      above it, which must therefore already be on the page. Out of order, the
      label of a lower tile was painted over by its upper neighbor. */
  const painted = [...board.tiles].sort((a, c) => a.y - c.y || a.x - c.x);
  for (const t of painted) {
    const panel = nodes.get(t.id);
    if (!panel) continue;
    //  A docked panel is not in the grid. renderDocks() parents it instead,
    //  and it keeps its x/y/w/h so undocking puts it back where it was.
    if (t.dock) continue;
    panel.classList.remove("is-docked");
    const wrap = document.createElement("div");
    wrap.className = "board-tile";
    wrap.dataset.id = t.id;
    wrap.style.gridColumn = (t.x + 1) + " / span " + t.w;
    wrap.style.gridRow = (t.y + 1) + " / span " + t.h;

    // Reused across re-renders rather than recreated — the panel-head survives
    // (only the wrapper is torn down), so appending a fresh button every render
    // would pile up duplicates.
    ensureRemoveButton(panel, t.id);
    ensureReloadButton(panel, t.id);
    ensureCoverButton(panel, t.id);
    wrap.appendChild(panel);
    appendTileResize(wrap, t, "w", t.x + t.w < board.cols && !overlaps(t, t.x + t.w, t.y, 1, t.h));
    appendTileResize(wrap, t, "h", !overlaps(t, t.x, t.y + t.h, t.w, 1));
    b.appendChild(wrap);
  }
}

// Only the legal buttons — a "+" never appears toward an occupied neighbor or
// past the board edge.
function appendTileResize(wrap, t, dim, canGrow) {
  const canShrink = (dim === "w" ? t.w : t.h) > 1;
  if (!canGrow && !canShrink) return;
  const box = document.createElement("div");
  box.className = "tile-resize tile-resize-" + dim;
  const mk = (label, delta, title) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = label; b.title = title;
    b.addEventListener("click", e => { e.stopPropagation(); resizeTile(t.id, dim, delta); });
    box.appendChild(b);
  };
  if (canGrow) mk("+", 1, dim === "w" ? "widen by one column" : "taller by one row");
  if (canShrink) mk("−", -1, dim === "w" ? "narrow by one column" : "shorter by one row");
  wrap.appendChild(box);
}

function resizeTile(id, dim, delta) {
  const t = board.tiles.find(k => k.id === id);
  if (!t) return;
  if (dim === "w") {
    const nw = t.w + delta;
    if (nw < 1) return;
    if (delta > 0 && (t.x + nw > board.cols || overlaps(t, t.x + t.w, t.y, delta, t.h))) return;
    t.w = nw;
  } else {
    const nh = t.h + delta;
    if (nh < 1) return;
    if (delta > 0 && overlaps(t, t.x, t.y + t.h, t.w, delta)) return;
    t.h = nh;
  }
  renderBoard({ content: false }); saveBoard();
}

/*  DOCKS.

    A panel pinned to an edge of the WINDOW rather than placed on the board. It
    stays where it is while the board scrolls past it, which is the whole point:
    the Pallet is the thing you are typing into and the panel you want to see
    is three screens down.

    A docked tile keeps its x, y, w and h untouched, so undocking drops it back
    into the cell it came from. `dock` and `dockSize` are the only additions,
    and a board saved without them reads exactly as it always did.

    The board gets padding rather than a smaller width, so nothing about the
    grid has to know a dock exists. */
const DOCK_SIDES = ["top", "right", "bottom", "left"];
const DOCK_MIN = 90, DOCK_MAX = 0.7;     // px, and a share of the window

function dockedTiles(side) {
  return board.tiles.filter(t => t.dock === side);
}
function dockSizeOf(side) {
  const tiles = dockedTiles(side);
  if (!tiles.length) return 0;
  const across = side === "left" || side === "right";
  const room = (across ? window.innerWidth : window.innerHeight) * DOCK_MAX;
  //  One size per EDGE, taken from the first panel on it: two panels sharing an
  //  edge share its thickness, the way a split pane does.
  return Math.max(DOCK_MIN, Math.min(room, tiles[0].dockSize || (across ? 300 : 240)));
}

function setDock(id, side) {
  const t = board.tiles.find(x => x.id === id);
  if (!t) return;
  if (side && !DOCK_SIDES.includes(side)) return;
  if (side) t.dock = side; else delete t.dock;
  saveBoard();
  renderBoard({ content: false });
  //  Canvas panels measure themselves against their box, and that box has just
  //  changed shape completely.
  BOARD_HOOKS.resized(true);   // canvas panels remeasure after the re-layout
}

/*  The way off an edge, beside the ordinary ✕ rather than instead of it. Two
    glyphs, two meanings: ↩ goes back to the board, ✕ leaves the board. An
    earlier version hid the ✕ while docked to avoid two crosses in one header,
    which read as a panel you were not allowed to remove.

    Added once and kept, since the header survives a re-render. */
/*  Reused across re-renders rather than recreated: the panel-head survives a
    render, so appending a fresh button each time would pile up duplicates.
    Wanted in two places now, a tile and a rail, which is why it left
    renderBoardTiles. */
/*  BUILD THIS PANEL AGAIN FROM NOTHING.

    A panel that draws into a canvas keeps a great deal of state on its own
    element: a renderer, a ticker, textures, a cast of display objects, a map
    instance. When one of those ends up in a state it cannot draw out of, every
    other route to fixing it costs you the whole page and everything else you
    had open.

    So: throw the panel's state away, empty its body, and let its renderer
    build the thing fresh. The pile is untouched, because no panel owns any of
    it — the Pallet is the only thing that does, and its state is a string.

    Whatever the panel hung on itself goes with it. That is the point, and it
    is why the underscore convention matters: anything private is prefixed, so
    "forget everything this panel remembered" is one loop. */
/*  WHAT EACH PANEL'S COVER IS MADE OF, AND HOW FAR IT IS PULLED.

    The position is a FRACTION of the panel's width rather than a pixel count,
    so a cover survives the tile being resized, the board changing its column
    count and the window being made narrower. 0 is shut; past 0.9 it is off
    altogether and there is no entry at all.

    Kept beside the board layout rather than in the pile: a cover is a thing
    about this screen right now, not a fact about your research. */
const COVER_KEY = BOARD_NS + "covers:v2";
/*  Named for what they are rather than for how they are drawn, because the
    choice you are making is what you want to be able to see through.

    Glass first. A cover over a panel that MOVES — the street, the map, a
    timeline — wants to leave you the movement while taking the controls away,
    and frosted does that. Card is the one that hides it completely, and it is
    last because that is the rarer want. */
const COVER_MATS = ["frosted", "smoked", "card"];
const COVER_MAT_DEFAULT = "frosted";
/*  WHICH WAY IT OPENS, named by the direction the sheet slides to open:
    lr drags left to right, rl right to left, tb top to bottom, bt bottom to
    top. Left to right is the default and what every cover did before there
    was a choice, so an older store reads as lr. */
const COVER_DIRS = ["lr", "rl", "tb", "bt"];
const COVER_DIR_DEFAULT = "lr";
const okDir = d => (COVER_DIRS.includes(d) ? d : COVER_DIR_DEFAULT);
let COVERS = new Map();                 // id -> { x: 0..1, m: material, d: side }

/*  WHAT A PANEL'S COVER IS LIKE, WHETHER IT HAS ONE ON OR NOT.

    COVERS says which panels are covered right now. This says what the cover
    looks like when there is one, and it outlives taking it off — a material
    you chose is a decision about that panel, not about that particular sheet,
    and having it thrown away because you uncovered the panel for a minute is
    the kind of small forgetting that makes a setting not worth making.

    The openness is remembered the same way. Take a cover off with ▤ and put it
    back, and it returns exactly as you left it — same material, same distance
    across. */
const COVER_PREF_KEY = BOARD_NS + "coverprefs:v1";
let COVER_PREFS = new Map();            // id -> { x, m }, kept when uncovered

function coverPref(id) {
  const p = COVER_PREFS.get(id);
  return { x: p && isFinite(p.x) ? p.x : 0,
           m: p && COVER_MATS.includes(p.m) ? p.m : COVER_MAT_DEFAULT,
           d: okDir(p && p.d) };
}
function rememberCover(id, st) {
  COVER_PREFS.set(id, { x: st.x, m: st.m, d: okDir(st.d) });
  try {
    if (!COVER_PREFS.size) localStorage.removeItem(COVER_PREF_KEY);
    else localStorage.setItem(COVER_PREF_KEY, JSON.stringify([...COVER_PREFS.entries()]));
  } catch (e) { /* unavailable */ }
}
function loadCoverPrefs() {
  try {
    const raw = localStorage.getItem(COVER_PREF_KEY);
    if (!raw) return;
    for (const [id, v] of JSON.parse(raw)) {
      const x = Number(v && v.x);
      COVER_PREFS.set(id, { x: isFinite(x) && x >= 0 && x <= 1 ? x : 0,
                            m: COVER_MATS.includes(v && v.m) ? v.m : COVER_MAT_DEFAULT,
                            d: COVER_DIRS.includes(v && v.d) ? v.d : undefined });
    }
  } catch (e) { /* unavailable, or a store somebody hand-edited */ }
}

function loadCovers() {
  try {
    const raw = localStorage.getItem(COVER_KEY);
    if (raw) {
      for (const [id, v] of JSON.parse(raw)) {
        const x = Number(v && v.x);
        //  1 is a legal position now — fully aside, still on the panel.
        if (!isFinite(x) || x < 0 || x > 1) continue;
        COVERS.set(id, { x, m: COVER_MATS.includes(v.m) ? v.m : COVER_MAT_DEFAULT, d: okDir(v.d) });
      }
      return;
    }
    /*  A v1 store held a bare number and no material. Honoured rather than
        dropped: a panel you covered is one you meant to cover. */
    const old = localStorage.getItem(BOARD_NS + "covers:v1");
    if (!old) return;
    for (const [id, v] of JSON.parse(old)) {
      const x = Number(v);
      if (isFinite(x) && x >= 0 && x <= 1) COVERS.set(id, { x, m: COVER_MAT_DEFAULT, d: COVER_DIR_DEFAULT });
    }
  } catch (e) { /* unavailable, or a store somebody hand-edited */ }
}
function saveCovers() {
  try {
    if (!COVERS.size) localStorage.removeItem(COVER_KEY);
    else localStorage.setItem(COVER_KEY, JSON.stringify([...COVERS.entries()]));
  } catch (e) { /* unavailable */ }
}
//  What is on the panel now, or failing that what it had last time.
const coverAt = id => COVERS.get(id) || coverPref(id);

function coverOf(panel) { return panel.querySelector(":scope > .panel-shade"); }
function tabOf(panel) { return panel.querySelector(":scope > .panel-tab"); }

/*  EVERYTHING BELOW THE TITLE BAR, not the .panel-body.

    The body was the obvious thing to measure and it is wrong for any panel
    whose content breaks out of it. The Promenade's shell does exactly that —
    its canvas sits at the panel's own edge with the bar and the footnote
    bled past the body's box — so a cover cut to the body left a strip of live
    street showing top and bottom. A cover with a gap in it is not a cover.

    So it is measured off the PANEL: the whole inside of it, from the underside
    of the header down. That covers anything a panel can do with its own
    content, including the things it has not thought of yet.

    Offsets are from the padding edge, because that is what an absolutely
    positioned child of a relatively positioned box is laid out against. */
/*  HOW FAR THE HANDLE SITS FROM THE SHADE'S LEFT EDGE.

    Straddling the sheet's leading edge — half on the cover, half on what has
    been uncovered — and never past either end of the panel. One expression,
    because the drag and the settle both need it and they were drifting apart
    when each worked it out for itself. */
const TAB_W = 17;
function tabShift(x, width) {  // width is unused: see below
  /*  FLUSH TO THE EDGE, NOT CENTRED ON IT.

      Centred looks better standing still and cannot be animated. The sheet
      travels the full width; a tab centred on its edge has to stop half its
      own width short, so the two ease toward DIFFERENT endpoints and the
      browser spreads that difference across the whole journey — the handle
      creeps against the edge it is supposed to be fixed to. Same duration,
      same property, same curve, and still out of step, because the distances
      were never the same.

      Flush was no better: clamping the far end still shortens the journey, and
      the browser spreads the seventeen pixels it lost across the whole of it.
      Any clamp at all, at either end, IS the drift. There is no version of
      this where the tab travels a different distance and still looks attached.

      So it travels exactly as far as the sheet does, and it is parked half its
      own width to the left of the shade. Shut, half of it stands proud of the
      panel; wide open, half of it stands proud the other way. Both of those
      are eight pixels into the panel's own padding, both look like a handle on
      a sliding thing, and in between it is welded to the edge. */
  return Math.round(x);
}

/*  THE ONE PLACE THAT KNOWS WHAT A SIDE MEANS. The sheet and the tab both
    move by this, so they cannot disagree about which way is open. */
const coverHoriz = d => d === "lr" || d === "rl";
const coverSign = d => (d === "lr" || d === "tb" ? 1 : -1);
const coverMove = (d, px) =>
  (coverHoriz(d) ? "translateX(" : "translateY(") + Math.round(coverSign(d) * px) + "px)";
//  How far the sheet can travel: across for a side cover, down for a top one.
const coverSpan = (d, box) => (coverHoriz(d) ? box.width : box.height);
/*  How far the sheet has moved, handed to its own CSS as --shx / --shy, so
    something painted ON the glass can stay put over the panel while the glass
    slides (a light glowing through a frosted cover is under the lamp, not
    wherever the sheet has been pushed to). */
function coverOffset(el, d, px) {
  const v = -Math.round(coverSign(d) * px) + "px";
  el.style.setProperty("--shx", coverHoriz(d) ? v : "0px");
  el.style.setProperty("--shy", coverHoriz(d) ? "0px" : v);
}

function coverBox(panel) {
  /*  ALL OF IT, including the strip behind the title bar.

      Starting under the header was still short. A header is transparent and
      several panels draw UNDER it — the Promenade's canvas begins thirty
      pixels above the header's baseline, so a cover that started where the
      header stopped left a band of live street running along the top of the
      panel.

      The header does not need the room. It sits above the cover in the
      stacking order, so the title, the badges and every button stay legible
      and clickable ON the cover rather than beside it. Which means the cover
      can simply be the panel: everything inside the border, corner to corner.

      Offsets are from the padding edge, because that is what an absolutely
      positioned child of a relatively positioned box is laid out against. */
  return { left: 0, top: 0, width: panel.clientWidth, height: panel.clientHeight };
}

/*  Everything about where the three pieces sit, in one place, so the sheet and
    its handle can never disagree about which edge is the leading one. */
function placeCover(panel, id) {
  const shade = coverOf(panel), tab = tabOf(panel);
  if (!shade) return;
  const box = coverBox(panel);
  /*  A PANEL WITH NO SIZE IS A PANEL THAT IS NOT THERE YET.

      A board render detaches every tile wrapper before re-appending it, so for
      part of that pass the panel measures zero by zero. Placed against that,
      the sheet was written to translateX(0) — flat shut — and the fraction it
      had been at was still in the store but no longer on the screen. Whether
      the ResizeObserver noticed depends on whether the browser coalesced the
      detach and the re-attach into one report: when the panel came back the
      same size it left, there was no change to observe and nothing put it
      right. A cover that "reset when I changed the grid".

      So: measure, and if the answer is nothing, leave everything exactly as it
      was. The observer will call again the moment there is a real box. */
  if (box.width < 1 || box.height < 1) return;
  const br = { width: box.width, height: box.height };
  const ox = box.left, oy = box.top;
  shade.style.left = ox + "px";
  shade.style.top = oy + "px";
  shade.style.width = br.width + "px";
  shade.style.height = br.height + "px";
  const st = coverAt(id);
  const d = okDir(st.d);
  const x = Math.round(st.x * coverSpan(d, br));
  const sheet = shade.firstElementChild;
  if (sheet) {
    sheet.style.transform = coverMove(d, x);
    coverOffset(sheet, d, x);
    sheet.dataset.mat = st.m;
  }
  //  The swatch on the handle IS the current material, so what you press to
  //  change it is also what tells you where you are.
  const swatch = tab && tab.querySelector(".tab-mat");
  if (swatch) swatch.dataset.mat = st.m;
  if (tab) {
    /*  Parked at the shade's left edge and moved by transform from there, so
        it animates on the same property as the sheet does. `left` stays put
        and only the transform changes.

        Held inside the panel at both ends. Fully open, the sheet's leading
        edge is the panel's own right edge, and a tab centred on it would hang
        half over the tile next door with nothing to pull it back by. */
    //  Its length follows the edge it sits on: the height for a side cover,
    //  the width for a top or bottom one.
    const TH = Math.max(34, Math.min(72, (coverHoriz(d) ? br.height : br.width) * 0.28));
    tab.dataset.dir = d;
    //  Half a tab outside the edge the sheet opens from, so travelling the
    //  sheet's full distance leaves it straddling that edge the whole way.
    if (coverHoriz(d)) {
      tab.style.width = TAB_W + "px";
      tab.style.height = Math.round(TH) + "px";
      tab.style.left = Math.round(ox + (d === "lr" ? 0 : br.width) - TAB_W / 2) + "px";
      tab.style.top = Math.round(oy + (br.height - TH) / 2) + "px";
    } else {
      tab.style.width = Math.round(TH) + "px";
      tab.style.height = TAB_W + "px";
      tab.style.left = Math.round(ox + (br.width - TH) / 2) + "px";
      tab.style.top = Math.round(oy + (d === "tb" ? 0 : br.height) - TAB_W / 2) + "px";
    }
    tab.style.transform = coverMove(d, tabShift(x, br.width));
  }
}

function addCover(panel, id) {
  if (coverOf(panel)) { placeCover(panel, id); return; }
  if (OPEN_DECK && OPEN_DECK.panel === panel) closeInstanceDeck();
  const body = panel.querySelector(".panel-body");
  if (!body) return;

  const shade = document.createElement("div");
  shade.className = "panel-shade";
  const cv = document.createElement("div");
  cv.className = "panel-cover";
  shade.appendChild(cv);
  panel.appendChild(shade);

  const tab = document.createElement("div");
  tab.className = "panel-tab";
  const grip = document.createElement("i");
  grip.className = "tab-grip";
  grip.title = "drag to open or shut \u2014 click to peek under it";
  const mat = document.createElement("i");
  mat.className = "tab-mat";
  mat.title = "what the cover is made of \u2014 click to change it";
  tab.appendChild(grip);
  tab.appendChild(mat);
  panel.appendChild(tab);

  placeCover(panel, id);

  /*  ONE GESTURE, TWO GRIPS. The tab is the handle and the sheet is the rest
      of the same thing, so both run the same drag — you should not have to
      find a 15-pixel target to move something the size of a panel.

      Pointer capture, so the sheet keeps following the hand when the pointer
      leaves the panel, which it will: sliding a cover aside is a gesture that
      ends outside the tile it started in. */
  let from = 0, grabbed = 0, w = 1, moved = false, live = null, onSwatch = false, dir = COVER_DIR_DEFAULT;
  //  How far the pointer has gone in the direction that opens this cover.
  const along = e => (coverHoriz(dir) ? e.clientX : e.clientY);
  const start = (el, e) => {
    if (e.button !== 0) return;
    /*  WHERE THE PRESS LANDED, recorded now.

        It cannot be read at pointerup. setPointerCapture retargets every later
        pointer event to the element holding the capture, so by the time the
        finger lifts, the event's target is the tab and not the swatch inside
        it — and the material click fell through to "throw it wide" every
        single time.

        The test that should have caught this was firing a synthetic event with
        its own target, which is the one shape of event the bug cannot happen
        on. pointerdown runs before the capture is taken, so its target is the
        real one. */
    onSwatch = !!(e.target && e.target.closest && e.target.closest(".tab-mat"));
    dir = okDir(coverAt(id).d);
    w = Math.max(1, coverSpan(dir, coverBox(panel)));
    from = coverAt(id).x * w;
    grabbed = along(e);
    moved = false;
    live = el;
    /*  BOTH of them, whichever one was grabbed. Dragging the sheet used to
        leave the tab without the class, so the handle eased along behind the
        pointer while the sheet kept up with it — the one case the transition
        must not apply to. */
    cv.classList.add("sliding");
    tab.classList.add("sliding");
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* no capture */ }
    e.preventDefault();
    e.stopPropagation();           // never starts a tile drag
  };
  const move = e => {
    if (!live) return;
    const dx = (along(e) - grabbed) * coverSign(dir);
    if (!moved && Math.abs(dx) < 3) return;
    moved = true;
    const x = Math.max(0, Math.min(w, from + dx));
    cv.style.transform = coverMove(dir, x);
    coverOffset(cv, dir, x);
    //  The same sum the settle uses, so letting go does not shift it.
    tab.style.transform = coverMove(dir, tabShift(x, w));
  };
  const letGo = e => {
    if (!live) return;
    const el = live; live = null;
    cv.classList.remove("sliding");
    tab.classList.remove("sliding");
    try { el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
    /*  A press that never moved is a press, not a drag — and WHERE on the
        handle decides which press it was. The ridged upper part throws the
        cover wide or shuts it, which is what a tab does. The swatch along the
        bottom steps through the materials, which is the only way any of them
        but the first was ever going to be found.

        Dragging works from either, so nothing is lost by splitting it: the
        whole handle still slides. */
    if (!moved) {
      if (el === tab) {
        if (onSwatch) cycleMat();
        else {
          /*  A CLICK IS A PEEK, NOT A SWEEP.

              It threw the sheet the whole way across, which is a big thing to
              do by accident on the one control you are most likely to brush
              past — and it is rarely what you want: uncovering a panel
              entirely is what the ▤ is for. What a press is actually asking is
              "what is under here", and the answer to that is a gap.

              Twice the handle's own width, so the opening is measured in the
              thing you are holding rather than in a number: one tab of sheet
              moved, one tab of panel showing. Drag it if you want more.

              As a fraction, because that is what the store keeps — the same
              34 pixels is a third of a narrow panel and a twentieth of a wide
              one, and the gap should be the same gap either way. */
          /*  IT PARKS UNDER THE CORNER CONTROLS.

              A press slides the sheet almost the whole way across and stops
              where the panel's own buttons begin, so the strip left showing
              sits beneath ↻ and ✕ rather than somewhere arbitrary. Two
              handles was a number I chose; this is a number the panel already
              has, and it lines the cover's edge up with something real.

              Measured off the reload button rather than written down, so it
              follows if those controls are ever resized or one is added. */
          const box = coverBox(panel);
          const w = Math.max(1, coverSpan(dir, box));
          //  Only left to right parks under the corner controls; the other
          //  sides leave a strip two handles wide.
          const rl = dir === "lr" && panel.querySelector(".tile-reload");
          const pr = panel.getBoundingClientRect();
          const corner = rl
            ? Math.max(0, pr.right - rl.getBoundingClientRect().left) + 6
            : TAB_W * 2;
          const open = Math.max(0, Math.min(0.98, 1 - corner / w));
          setCoverX(panel, id, coverAt(id).x > 0.01 ? 0 : open);
        }
      }
      return;
    }
    setCoverX(panel, id, Math.max(0, Math.min(w, from + (along(e) - grabbed) * coverSign(dir))) / w);
  };
  for (const el of [cv, tab]) {
    el.addEventListener("pointerdown", e => start(el, e));
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", letGo);
    el.addEventListener("pointercancel", letGo);
  }

  const cycleMat = () => {
    const st = coverAt(id);
    const next = COVER_MATS[(COVER_MATS.indexOf(st.m) + 1) % COVER_MATS.length];
    COVERS.set(id, { x: st.x, m: next, d: okDir(st.d) });
    rememberCover(id, { x: st.x, m: next, d: st.d });
    saveCovers();
    placeCover(panel, id);
  };
  //  Right-click on the handle does the same thing, for anybody who reaches
  //  for it. It is a shortcut to the swatch, not the way in.
  tab.addEventListener("contextmenu", e => { e.preventDefault(); cycleMat(); });
  cv.addEventListener("contextmenu", e => {
    e.preventDefault();
    setCoverX(panel, id, 0);
  });

  /*  MEASURED WHENEVER THE BODY IS, not once when it is made.

      A cover put on during a board render measured a body the browser had not
      laid out yet — zero by zero — and then never looked again, so the sheet
      was an invisible speck in the corner of the tile.

      Everything that can change a panel's size ends in the same place: the
      body's own box. One observer per cover rather than a hook in each of the
      five things that reflow a board, and disconnected with the cover, so a
      board of uncovered panels is watching nothing. */
  /*  The PANEL and its header. The box is cut from both, and a header that
      wraps to two lines moves the top of the cover without the panel changing
      size at all. */
  const ro = new ResizeObserver(() => placeCover(panel, id));
  ro.observe(panel);
  const head = panel.querySelector(".panel-head");
  if (head) ro.observe(head);
  shade.__ro = ro;
}

/*  HOW FAR ACROSS, AND NOTHING ELSE.

    Sliding it right off used to take the cover away. That was one gesture
    doing two jobs, and it made the wrong one easy: a drag that went a little
    too far removed the thing you were only trying to move, and the ▤ in the
    header — which exists for exactly that — was left with nothing to do that
    you had not already done by accident.

    So the slider only ever slides. Fully open is a position like any other:
    the sheet sits clear of the panel and the tab stands at the far edge
    waiting to be pulled back. The toggle is the only way on and the only way
    off. */
function setCoverX(panel, id, f) {
  const st = coverAt(id);
  const x = Math.max(0, Math.min(1, f));
  COVERS.set(id, { x, m: st.m, d: okDir(st.d) });
  rememberCover(id, { x, m: st.m, d: st.d });
  placeCover(panel, id);
  saveCovers();
  syncCoverBtn(panel, id);
}

function removeCover(panel, id) {
  const shade = coverOf(panel), tab = tabOf(panel);
  if (shade) {
    if (shade.__ro) { try { shade.__ro.disconnect(); } catch (e) { /* gone */ } }
    shade.remove();
  }
  if (tab) tab.remove();
}

function syncCoverBtn(panel, id) {
  const b = panel.querySelector(".tile-cover");
  if (!b) return;
  const on = COVERS.has(id);
  b.classList.toggle("on", on);
  b.title = on ? "take the cover off"
               : "cover this panel \u2014 pick the side it opens from (press again for the lit one)";
}

/*  CHOOSING THE SIDE.

    ▤ on an uncovered panel puts an arrow on each edge. The cover comes IN
    from the edge you pick, travelling the way its arrow points, so it is
    fastened to that edge and its tab is on the far side. (The stored side
    names the way it slides OPEN, which is the opposite way: the → on the left
    edge is "rl".) The one this panel used last is lit, left to right until you
    choose another, so a second press of ▤ takes it without aiming. Esc, or a
    click anywhere else on the panel, puts the arrows away and changes nothing.
    Taking a cover off never asks. */
const COVER_EDGES = [
  { edge: "left",   glyph: "\u2192", d: "rl", title: "cover it from the left" },
  { edge: "right",  glyph: "\u2190", d: "lr", title: "cover it from the right" },
  { edge: "top",    glyph: "\u2193", d: "bt", title: "cover it from the top" },
  { edge: "bottom", glyph: "\u2191", d: "tb", title: "cover it from the bottom" },
];
//  The lit arrow: the side last chosen, or left to right for a panel that
//  has never been given one.
const pickDefault = id => {
  const p = COVER_PREFS.get(id);
  return p && COVER_DIRS.includes(p.d) ? p.d : "rl";
};
function pickerOf(panel) { return panel.querySelector(":scope > .cover-pick"); }
function closeCoverPicker(panel) {
  const p = pickerOf(panel);
  if (!p) return;
  if (p.__esc) document.removeEventListener("keydown", p.__esc, true);
  p.remove();
}
function coverWith(panel, id, d) {
  closeCoverPicker(panel);
  const st = coverPref(id);
  COVERS.set(id, { x: st.x, m: st.m, d: okDir(d) });
  rememberCover(id, COVERS.get(id));
  removeCover(panel, id);         // a new side means a new tab, placed fresh
  addCover(panel, id);
  saveCovers();
  syncCoverBtn(panel, id);
}
function openCoverPicker(panel, id) {
  const last = pickDefault(id);
  const p = document.createElement("div");
  p.className = "cover-pick";
  p.innerHTML = COVER_EDGES.map(k =>
    '<button type="button" data-edge="' + k.edge + '" data-d="' + k.d + '"' +
    (k.d === last ? ' class="on"' : "") +
    ' title="' + k.title + '">' + k.glyph + "</button>").join("");
  p.addEventListener("pointerdown", e => e.stopPropagation());   // never a tile drag
  p.addEventListener("click", e => {
    e.stopPropagation();
    const b = e.target.closest("button[data-d]");
    if (b) coverWith(panel, id, b.dataset.d);
    else closeCoverPicker(panel);
  });
  p.__esc = e => { if (e.key === "Escape") { e.stopPropagation(); closeCoverPicker(panel); } };
  document.addEventListener("keydown", p.__esc, true);
  panel.appendChild(p);
  const on = p.querySelector("button.on");
  if (on) on.focus({ preventScroll: true });
}

function ensureCoverButton(panel, id) {
  if (!panel.querySelector(".tile-cover")) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tile-cover";
    b.textContent = "\u25a4";
    b.addEventListener("click", e => {
      e.stopPropagation();
      if (COVERS.has(id)) {
        closeCoverPicker(panel);
        //  Put away as it stands, so it comes back the same.
        rememberCover(id, COVERS.get(id));
        COVERS.delete(id);
        removeCover(panel, id);
        saveCovers();
        syncCoverBtn(panel, id);
      } else if (pickerOf(panel)) {
        //  Second press: the lit side, which is the last one used.
        coverWith(panel, id, pickDefault(id));
      } else {
        openCoverPicker(panel, id);
      }
    });
    /*  Last in the cartouche, after the ?. Appended to the lead rather than to
        the header, so it travels with the title: the cartouche is what moves
        when the panel is narrow, and a mark that belongs to the title has to
        move with it. */
    const lead = panel.querySelector(".panel-head-lead");
    (lead || panel.querySelector(".panel-head")).appendChild(b);
  }
  /*  The panel element is reused across board renders, so a cover that should
      be there is put back rather than assumed to have survived — and one that
      should not is taken off, but only if there is one. This ran removeCover
      on every uncovered panel on every render: a dozen calls a keystroke, each
      one a query and a branch for a cover that was never there. */
  if (COVERS.has(id)) addCover(panel, id);
  else if (coverOf(panel)) removeCover(panel, id);
  syncCoverBtn(panel, id);
}

function reloadPanel(id) {
  const node = document.getElementById(id);
  const def = panels.get(id);
  if (!node || !def) return;
  const body = node.querySelector(".panel-body");
  if (!body) return;

  //  Hand back what the browser will not collect on its own: a WebGL context
  //  and a map both hold resources that outlive the element.
  try { if (body._app && body._app.destroy) body._app.destroy(true, { children: true }); } catch (e) { /* already gone */ }
  try { if (body._map && body._map.remove) body._map.remove(); } catch (e) { /* already gone */ }
  if (body._seen && body._seen.disconnect) { try { body._seen.disconnect(); } catch (e) { /* gone */ } }

  for (const k of Object.keys(body)) if (k.charAt(0) === "_") delete body[k];
  delete body.dataset.built;
  body.innerHTML = "";

  /*  PUT THE TEMPLATE BACK.

      This emptied the body and then asked the panel to render into it, which
      works only for the panels that build their own DOM — the Promenade, the
      Sprite Editor, Tally. Every panel with a `tpl` renders by looking its own
      markup UP, so an empty body handed them nothing to find and the render
      threw on the first null: Theme, Filter, The Pallet, Gazetteer, Notation
      reference. Pressing reload on any of those killed the panel rather than
      rebuilding it.

      Cloned from the same template `buildPanel` uses, and wired with the same
      call, because "rebuild this panel" has to mean what the first build
      meant. */
  if (def.tpl) {
    const tpl = bEl(def.tpl);
    if (tpl) body.appendChild(tpl.content.cloneNode(true));
    else body.innerHTML = '<p class="hint" style="color:var(--bad)">missing template “' + bEsc(def.tpl) + '”</p>';
  }
  //  Listeners that live for the panel's lifetime rather than for one render.
  //  Without this a rebuilt Pallet took your typing nowhere.
  try { wirePanelBody(def, body); } catch (e) { /* a template that lost a hook */ }

  BOARD_HOOKS.refreshPanel(id);
}

function ensureReloadButton(panel, id) {
  if (panel.querySelector(".tile-reload")) return;
  const b = document.createElement("button");
  b.type = "button";
  b.className = "tile-reload";
  /*  A LIGHT ARROW, TO MATCH THE CROSS IT SITS BESIDE.

      U+27F3 is a heavy circular arrow drawn for body text, and in an
      eighteen-pixel disc next to a hairline cross it read as a blot: two
      controls the same size and the same shape, one of them twice the weight
      of the other. U+21BB is the same gesture at the cross's own weight.

      Clockwise, because that is the way every reload control anybody has used
      turns; a counter-clockwise one reads as undo. */
  b.textContent = "↻";
  //  Says what it does, not how it does it. It read "build this panel again,
  //  from nothing", which describes the implementation and sounds like a
  //  threat.
  b.title = "reload this panel";
  b.addEventListener("click", e => { e.stopPropagation(); reloadPanel(id); });
  /*  In the HEADER, where ✕ lives, not on the panel.

      Both are placed with the same `top`, and an absolute offset resolves
      against the nearest positioned ancestor — the header is one, so a button
      hung on the panel instead measured from a different box and landed
      fourteen pixels higher than its twin. */
  panel.querySelector(".panel-head").appendChild(b);
}

function ensureRemoveButton(panel, id) {
  if (panel.querySelector(".panel-head > .tile-remove")) return;
  const rm = document.createElement("button");
  rm.type = "button";
  rm.className = "tile-remove";
  rm.title = "remove from board";
  rm.textContent = "✕";
  rm.addEventListener("click", e => { e.stopPropagation(); removeTile(id); });
  panel.querySelector(".panel-head").appendChild(rm);
}

function addDockPop(panel, id) {
  if (panel.querySelector(".panel-head > .dock-pop")) return;
  const x = document.createElement("button");
  x.type = "button";
  x.className = "dock-pop";
  x.textContent = "\u21A9";             // ↩ — undo the dock
  x.title = "undock: put it back on the board";
  x.addEventListener("click", e => { e.stopPropagation(); setDock(id, ""); });
  //  Before the ✕, which owns the corner, so the two never trade places.
  const head = panel.querySelector(".panel-head");
  head.insertBefore(x, head.querySelector(".tile-remove"));
}

function renderDocks() {
  for (const side of DOCK_SIDES) {
    const tiles = dockedTiles(side);
    let rail = document.getElementById("dock-" + side);
    if (!tiles.length) { if (rail) rail.remove(); continue; }
    if (!rail) {
      rail = document.createElement("div");
      rail.id = "dock-" + side;
      rail.className = "dock dock-" + side;
      const grip = document.createElement("div");
      grip.className = "dock-grip";
      grip.title = "drag to resize this edge";
      rail.appendChild(grip);
      wireDockGrip(grip, side);
      wireDockReorder(rail, side);
      document.body.appendChild(rail);
    }
    const size = dockSizeOf(side);
    if (side === "left" || side === "right") rail.style.width = size + "px";
    else rail.style.height = size + "px";

    /*  The rail is laid out in the order the tiles sit in, and appending only
        when the parent is wrong was not enough: a panel already in the right
        rail in the wrong place stayed put, so reordering did nothing. Compared
        first, then re-appended in one pass, because appendChild MOVES a node
        and doing that every render costs the Promenade a reflow it does not
        need. */
    /*  Panels with a splitter between each pair, so the share of the rail is
        yours as well as its thickness. The pair is the handle's identity, so a
        reorder retires the old handles and mints the ones the new neighbours
        need. */
    const want = [];
    tiles.forEach((t, i) => {
      if (i) want.push(dockSplit(rail, side, tiles[i - 1].id, t.id));
      want.push(panelNode(t.id));
    });
    const have = [...rail.querySelectorAll(":scope > .panel, :scope > .dock-split")];
    if (have.length !== want.length || have.some((n, i) => n !== want[i])) {
      for (const n of want) rail.appendChild(n);
    }
    for (const n of have) if (!want.includes(n) && n.classList.contains("dock-split")) n.remove();
    //  Each panel's share, which the splitter writes and this reads back.
    for (const t of tiles) {
      const p = document.getElementById(t.id);
      if (p) p.style.flexGrow = t.dockGrow || 1;
    }

    for (const t of tiles) {
      const panel = document.getElementById(t.id);
      if (!panel) continue;
      panel.classList.add("is-docked");
      //  A board restored with this panel already docked never went through
      //  renderBoardTiles, so it has no ✕ yet. Without this it arrives on the
      //  rail with no way off the board at all.
      ensureRemoveButton(panel, t.id);
      ensureReloadButton(panel, t.id);
      addDockPop(panel, t.id);
      ensureCoverButton(panel, t.id);
    }
    //  Panels that left this rail since the last render.
    for (const node of [...rail.querySelectorAll(":scope > .panel")]) {
      if (!tiles.some(t => t.id === node.id)) node.remove();
    }

    /*  The rail's own plus, FIRST rather than last. On the end of a bottom
        rail it lands in the bottom right corner, which is where the minimap
        lives, and a drop target you cannot reach is not one. */
    let slot = rail.querySelector(":scope > .dock-slot");
    if (!slot) {
      slot = document.createElement("button");
      slot.type = "button";
      slot.className = "dock-slot";
      slot.textContent = "+";
      slot.title = "drop a panel here to add it to this edge";
      wireDockTarget(slot, side);
    }
    //  Kept at the head of the rail as panels come and go.
    rail.insertBefore(slot, rail.querySelector(":scope > .panel") || null);
  }

  /*  The page keeps clear of every rail. Set on the body rather than the
      board, because the header and the minimap have to move too.

      ON TOP OF the page's own padding, not instead of it. This used to write
      the rail sizes straight in, which set a page with no rails to padding 0
      whatever its stylesheet said. So the inline values are cleared first,
      the page's own padding is read, and each rail is added to it. */
  const s = document.body.style;
  s.paddingTop = s.paddingRight = s.paddingBottom = s.paddingLeft = "";
  const own = getComputedStyle(document.body);
  const px = v => parseFloat(v) || 0;
  s.paddingTop = px(own.paddingTop) + dockSizeOf("top") + "px";
  s.paddingRight = px(own.paddingRight) + dockSizeOf("right") + "px";
  s.paddingBottom = px(own.paddingBottom) + dockSizeOf("bottom") + "px";
  s.paddingLeft = px(own.paddingLeft) + dockSizeOf("left") + "px";
}

/*  THE SPLITTER BETWEEN TWO DOCKED PANELS.

    The grip on the rail's inner edge sets how thick the edge is; this sets how
    the panels on it divide that thickness between them. Two different
    questions, two handles, and the second one was missing.

    Sizes are kept as flex-grow rather than pixels, so a rail that changes
    thickness, or a window that changes width, keeps the proportions you set
    instead of leaving one panel at a stale 340px. */
const DOCK_SHARE_MIN = 80;   // px, the narrowest a panel may be squeezed to

function dockSplit(rail, side, aId, bId) {
  const key = aId + "|" + bId;
  let node = rail.querySelector(':scope > .dock-split[data-pair="' + CSS.escape(key) + '"]');
  if (node) return node;
  node = document.createElement("div");
  node.className = "dock-split";
  node.dataset.pair = key;
  node.title = "drag to divide the space between these two";

  const across = side === "left" || side === "right";
  node.addEventListener("mousedown", ev => {
    ev.preventDefault();
    ev.stopPropagation();              // not a reorder, and not a rail resize
    const a = board.tiles.find(t => t.id === aId);
    const b = board.tiles.find(t => t.id === bId);
    const pa = document.getElementById(aId), pb = document.getElementById(bId);
    if (!a || !b || !pa || !pb) return;

    const ra = pa.getBoundingClientRect(), rb = pb.getBoundingClientRect();
    const sizeA = across ? ra.height : ra.width;
    const totalPx = sizeA + (across ? rb.height : rb.width);
    const totalGrow = (a.dockGrow || 1) + (b.dockGrow || 1);
    const from = across ? ev.clientY : ev.clientX;
    node.classList.add("live");

    const onMove = e => {
      const delta = (across ? e.clientY : e.clientX) - from;
      const newA = Math.max(DOCK_SHARE_MIN,
                            Math.min(totalPx - DOCK_SHARE_MIN, sizeA + delta));
      a.dockGrow = totalGrow * (newA / totalPx);
      b.dockGrow = totalGrow - a.dockGrow;
      //  Written straight onto the elements: a full render per mousemove would
      //  rebuild every panel body sixty times a second.
      pa.style.flexGrow = a.dockGrow;
      pb.style.flexGrow = b.dockGrow;
    };
    const onUp = () => {
      node.classList.remove("live");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      saveBoard();
      BOARD_HOOKS.resized(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
  return node;
}

/*  REORDERING WITHIN A RAIL.

    Drag a docked panel by its header and it changes places with its
    neighbours. The board's own tile drag is wired to the board element, so a
    docked header reached nothing and an edge was stuck in whatever order you
    happened to dock things in.

    The rail draws in `board.tiles` order, so reordering the rail is reordering
    that array. No positions change: a docked tile's x and y are the cell it
    goes back to, and where it sits on the edge is a separate question. */
function wireDockReorder(rail, side) {
  const across = side === "left" || side === "right";
  rail.addEventListener("mousedown", ev => {
    const panel = ev.target.closest(".panel");
    if (!panel || !ev.target.closest(".drag-handle")) return;
    ev.preventDefault();
    panel.classList.add("dock-moving");

    const tile = board.tiles.find(t => t.id === panel.id);

    const onMove = e => {
      /*  OFF THE EDGE IS ONTO THE FLOOR.

          Carry it out of the rail and the drag stops being a reorder and
          becomes the ordinary board drag: the ghost appears over the grid and
          the dock targets light up, so the same gesture can put it in a cell
          or on a different edge. Coming back inside the rail hands it back to
          the reorder. */
      const r = rail.getBoundingClientRect();
      const inside = e.clientX >= r.left && e.clientX <= r.right &&
                     e.clientY >= r.top && e.clientY <= r.bottom;

      if (!inside && tile) {
        if (!boardDrag) {
          boardDrag = { id: panel.id, w: tile.w, h: tile.h, fromTile: tile, valid: false };
          showDockTargets(true);
        }
        updateGhost(e.clientX, e.clientY);
        return;
      }
      if (inside && boardDrag) { endBoardDrag(false); ghostEl().hidden = true; }

      const over = [...rail.querySelectorAll(":scope > .panel")].find(n => {
        if (n === panel) return false;
        const b = n.getBoundingClientRect();
        return across ? (e.clientY >= b.top && e.clientY <= b.bottom)
                      : (e.clientX >= b.left && e.clientX <= b.right);
      });
      if (!over) return;
      const b = over.getBoundingClientRect();
      //  Past the middle of a neighbour is what commits the exchange, so a
      //  panel does not flicker back and forth on the boundary.
      const before = across ? e.clientY < b.top + b.height / 2
                            : e.clientX < b.left + b.width / 2;
      if (reorderDock(panel.id, over.id, before)) renderDocks();
    };
    const onUp = e => {
      panel.classList.remove("dock-moving");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (boardDrag) {
        //  A dock target may already have caught this press and undocked it,
        //  in which case boardDrag is gone and there is nothing to commit.
        const landed = boardDrag.valid;
        if (landed) {
          updateGhost(e.clientX, e.clientY);
          //  Off the edge FIRST, so the tile is back on the grid before it is
          //  asked to move within it.
          setDock(panel.id, "");
        }
        endBoardDrag(landed);
      }
      saveBoard();
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}

//  Returns whether anything actually moved, so the caller can skip a redraw.
function reorderDock(id, overId, before) {
  const from = board.tiles.findIndex(t => t.id === id);
  const to = board.tiles.findIndex(t => t.id === overId);
  if (from < 0 || to < 0 || from === to) return false;
  const want = before ? to : to + 1;
  if (want === from || want === from + 1) return false;
  const [moved] = board.tiles.splice(from, 1);
  board.tiles.splice(want > from ? want - 1 : want, 0, moved);
  return true;
}

/*  Dragging the inside edge of a rail. Written onto every tile on that edge,
    so the size belongs to the edge rather than to whichever panel happens to
    be first on it. */
function wireDockGrip(grip, side) {
  let from = 0, start = 0;
  const across = side === "left" || side === "right";
  const move = ev => {
    const now = across ? ev.clientX : ev.clientY;
    const away = (side === "left" || side === "top") ? now - from : from - now;
    const room = (across ? window.innerWidth : window.innerHeight) * DOCK_MAX;
    const size = Math.max(DOCK_MIN, Math.min(room, start + away));
    for (const t of dockedTiles(side)) t.dockSize = size;
    renderDocks();
  };
  const up = () => {
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    saveBoard();
    renderMiniMap();
    BOARD_HOOKS.resized(false);
  };
  grip.addEventListener("pointerdown", ev => {
    ev.preventDefault();
    from = across ? ev.clientX : ev.clientY;
    start = dockSizeOf(side);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
  });
}

/*  WHICH PANEL IS THE ONE YOU ARE IN.

    The pointer decides, and what has the caret decides when the pointer is
    over nothing: leave the mouse on the map while you type in the Pallet and
    the Pallet is still where you are working.

    Only ever a class. Whether it means anything is the focus switch's
    business, so the page is not computing a lighting scheme for a setting
    almost nobody has on. */
const FOCUS_KEY = BOARD_NS + "focusmode:v1";

function markActivePanel(id) {
  let want = id;
  if (!want) {
    const held = document.activeElement && document.activeElement.closest
      ? document.activeElement.closest(".panel") : null;
    want = held ? held.id : null;
  }
  for (const p of document.querySelectorAll(".panel.is-active")) {
    if (p.id !== want) p.classList.remove("is-active");
  }
  if (want) {
    const p = document.getElementById(want);
    if (p) p.classList.add("is-active");
  }
}

/*  THE MINIMAP.

    A board of twenty panels is taller than any window, so "where is the
    Gazetteer" becomes a scroll and a hunt. This is the board at about a
    fiftieth scale in the corner: every tile at its own grid position and
    footprint, which makes it a recognisable shape rather than a legend. You
    already know the Pallet is the tall one second from the left.

    Click a block to bring that panel into view. The lit outline is the part of
    the board you are actually looking at, so the map says where you are as
    well as what there is.

    Built from `board.tiles` and nothing else. It cannot drift from the layout
    because it IS the layout, read at draw time. */
function renderMiniMap() {
  let host = document.getElementById("miniMap");
  if (!host) {
    host = document.createElement("div");
    host.id = "miniMap";
    host.innerHTML = '<div class="mm-grid" data-el="grid"></div>';
    document.body.appendChild(host);
    const tip = document.createElement("div");
    tip.id = "mmTip";
    tip.hidden = true;
    document.body.appendChild(tip);
    //  Follows the scroll it is describing, cheaply: the viewport box is the
    //  only thing that moves, and it is one style write.
    window.addEventListener("scroll", () => syncMiniView(), { passive: true });
    window.addEventListener("resize", () => syncMiniView(), { passive: true });

    /*  THE FADE STARTS WHEN YOU LEAVE, NOT WHEN THE PAGE LOADS.

        `dozing` is only ever added on the way OUT, so a map nobody has touched
        is still at full strength however long the page has been open. One
        pointer in and out is what arms it.

        pointerleave rather than mouseleave, so a pen or a touch behaves the
        same way, and pointerenter to wake it rather than relying on the :hover
        rule alone — the class has to come off or it would fight the hover for
        the rest of the session. */
    host.addEventListener("pointerenter", () => host.classList.remove("dozing"));
    host.addEventListener("pointerleave", () => host.classList.add("dozing"));

    /*  AND THE OTHER WAY ROUND.

        Hovering a panel lights its block on the map, which is how you learn
        the map: you find the Gazetteer the ordinary way once and see where it
        lives in the little shape. After that you use the map.

        One delegated listener rather than one per panel, and it does nothing
        at all unless the panel under the pointer has changed, so sweeping
        across the board is a string comparison per event. */
    let lastOver = null;
    document.addEventListener("pointerover", ev => {
      const panel = ev.target.closest && ev.target.closest(".panel");
      const id = panel ? panel.id : null;
      if (id === lastOver) return;
      lastOver = id;
      for (const c of document.querySelectorAll(".mm-cell.lit")) c.classList.remove("lit");
      markActivePanel(id);
      if (!id) return;
      const cell = document.querySelector('.mm-cell[data-id="' + CSS.escape(id) + '"]');
      if (cell) cell.classList.add("lit");
    }, { passive: true });

    /*  Typing counts as being in a panel. Without this, writing in the Pallet
        with the pointer parked over the map turned the Pallet down while you
        were looking at it. */
    document.addEventListener("focusin", ev => {
      const panel = ev.target.closest && ev.target.closest(".panel");
      if (panel) markActivePanel(panel.id);
    });
  }
  const grid = host.querySelector('[data-el="grid"]');
  const tip = document.getElementById("mmTip");
  tip.hidden = true;   // the block it was naming may be gone after a redraw
  grid.innerHTML = "";
  host.hidden = board.tiles.length < 2;
  /*  Slid clear of a bottom or right rail. It is fixed to the corner and a
      rail is fixed to the same corner, so without this the map sits under the
      drawer and the one thing that is meant to be reachable is the one thing
      covered. */
  host.style.bottom = (10 + dockSizeOf("bottom")) + "px";
  host.style.right = (10 + dockSizeOf("right")) + "px";
  if (host.hidden) return;

  const rows = board.tiles.reduce((n, t) => Math.max(n, t.y + t.h), 1);
  grid.style.gridTemplateColumns = "repeat(" + board.cols + ", 1fr)";
  grid.style.gridTemplateRows = "repeat(" + rows + ", 1fr)";
  //  Taller boards get a taller map rather than squashed blocks, up to a cap.
  grid.style.height = Math.min(120, Math.max(40, rows * 13)) + "px";

  for (const t of board.tiles) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "mm-cell";
    cell.style.gridColumn = (t.x + 1) + " / span " + t.w;
    cell.style.gridRow = (t.y + 1) + " / span " + t.h;
    const label = (FOOTPRINTS[t.id] && FOOTPRINTS[t.id].name) || t.id;
    cell.setAttribute("aria-label", label);
    cell.dataset.id = t.id;
    const placeTip = e => { tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; };
    cell.onmouseenter = e => {
      tip.textContent = label;
      placeTip(e);
      tip.hidden = false;
      const node = document.getElementById(t.id);
      if (node) node.classList.add("mm-lit");
    };
    cell.onmousemove = placeTip;
    cell.onmouseleave = () => {
      tip.hidden = true;
      const node = document.getElementById(t.id);
      if (node) node.classList.remove("mm-lit");
    };
    cell.onclick = () => {
      const node = document.getElementById(t.id);
      if (!node) return;
      node.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      /*  A flash, because a smooth scroll ending on a wall of identical panels
          leaves you asking which one you asked for. */
      node.classList.add("mm-ping");
      setTimeout(() => node.classList.remove("mm-ping"), 900);
    };
    grid.appendChild(cell);
  }
  /*  Next frame, not now. This reads a rectangle per tile, and calling it
      immediately after the grid was rewritten makes the browser lay the whole
      board out again before it has finished the one it is doing. Deferred, it
      reads a settled page once. */
  requestAnimationFrame(syncMiniView);
}

/*  Which tiles are on screen, and where the window sits over the whole board.
    Measured rather than computed from scroll maths, so a sticky header or a
    board that has not finished laying out cannot put it out by a row. */
function syncMiniView() {
  const host = document.getElementById("miniMap");
  if (!host || host.hidden) return;
  const top = window.scrollY, bot = top + window.innerHeight;
  for (const cell of host.querySelectorAll(".mm-cell")) {
    const node = document.getElementById(cell.dataset.id);
    if (!node) { cell.classList.remove("here"); continue; }
    const r = node.getBoundingClientRect();
    const y0 = r.top + window.scrollY, y1 = y0 + r.height;
    cell.classList.toggle("here", y1 > top && y0 < bot);
  }
}

/*  MOVING A PANEL DOES NOT CHANGE WHAT IS IN IT.

    This used to re-render every panel body on any board change, which meant a
    drop cost about a tenth of a second: eighty of those milliseconds were
    panels redrawing content that had not altered by so much as a character.
    That is the pause you feel between letting go and the tile landing.

    Pass `{ content: false }` for a pure layout change — a move, a swap, a
    dock, a removal. The panels are re-parented, not rebuilt, so their scroll
    position and their typing survive untouched, and the two canvas panels get
    told to remeasure below because a new box is the one thing they do care
    about. */
function renderBoard(opts) {
  renderBoardCells();
  renderBoardTiles();
  renderDocks();
  renderMiniMap();
  const b = boardEl();
  const empty = b.querySelector(".board-empty");
  if (!board.tiles.length) {
    if (!empty) {
      const d = document.createElement("div");
      d.className = "board-empty";
      d.textContent = "Empty board — open Panels and drag one in.";
      b.appendChild(d);
    }
  } else if (empty) empty.remove();
  /*  An empty board makes the drawer tab the only thing worth pressing, so it
      stops being decoration and starts being a beacon. Counted off the DOM
      rather than board.tiles, because a docked panel is still on the page and
      an empty grid with a full rail is not an empty board. */
  const tab = bEl("boardFlyoutTab");
  if (tab) {
    tab.classList.toggle("empty",
      !document.querySelector(".board-tile > .panel, .dock > .panel"));
  }
  if (!opts || opts.content !== false) BOARD_HOOKS.refresh();
  /*  Canvas panels size themselves against the tile, and a ResizeObserver does
      not survive this function re-parenting them. So the board tells them
      directly — it is the only thing that reliably knows the grid moved. */
  BOARD_HOOKS.resized(true);   // canvas panels remeasure after the re-layout
}

function renderBoardCardList() {
  const list = bEl("boardCardList");
  const q = bEl("boardSearch").value.trim().toLowerCase();
  //  Copies never get a card of their own; their kind's card makes more.
  const available = Object.keys(FOOTPRINTS).filter(id =>
    !FOOTPRINTS[id].instance && !FOOTPRINTS[id].isKind && !isOnBoard(id));
  const kindIds = Object.keys(FOOTPRINTS).filter(id => FOOTPRINTS[id].isKind);
  list.innerHTML = "";
  let shown = 0;

  // Grouped by what a panel does to state, which is a fact about it, rather
  // than by the ad-hoc labels the list used before.
  //  Grouped when the page says how (Brick by Brick groups by role); one
  //  plain list otherwise.
  //  Kinds after the page's own groups, under their own headings, and always
  //  there: adding one makes another copy, so it never runs out.
  const kindGroups = [...new Set(kindIds.map(id => FOOTPRINTS[id].group))]
    .map(g => ({ kindGroup: g, title: g }));
  for (const group of [...(BOARD_HOOKS.groups() || [{ role: null, title: "" }]), ...kindGroups]) {
    const ids = group.kindGroup
      ? kindIds.filter(id => FOOTPRINTS[id].group === group.kindGroup)
      : available.filter(id => group.role === null || (FOOTPRINTS[id].role || "read") === group.role);
    const visible = q ? ids.filter(id => FOOTPRINTS[id].name.toLowerCase().includes(q)) : ids;
    if (!visible.length) continue;
    if (group.title) {
      const heading = document.createElement("h4");
      heading.className = "board-group-heading";
      heading.textContent = group.title;
      list.appendChild(heading);
    }

    for (const id of visible) {
      const fp = FOOTPRINTS[id];
      const card = document.createElement("div");
      card.className = "board-card" + (fp.isKind ? " is-kind" : "");
      card.draggable = true;
      card.dataset.id = id;
      card.innerHTML =
        '<div class="cart-label">' +
        '<div class="board-card-row">' +
          '<button type="button" class="fp-add" title="' + (fp.isKind ? "add another to the board" : "add to board") + '">+</button>' +
          '<span class="board-card-name">' + bEsc(fp.name) +
            (fp.wip ? ' <span class="wip-badge" title="work in progress: may be incomplete or change">\u{1F6A7}</span>' : "") +
          "</span>" +
        "</div>" +
        '<div class="board-card-desc">' + bEsc(fp.desc || "") + "</div>" +
        //  Size in the bottom-right corner of the label, out of the name's way.
        '<div class="cart-foot">' +
          '<span class="fp">' +
            '<input type="number" class="fp-w" min="1" max="12" step="1" value="' + fp.w + '" title="width (cells)">' +
            "<span>&times;</span>" +
            '<input type="number" class="fp-h" min="1" max="12" step="1" value="' + fp.h + '" title="height (cells)">' +
          "</span>" +
        "</div>" +
        "</div>";

      const wIn = card.querySelector(".fp-w"), hIn = card.querySelector(".fp-h");
      [wIn, hIn].forEach(i => i.addEventListener("mousedown", e => e.stopPropagation()));
      wIn.addEventListener("change", () => { fp.w = Math.max(1, Math.min(12, parseInt(wIn.value, 10) || 1)); wIn.value = fp.w; saveFootprints(); });
      hIn.addEventListener("change", () => { fp.h = Math.max(1, Math.min(12, parseInt(hIn.value, 10) || 1)); hIn.value = fp.h; saveFootprints(); });

      const add = card.querySelector(".fp-add");
      add.addEventListener("mousedown", e => e.stopPropagation());
      add.addEventListener("click", e => {
        e.stopPropagation();
        const slot = pickedSlot(fp.w, fp.h) || findFreeSlot(fp.w, fp.h);
        clearBoardPick();
        hideFootprint();
        addTile(id, slot.x, slot.y, fp.w, fp.h);
      });
      card.addEventListener("mouseenter", () => previewFootprint(fp.w, fp.h));
      card.addEventListener("mouseleave", hideFootprint);
      //  Resizing the footprint in the card updates the outline straight away.
      [wIn, hIn].forEach(i => i.addEventListener("input", () =>
        previewFootprint(Math.max(1, parseInt(wIn.value, 10) || 1), Math.max(1, parseInt(hIn.value, 10) || 1))));
      list.appendChild(card);
      shown++;
    }
  }
  if (!shown) {
    const none = document.createElement("div");
    none.className = "board-card-empty";
    none.style.cursor = "default";
    none.textContent = board.tiles.length ? "everything is on the board" : "no match";
    list.appendChild(none);
  }
}

function addTile(id, x, y, w, h) {
  const fp = FOOTPRINTS[id];
  if (!fp) return null;
  if (fp.isKind) {
    id = newInstance(fp.kind);
    if (!id) return null;
  }
  board.tiles.push({ id, x, y, w: Math.min(w || fp.w, board.cols), h: h || fp.h });
  renderBoard(); renderBoardCardList(); saveBoard();
  return id;
}

/*  The empty cell last pressed, or null. A panel added from the list goes
    there if its footprint fits with that cell as its top-left corner; a wide
    panel picked near the right edge is pulled left to stay on the grid. If it
    still does not fit, it falls back to the first free slot. */
let boardPick = null;
function pickedSlot(w, h) {
  if (!boardPick) return null;
  const cw = Math.min(w, board.cols);
  const x = Math.min(boardPick.x, board.cols - cw);
  return overlaps(null, x, boardPick.y, cw, h) ? null : { x, y: boardPick.y };
}
/*  Hovering a card in the panel list shows where + would put it, using the
    drag ghost. With a picked cell it outlines the footprint there, red if it
    does not fit; with none it outlines the first free slot. */
function previewFootprint(w, h) {
  if (boardDrag) return;
  const cw = Math.min(w, board.cols);
  let x, y, bad = false;
  if (boardPick) {
    x = Math.min(boardPick.x, board.cols - cw); y = boardPick.y;
    bad = overlaps(null, x, y, cw, h);
  } else ({ x, y } = findFreeSlot(w, h));
  const g = ghostEl();
  g.hidden = false;
  g.classList.toggle("invalid", bad);
  g.classList.remove("swap");
  g.style.gridColumn = (x + 1) + " / span " + cw;
  g.style.gridRow = (y + 1) + " / span " + h;
}
function hideFootprint() {
  if (!boardDrag) ghostEl().hidden = true;
}
function clearBoardPick() {
  boardPick = null;
  boardEl().querySelectorAll(".board-cell.picked").forEach(c => c.classList.remove("picked"));
}

function findFreeSlot(w, h) {
  const cw = Math.min(w, board.cols);
  for (let y = 0; y < 999; y++) {
    for (let x = 0; x <= board.cols - cw; x++) {
      if (!overlaps(null, x, y, cw, h)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

function moveTile(id, x, y) {
  const t = board.tiles.find(k => k.id === id);
  if (!t) return;
  t.x = x; t.y = y;
  renderBoard({ content: false }); saveBoard();
}

/* Two tiles of identical footprint exchange positions. Same size is the whole
   condition: neither can then overlap anything the other did not, so the
   exchange needs no repack and can never half-fail. */
function swapTiles(idA, idB) {
  const a = board.tiles.find(k => k.id === idA);
  const b = board.tiles.find(k => k.id === idB);
  if (!a || !b || a === b || a.w !== b.w || a.h !== b.h) return;
  const x = a.x, y = a.y;
  a.x = b.x; a.y = b.y;
  b.x = x;   b.y = y;
  renderBoard({ content: false }); saveBoard();
}

function removeTile(id) {
  board.tiles = board.tiles.filter(t => t.id !== id);
  // Park the panel rather than destroying it, so its scroll and typed text
  // survive a trip off the board.
  const panel = document.getElementById(id);
  if (panel) {
    const rm = panel.querySelector(".panel-head > .tile-remove");
    if (rm) rm.remove();
    //  A panel removed straight off a rail takes its dock furniture with it,
    //  or it comes back to the board still wearing the undock button.
    const pop = panel.querySelector(".panel-head > .dock-pop");
    if (pop) pop.remove();
    panel.classList.remove("is-docked");
    bEl("panelStore").appendChild(panel);
  }
  forgetInstance(id);        // a copy is deleted, not parked
  renderBoard({ content: false }); renderBoardCardList(); saveBoard();
}

function resetBoard() {
  board = JSON.parse(JSON.stringify(DEFAULT_BOARD));
  pruneInstances();
  renderBoard(); renderBoardCardList(); saveBoard();
}

/* ---------- drag: card -> board, and tile -> board ---------- */
let boardDrag = null;

function boardCellUnderPoint(clientX, clientY) {
  const b = boardEl();
  const r = b.getBoundingClientRect();
  const gap = parseFloat(getComputedStyle(b).columnGap) || 14;
  const cellW = (r.width - gap * (board.cols - 1)) / board.cols;
  const cellH = board.rowUnit;
  return { x: Math.floor((clientX - r.left) / (cellW + gap)),
           y: Math.floor((clientY - r.top) / (cellH + gap)) };
}

function tileAtCell(x, y) {
  return board.tiles.find(t => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h) || null;
}

function updateGhost(clientX, clientY) {
  if (!boardDrag) return;
  const { x, y } = boardCellUnderPoint(clientX, clientY);

  /*  Dragging one tile onto another of the same footprint swaps them, instead
      of being refused as an overlap. Only ever offered for a tile already on
      the board — a card from the flyout has nowhere to send the displaced tile
      back to. Different sizes still refuse: an unequal exchange would have to
      shove a third tile somewhere, and a drop should do exactly what its ghost
      showed. */
  const under = boardDrag.fromTile ? tileAtCell(x, y) : null;
  const swap = under && under !== boardDrag.fromTile &&
               under.w === boardDrag.w && under.h === boardDrag.h ? under : null;

  const cx = swap ? swap.x : Math.max(0, Math.min(board.cols - boardDrag.w, x));
  const cy = swap ? swap.y : Math.max(0, y);
  const bad = !swap &&
              (x < 0 || x > board.cols - boardDrag.w || y < 0 ||
               overlaps(boardDrag.fromTile || null, cx, cy, boardDrag.w, boardDrag.h));
  const g = ghostEl();
  g.hidden = false;
  g.classList.toggle("invalid", bad);
  g.classList.toggle("swap", !!swap);
  g.style.gridColumn = (cx + 1) + " / span " + boardDrag.w;
  g.style.gridRow = (cy + 1) + " / span " + boardDrag.h;
  // The ghost marks where the dragged tile lands; the outline marks the tile
  // being sent the other way, so both halves of the exchange are visible.
  boardEl().querySelectorAll(".board-tile.swap-target")
    .forEach(n => n.classList.remove("swap-target"));
  if (swap) {
    const node = boardEl().querySelector('.board-tile[data-id="' + swap.id + '"]');
    if (node) node.classList.add("swap-target");
  }
  boardDrag.valid = !bad; boardDrag.cx = cx; boardDrag.cy = cy;
  boardDrag.swapWith = swap ? swap.id : null;
}

/*  DROP TARGETS FOR THE EDGES.

    A plus sign at each edge of the window, and one on the end of every rail
    that already has something in it. Drag a panel onto a plus and it docks
    there; a rail's own plus is how a second panel joins it, so an edge can
    hold as many as you like.

    Only visible while you are dragging a panel. Four permanent crosses around
    the window would be four things in the way of a page you are reading. */
function dockTargets() {
  let host = document.getElementById("dockTargets");
  if (!host) {
    host = document.createElement("div");
    host.id = "dockTargets";
    for (const side of DOCK_SIDES) {
      const t = document.createElement("button");
      t.type = "button";
      t.className = "dock-target dock-target-" + side;
      t.dataset.side = side;
      t.textContent = "+";
      t.title = "dock to the " + side;
      wireDockTarget(t, side);
      host.appendChild(t);
    }
    document.body.appendChild(host);
  }
  //  Clear of any rail already on that edge, so the plus for the bottom is
  //  never hidden behind the bottom rail.
  for (const t of host.children) {
    const side = t.dataset.side;
    const off = dockSizeOf(side) + 8;
    if (side === "left" || side === "right") t.style[side] = off + "px";
    else t.style[side] = off + "px";
  }
  return host;
}

/*  Both drags end here. The flyout uses HTML5 drag and drop and a tile already
    on the board is moved with plain mouse events, so a target has to answer to
    either one. */
function wireDockTarget(node, side) {
  const take = () => {
    if (!boardDrag) return false;
    const id = boardDrag.id;
    const known = board.tiles.some(t => t.id === id);
    //  Dragged in from the flyout: it has to be on the board before it can be
    //  docked, and it keeps that cell for when it is undocked again.
    let placed = id;
    if (!known) {
      const fp = FOOTPRINTS[id] || { w: 1, h: 1 };
      const slot = findFreeSlot(fp.w, fp.h);
      placed = addTile(id, slot.x, slot.y, fp.w, fp.h) || id;
    }
    boardDrag = null;
    setDock(placed, side);
    return true;
  };
  node.addEventListener("dragover", e => {
    if (!boardDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    node.classList.add("over");
  });
  node.addEventListener("dragleave", () => node.classList.remove("over"));
  node.addEventListener("drop", e => {
    e.preventDefault();
    node.classList.remove("over");
    if (take()) endBoardDrag(false);
  });
  //  The mouse drag: the pointer is down the whole way, so a plain mouseup on
  //  the target is the drop.
  node.addEventListener("mouseenter", () => { if (boardDrag) node.classList.add("over"); });
  node.addEventListener("mouseleave", () => node.classList.remove("over"));
  node.addEventListener("mouseup", () => {
    node.classList.remove("over");
    if (take()) endBoardDrag(false);
  });
}

function showDockTargets(on) {
  dockTargets().classList.toggle("live", !!on);
  document.body.classList.toggle("panel-dragging", !!on);
}

function endBoardDrag(commit) {
  showDockTargets(false);
  if (boardDrag && commit && boardDrag.valid) {
    if (boardDrag.swapWith) swapTiles(boardDrag.id, boardDrag.swapWith);
    else if (boardDrag.fromTile) moveTile(boardDrag.id, boardDrag.cx, boardDrag.cy);
    else addTile(boardDrag.id, boardDrag.cx, boardDrag.cy, boardDrag.w, boardDrag.h);
  }
  ghostEl().hidden = true;
  document.querySelectorAll(".board-card.dragging, .board-tile.dragging, .board-tile.swap-target")
    .forEach(n => n.classList.remove("dragging", "swap-target"));
  boardDrag = null;
}


/* --------------------------------------------------------------------------
   WIRING — the controls the board owns: the 🧰 tab (press, drag, glow), the
   panel list (close, search, reset, columns, row height), dragging cards and
   tiles, and the focus switch if the page has one (#spotlight).

   A function rather than code that runs on load, because it reaches for the
   page's bEl() and elements, which exist only once the page's own script has
   run. The page calls it once, at the end of starting up.
   -------------------------------------------------------------------------- */
const TAB_GLOW_KEY = BOARD_NS + "toolboxglow:v1";
const TAB_POS_KEY = BOARD_NS + "toolboxpos:v1";
const TAB_DRAG = { moved: false };

function wireBoard() {
  /*  Focus mode, remembered. A view preference that resets on every reload is a
      view preference nobody keeps using. */
  /*  Listened for on the document, not on the box: the switch can live in a
      panel, which is built and rebuilt (↻) long after this runs. Any checkbox
      with id "spotlight", whenever it exists, drives it; the body class is the
      state, and a rebuilt box reads it back from there. */
  {
    let on = false;
    try { on = localStorage.getItem(FOCUS_KEY) === "1"; } catch (e) { on = false; }
    const apply = () => {
      document.body.classList.toggle("spotlight", on);
      const box = bEl("spotlight");
      if (box) box.checked = on;
      //  Something has to be lit the moment it comes on, or every panel is dark
      //  until the pointer moves.
      if (on) markActivePanel(null);
    };
    document.addEventListener("change", e => {
      if (!e.target || e.target.id !== "spotlight") return;
      on = e.target.checked;
      try { localStorage.setItem(FOCUS_KEY, on ? "1" : "0"); } catch (err) { /* unavailable */ }
      apply();
    });
    apply();
  }

  //  Opening from the tab has no cell behind it, and closing forgets any cell picked.
  bEl("boardFlyoutTab").addEventListener("click", () => {
    if (TAB_DRAG.moved) { TAB_DRAG.moved = false; return; }   // that was a drag, not a press
    clearBoardPick();
    bEl("boardFlyoutWrap").classList.toggle("open");
  });

  /*  THE 🧰 TAB SLIDES UP AND DOWN ITS EDGE.

      Drag it to wherever on the right edge suits you; a press without moving
      still opens the list. Kept as a share of the window's height, so it stays
      in the same place relative to the window when the window changes size,
      and remembered between visits. Only up and down: the drawer it opens
      slides in from this edge, so the tab stays on it. */
  /*  THE GLOW, SWITCHED OFF BY A DOT ON THE TAB ITSELF.

      The green ring is a call to action, and once you know where the tab is it
      has made its point. A small dot in the tab's corner turns it off and on;
      remembered. It stops its own press so it neither opens the drawer nor
      starts a drag. */
  (function () {
    const tab = bEl("boardFlyoutTab");
    const dot = document.createElement("span");
    dot.className = "tab-glow-dot";
    tab.appendChild(dot);
    let off = false;
    try { off = localStorage.getItem(TAB_GLOW_KEY) === "off"; } catch (e) {}
    const sync = () => {
      tab.classList.toggle("quiet", off);
      dot.title = off ? "turn the glow back on" : "turn the glow off";
    };
    sync();
    dot.addEventListener("pointerdown", e => e.stopPropagation());
    dot.addEventListener("click", e => {
      e.stopPropagation();
      off = !off;
      try { off ? localStorage.setItem(TAB_GLOW_KEY, "off") : localStorage.removeItem(TAB_GLOW_KEY); } catch (err) {}
      sync();
    });
  })();

  (function () {
    const tab = bEl("boardFlyoutTab");
    const place = frac => {
      const h = tab.offsetHeight || 36, H = window.innerHeight;
      const y = Math.max(h / 2 + 6, Math.min(H - h / 2 - 6, frac * H));
      tab.style.top = y + "px";
    };
    let frac = 0.5;
    try { const v = parseFloat(localStorage.getItem(TAB_POS_KEY)); if (v >= 0 && v <= 1) frac = v; } catch (e) {}
    place(frac);
    window.addEventListener("resize", () => place(frac), { passive: true });

    tab.addEventListener("pointerdown", e => {
      if (e.button !== 0) return;
      const startY = e.clientY;
      TAB_DRAG.moved = false;
      tab.setPointerCapture(e.pointerId);
      const move = ev => {
        if (!TAB_DRAG.moved && Math.abs(ev.clientY - startY) < 4) return;   // still a press
        TAB_DRAG.moved = true;
        tab.classList.add("dragging");
        frac = ev.clientY / window.innerHeight;
        place(frac);
      };
      const up = () => {
        tab.removeEventListener("pointermove", move);
        tab.removeEventListener("pointerup", up);
        tab.removeEventListener("pointercancel", up);
        tab.classList.remove("dragging");
        if (TAB_DRAG.moved) {
          try { localStorage.setItem(TAB_POS_KEY, String(frac)); } catch (e) {}
        }
      };
      tab.addEventListener("pointermove", move);
      tab.addEventListener("pointerup", up);
      tab.addEventListener("pointercancel", up);
    });
  })();
  bEl("boardFlyoutClose").addEventListener("click", () => {
    clearBoardPick();
    bEl("boardFlyoutWrap").classList.remove("open");
  });
  bEl("boardSearch").addEventListener("input", renderBoardCardList);
  bEl("boardReset").addEventListener("click", resetBoard);

  bEl("boardCols").addEventListener("change", e => {
    const cols = Math.max(1, Math.min(12, Math.round(Number(e.target.value)) || 4));
    e.target.value = cols;
    if (cols !== board.cols) { board.cols = cols; repackForCols(cols); renderBoard({ content: false }); saveBoard(); }
  });
  bEl("boardRowUnit").addEventListener("change", e => {
    const px = Math.max(80, Math.min(600, Math.round(Number(e.target.value)) || 220));
    e.target.value = px;
    board.rowUnit = px;
    renderBoard({ content: false }); saveBoard();
  });

  /* ---------- drag wiring ---------- */
  bEl("boardCardList").addEventListener("dragstart", e => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "BUTTON") { e.preventDefault(); return; }
    const card = e.target.closest(".board-card[draggable]");
    if (!card) return;
    const fp = FOOTPRINTS[card.dataset.id];
    if (!fp) return;
    card.classList.add("dragging");
    boardDrag = { id: card.dataset.id, w: Math.min(fp.w, board.cols), h: fp.h, fromTile: null, valid: false };
    showDockTargets(true);
    e.dataTransfer.effectAllowed = "copy";
    // Firefox needs data set to fire subsequent drag events at all.
    e.dataTransfer.setData("text/plain", card.dataset.id);
  });
  bEl("boardCardList").addEventListener("dragend", () => endBoardDrag(false));

  boardEl().addEventListener("dragover", e => {
    if (!boardDrag) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = boardDrag.fromTile ? "move" : "copy";
    updateGhost(e.clientX, e.clientY);
  });
  boardEl().addEventListener("drop", e => {
    if (!boardDrag) return;
    e.preventDefault();
    endBoardDrag(true);
  });

  // Repositioning a tile already on the board — grabbed by its ✥ handle only,
  // so the rest of the header (and anything under it) stays clickable.
  boardEl().addEventListener("mousedown", e => {
    const head = e.target.closest(".drag-handle");
    const tile = e.target.closest(".board-tile");
    if (!head || !tile) return;
    const t = board.tiles.find(k => k.id === tile.dataset.id);
    if (!t) return;
    //  A drag, not a text selection: without this the browser starts
    //  selecting every word the pointer crosses on its way to the new cell.
    e.preventDefault();
    const sel = window.getSelection && window.getSelection();
    if (sel) sel.removeAllRanges();
    tile.classList.add("dragging");
    boardDrag = { id: t.id, w: t.w, h: t.h, fromTile: t, valid: false };
    showDockTargets(true);
    const onMove = ev => updateGhost(ev.clientX, ev.clientY);
    const onUp = ev => {
      updateGhost(ev.clientX, ev.clientY);
      endBoardDrag(true);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });
}
