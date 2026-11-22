# Feature Specification: Full-width reading layout, a whole song on one screen

**Feature Branch**: `010-wide-reading-layout`

**Created**: 2026-11-13

**Status**: Draft

**Input**: User description: "On desktop and wide tablets, lay staves across the full width so that a whole song fits on one screen on the song page and in the play view, while phones keep a layout that reads well." (full roadmap entry: `.specify/roadmaps/best-in-class.json`, entry `wide-reading-layout`)

## Summary

The README's thesis is that a song's whole form fits on one screen instead of unrolling into metres of linear tab. Today a desktop does the opposite. The song page is a narrow column in the middle of the screen, and the play view stacks one full-width card per pass, so a ten-pass song is a tall scroll of mostly empty cards.

This entry changes layout only, and only where the screen is wide:

1. **Cards flow across the width.** On the song page, part cards sit side by side. In the play view, pass cards sit side by side. Both read **row-major**: left to right, then the next row down, the way text reads. Every play-view card carries its number in that order.
2. **Staves fill their card.** On a wide screen a staff runs to its card's full width and wraps at barlines, so a long part uses several bars per line instead of a strip.
3. **A run of identical passes is drawn once.** `A ×4` with a variant on the 4th draws as one card for passes 1 to 3, marked `×3`, and one card for the variant. The click highlight, the keyboard steps, the variant marks and the bar numbers all still land on the right pass (FR-014 to FR-021).
4. **A measured fit target.** A fixed fixture song (four parts, ten passes, one of them a variant) fits with no vertical scroll on both pages at 1280×800 and 1440×900.
5. **The click bar sits at the foot of the screen** on a short song, and its height is the same at rest and running, so a double tap on Start still starts one click.

Layout follows **width**, not pointer. A wide tablet with a touch pointer gets the wide layout at touch sizes. Phones in portrait keep exactly today's one-column layout. Nothing about a song changes: no field, migration, sync message, export or import.

### Where the brief and the code differ

| The brief says | The code says | What this spec does |
|---|---|---|
| "each part card's staff uses about a third of its card on a desktop" | The song page's staff is **not** wrapped. It is one line that scrolls sideways inside its card. A short part leaves the rest of the card empty, and a long one hides most of itself off to the right. | On a wide screen the song page's staff wraps at barlines the way the play view's does (FR-008). On a phone it stays one line, as today (FR-024). |
| "the arrangement already says `A x4`" | The roadmap chips say `×4`. The play view's head row says `pass 2 of 4` on every pass, and bar numbers **run on across the whole song** (spec 007): pass 2 of an `A ×4` with 4-bar A starts at bar 5. | A drawn-once card cannot show four sets of running numbers. It shows the first pass's numbers and names the span of all of them in its head row (FR-018). The card after it carries on from the right number. |
| "keyboard stepping between columns and bars" | The play view's keys step in **reading order** (column back and on, bar back and on), through a flat list of every column of every pass, only while the click is stopped. There is no up or down between cards. | Unchanged. The steps follow reading order, whatever the cards' positions on screen. Stepping out of pass 1 of a drawn-once card goes back to its first column, now in pass 2 (FR-016). |
| "the play view's click bar sits directly under the last card in mid-page" | The bar is `sticky` at the foot of the page, so it only reaches the foot of the screen on a song long enough to scroll. On start it grows a help line below its controls. Spec 005 research R17 relies on that growth going **down**, so Stop lands clear of where Start was. | The bar sits at the foot of the screen on every song, and holds the running height at rest, so nothing in it moves when the click starts or stops (FR-027 to FR-030). |
| "Spec 007 made density follow `pointer: fine` and `pointer: coarse`" | It did: cell, control and gap sizes follow the pointer. No layout in the app follows width yet, apart from text wrapping. | Sizes still follow the pointer. Columns follow width only (FR-001, FR-002). |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Read a whole song in the play view without scrolling (Priority: P1)

A bassist puts a laptop on a music stand and opens the play view of a song with four parts and ten passes. Today they see the first three or four passes and have to scroll during the song. After this change, the passes sit side by side in numbered order, the three identical opening passes of the verse are one card marked `×3`, and the whole song is on the screen at once, with the click bar at the foot.

**Why this priority**: The play view is where a whole song is read while playing. Scrolling mid-song is the cost this entry exists to remove, and the play view is where the README's thesis is tested hardest.

