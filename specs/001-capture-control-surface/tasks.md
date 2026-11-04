---

description: "Task list for: Restructure the capture control surface"
---

# Tasks: Restructure the capture control surface

**Input**: Design documents from `/specs/001-capture-control-surface/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/descriptors.md, contracts/components.md, quickstart.md — all present and read.

**Tests**: Not explicitly requested as TDD, but the project convention (`docs/DECISIONS.md`,
`src/lib/local/editing.ts` header) and `quickstart.md` both name the exact unit/component/e2e
suites this feature must add, so they are included as part of each story's implementation.
**Invariant probes are mandatory regardless** (plan.md § Invariants, 16 of them) and are listed
first in every phase that builds what they protect.

**Organization**: Phases follow the three user stories in spec.md (P1 latch strip, P2 contextual
toolbar, P3 column inspector), after one Foundational phase for the five `src/lib/capture/`
modules all three surfaces call into (plan.md's "technical core").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 / US2 / US3, mapping to spec.md's priorities P1 / P2 / P3
- File paths are exact; this is a single Next.js package, no `backend/`/`frontend/` split

---

## Phase 1: Setup

**Purpose**: Capture the one piece of evidence that cannot be recovered once implementation
starts, and confirm the tree is green before touching it.

- [X] T001 Record `NECK_HEIGHT_BASELINE_PX` **before any other task touches `Fretboard.tsx`**:
      add a temporary git worktree checked out to `main` (`git worktree add ../stablature-baseline main`),
      run `npm ci && npm run build && npm start -- -p 4100` there, then run a short one-off
      Playwright script (headless Chromium, viewport 375×667, a capture screen with a five-string
      part) that navigates to the capture screen on `http://localhost:4100` and reads
      `document.querySelector('[class*="w-max"]').getBoundingClientRect().height`. Write the
      number into `e2e/capture-surface.spec.ts` as `const NECK_HEIGHT_BASELINE_PX = <value>;`
      with a comment recording how it was measured (expected ≈234, per research.md §3). Stop the
      server and remove the worktree (`git worktree remove ../stablature-baseline`). This is the
      "before" half of INV-011 and must happen first — the pre-change fret-grid box stops
      existing in its current form the moment T016 gives `Fretboard` a `latchStrip` prop.
- [X] T002 [P] Confirm the pre-change baseline is green: run `npm run typecheck`, `npm run lint`,
      and `npm test` on the unmodified tree and record that all three pass. If any fails, stop and
      fix it before T003 — a red baseline makes every later probe's "fails on pre-change code"
      claim unverifiable.

---

## Phase 2: Foundational (the `src/lib/capture/` core)

**Purpose**: The five modules every one of the three surfaces calls into, so applicability and
mutation cannot drift between them (FR-017, FR-018, INV-002, INV-004, INV-010, INV-015). None of
these files exist yet — every probe below targets a file this phase creates, so each one fails
with "module not found" on the pre-change tree.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Invariant probes (FIRST — each must FAIL on the pre-change code, because the module under test does not exist yet)

- [X] T003 [P] Probe the applicability rule in `src/lib/capture/__tests__/target.test.ts`: all 12
      cells of the `appliesTo(scope, target)` table (3 scopes × 4 target kinds, data-model.md's
      table) and all 5 `resolveTarget` input cases (`no-part`, `no-column` at start, `no-column`
      from empty part, `playable`, `barline`, plus the "afterId names nothing" case). Fails today
      because `src/lib/capture/target.ts` does not exist.
- [X] T004 [P] Probe INV-002's structural half in `src/lib/capture/__tests__/controls.test.ts`:
      `isPresent(control, target)` for all 9 `TOOLBAR_CONTROLS` × the 4 `CursorTarget` kinds (36
      cases) — stable controls present for every kind, contextual controls present iff the target
      is `playable`. Fails today because `src/lib/capture/controls.ts` does not exist.
