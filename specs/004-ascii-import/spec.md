# Feature Specification: Import ASCII tab by pasting text

**Feature Branch**: `004-ascii-import`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Parse ASCII tab back into parts, so a riff that already exists as text does not have to be re-entered with thumbs." (full roadmap entry, with file references for planning: `.specify/roadmaps/capture-expression.json`, entry `ascii-import`)

## Summary

Bands already have their riffs as text, in chat and on the web, and the only way into the app is tapping them in again. This entry adds a paste target on the song screen. The person pastes tab, sees it drawn by the same staff the app uses everywhere, and imports it as one new part. If any line cannot be read, the import says which line and why, and imports nothing.

The format is the one the app already writes. Everything the text export emits must come back. Tab from the wild is accepted where the differences are only whitespace and rails, and refused where reading it would mean guessing at notes.

A plausible-looking wrong tab is worse than a refusal. Every rule below follows from that sentence.

### What "the inverse" can and cannot mean

The brief asks that parsing rendered text reproduces the events it came from. The export does not carry everything, so this spec states exactly what comes back.

| Stored | Comes back | What the text cannot carry |
|---|---|---|
| Notes, dead notes, frets | Exactly | |
| Barlines | Exactly, so bars number the same | |
| Repeats | Exactly, by the rule in **Reading repeats** | Expanded text draws `repeat: 4` as four columns, the same as four separate columns. Separately stored identical columns come back as one repeated column. Identical columns in a counted group may split differently: stored `5 5x8 5`, drawn as ten 5s, comes back as `5x8 5 5`. It draws the same. |
| Spaces | By the rule in **Reading rails** | They are drawn as rails. A repeated space draws as one space in compact density. A column stored as notes with nothing on it draws as a space, and comes back as one. |
| Groups | Extent, number and presentation | A group with no stored kind comes back as a counted tuplet, which reads the same. An older group crossing a barline is drawn as two brackets and comes back as two groups. |
| Chords | On the same column | Two chords on neighbouring columns can overwrite each other when drawn: `Am7` then `G` draws `AmG`. The `7` is lost before import sees it. A chord value that is not a chord symbol comes back as commentary. |
| Techniques | Every one that is drawn | A transition on the first note of a string, a second transition on one string, `dead_note` and anything unknown are stored but never drawn. |
| Durations | Not at all | The export does not write them. |

The test of the inverse is therefore two properties, not one:

1. **Same events.** For every fixture in the export's test file, at both densities, parsing the rendered text gives the events it was rendered from, column for column, ignoring only ids and ranks. Only what the table above says the text cannot carry is excluded.
2. **Same text.** Drawing the parsed result again at the density it was written in gives the identical string. This holds for all export output, with one named exception: compact text containing no repeat label cannot be told apart from expanded text and is read as expanded, so it comes back identical in expanded density.

### What the parser reads

Lines are sorted into five kinds. Each line number below counts from 1 at the first line of the paste, blank lines included.

| Line | What it is | What happens |
|---|---|---|
| **Staff row** | An optional gutter, an optional string label, a pipe or rails, then a body | Read as one string of a system |
| **Chord row** | Directly above a staff, or above its bracket row, and every symbol on it is a chord | Read as chords |
| **Bracket row** | Directly above a staff, holding only commas, rails, digits and spaces, with at least one comma or digit | Read as groups |
| **Blank** | Only whitespace | Separates systems |
| **Commentary** | Anything else that cannot be mistaken for a staff row | Ignored, and listed in the preview |

**The rule that protects a dropped string:** a line that might be a damaged staff row is never commentary. A line that starts with a string label followed, after any spaces, by a pipe or rails, or starts with a pipe, or holds a run of three or more rails and a fret, is a staff row. If it then cannot be read, the import refuses. So `B |--?--|` refuses rather than vanishing and leaving a tidy four-row staff.

### What a staff row's body may contain

Exactly the notation the app defines, in `specs/002-playing-techniques/contracts/notation.md` and `specs/003-generalised-grouping/contracts/notation.md`.

