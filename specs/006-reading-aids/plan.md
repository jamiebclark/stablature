# Implementation Plan: Note names, intervals, and seeing what a variant changed

**Branch**: `006-reading-aids` | **Date**: 2026-11-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-reading-aids/spec.md`

## Summary

Two read-side features on the staff the app already has: a three-way view (frets, notes, intervals) on
the song page and play view, and marks showing what a variant changed against its declared parent.
Nothing synced changes. Each rule has one owner, so two things cannot drift apart:

- **One loop draws every staff.** `layoutPart` and a new `layoutReading` both run one builder with a
  different cell writer. `layoutPart` keeps its signature, so the export has no route to a label.
- **One order of decorations.** `decorate` takes a separator. It stays the only owner of the wrap order.
- **One reading of the chord in force.** `chordInForceAt` becomes a lookup in a new one-pass
  `chordsInForce`, so the staff and the fretboard cannot disagree.
- **One read of a song's content.** Parts, events and chords arrive from one transaction, so a comparison
  can never see a part without its columns, or columns without their chords.
- **One object for the marks and the line.** `staffMarks` returns both from the same list of operations,
  over the columns actually drawn.

The comparison is a unit-cost edit distance, not a longest-common-subsequence diff. An LCS reports 8
differing columns where 5 changes is the true minimum, so it cannot meet SC-008 once FR-024 counts a
change as one (research R7). The search is a bounded furthest-reaching walk, stopped by a count of
edits and never a clock, so the same two parts always give the same answer.

The risky claims were run before this was written: the search matched a plain DP table on 200,000
random pairs, SC-009 measured about 7 ms against 20, SC-010 about 2.4 ms against 50, and a read
transaction inside a live query gave one consistent result per write. Those figures are from Node. No
layout claim here has been seen in a browser. See [research.md](./research.md).

No migration, no new dependency, no new route, no change to `public/sw.js`, and no change to any byte
of the export.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`. **No new
dependency.** No Next.js API is involved beyond existing Client Components (research R19).

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **No change.** One
new `localStorage` key, `stablature.staffView`, on the device only.

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock, `fake-indexeddb` for reads.
Playwright 1.64 (`npm run test:e2e`) against a production build, projects `mobile` (Pixel 7) and
`desktop`. A person-level browser pass at actual size in both themes after merge.

**Target Platform**: Installable PWA in a mobile browser, offline-capable. The smallest supported
viewport is 375×667.

**Project Type**: Next.js web application, single package. Song page and play view are `"use client"`.

**Performance Goals**: `compareVariants` on 20 variants of 1,000 played columns in under 20 ms on a
desktop (SC-009). Two unrelated parts of 5,000 in under 50 ms (SC-010). Both on every data change, with
no reliance on caching.

**Constraints**:
- `src/lib/tab/ascii.ts` has **zero diff**, and `src/lib/export/text.ts` a comment-only diff.
- `layoutPart`'s signature and `TabColumn`'s shape do not change.
- A visual tier is never opacity over a surface. Name the colour per theme, and repaint the cell masks.
- `text-text-faint` fails 4.5:1, so nothing here uses it.
- `round-trip.test.ts` fails on any unlisted `*.test.ts` in `src/lib/tab/__tests__/`, so new tests go in
  `src/lib/reading/__tests__/`.
- `single-owner.test.ts` forbids `TabStaff.tsx` and `ascii.ts` importing techniques or reading
  `.techniques`.
- `tsconfig.json` includes `specs/` and test files, so review probes must pass `npm run typecheck`.
- `npm run dev:clean` before debugging a style that appears to do nothing. Never run the build or e2e
  suite while a dev server holds the same `.next`.
- Edits keep each file's line endings. `TabStaff.tsx` and `SongView.tsx` are **CRLF**. `PlayView.tsx`,
  `layout.ts`, `chords.ts`, `techniques.ts`, `hooks.ts`, `queries.ts`, `text.ts` and `globals.css` are LF.

