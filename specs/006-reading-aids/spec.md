# Feature Specification: Note names, intervals, and seeing what a variant changed

**Feature Branch**: `006-reading-aids`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Two read-side features that make a captured part easier to understand. Both are presentation over data that already exists, and neither writes anything new." (full roadmap entry, with file references for planning: `.specify/roadmaps/capture-expression.json`, entry `reading-aids`)

## Summary

Two ways of reading a part that the app cannot offer today, both drawn on the staff the app already has:

1. **The staff can say what the notes are.** A three-way view control switches the staff between fret numbers, note names and intervals from the chord in force. Fret numbers say where to put a finger; the other two say what the line is doing.
2. **A variant shows what it changed.** Wherever a variant is drawn on the song page or the play view, the columns that differ from its parent are marked, and one line says how many and where.

Nothing here changes a song. No field, table, migration or sync message is added, and the text export does not change at all. The one thing written is the reader's own view choice, which stays on the device.

Two sentences settle most of what follows. A staff must never say something about a note that the stored data cannot back up. And a reader must never have to take a label for a fret number, or a fret number for a label.

### Where the brief and the code differ

The roadmap entry was written earlier and some of its details have moved. This spec follows the code.

| The brief says | The code says | What this spec does |
|---|---|---|
| Column width is at `layout.ts:132` | The width is computed where each column is built, in `layoutPart`. Line 132 now falls in that function's doc comment. | Same rule, new location: the widest cell sets the width. See FR-013. |
| The caret must stay aligned when the toggle flips | Only the capture screen draws a caret, and capture stays in fret numbers (FR-004) | The caret cannot meet a label in the app. FR-014 still requires it to line up if a staff is ever given both. |
| Copy and paste has fresh ids, so diff by content | True, and `createVariant`, the usual route, is the opposite: fresh event ids but the **same** group ids as the parent. A comparison that used group ids would pass on every made variant and fail on every pasted one. | Group membership is compared by shape, never by id. See FR-022. |
| Note names are a rendering of the pitch | The decoration letters were designed to sit next to digits. Next to a note name they read as something else: palm mute on A gives `Am`, and bend on B gives `Bb`. | A separator keeps the two apart. See FR-008. |
| `fretToMidi` gives the pitch | True for a fretted note. A natural harmonic usually sounds a different note from the fret it is played at: on an A string, the harmonic at fret 5 sounds an A, and the fret says D. The data does not record which kind of harmonic it is. | A harmonic shows no pitch at all. See FR-009. |
| The chord in force is already computed | It is computed for one column at a time, by walking the events it is given. A play view pass cut to a bar range hands the staff only those bars, so a chord anchored before the slice is lost. | The chord in force is read from the whole part. See FR-011. |
| Neither feature writes anything | The view choice is remembered, so it is written, but only on the device | "Writes nothing" is held to mean nothing synced. See FR-003 and SC-003. |
| Two code comments say the export is what you see | `TabStaff.tsx` and `export/text.ts` both say so, and after this entry it holds only in fret numbers | Both comments need correcting as part of this work. |

### The three views

Each cell shows one of these. Worked on a 4-string bass (G D A E), with Am in force:

| Stored note | Frets | Notes | Intervals |
|---|---|---|---|
| A string, fret 3 | `3` | `C` | `b3` |
| D string, fret 2 | `2` | `E` | `5` |
| E string, fret 5 | `5` | `A` | `1` |
| E string, fret 7 (not in Am) | `7` | `B` | `2` |
| E string, fret 5, palm mute | `5m` | `A·m` | `1·m` |
| A string, fret 2, bend | `2b` | `B·b` | `2·b` |
| G string, fret 7, tap | `t7` | `t·D` | `t·4` |
| A string, fret 3, let ring | `(3)` | `(C)` | `(b3)` |
| A string, fret 5, harmonic | `<5>` | `<?>` | `<?>` |
| Dead note | `x` | `x` | `x` |
| E string, fret 7, eight times, compact | `7x8` | `Bx8` | `2x8` |

