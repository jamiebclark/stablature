# Implementation Plan: Full-width reading layout, a whole song on one screen

**Branch**: `010-wide-reading-layout` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-wide-reading-layout/spec.md`

## Summary

On a page at least 768px wide, both pages draw their cards in a grid, row-major. Wrapped staves fill each card. In the play
view, a run of identical passes from one entry is drawn once. The click bar sits at the foot of the screen at a constant
height. Phones draw today's markup. Nothing is stored, exported or synced differently.

The design has five parts. In each, two things that must agree are kept in agreement by one calling the other:

- **Which passes share a card is decided once.**
  - `drawnCards(passes, bars)` (`src/lib/reading/cards.ts`) folds passes `p`, `p+1` when they have the same entry, the same
    part, and consecutive pass numbers. That integer test is FR-014's three conditions, because `expandArrangement` restarts
    `pass` at every section visit (research R1).
  - The same loop returns `cardOf`, which the reading position uses to find a pass's card.
  - The click and the keys are **not** given cards. They keep reading `passes`, so every pass is still counted, sounded and
    stepped (FR-016, FR-020).
- **Equal columns whose count follows the widest card.**
  - A CSS grid places the cards (`auto-fit`, `1fr`, top-aligned). The track is
    `max(floor, min(widest one-line staff + chrome, half the row))`.
  - The widest one-line staff comes from a hidden ruler in each wrapped staff. Its `calc()` is built from the same
    `widthTerms()` the columns use, so the browser measures it in the staff's own font (research R3, R4).
- **Wide chrome is tightened, and nothing else.** Page side padding 8px, card padding 6px × 8px, and gaps 8px, wide only. No
  cell, control, gutter, row or font size changes (research R3).
- **The click bar is fixed at the foot with a held height.**
  - Its status words share one grid cell with a hidden ghost of every message it can show, drawn from the same word table. The
    bar is as tall as its tallest message in every state (FR-028).
  - On wide screens the words sit inside the controls row, so the bar stays 57px.
  - One `ResizeObserver` writes both the scroll padding and the page's bottom padding from the bar's height (research R5).
- **The reading position maps a pass to its card at the one place the DOM is touched.**
  - `useReadingPosition` locates `[data-card=cardOf[pass]] [data-column=key]`.
  - It writes the card's live pass words as a DOM write: no re-render mid-song, and the words share a cell so the head row
    cannot re-wrap (research R8).

The risky claim is the fit, and it was measured first ([research.md](./research.md) R2, R3; raw figures in
`research-probes/measure-fit-tight.json`):

| Fit song, 4 strings, 1280×800, mouse | Figure | What it means |
|---|---|---|
| Three cards to a row (≈411px) | every 4-bar card on 2 lines; last card ends at 826px | cannot fit at any chrome |
| Two to a row at today's chrome | card 616px, inner 590px; A's one-line staff needs ≈606px; 2 lines | does not fit |
| Two to a row, wide chrome (side 8, pad-x 6, gap 8) | card 628px, inner 614px: **8px horizontal margin** (Windows Chromium; ≈14px more on Linux) | all six cards on one line |
| Play view, six cards in three rows | last card ends ≈693px; bar 57px at the foot | **≈42px vertical margin** |
| Song page, four cards in two rows, panels closed | last card ends ≈760px, plus `pb-6` | **≈16px margin**, with the footer not drawn (R6) |
| 1440×900 | every variant one line per card | ≥ 100px margin on both pages |

There is no migration, no new dependency, no new route, and no change to `src/lib/tab/`, the export, the click's notation
reader, `public/sw.js` or capture.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router).

**Primary Dependencies**: Tailwind CSS 4 (a new `@custom-variant wide`), Dexie 4 with `dexie-react-hooks`, `lucide-react`.
**No new dependency.**

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change of any kind.**

**Testing**: Vitest (`npm test`; node by default, jsdom by docblock). Playwright 1.64 (`npm run test:e2e`) against a production
build, with the projects `mobile` (Pixel 7, coarse), `desktop` (fine), `firefox` (staves only) and `no-pointer`. New e2e specs
run on `mobile` and `desktop`. A coarse pointer at wide widths is the `mobile` project with its viewport set wide. A
person-level browser pass and a real-tablet item follow.

**Target Platform**: An installable, offline-capable PWA in a mobile browser, and a desktop browser. Budgeted sizes: 375×667,
412×915, 768×1024, 1024×768, 1280×800, 1440×900.

**Project Type**: Next.js web application, single package.

**Performance Goals**:
- The highlight still moves with no React render: class and text DOM writes only.
- `useCardTrack` costs one `offsetWidth` read per card per change.
- Capture is untouched, so the spec 008 tap-latency spec runs unedited.

**Constraints**:
- `src/lib/tab/`, `src/lib/export/`, `src/lib/rhythm/`, `src/lib/arrangement/`, `src/lib/reading/position.ts` and
  `src/lib/reading/bars.ts` have **zero diff**. So do `src/components/capture/` and every capture e2e spec except one play-view
  test (Deviation 2).
- `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` have **zero diff** (FR-030).
- `TabStaff`'s markup without the new `ruler` prop is byte-identical: the wrapped-markup snapshot and `baseline.json` are
  unedited.
- A visual tier is never opacity over a surface, and unlayered CSS beats any Tailwind utility.
- Never run the build or the e2e suite while a dev server holds `.next`.
- Edits keep each file's line endings. Every file touched is LF.
- `tsconfig.json` includes `specs/`, so the research probes must pass `npm run typecheck`.

**Scale/Scope**: about 6 new source files (≈350 LOC) and 9 modified. 11 new e2e specs plus a helper and a recorder, 3 new unit
specs, 2 guard scripts, and 13 existing test files re-pinned on purpose (two of them helpers gaining an option). **US1, US4
and US5 must land together**: drawing once needs the position mapping, and the fit needs the 57px wide bar. US2 depends on the
grid and ruler from US1. US3 is a guard over all of them.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to gate
against. As in entries 1 to 9, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's
own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed) | `quickstart.md` §6; INV-018. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | No new colour. The card number and words use `text-dim`/`text-faint`, as the head row already does. |
| **A visual tier is never opacity over a surface.** | `docs/DECISIONS.md` | PASS | Hidden words use `visibility`, never opacity. |
| **A size is never set by a width breakpoint** (density follows the pointer). | `globals.css` density header | PASS | The `wide` variant sets columns, card padding, gaps and page padding only, never a cell, control or row size (FR-002; INV-016 checks a touch pointer at wide). |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts` headers | PASS | `src/lib/tab/` has zero diff. The ruler reads `TabColumn` widths and feeds nothing back (INV-014, INV-019). |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | The fold rule and every word are in `src/lib/reading/cards.ts`, React-free and unit-tested. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | No write is added. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | entry 4 to 9 reviews | PASS | The fold oracle is a hand table. Re-pinned "long song" tests keep a long song (separate entries), not a folded short one. No check may pass by skipping. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. The probe config uses its own port. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | One CSS grid rule, one pure module, two small hooks. No JS packer (research R3). |
| **Offline first.** | `public/sw.js` header | PASS | Nothing is fetched. `public/sw.js` has zero diff. |
| **Earlier requirements stay true.** | spec 007 FR-064, spec 009 FR-035 | PASS | Spec 007 SC-010 and FR-055 are amended in place, pinned by `check:wide-amendments` (INV-017; Deviation 4). |

