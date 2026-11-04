---

description: "Task list for making playing techniques capturable and visible"
---

# Tasks: Make playing techniques capturable and visible

**Input**: Design documents from `/specs/002-playing-techniques/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (notation, descriptors, writes, components), quickstart.md

**Tests**: The spec does not ask for TDD, but plan.md § Invariants (INV-001 to INV-027) makes probes mandatory. Each probe is the FIRST task of the phase that builds what it protects, lives in the project suite (never a temp dir), and **must FAIL on the pre-change code** (a missing module, a missing control, or the old behaviour). Unit tests run with `npm test`; e2e with `npm run test:e2e` (Playwright, production build, projects `mobile` and `desktop`).

**Organization**: Grouped by user story. Drawing and the write operations are shared by every story, so they sit in Phase 2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no dependency on an incomplete task. Two tasks touching the same file are never [P].
- Run every command synchronously with `< /dev/null`. Nothing here needs a browser, a dev server or the network except Playwright's own production-build server, which `playwright.config.ts` starts. Never run build/e2e while `npm run dev` holds `.next`.
- **Line endings**: keep each file's existing endings. CRLF: `src/components/tab/TabStaff.tsx`, `src/components/ui/index.tsx`, `e2e/capture-surface.spec.ts`, `src/components/capture/__tests__/ColumnInspector.test.tsx`. Do not rewrite them wholesale.
- **Do not edit**: `src/lib/tab/__tests__/ascii.test.ts`, `src/lib/export/__tests__/text.test.ts`, `src/lib/local/__tests__/editing.test.ts`. New cases go in new files.
- **Fenced (INV-001)**: nothing under `src/db/`, `drizzle/`, `src/lib/model.ts`, `src/lib/sync/`, `src/lib/local/clipboard.ts`, `src/lib/local/db.ts` changes.
- Read `node_modules/next/dist/docs/` before touching anything Next-specific (AGENTS.md). This feature should touch no Next API.

## Phase 1: Setup

**Purpose**: Confirm the baseline and make the new e2e file exist.

- [X] T001 Run `npm run typecheck`, `npm run lint` and `npm test` (all with `< /dev/null`) on the untouched branch and record any pre-existing failures in a note at the bottom of `specs/002-playing-techniques/tasks.md`, so later failures can be attributed.
- [X] T002 Run `git ls-files --eol` on the four CRLF files listed above and confirm each reports `i/crlf w/crlf` (quickstart §3). Note the result; do not change anything.
- [X] T003 [P] Extend `e2e/capture-surface-helpers.ts` (read it first for conventions) with the helpers in contracts/components.md: `chip(page, name)`, `toggle(page, technique, note)`, `connectors(page)` (`getByTestId("tab-connector")`), `staffRows(page)` (each string's drawn tokens from the DOM, in order), and widen the `status` regex to the new status texts (`next note: hammer-on|pull-off|slide up|slide down`, and `stack + <short>` combined forms).

---

## Phase 2: Foundational (blocking prerequisites)

**Purpose**: The one drawing owner (`techniques.ts` → `layout.ts` → `ascii.ts`/`TabStaff`), the pure capture descriptors, and the write operations. No story can start until these exist.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Invariant probes (FIRST in the phase — each must FAIL on the pre-change code)

- [X] T004 [P] Probe INV-001 in `src/lib/__tests__/storage-fence.test.ts` (new): run `git diff --name-only main --` over the fenced members (`src/db`, `drizzle`, `src/lib/model.ts`, `src/lib/sync`, `src/lib/local/clipboard.ts`, `src/lib/local/db.ts`) and assert the output is empty and `drizzle/` gains no untracked file; also assert `src/lib/tab/__tests__/ascii.test.ts` and `src/lib/export/__tests__/text.test.ts` show no diff against `main` (INV-003 half). Skip itself with a clear message when `main` is not resolvable. Fails pre-change only if someone has edited a fenced file; say so in a comment (it guards, it cannot fail first).
- [X] T005 [P] Probe INV-004, INV-007 and INV-026 in `src/lib/tab/__tests__/techniques.test.ts` (new) through the public `layoutPart` and `toAscii`: exact strings and equal row lengths over 10 techniques × 2 densities × 7 shapes (alone; after a plain source; two-digit source; source widened to 2; widened to 3; across a space; across a barline) = 140 parts, plus all six on one note, plus two transitions into one column on different strings; the INV-007 truth table (first column, only another string played, across a space, across a barline, source cut off by `eventsInBars`, technique on a barline, on an empty rest, `dead_note`, unknown string, 6 pairs of two stored transitions in both orders); and the 63 non-empty subsets of the six decorations × stored and reversed order on a fret, a two-digit fret and `x`. Include the exact fixture `E |-5h7-7p5-5/7-7\5-|` from contracts/notation.md. Fails pre-change: `techniques.ts` and `connectors` do not exist.
- [X] T006 [P] Probe INV-008 in `src/lib/tab/__tests__/techniques-repeat.test.ts` (new) through `toAscii`: 10 techniques × {expanded, compact} × {repeat 1, 3} × {has a source, first in the part}, with the exact strings `5h7h7h7`, `5h7x3`, `7~-7~-7~`, `7~x3`, `7h7h7`, `7x3`, `<7>-<7>`, `<7>x2`; a chord symbol on a repeated decorated column draws on the first repetition only. Fails pre-change: techniques are not drawn.
- [X] T007 [P] Probe INV-003 (behavioural half) and INV-023 in `src/lib/tab/__tests__/techniques-plain.test.ts` (new): every fixture used by `ascii.test.ts` and `text.test.ts` lays out with all `connectors` null and `description` equal to today's text (`string 4 fret 7`, `Barline`, `Empty column`); and the description table of contracts/descriptors.md (`string 4 fret 7 with hammer-on and vibrato`, `..., repeated 3 times`, a transition with no source not named, a dead note, no affix characters in any description). Fails pre-change: `description` does not exist.
- [X] T008 [P] Probe INV-005 (structural half) and INV-025 (source-check half) in `src/lib/tab/__tests__/single-owner.test.ts` (new): read the source text of `src/lib/tab/ascii.ts` and `src/components/tab/TabStaff.tsx` and assert neither imports `techniques.ts` nor reads `.techniques`; read `LatchStrip.tsx`, `ColumnInspector.tsx` and the `press`/status regions of `CaptureScreen.tsx` and assert no latch id or property id literal (`"stack"`, `"hammer_on"`, `"decorations"`, …) appears. Fails pre-change: `CaptureScreen.tsx` still contains `lit.has("stack")`. NOTE: the CaptureScreen source check is `it.skip` until the US1 phase moves it onto nextNote/statusFor — un-skip it there.
- [X] T009 [P] Probe INV-002, INV-006 (stored form), INV-014, INV-015 and INV-016 in `src/lib/local/__tests__/techniques.test.ts` (new) over `fake-indexeddb` through the public `insertNote`, `stackNote`, `unstackNote`, `toggleDecoration` (read the existing `editing.test.ts` for the harness, do not edit it): the 7 nothing-armed routes compare stored rows, field clocks and outbox count to today's behaviour; stored form is exactly `{ "<string>": ["<technique>"] }`; 6 decorations × {on, off} × {with a transition; `dead_note`; unknown entry; another string decorated} with deep-equal and clock checks; 15 pairs of decorations in two concurrent calls with both promises in flight (INV-013), 6 double taps, all six in one burst; `eventRowSchema.safeParse` after each write, `MAX_TECHNIQUES_PER_STRING` pinned (8 accepted, 9 refused), toggles on lists of 6/7/8; removed-note cases (stack replace plain/with chip, same-fret stack, `unstackNote` with a second string left/emptying the column, orphan technique). Fails pre-change: `toggleDecoration` and the `techniques` write option do not exist.
- [X] T010 Create `src/lib/tab/techniques.ts` per contracts/descriptors.md: `Transition`, `Decoration`, `TransitionSpec`, `DecorationSpec`, `TRANSITIONS` (`h`, `p`, `/`, `\`), `DECORATIONS` (toggle order, `before`/`after`/`words`/`short`), `MAX_TECHNIQUES_PER_STRING = 8`, `decorate`, `drawnTransition`, `drawnDecorations`. Fixed affix order: tap, let ring, harmonic, fret, bend, vibrato, palm mute (see contracts/notation.md). Make T005/T006 pass later in this phase.
- [X] T011 Extend `src/lib/tab/layout.ts`: `TabColumn` gains `connectors: (string | null)[]` and `description: string`; `cells` hold affixes via `decorate`; a connector is set only with a note on the string, a transition and an earlier note on that string among the laid-out columns (across spaces and barlines); the repeat label stays last; description per contracts/descriptors.md (transition named only when drawn). Depends on T010.
- [X] T012 Update `src/lib/tab/ascii.ts` so a connector replaces the one rail in the gap before the column (row length unchanged, barline gap handled as in `5-|h7`); it reads only `cells`/`connectors`. Depends on T011.
- [X] T013 Update `src/components/tab/TabStaff.tsx` (CRLF — edit surgically): add internal `Gap` per contracts/components.md (`data-testid="tab-connector"`, `aria-hidden`, class `tab-connector`, width `1ch`, chord spacer / tuplet row / one `.tab-cell` per string, props `bracket`/`selected`/`active`), rendered between `Column i`, `Caret`, and `Column i+1` only when `connectors.some(Boolean)`; `Column` takes `label` from `column.description` (remove `describe()`); read-only branch gains `role="img"` and `aria-label`; `InspectableColumn` gains `onKeyDown` (`ContextMenu`, `Shift+F10`) plus `aria-keyshortcuts` and `aria-haspopup="dialog"`; `followTail` also depends on drawn width. Depends on T011.
- [X] T014 [P] Add `.tab-connector` rules to `src/app/globals.css` (padding-inline 0, font-weight 600; ink is the fret numbers', opaque background masking the string line; no opacity over a surface token). Use `npm run dev:clean`-free reasoning: do not start a dev server.
- [X] T015 Extend `src/lib/local/editing.ts` per contracts/writes.md: `NoteWrite`, `insertColumn` `techniques` option, `insertNote`/`stackNote` with `{ techniques }` (stack reads the row inside one `mutateBatch`, replaces/clears the string's list, drops `dead_note`/unknown on a replaced note, patches `techniques` only if the map changes), `unstackNote` removes the string's `techniques` key in the same patch, new `toggleDecoration(eventId, stringIndex, decoration, ctx)` (reads inside the transaction, removes every copy or appends, honours the cap, deletes an empty key, patches only `techniques`, writes nothing when nothing changes). Everything through `mutate.ts`. Depends on T010.
- [X] T016 Run `npm test < /dev/null`, `npm run typecheck < /dev/null`, and the `git diff --stat main --` commands in quickstart §2; fix until T004–T009 pass and the fenced paths print nothing.

**Checkpoint**: techniques draw identically in export and staff; writes exist and are safe. Nothing is capturable from the UI yet.

---

## Phase 3: User Story 1 - Capture a hammer-on as it is played (Priority: P1) 🎯 MVP

**Goal**: Four transition chips; one extra tap per transition; zero change for a capturer who never touches a chip.

**Independent Test**: Empty part → fret 5, arm `h`, fret 7 on the same string, fret again → `5h7` then a plain note on staff and export; chip dark after the second press.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [X] T017 [P] [US1] Probe INV-010, INV-011 (derivation half) and INV-025 (render half) in `src/lib/capture/__tests__/latches-transitions.test.ts` (new): `armLatch` over the 12 ordered pairs of different chips, 4 self-toggles, stack with each chip in both orders = 8; `litLatches` for 5 latches × 6 targets (notes, rest, barline, start of part, empty part, no part) = 30 using the `transition` scope table in contracts/descriptors.md; `nextNote` and `statusFor` outputs (stack alone keeps its exact text); and in `src/components/capture/__tests__/LatchStrip.test.tsx` (extend the existing file if present, else new) render fabricated descriptors at 1 and 5 latches. Fails pre-change: no `armLatch`, `nextNote`, `statusFor`, or `transition` scope.
- [X] T018 [P] [US1] Probe INV-009, INV-010 (e2e half), INV-011 (e2e half), INV-019 and INV-020 in `e2e/techniques.spec.ts` (new): 4 chips × 3 routes (insert at end, insert mid-part, stack) × {paced, back-to-back with no wait} = 24 reading export and `aria-pressed`; `aria-pressed` on all five chips after each tap; 5 latches × 6 targets for `disabled`/`aria-pressed`, 4 chips × 9 disarm routes (tap column, switch part, space, barline, `start`, delete target, delete from a second tab, add a part, history back) = 36; INV-002 tap-count check (fret, fret, fret taps and export unchanged); INV-019 `boundingBox` of strip, neck and 5 stable controls against baselines (strip 38.8 px, chip 30.8 px, row 2 ends ≤ 308.2 of 365) × 8 states × 2 themes at 375×667; INV-020 `scrollWidth <= clientWidth` and one line on the declared chips × {unlit, lit, unavailable} × 2 themes, with a documented mutation check (one long label in a temp copy must fail it — do the mutation by hand once, revert it, and note the result in a comment). Fails pre-change: no `h`/`p`/`/`/`\` chips exist.
- [X] T019 [P] [US1] Probe INV-006 (position half) in `e2e/techniques.spec.ts` after T018's block (same file — not parallel with T018): delete the source by toolbar, inspector, selection delete, cut, and from a second tab; insert between; paste between; delete the arrival; paste the arrival elsewhere; variant — assert the export after each and that nothing else is stored. Fails pre-change: no way to store a transition from the UI.

### Implementation for User Story 1

- [X] T020 [P] [US1] Extend `src/lib/capture/target.ts` with the `transition` scope (available on playable and barline, not on no-part/no-column) per the table in contracts/descriptors.md; extend `src/lib/capture/__tests__/target.test.ts`.
- [X] T021 [US1] Extend `src/lib/capture/latches.ts`: `LatchId`, new optional `Latch` members (`statusShort`, `stacks`, `transition`), four new `LATCHES` entries with labels from `TRANSITIONS`, `armLatch`, `nextNote`, `statusFor`, `cursorPending`, `prunedArmed` (US4 uses the last two; implement them here since they live beside the others). Update `src/lib/capture/__tests__/latches.test.ts`. Depends on T010, T020.
- [X] T022 [US1] Update `src/components/capture/LatchStrip.tsx`: a latch with `transition` renders its label in `font-mono text-sm leading-[1.05rem]`; never reads `latch.id` except for `key` and `onToggle`; strip stays 38.8 px tall. Depends on T021.
- [X] T023 [US1] Update `src/components/capture/CaptureScreen.tsx`: `toggleLatch` calls `armLatch`; `press` calls `nextNote(lit, target)`, removes `consumed` from `armed` synchronously before awaiting `stackNote`/`insertNote` with `{ techniques }`; no `lit.has("stack")` branch; status line uses `statusFor(lit)`. Depends on T015, T021.
- [X] T024 [US1] Remove the clearance assertion at `e2e/capture-surface.spec.ts:2381` and update the five-latch test near `:1006` to measure the five real chips and add `overflows` (CRLF file; see plan.md "Existing tests this changes on purpose"). Update the `INV-002 members` of that file only as far as US2's `inspect` control needs — leave that to T033.
- [X] T025 [US1] Run `npm test < /dev/null`, `npm run typecheck < /dev/null`, `npm run lint < /dev/null` and `npm run test:e2e < /dev/null`; fix until T017–T019 pass and no existing e2e regresses.

**Checkpoint**: US1 is shippable alone.

---

## Phase 4: User Story 2 - Decorate a note while looking at it (Priority: P2)

**Goal**: Six toggles per played string in the sheet; keyboard route; the sheet reachable and safe on a phone.

**Independent Test**: Capture one note, open the inspector, toggle each of the six on and off; staff and export match each time and end plain.

### Invariant probes for User Story 2 (FIRST — each must FAIL on the pre-change code)

- [X] T026 [P] [US2] Probe INV-025 (property half) and the properties contract in `src/lib/capture/__tests__/properties-decorations.test.ts` (new): `propertiesFor` returns `decorations` only for a playable column with a note (not barline, not empty space); `toggles(ctx)` yields one group per played string with six toggles in `DECORATIONS` order, unique `ariaLabel`s on `Guitar 6` (two E strings), `on` read from the live row; `commit` passes the event **id**. jsdom render of `ColumnInspector` with fabricated descriptors at 3 and 7 properties in `src/components/capture/__tests__/ColumnInspector-toggles.test.tsx` (new, jsdom docblock). Fails pre-change: no `decorations` property or `toggles` control.
- [X] T027 [P] [US2] Probe INV-017 in `src/components/ui/__tests__/Sheet.test.tsx` (new, jsdom docblock): a `detail: 1` click with no inner `pointerdown` is dropped (`preventDefault` + `stopPropagation`, handler not called); with one it passes; `detail: 0` always passes; record clears after one click. Fails pre-change: `Sheet` has no such rule.
- [X] T028 [US2] Probe INV-013, INV-014, INV-017 (e2e half), INV-018, INV-022 (shared with T040), INV-024 in `e2e/techniques.spec.ts`: INV-013 click bursts (15 pairs, 6 double taps, one pair across two strings, all six) then read stored row and export; INV-017 hold a column on 7 heights (1–5 strings on B Standard, `Guitar 6`, `Guitar 7`) × {mouse, touch}, release over a toggle, `delete`, `close`, assert stored row/export unchanged and sheet open; INV-018 at 375×667 scroll each toggle into view, assert in-viewport and clickable, `close` in viewport at top/middle/bottom of scroll, no horizontal overflow or page scroll, 4 string counts × 2 themes; INV-024 keyboard alone (`Shift+F10`, `ContextMenu`, `details` button) × 6 toggles × {Space, Enter}, single tap on `details`, no route opens the sheet during a selection. Also replace the test at `e2e/capture-surface.spec.ts:1067` ("six rows need no scrolling") with a reference to this INV-018 block (CRLF file; surgical edit). Fails pre-change: no toggles, no `details` button.

### Implementation for User Story 2

- [X] T029 [US2] Extend `src/lib/capture/properties.ts` per contracts/descriptors.md: `ColumnPropertyId` gains `decorations`; `PropertyContext.tuning`; `DecorationChange`, `PropertyValue`, `ColumnToggle`, `ColumnToggleGroup`; `control` gains `"toggles"`; `toggles()` and `appliesToColumn`; `COLUMN_PROPERTIES` order `repeat, chord, decorations, delete`; `commit` calls `toggleDecoration(ctx.event.id, …)`; `propertiesFor` also filters by `appliesToColumn`. Add `tuning` to the context where tests construct it (`ColumnInspector.test.tsx` — CRLF — and `properties.test.ts`).
- [X] T030 [P] [US2] Add the `inspect` control to `src/lib/capture/controls.ts` (declared last, group `contextual`, scope `column-property`; row 2 = `triplet, repeat, times4, chord, inspect`) and add it to `src/lib/capture/__tests__/controls.test.ts:43`.
- [X] T031 [US2] Update `src/components/ui/index.tsx` (CRLF — surgical): `Sheet` class gains `max-h-dvh overflow-y-auto overscroll-contain`; track whether a press began inside the dialog; `onClickCapture` stops a click with `detail !== 0` and no inside press; `detail === 0` passes; record clears.
- [X] T032 [US2] Update `src/components/capture/ColumnInspector.tsx`: sticky header (`sticky top-0 z-10 bg-bg`), `flex-wrap` on every `data-property-row`, `Control` `case "toggles"` rendering `ToggleGrid` per contracts/components.md (`data-testid="decoration-group"`, `data-string`, six equal buttons with `aria-pressed`/`aria-label`, stable keys not containing `on`, on = `border-accent bg-accent text-accent-text`, off = `border-border-subtle bg-bg-raised text-text`, sheet stays open after tap). Depends on T029.
- [X] T033 [US2] Update `src/components/capture/CaptureScreen.tsx`: add the icon-only `inspect` button in row 2 (`aria-label="Open column details"`, 44 px, calls `setInspecting(editable.id)`); pass `tuning` to `propCtx`, the toolbar delete and `InspectorSheet`. Update the INV-002 members in `e2e/capture-surface.spec.ts` to 6 targets × 10 controls. Depends on T030, T032.
- [X] T034 [US2] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run test:e2e` (all `< /dev/null`); fix until T026–T028 pass.

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - The tab reads the same everywhere it appears (Priority: P2)

