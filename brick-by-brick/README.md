# Brick by Brick

A notation system where you define the symbols. One `.txt` file of bricks in, any
number of visualizations out. Single self-contained HTML, so it embeds anywhere.

Lives at `mbrickmaps.github.io/brick-by-brick/`. Sibling to `collage/`, and
deliberately shares its panel grammar and palette.

> **New to it?** [QUICK-GUIDE.md](QUICK-GUIDE.md) covers what a brick is, what
> the panels do, and how to keep your work safe, in about five minutes. This
> page is the full detail.
>
> Both read as web pages too: [doc/quick-guide.html](doc/quick-guide.html) and
> [doc/documentation.html](doc/documentation.html).

> **Note on this document.** Written by an AI assistant during development, and
> not yet reviewed line by line. It describes the code as it stood when written,
> so some of it will have drifted. Treat it as a working draft — to be rewritten
> properly later.


---

## The research folder

Everything a piece of research needs, in one directory. Open it with **Folder…**
in the Pallet and all of it is read at once.

```
my-research/
├── bricks/                     the piles — *.txt, any number, any nesting
│   ├── moncur-bricks.txt
│   └── places.txt
├── images/
│   ├── scans/                  what a document brick points at
│   ├── places/                 longforgan.png — scenery behind that column
│   └── wear/                   who wears what — see the Promenade
├── gazetteer.csv               uid,lat,lng,label,icon
├── project.json                an Atlas project file (map context)
└── brick.json                  placements and column colors
```

Two rules the structure depends on:

**A uid is declared in exactly one file.** Merging is concatenation, so two
files both declaring `<james>` is an error by design. Declare once, reference
everywhere.

**Images are indexed, not linked.** As a plain `<img src>`, `images/scans/x.jpg`
would resolve against the *page*, not your folder, so a local scan would never
load. Opening a folder maps each image to a blob URL — the same brick file works
from disk and hosted, with nothing uploaded.

---

## The notation

One record per line, pipe-separated, read by **shape rather than position**
because a real corpus is inconsistent and a notation whose premise is "you
define the symbols" cannot then punish a stray column.

```
+|👤|<george-isles>|George Isles|Powerloom Tender|@dora-edmed
│  │       │             │              │              │
│  │       │             │              │              └── links to other uids
│  │       │             │              └───────────────── detail / occupation
│  │       │             └──────────────────────────────── name
│  │       └────────────────────────────────────────────── uid, in angle brackets
│  └────────────────────────────────────────────────────── type token
└───────────────────────────────────────────────────────── status
```

| | |
|---|---|
| `+` | verified — a document says so |
| `-` | draft — your inference, or not yet checked |
| `<uid>` | declares this record's identity. Optional. |
| `@a,b` | links to other uids |
| `<4><george>` | a numbered variant, for same-name people |

**Type tokens** are interchangeable between emoji, full word and single letter —
`👤`, `person` and `p` are the same thing. The complete list is in the
**Notation reference** panel, generated from the parser, so it can never drift
from what the code actually accepts.

Three properties worth knowing:

- **First declaration wins.** A second `<james>` is an error that changes
  nothing, rather than silently overwriting the first. Duplicate *records* are
  ordinary and expected; duplicate uids are not.
- **Ghosts are a feature.** An alias referenced but never declared is not a
  mistake — it is often the most interesting object in the pile, and it is
  listed as such rather than dropped.
- **Ghost-ness is never recomputed for a filtered view.** Whether an alias was
  ever declared is a fact about the whole pile. Filtering to one family must not
  manufacture ghosts.

---

## The board

Panels are tiles with `{id, x, y, w, h}` on a real coordinate grid — cells and
tiles both explicitly placed, so neither pushes the other around.

- **🧰 flyout** — every panel *not currently on the board*, grouped and
  searchable. Drag a card onto the board, or press **+** to drop it in the first
  free slot. The list empties as you add and refills as you remove.
- **Four panels start off the board** — Promenade, Theme, Map Style and Map
  Editor. The default board is the working set for entering records; those four
  are for once you have some. A first-time reader will not find them without
  opening the flyout, so the quick guide says so explicitly.
- **Footprints** are per panel, editable in the flyout, and remembered.
- **Grow or shrink** a tile by a column or row; only the legal buttons appear,
  so a **+** never points at an occupied neighbor or past the edge.
- **Swap** two tiles of the same footprint by dragging one onto the other.
- **Removing** a tile parks its panel in the store, so its scroll position and
  typed text survive a trip off the board.