**Post-design re-check (after Phase 1)**: PASS. Nothing is stored. Every pair that must agree is closed by one calling the
other (*Agreement is structural*), except the CSS/JS width threshold, which a media query cannot share and a test pins
instead. The fit needed chrome the spec allowed to tighten, plus the footer (Deviations 1 and 3). No gate needs a Complexity
Tracking entry.

### Deviations from the spec's wording

1. **Card padding and page side padding are tightened on wide pages, not only the spacing between cards.** The spec's
   Assumptions allow "spacing between cards tightened". Measured at 1280, narrowing the gap from 16 to 8px gains 4px per card,
   against the ≈16px each card is short (≈24px for an 8px margin). The rest comes from the space around and between cards:
   page side padding (16 → 8px, +4px per card) and card padding (12 → 6px horizontal, +12px; 8px vertical) (research R3). No cell, control, gutter or row size changes. The figures are recorded in
   `docs/DECISIONS.md` (FR-033).
2. **One test in `capture.spec.ts` is re-pinned.** FR-026 and SC-006 say every capture test passes unedited.
   `capture.spec.ts`'s "four passes of A, then one of B" test asserts the **play view's** card count and `pass 1 of 4`, which
   FR-014 changes on purpose. It is re-pinned to the folded card, and no capture assertion changes.
3. **The footer is not drawn on the play view, or on a wide song page.** The spec does not mention it. It is ≈129px of page
   height, and SC-001 and SC-002 cannot hold with it (research R6). A narrow song page keeps it, and every other page keeps
   it.
4. **Spec 007 SC-010 and FR-055 are amended in place.** Holding the running height at rest makes the phone's idle bar ≈93px,
   against SC-010's "at most 60px". Cards side by side make FR-055's "filling at least 90% of the window at 1280" true only
   for a lone card. Spec 010 has no amendment requirement, so this follows spec 007 FR-064 and spec 009 FR-035's practice
   (research R12).
5. **The status words sit inside the controls row on a wide bar.** The spec says only that the height is held (FR-028). Inline
   holds it at the rest height (57px), which is the play view's vertical margin at 1280×800 (research R5).
6. **The fit song's frets are one digit.** The spec leaves frets open. A bar of two-digit frets pushes a 4-bar card onto two
   lines at 1280. This is recorded as a property of the claim (research R13), not tuned away.

## Invariants — what must never happen *(mandatory)*

The probes go through the real interfaces: e2e on a production build; `renderToStaticMarkup(TabStaff)` in jsdom; and the
public exports `drawnCards`, `cardWords`, `cardSpanWords`, `livePassWords` and `WIDE_QUERY`. The DOM hooks are in
[contracts/reading-cards.md](./contracts/reading-cards.md) §7 and [contracts/click-bar.md](./contracts/click-bar.md).

