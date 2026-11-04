# Implementation Plan: Restructure the capture control surface

**Branch**: `001-capture-control-surface` | **Date**: 2026-11-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-capture-control-surface/spec.md`

## Summary

Re-sort the capture screen's ten controls by **what they modify**, adding no musical
capability. Three surfaces come out of it, and all three are driven by one
applicability rule and one set of mutations so they cannot drift apart:

- a **latch strip** of next-note modifiers, rendered inside `Fretboard` above the fret
  grid, holding exactly one latch today (`stack`), declared as an ordered list;
- a **two-row contextual toolbar** — row 1 is the always-present stable group, row 2 is
  the column-property group that is absent entirely when the cursor's target is not a
  playable column;
- a **column inspector** sheet opened by long-pressing a column on the capture staff,
  built from the same column-property descriptors the toolbar's row 2 renders.

The technical core is five small new modules under `src/lib/capture/`:
`target.ts` (one resolver + one applicability predicate), `latches.ts` (the ordered
latch list), `properties.ts` (the ordered column-property list, each property owning
its own `commit` that calls `src/lib/local/editing.ts`), `controls.ts` (which toolbar
group each control is in) and `cursor.ts` (the shared post-delete cursor repair). Every
surface calls into those; none re-derives the rule or the mutation. The vertical cost of the strip is paid by
collapsing today's three-row wrapping toolbar into two fixed rows — see
[research.md](./research.md) for the measured budget.

No schema change, no migration, no wire-protocol change, no change to
`src/lib/tab/` or `src/lib/export/`.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router)

**Primary Dependencies**: Next 16, React 19, Tailwind CSS 4 (`@theme inline` tokens in
`src/app/globals.css`, compiled by Lightning CSS via `@tailwindcss/turbopack`),
Dexie 4 + `dexie-react-hooks` for the local-first store, `lucide-react` for icons.
No component library — `src/components/ui/index.tsx` holds the thin shared primitives.

**Storage**: Dexie/IndexedDB locally, mirrored to Postgres via `src/lib/sync/`.
**This feature writes no new field and reads no new table.** All mutations go through the
existing `src/lib/local/editing.ts` vocabulary (`bumpColumnRepeat`, `setChord`,
`deleteColumn`).

**Testing**: Vitest 5 (`npm test`) — node environment by default, component tests opt in
with a `// @vitest-environment jsdom` docblock, per the comment in `vitest.config.mts`.
Playwright 1.64 (`npm run test:e2e`) against a production build, projects `mobile`
(Pixel 7) and `desktop` (Desktop Chrome), `reuseExistingServer: false`.
Plus a manual browser pass at actual size in both themes — repo convention, see
`docs/DECISIONS.md` ("browser testing is now part of done").

**Target Platform**: Installable PWA in a mobile browser, offline-capable. Primary
target is a phone held one-handed; the smallest supported viewport is 375×667.

**Project Type**: Next.js web application, single package, client-heavy (the capture
screen is entirely `"use client"`).

**Performance Goals**: The four-second capture path — three fret presses, no modifier —
must take no more taps and feel no slower. A tap on a column must move the cursor on
`pointerup` with no added timer (see INV-006). Long-press threshold 500 ms, movement
cancellation threshold 10 px.

**Constraints**:
- 375×667 viewport, no page-level scrolling, five-string staff visible without the staff
  scrolling vertically, neck height unchanged (FR-026…FR-028).
- Both themes legible at actual size; a visual tier is **never** opacity over a surface
  token, because `--bg-raised` is `#ffffff` on the light theme (`docs/DECISIONS.md`).
- Exactly one background utility and one text utility per cell on the neck — Lightning
  CSS flattens `@layer components` and hoists it, so custom classes win specificity ties
  by source order (`docs/DECISIONS.md`).
- `npm run dev:clean` before debugging any style that appears to do nothing; never run
  `npm run build` or the e2e suite while a dev server holds the same `.next`.

