# Implementation Plan: Make playing techniques capturable and visible

**Branch**: `002-playing-techniques` | **Date**: 2026-11-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-playing-techniques/spec.md`

## Summary

Make the ten techniques already in the stored model capturable and visible, with no change
to what is stored. The work has four parts, and each has one owner so two things cannot
drift apart:

- **Drawing, once.** A new `src/lib/tab/techniques.ts` declares every glyph, affix and word.
  `layoutPart` turns stored techniques into affixed `cells`, a new per-string `connectors`
  field (the glyph in the gap before a column) and a new `description` for screen readers.
  `ascii.ts` swaps a rail for a connector, and `TabStaff` draws a thin `Gap` element. Neither
  works out a glyph for itself.
- **Transitions on chips.** Four more entries in `LATCHES`, plus three pure functions
  (`armLatch`, `nextNote`, `statusFor`) so `CaptureScreen` holds no latch-specific branch. A
  new `transition` scope makes the chips available on a barline, and stack's rule is
  untouched.
- **Decorations in the sheet.** One new `decorations` entry in `COLUMN_PROPERTIES`, rendering
  six toggles per played string, committing through a new `toggleDecoration` that reads the
  row inside its transaction, so quick toggles cannot overwrite each other.
- **Two inherited defects.** F14: the latch prune waits while the cursor names a column that
  has not been delivered. FU12: `Sheet` ignores a pointer click that did not begin inside it,
  which holds at any sheet height.

No schema change, no migration, no wire-protocol change, no clipboard change. See
[research.md](./research.md) for how each decision was reached.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`,
Zod (wire validation only). **No new dependency.** No Next.js API is touched: everything here
is client components, CSS and library code.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`.
`EventRow.techniques` already exists and is merged, validated and copied. **This feature
writes that field and adds nothing.**

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock. Playwright 1.64
(`npm run test:e2e`) against a production build, projects `mobile` (Pixel 7) and `desktop`.
Plus a person-level browser pass at actual size in both themes, which happens outside the
pipeline (spec assumption).

**Target Platform**: Installable PWA in a mobile browser, offline-capable. The smallest
supported viewport is 375×667.

**Project Type**: Next.js web application, single package. The capture screen is entirely
`"use client"`.

**Performance Goals**: The fret, fret, fret path gains no tap, no delay and no prompt
(FR-037). A transition costs exactly one extra tap (SC-001). A toggle takes effect at once.

**Constraints**:
- 375×667, no page-level scrolling, every string of a five-string part visible, neck height
  unchanged, stable toolbar positions (FR-038). Measured baselines on `main`: strip 38.8 px,
  chip 30.8 px, row 2 ending at 308.2 of 365 usable px.
- A visual tier is never opacity over a surface token. A new colour is named per theme, and
  a distinction never rests on hue alone (FR-040).
- `npm run dev:clean` before debugging a style that appears to do nothing. Never run the
  build or e2e suite while a dev server holds the same `.next`.
- Edits keep each file's existing line endings. CRLF: `TabStaff.tsx`, `ui/index.tsx`,
  `e2e/capture-surface.spec.ts`, `ColumnInspector.test.tsx`.

**Scale/Scope**: 1 new library module (~90 LOC). 13 modified source files. 1 new e2e spec and
3 new unit test files. No new route, table or token.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no
ratified constitution to gate against. As in the previous entry, the gates below are the
project's de facto rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers. See
*Open for the human*.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed after merge) | FR-039; INV-027; `quickstart.md` §6. The pipeline has no browser, so a person does this after merge, as for the previous entry. Nothing is claimed for it until then. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | INV-027 is computed style at 375×667, plus the person-level pass. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` | PASS | Connectors use the fret numbers' ink. Toggles reuse the chip's named tokens and differ by fill as well as hue. No new colour is planned. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts`, `TabStaff.tsx` headers | PASS | FR-007, enforced by INV-005, including a check that neither renderer imports `techniques.ts`. |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | Glyphs, arming, placement, status text, the prune and the toggle are all pure or library functions. `CaptureScreen` loses its `lit.has("stack")` branch. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | `toggleDecoration` and `stackNote` use `mutateBatch` and `patchRow`. |
| **Tests must be able to fail for the right reason.** | `docs/DECISIONS.md` | PASS | Exact strings over the export; `boundingBox`, `scrollWidth` and computed style on screen. INV-020 exists because the previous test could not fail. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | No dependency. `Sheet` gains one handler. |

**Post-design re-check (after Phase 1)**: PASS. The design adds no dependency, table, token or
route. Every place where two things must agree is closed by one calling the other (see
*Agreement is structural* below), not by tests over two copies.

## Invariants — what must never happen *(mandatory)*

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does the stored model, schema, wire protocol or clipboard change, and no migration exists. | `git diff --stat main --` over the members prints nothing, and `drizzle/` gains no file. | `src/db/**`, `drizzle/**`, `src/lib/model.ts`, `src/lib/sync/**`, `src/lib/local/clipboard.ts`, `src/lib/local/db.ts`. |
| INV-002 | Never does a capturer who touches no chip get a different result. | Public `insertNote`/`stackNote` over `fake-indexeddb`: compare the stored row to today's, apart from id, rank and clock values, plus which field clocks were stamped and the outbox count. e2e counts taps and reads the export. | 7 routes with nothing armed: insert at the end, insert mid-part, insert at the start, insert after a barline, stack on a new string, stack on a rest, stack replacing a plain note. |
| INV-003 | Never does a part with no techniques export differently, or draw at a different width. | `ascii.test.ts` and `text.test.ts` run with **zero diff** against `main`. e2e asserts `tab-connector` count 0 and each column's `boundingBox` width equal to the plain formula. | Every fixture in both suites × both densities; the parts captured by `e2e/capture.spec.ts`. |
| INV-004 | Never are two rows of an exported part different lengths, nor is any string misaligned by a technique. | `toAscii` exact-string and equal-length assertions. e2e reads `boundingBox` of each cell in a widened column. | 10 techniques × 2 densities × 7 shapes (alone; after a plain source; two-digit source; source column widened to 2; widened to 3; across a space; across a barline) = 140 parts, plus all six on one note, plus two transitions into one column on different strings. |
| INV-005 | Never do the staff and the export disagree, and never does a renderer work out a glyph. | **Structural**: `ascii.ts` and `TabStaff.tsx` read only `cells` and `connectors`; a source check asserts neither imports `techniques.ts` nor reads `.techniques`. **Behavioural**: e2e reads each string's tokens from the DOM with `staffRows`, and compares them in order with the exported row split on rails. | One fixture (4 transitions, 6 decorations, a repeated column, a barline, a chord symbol, a triplet) on 4 surfaces: capture staff, song page expanded, song page compact, play view. |
| INV-006 | Never is a source stored in any form, and never does a transition point anywhere but the nearest earlier note. | Read stored rows: the value is exactly `{ "<string>": ["<technique>"] }` and no other field changed. Then read the export after each edit. | Stored form: 4 chips × {insert, stack}. Position: delete the source by toolbar, inspector, selection delete, cut, and from a second tab; insert between; paste between; delete the arrival; paste the arrival elsewhere; variant. |
| INV-007 | Never is a connector drawn without a note, a transition and an earlier note, and never is one missing with all three. | `layoutPart` and `toAscii` exact strings. | 8 rows of the truth table; source shapes: first column, only another string played, across a space, across a barline, source cut off by `eventsInBars`; technique on a barline; on an empty rest; `dead_note`; an unknown string; 6 pairs of two stored transitions, in both stored orders. |
| INV-008 | Never does a repeat draw a technique other than on every repetition in expanded, and once in compact with the label last. | `toAscii` exact strings, including `5h7h7h7`, `5h7x3`, `7~-7~-7~`, `7~x3`, `7h7h7`, `7x3`. | 10 techniques × {expanded, compact} × {repeat 1, repeat 3} × {has a source, first in the part}; a chord symbol on a repeated decorated column draws on the first repetition only. |
| INV-009 | Never does one armed chip mark two notes, or none. | e2e through the fretboard, reading export and `aria-pressed`. Back-to-back presses are issued with no wait between. | 4 chips × 3 routes (insert at the end, insert mid-part, stack) × {paced, back-to-back} = 24. Stack stays armed in each stack member. |
| INV-010 | Never are two transition chips lit together, and never does a chip block stack. | e2e reads `aria-pressed` on all five chips after each tap. `armLatch` unit test over the same set. | 12 ordered pairs of different chips; 4 self-toggles (write nothing); stack with each chip in both arming orders = 8. |
| INV-011 | Never is a latch lit where it cannot apply, and never is a chip left armed after an action that disarms stack. | **Structural**: `lit` is derived each render. e2e reads `aria-pressed` and `disabled`, then presses a fret and reads the export. | 5 latches × 6 targets (notes, rest, barline, start of part, empty part, no part) = 30; 4 chips × 9 routes (tap a column, switch part, space, barline, `start`, delete the target, delete it from a second tab, add a part, history back) = 36. |
| INV-012 | Never does a mid-part paste drop a latch that still applies, and never does a latch survive its column really going. | e2e through the toolbar. `prunedArmed` and `cursorPending` unit tests. The `test.fail` mark is removed. | 5 latches × 2 clipboard tails (ending on notes; ending on a barline, where stack alone must disarm) = 10; 5 latches × a delete from a second tab = 5. |
| INV-013 | Never is a toggle lost to the one before it. | e2e fires clicks with no wait between, then reads the stored row and export. Public `toggleDecoration` called with both promises in flight. | 15 pairs of decorations on one string; 6 double taps of one toggle (back to off); one pair across two strings; all six in one burst. |
| INV-014 | Never does a toggle disturb anything else, and off returns exactly what was there. | Deep-equal the stored row before and after, comparing which field clocks moved. | 6 decorations × {on, off} × {with a transition; `dead_note`; an unknown entry; another string decorated}; `frets`, `repeat`, `rank` and the chord symbol unchanged; off restores `{}` on a plain note. |
| INV-015 | Never is a row written that the wire would refuse. | After each write, `eventRowSchema.safeParse` on the stored row. A test also pins `MAX_TECHNIQUES_PER_STRING` against the real schema: 8 accepted, 9 refused. | `toggleDecoration` on a list of 6, 7 and 8 entries, each turning on and off; insert with a transition; stack with a transition onto a full list. |
| INV-016 | Never does a removed note leave its techniques behind for a later note. | Public operations, then read the row and the export after entering a new note on that string. | Stack replace with nothing armed; stack replace with a chip armed; same-fret stack; `unstackNote` with a second string left; `unstackNote` emptying the column; stacking onto an orphan technique. |
| INV-017 | Never does the release of the long press activate anything in the sheet. | e2e holds a column and releases over a sheet control, then asserts the stored row and export are unchanged and the sheet is open. jsdom: a `detail: 1` click with no inner `pointerdown` is dropped; with one, it passes; `detail: 0` always passes. | Columns playing 1 to 5 strings on B Standard, 6 on `Guitar 6`, 7 on `Guitar 7` = 7 heights × {mouse, touch}; release over a toggle, over `delete`, and over `close`. |
| INV-018 | Never is a toggle or the close control out of reach at phone size. | e2e at 375×667: scroll each toggle into view and assert it is in the viewport and clickable; assert `close` is in the viewport at the top, middle and bottom of the scroll; assert no horizontal overflow and no page scroll. | 4 string counts (4, 5, 6, 7), every string played × 2 themes. |
| INV-019 | Never do the chips, status line or sheet move the capture screen's layout. | e2e reads `boundingBox` and scroll sizes against the measured baselines, and adds the new states to the existing status-row clipping test. A chip holds its position while unavailable. | Strip, neck, 5 stable controls × 8 states (nothing armed, each of 5 latches, stack with a chip, at the start) × 2 themes; 8 new status texts (4 alone, 4 with stack) × the existing 15-state chord and tuplet matrix. |
| INV-020 | Never does a label escape its chip. | e2e asserts `scrollWidth <= clientWidth` and one line, on the **declared** chips. A mutation (one long label in a temp copy) must make it fail. | 5 chips × {unlit, lit, unavailable} × 2 themes at 375 px. |
| INV-021 | Never does a connector break the chord row, bracket, caret, selection band or barline, or act as a control. | e2e reads `boundingBox` and DOM order: a chord's `x` equals its column's; the bracket's line has no gap across a `Gap`; the caret precedes the `Gap`; a connector is not focusable, not a `button` and not a `tab-column`. | Chord on the arriving column; chord on the source; connector inside a tuplet, at its first column and just after its last; caret before a connector; barline either side; selection covering both sides and the arrival only; the cursor rule across a repeat; tap on a connector moves nothing. |
| INV-022 | Never does a connector fail to mask the string line. | e2e compares the glyph span's computed `background-color` with a fret number's beside it, and asserts it is opaque. | 3 surfaces (base, raised, selected) × 2 themes = 6. |
| INV-023 | Never does a description read an affix, or a plain column's description change. | e2e reads `aria-label`. `layoutPart` unit test on `description`. | 10 techniques, all six together, a dead note, compact repeated, a transition with no source (not named), and plain columns, on the capture staff and read-only views. |
| INV-024 | Never is a decoration out of reach without a sustained press. | e2e with the keyboard alone, and with a single tap. Reads `aria-pressed` and each toggle's accessible name. | 3 routes (`Shift+F10`, `ContextMenu`, the `details` button) × 6 toggles × {Space, Enter}; a single tap on `details`; names unique on `Guitar 6`, with its two E strings; no route opens the sheet during a selection. |
| INV-025 | Never does a component branch on a particular latch or property. | jsdom renders fabricated descriptors at 1 and 5 latches and at 3 and 7 properties, and a source check finds no latch or property id literal. | `LatchStrip`, `ColumnInspector`, `CaptureScreen`'s `press` and status line; every id in `LATCHES` and `COLUMN_PROPERTIES`. |
| INV-026 | Never does a note's drawn text depend on stored order. | `toAscii` exact strings. | All 63 non-empty subsets of the six decorations × {stored order, reversed}, on a fret, a two-digit fret and `x`. |
| INV-027 | Never is a new mark illegible, or told apart by hue alone. | Computed style at 375×667: named tokens only, no `opacity` on a surface, and on and off toggles differ by fill and luminance. **Person-level pass for the rest** (`quickstart.md` §6). | Connectors, affixes, chips, toggles × 2 themes. The person-level half is owed after merge, and is SC-008. |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| Staff and export | Both read `TabColumn.cells` and `connectors` from `layoutPart`. |
| A chip's label and the connector it draws | `LATCHES` takes its label from `TRANSITIONS`. |
| A toggle's name and the description | Both read `words` from `DECORATIONS`. |
| Chip availability and what the note can do | `LatchStrip` and `litLatches` both call `appliesTo`. |
| What the status line says and what the note does | `statusFor` and `nextNote` both read `lit`. |
| Toolbar `details`, long press and keys | All call `setInspecting`. |
| `MAX_TECHNIQUES_PER_STRING` and the wire | A test parses through the real `eventRowSchema`. It is the one constant that cannot be shared, because FR-001 fences the protocol file. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Deletion**: stacking onto a string with a note clears that string's techniques, including entries this entry does not manage. | Clear them, with no prompt. | FR-004: the note they described has gone. It touches one string, and a prompt would cost the capture path. | INV-016 |
| **Deletion**: a toggle rewrites a string that holds `dead_note` or an unknown entry. | Keep them. Only the toggled decoration changes. | FR-006. Data this version cannot read is not this version's to drop. | INV-014 |
| **Deletion**: deleting a source note. | Nothing else is touched. The transition reattaches by position. | The roadmap's central decision, and the reason no pointer is stored. | INV-006 |
| **Refusal**: turning on a decoration at the wire's cap. | Write nothing. | One 9-entry row makes the push route refuse the device's whole batch, which stops all sync. Dropping an entry to make room would break FR-006. | INV-015 |
| **Authority**: who may write techniques. | Unchanged. No new role check, and no new route. | Toggles use `patchRow`, like frets, and the server already refuses a viewer's push. | INV-005 of the previous entry (no inspector on read-only views) |
| **Merging**: two devices edit one column's techniques offline. | Later write wins, for the whole column. | Spec assumption. Per-string merging would need a stored-model change. | INV-001 |
| **Money** | None involved. | | |

### Deviations and corrections, all cheap to overturn

1. **A previous test's guarantee is retired.** `e2e/capture-surface.spec.ts:2381` asserts the
   sheet opens clear of the pressed column. FR-031's sheet cannot promise that, so INV-017
   replaces it with the behaviour it stood in for. The test at `:1067` ("six rows need no
   scrolling") goes the same way, in favour of INV-018.
2. **The toolbar gains a tenth control**, `details`, which FR-032 does not strictly require
   ("at least by keyboard"). Without it, a touch user who cannot hold a press has no route to
   decorations at all. It fits: row 2 has 52.8 px spare at 375 px. **To overturn**: delete one
   line in `controls.ts` and the button. The key route stands alone.
3. **The spec's `5--h7` wide-cell example** is right for a width-3 neighbour. A width-2
   neighbour gives `5-h7` (research R3). The rule is built as stated, and the tests pin both.
4. **A leading space or barline leaves the chips available** (research R9). A transition
   stored there draws nothing until a source appears, as the edge cases already say.
5. **Read-only columns gain `role="img"`** and a description (research R5). Without it, FR-017
   would hold only on the capture staff.

### Existing tests this changes on purpose

| Test | Change | Why |
|---|---|---|
| `e2e/capture-surface.spec.ts:2381` | Drop the clearance assertion | Deviation 1 |
| `e2e/capture-surface.spec.ts:1067` | Replace with INV-018 | Deviation 1. Its `rows === 6` count also changes |
| `e2e/capture-surface.spec.ts` five-latch test (near `:1006`) | Measure the five real chips, adding `overflows` | Clones would now make nine chips. Closes F24 |
| `e2e/capture-surface.spec.ts` INV-002 members | 6 targets × 10 controls | The `inspect` control |
| `e2e/capture-surface-helpers.ts` `status` | Widen the regex | New status texts |
| `src/lib/capture/__tests__/controls.test.ts:43` | Add `inspect` | Deviation 2 |
| `ColumnInspector.test.tsx`, `properties.test.ts` | Add `tuning` to the context where the type requires it | `PropertyContext` |
| `specs/001-…/review-probes/INV-010-r2-transient-and-part-routes.spec.ts:24` | Remove `test.fail`, and adopt the member into the suite | FR-036 |

`ascii.test.ts`, `text.test.ts` and `editing.test.ts` are **not** edited. New cases go in new
files.

## Project Structure

### Documentation (this feature)

```text
specs/002-playing-techniques/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── notation.md      #   the normative grammar `ascii-import` will parse
│   ├── descriptors.md   #   techniques, layout, target, latches, properties, controls
│   ├── writes.md        #   insertNote, stackNote, unstackNote, toggleDecoration
│   └── components.md    #   Gap, LatchStrip, ColumnInspector, Sheet, CaptureScreen, test hooks
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── tab/
│   │   ├── techniques.ts             # NEW: glyphs, affixes, words, order, the wire cap
│   │   ├── layout.ts                 # MODIFIED: affixed cells, connectors, description
│   │   ├── ascii.ts                  # MODIFIED: a connector replaces a rail
│   │   └── __tests__/
│   │       └── techniques.test.ts    # NEW: exact strings (ascii.test.ts is not edited)
│   ├── capture/
│   │   ├── target.ts                 # MODIFIED: the `transition` scope
│   │   ├── latches.ts                # MODIFIED: 4 chips, armLatch, nextNote, statusFor, the prune
│   │   ├── properties.ts             # MODIFIED: decorations, toggles, appliesToColumn, tuning
│   │   ├── controls.ts               # MODIFIED: `inspect` in row 2
│   │   └── __tests__/                # MODIFIED: latches, properties, controls, target
│   └── local/
│       ├── editing.ts                # MODIFIED: techniques on insert and stack, toggleDecoration
│       └── __tests__/
│           └── techniques.test.ts    # NEW: writes (editing.test.ts is not edited)
├── components/
│   ├── capture/
│   │   ├── CaptureScreen.tsx         # MODIFIED: press, status, prune, details button, tuning
│   │   ├── ColumnInspector.tsx       # MODIFIED: toggles, sticky header
│   │   ├── LatchStrip.tsx            # MODIFIED: glyph label treatment
│   │   └── __tests__/                # MODIFIED: ColumnInspector, LatchStrip
│   ├── tab/
│   │   ├── TabStaff.tsx              # MODIFIED (CRLF): Gap, description, keys, followTail
│   │   └── __tests__/
│   │       └── TabStaff.test.tsx     # NEW: no glyph logic, gap only where needed
│   └── ui/
│       └── index.tsx                 # MODIFIED (CRLF): Sheet scrolling and the release rule
└── app/
    └── globals.css                   # MODIFIED: .tab-connector
e2e/
├── techniques.spec.ts                # NEW: INV-002 to INV-027 through the real screen
├── capture-surface-helpers.ts        # MODIFIED: chip, toggle, connectors, staffRows, status
└── capture-surface.spec.ts           # MODIFIED (CRLF): see "Existing tests this changes"
```

**Structure Decision**: Single Next.js package, unchanged. Domain rules stay in `src/lib/`,
testable in the node environment, and presentation stays in `src/components/`. The one new
file exists so the staff, the export, the chips, the toggles and the later parser all have
one table to read. Nothing under `src/app/api/`, `src/db/`, `drizzle/` or `src/lib/sync/` is
touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. One judgement call adds a little structure:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| `MAX_TECHNIQUES_PER_STRING` restates a number in `protocol.ts` | One over-long row stops a device's sync, and FR-001 fences that file. | Importing it would need a protocol change. No guard at all leaves a sync outage reachable from foreign data. A test parses through the real schema, so the two cannot drift silently. |

## Open for the human

Not blocking. Planning proceeded under the recorded decisions.

1. **The constitution is still the scaffold template**, as it was for the previous entry.
   `/speckit-constitution` would give the remaining roadmap entries something firmer than
   `docs/DECISIONS.md` to check against.
2. **The `details` button** (Deviation 2) goes beyond FR-032's minimum, for touch users who
   cannot hold a press. It is one line and one button to remove.
3. **The browser pass is owed after merge** (`quickstart.md` §6). SC-008 and FR-039 stay
   unverified until a person does it, and the slash glyphs are the likeliest thing to need
   adjusting.
