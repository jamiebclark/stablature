# Implementation Plan: Rhythm notation under the tab

**Branch**: `009-rhythm-notation` | **Date**: 2026-11-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-rhythm-notation/spec.md`

## Summary

The letters under the tab become stems, flags, beams and rests. On a staff with rhythm, the group brackets move under the tab with the
beams. Capture draws the rhythm row too, and the inspector's duration buttons show note symbols. Nothing is stored, and a part with no
durations is byte-identical on every surface.

The design has four parts, and in each, two things that must agree are kept in agreement by one calling the other:

- **Beat positions come from the click's own arithmetic.** A new `barPositions(events)` in `notation.ts` calls `readBar`, the function
  that times the click, one bar at a time. A bar that cannot be timed stops only itself (FR-006). Within a bar, a hit's position is known up
  to the first unset column or unreadable group (FR-008), because `readBar` reports hits before it fails (research R3).
- **Beaming is a pure function** (`rhythmMarks` in `src/lib/rhythm/beams.ts`). It turns layout columns and positions into one mark per
  column: note or rest, levels, flags, and `left`/`right` beam levels shared with each neighbour. A run is consecutive beamable columns with
  one *unit*: the beat, or the counted group that reads. Barlines are columns and the unit carries the group id, so FR-007 holds by
  construction (research R4).
- **Beams are drawn as halves.** Each column draws its own left and right halves, from its edge to its centre, where the stem is. A beam is
  never measured, so it stays on its stems through any width change: a chord, a view, density or wrapping (research R5).
- **One bracket, two places.** `bracketRow` is `"above"` with no rhythm (exactly today's markup) and `"under"` with it. Both placements use
  the same bracket element and one `groupLabels` call, so each group's number is drawn once (research R6, R7).

The risky claim is height, and it was worked out first ([research.md](./research.md) R1, R2):

| Measure (375×667 touch) | Figure | What it means |
|---|---|---|
| Band content height today | 185.6px | outer 189.6 less `pt-1` |
| Six strings, a chord row and a bracket row | 184.0px | 1.6px spare, not 5 |
| Needed under the tab with a 12px numeral (spec 007 FR-030) | 25.5px from the stem's top | 22.0 is available without new height: **3.5px short** |
| Named source | the band's `pt-1`, dropped only while the staff draws rhythm | content becomes 189.6 |
| Six strings, a chord row and rhythm (with or without a group) | **188.0px** | 1.6px slack; band outer height unchanged |

There is no migration, no new dependency, no new route, no fetched asset, and no change to `public/sw.js`, the export or the parser.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router).

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`. **No new dependency.** Glyphs are inline SVG
and `div`s. No font is added.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change** of any kind (FR-033).

**Testing**: Vitest 5 (`npm test`): node by default, and jsdom by docblock. Playwright 1.64 (`npm run test:e2e`) against a production
build, with the projects `mobile` (Pixel 7, coarse), `desktop` (fine), `firefox` (staves only) and `no-pointer` (density only). New specs
run on `mobile` and `desktop`. A person-level browser pass and two real-phone items follow.

**Target Platform**: An installable, offline-capable PWA in a mobile browser, and a desktop browser. The budgeted sizes are 375×667 and
1280×800.

**Project Type**: Next.js web application, single package.

**Performance Goals**: Beaming is O(columns) per render, memoised with the layout. A fret tap in capture shows its note no slower than today:
the spec 008 tap-latency spec runs unedited, and rhythm adds work only to parts with durations.

**Constraints**:
- A part with no durations: `baseline.json` **unedited**, and `frets-unchanged.test.ts` green (FR-019, SC-001).
- `src/lib/tab/` has **zero diff**. `src/lib/rhythm/notation.ts` changes by **addition only**, plus a fourth callback argument (research R3).
- Spec 007 FR-030 (numerals ≥ 12px, no line across a digit) is binding and is **not** amended.
- A visual tier is never opacity over a surface. Unlayered CSS beats any Tailwind utility.
- Never run the build or the e2e suite while a dev server holds `.next`.
- Edits keep each file's line endings. Every file touched in this tree is LF.
- `tsconfig.json` includes `specs/`, so the research probe and its config must pass `npm run typecheck`.

