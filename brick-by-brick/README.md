# Brick by Brick

A notation system where you define the symbols. One `.txt` file of bricks in, any
number of visualizations out. It is a single self-contained HTML file. It embeds
anywhere.

Lives at `mbrickmaps.github.io/brick-by-brick/`. It shares a panel grammar and a
palette with its sibling, `collage/`.

> **New to it?** [QUICK-GUIDE.md](QUICK-GUIDE.md) covers what a brick is, what
> the panels do, and how to keep your work safe, in about five minutes. This
> page is the full detail.
>
> Both read as web pages too: [doc/quick-guide.html](doc/quick-guide.html) and
> [doc/documentation.html](doc/documentation.html).

> **Note on this document.** An AI assistant wrote this during development.
> Nobody has reviewed it line by line. It describes the code as it stood when
> written, and parts of it have drifted. Treat it as a working draft.


---

## The research folder

Everything a piece of research needs, in one directory. Open it with **Folder…**
in the Pallet. The page reads all of it at once.

```
my-research/
├── bricks/                     the piles: *.txt, any number, any nesting
│   ├── moncur-bricks.txt
│   └── places.txt
├── images/
│   ├── scans/                  what a document brick points at
│   ├── places/                 longforgan.png, scenery behind that column
│   └── wear/                   who wears what. See the Promenade
├── gazetteer.csv               uid,lat,lng,label,icon
├── project.json                an Atlas project file (map context)
└── brick.json                  placements and column colors
```

Two rules the structure depends on:

**Declare a uid in exactly one file.** Merging concatenates. Two files both
declaring `<james>` is an error by design. Declare once, reference everywhere.

**The page indexes images. It does not link them.** As a plain `<img src>`,
`images/scans/x.jpg` resolves against the *page* rather than your folder. A local
scan would never load. Opening a folder maps each image to a blob URL instead.
The same brick file then works from disk and hosted, with nothing uploaded.

---

## The notation

One record per line, pipe-separated. The parser reads it by **shape, not
position**. Real corpora are inconsistent. A notation that promises you define
the symbols cannot then punish a stray column.

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
| `+` | verified. A document says so |
| `-` | draft. Your inference, or not yet checked |
| `<uid>` | declares this record's identity. Optional. |
| `@a,b` | links to other uids |
| `<4><george>` | a numbered variant, for same-name people |

**Type tokens** are interchangeable between emoji, full word and single letter.
`👤`, `person` and `p` are the same thing. The **Notation reference** panel lists them all,
built from the parser itself. It cannot drift from what the code accepts.

Three properties matter:

- **First declaration wins.** A second `<james>` raises an error and changes
  nothing. It never overwrites the first. Duplicate *records* are ordinary.
  Duplicate uids are not.
- **Ghosts are a feature.** An alias you referenced but never declared is often the
  most interesting object in the pile. The page lists it instead of dropping
  it.
- **Nothing recomputes ghost-ness for a filtered view.** Whether an alias was
  ever declared is a fact about the whole pile. Filtering to one family must not
  manufacture ghosts.

---

## The board

Panels are tiles with `{id, x, y, w, h}` on a real coordinate grid. You place
cells and tiles explicitly. Neither pushes the other around.

- **🧰 flyout** holds every panel *not currently on the board*, grouped and
  searchable. Drag a card onto the board, or press **+** to drop it in the first
  free slot. The list empties as you add and refills as you remove.
- **Seven panels start off the board.** Promenade, Sprite Editor, Photo Ruler,
  Pixel Party City, Theme, Map Style and Map Editor. The default board is the
  working set for entering records. Those seven become useful once you have
  some. Nobody finds them without opening the flyout, which is why the quick
  guide says so.
- **Footprints** are per panel, editable in the flyout, and remembered.
- **Grow or shrink** a tile by a column or row. Only the legal buttons appear.
  A **+** never points at an occupied neighbour or past the edge.
