# Feature Specification: Cards per row follow what the cards hold

**Feature Branch**: `013-cards-per-row`

**Created**: 2026-11-21

**Status**: Draft

**Input**: User description: "Entry `wide-reading-layout` (spec 010) lays a song's cards in a grid on wide screens. The number of cards per row follows the screen width, not what the cards hold. … DO: size each card from its own content, so short cards pack several to a row and a long card takes the width it needs. … ALSO FIX two small defects the same check logged in this layout … DOES NOT DO: no change to how a staff draws inside a card, to rhythm notation, or to the playback controls." (full roadmap entry: `.specify/roadmaps/best-in-class.json`, entry `cards-per-row`)

## Summary

Spec 010 put a song's cards side by side on wide screens, so a whole song fits on one screen. But every card in a song gets the same width. That width comes from the **widest** staff in the list, is never less than the phone-width floor (343px), and is never more than half the row. So the number of cards per row follows the screen, not the cards.

The browser check of spec 010 (`docs/DECISIONS.md` on `docs/browser-checks`, "Browser check: wide-reading-layout", findings 1 to 4) saw what that costs:

1. **Short cards waste the screen.** The `short` song (twelve one-bar parts) at 1280×800 draws three cards a row. Each is about 415px wide around a 100px staff, and the last row falls under the click bar. Five or six a row would fit the song on one screen, which is spec 010's own goal.
2. **Uneven cards get equal room.** At 1920 the `long` song (a 16-bar part, then two 2-bar parts) gets three equal tracks. The long card wraps into four lines in a third of the width, while the two short cards leave most of theirs empty.
3. **A gap opens when the click runs.** The hidden `×3 · passes 1–3 of 4` keeps its width, so a blank stretch follows `pass 1 of 4` before `bars 1–12`.
4. **Print breaks short chord symbols.** `Em7` prints as `Em` over `7`.

This entry changes the wide layout only:

- **Each card is as wide as its own content.** A card's width comes from its own one-line staff, not from the widest staff in the song. Short cards pack several to a row. A long card takes the width it needs, up to the whole row.
- **Order stays row-major.** Cards still read left to right, then down, in card-number order. No card moves ahead of an earlier one to fill a gap.
- **The two head-row and print defects are fixed** (findings 3 and 4).

Nothing about a song changes: no field, migration, sync message, export or import. Below 768px nothing changes at all.

### Where the brief and the code differ

| The brief says | The code says | What this spec does |
|---|---|---|
| "every track is `max(var(--card-floor), min(<one --staff-line for the whole list> + padding, half the width))`" | Correct. `useCardTrack` writes the **widest** ruler in the list as one `--staff-line` on the list. Each card already has its own hidden `tab-ruler`, so each card's own one-line width is already measured. | Each card is sized from its own ruler (FR-003). The plan picks the mechanism. |
| "short cards can never go narrower than `--card-floor`" | Spec 010 FR-005 sets that 343px floor so a card's chrome reads as it does on a phone. | The phone-width floor no longer applies to every card. A smaller **card minimum** keeps the head row readable (FR-005). Cards that hold memo rows or the recorder keep the 343px floor (FR-006). |
| Spec 010 FR-006: "the rows' right edges MUST line up" | Every row of equal tracks fills the list. | Every row except the last still fills the list. The last row keeps its cards at their own widths, left-aligned, like the last line of justified text (FR-009, Decision 3). |
| Spec 010 SC-003: "at 768, 1024 and 1280 the fit song … put at least two cards side by side in some row" | That held because 343px floors fit two to a row, so each card's staff wrapped at half the row. | A card whose one line fits the row is no longer wrapped just to share a row (FR-004). At 768 the fit song's 4-bar cards (≈606px each) are one per row, on one line each. Any test that pins the old count is re-pinned and logged (FR-022). |
| "the hidden `x3 · passes 1–3 of 4` keeps its width (`visibility: hidden` …)" | Correct. The live and rest words share one grid cell (`.card-passes`), so the slot is as wide as the wider of the two. | FR-014 to FR-016. |
| "the print rule `overflow-wrap: anywhere` on the chord row" | Correct. It is in `@media print` on `.tab-bar-run [data-testid="tab-column"] > div.text-accent`. It lets a symbol break between any two letters. | FR-017 and FR-018. |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A song of short parts fits on one screen (Priority: P1)