| Element | Text | Becomes |
|---|---|---|
| Rail | `-` of any run length | Spacing, or a space column (see **Reading rails**) |
| Fret | `0` to `36` | A note |
| Dead note | `x`, also `X` | A dead note |
| Barline | `\|` on every row at the same position | One stored barline |
| Double barline | `\|\|` | One stored barline, so a bar is not invented between them |
| Transition | `h` `p` `/` `\`, also `H` `P`, in the gap before a note | Stored on the arriving note, on that string |
| Decoration | `t`, `( )`, `< >`, `b`, `~`, `m`, in the fixed order | Stored on that note |
| Repeat label | `x<n>`, last in the cell, the same on every played string of the column | One column with `repeat: n` |

The full cell, in order, is `t(<7>)b~mx3`.

### Reading rails

The app draws a space column as rails, with every column one rail apart, so `-7---5-` is three columns. Hand-typed tab uses rails freely, so `---7---5---` is two notes. The text alone cannot always separate these, and getting it wrong in one direction loses spaces while getting it wrong in the other fills a part with columns nobody asked for.

**The paste is read on the app's grid only if it has the app's exact shape**, and on no other condition:

- every staff row is a label, at least one space, a pipe, a body and a closing pipe,
- every row of a system is the same length, with its pipes in the same positions, and
- every run of rails, once column widths are allowed for and with a connector counting as a rail, has an odd length.

In that shape, each pair of rails beyond the one between columns is a space, so `G |---7---|` is a space, a 7 and a space. In any other paste, rails are spacing only and no space columns are made. One reading applies to the whole paste. `E|---7---5---|` is two notes, and the preview shows if spaces were read.

### Reading repeats

A compact label says its repeat outright: `7x8` is one column with `repeat: 8`.

Expanded text has no label, and the app stores a run of identical hits as one repeated column. So when a paste has no repeat label anywhere, a run of identical neighbouring columns becomes one repeated column. `-7-7-7-7-` is one column with `repeat: 4`, which is what the first fixture in the export's tests was drawn from.

A run stops at anything that makes the columns different: a barline, a different fret or technique on any string, a chord on a later column, or the edge of a group. In `5h7h7h7` the three arrivals merge and the 5 does not.

A paste with a repeat label anywhere is compact, so it says what it means and nothing merges.

Inside a group the bracket decides, because a counted group's number counts stored columns:

| Group | Drawn columns | Result |
|---|---|---|
| Counted, number equals the drawn columns | `,-3-,` over `5-5-5` | Three columns, nothing merges |
| Counted, more drawn columns than the number | `,--------3--------,` over `3-5-5-5-5-5-5-5-5-7` | Identical neighbours merge only as far as reaching 3, earliest first |
| Counted, the number cannot be reached | `,3,` over `5-7` | Nothing merges, and the number is kept as drawn |
| Plain | `,-----,` over `5-5-5-5` | Nothing merges. A plain group must keep at least two columns |

### Reading tuning

The app stores frets, so a fret on the wrong string is a wrong note even though it looks right. Row labels are therefore checked, not trusted.

**The paste fits the song when every row with anything on it sits at the same position from the top as a string with the same note name.** Names compare by sound, so `D#` matches `Eb`, case does not matter, and an octave number on a label is ignored.

This one rule covers several cases, and the numbering in the README is why it works:

| Paste | Song | Result |
|---|---|---|
| `G D A E` | `G D A E` | Fits |
| `Eb Bb F C` | `D# A# F C` | Fits |
| `G D A E` | `G D A E B` | Fits. Strings number from the top, so a four-string riff is already correct on a five-string. The B string stays empty |
| `G D A E B`, nothing on the B row | `G D A E` | Fits. The preview says the empty B row was left out |
| `G D A E B`, notes on the B row | `G D A E` | Does not fit |
| `G D A D`, notes on the low row | `G D A E` | Does not fit |
| `E A D G` | `G D A E` | Does not fit. The rows run lowest first, and the message says so |

**When it does not fit, the app offers an exact tuning or refuses. It never offers a closest one.** A closest tuning is a tuning in which some frets are the wrong pitch, which is the failure this rule exists to stop.