**Spelling a note.** A chord in force spells its own tones: under Cm the note a semitone below E is `Eb`, never `D#`, and under Cdim7 the seventh is `Bbb`. A slash bass is spelt as it was typed. Any other note follows one rule:

- With a chord in force, it takes flats if that chord spells any tone with a flat, and sharps otherwise.
- With no chord in force, it takes flats if the tuning spells any string with a flat, and sharps otherwise. So an open string on C Standard reads `Eb`, matching the label at the left of the staff.

The app does not model keys, so a note outside the chord can still be spelt the less usual way: under Dm, a Bb outside the chord reads `A#`. That is a spelling and never a wrong pitch.

**Naming an interval.** A chord tone uses the degree the chord gives it: `b3`, `#9`, `13`, `bb7`. Any other note, including a slash bass that is not a chord tone, is named by its distance from the chord's root, folded into one octave:

| Semitones above root | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Shown | `1` | `b2` | `2` | `b3` | `3` | `4` | `b5` | `5` | `b6` | `6` | `b7` | `7` |

**No chord in force.** An interval needs a chord. Where none is in force, or the one in force cannot be read, such as `N.C.`, the cell shows the note name instead. It must not fall back to the fret number: fret `5` in a row of intervals would read as a fifth. A letter cannot be taken for a degree.

### What counts as different

A variant and its parent are compared as **played columns**: repeats unrolled, barlines included, ids ignored. Two columns are the same when all of these match:

- **Kind**: notes, rest or barline.
- **Frets**: the same value on every string the tuning draws, with dead notes matching dead notes.
- **Techniques**: the same set on each played string. Stored order, duplicates and an empty list do not count.
- **Duration**: the same stored value, or both unset.
- **Group**: whether the column is in a group, whether it continues the group of the column before it, whether the group is plain or counted, and the number it prints. A group stored before group kinds existed matches its modern equivalent.
- **Chord symbol**: the same text anchored at that position, ignoring surrounding spaces. The brief does not list this, but without it a variant differing only in a chord would be declared the same as its parent, which is false.

So a stored `7x8` in the parent and `7x4 7x4` in the variant are the same part: eight hits either way. A `7x8` that becomes `7x6` is two removed columns, not eight changed ones.

Text and dynamic annotations, part names, notes and ranks are not compared. The staff does not draw them.

### The marks

| Mark | Means | Where it is drawn |
|---|---|---|
| `*` | **Changed**: this column replaced one in the parent | Under the column, which is also bold and tinted |
| `+` | **Added**: this column is not in the parent | Under the column, which is also bold and tinted |
| `−2` | **Removed**: two parent columns are gone from this spot | In a narrow gap between the columns either side, because a removed column has no column to mark |

The glyph is what carries the meaning. The tint is a second signal, and the bold a third, so losing colour to glare, a greyscale printer or colour blindness loses nothing.

**Worked examples**, parent `5 7 8 | 5 7 8`:

| Variant | Marks | Line under the staff |
|---|---|---|
| `5 7 8 \| 5 7 8` | None | Same as A |
| `5 7 9 8 \| 5 7 8` | `+` on the 9 | Differs from A in bar 1: 1 added |
| `5 7 9 \| 5 7 8` | `*` on the 9 | Differs from A in bar 1: 1 changed |
| `5 7 \| 5 7 8` | `−1` after the 7 | Differs from A in bar 1: 1 removed |
| `5 7 8 5 7 8` | `−1` where the barline was | Differs from A in bar 1: 1 removed |
| `5 7 8 \| 5 7 9 10` | `*` on the 9, `+` on the 10 | Differs from A in bar 2: 1 changed, 1 added |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a riff as notes (Priority: P1)

