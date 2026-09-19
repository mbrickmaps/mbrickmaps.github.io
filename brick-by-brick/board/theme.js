/*  THEME — a Theme panel for any page on the board.

    Load after board.js (it uses BOARD_NS and bEsc):

      <link rel="stylesheet" href="theme.css">
      <script src="theme.js"></script>

    then, before startBoard():

      loadSavedThemes(); loadTheme(); applyTheme();
      registerPanel({ id: "theme", title: "Theme", w: 1, h: 2,
                      render(body) { renderTheme(body); } });

    It sets the page's colour variables (--bg, --panel, --field, --fg,
    --border, --accent, --accent2, --draft) on <html>, so everything styled
    with them follows. Saved under BOARD_NS + "theme:v1" and "themes:v1". */
const THEME_KEY = BOARD_NS + "theme:v1";     // the one in use
const THEMES_KEY = BOARD_NS + "themes:v1";   // the ones you saved

/* --------------------------------------------------------------------------
   THEMES
   --------------------------------------------------------------------------
   Eight colors and a light/dark flag. Everything else on the page is written
   in terms of these, and the "on" washes are mixed from --accent/--accent2 at
   render time, so a theme never has to name a tint and never has one drift out
   of step with the color it belongs to.

   `color-scheme` is not decoration: without it the browser paints native
   controls — checkboxes, sliders, scrollbars, the color picker itself — for
   the wrong side, which is what made the Brick Builder fields white.

   Not covered here: the basemap. Its colors are cartography, not chrome, and
   they live in the Map Style panel where they belong.
   -------------------------------------------------------------------------- */
/*  Each token says what it paints, in the words of the thing on screen rather
    than the word in the stylesheet — "Behind the panels" is checkable by
    looking, "--bg" is not. */
const THEME_TOKENS = [
  { key: "bg",      label: "Board",    hint: "behind the panels" },
  { key: "panel",   label: "Panels",   hint: "the tiles themselves" },
  { key: "field",   label: "Inputs",   hint: "text boxes, lists, buttons" },
  { key: "fg",      label: "Text",     hint: "every word on the page" },
  { key: "border",  label: "Edges",    hint: "panel outlines and rules" },
  { key: "accent",  label: "Verified", hint: "+ bricks, confirmed markers" },
  { key: "accent2", label: "Active",   hint: "hover, focus, what is switched on" },
  { key: "draft",   label: "Draft",    hint: "− bricks, unconfirmed things" },
];