- **Swap** two tiles of the same footprint by dragging one onto the other.
- **Removing** a tile parks its panel in the store. Its scroll position and
  typed text survive a trip off the board.
- **Columns and row height** are controls. Changing columns repacks with a
  skyline scan. It never pretends old positions still fit.

### Panel roles

Every panel header carries a badge saying what it does **to your data**:

| | | |
|---|---|---|
| **W** | write | changes the pile: `state.text` or the gazetteer |
| **F** | filter | changes what is in view, never the pile itself |
| **R** | read only | |

A panel can hold more than one. The legend is at the top of the panel list.

---

## Saving

Four controls in the header cover it: **auto**, **Save to browser**, **Export**,
**Clear all**.

| | |
|---|---|
| **auto** | Autosave on or off. Off means off. Nothing is written until you press Save, and the status line turns red saying **unsaved changes**. |
| **Save to browser** | Writes to `localStorage`. This browser, this machine. A clear-site-data takes it. |
| **Export** | A real `.txt` file you own. The only durable one. |
| **Clear all** | Back to a blank project. |

**Clear all** sits immediately right of Export. That is deliberate. The safe way
out stands next to the destructive one. It confirms first, lists what will go
with live counts, and warns you in the dialog if you have never exported.

It removes the pile, the gazetteer, Promenade placements and column colors, the
board layout and panel sizes, and the map's project file, style and source. It
**keeps** your themes and your tile key. Losing those would be a separate annoyance
you never asked for, and neither says anything about the research. The dialog names both lists.
Nothing goes unannounced.

There is no undo, by design. An undo would mean holding a full copy of what you
just deleted. A page storing your only copy should not quietly retain that.
Export is the undo. Hence the placement.

The status line spells all of it out: where the pile came from, when it last
autosaved, and when it last left the browser as a file.

---

# The panels

## The Pallet · **W**

Your bricks. One record per line, and the only source of truth on this page.

Behind the **☰** menu: Import, Export, Merge, and **Folder…**.

**Folder** reads every `.txt` in a folder, subfolders included, merged in
filename order. Support differs across browsers, so there are three routes.
`showDirectoryPicker()` on Chromium keeps a handle, and Rescan re-reads with no
second prompt. `<input webkitdirectory>` covers everywhere else. You can also
drop a folder onto the panel.
A page cannot watch a folder. The browser gives no filesystem access without a
gesture, so this is open-and-rescan, never live sync.

**Rescan is idempotent.** Merging skips bricks already present, and it writes
nothing at all for a block whose only new content is comments. Read the same
folder twice and you get exactly the bricks added since last time.

**Merge** folds several small piles into one, marking each file's bricks with a
`# --- merged from <file> ---` provenance line and skipping any brick already
present verbatim. One person recorded in two piles does not become two entities.
Comments never deduplicate, because the same `# PEOPLE` heading legitimately
appears in every file.

## Brick Builder · **W**

Compose a line without typing a pipe or hunting for an emoji. Status toggle,
type buttons, labeled fields that change with the type, and uid autocomplete
drawn from what you have already declared.

It always shows the exact line it will write. **The real parser checks that line
before the builder offers it**, so the builder can never emit something the
parser would reject. Click a line in Classification and it loads back in for
editing. It round-trips exactly, including your own arithmetic.

## Classification · **R**

Every line as the parser sees it. Orange verified, gray dashed draft, red
unparsed. Click one to load it into the Builder.

## Bricks · **F R**

Every uid in the pile. Dotted means a ghost: referenced but never declared.

Click a name to **focus** it. You get every record that names them, which is their
family as the records describe it. Not as a tree asserts it.

Its own filter row narrows only what this panel shows, without touching the
board-wide filter. The kind toggles are built from the kinds actually present,
so a pile with no documents is not offered a document filter.

## Filter · **F**