A guitarist opens a song with twelve one-bar parts (riffs, fills, an intro lick) on a laptop at 1280×800. Today it shows three cards a row, each mostly empty, and the last row is hidden under the click bar. After this change the cards are only as wide as their one-bar staves, five or more sit in each row, and the whole song is on the screen at once on both pages.

**Why this priority**: Fitting a whole song on one screen is spec 010's goal and the README's thesis. Short parts are where the equal-width rule fails worst, and the browser check showed the song not fitting.

**Independent Test**: Seed the `short` song. Open its play view (cluster closed, click at rest) and its song page (panels closed) at 1280×800 with a mouse, in both themes. Neither page scrolls vertically, every card is wholly visible (above the click bar in the play view), and each row holds at least five cards in number order.

**Acceptance Scenarios**:

1. **Given** the `short` song at 1280×800 with a mouse, **When** the play view opens, **Then** the page has no vertical scroll, every card is wholly visible above the click bar, and no row holds fewer than five cards except the last.
2. **Given** the `short` song at 1280×800 with a mouse, **When** the song page opens with the panels closed, **Then** the page has no vertical scroll and the arrangement and all twelve part cards are wholly visible.
3. **Given** any song on a wide screen, **When** either page is drawn, **Then** cards read left to right, then down, in their order (play-view cards show 1, 2, 3 … in that order), and no card sits ahead of one that comes before it.
4. **Given** a one-bar card, **When** it is drawn, **Then** it is no narrower than its one-line staff, and its head row (card number, label, menu) is readable with nothing overlapping or clipped.

---

### User Story 2 - A long part gets the width it needs (Priority: P1)

A bassist opens a song with a 16-bar verse and two 2-bar fills at 1920. Today the verse is squeezed into a third of the screen and wraps into four lines, while the fills leave their cards mostly empty. After this change the verse takes as much of the row as its staff needs. Its staff is on one line if one line fits the row, and fills the whole row otherwise. The fills share a row at their own widths.

**Why this priority**: The second half of the same defect. A long part read in a narrow strip is the "metres of linear tab" problem moved sideways.

**Independent Test**: Seed the `long` song. At 1920×1080 (and at 1024, 1280 and 1440) on both pages, measure each card's width against its own ruler and the row's width. The long card is at least as wide as the smaller of its one-line width and the row. The two short cards share a row.

**Acceptance Scenarios**:

1. **Given** the `long` song at 1920, **When** either page is drawn, **Then** card A is at least as wide as the smaller of its one-line staff and the row, and B and C sit together in one row after it.
2. **Given** a card whose one-line staff is wider than the row, **When** it is drawn, **Then** it takes the whole row and its staff wraps at barlines inside it, as spec 010 draws it.
3. **Given** a card whose one-line staff fits in the row, **When** it is drawn, **Then** its staff is on one line. It is never wrapped just so that it can share a row.
4. **Given** a single bar wider than the row (the `wide-bar` song), **When** it is drawn, **Then** its card takes the whole row and the bar scrolls sideways inside itself (spec 007 deviation 7). The page never scrolls sideways.

---

### User Story 3 - What spec 010 held still holds (Priority: P1)

The same reader moves between a phone, a tablet at 768, and desktops at every size. The fit song still fits 1280×800 and 1440×900 on both pages. Phones draw exactly as before. Print shows every card whole and in order. Both themes read. Firefox never scrolls sideways. The click highlight, the playback outline from entry `tab-playback` and the memo rows from entry `voice-memos` all still work inside cards.

**Why this priority**: This entry reworks the grid that spec 010, entry `tab-playback` and entry `voice-memos` build on. Regressing any of them would cost more than the waste it removes.

**Independent Test**: Run spec 010's, 011's and 012's e2e suites unedited, apart from any re-pins logged in `docs/DECISIONS.md`. That includes `wide-narrow-unchanged.spec.ts` against both `narrow-before.json` and `narrow-before.linux.json`, `wide-sideways-firefox.spec.ts`, `wide-fit.spec.ts` and `wide-print.spec.ts`. Run them locally and in the Linux replica.

