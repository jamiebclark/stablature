# Implementation Plan: Group any run of columns, as a counted tuplet or as plain phrasing

**Branch**: `003-generalised-grouping` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-generalised-grouping/spec.md`

## Summary

Let a selection become a group of any size, as a counted tuplet or a bare bracket, and let any
group be taken apart. One stored field is added, and each rule has one owner so two things
cannot drift apart:

- **One stored field.** `groupKind` joins `EventRow`, the wire, the merge registry, the clipboard
  and Postgres. `NO_GROUP` and `groupNumber` in `model.ts` are the only statement of what "no
  group" is and of what number a group prints.
- **One rule for what a selection can do.** A new pure `src/lib/capture/grouping.ts` holds
  `groupOffer` and `runEndingAt`. The toolbar renders from the offer, and the write recomputes
  the same offer from stored rows, so the numeral shown is the number written.
- **One writer.** `groupSelection` and `groupRunEndingAt` end in a single private `regroup`, which
  reads the part inside the transaction, dissolves whole any group that loses a column, and
  always writes all three fields. `tripletFromTail` and the triplet button are the same call.
- **One drawing path.** A plain span has a null count, and `tupletRow` and `TabStaff` draw it
  through the code a counted span uses, with no number. Extents cannot differ.
- **The selection toolbar moves into the empty row-2 slot.** Measured on `main`, four controls
  already hide one of five strings, so FR-020 cannot be met by adding three more to that row.

One migration, one new pure module, no new route, no new dependency, no new colour token. See
[research.md](./research.md) for how each decision was reached.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Tailwind CSS 4, Dexie 4 with `dexie-react-hooks`, `lucide-react`, Zod,
Drizzle ORM and drizzle-kit. **No new dependency.** No Next.js API is touched: everything here
is client components, CSS, library code and one SQL migration.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres through `src/lib/sync/`. **One new
nullable column**, `events.group_kind`, with a new enum type. No IndexedDB version change.

**Testing**: Vitest 5 (`npm test`), node by default, jsdom by docblock, `fake-indexeddb` for
writes. Playwright 1.64 (`npm run test:e2e`) against a production build, projects `mobile` (Pixel
7) and `desktop`. `e2e` sync scenarios need Postgres and skip without it. Plus a person-level
browser pass at actual size in both themes, after merge (FR-038).

**Target Platform**: Installable PWA in a mobile browser, offline-capable. The smallest supported
viewport is 375×667.

**Project Type**: Next.js web application, single package. The capture screen is entirely
`"use client"`.

**Performance Goals**: A group of any allowed size takes one tap once selected (SC-001). The
fret path gains no tap, delay or stored difference beyond a null field (SC-010). `groupOffer` is
linear in the selection and runs each render, which is negligible beside the staff.

**Constraints**:
- 375×667, no page scroll, every string kept with all seven controls present (FR-020). Measured
  on `main`: band 166 px at rest, 108.8 px during a selection, stable row top 277.8 px.
- `tsc` includes test files, so a required `groupKind` breaks 11 test files (research R1).
- A refused row fails the whole push, so one bad row stops a device syncing (FR-006, SC-004).
- A visual tier is never opacity over a surface. Colours are named per theme (FR-034).
- `no-id-branch.test.tsx` slices `CaptureScreen` on two literals, which must survive (research R8).
- `npm run dev:clean` before debugging a style that appears to do nothing. Never run the build or
  e2e suite while a dev server holds the same `.next`.
- Edits keep each file's line endings. CRLF: `TabStaff.tsx`, `e2e/capture-surface.spec.ts`,
  `ColumnInspector.test.tsx`.

**Scale/Scope**: 1 new library module (~70 LOC). 1 migration. 14 modified source files. 1 test file
removed, 2 test files edited on purpose. New tests in new files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no
ratified constitution to gate against. As in the previous entries, the gates below are the
project's de facto rules from `docs/DECISIONS.md`, `AGENTS.md` and the code's own headers. See
*Open for the human*.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done**, at actual size, in both themes. | `docs/DECISIONS.md` | PASS (owed after merge) | FR-038; INV-027; `quickstart.md` §6. The pipeline has no browser. Nothing is claimed until a person has looked. |
| **No colour decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | INV-024 is computed style against the real surface, plus the person-level pass. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` | PASS | `.tab-bracket` switches between two named tokens. No opacity, no new colour. |
| **The layout is the one source for screen and export.** | `layout.ts`, `ascii.ts`, `TabStaff.tsx` headers | PASS | `tupletSpans` is the only span source. Neither renderer works out a number. INV-021, INV-022. |
| **Domain rules live in `src/lib/`.** | `editing.ts` header | PASS | `groupOffer`, `runEndingAt`, `regroup` and `groupNumber` are all library code. `CaptureScreen` renders an offer and calls a write. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | All group writes use `mutateBatch` and `patchRow`. |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | `_Events` is untouched and a new assertion covers the one blind spot. Proven by mutation, INV-025. |
| **Tests must be able to fail for the right reason.** | `docs/DECISIONS.md` | PASS | Exact strings over the export, `boundingBox`, `getBBox` and computed style on screen. INV-007 injects a real failure. INV-025 is a mutation. |
| **Never reuse a server, never share `.next`.** | `playwright.config.ts` | PASS | No harness change. |
| **Simplicity: no component library, thin primitives.** | `ui/index.tsx` header | PASS | No dependency. `ui/index.tsx` is not touched. |

