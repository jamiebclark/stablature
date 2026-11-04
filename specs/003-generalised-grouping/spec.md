# Feature Specification: Group any run of columns, as a counted tuplet or as plain phrasing

**Feature Branch**: `003-generalised-grouping`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Let a run of columns be grouped by any count, and let the group say whether it is a counted tuplet or plain phrasing. The data model is already general; the limitation is entirely in the UI." (full roadmap entry, with file and line references for planning: `.specify/roadmaps/capture-expression.json`, entry `generalised-grouping`)

## Summary

A capturer can bracket three columns as a triplet, and that is all. The stored model and both renderers already handle any count. What is missing is a way to choose one, a way to undo a group, and a way to bracket columns without printing a number over them.

This entry keeps one mechanism, a bracket over a run of columns, and gives it two presentations:

| | **Counted tuplet** | **Plain group** |
|---|---|---|
| Means | Three in the time of two. The number changes how the notes are read. | "These four are one beat." A reading aid. |
| Drawn as | A bracket with its number | A bracket with no number |
| Length | 2 to 16 columns | 2 columns or more, no upper limit |

There is no count picker. Grouping acts on the selection, so the selection is the count.

### Stored states

One new nullable field on a column, `groupKind`, says which presentation a group uses. The name is a requirement of this entry, because the brief asks that a reader can tell the two apart without the docs.

| State | `tupletId` | `tupletCount` | `groupKind` |
|-------|-----------|---------------|-------------|
| Not grouped | null | null | null |
| Counted tuplet | shared id | 2 to 16 | `"tuplet"` |
| Plain group | shared id | null | `"plain"` |
| Grouped before this entry | shared id | its count | absent or null, which reads as a counted tuplet |

### The notation this entry defines

The `ascii-import` entry has to parse this, so it is normative. Each row's example is the bracket as it sits above that many single-digit columns.

| Group | Columns | Text |
|-------|---------|------|
| Counted tuplet of 2 | 2 | `,2,` |
| Counted tuplet of 3 | 3 | `,-3-,` |
| Counted tuplet of 4 | 4 | `,--4--,` |
| Plain group | 2 | `,-,` |
| Plain group | 3 | `,---,` |
| Plain group | 4 | `,-----,` |

A plain bracket has exactly the extent the same columns would get as a counted tuplet, with rails where the number would be. The counted form is what the app already emits and does not change.

### The glyph decision

The bracket glyph takes its numeral as a parameter, and there is one glyph, not two. The "last three" button passes a literal 3 and so looks exactly as it does today. The selection toolbar's tuplet control passes the live count, and the plain group control passes no numeral at all, so its bracket is empty. This is the first of the two options the brief offered, and it covers the second one's goal as well: the button that means "last three" still shows a 3.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Make a tuplet of any size from a selection (Priority: P1)

The capturer has six notes that were played in the time of four. They tap select, tap the last of the six columns, and the selection toolbar shows a tuplet control already reading 6. One tap and the bracket appears with a 6 over it. There was nothing to pick or step through, because the selection was the answer.

**Why this priority**: This is the limitation the entry exists to remove, and it proves the selection-drives-count interaction end to end. It does not depend on plain groups, so it delivers value on its own.

**Independent Test**: Capture six columns, select all six and tap the tuplet control. The staff and the text export both show one bracket over six columns with a 6, and the numeral on the control read 6 before the tap.

**Acceptance Scenarios**:

1. **Given** six columns are selected, **When** the capturer looks at the selection toolbar, **Then** a tuplet control is present and its glyph shows 6.
2. **Given** a selection of two columns that is then extended by two more, **When** the capturer looks at the tuplet control, **Then** its numeral changes from 2 to 4 as the selection grows.
3. **Given** six columns are selected, **When** the capturer taps the tuplet control, **Then** all six share one group, one bracket spans them with a single 6, the selection ends, and the cursor stays where it was.
4. **Given** a selection of 16 playable columns, **When** the capturer looks at the toolbar, **Then** the tuplet control is present and reads 16, legibly.
5. **Given** a selection of 17 playable columns, **When** the capturer looks at the toolbar, **Then** the tuplet control is absent and the plain group control is present.
6. **Given** a selection holding one playable column, or only barlines, **When** the capturer looks at the toolbar, **Then** neither grouping control is present.
7. **Given** a selection containing a rest, **When** it is grouped as a tuplet, **Then** the rest counts as one of the columns.