**Acceptance Scenarios**:

1. **Given** the fit song at 1280×800 and at 1440×900 with a mouse, in both themes, with the cluster closed, **When** the play view opens, **Then** it has no vertical scroll and every card is wholly visible above the click bar. **And** its song page, with the panels closed, has no vertical scroll.
2. **Given** a viewport narrower than 768px, **When** either page is drawn, **Then** its markup and geometry match the recorded fixtures exactly.
3. **Given** the click running with "following notation" on, or the song playing through the bass voice, **When** the position moves from card to card, **Then** it lands on the right column of the right card in reading order, as spec 010 and entry `tab-playback` have it.
4. **Given** a part card that holds memo rows or the recorder, **When** it is drawn on a wide screen, **Then** each memo row and the recorder work and read as they do today.
5. **Given** print of either page, **When** previewed, **Then** every card prints whole, in order, with its number and its `×` words, and nothing is cut at the paper's right edge.

---

### User Story 4 - The pass words don't leave a hole while the click runs (Priority: P2)

A drummer starts the click on a song whose verse opens with `A ×3`. As the highlight enters that card, its head row switches from `×3 · passes 1–3 of 4` to `pass 1 of 4`. Today a blank stretch the width of the hidden words follows, before `bars 1–12`. After this change there is no hole, and still nothing in the head row moves as the highlight enters, crosses passes or leaves.

**Why this priority**: A small defect that a reader sees on every run of the click. The slot exists so the head row never reflows while playing, and that must not be lost in fixing it.

**Independent Test**: Seed the fit song at 1280×800. Record the box of every head-row item of card 1 at rest, then at each pass while the click runs with following on, then after it stops. Measure the space after the visible pass words in every state.

**Acceptance Scenarios**:

1. **Given** the click running with the position inside a drawn-once card, **When** its head row is drawn, **Then** the space between the visible pass words and the next item is no wider than the head row's normal gap between items.
2. **Given** the same card, **When** the position enters it, moves from one of its passes to the next, or leaves it (or the click stops), **Then** no other item in its head row moves and the head row's height does not change.
3. **Given** the click at rest, **When** the card is drawn, **Then** it reads `×3 · passes 1–3 of 4` with no extra space after it, as today.

---

### User Story 5 - Short chord symbols print whole (Priority: P2)

A guitarist prints a song to put on a stand. `Em7` over bar 1 prints as `Em7` on one line, not `Em` over `7`. A chord symbol longer than its whole line still breaks rather than running off the page.

**Why this priority**: A small print defect, but a split chord symbol reads as two chords.

**Independent Test**: Print-emulate the fit song's song page and play view in both themes. Every chord symbol shorter than its line sits on a single line. Seed one chord symbol longer than the printable line and check it breaks inside the page.

**Acceptance Scenarios**:

1. **Given** a chord symbol narrower than its printed line (for example `Em7`), **When** the page is printed, **Then** it is drawn on one line.
2. **Given** a chord symbol wider than its printed line, **When** the page is printed, **Then** it breaks inside the line and nothing is cut at the paper's right edge.

---

### Edge Cases