Narrows what every panel shows. **Every control is read back out of your text**:
your `#` headings are the groupings, the type tokens are the kinds, `+/-` is the
confidence. No taxonomy you did not type.

The time slider has three modes: a decade, a min to max span, or a single year
±n. Undated records are exempt: filtering by date must not silently hide
everything without a date on it.

## Document · **F R**

One document at a time, large: the scan, the raw brick, its metadata, and a
button for every person it names.

The scan draws to a **canvas**. Wheel to zoom, drag to pan, Fit and
1:1, double-click to fit. Same zoom-to-cursor arithmetic as the collage clipper,
so whatever is under the pointer stays there. The buffer takes its size in
device pixels. A census page at 1:1 shows the ink, not a resample.

It selects by **line number, never an index into a filtered list**, because the list
changes shape as you filter, and an index would silently point at a different
record.

## Gazetteer · **W F**

Coordinates by uid, so `lat,lng` need not live inside every place brick. A place
brick declares identity; the gazetteer supplies geometry.

- Every declared place is a row, named, with lat/lng editable in place.
- A brick's **own** inline coordinates lock that row. Edit the brick rather than
  the panel, and the two can never disagree silently.
- An entry matching no declared place lists separately as unclaimed.
- The **Add** row declares a brand-new place and sets its coordinates in one
  action. Adding the same name again updates rather than duplicating.
- **Paste a Google Maps string** such as `56.4629, -2.9715` into either coordinate
  field and it splits across both. Recognized by the same `readCoords` the
  parser uses, so "what counts as a pair" is defined once.
- Per place: a **marker icon** (any emoji) and a **label placement**, nine
  choices, `auto` by default.

CSV is import/export only, never the source of truth for what you see.

## Timeline · **F R**

Every dated record, one lane per person, in order. Years found in a note or
heading count too, and are drawn hollow to mark them as inferred. Hover a mark
for the detail.

The page computes ages where a birth is known. `~` prefixes any age derived from
a rounded census age. Nobody mistakes it for one from a real date.

## Tally · **R**

Live count of the pile: bricks, verified, draft, unparsed, entities, ghosts,
links.

## Red Flags · **R**

Everything the parser objects to: duplicate uids, ghosts, missing dates, derived
years. Red is an error, amber a warning.

## Notation reference · **R**

The symbols the parser understands, generated from the parser itself. Emoji,
word and letter are interchangeable.

---

# The map

## Map Viewer · **F R**

Every place brick that carries coordinates. Click a marker to focus that place.

**Source dropdown**, top left: **My tiles** or **MapLibre**, remembered between
sessions. If your tiles do not answer, it falls back to MapLibre's own basemap
and says so. Markers floating on nothing read worse than a borrowed
basemap.

**Coordinate readout**, bottom left: `z7.00  -4.7623, 55.7841 → -2.0377, 57.0061`
shows zoom, then west, south, east, north, the same order `view.bbox` takes. **Click
it** to copy `"center": […], "zoom": …, "bbox": […]` for pasting into a project
file.

**Marker kinds** take their colour from what they are: places, births, deaths,
marriages. Status moved to opacity, because a mark cannot say two things with
one fill, and *what is this* is the question you ask before *how sure are we*.
An event becomes a mark only when it names a place with coordinates; it borrows
that place's position rather than inventing one.

**Labels** place themselves. A label set to `auto` tries eight positions in
Imhof's order, upper right first, then the other corners, then the sides, then
directly above and below. It takes the first that does not collide. Choosing a
side opts out: it is honoured or the label is dropped, never quietly moved.

**Connector lines** join two places when one record names both (orange, a stated
fact) or when the same person is named at both (gray, inferred, wearing the
draft color). Undirected, because the records give an association and never a
direction of travel.

## Map Style · **R**

Per-layer control of your basemap: show/hide, color, line width, and opacity for
every layer, plus the hillshade raster.