**Scale/Scope**: 10 new source files (about 735 LOC: `compare.ts` ~130, `marks.ts` ~120, `align.ts`
~110, `labels.ts` ~110, `played.ts` ~80, `view.ts` ~60, `spelling.ts` ~60, `ViewControl.tsx` ~45,
`VariantLine.tsx` ~10, `useStaffView.ts` ~10). 10 modified source files, most by a few lines. No
existing test should need editing.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified
constitution to gate against. As in the previous entries, the gates below are the project's de facto
rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers. See *Open for the human*.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed after merge) | INV-038, `quickstart.md` §8. The pipeline has no browser, so nothing is claimed until a person has looked. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | Tokens were chosen by computed contrast. INV-032 measures them on the real surface, and §8 is at actual size. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` | PASS | `--diff-tint` and `--diff-ink` are named per theme, and the masks are repainted. |
| **A distinction never rests on hue.** | `docs/DECISIONS.md`, the chord-tone defect | PASS | Glyph first, weight second, tint third. INV-032. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts`, `TabStaff.tsx` headers | PASS | Both entry points run one builder. The two comments that overclaim are corrected, as the spec asks. |
| **Barlines are stored, never inferred.** | `layout.ts` header | PASS | Nothing here creates or moves a barline. |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | Everything under `src/lib/reading/` is React-free. Components render it. |
| **Only `layout.ts` and named readers touch technique drawing.** | `techniques.ts` header, `single-owner.test.ts` | PASS | `decorate` stays called from the layout. `compare.ts` reads the word tables, and the header is amended to name it. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | No synced write exists in this entry. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | Neither changes. |
| **Tests must be able to fail for the right reason.** | Entry 4 and 5 reviews | PASS | Each oracle shares no code with the rule, and no sweep is filtered by the rule's own test (research R17). |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | No dependency, and `ui/index.tsx` has zero diff. `Card` already takes `className`. |
| **Offline first.** | `public/sw.js` header | PASS | No fetch, no route, worker untouched. |

**Post-design re-check (after Phase 1)**: PASS. The design adds no stored shape, and every place where
two things must agree is closed by one calling the other, or is listed as pinned. See *Agreement is
structural*.

## Invariants — what must never happen *(mandatory)*

Cells and comparisons are probed through `layoutReading`, `compareVariants` and `staffMarks`, drawing
through `renderToStaticMarkup(TabStaff)` in jsdom, and screens through `e2e`, with hooks from
[contracts/components.md](./contracts/components.md).

Named sets:

- **V**, the views: frets, notes, intervals.
- **N**, the views that label: notes, intervals.
- **Den**, densities: expanded, compact.
- **H**, the harvest: every recorded `layoutPart` fixture, recorded as `harvest.test.ts` does.
- **T**, tunings: all 17 of `TUNING_PRESETS`; a custom tuning with a `F#` string beside a `Bb` string.
- **R**, chord roots: C, C#, Db, D, D#, Eb, E, F, F#, Gb, G, G#, Ab, A, A#, Bb, B, Cb.
- **Q**, chords: every key of `CHORD_QUALITIES` × **R**; each of `add2`, `add4`, `add6`, `add9`, `add11`,
  `add13`, `b5`, `#5`, `b9`, `#9`, `#11`, `b13`, `no3`, `omit3`, `no5`, `omit5` on `C7` and `Am`; slash
  chords `C/G`, `C/F#`, `C/Bb`, `Cm/Eb`, `Cm/D#`, `Am/G`.
- **Dec**, decoration sets: all 64 subsets of vibrato, harmonic, let ring, bend, tap, palm mute.
- **Unread**, chord text that reads as nothing: `N.C.`, `Bridge`, `C(x)`, `""`, `"   "`.
- **F**, compared fields, one edit each: kind notes to rest; fret value; fret to dead; fret added on a
  string; fret removed from a string; technique added; technique removed; duration set; duration
  changed; duration cleared; joined a group; left a group; group kind; group number; chord added; chord
  changed; chord removed.
- **NotF**, what must not count: every event id; every group id; every annotation id; annotation row
  order; part name; part notes; part label; event rank values; a text annotation; a dynamic annotation;
  technique order; a duplicate technique; an empty technique list; a technique on an unplayed string; a
  fret on a string the tuning lacks; chord with surrounding spaces; `7x8` against `7x4 7x4`; legacy null
  kind and null count against a modern 3.
- **Surf**, reading surfaces: song page expanded; song page compact; play view whole; play view sliced.
- **Rows**, what sits on a column: chord row; carried chord; bracket start, middle, end, label;
  connector; barline; rhythm mark; diff mark; removal gap; caret (jsdom only, since no screen has both).
- **Par**, parent states: none declared; live, same song; deleted; in another song; itself; a variant
  itself; an id with no row.
- **Load**, load orders: parts first; events first; annotations first; a `createVariant` batch; a paste;
  a sync batch.
- **St**, storage states: normal; `localStorage` undefined; `getItem` throws; `setItem` throws; stored
  `"tabs"`; stored `""`; stored `"NOTES"`; changed in a second tab.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a staff in frets draw differently from today. | `renderToStaticMarkup(TabStaff)` against a baseline recorded from unedited code before the first change, and `layoutPart` output deep-equal to the same baseline. | **H** × **Den** × {base, raised surface} × {`showRhythm` on, off} × {`reading` absent, frets with no marks}. |
