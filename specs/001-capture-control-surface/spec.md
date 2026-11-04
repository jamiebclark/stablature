# Feature Specification: Restructure the capture control surface

**Feature Branch**: `001-capture-control-surface`

**Created**: 2026-11-02

**Status**: Draft

**Input**: User description: "Re-arrange the capture screen's controls so that later entries have somewhere to put new ones. This entry adds NO new musical capability: when it lands, exactly the same things are possible as before, reachable from better places." (full roadmap entry: `.specify/roadmaps/capture-expression.json`, entry `capture-control-surface`)

## Summary

The capture screen's controls are all in one wrapping row, sorted by nothing. This re-sorts them by **what they modify**, so that each kind of control has an obvious home and room to grow:

| Scope | Home | Lives there today |
|-------|------|-------------------|
| Modifies the **next note** you press | A thin latch strip across the top of the on-screen neck | `stack` |
| Acts on the **column at the cursor** | The bottom toolbar, made contextual | repeat stepper, ×4, space, barline, triplet, chord symbol, select, paste, delete |
| Acts on a **selection** | The selection toolbar that already replaces the row | copy, cut, delete, cancel — unchanged |
| Properties **of one column**, set at rest | A new sheet opened by long-pressing a column | repeat count, chord symbol, delete |

No new musical capability. When this lands, exactly the same things are possible as before.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - The next-note modifier sits with the neck (Priority: P1)

Someone is capturing a riff one-handed with their thumb on the on-screen neck. They want the next fret they press to join the column they are already on, rather than start a new one. Reaching away from the neck into a row of verbs to say so breaks the flow, so the modifier moves to a thin strip directly above the neck — where the thumb already is — and stays visibly lit for as long as it is armed.

**Why this priority**: It is the one control that genuinely moves, and the strip it moves into is the extension point two later roadmap entries hang their controls on. If only this ships, the screen is already better and the strip exists.

**Independent Test**: Capture a three-note chord using only the neck and the strip above it, without touching the bottom toolbar. The three notes land in one column, the latch is visibly lit throughout, and the status line says what is happening.

**Acceptance Scenarios**:

1. **Given** a part with at least one playable column and the cursor on it, **When** the capturer arms the stack latch in the strip and presses three frets on different strings, **Then** all three notes land in the column at the cursor, the latch stays lit and armed across all three presses, and the status line reads "stacking onto the marked column".
2. **Given** the stack latch is armed, **When** the capturer disarms it and presses a fret, **Then** the note starts a new column after the cursor, the latch is no longer lit, and the status line returns to describing where notes are being added.
3. **Given** the stack latch is armed, **When** the capturer taps a different column, switches part, or inserts a space or barline, **Then** the latch disarms and stops being lit — the same behaviour the control has today.
4. **Given** the capturer has a screen reader, **When** they reach the latch, **Then** its name and its armed/unarmed state are announced, and arming it is announced as a state change rather than as an action with no result.

---

### User Story 2 - The toolbar stops showing dead controls (Priority: P2)

The cursor is on a barline. Repeat, ×4 and chord symbol mean nothing there, and today the screen spends its scarce width drawing them greyed out. The capturer should see only the controls that will do something, and the controls that are always available should not jump out from under their thumb when the cursor moves.

**Why this priority**: It is what buys back the vertical and horizontal room the new strip costs, and it is a pure subtraction — nothing new to learn.

**Independent Test**: Move the cursor between a playable column and a barline and watch the toolbar. The inapplicable controls are absent rather than greyed out, and the always-applicable ones do not move.

**Acceptance Scenarios**:

1. **Given** the cursor is on a playable column, **When** the capturer looks at the bottom toolbar, **Then** the repeat stepper, ×4 and chord symbol are present and usable.
2. **Given** the cursor is on a barline, **When** the capturer looks at the bottom toolbar, **Then** the repeat stepper, ×4 and chord symbol are absent entirely — not present-and-disabled.
3. **Given** the capturer has just inserted a barline (so the cursor is on it), **When** they press space, barline, triplet, select, paste or delete, **Then** each of those controls is in the same screen position it occupied a moment earlier, so the press lands where they aimed.
4. **Given** a selection exists, **When** the capturer looks at the controls row, **Then** it is replaced wholesale by copy / cut / delete / cancel exactly as it is today, with the selected-count message still readable, and the contextual behaviour of story 2 does not leak into it.
5. **Given** there is no part yet, **When** the capturer looks at the screen, **Then** the controls that need a part are unavailable and the screen says to add a part — as today.