Below a divider: **Hide overlaps** (label decluttering), **Label offset**, and
**Marker size**. The label offset is measured from the edge of the mark, so
growing a marker pushes its name out with it.

Behind **Style file…**: a hosted style URL, a tile-service key, and the raw
MapLibre style JSON. Write `{key}` in a URL and the key is substituted at the
moment the page hands the style to the map. Your key stays in this browser, out
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

## Map Editor · **R**

A blank map to trace on, kept deliberately separate from the Viewer: no bricks,
no markers, no place labels. Nothing you did not put there can be clicked or
read by mistake.

Paste a **basemap style URL** to trace against, such as a MapTiler URL with your key in
it works as typed, or write `{key}`.

Tools: point, line, shape, arrow, curved arrow, note. Draw on the map; select an
item to restyle it; drag its handles to reshape it. **Capture view** writes the
current center and zoom into the file, and **Download** saves it.

It writes the same format the Viewer reads. The preview is the real renderer
drawing the real file. Nothing can look right here and wrong when loaded.

## Theme · **R**

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

`color-scheme` flips with the theme. Without it the browser paints checkboxes,
sliders and scrollbars for the wrong side.

## Promenade · **R**

Your people, walking the ground their records put them on.

Full documentation, including the sprite-sheet spec: **[doc/promenade.html](doc/promenade.html)**.

A side-on scene. The horizontal axis is longitude and each place is a column. Drag people into columns to group them; the grouping carries into
the grid view and is saved to `brick.json`.

Art is found by filename, never configured. A place is `images/places/<uid>.png`,
falling back to `images/places/default.png`.
A person is one sheet, `images/wear/<who>.png`, where *who* is a uid, a trade,
or `default`. Four frames across and four rows down: **body, bottom, top, hat**.
Rows resolve independently down that chain. A sheet with only a hat drawn on
it changes only the hat, and redrawing the body row gives that person a
different figure with no flag or setting anywhere.

**Day and night.** The `☀`/`☾` beside the scene colours changes the hour, and so
does clicking the sun or moon itself. Drag that to hang it somewhere else,
right-click to put it back. Each hour keeps its own sky and ground. Setting a
colour you like no longer stops the switch changing anything. Windows marked as
glass in the Sprite Editor light at night: each pane is lit from a point low in
it, falling off fast, with its own warmth. A terrace does not read as one
strip of yellow.

**The labels are yours to place.** Every signpost and ribbon can be dragged up
and down and stays where you put it. A post keeps its foot on the ground and
changes length rather than sinking through it. Sideways is reserved for group
ribbons, because sideways means reordering columns and the places are in
longitude order.

**A column can carry two lines of your own**, one over the roof and one on the
ground, set on the bar that appears when you select a column. They wrap, they
drag vertically, and they travel in `brick.json`. They are the part of a scene
no file can regenerate, because nothing in the records says the mill burned in
1874.

---

## Sprite Editor · **R**

Draw the art the Promenade uses, a pixel at a time, with the figure walking
beside you at true size. `TYPE` picks what you are drawing: `body`, `bottom`,
`top` and `hat` are the four rows of a wardrobe sheet; `place` is the scenery
that stands behind a column.

The name in `FOR` decides the filename, and the panel opens whatever already
exists under it. Type a name you drew last week and that drawing comes back.
`download` writes the PNG. `to promenade` puts it straight into Pixel Party City
instead: `places/<name>.png` for a place, `wear/<name>.png` for a wardrobe
sheet. The street picks it up with nothing written to disk.

**Tools.** Pencil, line, box, filled box, move, marquee copy, guide and measure.
The marquee lifts a rectangle to the clipboard and stamps it; `keep` saves what
is on the clipboard to the **parts** tray under the canvas, and clicking a part
puts it back on the clipboard to stamp again. Drop a PNG on the tray to add one.