| INV-002 | Never does the export change, or carry a label or a mark. | `songToText` and `toAscii` against the baseline. e2e: Copy text and Download in each view, on a song with a marked variant, compared with each other. `ascii.ts` and `text.ts` import nothing from `src/lib/reading/`. | **H** × **Den** × **V**; a variant with `*`, `+` and `−`; the paste reader over each exported text, which reads back the stored frets. |
| INV-003 | Never does the view reach a table, the queue or the network. | e2e: dump every Dexie table and `meta`, count the outbox, and watch requests, before and after 100 changes. Two contexts with Postgres: the second device's view is unaffected. | 100 changes across **V** on the song page; the same on the play view; a reload between; signed in, signed out. |
| INV-004 | Never does a staff outside the song page and the play view follow the view. | e2e: store each view, open the screen, read every cell against the frets. | **N** × {capture, capture with a selection, paste preview, paste preview after an import refusal}. |
| INV-005 | Never does a fret number flash in a remembered view, or the page report a hydration mismatch. | e2e: `addInitScript` installs a `MutationObserver` recording every `tab-column` text from the first node. Console read for hydration errors. | **N** × {song page, play view} × {reload, direct open, in-app link from the band page, in-app link between the two, offline after a visit}. |
| INV-006 | Never does storage trouble throw, stick, or read as anything but a valid view. | `view.ts` with injected storage, then e2e with `localStorage` stubbed in `addInitScript`. | **St**, each × {read, set, then read again}. A second tab's change reaches the first. |
| INV-007 | Never does the control mislead, overflow, print, or appear with nothing to act on. | e2e at 375×667: `aria-pressed`, computed `text-decoration-line` and `font-weight` per button, `scrollWidth` against the width set, print emulation. | **V** × {song page, play view} × 2 themes; no tuning; no arrangement on the play view; export, BPM and density all beside it. |
| INV-008 | Never does a cell name a pitch other than the stored note's. | `layoutReading` read through the test's own cell reader, against a hand table of semitones per open string. | **T** × every string × every fret 0 to 36 × {no chord, Am, Bb7}. No octave digit in any name. |
| INV-009 | Never is a chord tone misspelt or misnamed, and never does the sharp-or-flat rule go the wrong way. | `layoutReading` on one column per pitch class, against literal tables for the worked cases, and `tone.name` and `tone.degree` for the rest. | **Q** × all 12 pitch classes × **N**. Worked: `Eb` under Cm, `Bbb` under Cdim7, `A#` under Dm, typed bass in every slash chord in **Q**. No chord: **T**, including `Eb` on C Standard. All 12 rows of the folded table. |
| INV-010 | Never can a cell be read as another note, degree or chord, and never does a mark or separator fall back to another font. | The test's reader recovers the pitch class from text alone. `parseChord(cell)` is null for every cell with a letter decoration. e2e: `document.fonts.check` for `·` and `−` in the mono face. | **Dec** × every name from **Q** and the sharp and flat names × every degree in `DEGREES` × **Den** with repeats 1, 2 and 8. |
| INV-011 | Never does a harmonic show a pitch, a dead note show anything but `x`, or either stop the cells around it. | `layoutReading` cells and description. | **N** × {harmonic, harmonic with each other decoration, dead, dead with harmonic, dead with palm mute} × a named neighbour either side × a chord stacked with them. Fret `-1`, `1.5`, `"7"` shows `?` and does not throw. |
| INV-012 | Never does the staff read a different chord from the fretboard. | For each column, the chord behind the cell against `chordInForceAt` called from the test on the whole part. | **H** with chords laid on in turn; **Unread**, each ending the chord before; a deleted anchor; two annotations on one anchor; a chord on a repeat; across a barline; across a repeat; a slice starting after, on and before the anchor. |
| INV-013 | Never does an interval cell fall back to a fret number. | `layoutReading` cells over parts where the fret and the note differ, with no digit-only cell where no chord is readable. | No chord at all; before the first chord; after each of **Unread**; a part with only text annotations. |
| INV-014 | Never is the carried chord missing, wrong, truncated, or shown where it should not be. | `layoutReading.carriedChord`. e2e: the label's `scrollWidth <= clientWidth`, and its text. | Slice starts: under Am, on the anchor, before any chord, under `N.C.`, under a blank chord. × **V**, present only in intervals. First column: a one-digit note, a barline, a space. Next column holding its own chord. |
| INV-015 | Never is a label or a comparison drawn from a partial read. | jsdom over `fake-indexeddb` with a recording of every committed render, and e2e with a `MutationObserver` on `variant-line` and `tab-diff`. | **Load** × {song page, play view} × **N**. A just-made variant never shows anything but `Same as A`. A pull lands in one `rw` transaction (`applyRemoteRows`), and a read is one `r` transaction (`listSongContent`), so no read sees half a pull. Nothing on the read path knows sync exists, so a slow or dead pull holds no page. |
| INV-016 | Never does anything on a column sit more than 1 px from it. | e2e: `getBoundingClientRect` of each item against its column. jsdom for the caret. | **Rows** × **V** × **Den** × {375×667, desktop} × 2 themes, on a part with two-digit frets and the widest cell. |
| INV-017 | Never does a view change alter a staff's or card's height, or leave a staff not saying what it shows. | e2e: both heights in each view. Caption text from the table. The caption sits inside the card and overlaps neither the staff nor the line. | **V** × **Surf** × {375×667, desktop}; a long part name; `chordCover` all, some, none, nothing; with a variant line. The exception is **Rows**' carried chord, under FR-012. |
| INV-018 | Never does a screen reader lose the string and fret, hear an affix character, or hear a change in frets. | Exact strings from `layoutReading` and `layoutPart` descriptions. | Every row of the table in [contracts/cells.md](./contracts/cells.md); **Dec** × **N**, with no `<>()~·` in any description; **H** in frets, byte-equal to the baseline. |
| INV-019 | Never does an id change a result. | `compareVariants` before and after regenerating ids. | **H** × {every event id, every group id, every annotation id, all of them} × a variant with one of each op. Variants built by `createVariant` and by `copyColumns` plus `rowsFromClipboard` over the same parent, through `fake-indexeddb`, give the same result. |
| INV-020 | Never is a column called the same when a compared field differs, or different when none does, and never do the unrolling and the layout disagree. | `compareVariants` on a one-edit pair. `playedColumns` against `layoutPart` expanded: keys, order and bar. | **F**, each giving exactly 1 changed. **NotF**, each giving Same. Keys and bars over **H**. |
| INV-021 | Never does one edit report anything but itself. | `compareVariants` and `staffMarks.line`. | The six worked examples and the exact cases in [contracts/compare.md](./contracts/compare.md). **H** × every position × {insert one, remove one, alter by each of **F**}, including every group edge and barline. Each × ids regenerated (SC-007). |
| INV-022 | Never is the difference count above the true minimum. | Added plus removed plus changed against a plain DP table in the test. | 5,000 seeded pairs up to 12 columns, alphabets of 2 to 6, barlines mixed in; `a b c d e` against `e f g h i`. |
| INV-023 | Never is a barline paired with a note, a run paired out of order, or a result different on a second run. | The ops list. Run twice, and with `Object.keys` order and row order of annotations shuffled. | Every pair from the 5,000 of INV-022. Runs with a barline at each position on each side. `5 7 8 \| 5 7 9 10`. A riff repeated, with one column inserted at each equally valid position: count 1, and the same position each time. |
| INV-024 | Never does a report lose a column. | Applying `ops` to the parent's columns reproduces the variant's signatures, and each op's `from` and `to` cover both parts once, in order. | **H** × the edits of INV-021; the pairs of INV-022; `coarse` results; both parts empty; one empty. |
| INV-025 | Never does a comparison miss its budget, or depend on the clock. | Best of five on `compareVariants` and `alignColumns`. Comparing at exactly `MAX_EDITS` and one past it, with the second `coarse` and still passing INV-024. `performance` and `Date` are absent from `align.ts` and `compare.ts`. | SC-009's song; SC-010's pair; two periodic riffs of 5,000; two parts sharing an alphabet; 20 unrelated variants of 1,000; a `x512` repeat in each of 200 events. |
| INV-026 | Never is a part compared unless it declares another live part of this song, and never with anything else. | `compareVariants` keys. e2e: no marks and no line. | **Par** × {song page, play view}; a chain, where C compares with B only. Last-pass substitute: a non-variant; a variant of the entry's part; a variant of another part. A variant used directly as an entry's part. |
| INV-027 | Never do the marks and the line disagree. | Count `tab-diff` and `tab-removal` totals, and the bars they sit in, against the line's numbers, on the page. | **Surf** × a variant with one of each op; only additions; only removals; none. Compact compares against expanded's counts. |
| INV-028 | Never does density or view change what is marked or counted. | `staffMarks` and e2e. In compact, a column is marked if any repetition is: `+` when all are added, `*` otherwise. | **V** × **Den** × {all repetitions added, one of 8 changed, some added and some same, a removal inside a repeat, two removals landing in one gap}. |
| INV-029 | Never does a slice lose a mark inside it, show one outside it, or count what it cannot draw. | `staffMarks` over `drawnPasses` output, then e2e. | Slice edges {first bar, middle, last bar, one bar, a range past the end} × a change, an addition and a removal at the first column, the last column, just before the closing barline, just after it, and at the very end. An added barline closing the slice. A slice with no differences while the variant has some. Removals over slices covering the part sum to the whole. Bars named are the part's own. |
| INV-030 | Never is the parent's staff marked, or a pass drawing anything else. | e2e: no `tab-diff`, `tab-removal` or `variant-line`. | Parent on the song page; `A x4`, passes 1 to 3; a text entry between; a part with no parent; an unrelated last-pass substitute. Pass 4 equals the song page's marks. |
| INV-031 | Never do marks go stale. | e2e: write through Dexie with the page open. | Edit the parent; edit the variant; add a chord to either; delete the parent; delete a column; from this tab, from another tab, from a sync pull. |
| INV-032 | Never does a mark depend on colour, or fall under 4.5:1. | e2e: `*`, `+` and `−` are different text. Computed contrast of each mark and line on its real surface, with no `opacity` below 1 on an ancestor. Computed `font-weight` of a marked cell above an unmarked one, and the mask's computed background equal to the tint. | Each mark × 2 themes × {raised, base}; the line × 2 themes; a marked cell with a chord, bracket and rhythm mark. |
| INV-033 | Never is anything in the marks or the line interactive. | e2e: no `a`, `button`, `[tabindex]` or `[role=button]` within them, the column stays `role="img"`, and tapping changes neither the URL nor Dexie. | **Surf** × `tab-diff`, `tab-removal`, `variant-line`. |
| INV-034 | Never do marks, lines or captions drop out of print. | e2e with `page.emulateMedia({ media: "print" })`, each visible, and backgrounds ignored: contrast computed against white. | Dark and light schemes × play view × each mark, the line, each caption. `--diff-tint` and `--diff-ink` resolve to the print values in dark. |
| INV-035 | Never does a screen reader miss a mark, or get it wrong. | Exact `aria-label` strings. | Every row of the words table in [contracts/compare.md](./contracts/compare.md) × each of **F**; a removal of 1 and of 2; compact with repetitions marked. |
| INV-036 | Never does a mark move a column, share a row, or add a row to an unmarked staff. | e2e: column `x` and width with and without the mark row, with the gap's own width as the only shift. No `tab-diff` when Same. Markup for a Same variant equals the same staff with no comparison. | A column with a chord, a bracket and a rhythm mark; a removal inside a bracket, whose line stays continuous; a removal before a connector; **Den**; **N**. |
| INV-037 | Never does this entry touch storage, the wire, the codec or the capture path. | `scripts/untouched-by-reading.sh`: `git diff main` prints nothing over named paths, and `text.ts`'s diff touches only its header comment. `npm run typecheck`. | `src/lib/tab/ascii.ts`, `src/lib/tab/parse.ts`, `src/lib/tab/reading.ts`, `src/lib/sync/` apart from `client.ts`, whose diff is confined to `applyRemoteRows`, `src/lib/server/`, `src/app/` apart from `src/app/globals.css`, `src/db/`, `drizzle/`, `src/lib/model.ts`, `src/lib/local/db.ts`, `src/lib/local/mutate.ts`, `src/lib/local/editing.ts`, `src/lib/local/clipboard.ts`, `src/lib/local/importing.ts`, `src/lib/arrangement/`, `src/components/capture/`, `src/components/app/PasteTab.tsx`, `src/components/app/ExportSong.tsx`, `src/components/rhythm/`, `src/components/ui/index.tsx`, `public/sw.js`, `src/lib/tab/__tests__/`, `src/lib/export/__tests__/`. |
| INV-038 | Never is anything here illegible at actual size. | **Person-level pass** (`quickstart.md` §8). INV-016, 017, 032 and 034 are the automated half. | Each row of that table × 2 themes. Owed after merge, and is the spec's *Owed to a browser pass*. Tasks for it are `🛑 BLOCKED` and are never ticked to pass a gate. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001 | INV-007 |
| FR-002 | INV-001 |
| FR-003 | INV-003, INV-006 |
| FR-004 | INV-004 |
| FR-005 | INV-005 |
| FR-006 | INV-008, INV-009 |
| FR-007 | INV-009, INV-013 |
| FR-008 | INV-010 |
| FR-009 | INV-011 |
| FR-010 | INV-010, INV-016 |
| FR-011 | INV-012 |
| FR-012 | INV-014 |
| FR-013, FR-014 | INV-016 |
| FR-015, FR-016, FR-017 | INV-017 |
| FR-018 | INV-018 |
| FR-019 | INV-002 |
| FR-020 | INV-007, and `export-note` in INV-002's e2e |
| FR-021 | INV-026 |
| FR-022 | INV-019, INV-020 |
| FR-023 | INV-021, INV-022 |
| FR-024 | INV-023 |
| FR-025 | INV-025 |
| FR-026 | INV-015 |
| FR-027 | INV-030, INV-036 |
| FR-028 | INV-029, INV-030 |
| FR-029 | INV-027, INV-029 |
| FR-030 | INV-028 |
| FR-031 | INV-032 |
| FR-032 | INV-035 |
| FR-033 | INV-033 |
| Edge cases: staff view | INV-006, INV-007, INV-008 |
| Edge cases: cells | INV-011, INV-012, INV-015, INV-016 |
| Edge cases: comparison | INV-021, INV-023, INV-024, INV-026, INV-029 |
| Story 3, scenario 9: live update | INV-031 |
| SC-001 | INV-005, INV-007 |
| SC-002 | INV-001, INV-002 |
| SC-003 | INV-003 |
| SC-004 | INV-008, INV-009 |
| SC-005 | INV-010 |
| SC-006 | INV-016, INV-017 |
| SC-007 | INV-019, INV-021 |
| SC-008 | INV-022 |
| SC-009, SC-010 | INV-025 |
| SC-011 | INV-024 |
| SC-012 | INV-032, INV-038 |
| SC-013 | INV-034, INV-038 |
| SC-014 | INV-007, INV-038 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| A label's width and position, and a fret's | `layoutPart` and `layoutReading` both call `layoutWith`. |
| The order of decorations in every view | One `decorate`, with a separator argument. |
| The export and the absence of labels | `layoutPart` has no view option, and `toAscii` calls only it. |
| The staff's chord and the fretboard's | `chordInForceAt` is a lookup in `chordsInForce`, which the staff calls. |
| Where a chord sits, for the chord row, the chord in force and the comparison | All call `anchoredChords`. |
| What the caption says and what the cells show | The caption reads `chordCover`, which the writer counts while writing the cells. |
| The marks and the line | One `staffMarks` result. |
| What is drawn and what is counted on a pass | `staffMarks` takes `pass.events`, the same array `TabStaff` draws. |
| The song page's marks and pass 4's | Both go through `compareVariants` and `staffMarks`. |
| A comparison's parts, columns and chords | One `listSongContent` transaction. |
| A pull's parts, columns and chords | `applyRemoteRows` validates every table, then writes them in one `rw` transaction, so the `r` transaction above sees all of a pull or none (INV-015). |
| The group number on the page and in a signature | Both call `groupNumber`. |
| A column's key on the staff and in the marks | The same `eventId-repetition`. **Pinned, not structural**, by INV-020, because extracting it is not worth touching the render loop. |
| The unrolling in `playedColumns` and in `layoutPart` | **Pinned, not structural**, by INV-020. Making `layoutPart` call it would mean reworking a loop that carries connectors, for one `Math.max`. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Authority**: who can see or use these features. | Everyone who can read the song. No role check. | Read-only, and the view is per device. | INV-037 |
| **Authority**: one reader changing what another sees. | Impossible. The view is on the device, and marks follow the stored parent link. | FR-003. | INV-003 |
| **Authority**: choosing what a variant is compared with. | Nobody can. Only the declared parent, with no parameter or control. | FR-021. | INV-026 |
| **Authority**: changing a part from a comparison. | Not possible. Nothing in the marks or line is interactive. | FR-033, Out of Scope. | INV-033 |
| **Deletion**: what this entry removes. | Nothing. No row is removed, tombstoned or rewritten. | | INV-037 |
| **Deletion**: a parent deleted while its variant lives. | The comparison goes away on the next read. The variant, and its stored link, are untouched. | Edge case. An undelete brings the marks back. | INV-026, INV-031 |
| **Data rewrite**: an unknown stored view. | Read as frets, and left in place until the reader chooses. | A later version's value should survive an older build. | INV-006 |
| **Data rewrite**: existing rows. | None. No migration, backfill or normalising. | Spec, Out of Scope. | INV-037 |
| **Publishing**: what leaves the app. | The export stays fret numbers, in every view. | Spec decision 1: `5 b3 1` would read back as frets with a bend, a silent wrong note. | INV-002 |
| **Money** | None involved. | | |

