/*  FONTS — picking a typeface, with every name shown in its own face.

    Load after board.js. It gives the ⚙ deck the "font" field type: a button
    showing the current face, and a list you can search that holds

      • the fonts on this computer (the browser hands them over after a press,
        in browsers that have the API), and
      • all of Google Fonts, fetched as a list and previewed a name at a time.

    A Google font you choose is remembered under BOARD_NS + "fonts:v1" and
    loaded again on your next visit, so a panel that uses one still has it.

    The same file serves any kind: give a setting { type: "font" }. */

const BOARD_FONTS_KEY = BOARD_NS + "fonts:v1";
let BOARD_GFONTS = [];                 // Google families in use on this page

/*  A family from Google, loaded for real. Its stylesheet is added once; the
    promise says whether the face actually arrived. */
const BOARD_GFONT_LOADING = new Map();
function boardLoadGoogleFont(family) {
  if (BOARD_GFONT_LOADING.has(family)) return BOARD_GFONT_LOADING.get(family);
  const p = new Promise(resolve => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") + "&display=swap";
    link.onload = () => document.fonts.load('16px "' + family + '"')
      .then(faces => resolve(faces.length > 0), () => resolve(false));
    link.onerror = () => { link.remove(); resolve(false); };
    document.head.appendChild(link);
  });
  BOARD_GFONT_LOADING.set(family, p);
  return p;
}
function boardRememberFont(family) {
  if (!BOARD_GFONTS.includes(family)) BOARD_GFONTS.push(family);
  try { localStorage.setItem(BOARD_FONTS_KEY, JSON.stringify(BOARD_GFONTS)); } catch (e) { /* unavailable */ }
  return boardLoadGoogleFont(family);
}
function boardLoadRememberedFonts() {
  let raw;
  try { raw = JSON.parse(localStorage.getItem(BOARD_FONTS_KEY) || "null"); } catch (e) { return; }
  if (!Array.isArray(raw)) return;
  BOARD_GFONTS = raw.filter(f => typeof f === "string");
  for (const f of BOARD_GFONTS) boardLoadGoogleFont(f);
}
boardLoadRememberedFonts();

/*  THE WHOLE OF GOOGLE FONTS, from Fontsource: Google's own list refuses to
    be read from another site, and this one says the same thing. Fetched once.
    A family's category decides what stands in for it while it loads. */
let BOARD_GFONT_LIST = null;
async function boardGoogleFonts() {
  if (BOARD_GFONT_LIST) return BOARD_GFONT_LIST;
  try {
    const r = await fetch("https://api.fontsource.org/v1/fonts");
    const generic = { serif: "serif", "sans-serif": "sans-serif", monospace: "monospace",
                      handwriting: "cursive", display: "sans-serif" };
    BOARD_GFONT_LIST = (await r.json())
      .filter(f => f.type === "google")
      .map(f => ({ family: f.family, generic: generic[f.category] || "sans-serif" }))
      .sort((a, b) => a.family.localeCompare(b.family));
  } catch (e) { return []; }           // no connection: the list stays empty
  return BOARD_GFONT_LIST;
}

/*  A PREVIEW COSTS ONLY THE LETTERS OF THE NAME. Google will send just those
    glyphs, and the cut-down face is registered under a different name so it
    can never stand in for the real one once it is chosen. */
