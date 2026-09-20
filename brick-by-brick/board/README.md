# Board

A grid of panels for a web page. Each panel is a box with its own content. People can add panels to the grid, move them, resize them, dock them to an edge of the window, cover them, rebuild them and put them away. The layout is saved in the browser.

Two files, no build step, no dependencies:

- `board.js`: the behaviour
- `board.css`: the look

[`demo.html`](demo.html) is a complete working page with five small panels. [Brick by Brick](../index.html) is the large example: every panel on it is a board panel.

---

## Quick start

```html
<link rel="stylesheet" href="board/board.css">

<!-- the markup the board looks for: see "Markup" below -->
<div id="board"></div>
<div id="boardFlyoutWrap"> … </div>
<div id="panelStore" hidden></div>

<script>window.BOARD_NS = "my-page:";</script>   <!-- before board.js -->
<script src="board/board.js"></script>
<script>
  registerPanel({
    id: "hello", title: "Hello", w: 1, h: 1,
    help: "Says hello.",
    render(body) { body.textContent = "Hello."; },
  });

  setDefaultBoard({ cols: 3, rowUnit: 200, tiles: [
    { id: "hello", x: 0, y: 0, w: 1, h: 1 },
  ]});

  startBoard();
</script>
```

The order matters: set `BOARD_NS`, load `board.js`, register the panels, set the default layout, then call `startBoard()`.

---

## What a panel is

A panel is one call to `registerPanel()`:

```js
let seconds = 0;
registerPanel({
  id: "stopwatch",            // unique; also the key in saved layouts
  title: "Stopwatch",         // the title bar
  help: "Counts seconds.",    // the panel's card in the 🧰 list
  w: 1, h: 1,                 // starting size, in grid cells
  render(body) {              // draws into body, a <div>
    body.textContent = seconds + "s";
  },
});
setInterval(() => { seconds++; BOARD_HOOKS.refreshPanel("stopwatch"); }, 1000);
```

| Field | Needed | What it does |
|---|---|---|
| `id` | yes | Unique name. Saved layouts refer to panels by it, so don't rename it once people are using it. |
| `title` | yes | Shown in the panel's title bar and on its card in the panel list. |
| `render(body)` | usually | Draws the panel's content into `body`. See below. |
| `help` | no | One sentence on the panel's card in the list. |
| `w`, `h` | no | Starting size in cells (default 1 × 1). Once someone changes a panel's size in the list, their size is used instead. |
| `tpl` | no | The id of a `<template>`. Its contents are copied into `body` when the panel is first built, and again when it is rebuilt with ↻. |
| `headButtons` | no | Buttons in the title bar: `[{ act, label, title, hidden }]`. Presses go to the page's `headAction` (see *Page settings*). |
| `role` | no | A category name. The page can group the panel list by it (see `groups` in *Page settings*). |
| `wip` | no | `true` shows 🚧 after the title. The page styles `.wip-badge`. |

### `render(body)`

- **When it runs:** whenever the panel is shown, moved, docked, rebuilt or refreshed. That can be often.
- **Build once, then update.** If `body` already holds your elements, change them rather than replacing them. Replacing them throws away whatever the person was doing in them: typing, scrolling, a drawing.
- **Redrawing:** call `BOARD_HOOKS.refreshPanel("your-id")`. It does nothing while the panel isn't on the board or a dock, so timers don't do wasted work.
- **Stay inside `body`.** Don't touch `document.body` or add page-wide CSS. Style inline, or with a `<style>` inside `body` whose selectors all start with `#your-id`.
- **Scaling:** a panel is a CSS size container, so `cqi` units scale with its width (`font-size: clamp(0.9rem, 13cqi, 2.2rem)`).

### Keeping what a panel knows

- Keep a panel's data in your own variables, not in the page.
- To keep it across reloads, save it in `localStorage` under `BOARD_NS + "something"`, so it's filed with the rest of the page's board data. `demo.html`'s Notes panel does this.

---

## Connected or not: the shared state

Panels are independent unless you connect them. There are two ways to hold state:

**Independent.** The panel keeps its own variables and redraws only itself with `BOARD_HOOKS.refreshPanel(id)`. Nothing else on the board sees it.

**Connected.** Shared values live in `boardState`, one object every panel can read. Change them with `setBoardState({ … })`, which updates the object and redraws every panel on the board. Any panel that reads the value in its `render()` follows along.

```js
setBoardState({ count: 0 });

registerPanel({ id: "counter", title: "Counter", render(body) {
  body.innerHTML = boardState.count + ' <button>+1</button>';
  body.querySelector("button").onclick = () => setBoardState({ count: boardState.count + 1 });
}});

registerPanel({ id: "mirror", title: "Mirror", render(body) {
  body.textContent = "Counter is at " + boardState.count;
}});
```

