# Quickstart: validating cards per row

How to prove this entry works end to end. What each check asserts is defined in [plan.md](./plan.md) (*Invariants*).
The rule a check computes is in [data-model.md](./data-model.md) §4, and the CSS and hook in
[contracts/cards-per-row.md](./contracts/cards-per-row.md).

## 0. Prerequisites

- `npm ci`; Postgres up (`stablature-db-1`), with `STABLATURE_DATABASE_URL` in `.env.local` as for every e2e run.
- Playwright browsers: Chromium and Firefox (`npx playwright install chromium firefox` if missing).
- For the Linux replica: Docker, and `specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh`.

## 1. Before any change: record the suite and the baseline

1. `npm test < /dev/null` and `npm run test:e2e < /dev/null` on the branch before editing. Log the pass/fail counts under
   "013 — suite before" in `docs/DECISIONS.md`.
2. Re-run the research probes once to confirm the starting figures still hold on this machine:
   `npx playwright test -c specs/013-cards-per-row/research-probes/probe.config.ts < /dev/null`.
   Today's short play view at 1280×800 is 3,3,3,3 with scroll 962/800, and the long song's ruler for A reads 0
   (research R3, R7).

## 2. Unit

```bash
npx vitest run src/components/tab/__tests__/TabStaff.ruler.test.tsx \
               src/components/tab/__tests__/TabStaff.ruler-depth.test.tsx \
               src/components/tab/__tests__/TabStaff.wrapped-unchanged.test.tsx < /dev/null
```

Expected: all pass. `TabStaff.ruler.test.tsx` and `wrapped-unchanged` are **unedited**. The depth test fails on today's
`rulerWidth` for a 64-bar part (a flat sum of over 100 operands) and passes after the change (INV-008).

## 3. e2e: the new specs

```bash
npx playwright test e2e/cards-rows.spec.ts e2e/cards-ruler-long.spec.ts e2e/cards-follow.spec.ts \
                    e2e/cards-pass-words.spec.ts e2e/cards-print.spec.ts < /dev/null
```

Expected outcomes, by scenario:

| Scenario | Spec | Expected |
|---|---|---|
| US1: the `short` song at 1280×800, mouse, both themes | `cards-rows` (INV-007) | Play view: rows 8 + 4 (the greedy count from measured widths), no vertical scroll, every card above the bar. Song page: 4 + 4 + 4, one-line head rows, `scrollHeight` ≤ 1030 (research R5, the recorded deviation). |
| US2: the `long` song at 1024/1280/1440/1920 | `cards-rows` (INV-003, INV-004) | A takes the row. It is on one line at 1440 and 1920, and wrapped at barlines at 1024 and 1280. B and C share the next row at their own widths. |
| US3: the fit song at 1280×800 and 1440×900 | `cards-rows` (INV-007) | Both pages: no vertical scroll. Play: last card bottom ≤ bar top. Song page: the C card's head row is one line. |
| Every song × width × pointer × page | `cards-rows` (INV-001–INV-006) | Drawn rows equal the greedy rows; order 1..n; widths within the rules; nothing sideways. |
| Long rulers | `cards-ruler-long` (INV-008) | Every ruler is non-zero and within ±1px of the one-line staff, at every part length up to 64 bars, in Chromium and Firefox. |
| Changes without reload | `cards-follow` (INV-009) | After a view, density or theme change, a resize, a memo added and removed, or a rename, the rows equal the greedy rows again. During a click run and a key walk, no `li` moves. |
| US4: the click on the fit song | `cards-pass-words` (INV-010) | In every pass of card 1, the gap after the visible pass words is ≤ the head row's gap, and no head-row item moves by more than 0.5px. |
| US5: print | `cards-print` (INV-012, INV-013) | `Em7` on one line; a 40-character symbol breaks inside its card; every card is whole, in order and greedy at the print width. |

## 4. e2e: what must still hold, unedited

```bash
npx playwright test e2e/wide-narrow-unchanged.spec.ts e2e/wide-sideways.spec.ts e2e/wide-fit.spec.ts \
  e2e/wide-print.spec.ts e2e/wide-ruler.spec.ts e2e/wide-position.spec.ts e2e/wide-fold.spec.ts \
  e2e/wide-click-bar.spec.ts e2e/wide-controls.spec.ts e2e/wide-click-plays-all.spec.ts \
  e2e/play-whole-song-outline.spec.ts e2e/memo-floors.spec.ts e2e/memo-card-height.spec.ts < /dev/null
npx playwright test --project firefox < /dev/null   # wide-sideways-firefox, usability-staves, and this entry's
                                                    # cards-rows (INV-005) and cards-ruler-long (INV-008)
```

Then the full suite: `npm run test:e2e < /dev/null`. Expected: everything passes. The only edited test files are the
re-pins in plan.md's table, each named in `docs/DECISIONS.md` under "013 — re-pinned tests".

## 5. Guards

```bash
npm run check:untouched-cards < /dev/null     # INV-015: the scope fence
npm run check:cards-amendments < /dev/null    # INV-016: amendments and re-pins recorded
npm run check:line-endings < /dev/null
npx tsc --noEmit < /dev/null && npm run lint < /dev/null
```

Earlier entries' `check:untouched-*` guards report this branch's own files (`PlayView.tsx`, `globals.css`,
`TabStaff.tsx`, `useCardTrack.ts`). Log that under "013 — earlier entries' untouched guards", as entries 11 and 12 did.

## 6. The Linux replica (FR-021)

Run the new specs and the §4 list in the replica. First
`bash specs/007-usability-pass/review-probes/INV-016-linux-chrome.sh setup`, then the script's run form (its header gives
the usage) with the spec list, as entry 10 did. The replica copies the tree at setup only, so re-run setup after edits. Expected: the same passes. Row counts
come from each run's own measurements, so Linux's whole-pixel advances change nothing.

## 7. Browser check (human; SC-009)

At 100% zoom, with `npm run dev:clean` or a production build (`npm run build && npm run start`), both themes. On each
of the `short`, `long` and fit songs, at 1280×800 and 1920×1080, on both pages:

1. Cards read in number order, left to right, then down. Short cards sit several to a row, and A in `long` takes the
   width it needs.
2. Every staff reads, and no head row is clipped or overlapping.
3. At 1280 with the click running on the fit song, the pass words show no blank stretch, and nothing jumps as passes
   change.
4. Print preview of both pages: `Em7` on one line, and every card whole.

Log the outcome under "013 — browser check" in `docs/DECISIONS.md`. This is a human task. An agent does not tick it
(INV-018).
