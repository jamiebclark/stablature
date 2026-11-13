# Quickstart: validating rhythm notation under the tab

**Feature**: `009-rhythm-notation` | **Plan**: [plan.md](./plan.md)

This is a run guide. It says what to run and what must come out. The rules it checks are in
[contracts/beaming.md](./contracts/beaming.md), [contracts/rhythm-row.md](./contracts/rhythm-row.md) and
[contracts/duration-buttons.md](./contracts/duration-buttons.md).

## Prerequisites

- Node and npm as in `package.json`; `npm ci` done; Playwright browsers installed (`npx playwright install`).
- **Never run `npm run build` or `npm run test:e2e` while a dev server holds `.next`.** Stop it first.
- Every browser check starts from `npm run dev:clean`, or from a fresh production build. Stale builds have shown old staves before.
- Run long suites in the foreground and wait for them to finish.

## §1. Measure before drawing (the first implementation task)

On the **unedited** tree, on the production build at 375×667 (touch) and 1280×800 (fine), record into
`specs/009-rhythm-notation/research-probes/measure-before.json`:

1. The band's outer height, its content height (outer minus padding), and one line's height, for six strings with a chord row and a
   bracket row (expect 189.6 / 185.6 / 184.0 on touch).
2. The bottom of the lowest string's fret-number `<span>` (its mask) relative to its cell, and the digit's Range rect (expect a mask bottom
   of 20.4 on touch and 17.4 on fine).
3. The box of a 12px numeral with `line-height: 9px` in JetBrains Mono (expect about 9px).

If any figure differs from research R1 or R2 by more than 0.5px, update `--rhythm-row` and `--rhythm-lead` within research R2's named
fallback before writing any drawing code, and record the figure in `docs/DECISIONS.md`.

## §2. Unit tests (pure rules)

```bash
npx vitest run src/lib/rhythm/__tests__/beams.test.ts src/lib/rhythm/__tests__/positions.test.ts < /dev/null
```

Expected: every row of the FR-036 corpus (`contracts/beaming.md`) passes. `right[i] === left[i+1]` holds over the whole corpus. Each L1 to L4
case gives one label per counted group.

```bash
npx vitest run src/lib/rhythm/__tests__/notation-baseline.test.ts src/lib/rhythm/__tests__/notation-oracle.test.ts src/lib/rhythm/__tests__/notation.test.ts < /dev/null
```

Expected: these pass **unedited**. The reader's output is unchanged by the new `hit` argument.

## §3. Markup (jsdom)

```bash
npx vitest run src/components/tab src/components/capture/__tests__/duration-row.test.tsx src/lib/reading/__tests__/frets-unchanged.test.ts < /dev/null
```

Expected:

- `frets-unchanged.test.ts` passes with `baseline.json` **unedited**: no durations means byte-identical markup (FR-019, SC-001).
- `tab-staff-rhythm.test.tsx`: no-duration staves are identical with and without `showRhythm`. With durations, each cell carries
  `data-duration`, and the bracket is inside `tab-rhythm`, not above the strings.
- `duration-row.test.tsx`: six buttons, empty text, `aria-label` and `title` in words, the lit one by `aria-pressed`.

## §4. Whole unit suite and guards

```bash
npm run typecheck < /dev/null
npm run lint < /dev/null
npm test < /dev/null
npm run test:spec004 < /dev/null
npm run check:untouched-notation < /dev/null
npm run check:notation-amendments < /dev/null
npm run check:polish-amendments < /dev/null
npm run check:usability-amendments < /dev/null
```

Expected: all pass. `check:untouched-notation` prints `zero diff` for every fenced path (plan, *Scope fence*).

## §5. Browser suite (production build)

```bash
npm run build < /dev/null && npx playwright test e2e/notation-*.spec.ts < /dev/null
npx playwright test < /dev/null
```

The new specs and the fixtures each one seeds (through `rhythm-probe-helpers.ts`'s `seed` and `writeColumns`):

| Spec | Proves |
|---|---|
| `notation-symbols.spec.ts` | Six notes, six rests and "none" on song (expanded, compact), play and print. Contrast ≥ 4.5 on each surface in both themes. Greyscale crops are pairwise different (INV-009, INV-010) |
| `notation-beams.spec.ts` | Every corpus bar from `contracts/beaming.md` on song and play: `data-beams-*` match the hand table, and every beam rect starts and ends within 1px of a stem centre (INV-002, INV-006, INV-007) |
| `notation-alignment.spec.ts` | Stem centre within 1px of note centre across frets, notes and intervals × compact and expanded × a chord-widened column × single and wrapped lines. The view switches with no reload (INV-007) |
| `notation-brackets.spec.ts` | On staves with durations, brackets under the tab with one number per group; on staves without, today's row above, unchanged (INV-004) |
| `notation-capture-height.spec.ts` | At 375×667 touch with 4, 5 and 6 strings, a chord, a counted group and durations: every string, the chord row and the rhythm row in view, page scroll 0, band ≥ 189 (INV-005) |
| `notation-capture.spec.ts` | The first duration set shows the row and moves the brackets; the last one cleared reverses both. Wrapped lines each draw their own row. The selection colour and the reveal of a new group still work (INV-011) |
| `notation-buttons.spec.ts` | Six symbols on one line at 375; each ≥ 54×44 on touch and meets the fine floor on desktop; named and titled in words; lit state visible in greyscale (INV-012) |
| `notation-offline.spec.ts` | A cold, offline open draws the notation; no new request, font or image (INV-014) |
| `notation-paste.spec.ts` | The paste preview's markup equals today's for every import fixture (INV-001) |

Expected: all green on `mobile` and `desktop`. The whole suite passes, except the known flakes named in the spec (spec 006 FU19 sync and
`durations.spec.ts:7` under full-suite load). If either flakes, rerun it alone and record the result.

## §6. Person-level browser pass

After `npm run dev:clean`, at 375×667 and 1280×800, in dark, light and a greyscale screenshot, open each of these and record what you see in
`docs/DECISIONS.md` (SC-002, SC-009):

1. The song page, expanded and compact, with the US1 part (four quarters, eight eighths, `16 8 16`, a rest and an eighth, a half and two
   quarters, a whole).
2. The play view, wrapped, with the same part, and print preview.
3. Capture with a six-string part, a chord, a counted group and durations, plus a four-string part that wraps.
4. The paste preview of any import fixture: unchanged.
5. The inspector's duration row on touch and with a mouse.

Re-measure §1's figures on the edited build and record them before and after (FR-018).

## §7. Owed to a real phone (human tasks; they stay open until done)

- Two-pixel beams and three stacked flags read as three, not as a smudge, on a real phone at arm's length and on a music stand in the play
  view.
- The rhythm row in capture does not crowd the neck under a resting thumb.