Neither panel knows the other exists. A third panel that reads `boardState.count` joins in, and removing one leaves the others working. One panel can mix shared values with private ones.

A page with its own central data can skip `boardState` and point the board's `refresh` at its own redraw instead (see *Page settings*). Brick by Brick does this: its panels are connected through its pile of bricks.

---

## Placing panels

`setDefaultBoard()` sets the layout a new visitor sees, and the layout **reset board** returns to:

```js
setDefaultBoard({
  cols: 4,          // columns in the grid
  rowUnit: 220,     // height of one row, in pixels
  tiles: [
    { id: "hello", x: 0, y: 0, w: 2, h: 1 },            // on the grid
    { id: "notes", x: 2, y: 0, w: 1, h: 2, dock: "right" },  // docked to the right edge
  ],
});
```

- `x`, `y` count cells from the top left, starting at 0. `w`, `h` are in cells.
- `dock` is optional: `"top"`, `"right"`, `"bottom"` or `"left"`. A docked panel keeps its `x`/`y` as the cell it returns to when undocked.
- Tiles must not overlap.
- Any registered panel that isn't in the layout waits in the 🧰 list until someone adds it.
- A saved layout that names a panel which no longer exists quietly drops it.

---

## Page settings

`configureBoard({ … })` tells the board how this page behaves. Call it before `startBoard()`. Every setting is optional and has a default that works.

| Setting | Called when | Default |
|---|---|---|
| `refresh()` | Content changed and every panel should redraw. | Runs `render()` for each panel on the board or a dock. |
| `refreshPanel(id)` | One panel should redraw, or was rebuilt with ↻. | Runs that panel's `render()` if it's on the board. |
| `resized(soon)` | Panel boxes changed size (move, resize, dock). `soon` is true straight after a re-layout. Canvas and map panels remeasure here. | Nothing. |
| `wireBody(def, body)` | A panel was built, once per build (including after ↻). Attach event listeners here. | Nothing. |
| `headAction(def, act, btn, body)` | A `headButtons` button was pressed. | Nothing. |
| `badges(def)` | Building a title bar. Return HTML to go before the title. | No badges. |
| `docHref(id)` | Building a title bar. Return a URL for the panel's **?** help link, or nothing. | No link. |
| `groups()` | Building the 🧰 list. Return `[{ role, title }]` to group cards by their `role`. | One plain list. |

`BOARD_HOOKS` near the top of `board.js` lists these with comments.

---

## What people can do