---

### User Story 2 - Bracket a beat without printing a number (Priority: P1)

The capturer wants four sixteenths to read as one beat. A 4 over them would be noise, because four in the time of four is just music. They select the four columns and tap group. A bare bracket appears with no number, in the staff and in the export, and it survives copying, pasting, making a variant and syncing to another phone.

**Why this priority**: The brief calls this the one genuine modelling decision. Without it, grouping can only say something arithmetic, and most of what people want from "group these four" is phrasing. It carries the entry's only stored change.

**Independent Test**: Group four columns with the plain group control. The staff shows a bracket with no numeral, and the export shows `,-----,` above them. After copy and paste, and after making a variant, the copies are also plain groups.

**Acceptance Scenarios**:

1. **Given** four columns are selected, **When** the capturer taps the plain group control, **Then** one bracket with no number spans them on the staff, and `,-----,` spans them in the text export.
2. **Given** a part with plain groups and no counted tuplets, **When** it is drawn, **Then** the row above the staff that holds brackets is there, and the strings stay aligned with their labels.
3. **Given** a selection of 20 columns, **When** the capturer taps the plain group control, **Then** one plain group spans all twenty, and it syncs without a rejection.
4. **Given** a plain group, **When** it is copied and pasted, **Then** the pasted columns form their own plain group, separate from the original.
5. **Given** a plain group, **When** a variant is made of the part, **Then** the variant shows the same plain group.
6. **Given** a plain group made on one device, **When** it syncs to another, **Then** that device draws it with no number.
7. **Given** a counted tuplet stored before this entry, **When** it is drawn after this entry lands, **Then** it looks exactly as it did, with its number.
8. **Given** a counted tuplet over some columns, **When** the capturer selects exactly those columns and taps the plain group control, **Then** the group becomes plain, and the reverse also works. Re-grouping is how a group changes presentation, so no separate switch is needed.

---

### User Story 3 - Take a group apart (Priority: P2)

The capturer bracketed the wrong notes. They either select any column in the group and tap ungroup, or long-press a column inside it and tap ungroup in the column sheet. Every column of that group comes free, including ones outside the selection, and nothing else about the notes changes.

**Why this priority**: Until now a group, once made, could not be removed by any route in the app. That is tolerable with one small triplet and not with groups of any length. It depends on groups existing, so it ranks below the two stories that create them.

**Independent Test**: Make a six-column group. Select two of its columns and tap ungroup, and the whole bracket goes. Make it again, long-press one column, tap ungroup in the sheet, and the whole bracket goes.

**Acceptance Scenarios**:

1. **Given** a selection overlapping a group, **When** the capturer looks at the toolbar, **Then** an ungroup control is present.
2. **Given** a selection overlapping no group, **When** the capturer looks at the toolbar, **Then** no ungroup control is present.
3. **Given** a six-column group with two of its columns selected, **When** the capturer taps ungroup, **Then** all six columns leave the group and the bracket disappears.
4. **Given** a selection overlapping two groups, **When** the capturer taps ungroup, **Then** both groups are gone.
5. **Given** a single selected column inside a group, **When** the capturer looks at the toolbar, **Then** ungroup is present and neither grouping control is.
6. **Given** a column inside a group, **When** the capturer opens its sheet, **Then** the sheet has a row saying which kind of group the column is in, with an ungroup action.
7. **Given** a column in no group, or a barline, **When** the sheet opens, **Then** it has no group row.
8. **Given** the sheet's ungroup action is tapped, **When** it completes, **Then** the whole group is gone and the sheet closes, as it does after any action row.
9. **Given** a variant whose group came from its parent part, **When** the capturer ungroups in the variant, **Then** the parent part's group is untouched.
10. **Given** a group is ungrouped, **When** the columns are inspected, **Then** their notes, repeats, techniques, chords and order are unchanged.

---

### User Story 4 - The triplet stays one tap, mid-riff (Priority: P2)

The capturer is mid-flow and hears a triplet. They tap the triplet button in the main toolbar and carry on, exactly as they do today. Nothing is selected. If the button cannot make a true triplet at that spot, it writes nothing and the status line says why, instead of drawing a 3 over two notes.

**Why this priority**: This is the common case and the only one that happens while playing, so it must not get slower. The refusal closes two ways the button can draw something false today.

