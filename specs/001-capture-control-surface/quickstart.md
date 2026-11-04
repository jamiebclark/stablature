# Quickstart — validating the capture control surface

How to prove this feature works end to end. Scenarios map to the spec's user stories and
to the invariants in [plan.md](./plan.md); the contracts they lean on are in
[contracts/](./contracts/).

---

## Prerequisites

```bash
npm ci
npx playwright install chromium     # first time only
```

Postgres is **not** needed for any scenario here — the capture screen is local-first and
writes to IndexedDB. Only `e2e/sync.spec.ts` talks to Postgres, and this feature does not
touch it.

### Two repo traps — do not re-debug these

Both are recorded in `docs/DECISIONS.md` and both have bitten this screen before:

1. **A style change that appears to do nothing is a stale Turbopack CSS cache.** Kill the
   dev server and use `npm run dev:clean` before looking at the CSS.
2. **Never run `npm run build` or the e2e suite while a dev server holds the same
   checkout.** They share `.next` and corrupt each other. Stop `npm run dev` first.

---

## Step 0 — record the neck's height BEFORE touching anything

INV-011 asserts the neck's height is unchanged, which needs a baseline from `main`. Take
it first; it cannot be recovered afterwards.

```bash
git switch main
npm run dev:clean           # then, in another shell, with the dev server up:
```

In Chrome at a 375×667 viewport, on a capture screen with a five-string part, read the
fret grid's height — today that is the `Fretboard`'s inner `div.w-max` (the strip does not
exist yet, so the wrapper and the grid are the same box):

```js
document.querySelector('[class*="w-max"]').getBoundingClientRect().height
```

Write the number into `e2e/capture-surface.spec.ts` as `NECK_HEIGHT_BASELINE_PX` with a
comment saying where it came from. Expected: ~234 px. Then `git switch 001-capture-control-surface`.

---

## Step 1 — the fast checks, after every change

```bash
npm run typecheck
npm run lint
npm test
```

**Expected**: all green, and in particular these two files pass **unmodified** —

- `src/lib/export/__tests__/text.test.ts`
- `src/lib/tab/__tests__/ascii.test.ts`

Those are the exact-string export tests. If either needed an edit, INV-013 is broken and
the change has reached the layout or the serialiser, which this feature must not touch.
Confirm with:

```bash
git diff --name-only main... -- src/lib/tab src/lib/export src/lib/sync src/lib/model.ts src/db/schema
# Expected: no output.
```

New unit suites that must exist and pass (node environment):

| Suite | Covers |
|-------|--------|
| `src/lib/capture/__tests__/target.test.ts` | all 12 cells of the applicability table, all 5 `resolveTarget` cases |
| `src/lib/capture/__tests__/latches.test.ts` | `litLatches ⊆ armed`; no lit-and-inapplicable state |
| `src/lib/capture/__tests__/properties.test.ts` | each `commit` writes what the toolbar wrote before; the import-graph assertion for INV-004 |
| `src/lib/capture/__tests__/controls.test.ts` | `isPresent` for all 9 controls × 4 target kinds — the node half of INV-002: stable always present, contextual present iff applicable |
| `src/lib/capture/__tests__/cursor.test.ts` | the four `nextCursorAfterDelete` cases |

New component suites (jsdom, opted in with `// @vitest-environment jsdom`):

| Suite | Covers |
|-------|--------|
| `src/components/capture/__tests__/LatchStrip.test.tsx` | INV-015 — 1 vs 5 latches, identical container class, no id branching |
| `src/components/capture/__tests__/ColumnInspector.test.tsx` | INV-015 — 3 vs 6 properties, same |
| `src/components/capture/__tests__/useLongPress.test.tsx` | threshold, movement cancel, single fire, synchronous click suppression, timer cleanup |

---

## Step 2 — story 1: the latch strip (P1)

Run the app and do it by hand first; it is a two-minute check and it is the story's
*Independent Test*.

```bash
npm run dev:clean
```

Open a song's capture screen, add a part, then **without touching the bottom toolbar**:

1. Tap a fret to create a column.
2. Tap `stack` in the strip directly above the neck.
3. Tap three frets on three different strings.

**Expected**:
- all three notes land in **one** column on the staff;
- the latch stays lit across all three presses;
- the status line reads exactly `stacking onto the marked column`;
- the strip did not scroll away when you scrolled the neck sideways.