- **Cards of mixed widths in one song.** A long card followed by a short one: the short one joins the long one's row when the row has room for its own width, else it starts the next row. A card never jumps ahead to fill a gap.
- **A card wider than the row.** It takes the whole row by itself and wraps at barlines (FR-004). The cards before and after it sit on other rows.
- **One card only.** It sits at its own width, left-aligned, because a lone card is also the last row (FR-009).
- **A part with no columns** (`empty` song). Its card is the card minimum (FR-005) and draws an empty staff, as today.
- **A song with no arrangement** (`none` song). The play view's empty state is unchanged. The song page draws the one card at its own width.
- **A long part name and heading** (`names` song). The head row wraps inside the card at the card's width. A long name never makes the card wider than its content's width would otherwise be, and never wider than the row.
- **Note names, intervals, two-digit frets or touch sizes.** Cells widen, so each card's own width grows with its ruler, and a row can hold fewer cards. The rule is the same and is measured, not assumed.
- **A view, density or theme change, fonts loading, or a resize.** Each card's width follows its ruler again without a reload. Cards may move to other rows, still in order. The highlight, if any, stays on its column.
- **The card holding memos.** It is never narrower than 343px (FR-006). It can make its row taller than its neighbours, since rows align at their tops (out of scope below).
- **Width exactly at 768px.** The wide layout applies, as spec 010. At 767px the narrow layout applies, unchanged.
- **Linux text rounding.** On Linux, glyph advances round to whole pixels, so a ruler can be a few pixels narrower than on Windows. Row counts are derived from each run's own measured rulers, so they hold on both.
- **A drawn-once card whose live words are longer than its rest words.** For example `pass 10 of 12` against `×3 · passes 10–12 of 12`. FR-014 and FR-015 still hold.
- **Print on narrow paper.** Below the 768px threshold of printable width, print is one card per row, as spec 010 FR-031.

## Requirements *(mandatory)*

### Functional Requirements

**Each card from its own content (wide only)**