### Deviations and corrections, all cheap to overturn

Spec text is not edited here. Each item says how this plan reads it.

1. **"Fewest columns that differ" is read as edit distance, with a change counted as one.** Research R7.
   FR-023 and SC-008 do not name a cost. An LCS is what most diffs use, and it fails SC-008 under
   FR-024's counting.
2. **Whether a column continues a group is compared only between aligned neighbours.** Research R10.
   The spec lists it as a field of the column, and taken literally that fails SC-007 and FR-023 at every
   group edge. **To overturn**: put `joined` in the signature, and scope SC-007 away from group edges.
3. **A removal on a slice belongs to the bar it falls in.** The spec says the pass holding the column
   that follows. If that column is the slice's closing barline, `eventsInBars` drops it, and the removal
   would appear on no pass at all.
4. **A column carrying `(Am)` may be wider than its widest cell**, bending FR-013, because the chord row
   truncates and `(A…` defeats FR-012. Research R14.
5. **An unreadable chord is carried too.** `(N.C.)` over the first column of a slice says why its cells
   are note names. FR-012 says "that chord", and this reads it literally. A blank one is not carried.
6. **A dead note with a harmonic draws `<x>`.** FR-009 gives each rule alone. `x` wins, because a dead
   note has no pitch to hide.
7. **A classic desktop scrollbar can still add its own height.** When notes push a staff past its card's
   width, a browser with non-overlay scrollbars gives the horizontal scrollbar height of its own,
   typically about 15 px, which FR-015 and SC-006 do not allow for. `scrollbar-gutter` reserves room on
   the inline edges only, so it cannot help a horizontal bar. Hiding the bar would change frets, against
   FR-002. Playwright hides scrollbars, so INV-017 cannot see this, and it is in `quickstart.md` §8.
   **To overturn**: `scrollbar-width: none` on every staff, and amend FR-002.