---

### User Story 3 - Long-press a column to inspect it (Priority: P3)

The riff is captured and the capturer has stopped playing. They want to look at one column and set its properties — how many times it repeats, what chord is written above it — while looking at that column rather than at a toolbar whose target is implied by a cursor. Long-pressing the column opens a sheet for exactly that column.

**Why this priority**: It ships genuinely useful on its own, and it is the extension point two later roadmap entries (per-note decorations, note durations) depend on. It is third because the screen is already better without it and a mis-built long press can make normal tapping feel broken.

**Independent Test**: Long-press a column, change its repeat count and set a chord symbol from the sheet, close it, and see both reflected on the staff — without the normal tap-to-move-the-cursor behaviour having changed.

**Acceptance Scenarios**:

1. **Given** a part with several columns in the capture screen, **When** the capturer long-presses one column, **Then** a sheet opens naming that column and offering its repeat count, its chord symbol and delete.
2. **Given** the inspector is open on a column, **When** the capturer raises the repeat count and closes the sheet, **Then** the staff shows that column repeated, and the change is identical to what the bottom toolbar's stepper would have produced.
3. **Given** the inspector is open on a column, **When** the capturer sets a chord symbol and closes the sheet, **Then** the symbol appears above that column on the staff.
4. **Given** the inspector is open on a column, **When** the capturer deletes from the sheet, **Then** that column is removed and the sheet closes.
5. **Given** a part with several columns, **When** the capturer taps (does not hold) a column, **Then** the cursor moves to that column and no sheet opens — exactly today's behaviour, with no added delay before the cursor moves.
6. **Given** the capturer begins a press on a column and then drags sideways to scroll the staff, **When** they release, **Then** no sheet opens and no cursor move is triggered.
7. **Given** the inspector is open, **When** the capturer dismisses it without changing anything, **Then** the screen is in exactly the state it was in before — including which column the cursor is on.
8. **Given** the staff is rendered read-only (the song page, the play view), **When** the reader long-presses a column, **Then** nothing happens: there is no inspector and no hint that there might be one.
9. **Given** the capturer is using a keyboard or a screen reader, **When** the inspector is open, **Then** every control in it is reachable and operable, and the sheet can be dismissed without a pointer.

---

### Edge Cases

- **Cursor on a barline, long-pressed.** The inspector opens for the barline and offers only what applies to it (delete), not an empty repeat stepper or chord field. It does not open an inspector with nothing in it.
- **Cursor at the very start or at the end.** The cursor can sit before the first column ("adding at the start") or track the end. In both cases the toolbar shows the controls that apply to whatever the cursor resolves to, and the latch strip behaves as it does today when there is no column to stack onto.
- **Latch armed, then the cursor moves somewhere it cannot apply.** The latch disarms rather than staying lit and silently doing nothing.
- **Long press while a selection is active.** A tap during a selection extends the selection; a long press during a selection does nothing, so the two gestures never fight over the same column.
- **Long press on an empty part.** There are no columns to press, so nothing happens.
- **Inspector open when the underlying column is deleted** (from another device, mid-sync). The sheet closes rather than editing something that no longer exists.
- **Smallest supported phone in both themes.** At a 375×667 viewport the whole screen still fits without page-level scrolling, in light and dark. The light theme is the one that has broken before.
- **A five-string tuning.** The staff shows every string without the staff area scrolling vertically, after the strip has taken its share of the height.

## Requirements *(mandatory)*

### Functional Requirements

**Scope and non-regression**

- **FR-001**: Every action possible on the capture screen before this change MUST remain possible after it. No musical capability is added and none is removed.
- **FR-002**: The plain-text export of a part MUST be character-for-character identical to what it is today, and the staff MUST draw every column exactly as it does today, because nothing new is being drawn.
- **FR-003**: The selection toolbar's behaviour (copy, cut, delete, cancel, the selected-count message, tap-to-extend) MUST be unchanged, and MUST be confirmed to still read correctly once the toolbar is contextual.

**The next-note latch strip**