Then: tap the latch again → it goes dark and the next fret press starts a new column. Arm
it again and press `end ⇥`, or insert a barline, or switch part → it goes dark each time
(this is the path today's code misses; see research §5).

Automated:

```bash
npm run test:e2e -- capture-surface.spec.ts -g "latch"
```

Covers INV-010's seven routes to an inapplicable target and INV-001's arm/disarm members.

---

## Step 3 — story 2: the contextual toolbar (P2)

By hand: put the cursor on a playable column, then on a barline, and watch the bottom
toolbar.

**Expected**:
- on a playable column: row 1 (space, barline, select, paste, delete) **and** row 2
  (triplet, repeat stepper, ×4, chord symbol);
- on a barline: row 1 only. Row 2 is **gone**, not greyed out;
- nothing in row 1 moved by a single pixel between the two states;
- with a selection active, the whole controls area is replaced by copy / cut / delete /
  cancel exactly as before, and the selected-count message still reads.

Automated:

```bash
npm run test:e2e -- capture-surface.spec.ts -g "toolbar"
```

Covers INV-002 (54 target × control pairs, asserting `toHaveCount(0)` rather than
`toBeDisabled()`) and INV-003 (`boundingBox()` equality for the five stable controls in
both directions).

Note the deliberate deviation recorded in `plan.md` → *Deviations* §1: `triplet` is in
row 2, so on a barline it is absent rather than holding position. The other five stable
controls do hold position.

---

## Step 4 — story 3: the column inspector (P3)

By hand, on the capture staff:

| Do | Expect |
|----|--------|
| Long-press a column (~½ s, finger or mouse) | a sheet opens naming that column, listing repeat count, chord symbol, delete |
| Raise the repeat count, close the sheet | the staff shows the column repeated; the exported text matches what the toolbar's stepper produces |
| Set a chord symbol, close | the symbol appears above that column |
| Delete from the sheet | the column goes, the sheet closes, the cursor lands where the toolbar's delete would have put it |
| **Tap** (do not hold) a column | the cursor moves, no sheet, **no perceptible delay** |
| Press a column and drag sideways to scroll | no sheet, and the cursor does **not** move |
| Open the sheet and press Esc | screen identical to before, including which column the cursor is on |
| Long-press a column while a selection is active | nothing happens |
| Long-press a **barline** | a sheet with one row: delete. Not an empty sheet, and no repeat or chord field |
| Tab through the open sheet, then Esc | every control reachable and operable, dismissal without a pointer |

Then the read-only staffs — this one is easy to get wrong and easy to check:

| Page | Do | Expect |
|------|----|--------|
| `/songs/[songId]` | long-press a column in a part's staff | nothing. No sheet, no hint, no context menu |
| `/songs/[songId]/play` | long-press a column in a step's staff | nothing |

Automated:

```bash
npm run test:e2e -- capture-surface.spec.ts -g "inspector|long press"
```

Covers INV-004 (each of six edits applied through both surfaces, compared via the exported
ASCII), INV-005, INV-006, INV-007, INV-008 and INV-009.

---

## Step 5 — the vertical budget

This is the one that is tight. Research §3 leaves roughly 20 px of slack in the worst
case, and the measurement is what decides, not the arithmetic.

```bash
npm run test:e2e -- capture-surface.spec.ts -g "fits|budget"
```

**Expected** at 375×667, in both themes:
- `document.scrollingElement.scrollHeight <= clientHeight` — no page-level scrolling;
- the staff scroller's `scrollHeight <= clientHeight` with all five string rows inside its
  client box, for a five-string part **with chords and with a tuplet**;
- `[data-testid="fret-grid"]`'s height equals `NECK_HEIGHT_BASELINE_PX` within 1 px;
- `[data-testid="latch-strip"]` present with non-zero height.

**If it fails**, the levers in order (from `plan.md` → *Blast-radius decisions*): drop the
visible words from `space` / `select` / `paste` and keep them in `aria-label`; tighten the
part-chip row's padding; tighten the status row. **Shrinking the neck is not a lever.** If
none of those is enough, stop and say so rather than taking it out of the neck.

---

## Step 6 — the browser pass, in both themes

Not optional and not substitutable by the suite. `docs/DECISIONS.md`: three defects
reached the user past a green suite, all three rendering or wiring problems a test cannot
see.

At **375×667, actual size, no zoom** (a magnified crop flatters a subtle tint — that is
also a recorded lesson), in light **and** dark:

1. Is the strip visibly a part of the neck's surface, and visibly separate from it?
2. Is an **unarmed** latch chip distinguishable from the strip behind it? (light theme
   first — `--bg-raised` is `#ffffff` there, which is where this has broken before)
3. Is an **armed** latch chip unmistakable, and does it carry the same emphasis the old
   `stack` button's armed state did?
4. Is the sheet readable over its backdrop, and are its row separators visible?
5. Do any button labels wrap? (a wrapped label reads as a layout bug — recorded)
6. Does a five-string part still show every string?

Then run the automated half of INV-014:

```bash
npm run test:e2e -- capture-surface.spec.ts -g "contrast|theme"
```

It asserts, for each of the five surface pairs in both themes, that the two backgrounds
resolve to **different named tokens with different relative luminance** and that the chip
carries a border — i.e. that the distinction does not rest on hue at matched lightness
(FR-030).

---

## Step 7 — the regression gate

```bash
npm test && npm run test:e2e
```

**Expected**: everything green, and `e2e/capture.spec.ts` changed by **exactly one
locator** — the `stack` button now lives in the strip. Any other edit to that file means a
behaviour changed, which INV-001 and INV-016 forbid.

```bash
git diff main... -- e2e/capture.spec.ts
# Expected: one hunk, the stack locator.
```

---

## Done when

- [ ] Steps 1–7 pass, including the manual passes in steps 2, 3, 4 and 6.
- [ ] The two export suites are unmodified and green (INV-013).
- [ ] `e2e/capture.spec.ts` differs by one locator (INV-001, INV-016).
- [ ] `NECK_HEIGHT_BASELINE_PX` is recorded with its provenance, and matches (INV-011).
- [ ] Each of the ten controls on the screen before this change has at least one home
      after it (SC-001): repeat stepper, ×4, stack, space, barline, triplet, chord symbol,
      select, paste, delete.