8. **The caption sits in the card's bottom padding.** Research R13. It is the one place FR-015 and FR-016
   both allow, and the call most worth seeing at actual size.
9. **A slash bass that is also a chord tone keeps its typed spelling**, so `Cm/D#` reads `D#`, not `Eb`.
   The spec's two rules collide, and the bass rule is the narrower. Its degree stays the chord's.
10. **A chord anchored on a barline is in force but not compared.** `chordInForceAt` honours it and the
    layout never draws it. Barline signatures are the kind alone, because the spec compares what the
    staff draws.
11. **`SongView` waits for parts, columns and chords together**, in frets too. One read takes the place of
    three, and the staff that results is the same. FR-002 is read as being about what is drawn. The play
    view keeps drawing empty staves first in frets, as today.
12. **Unknown durations compare as stored**, so `"64"` differs from null though neither draws. The spec
    says "the same stored value". Marking a column with no visible change is the cost.
13. **`check:untouched` and `check:untouched-rhythm` will fail on this branch.** They are the guards of
    specs 004 and 005, they name files this entry changes on purpose, and neither is in CI. This entry
    adds `check:untouched-reading` beside them and leaves both alone.
14. **`src/lib/sync/client.ts` takes one change, to `applyRemoteRows`.** A pull is validated for every table and then written in one transaction over the tables it touches, instead of one transaction per table. No stored shape, wire message or row changes, so no blast-radius decision reverses. The earlier read-side hold (`settled`, `stuck`, `STUCK_SYNC_MS`, `SongContent.syncing`) is removed: it made a staff wait on the network (review F18). A variant split across two pull pages or two pushes can still arrive in pieces (FU13).