const THEMES = [
  { id: "night", name: "Night", scheme: "dark", tokens: {
      bg: "#111111", panel: "#1a1a1a", field: "#0d0d0d", fg: "#eeeeee",
      border: "#333333", accent: "#ff5500", accent2: "#33ff33", draft: "#7a8a99" } },
  { id: "blueprint", name: "Blueprint", scheme: "dark", tokens: {
      bg: "#0a1c33", panel: "#102844", field: "#08172a", fg: "#dce9fb",
      border: "#1e3d66", accent: "#ffb703", accent2: "#7fdbff", draft: "#6f8bb0" } },
  // Dark, but warm rather than blue — the tobacco-and-lamplight end of an old
  // map room. Easier on the eye than Night for a long session.
  { id: "vellum", name: "Vellum", scheme: "dark", tokens: {
      bg: "#171310", panel: "#211b16", field: "#120e0b", fg: "#e8ddcb",
      border: "#3a2f25", accent: "#e07b39", accent2: "#c9a227", draft: "#8c7c66" } },
  // Near-black with a green cast: a phosphor terminal, which is where this
  // notation's ancestors were actually typed.
  { id: "phosphor", name: "Phosphor", scheme: "dark", tokens: {
      bg: "#0a0f0b", panel: "#111a13", field: "#070c08", fg: "#cfe8d4",
      border: "#23342a", accent: "#ff7a1a", accent2: "#3ddc72", draft: "#6f8d7a" } },
  // Cold and low-contrast, the quietest of the set — for when even Night's
  // pure black feels like a hole in the screen.
  { id: "slate", name: "Slate", scheme: "dark", tokens: {
      bg: "#14181d", panel: "#1c2229", field: "#0f1317", fg: "#dbe2ea",
      border: "#2c353f", accent: "#f0883e", accent2: "#58c8b0", draft: "#7d8a99" } },
  // Deep aubergine — the same value range as Night, a different temperature.
  { id: "plum", name: "Plum", scheme: "dark", tokens: {
      bg: "#150f1a", panel: "#1f1727", field: "#100b14", fg: "#e6dcf0",
      border: "#332844", accent: "#ff6b9d", accent2: "#a78bfa", draft: "#8b7fa0" } },
  /*  THE PAGE AS A WALL.

      The panels are the bricks and the board behind them is the mortar, which
      makes the edges the pointing: a panel outline is the joint between two
      bricks, so `border` is the lightest thing in the theme rather than the
      quietest. It is the one theme here where the token names describe a real
      object.

      Sooted London mortar rather than fresh lime, because a page of light grey
      behind red panels is a page you cannot read a header on: `fg` is one
      colour for every word, including the ones sitting on the board itself.
      Dark mortar keeps both legible and keeps the set consistently dark.

      Verified is a yellow stock brick and Active a weathered copper, neither
      of which an orange wall can swallow. */
  { id: "brick", name: "Brick", scheme: "dark", tokens: {
      bg: "#33302c", panel: "#7d3a28", field: "#5a2a1d", fg: "#f7ece6",
      border: "#a89c8c", accent: "#f0b429", accent2: "#57cfbe", draft: "#c9b6a8" } },
];

/*  Themes you have saved. Kept apart from the built-in ones: those are code
    and improve when the code does, these are yours and must never be rewritten
    by a later version of this page. */
let SAVED_THEMES = [];

/*  THE TEXT CURSOR: the thin bar, a block, or an underscore, in every text
    box and text area on the page. Kept apart from the colors, so choosing a
    theme does not change it. Uses CSS caret-shape; where a browser does not
    have it, text boxes keep the bar. */
const CARET_KEY = BOARD_NS + "caret:v1";
const CARETS = [
  { id: "bar",        glyph: "|",       title: "a thin bar (the usual)" },
  { id: "block",      glyph: "\u2588", title: "a block, like a terminal" },
  { id: "underscore", glyph: "_",       title: "an underscore" },
];
let CARET = "bar";
try { const c = localStorage.getItem(CARET_KEY); if (CARETS.some(k => k.id === c)) CARET = c; } catch (e) { /* unavailable */ }
function setCaret(id) {
  if (!CARETS.some(k => k.id === id)) return;
  CARET = id;
  document.documentElement.dataset.caret = id;
  try { if (id === "bar") localStorage.removeItem(CARET_KEY); else localStorage.setItem(CARET_KEY, id); }
  catch (e) { /* unavailable */ }
}

let THEME_ID = "night";
let THEME = Object.assign({}, THEMES[0].tokens);

// Saved themes answer to the same lookup as the built-in ones, so everything
// downstream — applying, marking the active one, restoring on load — is
// written once and does not care where a theme came from.
function themeById(id) {
  return THEMES.find(t => t.id === id) || SAVED_THEMES.find(t => t.id === id) || null;
}

function loadSavedThemes() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(THEMES_KEY) || "null"); } catch (e) { return; }
  if (!Array.isArray(raw)) return;
  SAVED_THEMES = raw
    .filter(t => t && t.name && t.tokens && !THEMES.some(b => b.id === t.id))
    .map(t => {
      const tokens = Object.assign({}, THEMES[0].tokens);
      for (const k of THEME_TOKENS) {
        if (/^#[0-9a-f]{6}$/i.test(t.tokens[k.key])) tokens[k.key] = t.tokens[k.key];
      }
      return { id: String(t.id), name: String(t.name), saved: true,
               scheme: isLight(tokens.bg) ? "light" : "dark", tokens };
    });
}
function saveSavedThemes() {
  try { localStorage.setItem(THEMES_KEY, JSON.stringify(SAVED_THEMES)); }
  catch (e) { /* unavailable */ }
}