**Independent Test**: With three columns and the cursor on the last, tap the triplet button and see one bracket reading 3. With two columns, tap it and see no bracket, a status line explaining why, and no write.

**Acceptance Scenarios**:

1. **Given** the cursor is on a playable column with two playable columns before it in the same bar, **When** the capturer taps the triplet button, **Then** those three columns become a counted tuplet of 3.
2. **Given** the cursor is mid-part, **When** the capturer taps the triplet button, **Then** the three columns ending at the cursor are grouped, and not the last three of the part.
3. **Given** fewer than three playable columns end at the cursor, **When** the capturer taps the triplet button, **Then** nothing is written and the status line says a triplet needs three columns in one bar.
4. **Given** a barline falls among the three columns ending at the cursor, **When** the capturer taps the triplet button, **Then** nothing is written and the status line says the same.
5. **Given** the cursor is on a playable column, **When** the capturer looks at the main toolbar, **Then** the triplet button is present and in its usual place, whether or not a triplet is possible there, so the row does not shift under the thumb on the third note.
6. **Given** a capturer who never groups anything, **When** they capture, **Then** the taps, the toolbar and the stored rows are the same as before this entry.

---

### Edge Cases

- **A barline at the edge of a selection.** It is ignored. The columns between form one group, and the bracket stops short of the bar.
- **A barline inside a selection.** A group never crosses a barline. Today this produces two brackets that share one group and each print the full count, so four columns across a bar read `,4,   ,4,`, and that is the result this entry removes. The tuplet control is absent, because no single number is true of the selection. The plain group control makes one group per bar. A bar holding a single selected column leaves that column as it was.
- **A selection of fewer than two playable columns.** No grouping control is offered. The same goes for two columns with a barline between them, because no bar holds two.
- **Columns already in another group.** Any group that loses a column to the new one is dissolved whole, including its columns outside the selection, because what is left would print a number it no longer has. This covers taking the middle of a group, an end of it, all of it, and overlapping two groups. It applies to the triplet button too: grouping `a b c`, then adding `d` and tapping triplet with the cursor on `d`, leaves `b c d` as a triplet and `a` ungrouped.
- **A group containing a `repeat: 8` column.** In expanded density the column unrolls into eight drawn columns, and the span stays one unbroken bracket with one number. In compact density the same group is drawn over its stored columns. Three stored columns read 3 in both densities: `,--------3--------,` over ten drawn columns and `,--3--,` over `5 5x8 5`. The number counts stored columns. See Assumptions.
- **Changing a repeat inside a group.** The number does not change, and the bracket stretches or shrinks in expanded density.
- **Two adjacent groups.** They stay two brackets. In the text they are separated by the gap between columns, so two plain pairs read `,-, ,-,`. On the staff, each bracket's closing and opening ticks keep them apart.
- **A group next to a connector.** The bracket runs unbroken across a connector inside its span, as `playing-techniques` requires.
- **More than 16 columns as a tuplet.** It is never offered. A count above 16 is not a display problem: sync refuses that row, and a refused row blocks the whole push batch behind it, so one bad group could stop a device syncing at all.
- **A selection with a barline at its edge.** The "N selected" message still counts the barline, as it always has, so it can read 5 while the tuplet control reads 4. The control is the number that will be drawn.
- **A group stored before this entry that crosses a barline.** Existing data stays as it is and is drawn as it was. Ungrouping removes both halves, and re-grouping replaces it under the new rules.
- **Two people grouping overlapping columns at once.** Each column keeps whichever write was later, as for any other field. The result may be a partial group, which either person can fix by re-grouping. It cannot be a column with one write's id and another's presentation.
- **A row or clipboard written before this entry.** It has no `groupKind` at all. It reads as null, and syncs and pastes as before.

## Requirements *(mandatory)*

### Functional Requirements

**The stored model**