**Scale/Scope**: One screen. 5 new library modules (~300 LOC), 3 new components/hooks
(`LatchStrip`, `ColumnInspector`, `useLongPress`), 3 modified components
(`CaptureScreen.tsx`, `Fretboard.tsx`, `TabStaff.tsx`), 1 new `Sheet` primitive,
1 new e2e spec, 8 new unit/component test files.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is **the unfilled scaffold template** — every principle
is still a `[PRINCIPLE_N_NAME]` placeholder and the version line reads
`[CONSTITUTION_VERSION]`. There is therefore no ratified constitution to gate against.
This is recorded, not worked around: see *Open for the human* at the end of this file.

In its place the gates below are the project's **de facto** standing rules, taken from
`docs/DECISIONS.md` and `AGENTS.md`, which are the documents this repo actually enforces.
A later `/speckit-constitution` run should supersede this section.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Browser testing is part of done.** A visual change is not done until it has been looked at in Chrome at actual size, in both themes. | `docs/DECISIONS.md`, 2026-11-02 Process | PASS | FR-029 is an explicit requirement; INV-014 names the ten surface/theme pairs; `quickstart.md` step 6 is the browser pass. |
| **No colour or contrast decision from a magnified crop.** | `docs/DECISIONS.md` | PASS | INV-014's probe is at 375×667 actual size plus a computed-style assertion, not a zoomed screenshot. |
| **A visual tier is never opacity over a surface token.** | `docs/DECISIONS.md` (the light-theme fretboard defect) | PASS | FR-030; the strip and its chips use named tokens (`--bg-sunken`, `--bg-raised`, `--accent`) plus a border. Research §4 records the lightness separation in both themes. |
| **One background utility and one text utility per neck cell.** | `docs/DECISIONS.md` (Lightning CSS layer hoisting) | PASS | The latch chip emits one `bg-*` and one `text-*`; the fret grid is untouched. |
| **Domain rules live in `src/lib/`, not in components, so they are testable without a browser.** | `src/lib/local/editing.ts` header comment | PASS | The applicability rule, the latch list and the property list are three library modules with node-environment unit tests. |
| **Tests must be able to fail for the right reason.** Asserting roles and aria-labels is exactly what let the chord-colour bug through. | `docs/DECISIONS.md` | PASS | INV-003 and INV-011 read `boundingBox()`; INV-012 reads `scrollHeight`; INV-014 reads computed styles. Presence invariants assert `count() === 0`, not `toBeDisabled()`. |
| **Never reuse a server; never share `.next`.** | `playwright.config.ts`, `docs/DECISIONS.md` | PASS | No change to the harness. `quickstart.md` states the ordering constraint. |
| **Simplicity — no component library, thin primitives.** | `src/components/ui/index.tsx` header | PASS | The sheet is a native `<dialog>` wrapped in one ~20-line `Sheet` primitive. No new dependency. |

**Post-design re-check (after Phase 1)**: PASS, unchanged. The design adds no dependency,
no schema change and no new CSS token; the one structural risk it introduces — three
surfaces that must agree — is closed by making them call one module rather than keep
copies (INV-002, INV-004, INV-010), which is the Phase 1 decision the gate table above
most cares about.