const BOARD_PREVIEWS = new Map();
function boardPreviewFont(family) {
  if (BOARD_PREVIEWS.has(family)) return BOARD_PREVIEWS.get(family);
  const alias = "pv " + family;
  const p = fetch("https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family).replace(/%20/g, "+") + "&text=" + encodeURIComponent(family))
    .then(r => (r.ok ? r.text() : Promise.reject()))
    .then(css => {
      const st = document.createElement("style");
      st.textContent = css.split("font-family: '" + family + "'").join("font-family: '" + alias + "'");
      document.head.appendChild(st);
      return document.fonts.load("16px '" + alias + "'", family).then(() => alias);
    })
    .catch(() => null);
  BOARD_PREVIEWS.set(family, p);
  return p;
}

//  The fonts on this computer. Chrome asks the person first; anything else
//  says no, and the list simply has no "this computer" section.
let BOARD_LOCAL_FONTS = null;
async function boardLocalFonts() {
  if (BOARD_LOCAL_FONTS) return BOARD_LOCAL_FONTS;
  if (!window.queryLocalFonts) return [];
  try {
    const seen = new Set();
    for (const f of await window.queryLocalFonts()) seen.add(f.family);
    BOARD_LOCAL_FONTS = [...seen].sort((a, b) => a.localeCompare(b));
  } catch (e) { return []; }           // refused: ask again another time
  return BOARD_LOCAL_FONTS;
}

/*  A few to start from, so the list is never empty and never only Google's.
    Everything here is on the machine already. */
const BOARD_FONT_PRESETS = [
  { family: "", label: "the page's own" },
  { family: "system-ui", label: "system" },
  { family: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", label: "system mono" },
  { family: "Georgia, serif", label: "serif" },
  { family: "Arial Narrow, sans-serif", label: "narrow" },
  { family: "Rockwell, Roboto Slab, serif", label: "slab" },
  { family: "Arial Black, Impact, sans-serif", label: "heavy" },
];
//  Names worth suggesting before anybody searches.
const BOARD_FONT_SUGGEST = [
  "Bebas Neue", "Oswald", "Anton", "Press Start 2P", "VT323", "Major Mono Display",
  "Rubik Mono One", "Special Elite", "Bungee", "Monoton", "Silkscreen", "Orbitron",
];

/*  A family as CSS. A preset is already a stack of names and is used as it
    stands; a single name is quoted, because plenty have spaces in them. */
function boardFontCss(family) {
  if (!family) return "inherit";
  return family.includes(",") ? family : '"' + family.replace(/"/g, "") + '", sans-serif';
}
//  What to draw a row in: the face itself for anything already here, the
//  cut-down preview for a Google font that is not.
function boardFontRow(family, label, picked) {
  return '<button type="button" class="fontrow' + (picked ? " on" : "") +
    '" data-font="' + bEsc(family) + '" style="font-family:' + bEsc(boardFontCss(family)) + '">' +
    bEsc(label || family) + "</button>";
}

/*  THE PICKER. Opened from a font field in the deck; hands the chosen family
    back through onPick. */
function boardFontPicker(host, current, onPick) {
  const box = document.createElement("div");
  box.className = "fontpick";
  box.innerHTML =
    '<input type="search" class="fontpick-q" placeholder="search fonts…" spellcheck="false">' +
    '<div class="fontpick-list"></div>';
  host.appendChild(box);
  const q = box.querySelector(".fontpick-q"), list = box.querySelector(".fontpick-list");

  const section = (title, html) => html
    ? '<div class="fontpick-sec">' + bEsc(title) + "</div>" + html : "";
  //  Google rows are previewed as they are drawn: each is a few kilobytes.
  const previewRows = fams => {
    for (const f of fams) {
      boardPreviewFont(f).then(alias => {
        if (!alias) return;
        const el = list.querySelector('.fontrow[data-font="' + CSS.escape(f) + '"]');
        if (el) el.style.fontFamily = '"' + alias + '", sans-serif';
      });
    }
  };

  const draw = async () => {
    const term = q.value.trim().toLowerCase();
    if (!term) {
      const locals = BOARD_LOCAL_FONTS || [];
      list.innerHTML =
        section("presets", BOARD_FONT_PRESETS.map(p =>
          boardFontRow(p.family, p.label, p.family === current)).join("")) +
        (window.queryLocalFonts && !locals.length
          ? '<button type="button" class="fontpick-local">list this computer’s fonts</button>' : "") +
        section("this computer", locals.slice(0, 40).map(f =>
          boardFontRow(f, f, f === current)).join("")) +
        section("google fonts", BOARD_FONT_SUGGEST.map(f =>
          boardFontRow(f, f, f === current)).join(""));
      previewRows(BOARD_FONT_SUGGEST);
      return;
    }
    const locals = (BOARD_LOCAL_FONTS || []).filter(f => f.toLowerCase().includes(term)).slice(0, 25);
    const google = (await boardGoogleFonts()).filter(f => f.family.toLowerCase().includes(term)).slice(0, 25);
    list.innerHTML =
      section("this computer", locals.map(f => boardFontRow(f, f, f === current)).join("")) +
      section("google fonts", google.map(f => boardFontRow(f.family, f.family, f.family === current)).join("")) +
      (locals.length || google.length ? "" : '<div class="fontpick-none">nothing by that name</div>');
    previewRows(google.map(f => f.family));
  };

  q.addEventListener("input", draw);
  q.addEventListener("keydown", e => {
    if (e.key === "Escape") { e.stopPropagation(); box.remove(); }
    if (e.key === "Enter") {
      e.preventDefault();
      const first = list.querySelector(".fontrow");
      if (first) first.click();
    }
  });
  box.addEventListener("click", async e => {
    const local = e.target.closest(".fontpick-local");
    if (local) { local.textContent = "asking…"; await boardLocalFonts(); draw(); return; }
    const row = e.target.closest(".fontrow");
    if (!row) return;
    const family = row.dataset.font;
    //  A Google font has to be fetched in full before it can be used, and
    //  remembered so it is there on the next visit.
    const known = BOARD_FONT_PRESETS.some(p => p.family === family) ||
      (BOARD_LOCAL_FONTS || []).includes(family);
    if (family && !known) await boardRememberFont(family);
    onPick(family);
    box.remove();
  });
  q.focus();
  draw();
  return box;
}