A player learning someone else's riff opens the song page and switches the view to notes. Every fret number on the page becomes a note name, with techniques still showing. They open the play view and it is already in notes. They come back tomorrow and it still is, on this device and no other, and nobody else in the band sees anything different.

**Why this priority**: It is the smallest slice that delivers the first feature, and it establishes the view control, its storage and the reflowed staff that Story 2 builds on.

**Independent Test**: On a part with two-digit frets, chords, a group and every decoration, switch to notes on the song page. Every note cell shows its note, the chord row, brackets and barlines still sit over their columns, and the same view shows in the play view. Reload and it is still there. Then look at the pending-write count: it has not moved.

**Acceptance Scenarios**:

1. **Given** a part on the song page in frets, **When** the reader chooses notes, **Then** each cell shows its note name as in **The three views**, and every staff on the page changes at once.
2. **Given** notes chosen on the song page, **When** the reader opens the play view, **Then** it is in notes, and changing it there changes the song page too.
3. **Given** notes chosen, **When** the page reloads, **Then** notes is in place before the first staff appears, with no flash of fret numbers.
4. **Given** notes chosen, **When** a bandmate opens the same song on another device, **Then** their view is unaffected, and the first device has queued no write.
5. **Given** a palm-muted A, **When** it is drawn in notes, **Then** the cell reads `A·m` and cannot be read as A minor.
6. **Given** a cell with a harmonic, **When** it is drawn in notes, **Then** it reads `<?>`, and a screen reader still hears the string and fret.
7. **Given** notes chosen, **When** the reader copies the song as text, **Then** the text holds fret numbers, is identical to the text copied in frets, and the page has said so.
8. **Given** notes chosen, **When** the reader opens the capture screen or the paste preview, **Then** those staves show fret numbers.

---

### User Story 2 - Read a line against its chord (Priority: P2)

A player wants to see how a line sits on the harmony: root on the one, flat third on the way up, a passing note on the way down. They switch to intervals. Where a chord is in force each note shows its degree. Where none is, it shows its note name, and the page says why.

**Why this priority**: It is the more useful reading, but it depends on Story 1's control and on the part having chords, which many captured riffs do not.

**Independent Test**: On a part with Am then C7#9, then `N.C.`, then no chord anchored until the end, switch to intervals. Each column reads against the chord in force, the columns after `N.C.` show note names, and a play view pass cut to bars 3-4 reads against the chord anchored in bar 1 and shows it.

**Acceptance Scenarios**:

1. **Given** Am anchored on a column, **When** intervals is chosen, **Then** that column and every later one up to the next chord read against Am, across barlines and repeats.
2. **Given** a note that is not in the chord, **When** it is drawn, **Then** it is named from the root by the table in **Naming an interval**.
3. **Given** a chord symbol the app cannot read, **When** it is in force, **Then** columns under it show note names, and an earlier chord does not stay in force.
4. **Given** a part with no chord symbols, **When** intervals is chosen, **Then** its cells show note names and its card says there are no chords to read against.
5. **Given** a play view pass of bars 3-4 with Am anchored in bar 1, **When** intervals is chosen, **Then** its cells read against Am, and the chord row shows `(Am)` over its first column so the reader can see what the numbers mean.
6. **Given** a staff in intervals, **When** it is printed or photographed, **Then** the staff's own card says it shows intervals, so a `5` cannot be taken for a fret.

---

### User Story 3 - See what a variant changed (Priority: P1)

A capturer has just made A' and added a flourish at the end. On the song page A' now shows exactly the columns they touched, and a line says "Differs from A in bar 4: 2 changed, 1 added". They can see they did not nudge anything else. A reader sees the same marks and learns what the flourish is without comparing two staves by eye.

**Why this priority**: It is the whole of the second feature in its most used place, and it needs nothing from Stories 1 or 2.