## Invariants — what must never happen *(mandatory)*

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never is an action that was reachable on the capture screen before this change unreachable after it. | `e2e/capture-surface.spec.ts` drives each control through the rendered screen and asserts the resulting staff/export; the pre-existing `e2e/capture.spec.ts` runs with **no edit except** re-pointing the `stack` locator at the strip. | 17 actions: repeat−, repeat+, ×4, arm stack, disarm stack, space, barline, triplet, set chord symbol, clear chord symbol, select, paste, delete, selection-copy, selection-cut, selection-delete, selection-cancel. |
| INV-002 | Never does the bottom toolbar render a control that cannot act on the cursor's target. | e2e asserts `expect(locator).toHaveCount(0)` — **not** `toBeDisabled()` — for each contextual control at each cursor target, and `toHaveCount(1)` for each stable control. | 6 targets × 9 controls = 54 pairs. Targets: notes column, rest column, barline, start-of-part (no column), empty part, no part at all. Controls: repeat stepper, ×4, triplet, chord symbol, space, barline, select, paste, delete. |
| INV-003 | Never does a stable toolbar control change screen coordinates as the cursor moves between a playable column and a barline. | e2e at 375×667 reads `boundingBox()` for each stable control with the cursor on a notes column, moves the cursor, re-reads, asserts identical `x` and `y`. | 5 controls (space, barline, select, paste, delete) × 2 directions (notes→barline, barline→notes) = 10 measurements. |
| INV-004 | Never does an edit made through the column inspector differ from the same edit made through the bottom toolbar. | **Structural**: both surfaces call `ColumnProperty.commit` from `src/lib/capture/properties.ts`; neither calls `src/lib/local/editing.ts` for repeat, chord or delete. Enforced by a unit test asserting the toolbar and inspector modules import no mutation from `editing.ts`. **Behavioural**: e2e applies each edit to twin columns — once via each surface — and compares the part's exported ASCII. | 6 properties/actions: repeat increase, repeat decrease, ×4, chord symbol set, chord symbol clear, delete. |
| INV-005 | Never does a long press open an inspector where the staff is read-only, or while a selection is active. | e2e long-presses a column on `/songs/[songId]`, on `/songs/[songId]/play`, and on the capture staff with a selection active; asserts `dialog` count 0 and that the DOM is otherwise unchanged. **Structural**: `TabStaff` attaches no press handlers at all when `onInspectColumn` is undefined, and only `CaptureScreen` ever passes it. | 3 surfaces: song-page part staff, play-view step staff, capture staff with an active selection. |
| INV-006 | Never is a short tap on a column delayed, swallowed, or made conditional on the long press not having fired. | e2e taps a column and asserts the insertion caret has moved on the very next assertion after `pointerup`, with no `waitForTimeout` anywhere in the path; a unit test asserts the click handler reads a synchronous ref and awaits no timer. | 7 members: tap on a notes column / a rest column / a barline, each with `pointerType` mouse and touch (6), plus keyboard `Enter` on a focused column. |
| INV-007 | Never does a press that moved become either a long press or a tap. | e2e presses a column, moves the pointer past the threshold, releases; asserts no `dialog` opened **and** the caret did not move. | 6 members: drag left, drag right, drag vertically; each released inside and outside the originating column. |
| INV-008 | Never does the inspector stay open on a column that no longer exists. | **Structural**: the open inspector is derived as `columns.find(c => c.id === inspectingId)`; the `EventRow` is never copied into state. e2e removes the column by each route and asserts the dialog closes. | 5 routes: the inspector's own delete, the toolbar's delete, a sync delete arriving from another device, switching part, deleting the part. |
| INV-009 | Never does dismissing the inspector without editing change any screen state. | e2e records the caret's `boundingBox()`, the status-line text and the part's exported ASCII; long-presses, dismisses, asserts all three byte-identical. | 3 dismissal routes (Esc, backdrop click, explicit close button) × 3 cursor positions (at start, on a column, at end) = 9 members. |
| INV-010 | Never is a latch lit or armed while it cannot apply to the cursor's target. | **Structural**: the lit set is `stored ∩ {l : l.appliesTo(target)}`, recomputed each render; nothing reads the stored set directly. e2e arms `stack`, reaches an inapplicable target by each route, asserts `aria-pressed="false"` and that the next fret press starts a new column. | 7 routes: tap a barline, insert a barline, jump to start, switch part, delete the target column, a sync delete of the target column, open a part with no columns. |
| INV-011 | Never does the latch strip's height come out of the neck. | e2e at 375×667 measures `[data-testid="fret-grid"]`'s bounding height and asserts it equals the baseline recorded from `main` within 1 px, while `[data-testid="latch-strip"]` is present with non-zero height. | 2 themes × 2 cursor targets (playable column, barline) = 4 measurements. |
| INV-012 | Never does the capture screen need page-level scrolling, nor the staff need vertical scrolling to show every string. | e2e at 375×667 asserts `scrollingElement.scrollHeight <= clientHeight` and that the staff scroller's `scrollHeight <= clientHeight` with every string row inside its client box. | 2 themes × 3 part shapes (5-string with chords; 5-string with chords and a tuplet; 4-string) × 2 cursor targets = 12 measurements. |
| INV-013 | Never does the plain-text export of a part change. | `src/lib/tab/__tests__/ascii.test.ts` and `src/lib/export/__tests__/text.test.ts` run **unmodified** and green; plus a diff check that no file under `src/lib/tab/`, `src/lib/export/`, `src/lib/sync/`, `src/lib/model.ts` or `src/db/schema/` is touched. | Every fixture in those two suites, plus the three parts captured by `e2e/capture.spec.ts`. |
| INV-014 | Never is a new surface illegible, nor distinguished from its background by hue alone at matched lightness. | A browser pass at actual size at 375×667 in both themes, **plus** a Playwright computed-style assertion that each pair resolves to two different named tokens whose relative luminance differs, and that the latch chip carries a border. | 5 pairs × 2 themes = 10: strip vs neck; unarmed chip vs strip; armed chip vs strip; sheet vs backdrop; inspector row separator vs sheet. |
| INV-015 | Never does adding a latch or a column property require a layout change. | jsdom component test renders `LatchStrip` with 1 then 5 descriptors and `ColumnInspector` with 3 then 6, asserting cell count equals descriptor count, the container's `className` is byte-identical across both renders, and each cell's `className` differs only in its armed/applicable modifier. Plus a source assertion that neither component branches on a descriptor `id`. | `LatchStrip` at 1 and at 5 latches; `ColumnInspector` at 3 and at 6 properties; the no-id-branching check over both components. |
| INV-016 | Never does the selection toolbar's behaviour change. | The six existing selection e2e tests run unmodified; plus new assertions that with a selection active the contextual toolbar row is absent and the latch strip is not reachable from it. | 6 members: copy, cut, delete, cancel, the selected-count message, tap-to-extend. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| Does the inspector's delete confirm first? | **No.** Identical to the toolbar's delete today. | FR-001 forbids behaviour change, and deletes in this app are soft and syncable (`docs/DECISIONS.md`: "Deletes are soft"), so the column is recoverable. Adding a confirmation to one surface and not the other would itself break INV-004. | INV-004, INV-008 |
| Where does the cursor go when the inspector deletes the column the cursor is on? | **The same place the toolbar's delete sends it**: the previous column, or the start if there is none. If the deleted column is *not* the cursor's target, the cursor is untouched. Both surfaces call one shared `nextCursorAfterDelete(columns, deletedId, cursor)`. | Two surfaces deciding this separately is one edit from disagreeing; a shared function makes agreement structural. | INV-004, INV-008 |
| Does opening the inspector move the cursor, or mutate anything? | **No.** Opening is strictly read-only. | FR-023's "dismiss leaves the screen exactly as it was" is free if nothing changed, and expensive to get right if it did. | INV-006, INV-009 |
| Does this entry touch the schema, the wire protocol or the clipboard? | **No.** No migration, no new `EventKind`, no new `AnnotationKind`, no protocol change, no clipboard change. | Declared out of scope by the spec; FR-002 pins the export byte-for-byte. | INV-013 |
| Who owns the applicability rule? | **One module**: `src/lib/capture/target.ts`. The toolbar, the latch strip and the inspector all call `appliesTo`; none keeps a copy, and `CaptureScreen` no longer computes its own `editable`. | FR-017 requires the inspector and the toolbar to agree about what applies to a barline. An invariant held by two copies staying in sync is one edit from broken. | INV-002, INV-010, INV-015 |
| Who owns the mutation behind a column property? | **`ColumnProperty.commit`** in `src/lib/capture/properties.ts`, which is the only caller of `bumpColumnRepeat`, `setChord` and `deleteColumn` from the capture screen. | FR-018 and SC-009 demand identical stored results from two surfaces; one `commit` makes that structural rather than a coincidence. | INV-004 |
| Is the armed-latch set stored or derived? | **Stored as a set of ids; the lit/effective set is derived** by intersecting with applicability on every render. | The spec's edge case "latch armed, then the cursor moves somewhere it cannot apply" has at least seven routes to it. One derivation covers all seven; seven explicit `disarm()` calls would need an eighth the moment a route is added. (Today's explicit clears on insert and part-switch are *kept too*, because they preserve exact present behaviour for a `rest` target, where the latch would otherwise stay applicable.) | INV-010 |
| Where does the latch strip's 40 px come from? | **The staff's scroll area, structurally**: the staff wrapper is the only `flex-1 min-h-0` child of the screen, so it is the only element that can absorb a new sibling. The neck is never given a smaller height. If the budget still fails at 375×667, the levers are, in order: drop the visible words from `space`/`select`/`paste` (keeping `aria-label`), tighten the part-chip row's padding, tighten the status row. **Shrinking the neck is not a lever.** | The neck is the primary input surface, and the light-theme defect that made it unusable is recent history. | INV-011, INV-012 |
| Does the long press work with a mouse as well as a finger? | **Yes** — Pointer Events, any `pointerType`. | A desktop user with no touchscreen would otherwise have no route to the inspector at all, and the `desktop` Playwright project needs one to drive INV-005/006/007. | INV-005, INV-006, INV-007 |
| What happens to `triplet` when the cursor is on a barline? | **It is absent**, not disabled — it joins the contextual group. This is a knowing deviation from FR-012's literal list; see *Deviations* below. | Today it is present-and-disabled there, so absence changes no musical behaviour, where making it *work* on a barline would add capability FR-001 forbids. | INV-002, INV-003 |
| What happens to `select` and `delete` when the cursor is at the very start (no column)? | **Present and disabled**, exactly as today. They are in the stable group, which is always present; "no target at all" is the existing no-part/empty case, not a contextual one. | FR-012 requires them to hold position; FR-011's absence rule is about a target that exists and cannot take the control. | INV-002, INV-003 |