**Independent Test**: Seed the fit song (see Success Criteria). Open its play view at 1280×800 and at 1440×900 with a mouse, in both themes. The page does not scroll vertically, every card is wholly visible above the click bar, and the cards read 1, 2, 3 … left to right, then down.

**Acceptance Scenarios**:

1. **Given** the fit song at 1280×800, **When** the play view opens, **Then** the page has no vertical scroll, and every card, from its head row to its last staff row, is visible above the click bar.
2. **Given** any song on a wide screen, **When** the play view is drawn, **Then** cards are placed in reading order, left to right and then down, and each card shows its number in that order. No card is placed out of order to fill a gap.
3. **Given** `A ×4` with a variant `A′` on the 4th pass, **When** the play view is drawn, **Then** passes 1 to 3 are one card marked `×3` (passes 1–3 of 4), and pass 4 is its own card showing `A′` with its variant marks.
4. **Given** a pass whose staff is wider than its card, **When** it is drawn, **Then** its staff wraps at barlines inside the card, with a bar number at the start of every bar, as the play view does today. No card is wider than its row.
5. **Given** a song too long to fit, **When** the play view opens, **Then** it scrolls vertically as it does today, and never sideways.

---

### User Story 2 - See every part of a song on the song page at once (Priority: P1)

A guitarist opens a song on a desktop to check what the parts are before practice. Today the page is a narrow column, and each part's staff fills about a third of its card. After this change the page uses the width of the screen. Part cards sit two or three to a row, each staff wraps at barlines inside its card, and every part is visible with the arrangement above it.

**Why this priority**: The song page is the first screen of a song. It is where the form is learnt, and on a desktop it currently wastes most of the screen.

**Independent Test**: Seed the fit song. Open its song page at 1280×800 and 1440×900 with a mouse, in both themes, with the panels closed. The page does not scroll vertically, and the arrangement and all four part cards are fully visible.

**Acceptance Scenarios**:

1. **Given** the fit song at 1280×800, **When** the song page opens, **Then** the header, the closed panels, the arrangement and all four part cards are visible with no vertical scroll.
2. **Given** a wide screen, **When** the song page is drawn, **Then** part cards are placed in their usual order, left to right and then down.
3. **Given** a part longer than its card on a wide screen, **When** it is drawn, **Then** its staff wraps at barlines inside the card, with a bar number at the start of every bar, instead of scrolling sideways.
4. **Given** a part card on a wide screen, **When** its menu is opened, it is renamed, or its label is tapped to edit it, **Then** each works as it does today.

---

### User Story 3 - Phones keep today's layout (Priority: P1)

A bassist at practice opens the same song on a phone. Nothing has changed: one card per row, the play view's staves wrap at barlines as they do now, the song page's staves are one line that scrolls sideways, and cell sizes are as before.

**Why this priority**: Phones are the primary device for capture and for reading at practice. A wide layout that leaks onto a phone would cost the readability that spec 007 built.

**Independent Test**: At 375×667 and 412×915 with touch, open the song page and the play view of the fit song and of the existing test songs. The layout is one column. Every phone-sized e2e test that does not pin the click bar's rest height passes unedited.

**Acceptance Scenarios**:

1. **Given** a 375-wide or 412-wide screen in portrait, **When** either page is drawn, **Then** cards are one per row at the full width, exactly as today.
2. **Given** a phone, **When** the play view shows `A ×4`, **Then** passes 1 to 3 are still one card marked `×3` (FR-014 holds at every width), and every other card is drawn as today.
3. **Given** a phone turned to landscape (wider than the wide threshold), **When** either page is drawn, **Then** it gets the wide layout at touch sizes, because layout follows width.

---

### User Story 4 - The click highlight and the keys still find the right pass (Priority: P2)

A drummer starts the click in the play view with "following notation" on. The highlighted column moves through the cards in reading order: along a row, then down to the first card of the next row. Inside the `×3` card it runs through the staff three times, and the card's head row shows which pass it is in. With the click stopped, the arrow keys step through the same columns in the same order.

**Why this priority**: The highlight and keys are what make the play view more than a picture. They must survive the new layout, and drawing a pass once is only acceptable if they do (brief: "only if… still land on the right pass").

**Independent Test**: Seed the fit song with eighth notes throughout. Start the click with following on, at 1280×800. Record the highlighted card and column at each beat for one full song. The sequence matches the order of every column of every pass, and while the highlight is in the `×3` card, the head row reads `pass 1 of 4`, then `pass 2 of 4`, then `pass 3 of 4`. Repeat with the keys while the click is stopped.