1. Look for a tuning with the same number of strings and the same note names, top to bottom: the band's tunings first, then the presets.
2. If there is one, and **every note already in the song keeps its pitch** under it, offer it. The preview draws in that tuning and the import button names the change: "Switch to B Standard and import". An empty song always qualifies, and so does a four-string song moving to the five-string tuning that extends it.
3. Otherwise refuse, with a message naming both tunings and the row that does not match, and pointing at a new song as the way through.

The app does not create a tuning from the labels. Labels give note names, not octaves, so a created tuning would be a guess about pitch. A preset the band does not yet have is added to the band when the import is committed, because a preset is a known tuning, not a guess.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Bring back text the app wrote (Priority: P1)

A bandmate pasted a part into the group chat from the app's export. The bassist opens the song, taps paste tab, pastes it, and sees the staff drawn with every chord, bracket, hammer-on and barline where it was. They tap import, and a new part appears with the next free letter. They did not re-enter a note.

**Why this priority**: This is the inverse the entry exists to build, and it is the smallest thing that delivers the capability. Nothing else in this spec works without it.

**Independent Test**: Render a part that uses every piece of notation, paste the text into a song with the same tuning, and import. The new part draws identically to the original, at both densities, and the arrangement's bar ranges mean the same bars on it.

**Acceptance Scenarios**:

1. **Given** a song with parts A and B, **When** the person pastes readable tab and imports it, **Then** a new part C exists, holding exactly what the preview drew, and the arrangement is unchanged.
2. **Given** pasted text, **When** the preview draws, **Then** nothing has been written to the device, and leaving now changes nothing.
3. **Given** a staff whose E row is `E |-7x16-5-|`, **When** it is imported, **Then** the part has two columns, the first with `repeat: 16`.
4. **Given** a staff whose E row is `E |-7-7-7-7-|` and whose other rows are rails, **When** it is imported, **Then** the part has one column with `repeat: 4`, and it draws as four columns in expanded density and `7x4` in compact.
5. **Given** a staff whose E row is `E |-7-|-5-|-3-|`, **When** it is imported, **Then** two stored barlines separate three bars, numbered as they were in the source.
6. **Given** a chord symbol above a column, **When** it is imported, **Then** that column carries the chord.
7. **Given** `,-3-,` over three columns and `,-----,` over four others, **When** it is imported, **Then** the first three share one counted group of 3 and the next four share one plain group, each with its own new group id.
8. **Given** a staff whose E row is `E |-5h7-7p5-5/7-7\5-|`, **When** it is imported, **Then** each arriving note stores its transition, and the text draws back unchanged.
9. **Given** `t(<7>)b~m`, **When** it is imported, **Then** the note stores all six decorations.
10. **Given** an import has completed, **When** the device next syncs, **Then** the new part, its columns and its chords reach other devices with no row refused.
11. **Given** no network, **When** the person pastes and imports, **Then** it works and the rows wait to sync, like any other write.

---

### User Story 2 - Paste tab found in the wild (Priority: P1)

The riff is on a website, typed by a stranger: labels flush against the pipes, uneven rails, three stacked systems, a line of lyrics between two of them. The bassist pastes the lot. The preview shows one continuous part, and lists the lyric line as ignored so they can see nothing else went missing.

**Why this priority**: The brief calls this the highest-value capability the app is missing, and most text a band has was not written by this app. The round trip alone would leave that text out of reach.

**Independent Test**: Paste a hand-typed two-system tab with `E|` labels, long rails, trailing spaces and a lyric line between the systems. One part is previewed, with the notes in order and the bars numbered through both systems.

**Acceptance Scenarios**:

1. **Given** a tab labelled `E|` with no space before the pipe, **When** it is pasted, **Then** its notes read the same as under `E |`.
2. **Given** rows with different gutters but aligned pipes, or labels of different widths with no padding, **When** it is pasted, **Then** each row is read from its own opening pipe, so its notes line up with the other rows.
3. **Given** a staff whose E row is `E|---5-----7---|`, **When** it is pasted, **Then** there are two notes and no space columns.
4. **Given** trailing whitespace, Windows line endings or non-breaking spaces in the gutter, **When** it is pasted, **Then** the notes read as if they were not there.
5. **Given** two systems separated by a blank line, a line of lyrics or both, **When** it is pasted, **Then** one part is previewed, with the systems joined in order.
6. **Given** the upper system ends in a closing pipe, **When** two systems are joined, **Then** one barline falls at the join, so the bars count through. If it has no closing pipe, no barline is added.
7. **Given** a lyric line, a `P.M.----|` line or a beat count, **When** the preview draws, **Then** each ignored line is listed with its line number.
8. **Given** rows with no labels and exactly as many rows as the song has strings, **When** it is pasted, **Then** they are read top down as the song's strings, and the preview says so.
9. **Given** a chord that does not sit exactly over a column, **When** it is pasted, **Then** it anchors to the nearest column that is not a barline, preferring the one to its right, and the preview shows where it landed.
10. **Given** a column of a two-digit fret above a single digit, aligned at either end, **When** it is pasted, **Then** they are one column.

---

### User Story 3 - Be told exactly what could not be read (Priority: P1)

The tab has `7b9` in it, and the app has no way to store a bend target. The preview does not draw. It says line 4 has something it cannot read, shows the line, and says why. The bassist fixes the line in the paste box, and the preview appears. Nothing was imported in between.

**Why this priority**: The entry's central promise is that a refusal is better than a wrong tab. Tolerance without this would land quietly damaged parts, which is worse than the tapping it replaces.

**Independent Test**: Paste text with one bad line among good ones. The import button is not available, the message names that line and the reason, and no part, column, chord or tuning is created.

**Acceptance Scenarios**:

1. **Given** a paste with one unreadable line and any number of good ones, **When** it is read, **Then** the import is refused as a whole.
2. **Given** several unreadable lines, **When** it is read, **Then** each is listed with its line number, its text and its reason, in order.
3. **Given** a refusal, **When** the person edits the text in the paste box, **Then** it is read again and the result updates, with no need to start over.
4. **Given** the paste has no staff in it, or a staff with no notes, **When** it is read, **Then** the message says so, and there is nothing to import.
5. **Given** a successful read, **When** the person cancels, **Then** nothing is written.
6. **Given** the local write fails during import, **When** it fails, **Then** nothing is left behind, the pasted text stays in the box, and the person is told.

---

### User Story 4 - Paste a tab written for a different tuning (Priority: P2)

A five-string riff is pasted into a song set to the band's four-string tuning, and the low row has notes on it. The app does not squeeze it onto four strings and does not drop the row. The song has no notes yet, so it offers the exact five-string tuning, draws the preview in it, and the import button says what it will do. In another song, full of four-string parts in a different tuning, the same paste is refused with a message naming both tunings.

**Why this priority**: The brief names this as the main failure mode. It ranks below the first three because a paste that matches the song, the common case, works without it, and the refusal path is delivered by Story 3.

**Independent Test**: Paste five labelled rows into an empty four-string song and accept the offer. The song is now five-string, the part holds all five rows, and the staff shows them. Paste the same text into a song whose captured notes would change pitch, and the import is refused with no change to the song.

**Acceptance Scenarios**:

1. **Given** labels that match the song's strings, **When** it is pasted, **Then** no tuning message appears.
2. **Given** a four-row `G D A E` paste and a song in `G D A E B`, **When** it is imported, **Then** the notes keep their strings, the B row is drawn empty, and no tuning changes.
3. **Given** a five-row paste with an empty low row and a four-string song, **When** it is pasted, **Then** it fits, and the preview says the empty row was left out.
4. **Given** a five-row paste with notes on the low row, a four-string song and no notes in the song, **When** it is pasted, **Then** the matching tuning is offered, the preview draws in it, and the import button names the switch.
5. **Given** a four-string `G D A E` song holding notes, and a paste in the five-string tuning that extends it, **When** it is pasted, **Then** the tuning is offered, because every captured note keeps its pitch.
6. **Given** a song holding notes that would change pitch or lose their string under the matching tuning, **When** it is pasted, **Then** the import is refused, and the song is unchanged.
7. **Given** labels matching no band tuning and no preset, **When** it is pasted, **Then** the import is refused, naming the labels and the song's tuning.
8. **Given** the offered tuning is a preset the band does not have, **When** the import is committed, **Then** the band gains that tuning and the song uses it, and the band's default tuning does not change.
9. **Given** the offer is taken, **When** the import fails, **Then** neither the tuning, the song nor the part has changed.
10. **Given** a five-row paste with a fret on every row, **When** it is read, **Then** no outcome loses a row: it imports whole, or it is refused.