**Measure** marks stay on the canvas through every tool, as many as you like, so
you can compare a window against a door you drew an hour ago. `⊗` on a mark
dismisses that one; right-click clears every mark on the `TYPE` you are looking
at. Each `TYPE` keeps its own set. A coat's measurements do not follow you onto
a place.

**A place has a scale.** `1px = N units` converts the cell count into real
dimensions, and the world size beside it can be typed or stepped to resize the
canvas in feet rather than pixels.

### paint and effects

A place is drawn in two modes, switched by the button on the paint row.

**paint** is the drawing. **effects** marks what parts of the drawing *mean*.
the picture goes faint and every tool you already have writes a mark instead of
a colour. Nothing in effects can change a colour: the pencil, the box and the
fill all flag, and copy and move do nothing at all.

| mark | means |
|---|---|
| `▣` | glass. These panes light at night |
| `▯` | a doorway. The way into this place |
| `⚑` | where this place's name stands |

The flags live in the **alpha channel** at 254, 253 and 252, all indistinguishable
from opaque. Marking never touches a pixel's colour. Your drawing survives being
marked, and the flags ride inside the PNG, which is the only place they can ride.
The PNG is the file you commit.

The anchor decides the signpost. On the **bottom row** of the drawing it plants
the post at that point of the building; **anywhere else** the name floats there
with no post, for a label over a roof or a hill.

---

## Pixel Party City · **R**

Scenery kept in this browser, standing in for files you have not deployed. A
picture named for a place's uid stands behind that place exactly as though it
were in `images/places/`. Download one when it earns a place in the repository.

---

## Photo Ruler · **R**

Measure a photograph. Drop one in, draw a line along something whose size you
know, say what it is worth, and every other line reads in those units. That is
how you find out how wide a door actually is before drawing it a pixel at a time.

Click a line to make it the reference; drag it, or either of its ends, to adjust;
right-click removes it. The unit dropdown changes what you read, and leaves the
scale alone. Set a line to `12 m`, switch to `ft`, and it says `39.37 ft`.

**Perspective.** One ratio is only true for things parallel to the film at one
depth. On an angled photograph a wall's far end reads short. `square up…` takes
the four corners of something you know is a real rectangle, plus its real width
and height, and undoes the projection across the whole of that flat surface. It
is a homography: four points in, four out, no camera model. It is true for **that
plane only**. The roof is a different plane, and so is the yard.

---

## Extending it

A visualization is a panel like any other, given a footprint on the board. Several sit side by side reading the same model at
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
nothing else. It cannot reach the raw text or its neighbours. A
broken renderer can only break its own tile.

`Brick.model` is the current model. `Brick.place("network")` drops one straight
onto the board from the console. A slot with no `render` reports the shape of the
data it *would* receive, which is the fastest way to see a new record type
flowing through.

**A renderer owns its element.** The page calls it again on every model change.
It must update what is there instead of assuming an empty element. Nobody can
rebuild a map sixty times while you type.

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
| `promenade-pins:v1` · `promenade-groups:v1` | placements and the groups you invented |
| `columntint:v1` · `ribbons:v1` | column gradients and ribbon colours |
| `promenade-bg:v1` · `night:v1` · `sunpos:v1` | sky and ground per hour, the hour, where the sun hangs |
| `signy:v1` · `colnote:v1` | how high each sign hangs, and each column's two notes |
| `ignored:v1` | bricks excluded from the pile |
| `art:v1` · `parts:v1` | Pixel Party City's scenery, and the Sprite Editor's parts tray |
| `wip:v1` | the Sprite Editor's unsaved draft |
| `swatches:v1` · `spritebg:v2` · `gridbg:v1` · `gridstep:v1` · `spcursor:v1` | the Sprite Editor's palette and view settings |
| `guides:v1` · `placescale:v1` | drawing guides, and a place's units per pixel |

All of it is this browser on this machine. Only **Export** and **brick.json**
produce files you own.