- **Columns and row height** are controls. Changing columns repacks with a
  skyline scan rather than pretending old positions still fit.

### Panel roles

Every panel header carries a badge saying what it does **to your data**:

| | | |
|---|---|---|
| **W** | write | changes the pile — `state.text` or the gazetteer |
| **F** | filter | changes what is in view — never the pile itself |
| **R** | read only | |

A panel can hold more than one. The legend is at the top of the panel list.

---

## Saving

The header carries the whole of it: **auto**, **Save to browser**, **Export**,
**Clear all**.

| | |
|---|---|
| **auto** | Autosave on or off. Off means off — nothing is written until you press Save, and the status line turns red saying **unsaved changes**. |
| **Save to browser** | Writes to `localStorage`. This browser, this machine. A clear-site-data takes it. |
| **Export** | A real `.txt` file you own. The only durable one. |
| **Clear all** | Back to a blank project. |

**Clear all** sits immediately right of Export, which is deliberate: the safe way
out is next to the destructive one. It confirms first, listing what will go with
live counts, and warns in the dialog if the pile has never been exported.

It removes the pile, the gazetteer, Promenade placements and column colors, the
board layout and panel sizes, and the map's project file, style and source. It
**keeps** your themes and your tile key — losing those is a separate annoyance
you never asked for, and neither says anything about the research. Both lists
are named in the dialog, so nothing goes unannounced.

There is no undo, by design: an undo would mean holding a full copy of
everything just deleted, which is the last thing a page storing your only copy
should quietly retain. Export is the undo — hence the placement.

The status line spells out all three: where the pile came from, when it was last
autosaved, and when it last left the browser as a file.

---

# The panels

## The Pallet — **W**

Your bricks. One record per line, and the only source of truth on this page.

Behind the **☰** menu: Import, Export, Merge, and **Folder…**.

**Folder** reads every `.txt` in a folder, subfolders included, merged in
filename order. Three routes, because support differs: `showDirectoryPicker()`
on Chromium keeps a handle so Rescan re-reads with no second prompt;
`<input webkitdirectory>` everywhere else; and dropping a folder onto the panel.
A page cannot watch a folder — there is no filesystem access without a gesture —
so this is open-and-rescan, never live sync.

**Rescan is idempotent.** Merging skips bricks already present, and a block whose
only new content is comments is not written at all. Reading the same folder twice
brings in exactly the bricks added since last time.

**Merge** folds several small piles into one, marking each file's bricks with a
`# --- merged from <file> ---` provenance line and skipping any brick already
present verbatim, so one person recorded in two piles does not become two
entities. Comments are never deduplicated — the same `# PEOPLE` heading
legitimately appears in every file.

## Brick Builder — **W**

Compose a line without typing a pipe or hunting for an emoji. Status toggle,
type buttons, labeled fields that change with the type, and uid autocomplete
drawn from what you have already declared.

It always shows the exact line it will write, and that line is **parsed with the
real parser before it is offered** — so the builder can never emit something the
parser would reject. Clicking a line in Classification loads it back in for
editing, and round-trips exactly, including your own arithmetic.

## Classification — **R**

Every line as the parser sees it. Orange verified, gray dashed draft, red
unparsed. Click one to load it into the Builder.

## Bricks — **F R**

Every uid in the pile. Dotted means a ghost: referenced but never declared.

Click a name to **focus** it — every record that names them, which is their
family as the records describe it rather than as a tree asserts it.

Its own filter row narrows only what this panel shows, without touching the
board-wide filter. The kind toggles are built from the kinds actually present,
so a pile with no documents is not offered a document filter.

## Filter — **F**

Narrows what every panel shows. **Every control is read back out of your text**:
your `#` headings are the groupings, the type tokens are the kinds, `+/-` is the
confidence. No taxonomy you did not type.

The time slider has three modes — a decade, a min–max span, or a single year
±n. Undated records are exempt: filtering by date must not silently hide
everything without a date on it.

## Document — **F R**

One document at a time, large: the scan, the raw brick, its metadata, and a
button for every person it names.

The scan is a **canvas, not an `<img>`** — wheel to zoom, drag to pan, Fit and
1:1, double-click to fit. Same zoom-to-cursor arithmetic as the collage clipper,
so whatever is under the pointer stays there. The buffer is sized in device
pixels, so a census page at 1:1 shows the ink rather than a resample.

Selection is by **line number, never an index into a filtered list** — the list
changes shape as you filter, and an index would silently point at a different
record.