### Deviations from the spec's letter

Two places where the spec contradicts itself. Both are resolved here rather than left for
implement, and both are cheap to overturn.

1. **`triplet` on a barline.** FR-012 lists `triplet` among the controls that "always
   apply" and must hold position; SC-004 requires *zero* unusable controls with the cursor
   on a barline; and today `triplet` is `disabled={!editable}`, so it is one of the
   unusable ones. All three cannot hold. Resolved by making `triplet` contextual (absent
   on a barline), because the alternative — making it apply on a barline by retargeting it
   at the nearest preceding playable column — adds a musical capability FR-001 forbids.
   Cost: `triplet` has no position on a barline, so SC-005 holds for the other five stable
   controls and not for `triplet`. The contextual row is ordered `triplet` first, so when
   it returns it returns to the same coordinates.
   **To overturn**: move `triplet` to the stable group and accept it disabled on a barline.
   One line in `src/lib/capture/controls.ts`.

2. **`select` and `delete` at the very start.** FR-011's rule read literally would make
   them absent when the cursor is before the first column, which FR-012 forbids. Resolved
   as recorded in the blast-radius table: the absence rule applies to a target that exists,
   not to the absence of a target.

## Project Structure

### Documentation (this feature)

```text
specs/001-capture-control-surface/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   ├── descriptors.md    #   latch + column-property + target contracts
│   └── components.md     #   component prop contracts and test hooks
├── checklists/           # pre-existing
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── capture/                      # NEW — the capture screen's domain rules
│       ├── target.ts                 #   resolveTarget + appliesTo: the ONE rule
│       ├── latches.ts                #   LATCHES: the ordered next-note latch list
│       ├── properties.ts             #   COLUMN_PROPERTIES: ordered, each owns commit()
│       ├── controls.ts               #   TOOLBAR_CONTROLS: id -> stable | contextual
│       ├── cursor.ts                 #   nextCursorAfterDelete, shared by both surfaces
│       └── __tests__/
│           ├── target.test.ts
│           ├── latches.test.ts
│           ├── properties.test.ts
│           ├── controls.test.ts
│           └── cursor.test.ts
├── components/
│   ├── capture/
│   │   ├── CaptureScreen.tsx         # MODIFIED — two-row toolbar, strip wiring, inspector host
│   │   ├── Fretboard.tsx             # MODIFIED — hosts the latch strip above the fret grid
│   │   ├── LatchStrip.tsx            # NEW — renders an ordered latch list, no id branching
│   │   ├── ColumnInspector.tsx       # NEW — renders an ordered property list in a Sheet
│   │   ├── useLongPress.ts           # NEW — pointer-events long press, movement-cancelled
│   │   └── __tests__/
│   │       ├── LatchStrip.test.tsx       # jsdom; 1 vs 5 latches (INV-015)
│   │       ├── ColumnInspector.test.tsx  # jsdom; 3 vs 6 properties (INV-015)
│   │       └── useLongPress.test.tsx     # jsdom; threshold, movement, click suppression
│   ├── tab/
│   │   └── TabStaff.tsx              # MODIFIED — optional onInspectColumn only
│   └── ui/
│       └── index.tsx                 # MODIFIED — adds the Sheet primitive (native <dialog>)
├── app/
│   └── globals.css                   # MODIFIED only if the browser pass demands a token
e2e/
├── capture.spec.ts                   # MODIFIED — one locator: stack now lives in the strip
└── capture-surface.spec.ts           # NEW — INV-002..INV-014 at 375×667, both themes
```