**Acceptance Scenarios**:

1. **Given** the click running with following on, **When** the highlight reaches the last column of the last card in a row, **Then** its next step is the first column of the first card in the next row.
2. **Given** the highlight in the drawn-once card for passes 1 to 3, **When** pass 1 ends, **Then** the highlight returns to that card's first column, and the head row's pass words change from pass 1 to pass 2.
3. **Given** the highlight in the drawn-once card's 3rd pass, **When** that pass ends, **Then** the highlight moves into the `A′` card, which shows the variant marks.
4. **Given** the click stopped, **When** the reader presses "column on" from the last column of pass 1 of the drawn-once card, **Then** the position moves to the first column of the same card, now in pass 2, and the head row says so. "Bar on" and the back steps behave the same way.
5. **Given** the highlight lands on a card partly off screen (a song too long to fit), **When** following is allowed, **Then** the page scrolls just enough to show it, as today.

---

### User Story 5 - The click bar sits at the foot of the screen (Priority: P2)

On a short song at 1280, the click bar is at the foot of the screen, not floating in mid-page under the last card. Tapping Start twice quickly still starts exactly one click, because nothing in the bar moves when it starts.

**Why this priority**: Once a whole song fits, a short page is the normal case, so the defect logged after spec 007's browser check becomes the common one. It must be fixed without breaking spec 005's double-tap guarantee (INV-024).

**Independent Test**: At 1280×800, 1440×900, 375×667 and 412×915, open a one-pass song's play view. The bar's bottom edge is at the foot of the screen. Measure Start and More before and after starting the click: neither moves. `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` pass unedited.

**Acceptance Scenarios**:

1. **Given** a song shorter than the screen, **When** the play view opens, **Then** the click bar's bottom edge is at the foot of the screen (above the safe area) at every width.
2. **Given** the click at rest, **When** it is started and then stopped, **Then** the bar's top edge, Start's box, Stop's box and the More button do not move.
3. **Given** the cluster (More), **When** it is opened or closed, **Then** the More button and Start do not move. The cluster opens upward over the staves.
4. **Given** a song longer than the screen, **When** it is scrolled to the end, **Then** the last card is wholly visible above the bar, as today.

---

### Edge Cases

- **A run of identical passes interrupted by a section boundary.** `[Verse: A ×2] ×2` plays A four times, but as two visits of the verse. Each visit's two passes are one card (`×2`), and the second visit's card carries `Verse, 2nd time`. Passes are never drawn once across a section visit.
- **Two separate entries of the same part.** `A, A` written as two entries is drawn as two cards. Only the passes of one arrangement entry are drawn once.
- **A bar-range entry.** `A bars 1–2 ×3` draws once with `×3` and its existing `bars 1–2 of this part` words.
- **An entry with `×2` and a variant on the 2nd.** Pass 1 is a card on its own. Nothing is marked `×1`.
- **An entry repeated once with a variant.** `A ×1` with `A′` on the last pass draws only `A′`, as today.
- **A part with no columns.** Its card is at least the floor's width (FR-005) and draws an empty staff, as today.
- **A bar wider than its card.** The bar sits on its own line inside the card, and scrolls sideways inside itself with a hidden scrollbar (spec 007 deviation 7). The page does not scroll sideways.
- **Note names or intervals.** Cells widen, so a staff can need another line and a card can grow. Cards may move to other rows when they grow (as T120 accepted for the play view). The page still never scrolls sideways.
- **Compact density on the song page.** Collapsed repeats still collapse. Wrapping applies to the collapsed staff.
- **A song with no arrangement.** The play view's empty state is unchanged. The click bar still sits at the foot of the screen.
- **A part with a long name, tempo and heading.** The head row wraps inside its card. It never widens the card past the row.
- **The width at the threshold.** At exactly the wide threshold (FR-001) the wide layout applies. One pixel below it, the phone layout applies.
- **Resizing or rotating.** The layout follows the new width without a reload. The highlight, if any, stays on its column.
- **Print.** Print follows the same width rule as the screen, using the printable width (FR-031).

## Requirements *(mandatory)*

### Functional Requirements

**Width, not pointer**

- **FR-001**: A page is **wide** when its viewport is at least 768 CSS pixels wide. Below that it is **narrow**. This is the only switch between the two layouts, on both pages.
- **FR-002**: Pointer type MUST NOT change which layout is used. It still sets cell, control and gap sizes exactly as spec 007 does. A wide screen with a touch pointer gets the wide layout at touch sizes.
- **FR-003**: On a narrow page, both pages MUST lay out as they do today: one card per row at the full width.

