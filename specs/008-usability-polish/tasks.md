---

description: "Task list for 008 Usability polish: capture height, part card overflow, honest labels"
---

# Tasks: Usability polish: capture height, part card overflow, honest labels

**Input**: Design documents from `/specs/008-usability-polish/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: Requested by the plan. Every invariant in plan.md § Invariants has a probe task, first in its phase, that must FAIL on the pre-change code.

**Organization**: By user story, in priority order. US-1 is what must land; US-2 to US-6 are independent of it and of each other.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: different files, no dependency on an incomplete task. Tasks that append to the same spec file are NOT [P].
- All paths are from the repo root. Every touched file is **LF**.
- Run every command with `< /dev/null`. Run builds and Playwright **synchronously**, in the foreground. Never run the build or e2e while a `next dev` holds `.next`.
- Next.js here differs from training data: read the relevant guide in `node_modules/next/dist/docs/` before writing route or component code.
- Browser-level checks are written as **Playwright specs** (`npx playwright test e2e/<spec> --project=mobile|desktop`) that set the viewport and assert. Nothing in this list asks the implementer to open a browser by hand.

## Scope fence (never edit)

`src/db/`, `drizzle/`, `src/lib/server/`, `src/lib/sync/`, `src/app/api/`, `src/lib/model.ts`, `src/lib/tab/`, `src/lib/export/`, `src/lib/rhythm/`, `src/lib/reading/`, `src/lib/arrangement/`, `src/lib/capture/latches.ts`, `src/lib/chords.ts`, `src/components/app/PlayView.tsx`, `public/sw.js`, `e2e/usability-height-budget.spec.ts`, `e2e/usability-wrap.spec.ts`, `e2e/usability-staves.spec.ts`, `src/lib/local/*` except additions to `queries.ts` and `hooks.ts`. If a must-pass-unedited spec trips, stop and report it. Do not edit it.

---

## Phase 1: Setup (record "today", before any source edit)

**Purpose**: Capture the unedited build's behaviour. This must precede every source edit.

- [X] T001 Create `e2e/polish-before.record.ts` (matched by no default `testMatch`; run through `e2e/polish-before.config.ts`, since the default config would not find it), then run `npm run build < /dev/null` and `npx playwright test e2e/polish-before.record.ts --project=mobile < /dev/null` per quickstart.md §1. It writes `e2e/fixtures/capture-375-before.json` (at 375×667, for {4,5,6 strings} × {plain, chord, chord+bracket} × {dark, light} × {at rest, selecting}: each capture row's rect and the staff's `outerHTML`) and `e2e/fixtures/card-actions-before.json` (Dexie dump after `+ variant` and after Delete on a part, on a part used in the arrangement, and on a variant's base). Record once. Never re-record to make a test pass.
- [X] T002 Run `npm run typecheck`, `npm run lint` and `npm test` on the unedited tree and note any pre-existing failures in a new "Baseline" line in `specs/008-usability-polish/research.md`, so later failures are attributable.

---

## Phase 2: Foundational (guards that every story relies on)

**Purpose**: The scope fence and amendment checks (INV-023, INV-024), and the shared CSS token.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [X] T003 Probe INV-023 and INV-024: add `check:untouched-polish` and `check:polish-amendments` entries to `package.json` pointing at `scripts/untouched-by-polish.sh` and `scripts/check-polish-amendments.sh`, then run both. They must FAIL now (the scripts do not exist yet; they pass after T004–T005). The scripts live in the repo, not a temp dir.

### Implementation

- [X] T004 Create `scripts/untouched-by-polish.sh` (LF): for every path in the *Scope fence* print `zero diff` against `main`, tracked or untracked, fail on anything else. For `src/lib/local/queries.ts` and `hooks.ts`, fail if `git diff main -U0` has a removed line other than a changed import list, and print the added declarations. Also compare the slice of `src/components/tab/TabStaff.tsx` from the one-line branch's `return (` to the end of `TabStaff`'s body, byte for byte, on `main` and on the branch. Test it in a throwaway `git worktree` with a deliberate edit to a fenced path, then remove the worktree.
- [X] T005 Create `scripts/check-polish-amendments.sh` (LF): each row of plan.md's *Existing tests this changes on purpose* table must be named in `docs/DECISIONS.md`, and each FR-035 requirement in `specs/007-usability-pass/spec.md` (FR-001, FR-026, FR-056, and the Out of Scope "Wrapping … capture" line) must carry `Amended by spec 008` on its own line. Print `polish amendments: ok`. Also confirm `npm run check:usability-amendments` still passes.
- [X] T006 In `playwright.config.ts`, add `polish-saving.spec.ts` and `polish-bands-list.spec.ts` to `PHONE_ONLY`. Confirm with `npx playwright test --list --project=desktop < /dev/null` that they are absent there.
- [X] T007 Move `--line-gap: 0.75rem` from `.tab-staff-wrapped` to `:root` in `src/app/globals.css`, value unchanged. `.tab-staff-wrapped` keeps `--gutter`. No other rule changes (research R2, decision 10).

**Checkpoint**: Guards exist. Stories can proceed.

---

## Phase 3: User Story 1 - Capture uses the whole screen (Priority: P1) 🎯 MVP

**Goal**: The capture band wraps when two whole lines fit, puts the cursor's line at the bottom, and is byte-identical at 375×667.

**Independent Test**: A six-string part of ≥12 bars at 412×915, cursor at the end: blank under one line and the cursor's line is the bottom one. At 375×667 the screen is unchanged.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [X] T008 [US1] Probe INV-003 in `e2e/polish-band.spec.ts` (new; mobile + desktop): on the production build, for **Trig** × **Pos** × **Wr** (412×915, 1280×800; and **Wr390**) on a 16-bar **Shape**, assert the caret's `.tab-bar-run` bottom is within 1px of the band's content bottom, and the blank (band top to top of highest run in view) is < one line. At the start: line 1 at the bottom with only runway above. Must FAIL now (today the blank at rest is 250px at 412×915 and 220.8 at 1280×800).
- [X] T009 [US1] Probe INV-002 in `e2e/polish-band.spec.ts`: read the band's content height, a column's height and the band's `row-gap`; assert `.tab-staff-wrapped` exists ⇔ `band ≥ 2·line + gap`, and when it exists ≥2 distinct run tops are in view (or the part's line count). Sweep **Sz** × **Rows** × {chord form closed, open}, then 412-wide × heights 600–1000 in 20px steps with 6+chord+bracket; assert the mode never flips back and forth within one size. Must FAIL now (capture never wraps).
- [X] T010 [US1] Probe INV-005 in `e2e/polish-band.spec.ts`: map each `data-column` to its run's top; move the cursor to every column of the 16-bar part, to the start and end, start/extend a selection, long press; the map must be identical each time (**Wr**; also the wide-bar **Shape**). Must FAIL now (the test first asserts wrapped mode is active).
- [X] T011 [US1] Probe INV-008 in `e2e/polish-band.spec.ts`: median time from a fret's `pointerup` to the new column's paint (`MutationObserver` + `requestAnimationFrame`) over 40 taps on the same 16-bar part; wrapped (412×915) ≤ one-line (375×667) × 1.1 + 2ms, at the end and mid-part. Must FAIL now (wrapped mode precondition fails).
- [X] T012 [US1] Probe INV-001 in `e2e/polish-band.spec.ts`: compare each row's rect and the staff's `outerHTML` with `e2e/fixtures/capture-375-before.json` for {4,5,6 strings} × {plain, chord, chord+bracket} × **Th** × {at rest, selecting} at 375×667, plus 7 strings at 375×667 and 6 at 375×553 (one line with a swipe). `e2e/usability-height-budget.spec.ts` runs unedited. This is a regression guard: it PASSES on pre-change code by design. To show it can fail, run it once against a deliberately perturbed one-line branch of `TabStaff` (revert after) and note that in the commit message.
- [X] T013 [US1] Probes INV-004, INV-006, INV-007 in `e2e/polish-band-interactions.spec.ts` (new; mobile + desktop). INV-004: for **Still** × {top line in view, bottom line} × **Wr**, the band's `scrollTop` and every run's `top` are unchanged within 1px (sync arrival via a second browser context's own page). INV-006: on every line, chord label, bracket, active rule, selection band and caret sit within 1px of their column, and the caret's run is the run of the column it follows (first run at the start); **Rows** × {after last column of a line, after first, before first of the part, after a ×4 column}. INV-007: run one scripted sequence on a one-line staff (375×667) and a wrapped one (412×915) and compare Dexie dumps (ignoring ids and clocks), the inspector title and the selection count; sequence: tap-select; extend across a line; group (tuplet and plain) with the bracket in view; ungroup; long-press on line 1 and the last line; each key in **Trig**; `followTail` and `keepCaretInView` on the wide bar. Must FAIL now (wrapped mode absent).
- [X] T014 [P] [US1] Probe INV-009: create `src/components/tab/__tests__/TabStaff.wrapped-unchanged.test.tsx` (jsdom docblock) asserting `renderToStaticMarkup(TabStaff)` with `wrap` and none of the capture props equals a snapshot of the same render recorded from the unedited `TabStaff`. Also run `src/lib/reading/__tests__/frets-unchanged.test.ts` unedited. Regression guard: PASSES now by design; show it can fail by temporarily changing the wrapped root's class, then revert.

### Implementation for User Story 1

- [X] T015 [P] [US1] Create `src/lib/capture/band.ts` with `bandLines`, `bandWraps`, `anchorFor` exactly per contracts/capture-band.md §1 (pure, React-free), and `src/lib/capture/__tests__/band.test.ts` with hand tables: exactly 2 lines, 2 lines less 0.1px, line 0, gap 0; anchor at the first, last and a middle line; a part that fits. Run `npx vitest run src/lib/capture/__tests__/band.test.ts`.
- [X] T016 [US1] Edit the wrapped branch only of `src/components/tab/TabStaff.tsx` per contracts/capture-band.md §4 a–f: start caret when `insertAfterEventId === null`; zero-advance caret holder (`relative w-0 shrink-0`, bar `absolute -left-px w-0.5`) when `wrap && insertAfterEventId !== undefined`; wrapped-root ref with `followTail` setting the last run's `scrollLeft`; `keepCaretInView` horizontal-only on the caret's run; `revealGroups` finds `[data-start]` under the wrapped root and uses `scrollIntoView({ block: "nearest", inline: "nearest" })`; update the `wrap` doc comment. Do NOT touch the one-line branch. Add jsdom tests for a–e in `src/components/tab/__tests__/TabStaff.wrapped-capture.test.tsx`. Run T014's test and `npx vitest run src/components/tab src/lib/tab src/lib/reading` — all pass unedited.
- [X] T017 [US1] Create `src/components/capture/useCaptureBand.ts` per contracts/capture-band.md §2: one `ResizeObserver` plus a layout effect read the band height, a drawn column's height and the band's computed `row-gap`; anchoring in a layout effect keyed on (`anchorRequest`, delivery, `wrapped`, band size) calls `anchorFor`, sets `runway`, then `band.scrollBy({ top: lineBottom − bandBottom })`; one-line mode does nothing; entering/leaving wrapped counts as a trigger and bumps `keepCaretInView` on leaving. No layout reads on the fret-tap path.
- [X] T018 [US1] Wire `src/components/capture/CaptureScreen.tsx` per contracts/capture-band.md §3: `bandRef`, `wrapped`, `runway` padding on the band's single child, `wrap={wrapped}` on `TabStaff`; add `anchorRequest`, bumped **before** the awaited write, at every anchor trigger in research.md R4 (writes at the cursor, keys, jumps, opening, part change by chip and key, fret/dead-note/`space`/barline/`paste`/stable delete/repeat/×4/chord symbol/triplet, column and bar moves, start/end keys and jumps, cut/delete selection, entering wrapped mode, band resize). Taps, selections, long press, inspector writes, group-from-selection, ungroup, copy, cancel, latch toggles, sync arrivals and the help overlay must NOT bump it. Keep the other TabStaff props exactly as today. `CaptureScreen.tsx` is also edited by T026 and T039–T040: do those sequentially.
- [X] T056 [US1] Apply plan.md Open item 7's decision (a) to the documents: in `spec.md` amend FR-003 and in `plan.md` amend INV-001's row and the *Must pass unedited* list so that "unchanged" applies where two whole lines do not fit (six strings with chord and bracket at 375×667 stays the deciding byte-identical case), and move `usability-height-budget.spec.ts` and `usability-staves.spec.ts` from *Must pass unedited* to the re-pinned table with the reason. Drop those two paths from `scripts/untouched-by-polish.sh`'s unedited list and add them to whatever `scripts/check-polish-amendments.sh` checks. Log the decision, its reason and both rejected options in `docs/DECISIONS.md`. Run `npm run check:untouched-polish` and `npm run check:polish-amendments`.
- [X] T057 [US1] Amend per line, weakening nothing: `e2e/usability-height-budget.spec.ts` counts distinct `.tab-cell` tops within the cursor's line (the last `.tab-wrapped-body` run when wrapped, the staff otherwise) and still expects `tuning.strings`, still requires them in view, and keeps every other assertion; `e2e/usability-staves.spec.ts` `measureSurface` takes each chord's edge from the run it sits in when wrapped. Amend `e2e/polish-band.spec.ts` INV-001 cases and `e2e/fixtures/capture-375-before.json` use so 4- and 5-string at 375×667 are checked as wrapped (INV-002/003) rather than unchanged, and 6-string chord+bracket stays byte-identical. If a chord label really crosses its run's edge on screen, fix the wrapped branch of `TabStaff.tsx`, not the measure.
- [X] T019 [US1] After T056-T057, run `npm run build < /dev/null` then `npx playwright test e2e/polish-band.spec.ts e2e/polish-band-interactions.spec.ts --project=mobile --project=desktop < /dev/null`; fix until T008–T013 pass. Also run `usability-height-budget` and `usability-staves` as amended by T057, and `usability-wrap`, `grouping-band` and every `click-*` spec unedited.
- [X] T020 [US1] Run `npm run typecheck < /dev/null` and `npm run lint < /dev/null`; fix.

**Checkpoint**: US-1 works and is testable alone.

---

## Phase 4: User Story 3 - Say what is true about saving (Priority: P2)

**Goal**: Signed-out users are never told `unsynced`; "not known" shows the count; one `pendingWords` feeds the top bar and capture header.

**Independent Test**: Signed out, add notes: top bar `Saved on this device`, header `saved · sign in`. Signed in and offline: count shows.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [x] T021 [US3] Probe INV-018 (unit) in `src/lib/__tests__/saving.test.ts` (new): hand-written table over `signInKnowledge` (each session shape × {`idle`,`syncing`,`offline`,`signed-out`,`error`, undefined}) × `pendingWords` (pending ∈ {undefined, 0, 1, 14}) per research.md R8; expected values written by hand, not computed. Fails now (module missing).
- [x] T022 [US3] Probes INV-018, INV-019, INV-020 in `e2e/polish-saving.spec.ts` (new; phone-only). INV-018: each **Sess** (route interception of `/api/auth/get-session` and `/api/sync/push`, `setOffline`) × **Pend** × **Surf** × {375, 1280}: presence/absence of `unsynced`, digit count, `Saved on this device`, `saved · sign in` per the table. INV-019: the short-form link's width ≤ a `99 unsynced` span with today's classes injected into the same header; back button ≥ 8ch; open chip inside the chip strip's visible rect; link ≥ 44 tall, named `SAVED_HERE_NAME`; {1,5,12 parts} × {short title, 120-char title} × **Th** × {375, 390}. INV-020: push answers 500 → top bar shows the error message, not saving words nor count. Fails now.

### Implementation for User Story 3

- [x] T023 [P] [US3] Create `src/lib/saving.ts` per contracts/saving-and-lists.md §1 (`signInKnowledge`, `pendingWords`, `SAVED_HERE`, `SAVED_HERE_SHORT`, `SAVED_HERE_NAME`; type-only import from `@/lib/sync/client`). Make T021 pass.
- [x] T024 [US3] Create `src/components/app/useSaving.ts` per contracts §2 (read-only `useSession`, sync state, pending count → one `useSaving()`).
- [x] T025 [US3] Edit `src/components/app/TopBar.tsx`: `SyncBadge` via `useSaving()`; `Saved on this device` in the sans face; errors keep precedence.
- [x] T026 [US3] Edit the header of `src/components/capture/CaptureScreen.tsx` to the short form `saved · sign in` (link, ≥44 tall, `SAVED_HERE_NAME`) via the same `useSaving()`.
- [x] T027 [US3] FR-028 test edits, each named in `docs/DECISIONS.md`: the quiet state waits for no `N unsynced` AND no `Saved on this device` or `saved · sign in` (and asserts the signed-out words are absent, so it cannot pass on a page that merely lost the count) in `e2e/grouping-queued-row.spec.ts`; `e2e/capture-matrix.spec.ts` and `e2e/rhythm-capture-height.spec.ts` pin the short form in place of `N unsynced`.
- [x] T028 [US3] Run `npm run build < /dev/null` and `npx playwright test e2e/polish-saving.spec.ts e2e/grouping-queued-row.spec.ts e2e/capture-matrix.spec.ts e2e/rhythm-capture-height.spec.ts --project=mobile < /dev/null`; fix.

**Checkpoint**: US-3 works alone.

---

## Phase 5: User Stories 2 (P2) and 5 (P3) - Part cards stop shouting; unnamed part invites a name

**Goal**: Card faces show no Delete/`+ variant`/Edit control and no danger ink; one modal `OverflowMenu` holds them; the label links to capture; an unnamed part shows a distinct invitation. (US2 and US5 edit the same component, so they share a phase.)

**Independent Test**: Song with three parts at 375×667: zero red controls, zero visible Deletes; every action reachable by keyboard.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T029 [US2] Probes INV-010, INV-011, INV-012 in `e2e/polish-part-card.spec.ts` (new; mobile + desktop). INV-010: 0 accessible controls named Delete/`+ variant`/Edit on a closed card face and no computed `color`/`background-color`/`border-color` equal to `--danger`; **Card** × **Th** × **Sz**, song with three parts. INV-011 (keyboard only): Tab to trigger, Enter/Space opens, first item focused, ArrowDown/ArrowUp/Home/End, Enter activates, each **Close** returns focus to the trigger; accessibility snapshot shows `menu` and named `menuitem`s; trigger name holds the label. INV-012: open by {tap, mouse click, Enter, Space} with Delete under the press point → part count unchanged; each **Outside** tapped with the menu open → URL, Dexie dump unchanged, menu closed, focus on trigger; {coarse, fine}. Fails now (no menu).
- [x] T030 [US2] Probes INV-013, INV-014, INV-015 in `e2e/polish-part-card.spec.ts` and `e2e/usability-floors.spec.ts`. INV-013: menu rect inside the viewport and above the top of `song-actions` when visible; first card, last card at page end, card at top edge × **Sz**; print emulation: no trigger, no dialog; second trigger inert while open. INV-014: extend the `usability-floors.spec.ts` walker to run with each menu open (floors unchanged: touch ≥44×44, items ≥44 tall, mouse column of spec 007's table). INV-015: Dexie dump after the menu's `+ variant` and Delete equals `e2e/fixtures/card-actions-before.json`; label link URL equals the Edit item's URL; Delete on a part used in the arrangement and on a variant's base. Fails now.
- [x] T031 [US5] Probe INV-016 in `e2e/polish-part-card.spec.ts`: {null name, name saved as spaces} × **Th** × {coarse, fine}: the invitation has an `svg` and computed `text-decoration-style: dashed`, a real name has neither; greyscale screenshot crops of the two differ; `measureContrast` ≥ 4.5 on `bg-raised`; activating it opens `Part name` with today's value. Fails now.

### Implementation

- [x] T032 [P] [US2] Create `src/components/ui/OverflowMenu.tsx` (LF) per contracts/part-card.md §1: modal `<dialog>` with `role="menu"` and `menuitem`s, stray-click guard (a click whose press did not begin inside the dialog runs nothing), focus management, ArrowDown/ArrowUp/Home/End, Escape/backdrop/Tab close returning focus to the trigger, `destructive` divider + 8px and danger ink, items ≥44 tall, hidden in print, viewport-clamped placement above the bottom bar. Read `Sheet` in `src/components/ui/index.tsx` for the same stray-click bug (spec 007 T121).
- [x] T033 [US2] Edit `src/components/app/SongView.tsx`: export one `partCaptureHref`; the `PartCard` face loses Delete/`+ variant`/Edit; add the `OverflowMenu` with the same `deleteRow("parts", id)` and `createVariant(part)` calls, moved not rewritten; `+ variant` only on a non-variant; the label becomes a link to capture using `partCaptureHref`, and the Edit item uses the same; label link and trigger meet the floors.
- [x] T034 [US5] In `src/components/app/SongView.tsx`, draw the unnamed-part invitation (pencil glyph + dashed underline, existing tokens, solid not opacity, contrast ≥4.5) for `null` or whitespace names; a real name has neither.
- [x] T035 [P] [US2] Create `e2e/part-card-helpers.ts` with `openPartMenu(page, name)` and `partAction(page, name, action)` per contracts/part-card.md.
- [x] T036 [US2] Reroute through `partAction` and name each in `docs/DECISIONS.md`: `e2e/capture-surface.spec.ts`, `e2e/capture.spec.ts`, `e2e/grouping.spec.ts`, `e2e/reading-sync.spec.ts`, `e2e/sync-no-lost-rows.spec.ts`, `e2e/variant-marks.spec.ts`, `e2e/variant-marks-paint.spec.ts`; in `e2e/usability-toolbars.spec.ts` measure the "part delete" gap with the menu open (≥8 between Delete and its nearest item). `e2e/usability-every-input.spec.ts` stays unedited.
- [x] T037 [US2] Run `npm run build < /dev/null` and `npx playwright test e2e/polish-part-card.spec.ts e2e/usability-floors.spec.ts e2e/usability-toolbars.spec.ts e2e/usability-every-input.spec.ts e2e/capture-surface.spec.ts e2e/capture.spec.ts e2e/grouping.spec.ts e2e/reading-sync.spec.ts e2e/sync-no-lost-rows.spec.ts e2e/variant-marks.spec.ts e2e/variant-marks-paint.spec.ts --project=mobile --project=desktop < /dev/null`; fix. **Status (pass 5):** build passes; every spec in the list passes on mobile and desktop EXCEPT 6 desktop-project cases in `e2e/capture-surface.spec.ts` (INV-012 "needs no scrolling" dark/four/column, dark/chords/column, light/tuplet/barline; INV-012 "keeps its strings" plain, tuplet; "chord form open" plain, tuplet): the capture screen at 375x667 on a fine pointer overflows by 8px (page) / 15 vs <=2 (chord form). That screen is not touched by the part card; suspect the capture-band wrap from Phases 2-4. Fix those, rerun, then tick.

**Checkpoint**: US-2 and US-5 work alone.

---

## Phase 6: User Story 4 - Read the capture status line at a glance (Priority: P2)

**Goal**: The status row's facts are separate segments with 1px rules and weight; one line, 26px, words unchanged.

**Independent Test**: The spec 007 status-row matrix at 375 including stack armed with `Dsus4` (F23).

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [x] T038 [US4] Probes INV-021 and INV-022 in `e2e/usability-status-row.spec.ts` (extend): `read` walks segments by test id, not child index; row height 26; one line; `status-position` whole (`scrollWidth ≤ clientWidth`); symbol up to 10 chars whole except beside a refusal; a `Sep` between each pair of adjacent visible segments; symbol weight greater than the tones'; accessible text reads `<symbol> chord: <t1>, <t2>, …`; jumps ≥44×24; **Lat** × **Chd** × **Dur** × {digit waiting, none} × {refused, not} × {end, start, mid} at 375 (F23 named). INV-022: `status-position` text equals today's literal from a hand table. The separation checks fail now.

### Implementation for User Story 4

- [x] T039 [US4] Extract `StatusRow` to `src/components/capture/StatusRow.tsx` from `CaptureScreen.tsx` with NO change (move `statusFor`, `statusShortFor`, `TRIPLET_REFUSAL` and the position literals; do not retype them); run `npm run typecheck` and the existing `usability-status-row` and `capture-matrix` specs green.
- [x] T040 [US4] Segment `StatusRow` per contracts/status-row.md: gap 4px→2px, `Sep` 1px rules, symbol `font-semibold`, sr-only ` chord:` text, test ids (`status-position`, `status-symbol`, `status-tones`, `cursor-duration`, `digit-waiting`), ellipsis-while-room cut rule (plan decision 4). `latches.ts` stays untouched.
- [x] T041 [US4] Run `npm run build < /dev/null` and `npx playwright test e2e/usability-status-row.spec.ts --project=mobile < /dev/null`; fix.

**Checkpoint**: US-4 works alone.

---

## Phase 7: User Story 6 - The band list shows what a member cares about (Priority: P3)

**Goal**: The bands page shows a live song count instead of the slug, from IndexedDB, with no request.

**Independent Test**: Bands page with a band of three songs and a band with none.

### Invariant probes for User Story 6 (FIRST — each must FAIL on the pre-change code)

- [X] T042 [US6] Probe INV-017 in `src/lib/__tests__/words.test.ts` (new; hand table for `songCountWords`: 0, 1, 2, 3) and `e2e/polish-bands-list.spec.ts` (new; phone-only): no band slug in the list's text; the count line equals a hand-expected value for bands with {0,1,2,3} songs, one with a deleted song, songs in another band, and a song arriving by sync in a second context; `page.on("request")` sees no request while the list renders and updates. Fails now.

### Implementation for User Story 6

- [X] T043 [P] [US6] Create `src/lib/words.ts` (`songCountWords`).
- [X] T044 [P] [US6] Add `songCountsByBand` to `src/lib/local/queries.ts` (filters with the same `isLive` as `listSongs`) and `useSongCounts` to `src/lib/local/hooks.ts`. Additions only; no removed line except the import list.
- [X] T045 [US6] Edit `src/app/page.tsx`: song count in place of the slug.
- [X] T046 [US6] Run `npx vitest run src/lib/__tests__/words.test.ts`, then `npm run build < /dev/null` and `npx playwright test e2e/polish-bands-list.spec.ts --project=mobile < /dev/null`; fix.

**Checkpoint**: US-6 works alone.

---

## Phase 8: Polish, amendments and human-owned checks

**Purpose**: After-figures, amendments, guards, and the checks only a person can do.

- [x] T047 Amend spec 007 in place in `specs/007-usability-pass/spec.md`: FR-001, FR-026, FR-056 and the Out of Scope "Wrapping … capture" line each get an `Amended by spec 008` line (FR-035).
- [x] T048 Update `docs/DECISIONS.md`: the measured figures (research R1, R6, R7, R10), each re-pinned test from plan.md's *Existing tests this changes on purpose* table by file name, Deviations 1–3 and decisions 4–11, and a "Browser pass findings" heading for T052. Then run `npm run check:polish-amendments < /dev/null` and `npm run check:usability-amendments < /dev/null`.
- [x] T049 Re-run the research probe for the after-figures: `cd specs/008-usability-polish/research-probes && npx playwright test --config playwright.measure.config.ts < /dev/null`; record before/after blank heights (FR-011) in `docs/DECISIONS.md`. Run `npm run typecheck < /dev/null` to confirm the probe still type-checks.
- [x] T050 Guards: run the project's fast guard tier — `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:untouched-polish`, `npm run check:polish-amendments`, `npm run check:usability-amendments`, and any other `check:*` script in `package.json` — and fix every failure BEFORE any push. Then run `npm run build < /dev/null` and `npm run test:e2e < /dev/null` (expect green apart from spec 006 FU19 and `durations.spec.ts:7` under load; do not lengthen a wait for them). (Result: all green except `check:untouched-reading`, spec 004's fence against main, which lists this branch's planned files; see DECISIONS "008 T050". e2e: 2 load flakes passed on rerun.)
- [x] T051 Probe INV-025: confirm T052–T055 are present, unchecked and marked `🛑 BLOCKED`, and that no other task in this file claims desktop proof of them.
- [ ] T052 🛑 BLOCKED: needs a person at a real browser window (no display or browser is available to the pipeline) — do the quickstart.md §6 pass at actual size, in both themes, at 375×667, 390×844, 412×915 and 1280×800 over the eight screens in that table (INV-025, SC-012), and record the findings under "Browser pass findings" in `docs/DECISIONS.md`.
- [ ] T053 🛑 BLOCKED: needs a real iOS Safari and an Android Chrome phone — confirm a tap outside the open part menu closes it and does not act on what was under it (quickstart.md §7.1).
- [ ] T054 🛑 BLOCKED: needs a real phone with a thumb on the neck — confirm the band moves the cursor's line to the bottom without a visible jump (quickstart.md §7.2).
- [ ] T055 🛑 BLOCKED: needs a phone browser with its toolbars showing — confirm that where the band's height is between one and two lines, the band shows one line (quickstart.md §7.3).

---

## Dependencies & Execution Order

- Phase 1 first (T001 before any source edit). Phase 2 next (T007 is needed by US-1).
- US-1 (Phase 3) is the MVP and depends only on Phases 1–2. US-3, US-2/5, US-4 and US-6 are independent of it and of each other. US-1 (T018), US-3 (T026) and US-4 (T039–T040) all edit `CaptureScreen.tsx`: do those edits sequentially, never in parallel.
- Phase 8 depends on every story built. T052–T055 are human-owned: owed, not missing.
- Within a story: probes → implementation → build + spec run.

## Parallel Opportunities

- T014 with T015; T023 with T021; T032 with T035; T043 with T044.
- US-6 and US-2/5 can run alongside other stories, apart from `CaptureScreen.tsx`.

## Implementation Strategy

MVP first: Phases 1–3, validate US-1, then US-3, US-2/5, US-4, US-6 in any order, then Phase 8. If the entry runs long, US-1 is the one that must land.

## Notes

- Probes T008–T011, T013, T021–T022, T029–T031, T038 and T042 must be seen failing before their implementation. T012 and T014 are regression guards that pass by design and are shown able to fail by perturbation.
- Never edit a must-pass-unedited spec; never re-record `capture-375-before.json` to make a test pass.

---

## Phase 9: Review remediation

From `review.md` round 1: three MAJOR findings, no BLOCKER. MINORs are in review.md § Follow-ups and are not tasks. The probes live in `specs/008-usability-polish/review-probes/`. Run them with `npx playwright test --config specs/008-usability-polish/review-probes/playwright.review.config.ts review-probes/<file>` after `npm run build`; the config serves `.next` on port 3119. Adopting a probe means moving it into `e2e/` with the drivers it needs from `review-probes/helpers.ts`. A probe-adoption task comes before its fix, and must be seen failing before the fix.

- [X] T058 [US1] Adopt part 1 of `review-probes/INV-004-still-after-trigger.probe.ts` into `e2e/polish-band-interactions.spec.ts` as a failing test first. Then adopt part 2 (copy, group, ungroup, latch toggle, help overlay and inspector write × {top line, bottom line}).
  - Part 1, on a wrapped 412×915 band: a column tap on the top line about 150ms after a fret tap, the `end ⇥` jump and ArrowLeft must leave the tapped column (within 1px) and the band's `scrollTop` where they were. Delete the 600ms "past the hook's 400ms delivery window" wait at `e2e/polish-band-interactions.spec.ts:28`–`29`, so that no Still is timed around the defect.
  - See part 1 fail on the current build.
  - Review F1 (MAJOR), INV-004, `src/components/capture/useCaptureBand.ts:132`.
- [X] T059 [US1] Make an anchor request outstanding by state, not by time.
  - Replace the `DELIVERY_MS` window (`src/components/capture/useCaptureBand.ts:23`, `:72`–`87`, `:132`–`133`) with the contract's `awaitingDelivery` (`contracts/capture-band.md:40`): set it at the bump in `CaptureScreen.tsx`, before the awaited write, and clear it when the write has been delivered.
  - Make every Still path spend any outstanding request: `routeCursor` (`src/components/capture/CaptureScreen.tsx:449`, wired at `:654`), the selection paths and the inspector.
  - The result: a tap, select, extend, long press, cancel or sync arrival never anchors, however soon it follows a trigger, and a write delivered after more than 400ms still anchors.
  - Then T058 passes. `review-probes/INV-003-every-trigger.probe.ts` (every Trig × Pos × config) and `review-probes/INV-008-tap-latency.probe.ts` still pass.
  - Review F1 (MAJOR), FR-005, SC-004.
- [X] T060 [US4] Adopt the FR-031 order check of `review-probes/INV-021-022-status-matrix.probe.ts` into `e2e/usability-status-row.spec.ts`'s matrix as a failing test first.
  - The check: at 375, in no state is `cursor-duration` cut (`scrollWidth > clientWidth`) while `status-tones` still has width.
  - Today 78 of the 465 states fail, for example `Am` with `whole note`.
  - Extend the spec's entry in `docs/DECISIONS.md` (FR-036).
  - Review F2 (MAJOR), FR-031.
- [X] T061 [US4] Make the tones give way before the duration in `src/components/capture/StatusRow.tsx:92` (`status-tones`) and `:122` (`cursor-duration`).
  - For example, a much larger `flex-shrink` on the tones than on the duration. Each part still shows an ellipsis while it has room (Deviation 4).
  - Update the markup sketch in `contracts/status-row.md:19`, `:25` to match its rule at `:46`.
  - Then T060 passes, and all of `review-probes/INV-021-022-status-matrix.probe.ts` passes.
  - Review F2 (MAJOR).
- [X] T062 Adopt `review-probes/INV-024-amendments-say-what-changed.sh` into `scripts/check-polish-amendments.sh` as a failing check first.
  - Each FR-035 member's `Amended by spec 008` note must state the change FR-035 names, not only carry the marker (`scripts/check-polish-amendments.sh:22`–`27`).
  - See it fail on spec 007 FR-026.
  - Review F3 (MAJOR), INV-024.
- [X] T063 Amend spec 007 FR-026's `Amended by spec 008` note (`specs/007-usability-pass/spec.md:367`) to say that the duration may give way after the tones (FR-031).
  - Record the before and after in the 008 amendments entry of `docs/DECISIONS.md`.
  - Then T062 and `npm run check:usability-amendments` pass.
  - Review F3 (MAJOR), FR-035.
- [X] T064 [US1] Adopt the band probes that held, as regression tests: `review-probes/INV-002-rows-sizes-form.probe.ts`, `INV-003-every-trigger.probe.ts` (keep its chunking and negative control), `INV-005-006-every-column.probe.ts`, `INV-006-repeat-column.probe.ts`, test 2 of `INV-006-caret-adds-no-overflow.probe.ts`, `INV-008-tap-latency.probe.ts`, and the SC-001 assertion of `FR-011-after-figures.probe.ts`.
  - Destination: `e2e/polish-band.spec.ts`, or a sibling `e2e/polish-band-sets.spec.ts` if run time calls for it.
  - Review: INV-002, INV-003, INV-005, INV-006, INV-008, SC-001.
- [X] T065 [US1] Adopt `review-probes/INV-007-same-result.probe.ts` and `INV-007-followtail-wide-bar.probe.ts` into `e2e/polish-band-interactions.spec.ts`.
  - Review: INV-007.
- [X] T066 [US2] Adopt `review-probes/INV-011-012-013-menu.probe.ts` into `e2e/polish-part-card.spec.ts`.
  - Review: INV-011, INV-012, INV-013.
- [X] T067 [US3] Adopt `review-probes/INV-018-every-session-surface.probe.ts`, `INV-019-short-form-fits.probe.ts` and `INV-020-error-first.probe.ts` into `e2e/polish-saving.spec.ts`.
  - Review: INV-018, INV-019, INV-020.
- [X] T068 Re-verify.
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:untouched-polish`, `npm run check:polish-amendments` and `npm run check:usability-amendments`.
  - Run `npm run build < /dev/null`, then the polish, usability-status-row, usability-staves, usability-height-budget and capture-surface specs, and every file in `review-probes/` through its config.
  - All must pass except test 1 of `INV-006-caret-adds-no-overflow.probe.ts`, which waits on MINOR F4 (review.md FU1).
  - Review F1–F3.

---

## Phase 10: Review remediation

From `review.md` round 2: two MAJOR findings, no BLOCKER, both in `src/components/capture/useCaptureBand.ts`. This is the second round in a row with INV-004 violated in that hook. Round 1 used a 400ms timer; round 2's fix used change detection. So the hook gets one REDESIGN task, not patches. MINORs are in review.md § Follow-ups and are not tasks.

The probes live in `specs/008-usability-polish/review-probes/`. Run them with `npx playwright test --config specs/008-usability-polish/review-probes/playwright.review.config.ts review-probes/<file>` after `npm run build`; the config serves `.next` on port 3119. Adopting a probe means moving it into `e2e/` with the drivers it needs (one helper module, not a new copy; see review.md F4). Each adoption comes before the redesign and must be seen failing on the current build first.

- [X] T069 [US1] Adopt `review-probes/INV-004-sync-arrival-after-trigger.probe.ts` into `e2e/polish-band-interactions.spec.ts` as a failing test first.
  - Replace the vacuous sync test at `e2e/polish-band-interactions.spec.ts:79`. Its band is never swiped and follows no trigger, on 40 rests in one bar, so it cannot fail.
  - Keep the members at the end: `end ⇥`, End and ArrowRight when already at the end; ×4, repeat + and triplet at the end; a chord symbol set at the end. Run them at 412×915 and at 1280×800 with 40 bars, with the column-tap and fret-tap controls.
  - Keep the through-the-server member, which needs `STABLATURE_DATABASE_URL`.
  - Drop the mid-part and start members, which cannot discriminate (see the probe header), or give them a part where the swiped position differs from the anchor.
  - Also adopt `review-probes/INV-004-tap-after-swipe-every-size.probe.ts` (it holds) as a regression guard.
  - See the sync test fail now: 7 of 7 at both sizes move the band's `scrollTop` to 0.
  - Review F1 (MAJOR), INV-004.
- [X] T070 [US1] Adopt `review-probes/INV-002-line-height-change.probe.ts` into `e2e/polish-band-rows-sizes.spec.ts` as a failing test first.
  - 16 opens of a 4-string part with chord and bracket at 375×667 must each decide one line. Today 3–4 of 16 wrap at band 258 < 280.75.
  - A chord symbol arriving from a second tab on a wrapped 4-string part with a bracket at 375×667 must leave wrapped mode. Today it stays wrapped.
  - See both fail now.
  - Review F2 (MAJOR), INV-002, INV-001.
- [X] T071 [US1] REDESIGN `src/components/capture/useCaptureBand.ts` and its wiring at `src/components/capture/CaptureScreen.tsx:195`–`199`: re-plan the hook so INV-004 and INV-002 hold by construction, not by inference.
  - **Why REDESIGN.** This is the second round with INV-004 violated in this hook. Round 1's F1 was the `DELIVERY_MS` timer. Round 2's F1 is change detection: `awaiting.{content,cursor}` (`useCaptureBand.ts:116`–`128`) stays set after a trigger whose write changes neither the columns nor the cursor, and the next sync arrival anchors. Round 2's F2 is in the same hook: the mode decision (`:102`–`111`) is keyed on `content` (the columns only) and the band's size, so a line that grows with its chord row (the annotations) is never re-decided.
  - **First, the contract.** Write the re-plan into `specs/008-usability-polish/contracts/capture-band.md` §2 and §3, then build it.
  - **Anchoring.** It happens only on these three:
    - the render of a trigger's bump, when the trigger needs no write (a key move, a jump, including one to where the cursor already is);
    - the render that delivers that trigger's own write;
    - a resize or a mode change.
  - **The delivery signal.** It comes from the write's own promise in `CaptureScreen`, as the contract's `awaitingDelivery` (`contracts/capture-band.md:40`), not from watching `content` or `cursorKey`.
    - A request ends when its write is delivered, or at once when it has none. It is never left outstanding for a later, unrelated change to spend.
    - A write that changes only an annotation, or only one column's repeat, must still end its request.
  - **The mode.** It is re-decided whenever any of `bandLines`'s three inputs changes: the band's size, a drawn column's height, or the gap. For example, the `ResizeObserver` also observes a drawn column. The decision must not depend on a content identity that leaves out the annotations.
  - **Then:**
    - T069 and T070 pass.
    - These still pass: `review-probes/INV-003-every-trigger.probe.ts` (309 trials, 40 bars at 1280×800), `INV-004-still-after-trigger.probe.ts`, `INV-004-tap-after-swipe-every-size.probe.ts`, `INV-002-rows-sizes-form.probe.ts`, `INV-005-006-every-column.probe.ts`, `INV-007-same-result.probe.ts` and `INV-008-tap-latency.probe.ts`.
    - `e2e/polish-band-unchanged.spec.ts` still passes, so INV-001 holds.
  - Review F1 and F2 (MAJOR, second round in this component). INV-004, INV-002, INV-001. FR-002, FR-003, FR-005. T059 was ticked without meeting its own stated result.
- [X] T072 Re-verify.
  - Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run check:untouched-polish`, `npm run check:polish-amendments` and `npm run check:usability-amendments`.
  - Run `npm run build < /dev/null`, then every `e2e/polish-*` and `e2e/usability-*` spec, plus capture-surface and capture on mobile and desktop.
  - Run every file in `review-probes/` through its config, and `review-probes/INV-002-line-height-change.probe.ts` with `--repeat-each=3`.
  - All must pass except test 1 of `INV-006-caret-adds-no-overflow.probe.ts`, which waits on MINOR F6 (review.md FU4).
  - Review F1, F2.