**Goal**: Prove staff, song page (expanded and compact) and play view agree with the export, and that connectors never break the chord row, bracket, caret, selection or barline.

**Independent Test**: One part with 4 transitions, 6 decorations, a repeated column, a barline, a chord symbol and a triplet: staff tokens equal the exported row split on rails, on all 4 surfaces.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [X] T035 [P] [US3] Probe INV-005 (behavioural) in `e2e/techniques.spec.ts`: build the fixture, read each string's tokens with `staffRows` on capture staff, song page expanded, song page compact and play view, and compare in order with the exported row split on rails; also assert INV-003 widths (`tab-connector` count 0 and each column's `boundingBox` width equal to the plain formula on a no-technique part captured as `e2e/capture.spec.ts` does). Fails pre-change: no connectors or affixes.
- [X] T036 [P] [US3] Probe INV-021 and INV-022 in `e2e/techniques.spec.ts`: chord on arriving column and on source (chord `x` equals column's), connector inside a tuplet (bracket line has no gap across a `Gap`), at its first column and just after its last, caret precedes the `Gap`, barline either side, selection covering both sides and the arrival only, cursor rule across a repeat, tap on a connector moves nothing and a connector is not focusable, not a `button`, not a `tab-column`; INV-022: glyph span computed `background-color` equals a fret number's beside it and is opaque, on 3 surfaces (base, raised, selected) × 2 themes. Fails pre-change: no connectors.
- [X] T037 [P] [US3] Probe INV-023 and INV-027 (computed-style half) in `e2e/techniques.spec.ts`: `aria-label` for the 10 techniques, all six together, a dead note, compact repeated, a transition with no source (not named), plain columns, on capture staff and read-only views; computed style at 375×667: named tokens only, no `opacity` on a surface, on/off toggles differ by fill and luminance, connectors/affixes/chips/toggles × 2 themes. Fails pre-change: no such marks.

### Implementation for User Story 3

- [X] T038 [US3] Fix whatever T035–T037 expose in `src/components/tab/TabStaff.tsx` (CRLF), `src/lib/tab/layout.ts`, `src/app/globals.css` or the song/play view components. Any change that makes a renderer compute a glyph is a bug — change `layout.ts` instead. Add the `TabStaff` jsdom test `src/components/tab/__tests__/TabStaff.test.tsx` (new): gap only where a connector exists, no glyph logic, `tab-connector` is `aria-hidden`.
- [X] T039 [US3] Run `npm run test:e2e < /dev/null` and `npm test < /dev/null`; fix until T035–T037 pass.

**Checkpoint**: One layout, four surfaces, identical.

---

## Phase 6: User Story 4 - An armed latch survives a mid-part insert (Priority: P3)

**Goal**: F14 — the prune waits while the cursor names an undelivered column.

**Independent Test**: Cursor mid-part, arm a latch, paste → still armed; delete the cursor's column from another device → disarms.

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [x] T040 [P] [US4] Probe INV-012 (unit half) in `src/lib/capture/__tests__/latches-prune.test.ts` (new): `cursorPending` and `prunedArmed` — pending returns `armed` itself; not pending returns `lit` when different; 5 latches × {tail ends on notes, tail ends on a barline where stack alone must disarm}. Fails pre-change if `prunedArmed` is unimplemented; if T021 already added it, first run the probe against `git stash`-free pre-change reasoning and note in the test header that the e2e probe T041 is the one that fails first.
- [x] T041 [US4] Probe INV-012 (e2e half) in `e2e/techniques.spec.ts`: 5 latches × 2 clipboard tails, mid-part paste through the toolbar = 10, and 5 latches × a delete from a second tab = 5. Remove the `test.fail` mark in `specs/001-capture-control-surface/review-probes/INV-010-r2-transient-and-part-routes.spec.ts:24` and adopt that member into the suite (move it into `e2e/techniques.spec.ts` or the suite's test directory per `playwright.config.ts` `testMatch`). Fails pre-change: the latch is dropped on paste.

### Implementation for User Story 4

- [x] T042 [US4] In `src/components/capture/CaptureScreen.tsx` add `deliveredId` state and replace the prune effect with `setArmed(prunedArmed(armed, lit, cursorPending(afterId, focusedId, deliveredId)))` only when it differs. Depends on T021, T023.
- [x] T043 [US4] Run `npm run test:e2e < /dev/null` and `npm test < /dev/null`; fix until T040–T041 pass and no `test.fail` remains.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] T044 [P] Verify line endings with `git ls-files --eol` and `git diff --stat` on the four CRLF files; each must stay `i/crlf w/crlf` with a diff showing only the lines really changed (F27). Fix any file that was rewritten wholesale.
- [x] T045 [P] Run quickstart §2 (`git diff --stat main -- src/db drizzle src/lib/model.ts src/lib/sync src/lib/local/clipboard.ts src/lib/local/db.ts` and the two unedited test files) and confirm both print nothing.
- [x] T046 [P] Update `docs/` (and `README` section on notation, if one exists) so the notation table in contracts/notation.md is documented where the project documents its export format. Search `docs/` first; if no such place exists, add nothing.
- [x] T047 Guards: run the project's fast guard tier — `npm run typecheck < /dev/null`, `npm run lint < /dev/null`, `npm test < /dev/null` (structural, inventory, golden, exhaustiveness and fixture-writer tests all live here) and `npm run test:e2e < /dev/null` — and fix every failure BEFORE any push. `e2e/sync.spec.ts` skips itself without `STABLATURE_DATABASE_URL`; that skip is expected.
- [ ] T048 [US3] 🛑 BLOCKED: needs a person with a real browser and phone — run the browser pass in quickstart §6 at 375×667 in light and dark themes without zooming (connectors told apart, tap vs hammer-on, chip legibility, toggle on/off without hue, connectors in selection and on the song page's raised surface, and on a real phone hold-and-lift flips no toggle). Covers SC-008, FR-039 and the person-level half of INV-027. If `/` or `\` fail, adjust `.tab-connector` in `src/app/globals.css` only; the characters do not change.

---

## Dependencies & Execution Order

- **Phase 1** → **Phase 2** (blocks all stories) → **US1 (P1)** → **US2 (P2)** → **US3 (P2)** → **US4 (P3)** → **Polish**.
- Within Phase 2: T004–T009 probes first (parallel; separate files) → T010 → T011 → T012 / T013 (parallel after T011; different files) → T014 parallel → T015 (after T010) → T016.
- US1 needs T010, T015. US2 needs T015 and US1's `CaptureScreen.tsx` edits (same file: T033 after T023). US3 is verification over Phase 2 and can start after US1 if staffed. US4's T042 edits `CaptureScreen.tsx` after T023/T033.
- All e2e probes share `e2e/techniques.spec.ts`: write them sequentially, not in parallel.

## Parallel Examples

```text
# Phase 2 probes together (distinct files):
T004 storage-fence.test.ts · T005 techniques.test.ts (tab) · T006 techniques-repeat.test.ts
T007 techniques-plain.test.ts · T008 single-owner.test.ts · T009 techniques.test.ts (local)

# After T011:
T012 ascii.ts · T013 TabStaff.tsx · T014 globals.css
```

## Implementation Strategy

- **MVP**: Phase 1 + Phase 2 + US1 (T001–T025): transitions captured and drawn identically in staff and export.
- Then US2 (decorations and the sheet fixes), US3 (cross-surface proof), US4 (F14), Polish. Validate each phase's checkpoint with its probes before moving on.
- The only work no pipeline phase can do is T048; every other task is a unit test, a Playwright spec or a typecheck/lint/build command.

## Notes

- Baselines recorded in T001 go here:

## Baseline notes (T001/T002)

- Untouched branch: `npm run typecheck`, `npm run lint`, `npm test` (21 files, 340 tests) all pass. No pre-existing failures.
- CRLF files (`TabStaff.tsx`, `ui/index.tsx`, `e2e/capture-surface.spec.ts`, `ColumnInspector.test.tsx`) all report `i/crlf w/crlf`.

## Phase 8: Review remediation

Probes live in `specs/002-playing-techniques/review-probes/`. Move what an adopted probe needs from `probe-helpers.ts` into `e2e/capture-surface-helpers.ts`. Keep each probe's full enumeration when adopting it.

- [x] T049 Adopt review-probes/INV-017-sheet-press-record.test.tsx into `src/components/ui/__tests__/Sheet.test.tsx` as a failing test first — review F1 (MAJOR), src/components/ui/index.tsx:150
- [x] T050 Adopt review-probes/INV-017-finger-on-a-control.spec.ts into the e2e suite as a failing test first, replacing the block that releases on the column, and keep the finding from review-probes/INV-017-release-over-control.spec.ts that a dragging finger is cancelled as the reason it holds still — review F1 (MAJOR), e2e/techniques.spec.ts:396
- [x] T051 Clear `pressBeganInside` on `pointercancel` and whenever the sheet opens, and not on `pointerup`, so the record cannot outlive the press or the open that made it — review F1 (MAJOR), src/components/ui/index.tsx:146
- [x] T052 Wait for the arrangement write to land before `page.goto` in the INV-005 test, then confirm with `--repeat-each=8` on that test and one whole `npm run test:e2e` — review F2 (MAJOR), e2e/techniques.spec.ts:563
- [x] T053 Adopt review-probes/INV-004-007-008-026-layout.test.ts into `src/lib/tab/__tests__/` — review § Invariants INV-004, INV-007, INV-008, INV-026, src/lib/tab/__tests__/techniques.test.ts:39
- [x] T054 Adopt review-probes/INV-002-006-013-014-015-016-writes.test.ts into `src/lib/local/__tests__/` — review § Invariants INV-002, INV-006, INV-013, INV-014, INV-015, INV-016, src/lib/local/__tests__/techniques.test.ts:1
- [x] T055 Adopt review-probes/INV-025-no-id-branch.test.tsx into `src/components/capture/__tests__/` — review § Invariants INV-025, src/lib/tab/__tests__/single-owner.test.ts:1
- [x] T056 Adopt review-probes/INV-006-positions.spec.ts into the e2e suite — review § Invariants INV-006, e2e/techniques.spec.ts:82
- [x] T057 Adopt review-probes/INV-009-010-one-shot-and-pairs.spec.ts into the e2e suite, replacing the "back-to-back" members that press once — review § Invariants INV-009, INV-010, e2e/techniques.spec.ts:82
- [x] T058 Adopt review-probes/INV-011-012-targets-and-routes.spec.ts into the e2e suite, covering a real part switch and stack on a barline tail — review § Invariants INV-011, INV-012, e2e/techniques.spec.ts:164, e2e/techniques.spec.ts:716
- [x] T059 Adopt review-probes/INV-013-bursts.spec.ts into the e2e suite, replacing the burst that awaits each click — review § Invariants INV-013, e2e/techniques.spec.ts:335
- [x] T060 Adopt review-probes/INV-018-024-sheet-reach.spec.ts into the e2e suite, replacing the blocks it supersedes — review § Invariants INV-018, INV-024, e2e/techniques.spec.ts:423, e2e/techniques.spec.ts:465
- [x] T061 Adopt review-probes/INV-019-020-layout.spec.ts into the e2e suite, including the long-label mutation, replacing the block it supersedes — review § Invariants INV-019, INV-020, e2e/techniques.spec.ts:265
- [x] T062 Adopt review-probes/INV-021-022-structures.spec.ts into the e2e suite, replacing the blocks it supersedes — review § Invariants INV-021, INV-022, e2e/techniques.spec.ts:584, e2e/techniques.spec.ts:641
- [x] T063 Adopt review-probes/INV-003-005-023-027-surfaces.spec.ts into the e2e suite, with its full fixture — review § Invariants INV-003, INV-005, INV-023, INV-027, e2e/techniques.spec.ts:501
