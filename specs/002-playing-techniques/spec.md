# Feature Specification: Make playing techniques capturable and visible

**Feature Branch**: `002-playing-techniques`

**Created**: 2026-11-03

**Status**: Draft

**Input**: User description: "Make the techniques that are ALREADY IN THE SCHEMA capturable and visible. No migration is needed and none should be written." (full roadmap entry, with file and line references for planning: `.specify/roadmaps/capture-expression.json`, entry `playing-techniques`)

## Summary

The stored model has always had a place for playing techniques on every note. Nothing writes to it and nothing draws it, so a hammer-on, a slide or a vibrato cannot be captured at all. This entry adds the capture controls and the drawing. It adds no new stored data.

The techniques fall into two kinds, and that split decides everything else:

| Kind | Where it lives | Techniques | How it is captured | How it is drawn |
|------|----------------|------------|--------------------|-----------------|
| **Transition** | Between two notes on one string | hammer-on, pull-off, slide up, slide down | A one-shot chip in the latch strip, before pressing the fret | A connector glyph in the gap before the arriving note |
| **Decoration** | On one note | vibrato, harmonic, let ring, bend, tap, palm mute | A per-string toggle in the column inspector, after the note exists | An affix on the note's own cell |

Dead notes need nothing. A dead note is already the fret value `x`.

### The notation this entry defines

This is the grammar the later `ascii-import` entry has to parse, so it is normative.