- **FR-004**: The screen MUST present a thin strip of next-note modifier latches immediately above the on-screen neck, as part of the neck's own surface rather than as another row of verbs.
- **FR-005**: The existing stack toggle MUST move into that strip and MUST be removed from the bottom toolbar. Its behaviour — stays armed across presses, disarms on any action that means the capturer has moved on — MUST be unchanged.
- **FR-006**: An armed latch MUST be visibly lit, carrying the same emphasis the stack button's armed state carries today, and MUST announce its armed state to assistive technology.
- **FR-007**: The status line MUST continue to read "stacking onto the marked column" while the stack latch is armed.
- **FR-008**: The strip MUST be defined as an ordered list of latches, so that adding further latches is a data change and not a layout change. Four more latches MUST be addable without re-laying out the strip. (Later roadmap entries add hammer-on, pull-off, slide-up and slide-down here; this entry adds none of them.)
- **FR-009**: A latch that cannot apply where the cursor currently is MUST be visibly unavailable rather than silently inert, and MUST hold its position in the strip rather than disappearing.
- **FR-010**: When there is no part to write to, the strip MUST be unavailable along with the rest of the neck.

**The contextual cursor toolbar**

- **FR-011**: Controls in the bottom toolbar that cannot apply to the column at the cursor MUST be absent from it, not rendered in a disabled state. Specifically: with the cursor on a barline, the repeat stepper, ×4 and chord symbol MUST be absent.
- **FR-012**: Controls that always apply (space, barline, triplet, select, paste, delete) MUST keep stable screen positions as the cursor moves between playable columns and barlines, so that a control does not move out from under a thumb that is already travelling toward it.
- **FR-013**: The toolbar MUST act on the column at the cursor, and which column that is MUST remain discoverable from the staff and the status line exactly as it is today.

**The long-press column inspector**

- **FR-014**: Long-pressing a column on the capture staff MUST open a sheet scoped to that one column.
- **FR-015**: In this entry the inspector MUST host only properties that already exist: the column's repeat count, its chord symbol, and delete. It MUST NOT introduce a new property of any kind.
- **FR-016**: The inspector MUST be structured as a general per-column property sheet — a list of properties that apply to the column — so that later entries add a property by declaring it, not by rebuilding the sheet. It MUST NOT be a hardcoded three-control panel.
- **FR-017**: The inspector MUST show only the properties that apply to the column it was opened on, on the same rule the toolbar uses: a barline offers delete and not repeat or chord symbol.
- **FR-018**: Editing a property in the inspector MUST produce the same result as the equivalent toolbar control, down to the stored data.
- **FR-019**: A short tap on a column MUST keep its current meaning — move the cursor there — and MUST NOT be delayed, debounced or made conditional on the long press not having fired.
- **FR-020**: A press that moves (a drag to scroll the staff) MUST cancel both the long press and the tap.
- **FR-021**: The long press MUST be available only where a column can already be tapped to move the cursor — that is, on the capture staff. Wherever the staff is read-only (the play view, the song page) it MUST be absent, with no inspector and no hint that there might be one.
- **FR-022**: A long press MUST do nothing while a selection is active.
- **FR-023**: Dismissing the inspector without editing MUST leave the screen in its prior state, including the cursor position.
- **FR-024**: The inspector MUST be fully operable by keyboard and comprehensible to a screen reader, including dismissal.
- **FR-025**: If the column the inspector is open on ceases to exist, the inspector MUST close.

**Vertical budget and presentation**

- **FR-026**: The capture screen MUST continue to fit the viewport without page-level scrolling: header, part chips, staff, status row, optional chord form, controls row, latch strip and neck.
- **FR-027**: The height the latch strip costs MUST come out of the staff's scroll area, not out of the neck. The neck's own height MUST be unchanged.
- **FR-028**: The staff MUST continue to show every string of a five-string tuning, plus the chord row when chords are present, without the staff area scrolling vertically at the smallest supported phone viewport.
- **FR-029**: Every new or changed surface MUST be legible in both the light and the dark theme, verified in a browser at actual size on a phone viewport — not through a magnified crop. (Repo convention: "browser testing is part of done", `docs/DECISIONS.md`.)
- **FR-030**: Where a new surface uses more than one shade to separate itself from what is behind it, those shades MUST stay visibly distinct in both themes, and the distinction MUST NOT rest on hue alone at matched lightness — the failure mode that made the neck unusable in the light theme once already. (The mechanism this rules out is recorded in Assumptions.)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A capturer can do everything they could do before. For each of the ten controls on the screen today — repeat stepper, ×4, stack, space, barline, triplet, chord symbol, select, paste, delete — there is at least one place to reach it, and no action that was previously possible has been dropped.
- **SC-002**: Capturing a three-note chord takes no more taps than it does today (arm once, three fret presses), and is done without the hand leaving the neck and the strip above it.
- **SC-003**: The four-second capture path — press fret, press fret, press fret, with no modifier touched — takes no more taps and feels no slower than before. A tap on a column still moves the cursor on release with no perceptible delay.
- **SC-004**: With the cursor on a barline, zero controls are shown that cannot be used. (Today: three.)
- **SC-005**: Every control that is always applicable stays at the same screen coordinates as the cursor moves between a playable column and a barline, at the smallest supported phone width.
- **SC-006**: On a 375×667 viewport, in both light and dark themes, the entire capture screen is visible with no page-level scrolling, every string of a five-string part is visible on the staff, and the neck occupies the same height it did before the change.
- **SC-007**: A further next-note latch can be added to the strip by declaring one more latch, with no change to how the strip is arranged — shown by the strip reading correctly with five latches at the smallest supported phone width.
- **SC-008**: A further property can be added to the column inspector by declaring one more property, with no change to how the sheet is arranged — shown the same way.
- **SC-009**: For each of repeat count, chord symbol and delete, the result of the action taken through the inspector is indistinguishable from the result of the same action taken through the bottom toolbar.
- **SC-010**: A long press on a column in the play view and on the song page produces no sheet and no visible response.
- **SC-011**: The plain-text export of a given part is identical before and after this change, for every part shape the project already has a recorded example of.