**Scale/Scope**: about 5 new source files (about 550 LOC) and 6 modified source files. About 9 new e2e specs, 2 new unit specs and 2 guard
scripts. 18 existing test files are re-pinned on purpose. **US1 and US2 must land together**, because the brackets move with the rhythm row.
US3 depends on both. US4 is independent.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to gate against. As in
entries 1 to 8, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed) | `quickstart.md` §6; SC-002, SC-009; INV-017. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | No new colour. The symbols use `--text`. Contrast is measured at actual size (INV-010). |
| **A visual tier is never opacity over a surface.** | `docs/DECISIONS.md` | PASS | Solid `currentColor` only (INV-010). |
| **A distinction never rests on hue.** | `docs/DECISIONS.md` | PASS | The thirteen states differ by shape, which a greyscale probe checks (INV-010). A button's pressed state shows by fill and border. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts` headers | PASS | `src/lib/tab/` has zero diff. The rhythm row reads `TabColumn` and never feeds back into widths (INV-018). |
| **Barlines are stored, never inferred.** | `layout.ts` header | PASS | Bars split only at stored barlines. No time signature (FR-005). |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `barPositions`, `rhythmMarks` and `groupLabels` are React-free and unit-tested. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | There is no new write. The buttons keep `property.commit`. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | Entry 4 to 8 reviews | PASS | The beaming oracle is a hand table, not a second implementation. Re-pinned tests read `data-*` and rects, never text that is now empty, and no check is left to skip silently (the *Existing tests* table). |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | One cell component, one glyph table, one symbol component. |
| **Offline first.** | `public/sw.js` header | PASS | Nothing is fetched (INV-014). |
| **Earlier requirements stay true.** | spec 007 FR-064, spec 008 FR-035 | PASS | FR-035's amendments are pinned by `check:notation-amendments` (INV-016). |

**Post-design re-check (after Phase 1)**: PASS. Nothing is stored, and each pair of things that must agree is closed by one calling the other
(*Agreement is structural*, below). One spec figure was wrong (5px of spare, where 1.6px is measured), and the height it would have paid
for is taken from a named place under FR-018. That is recorded as Deviation 1. No gate needs a Complexity Tracking entry.

### Deviations from the spec's wording

1. **The spare height is 1.6px, not 5px, and the rhythm row is 4px taller than the bracket row it replaces.** The spec's "the rhythm row
   MUST fit in the height the bracket row frees" cannot hold with a 12px numeral (spec 007 FR-030) and three 2px beams (FR-027). FR-018's
   alternative is used: the 4px comes from the capture band's `pt-1`, dropped only while the staff draws rhythm. It is measured before and
   after (`quickstart.md` §1 and §6) and recorded in `docs/DECISIONS.md`. Spec 008 FR-003 is amended to say so (FR-035).
2. **The bracket's number is drawn once per group id, on every staff** (FR-014). On a staff with no durations, this differs from today only
   for a legacy group stored across a barline. The probe found no such layout among the 3,394 baseline fixtures (research R6), so FR-019's
   "identical markup" holds for every pinned input.

## Invariants — what must never happen *(mandatory)*

The probes go through the real interfaces: `e2e` on a production build; `renderToStaticMarkup(TabStaff)` and `render(ColumnInspector)` in
jsdom; and the public exports `barPositions`, `notationColumns`, `rhythmMarks` and `groupLabels`. The DOM hooks are in
[contracts/rhythm-row.md](./contracts/rhythm-row.md) and [contracts/duration-buttons.md](./contracts/duration-buttons.md).

Named sets:

- **Surf**, every surface that draws a staff:
  - capture, single line (375×667);
  - capture, wrapped (412×915);
  - the song page, expanded;
  - the song page, compact;
  - the play view (wrapped);
  - the paste preview;
  - print emulation of the song page;
  - print emulation of the play view.
- **Th**: dark, light.
- **Sz**: 375×667 (coarse), 1280×800 (fine).
- **View**: frets, notes, intervals.
- **Dens**: expanded, compact.
- **D**: `w`, `h`, `q`, `8`, `16`, `32`.
- **Sym**, the thirteen states: six notes, six rests, and no duration.
- **Corp**, the FR-036 corpus: the 24 rows and L1–L4 in [contracts/beaming.md](./contracts/beaming.md).
- **Brk**, what a beam may not cross (FR-007):
  - a barline;
  - a rest;
  - an unset column;
  - an unknown stored value;
  - `q`, `h` and `w`;
  - a plain group's first and last column;
  - a counted group's first and last column;
  - a wrapped line break;
  - a print line break inside a wide bar.