**Cards flow in reading order (wide only)**

- **FR-004**: On a wide page, cards (part cards on the song page, pass cards in the play view) MUST be placed **row-major**: left to right in their order, then onto the next row. A card MUST never be placed ahead of a card that comes before it.
- **FR-005**: A card MUST NOT be narrower than a card on a 375-wide phone is today (343 CSS pixels at today's page padding), unless the row itself is narrower than that. This **floor** keeps a card's head row, menu and staff as readable as they are on a phone. *Amended by spec 013:* the floor is per card: the card's head row on one line, at least 9rem and at most 343px. 343px stays only for a card holding memo rows or the recorder (013 FR-003, FR-005).
- **FR-006**: How a row divides its width among its cards is the plan's choice, measured against SC-001 and SC-002, within these rules: a row MUST NOT end with unused width at least as wide as the floor while cards remain to be placed; the rows' right edges MUST line up; and a card MUST NOT be wider than its row. A card narrower than its staff's one-line width wraps its staff at barlines (FR-008). *Amended by spec 013:* rows are placed greedily at each card's own one-line width; every row but the last fills the list's width; the last row keeps its cards' own widths (013 FR-006, FR-007).
- **FR-007**: Cards in one row MUST be aligned at their tops.

**Staves fill their card**

- **FR-008**: On a wide page, the song page's staves MUST wrap at barlines inside their card, the way the play view's staves already do. A line MUST hold as many whole bars as fit in the card's width.
- **FR-009**: Wrapping MUST keep everything spec 007 and entry `rhythm-notation` draw on a wrapped line: the string labels on each line, a bar number at the start of every bar, the chord row, group brackets and their numbers, and the rhythm row with stems, flags and beams. A beam MUST NOT cross from one line to the next.
- **FR-010**: A bar wider than its line MUST sit alone on its line and scroll sideways inside itself with a hidden scrollbar, as spec 007 deviation 7 has it. The page MUST NOT scroll sideways at any width from 320 to 2560.
- **FR-011**: The song page's header, panels and arrangement MUST use the same page width as the play view on a wide page. On a narrow page they are unchanged.

**Pass cards in the play view**

- **FR-012**: Every play-view card MUST show its number in reading order (1, 2, 3 …) as the first item of its head row. The numbering counts cards, not passes.
- **FR-013**: Every existing head-row item stays: the part label, the section words (`Verse, 2nd time`), the bar-range words, the part's name, and the tempo and beats heading on the first card of a part.

**Repeated passes drawn once**

- **FR-014**: Consecutive passes that come from **one** arrangement entry, play the **same** part and fall in the **same** section visit MUST be drawn as one card. This holds at every width, on screen and in print.
- **FR-015**: A drawn-once card MUST say how many passes it stands for and which they are, as `×3 · passes 1–3 of 4`. A card for a single pass of a repeated entry keeps today's `pass 4 of 4`.
- **FR-016**: The reading position (the click highlight and the keyboard steps) MUST still walk every pass, in order. A position in any pass of a drawn-once card MUST be shown on that card's column. Stepping on from the last column of one of its passes MUST land on its first column in the next pass.
- **FR-017**: While the reading position is inside a drawn-once card, its head row MUST show which pass it is in (for example `pass 2 of 4`). When the position leaves the card, or is cleared, the head row MUST return to FR-015's words.
- **FR-018**: A drawn-once card's bar numbers MUST be those of the first pass it stands for. Its head row MUST also give the running bar span of all its passes (`bars 1–12`). The card after it MUST start at the running number it would have had if every pass were drawn (bar 13 in that example).
- **FR-019**: A variant played on an entry's last pass (`lastRepeatPartId`) MUST be drawn as its own card, after the drawn-once card for that entry's earlier passes. It MUST carry spec 006's variant marks and variant line exactly as today.
- **FR-020**: The click MUST play every pass. Drawing a pass once changes only what is drawn, never what is counted or sounded.
- **FR-021**: The play view's keyboard shortcuts (column back and on, bar back and on, and the help overlay) MUST behave as today, in reading order.

**Things that must keep working**

- **FR-022**: Bar numbers and section labels (spec 007), the note-name and interval view (spec 006, DECISIONS.md T120), variant marks (spec 006), the chord row, group brackets and rhythm notation (entry `rhythm-notation`) MUST draw on every card at every width as they do today.
- **FR-023**: The song page's panels, the play view's cluster, the view control and the density control (spec 007) MUST keep their behaviour and their touch floors at every width.
- **FR-024**: On a narrow page the song page's staves MUST stay one line that scrolls sideways inside the card, as today.
- **FR-025**: The ASCII export, the column model it shares with the screen, and every exported file MUST be byte-for-byte unchanged.
- **FR-026**: Capture MUST NOT change. If code shared with the wrapped staff changes, every capture e2e test MUST pass unedited.

**The click bar**

- **FR-027**: The play view's click bar MUST sit at the foot of the screen (above the bottom safe area) on every song at every width, including songs shorter than the screen.
- **FR-028**: The bar's height MUST be the same at rest as when the click is running, in every state it can be in (no tempo, a plain beat, following notation, sound unavailable). The space for the running help line is held at rest. It MAY carry rest-state words, but MUST NOT change height when the click starts or stops.
- **FR-029**: Starting the click, stopping it, and opening or closing the cluster MUST NOT move Start, Stop, the beat box, the tempo control or More. The cluster MUST open upward from the bar.
- **FR-030**: `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` MUST pass with no edit. Their INV-024 and INV-040 guarantees hold.

**Print**

- **FR-031**: Print MUST apply FR-001 to FR-007 to the printable width, so a page narrower than the threshold prints one card per row. Every card MUST print whole (never split across a page), in reading order, with its number and its drawn-once words. Nothing may be cut at the paper's right edge. The click bar and the panels do not print.

**Tests and records**

- **FR-032**: e2e tests that pin play-view or song-page geometry (for example `reading-layout.spec.ts` INV-016 and INV-017, and the `click-bar-*` specs other than those in FR-030) MAY be re-pinned only where the new layout changes the value on purpose. None MAY be deleted or weakened. Each one re-pinned MUST be listed in `docs/DECISIONS.md` with what changed and why, as spec 007 did.
- **FR-033**: The fit figures (SC-001, SC-002), the wide threshold, the drawn-once rule and the reading-order choice MUST be recorded in `docs/DECISIONS.md`.

### Key Entities

No stored data changes. One read-side idea is new:

- **Drawn card**: what the play view draws for one or more consecutive passes. It knows the passes it stands for (one, or a run from one entry inside one section visit), its number in reading order, and the running bar span of its passes. It is derived each time the song is read and never stored or synced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

**The fit song** is the fixture for SC-001 and SC-002. A 4-string bass in standard tuning at 120 bpm. Four parts: **A** (4 bars), **A′** (a variant of A, 4 bars, its last bar different), **B** (4 bars), **C** (2 bars). Every bar is eight eighth notes, so every staff draws beams. A has one chord and one plain group, so the chord row and a group bracket are drawn. The arrangement is a section **Verse** holding `A ×4` with `A′` on the 4th, then `B ×2`, then `A ×2`, then a section **Outro** holding `C`, then `B`. That is ten passes, one of them a variant. Drawn as FR-014 says, it is six play-view cards: `A ×3`, `A′`, `B ×2`, `A ×2`, `C`, `B`.

- **SC-001**: The fit song's play view, at 1280×800 and 1440×900 with a mouse, in both themes, in frets, with the click at rest and the cluster closed, has **no vertical scroll**, and every card is wholly visible above the click bar. An e2e test asserts it.
- **SC-002**: The fit song's song page, at the same sizes and settings with the panels closed, has **no vertical scroll**, with the arrangement and all four part cards wholly visible. An e2e test asserts it.
- **SC-003**: At 375, 412, 768, 1024 and 1280 wide, in both themes and both pointer types, neither page scrolls sideways. At 375 and 412 both pages are one card per row. At 768, 1024 and 1280 the fit song's play view and song page each put at least two cards side by side in some row (FR-006 forces this, because two floors fit). *Amended by spec 013:* at 768 the fit song's 4-bar cards are one a row (752px each); at 1024 and 1280 some row still holds two cards (013 FR-022).
- **SC-004**: A full click run of the fit song with following on highlights exactly the columns of all ten passes, in order, and the head-row pass words read right at every step inside a drawn-once card. The same holds for the keyboard steps.
- **SC-005**: In the play view at every width in SC-003, Start, Stop, the beat box and More move by no more than 0.5px when the click starts, stops, or the cluster opens. On a one-pass song the bar's bottom edge is within 1px of the foot of the screen (above the safe area).
- **SC-006**: Every e2e test that is not listed as re-pinned in `docs/DECISIONS.md` passes unedited, and every capture test passes unedited. The ASCII export of every existing export fixture is byte-identical.
- **SC-007**: Print preview of the fit song's play view, in both themes, shows every card whole, in order, with its number and `×` words, and nothing cut at the right edge.
- **SC-008**: In the browser check, a reader can say which card comes next from any card on the fit song's play view at 1280×800 without counting, because the numbers say so.

### Owed to a real device

A coarse-pointer tablet at 768×1024 and 1024×768, and a phone in landscape, are checked in the e2e suite by emulation. A real tablet check is owed and is logged as such, as spec 007 logged T108 to T113.

## Decisions made for this spec

Each is cheap to overturn and is recorded in `docs/DECISIONS.md` (FR-033).

1. **Row-major order.** Cards read left to right, then down, like text and like a printed chart. Column-major would read down each column. It balances column heights better, but a reader's eye has to jump from the foot of one column to the top of the next, and the number of rows would change the order whenever a card grew. Each card's number (FR-012) removes any doubt.
2. **The threshold is 768 pixels of width.** Two floor-width cards (FR-005) and the gap between them fit inside it with the page's padding (about 734 pixels). Every phone in portrait is below it, and common tablets in either orientation are at or above it. A lower threshold would put two cards side by side on large phones held upright, which the brief rules out.
3. **Identical passes are drawn once, at every width.** All four of the brief's conditions hold: the highlight and the keys land on the card's column for the right pass (FR-016), the head row names that pass (FR-017), variant marks sit on the variant's own card (FR-019), and `lastRepeatPartId` is never folded into the run. Bar numbers were the hard case. The card shows the first pass's numbers and the span of all of them (FR-018), so the running count stays right for every card that follows. Drawing once on phones too saves the most scrolling where screens are smallest, and one rule is simpler than two.
4. **Only one entry's passes in one section visit are drawn once.** Two entries of the same part were written separately on purpose, and a new section visit carries a new label.
5. **The spec fixes the rules of packing, not the packing.** Order, the floor, no wasted room and aligned right edges (FR-004 to FR-007) are fixed. Whether a long card takes a whole row on one line, or shares a row with its staff wrapped onto two lines, is left to the plan, because the fit target is the test and the plan can measure it.
6. **Bar numbers on a drawn-once card are the first pass's.** Showing the number of the pass being read would make the printed page and the screen disagree and would change the staff as the highlight moves. The head row's live pass words (FR-017) carry that instead.
7. **The click bar holds its running height at rest, at every width.** This is research R17's remaining option: anchored at the foot, the bar can only grow upward, which moves its controls unless the height is already held. The cost is up to one line of small text at rest, on phones too.
8. **The fit target is measured in frets with a mouse.** Note names and intervals can need more lines (T120), and touch cells are bigger. The wide layout still applies there, but the song may scroll.

## Out of Scope

- Sound, transport, loop, slow-down, or a playhead driven by playback: entry `tab-playback`. This entry keeps the existing click-driven highlight working.
- Voice memos: entry `voice-memos`.
- How rhythm, techniques or groups are drawn: entry `rhythm-notation` owns rhythm. This entry only places what is drawn.
- New data, a migration, or any sync change.
- The ASCII export and its column model (FR-025).
- Capture's layout (FR-026).
- Drawing identical passes once on the song page's roadmap, which already says `×4`.

## Assumptions

- Spec 007's sizes (cell width, control floor, gaps) are right for each pointer type, and this entry does not retune them except where the fit target needs spacing between cards tightened. Any such change is recorded with the fit figures.
- The rhythm row from entry `rhythm-notation` is at its final height, so the fit figures will not need re-measuring for rhythm.
- A desktop browser check covers both themes at actual size. The `npm run dev:clean` trap (stale dev builds) and the rule against opacity over a surface token (spec 007) apply to every new piece of chrome, including the card number and the `×` words.
- The keyboard shortcut list does not grow. Moving up or down between cards is not added.
- A page narrower than 320 pixels is not supported, as today.

### Dependencies

- Spec 005 (click, R17, INV-024, INV-040), spec 006 (variant marks, views), spec 007 (bar numbers, section labels, density, panels, cluster, deviation 7, T120), entry `usability-polish` (wrapped capture, part card menu) and entry `rhythm-notation` (rhythm row, brackets under the tab). All are merged on `main`.
