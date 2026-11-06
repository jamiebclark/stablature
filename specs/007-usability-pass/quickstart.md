# Quickstart: validating the usability pass

How to prove this entry works. What each thing must do is in [contracts/](./contracts/), and the full property list is in
[plan.md](./plan.md). This file does not restate either.

## Prerequisites

- `npm ci`, and `.env.local` as in the README. Postgres via `npm run db:up` for the two-device checks, which skip without it.
- No dev server running. The build and the e2e suite must own `.next`.

## 1. Types, lint and unit tests

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
npm run test:budget < /dev/null
```

All pass. `src/lib/reading/__tests__/frets-unchanged.test.ts` passes with only `TabStaff` markup entries re-recorded. Compare them:

```bash
git diff main --stat -- src/lib/reading/__tests__/baseline.json
```

Every changed key is a markup key.

## 2. The scope fence

```bash
npm run check:untouched-usability < /dev/null
```

Prints `zero diff` for every path in the plan's *Scope fence*. `check:untouched`, `check:untouched-rhythm` and `check:untouched-reading` are
expected to fail on this branch (Deviation 12).

## 3. The height budget

```bash
npx playwright test e2e/usability-height-budget.spec.ts --project=mobile < /dev/null
```

At 375×667 in both themes: 0 strings out of view at rest and while selecting, frets 36×36, and the band at least 189px.

To prove the test can fail, add a throwaway `<div className="h-1" />` to `CaptureScreen`'s root, run it, see it fail, and take the line out.

## 4. Every screen

```bash
npx playwright test e2e/usability- < /dev/null
```

`mobile`, `desktop` and `no-pointer` all pass. `no-pointer` fails loudly, not silently, if its `matchMedia` check does not hold.

## 5. The reader

```bash
npx vitest run src/lib/tab src/lib/reading/__tests__/paste-joined-chords.test.ts < /dev/null
npx vitest run --config specs/004-ascii-import/review-probes/vitest.probes.config.mts < /dev/null
```

The first passes in full, with `src/lib/tab/__tests__/` unedited. The second fails **only** on the 19 already failing on `main`:

- `INV-002-fret-over-the-range-says-so` (4)
- `INV-006-rails-only-every-spelling` (5)
- `INV-008-true-reason` (3)
- `INV-009-pipe-touching-a-wrapped-cell` (4)
- `INV-015-016-chord-over-a-bare-bracket` (3)

`INV-014-030-wrapped-cells-only-s6-claims` is a timing probe, and may fail under load. A failure outside this list is a regression. Run the same command on `main` to compare, in the
same session, since load moves the timing probe.

The F75 measure comes from spec 004's `INV-010-ordinary-lines-anywhere` probe, in the same run, which prints the cost by kind. Expect 39 of 202, and it must be at most 43.

## 6. The click is unchanged

```bash
npx vitest run src/lib/rhythm < /dev/null
npx playwright test e2e/click- < /dev/null
```

These pass with `click-timing`, `click-running` and `click-every-ending` unedited.

## 7. The whole suite

```bash
npm run test:e2e < /dev/null
```

A sync failure that says a row is lost is spec 006's FU19, not this entry. Do not lengthen a wait for it.

## 8. The audit's after figures

```bash
npm run build < /dev/null
npx playwright test -c specs/007-usability-pass/audit/playwright.audit.config.ts < /dev/null
node specs/007-usability-pass/audit/summarise.mjs < /dev/null > specs/007-usability-pass/audit/after.txt
```

Compare `after.txt` with `before.txt`. Every A-number gets an outcome: fixed, accepted with a reason, or logged (SC-017).

## 9. Browser pass, at actual size, in both themes

A person-level check. Owed after merge, because no pipeline phase has a browser. Each row is looked at in the dark and light themes.

| Look at | At | What to see |
|---|---|---|
| Capture, six strings, chord and bracket | 375×667 | All six show. Nothing feels cramped. The merged row reads clearly |
| Capture selecting, all seven controls | 375×667 | Brackets are tellable apart, and `delete` is clear of them |
| Status row, stack armed, chord | 375×667 | Whole words |
| Neck | 375×667 | Header numbers legible, inlays still show the neck's shape |
| Chord-tone contrast in the light theme | 375×667 | New accent against the new grey still says "in the chord" |
| Any staff, with every row | 375×667, desktop | JetBrains Mono looks right, and numerals and marks sit on their notes |
| Song page | 375×667 | Panels open and close, bottom bar feels right |
| Play view, 16 bars, wrapped | 375×667, 1280×800 | Justified lines look like a page, and labels sit on each line |
| Play view, a bar wider than a line | Windows desktop | Sideways scrolling with no visible scrollbar is acceptable (Deviation 7) |
| Highlight with the click running | 375×667, desktop | Easy to follow, and clearly not a selection or a variant mark |
| Help overlay | Desktop | Readable, and lists only what works here |
| Mouse density | 500×800, 1280×800 | Tighter and not fiddly |
| Landscape, capture | Phone size | Neck stays reachable |
| Print preview, play view | Desktop | Lines fit the page, with no cluster or highlight |

## 10. Owed to a real phone

From the spec's list. Each is a human item in `tasks.md`, open until done.

1. 16px inputs do not zoom on focus on iOS Safari. A pinch zooms, and a double tap on the neck does not.
2. The keyboard hides neither the paste status nor the inspector's input, on iOS and Android.
3. Installed to the home screen, nothing sits under the status bar or home indicator.
4. Six strings in a phone browser with its bars showing.
5. A fret tap, a jump button in its 26px row, and the two bracket controls, each with a thumb.
6. The reading highlight, with the click running.
