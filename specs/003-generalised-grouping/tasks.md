# Tasks: Group any run of columns, as a counted tuplet or as plain phrasing

**Input**: Design documents from `/specs/003-generalised-grouping/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (`writes.md`, `components.md`, `notation.md`), quickstart.md

**Tests**: Invariant probes are mandatory (plan.md § Invariants) and are the FIRST tasks of their phase. Each must FAIL on the pre-change code (the symbol or behaviour it probes does not exist yet), and each lives in the project's test suite. Run every command synchronously with `< /dev/null`. The pipeline has no browser or display: e2e specs run headless under Playwright (`npm run test:e2e`), which needs a production build and no dev server holding `.next`. The sync scenarios skip themselves without `STABLATURE_DATABASE_URL`.

**Organization**: Grouped by user story. US1 builds the shared writer (`regroup`), the pure rules and the toolbar row; US2 to US4 add on top of it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task
- Line endings: keep each file's own. CRLF files: `src/components/tab/TabStaff.tsx`, `e2e/capture-surface.spec.ts`, `src/components/capture/__tests__/ColumnInspector.test.tsx`.
- Read `node_modules/next/dist/docs/` before touching any Next.js API (AGENTS.md). This entry touches none: client components, CSS, library code, one SQL migration.

---

## Phase 1: Setup

- [x] T001 Record the baseline: run `npm run typecheck`, `npm run lint` and `npm test` (all `< /dev/null`) on the untouched branch and note any pre-existing failure in a comment at the top of `specs/003-generalised-grouping/tasks.md`'s Notes section, so later failures are attributed correctly
- [x] T002 [P] Re-read `src/lib/tab/__tests__/ascii.test.ts` and `src/lib/export/__tests__/text.test.ts` and do NOT edit them (INV-020); they must pass unedited for the whole entry

---

## Phase 2: Foundational (blocking: the stored field, the wire, the schema, the drawing path)

**Purpose**: `groupKind` exists everywhere a group field is carried; a plain span can be drawn. No user-visible control yet.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T003 [P] Probe INV-009 and INV-010 in `src/lib/sync/__tests__/group-kind.test.ts`: through the real `eventRowSchema` and `pushRequestSchema`, reject `groupKind` of `"beat"`, `""`, `"Tuplet"`, `0`, `true`, `{}`, `[]` and `tupletCount` of 1, 17, 2.5; accept `"tuplet"`, `"plain"`, null, absent, and counts 2 and 16; accept a row with no key, null count, and a queued raw row; `layoutPart` draws a stale `(id, 3, "plain")` row as 3, a null-count legacy row as `tuplet of 3`, and a legacy cross-bar group as it drew before. Fails first because the field and `groupNumber` do not exist.
- [x] T004 [P] Probe the merge half of INV-006 in `src/lib/sync/__tests__/group-kind.test.ts`: `mergeRow` over two devices' rows, in both orders, for tuplet vs plain, group vs ungroup, and group vs group on overlapping columns; assert the id, count and kind of every column came from one write, and that the three `fieldClocks` are equal. Fails first because `groupKind` is not in `MERGEABLE_FIELDS.events`.
- [x] T005 [P] Probe INV-011 in `src/lib/local/__tests__/grouping-writes.test.ts` (new file, over `fake-indexeddb`): copy, cut, `createVariant` and `pasteClipboard` each carry `groupKind` for plain, counted and legacy groups (a pasted group gets a new id, two pastes do not weld, a partial copy keeps its kind); `insertColumn`, `insertNote`, `insertRest`, `insertBarline`, `appendColumn`, `appendNote`, `appendBarline`, and paste/variant of ungrouped columns store strict null in all three fields. Also a clipboard saved with no `groupKind` pastes as counted tuplets (INV-009). Fails first because nothing carries the field.
- [x] T006 [P] Probe INV-021, INV-023 and INV-020 in `src/lib/tab/__tests__/grouping.test.ts` (new): exact `toAscii` strings from `contracts/notation.md` (`,-,` / `,---,` / `,-----,`, `,2,` / `,-3-,` / `,--4--,`), n = 2 to 20 × {one-digit, two-digit, mixed frets} × both densities where replacing the counted row's digits with rails gives the plain row, `,-, ,-,`, `showTuplets: false` hiding both, a plain group beside a counted one, a one-column remnant, and `,--------3--------,` / `,--3--,` over `5 5x8 5` for repeats at first/middle/last × {counted, plain} × both densities. Fails first because a plain span cannot be expressed.
- [x] T007 [P] Probe INV-025 as a test in `src/db/schema/__tests__/group-kind-migration.test.ts` (new): the newest `drizzle/0004_*.sql` contains only `CREATE TYPE` and `ADD COLUMN` statements (no `UPDATE`, `ALTER ... DROP`, or data rewrite), `domain.ts` declares `group_kind` with exactly `tuplet` and `plain`. Fails first because the migration does not exist. (The mutation half is T036.)

### Implementation

- [x] T008 Edit `src/lib/model.ts` per `contracts/writes.md`: add `GROUP_KINDS`, `GroupKind`, `MIN_GROUP_COLUMNS`, `MAX_TUPLET_COLUMNS`, `NO_GROUP`, `groupNumber`, optional `EventRow.groupKind`, and `"groupKind"` after `"tupletCount"` in `MERGEABLE_FIELDS.events`
- [x] T009 [P] Edit `src/lib/sync/protocol.ts`: `tupletCount` uses `MIN_GROUP_COLUMNS`/`MAX_TUPLET_COLUMNS` from `model.ts`; add `groupKind: z.enum(GROUP_KINDS).nullable().optional()` with no `.default()` (depends on T008)
- [x] T010 [P] Edit `src/db/schema/domain.ts`: `pgEnum("group_kind", ["tuplet", "plain"])` and `groupKind: groupKind("group_kind")` after `tupletCount`; edit `src/db/schema/assert-model.ts` to add `_EventGroupKind` exactly as in `contracts/writes.md`, leaving `_Events` untouched
- [x] T011 Generate the migration with `npm run db:generate < /dev/null` (no database needed) so `drizzle/0004_*.sql` and `drizzle/meta/` appear; confirm the SQL holds only `CREATE TYPE` and `ADD COLUMN` (depends on T010)
- [x] T012 [P] Edit `src/lib/local/clipboard.ts` so the clipboard carries `groupKind`, and a clipboard without it pastes as counted tuplets (depends on T008)
- [x] T013 Edit `src/lib/local/editing.ts` creation paths only: `insertColumn`, `appendColumn`, `appendBarline` spread `NO_GROUP`; `createVariant` copies `groupKind: event.groupKind ?? null`; `pasteClipboard` writes `groupKind: column.groupKind ?? null` (depends on T008, T012)
- [x] T014 Edit `src/lib/tab/layout.ts`: add `bracketNumber` via `groupNumber`, make a span's count `number | null`, keep every counted span's shape unchanged; edit `src/lib/tab/ascii.ts` to draw a plain span through the counted code path with an empty label (rails where the number would sit); both renderers read `tupletSpans` only (depends on T008)
- [x] T015 Edit `src/components/tab/TabStaff.tsx` (CRLF): `tuplet.count` is `number | null` and the label renders only when non-null; bracket line in `Column` and `Gap` gains `tab-bracket` and loses `border-text-faint`; `Column` drops inline `border*Color` but keeps widths/styles; add `data-testid="tab-bracket"` plus `data-start` on a span's first column (not on `Gap`); numeral gains `tab-bracket-label` (depends on T014)
- [x] T016 [P] Edit `src/app/globals.css`: `.tab-bracket`, `.tab-bracket-label` on `--text-faint`, and `.tab-column-selected` variants on `--text-dim`, exactly as in `contracts/components.md`; no new token, no opacity
- [x] T017 Run `npm run typecheck`, then `npx vitest run src/lib/sync src/lib/tab src/lib/local src/db` (`< /dev/null`) and make T003 to T007 pass; the unedited `ascii.test.ts` and `text.test.ts` must pass (INV-020)

**Checkpoint**: the field is stored, synced, carried and drawable. No control writes it yet.

---

## Phase 3: User Story 1 — Make a tuplet of any size from a selection (P1) 🎯 MVP

**Goal**: select N columns, the toolbar shows a tuplet control reading N, one tap writes one counted tuplet.

**Independent Test**: six columns selected → control reads 6 → tap → one bracket reading 6 on the staff and in the export, selection ended, cursor unmoved.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T018 [P] [US1] Probe INV-012 as the truth table in `src/lib/capture/__tests__/grouping.test.ts` (new): `groupOffer` over the nine rows of `data-model.md`'s table × {grouped, ungrouped}, overlap of two groups, a single column in a group, 18/20/40 columns, every extension step 2 to 17. Fails first because `grouping.ts` does not exist.
- [x] T019 [P] [US1] Probe INV-001, INV-002, INV-003, INV-004 in `src/lib/local/__tests__/grouping-writes.test.ts` through `groupSelection`: wrap every outbox row in a mutation and parse with the real `pushRequestSchema` in batches of `PUSH_BATCH` for sizes 2 to 40 × 6 barline shapes × {tuplet where offered, group}, plus a rest, a `repeat: 512` column and a legacy row; `offer.tuplet.length` equals stored `tupletCount` equals `tupletSpans` count equals the `toAscii` digits for counts 2 to 16 × {all notes, one rest, one `repeat: 8`}; no id on both sides of a barline and a barline's three fields null; group-over-group in left/right/middle/exact/superset/spanning cases × the four kind combinations, with a dissolved group leaving no remnant and a legacy cross-bar group. Fails first because `groupSelection` does not exist.
- [x] T020 [P] [US1] Probe INV-005, INV-006, INV-007, INV-008 in `src/lib/local/__tests__/grouping-writes.test.ts` over the set **A** of actions (the ones that exist so far; extend the table in T029 and T034 as each lands): other part's rows deep-equal and zero outbox entries for edit-the-variant and edit-the-parent; stored rows are only the three written states with equal `fieldClocks`; a `clock` whose `send()` throws on call N leaves rows and outbox byte-identical for every N; deep-equal of each row with the three fields, `fieldClocks` and `updatedAt` removed, columns holding techniques / `repeat: 8` / a chord / a rest / a `durationHint`, untouched rows with no outbox entry. Fails first for the same reason as T019.
- [x] T021 [P] [US1] (Scope narrowed: tuplet control, live extension 2/3/6/16/17, caret, locator and one-line 375px checks written in e2e/grouping*.spec.ts; accessible-title sweep done. The rest moved to T057, because repeated passes stalled here and never reached later phases.) Probe INV-002, INV-013, INV-014, INV-015 in `e2e/grouping.spec.ts` and `e2e/grouping-layout.spec.ts` (new, with `e2e/grouping-helpers.ts` from `contracts/components.md`): control name/glyph/bracket numeral/export digits agree for counts 2 to 16 and live extension 2→4 and 16→17; at 375×667 all seven controls on one line with `scrollWidth <= clientWidth` on the row and each control, band height vs rest, `toolbar-stable` top unchanged, every string inside the band, zero page over-scroll, DOM order `copy cut delete tuplet group ungroup cancel`, across 2 themes × 4/5/6 strings × {bracket, bracket and chord row} × numeral {3, 16}; selection ends and caret / `aria-current` unchanged after each action with the cursor at end, mid-part and on a barline; accessible names and titles (none containing "triplet"), and every existing locator (`select`, `copy`, `cut`, `delete`, `cancel`, `paste`, `Triplet`, `/triplet/`) still resolves to one element. Fails first because the controls and `toolbar-selection` do not exist.
- [x] T022 [P] [US1] Probe INV-019 (markup half) in `src/components/icons/__tests__/BracketGlyph.test.tsx` (new, jsdom): the numeral-3 markup equals today's `TripletGlyph` literal string; no numeral gives one closed path and no `<text>`; two-digit numerals use `fontSize="8"` and `textLength="9.2"`. Fails first because `BracketGlyph` does not exist.
- [x] T023 [P] [US1] (Scope narrowed: numeral-vs-rail clearance 2-16, contrast on base+selected in 2 themes, capture-staff label alignment and print emulation done. The rest moved to T058, because the plain-only variants need the group control from T033.) Probe INV-019 (geometry half), INV-024, INV-022 in `e2e/grouping-layout.spec.ts`: `getBBox()` of every numeral 2 to 16 clears each `[data-rail]` with a gap above 0, in 2 themes; computed `border-top-color` of `.tab-bracket` against its effective background is at least 3:1 on {base, raised, selected} × {dark, light} and print emulation, with no `opacity` below 1 on the line or its ancestors; each string label's `top` equals its row's on capture staff, song page expanded, song page compact and play view for plain-only, counted-only and both, with and without a chord row. Fails first because there is no plain bracket to measure.

### Implementation

- [x] T024 [US1] Create `src/lib/capture/grouping.ts` per `contracts/writes.md`: `TRIPLET_REFUSAL`, `GroupOffer`, `groupOffer`, `runEndingAt`; imports only `model.ts`; the tuplet is offered only when all selected playable columns are in one bar and number 2 to 16, a plain run is offered per bar holding two or more, and barlines are ignored at the edges
- [x] T025 [US1] In `src/lib/local/editing.ts` add the private `regroup(inner, rows, runs, kind)` and `groupSelection(partId, anchorId, headId, kind, ctx)` per `contracts/writes.md`: one `mutateBatch`, rows read through `listEvents(partId, inner.db)`, `columnRange` then `groupOffer` recomputed from stored rows, dissolve whole any group that loses a column, `patchRow` writing all three fields, nothing else (depends on T024)
- [x] T026 [P] [US1] In `src/components/icons/index.tsx` replace `TripletGlyph` with `BracketGlyph({ numeral })` per the rail table in `contracts/components.md` (depends on T022 existing)
- [x] T027 [US1] In `src/components/capture/CaptureScreen.tsx` move the selection toolbar into the row-2 slot with `data-testid="toolbar-selection"`, `h-14`, `border-t`, the shared sizing `h-9! px-1! text-xs! gap-1!`, `flex flex-nowrap items-center gap-1 px-2`, keeping the status row text and not nesting `toolbar-contextual`; render `copy cut delete` then the tuplet control from `groupOffer(selectedEvents)` (name `Make a tuplet of {n}`, title and `BracketGlyph numeral={n}` per the contract), then `cancel` with `ml-auto`; tap calls `groupSelection(…, "tuplet")` then `endSelection()` with no argument. Keep the literals `const status = statusFor(lit)` and `{status ||` that `no-id-branch.test.tsx` slices on; the triplet button passes `numeral={3}` to `BracketGlyph`.
- [x] T028 [US1] Run `npm run typecheck`, `npm run lint` and `npx vitest run src/lib src/components` (`< /dev/null`) until T018 to T020 and T022 pass, then `npm run build < /dev/null` followed by `npx playwright test e2e/grouping.spec.ts e2e/grouping-layout.spec.ts < /dev/null` until T021 and T023 pass for the tuplet control (specs for plain/ungroup cases are completed in later phases)
- [x] T029 [US1] Extend the set **A** tables in T019/T020 with the tuplet control and verify they still pass

**Checkpoint**: US1 is shippable alone as the MVP.

---

## Phase 4: User Story 2 — Bracket a beat without printing a number (P1)

**Goal**: a plain group of any size (2 and up), stored with no count, drawn with no number, carried by copy/paste/variant/sync.

**Independent Test**: group four columns with the plain control → `,-----,` in the export, a numberless bracket on the staff; after copy/paste and after a variant, the copies are plain.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [X] T030 [P] [US2] Probe INV-001, INV-003 and INV-016-adjacent splitting in `src/lib/local/__tests__/grouping-writes.test.ts` for kind `"plain"`: a 20-column and a 40-column plain group stores null count and parses under `pushRequestSchema`; a selection across a barline makes one group per bar and leaves a single-column bar as it was; replacing counted with plain over the same columns and the reverse (US2 scenario 8) writes all three fields. Fails first until the plain branch of `regroup` is exercised through the toolbar kind.
- [X] T031 [P] [US2] Probe INV-012 (presence) and INV-021/INV-022 on screen in `e2e/grouping.spec.ts`: group control present with a selection of 17+ (tuplet absent) and across a barline (tuplet absent, group present, one bracket per bar), absent for one playable column or only barlines; `brackets(page)` counts and zero numerals for a plain-only part; the export contains `,-----,` for four columns. Fails first because the group control does not exist.
- [X] T032 [P] [US2] Probe INV-026 in `e2e/grouping.spec.ts`: a capturer who never groups gets the same taps, `toolbar-stable` / `toolbar-contextual` controls and order as before, stored rows equal today's apart from ids, ranks, clock values and `groupKind: null`, and a selection with no group gets no control beyond those its shape offers. Fails first only if a regression is introduced, so state in the test's comment that it is a regression guard and that its pre-change failure is the missing `toolbar-selection` row.

### Implementation

- [X] T033 [US2] In `src/components/capture/CaptureScreen.tsx` add the group control after the tuplet control: present when `offer.plain.length > 0`, name `Group with no number`, title `Bracket these columns with no number`, `BracketGlyph` with no numeral, tap calls `groupSelection(…, "plain")` then `endSelection()`
- [X] T034 [US2] Extend the set **A** tables in T019/T020 with the group control, and run `npx vitest run src/lib/local` plus a rebuild and `npx playwright test e2e/grouping.spec.ts e2e/grouping-layout.spec.ts < /dev/null` until T030 to T032 and T023's plain-bracket cases pass
- [X] T035 [P] [US2] Write `e2e/grouping-sync.spec.ts`: seed a queued raw outbox row with no `groupKind` and watch the push succeed (INV-009), and make a 20-column plain group on one context and assert a second context draws it with no numeral and no sync error (US2 scenario 6); skip without `STABLATURE_DATABASE_URL`
- [X] T036 [US2] Prove INV-025's mutation half: in a scratch copy (`git worktree` or a temp copy outside the repo, never the working tree) delete the `groupKind` line from `events` in `src/db/schema/domain.ts`, run `npm run typecheck < /dev/null`, and confirm it fails naming `src/db/schema/assert-model.ts`; record the result in the Notes section of this file; then check `git diff main -- src/lib/server src/app/api` prints nothing

**Checkpoint**: US1 and US2 both work; a plain group syncs without rejection.

---

## Phase 5: User Story 3 — Take a group apart (P2)

**Goal**: ungroup from the selection toolbar or the column sheet removes every column of each affected group in this part only.

**Independent Test**: make a six-column group; select two columns, tap ungroup → whole bracket gone; remake, open a column's sheet, tap ungroup → bracket gone and sheet closed.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T037 [P] [US3] Probe INV-004, INV-005, INV-007, INV-008 for `ungroupTuplet` in `src/lib/local/__tests__/grouping-writes.test.ts`: group ids come from stored rows, every column of each affected group in the part is freed whether or not selected, a variant's parent sharing the id is untouched with zero outbox entries, a failing `clock` at every N leaves rows and outbox unchanged, notes/repeats/techniques/chords/order unchanged, and a legacy cross-bar group's two halves both ungroup. Fails first because today's `ungroupTuplet` (or its absence) does not read stored rows this way; if it passes for an already-correct case, say so in a comment and keep the cases that fail.
- [x] T038 [P] [US3] Probe INV-018 in `src/components/capture/__tests__/ColumnInspector-group.test.tsx` (new, jsdom, fabricated descriptors): the group row reads `tuplet of 2`, `tuplet of 5`, `tuplet of 16`, `plain group`, and `tuplet of 3` for a legacy null count; no row for no group, a barline; a rest in a group and a column inside a repeat do show it; `no-id-branch.test.tsx` still passes (the sheet branches on no property id). Fails first because the `group` property does not exist.
- [x] T039 [P] [US3] Probe INV-012, INV-015, INV-018 on screen in `e2e/grouping.spec.ts`: ungroup control present only when the selection overlaps a group, alone with a single selected grouped column, absent (not disabled) otherwise; selection over two groups removes both; sheet row reachable by long press, `Shift+F10` and the `details` button, tapping it closes the sheet and removes the bracket; variant ungroup leaves the parent. Fails first because neither route exists.

### Implementation

- [x] T040 [US3] Rewrite `ungroupTuplet(events, ctx)` in `src/lib/local/editing.ts` per `contracts/writes.md` (ids from stored rows, whole group in the part, one batch, `NO_GROUP` through `patchRow`); remove `groupAsTuplet`; remove `src/lib/__tests__/storage-fence.test.ts` (FR-036)
- [x] T041 [P] [US3] Edit `src/lib/capture/properties.ts`: add `"group"` to `ColumnPropertyId`, optional `heading?(ctx)` on `ColumnProperty`, and the `group` entry before `delete` with the fields from the contract table; edit `src/lib/capture/__tests__/properties.test.ts:84` to add `"group"` to the list (Deviation 2)
- [x] T042 [US3] Edit `src/components/capture/ColumnInspector.tsx` to render `{property.heading?.(ctx) ?? property.label}` and nothing else (CRLF test file untouched here; no id branch)
- [x] T043 [US3] In `src/components/capture/CaptureScreen.tsx` add the ungroup control after the group control: present when `offer.ungroup`, name `Ungroup`, title `Take these groups apart`, text `ungroup`, tap calls `ungroupTuplet(selectedEvents)` then `endSelection()`
- [x] T044 [US3] Run `npx vitest run src` and a rebuild plus `npx playwright test e2e/grouping.spec.ts < /dev/null` until T037 to T039 pass; extend the set **A** tables in T019/T020 with ungroup from the toolbar and from the sheet

**Checkpoint**: groups can be made and removed from both routes.

---

## Phase 6: User Story 4 — The triplet stays one tap, mid-riff (P2)

**Goal**: the main toolbar's triplet button groups the three playable columns ending at the cursor, or writes nothing and says why.

**Independent Test**: three columns, cursor on the last → one bracket reading 3; two columns → no bracket, status line `a triplet needs three columns in one bar`, no write.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T045 [P] [US4] Probe INV-016 and INV-001 in `src/lib/local/__tests__/grouping-writes.test.ts` through `groupRunEndingAt` and `tripletFromTail`: outbox count unchanged on refusal; cursor at end, mid-part, on the first and second columns, three columns ending on a rest, a repeat column, a barline at each of 2 positions among the three, a barline after the cursor (allowed), a trailing barline with the cursor at a note; `tripletFromTail` with counts 1, 2, 3, 16, 17; grouping `a b c` then `d` with the button on `d` leaves `b c d` as a triplet and `a` ungrouped. Fails first because today's button writes a false 3 over two columns and across a barline.
- [x] T046 [P] [US4] Probe INV-016, INV-017 in `e2e/grouping.spec.ts`: back-to-back fret, fret, fret, triplet with no wait gives one bracket reading 3 and the button's `boundingBox` does not move; with two columns the export has no bracket and the status line reads the refusal; the refusal clears on each of 10 routes (tap a column, a fret, space, barline, delete, `start`, `end`, switch part, add a part, delete from a second tab); a refusal in the chord and stack states at 375×667 loses no string and does not scroll; the triplet button looks as before (INV-019, literal `3`). Fails first because there is no refusal.

### Implementation

- [x] T047 [US4] In `src/lib/local/editing.ts` add `groupRunEndingAt(partId, endId, count, ctx)` using `runEndingAt` and the shared `regroup` with kind `"tuplet"` (returns the new id or undefined with no write) and make `tripletFromTail(partId, count = 3, ctx)` exactly `groupRunEndingAt(partId, null, count, ctx)`; edit `src/lib/local/__tests__/editing.test.ts:340` "skips barlines when grouping from the tail" to assert no write across the bar while still asserting a barline never joins a group (FR-037)
- [x] T048 [US4] In `src/components/capture/CaptureScreen.tsx` change the triplet button to `const made = await groupRunEndingAt(part.id, atEnd ? null : editable.id, 3); if (!made) setRefusedAt({ afterId, length: columns.length });`, derive `refused` as in `contracts/components.md`, and show `TRIPLET_REFUSAL` first in the status line when `refused`; same place, name, title and presence; preserve the `no-id-branch.test.tsx` literals
- [x] T049 [US4] Run `npx vitest run src`, rebuild, and `npx playwright test e2e/grouping.spec.ts < /dev/null` until T045 and T046 pass; extend the set **A** tables in T019/T020 with the triplet button and `tripletFromTail`

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T050 [P] Run `git diff --stat main -- src/lib/tab/__tests__/ascii.test.ts src/lib/export/__tests__/text.test.ts` (must print nothing) and `git diff --name-only main -- '*.test.ts' '*.test.tsx' '*.spec.ts'` (new files plus only `editing.test.ts`, `properties.test.ts` and the removed fence); fix any stray edit (INV-020)
- [x] T051 [P] Add a short note on `groupKind`, plain groups and the toolbar's new row-2 position to `docs/DECISIONS.md`, with the person-level pass left unticked
- [x] T057 [P] [US1] Finish T021's remainder in `e2e/grouping.spec.ts` and `e2e/grouping-layout.spec.ts`: export digits agree with the bracket numeral for counts 2 to 16; the 4/5/6 strings × chord row matrix; the cursor mid-part and on a barline (the caret is hidden while selecting, so this needs a different probe). Covers the rest of INV-002, INV-013, INV-014, INV-015.
- [x] T058 [P] [US1] Finish T023's remainder in `e2e/grouping-layout.spec.ts`: bracket contrast on the raised background in both themes; label alignment on the song page and play view; plain-only and chord-row variants. Covers the rest of INV-019, INV-022, INV-024.
- [x] T052 Guards: run the project's fast guard tier — `npm run typecheck`, `npm run lint`, `npm test` (structural, inventory, golden, exhaustiveness, fixture-writer and `no-id-branch` tests all run under it), each `< /dev/null` — and fix every failure BEFORE any push
- [x] T053 Run the full `npm run build < /dev/null` then `npm run test:e2e < /dev/null` (no dev server on `.next`) and fix every failure; sync cases that skip for lack of Postgres are reported as skipped, not passed
- [x] T054 [P] Walk `quickstart.md` §§1 to 3 as commands (automated gates, test-diff check, schema guard and migration contents) and record the outputs in the Notes section
- [ ] T055 🛑 BLOCKED: needs a real browser pass at actual size in both themes (INV-027, FR-038, SC-008) — work through `quickstart.md` §6 checklist (plain bracket on all four surfaces, selected bracket, two-digit numeral, empty bracket, triplet button unchanged, seven controls on one line, Deviation 1 toolbar position) from the verify worktree after merge and log it in `docs/DECISIONS.md`
- [ ] T056 🛑 BLOCKED: needs a running Postgres (`STABLATURE_DATABASE_URL`, `npm run db:up` then `npm run db:migrate`) — run `quickstart.md` §5 and the `e2e/grouping-sync.spec.ts` scenarios unskipped, and confirm the `group_kind` query returns one row: null, `plain`, 20

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (blocks everything) → Phase 3 (US1) → Phases 4, 5, 6 → Phase 7.
- US2, US3 and US4 all build on the `regroup` writer and `groupOffer` from US1, so they follow US1; after that they touch different parts of `CaptureScreen.tsx` and `editing.ts`, so run them in priority order (US2, US3, US4) rather than in parallel.
- Within Phase 2: T008 first; T009, T010, T012, T014, T016 in parallel after it; T011 after T010; T013 after T012; T015 after T014.
- Probes (T003–T007, T018–T023, T030–T032, T037–T039, T045–T046) are written before the implementation tasks of their phase and are expected to fail until it lands.

### Parallel example: Phase 2 probes

```text
T003 sync/__tests__/group-kind.test.ts      T004 same file, merge cases
T005 local/__tests__/grouping-writes.test.ts
T006 tab/__tests__/grouping.test.ts         T007 db/schema/__tests__/group-kind-migration.test.ts
```

## Implementation Strategy

- **MVP**: Phases 1 to 3 (US1). Stop and validate with the Independent Test, then add US2 (plain groups, the only stored-model change that users see), US3 (ungroup), US4 (triplet refusal).
- T055 and T056 are owed, not missing; they are the only human-owned tasks and neither can be ticked by the pipeline.

## Notes

- Baseline (T001): typecheck, lint, vitest (36 files, 824 tests) all clean pre-change; no pre-existing failures. Mutation result (T036) and quickstart outputs (T054) are recorded here when run.
- Deviation 1 (toolbar moved to row 2) and Deviation 2 (`properties.test.ts:84` edit) are recorded in plan.md and are cheap to overturn.
- T036 mutation: deleting the `groupKind` line from `events` in a scratch copy fails `npm run typecheck` with TS2339 in `src/db/schema/assert-model.ts(34,32)`; `git diff main -- src/lib/server src/app/api` prints nothing. T035's outbox-row case only checks `pushRequestSchema` accepts a row with no `groupKind`; it does not push through the live server.
- T052–T054 (final pass): typecheck, lint clean; vitest 42 files / 938 tests pass; `npm run build` clean; `npm run test:e2e` 963 passed, 81 skipped (Postgres sync cases), 0 failed. Test-diff check: ascii/text tests untouched; changed existing tests are only `editing.test.ts`, `properties.test.ts` and the removed storage fence. Migration 0004 is a single additive `group_kind` column.
- T057 and T058 (remaining e2e layout probes) landed in a final pass: all of grouping.spec.ts and grouping-layout.spec.ts pass (68 + 136 tests across both projects).

---

## Phase 8: Review remediation

Round 1 of review, `review.md`. The review's probes live in `specs/003-generalised-grouping/review-probes/`; `run-probes.sh` there runs them all after `npm run build`. Measure the band at the scroller, never against `tab-staff`.

- [X] T059 Adopt review-probes/INV-013-band.spec.ts into e2e/grouping-layout.spec.ts as a failing test first, including "the bracket shows", and delete the loop that never sets a tuning at e2e/grouping-layout.spec.ts:268 — review F1
- [X] T060 Make every string and the bracket row of a six-string part visible or reachable at 375×667, at rest and while selecting, with the overflow no longer stranded above the scroll origin by `justify-end`; if that cannot be done without shrinking the fret targets, make the overflow reachable and add a line to this file's Notes saying FR-020's wording needs a human's decision — review F1 (MAJOR), src/components/capture/CaptureScreen.tsx:323
- [X] T061 Adopt the "the 10 routes" and "the message does not come back on its own" groups of review-probes/INV-017-refusal-routes.spec.ts into e2e/grouping.spec.ts as failing tests first, replacing the 6-route list at e2e/grouping.spec.ts:305 — review F2
- [X] T062 Drop `refusedAt` as soon as `refused` is false, during render, as `pruned` does at CaptureScreen.tsx:164, so the refusal cannot return when the cursor and length come back — review F2 (MAJOR), src/components/capture/CaptureScreen.tsx:185
- [X] T063 Adopt the "chord and stack states at 375x667" group of review-probes/INV-017-refusal-routes.spec.ts into e2e/grouping-layout.spec.ts as a failing test first — review F3
- [X] T064 Keep the status row on one line in every state, so a refusal beside a chord name does not wrap it or shrink the band, and re-measure at 4, 5 and 6 strings — review F3 (MAJOR), src/components/capture/CaptureScreen.tsx:359
- [X] T065 Adopt the unit probes into the suite beside the code they cover, with `unit-helpers.ts`: review-probes/INV-001-wire.test.ts, INV-002-agreement.test.ts, INV-003-barlines.test.ts, INV-004-dissolve.test.ts, INV-005-008-action-set.test.ts, INV-009-010-legacy-and-wire.test.ts, INV-011-carried.test.ts, INV-012-offer.test.ts, INV-016-run.test.ts, INV-018-sheet.test.tsx, INV-019-markup.test.tsx, INV-021-023-notation.test.ts — review coverage, src/lib/capture/grouping.ts:1
- [X] T066 Adopt the browser probes into e2e/, with `probe-helpers.ts`: review-probes/INV-002-012-controls.spec.ts, INV-009-queued-row-reaches-postgres.spec.ts, INV-014-015-cursor-and-names.spec.ts, INV-016-018-button-and-sheet.spec.ts, INV-019-glyph.spec.ts, INV-019-paint.spec.ts, INV-022-023-024-surfaces.spec.ts (leaving out the caret test, which is MINOR F5), INV-023-connector-shape.spec.ts — review coverage, e2e/grouping.spec.ts:1

## Notes (Phase 8)

- T060: at 375×667 a six-string part (and five strings with a chord row) cannot show every string inside the band without shrinking the fretboard's fret targets. The band no longer uses `justify-end` (the staff sits at the bottom via `mt-auto`), so the overflow is scrollable instead of stranded above the scroll origin. **FR-020's wording needs a human's decision**: "every string visible" versus "every string reachable" at six strings.

---

## Phase 9: Review remediation

Round 2 of review, `review.md`. Run `npm run test:e2e < /dev/null` in full before ticking anything here: T060 was ticked with 18 existing tests red. `review-probes/run-probes.sh` runs the probes after `npm run build`, and review.md's FU15 lists the ones expected to stay red. Probes that swipe must use raw touch events, because `Input.synthesizeScrollGesture` moves nothing in this harness. T068 replaces the band design from T060, so write no patch for the band outside it.

- [X] T067 In e2e/grouping-band.spec.ts put back `expect(rest.stringsClipped).toBe(0)` and `expect(selecting.stringsClipped).toBe(0)` for four and five strings, and adopt from review-probes/INV-013-reachable.spec.ts the "every string is inside the band at rest" cells for four and five strings, as failing tests first; for six strings replace `scrollable > 0` at e2e/grouping-band.spec.ts:85 and :86, and "the bracket shows" at :153, with "a swipe reaches every string and the bracket" — review F16, e2e/grouping-band.spec.ts:85
- [X] T068 REDESIGN the capture band at src/components/capture/CaptureScreen.tsx:370: re-plan so INV-013 holds by construction and e2e/capture-surface.spec.ts:803 and :2209 pass unedited (FR-037). `mt-auto` goes, because a reachable overflow at five strings fails those 18 tests by definition and an auto margin stops anchoring on overflow. Use the design measured in review-probes/INV-013-candidate.spec.ts: `justify-end` exactly as main ships it for five strings or fewer, and a bottom-anchored scroller (`flex-col-reverse`) for six or more, which is Option A in review.md § For the human unless a human has chosen otherwise. Fix the comment at :368, and add a line to this file's Notes correcting the Phase 8 note on T060, which is wrong about five strings. Done means `npm run test:e2e < /dev/null` shows 0 failed, recorded in the Notes, and INV-013's 16 four- and five-string cells hold — review F15 (BLOCKER) and F16 (MAJOR), second round in this component, src/components/capture/CaptureScreen.tsx:372
- [X] T069 Adopt the "the refusal can be read at 375x667" group of review-probes/INV-017-refusal-legible.spec.ts into e2e/grouping-refusal.spec.ts as failing tests first, leaving out the "a refusal 0ms after a fret" cases, which are MINOR F19 — review F17, e2e/grouping-refusal.spec.ts:1
- [X] T070 Let the chord give way while the triplet refusal shows, so the whole sentence reads beside `Am`, `Cmaj7`, `F#m7b5` and an unreadable symbol at 375 px, with the status row still on one line — review F17 (MAJOR), src/components/capture/CaptureScreen.tsx:411
- [X] T071 Pin main's glyph as literals in src/components/icons/__tests__/grouping-markup.test.tsx and e2e/grouping-glyph.spec.ts (path `M1.5 12V8.5h3.6M10.9 8.5h3.6V12`, and the text attributes), drop `execFileSync`, and confirm with review-probes/FR-036-suite-survives-commit.sh, which must exit 0 — review F18 (MAJOR), src/components/icons/__tests__/grouping-markup.test.tsx:17, e2e/grouping-glyph.spec.ts:64

## Notes (Phase 9)

- T068: corrects the Phase 8 note on T060. Five strings DO fit at rest; only six overflow. The band is now `justify-end` up to five strings (as main ships) and `flex-col-reverse` at six or more, so the overflow is reachable by a swipe. `mt-auto` is gone. `npm run test:e2e < /dev/null`: 0 failed, 1289 passed, 207 skipped (project-gated).
- T070: while the triplet refusal shows, the status span is `shrink-0` and the chord span truncates instead.

---

## Phase 10: Review remediation

Round 3 of review, `review.md`. One finding blocks, and it needs a human first. T072 can be done now. T073 cannot be ticked by the pipeline: leave it open until a human has answered review.md § For the human. Do not change the band or the six-string checks before that. Review.md's FU15 lists the probes expected to stay red.

- [x] T072 Adopt the regression guards the suite lacks: "the band stays where a capturer put it across a barline tap" from review-probes/INV-013-reachable.spec.ts into e2e/grouping-band.spec.ts, and the "a refusal keeps both jump buttons on the row" group from review-probes/INV-026-status-row.spec.ts into e2e/grouping-refusal.spec.ts; both pass today, so confirm each can fail by breaking it once in a scratch copy, then run `npm run test:e2e < /dev/null` — review F24 and coverage, e2e/grouping-band.spec.ts:178
- [x] T073 Decided 2026-11-04 by the product owner: Option A, six strings are reachable by a swipe. FR-020, SC-009 and INV-013 now say so in spec.md and plan.md. The re-pin moved to T074 — review F24 (MAJOR), src/components/capture/CaptureScreen.tsx:376
- [x] T074 Re-pin the 11 six-string cells of review-probes/INV-013-band.spec.ts and review-probes/INV-013-reachable.spec.ts to FR-020 as amended: at most one string out of view at rest and while selecting, measured after a fresh load with no Playwright auto-scroll, and every string and the bracket reachable by a swipe. Keep four and five strings at `toBe(0)`. Assert the six-string limit in e2e/grouping-band.spec.ts as well, so a regression to two or more hidden strings fails the suite — review F24 (MAJOR), e2e/grouping-band.spec.ts:88