### Existing tests this changes on purpose

None. If implement trips any pin, it reports it and does not quietly change it. The likely candidates to
read first are `src/components/tab/__tests__/TabStaff.test.tsx`, `src/lib/__tests__/chords.test.ts` and
`src/lib/tab/__tests__/single-owner.test.ts`.

## Project Structure

### Documentation (this feature)

```text
specs/006-reading-aids/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── cells.md         #   the view store, spelling, cell text, layout entry points, spoken words
│   ├── compare.md       #   when, the ops, exact cases, words, staffMarks, the line, the budget
│   └── components.md    #   TabStaff, the control, caption, marks, screens, test hooks
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── reading/
│   │   ├── view.ts                   # NEW: StaffView, the store
│   │   ├── spelling.ts               # NEW: spellingFor, noteName, degreeName, FOLDED_DEGREES
│   │   ├── labels.ts                 # NEW: the label writer, layoutReading, ReadingLayout
│   │   ├── played.ts                 # NEW: playedColumns, signatures
│   │   ├── align.ts                  # NEW: alignColumns, MAX_EDITS
│   │   ├── compare.ts                # NEW: compareParts, compareVariants, words
│   │   ├── marks.ts                  # NEW: staffMarks, the line
│   │   └── __tests__/
│   │       ├── baseline.json         # NEW: recorded from unedited code, for INV-001, 002, 018
│   │       ├── frets-unchanged.test.ts   # NEW: INV-001, 002, by the harvest
│   │       ├── view.test.ts          # NEW: INV-006
│   │       ├── cells.test.ts         # NEW: INV-008 to 013, 018
│   │       ├── carried-chord.test.ts # NEW: INV-014
│   │       ├── played.test.ts        # NEW: INV-020
│   │       ├── compare.test.ts       # NEW: INV-019 to 021, 024, 026
│   │       ├── compare-oracle.test.ts    # NEW: INV-022, 023, against a DP table
│   │       ├── budget.test.ts        # NEW: INV-025
│   │       ├── marks.test.ts         # NEW: INV-027 to 029, 035
│   │       └── snapshot.test.ts      # NEW: INV-015, over fake-indexeddb
│   ├── chords.ts                     # MODIFIED: bassName, anchoredChords, chordsInForce, CHORD_QUALITIES
│   ├── export/text.ts                # MODIFIED: header comment only
│   ├── local/
│   │   ├── queries.ts                # MODIFIED: listSongContent
│   │   └── hooks.ts                  # MODIFIED: useSongContent
│   └── tab/
│       ├── layout.ts                 # MODIFIED: CellWriter, layoutWith; layoutPart calls it
│       └── techniques.ts             # MODIFIED: decorate's separator, header
├── components/
│   ├── reading/
│   │   ├── useStaffView.ts           # NEW
│   │   ├── ViewControl.tsx           # NEW
│   │   ├── VariantLine.tsx           # NEW
│   │   └── __tests__/                # NEW: jsdom halves of INV-016 (caret), 033, 036
│   ├── tab/TabStaff.tsx              # MODIFIED (CRLF): reading, marks, RemovalGap, caption, header
│   └── app/
│       ├── SongView.tsx              # MODIFIED (CRLF): useSongContent, control, note, marks
│       └── PlayView.tsx              # MODIFIED: useSongContent, control, marks
├── app/globals.css                   # MODIFIED: tokens, print values, mark rules
e2e/
├── reading-helpers.ts                # NEW: seeding the part sets
├── reading-view.spec.ts              # NEW: Stories 1 and 2, INV-003 to 007, 014
├── reading-layout.spec.ts            # NEW: INV-016, 017
├── variant-marks.spec.ts             # NEW: Stories 3 and 4, INV-015, 026 to 031, 033, 036
├── variant-marks-paint.spec.ts       # NEW: INV-010, 032, 034, both themes
└── reading-sync.spec.ts              # NEW: INV-003 across devices (skips with no database)
scripts/
└── untouched-by-reading.sh           # NEW: INV-037, as check:untouched-reading in package.json
```