Named sets:

- **Wn**, narrow widths: 320, 375, 412, 767.
- **Ww**, wide widths: 768, 1024, 1280, 1440, 1920, 2560.
- **W**: Wn ∪ Ww.
- **Ptr**: mouse (`desktop`), touch (`mobile`, viewport set).
- **Th**: dark, light.
- **Pg**: the song page, the play view.
- **Song**, the songs laid out:
  - *fit*, data-model.md §1;
  - *short*: twelve 1-bar parts, each played once;
  - *long*: one 16-bar part and two 2-bar parts;
  - *wide-bar*: a part with one bar of 40 quarters;
  - *names*: a part with a 60-character name, two-digit frets and a heading;
  - *empty*: a part with no columns;
  - *none*: no arrangement (the play view's empty state).
- **View**: frets, notes, intervals.
- **Dens**: expanded, compact (the song page).
- **Fold**: F1–F15 of [contracts/cards.md](./contracts/cards.md) §4.
- **Pos**, what moves the reading position:
  - the click following;
  - the keys: column on, column back, bar on, bar back.
- **BarSt**, every state the bar can be in:
  - no tempo;
  - idle, follows the notation;
  - idle, plain because nothing is timed;
  - idle, plain by choice;
  - stopped: screen hidden, audio lost, fell behind;
  - counting in, following, plain, each with sound and soundless.
- **Clu**: cluster closed, open.
- **Prn**: print emulated at 718px (A4 portrait) and at 1047px (A4 landscape).
- **Bw**: 375, 412, 768, 1024, 1280, 1440.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a narrow page lay out differently from `main`: anything but one card per row at the list's full width, a card, staff or column in a different place or size, or a song-page staff that wraps. | `wide-narrow-unchanged.spec.ts`, against `e2e/fixtures/narrow-before.json`, recorded on the unedited build (quickstart §1). (a) The rects of every card, staff, `tab-column` and `tab-bar-run` equal the fixture's ±0.5px. (b) `main`'s `outerHTML`, ids stripped, with this entry's additions removed, equals the fixture's. The additions are `card-number`, `card-passes*`, `card-bars`, `tab-ruler`, `data-card`/`-first-pass`/`-last-pass`, the classes `reading-cards`/`reading-card`/`wide:*`, and `click-bar`'s subtree. (c) The song page has no `.tab-staff-wrapped`, and each `li`'s left and right equal the list's. | **Wn** × **Ptr** × **Th** × **Pg** × {the four fixture songs, which have no repeated entries}. The bar's own height is the recorded exception (INV-011). The play view's head row gains its number at every width (FR-012), which (b) strips and (a) does not measure. |
| INV-002 | Never is a card placed ahead of one before it, never does a card's number differ from its place, and never does a number repeat or skip. | `wide-order.spec.ts`: for consecutive `li`s, either `next.top > prev.top + 0.5` and `next.left ≤ prev.left`, or same top and `next.left ≥ prev.right`. `card-number` texts read `1..n` in DOM order, and the computed `order`, `grid-row` and `grid-column` are `auto`/`0`. | **Ww** × **Ptr** × **Pg** (numbers: play view) × {fit, short, long, names}. |
| INV-003 | Never is a card narrower than the floor in a row at least as wide as it, never wider than its row, never are rows' right edges unaligned, never are tops in a row unaligned, and never is the page width different between the two pages. | `wide-order.spec.ts`: `width ≥ min(343, list width) − 0.5`; `right ≤ list right + 0.5`; every full row's last card ends at the list's right ±0.5; tops in a row equal ±0.5. The list's `--staff-line` equals the widest ruler. The song page's `main` width equals the play view's at the same viewport. | **Ww** × **Ptr** × **Pg** × {fit, short, long, names, empty}. |
| INV-004 | Never does either page scroll sideways. | `wide-sideways.spec.ts`: `documentElement.scrollWidth ≤ innerWidth`, after load and after each view switch. | **W** ∪ {2560} × **Ptr** × **Th** × **Pg** × **View** × {fit, wide-bar, names, long}. |
| INV-005 | Never does the fit song scroll vertically, or leave a card under the bar, at the fit sizes. | `wide-fit.spec.ts`: `scrollHeight ≤ innerHeight`. Play view: every `li`'s bottom ≤ the bar's top, and six cards are present. Song page: the arrangement section and all four `li`s are within the viewport, with the panels closed. The figures are logged to the run for `docs/DECISIONS.md`. | {1280×800, 1440×900} × **Th** × **Pg**, mouse, frets, bar at rest, cluster closed. |
| INV-006 | Never is a wide page one card per row when two floor-width cards fit. | `wide-order.spec.ts`: some row of the fit song holds two cards or more. | {768, 1024, 1280} × **Ptr** × **Pg**. |
| INV-007 | Never are two passes folded unless they share entry, part, and consecutive pass numbers, and never is such a pair left unfolded. | Unit `cards.test.ts`: `drawnCards` against the hand table for every **Fold** row, plus the partition and `cardOf` properties. e2e `wide-fold.spec.ts`: each drawn row's `li` count and `data-first-pass`/`data-last-pass`, at one wide and one narrow width. | **Fold** (unit); {F1–F9, F13, F15} × {375, 1280} (e2e). |
| INV-008 | Never are a card's words, span or bar numbers wrong: no `×1`, no folded card without its `×k · passes a–b of n`, no wrong span, no card after a folded one starting at the wrong bar, and no head-row item from today missing. | Unit: `cardWords`, `cardSpanWords` and `offset` per **Fold** row. e2e `wide-fold.spec.ts`: `card-passes-rest`, `card-bars` and the first `tab-bar-number` of each card; today's label, section words, slice words, part name and heading present. A variant card shows `variant-line` and its marks. | **Fold** (unit); {F1–F9, F13, F15} × {screen, **Prn**} (e2e). |
| INV-009 | Never does the reading position light a column outside `cardOf[pass]`, light a different column key, skip or repeat a pass, or show live words that name the wrong pass, or live words on a card it has left. | `wide-position.spec.ts`. Keys, stopped: step "column on" from clear to the end, and at each step the lit element's `li[data-card]` is `cardOf[pass]`, its `data-column` is the stop's key, and `card-passes-live` is `pass {k} of {n}` exactly while `li[data-reading]`. Then back to the start with "column back", and the bar steps. Click following at bpm 300: the sequence of `(card, key, live words)` equals the list built from `readingStops`. On Stop and on Start, no `li` keeps `data-reading`. | **Pos** × {fit, F5, F8, F15} × {375, 1280}. |
| INV-010 | Never does folding change what is counted or sounded. | `wide-click-plays-all.spec.ts` (recorder): clicks and accents for the fit song equal the bar starts of all 38 bars across all ten passes. `notationColumns` is unchanged (scope fence). `click-following.spec.ts` runs unedited. | {fit, F2, F5, F8}, desktop. |
| INV-011 | Never do Start, Stop, the beat box, the tempo control or More move more than 0.5px on start, stop or a cluster toggle, never does the bar's height differ between rest and any running state, and never is a one-pass song's bar more than 1px off the screen's foot. | `wide-click-bar.spec.ts`: boxes before and after each transition. The bar's height at rest equals its height in each **BarSt**. `innerHeight − bar.bottom − safe-bottom ≤ 1`. `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` unedited. | **BarSt** × **Bw** × **Ptr** × **Clu** × {one pass, fit, 40 entries}. |
| INV-012 | Never is the last card, or the followed column, under the bar. | `wide-click-bar.spec.ts`: scrolled to the end, the last `li`'s bottom ≤ bar top − 7.5, at rest and running, cluster open and closed. `reading-highlight-on-screen.spec.ts` (re-pinned seed, same assertions) for the followed column. | {rest, running} × **Clu** × **Bw** × {fit, 40 entries}. |
| INV-013 | Never does a wide song-page staff scroll sideways when its bars fit its card, never does a wrapped line lose its string labels, bar numbers, chord row, brackets or rhythm row, never does a beam cross lines, and never does a narrow song-page staff wrap. | `wide-sideways.spec.ts`: on the song page at wide widths `.tab-staff-wrapped` is present and every `.tab-bar-run` has `scrollWidth ≤ clientWidth + 1`, except a bar wider than its line, which scrolls inside itself with a hidden scrollbar. `reading-layout.spec.ts` INV-016 and `notation-beams.spec.ts` run unedited (rows on columns; `data-beams-right` 0 at a line's end). | {768, 1024, 1280} × **Ptr** × **View** × **Dens** × {fit, wide-bar, names}; and {375, 412} for "never wraps". |
| INV-014 | Never does a stored row, the sync, the export, capture, the click's reader, or `TabStaff`'s markup without `ruler` change. | `npm run check:untouched-wide` (*Scope fence*). `npm run test:spec004`, the export and parser tests, `frets-unchanged.test.ts` with `baseline.json`, and `TabStaff.wrapped-unchanged` with its snapshot, all unedited. Every capture spec but Deviation 2's test is unedited and passes. | The paths in *Scope fence*. |
| INV-015 | Never does a printed play view split a card across pages, cut anything at the right edge, show live words, or lose a card's number or `×` words. | `wide-print.spec.ts` with `emulateMedia({ media: "print" })` at each **Prn** width. Each `li` has `break-inside: avoid`; its right ≤ the viewport. 718: one card per row; 1047: the grid. `card-number` and `card-passes-rest` are visible; `card-passes-live` is `display: none`; `click-bar` is hidden. | **Prn** × **Th** × {fit, F5}. |
| INV-016 | Never does the layout switch at a width other than 768, or on pointer type, and never do the CSS and JS thresholds differ. | Unit `wide-threshold.test.ts`: the `@custom-variant wide` condition in `globals.css` equals `WIDE_QUERY`. e2e `wide-order.spec.ts`: at 767 the play view has one column and the song page no wrapped staff; at 768 two columns and wrapped. The same holds on touch. | {767, 768} × **Ptr** × **Pg**. |
| INV-017 | Never is an earlier requirement left saying something untrue, or a test pin moved in silence. | `npm run check:wide-amendments`. Each file in *Existing tests this changes on purpose* is named under "010 — re-pinned tests" in `docs/DECISIONS.md`. Spec 007 SC-010 and FR-055 each carry `Amended by spec 010` with a note. The fit figures, the threshold, the fold rule and the order are under "010 — decisions" (FR-033). | Every row of the table; spec 007 SC-010, FR-055. |
| INV-018 | Never is a claim that needs a person or a real device marked done. | `tasks.md` carries the browser check (quickstart §6) and the real-tablet item (§7) as human tasks, `🛑 BLOCKED` until done. | §6 × its seven sizes × **Th** × print; §7's three devices. |
| INV-019 | Never does the ruler's width differ from the staff's one-line width by more than 1px. | `wide-ruler.spec.ts`: for each card, set its `.tab-lines` to `flex-wrap: nowrap; width: max-content` and each run to `flex: none` (in a cloned page state); the lines' width plus `--gutter` equals the `tab-ruler`'s `offsetWidth` ±1. Unit `TabStaff.ruler.test.tsx`: no ruler without the prop; the ruler's `calc` is the sum of the same `widthTerms` strings. | **View** × {fit's four parts, a chord-widened part, two-digit frets, a part with connector gaps, a variant with removal gaps} × **Ptr**. |
| INV-020 | Never do a card's rect or the staff's DOM change while the reading position moves within or between cards. | `wide-position.spec.ts`: during a full click run and a key walk, every `li`'s rect is constant ±0.5, and a `MutationObserver` on each `.tab-staff` sees no `childList` change, only `class` on columns. | {fit} × {768, 1280} × **Pos**. |
| INV-021 | Never does a control on a wide card or page lose its behaviour or its touch floor. | `wide-controls.spec.ts`: the part card's menu opens, Escape closes it with focus returned, its items act, rename saves, and the label link opens capture. The song tools panel, view and density controls, and the cluster work. Each control is ≥ 44px on touch and meets spec 007's fine floor. | {part menu, rename, label link, song tools panel, view control, density control, cluster} × {768, 1280} × **Ptr**. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002 | INV-016, INV-006 (touch at wide) |
| FR-003 | INV-001 |
| FR-004, FR-012 | INV-002 |
| FR-005, FR-006, FR-007, FR-011 | INV-003, INV-006 |
| FR-008, FR-009, FR-024 | INV-013 |
| FR-010 | INV-004, INV-013 |
| FR-013, FR-015, FR-018, FR-019, FR-022 | INV-008 |
| FR-014 | INV-007 |
| FR-016, FR-017, FR-021 | INV-009, INV-020 |
| FR-020 | INV-010 |
| FR-023 | INV-021 |
| FR-025, FR-026 | INV-014 |
| FR-027, FR-028, FR-029, FR-030 | INV-011, INV-012, INV-014 |
| FR-031 | INV-015 |
| FR-032, FR-033 | INV-017 |
| SC-001, SC-002 | INV-005 |
| SC-003 | INV-001, INV-004, INV-006 |
| SC-004 | INV-009, INV-010 |
| SC-005 | INV-011 |
| SC-006 | INV-014, INV-017 |
| SC-007 | INV-015 |
| SC-008 | INV-002, INV-018 |
| Edge: a run across a section visit; two entries; a bar range; ×2 with a variant; ×1 with a variant | INV-007 (F5, F6, F7, F8, F3, F4) |
| Edge: a part with no columns | INV-003 (*empty*), INV-007 (F10) |
| Edge: a bar wider than its card | INV-013 (*wide-bar*), INV-004 |
| Edge: note names or intervals | INV-004, INV-013 (**View**) |
| Edge: compact on the song page | INV-013 (**Dens**) |
| Edge: a song with no arrangement | INV-011 (the bar on *none*) |
| Edge: a long head row | INV-003, INV-004 (*names*) |
| Edge: the threshold | INV-016 |
| Edge: resizing or rotating | INV-009 (one resize across 768 mid-walk keeps the lit key), INV-016 |
| Edge: print | INV-015 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| Which passes share a card, and where the highlight looks for a pass | One `drawnCards` call returns `cards` and `cardOf` from one loop. `PlayView` renders `cards` and passes `cardOf` to `useReadingPosition`. |
| What is drawn, and what is counted, sounded and stepped | `cards` are derived **from** `passes`. `ClickBar`, `readingStops` and `notationColumns` read `passes` and never see a card. |
| A card's bar numbers, its span, and the keys' running bars | All read `passBars(passes).offset`. |
| The rest words, the live words and the printed words | `cardWords` and `livePassWords` in `cards.ts`. The DOM write in `useReadingPosition` calls `livePassWords`; React renders `cardWords`. |
| A card's one-line width and its drawn columns | The ruler's `calc` sums `widthTerms()`, the helper the columns' `width`/`flex-basis` call. |
| The grid track and the card's padding | Both read `--card-pad-x` and `--card-gap`. |
| The bar's height, the page's bottom padding and the scroll padding | One `ResizeObserver` writes `--click-bar-h` and `scroll-padding-bottom` from one `offsetHeight`. |
| The held height and the words the bar can say | Ghosts and live words both read the one `CLICK_WORDS` table. |
| The CSS threshold and the JS one | **Not structural**: a media query cannot read a variable. `wide-threshold.test.ts` pins `globals.css`'s condition equal to `WIDE_QUERY`, and INV-016's e2e checks both at 767/768. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Data rewrite**: existing rows. | None. No migration, backfill or normalisation. | Spec, Key Entities. | INV-014 |
| **Data read**: what decides a fold. | Only `step.entryId`, `step.partId` and `step.pass` of the drawn passes. No width, no event content, no visit label. | research R1 | INV-007 |
| **What a reader stops seeing.** | (a) The second and later passes of a foldable run, drawn once with `×k · passes a–b of n` and their bar span. They are still counted, sounded and stepped. (b) The footer on the play view at every width, and on a wide song page. Nothing is deleted from data. | FR-014; research R6. | INV-007, INV-008, INV-010; Deviation 3 |
| **Deletion**: could a layout change remove anything? | No. No write is added. The part card's menu and Delete are untouched (FR-023). | | INV-014, INV-021 |
| **Authority**: who sees the wide layout. | Everyone, by viewport width alone. No role exists, and none is added. Pointer type plays no part. | FR-001, FR-002 | INV-016 |
| **Publishing**: what leaves the app. | Nothing new. The export, sync messages and print's content are unchanged, apart from print's grid on a wide page. | FR-025 | INV-014, INV-015 |
| **Layout authority**: which sizes may change. | Wide only: page side padding (8px), card padding (6px × 8px), card gap (8px), the column count. All widths: the bar's position (fixed) and held height. Nothing in the pointer density blocks; no cell, control, gutter, row or font size. | research R3, R5; Deviation 1. | INV-001, INV-005, INV-011 |
| **Earlier spec text**: what may be rewritten. | Spec 007 SC-010 and FR-055 only, amended in place with before and after wording. | research R12; Deviation 4 | INV-017 |
| **Existing tests**: what may be edited. | Only the files in *Existing tests this changes on purpose*, each re-pinned to an equal or stronger check, never deleted, and named in `docs/DECISIONS.md`. A test outside the table that fails is a product defect, unless it pins one of C1–C3 (research R11). Then it is added to the table, with its reason, **before** it is edited. | FR-032 | INV-017 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-wide.sh`, run as `npm run check:untouched-wide`, prints `zero diff` for every path below against `main`,
tracked or untracked, and fails on any other result:

- **Storage, sync and server**: `src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`,
  `src/lib/model.ts`, `src/lib/local/`.
- **Layout, export, notation and capture logic**: `src/lib/tab/` (all of it, tests too), `src/lib/export/`, `src/lib/rhythm/`
  (all of it), `src/lib/arrangement/`, `src/lib/capture/`, `src/lib/chords.ts`.
- **The reading module, except the new files**: `src/lib/reading/position.ts`, `bars.ts`, `played.ts`, `marks.ts`,
  `compare.ts`, `labels.ts`, `staff.ts` and `view.ts`, plus `src/lib/reading/__tests__/baseline.json` and
  `notation-baseline.json`.
- **Components**: `src/components/capture/`, `src/components/tab/RhythmCell.tsx`,
  `src/components/tab/__tests__/__snapshots__/`.
- **Offline**: `public/sw.js`.
- **e2e specs**: `e2e/click-double-tap.spec.ts`, `e2e/click-bar-fit.spec.ts`, `e2e/click-following.spec.ts`,
  `e2e/usability-highlight-timing.spec.ts`, `e2e/usability-height-budget.spec.ts`, `e2e/polish-band*.spec.ts`,
  `e2e/capture-*.spec.ts`, `e2e/notation-capture*.spec.ts`.
- **e2e fixtures**: `e2e/fixtures/capture-375-before.json`, `e2e/fixtures/paste-preview-before.json`.

It also checks that `e2e/capture.spec.ts` differs from `main` only inside the test titled
`"builds the brief's arrangement and reads it back in order"`, which starts at line 528 (Deviation 2).

### Existing tests this changes on purpose

Each file is re-pinned, never deleted. Each is named in `docs/DECISIONS.md` under "010 — re-pinned tests". **C1** is drawn
once, **C2** is the held bar height (research R11).

| File | What it pins today | Re-pinned to |
|---|---|---|
| `e2e/rhythm-probe-helpers.ts` | `seed(…, { passes })` sets the entry's `repeat` | gains `entries: n`, which writes n separate part entries. `passes` is unchanged. Addition only. |
| `e2e/click-helpers.ts` | `seedPlayable(…, { passes })` clicks "One more repeat" | gains `entries: n`, which adds the part n times. `passes` is unchanged. Addition only. |
| `e2e/capture.spec.ts` | (C1) "builds the brief's arrangement and reads it back in order": the play view of `A ×4, B` has 5 staves, `pass 1 of 4`, `pass 4 of 4` | 2 staves. Card 1's `card-passes-rest` is `×4 · passes 1–4 of 4` and its `card-bars` is `bars 1–4`. Card 2 is B. Deviation 2. |
| `e2e/usability-wrap.spec.ts` | (C1) INV-032: two passes of one entry number 1–16 and 17–32; INV-033: `pass 1 of 2`, `pass 2 of 2`, heading on the first only | INV-032: seeds `entries: 2`; same assertions. INV-033: (a) `entries: 2` for "heading on the first card only"; (b) `passes: 2` asserts one card reading `×2 · passes 1–2 of 2` and `bars 1–32`, with the heading. The no-fraction check is kept on both. |
| `e2e/usability-bars-sections.spec.ts` | (C1) "INV-032 {shape}, twice through" ×2: `[{part a, repeat 2}]` → numbers `[[2],[4]]` and `[[1,3],[4,6]]` | the arrangement becomes `[{part a}, {part a}]`; same numbers. A folded twin is added in `wide-fold.spec.ts` (F11). |
| `e2e/variant-marks.spec.ts` | (C1) the UI test "A ×4 last A′" expects 4 staves and checks marks on `nth(0..2)`, the line on `nth(3)`; INV-030 expects 7 staves, `lines[3]` and `staffReport(3)` | 2 staves: no marks on `nth(0)`; the line on `nth(1)`. INV-030: 5 cards `[A×3, A′, P, A, P]`; `lines` `[null, line, null, null, null]`; `staffReport(1)` equals the song page's; counts zero on 0, 2, 3 and 4. |
| `e2e/click-bar-at-size.spec.ts` | (C1) two tests seed `passes: 40` to make a long page | `entries: 40`; same assertions. |
| `e2e/click-layout.spec.ts` | (C1) `seedPlayable({ passes: 12 })` for "a long song" | `entries: 12`; same assertions. |
| `e2e/click-state.spec.ts` | (C1) "controls reachable across a 40-pass song" | `entries: 40`; same assertions. |
| `e2e/click-timing.spec.ts` | (C1) INV-022 seeds `passes: 8` and counts `8 * 501` columns | `entries: 8`; same count. |
| `e2e/reading-highlight-on-screen.spec.ts` | (C1) `passes: 3`: "drawn three times: tall enough to need following on any phone" | `entries: 3`; same assertions. |
| `e2e/usability-cluster-states.spec.ts` | (C2) "INV-026 idle, collapsed, at most 60 high" at 375×667 | idle height ≥ 44, equal to the same bar's running height ±0.5, and ≤ the figure recorded at T001 (≈93) plus 1. Spec 007 SC-010, amended. |
| `e2e/usability-reach.spec.ts` | (C2) INV-026 "idle height ≤ 60" at 375×667 and 390×844 | the same re-pin as above, at both sizes. The rest of the test is unedited. |
| `e2e/wide-narrow-unchanged.spec.ts` ("click bar height unchanged below 768") | (C2) the idle bar equals the height recorded on main, 57px | the idle bar is ≥ 44, equals the same bar's running height within 0.5px, and the running height is exactly the held figure, 97 at 375 and 412 (main drew 93 running; DECISIONS "Bar held height", ≤ 98). Still exact. |
| `e2e/usability-staves.spec.ts` (INV-016/017/038, `widthShare`) | the staff on the play page takes ≥ 90% of the window at 1280 | the widest row of staves takes ≥ 90% of the window: two cards side by side count together (46% + 46%). One card to a row is the old check. (C1: one entry's cards now sit two across.) The rest is unedited. |

**Must pass unedited**:
- **Click.** `e2e/click-double-tap.spec.ts`, `e2e/click-bar-fit.spec.ts`, `e2e/click-following.spec.ts`,
  `e2e/usability-highlight-timing.spec.ts` (its two-pass run folds, and the logged `data-column` sequence is unchanged).
- **Layout and notation.** `e2e/reading-layout.spec.ts`, `e2e/notation-*.spec.ts`, `e2e/usability-staves.spec.ts`,
  `e2e/usability-staff.spec.ts`.
- **Capture and part cards.** `e2e/polish-*.spec.ts`, every capture spec except Deviation 2's test.
- **Unit.** Every unit test in `src/`.

If one of these fails, the product is wrong, not the test. The exception is the rule in *Blast-radius decisions*: add it to the
table first, with its reason.

## Project Structure

### Documentation (this feature)

```text
specs/010-wide-reading-layout/
├── plan.md                  # This file
├── research.md              # Phase 0: R1–R13
├── data-model.md            # Phase 1: the fit song, DrawnCard, tokens (nothing stored)
├── quickstart.md            # Phase 1: validation guide
├── contracts/
│   ├── cards.md             # drawnCards, words, the fold corpus F1–F15
│   ├── reading-cards.md     # the grid, the ruler, useCardTrack, the play-view card, the reading position
│   └── click-bar.md         # fixed bar, held height, what must not move
├── research-probes/
│   ├── probe.config.ts              # its own port; not part of the suite
│   ├── measure-fit.probe.ts         # R2: today, 5 strings, packings
│   ├── measure-fit.json
│   ├── measure-fit-tight.probe.ts   # R3: 4 strings, panels closed, chrome variants
│   └── measure-fit-tight.json
├── checklists/              # from /speckit-specify
└── tasks.md                 # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── reading/
│       ├── cards.ts                 # NEW: drawnCards, cardWords, cardSpanWords, livePassWords (pure)
│       ├── wide.ts                  # NEW: WIDE_QUERY
│       └── __tests__/
│           ├── cards.test.ts        # NEW: INV-007, INV-008 (corpus F1–F15)
│           └── wide-threshold.test.ts   # NEW: INV-016 (globals.css == WIDE_QUERY)
├── components/
│   ├── app/
│   │   ├── PlayView.tsx             # cards, ol.reading-cards, data-card, head row (number, words, span), ruler, cardOf
│   │   ├── SongView.tsx             # max-w-screen-2xl, ul.reading-cards, wrap + ruler when wide, card padding
│   │   └── Footer.tsx               # null on the play view; wide:hidden on the song page
│   ├── reading/
│   │   ├── useReadingPosition.ts    # cardOf, live words, --click-bar-h
│   │   ├── useWide.ts               # NEW: matchMedia(WIDE_QUERY)
│   │   └── useCardTrack.ts          # NEW: rulers → --staff-line
│   ├── rhythm/
│   │   └── ClickBar.tsx             # fixed; lead/status/tools grid; CLICK_WORDS; ghost slot
│   └── tab/
│       ├── TabStaff.tsx             # widthTerms() shared; `ruler` prop
│       └── __tests__/TabStaff.ruler.test.tsx   # NEW: INV-019 (unit)
└── app/
    └── globals.css                  # @custom-variant wide; .reading-cards; card tokens; .tab-ruler; .card-passes;
                                     # .click-status ghosts; print rules

e2e/
├── wide-helpers.ts                  # NEW: seedFitSong (4-string), the Song set, Fold seeds
├── wide-before.config.ts            # NEW: records the narrow baseline (its own port; not in the suite)
├── wide-narrow-record.ts            # NEW: writes e2e/fixtures/narrow-before.json
├── fixtures/narrow-before.json      # NEW: recorded on the unedited build
├── wide-fit.spec.ts                 # INV-005
├── wide-order.spec.ts               # INV-002, INV-003, INV-006, INV-016
├── wide-sideways.spec.ts            # INV-004, INV-013
├── wide-narrow-unchanged.spec.ts    # INV-001
├── wide-fold.spec.ts                # INV-007, INV-008
├── wide-position.spec.ts            # INV-009, INV-020
├── wide-click-plays-all.spec.ts     # INV-010
├── wide-click-bar.spec.ts           # INV-011, INV-012
├── wide-print.spec.ts               # INV-015
├── wide-ruler.spec.ts               # INV-019
└── wide-controls.spec.ts            # INV-021

scripts/
├── untouched-by-wide.sh             # INV-014 (npm run check:untouched-wide)
└── check-wide-amendments.sh         # INV-017 (npm run check:wide-amendments)

docs/DECISIONS.md                    # 010: suite before, decisions and fit figures, re-pinned tests, browser check
specs/007-usability-pass/spec.md     # SC-010, FR-055 amended in place
package.json                         # the two check scripts
```

**Structure Decision**: a single Next.js package, as in entries 1 to 9.
- The fold rule and its words live in `src/lib/reading/`, beside `bars.ts`, whose offsets they read. `src/lib/arrangement/`
  stays fenced.
- The width hook and the track hook live in `src/components/reading/`, beside `useReadingPosition`.
- The ruler lives in `TabStaff`, because only the staff knows its own column terms.

### Order of work

1. `quickstart.md` §1 on the unedited build:
   - re-run the probes;
   - record `narrow-before.json` and the bar heights;
   - save the suite's failures on `main`.
2. `cards.ts` and `cards.test.ts` (INV-007, INV-008).
3. `wide.ts`, `useWide`, the `wide` variant and tokens in `globals.css`, then `wide-threshold.test.ts` (INV-016).
4. `TabStaff`'s `widthTerms()` refactor and the `ruler` prop, then `TabStaff.ruler.test.tsx`. The snapshot and `baseline.json`
   stay green at every step (INV-014).
5. `useCardTrack`, `PlayView` (cards, head row, `data-card`) and `SongView` (width, grid, `wrap`, padding).
6. `useReadingPosition` (`cardOf`, live words, `--click-bar-h`), then `ClickBar` (fixed, `CLICK_WORDS`, slot), then `Footer`.
7. The helpers' `entries` options, then the re-pins in the table, then the new e2e specs, the guard scripts, the amendments and
   the `docs/DECISIONS.md` entries (fit figures from INV-005's log).
8. The full suite. Then the person-level browser check (§6) and the owed device item (§7), both human.

## Complexity Tracking

No gate is violated, so there is nothing to justify.