- **Grp**, the group shapes:
  - a counted group that reads;
  - a counted group still being built;
  - a counted group with a repeated column;
  - a plain group;
  - a plain group with a repeated column;
  - a group next to a barline;
  - two adjacent groups;
  - a legacy group across a barline.
- **Gapk**, the gaps a beam must run through: a connector gap (a slide or hammer-on); a variant's removal gap.
- **Wid**, what can change a column's width:
  - none;
  - a chord symbol that widens it;
  - a two-digit fret;
  - a `7x8` compact cell;
  - the notes view;
  - the intervals view.
- **Str**: 4, 5 and 6 strings.
- **Cap**, the capture row sets:
  - no group, no durations;
  - a plain group, no durations;
  - a counted group, no durations;
  - no group, durations;
  - a counted group, durations;
  - a plain group and a counted group, durations.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a part with no durations draw differently, in markup or in layout, from `main`. | `frets-unchanged.test.ts` with `baseline.json` unedited (plain and `showRhythm` markup, base and raised). `tab-staff-rhythm.test.tsx`'s no-duration case unedited. `polish-band-unchanged.spec.ts` against `e2e/fixtures/capture-375-before.json` unedited. `notation-paste.spec.ts`: the preview's `outerHTML` equals a fixture recorded on `main` for each import fixture. | **Surf** × {no groups, each of **Grp**} × **Th**. In capture, also each **Cap** row with no durations. |