**Post-design re-check (after Phase 1)**: PASS. The design adds one column and one module. Every
place where two things must agree is closed by one calling the other (see *Agreement is
structural*). The two test edits and the move of the toolbar are recorded below, not hidden.

## Invariants — what must never happen *(mandatory)*

Writes are probed through the public functions over `fake-indexeddb`, reading rows, outbox and
export. Screens are probed through `e2e`. "Actions" means the set **A**: tuplet control, group
control, triplet button, `tripletFromTail`, ungroup from the toolbar, ungroup from the sheet.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never is a row written that sync would refuse. | After each write, wrap every outbox row in a mutation and parse with the real `pushRequestSchema`, in batches of `PUSH_BATCH`. | Selection sizes 2 to 40 × 6 shapes (no barline; barline at the left edge; at the right edge; both edges; one interior; two interior) × {tuplet where offered, group} = 468 at most; then ungroup of each result; a rest, a `repeat: 512` column and a legacy row in the selection. |
| INV-002 | Never do the control, staff, export and stored count disagree, or a number differ from its group's columns. | e2e reads the control's name and glyph text, the bracket's numeral, and the export's digits. Unit: `offer.tuplet.length`, stored `tupletCount`, `tupletSpans` count and the `toAscii` label compared. | Counts 2 to 16, each × {all notes, one rest, one `repeat: 8`}; extending 2→4 and 16→17 live. |
| INV-003 | Never does a write put columns on both sides of a barline into one group, and never does a barline join one. | Read stored rows: walk in rank order and assert no id appears on both sides of a barline, and a barline's three fields are null. Then read `toAscii`. | 4 grouping actions (tuplet, group, button, `tripletFromTail`) × 6 barline shapes from INV-001 × {cursor at the end, mid-part}, and a barline arriving between render and tap, which re-derives the offer (a stale anchor and head with stored rows changed). |
| INV-004 | Never does a group lose a column and survive, and never does a counted tuplet hold a different number of columns from its number after an action. | Read rows, group by id within the part, assert `tupletCount` equals the member count for every touched group, and no touched id remains with a missing member. | New group over an old one: left end, right end, middle, exact match, superset, spanning two groups, all × {counted over counted, counted over plain, plain over counted, plain over plain}; the button over `a b c` then `d`; an old group with columns in another bar; a legacy cross-bar group. |
| INV-005 | Never does an action reach another part. | Read the other part's rows, deep-equal, and count its outbox entries. | 6 actions in **A** × {edit the variant, edit the parent} × {group shared by id, two variants of one parent}. |
| INV-006 | Never is a column stored outside the stored-states table, and never are its three fields clocked apart. | Read rows: each is one of the three written states, and the three `fieldClocks` are equal. `mergeRow` over two devices' rows, in both orders. | 6 actions in **A** × {joining, dissolved}; merge pairs: tuplet vs plain, group vs ungroup, group vs group on overlapping columns, each both ways, asserting the id, count and kind of every column came from one write. |
| INV-007 | Never is an action left half done. | Pass a `clock` whose `send()` throws on call N. Assert the rows and outbox are byte-identical to before. | 6 actions in **A** × N from 1 to the number of patches, on a group that dissolves another. |
| INV-008 | Never does an action change anything but the three fields. | Deep-equal each row before and after with those fields, `fieldClocks` and `updatedAt` removed, and compare which clocks moved. Untouched rows get no outbox entry. Annotations deep-equal. | 6 actions in **A** × columns holding {techniques, `repeat: 8`, a chord symbol, a rest, a `durationHint`}; rank order; a selected column that joins nothing. |
| INV-009 | Never does a row or clipboard from before this entry fail, block a batch, or read as plain. | Real `pushRequestSchema`, `mergeRow`, `layoutPart`, `pasteClipboard`, `readClipboard`. e2e: seed a queued raw row, and watch the push succeed. | A local row with no key; a queued outbox row with no key; a pulled row with null; no clock for the field on either side; a clipboard with no key, grouped and ungrouped; a row with null count; a stale `(id, 3, "plain")` row, which prints 3; a legacy cross-bar group, which draws as it did and whose two halves ungroup. |
| INV-010 | Never does the wire accept a value outside FR-001 or a count outside 2 to 16. | `eventRowSchema.safeParse` over the real schema. | `groupKind`: `"beat"`, `""`, `"Tuplet"`, `0`, `true`, `{}`, `[]`. `tupletCount`: 1, 17, 2.5. Accepted: `"tuplet"`, `"plain"`, null, absent; 2 and 16. |
| INV-011 | Never is `groupKind` dropped where its siblings are carried, or anything but null on a new column. | Public operations, read the stored row with strict null checks, then `toAscii`. | Carried: copy, cut, variant, each × {plain, counted, legacy}; a pasted group has a new id; two pastes do not weld; partial copy keeps its kind. Null: `insertColumn`, `insertNote`, `insertRest`, `insertBarline`, `appendColumn`, `appendNote`, `appendBarline`, paste and variant of ungrouped columns. |
| INV-012 | Never is a control shown that cannot act, or missing when it can. | `groupOffer` truth table. e2e reads presence through the toolbar, and asserts absent, not disabled. | The nine rows of `data-model.md`'s table, each × {grouped, ungrouped}; a selection overlapping two groups; a single column in a group; 18, 20 and 40 columns; every extension step from 2 to 17; a group arriving by sync. |
| INV-013 | Never does a selection wrap a label, shrink the staff below its resting band, move the stable row, or scroll the page. Four and five strings stay inside the band; six may leave at most one string out of view, with every string and the bracket reachable by a swipe (FR-020, decided 2026-11-04). | e2e at 375×667: all seven on one line, `scrollWidth <= clientWidth` on the row and each control, the band height against the same part at rest, `toolbar-stable` top unchanged, each string inside the band at four and five strings, at most one out of view and all reachable at six, page over-scroll 0. DOM order read directly. | 2 themes × 3 string counts (4, 5, 6) × {bracket, bracket and chord row} × numeral {3, 16}; six-control and four-control states keep the order `copy cut delete tuplet group ungroup cancel`. | *(Amended by spec 007: six strings now stay in view too; swipe is for seven strings or a screen shorter than 375×667. Probe: e2e/grouping-layout.spec.ts)*
| INV-014 | Never does an action leave the selection up or move the cursor. | e2e reads `data-selected`, the caret and `aria-current` before and after. | 3 toolbar actions × {cursor at the end, mid-part, on a barline}. |
| INV-015 | Never is a new control unnamed, and never does the tuplet control say "triplet". | e2e reads accessible name and title. All existing locators still resolve to one element. | Tuplet at 2, 3 and 16; group; ungroup; sheet row. Locators: `select`, `copy`, `cut`, `delete`, `cancel`, `paste`, `Triplet`, `/triplet/`. |
| INV-016 | Never does the triplet button draw a false 3, or write when it refuses. | Public `groupRunEndingAt` and `tripletFromTail`: outbox count unchanged on refusal. e2e reads the export, the status line, and the button's `boundingBox`. Back-to-back fret, fret, fret, triplet with no wait. | Cursor at the end; mid-part; on the first and second columns; three columns ending on a rest; a repeat column; barline at each of 2 positions among the three; a barline after the cursor (allowed); trailing barline with the cursor at a note; `tripletFromTail` with counts 1, 2, 3, 16, 17. |
| INV-017 | Never does a refusal message outlive its cause. | e2e reads the status line after each route. | 10 routes: tap a column, a fret, space, barline, delete, `start`, `end`, switch part, add a part, delete from a second tab. Then a refusal in the chord and stack states at 375×667, with no page scroll and no lost string. |
| INV-018 | Never does the sheet offer a group row wrongly, misname a group, or branch on a property id. | jsdom on `ColumnInspector` with fabricated descriptors, and `no-id-branch.test.tsx`. e2e reads the row, taps it, and asserts the sheet closed and the bracket went. | Tuplets of 2, 5, 16; plain; legacy; legacy null count (`tuplet of 3`); no group; rest in a group; barline; each column of a group, including one inside a repeat. Three entry routes: long press, `Shift+F10`, the `details` button. |
| INV-019 | Never does a digit touch the bracket, and never does the triplet button change. | e2e in real Chromium: `getBBox()` of the text against each `[data-rail]`, gap above 0. jsdom: the 3's markup equals today's literal string. Empty form has no `<text>`. | Numerals 2 to 16 × 2 themes; no numeral; the triplet button. |
| INV-020 | Never does a part with no plain group render differently. | `ascii.test.ts` and `text.test.ts` with **zero diff** against `main`, and the exact tests pass. | Every fixture in both suites × both densities; every `e2e` fixture carrying a triplet. |
| INV-021 | Never does a plain bracket differ from a counted one except where the number sits. | `toAscii` exact strings. Over the same columns, replacing the digits in the counted row with rails gives the plain row. | Notation table's 6 rows; n = 2 to 20 × {one-digit, two-digit, mixed frets} × 2 densities; `,-, ,-,`; `showTuplets: false` hides both; a plain group next to a counted one; a one-column remnant. |
| INV-022 | Never does a plain-only part lose its bracket row or misalign its strings. | e2e `boundingBox`: each string label's `top` equals its row's. Count `brackets`. Numeral count zero. | 4 surfaces: capture staff, song page expanded, song page compact, play view; plain-only, counted-only, and both; with and without a chord row. |
| INV-023 | Never does a repeat break a bracket or add a number. | `toAscii` exact strings, including `,--------3--------,` and `,--3--,` over `5 5x8 5`. e2e counts numerals, and checks the line has no gap. | `repeat: 8` at first, middle and last × {counted, plain} × 2 densities; a repeat changed after grouping, up and down; a connector inside the span. |
| INV-024 | Never is the bracket line below 3:1 on a surface a staff is drawn on. | e2e computes contrast from the computed `border-top-color` and the element's effective background, and asserts no `opacity` below 1 on the line or its ancestors. | {base, raised, selected} × {dark, light}; print emulation × {dark, light}. |
| INV-025 | Never can the SQL schema lose the column unnoticed, and never is existing data rewritten by the migration. | Mutation in a scratch copy: delete the `domain.ts` line, `npm run typecheck` fails in `assert-model.ts`. The migration file holds only `CREATE TYPE` and `ADD COLUMN`. | Both assertions in `assert-model.ts`; `drizzle/0004_*.sql` and its snapshot; `git diff main -- src/lib/server src/app/api` prints nothing. |
| INV-026 | Never does a capturer who never groups see a change. | Stored rows compared to today's, apart from ids, ranks, clock values and `groupKind: null`. e2e counts taps and reads the toolbar's controls. | The 7 routes of the previous entry's INV-002; `toolbar-stable` and `toolbar-contextual` controls and order; a selection with no group gets no new control beyond those its shape offers. |
| INV-027 | Never is a bracket illegible at actual size. | **Person-level pass** (`quickstart.md` §6). INV-024 is the automated half. | A plain bracket on all 4 surfaces; a selected one; numerals 2 to 16 on the control × 2 themes. Owed after merge, and is SC-008 and FR-038. |