/*  Written as inline properties on <html>, which outrank the :root block in
    the stylesheet. That keeps the stylesheet as the honest default — open the
    file with an empty localStorage and you get Night, exactly as written. */
function applyTheme() {
  const root = document.documentElement;
  for (const t of THEME_TOKENS) root.style.setProperty("--" + t.key, THEME[t.key]);
  const preset = themeById(THEME_ID);
  root.style.colorScheme = preset ? preset.scheme : (isLight(THEME.bg) ? "light" : "dark");
  root.dataset.caret = CARET;
}

// Perceived lightness, so a custom ground picks its own light/dark side rather
// than making you tell it. sRGB luma is close enough for a yes/no.
function isLight(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 140;
}

function saveTheme() {
  try { localStorage.setItem(THEME_KEY, JSON.stringify({ id: THEME_ID, tokens: THEME })); }
  catch (e) { /* unavailable */ }
}
function loadTheme() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(THEME_KEY) || "null"); } catch (e) { return; }
  if (!raw || typeof raw !== "object") return;
  const preset = themeById(raw.id);
  // A named preset is re-read from the code, not from storage: editing a
  // preset here should reach anyone who picked it, rather than being frozen at
  // whatever it looked like the day they chose it.
  if (preset && raw.id !== "custom") {
    THEME_ID = preset.id;
    THEME = Object.assign({}, preset.tokens);
    return;
  }
  if (raw.tokens && typeof raw.tokens === "object") {
    THEME_ID = "custom";
    for (const t of THEME_TOKENS) {
      const v = raw.tokens[t.key];
      if (/^#[0-9a-f]{6}$/i.test(v)) THEME[t.key] = v;
    }
  }
}