---

### Edge Cases

**Refused, with the line and the reason:**

- **A character the notation does not have.** Anything in a staff body outside the table above, including `s` for a slide, `r` for a release, and `^`.
- **A bend target, or two notes with no gap.** `7b9`, `12t17` and `xx` are not cells followed by cells. Reading `7b9` as a bend and then a fret 9 would invent a note. Fret text over 36, which is how `57` (two notes run together) shows up, is refused for the same reason.
- **A long dash.** `—` or `–`, which is what a phone's autocorrect leaves in place of `--`. Each one has also shifted the row, so the alignment can no longer be trusted.
- **A space inside a staff body.** Only rails separate notes.
- **Repeat signs.** `|:`, `:|`, and text after the closing pipe such as `| x4`. Ignoring them would give a part with a fraction of its notes. Repetition belongs to the arrangement, which stays hand-built.
- **A barline on only some rows**, or rows of a system with pipes at different positions.
- **Rows of different lengths.** Allowed only when the difference is rails after the last note and no row has a closing pipe. Anywhere else, one of the rows has slipped and the columns cannot be matched.
- **Cells that overlap without one containing the other.** `12` above `34` shifted by one is not a chord anyone can be sure of.
- **Repeat labels that disagree in one column**, or a label on some of a column's notes and not others. Also a repeat of 0, or above 512, which sync would refuse.
- **A connector with nothing to join.** No earlier note on that string, or no note after it. It would store a technique the staff cannot draw, so the preview would not be the truth.
- **Rows out of step between systems.** Systems with different row counts or labels are not one part.
- **Labels on some rows and not others**, a label that is not a note name, or `T` `A` `B` down the gutter.
- **A lone staff row, or rows split by a line.** A blank or commentary line inside a system separates the rows, and the pieces then fail on row count. This is also how double-spaced pastes fail.
- **A bracket that cannot be placed.** It does not start and end on columns, it crosses a barline, or its number is outside 2 to 16. A group never crosses a barline, and sync would refuse the number and block the batch behind it.
- **Two chords landing on one column**, or a chord with no column to land on.
- **More than one part in the paste.** The song export writes a heading above each part. Pasted whole, the systems would otherwise join into one long plausible part. A line that reads exactly as such a heading, with a system above it, refuses, and the message says to paste one part at a time.

**Accepted, and worth saying:**

- **A single part cut from a song export**, with its title, arrangement line and heading above it. There is one system, so those lines are commentary and are listed.
- **`(7)` in wild tab**, where it often means a ghost note. This app's notation says let ring, and one meaning has to win. The preview draws it as written.
- **A lone letter at the left margin above a staff.** `A` or `B'` flush left is the export's part heading, not a chord, so it is commentary. The app's own chord rows are always indented by the gutter. A wild chord row holding one symbol flush left is therefore listed as ignored and not stored.
- **A song with no tuning at all.** Nothing fits, so an exact tuning is offered if labels name one. Unlabelled rows are refused, because there is no string count to read them against.
- **A stored barline at the very start or end.** `G |-|-7-|-|` holds two barlines, and the outer pipes hold none. Opening and closing pipes are never events.
- **Short bracket forms.** `3`, `3,`, `,` and `,,` are accepted when they sit exactly over columns. A digits-only line that does not fit this, such as a beat count `1   2   3   4`, is commentary.
- **Chords that touch.** `AmDm` is split at the columns beneath it. A symbol that reads as a chord whole, such as `Am7`, stays whole.
- **Free text above a column.** `riff` over a column is not a chord, so that line is commentary and is listed. `N.C.` is read as a chord row entry.
- **A connector across a barline or a join.** The source is the last note on that string in the part, as when drawing. `5-|/7` joins, and so does `h7` opening a second system.
- **A connector separated from its arrival by rails**, as in `5h-7`. It belongs to the next note on that string.
- **An identical run of more than 512.** It becomes as many repeated columns as it takes.
- **Section headings in wild tab**, such as `[Verse]`. They are commentary, so verse and chorus pasted together join into one part. The preview shows the whole length and lists the headings, and sections are not imported.