Selection sizes in INV-001 with the tuplet offered are limited to one bar and 16 columns, so the
count of 468 is a ceiling, not a target.

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002, FR-003 | INV-006, INV-009 |
| FR-004 | INV-006, INV-010 |
| FR-005 | INV-006 |
| FR-006 | INV-001, INV-009 |
| FR-007 | INV-009, INV-011 |
| FR-008 | INV-025 |
| FR-009 | INV-002 |
| FR-010 | INV-003 |
| FR-011, FR-012 | INV-001, INV-012, INV-016 |
| FR-013 | INV-004, INV-005 |
| FR-014 | INV-004, INV-005 |
| FR-015 | INV-007 |
| FR-016 | INV-008 |
| FR-017 | INV-012 |
| FR-018, FR-020 | INV-013 (see Deviation 1) |
| FR-019 | INV-014 |
| FR-021 | INV-015 |
| FR-022, FR-023, FR-024, FR-025 | INV-016, INV-017 |
| FR-026, FR-027 | INV-018 |
| FR-028, FR-029 | INV-019 |
| FR-030 | INV-020 |
| FR-031 | INV-021 |
| FR-032 | INV-021, INV-022 |
| FR-033 | INV-023 |
| FR-034 | INV-024, INV-027 |
| FR-035 | INV-001, INV-003, INV-004, INV-009, INV-012, INV-023 |
| FR-036, FR-037 | *Existing tests this changes on purpose*, INV-020 |
| FR-038 | INV-027 |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| The numeral on the control and the number stored | Both are the length of `groupOffer(...).tuplet`. The write takes no count. |
| What the toolbar offers and what the write does | `CaptureScreen` and `groupSelection` both call `columnRange` then `groupOffer`. |
| The number on the staff, in the export, and in the sheet | All three go through `groupNumber`. |
| The triplet button and `tripletFromTail` | The same `groupRunEndingAt`, over the same `runEndingAt`. |
| The three group fields | `NO_GROUP` and `regroup` are the only places they are written together. |
| A plain bracket's extents and a counted one's | The same lines of `tupletRow`, with an empty label. |
| Staff and export | Both read `tupletSpans`. |
| The app's tuplet cap and the wire's | `protocol.ts` imports `MAX_TUPLET_COLUMNS`. |
| The wire's values and the type | `z.enum(GROUP_KINDS)`, and `GroupKind` derives from the same array. |
| SQL and the model | `assert-model.ts`, including the new field assertion. The literal in `domain.ts` is the one copy, and the compiler checks it. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Deletion**: regrouping takes a column from another group. | Dissolve that group whole, columns outside the selection included, with no prompt and no undo. | FR-013. A remnant would print a number it no longer has. Only bracket data is lost, and regrouping restores it. | INV-004, INV-008 |
| **Deletion**: ungroup removes columns outside the selection. | Yes, every column of each affected group in the part, with no prompt and no undo. | FR-014. Notes are untouched, and it takes one selection to make the group again. | INV-004, INV-008 |
| **Deletion**: a group's tombstoned columns. | Leave them. Only live columns are read and written. | Nothing restores a column today, and writing tombstones would push rows nobody can see. If undelete ever ships, it must handle this. | INV-005 |
| **Deletion**: the stored count of a plain group. | Not stored. Regrouping a counted tuplet as plain discards its number. | FR-002. The selection's length is the number, so regrouping recovers it. | INV-001, INV-006 |
| **Deletion**: `src/lib/__tests__/storage-fence.test.ts` and `groupAsTuplet`. | Remove both. | FR-036 for the first. The second has one caller and lets a caller state a false count. | INV-002, INV-025 |
| **Data rewrite**: existing rows. | None. No backfill, no Dexie upgrade, no repair of cross-bar groups. | Null reads correctly, an upgrade cannot reach the outbox, and FR-006 needs absence handled anyway. | INV-009, INV-025 |
| **Migration order**: the server meeting an unmigrated table. | Unchanged process: `migrate.mjs` runs before `server.js`. The migration is additive, so an old server keeps working against it. | Without the column every event upsert would fail. | INV-025 |
| **Refusal**: a triplet that cannot be true. | Write nothing, and say why on the status line. | FR-024. A false 3 is what this entry removes. | INV-016, INV-017 |
| **Refusal**: a row the wire would reject. | Unreachable from any selection. Plain groups store no count, and tuplets stop at 16. | One bad row stops a device syncing. | INV-001, INV-010 |
| **Merging**: two people group overlapping columns. | Later write wins per column. A partial group can result, and either person can regroup. | Spec edge case. A group has no row of its own to merge. | INV-006 |
| **Authority**: who may group. | Unchanged. No new role check, no new route. A viewer's push is already refused. | Grouping is an ordinary field write. | INV-025 |
| **Money** | None involved. | | |

