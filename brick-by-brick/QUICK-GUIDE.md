# Quick guide

**Write your research as plain text, one record to a line, in a notation you
invent. Read it back as a timeline, a tree, a map, or a street you can walk
along.**

One record at a time, one fact for every line. Every panel reads the pile, while
your bricklings smile and stroll the pixel promenade from sunlight into twilight.

---

## Start here

Six steps, in order.

1. **Open the page.** A board of panels and an empty Pallet. For something to
   practise on, open the Pallet's **☰** menu and press **Sample**. It replaces
   whatever is in the Pallet without asking, so press it before you type
   anything of your own.
2. **Find The Pallet.** The panel full of text. That is your whole research, one
   record to a line, and every other panel is a reading of it.
3. **Change a line.** The rest of the board follows as you type. Nothing to save,
   nothing to reload.
4. **Click a name in Bricks.** Every panel narrows to the records that name that
   person, which is their family as the documents describe it.
5. **Add a panel.** Open the **🧰** tab on the right-hand edge, find
   **Promenade** under *Read only*, and press its **+**. Eight panels start off
   the board and this is the only way to reach them.
6. **Press Export.** Before you close the tab. [Keeping your work](#keeping-your-work)
   explains why this one matters more than it looks.

To bring in your own work, the Pallet's **☰** menu holds **Import**, **Merge**
and **Folder…**. Merge keeps what is already there. Folder reads every `.txt` in
a directory, subfolders included, and you can drop a folder straight onto the
panel.

---

## What a brick is

One line. One thing you know.

```
+|👤|<george-isles>|Powerloom Tender
```

| | |
|---|---|
| `+` | **A document says so.** Write `-` when you inferred it or have not checked yet. |
| `👤` | The type. Seven exist: person, place, birth, marriage, death, document and census. Write `👤`, `person` or `p` for the same thing. |
| `<george-isles>` | A uid you invent, so other records can point at this one. His displayed name comes from it, so `<george-isles>` shows as George Isles. |
| `Powerloom Tender` | A description or occupation. The Promenade reads the first clause of it as a trade and dresses him accordingly. |

You invent the symbols. The parser recognises each part by its shape rather than
its position, so angle brackets mean a uid wherever they fall on the line, and an
extra field or a missing one never throws the record away. A real corpus is
inconsistent, and a notation you defined yourself should not punish you for a
stray column.

You never have to type a pipe. **Brick Builder** gives you a field for each part
and writes the line.

### Brick and mortar

`+` and `-` carry more weight than anything else on the line. `+` is the brick:
what a document states, and it does not change. `-` is the mortar: your own
inference, which you expect to redo when a better record turns up. Panels draw
the two apart, so a drafted parentage grows dashed wood on the Tree and a year
scraped out of a note is drawn hollow on the Timeline. Mark it while the document
is still in front of you, because six months from now you will not remember which
was which.

### Declaring a name, and pointing at it

Declare a uid once, in angle brackets, on the record about that person or place.
Point at it from every other record with `@`:

```
+|👶|1893-02-11|@alice-isles,george-isles,margaret-kinnear
```

That is a birth, and the first person named is its subject. So this is Alice's
birth and the two after her are her parents, which is the only place the pile
records parentage and the one line the **Tree** is built from. Declare
`<alice-isles>` a second time and the page raises an error and changes nothing:
the first declaration stands, because a silent overwrite loses a record you
thought you still had.

### Ghosts

Reference a uid you never declared and the page keeps it anyway, drawn dotted in
Bricks and listed in Red Flags. That is a ghost, and it is usually the most
interesting thing in the pile: somebody you have only met inside another person's
record. Treat it as your next lead.

---

## Choosing your tools

**Treat the board as a bench.** Put out the panels you are using and put the rest
away. Eight start off the bench, because they are no use until you have records
to look at.

> **Promenade**, **Tree**, **Sprite Editor**, **Photo Ruler**, **Pixel Party
> City**, **Theme**, **Map Style** and **Map Editor** start off the board. You
> have to add them.

The **🧰** tab on the right-hand edge holds everything not currently out, with a
search box, and each entry says what that panel is for. It shrinks as you take
tools out and fills as you put them back.

The list is grouped by what a panel can do to your work, and every panel header
carries the same badges:

| | |
|---|---|
| `W` | Write. It changes the pile. |
| `F` | Filter. It can change what every other panel is showing. |
| `R` | Read only. |

| To do this | Do that |
|---|---|
| Add a panel | Press its **+**. It drops into the first free space. |
| Put it somewhere exact | Drag the entry out of the list and onto the board. |
| Change its size | The two number boxes on its entry: width × height, in cells. |
| Move one | Drag it by the **✥** handle in its top-left corner. |
| Swap two | Drag one onto another of the same size. |
| Grow or shrink it | The **+** and **−** buttons on its edges. Only the ones with room appear. |
| Take one off | The **×** in its corner. |
| Start over | **reset board**, in the 🧰 panel. |

**Putting a tool away never loses work.** Your bricks live in The Pallet, not in
the panel you closed. Take one off, put it back, and it returns exactly as you
left it, still scrolled where you were. Rearranging cannot break anything.

### Keeping one in sight

Drag a panel by its header and a dashed **+** appears at each edge of the
window. Drop it on one and the panel pins to that edge, where it stays while the
board scrolls past. The Pallet along the bottom while you work three screens
down is the usual reason.

Every edge keeps its own **+**, so a second panel can join it and share the
space. Drag the inside edge of the strip to make it thicker. On a pinned panel,
**⊞** puts it back in the cell it came from and **✕** takes it off the board.

### Finding your way back

The little grid in the bottom right corner is your whole board at about a
fiftieth scale, each panel at its own position and size. Click a block to scroll
straight to that panel. Hover a block to light the panel it stands for, or hover
a panel to light its block.

Two more controls at the top of the 🧰 panel: **Columns** for how wide the board
is, **Row px** for how tall a row sits.

---

## What each tool does

Most panels carry a **help** link beside their title that opens their own
write-up. In short:

**Laying.** **The Pallet** holds every brick and is the only source of truth on
the page. **Brick Builder** lays them for you. **Gazetteer** gives each declared
place its coordinates, so a `lat,lng` need not sit inside every place record.
Paste a pair straight out of Google Maps and it splits across both fields.

**Checking the work.** **Bricks** lists every uid you have named, people and
places and documents alike, with ghosts dotted. **Classification** shows every
line as the parser read it, so a line that appears nowhere else shows up here in
red. **Red Flags** collects what the parser objects to, errors in red and
warnings in amber. **Tally** counts the pile. **Notation reference** lists the
symbols, generated from the parser itself, so it cannot drift from what the code
accepts.

**Standing back.** **Timeline** puts every dated record in order, one lane per
person, plus a lane for dated records that name nobody. A year found in a note or
a heading rather than a date field is drawn hollow. **Tree** grows parents upward
and children below, rooted on whoever you last clicked, dashed wherever the
parentage is still a draft. **Map Viewer** puts places with coordinates on a
basemap. **Document** shows one scan big enough to read the handwriting.
**Promenade** stands your people in the places their records name.

**Drawing.** **Sprite Editor** draws the figures and buildings the Promenade
uses, a pixel at a time, and writes the marks that make a building work. **Pixel
Party City** holds drawings you have made but not saved to a file; a drawing
reaches a place by being named for that place's uid. **Photo Ruler** measures a
photograph: draw a line along something whose size you know, say what it is
worth, and every other line reads in the unit you picked. Calibrate with four
points and it undoes the photograph's perspective first.

**Your own hand.** **Filter** narrows every panel at once, and every control on
it is read back out of your own text: your `#` headings are the groupings, your
type tokens are the kinds, `+` and `-` are the confidence. **Theme** is eight
colors. **Map Style** and **Map Editor** are the map's own look, and your own
additions to it.

**A drawing can carry marks in its own pixels.** In the Sprite Editor you can
flag pixels as glass, a door, a chimney, or the spot the signpost stands on. The
mark hides in the pixel's alpha, so the picture looks identical. On the Promenade
the glass lights at night, the chimneys smoke, and the door is a thing you can
knock on. Details in [the Promenade's own page](doc/promenade.html#marks).

---

## Keeping your work

Read this part twice.

Your bricks live in this browser, not on a server. Nothing is uploaded and nobody
else can see it. That privacy has a price:

> **Clearing your browsing data will delete your work.** So will a browser that
> tidies up after itself, and so will opening the page on another computer.

So **press Export**. It writes an ordinary text file onto your computer, and that
file is the only copy that is truly yours. Export again every time you have added
a stretch worth keeping.

Two controls sit beside it. **auto** is on by default and writes to browser
storage as you type; **Save to browser** writes once when you press it. Neither
one gives you a file.

The status line beside them speaks up when it has something to say: where the
pile came from, when it last saved, and when it last left the browser as a file.
It turns red when this browser is refusing to store anything, which is the moment
Export stops being advice.

The Promenade saves separately. Its **save** button hands you a `brick.json`
holding where you placed people and how you coloured the columns. Drop that
beside your `bricks/` folder and it loads with them.

**Clear all**, next to Export, starts a new project. It asks first, lists what
will go with live counts, and says so if you have never exported. It takes the
pile, the gazetteer, your placements and column colours, the board layout, the
map's project file and style, and **every drawing Pixel Party City is holding**.
Export does not back those up. Download a drawing you want to keep before you
press it.

It keeps your themes, your tile key, and how you dressed the Promenade: sign
heights, the hour, where the sun hangs, the weather, the clouds, the smoke. Those
carry into the next project.

---

## When something looks wrong

| | |
|---|---|
| A line isn't showing up | Look at it in *Classification*. Red usually means a missing `\|`. |
| Someone's appeared twice | Two uids for one person. Pick one, use it everywhere. |
| A name is dotted | Mentioned, never declared. Not an error. A lead. |
| The map is blank | Places need coordinates. Add them in *Gazetteer*. |
| The map is blue and empty | The custom basemap only loads over `http` or `https`. Opened from a `file://` path, the map falls back to a plain demo style. |
| The Promenade is empty | It fetches its drawing engine the first time you open it, so it needs a connection once. |
| Everything's vanished | Check *Filter*. Something is still switched on from earlier. |

---

## Four things worth knowing

**No one hands you the plan.** Headings starting with `#` become your groupings:
a family, a village, a court case, a theory you are testing. The page uses your
categories and never imposes its own.

**Keep the wrong records.** Mark it `-`, say why you doubt it, and leave it in. A
contradiction you have written down is research; one you have deleted is a hole
you will fall into again next year.

**Strength comes from the overlap.** One record saying a thing rests on one
clerk's handwriting. Two records from different sources naming the same person
hold each other up, and that overlap is what links and the map's connector lines
show you. A connector is orange where a single record names both places and grey
where you inferred the pairing from one person turning up at each.

**Nothing is locked away.** Your whole pile is plain text, readable in any editor
on any computer in twenty years, with or without this page.

---

> **Note on this document.** Written by an AI assistant during development, and
> not yet reviewed line by line. It describes the code as it stood when written,
> so parts of it have drifted. Treat it as a working draft.

[The full documentation](doc/documentation.html) covers the research folder, the
notation in detail, the map project file, and how to register a panel of your
own. [The Promenade](doc/promenade.html) has a page to itself, including the
sprite-sheet spec.