## Requirements *(mandatory)*

### Functional Requirements

**Reading the app's own text**

- **FR-001**: The system MUST read every shape the text export emits, at both densities: staff rows with labels and pipes, frets to two digits, dead notes, barlines, repeat labels, space columns, chord rows, bracket rows in counted, plain and short forms, connectors and decorations.
- **FR-002**: The string in a staff's top row MUST become string index 0, the next row index 1, and so on. Reading a row's position any other way is a wrong note.
- **FR-003**: Each barline MUST become one stored barline in its exact position, so that bar numbers, and the arrangement's bar ranges, mean the same bars as in the source. A row's opening and closing pipes MUST NOT become barlines.
- **FR-004**: A repeat label MUST become one column with that repeat, on every string played in the column.
- **FR-005**: When a paste has no repeat label, runs of identical neighbouring columns MUST become one repeated column, under the limits in **Reading repeats**. When it has one, columns MUST NOT merge.
- **FR-006**: A space column MUST be read only under the rule in **Reading rails**. A run of spaces MUST then follow FR-005 like any other columns.
- **FR-007**: A chord MUST be stored as a chord annotation on the column beneath it. A chord MUST NOT anchor to a barline, and on a repeated column it belongs to the first pass.
- **FR-008**: A bracket holding digits MUST become a counted tuplet with that number. A bracket holding none MUST become a plain group. All columns under a bracket MUST share one newly made group id, and each group MUST store the three fields in the stored-states table of `specs/003-generalised-grouping/spec.md`.
- **FR-009**: A transition glyph MUST be stored on the arriving note, on that string. Each decoration MUST be stored on its note, on that string.
- **FR-010**: A dead note MUST be stored as a dead note fret value, and MUST NOT add any technique.

**Tolerance**

- **FR-011**: The system MUST accept leading gutters of any width, `E|` and `E |`, runs of rails of any length, trailing whitespace, any line-ending style, non-breaking spaces outside a staff body, and blank lines between systems.
- **FR-012**: Each row MUST be aligned on the start of its own body, just after its opening pipe or, with no pipe, just after its label, so that gutters and label widths do not shift its notes. Chord and bracket rows MUST be aligned against the top row of the staff beneath them.
- **FR-013**: Multiple systems of one part MUST join in order into one part, with one barline at a join whose upper system ends in a closing pipe. Chords and brackets MUST be read per system, against the staff beneath them.
- **FR-014**: Cells on different rows MUST be one column when one contains the other, which covers tab that aligns two-digit frets at either end.
- **FR-015**: Unlabelled rows MUST be accepted only when every row is unlabelled and there are exactly as many as the song has strings. The preview MUST say the rows were read top down as the song's strings.
- **FR-016**: Commentary MUST be ignored only under the rule in **What the parser reads**. Every ignored line MUST be listed in the preview with its line number.

**Refusing**

- **FR-017**: Any line that cannot be read MUST refuse the whole import. No partial part may ever be offered or written.
- **FR-018**: Every refusal MUST give the line number, the line's text, and a reason in plain words, for every such line, not only the first. It MUST cover every case in the refused list under Edge Cases.
- **FR-019**: A paste holding no notes MUST say so, and MUST NOT offer an import.
- **FR-020**: Everything read MUST stay inside the limits sync enforces: frets 0 to 36, repeat 1 to 512, group numbers 2 to 16, and a chord of at most 200 characters. A row outside them is refused by the server, and one refused row blocks the batch behind it, so such text MUST be refused at import.

**String count and tuning**

- **FR-021**: The paste MUST be checked against the song's tuning using the fit rule in **Reading tuning**. No row with anything on it may be dropped, moved to another string, or imported onto a string of a different name.
- **FR-022**: A row left out because it is empty MUST be named in the preview.
- **FR-023**: When the paste does not fit, the system MUST offer only a tuning with the same string count and the same names, in the order given in **Reading tuning**, and only when every note already in the song keeps its pitch under it. It MUST NOT offer a merely similar tuning.
- **FR-024**: When no such offer can be made, the import MUST be refused with a message naming the paste's strings, the song's tuning, and the first row that does not match. Rows that run lowest first MUST be identified as such.
- **FR-025**: Taking an offer MUST set that song's tuning only. It MUST NOT change the band's default, or any other song. It MUST NOT happen before the import is committed.
- **FR-026**: The system MUST NOT create a tuning from labels. It MAY add a known preset to the band as part of a committed import.