### Deviations and corrections, all cheap to overturn

1. **The selection toolbar moves to the row-2 slot, under the stable toolbar.** FR-018 says copy,
   cut and delete "keep their places". This plan keeps their **order**, and changes their
   position on screen by about 105 px, because FR-020 cannot otherwise be met well: `main`
   hides a string with four controls (research R9). The band goes from 108.8 px to 170 px and
   the staff no longer jumps. **To overturn**: put the row back above `toolbar-stable` on one
   line and put the message in the slot. That keeps their exact position at a band of 146.8 px,
   holds five strings, and clips a six-string part by 2 px.
2. **`properties.test.ts:84` is edited**, adding `"group"` to one list. It pins
   `COLUMN_PROPERTIES` to exactly four ids, so FR-027 ("one more entry in the existing list")
   and FR-037 ("every other existing test") cannot both hold literally. FR-027 is the specific
   requirement, and FR-037 names the exact-string and presence tests as what it protects, which
   this is not. **To overturn**: keep the entry out of `COLUMN_PROPERTIES`, which then needs a
   second list.
3. **FR-034 is wider than the spec measured.** `--text-faint` is 2.16:1 and 2.75:1 on the
   selection band, so the bracket switches to `--text-dim` on selected columns (research R11).
   Colours on every other surface are unchanged.