**Independent Test**: Make a variant of a long part. It says it is the same as its parent. Add one column near the start: exactly one column is marked, and everything after it is not. Delete one elsewhere: one removal mark appears. Do the same on a variant built by copy and paste, whose ids are all different: the marks are the same.

**Acceptance Scenarios**:

1. **Given** a variant just made, **When** the song page shows it, **Then** nothing is marked and the line says it is the same as its parent.
2. **Given** a variant with one column inserted, **When** it is drawn, **Then** exactly that column is marked `+`, and no column after it is marked.
3. **Given** a variant with one column's fret changed, **When** it is drawn, **Then** that one column is marked `*`, and it does not read as one removed and one added.
4. **Given** a variant with a column deleted, **When** it is drawn, **Then** a removal mark sits between its neighbours, or at the end of the staff if the last column went.
5. **Given** a variant that differs only in a technique, a duration, a chord symbol, or a group, **When** it is drawn, **Then** the affected columns are marked.
6. **Given** a parent and a variant built by copying and pasting all of its columns, **When** the variant is drawn, **Then** it is the same as its parent, though every id differs.
7. **Given** a variant in compact density, **When** it is drawn, **Then** a column is marked if any of its repetitions is, and the summary line reads the same as in expanded.
8. **Given** the view is in notes or intervals, **When** a variant is drawn, **Then** the same columns are marked with the same counts.
9. **Given** a parent's column is edited, here or by sync, **When** the song page is open, **Then** its variants' marks update with no action from the reader.
10. **Given** a marked column, **When** a screen reader reads it, **Then** it hears the mark in words and what changed, such as "changed from A: fret 5 to fret 7 on string 2".

---

### User Story 4 - See the flourish where it is played (Priority: P2)

On the play view, `A x4 with a flourish on the 4th` draws four staves. The first three are plain. The fourth carries the marks, so the player sees what is coming before they reach it.

**Why this priority**: It is the same comparison in a second place, and most of its work is already done by Story 3.

**Independent Test**: Build `A x4` with A' on the last pass, then draw it. Only pass 4 shows marks and a summary line, and the marks match the song page. Cut the entry to bars 3-4 and the marks and counts cover those bars only.

**Acceptance Scenarios**:

1. **Given** `A x4` with A' on the last pass, **When** the play view draws it, **Then** passes 1 to 3 have no marks, and pass 4 has the same marks as A' on the song page.
2. **Given** an entry cut to bars 3-4, **When** its variant pass is drawn, **Then** only marks inside those bars appear, and the line counts only those marks.
3. **Given** a sliced pass with no differences inside its bars, while the variant differs elsewhere, **When** it is drawn, **Then** the line says it is the same as its parent in these bars.
4. **Given** a printed play view, **When** colour and backgrounds are dropped, **Then** the marks and the summary line still print.

---

### Edge Cases

**View control**

- What happens when device storage is unavailable, as in some private windows? The control works for the visit and is forgotten afterwards. Nothing throws.
- What happens when the stored view is unrecognised, perhaps from a later version? The view reads as frets.
- What happens when the song has no tuning? No staff is drawn, so the control is not shown.
- What happens when the song's tuning changes? Names and intervals follow the new tuning on the next draw. The stored frets do not move.
- What happens when a stored fret sits on a string the tuning does not have? It is not drawn, as today.

**Cells**

- What happens to a rest or an empty column? It draws as it does in frets, with nothing to name.
- What happens to a note with a bend or slide? It shows the fretted note. The cell's decoration says what happens next.
- What happens with a very long cell, such as a tap, let ring, bend, vibrato and palm mute on `Bbb`? It is as wide as it is, and the column widens with it. Nothing truncates.
- What happens when a chord's anchor column has been deleted? That chord is in force nowhere, as on the fretboard today.
- What happens when chords are still loading? Interval cells do not draw from an empty chord list and then correct themselves. The staff waits for chords as it waits for columns.

**Comparison**

