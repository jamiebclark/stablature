# Implementation Plan: Cards per row follow what the cards hold

**Branch**: `013-cards-per-row` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-cards-per-row/spec.md`

## Summary

On a wide page, both card lists become a **wrapping flex row**. Each card's flex basis is its own width, so the browser
does the spec's greedy, in-order row breaking itself. A `::after` filler takes the last row's spare width, so the last
row keeps its cards at their own widths while every other row fills the list (research R1, verified in Chromium and
Firefox).

A card's own width is the larger of:
- its one-line staff (its own `tab-ruler`) plus chrome;
- a per-card minimum: its head row on one line, capped at the 343px phone width, and never under `9rem`.

Memo cards keep the 343px floor through CSS `:has()`. `useCardTrack` keeps its signature. It now writes `--own-staff`
and `--own-head` on each `li`, and still writes spec 010's `--staff-line` on the list.

Three measured findings shape the plan:

1. **The ruler reads 0px for any part over 48 columns in Chromium** (about 10 bars). Chromium drops a flat `calc()` sum
   of over about 100 operands (research R3). This is half of the browser check's finding 2. `rulerWidth` now sums the
   same terms in nested groups of 8. No drawn column changes.
2. **Staff-only widths break spec 010 SC-001 on the song page.** The fit song's 2-bar C card narrows to 321px, its head
   row wraps, and the page scrolls 832/800. Counting the head row up to 343px restores 800/800 (research R4).
3. **The `short` song's song page cannot fit 1280×800 in this entry's scope.** A proof from measured heights is in
   research R5. The play view meets SC-002 in full (8 + 4 cards, no scroll). The song page meets every layout rule and
   drops from 1221 to 1010px. This is recorded as a deviation, **worth your eye**.

The two small defects:
- **The pass-words slot moves to the end of the play view's head row.** Nothing follows it, so there is no hole, and its
  stacked width still keeps everything still (research R8).
- **In print, a chord symbol takes its own width, up to its card's line** (container units). `Em7` stays whole, and a
  symbol longer than the line still breaks (research R9).

Changed source files: `globals.css`, `useCardTrack.ts`, `TabStaff.tsx` (`rulerWidth` only) and `PlayView.tsx` (one span
moved). `SongView.tsx`, `src/lib/**`, sync, storage, export, capture and playback have zero diff.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.6 (App Router). No Next.js API is touched (a CSS
rule set, a client layout hook, one `TabStaff` helper, one JSX move). AGENTS.md's rule still holds: read
`node_modules/next/dist/docs/` before touching any Next API.

**Primary Dependencies**: Existing only, with no new dependency.
- CSS features: flexbox wrapping, `:has()`, and `container-type` with `cqi` units in print. Chromium 105+ and
  Firefox 121+ ship all three, and the app's targets (spec 012: iOS 17+, current Chromium and Firefox) are covered.
- DOM: `ResizeObserver` and `getBoundingClientRect`.

**Storage**: N/A. Nothing stored, synced or exported changes (data-model.md).

**Testing**:
- Vitest (`npm test`): one new unit file, `TabStaff.ruler-depth.test.tsx`. `TabStaff.ruler.test.tsx`,
  `TabStaff.wrapped-unchanged` and `frets-unchanged` are unedited.
- Playwright 1.64 (`npm run test:e2e`, production build, real Postgres): five new specs (contracts §6). The new
  INV-005 and INV-008 specs are added to the `firefox` project's `testMatch`.
- The Linux replica (`INV-016-linux-chrome.sh`) runs the new and the unedited wide specs (FR-021).
- A human browser check (quickstart §7).

**Target Platform**: The installable PWA, in desktop Chromium and Firefox, tablets at 768+, and print. Phones below
768px are untouched.

**Project Type**: Web application (Next.js App Router, offline-first PWA). This entry is client layout only.

**Performance Goals**:
- One forced layout per measuring pass: all head rows are toggled in one batch, then all are read.
- No React state, and no re-render.
- No measuring while the reading position moves (INV-009).

**Constraints**:
- Below 768px, markup and geometry must be byte-for-byte and ±0.5px what `narrow-before.json` and
  `narrow-before.linux.json` record (FR-011).
- No pixel constant may come from a font advance (FR-021).
- No opacity over a surface token (FR-020).

**Scale/Scope**:
- Two lists (song page, play view) and up to about 40 cards a song (the `40 entries` seed of spec 010).
- Widths 320 to 2560.
- Four source files changed, five e2e specs and one unit spec new, two scripts new, one e2e spec and one fixture
  re-pinned.

No NEEDS CLARIFICATION remains. Every open choice the spec handed the plan (the route, the share split, the card minimum,
the measuring) is resolved in research.md with measurements.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to
gate against. As in entries 1 to 12, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md`,
the README's architecture and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Screens read only the local store; nothing new is stored.** | `src/lib/local/db.ts` header | PASS | Widths are derived on each layout and never stored or synced (data-model §2). |
| **Domain rules live in `src/lib/`, React-free.** | `editing.ts` header | PASS | No domain rule changes. `src/lib/**` has zero diff (INV-015). |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts` headers | PASS | `src/lib/tab/` is untouched. The ruler change regroups the same terms and feeds nothing back (INV-008, INV-015). |
| **A size is never set by a width breakpoint** (density follows the pointer). | `globals.css` density header | PASS | The wide rule sets card widths and the row only. No cell, control or row height changes. `--card-min` is a card width, like spec 010's floor. |
| **Narrow phones draw exactly as before.** | spec 010 FR-003, INV-001 | PASS | All new CSS is inside `@media (min-width: 768px)` or `@media print`. The one JSX move is inside an element the narrow comparison drops and its songs never draw (research R8). INV-014. |
| **Nothing relies on colour alone; no tier is opacity over a surface.** | DECISIONS (spec 007) | PASS | No colour changes (FR-020). |
| **Browser testing is part of done, at actual size, in both themes.** | `docs/DECISIONS.md` | PASS (owed) | quickstart §7, a human task (INV-018). |
| **Earlier requirements stay true or are amended in place.** | spec 007 practice | PASS | Spec 010 FR-005 (floor for every card), FR-006 (all rows' right edges) and SC-003 (two side by side at 768) are amended in place with `Amended by spec 013`. So is contracts/reading-cards.md §1, §4, §5. Pinned by `check:cards-amendments` (INV-016). |
| **A test pin never moves in silence; none is weakened.** | spec 010 INV-017 | PASS | The re-pins are listed below, line by line. Each one replaces an equal-track assertion with the greedy rule computed from measurements, which is stricter (INV-016). |
| **Tests must be able to fail for the right reason.** | entries 4 to 12 reviews | PASS | Each probe recomputes expected rows from its own measurements, never from the hook's variables (data-model §5). The ruler probe fails on today's tree at 10+ bars (research R3). |
| **Simplicity.** | `ui/index.tsx` header | PASS | The browser's flex line breaking is the placement algorithm, so there is no JS layout. One hook, one CSS rule set, one helper. |

**Post-design re-check (after Phase 1)**: PASS.
- Each pair that must agree is closed structurally (*Agreement is structural* below).
- One requirement could not be met as worded: SC-002's song-page "no scroll" (Deviation 3). It is recorded with its
  proof, not hidden.
- No gate needs a Complexity Tracking entry.

### Agreement is structural

- **Row breaking and the greedy rule.** The CSS does not re-implement greedy placement: the browser's flex line
  breaking *is* the placement, and the basis is the own width. Tests compute greedy independently from their own
  measurements (data-model §4–§5), so a drift is a failure, not a second copy kept in sync.
- **The ruler and the drawn staff.** The ruler is still built from the same `widthTerms` the columns use. The regrouping
  keeps each column's term verbatim (contracts §3). INV-008 checks it against the staff laid out on one line.
- **The head-row term and the head row.** It is measured from the drawn head row itself, never computed from word
  lengths (research R10).
- **The memo floor and the memo area.** It is keyed by CSS `:has()` on the area's own `data-testid`. No JS flag has to
  follow it.
- **The pass-word slot.** It is unchanged: one grid cell holds both layers, so its width is the wider of the two by
  construction.

### Deviations from the spec's wording

1. **The card minimum is per card** (research R4). It is the head row's one-line width, capped at 343px, and at least
   `9rem`. FR-003's "the card minimum (FR-005)" is this value, and FR-005 leaves its setting to the plan. A card is
   still sized only from its own content.
2. **The ruler is fixed** (research R3). The spec assumed every ruler was accurate. In Chromium it is 0 past 48 columns.
   The fix regroups the hidden ruler's `calc()`. FR-012 holds, because no drawn column's width string changes.
3. **SC-002 and US1 AS2's song-page "no vertical scroll" are not met** (research R5, **worth your eye**). With today's
   staff height, arrangement section and head-row controls, no width rule fits twelve part cards into the 417px left
   at 1280×800. The plan holds the song page to:
   - FR-001–FR-010, as everywhere;
   - one-line head rows;
   - `scrollHeight` ≤ 1030 (measured 1010 on Windows, plus 2% for Linux rounding), against 1221 today.

   The play view meets SC-002 in full. A compact song-page arrangement or head row is logged as a follow-up finding.
4. **The pass words move to the end of the play view's head row** (research R8, **worth your eye**). This is the only
   way FR-014 and FR-015 can both hold. It amends spec 010 contracts/reading-cards.md §5's item order.
5. **In print, the "printed line" is the card's content width** (research R9). FR-017 and FR-018 are read per card, since
   wide paper prints several cards a row.
6. **Spec 010's `--staff-line` stays on the list** as the "measured" signal (research R10). No CSS reads it, but four
   unedited spec 010 suites wait on it.
7. **SC-003 / US2 AS1 does not hold on Linux Chrome at 1920** (review F4). There FR-007 puts B beside A (play view, mouse: A 1306 + 8 + B 186 <= 1520). Windows keeps A alone, so B and C share a row. `cards-rows.spec.ts` INV-007 asserts B and C share a row whenever the measured greedy rows leave A alone, and that A is alone at 1920 on Windows.

## Invariants — what must never happen *(mandatory)*

Enumerations used below:
- **Ww** (wide widths) = {768, 1024, 1280, 1440, 1920, 2560}.
- **Wn** (narrow widths) = {320, 375, 412, 767}.
- **Ptr** = {mouse (`desktop` project), touch (`mobile` project at the width)}.
- **Th** = {dark, light}.
- **Pg** = {song page, play view}.
- **View** = {frets, notes, intervals}.
- **Songs** = {fit, short, long, names, wide-bar, empty, none, memo}. `memo` is the fit song with two memos on part B
  and the recorder open on part C, seeded through `e2e/memo-helpers.ts`.
- **Prn** = {718, 1047} (spec 010's print widths).

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never is a card placed ahead of one before it. Never does a play-view number differ from its place, repeat or skip. | `cards-rows.spec.ts`, on the rendered list. For consecutive `li`s, either the same top ±0.5 and `next.left ≥ prev.right − 0.5`, or `next.top > prev.top + 0.5` and `next.left ≤ list.left + 0.5`. `card-number` texts read `1..n` in DOM order. Each `li`'s computed `order` is `0`. | **Ww** × **Ptr** × **Pg** × **Songs** (numbers: play view; `none` play view has no list and is skipped by its empty state, asserted present). |
| INV-002 | Never does a row end while the next card would fit at its own width, and never does a row hold a card that does not fit (FR-007). | `cards-rows.spec.ts`. `measureCards(page)` measures each card's ruler box, its head row laid out on one line (a hidden clone), whether it holds `part-memos`, and the resolved tokens (data-model §5). It computes each own width by data-model §3, then `greedyRows` (§4). It asserts the drawn rows (grouped by top ±0.5) equal the greedy rows, with ties within ±0.5 reported. It never reads `--own-*`. | **Ww** × **Ptr** × **Pg** × **Songs** × **Th** (themes: 1280 only). |
| INV-003 | Never is a card narrower than `min(own, row) − 0.5` or wider than its row + 0.5. Never does a full row end off the list's right edge ±0.5. Never is a last-row card wider than its own width + 0.5. Never are tops in a row unaligned ±0.5. | `cards-rows.spec.ts`: the same measurements as INV-002, against each `li`'s box. | **Ww** × **Ptr** × **Pg** × **Songs**. |
| INV-004 | Never does a card whose own width fits its row draw its staff on more than one line. Never does a card wider than its row leave its staff unwrapped while a barline could break it. Never is a card narrower than its longest bar, unless that bar is wider than the row. | `cards-rows.spec.ts`: the count of distinct `.tab-bar-run` tops in each card, against `own ≤ row`. Each run's `scrollWidth ≤ clientWidth + 1`, except a single bar wider than its line, which scrolls inside itself (spec 007 deviation 7). | **Ww** × **Ptr** × **Pg** × {fit, short, long, names, wide-bar} × **View**. |
| INV-005 | Never does either page scroll sideways. | `cards-rows.spec.ts`: `documentElement.scrollWidth ≤ innerWidth` after load and after each view switch. Run in the `desktop`, `mobile` and `firefox` projects. | (**Ww** ∪ **Wn**) × {Chromium, Firefox} × **Pg** × **View** × {fit, long, names, wide-bar, short}. |
| INV-006 | Never is a card narrower than its card minimum (`max(9rem, min(head line + chrome, 343))`, or the row if smaller). Never is a memo card narrower than 343px (or the row). Never is a head-row item clipped by its card or overlapping another. | `cards-rows.spec.ts`: each card's box against the measured minimum. The memo song's B and C cards ≥ `min(343, row) − 0.5`. For each head-row child: `left ≥ card.left − 0.5`, `right ≤ card.right + 0.5`, and no two children's boxes intersect by more than 0.5px. | **Ww** × **Ptr** × **Pg** × {fit, short, names, empty, memo}. |
| INV-007 | Never does the fit song scroll vertically or leave a card under the bar at the fit sizes. Never does the short play view scroll, leave a card under the bar, or hold fewer than 5 cards in a row but the last. Never does the short song page exceed 1030px of `scrollHeight` or wrap a head row. Never is `long`'s A narrower than `min(own, row)`, and never do B and C fail to share a row. | `cards-rows.spec.ts`: `scrollHeight ≤ innerHeight`; every `li.bottom ≤ click-bar.top`. Short: rows per INV-002 and `perRow[k] ≥ 5` for all rows but the last. Song page: `scrollHeight ≤ 1030` and every head row is one line (its height equals the first child's line box ±1). Long: A's width and B/C tops equal. Figures are logged for `docs/DECISIONS.md`. | {1280×800, 1440×900} × **Th** × **Pg** × {fit}; {1280×800} × **Th** × **Pg** × {short}; {1024, 1280, 1440, 1920} × **Pg** × {long}. Mouse, frets, bar at rest, cluster and panels closed. |
| INV-008 | Never does a ruler read 0px, or differ from its staff laid out on one line by more than 1px. Never does a ruler `calc()` level hold more than 16 operands. | e2e `cards-ruler-long.spec.ts`: for each card, the `tab-ruler` box width against spec 010 INV-019's one-line clone, in Chromium and Firefox. Unit `TabStaff.ruler-depth.test.tsx`: parse the rendered ruler `width` and count operands at each parenthesis depth. Every column's term appears verbatim. | Parts of {1, 4, 8, 10, 12, 16, 32, 64} bars of quarter notes; one 64-column bar; a part with 60 chord columns; a variant with removal gaps. × **View** × **Ptr** × {Chromium, Firefox} (e2e at 1280 on the play view, and on the song page at 1280). |
| INV-009 | Never does a card keep a stale width after its content or the page changes. Never does a card move, or any `--own-*` get written, while the reading position moves. | `cards-follow.spec.ts`. After each trigger, with no reload, INV-002 holds again. Triggers: view switch, density switch, theme switch, viewport 1280→1024→1440, a memo added then deleted, a part renamed (long name then empty), `document.fonts` load completes. During a full click run (following on, bpm 300) and a key walk over every column: every `li` rect is constant ±0.5, and a `MutationObserver` on every `li`'s `style` attribute sees no record. | The triggers listed × **Pg** (play view: view, theme, resize, reading; song page: all) × {fit, memo}, at 1280, mouse. Reading walks: {fit} × {768, 1280}. |
| INV-010 | Never, while the position is in a drawn-once card, is the space between its visible pass words and the next head-row item on the same line wider than the head row's column gap + 0.5. Never does another head-row item move more than 0.5px, or the head row's height change, between rest, each pass and stop. | `cards-pass-words.spec.ts`: record every head-row child's box at rest, at each pass (keys: step into each pass, and the click following at bpm 300 sampled per pass), and after Stop. The visible layer's right edge to the nearest later child's left on the same top ±0.5 is ≤ `column-gap` + 0.5. If no child follows on that line, it holds. | {fit card 1 (`×3 · passes 1–3 of 4`), Fold row F5, a seeded `×12` entry read at `pass 10 of 12`} × {375, 768, 1280} × {keys, click}. |
| INV-011 | Never do the pass words say anything other than spec 010 FR-015/FR-017: `×3 · passes 1–3 of 4` at rest, `pass k of n` while inside, the rest words in print. Never does the reading position land on the wrong card or column. | `wide-position.spec.ts`, `wide-fold.spec.ts`, `play-whole-song-outline.spec.ts` and `wide-print.spec.ts`, unedited, run as-is. | Their own enumerations (spec 010 INV-008, INV-009, INV-015; entry 11's outline). |
| INV-012 | Never does a chord symbol no wider than its card's line print on more than one line. Never does a wider one print past its card's right edge or the paper's. | `cards-print.spec.ts` with `emulateMedia({ media: "print" })`: each chord `div.text-accent`'s line count (`height / line-height` ≤ 1.05), and `right ≤ min(card.right, innerWidth) + 0.5`. | {every chord symbol of the fit song (including `Em7`); a seeded 40-character symbol} × **Prn** × **Th** × **Pg**. |
| INV-013 | Never does print split a card, cut anything at the right edge, lose a card's number or rest words, place cards out of order, or break rows other than greedily at the printable width. | `cards-print.spec.ts`: INV-001 and INV-002's computation under print media at each **Prn** width, plus `wide-print.spec.ts` unedited (`break-inside: avoid`, right ≤ viewport, numbers, rest words, live words hidden). At 718 it is one card per row (spec 010 FR-031). | **Prn** × **Th** × **Pg** × {fit, short, F5}. |
| INV-014 | Never does a page below 768px lay out or mark up differently from `main`. Never does an `li` or head row carry a style attribute there. | `wide-narrow-unchanged.spec.ts` unedited, against `narrow-before.json` and `narrow-before.linux.json`. `cards-rows.spec.ts`: at each **Wn** no `.reading-cards > li` and no head row has a `style` attribute, and the list has no `--staff-line`. | **Wn** × **Ptr** × **Th** × **Pg** × {the four fixture songs, plus fit and short for the style check}. |
| INV-015 | Never does a stored row, the sync, the export, capture, playback, the memo UI, `SongView`, or any drawn part of `TabStaff` change. | `npm run check:untouched-cards`: zero diff against `main` for the fenced paths (*Scope fence* below). `TabStaff.tsx`'s diff hunks fall only inside `rulerWidth` and the new `sumTerms`. `TabStaff.wrapped-unchanged` with its snapshot and `frets-unchanged` with `baseline.json` pass unedited. | Every path in *Scope fence*. |
| INV-016 | Never is an earlier requirement left saying something untrue, a test pin moved in silence, or a pin weakened or deleted. | `npm run check:cards-amendments`. Spec 010 FR-005, FR-006 and SC-003 and contracts/reading-cards.md §1, §4, §5 each carry `Amended by spec 013`. `docs/DECISIONS.md` has "013 — decisions" (6 spec decisions + 6 plan deviations, with the card minimum, last-row rule, route and fit figures: FR-023), and "013 — re-pinned tests" naming each row of *Existing tests this changes on purpose*. Every assertion listed there still exists in the file in its re-pinned form (grep for its marker comment `// re-pinned by spec 013`). | Every row of that table; spec 010 FR-005, FR-006, SC-003; the contract's §1, §4, §5. |
| INV-017 | Never does a memo row or the recorder lose a control, its touch floor or its readable state in a wide card. | `memo-floors.spec.ts`, `memo-recorder.spec.ts`, `memo-list.spec.ts` and `memo-states.spec.ts`, unedited, at their sizes. `cards-rows.spec.ts` (memo song) adds INV-006 at **Ww**. | Their own enumerations × the memo song at **Ww** × **Ptr**. |
| INV-018 | Never is a claim that needs a person ticked by an agent. | `tasks.md` carries the browser check (quickstart §7) as a human task, `🛑 BLOCKED` until a person logs it. | quickstart §7 × its songs × {1280, 1920} × **Th** × **Pg** × print. |

### Blast-radius decisions

This entry has no authority, deletion or money surface. Nothing is stored, sent, granted or erased. The decisions below
are the ones that set what the suite may assert, so implement does not make them.

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| Who may change an existing test's pins | Only the rows in *Existing tests this changes on purpose*, each to a stricter, measurement-derived form, each listed in DECISIONS. No other existing test or fixture is edited. | FR-022; spec 010 INV-017's practice. | INV-016, INV-011, INV-014, INV-017 |
| Whether to bend a success criterion the spec states | SC-002's song-page "no scroll" is bent to `≤ 1030px`, and nothing else. The proof is recorded (research R5). | No layout rule inside scope can meet it, and an unmeetable pin would block the merge. | INV-007 |
| Whether the narrow fixtures may be re-recorded | **No.** `narrow-before.json` and `narrow-before.linux.json` are never re-recorded by this entry. A narrow diff is a bug. | FR-011. | INV-014 |
| Whether `memo-card-before.json` may be re-recorded | Only its two `1280x800-*` entries, re-recorded once on the finished build, on the `mobile` project as before. The 375 and 412 entries are untouched (byte-equal). | Per-card widths change those cards' wide boxes on purpose. Phone boxes must not move. | INV-016, INV-017 |

### Existing tests this changes on purpose

Each edited assertion carries the comment `// re-pinned by spec 013: <reason>`, and is listed in DECISIONS (FR-022).

| File | Assertion today | Re-pinned to |
|---|---|---|
| `e2e/wide-order.spec.ts` "cards read left to right … at {768,1024,1280}" | `width ≥ min(343, list) − 0.5` | `width ≥ min(cardMinimum(li), list) − 0.5` (INV-006's measured minimum) |
| same | every row with more than one card ends at the list's right | every row **but the last** ends at the list's right; the last row's cards are within +0.5 of their own widths |
| same | some row holds ≥ 2 cards, at 768, 1024, 1280 | drawn rows equal `greedyRows(measureCards)`. At 1024 and 1280 that still puts two cards in a row; at 768 it is one a row (spec 010 SC-003, amended) |
| `wide-order.spec.ts` "767 is one column; 768 is two columns" | at 768, fewer than 6 distinct tops | at 768 the list's computed `display` is `flex` and some card is narrower than the list (the last row at its own width); at 767 it is `grid` with 6 tops (unchanged) |
| `wide-order.spec.ts` "a 20px default font size …" | `gridTemplateColumns` count: 1 below 768, ≥ 2 at 768+ | the list's computed `display`: `grid` below 768, `flex` at 768+ (the wrap checks unchanged) |
| `wide-order.spec.ts` "order, floor, rows and widths: {fit, short, long, names, empty}" | floor 343; full-row rule includes a last row of `perRow` cards; INV-006 `perRow ≥ 2` at ≤ 1280 | floor = measured card minimum; full-row rule = every row but the last; rows equal `greedyRows(measureCards)` (replaces the `perRow ≥ 2` count). The order, `placed`, `dense`, right-edge, `--staff-line` and shared-`main` checks are unchanged. |
| `e2e/fixtures/memo-card-before.json` | spec 010 grid boxes at 1280×800 (dark, light) | boxes re-recorded on the finished build. |
| `e2e/wide-print.spec.ts` "print {fit, F5} {dark, light}" (T037) | at 1047, fewer distinct tops than cards (spec 010's 2-up paper) | at 1047 the drawn rows equal `greedyRows` of the cards' own widths, measured under print (FR-019, FR-022); 718 stays one a row |
| `e2e/wide-print.spec.ts` "print {fit, F5} {dark, light}" (T037) | at 1047, fewer distinct tops than cards (spec 010's 2-up paper) | at 1047 the drawn rows equal `greedyRows` of the cards' own widths, measured under print (FR-019, FR-022); 718 stays one a row |
| `e2e/memo-card-height.spec.ts` (fixture path only; added by the supervisor at T031) | one fixture for every platform | on Linux it reads `e2e/fixtures/memo-card-before.linux.json`, measured in the Linux replica (part A 151.0625 wide at 1280×800 against 149.0625 on Windows, because a card's width now follows its head row's glyphs). Assertions and the 1px tolerance are unchanged, as `wide-narrow-unchanged.spec.ts` does with `narrow-before.linux.json`. |

### Scope fence (`scripts/untouched-by-cards.sh`)

Zero diff against `main`, tracked or untracked:
- `src/lib`, `src/db`, `src/app/api` and `drizzle`;
- `src/components/capture`, `src/components/rhythm`, `src/components/memos` and `src/components/app/SongView.tsx`;
- `src/components/app/ClickBar*` and `src/components/reading/useReadingPosition.ts`;
- `public/sw.js` and `next.config.ts`;
- every `e2e/` file on `main`, except `e2e/wide-order.spec.ts`, `e2e/wide-print.spec.ts` (T037) and `e2e/fixtures/memo-card-before.json`.

Bounded diffs:
- `src/components/tab/TabStaff.tsx`: changed lines only inside `rulerWidth` and the new `sumTerms`.
- `src/components/app/PlayView.tsx`: only the moved `card-passes` block.
- `playwright.config.ts`: only the `firefox` project's `testMatch`.
- `package.json`: only the two new `check:` scripts.

## Requirement → invariant map

| Requirement | Invariants |
|---|---|
| FR-001, FR-003 | INV-002, INV-003 |
| FR-002 | INV-001 |
| FR-004 | INV-003, INV-004 |
| FR-005, FR-006 | INV-006, INV-017 |
| FR-007 | INV-002 |
| FR-008 | INV-003, INV-005 |
| FR-009 | INV-003 |
| FR-010 | INV-009 |
| FR-011 | INV-014 |
| FR-012 | INV-008, INV-015 |
| FR-013 | INV-009, INV-011, INV-017 |
| FR-014, FR-015 | INV-010 |
| FR-016 | INV-011 |
| FR-017, FR-018 | INV-012 |
| FR-019 | INV-013 |
| FR-020 | INV-015 (no colour file in the diff beyond the listed rules); the browser check |
| FR-021 | INV-002 (computed, never hard-coded); quickstart §6 |
| FR-022, FR-023 | INV-016 |
| SC-001 | INV-007 |
| SC-002 | INV-007 (Deviation 3) |
| SC-003 | INV-007 |
| SC-004 | INV-001–INV-005 |
| SC-005 | INV-014, INV-005 |
| SC-006 | INV-010 |
| SC-007 | INV-012, INV-013 |
| SC-008 | INV-011, INV-016, INV-017; the full suite |
| SC-009 | INV-018 |

## Project Structure

### Documentation (this feature)

```text
specs/013-cards-per-row/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R11, with measurements
├── data-model.md        # Phase 1: tokens, written values, the own-width and row rules, test inputs
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── cards-per-row.md # the list CSS, useCardTrack, the ruler, the head-row order, print, test hooks
├── research-probes/     # the probes and their JSON (not part of the suite)
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── app/globals.css                     # :root --card-min; the wide .reading-cards rule set; print chord + container
├── components/
│   ├── reading/useCardTrack.ts         # per-li --own-staff/--own-head; list --staff-line kept; one ResizeObserver
│   ├── tab/TabStaff.tsx                # rulerWidth → sumTerms (nested groups of 8); nothing else
│   ├── tab/__tests__/TabStaff.ruler-depth.test.tsx   # NEW: INV-008 unit half
│   └── app/PlayView.tsx                # card-passes span moved to the end of the head row

e2e/
├── cards-helpers.ts                    # NEW: measureCards, greedyRows, seeders (long rulers, chords, memo song)
├── cards-rows.spec.ts                  # NEW: INV-001–INV-007, INV-014 style check
├── cards-ruler-long.spec.ts            # NEW: INV-008
├── cards-follow.spec.ts                # NEW: INV-009
├── cards-pass-words.spec.ts            # NEW: INV-010
├── cards-print.spec.ts                 # NEW: INV-012, INV-013
├── wide-order.spec.ts                  # re-pinned (table above)
└── fixtures/memo-card-before.json      # 1280×800 entries re-recorded

scripts/
├── untouched-by-cards.sh               # NEW: INV-015
└── check-cards-amendments.sh           # NEW: INV-016

playwright.config.ts                    # firefox project testMatch += cards-rows, cards-ruler-long
package.json                            # check:untouched-cards, check:cards-amendments
docs/DECISIONS.md                       # "013 — suite before", "013 — decisions", "013 — re-pinned tests",
                                        # "013 — earlier entries' untouched guards", "013 — browser check"
specs/010-wide-reading-layout/spec.md   # FR-005, FR-006, SC-003 amended in place
specs/010-wide-reading-layout/contracts/reading-cards.md   # §1, §4, §5 amended in place
```

**Structure Decision**: the existing single Next.js app. This entry is a client-side layout change in `src/app/` and
`src/components/`, with its tests in `e2e/` and one unit file beside `TabStaff`. No new directory under `src/`.

## Complexity Tracking

No gate is violated, so there is nothing to justify.