| INV-002 | Never does a beam cross anything in **Brk**, and never is a beamable pair in one unit left unjoined. | Unit: `rhythmMarks` over **Corp** against the hand table, and `out[i].right === out[i+1].left` for every `i`. e2e `notation-beams.spec.ts`: for each **Corp** bar, the `data-beams-left`/`data-beams-right` of every cell match the table; no beam element sits in a barline, rest or unset cell; at each wrapped line's last column, `data-beams-right` is 0. | **Brk** × **Corp** × {song expanded, song compact, play, capture single, capture wrapped, print of the play view}. |
| INV-003 | Never does the staff's beat position for a hit disagree with the tick the click uses for it. | Unit `positions.test.ts`: for every pass in `notation-baseline.json`'s inputs and **Corp**, and for every bar `walk` times, `barPositions(events).get(key).tick` equals `notationColumns(...)`'s tick less the bar's start. `notation-baseline.test.ts` and `notation-oracle.test.ts` run unedited. | Every input in `notation-baseline.json` × every timed bar × every hit, plus **Corp**. |
| INV-004 | Never is a group's number drawn twice or left out, never is a bracket in a different placement from its staff's rule, and never does a staff draw a bracket row above when it draws rhythm. | jsdom: count `.tab-bracket-label` per group id (1 for each counted group, 0 for plain), and check each `tab-bracket` is inside `tab-rhythm` iff the staff has `data-rhythm`. e2e `notation-brackets.spec.ts` checks the same on screen, plus that on a staff with rhythm no column has a row above the cells. | **Grp** × {rhythm, no rhythm} × **Surf** (paste: no rhythm only). |
| INV-005 | Never does capture at 375×667 on touch put a string, the chord row or any part of the rhythm row (bracket and numeral included) out of view, scroll the page, or shrink the band below 189px. | `notation-capture-height.spec.ts`: every `.tab-cell`, the chord row and the `tab-rhythm` cells (with their stems' rects) lie inside the band's content rect; `scrollHeight − innerHeight ≤ 0`; band ≥ 189. `usability-height-budget.spec.ts` runs unedited. The figures are recorded before and after. | **Str** × **Cap** × **Th** × {cursor at the end, cursor on a group's labelled column, a selection across the group}. |
| INV-006 | Never does a beam end more than 1px from the stem it joins, or a piece of a beam hang across a gap or line it does not join. | e2e: for each `beam` and `stub`, the edge on the stem side is within 1px of its column's stem centre; the other edge of a `left`/`right` half is within 1px of the column's edge; in a **Gapk** gap, the full-width beam's ends touch both neighbours' halves within 1px. In print, a beam's piece never sits on a different line from its stem. | **Gapk** × **Wid** × **View** × **Dens** × {single line, wrapped} × {screen, print with a bar wider than the page}. The view is switched with no reload. |
| INV-007 | Never is a stem, rest or oval more than 1px off its note's centre. | e2e `notation-alignment.spec.ts`: the stem's rect centre against the cell `span`'s rect centre, and the rest or oval's rect centre against the column centre. | **Sym** × **Wid** × **View** × **Dens** × {single, wrapped} × **Sz**. |
| INV-008 | Never does a stem start inside a fret number's mask, never does a part of the rhythm row overlap another band or the cursor's rule, never does a line cross a numeral, and never is a numeral under 12px. | e2e rects: a stem's top ≥ the lowest cell's `span` bottom; the beam stack's bottom ≤ the bracket line's top − 1; the bracket line's bottom ≤ the numeral's top; the numeral's bottom ≤ the column's bottom − 2 (the `::after` rule); the numeral's computed `font-size` ≥ 12. | **Sym** × {in no group, in a group on its labelled column} × {active column, not} × **Sz** × {a note on the lowest string, none there}. |
| INV-009 | Never is a beam, stub or flag under 2px thick, a gap between stacked ones narrower than the thickness, or a stem or bracket line under 1px. | e2e: the rects of `beam`, `stub` and `stem` parts; the `stroke-width` and bbox of `flag` parts; and the vertical gaps between levels. | Each of {beam, stub, flag} × levels 1 to 3 × **Sz** × {screen, print}. |
| INV-010 | Never is a symbol below 4.5:1 against the surface it sits on, never is opacity or `color-mix` used on one, and never are two of **Sym** indistinguishable in greyscale. | `notation-symbols.spec.ts`: `contrast()` from `rhythm-probe-helpers.ts` on each part's computed colour against its column's resolved background; computed `opacity` is 1 up the tree to the staff; greyscale screenshot crops of the 13 cells differ pairwise by at least 2% of pixels. | **Sym** × {`--bg`, `--bg-raised`, `--selection`} × **Th** × **Sz** × print. |
| INV-011 | Never does capture behave differently because rhythm is drawn: the selection colour, revealing a new group, each wrapped line's own row, and the transition into and out of rhythm. | `notation-capture.spec.ts`. Set the first duration: the rhythm row appears, brackets move under, every string is still in view. Clear the last: rhythm gone, brackets above, markup equals the earlier no-duration `outerHTML`. Make a group off-screen: its bracket is scrolled into view (`[data-start]`). Selected columns' parts compute to `--text`. Wrapped: each `.tab-bar-run` has its own `tab-rhythm` cells and no beam crosses runs. | {6 strings at 375×667, 4 strings wrapped at 412×915} × **Th** × {tuplet, plain group}. |
| INV-012 | Never is a duration button unnamed, out of order, under its floor, off one line, lit wrongly, or shown as a letter. | `duration-row.test.tsx` (jsdom): order by `data-duration`; `aria-label` and `title` equal `words`; `aria-pressed` matches the stored value; `textContent` is empty. e2e `notation-buttons.spec.ts`: all six share one `top`; each is ≥ 54×44 on touch and meets spec 007's fine floor; a greyscale crop of lit and unlit differs. | The six of **D** × stored {null, each of **D**, `"64"`} × **Sz** × **Th**. |
| INV-013 | Never do the words change: a column's description, or the capture status line's duration words. Never does a rhythm part reach the accessibility tree. | `baseline.json`'s `descriptions` hashes unedited. e2e: `cursor-duration` text equals `words` for each of **D**; the accessibility snapshot of a staff with rhythm equals the same staff's with no durations, except for the words already in each description. | **D** × **Surf** (capture for the status line). |
| INV-014 | Never does drawing rhythm need a fetched asset, or fail on a cold offline open. | `notation-offline.spec.ts`: a context with no network after one warm load. The notation is drawn, and `page.on("request")` sees no font, image or cross-origin request beyond the warm load's list. `public/sw.js` has zero diff. | {song page, play view, capture} × cold offline. |
| INV-015 | Never does a stored row, the sync, the schema, a wire format, the export or the parser change. | `npm run check:untouched-notation` (*Scope fence*). `npm run test:spec004` and the export and parser tests run unedited. | The paths in *Scope fence*. |
| INV-016 | Never is an earlier requirement left saying something untrue, or a test pin moved in silence. | `npm run check:notation-amendments`: each file in *Existing tests this changes on purpose* is named in `docs/DECISIONS.md`, and each FR-035 requirement carries `Amended by spec 009` on its own line with a note that says the change. `check:polish-amendments` and `check:usability-amendments` still pass. | Spec 005 FR-013, FR-014, FR-015, FR-016, SC-011; spec 003 FR-020, SC-009, FR-032; spec 007 FR-064; spec 008 FR-003. Every row of the table. |
| INV-017 | Never is a claim that a desktop cannot prove, or that needs a person, marked done. | `tasks.md` carries the browser pass (`quickstart.md` §6) and the two real-phone items (§7) as human tasks, `🛑 BLOCKED` until done. | §6 × **Sz** × **Th** × greyscale, and both §7 items. |
| INV-018 | Never does a duration move, resize, reorder, number or create a column. | e2e: column rects (x, width) and bar numbers on a part with durations equal the same part with every duration cleared, measured on the strings' rows only. `rhythm-marks.spec.ts` keeps its width-equality check. | **Surf** × **Dens** × **View**. |
| INV-019 | Never is a compact repeat beamed, and never do the columns after a repeat sit on different beats in compact and expanded. | Unit: **Corp** rows 15 and 16. `barPositions` takes no density, so both densities read the same map, and for each column after a repeat `positions.get(eventId:0)` is identical in both. e2e: the compact `7x8` cell has `data-flags` equal to its levels and `data-beams-*` 0. | {plain group with a repeat, a repeat outside any group, a counted group with a repeat} × **Dens** × {song, play}. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002, FR-003 | INV-007, INV-009, INV-010 |
| FR-004 | INV-002 |
| FR-005, FR-006 | INV-003, INV-002 (**Corp** rows 1–5, 19) |
| FR-007, FR-008 | INV-002 |
| FR-009 | INV-002 (rows 9–12) |
| FR-010, FR-011 | INV-019, INV-002 (rows 15–17), INV-004 |
| FR-012, FR-013, FR-014, FR-015 | INV-004, INV-011 |
| FR-016, FR-017 | INV-006, INV-007 |
| FR-018 | INV-005 |
| FR-019 | INV-001 |
| FR-020 | INV-005's figures, recorded; a jsdom check that `--rhythm-row` ≤ 2 × `--staff-row` on both pointers |
| FR-021, FR-022, FR-023, FR-025 | INV-002, INV-004 across **Surf** |
| FR-024 | INV-001 (paste) |
| FR-026 | INV-010 |
| FR-027 | INV-009 |
| FR-028, FR-029 | INV-012 |
| FR-030, FR-031 | INV-013 |
| FR-032, FR-033 | INV-015, INV-014 |
| FR-034 | INV-018 |
| FR-035, FR-037 | INV-016 |
| FR-036 | INV-002, INV-003, INV-004 (unit) |
| SC-001 | INV-001 |
| SC-002, SC-009 | INV-010, INV-017 |
| SC-003 | INV-005 |
| SC-004 | INV-006, INV-007 |
| SC-005 | INV-002, INV-004 |
| SC-006 | INV-015 |
| SC-007 | INV-012 |
| SC-008 | INV-014 |
| Edge: an unset column or unknown value among set ones | INV-002 (rows 8, 22) |
| Edge: a position that cannot be known | INV-002 (rows 8, 17, 18, 19) |
| Edge: a straddling note; a bar of fractional beats | INV-002 (rows 3, 4, 5) |
| Edge: repeats, expanded and compact | INV-019 |
| Edge: a group next to a barline; a rest in a counted group | INV-002 (row 14), INV-004 |
| Edge: connector and removal gaps; a chord-widened column | INV-006 |
| Edge: print wrapping a wide bar | INV-006 |
| Edge: the first duration set, the last one cleared | INV-011, INV-005 |
| Edge: themes and print | INV-010 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| The staff's beats and the click's ticks | `barPositions` calls `readBar`, the function `walk` calls. There is no second copy of the arithmetic. |
| A beam's two halves | `rhythmMarks` sets `right[i]` and `left[i+1]` from one `join(i, i+1)`. The unit test asserts equality over **Corp**. |
| A beam and its stem | Both are positioned from the same column box: the stem at 50%, and each half from an edge to 50%. Nothing is measured. |
| A gap's beam and its neighbours | `Gap` and `RemovalGap` draw the arriving column's `left` levels, which are the departing column's `right` levels. |
| The bracket above and the bracket under | One `tuplet` computation and one `groupLabels` call feed one element in either place. |
| Every row offset and the bracket's placement | One `bracketRow` value. `offsetFor`, the gutter, `Caret`, `EmptyStaff`, `Gap` and `RemovalGap` read it. |
| Whether rhythm is drawn, and the band's padding | The band's CSS reads `data-rhythm`, which `TabStaff` writes from its own `hasRhythm`. `useCaptureBand` reads the computed padding. |
| A button's symbol and the staff's flags | One glyph table, `src/components/rhythm/glyphs.ts`. |
| The status words, the descriptions and the button names | All read `Duration.words` from `DURATIONS`. None is retyped. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Data rewrite**: existing rows. | None. No migration, backfill or normalisation. An unknown stored value stays stored and draws nothing. | FR-033. | INV-015 |
| **Data read**: what decides a beat. | Only the staff's own `events` (the pass or slice it draws), through `readBar`. There is no time signature, bar length or cross-part read. | FR-005, FR-006. | INV-003 |
| **Deletion**: could drawing, or the new buttons, remove anything? | No. The buttons call the same `property.commit` with `nextDuration`. A tap on the lit button clears the duration, as today. | FR-029, FR-034. | INV-012, INV-018 |
| **Authority**: who sees the notation and the buttons. | Everyone who sees the staff or the inspector today. No role exists, and none is added. | | INV-001 |
| **Publishing**: what leaves the app. | Nothing new. The export keeps its text and its bracket row above. Sync messages are unchanged. | FR-032. | INV-015 |
| **Layout authority**: what may take height in capture. | The band's 4px `pt-1`, and only while the staff draws rhythm. No other row, token or surface gives height. | research R1; Deviation 1. | INV-005, INV-001 |
| **Earlier spec text**: what may be rewritten. | Only the requirements FR-035 names, amended in place with before and after wording. Spec 007 FR-030 is **not** amended. | FR-035. | INV-016 |
| **Existing tests**: what may be edited. | Only the files in *Existing tests this changes on purpose*. Each is re-pinned to an equal or stronger check, never deleted, and named in `docs/DECISIONS.md`. | FR-037. | INV-016 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-notation.sh`, run as `npm run check:untouched-notation`, prints `zero diff` for every path below against `main`,
tracked or untracked, and fails on any other result:

`src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`, `src/lib/model.ts`, `src/lib/tab/` (all of it, tests too),
`src/lib/export/`, `src/lib/reading/` (all of it, including `baseline.json` and `notation-baseline.json`), `src/lib/arrangement/`,
`src/lib/local/`, `src/lib/capture/latches.ts`, `src/lib/chords.ts`, `src/lib/rhythm/durations.ts`, `src/lib/rhythm/audio.ts`,
`src/lib/rhythm/scheduler.ts`, `src/lib/rhythm/stream.ts`, `src/lib/rhythm/tap.ts`, `src/lib/rhythm/tempo.ts`,
`src/lib/rhythm/__tests__/notation-baseline.test.ts`, `src/lib/rhythm/__tests__/notation-oracle.test.ts`,
`src/lib/rhythm/__tests__/notation.test.ts`, `src/components/app/PlayView.tsx`, `src/components/app/SongView.tsx`, `public/sw.js`,
`e2e/fixtures/capture-375-before.json`, `e2e/usability-height-budget.spec.ts`, `e2e/usability-wrap.spec.ts`, `e2e/polish-band-unchanged.spec.ts`.

It also checks that `src/lib/rhythm/notation.ts` changes by **addition only**, except for the `hit` callback's signature in `readBar` and
its two call sites.

### Existing tests this changes on purpose

Each file is re-pinned to read the notation (`data-duration`, `data-beams-*`, part rects), never deleted. Each is named in
`docs/DECISIONS.md` under "009 — re-pinned tests". No check is allowed to pass by skipping: a `textContent` guard that would now always be
empty is replaced, not left in place.

| File | What it pins today | Re-pinned to |
|---|---|---|
| `src/components/tab/__tests__/tab-staff-rhythm.test.tsx` | the marks' text `["8","","","q"]` | the same cells' `data-duration` (`"8"`, none, none, `"q"`). The no-duration case is unedited |
| `src/components/tab/__tests__/TabStaff.test.tsx` | "draws rhythm marks at 12px" | stems, beams and flags meet FR-027's sizes, and the numeral stays at 12px |
| `src/components/capture/__tests__/duration-row.test.tsx` | the lit button's text is the mark | the lit button's `data-duration`; empty text; `aria-label` and `title` are words |
| `e2e/rhythm-marks.spec.ts` | each mark's text and centre; six distinct texts | each cell's `data-duration`, its stem's centre and its contrast; 13 distinct greyscale crops |
| `e2e/rhythm-capture-height.spec.ts` | capture draws no `tab-rhythm`, and the staff's height is unchanged by a duration | capture draws the row; the height follows research R1's table; strings in view (INV-005) |
| `e2e/durations.spec.ts` | "never on capture"; first mark's text `"8"` | capture draws it; the first cell's `data-duration="8"` |
| `e2e/click-following.spec.ts` | each bar's mark texts | each bar's `data-duration` values |
| `e2e/click-running.spec.ts` | `tab-rhythm` 7th has text `""` | the 7th cell has no `data-duration` |
| `e2e/click-state.spec.ts` | first mark matches `/\S/` | the first cell has a `data-duration` |
| `e2e/rhythm-members.spec.ts` | the mark's text and its centre against the note | `data-duration`, and the stem's centre against the note |
| `e2e/rhythm-lit-and-nowhere-else.spec.ts` | the lit button found by its text | the lit button found by `data-duration`; the words unchanged |
| `e2e/durations-layout.spec.ts` | the buttons' texts are `w h q 8 16 32` | the buttons' `data-duration`s in that order, with empty text |
| `e2e/durations-row-every-column.spec.ts` | the same texts, for each column shape | the same, by `data-duration` |
| `e2e/polish-band-interactions.spec.ts` | INV-004 "an inspector write" sets a part's first duration (its `/dead|ghost|x/i` matches `sixteenth note`), which now adds the capture rhythm row and reflows every line by 4px | the same still, measured after the part already holds one duration (set on another column and settled before `before`), so it checks an ordinary inspector write. A part's first duration reflowing once is the same exception as its first bracket (spec 008's own comment on that test), recorded in DECISIONS |
| `e2e/usability-neck.spec.ts` | rhythm marks among the ≥ 12px texts | numerals and bar numbers ≥ 12px; rhythm parts by FR-027's sizes |
| `e2e/usability-contrast.spec.ts` | the marks' font size ≥ 12; the numeral above its line | the numeral ≥ 12 and clear of its line in either placement; rhythm parts' contrast |
| `e2e/usability-surfaces.spec.ts` | the "rhythm mark" is drawn in JetBrains Mono | the rhythm cell draws no text; the numeral stays in JetBrains Mono |
| `e2e/usability-staff.spec.ts` | the mark's text centre within 1px of the column | the stem's centre within 1px of the column's centre |
| `e2e/usability-staves.spec.ts` | the mark's text centre against the note (skipped when empty) | the stem's centre against the note, never skipped on a cell with `data-rhythm="note"` |

**Must pass unedited**: `src/lib/reading/__tests__/frets-unchanged.test.ts` (with `baseline.json`), every `src/lib/rhythm/__tests__/` file
except the two new ones, `src/lib/tab/__tests__/*`, `src/lib/export/__tests__/*`, `src/lib/reading/__tests__/spec004-holds.test.ts`,
`e2e/usability-height-budget.spec.ts`, `e2e/usability-wrap.spec.ts`, `e2e/polish-band*.spec.ts`, `e2e/grouping-*.spec.ts`,
`e2e/reading-layout.spec.ts`, `e2e/click-bar-at-size.spec.ts`, `e2e/rhythm-unknown-values.spec.ts`, `e2e/durations-row-tall-sheets.spec.ts`,
and `e2e/import-*.spec.ts`. If one of these fails, the product is wrong, not the test. The exception is a test that pins a staff *with
durations* through a path the spec changes; then it is added to the table above with its reason before it is edited.

## Project Structure

### Documentation (this feature)

```text
specs/009-rhythm-notation/
├── plan.md                  # This file
├── research.md              # Phase 0: R1–R11
├── data-model.md            # Phase 1: derived entities (nothing stored)
├── quickstart.md            # Phase 1: validation guide
├── contracts/
│   ├── beaming.md           # barPositions, rhythmMarks, groupLabels; the FR-036 corpus
│   ├── rhythm-row.md        # TabStaff's rhythm cell, brackets under the tab, tokens, band CSS
│   └── duration-buttons.md  # the inspector's six symbols
├── research-probes/
│   ├── split-groups.test.ts         # R6 (0 of 3,394)
│   └── vitest.probe.config.ts       # runs the probes outside `src/`
├── checklists/              # from /speckit-specify
└── tasks.md                 # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── rhythm/
│   │   ├── notation.ts            # + barPositions(events); readBar's hit gains `counted`
│   │   ├── beams.ts               # NEW: rhythmMarks, groupLabels (pure)
│   │   └── __tests__/
│   │       ├── positions.test.ts  # NEW: INV-003, the FR-006/FR-008 rows
│   │       └── beams.test.ts      # NEW: the FR-036 corpus, L1–L4, right[i] === left[i+1]
│   └── capture/
│       └── properties.ts          # ColumnSegment.symbol; duration segments set it
├── components/
│   ├── tab/
│   │   ├── TabStaff.tsx           # bracketRow; data-rhythm; RhythmCell in Column, Gap and RemovalGap; groupLabels
│   │   ├── RhythmCell.tsx         # NEW: stem, beams, stubs, flags, rest, oval, bracket under the tab
│   │   └── __tests__/             # tab-staff-rhythm, TabStaff re-pinned (table above)
│   ├── rhythm/
│   │   ├── glyphs.ts              # NEW: SVG path data for flags, rests, oval, noteheads
│   │   └── NoteSymbol.tsx         # NEW: the six button symbols
│   ├── capture/
│   │   ├── ColumnInspector.tsx    # SegmentRow draws NoteSymbol and a title
│   │   └── CaptureScreen.tsx      # passes showRhythm
│   └── app/
│       └── PasteTab.tsx           # passes showRhythm
└── app/
    └── globals.css                # --rhythm-* tokens (touch and fine); .tab-rhythm parts; band padding rule

e2e/
├── notation-symbols.spec.ts       # INV-009, INV-010
├── notation-beams.spec.ts         # INV-002, INV-006
├── notation-alignment.spec.ts     # INV-007, INV-018
├── notation-brackets.spec.ts      # INV-004
├── notation-capture-height.spec.ts# INV-005, INV-008
├── notation-capture.spec.ts       # INV-011, INV-013
├── notation-buttons.spec.ts       # INV-012
├── notation-offline.spec.ts       # INV-014
├── notation-paste.spec.ts         # INV-001 (paste)
└── fixtures/paste-preview-before.json  # recorded on main before any edit

scripts/
├── untouched-by-notation.sh       # INV-015 (npm run check:untouched-notation)
└── check-notation-amendments.sh   # INV-016 (npm run check:notation-amendments)

docs/DECISIONS.md                  # 009 sections: height figures, re-pinned tests, amendments, browser pass
specs/003-…/spec.md, specs/005-…/spec.md, specs/007-…/spec.md, specs/008-…/spec.md   # in-place amendments (FR-035)
```

**Structure Decision**: a single Next.js package, as in entries 1 to 8. The rules live in `src/lib/rhythm/`, beside the reader whose
arithmetic they call. The drawing lives in `src/components/tab/`, beside the staff. The shared glyphs live in `src/components/rhythm/`,
beside the other rhythm UI.

### Order of work

1. `quickstart.md` §1: measure on the unedited build, and record `e2e/fixtures/paste-preview-before.json`.
2. `barPositions` and its tests (INV-003), then `rhythmMarks` and `groupLabels` and their tests (INV-002, INV-019).
3. Tokens and `RhythmCell`, then `TabStaff`'s `bracketRow`, cells, gaps and labels. Keep `frets-unchanged` green at every step (INV-001).
4. Capture and paste pass `showRhythm`. Then the band padding rule and the height spec (INV-005, INV-008).
5. `NoteSymbol` and the buttons (INV-012).
6. Re-pin the tests in the table, then write the new e2e specs, the guard scripts, the amendments and the `docs/DECISIONS.md` entries.
7. The person-level pass and the real-phone items (human).

## Complexity Tracking

No gate is violated, so there is nothing to justify.