- What happens when the parent has been deleted, or is not in this song? There is no comparison, no marks and no line.
- What happens when a part names itself as its parent? There is no comparison.
- What happens when a variant's parent is itself a variant? It is compared with the parent it declares, and with nothing further up.
- What happens when a last-pass substitute is not a variant at all? It is drawn with no marks, because two arbitrary parts are never compared.
- What happens when a last-pass substitute is a variant of a different part from the entry's? It is compared with its own declared parent, and the line names that parent.
- What happens when a variant is used directly as an entry's part, rather than as a substitute? Every pass that draws it shows the marks. The rule is about the part drawn, not how it got there.
- What happens when a parent or a variant is empty? Every column of the other reads as added or removed. Two empty parts are the same.
- What happens when the riff repeats, so an inserted column could sit at several positions? Any of those positions is equally true. One is chosen, the same one every time, and the count is still exactly one.
- What happens when a barline and a note fall in the same spot? They are never paired as changed. That reads as one removed and one added.
- What happens when a removal falls on the edge of a bar slice? It belongs to the pass holding the column that follows it. A removal at the very end of the part belongs to the pass holding the last column.
- What happens when two parts are completely unrelated? The result stays correct, and may be coarser: the middle reads as replaced. It stays inside the time budget in SC-010.

## Requirements *(mandatory)*

### Functional Requirements

**The view control**

- **FR-001**: The song page and the play view MUST each offer a three-way control choosing frets, notes or intervals. It MUST be hidden from print. The current choice MUST be plain from the control itself, not from colour alone. *(Amended by spec 007: the control is in the tools panel of the song page and the click cluster of the play view, one tap away; it is shown on the play view only when the song has an arrangement.)*
- **FR-002**: The default MUST be frets. In frets, every staff MUST draw exactly as it does today.
- **FR-003**: The choice MUST be one per device, shared by the song page and the play view and by every song. It MUST be remembered on that device and MUST NOT reach any synced table, the sync queue or the server, or need a migration.
- **FR-004**: Only the staves on the song page and the play view MUST follow the choice. The capture screen and the paste preview MUST stay in fret numbers, because a capturer is placing fingers and a preview is promising what will be stored.
- **FR-005**: A remembered choice MUST be in place before the first staff is drawn, with no mismatch between server and browser rendering.

**What a cell says**

- **FR-006**: In notes, a played cell MUST show its note name with no octave, spelt as in **Spelling a note**. Pitch MUST come from the song's tuning and the stored fret.
- **FR-007**: In intervals, a played cell MUST show the degree from **Naming an interval** against the chord in force, and MUST show the note name where no readable chord is in force.
- **FR-008**: Every decoration MUST still be drawn, in the same order as in frets. Each letter decoration (bend `b`, palm mute `m`, tap `t`) MUST be set off from the rest of the cell with `·`, so no cell can be read as a different note, degree or chord. Accidentals MUST use `#` and `b`. The staff's font does not carry `♯` and `♭` in the set the app loads, so a fallback glyph would break the column widths.
- **FR-009**: A cell with a harmonic MUST show `?` in place of a pitch, in both notes and intervals, inside its usual `<` and `>`. A dead note MUST stay `x`. Neither may stop the cells around it being named.
- **FR-010**: A repeat in compact density MUST keep its suffix: `Bx8`, `2x8`.
- **FR-011**: The chord in force at a column MUST mean the same as it does for the fretboard: the most recent chord anchored at or before that column in the whole part, read through a slice's edge. A chord that cannot be read ends the one before it.
- **FR-012**: Where a staff in intervals starts under a chord anchored outside what it draws, the chord row MUST show that chord in brackets over the first column, for example `(Am)`. It MUST NOT do so in frets or notes.

**Staying aligned**