- **FR-001**: Each column MUST gain one nullable field, `groupKind`, holding `"tuplet"`, `"plain"` or null. The span-over-columns model MUST otherwise stay as it is.
- **FR-002**: A counted tuplet MUST store the states in the Stored states table: the shared id, the count and `"tuplet"`. A plain group MUST store the shared id, no count and `"plain"`. A column in no group MUST store null in all three.
- **FR-003**: A grouped column whose `groupKind` is null or absent MUST read as a counted tuplet.
- **FR-004**: `groupKind` MUST sync field by field like the other group fields, and MUST be a validated part of the wire format, accepting only the values in FR-001.
- **FR-005**: Every action that creates, replaces or removes a group MUST write all three fields on every column it touches, so that field-by-field merging cannot pair one action's id with another's presentation.
- **FR-006**: Rows lacking the field MUST still be accepted on push. That covers rows already in a device's local store and rows already queued to send when this entry lands. Such a row MUST NOT block a sync batch.
- **FR-007**: `groupKind` MUST be carried everywhere the other group fields are carried: copy and paste, and making a variant. A clipboard saved before this entry MUST still paste, with its groups as counted tuplets. Columns created by any other path MUST start with it null.
- **FR-008**: The server schema MUST gain the column through a migration, and the compile-time check that the server schema matches the client model MUST pass without being weakened.

**Grouping rules**

- **FR-009**: A counted tuplet's number MUST be the count of playable columns in the group. A playable column is any column that is not a barline, so a rest counts. A column's repeat MUST NOT change it.
- **FR-010**: A group MUST NOT span a barline. No write may put columns on both sides of a barline into one group.
- **FR-011**: A counted tuplet MUST hold 2 to 16 columns. The app MUST NOT write a count outside that range.
- **FR-012**: A plain group MUST hold 2 columns or more, with no upper limit.
- **FR-013**: When a column joins a new group, every group it was already in MUST be dissolved whole within that part, leaving no remnant with a stale number.
- **FR-014**: Ungrouping MUST remove every column of each affected group within the part being edited, whether or not those columns are selected, and MUST NOT touch any other part, including a variant's parent that shares the group's id.
- **FR-015**: Each group or ungroup action MUST apply as a single batch, so a failure cannot leave it half done.
- **FR-016**: Grouping and ungrouping MUST change nothing about a column except the three group fields.

**The selection toolbar**

- **FR-017**: The selection toolbar MUST gain three controls, shown only when they can act and otherwise absent rather than disabled. Their presence MUST track the selection live as it is extended:

  | Control | Present when | Effect |
  |---------|--------------|--------|
  | Tuplet, showing the count | All selected playable columns are in one bar, and there are 2 to 16 of them | One counted tuplet of that count |
  | Group, a bracket with no numeral | At least one bar holds 2 or more selected playable columns | One plain group per such bar |
  | Ungroup | At least one selected column is in a group | FR-014 |

- **FR-018**: Copy, cut and delete MUST keep their places and their behaviour. The three new controls come after delete, in the order tuplet, group, ungroup, and cancel stays last.
- **FR-019**: After a group or ungroup action the selection MUST end and the cursor MUST stay where it was.
- **FR-020**: At 375×667 with all seven controls present, labels MUST NOT wrap, the staff MUST keep every string of a four- or five-string part in view, and the page MUST NOT scroll. A six-string part does not fit at this size: at most one string MAY sit out of view, at rest and while selecting, and every string and the bracket MUST be reachable with a swipe (decided by the product owner on 2026-11-04, review F24).
- **FR-021**: Each new control MUST have an accessible name that says what it does, with the count for the tuplet control. The tuplet control's name and title MUST NOT contain the word "triplet", which identifies the main toolbar button.

**The main toolbar's triplet button**

- **FR-022**: The triplet button MUST stay in the main toolbar, in its place, under the same name and title, with one tap and no selection. It MUST keep acting on the three playable columns ending at the cursor.
- **FR-023**: The button MUST be present on every playable column, as it is today.
- **FR-024**: When those three columns do not exist, or a barline falls among them, the button MUST write nothing and the status line MUST say that a triplet needs three columns in one bar.
- **FR-025**: `tripletFromTail` MUST be kept and MUST follow the same rules as the button: exactly `count` columns in one bar, or no write.

**The column sheet**

- **FR-026**: The column sheet MUST show a group row only for a column in a group. The row MUST say which kind, as "tuplet of 5" or "plain group", and offer ungroup.
- **FR-027**: The row MUST be added as one more entry in the sheet's existing property list, with no special case in the sheet itself.

**The glyph**

- **FR-028**: One bracket glyph MUST take its numeral as a parameter, with no numeral allowed. The triplet button passes 3, the tuplet control passes the live count, and the group control passes none.
- **FR-029**: Every numeral from 2 to 16 MUST be readable at button size, with no digit touching the bracket.

