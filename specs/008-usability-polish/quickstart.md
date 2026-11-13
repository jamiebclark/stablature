# Quickstart: validating Usability polish

How to prove this entry works, end to end. The design is in [plan.md](./plan.md), and the interfaces are in [contracts/](./contracts/).

## 0. Prerequisites

- Node and `npm ci` done. Playwright's Chromium is installed (`npx playwright install chromium`).
- **Never** run the build or the e2e suite while a `next dev` holds `.next`. If a style change seems to do nothing in dev, run
  `npm run dev:clean` (FR-034).
- Stdin closed on anything that might prompt: append `< /dev/null`.

## 1. Before anything changes: record "today"

Do this once, on the branch before the first source edit, against a fresh `npm run build`:

```bash
npx playwright test e2e/polish-before.record.ts --project=mobile < /dev/null
```

This writes `e2e/fixtures/capture-375-before.json`: at 375×667, for {4, 5, 6 strings} × {plain, chord, chord + bracket} × {dark, light} ×
{at rest, selecting}, each capture row's rect, and the staff's `outerHTML`. INV-001 compares against it. It is recorded once, and is never
re-recorded to make a test pass.

The before figures for FR-011 are already in [research.md R1](./research.md#r1-how-much-the-band-has-and-how-tall-a-line-is-measured).
Re-run the probe to confirm them on the machine of record:

```bash
cd specs/008-usability-polish/research-probes && npx playwright test --config playwright.measure.config.ts < /dev/null
```

## 2. Unit and type checks

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
```

Expected: all pass. The new tests are `src/lib/capture/__tests__/band.test.ts`, `src/lib/__tests__/saving.test.ts` and
`src/lib/__tests__/words.test.ts`. `src/lib/tab/__tests__/` and `src/lib/reading/__tests__/frets-unchanged.test.ts`, with `baseline.json`,
pass **unedited**.

## 3. Guards

```bash
npm run check:untouched-polish < /dev/null      # INV-023: prints "zero diff" for every fenced path, and nothing CHANGED
npm run check:polish-amendments < /dev/null     # INV-024: "polish amendments: ok"
npm run check:usability-amendments < /dev/null  # still "usability amendments: ok"
```

## 4. Browser suite: this entry's specs

```bash
npx playwright test e2e/polish-band.spec.ts e2e/polish-band-interactions.spec.ts e2e/polish-part-card.spec.ts \
  e2e/polish-saving.spec.ts e2e/polish-bands-list.spec.ts e2e/usability-status-row.spec.ts < /dev/null
```

| Spec | Proves | Invariants |
|---|---|---|
| `polish-band.spec.ts` | 375×667 unchanged; wraps only when two lines fit; cursor's line at the bottom; blank under one line; line breaks stable; height sweep | INV-001 to 003, INV-005, INV-008 |
| `polish-band-interactions.spec.ts` | every trigger anchors and every non-trigger moves nothing; rows on every line; same results wrapped and on one line | INV-004, INV-006, INV-007 |
| `polish-part-card.spec.ts` | the face, the menu by keyboard and pointer, outside taps acting on nothing, position, print, floors, the invitation | INV-010 to 016 |
| `polish-saving.spec.ts` | every sign-in state on every surface, the short form's width, error precedence | INV-018 to 020 |
| `polish-bands-list.spec.ts` | no slug, counts, no request | INV-017 |
| `usability-status-row.spec.ts` (extended) | segments, separators, weight, words, one line | INV-021, INV-022 |

## 5. The full suite

```bash
npm run test:e2e < /dev/null
```

Expected: green, apart from the two known flakes that are not this entry's (spec 006 FU19, and `durations.spec.ts:7` under load). Do not
lengthen a wait for them. `usability-height-budget.spec.ts`, `usability-wrap.spec.ts`, `usability-staves.spec.ts` and every `click-*`
timing spec pass **unedited**.

## 6. The person-level browser pass (FR-034, SC-012)

At actual size, in a real browser window, in **both themes**, at **375×667, 390×844, 412×915 and 1280×800**. Record the findings in
`docs/DECISIONS.md`.

| Screen | Look for |
|---|---|
| Capture, 12-bar six-string part, chord and bracket, cursor at end | 412 and 1280: two lines, cursor's line on the neck, blank under one line. 375 and 390: today's single line. |
| Capture, cursor at start; mid-part; a wide bar | The first line at the bottom with blank above; the mid line at the bottom; the wide bar scrolls alone. |
| Capture, tap a column on the upper line; extend to the lower line; group; long press | Nothing jumps; the selection shows on both lines; the bracket comes into view; the inspector is on the pressed column. |
| Capture, open the chord form at 412×915 | It drops to one line with the caret in view, and wraps again on close. |
| Song page, three parts, one unnamed | No red on the faces; the label has its pencil; the invitation is told from a name in greyscale; the menu opens beside its button, never under the bar. |
| Top bar and capture header, signed out with changes | `Saved on this device` beside Sign in; `saved · sign in` in the header; no `unsynced`. |
| Bands list | Names and counts, no slugs. |
| Status row: stack with `Dsus4`; a waiting digit; a refusal; an unknown symbol | Separate facts, one line, nothing whole is cut. |

## 7. Owed to a real phone

These are human tasks in `tasks.md`. They stay open until done on hardware:

1. On iOS Safari and Android Chrome, a tap outside the open menu closes it and does not act on what was under it.
2. On a real phone, the band moves its line to the bottom without a visible jump under a thumb resting on the neck.
3. On a phone browser with its toolbars showing, where the band's height is between one and two lines, the band shows one line.