- **FR-013**: Each column's width MUST follow its widest cell in the current view, by the same rule as in frets.
- **FR-014**: In every view and density, the chord row, group brackets, barlines, connectors, rhythm marks, diff marks and, where one is drawn, the caret MUST stay on the columns they belong to. Each MUST move with its column when the staff reflows.
- **FR-015**: A view change MUST NOT change the height of a staff or its card, except where FR-012 adds a chord row.

**Saying what is shown**

- **FR-016**: A staff not in frets MUST say so in words on its own card, without adding a row (FR-015), so it stays clear when the control has scrolled away and on a printed page.
- **FR-017**: In intervals, a staff with no chord symbols to read against MUST say in those same words that it has no chords and is showing note names.
- **FR-018**: What a screen reader hears for a column MUST keep the string and fret, and MUST add what the cell shows in words, such as "C sharp" or "flat third". It MUST NOT read affix characters. In frets it MUST NOT change.

**Export**

- **FR-019**: The text export MUST always use fret numbers, whatever the view. It MUST carry no diff marks. Its bytes MUST be the same as today for every song.
- **FR-020**: While the view is notes or intervals, the page MUST say beside the export controls that exports use fret numbers. This must be visible text, because a tooltip does not exist on a phone, and density does follow the screen into the export, so a reader will expect this to as well.

**Comparing a variant with its parent**

- **FR-021**: A part MUST be compared when it declares a parent that is another live part of the same song, and at no other time. There MUST be no way to choose what it is compared with.
- **FR-022**: Two columns MUST be the same exactly as defined in **What counts as different**. No id of any kind may affect the result, including group ids.
- **FR-023**: The comparison MUST be a true sequence alignment over played columns, finding the fewest columns that differ, so an inserted or removed column leaves every later column unmarked.
- **FR-024**: Within a run of differences, a parent column and a variant column MUST be paired in order and reported as one change, with the remainder reported as added or removed. A barline MUST NOT be paired with anything but a barline. The same two parts MUST always give the same result.
- **FR-025**: The comparison MUST be fast enough to run for every variant in a song each time any of the song's data changes, and MUST stay bounded on parts with nothing in common (SC-009, SC-010). Where a full alignment would exceed that bound it MUST give a correct, coarser answer rather than stall the page.
- **FR-026**: No comparison result may be drawn until both parts' columns and chords have loaded, so a chord still in flight never shows as a difference.

**Showing the difference**

- **FR-027**: On the song page, a compared variant's own staff MUST show the marks from **The marks**, in a row of their own that does not share with the chord, bracket or rhythm rows. The parent's staff MUST NOT be marked.
- **FR-028**: On the play view, every pass drawing a compared variant MUST show the same marks, limited to the bars it draws. Passes drawing anything else MUST be unmarked.
- **FR-029**: Every compared variant MUST show one line under or beside its staff naming the parent by label and giving the counts of changed, added and removed columns and the bars they fall in, or saying it is the same. On a sliced pass the line MUST cover only the bars drawn, and say so.
- **FR-030**: Counts MUST be of played columns, so they do not change with density or view. In compact density a column MUST be marked if any repetition in it is: `+` when all are added, `*` otherwise.
- **FR-031**: The distinction MUST NOT rest on colour. Mark glyphs MUST be told apart by shape, marked cells MUST be heavier than unmarked ones, and the tint MUST be a named colour for each theme with the cell masks repainted to match, not an opacity over a surface.
- **FR-032**: What a screen reader hears for a marked column MUST say it is changed or added, against which parent, and what changed in words. A removal mark MUST be announced with its count.
- **FR-033**: Nothing in the marks or the line may be interactive: no link, no action, no way to apply or revert a change.

### Key Entities