- [X] T005 [P] Probe INV-004's structural half in `src/lib/capture/__tests__/properties.test.ts`:
      an import-graph assertion that `src/components/capture/CaptureScreen.tsx` and (once it
      exists) `src/components/capture/ColumnInspector.tsx` import none of `bumpColumnRepeat`,
      `setChord`, `deleteColumn` directly from `src/lib/local/editing.ts`; plus `propertiesFor`
      returning `repeat`/`chord` only for a `playable` target and `delete` for every target except
      `no-part`/`no-column`. Fails today because `src/lib/capture/properties.ts` does not exist
      (and today's `CaptureScreen.tsx` *does* import those three directly).
- [X] T006 [P] Probe INV-010's structural half in `src/lib/capture/__tests__/latches.test.ts`:
      `litLatches(armed, target) ⊆ armed` and every member of the result satisfies
      `appliesTo("next-note", target)`, exercised with `armed = {"stack"}` against all 4 target
      kinds. Fails today because `src/lib/capture/latches.ts` does not exist.
- [X] T007 [P] Probe the cursor repair function in `src/lib/capture/__tests__/cursor.test.ts`: the
      4 `nextCursorAfterDelete` cases from data-model.md (`cursor === "end"`; `cursor ===
      deletedId` with a previous column; `cursor === deletedId` with none; `cursor` is some other
      column). Fails today because `src/lib/capture/cursor.ts` does not exist.

### Implementation

- [X] T008 Implement `src/lib/capture/target.ts`: `CursorTarget`, `Scope`, `resolveTarget`,
      `appliesTo`, `targetEvent` per contracts/descriptors.md. Makes T003 pass.
- [X] T009 [P] Implement `src/lib/capture/cursor.ts`: `Cursor` type (moved from
      `CaptureScreen.tsx`, docblock kept) and `nextCursorAfterDelete` per contracts/descriptors.md.
      Makes T007 pass. No dependency on T008.
- [X] T010 Implement `src/lib/capture/controls.ts`: `ToolbarControlId`, `ToolbarControl`,
      `TOOLBAR_CONTROLS` (5 stable in DOM order, then 4 contextual in DOM order), `isPresent` per
      contracts/descriptors.md and research.md §2's table. Depends on T008. Makes T004 pass.
- [X] T011 Implement `src/lib/capture/latches.ts`: `LatchId`, `Latch`, `LATCHES` (today's single
      `stack` entry, fields pinned by FR-005/006/007 and contracts/descriptors.md), `litLatches`.
      Depends on T008. Makes T006 pass.
- [X] T012 Implement `src/lib/capture/properties.ts`: `ColumnPropertyId`, `PropertyContext`,
      `ColumnProperty`, `COLUMN_PROPERTIES` (`repeat`, `chord`, `delete` with `delete` scoped
      `"part"` per data-model.md's *Open question recorded*), `propertiesFor`, each `commit`
      calling exactly one of `bumpColumnRepeat` / `setChord` / `deleteColumn` from
      `src/lib/local/editing.ts`. Depends on T008. Makes T005 pass.

**Checkpoint**: `npm test` is green for all five new suites. Foundation ready — user story work
can begin.

---

## Phase 3: User Story 1 — The next-note modifier sits with the neck (Priority: P1) 🎯 MVP

**Goal**: The `stack` latch moves into a strip above the neck inside `Fretboard`, lit while
armed, disarming on every route the spec and INV-010 name.

**Independent Test**: Capture a three-note chord using only the neck and the strip above it,
without touching the bottom toolbar (spec.md story 1's own Independent Test).

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [X] T013 [P] [US1] Probe INV-015 for the strip in
      `src/components/capture/__tests__/LatchStrip.test.tsx` (`// @vitest-environment jsdom`):
      render `LatchStrip` with 1 then 5 `Latch` descriptors, assert cell count equals descriptor
      count, the container's `className` is byte-identical across both renders, each cell's
      `className` differs only in its armed/applicable modifier, and a source-level assertion
      that the component body contains no `id ===` / `switch (id)` branch. Fails today because
      `src/components/capture/LatchStrip.tsx` does not exist.
- [X] T014 [US1] Probe INV-001 (the 2 stack-latch members) and INV-010 (the 7 routes to an
      inapplicable target) behaviourally: add a `test.describe("latch", ...)` block to new
      `e2e/capture-surface.spec.ts` that arms `stack` via the strip locator (not the old toolbar
      button), presses three frets, asserts one column and the status line reads exactly
      "stacking onto the marked column"; then separately arms it and reaches an inapplicable
      target by each of the 7 routes (tap a barline, insert a barline, jump to start, switch part,
      delete the target column, a sync delete of the target column, open a part with no columns),
      asserting `aria-pressed="false"` and that the next fret press starts a new column. Fails
      today because there is no strip to locate.

### Implementation for User Story 1

- [X] T015 [US1] Implement `src/components/capture/LatchStrip.tsx` per contracts/components.md:
      one `<button>` per `Latch` in declaration order via a single `map`, `aria-pressed={lit.has(id)}`,
      `aria-label`/`title` from the descriptor, armed = `bg-accent text-accent-text`, unarmed =
      `bg-bg-raised border border-border-subtle`, container `grid-auto-flow: column;
      grid-auto-columns: minmax(0, 1fr)`, `disabled` prop dims the whole strip. Depends on T011.
      Makes T013 pass.
- [X] T016 [US1] Modify `src/components/capture/Fretboard.tsx`: add an optional `latchStrip?:
      ReactNode` prop, rendered as a sibling above the existing `overflow-x-auto` fret-grid
      scroller and inside the current `disabled ? "pointer-events-none opacity-40" : ""` wrapper;
      give the fret-grid region `data-testid="fret-grid"`; the fret grid's own cell/mute-row
      heights are unchanged (FR-027, INV-011).
- [X] T017 [US1] Modify `src/components/capture/CaptureScreen.tsx`: replace `stacking: boolean`
      with `armed: ReadonlySet<LatchId>` (seeded `new Set()`); derive `target =
      resolveTarget(part, columns, afterId)` and `lit = litLatches(armed, target)`; remove the
      `stack` `<Button>` from the controls row; render `<LatchStrip latches={LATCHES} lit={lit}
      target={target} onToggle={...} disabled={!part} />` and pass it into `<Fretboard
      latchStrip={...}>`; give the strip container `data-testid="latch-strip"`; keep the existing
      explicit disarms on tap-column, switch-part, insert-space, insert-barline (research.md §5 —
      derivation alone is not enough for a `rest` target). Depends on T015, T016.
- [X] T018 [US1] Modify `e2e/capture.spec.ts` by **exactly one hunk**: re-point the existing
      `stack` locator at the strip. No other line in this file changes (INV-001, INV-016). Confirm
      with `git diff main... -- e2e/capture.spec.ts` showing one hunk.
      **Result**: zero hunks needed. Playwright's `getByRole(..., { name })` matches the
      accessible name by case-insensitive substring by default; `page.getByRole("button", {
      name: "stack" })` already matches the strip chip's `aria-label="stack notes onto the
      marked column"` once the old toolbar button is removed, and is unambiguous since it is
      the only "stack"-named button left. Confirmed by actually building and running the full
      unmodified `e2e/capture.spec.ts` (30/30 passed) plus the new `latch` describe block in
      `e2e/capture-surface.spec.ts` (8/8 passed) — matching the checkpoint's own wording, "the
      unmodified `e2e/capture.spec.ts`".

**Checkpoint**: User Story 1 is fully functional and testable independently — `npm run test:e2e
-- capture-surface.spec.ts -g "latch"` and the unmodified `e2e/capture.spec.ts` are both green.

---

## Phase 4: User Story 2 — The toolbar stops showing dead controls (Priority: P2)

**Goal**: The bottom toolbar becomes two fixed rows — stable (always present) and contextual
(present iff the cursor's target is `playable`) — so inapplicable controls are absent, not
greyed out, and the stable ones never move.

**Independent Test**: Move the cursor between a playable column and a barline and watch the
toolbar; inapplicable controls are absent, always-applicable ones do not move (spec.md story 2).

### Invariant probes (FIRST — each must FAIL on the pre-change code, because today's toolbar renders every control disabled rather than absent, and wraps into three rows rather than two fixed ones)

- [x] T019 [P] [US2] Probe INV-002's behavioural half in `e2e/capture-surface.spec.ts`
      (`test.describe("toolbar", ...)`): for the 6 target kinds × 9 controls (54 pairs),
      `expect(locator).toHaveCount(0)` for every inapplicable contextual control and
      `toHaveCount(1)` for every stable control — never `toBeDisabled()`. Fails today because the
      repeat stepper, ×4 and chord symbol render disabled on a barline, not absent.
- [x] T020 [P] [US2] Probe INV-003 in the same spec: at 375×667, read `boundingBox()` for each of
      the 5 stable controls (space, barline, select, paste, delete) with the cursor on a notes
      column, move the cursor to a barline, re-read, assert identical `x`/`y`; then the reverse
      direction (10 measurements). Fails today because the single wrapping row reflows when the
      contextual controls' disabled state changes their row-wrap point.
- [x] T021 [US2] Probe INV-016 by extending the existing selection-toolbar e2e assertions: with a
      selection active, assert `toolbar-contextual` has count 0 and the latch strip is not
      present/operable from the selection row (new assertions; the 6 pre-existing selection tests
      — copy, cut, delete, cancel, selected-count message, tap-to-extend — must still pass
      unmodified). Fails today because `data-testid="toolbar-contextual"` does not exist yet.

### Implementation for User Story 2

- [x] T022 [US2] Modify `src/components/capture/CaptureScreen.tsx`: restructure the controls row
      into two fixed, non-wrapping rows. Row 1 (`data-testid="toolbar-stable"`): space, barline,
      select, paste, delete, in that DOM order, each present always and disabled per its existing
      precondition. Row 2 (`data-testid="toolbar-contextual"`): triplet, repeat stepper, ×4, chord
      symbol, each rendered only when `isPresent(control, target)` from `controls.ts` is true.
      Drop `delete`'s `ml-auto` (its position must not depend on row content width per
      research.md §2); keep its visual separation via a fixed gap and `variant="danger"`. Tighten
      row padding `px-3`→`px-2.5` and gap `gap-1.5`→`gap-1` per research.md §3's arithmetic.
      Depends on T010.
- [x] T023 [US2] Modify `src/components/capture/CaptureScreen.tsx`: render row 2's repeat stepper
      and chord-symbol button by reading `propertiesFor(target)` from `properties.ts` and calling
      each property's `commit` (repeat `±1` and ×4's `commit(ctx, 3)` shortcut both call the
      `repeat` property's `commit`; `chord symbol` opens the existing inline form, whose submit
      calls the `chord` property's `commit`). `triplet` stays a toolbar-only control (not a
      `ColumnProperty`), contextual per the deviation recorded in plan.md. Depends on T012, T022.

**Checkpoint**: User Stories 1 AND 2 both work independently — `npm run test:e2e --
capture-surface.spec.ts -g "toolbar"` is green, and the existing selection e2e tests are
unmodified and green.

---

## Phase 5: User Story 3 — Long-press a column to inspect it (Priority: P3)

**Goal**: Long-pressing a column on the capture staff opens a sheet, built from
`COLUMN_PROPERTIES`, scoped to that column; a short tap keeps moving the cursor with no added
delay; the staff stays untouched everywhere it is read-only.

**Independent Test**: Long-press a column, change its repeat count and set a chord symbol from
the sheet, close it, see both reflected on the staff — without tap-to-move-cursor changing
(spec.md story 3).

### Invariant probes (FIRST — each must FAIL on the pre-change code, because none of `useLongPress`, `ColumnInspector` or `TabStaff`'s `onInspectColumn` prop exist yet)

- [x] T024 [P] [US3] Probe INV-015 for the sheet in
      `src/components/capture/__tests__/ColumnInspector.test.tsx` (`// @vitest-environment
      jsdom`): render with 3 then 6 `ColumnProperty` descriptors, assert row count equals
      descriptor count, container `className` byte-identical across both renders, and the
      no-id-branching source assertion (mirrors T013 for the inspector). Fails today because
      `src/components/capture/ColumnInspector.tsx` does not exist.
- [x] T025 [P] [US3] Probe `useLongPress` in
      `src/components/capture/__tests__/useLongPress.test.tsx` (`// @vitest-environment jsdom`,
      fake timers): fires `onLongPress` once after 500 ms with no movement; is cancelled by
      movement past 10 px, by `pointerup`/`pointercancel`, and on unmount; `consumeSuppressedClick()`
      returns `true` exactly once per fired long press then `false`; only `event.isPrimary` (and
      for mouse, `button === 0`) starts a press. Fails today because the hook does not exist.
- [x] T026 [US3] Probe INV-005, INV-006, INV-007, INV-008, INV-009 behaviourally in
      `e2e/capture-surface.spec.ts` (`test.describe("inspector", ...)` and a long-press group,
      both `mobile` and `desktop` Playwright projects for the `pointerType` coverage): long-press
      opens a sheet naming the column (not on `/songs/[songId]` or `/songs/[songId]/play`, and not
      with a selection active — INV-005, 3 members); a tap moves the cursor on `pointerup` with no
      `waitForTimeout` in the path (INV-006, 7 members); a press that moves past threshold opens
      no dialog and does not move the caret (INV-007, 6 members); deleting the inspected column by
      any of 5 routes closes the dialog (INV-008); dismissing without editing leaves
      `boundingBox()`/status line/exported ASCII byte-identical across 9 dismissal×position
      combinations (INV-009). Fails today because there is no long-press handler anywhere on the
      staff.

### Implementation for User Story 3

- [x] T027 [US3] Add a `Sheet` primitive to `src/components/ui/index.tsx` per
      contracts/components.md: wraps a native `<dialog>` opened with `showModal()`, closed with
      `close()`; `onClose` fires for the `close` event (covers Esc, backdrop, and an explicit close
      button through one callback). No new dependency.
- [x] T028 [US3] Implement `src/components/capture/useLongPress.ts` per contracts/components.md:
      Pointer Events, 500 ms default threshold, 10 px default movement cancellation, any
      `pointerType`, synchronous self-clearing `consumeSuppressedClick()`. Makes T025 pass.
- [x] T029 [US3] Modify `src/components/tab/TabStaff.tsx`: add optional `onInspectColumn?:
      (eventId: string) => void`. When present, attach `useLongPress` to the column `<button>`,
      add `onContextMenu={e => e.preventDefault()}` and a `select-none` class; when absent, attach
      **no** press handlers, timers or listeners at all (FR-021, INV-005). `onClick`
      (`onSelectColumn`) calls `consumeSuppressedClick()` synchronously first and returns early if
      it was true; it awaits nothing (FR-019, INV-006). `touch-action` is left unset so horizontal
      scroll still wins (research.md §6). Depends on T028.
- [x] T030 [US3] Implement `src/components/capture/ColumnInspector.tsx` per
      contracts/components.md: renders the sheet body (exported separately from `Sheet` so T024
      can mount it directly), one row per `ColumnProperty` from `propertiesFor(target)` rendered
      by its `control` kind (`stepper` | `text` | `action`), every edit through `property.commit`,
      no mount-effect writes, `data-testid="column-inspector"`; the `delete` row's action closes
      the sheet after `commit` resolves. Depends on T012. Makes T024 pass.
- [x] T031 [US3] Modify `src/components/capture/CaptureScreen.tsx`: add `inspecting: string |
      null` state (an event id); derive `inspected = inspecting ? columns.find(c => c.id ===
      inspecting) ?? null : null` (never a stored `EventRow` copy — this is what makes INV-008
      structural); pass `onInspectColumn={setInspecting}` to `TabStaff` only when no selection is
      active; host `<Sheet open={inspected !== null} onClose={() => setInspecting(null)}
      label={...}><ColumnInspector properties={propertiesFor(target)} ctx={...} .../></Sheet>`;
      on the inspector's delete, repair the cursor via `nextCursorAfterDelete` (shared with the
      toolbar's own delete). Opening sets `inspecting` and nothing else (FR-023, INV-009). Depends
      on T027, T029, T030.
- [x] T032 [US3] Probe and confirm INV-004's behavioural half in `e2e/capture-surface.spec.ts`:
      for each of the 6 members (repeat increase, repeat decrease, ×4, chord-symbol set,
      chord-symbol clear, delete), apply the edit once via the toolbar and once via the inspector
      to twin columns, export both parts as plain text, assert the two exports agree on that
      column. Depends on T022, T031.

**Checkpoint**: All three user stories are independently functional — `npm run test:e2e --
capture-surface.spec.ts -g "inspector|long press"` is green, and `/songs/[songId]` and
`/songs/[songId]/play` remain untouched (no file edited in either route's component).

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The two invariants that are about the whole screen rather than one surface, the
non-regression guarantees, the one check nobody downstream can run, and the final gate.

- [x] T033 [P] Probe and confirm INV-011 and INV-012 in `e2e/capture-surface.spec.ts`
      (`test.describe` matched by `-g "fits|budget"`), at 375×667 in both themes:
      `[data-testid="fret-grid"]`'s height equals `NECK_HEIGHT_BASELINE_PX` (from T001) within
      1 px with `[data-testid="latch-strip"]` present and non-zero height (2 themes × 2 cursor
      targets = 4 measurements); `document.scrollingElement.scrollHeight <= clientHeight` and the
      staff scroller's `scrollHeight <= clientHeight` with every string row inside its client box,
      for 2 themes × 3 part shapes (5-string with chords; 5-string with chords and a tuplet;
      4-string) × 2 cursor targets = 12 measurements. If this fails, the levers are, in order
      (plan.md → *Blast-radius decisions*): drop the visible words from `space`/`select`/`paste`
      (keep `aria-label`), tighten the part-chip row's padding, tighten the status row —
      shrinking the neck is not a lever. Depends on T016, T017, T022.
- [x] T034 [P] Probe and confirm INV-014 in `e2e/capture-surface.spec.ts` (matched by `-g
      "contrast|theme"`): for the 5 surface pairs (strip vs neck; unarmed chip vs strip; armed
      chip vs strip; sheet vs backdrop; inspector row separator vs sheet) × 2 themes = 10
      measurements, assert each pair resolves to two different named CSS custom-property tokens
      whose relative luminance differs, and that the latch chip carries a `border`. This is the
      automated half of FR-030/FR-029; it does not substitute for T037. Depends on T015, T030.
- [x] T035 Confirm INV-001 in full: (result: capture.spec.ts has zero hunks vs main and all 164 e2e pass; stricter than "one hunk") run the complete `e2e/capture-surface.spec.ts` suite plus the
      unmodified `e2e/capture.spec.ts`, and verify by inspection that all 17 actions (repeat−,
      repeat+, ×4, arm stack, disarm stack, space, barline, triplet, set chord symbol, clear chord
      symbol, select, paste, delete, selection-copy, selection-cut, selection-delete,
      selection-cancel) are each reachable from the rendered screen and produce the expected
      staff/export. Confirm `git diff main... -- e2e/capture.spec.ts` shows exactly one hunk
      (INV-001, INV-016). Depends on T018, T021, T023, T032.
- [x] T036 Confirm INV-013: run `src/lib/tab/__tests__/ascii.test.ts` and
      `src/lib/export/__tests__/text.test.ts` **unmodified** and green; then run `git diff
      --name-only main... -- src/lib/tab src/lib/export src/lib/sync src/lib/model.ts
      src/db/schema` and confirm it produces no output. If either suite needed an edit or the diff
      is non-empty, the change has reached the layout or the serialiser and must be reverted back
      to this feature's `src/lib/capture/` and `src/components/` boundary.
- [x] T037 🛑 BLOCKED: needs a human looking at a real browser — no pipeline phase has one. At
      375×667, actual size, no zoom, in light **and** dark (quickstart Step 6): (1) is the strip
      visibly part of the neck's surface and visibly separate from it; (2) is an **unarmed** latch
      chip distinguishable from the strip behind it, light theme first (`--bg-raised` is
      `#ffffff` there — this is where it broke before); (3) is an **armed** chip unmistakable,
      carrying the stack button's old emphasis; (4) is the sheet readable over its backdrop, with
      visible row separators; (5) does any button label wrap (a wrapped label is a layout bug);
      (6) does a five-string part still show every string. T034 covers the measurable token/luminance
      half of this already — this task is for what a computed-style assertion cannot see. Record
      any defect found as a new task rather than silently approving.
      ✅ Checked 2026-11-03 by Claude in Chrome at a true 375×667 viewport (iframe, separate
      origin and worktree), dark and light tokens, five-string B Standard part: (1) the strip
      reads as a sunken band over the neck, divided by its top border; (2) the unarmed chip is
      separated from the strip by its border in both themes, subtle but clear in light; (3) the
      armed chip is a full accent fill, unmistakable; (4) the inspector sheet is readable over a
      dimmed backdrop, row separators visible (faint in light); (5) no label wraps; (6) all five
      strings shown. No visual defects found. This was a look at appearance only: the long press
      was synthesised with pointer events and no trailing click, so it could not see review F2
      (the sheet closing on a real touch release), and it does not vouch for touch behaviour.
- [x] T038 Guards: run the project's fast guard tier — `npm run typecheck && npm run lint && npm
      test && npm run test:e2e` — and fix every failure before any push. Depends on all of the
      above.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies. T001 must finish before T016 (it measures a box T016
  changes the shape of).
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories — T008 blocks T010–T012.
- **User Story 1 (Phase 3)**: Depends on Foundational (T008, T011). No dependency on US2/US3.
- **User Story 2 (Phase 4)**: Depends on Foundational (T008, T010, T012). Independent of US1/US3
  at the file level, though in practice both edit `CaptureScreen.tsx`'s controls row.
- **User Story 3 (Phase 5)**: Depends on Foundational (T008, T012). Independent of US1/US2 at the
  component level (`TabStaff.tsx`, `ColumnInspector.tsx`, `useLongPress.ts`), though T031 also
  edits `CaptureScreen.tsx`.
- **Polish (Phase 6)**: Depends on all three stories being complete (T033/T034 read artifacts
  T016/T017/T022/T015/T030 produce; T035 depends on all three stories' e2e probes existing).

### Within Each Phase

- Invariant probes come first and MUST fail on the pre-change code.
- Within Foundational: T008 before T010/T011/T012 (all three import `target.ts`); T009 is
  independent of T008.
- Within US2: T022 (the two-row restructure) before T023 (which renders row 2's contents from it).
- Within US3: T027–T030 before T031 (which composes them); T032 after T031.

### Parallel Opportunities

- T003–T007 (all five Foundational probes) run in parallel — five different files.
- T009 runs in parallel with T008 (no shared import).
- T013 and T014 (US1 probes) run in parallel.
- T019 and T020 (US2 probes) run in parallel.
- T024 and T025 (US3 probes) run in parallel.
- T033 and T034 (Polish probes) run in parallel.
- Once Foundational is done, US1, US2 and US3 implementation could proceed in parallel by
  different people, accepting that T017/T022/T031 all touch `CaptureScreen.tsx` and will need
  merging in sequence regardless of who starts first.

---

## Parallel Example: Foundational phase

```bash
# Launch all five probes together — five different files, all expected to fail (module not found):
Task: "Probe target.ts in src/lib/capture/__tests__/target.test.ts"
Task: "Probe controls.ts in src/lib/capture/__tests__/controls.test.ts"
Task: "Probe properties.ts in src/lib/capture/__tests__/properties.test.ts"
Task: "Probe latches.ts in src/lib/capture/__tests__/latches.test.ts"
Task: "Probe cursor.ts in src/lib/capture/__tests__/cursor.test.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1: Setup (T001–T002).
2. Phase 2: Foundational (T003–T012) — CRITICAL, blocks everything else.
3. Phase 3: User Story 1 (T013–T018).
4. **STOP and VALIDATE**: run `npm run test:e2e -- capture-surface.spec.ts -g "latch"` and do the
   by-hand check from quickstart Step 2. The strip exists and the screen is already better —
   this is the MVP the plan names.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + User Story 1 → test independently (latch strip) → this is the MVP.
3. + User Story 2 → test independently (contextual toolbar).
4. + User Story 3 → test independently (column inspector).
5. Polish (T033–T038) → the vertical-budget and contrast invariants, the regression gate, the one
   human-owned browser pass, and the final guard run.

### Notes

- `commit` in `properties.ts` is the single mutation path for `repeat`, `chord`, `delete` — T005,
  T012, T022, T023, T030 all key off this to keep INV-004 structural rather than coincidental.
- `target.ts`'s `appliesTo` table (T003, T008) is the one rule every other module calls; do not
  let any later task re-derive it inline.
- Shrinking the neck is never an available lever for T033 — plan.md is explicit about this.

---

## Phase 7: Review remediation

**Purpose**: Close the four MAJOR findings of review round 1 (`review.md` F1–F4) and adopt every
review probe into the project suite. Each probe lives in `specs/001-capture-control-surface/review-probes/`;
run all of them with `bash specs/001-capture-control-surface/review-probes/run-probes.sh` (builds once,
serves on port 3300, stops the server itself). For a violated invariant the probe is adopted **first**
and must fail before its fix lands.

- [x] T039 Adopt review-probes/INV-010-latch-never-armed-inapplicable.spec.ts into `e2e/capture-surface.spec.ts`'s `latch` block as a failing test first: strengthen `expectDisarmed` so that after the next fret press the latch is **still** `aria-pressed="false"` and a second press starts its own column, for all 7 routes. It must fail today on "jump to start", "delete the target column" and "a sync delete" — review F1 (MAJOR), src/components/capture/CaptureScreen.tsx:94
- [x] T040 Make INV-010 hold for the stored set, not just the lit set: `armed` must never keep a latch that `appliesTo("next-note", target)` rejects. Use one rule for every route (drop rejected ids whenever the target changes, or bind each armed latch to the event id it was armed on and light it only there), not more per-route `setArmed(new Set())` calls. Keep the existing explicit disarms. Makes T039 pass — review F1 (MAJOR), src/components/capture/CaptureScreen.tsx:131, src/components/capture/CaptureScreen.tsx:386, src/components/capture/CaptureScreen.tsx:490
- [x] T041 Adopt review-probes/INV-005-006-touch-long-press-trace.spec.ts into `e2e/capture-surface.spec.ts` as a failing test first: on the `mobile` project, a real touch hold (CDP `Input.dispatchTouchEvent`, see `touchHold` in review-probes/helpers.ts) on a column opens the inspector, and it is **still open** after the finger lifts. Also run at least one existing inspector test (open, edit, dismiss) with a touch hold rather than `page.mouse` — review F2 (MAJOR), src/components/ui/index.tsx:138
- [x] T042 Stop the click that ends the opening press from dismissing the `Sheet`: a backdrop dismissal must need a press that began on the backdrop (e.g. record `pointerdown` on the `<dialog>` and close on `click` only when both landed on the dialog itself). This must hold for mouse, touch and pen. Esc and the close button are unchanged. Makes T041 pass with INV-009's 9 members still green — review F2 (MAJOR), src/components/ui/index.tsx:138, src/components/capture/useLongPress.ts:59
- [x] T043 Adopt review-probes/INV-006-tap-not-delayed.spec.ts into `e2e/capture-surface.spec.ts` as a failing test first. It covers all 7 plan members ({notes, rest, barline} × {mouse, touch} + keyboard Enter, with the in-page pointerup→aria-current gap under 100 ms) plus "keyboard Enter right after a mouse long press" and "keyboard Enter right after a touch long press" on the same column. The last one fails today — review F3 (MAJOR), src/components/capture/useLongPress.ts:61
- [x] T044 Make `useLongPress`'s click suppression end with the press that set it. Expire it when the press ends without a click reaching the column (e.g. clear it on the task after `pointerup`/`pointercancel`), and never suppress a keyboard-generated click (`event.detail === 0`). Extend src/components/capture/__tests__/useLongPress.test.tsx with both cases. Makes T043 pass — review F3 (MAJOR), src/components/capture/useLongPress.ts:82, src/components/tab/TabStaff.tsx:337
- [x] T045 Adopt the FR-022 tests from review-probes/INV-005-no-inspector-readonly-or-selection.spec.ts (`FR-022 a long press during a selection leaves the selection alone`, mouse and touch) into `e2e/capture-surface.spec.ts` as a failing test first: after a hold during a one-column selection, the count still reads "1 selected" — review F4 (MAJOR), src/components/capture/CaptureScreen.tsx:292
- [x] T046 While a selection is active, swallow a press that passes the long-press threshold on the capture staff: no inspector, no selection extend. A short tap still extends. For example, give the selection-time staff a long-press handler that does nothing, so the hook's click suppression applies. Read-only staffs (song page, play view) must still get no press handlers at all (INV-005). Makes T045 pass — review F4 (MAJOR), src/components/capture/CaptureScreen.tsx:292, src/components/capture/CaptureScreen.tsx:294
- [x] T047 [P] Adopt review-probes/INV-001-every-action-reachable.spec.ts into `e2e/capture-surface.spec.ts` (17 actions driven at 375×667 and checked by their effect) — review INV-001 (held; probe not yet in the suite)
- [x] T048 [P] Adopt review-probes/INV-002-toolbar-presence.spec.ts into `e2e/capture-surface.spec.ts`, replacing the 3-target `toolbar` presence test with all 6 targets × 9 controls (adds rest column, start-of-part, no part at all) — review INV-002 / F9
- [x] T049 [P] Adopt the "every toolbar control is inside the 375px viewport" test from review-probes/INV-003-stable-positions.spec.ts into `e2e/capture-surface.spec.ts`, plus the per-direction tap-reached measurements — review INV-003 (held; viewport member not in the suite)
- [x] T050 [P] Adopt review-probes/INV-005-no-inspector-readonly-or-selection.spec.ts (INV-005 members) into `e2e/capture-surface.spec.ts`, replacing the test at e2e/capture-surface.spec.ts:345. Put the part in the arrangement so the play view really has a staff, never `continue` past a surface with no columns, assert read-only columns are `<div>`s without `select-none`, and add the touch-hold variants — review INV-005 / F8
- [x] T051 [P] Adopt review-probes/INV-007-moved-press-is-neither.spec.ts into `e2e/capture-surface.spec.ts`: drag left/right/vertical × release inside/outside, mouse on both projects and touch on `mobile` — review INV-007 / F9
- [x] T052 [P] Adopt review-probes/INV-008-inspector-closes-when-column-gone.spec.ts into `e2e/capture-surface.spec.ts`: inspector delete, toolbar delete unreachable behind the modal, sync delete, part switch via history back, part deleted from the song page — review INV-008 / F9
- [x] T053 [P] Adopt review-probes/INV-009-dismiss-changes-nothing.spec.ts into `e2e/capture-surface.spec.ts`, replacing the 2-member dismissal test at e2e/capture-surface.spec.ts:303 with all 9 route × position members, comparing caret box, status line, current column, latch state and exported ASCII — review INV-009 / F9
- [x] T054 [P] Adopt review-probes/INV-013-export-untouched.sh as a guard the project actually runs (e.g. a CI step or a vitest that diffs the fenced paths against the merge-base, skipping cleanly when no base ref exists) — review INV-013 (held; fence check not in the suite)
- [x] T055 [P] Adopt review-probes/INV-015-descriptor-layout.test.tsx into src/components/capture/__tests__/LatchStrip.test.tsx and ColumnInspector.test.tsx, so the "differs only in its armed/applicable modifier" test really compares classNames and an inapplicable cell is shown to stay in place — review INV-015 / F9, src/components/capture/__tests__/LatchStrip.test.tsx:69
- [x] T056 [P] Adopt review-probes/INV-016-selection-toolbar.spec.ts into `e2e/capture-surface.spec.ts` (at 375×667 the selection row's count message and copy/cut/delete/cancel are visible and in the viewport, the contextual row is absent, the strip is inert, no page scroll) — review INV-016 (held; FR-003 member not in the suite)
- [x] T057 [P] Adopt review-probes/FR-017-024-inspector-scope-and-keyboard.spec.ts into `e2e/capture-surface.spec.ts` (a long-pressed barline offers delete only, a rest offers all three; the inspector is Tab-reachable, keyboard-operable and Esc-dismissible) — review FR-017 / FR-024 (held; no probe in the suite)
- [x] T058 Gate: run `npm run typecheck && npm run lint && npm test && npm run test:e2e`, then `bash specs/001-capture-control-surface/review-probes/run-probes.sh`. Everything must be green, including the 11 probe runs that fail today (F1 ×6, F2 ×1, F3 ×1, F4 ×3) — review F1–F4

---

## Phase 8: Review remediation

**Purpose**: Close the two MAJOR findings of review round 2 (`review.md` F12, F13) and adopt this round's
probes into the project suite. Each probe lives in `specs/001-capture-control-surface/review-probes/`; run
all of them with `bash specs/001-capture-control-surface/review-probes/run-probes.sh`. For the violated
invariant the probe is adopted **first** and must fail before its fix lands. MINORs F5, F6, F7, F14 and F15
are in `review.md` § Follow-ups and are not tasks here.

- [x] T059 Adopt review-probes/INV-003-r2-armed-latch-no-shift.spec.ts into `e2e/capture-surface.spec.ts`'s `toolbar` block as a failing test first: at 375×667 the five stable controls keep identical `x` and `y` when the cursor leaves a column with `stack` armed, and when the latch is armed in place, and the strip's height does not depend on the chip's state. All three members fail today by 2 px — review F12 (MAJOR), src/components/capture/LatchStrip.tsx:41
- [x] T060 Give every latch chip the same border width, so only the border's colour changes with state: the armed chip keeps today's emphasis, the strip's height stops depending on the chip, and each chip still emits exactly one `bg-*` and one `text-*` utility. Do not change the neck's height. Extend the `contrast` test at e2e/capture-surface.spec.ts:826 to assert the armed chip's border width as well as the unarmed chip's. Makes T059 pass with INV-011, INV-012 and INV-015 still green — review F12 (MAJOR), src/components/capture/LatchStrip.tsx:41, src/components/capture/LatchStrip.tsx:42
- [x] T061 Delete src/lib/capture/__tests__/export-untouched.test.ts. INV-013 is a fence for this one spec, and as a member of `npm test` (run by .husky/pre-commit) it fails on the `src/lib/tab/` change the next roadmap entry must make. `src/lib/tab/__tests__/ascii.test.ts` and `src/lib/export/__tests__/text.test.ts` stay as the lasting protection and review-probes/INV-013-export-untouched.sh stays as this spec's fence. Supersedes T054. `bash specs/001-capture-control-surface/review-probes/INV-013-r2-guard-false-positive.sh` must then exit 0 — review F13 (MAJOR), src/lib/capture/__tests__/export-untouched.test.ts:12
- [x] T062 [P] Adopt review-probes/INV-009-r2-touch-dismissal.spec.ts into `e2e/capture-surface.spec.ts`: all 3 dismissal routes opened by a real touch hold, twice each, plus a touch tap on the held column straight after dismissal — review INV-009 (held; touch members not in the suite)
- [x] T063 [P] Adopt review-probes/INV-007-r2-touch-drag-scrolls.spec.ts into `e2e/capture-surface.spec.ts`: a touch drag across the columns really scrolls the staff and fires neither gesture — review INV-007 (held; story 3 scenario 6's scroll not in the suite)
- [x] T064 [P] Adopt the "history back to another part" member of review-probes/INV-010-r2-transient-and-part-routes.spec.ts into `e2e/capture-surface.spec.ts`'s `latch` block. Leave its paste member in review-probes/ (marked `test.fail` until F14 is fixed) — review INV-010 (held; route not in the suite)
- [x] T065 [P] Adopt review-probes/INV-012-r2-chord-form-open.spec.ts into `e2e/capture-surface.spec.ts`'s `fits` block, keeping its "no worse than main" bound of 2 clipped strings — review INV-012 (held; FR-026's chord form not in the suite)
- [x] T066 [P] Adopt review-probes/INV-002-r2-row-during-insert.spec.ts into `e2e/capture-surface.spec.ts`: row 2 is never gone for a painted frame across mid-part inserts — review INV-002 (held; not in the suite)
- [x] T067 [P] Adopt review-probes/FR-014-r2-release-over-sheet-control.spec.ts into `e2e/capture-surface.spec.ts`: a touch hold edits nothing when the finger lifts, and the sheet opens clear of the pressed column — review FR-014 (held; clearance not in the suite)
- [x] T068 Gate: run `npm run typecheck && npm run lint && npm test && npm run test:e2e`, then `bash specs/001-capture-control-surface/review-probes/run-probes.sh`. Everything must be green, including the 6 `INV-003-r2` runs and the `INV-013 r2` shell probe that fail today. The paste member of `INV-010-r2` stays an expected failure — review F12, F13

---

## Phase 9: Review remediation

**Purpose**: Close the two MAJOR findings of review round 3 (`review.md` F18, F19) and adopt this round's
probes into the project suite. Each probe lives in `specs/001-capture-control-surface/review-probes/`; run
all of them with `bash specs/001-capture-control-surface/review-probes/run-probes.sh`. For a violated
invariant the probe is adopted **first** and must fail before its fix lands. MINORs F5, F6, F7, F14, F15, F20
and F21 are in `review.md` § Follow-ups and are not tasks here.

- [X] T069 Adopt review-probes/INV-012-r3-chord-row-any-build.spec.ts and review-probes/INV-012-r3-selection-any-build.spec.ts into `e2e/capture-surface.spec.ts`'s `fits` block as failing tests first. Read the rendered chord label's own box against the box that clips it, at most 1 px outside, for 2 themes × {chords, chords and tuplet} × {column, barline}, and allow at most 1 of 5 strings hidden during a selection (`main`'s figure) for 3 shapes. Do not assert this through `.tab-cell` counts or `scrollHeight`: neither can see overflow off the top of a `justify-end` scroller. All 4 tuplet members and all 3 selection members fail today — review F18 (MAJOR), e2e/capture-surface.spec.ts:724, e2e/capture-surface.spec.ts:738
- [X] T070 Recover at least 18 px of staff height above the neck, without changing the neck's height. Measured and sufficient (review-probes/INV-012-r3-budget-recipe.spec.ts): staff wrapper `pb-3` → `pb-1` (8 px), part-chip row `py-2` → `py-1` (8 px), status row `py-1.5` → `py-1` (4 px). Keep the wrapper's top padding: the staff is bottom-anchored, so it buys nothing. Shrinking the neck is not a lever. Makes T069 pass with INV-003, INV-011 and INV-012 still green — review F18 (MAJOR), src/components/capture/CaptureScreen.tsx:292, src/components/capture/CaptureScreen.tsx:257, src/components/capture/CaptureScreen.tsx:372
- [X] T071 Adopt the "SC-007 five latches" test from review-probes/INV-015-r3-phone-width.spec.ts and review-probes/INV-015-r3-label-sets.spec.ts into `e2e/capture-surface.spec.ts` as failing tests first: at 375×667, with FR-008's labels and with the roadmap's (`h`, `p`, `slide-up`, `slide-down`), no label wraps, every chip is the same height, and the strip, the neck and the stable row do not move. Keep the probes' method of appending clones of the rendered chip, since a test cannot declare a descriptor. All 3 runs fail today — review F19 (MAJOR), src/components/capture/LatchStrip.tsx:39, src/components/capture/__tests__/LatchStrip.test.tsx:111
- [X] T072 Keep every latch chip on one line at five latches, so the strip's height does not depend on how many latches there are. Measured and sufficient (review-probes/INV-012-r3-budget-recipe.spec.ts): add `whitespace-nowrap`, and change `px-2` → `px-1` and `text-xs` → `text-[0.7rem]` on the chip. Each chip must still emit exactly one `bg-*` and one colour `text-*` utility, every chip keeps the same border width (T060), and no component branches on a latch `id`. Makes T071 pass with INV-003, INV-011 and INV-015 still green — review F19 (MAJOR), src/components/capture/LatchStrip.tsx:39
- [X] T073 [P] Adopt the "SC-008 six properties" tests from review-probes/INV-015-r3-phone-width.spec.ts into `e2e/capture-surface.spec.ts`: six rows at 375×667 need no scrolling and no row is wider than the phone — review INV-015 (member held; not in the suite)
- [X] T074 [P] Adopt review-probes/INV-004-r3-stored-row-parity.spec.ts into `e2e/capture-surface.spec.ts`'s `inspector parity with the toolbar` block: the 6 edits compared row by row in IndexedDB, delete's cursor at 4 positions, and 3 deletes of a column the cursor is not on — review INV-004 (held; FR-018's stored data not in the suite)
- [X] T075 [P] Adopt review-probes/INV-003-r3-every-column-kind.spec.ts into `e2e/capture-surface.spec.ts`'s `toolbar` block: 4 column kinds × {armed, unarmed}, and `triplet` returning to its coordinates — review INV-003 (held; not in the suite)
- [X] T076 [P] Adopt review-probes/FR-014-r3-column-shapes.spec.ts into `e2e/capture-surface.spec.ts`: a repeated column is one event from every repetition, tuplet members, a hold on the chord label, an empty part, and tap-to-extend by real touch — review FR-014, FR-022 (held; not in the suite)
- [X] T077 [P] Adopt review-probes/INV-010-r3-latch-across-inspector.spec.ts into `e2e/capture-surface.spec.ts`'s `latch` block: the latch across a hold, an edit and a delete through the sheet, and both surfaces' delete — review INV-010 (held; not in the suite)
- [X] T078 [P] Adopt the border assertion from review-probes/INV-014-r3-armed-chip.spec.ts into the `contrast` test at e2e/capture-surface.spec.ts:804: the armed chip's border colour equals its fill, and its fill and ink are the accent tokens — review INV-014 (held; not in the suite)
- [X] T079 Gate: run `npm run typecheck && npm run lint && npm test && npm run test:e2e`, then `bash specs/001-capture-control-surface/review-probes/run-probes.sh`. Everything must be green, including the 10 probe runs that fail today (`INV-012-r3-chord-row` ×4, `INV-012-r3-selection` ×3, `INV-015-r3-label-sets` ×2, `INV-015-r3-phone-width` ×1). The paste member of `INV-010-r2` stays an expected failure — review F18, F19

---

## Phase 10: Review remediation

**Purpose**: Close the one MAJOR finding of review round 4 (`review.md` F22) and adopt this round's probes into
the project suite. Each probe lives in `specs/001-capture-control-surface/review-probes/`; run all of them with
`bash specs/001-capture-control-surface/review-probes/run-probes.sh`. The probe is adopted **first** and must fail
before its fix lands. MINORs F5, F6, F7, F14, F15, F21, F23 and F24 are in `review.md` § Follow-ups and are not
tasks here.

- [x] T080 Adopt review-probes/INV-004-r4-sheet-draft-gap.spec.ts into `e2e/capture-surface.spec.ts`'s `inspector parity with the toolbar` block as a failing test first: across a `set`, sampled on every task, the sheet's chord field holds only what was typed, and a clear typed straight after `set` is not lost. Keep the probe's in-page sampling, because a Playwright assertion is too slow to land in the gap. Both members fail today (`seen` is `["Am", "", "Am"]`) — review F22 (MAJOR), src/components/capture/ColumnInspector.tsx:112
- [x] T081 Hold `TextControl`'s draft until the live row lands, not until the commit resolves. Measured and sufficient: keep the submitted text in a `useRef`, set it just before `await property.commit(...)`, delete the `setDraft` after that await, and add `useEffect(() => { const value = sent.current; sent.current = null; setDraft((now) => (now === value ? null : now)); }, [current])`. Text typed while the write is in flight must still be kept, as it is today. Do not branch on a property `id`, and do not edit the tests at e2e/capture-surface.spec.ts:519 or :2326, which pass unchanged once this lands. Extend src/components/capture/__tests__/ColumnInspector.test.tsx: the draft survives until `read(ctx)` changes, and a draft typed in flight is kept. Makes T080 pass — review F22 (MAJOR), src/components/capture/ColumnInspector.tsx:112, src/components/capture/ColumnInspector.tsx:101
- [x] T082 [P] Adopt review-probes/INV-012-r4-status-row-any-build.spec.ts into `e2e/capture-surface.spec.ts`'s `fits` block: 3 cursor states × 5 chord symbols × 2 chord-bearing shapes, keeping its `MAIN_CLIP` figures as the bar, so the chord label is never clipped more than on `main`. It passes today. Do not tighten the bar: F23 is a follow-up, not this task — review INV-012 (held; status-row states not in the suite)
- [x] T083 Gate: run `npm run typecheck && npm run lint && npm test`, then `npm run test:e2e` **three times in a row**, then `bash specs/001-capture-control-surface/review-probes/run-probes.sh`, then `npx playwright test e2e/capture-surface.spec.ts -g "chord symbol clear: toolbar|chord clear: both surfaces" --repeat-each=40`, which must report 160 passed and 0 failed (today: 19 failed). Everything must be green, including every `INV-004-r4` run. The paste member of `INV-010-r2` stays an expected failure. A failure that passes on a re-run is a finding to report, not a flake to tick past — review F22