| | How |
|---|---|
| Add a panel | Open 🧰 on the right edge. Press **+** on a card, or drag the card onto a cell. Click an empty cell first to choose where **+** puts it. Hovering a card outlines where it would go, in red if it won't fit. |
| Move | Drag by the **✥** in the title bar. Dropping onto a panel the same size swaps the two. |
| Resize | Hover a panel, then **+** / **−** on its right and bottom edges. |
| Dock | Drag a panel onto a **+** at a window edge. Docked panels share the edge, can be reordered, and the edge can be dragged wider or narrower. **↩** puts one back on the grid. |
| Cover | **▤** in the title bar shows an arrow on each edge; pick one and the cover slides in from that edge, the way the arrow points (the left edge's → is lit by default, and pressing **▤** again takes the lit one). It blocks the mouse without changing anything underneath. Drag its tab to peek. Click the bottom of the tab to change the material (frosted, smoked, card). |
| Rebuild | **↻** builds the panel again from nothing. |
| Remove | **✕**. The panel is parked, not destroyed, so it comes back from 🧰 as it was. |
| Grid | **Columns** (1–12) and **Row px** (80–600) in 🧰. **reset board** returns to the default layout. |
| Find | Search box in 🧰 filters the cards. The minimap (bottom right) shows the whole board; click a block to jump to it. |
| Focus | A checkbox with id `spotlight`, if the page has one, dims every panel except the one you're working in. |
| 🧰 tab | Drag it up or down its edge. The dot on it turns its glow off. |

---

## Markup

The board looks for these elements:

```html
<div id="board"></div>

<div id="boardFlyoutWrap">
  <button type="button" id="boardFlyoutTab" title="show/hide the panel list">🧰</button>
  <div id="boardFlyout">
    <h3>Panels</h3>
    <div class="row">
      <label>Columns <input type="number" id="boardCols" min="1" max="12" step="1" value="4"></label>
      <label>Row px <input type="number" id="boardRowUnit" min="80" max="600" step="10" value="220"></label>
      <button type="button" id="boardFlyoutClose" title="hide the list">×</button>
    </div>
    <div class="row"><button type="button" id="boardReset">reset board</button></div>
    <input type="text" id="boardSearch" placeholder="search panels…">
    <div id="boardCardList"></div>
  </div>
</div>

<div id="panelStore" hidden></div>   <!-- where removed panels are parked -->
```

It creates the rest itself: the drop outline, the edge docks, the dock drop targets and the minimap.

---

## Theming

`board.css` takes its colors and sizes from CSS variables the page defines on `:root`:

| Variable | Used for |
|---|---|
| `--bg`, `--fg` | Page background and text. |
| `--panel`, `--field`, `--border`, `--border-soft` | Panel surface, inset surfaces, lines. |
| `--accent2` | Everything active or pressable: hover rings, the drop outline, the lit minimap. |
| `--accent`, `--bad`, `--muted` | Emphasis, errors, quiet text. |
| `--go`, `--stop` | The 🧰 tab's glow, and its red pulse when the board is empty. |
| `--tint` | The minimap block under the pointer. |
| `--panel-radius`, `--panel-border`, `--panel-gap`, `--close-size` | Corner radius, border width, gap between panels, size of the ↻ ✕ ↩ discs. |

`demo.html` defines a full set to copy. `board.css` is linked before the page's own styles, so the page can override any board rule by writing the same selector again.

### Props: panels you can place many times

A registered panel is on the board once or not at all. A **kind** is a recipe instead: each time someone adds it from 🧰, the board makes a new copy with its own id and its own settings. Removing a copy deletes it.

`props.js` and `props.css` add two kinds, under **Props** in 🧰:

- **Signal light:** a lamp that is steady, blinks, pulses, breathes, beats like a heart, flickers or spells Morse. It comes in six shapes: round, square, pill, triangle, octagon and a coin slot (a backlit coin-door insert with a slot and a molded "25¢"). A **Lens** sets what the light shines through: arcade plastic (a colored dome in a collar, colored even when off), fresnel rings, frosted, or bare LED dots. Each lamp has a hot spot where the bulb is and a glass shine on top. **Words** on the face are *cut out* — a black plate over the whole lamp with the letters cut through it, so each letter shows the lamp behind it and the plate gives off nothing — or *inverted*, dark letters on the lit face. They size themselves to the lamp. You can also set its color, speed, size, brightness (the glow follows it) and **grime**: dirt, dust, a fingerprint smudge and scratches on the glass, different on every copy.
- **Material:** a surface to fill a gap: brick, grid, blueprint, dots, stripes, paper or contour lines. You can set the line and ground colors, the scale, the strength, and **words** on it, painted on or engraved into it, sized to fill the panel.

Each copy has a **⚙** in its bottom-right corner, under any cover, so covering a prop puts its settings out of reach too. It opens a **deck** beside the panel, never over it, so you watch the prop change as you adjust it. Every copy also has a Name and a switch that hides its title bar:

- **Knobs** for numbers. Drag up or right to turn them up (Shift for fine steps), or scroll, or use the arrow keys. Double-click resets a knob.
- **Keys** for choices, **switches** for on/off, swatches for colors, and boxes for text.
- Every copy also has a **Name** and a switch that hides its title bar until you hover.

A frosted or smoked cover over a signal light glows with it, in step; card blocks the light. Colors marked **theme** follow the page's variables, so they change with the Theme panel. Load after `board.js`:

```html
<link rel="stylesheet" href="props.css">
<script src="props.js"></script>
```

### Fidgets: small games

`fidgets.js` and `fidgets.css` add games, under **Fidgets** in 🧰. They're kinds too, so you can place several, each set up its own way. Each one remembers where you were in it.

- **Toggle Grid:** press a light and it flips along with its neighbours. Turn them all off. It is drawn as a CRT phosphor screen: dark glass, scanlines, bloom, and an afterglow when a light goes out. The ⚙ sets:
  - **Shape:** square or hex. Hex cells sit in a honeycomb and flip the six that touch.
  - **Flips:** plus (the classic), corners, all eight, or the whole row and column.
  - **Wrap edges**, grid size (3–10 each way) and the lit color. How scrambled a new puzzle is follows the grid size.
  - **Random play:** it presses lights by itself at a speed you set (0.5–10 presses a second), with each press flashing. When it happens to clear a puzzle it deals a new one. You can still press lights while it runs, but no best score is kept.
  - Every puzzle is made by scrambling a solved board, so it can always be solved. **new** deals another. It counts your moves and keeps your best.

```html
<link rel="stylesheet" href="fidgets.css">
<script src="fidgets.js"></script>
```

To make a kind of your own, call `registerKind()` before the board loads:

```js
registerKind({
  kind: "clockface", title: "Clock face", help: "…", w: 1, h: 1, group: "Props",
  settings: [
    { key: "color", label: "Color", type: "color", default: "theme", theme: "--accent2" },
    { key: "speed", label: "Speed", type: "range", min: 0.2, max: 4, step: 0.1, default: 1 },
    { key: "style", label: "Style", type: "select", options: ["plain", "roman"], default: "plain" },
    { key: "text",  label: "Text",  type: "text", default: "", when: s => s.style === "roman" },
    { key: "on",    label: "On",    type: "check", text: "switched on", default: true },
  ],
  render(body, s) { /* draw with this copy's settings s */ },
});
```

`render(body, s)` runs when a copy is first drawn and whenever its settings change, never on an ordinary refresh. That lets an animation keep running while the page updates around it. `when` shows a setting only while it applies.

### The Theme panel

`theme.js` and `theme.css` add a panel for changing those colors: seven built-in themes, a swatch for each of eight variables (`--bg`, `--panel`, `--field`, `--fg`, `--border`, `--accent`, `--accent2`, `--draft`), saving your own under a name, **Export** and **Import…** to move saved themes between browsers or pages as a `themes.json` file, and a **Cursor** row that makes the text cursor in every text box a thin bar, a block, or an underscore. It writes the variables onto `<html>`, so the whole page follows. Load it after `board.js`:

```html
<link rel="stylesheet" href="theme.css">
<script src="theme.js"></script>
<script>
  loadSavedThemes(); loadTheme(); applyTheme();   // put back the last choice
  registerPanel({ id: "theme", title: "Theme", w: 1, h: 2,
                  render(body) { renderTheme(body); } });
</script>
```

Brick by Brick and `demo.html` both use it.

---

## Storage

Everything is saved in `localStorage`, under the prefix in `window.BOARD_NS` (default `"board:"`). Give each page its own prefix so two pages on one site don't share a layout.

| Key (after the prefix) | Holds |
|---|---|
| `board:v2` | The layout: columns, row height, every tile and its dock. |
| `footprints:v2` | Panel sizes people have changed in the list. |
| `covers:v2`, `coverprefs:v1` | Which panels are covered, how far open, which way they open, and in what material. |
| `focusmode:v1` | Whether focus mode is on. |
| `toolboxpos:v1`, `toolboxglow:v1` | Where the 🧰 tab sits and whether it glows. |
| `instances:v1` | Every placed copy of a kind, with its settings. |
| `fidget:<id>` | Where each fidget is in its game. Deleted with the fidget. |
| `theme:v1`, `themes:v1`, `caret:v1` | The theme in use, the ones you saved, and the text cursor shape (only with `theme.js`). |

---

## Functions you can call

| Function | Does |
|---|---|
| `registerPanel(cfg)` | Adds a panel to the registry (see above). |
| `setDefaultBoard(layout)` | Sets the starting layout. |
| `configureBoard(settings)` | Sets the page's behaviour. |
| `startBoard()` | Loads what's saved, draws the board and wires its controls. Call once. |
| `setBoardState(patch)` / `boardState` | Shared state; `setBoardState` redraws every panel. |
| `BOARD_HOOKS.refreshPanel(id)` / `BOARD_HOOKS.refresh()` | Redraw one panel, or all. |
| `addTile(id, x, y, w, h)` | Put a registered panel on the grid. |
| `removeTile(id)` | Take it off (parked, not destroyed). |
| `moveTile(id, x, y)` | Move it. |
| `resizeTile(id, "w" \| "h", ±1)` | Grow or shrink by one cell, if there's room. |
| `setDock(id, side)` | Dock to `"top"`/`"right"`/`"bottom"`/`"left"`; `""` to undock. |
| `reloadPanel(id)` | Rebuild it from nothing (same as ↻). |
| `findFreeSlot(w, h)` | The first free spot for a panel of that size: `{ x, y }`. |
| `resetBoard()` | Back to the default layout. |
| `renderBoard()` | Redraw the whole board. |

`board` holds the live layout (`board.cols`, `board.rowUnit`, `board.tiles`). Read it freely, but change it through the functions above so it gets saved.

---

## How it loads

`board.js` is a classic script, not a module. Its functions and variables are globals the page can call, and it uses nothing from the page. Everything a page supplies comes in through `registerPanel`, `setDefaultBoard` and `configureBoard`.