| Technique | Text | Example |
|-----------|------|---------|
| Hammer-on | `h` in the gap | `5h7` |
| Pull-off | `p` in the gap | `7p5` |
| Slide up | `/` in the gap | `5/7` |
| Slide down | `\` in the gap | `7\5` |
| Vibrato | `~` after the note | `7~` |
| Harmonic | `<` `>` around the note | `<7>` |
| Let ring | `(` `)` around the note | `(7)` |
| Bend | `b` after the note | `7b` |
| Tap | `t` before the note | `t7` |
| Palm mute | `m` after the note | `7m` |

**Several decorations on one note** always render in one fixed order, however they were stored: tap, then let ring, then harmonic around the fret, then bend, vibrato and palm mute after it. All six together read `t(<7>)b~m`. In compact density the repeat label comes last: `7~x8`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Capture a hammer-on as it is played (Priority: P1)

The guitarist plays a riff with a hammer-on and the capturer has one hand and about four seconds. They press the first fret, tap `h` in the strip above the neck, and press the second fret. The two notes land as `5h7`, the chip goes dark by itself, and the next press is an ordinary note. Someone who never touches a chip captures exactly as fast as before.

**Why this priority**: Transitions are what make a bass line recognisable, and they are the only techniques that have to be caught mid-riff. They also carry the larger renderer change, and this one story proves that the chip, the storage and the connector work end to end.

**Independent Test**: On an empty part, press a fret, arm `h`, press a second fret on the same string, then press a third. The staff and the text export both show `5h7` followed by a plain note, and the chip is no longer lit after the second press.

**Acceptance Scenarios**:

1. **Given** a part whose last column has a 5 on the E string, **When** the capturer taps `h` and presses fret 7 on the E string, **Then** a new column is added, the E string reads `5h7` on the staff and in the export, and the stored data records the hammer-on on the arriving note only.
2. **Given** a transition chip is armed, **When** the capturer looks at the screen, **Then** the chip is lit and the status line says which transition the next note will use.
3. **Given** a transition chip is armed, **When** one note is entered, **Then** the chip disarms by itself, and the next press produces a plain note with no connector.
4. **Given** `h` is armed, **When** the capturer taps `p`, **Then** `p` is armed and `h` is not, because one gap can only hold one glyph.
5. **Given** `h` is armed, **When** the capturer taps `h` again, **Then** it disarms and nothing is written.
6. **Given** both stack and `/` are armed and the cursor is on a column, **When** the capturer presses a fret on another string, **Then** the note joins the column at the cursor with a slide on that string, `/` disarms, and stack stays armed.
7. **Given** a chip is armed, **When** the capturer taps a column, switches part, or inserts a space or barline, **Then** the chip disarms, just as stack does.
8. **Given** the cursor is on a barline and the note before it is a 5 on the E string, **When** the capturer taps `/` and presses fret 7 on the E string, **Then** the slide is stored and drawn in the gap after the barline, as `5-|/7`.
9. **Given** the cursor is at the very start of a part, or the part is empty, **When** the capturer looks at the transition chips, **Then** they are visibly unavailable and hold their positions, because a note there cannot have a note before it.
10. **Given** a capturer who never touches a chip, **When** they press fret, fret, fret, **Then** the number of taps, the response to each tap and the stored rows are all the same as before this entry.

---

### User Story 2 - Decorate a note while looking at it (Priority: P2)

The riff is down and the capturer goes back to mark that the last note was held with vibrato and that the verse is palm-muted. They long-press the column, and the inspector shows each played string with its decoration toggles. They flip one on, the note changes behind the sheet straight away, and they close it.

**Why this priority**: Decorations add detail but are not urgent. Nobody adds vibrato mid-riff, which is why they live in the sheet and leave the strip alone. The story stands alone because it needs only the existing inspector and the cell affixes.

**Independent Test**: Capture one note, open the inspector on it, toggle each of the six decorations on and off, and confirm the staff and export show the matching mark each time and return to the plain note at the end.

**Acceptance Scenarios**:

1. **Given** a column with a 7 on the E string, **When** the capturer opens the inspector and turns on vibrato for that string, **Then** the toggle shows as on, the staff shows `7~`, and the export shows `7~`.
2. **Given** a column with notes on two strings, **When** the capturer opens the inspector, **Then** each played string has its own set of toggles, named so it is clear which string each belongs to, and strings with no note have none.
3. **Given** vibrato is on, **When** the capturer turns it off, **Then** the note reads `7` again and nothing else on the column has changed.
4. **Given** a note reached by a hammer-on, **When** the capturer toggles any decoration on that string, **Then** the hammer-on is kept.
5. **Given** a column with vibrato on one string and a bend on another, **When** the capturer views the staff, **Then** both marks appear and every string in the column stays aligned, because the column has widened to its widest cell.
6. **Given** a barline or an empty space column, **When** the capturer opens the inspector, **Then** no decoration toggles are offered.
7. **Given** a palm-muted note, **When** the capturer views the staff, **Then** it reads `7m`, a mark on that note, and no span is drawn above the staff.
8. **Given** a capturer using only a keyboard, **When** they reach a column, **Then** they can open the inspector for it and operate every toggle, and a screen reader announces each toggle's technique, string and on/off state.

---

### User Story 3 - The tab reads the same everywhere it appears (Priority: P2)

The capturer pastes the part into the band chat, and a bandmate reads it on the song page. A hammer-on on the phone staff, in the song view, in the play view and in the pasted text is the same thing in the same place, with the same glyph. The text looks like the tab bands already send each other.

**Why this priority**: The screen and the export can only disagree if the drawing exists twice, so this story is what protects the one-layout rule. It also pins the repeat behaviour so the next person does not have to guess which way it went.

**Independent Test**: Take one part containing every transition and decoration, a repeated column, a barline, a chord symbol and a triplet. Compare the staff at both densities against the exact-string export, glyph for glyph and position for position.

**Acceptance Scenarios**:

1. **Given** any part with no techniques, **When** it is drawn or exported, **Then** the export is character-for-character what it is today and the staff has exactly today's width.
2. **Given** a column of a 7 with a hammer-on, repeated three times, after a plain 5, **When** it is drawn in expanded density, **Then** the connector appears on every repetition: `5h7h7h7`.
3. **Given** a column of a 7 with vibrato, repeated three times, **When** it is drawn in expanded density, **Then** the mark appears on every repetition: `7~-7~-7~`. A chord symbol on that same column appears only on the first, as it does today.
4. **Given** the column from scenario 2, **When** it is drawn in compact density, **Then** it reads `5h7x3`, with one connector for the one drawn column.
5. **Given** a part with a chord row, a tuplet bracket, a barline and the insertion caret, **When** connectors are drawn among them, **Then** chord symbols stay over their columns, the bracket stays unbroken across a connector inside it, the caret marks the same insertion point, and barlines are drawn as before.
6. **Given** three columns of 3, 5 and a hammer-on to 7 on one string, **When** the column holding the 5 is deleted, **Then** the part reads `3h7`, because the source note is worked out from position and was never stored.

---

### User Story 4 - An armed latch survives a mid-part insert (Priority: P3)

The capturer has stack armed with the cursor in the middle of a part, and pastes a copied column. The cursor moves onto the pasted column before the screen has received that column, and for that moment the screen thinks the cursor points at nothing and drops the latch. This must stop, or every new latch inherits the bug.

**Why this priority**: It is a small defect (F14 in the previous entry's review), but this entry must clear it, because adding latches multiplies the routes that reach it.

**Independent Test**: With the cursor mid-part, arm a latch and paste. The latch is still armed afterwards. Separately, delete the cursor's column from another device, and the latch disarms.

**Acceptance Scenarios**:

1. **Given** stack is armed and the cursor is mid-part, **When** the capturer pastes, **Then** stack is still armed once the pasted columns appear.
2. **Given** a transition chip is armed and the cursor is mid-part, **When** the capturer pastes, **Then** the chip is still armed, because a paste is not a note.
3. **Given** a latch is armed and the column at the cursor is really gone (deleted on another device), **When** the screen catches up, **Then** the latch disarms, as it does today.

---

### Edge Cases

- **No earlier note on that string**: the transition stays stored but no glyph is drawn. The first column of a part, and a note on a string nothing has played yet, render plain. If a source note is later inserted before it, the glyph appears.
- **The source is not in the adjacent column**: the source is the nearest earlier note on that string, wherever it is, and the glyph sits in the gap directly before the arriving note. Spaces, barlines and notes on other strings between them do not stop it (`5--h7` across one space column, `5-|h7` across a barline).
- **Source note deleted**: the transition reattaches to whatever note is now before it on that string, or draws nothing if there is none.
- **A note inserted between source and arrival**: the transition now comes from the inserted note. This follows directly from positional storage and is intended.
- **Arriving note deleted**: its transition goes with it.
- **A partial view of a part** (an arrangement entry that plays only some bars): the layout knows only the columns it was given, so a transition whose source falls outside the range draws nothing.
- **Two transitions stored on one string of one column**: capture cannot produce this, but the wire accepts it. One glyph is drawn, chosen by the fixed order hammer-on, pull-off, slide up, slide down. The other stays stored.
- **Technique stored on a string with no note in that column**: drawn as nothing.
- **An unknown technique, or the stored dead-note technique, in existing data**: draws nothing, and is kept when a toggle rewrites that string's techniques.
- **Dead notes**: decorations and transitions work on `x` like any other note. A palm-muted dead note, `xm`, is ordinary bass notation.
- **Two-digit frets and wide cells**: `12h14`, or a neighbouring string wider than the source, pads with rails before the connector, so all strings stay aligned (`5--h7`).
- **Two transitions into one column on different strings**: each string has its own connector in the same gap.
- **Stacking onto a string that already has a note**: the new note replaces the old one, so that string's techniques become whatever is armed, or none. This is also how to add or remove a transition on a note already captured: arm stack (and a chip, if adding) and press the same fret.
- **Removing a note from a column**: its techniques go with it, so they cannot attach themselves to a later note on that string.
- **Two toggles in quick succession**: both land. The second must not overwrite the first because the screen had not caught up yet.
- **The hold that opens the inspector**: with toggles in the sheet, its top edge can reach the staff, so the release of the long press must not flip a toggle lying under the finger.
- **A column with every string played**: the inspector stays usable on a phone. It scrolls within the viewport and the close control stays reachable.
- **Copy, paste and variants**: techniques travel with the column. A pasted transition derives its source from where it lands.

## Requirements *(mandatory)*

### Functional Requirements

**Storage**

- **FR-001**: This entry MUST NOT change the stored model, the database schema, the wire protocol or the clipboard, and MUST NOT include a migration.
- **FR-002**: A transition MUST be stored on the arriving note, on the string it applies to. The source note MUST be derived from position and MUST NOT be stored in any form.
- **FR-003**: A note created with nothing armed MUST store exactly what it stores today.
- **FR-004**: The operations that create a note and that stack a note onto a column MUST accept the techniques for that note. When a stacked note replaces another on the same string, that string's techniques MUST become those given, or none.
- **FR-005**: Removing a note from a column MUST remove that string's techniques.
- **FR-006**: Changing one string's techniques MUST preserve every other string's techniques, and any entry on that string this entry does not manage.

**Drawing, once**

- **FR-007**: All drawing of techniques MUST be produced in the one layout shared by the on-screen staff and the text export. Neither renderer may work out a glyph, an affix or a source note for itself.
- **FR-008**: Decorations MUST render as the affixes in the notation table, in the fixed order given there, regardless of the order in which they are stored.
- **FR-009**: Column width MUST continue to follow the widest cell, so that strings stay aligned with affixes present in both renderers.
- **FR-010**: Each column MUST expose, per string, the connector glyph occupying the gap before it. A connector MUST be drawn only when that string has a note in the column, a transition stored on it, and an earlier note on that string among the columns being laid out.
- **FR-011**: In the text export, a connector MUST take the place of the one rail character in that gap, so that the export's overall width and alignment do not change.
- **FR-012**: On the staff, a connector MUST be a thin element of about one character between columns, with one glyph per string row, lined up exactly with those rows. It MUST appear only at gaps that hold a connector, so a part with no transitions keeps exactly today's width.
- **FR-013**: The connector MUST NOT break the chord row, the tuplet bracket (which runs unbroken across a connector inside its span), the caret, the selection band or the barlines. It MUST NOT count as a column or be a control.
- **FR-014**: A connector glyph MUST mask the string line behind it the way a fret number does, on every surface the staff is drawn on, including inside a selection.
- **FR-015**: A technique on a repeated column MUST draw on every repetition in expanded density, for transitions and decorations alike. This is deliberately the opposite of the chord row, which draws only on the first repetition. A test on the exact export text MUST pin this.
- **FR-016**: In compact density a repeated column MUST draw its affixes and its connector once, with the repeat label last.
- **FR-017**: The column's description for screen readers MUST name techniques in words and report the fret as a number. It MUST NOT read affix characters out as text.

**Transition chips**

- **FR-018**: The latch strip MUST gain four chips, in this order after stack: hammer-on, pull-off, slide up, slide down. Each chip's visible label MUST be the glyph it draws (`h`, `p`, `/`, `\`), and its accessible name MUST be the technique in words.
- **FR-019**: A transition chip MUST disarm after exactly one note, whether that note was inserted or stacked. Stack's stay-armed behaviour MUST NOT change.
- **FR-020**: Arming a transition chip MUST disarm any other transition chip. Transition chips and stack MUST be able to be armed together.
- **FR-021**: A transition chip MUST be available when the cursor is on a playable column or on a barline, and visibly unavailable when the note would be the first in the part. Stack's availability MUST NOT change.
- **FR-022**: An armed chip MUST be lit, with the emphasis stack has when armed, and MUST disarm on the same actions that disarm stack.
- **FR-023**: The status line MUST say which transition is armed. When stack and a transition are armed together it MUST say both, and "stacking onto the marked column" MUST remain the text when stack is armed alone. The status row MUST NOT clip the staff or the chord row any more than it does today.
- **FR-024**: Five chips MUST fit the strip at the smallest supported phone width with every label inside its chip, at the strip's current height, with the neck and the toolbar unmoved. The test for this MUST be able to fail when a label overflows (F24, FU3 in the previous review).
- **FR-025**: Adding these chips MUST remain a change to the declared list of latches. No component may branch on a particular latch.

**Decoration toggles**

- **FR-026**: The inspector MUST offer, for each string with a note in the column, one toggle each for vibrato, harmonic, let ring, bend, tap and palm mute. It MUST offer none for a barline or for a column with no notes.
- **FR-027**: A toggle MUST take effect immediately, MUST show its current state, and MUST leave the sheet open.
- **FR-028**: Toggles MUST be declared through the inspector's existing property list. The sheet MUST NOT gain a hardcoded panel.
- **FR-029**: Toggles in quick succession MUST all be kept.
- **FR-030**: The release of the long press that opens the inspector MUST NOT activate any control in the sheet, at every sheet height this entry makes possible (FU12 in the previous review).
- **FR-031**: The inspector MUST remain fully usable at the smallest supported phone viewport with every string of the tuning played.
- **FR-032**: Because decorations can be set only in the inspector, it MUST become reachable without a sustained press, at least by keyboard. The previous entry's assumption that nobody loses a capability by being unable to long-press no longer holds.

**Palm mute**

- **FR-033**: Palm mute MUST ship as a per-note mark. Notation proper would draw it as a span above the staff (`P.M.------`). That span is deliberately not built here, and its absence is a decision, not an oversight. A per-note mark is enough for bass at practice.

**The latch prune (F14)**

- **FR-034**: An armed latch MUST NOT be dropped because the cursor names a column the screen has not yet received. Mid-part paste with stack or a transition chip armed MUST keep the latch.
- **FR-035**: An armed latch MUST still disarm when the cursor's column has really gone, or the cursor is on a target that latch cannot apply to. The previous entry's guarantee that no latch is ever lit and inapplicable MUST hold.
- **FR-036**: A test MUST prove that a latch survives a mid-part insert. The paste case the previous review marked as an expected failure MUST pass with that marker removed.

**Speed and presentation**

- **FR-037**: The capture path of fret, fret, fret MUST gain no tap, no delay and no prompt for a capturer who never touches a chip.
- **FR-038**: The capture screen's layout guarantees from the previous entry MUST continue to hold: no page-level scrolling, every string of a five-string part visible, the neck's height unchanged, and stable toolbar positions.
- **FR-039**: Connectors, affixes, chips and toggles MUST be legible in both themes, checked in a browser at actual size on a phone viewport, not through a magnified crop. If `/` and `\` read as mush at the staff's size, the on-screen presentation MUST be adjusted. The characters MUST NOT change.
- **FR-040**: No new visual tier may be opacity over a surface token. A new colour MUST be named per theme. The distinction MUST NOT rest on hue alone.

### Key Entities

- **Transition**: A technique on an arriving note that says how that string was reached. It is one of hammer-on, pull-off, slide up, slide down. Its source is the nearest earlier note on the same string, derived each time the part is laid out.
- **Decoration**: A technique on one note. It is one of vibrato, harmonic, let ring, bend, tap, palm mute.
- **Connector**: A drawn thing and never stored. It is the glyph, if any, in the gap before a column on one string.
- **Latch**: A next-note modifier in the strip. Stack stays armed. Transition latches are one-shot and mutually exclusive with one another.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A hammer-on, pull-off or slide between two notes costs exactly one extra tap over capturing those two notes plain.
- **SC-002**: The fret, fret, fret path takes the same number of taps as before, and produces stored notes identical to today's apart from their ids and ordering keys.
- **SC-003**: Each of the ten techniques can be captured through the interface, and appears with the same glyph in the same position on the staff and in the text export, in both densities.
- **SC-004**: For every part with no techniques, the text export is character-for-character identical to today, and every existing export test passes unedited.
- **SC-005**: Every row of every exported part is the same length, whichever techniques it contains.
- **SC-006**: On a 375×667 viewport in both themes, five chips each show their whole label on one line, with the strip height, the neck height and the toolbar position unchanged from before.
- **SC-007**: On a 375×667 viewport, a column with every string played has every decoration toggle reachable and the sheet can be closed.
- **SC-008**: A reader looking at the staff at actual size on a phone, in both themes, can tell all four connectors apart and tell a tap from a hammer-on, confirmed by a person-level browser check.
- **SC-009**: An armed latch survives a mid-part paste every time, and disarms every time the cursor's column is deleted from elsewhere.
- **SC-010**: Deleting a source note never leaves a broken reference. The part still renders, and the transition now comes from the previous note on that string.

## Out of Scope

Named explicitly, with the roadmap entry that picks each up where there is one:

- **Bend target pitches.** A bend renders as `b`, not `7b9`.
- **A palm-mute span row.** See FR-033.
- **Tuplet or grouping changes.** Entry `generalised-grouping`.
- **Durations.** Entry `rhythm-and-tempo`.
- **Parsing techniques from pasted text.** Entry `ascii-import`, which depends on the notation defined here.
- **A legend in the text export.** The marks follow what bands already paste, and `m` and `t` are the only ones a reader might have to work out.
- **Transition controls in the inspector.** See Assumptions.
- **Any migration or stored-model change.** See FR-001.

## Assumptions

Decisions taken where the roadmap entry left room, so that planning does not have to stop and ask. The first four are the ones most worth a second look.

- **A repeated column gives `5h7h7h7`, not `5h7 5h7 5h7`.** The entry calls the every-repetition rule correct for a repeated figure and gives `5h7 5h7 5h7` as the example. A repeat belongs to one stored column, so it can only ever repeat the arriving note, and the source of each later repetition is the repetition before it. A two-note figure cannot be produced by a repeat at all. The decision itself stands: techniques draw on every repetition, and the escape hatch is not compressing the column. The pinned test uses the output the model actually produces.
- **Transition chips are available on a barline.** The strip's existing rule, which the previous entry's contract applies to every latch, makes latches unavailable there, which is right for stack because a barline cannot hold a note. It is wrong for a transition: the note goes after the barline, and sliding into a downbeat is ordinary bass playing. Otherwise a capturer could not enter it directly after tapping barline. The previous entry's applicability table therefore gains a distinct rule for transitions, and stack's row does not change.
- **`t7` for tap and `7m` for palm mute are chosen here.** The entry fixed the other characters. `t` before the note keeps the common tapping figure readable as `t12p5`. `m` follows the lower-case letter pattern of `h`, `p`, `b` and `t`, and collides with nothing in the grammar.
- **A transition is corrected by re-entering the note, not in the inspector.** The entry puts transitions on chips and decorations in the sheet. Deleting the column and re-entering it works, and so does stacking the same fret onto the same string, which also adds a transition to a note already captured. Stacking replaces the note, so that string's decorations are cleared. If this proves awkward, a transition row in the inspector is a small addition later.
- **The review reference is F14, follow-up FU4.** The entry cites "F14/FU1", but in `specs/001-capture-control-surface/review.md` FU1 is F27 (line endings) and F14's follow-up is FU4. The described defect matches F14, so that is what this entry fixes.
- **F27 is not picked up.** The staff component and the other flagged files were committed with CRLF. Edits keep each file's existing line endings, so the diff stays reviewable, and converting them is not part of this entry.
- **Only paste can carry an armed latch across an insert.** Stack does not insert, transition chips disarm on their note, and space and barline disarm explicitly. Paste is therefore the route the test exercises.
- **Toggle labels are for the plan to settle.** Six toggles per string have to fit a phone in a way that reads. The requirement is that each toggle's technique, string and state are clear, and their accessible names use words.
- **Concurrent edits follow the existing merge rule.** Techniques are one mergeable field on a column, so two devices editing the same column's techniques offline resolve to the later write, as frets already do.
- **Two repo traps are assumed known and must not be re-debugged.** If a style change appears to do nothing, kill the dev server and use `npm run dev:clean` before looking at the CSS. A visual tier must never be opacity over a surface token, because on the light theme the surface is white.
- **Verification is both automated and visual.** Exact-string tests over the export are the evidence for the layout. The browser pass at actual size in both themes is the evidence for legibility, and neither substitutes for the other. The pipeline's implement and review phases have no browser, so that pass happens as a separate step, as it did for the previous entry.