**The paste target and preview**

- **FR-027**: The song screen MUST offer a paste tab control beside the control that adds a part, and also when the song has no parts. It MUST be available offline, and MUST NOT need clipboard permission.
- **FR-028**: The target MUST be a text box. Reading MUST update as the text changes, with no separate step to read it.
- **FR-029**: The preview MUST be drawn by the same staff component and layout as every other part, from the columns that will be written, in the song screen's current density. There MUST NOT be a second renderer.
- **FR-030**: The preview MUST say which letter the part will get and how many bars and columns it has, and MUST list anything ignored, left out or assumed.
- **FR-031**: The preview MUST write nothing. Cancelling at any point MUST leave the device exactly as it was.
- **FR-032**: Refusals and the result of reading MUST be announced to assistive technology, and the preview's columns MUST keep the staff's existing screen-reader descriptions.
- **FR-033**: The paste box, messages, preview and buttons MUST be usable and legible at the smallest supported phone viewport in both themes, checked in a browser at actual size. A long line in the box or a message MUST NOT widen the page. No new visual tier may be opacity over a surface token.

**Writing**

- **FR-034**: An import MUST create exactly one new part, lettered by the same rule as any new part, at the end of the song's parts. It MUST NOT add to or replace an existing part, and MUST NOT touch the arrangement.
- **FR-035**: Every row MUST go through the app's existing write path, so ids are newly minted, ranks are fractional and evenly spread, every field is clocked and every row is queued for sync. Nothing may write to the local store directly.
- **FR-036**: The tuning, song change, part, columns and chords MUST be written as one batch, so that a failure leaves nothing behind.
- **FR-037**: Importing MUST happen once per tap. A second tap, or a tap while the write is in progress, MUST NOT create a second part.
- **FR-038**: After a successful import the paste target MUST close and the new part MUST be visible on the song screen, drawing what the preview drew.

**Boundaries**

- **FR-039**: This entry MUST NOT change the text the export writes, the export's test suites, the stored model, the wire protocol or the database schema, and MUST NOT include a migration.
- **FR-040**: The round-trip suite MUST be the backbone of this entry's tests. It MUST run every fixture of the export's test file through both properties in **What "the inverse" can and cannot mean**, at both densities, and MUST also cover the fixtures in the techniques and grouping test files and the exact fixture in the notation contract. A shape listed in the table as not coming back MUST be asserted as such, and not skipped silently.

### Key Entities

- **Paste**: The text as given, with line numbers. It is never stored.
- **System**: One block of staff rows with its optional chord and bracket rows. Several systems of one paste form one part.
- **Reading**: The outcome of a paste. It is either a part's worth of columns and chords with its notes for the preview, or a list of refusals, and it never holds both.
- **Refusal**: A line number, the line's text and a reason.
- **Fit**: How a reading relates to the song's tuning: fits, an offered tuning, or refused.
- **Part, column, chord, group, tuning**: The existing stored rows. This entry adds none.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every fixture in the export's test file, at both densities, parses back to the columns it was rendered from, with every field the export draws identical: 100%, no exclusions beyond the table in the Summary.
- **SC-002**: Every string the export can write draws back character for character at its own density, with only the one exception named in the Summary.
- **SC-003**: Zero cases, across the refused list under Edge Cases, end with a part created or any row written.
- **SC-004**: In every refusal, the person can tell which line to fix and why without opening any other screen.
- **SC-005**: A person can go from a tab in another app to a saved eight-bar part in under 30 seconds on a phone, where tapping it in takes minutes.
- **SC-006**: A hand-typed tab of 16 bars across four systems with a lyric line between each imports in one paste, with bars numbered 1 to 16.
- **SC-007**: A paste of 2,000 columns previews with no perceptible delay in typing, and imports without freezing the screen.
- **SC-008**: An imported part syncs to a second device with zero rows refused.
- **SC-009**: No row with a note on it is lost or moved to a differently named string in any tuning scenario in Story 4.
- **SC-010**: At the smallest supported phone viewport, in both themes, the whole flow can be completed with no horizontal page scrolling and with all text legible at actual size.