## Out of Scope

Named explicitly, with the roadmap entry that picks each up:

- **Playing techniques of any kind** — no hammer-ons, pull-offs, slides, bends, vibrato, harmonics, taps, palm mutes or let-rings, and no latches for them. Entry `playing-techniques`. This entry builds the strip they will live in and puts nothing new in it.
- **Any change to how tuplets are created, or how many notes they can span.** The triplet button keeps its current "group the last three" behaviour. Entry `generalised-grouping`.
- **Note durations and the metronome.** Entry `rhythm-and-tempo`. The inspector is the place a duration control will go; it does not go there now.
- **Any change to how tab is laid out, drawn or exported**, because nothing new is being drawn. The on-screen staff and the text export share one layout, and neither changes here.
- **Any change to the data model, the database schema, the wire protocol or the clipboard.** This entry is a re-arrangement of controls over data that already exists.
- **Any change to the selection toolbar's behaviour.** A later entry adds group/ungroup to it; this one only confirms it still reads correctly.

## Assumptions

Decisions taken where the roadmap entry left room, so that planning does not have to stop and ask:

- **"Replace inapplicable controls with applicable ones" means omit them.** This entry adds no new controls, so on a barline there is nothing to promote into the freed space — the inapplicable controls are simply absent and the row is shorter. The freed space is headroom for the later entries, not something that must be filled now.
- **The always-applicable controls hold fixed positions.** Removing controls would otherwise shift the remaining ones sideways precisely when the capturer has just pressed barline and is reaching for the next verb. The row is therefore arranged so that the context-dependent controls sit together and the stable ones do not move. This is the resolution of the one genuine tension in making the row contextual.
- **The latch strip is a fixed list, not a reflowing set.** Latches that cannot apply stay in place and are visibly unavailable. A strip whose contents shuffle is a mis-tap hazard, and it would make the later entries' four extra latches a layout problem rather than a data one.
- **Long press means a sustained press of roughly half a second that has not moved.** Movement cancels it, and the tap still fires on release of a short press, so neither gesture waits on the other. The exact threshold is a tuning detail for the plan; the requirement is that a normal tap is never delayed.
- **The inspector duplicates rather than replaces.** Repeat count, chord symbol and delete remain in the bottom toolbar as well. That is deliberate: the toolbar is for mid-riff, the inspector is for at-rest, and keeping both means this entry removes nothing and the inspector's accessibility story has a fallback that already works.
- **No alternative gesture is added for the inspector.** Because everything it hosts is also in the toolbar, a capturer who cannot perform a long press loses no capability. The inspector itself must still be keyboard-operable once open.
- **The latch strip costs roughly 40px**, taken from the staff's scroll area. If the staff cannot then show a five-string part at 375×667, the budget has to be found elsewhere in the plan rather than by shrinking the neck — the neck is the primary input surface and the light-theme defect that made it unusable is recent history.
- **Two repo traps are assumed known and must not be re-debugged**: if a style change appears to do nothing, the dev server's CSS cache is stale — kill it and use `npm run dev:clean` before looking at the CSS; and a visual tier must never be opacity over a surface token, because on the light theme the raised surface is white. Both are documented in `docs/DECISIONS.md`.
- **Verification is both automated and visual.** The automated suite covers behaviour; the browser pass at actual size in both themes covers legibility, and neither substitutes for the other. This is the repo's standing convention, not a new requirement.