## Gazetteer — **W F**

Coordinates by uid, so `lat,lng` need not live inside every place brick. A place
brick declares identity; the gazetteer supplies geometry.

- Every declared place is a row, named, with lat/lng editable in place.
- A brick's **own** inline coordinates lock that row — edit the brick, not the
  panel — so the two can never disagree silently.
- An entry matching no declared place lists separately as unclaimed.
- The **Add** row declares a brand-new place and sets its coordinates in one
  action. Adding the same name again updates rather than duplicating.
- **Paste a Google Maps string** — `56.4629, -2.9715` — into either coordinate
  field and it splits across both. Recognized by the same `readCoords` the
  parser uses, so "what counts as a pair" is defined once.
- Per place: a **marker icon** (any emoji) and a **label placement** — nine
  choices, `auto` by default.

CSV is import/export only, never the source of truth for what you see.

## Timeline — **F R**

Every dated record, one lane per person, in order. Years found in a note or
heading count too, and are drawn hollow to mark them as inferred. Hover a mark
for the detail.

Ages are computed where a birth is known: `~` prefixes an age derived from a
rounded census age, so it can never be mistaken for one from a real date.

## Tally — **R**

Live count of the pile: bricks, verified, draft, unparsed, entities, ghosts,
links.

## Red Flags — **R**

Everything the parser objects to: duplicate uids, ghosts, missing dates, derived
years. Red is an error, amber a warning.

## Notation reference — **R**

The symbols the parser understands, generated from the parser itself. Emoji,
word and letter are interchangeable.

---

# The map

## Map Viewer — **F R**

Every place brick that carries coordinates. Click a marker to focus that place.

**Source dropdown**, top left: **My tiles** or **MapLibre**, remembered between
sessions. If your tiles do not answer, it falls back to MapLibre's own basemap
and says so — a map with markers floating on nothing is worse than a borrowed
basemap.

**Coordinate readout**, bottom left: `z7.00  -4.7623, 55.7841 → -2.0377, 57.0061`
— zoom, then west, south, east, north, the same order `view.bbox` takes. **Click
it** to copy `"center": […], "zoom": …, "bbox": […]` for pasting into a project
file.

**Marker kinds** are colored by what they are — places, births, deaths,
marriages. Status moved to opacity, because a mark cannot say two things with
one fill, and *what is this* is the question you ask before *how sure are we*.
An event becomes a mark only when it names a place with coordinates; it borrows
that place's position rather than inventing one.

**Labels** place themselves. A label set to `auto` tries eight positions in
Imhof's order — upper right first, then the other corners, then the sides, then
directly above and below — and takes the first that does not collide. Choosing a
side opts out: it is honoured or the label is dropped, never quietly moved.

**Connector lines** join two places when one record names both (orange, a stated
fact) or when the same person is named at both (gray, inferred — so it wears the
draft color). Undirected, because the records give an association and never a
direction of travel.

## Map Style — **R**

Per-layer control of your basemap: show/hide, color, line width, and opacity for
every layer, plus the hillshade raster.

Below a divider: **Hide overlaps** (label decluttering), **Label offset**, and
**Marker size**. The label offset is measured from the edge of the mark, so
growing a marker pushes its name out with it.

Behind **Style file…**: a hosted style URL, a tile-service key, and the raw
MapLibre style JSON. Write `{key}` in a URL and the key is substituted at the
moment the style is handed to the map — so the key stays in your browser and out
of anything you share.

Behind **Project…**: an Atlas project file, pasted or chosen from the `.json`
files in your research folder. Nothing auto-applies; which map you are looking at
is your call.

### The project file

Reads the Atlas format as-is:

```json
{ "view":   { "center": [-3.4, 56.4], "zoom": 8, "hide": [], "insertBelow": {} },
  "points": { "data": [ { "name": "Perth", "lng": -3.44, "lat": 56.40, "dir": "NE" } ] },
  "polys":  { "data": [ { "geometry": {…}, "style": { "fill": "#8b0000" } } ] },
  "annotations": { "data": [ { "type": "text-area", "position": […], "text": "…" } ] } }
```

Supported: `view` center/zoom/lock/basemap/hide/hideFeatures/insertBelow;
`polys` with inline geometry or a `source` URL, with per-entry `insertBelow`;
`points` with `dir` and full style; `annotations` as straight-arrow,
curved-arrow and text-area.