4. **`EventRow.groupKind` is optional in the type**, which blinds `_Events` to this one field,
   so `assert-model.ts` gains a second assertion (research R1). FR-008 is met by mutation, not
   by leaving the file alone.
5. **The spec's "existing lifetime" for the status line does not exist.** That line is derived
   each render, so the refusal is too (research R8).
6. **A stored count beats a `"plain"` kind** when both are present, a state only an older cached
   device can make (research R2). The spec does not cover it.

### Existing tests this changes on purpose

| Test | Change | Why |
|---|---|---|
| `src/lib/__tests__/storage-fence.test.ts` | Delete the file | FR-036 |
| `src/lib/local/__tests__/editing.test.ts:340` "skips barlines when grouping from the tail" | Assert no write across the bar, keeping "a barline never joins a group" | FR-037 |
| `src/lib/capture/__tests__/properties.test.ts:84` | Add `"group"` to the list | Deviation 2 |

Every other test stays unedited, including `ascii.test.ts`, `text.test.ts`, `controls.test.ts`,
`clipboard.test.ts` and the e2e specs. New cases go in new files.

## Project Structure

### Documentation (this feature)

```text
specs/003-generalised-grouping/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── notation.md      #   the normative bracket grammar `ascii-import` will parse
│   ├── writes.md        #   model declarations, grouping rules, writes, wire, schema
│   └── components.md    #   glyph, selection toolbar, triplet button, sheet, staff, CSS, test hooks
├── checklists/          # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
drizzle/
├── 0004_group_kind.sql               # NEW, generated: enum and column
└── meta/                             # MODIFIED, generated: snapshot and journal
src/
├── db/schema/
│   ├── domain.ts                     # MODIFIED: group_kind enum and column
│   └── assert-model.ts               # MODIFIED: _EventGroupKind
├── lib/
│   ├── model.ts                      # MODIFIED: groupKind, GROUP_KINDS, limits, NO_GROUP, groupNumber
│   ├── sync/
│   │   ├── protocol.ts               # MODIFIED: groupKind, shared tupletCount limits
│   │   └── __tests__/group-kind.test.ts      # NEW: INV-009, INV-010, merge half of INV-006
│   ├── capture/
│   │   ├── grouping.ts               # NEW: groupOffer, runEndingAt, TRIPLET_REFUSAL
│   │   ├── properties.ts             # MODIFIED: `group` entry, optional heading
│   │   └── __tests__/
│   │       ├── grouping.test.ts      # NEW: INV-012 truth table
│   │       └── properties.test.ts    # MODIFIED: Deviation 2
│   ├── local/
│   │   ├── editing.ts                # MODIFIED: groupSelection, groupRunEndingAt, regroup, ungroupTuplet
│   │   ├── clipboard.ts              # MODIFIED: carries groupKind
│   │   └── __tests__/
│   │       ├── grouping-writes.test.ts       # NEW: INV-001, 003 to 008, 011, 016
│   │       └── editing.test.ts       # MODIFIED: FR-037
│   ├── tab/
│   │   ├── layout.ts                 # MODIFIED: bracketNumber, nullable span count
│   │   ├── ascii.ts                  # MODIFIED: empty label for a plain span
│   │   └── __tests__/grouping.test.ts        # NEW: INV-021, INV-023, exact strings
│   └── __tests__/storage-fence.test.ts       # REMOVED: FR-036
├── components/
│   ├── capture/
│   │   ├── CaptureScreen.tsx         # MODIFIED: selection row, triplet call, refusal
│   │   ├── ColumnInspector.tsx       # MODIFIED: one expression, heading
│   │   └── __tests__/ColumnInspector-group.test.tsx  # NEW: INV-018
│   ├── icons/
│   │   ├── index.tsx                 # MODIFIED: BracketGlyph
│   │   └── __tests__/BracketGlyph.test.tsx   # NEW: INV-019 markup half
│   └── tab/TabStaff.tsx              # MODIFIED (CRLF): nullable count, bracket classes, test hooks
└── app/globals.css                   # MODIFIED: .tab-bracket, .tab-bracket-label
e2e/
├── grouping-helpers.ts               # NEW: selection and bracket drivers
├── grouping.spec.ts                  # NEW: stories, INV-002, 012, 014 to 019
├── grouping-layout.spec.ts           # NEW: INV-013, 022, 024
└── grouping-sync.spec.ts             # NEW: US2 scenario 6, INV-009's queued row (skips with no database)
```

