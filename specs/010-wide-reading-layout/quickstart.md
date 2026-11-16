# Quickstart: validating the full-width reading layout

**Feature**: `010-wide-reading-layout` | **Plan**: [plan.md](./plan.md)

The steps prove the feature end to end. Contracts: [cards](./contracts/cards.md), [reading-cards](./contracts/reading-cards.md),
[click-bar](./contracts/click-bar.md). Fixture: [data-model.md](./data-model.md) §1.

## Prerequisites

- Node and the repo's dependencies (`npm ci`). Postgres from `npm run db:up` only for the sync specs.
- **No dev server holding `.next`.** Never run `npm run build` or the e2e suite while `next dev` is up. Kill it, or use
  `npm run dev:clean` afterwards.
- Edits keep each file's line endings (`npm run check:line-endings`).

## §1. Before any source edit (on the unedited tree)

1. `npm run build`, then
   `npx playwright test -c specs/010-wide-reading-layout/research-probes/probe.config.ts`.
   This re-records `measure-fit.json` and `measure-fit-tight.json`. They must match research R2/R3 within 1px.
2. Record the narrow baseline: `npx playwright test e2e/wide-narrow-record.ts -c e2e/wide-before.config.ts`. It writes
   `e2e/fixtures/narrow-before.json`.
   - **Content.** The `outerHTML` of `main` (stripped of ids) for the song page and the play view, and the rects of every
     card, staff, `tab-column` and `tab-bar-run`.
   - **Songs.** The four test songs, which have no repeated entries: one part; the fit song's parts each played once; a
     variant; a sliced pass.
   - **Sizes.** 375×667 and 412×915 on touch, and 767×1024 with a mouse.
   - **Bar.** The bar's rest and running heights at 375, 412, 768, 1024, 1280 and 1440.
3. Run the whole e2e suite once and save the list of failures. Any test that already fails on `main` is not this entry's.

**Expected**: the probe figures equal research R2/R3; the fixture file exists; the failure list is recorded in
`docs/DECISIONS.md` under "010 — suite before".

## §2. Unit

```bash
npm test -- src/lib/reading/__tests__/cards.test.ts            # INV-007, INV-008 (fold corpus F1–F15, words, spans, cardOf)
npm test -- src/lib/reading/__tests__/wide-threshold.test.ts   # INV-016 (globals.css variant == WIDE_QUERY)
npm test -- src/components/tab/__tests__/TabStaff.ruler.test.tsx   # INV-019 (ruler only with the prop; terms shared)
npm test                                                       # all; frets-unchanged, wrapped-unchanged snapshot unedited
npm run typecheck && npm run lint
```

**Expected**: all green. `git diff main -- src/components/tab/__tests__/__snapshots__ src/lib/reading/__tests__/baseline.json`
prints nothing.

## §3. The new e2e specs

```bash
npx playwright test e2e/wide-fit.spec.ts          # INV-005: SC-001, SC-002 (1280x800, 1440x900, both themes)
npx playwright test e2e/wide-order.spec.ts        # INV-002, INV-003, INV-006
npx playwright test e2e/wide-sideways.spec.ts     # INV-004, INV-013
npx playwright test e2e/wide-narrow-unchanged.spec.ts   # INV-001 against e2e/fixtures/narrow-before.json
npx playwright test e2e/wide-fold.spec.ts         # INV-007, INV-008
npx playwright test e2e/wide-position.spec.ts     # INV-009, INV-020 (SC-004)
npx playwright test e2e/wide-click-plays-all.spec.ts   # INV-010
npx playwright test e2e/wide-click-bar.spec.ts    # INV-011, INV-012 (SC-005)
npx playwright test e2e/wide-print.spec.ts        # INV-015 (SC-007)
npx playwright test e2e/wide-ruler.spec.ts        # INV-019
```

**Expected outcomes, in a reader's words**:
- **The fit song at 1280×800** with a mouse: both pages have `scrollHeight ≤ innerHeight`.
  - Play view: six cards numbered 1–6, two to a row in three rows, every card ending above the bar's top. Card 1 reads
    `×3 · passes 1–3 of 4` and `bars 1–12`; card 2 draws `A′` with its variant line.
  - Song page: the arrangement and four part cards, two to a row.
- **At 375 and 412**: one card per row, and the narrow markup equals the fixture.
- **At 768, 1024 and 1280**: two cards side by side in some row, and no sideways scroll at any width from 320 to 2560.
- **A full click run with following on**: the highlight visits every column of all ten passes in order. In card 1 the head
  row reads `pass 1 of 4`, then `pass 2 of 4`, then `pass 3 of 4`, and the card's height does not change.
- **Start, Stop, the beat box, tempo and More** move ≤ 0.5px on start, stop and cluster toggle, and the bar's bottom is
  within 1px of the screen's foot.

## §4. The existing suite

```bash
npm run test:e2e
```

**Expected**: every test passes.
- The tests in the plan's *Existing tests this changes on purpose* table were re-pinned. Each is named under
  "010 — re-pinned tests" in `docs/DECISIONS.md`.
- `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` have **zero diff** (`npm run check:untouched-wide`).
- Every capture spec except `capture.spec.ts`'s one play-view test (Deviation 2) has zero diff.

## §5. Guards

```bash
npm run check:untouched-wide       # INV-014: the scope fence prints "zero diff" for every path
npm run check:wide-amendments      # INV-017: re-pinned tests named in DECISIONS; spec 007 SC-010 and FR-055 amended
npm run test:spec004               # export and parser, unedited
npm run check:line-endings
```

## §6. Browser check (a person, at actual size; `npm run dev:clean` first)

At 375×667, 412×915, 768×1024, 1024×768, 1280×800, 1440×900 and 1920×1080, in **both themes**:

1. Song page with the panels closed, then play view, with the fit song and with a real long song.
2. Read the play view's cards in order by their numbers, without counting (SC-008). Is the next card obvious from any card?
3. The card number and the `×` words at actual size: legible, and no opacity over a surface.
4. Start and stop the click on a one-pass song. The bar is at the foot, and nothing in it jumps. Open and close More.
5. Turn on notes, then intervals. Cards may re-wrap and the song may scroll, and nothing scrolls sideways.
6. Print preview of the play view, portrait and landscape, both themes: every card whole, in order, numbered, and nothing cut
   at the right edge (SC-007).
7. Resize across 768 with a highlight showing. The highlight stays on its column.

Record each finding in `docs/DECISIONS.md` under "010 — browser check".

## §7. Owed to a real device

A coarse-pointer tablet at 768×1024 and 1024×768, and a phone in landscape. These are logged as owed, as spec 007 logged
T108–T113. They are emulated in §3 and are not marked done until a person has held the device.