**Not supported, and ignored rather than treated as an error:** `refUid` (it
addresses features in *your* tiles by uid, and this basemap has different source
layers), `pattern` fills (they need a sprite this page does not carry),
`hillshade`, and `inset`. Annotations are always above the marks, since they are
DOM rather than style layers.

Context is pure reference. It never enters the model and the timeline never
touches it.

## Map Editor — **R**

A blank map to trace on, kept deliberately separate from the Viewer: no bricks,
no markers, no place labels, so nothing you did not put there can be clicked or
read by mistake.

Paste a **basemap style URL** to trace against — a MapTiler URL with your key in
it works as typed, or write `{key}`.

Tools: point, line, shape, arrow, curved arrow, note. Draw on the map; select an
item to restyle it; drag its handles to reshape it. **Capture view** writes the
current center and zoom into the file, and **Download** saves it.

It writes the same format the Viewer reads, so the preview is the real renderer
drawing the real file — nothing can look right here and wrong when loaded.

## Theme — **R**

Six dark themes, or your own. Eight colors drive the whole page.

| | |
|---|---|
| Board | behind the panels |
| Panels | inside each panel |
| Inputs | text boxes, lists, buttons |
| Text | every word on the page |
| Borders | panel outlines, dividing lines |
| Verified | `+` bricks, confirmed markers |
| Highlight | hover, focus, switched-on controls |
| Draft | `−` bricks, unconfirmed things |

Edit any swatch and it becomes *your* theme; name it and **Save** to keep it.
Built-in themes live in code and improve when it does; yours live in your browser
and nothing this page ships can rewrite them.

`color-scheme` flips with the theme — without it the browser paints checkboxes,
sliders and scrollbars for the wrong side.

## Promenade — **R**

Your people, walking the ground their records put them on.

Full documentation, including the sprite-sheet spec: **[doc/promenade.html](doc/promenade.html)**.

In short: a side-on scene where the horizontal axis is longitude and each place
is a column. Drag people into columns to group them; the grouping carries into
the grid view and is saved to `brick.json`.

Art is found by filename, never configured. A place is `images/places/<uid>.png`,
falling back to `images/places/default.png`.
A person is one sheet — `images/wear/<who>.png`, where *who* is a uid, a trade,
or `default` — four frames across and four rows down: **body, bottom, top, hat**.
Rows resolve independently down that chain, so a sheet with only a hat drawn on
it changes only the hat, and redrawing the body row gives that person a
different figure with no flag or setting anywhere.

---

## Extending it

A visualization is not a tab or a mode. It is a panel like any other, given a
footprint on the board, so several can sit side by side reading the same model at
once.

```js
Brick.viz.register("network", {
  emoji: "🕸️", label: "Network", w: 2, h: 2,
  description: "What this slot would draw.",
  render(model, el) { /* draw into el */ },
});
```

Registering creates a panel with a footprint; it appears as a card in the flyout
and you place it on the board. A slot gets the model and an empty element,
nothing else — no access to the raw text, the editor, or its neighbors — so a
broken renderer can only break its own tile.

`Brick.model` is the current model. `Brick.place("network")` drops one straight
onto the board from the console. A slot with no `render` reports the shape of the
data it *would* receive, which is the fastest way to see a new record type
flowing through.

**A renderer owns its element.** It is called again on every model change, so it
must update what is there rather than assume an empty element — a map or a canvas
cannot be rebuilt sixty times while you type.

---

## Notes for whoever runs this

**Tiles and CORS.** `tiles.mbricknell.com` allows `localhost:3000` only. Serving
this page from any other port means every tile request is blocked and the map
falls back to MapLibre's basemap without the failure being obvious. If the map is
unexpectedly blue, check the port before checking the server.

**What lives in `localStorage`**

| key | holds |
|---|---|
| `text:v1` | the pile |
| `autosave:v1` | autosave on/off |
| `board:v2` · `footprints:v2` | tile layout and panel sizes |
| `gazetteer:v1` | coordinates, icons, label placements |
| `theme:v1` · `themes:v1` | the theme in use, and the ones you saved |
| `mapsource:v1` · `mapstyle:v1` · `mapstyle-raw:v1` | basemap choice, layer settings, hand-edited style |
| `mapproject:v1` · `styleurl:v1` · `tilekey:v1` | project file, hosted style, tile key |
| `meurl:v1` · `mesource:v1` | Map Editor's tracing basemap |
| `promenade-pins:v1` · `columntint:v1` | placements and column colors |

All of it is this browser on this machine. Only **Export** and **brick.json**
produce files you own.