**Structure Decision**: Single Next.js package, unchanged. Domain rules stay in `src/lib/`,
testable in the node environment, and presentation stays in `src/components/`. The new module
sits in `src/lib/capture/` beside `target.ts` and `latches.ts`, which answer the same kind of
question for the same screen, and imports only `model.ts` so `editing.ts` can use it. Nothing
under `src/app/api/`, `src/lib/server/` or `src/lib/local/db.ts` is touched.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. One judgement call adds a little structure:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A second assertion in `assert-model.ts` for one field | An optional field is invisible to `_Events`. **Ran**: deleting the column passed `tsc`. | A required field breaks 11 test files, which FR-037 forbids. Leaving the gap would weaken the guard, which FR-008 forbids. |

## Open for the human

Not blocking. Planning proceeded under the recorded decisions.

1. **The toolbar's new position** (Deviation 1) is the one to look at. It is the plan's largest
   reading of the spec, and the person-level pass in `quickstart.md` §6 asks about it directly.
2. **`properties.test.ts:84`** (Deviation 2) is an edit FR-037 did not list.
3. **The constitution is still the scaffold template**, as for the previous entries.
   `/speckit-constitution` would give the remaining roadmap entries something firmer than
   `docs/DECISIONS.md` to check against.
4. **The browser pass is owed after merge** (`quickstart.md` §6). SC-008 and FR-038 stay
   unverified until a person does it, and the two-digit numeral and the empty bracket are the
   likeliest things to need adjusting.