## Out of Scope

- **Importing the arrangement line, part letters or sections.** One paste makes one part's notes, and the arrangement stays hand-built.
- **MusicXML, Guitar Pro files, Songsterr or any other fetched source.**
- **Any change to the export.** `toAscii` already works, including where its chord row overwrites itself.
- **Pasting into an existing part**, at the cursor or otherwise.
- **Notation the app does not have.** Bend targets, `s` slides, release marks, repeat signs and palm-mute span rows stay refused or ignored. Each is a later decision about what the app stores, not about parsing.
- **Reading durations from text.** Entry `rhythm-and-tempo`.
- **Creating a custom tuning.** The app has no such screen, and labels do not give octaves.
- **Permissions for viewers.** The song screen does not gate any other write by role, and this entry does not start. The server's existing rule applies.

## Assumptions

Decisions taken where the entry left room, so that planning does not have to stop and ask. They are made on the standing instruction to decide and move on, and the first seven are the ones worth a second look.

- **Tuning: offer exact or refuse, never closest, never invent.** The brief asked for a decision. See **Reading tuning**. The safety condition, that every captured note keeps its pitch, is what lets a four-string song grow into five strings without risk, which is the reason the numbering runs from the top.
- **Expanded runs become repeated columns.** The brief only requires this of `7x8`, but the first fixture in the export's tests is a stored `repeat: 4` drawn as four columns, and the brief requires fixtures to come back. It also matches how the app stores this music. The cost is that two separately captured identical notes come back as one repeated column, drawing the same.
- **Spaces are read only from the app's exact shape.** See **Reading rails**. `E |---7---5---|` typed by hand with a space before the pipe gets read as the app's, and gains space columns. The notes are still right, and the preview shows it.
- **A closing pipe at a join is a barline.** Tab systems nearly always break at a bar, and this keeps bar numbers true. A system with no closing pipe is treated as mid-bar.
- **Commentary between systems does not separate parts**, as the brief requires, with one exception: a line that reads exactly like the song export's part heading refuses. Otherwise, pasting a whole song export would silently join all its parts into one, and that is the app's own most common text.
- **Unlabelled rows are accepted by count.** The brief speaks only of labelled rows. Top-to-bottom is universal in tab, and the song's labels appear in the preview.
- **Only `X`, `H` and `P` get a case allowance.** The brief asks for generosity about whitespace and rails only. These three have one possible meaning and are common enough to be worth it. Anything else outside the notation refuses, including decorations in a different order.
- **Frets up to 36 are accepted**, matching what sync accepts, though the capture neck stops at 24. A run-together `35` therefore reads as fret 35, and the preview shows it as written.
- **The new part is unnamed.** A name is one tap away on the part card, and nothing in a paste reliably gives one.
- **The preview follows the song screen's density toggle**, so both views are available without a new control.
- **Writing reuses what paste already does.** The brief names `src/lib/local/editing.ts`. The existing paste of copied columns already writes a run with fresh ids, evenly spread ranks, fresh group ids and anchored chords in one batch, and the columns a reading produces can take that shape. The plan should build on it, not write a second run writer, and must keep the part, the tuning and the columns in one batch.
- **The export's test file is left unedited.** The round-trip suite needs its fixtures without changing that file. How is for the plan to settle.
- **The chord grammar is the app's existing chord reader**, plus `N.C.`. It decides what makes a chord row, and a line it does not fully accept is commentary.
- **Verification is both automated and visual.** The round-trip suite is the evidence for the parser. The browser pass at actual size in both themes is the evidence for the screen, and it happens after merge, from the verify worktree, as for the earlier entries.
- **Two repo traps are assumed known.** If a style change seems to do nothing, restart with `npm run dev:clean` before looking at the CSS. A visual tier must be a named colour per theme, not opacity over a surface.