- **Staff view**: the reader's choice of frets, notes or intervals. One value per device. Not song data.
- **Cell label**: what a cell shows in the current view. Derived from the fret, the string's tuning, the chord in force and the decorations. Never stored.
- **Played column**: one drawn position with repeats unrolled. The unit of comparison and counting.
- **Column signature**: the content of a played column as defined in **What counts as different**. Ids play no part.
- **Variant comparison**: for one variant and its declared parent, each played column's status (same, changed, added) plus the removals between columns. Derived on read. Never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A reader can switch every staff on the page from frets to notes with one tap, and the same view is in place on the play view and after a reload.
- **SC-002**: Every existing fixture draws the same staff in frets as before this entry, and every existing fixture exports byte-identical text in all three views.
- **SC-003**: After 100 changes of view, the sync queue holds no new write and no synced row has changed.
- **SC-004**: For every tuning preset, every string and every fret up to the cap, the note shown has the pitch class of the stored note. For every chord quality the parser reads, every chord tone shows the chord's own spelling and degree.
- **SC-005**: For every decoration combination on every note name and every degree, the pitch can be recovered from the cell's text alone, and no cell carrying a letter decoration is itself a valid note name, degree or chord symbol. An undecorated `A` or `b7` also parses as a chord symbol, and that is fine: it sits on a string, not in the chord row, and only a decoration could change what it says.
- **SC-006**: In all three views, at both densities, on both 375×667 and desktop, with and without chords, brackets, connectors, rhythm marks and diff marks, every chord label, bracket end, barline and mark sits within 1 px of the column it belongs to, and the staff's height differs by nothing between views except under FR-012.
- **SC-007**: For every fixture and every position in it, inserting one column gives exactly 1 added and nothing else, removing one gives exactly 1 removed, and altering one in any compared field gives exactly 1 changed. Each holds with all ids regenerated.
- **SC-008**: On random sequences checked against a brute-force reference alignment, the number of differing columns is never above the true minimum.
- **SC-009**: A song with 20 variants of 1,000 played columns each, ten differences apiece, is compared in full in under 20 ms on a desktop.
- **SC-010**: Two unrelated parts of 5,000 played columns each are compared in under 50 ms, and the result still accounts for every column of both.
- **SC-011**: Applying a variant's reported changes to its parent reproduces the variant's columns exactly, for every fixture.
- **SC-012**: In a greyscale capture at actual size in both themes, each of `*`, `+` and `−` is told apart from the others and from unmarked columns, every mark and summary line measures 4.5:1 contrast or better against what is behind it, and computed weight confirms a marked cell is heavier than an unmarked one.
- **SC-013**: With colour and backgrounds off, a printed play view still shows every mark, every summary line and every view caption.
- **SC-014**: At 375×667 in both themes, the view control and everything beside it fit without horizontal overflow on the song page and the play view.

### Owed to a browser pass

The pipeline's implement and review phases have no browser, so these stay open after review and must not be ticked to pass a gate. They are done in Chrome, at actual size, in both themes, per `docs/DECISIONS.md`:

- [ ] Notes and intervals are legible at the staff's real size, with `·` visible at actual size and not mistakable for a rail or a mask gap.
- [ ] Marked columns read as marked at a glance on the song page and the play view, with the tint not fighting the cell masks.
- [ ] The chord-tone defect does not recur: desaturated, the marks still separate from unmarked columns in the light theme.
- [ ] A removal gap reads as "something was here", not as a drawing fault.
- [ ] A printed play view, from the browser's print preview, in greyscale.
- [ ] The song page's control row at 375×667 with export, BPM, density and the new control together.

## Decisions made for this spec

Jamie asked for calls to be made and logged rather than waited on. Each of these can be overturned without touching the others. The first is the one the brief asked to be decided. The rest are **worth your eye**.