- **FR-001**: On a wide page (viewport at least 768px, spec 010 FR-001), both pages' card lists MUST size each card from that card's own content. A card's width MUST NOT depend on any other card's content, except through sharing its row's spare width (FR-009).
- **FR-002**: Cards MUST be placed row-major in their order: left to right, then onto the next row. A card MUST NOT be placed ahead of a card that comes before it. Play-view card numbers MUST read 1, 2, 3 … in that order.
- **FR-003**: A card's **own width** is the larger of two values: its one-line staff width plus the card's padding and border, and the card minimum (FR-005). The one-line staff width is what the card's own `tab-ruler` measures. FR-006 raises the minimum for memo cards.
- **FR-004**: A card whose own width fits in the row MUST be at least its own width, so its staff is on one line. A card whose own width is wider than the row MUST take the whole row, alone, with its staff wrapped at barlines as spec 010 draws it. A card MUST NOT be narrower than its longest bar, except where that bar is wider than the row, and then spec 007 deviation 7 applies.
- **FR-005**: A card MUST NOT be narrower than a **card minimum**, at which its head row's first line is readable with nothing overlapping or clipped, at both pointer sizes. For the play view that line is the card number and label. For the song page it is the label and menu button. Other head-row items wrap inside the card. The plan sets the minimum and records it. It MUST be small enough that SC-002 holds.
- **FR-006**: A song-page part card that shows memo rows or the recorder MUST NOT be narrower than 343px (spec 010's `--card-floor`), the width those rows were built and checked at.
- **FR-007**: A new row MUST start only when the next card's own width does not fit in what is left of the current row (after the gap). Placement is greedy in order. While cards remain, a row MUST NOT end with room left for the next card at its own width.
- **FR-008**: A card MUST NOT be wider than its row. The page MUST NOT scroll sideways at any width from 320 to 2560, in Chromium and in Firefox.
- **FR-009**: Every row except the last MUST fill the list's width: its cards share the row's spare width, so right edges line up. The plan chooses how the share is split. The last row's cards MUST keep their own widths, left-aligned. Cards in a row MUST be aligned at their tops (spec 010 FR-007).
- **FR-010**: When a card's own width changes (fonts loading, view, density or theme, a resize, a memo added or removed), the layout MUST follow without a reload, still in order.

**What spec 010 and later entries hold**

- **FR-011**: The 768px switch, the narrow layout below it, and pointer-follows-size (spec 010 FR-001 to FR-003) MUST be unchanged. `e2e/wide-narrow-unchanged.spec.ts` MUST pass with no edit to it or to `e2e/fixtures/narrow-before.json` or `e2e/fixtures/narrow-before.linux.json`.
- **FR-012**: How a staff draws inside its card MUST NOT change. That covers wrapping at barlines, bar numbers, string labels, the chord row, group brackets, rhythm notation, variant marks and views (spec 010 FR-008 to FR-010, FR-022). Only the card's width changes.
- **FR-013**: The play view's reading position must keep working inside cards: the click highlight, the keyboard steps, the drawn-once pass words and scroll-into-view (spec 010 FR-014 to FR-021). So must entry `tab-playback`'s playback outline and entry `voice-memos`' memo rows and recorder. None of them may change. Their e2e tests MUST pass unedited, apart from re-pins logged under FR-022.

**The pass words while the click runs (every width)**

- **FR-014**: While the reading position is in a drawn-once card, the space between its visible pass words and the next head-row item MUST be no wider than the head row's normal gap between items.
- **FR-015**: When the position enters a drawn-once card, moves between its passes, or leaves it (or is cleared), the card's other head-row items MUST NOT move by more than 0.5px, and the head row's height MUST NOT change.
- **FR-016**: The pass words MUST still say what spec 010 FR-015 and FR-017 say. At rest that is `×3 · passes 1–3 of 4`. While the position is inside, they name the pass being read, such as `pass 2 of 4`. Print keeps the rest words.

**Chord symbols in print**

- **FR-017**: In print, a chord symbol no wider than its printed line MUST NOT break across lines.
- **FR-018**: In print, a chord symbol wider than its printed line MUST break inside the line so that nothing is cut at the paper's right edge (the case the current rule was written for).

**Print and themes**

- **FR-019**: Print MUST apply FR-001 to FR-009 to the printable width. Every card MUST print whole (never split across a page), in order, with its number and drawn-once words. Nothing may be cut at the right edge (spec 010 FR-031).
- **FR-020**: Both themes MUST read on every card at every width. Nothing new may use opacity over a surface token (spec 007's rule).

**Tests and records**

- **FR-021**: Pixel e2e tests MUST derive expected row counts and widths from each run's measured rulers and row width. They MUST NOT hard-code a font advance. They MUST pass locally and in the Linux replica (`specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh`).
- **FR-022**: An e2e test that pins spec 010's equal-track geometry MAY be re-pinned only where this entry changes the value on purpose. An example is spec 010 SC-003's "at least two side by side at 768" for the fit song. None MAY be deleted or weakened. Each re-pin MUST be listed in `docs/DECISIONS.md` with what changed and why.
- **FR-023**: `docs/DECISIONS.md` MUST record the sizing route the plan picks and why, the card minimum, the last-row rule, and the measured fit figures for the fit and `short` songs at 1280×800.

### Key Entities

No stored data changes. One read-side value changes meaning:

- **Card width**: derived each time the page is laid out, from the card's own ruler (its one-line staff), the card minimum, and the row it lands in. It is never stored or synced.

## Success Criteria *(mandatory)*

### Measurable Outcomes

The songs are spec 010's: the **fit** song (`seedFitSong`) and the `short`, `long`, `names` and `wide-bar` songs (`seedWideSong` in `e2e/wide-helpers.ts`). Fit figures are measured in frets, with the click at rest, the playback cluster closed and the song page's panels closed, as spec 010 measures them.

- **SC-001**: The fit song, at 1280×800 and 1440×900 with a mouse, in both themes, has no vertical scroll on either page. Every play-view card is wholly visible above the click bar (spec 010 SC-001 and SC-002 still hold).
- **SC-002**: The `short` song at 1280×800 with a mouse, in both themes, has no vertical scroll on either page. Every play-view card is wholly visible above the click bar, and every row but the last holds at least five cards. Today it is three a row and does not fit.
- **SC-003**: The `long` song at 1920×1080 on both pages: card A is at least as wide as the smaller of its own width and the row, and B and C share one row. Today A is a third of the row.
- **SC-004**: At 1024, 1280, 1440 and 1920 wide, for the fit, `short`, `long`, `names` and `wide-bar` songs, on both pages, with a mouse and with touch, an e2e test asserts four things. Cards per row equal the greedy count from each card's measured own width, the row width and the gap (FR-007). Cards read in order. No card is narrower than its ruler (or than the row, where its ruler is wider). Nothing scrolls sideways. It passes locally and in the Linux replica.
- **SC-005**: Below 768px nothing moves. `wide-narrow-unchanged.spec.ts` passes unedited against both fixtures, and `wide-sideways-firefox.spec.ts` passes unedited.
- **SC-006**: With the click running on the fit song at 1280×800, the space after the visible pass words in card 1 is no wider than the head row's gap, in every pass. No head-row item moves by more than 0.5px between rest, each pass, and stop.
- **SC-007**: Print preview of the fit song's song page and play view, in both themes, draws `Em7` (and every chord symbol shorter than its line) on one line. Every card prints whole and in order, and nothing is cut at the right edge.
- **SC-008**: Every e2e test of specs 010, 011 and 012 passes. The only edits allowed are re-pins listed in `docs/DECISIONS.md` (FR-022). Every capture test passes unedited.
- **SC-009**: A browser check at actual size, in both themes, of the `short`, `long` and fit songs at 1280 and 1920 on both pages (and the click running at 1280), is logged in `docs/DECISIONS.md`. In it, a reader can tell each card's order and read its staff without the waste findings 1 and 2 describe.

## Decisions made for this spec

Each is cheap to overturn and is recorded in `docs/DECISIONS.md` (FR-023).

1. **A card that fits the row on one line is never wrapped to share a row.** "A long card takes the width it needs." Spec 010's research found that wrapping the fit song's 4-bar cards costs about 148px a row and breaks the fit, so one line where it fits is also what the fit target needs. Wrapping is kept only for a card wider than the whole row.
2. **Greedy placement in order.** The next card goes on the current row if it fits at its own width, or else starts a new row. That is the only packing that keeps reading order and leaves no room for the next card. It is also simple enough for a test to compute from measured rulers. Balancing rows (for example by moving a break earlier) would make the count depend on cards that come later. That is left out until a reader needs it.
3. **The last row is not stretched.** Stretching a short last row would bring back the waste this entry removes, for example two one-bar cards each half the screen wide. Every other row fills the width, so right edges line up wherever the row is full, like justified text.
4. **The phone floor (343px) stays only for cards that hold memo rows or the recorder.** Those rows were built and checked at phone width, and the voice-memos check found no defect there. Every other card gets a smaller card minimum, set by its head row's first line.
5. **The route is the plan's.** The plan can use per-card spans on a fine column grid, a wrapping row with each card's basis at its own width, or another route. It must say why. Any route must hold FR-002 (no `grid-auto-flow: dense` unless order is kept), FR-007 and FR-009, and keep the narrow markup unchanged.
6. **The pass-words fix applies at every width.** The slot is in the play view's head row at every width. Narrow markup is unaffected, because spec 010's narrow comparison already leaves the pass-word elements out.

## Out of Scope

- How a staff draws inside a card, rhythm notation, techniques, groups and views (FR-012).
- The playback controls and the cluster. At 1280×800 the open cluster takes two rows and pushes the fit song's last card under the bar. That is a known finding from the tab-playback check and stays open. Fit is measured with the cluster closed.
- Uneven card **heights** in a row. One example is a part card with five memos beside short cards (voice-memos check, finding 1). Rows align at their tops. Filling the space under a short card would mean placing a later card above an earlier one's row, which breaks reading order.
- Time signatures, new data, a migration, any sync change, or any export or import change.
- The narrow layout below 768px.
- Balancing rows beyond greedy placement (Decision 2).

## Assumptions

- Each card's hidden `tab-ruler` (spec 010 contracts/reading-cards.md §3) measures that card's one-line staff accurately at every width, in both pointers and every view. INV-019 already checks this against a staff drawn on one line.
- The song page's part cards get a ruler on a wide page, as spec 010 has it, so both pages have a per-card measure.
- Spec 007's cell, control and gap sizes stay. If the fit target needs the gap between cards tightened, the change is recorded with the fit figures.
- Spec 010's 8px margin at 1280 for the fit song's two 4-bar cards per row (research R4) holds under per-card sizing, because each of those cards is still its own one-line width.
- The browser check uses `npm run dev:clean` or a production build (stale dev builds trap), as earlier checks did.

### Dependencies

- Spec 010 (`wide-reading-layout`: the card list, rulers, drawn-once cards, the click bar, print), entry `tab-playback` (the playback outline inside cards) and entry `voice-memos` (memo rows and the recorder in part cards). All are merged on `main`.
- The Linux replica script `specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh` for the CI-equivalent run.