function renderTheme(body) {
  /*  Built here rather than from a <template>, so a page only needs this file
      and theme.css to have the panel. */
  if (!body.querySelector('[data-el="presets"]')) {
    body.innerHTML =
      '<div class="th-presets" data-el="presets"></div>' +
      '<div class="th-rows" data-el="rows"></div>' +
      '<div class="th-caret" data-el="caret"><span>Cursor</span>' +
        CARETS.map(k => '<button type="button" data-caret="' + k.id + '" title="' +
          bEsc(k.title) + '">' + k.glyph + "</button>").join("") +
        //  A picture of the cursor, not a box to type in.
        '<span class="th-caret-demo" aria-hidden="true">text<i></i></span>' +
      "</div>" +
      '<div class="row th-bar">' +
        '<input type="text" data-el="name" placeholder="save as…" spellcheck="false">' +
        '<button data-act="save" title="keep these colors under a name">Save</button>' +
        '<button data-act="reset" title="back to Night, the theme this page ships with">Reset</button>' +
      "</div>" +
      //  Saved themes live in this browser, for this page. A file carries them
      //  to another browser, or between Brick by Brick and the board demo.
      '<div class="row th-bar">' +
        '<button data-act="export" title="download your saved themes as a file">Export</button>' +
        '<button data-act="import" title="add themes from a file you exported">Import…</button>' +
        '<input type="file" data-el="file" accept=".json,application/json" hidden>' +
      "</div>" +
      '<p class="hint" data-el="msg"></p>';
  }
  const presets = body.querySelector('[data-el="presets"]');
  const rows = body.querySelector('[data-el="rows"]');
  const msg = body.querySelector('[data-el="msg"]');

  const name = body.querySelector('[data-el="name"]');

  const chip = t =>
    '<span class="th-chip" style="background:' + t.tokens.bg +
      ';border-color:' + t.tokens.border + '">' +
      '<i style="background:' + t.tokens.accent + '"></i>' +
      '<i style="background:' + t.tokens.accent2 + '"></i>' +
    "</span>";

  // Saved themes sit in the same strip as the built-in ones, and carry a ×
  // because they are the only ones you can delete.
  const renderPresets = () => {
    presets.innerHTML =
      THEMES.map(t => '<button data-theme="' + t.id + '">' + chip(t) + bEsc(t.name) + "</button>").join("") +
      SAVED_THEMES.map(t =>
        '<span class="th-item">' +
          '<button data-theme="' + bEsc(t.id) + '">' + chip(t) + bEsc(t.name) + "</button>" +
          '<button class="th-del" data-del="' + bEsc(t.id) + '">&times;</button>' +
        "</span>").join("");
  };

  const paint = () => {
    presets.querySelectorAll("button[data-theme]").forEach(b => {
      b.classList.toggle("on", b.dataset.theme === THEME_ID);
    });
    rows.querySelectorAll('input[type="color"]').forEach(i => { i.value = THEME[i.dataset.k]; });
    body.querySelectorAll("button[data-caret]").forEach(b => {
      b.classList.toggle("on", b.dataset.caret === CARET);
    });
    const cur = themeById(THEME_ID);
    msg.textContent = cur
      ? cur.name + " — edit any swatch to make it yours."
      : "Unsaved — give it a name to keep it.";
  };

  if (body._wired) { renderPresets(); paint(); return; }
  body._wired = true;

  renderPresets();

  rows.innerHTML = THEME_TOKENS.map(t =>
    '<div class="th-row">' +
      '<input type="color" data-k="' + t.key + '" value="' + THEME[t.key] + '">' +
      '<span class="th-label"><b>' + bEsc(t.label) + "</b>" +
        '<em>' + bEsc(t.hint) + "</em></span>" +
    "</div>").join("");

  body.querySelector('[data-el="caret"]').addEventListener("click", e => {
    const b = e.target.closest("button[data-caret]");
    if (!b) return;
    setCaret(b.dataset.caret);
    paint();
  });

  presets.addEventListener("click", e => {
    const del = e.target.closest("button[data-del]");
    if (del) {
      SAVED_THEMES = SAVED_THEMES.filter(t => t.id !== del.dataset.del);
      saveSavedThemes();
      // Deleting the theme you are wearing leaves the colors on screen
      // untouched — they simply stop having a name. Nothing should change
      // appearance because you tidied a list.
      if (THEME_ID === del.dataset.del) { THEME_ID = "custom"; saveTheme(); }
      renderPresets(); paint();
      return;
    }
    const b = e.target.closest("button[data-theme]");
    if (!b) return;
    const preset = themeById(b.dataset.theme);
    if (!preset) return;
    THEME_ID = preset.id;
    THEME = Object.assign({}, preset.tokens);
    applyTheme(); saveTheme(); paint();
  });

  // Editing any swatch makes it yours — the preset it started from is a
  // starting point, not a thing you have to leave first.
  rows.addEventListener("input", e => {
    const i = e.target.closest('input[type="color"]');
    if (!i) return;
    THEME[i.dataset.k] = i.value;
    THEME_ID = "custom";
    applyTheme(); saveTheme(); paint();
  });

  const doSave = () => {
    const label = name.value.trim();
    if (!label) { msg.textContent = "Give it a name first."; name.focus(); return; }
    if (THEMES.some(t => t.name.toLowerCase() === label.toLowerCase())) {
      msg.textContent = "“" + label + "” is a built-in theme — pick another name.";
      return;
    }
    /*  Saving the same name twice updates that theme rather than making a
        second one with the same label, the same rule the Gazetteer's Add row
        follows. A list where two rows read alike and behave differently is
        worse than no list. */
    const existing = SAVED_THEMES.find(t => t.name.toLowerCase() === label.toLowerCase());
    const tokens = Object.assign({}, THEME);
    if (existing) {
      existing.tokens = tokens;
      existing.scheme = isLight(tokens.bg) ? "light" : "dark";
      THEME_ID = existing.id;
    } else {
      const id = "saved-" + Date.now().toString(36);
      SAVED_THEMES.push({ id, name: label, saved: true,
                          scheme: isLight(tokens.bg) ? "light" : "dark", tokens });
      THEME_ID = id;
    }
    saveSavedThemes(); saveTheme();
    name.value = "";
    renderPresets(); paint();
  };

  body.querySelector('button[data-act="save"]').onclick = doSave;
  name.addEventListener("keydown", e => { if (e.key === "Enter") doSave(); });

  /*  EXPORT: every saved theme, or the colors on screen when nothing is saved
      yet, so the button always gives you something. */
  body.querySelector('button[data-act="export"]').onclick = () => {
    const cur = themeById(THEME_ID);
    const list = SAVED_THEMES.length
      ? SAVED_THEMES.map(t => ({ name: t.name, tokens: t.tokens }))
      : [{ name: cur ? cur.name : "My theme", tokens: Object.assign({}, THEME) }];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(
      [JSON.stringify({ kind: "board-themes", version: 1, themes: list }, null, 2)],
      { type: "application/json" }));
    a.download = "themes.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    msg.textContent = "Exported " + list.length + (list.length === 1 ? " theme." : " themes.");
  };

  /*  IMPORT: takes an exported file, a list of themes, or a single
      { name, tokens }. A name you already have is updated rather than
      doubled, the same rule as Save; a built-in name gets "(imported)" added.
      The first theme in the file is put on. */
  const file = body.querySelector('[data-el="file"]');
  body.querySelector('button[data-act="import"]').onclick = () => { file.value = ""; file.click(); };
  file.addEventListener("change", async () => {
    const f = file.files && file.files[0];
    if (!f) return;
    let data;
    try { data = JSON.parse(await f.text()); }
    catch (e) { msg.textContent = "That file is not JSON, so there are no themes in it."; return; }
    const raw = Array.isArray(data) ? data
      : Array.isArray(data && data.themes) ? data.themes
      : data && data.tokens ? [data] : [];
    let first = null, n = 0;
    for (const t of raw) {
      if (!t || typeof t.tokens !== "object") continue;
      const tokens = Object.assign({}, THEMES[0].tokens);
      let any = false;
      for (const k of THEME_TOKENS) {
        if (/^#[0-9a-f]{6}$/i.test(t.tokens[k.key])) { tokens[k.key] = t.tokens[k.key]; any = true; }
      }
      if (!any) continue;
      let label = String(t.name || "Imported").trim().slice(0, 40) || "Imported";
      if (THEMES.some(b => b.name.toLowerCase() === label.toLowerCase())) label += " (imported)";
      const scheme = isLight(tokens.bg) ? "light" : "dark";
      let got = SAVED_THEMES.find(s => s.name.toLowerCase() === label.toLowerCase());
      if (got) { got.tokens = tokens; got.scheme = scheme; }
      else {
        got = { id: "saved-" + Date.now().toString(36) + "-" + n, name: label, saved: true, scheme, tokens };
        SAVED_THEMES.push(got);
      }
      if (!first) first = got;
      n++;
    }
    if (!first) { msg.textContent = "No themes found in that file."; return; }
    saveSavedThemes();
    THEME_ID = first.id;
    THEME = Object.assign({}, first.tokens);
    applyTheme(); saveTheme();
    renderPresets(); paint();
    msg.textContent = "Imported " + n + (n === 1 ? " theme" : " themes") + "; wearing " + first.name + ".";
  });

  body.querySelector('button[data-act="reset"]').onclick = () => {
    THEME_ID = "night";
    THEME = Object.assign({}, THEMES[0].tokens);
    applyTheme(); saveTheme(); paint();
  };

  paint();
}
