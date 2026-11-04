# Phase 0 — Research: Restructure the capture control surface

The spec's *Assumptions* section already resolved most of the open questions, so this
document records the remaining technical decisions and the one that needed real
arithmetic (§3, the vertical budget). Nothing below is marked NEEDS CLARIFICATION.

What was read to get here: `src/components/capture/CaptureScreen.tsx` (552 lines),
`src/components/capture/Fretboard.tsx`, `src/components/tab/TabStaff.tsx`,
`src/lib/local/editing.ts`, `src/lib/model.ts`, `src/components/ui/index.tsx`,
`src/app/globals.css`, `e2e/capture.spec.ts`, `playwright.config.ts`,
`vitest.config.mts`, `docs/DECISIONS.md`, `AGENTS.md`.

---

## 1. One applicability rule, or three?

**Decision**: one module, `src/lib/capture/target.ts`, exporting a `CursorTarget`
resolver and a single `appliesTo(scope, target)` predicate. `CaptureScreen` stops
computing its own `editable` and asks the module instead; the latch strip, the toolbar and
the inspector all call the same predicate.

**Rationale**: today the rule is one expression inside `CaptureScreen`:

```ts
const editable: EventRow | undefined = focused?.kind === "barline" ? undefined : focused;
```

That is fine while there is one consumer. FR-017 adds a second ("the inspector shows only
the properties that apply, **on the same rule the toolbar uses**") and FR-009 a third. An
invariant kept by three copies of a one-line expression is one edit from broken, and the
edit that breaks it is exactly the kind a later roadmap entry makes — `playing-techniques`
adds four latches with their own applicability, and `rhythm-and-tempo` adds a duration
property. So the rule is promoted to data the surfaces consult.

Resolving the cursor to a *target* rather than to an `EventRow | undefined` also names the
cases the spec's Edge Cases list, which `undefined` currently conflates: "cursor on a
barline" and "cursor at the very start" are both `undefined` today, and they want
different toolbar treatment (see §2).

**Alternatives considered**:
- *Keep `editable` and pass it down.* Rejected: it loses the distinction between "there is
  a target and the control does not apply to it" (→ absent) and "there is no target"
  (→ present and disabled), which is the distinction FR-011 and FR-012 disagree about.
- *A React context.* Rejected: nothing needs to read it more than one level deep, and it
  would put the rule back inside the component tree where it cannot be unit-tested in the
  node environment.

---

## 2. What "contextual" means for each of the nine toolbar controls

**Decision**: two groups, declared in `src/lib/capture/controls.ts`.

| Control | Group | Present when | Enabled when |
|---------|-------|--------------|--------------|
| space | stable | always | a part exists |
| barline | stable | always | a part exists |
| select | stable | always | a target column exists and no selection is active |
| paste | stable | always | a part exists and the clipboard is non-empty |
| delete | stable | always | a target column exists |
| triplet | contextual | target is a playable column | always, when present |
| repeat stepper | contextual | target is a playable column | `−` only when `repeat > 1` |
| ×4 | contextual | target is a playable column | always, when present |
| chord symbol | contextual | target is a playable column | always, when present |

"Playable column" means `kind` is `notes` or `rest` — i.e. today's `editable`. A `rest`
takes a repeat and a chord symbol today (`insertRest` produces `kind: "rest"`, which is
not `barline`, so `editable` is truthy), and that is preserved.

**Rationale**: the stable group is ordered *first* in the DOM, so removing the contextual
group cannot move any of it — which is what makes FR-012 and INV-003 structural rather
than something a reviewer has to eyeball. Today's `ml-auto` on `delete` is dropped,
because `ml-auto` makes its position a function of the row's total content width, which
is precisely what must not change. `delete` keeps its visual separation with a fixed gap
and its `variant="danger"` instead.

Two spec contradictions surfaced here and are resolved in `plan.md` → *Deviations*:
`triplet` is contextual despite FR-012 listing it as always-applying, and `select`/`delete`
stay present-and-disabled when there is no column at all.

**Alternatives considered**:
- *Contextual group first, stable group second.* Rejected: removing the leading group
  shifts the whole stable group left, failing SC-005 outright.
- *Reserve the contextual group's width with a `min-width` so nothing moves.* Rejected:
  it keeps the screen width the re-arrangement is meant to free, and the spec's own
  Assumptions say "the inapplicable controls are simply absent and the row is shorter".

---

## 3. The vertical budget — the one decision that needed numbers

**Decision**: the toolbar becomes **two fixed rows that never wrap** (row 1 stable, row 2
contextual), replacing today's single `flex-wrap` row. That is what pays for the strip.
Button padding on the capture toolbar tightens from `px-3` to `px-2.5` and the gap from
`gap-1.5` to `gap-1` so row 1 fits in one line at 375 px.

**Rationale**: the strip costs ~40 px of a 667 px-tall viewport that is already full.
Measured constants, from the source:

| Constant | Value | Source |
|----------|-------|--------|
| `--string-height` | `1.55rem` = 24.8 px | `src/app/globals.css:51` |
| chord row height | `1.1rem` = 17.6 px | `TabStaff.tsx` `h-[1.1rem]` |
| tuplet row height | `1.1rem` = 17.6 px | `TabStaff.tsx` `h-[1.1rem]` |
| fret cell | `h-9 w-9` = 36 px | `Fretboard.tsx` |
| mute row | `h-7` = 28 px | `Fretboard.tsx` |
| button | `px-3 py-2 text-sm` ≈ 36 px tall | `src/components/ui/index.tsx` BASE |

Estimated vertical budget at 375×667 (all figures ±4 px; the binding check is INV-012's
measurement, not this table):

| Band | Today | After |
|------|-------|-------|
| header | 45 | 45 |
| part chips | 45 | 45 |
| **staff (flex-1, absorbs the remainder)** | **~199** | **~179** |
| status row | 28 | 28 |
| controls row | ~136 (three wrapped rows at 375 px) | ~96 (two fixed rows) |
| latch strip | 0 | ~40 |
| neck | ~234 | ~234 (unchanged — INV-011) |
| **total** | 667 | 667 |

The staff needs 5 × 24.8 = 124 px for a five-string part, +17.6 for the chord row, +17.6
for a tuplet row: **159 px worst case**. After the change it gets ~179 px, so roughly
20 px of slack. With the cursor on a barline the contextual row collapses and the staff
gets ~219 px.

Without the two-row change the arithmetic fails: today's wrapping row plus a 40 px strip
leaves the staff ~139 px against a 142 px requirement for a five-string part with chords.
That is why the toolbar restructure is load-bearing and not cosmetic.

Row 1's horizontal fit at 375 px (usable 351 px after `px-3`): `space` 86 + `barline` 44 +
`select` 82 + `paste` 78 + `delete` 48 = 338, plus four `gap-1` gaps = 354 — 3 px over.
Dropping to `px-2.5` saves 4 px per side on five buttons = 40 px → **~322 px, fits.**
Row 2: `triplet` 44 + stepper 110 + `×4` 52 + `chord symbol` 110 + three gaps = ~328, fits.

**If measurement disagrees**, the levers in order (from the blast-radius table): drop the
visible words from `space`/`select`/`paste` and keep them in `aria-label`; tighten the
part-chip row padding; tighten the status row. **Shrinking the neck is not a lever** — it
is the primary input surface and the light-theme defect that erased it is recent history.

**Alternatives considered**:
- *One non-wrapping horizontally-scrollable row* (saves ~80 px). Rejected: it hides
  controls off-screen on the one screen where everything must be thumb-reachable, and the
  saving is not needed once the two-row layout works.
- *Shrink `--string-height`.* Rejected: it changes how tab is drawn, which the spec puts
  out of scope, and the staff shares `layoutPart` with the ASCII serialiser.
- *Overlay the strip on top of the neck.* Rejected: it covers fret cells, which are 36 px
  targets chosen because "mis-taps here are the main way bad data gets captured".

---

## 4. Where the latch strip lives, and how it stays legible in both themes

**Decision**: the strip renders **inside `Fretboard`**, as a sibling above the
`overflow-x-auto` fret-grid scroller and inside the existing `disabled` wrapper. It uses
`bg-bg-sunken` (the neck's own background) with `border-b border-border-subtle`; each
latch chip is `bg-bg-raised` + `border border-border-subtle` when unarmed, and
`bg-accent text-accent-text` when armed.

**Rationale**:
- FR-004 wants the strip to read "as part of the neck's own surface rather than as
  another row of verbs", and FR-010 wants it unavailable with the neck. Putting it inside
  the `disabled ? "pointer-events-none opacity-40" : ""` wrapper gets both for free.
- It must be *outside* the horizontal scroller, or it would scroll away with the 25-fret
  grid.
- FR-030 forbids a distinction resting on hue at matched lightness, and FR-030's
  parenthetical points at `docs/DECISIONS.md`'s opacity-over-a-surface-token defect. Named
  tokens with different lightness, in both themes:

| Pair | Dark | Light |
|------|------|-------|
| strip (`--bg-sunken`) | `#07070a` | `#f1f1ee` |
| unarmed chip (`--bg-raised`) | `#15151a` | `#ffffff` |
| armed chip (`--accent`) | `#ffa629` | `#b45309` |

Both themes separate by lightness, not hue, and the chip border means the boundary does
not rest on the fill alone. **No new CSS token is needed**; one is added only if the
browser pass (INV-014) says otherwise.

FR-006 requires the armed latch to carry "the same emphasis the stack button's armed
state carries today". Today that is `variant="primary"` = `bg-accent text-accent-text`,
which is what the armed chip uses — so the emphasis is identical by construction.

**Alternatives considered**:
- *The strip as a row in `CaptureScreen`, above `<Fretboard>`.* Rejected: it then needs
  its own copy of the neck's disabled treatment and its own background decision, and it
  reads as a fourth row of verbs — the thing FR-004 explicitly rules out.
- *Opacity over `bg-bg-raised` for the unarmed chip.* Rejected on sight: that is the exact
  mechanism that made the fretboard disappear in light mode.

---

## 5. Armed state: stored or derived?

**Decision**: `CaptureScreen` stores `armed: ReadonlySet<LatchId>`; the **lit and effective
set is derived** every render as `armed ∩ {l : l.appliesTo(target)}`. Today's explicit
disarms (on tapping a column, switching part, inserting a space or a barline) are kept.

**Rationale**: the spec's edge case — "latch armed, then the cursor moves somewhere it
cannot apply → the latch disarms rather than staying lit and silently doing nothing" — has
at least seven routes to it (INV-010 enumerates them), and today two of them leak: the
`⇤ start` and `end ⇥` buttons call `setCursor` without `setStacking(false)`, so `stack`
stays lit while `editable` is `undefined` and the next fret press quietly inserts a new
column instead. Deriving the lit set closes all seven with one expression and closes the
eighth route a later entry adds.

The explicit disarms stay because they are not redundant: inserting a *space* leaves the
target a `rest`, which `stack` still applies to, so derivation alone would keep it armed —
and story 1 scenario 3 says inserting a space must disarm it. Derivation is the safety
net; the explicit clears preserve exact present behaviour.

A `Set` rather than a boolean because FR-008 requires four more independently-armable
latches to be addable as data.

**Alternatives considered**: a `useEffect` that disarms when the target changes. Rejected:
it introduces a render in which the latch is lit and inapplicable, which is exactly the
state INV-010 says must never exist.

---

## 6. The long press

**Decision**: a `useLongPress` hook on Pointer Events, attached by `TabStaff` to the
column `<button>` only when `onInspectColumn` is supplied. 500 ms threshold, 10 px
movement cancellation, any `pointerType`. When the long press fires it sets a synchronous
`suppressClick` ref that the existing `onClick` reads and clears.

**Rationale**:
- Pointer Events rather than touch events: one code path covers finger and mouse, and the
  `desktop` Playwright project can drive it with `page.mouse`, which is how INV-005/006/007
  get probed on both projects.
- 500 ms is the platform convention (Android's `ViewConfiguration` long-press timeout is
  500 ms, iOS's `UILongPressGestureRecognizer` default 0.5 s), and the spec's Assumptions
  say "roughly half a second" with the exact threshold left to the plan.
- 10 px because the staff scrolls horizontally and the spec requires a drag-to-scroll to
  cancel both gestures (FR-020). Below 10 px is thumb jitter on a 36 px target.
- **The tap is never delayed.** The long press fires at 500 ms, *before* release, so by the
  time `pointerup`/`click` arrives the outcome is already known and `onClick` only has to
  read a ref. No timer is awaited on the tap path, which is what INV-006 asserts. This is
  the whole reason FR-019 is satisfiable at all: the two gestures resolve at different
  moments, so neither waits on the other.
- `onContextMenu` is prevented on the column, and the column gets `select-none` plus
  `-webkit-touch-callout: none`, so a sustained press does not raise the platform menu or
  start a text selection on top of the sheet.

**Alternatives considered**:
- *Touch events with `touch-action: none`.* Rejected: it kills the staff's horizontal
  scroll, which is the gesture the spec insists must still win.
- *A double tap, or a dedicated "inspect" button.* Rejected: the spec names a long press,
  and its Assumptions explain why no alternative gesture is needed (everything in the
  sheet is also in the toolbar).
- *Resolving the tap on a timer so it can be cancelled by the long press.* Rejected
  outright by FR-019 and SC-003 — that is the delay the spec forbids.

---

## 7. The sheet

**Decision**: a `Sheet` primitive added to `src/components/ui/index.tsx`, wrapping a
native `<dialog>` opened with `showModal()`, styled as a bottom sheet. Dismissal via the
`cancel`/`close` events (Esc), a backdrop click, and an explicit close button.

**Rationale**: `showModal()` gives focus containment, Esc-to-dismiss, inertness of the
page behind it and `::backdrop` with no code, which is most of FR-024 for free. The repo
has no dialog pattern yet and deliberately has no component library, so a ~20-line
primitive next to `Button` and `Input` matches the house style. Baseline support is
universal in the browsers a 2026 PWA targets.

**Risk and mitigation**: jsdom's `HTMLDialogElement` support is recent. If
`showModal` is missing or partial under jsdom 30, the component test renders the sheet's
*body* directly (it is a separate component taking the property list as a prop, which is
what INV-015 probes anyway) and modality is covered only by the e2e suite. Either way
INV-015's probe does not depend on `<dialog>` working in jsdom.

**Alternatives considered**: a hand-rolled portal with a focus trap. Rejected: more code,
and an accessibility bug if it is wrong.

---

## 8. Making the two surfaces agree about the stored result

**Decision**: `src/lib/capture/properties.ts` exports `COLUMN_PROPERTIES`, an ordered list
in which each property owns its own `commit`. `commit` is the **only** path from the
capture screen to `bumpColumnRepeat`, `setChord` and `deleteColumn`. Both the toolbar's
row 2 and the inspector render from the same list and call the same `commit`.

**Rationale**: FR-018 and SC-009 require the inspector's edit to be "indistinguishable
from the same action taken through the bottom toolbar, down to the stored data". Two
call sites into `editing.ts` would satisfy that today and drift the first time one of them
grows an argument. Having one of them *call* the other — here, both calling one shared
`commit` — is the structural form of the requirement (this is invariant rule 4 in the
plan template). INV-004's structural half asserts the import graph, so the drift is caught
by a unit test rather than by a reviewer noticing.

The same reasoning gives `nextCursorAfterDelete` in `src/lib/capture/cursor.ts`: the
toolbar's delete repairs the cursor today (`previous ? previous.id : null`), the
inspector's delete must repair it identically, so there is one function and both call it.

**Alternatives considered**: let the inspector call `editing.ts` directly and add an e2e
test comparing the two results. Rejected: the test proves agreement at one moment; the
shared `commit` makes disagreement unrepresentable.

---

## 9. Probing "adding one is a data change, not a layout change"

**Decision**: SC-007 and SC-008 are probed by a jsdom component test that renders
`LatchStrip` with 1 then 5 descriptors (and `ColumnInspector` with 3 then 6), asserting
that cell count equals descriptor count, the container's `className` is byte-identical
across both renders, and each cell's `className` differs only in its armed/applicable
modifier — plus a source assertion that neither component branches on a descriptor `id`.

**Rationale**: the honest limitation is that jsdom computes no layout, so it cannot tell
you five chips *fit* at 375 px. The real-browser check (INV-014, and the e2e width
assertion) covers the one latch that actually exists. For the five-latch case the
falsifiable property is structural — "the arrangement does not change" — and that is what
the test asserts. The strip's geometry is made true by construction:
`grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr)`, so N latches share the width
evenly at any N and any viewport, with no wrapping rule to re-tune.

This is written down rather than glossed because SC-007/SC-008 say "shown by the strip
reading correctly with five latches at the smallest supported phone width", and no probe
available here shows exactly that. The structural probe plus the by-construction geometry
is the closest honest substitute; a Playwright component-test setup would be the real
answer and is not worth adding for this entry.

**Alternatives considered**: a dev-only query parameter injecting fake latches so
Playwright can measure five. Rejected: shipping a test hatch into the capture screen to
test the capture screen.

---

## 10. Test surfaces at 375×667

**Decision**: a new `e2e/capture-surface.spec.ts` with
`test.use({ viewport: { width: 375, height: 667 } })`, running under both existing
Playwright projects. Theme is forced with `test.use({ colorScheme: "light" | "dark" })` in
two `describe` blocks, since the themes are `prefers-color-scheme` media queries in
`globals.css`.

**Rationale**: neither existing project is 375 px wide (Pixel 7 is 412×915), and the
spec's measurable outcomes all name 375×667. Overriding the viewport inside the spec keeps
`isMobile`/`hasTouch` from the `mobile` project — which is what lets the long-press tests
run with touch there and with a mouse on `desktop`, covering both `pointerType` members of
INV-006.

New `data-testid` hooks needed, because the invariants measure geometry rather than roles:
`latch-strip`, `fret-grid`, `toolbar-stable`, `toolbar-contextual`, `column-inspector`.
`docs/DECISIONS.md` is explicit that asserting roles and aria-labels is what let the
chord-colour defect through, so the geometric invariants read `boundingBox()`,
`scrollHeight` and computed styles instead.

**Alternatives considered**: a third Playwright project at 375×667. Rejected: it would
re-run the whole suite a third time for one spec's benefit, and the suite already pays
~20 s per run for a non-reused server.