1. **The export always uses fret numbers** (FR-019). The deciding fact: the paste reader accepts `0123456789xX~<>()btm` as cell characters, so `5 b3 1` from an interval export would read back as frets `5`, `3`, `1`, with `b` as a bend. That is the silent wrong note specs/004 exists to prevent. Note names would fail less badly but would still not read back. Fret numbers are also what tab means in band chat, and interval text means nothing to someone without the chord.
2. **Harmonics show `<?>`** (FR-009). Computing the sounding note needs to know a natural harmonic from an artificial one, which is not stored. Keeping the fret number was rejected because in intervals `<5>` reads as a fifth. The fret stays available by switching back and in the screen reader text.
3. **`·` separates letter decorations** (FR-008). It costs a column of width on those cells. The alternatives were weight, which is too subtle at the staff's size, and `♯`/`♭`, which the loaded font does not have and which would not help `Am` anyway.
4. **Intervals fall back to note names, not fret numbers** (FR-007).
5. **Chord symbols count as a difference** (**What counts as different**), which the brief did not list. Without them "Same as A" could be false.
6. **Comparison is by played column, so `7x8` matches `7x4 7x4`.** Splitting a repeat to change its tail is the commonest way to write a flourish, so treating that as a difference would mark every hit.
7. **A removal has its own mark in a gap**, which the brief did not mention. A deleted column has nothing to mark, and a variant that only removes things would otherwise look unchanged.
8. **The variant's staff is marked and no second staff is drawn.** The parent is on the same page, and a stacked comparison would double the height on a phone. A changed column's old value is given in words to a screen reader only. If that proves too little, a tap-to-reveal would be a later addition, and FR-033 would need amending.
9. **Marks are always on, with no toggle.** This is the simplest answer, and a clean-sheet option can be added if a band asks for one.
10. **No chord-tone emphasis on the staff.** The fretboard's bold roots are not carried over, because on a staff weight has to mean one thing, and FR-031 gives it to the diff.
11. **This stays one spec.** The template warns against bundling, and these are two features with one shared surface. It stays whole because the roadmap entry is one unit, the runner works one spec per entry, and both draw on the same staff. Stories 1-2 and 3-4 are independent, so either half could ship alone.

## Out of Scope

- Editing from a comparison: no "apply this change to the parent", no revert, no link into capture at a column.
- Comparing any two parts, or a variant with anything but its declared parent.
- Transposition, capo, or any other use of the pitch machinery that changes which notes are shown.
- A key or scale for the song. Spelling and intervals read the chord in force and the tuning, nothing wider.
- Showing the sounding pitch of a harmonic or bend.
- Octave numbers on note names.
- Notes, intervals or marks on the capture screen or paste preview.
- Notes, intervals or marks in the text export.
- A side-by-side or stacked staff of the parent.
- Chord-tone highlighting on the staff.
- A per-song or per-part view choice.
- New data of any kind: no field, table, migration or sync message.
- The chord row's existing truncation, and JetBrains Mono's ligatures. Both are `usability-pass` items.

## Assumptions

- Users are players reading on a phone or a desktop, often at practice, sometimes in print.
- The project constitution is still the unfilled template, so `docs/DECISIONS.md` and the earlier specs are the governing practice.
- Local-only state already has homes on the device, so no new kind of storage is needed. Which one is a planning choice, bound by FR-003 and FR-005.
- A signed-out or shared device keeps its view choice. It is not personal data.
- The control's size follows the existing density control. `usability-pass` owns tap target sizes across the app, including this one.
- Per the `usability-pass` entry, that later work will rearrange the play view's controls. This entry only needs a place that fits at 375×667.
- Comparison work happens on every data change, because the app's live reads hand back fresh rows after any write in the song. So the budget assumes no caching helps, and caching is an extra.
- Lessons from `docs/DECISIONS.md` apply: name colours per theme instead of using opacity over a surface, and check computed styles because custom classes win ties against utilities in this build.

### Dependencies

- Chord symbol parsing and spelling, as used by the fretboard, including the rule for the chord in force.
- Pitch arithmetic and fret-to-pitch from the tuning.
- Technique drawing rules from specs/002, group rules from specs/003, the paste reader's grammar from specs/004, durations from specs/005.
- The shared column layout that drives both the staff and the text export.
- The existing variant link and last-pass substitution. Neither changes.