**Drawing**

- **FR-030**: A counted tuplet MUST draw as it does today, on the staff and in the text export. Output for every part with no plain group MUST be unchanged, byte for byte.
- **FR-031**: A plain group MUST draw as a bracket with no number, on the staff and in the text export, following the notation table. It MUST reach the same extents as a counted tuplet over the same columns.
- **FR-032**: Plain groups MUST use the same bracket row as counted tuplets, on every surface that draws a staff, and the export's option to hide tuplets MUST hide both.
- **FR-033**: A group MUST draw as one unbroken bracket with at most one number across any repeated columns inside it, in both densities.
- **FR-034**: The bracket line MUST have a contrast of at least 3:1 against every surface a staff is drawn on, in both themes. If it does not read at actual size, the fix MUST be a colour named per theme, not opacity over a surface.

**Proof**

- **FR-035**: Automated tests MUST pin each of the following:
  - a barline at the edge of a selection and inside one, including that no bracket crosses the bar and no group prints a count that is not its own
  - a selection of fewer than two playable columns offering neither grouping control
  - grouping columns already in a group, for a partial overlap, a middle section and two groups at once
  - a group containing a `repeat: 8` column, in both densities
  - selections of 2, 16 and 17 columns and over
  - rows and clipboards with no `groupKind`
- **FR-036**: The automated guard left by `playing-techniques`, `src/lib/__tests__/storage-fence.test.ts`, MUST be removed. It forbids exactly the changes FR-001 and FR-035 require, and it compares against `main`, so re-pinning it would only move the problem. Its review (spec 002, F11) expected this.
- **FR-037**: The existing test "skips barlines when grouping from the tail" MUST be changed, not preserved. It asserts that three columns across a barline join one group, which FR-010 forbids. Its stated intent, that a barline never joins a group, MUST still be asserted. Every other existing test MUST pass unedited, including the exact-string text tests and the toolbar presence tests.
- **FR-038**: The result MUST be looked at in a browser at actual size in both themes, as `docs/DECISIONS.md` requires, covering a plain bracket on each surface that draws a staff and a two-digit numeral on the tuplet control. The check MUST be recorded and MUST NOT be marked done until someone has actually looked.

### Key Entities

- **Column**: One stored position in a part. It belongs to at most one group, and carries that group's id, count and presentation.
- **Group**: A run of columns in one bar of one part, sharing an id. It is not stored as a row of its own. A variant's copy of a group shares its parent's id, so a group is identified by its id within a part.
- **Span**: The drawn bracket. It is derived from the columns at draw time and is never stored. It covers every drawn column of its group, including repetitions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With a selection made, a group of any allowed size takes exactly one tap, with no picker, stepper or held gesture.
- **SC-002**: For every count from 2 to 16, the number on the control, the number on the staff and the number in the export are the same.
- **SC-003**: Every part with no plain group renders identically to before, with no change to any existing exact-string expectation.
- **SC-004**: No selection of any size or shape can produce a row that sync refuses, proven across selections of 2 to 40 columns with and without barlines.
- **SC-005**: No bracket crosses a barline, and no bracket shows a number other than its own group's, across every grouping path.
- **SC-006**: After any group or ungroup action, every counted tuplet in the part that the action touched holds exactly as many columns as its number, and no dissolved group leaves a remnant.
- **SC-007**: A group can be removed from both routes, the selection toolbar and the column sheet, with one tap once the toolbar or sheet is open.
- **SC-008**: The bracket line measures at least 3:1 contrast on every staff surface in both themes. A person looking at a phone-sized view at actual size in both themes confirms a plain bracket is visible and reads as a bracket.
- **SC-009**: On a 375×667 viewport in both themes, the selection toolbar with all seven controls shows every label on one line, the staff keeps every string of a four- or five-string part in view, a six-string part has at most one string out of view with every string and the bracket reachable by a swipe, and the page does not scroll.
- **SC-010**: A capturer who never groups anything sees no change in taps, toolbar layout or stored rows, apart from the new field being null.

## Out of Scope

Named explicitly, with the roadmap entry that picks each up where there is one:

- **Durations and a metronome.** Entry `rhythm-and-tempo`, even though grouping and duration are both rhythm. Grouping changes no column's duration.
- **Playing techniques.** Entry `playing-techniques`, already landed.
- **Parsing groups from pasted text.** Entry `ascii-import`, which depends on the notation defined here.
- **Re-counting a group after later edits.** See Assumptions.
- **Repairing groups already stored across a barline.** They stay as they are until someone regroups them.
- **A switch that flips a group's presentation.** Re-grouping the same columns does this.
- **Announcing groups to screen readers on the staff.** The staff does not announce tuplets today, and this entry does not change that.

## Assumptions

Decisions taken where the roadmap entry left room, so that planning does not have to stop and ask. The first five are the ones most worth a second look.

- **A barline inside a selection does not produce one contiguous span, so the rule changed.** The entry asks to confirm the span stays contiguous after barlines are filtered out. It does not. Running today's code on four columns across a bar gives two spans sharing one group, each printing the full count: `,4,   ,4,`. Three columns across a bar give `3   ,3,`. Filtering is only safe for a barline at the selection's edge. The rule is therefore that a group never crosses a barline. A tuplet is refused there, because no single number is true of the selection. A plain group splits per bar, because a bracket per bar is honest and has no number to get wrong. This costs one existing test (FR-037).
- **A plain group stores no count.** The wire format caps the count at 16, and a refused row blocks the whole push batch, so storing the selection length on a 20-column plain group would stop that device syncing. A number that is never drawn can only be wrong, so it is not stored. This is what makes plain groups unlimited. It also means the count being null would, on its own, identify a plain group. `groupKind` is kept anyway, as the brief requires, because existing readers treat a null count as 3, so a named value is clearer than a meaningful absence.
- **The number counts stored columns, not hits.** "The selection length is the count" is ambiguous for a repeated column, which is one stored column but eight drawn ones. The number follows the selection message and what `tupletCount` means today, stays the same in both densities, and cannot go stale when a repeat is changed. The cost is that a counted tuplet around a repeated column reads 3 over ten drawn columns. A plain group is the better tool for that shape. Counting hits instead would make the triplet button's 3 false on any repeated column, and could push ordinary selections past 16.
- **The triplet button acts at the cursor, not at the tail.** The entry says `tripletFromTail` already does what the button does. In fact the button groups the three columns ending at the cursor, on purpose, so it works mid-part, and `tripletFromTail` is called only from tests. At the end of a part the two are identical. This spec keeps the button's behaviour, because switching would remove mid-part triplets, and keeps the function, as the entry asks.
- **Later edits do not re-count a group.** Deleting, cutting or inserting a column inside a group behaves as it does today: the bracket shrinks or splits and the number stays. Copying part of a group likewise pastes that part with the original number. This was tolerable with triplets and is more visible with larger groups. Fixing it means deciding what a stored count is for once it can disagree with the columns, including under sync, which is a bigger change than this entry. Regrouping corrects the number.
- **The button stays present when it cannot act.** The entry's "must not offer the action" is about a selection, and the selection controls are absent as asked. The triplet button is different: it arrives on the third note mid-riff, and it sits first in its row, so making it appear on that note would shift every control beside it under the thumb. The existing presence test also expects it on every playable column. Refusing with a reason in the status line replaces today's silent no-op and today's 3 over two columns.
- **`groupKind` is the chosen name, and its values are `"tuplet"` and `"plain"`.** Planning decides how it is stored, but not what it is called.
- **Existing span expectations stay valid.** The existing tests compare spans exactly, so the way a plain span is told apart must not add to a counted span's shape. A plain span's count being null would meet this.
- **A device on an older cached version** draws a plain group with a 3 until it updates, because it reads a null count as 3. It does not lose data, because merging is by field clock. This is accepted as temporary.
- **The status line is the existing one**, with its existing lifetime. No new toast or dialog is added.
- **Measured starting point for contrast.** The bracket's current colour measures 3.74:1 and 3.46:1 in the dark theme, and 3.30:1 and 3.42:1 in the light theme, on the base and raised surfaces. That passes, narrowly. A number gives a bracket a second cue, and a plain bracket has none, so the measurement does not replace looking at it.
- **The browser check happens after merge.** The pipeline's phases have no browser, so FR-038 stays owed through implementation and is done from the separate verify worktree, as the roadmap's process describes. It must not be ticked to get past a phase.
- **Depends on** `capture-control-surface` for the column sheet and the toolbar's presence rules, and on `playing-techniques` for the rule that brackets run across connectors. Both have landed.