**Structure Decision**: Single Next.js package, unchanged. The feature follows the
repo's existing split: domain rules in `src/lib/` where they are testable in the node
environment without a browser (the rule stated in `src/lib/local/editing.ts`'s header),
presentation in `src/components/`. The new `src/lib/capture/` directory is the only
structural addition, and it exists so the three surfaces have one rule to call rather than
three copies to keep in sync — the single decision the invariants above most depend on.
No `backend/`, `frontend/` or mobile split: this repo is one app with route handlers under
`src/app/api/`, and this feature touches none of them.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No gate violations. Two judgement calls are recorded because they add structure a smaller
change would not:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| A new `src/lib/capture/` layer for what is "just a toolbar re-arrangement" | FR-016 and FR-008 require the strip and the sheet to be extensible by declaring data, and FR-017/FR-018 require three surfaces to agree about applicability and about the stored result. Both are structural requirements, not polish. | Keeping the rule inline in `CaptureScreen.tsx` (today's `editable` expression) means the inspector and the toolbar each carry a copy. That is the exact failure mode INV-002/INV-004 exist to prevent, and the spec's own history (`stack` vs `chord`) shows this screen drifts. |
| A `Sheet` primitive in `src/components/ui/index.tsx` | The inspector must be keyboard-operable and dismissible without a pointer (FR-024). | Rolling focus-trapping and Esc handling by hand is more code than wrapping a native `<dialog>`, and getting it wrong is an accessibility defect rather than a cosmetic one. A dependency was rejected: the repo deliberately has no component library. |

## Open for the human

Not blocking — planning proceeded under the recorded assumptions — but worth a look:

1. **The constitution is still the scaffold template.** `.specify/memory/constitution.md`
   has no filled principles, so the Constitution Check above gates against
   `docs/DECISIONS.md` and `AGENTS.md` instead. Running `/speckit-constitution` would give
   later entries in this roadmap something firmer to check against.
2. **The `triplet` deviation** in *Deviations* §1 is a real, if small, loss against SC-005.
   The one-line alternative is written down.
3. **The vertical budget is tight.** Research §3's arithmetic leaves roughly 19 px of
   slack in the worst case (five strings + chord row + tuplet row at 375×667). The levers
   if measurement disagrees are ordered in the blast-radius table, and shrinking the neck
   is not one of them.