**Structure Decision**: Single Next.js package, unchanged. Everything about reading sits in
`src/lib/reading/`, which is deliberately not `src/lib/tab/`: its tests would trip `round-trip.test.ts`,
and keeping it apart is what lets a one-line guard say the export imports none of it. The only new code
in `src/lib/tab/` is the seam the reading layer plugs into. `src/app/`, apart from `globals.css`, is not
touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. Two judgement calls add a little machinery:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| A hand-written alignment rather than a diff library | Substitution, a forbidden barline pairing and a deterministic edit budget are all needed, and they are about 110 lines. | A library is a dependency, and the usual ones are LCS, which fails SC-008. |
| A second pass for group continuation | SC-007 and FR-023 fail at every group edge without it (research R10). | Keeping it in the signature marks columns nobody changed. |

## Open for the human

Not blocking. Planning proceeded under the standing instruction to decide and move on.

1. **Deviation 2 reads the spec's group rule more narrowly than it is written.** It is the call most
   likely to surprise a reviewer, though the spec's own SC-007 forces it.
2. **Deviation 8, the caption in the card's padding,** is the design call most worth seeing at actual
   size.
3. **Deviation 7**: a Windows desktop will show a staff grow by a scrollbar when notes make it overflow.
   Worth a look, since that is the machine in use here. `usability-pass` could settle it.
4. **`MAX_EDITS = 512`** is a judgement. Above it a variant reads as replaced in the middle. Research R8.
5. **The tint tokens were picked by computed contrast only.** No one has seen them yet.
6. **`usability-pass` will be asked to fit this control into the play view's rearranged controls**, and
   owns its tap target size.
7. **The constitution is still the scaffold template**, as for the previous entries.
8. **The browser pass is owed after merge** (`quickstart.md` §8). SC-012, SC-013 and SC-014 are only
   partly proved until someone does it.
