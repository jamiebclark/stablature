# Review: Cards per row follow what the cards hold

I reviewed the uncommitted working tree on `013-cards-per-row` against `main` (`bcd3cde`). `HEAD` equals `main`, so the
branch has no commits, and this is the present tree after Phase 11's remediation (T045–T048). That is:
- 13 modified tracked files: 253 insertions and 53 deletions by `git diff --stat`, the same totals as round 3, since
  T045 rewrote a line without adding one;
- 12 new non-spec files.

This is **round 4**. The earlier rounds:
- **Round 1:** 1 BLOCKER (the print chord rules) and 3 MAJOR. Phase 9 fixed them.
- **Round 2:** 1 MAJOR (print sizing outside emulation). Phase 10 fixed it.
- **Round 3:** 1 MAJOR: T043's `@media print and (min-width: 768px)` turned `npm test` red. Phase 11 fixed it, and all
  four of its tasks are ticked.

**Read in full:**
- the source diffs: `src/app/globals.css`, `src/components/reading/useCardTrack.ts`, `src/components/tab/TabStaff.tsx`
  and `src/components/app/PlayView.tsx`;
- `e2e/cards-print.spec.ts`, with T046's widened real-print test and T047's `page.pdf()` test;
- T048's test in `e2e/cards-follow.spec.ts`;
- the `e2e/wide-order.spec.ts` re-pins;
- the records: plan.md § Invariants, Deviations, re-pin table and Scope fence; contracts §2 and §5; DECISIONS deviation 5
  and "013 — suite before";
- Phase 11 in tasks.md.

**Sampled by running them:** the other `e2e/cards-*` specs, `cards-helpers.ts`, `cards-print-measure.ts`, both new
scripts, and the fixtures. Rounds 2 and 3 read these in full, and Phase 11 did not touch them.

**Not reviewed:** `.specify/roadmaps/best-in-class.json`, which is roadmap metadata.

## Verdict

**Ready to merge: 0 BLOCKER, 0 MAJOR.**

**Round 3's MAJOR is fixed:**
- **The rule:** it is now a plain `@media print` (`src/app/globals.css:670`).
- **The tests:** `npm test` passes 6296 of 6296, with spec 010's `wide-threshold.test.ts` unedited.
- **The records:** the contract §2 and DECISIONS deviation 5 describe the new condition.

**Every invariant holds over its enumeration:**
- **On Windows:** in Chromium (mouse and touch) and Firefox.
- **In the Linux replica:** `cards-print`, `wide-print`, `cards-rows` and the INV-013/INV-009 probes.

**Every earlier probe was re-run first, and none regressed.** Their only failures are the two known MINORs.

**This round also covered what earlier rounds had not:**
- **The whole e2e suite**, which T023 still owed. In 8 shards, 2632 passed, 514 were skipped and 3 failed. All 3 are
  noise on re-run, or fail on `main` too.
- **INV-009's font-load trigger.** It is checked properly for the first time, and it holds.
- **A mutation run.** It shows that the suite's adopted real-print test fails in round 2's state.

**Not gating:**
- Six MINORs go to § Follow-ups. Four are carried from round 3. Two are new, and both concern tests: one font trigger
  that measures nothing, and one flake seen once.
- One pre-existing flaky click test is out of scope.

The browser check at actual size (T032, INV-018) is still owed to a person.

## Invariants

**How it ran:**
- **The 13 probes kept from rounds 1–3** ran first, in `probe-desktop`, `probe-mobile` and `probe-firefox`: 84 passed,
  51 were skipped by design and 6 failed. The failures are the known MINORs F1 and F2, unchanged.
- **One new probe**, marked "round 4" in the table.
- **The feature's e2e specs** in desktop, mobile and firefox: 319 passed and 32 were skipped.
- **The replica:** cards-print, wide-print and cards-rows passed 181 tests, and the probes passed 19.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | Ww 6 × Ptr 2 × Pg 2 × Songs 8, plus Firefox | `cards-rows.spec.ts` (mobile, desktop, firefox, Linux); `wide-order.spec.ts` (order and numbers) |
| INV-002 | held | the same, plus light at 1280; after the 7 triggers; screen → print → screen | `cards-rows.spec.ts`; `cards-follow.spec.ts`; review-probes/INV-009-triggers-and-key-walk.probe.ts; INV-013-print-remeasure.probe.ts round trip. Round 4: INV-009-font-load-late.probe.ts holds after a real late font (desktop, firefox, Linux) |
| INV-003 | held | Ww × Ptr × Pg × Songs | `cards-rows.spec.ts`, still at 1.5px on the bounds (FU8) |
| INV-004 | held | Ww × Ptr × Pg × 5 songs × View 3 | `cards-rows.spec.ts` (3 projects, Linux); review-probes/INV-007-long-1920-and-play-views.probe.ts |
| INV-005 | held | (Ww ∪ Wn) × {Chromium, Firefox} × Pg × View × 5 songs | `cards-rows.spec.ts` in desktop, mobile, firefox; `wide-sideways-firefox.spec.ts` |
| INV-006 | held | Ww × Ptr × Pg × {fit, short, names, empty, memo}; the recorder at {768, 1024, 1280, 1920} | `cards-rows.spec.ts`; `cards-recorder.spec.ts`; review-probes/INV-006-017-recorder-floor.probe.ts. A `wide-order.spec.ts` card at 768 drew under its minimum once in about 170 runs → F6 (MINOR, test timing). Round 4's late-font probe checks the minimum after a font swap. |
| INV-007 | held | 16 of 16 members on Windows; on Linux, `long` play @1920 is plan Deviation 7 | `cards-rows.spec.ts`; review-probes/INV-007-long-1920-and-play-views.probe.ts. The short song page's `≤ 1030` is Deviation 3. |
| INV-008 | held | {1, 4, 8, 10, 12, 16, 32, 64} bars, a 64-column bar, 60 chords, a 40-char chord, removal gaps, an empty part × 3 views × Pg × {Chromium, touch, Firefox} | review-probes/INV-008-ruler-every-member.probe.ts (3 projects); `cards-ruler-long.spec.ts`; `TabStaff.ruler-depth.test.tsx` (in `npm test`) |
| INV-009 | held | the 7 triggers × Pg; key walks at {768, 1280}; a click run; a 40-press walk at 1280. Round 4: the font trigger with the web fonts really held back, {fit, short} × {768, 1280} × Pg | `cards-follow.spec.ts` (T048 adopted); review-probes/INV-009-triggers-and-key-walk.probe.ts and -no-measure-while-reading.probe.ts. Round 4: INV-009-font-load-late.probe.ts. `--own-head` changes on release (for example 380 → 373) and the rows re-form greedy. The suite's own font trigger tests nothing → F5 (MINOR). |
| INV-010 | held | {fit card 1, F5, `×12`} × {375, 768, 1280} × {keys, click} | `cards-pass-words.spec.ts` (mobile, desktop) |
| INV-011 | held | their own enumerations | `wide-position`, `wide-fold`, `play-whole-song-outline` and `wide-print` (T037 re-pin only): pass in mobile, desktop, firefox, Linux |
| INV-012 | held | fit chords incl. `Em7` and a 40-char symbol × Prn × Th × Pg; 80-char × {375, 820, 1280}; later-column shapes × {375, 718, 820, 1047, 1280} | `cards-print.spec.ts` (3 projects, Linux); the three INV-012 probes. The extended 375 member still breaks → F2 (MINOR, outside the enumeration). |
| INV-013 | held | the real-print state over {fit, short, long, F5} × Prn × screen {1047, 1280, 1920} × Th × Pg × {Chromium mouse, touch, Firefox}, **288 of 288**, now in the suite (T046); emulated print; `page.pdf()` from 412 and 1280 (T047); Linux | `cards-print.spec.ts`; review-probes/INV-013-real-print-every-member.probe.ts (Windows, Linux) and the other INV-013 probes. Round 4 mutation: with round 2's print rule served (`INV-013-mutation-proxy.mjs own-head-print`), T046's test fails (`short`: 3 a row vs greedy 4), and the control passes 8 of 8. Outside the enumeration: a script-less print from below 768 → F1 (MINOR). |
| INV-014 | held | Wn × Ptr × Th × Pg × fixture songs; fit and short for the style check | `wide-narrow-unchanged.spec.ts` unedited (3 projects); `cards-rows.spec.ts` INV-014. T045's print rule has no width condition, but it applies only under print media. Below 768 `--card-least` is unread, so nothing below 768 changes. |
| INV-015 | held | every *Scope fence* path and bounded file | `npm run check:untouched-cards`: ok. `TabStaff.wrapped-unchanged` and `frets-unchanged` pass in `npm test`. |
| INV-016 | held | every re-pin row; spec 010 FR-005, FR-006, SC-003; contract §1, §4, §5 | `npm run check:cards-amendments`: ok. No pin was moved or weakened, and `wide-threshold.test.ts` has zero diff. The records' leftover drift is F3 (MINOR). |
| INV-017 | held | memo-floors, memo-list, memo-states, memo-recorder, memo-card-height (both fixtures) at their sizes | all pass (memo-recorder in mobile and desktop) |
| INV-018 | held | T032 | still unticked and `🛑 BLOCKED` for a person |

## Findings

- [ ] MINOR F1 — PLAUSIBLE: a page opened below 768 and printed onto paper 768 or wider, in a browser that runs no
      script while printing, prints every card at the 9rem minimum. This is round 3's F2, unchanged.
      where:  src/app/globals.css:652-654, src/components/reading/useCardTrack.ts:21, src/components/app/SongView.tsx:471-472
      why:    Below 768 the hook writes no `--own-*` (INV-014), so on wide paper every basis falls back to
              `--card-min`.
              - **The model:** review-probes/INV-013-print-from-narrow-screen.probe.ts freezes `matchMedia`. The fit
                play view then prints 6 a row on 4 lines each, and the song page cuts 465 of each 606px staff.
              - **Chromium's real print is fine:** its `page.pdf()` re-renders wide and prints the greedy rows.
              - **Firefox:** its print is unverified.
      traces: FR-019, FR-004, US3 AS5, INV-013 (outside its enumeration)

- [ ] MINOR F2 — A printed chord symbol that fits its line still breaks when it is wider than `100vw - 8rem`. This is
      round 3's F3, unchanged.
      where:  src/app/globals.css:715
      why:    At 375 a 269px symbol in a 289px line prints on 2 lines, in desktop and firefox
              (review-probes/INV-012-print-chord-any-column.probe.ts). No real chord name reaches that width.
      traces: FR-017, US5 AS1, INV-012 (outside its enumeration)

- [ ] MINOR F3 — The records still drift from the code. This is round 3's F4, less T045's part.
      where:  specs/013-cards-per-row/contracts/cards-per-row.md:72, specs/013-cards-per-row/contracts/cards-per-row.md:139, docs/DECISIONS.md:930, specs/013-cards-per-row/plan.md:68, specs/013-cards-per-row/plan.md:146, specs/013-cards-per-row/plan.md:211-212, specs/013-cards-per-row/plan.md:222
      why:    **T045 fixed** the condition's wording in contract §2 step 3 and in DECISIONS deviation 5.
              **Still open:**
              - "A real print fires only `beforeprint`/`afterprint` … and runs no observer" (contract §2 and DECISIONS
                deviation 5). This holds from a wide screen only.
              - Plan Performance Goals still says one forced layout per pass, where the batch forces three.
              - Contract §5 still says `.reading-card { container-type }`, where the code uses `.tab-lines`.
              - Plan Deviation 5 still calls the printed line "the card's content width".
              - The `wide-print` re-pin row is listed twice.
              - The Scope fence omits `memo-card-height.spec.ts`.
              - DECISIONS "013 — decisions" omits Deviation 7.
      traces: INV-016, FR-023

- [ ] MINOR F4 — The own-width and greedy rule exists in four copies, with two tie tolerances. This is round 3's F5,
      unchanged.
      where:  e2e/cards-helpers.ts:103-109, e2e/cards-print-measure.ts:84-85, e2e/cards-rows.spec.ts:83-92, e2e/wide-print.spec.ts:58
      why:    `isRoundingTie` skips within ±0.5px and the print copy skips within ±1px. On a tie, `wide-print`'s re-pin
              asserts nothing. No tie occurs for the seeded songs today.

- [ ] MINOR F5 — The suite's "`document.fonts` load completes" trigger re-measures nothing. The product holds, but
      no suite test would catch it if it stopped holding.
      where:  e2e/cards-follow.spec.ts:61
      why:    `document.fonts.load("1em monospace")` runs after `document.fonts.ready`, so every face is already
              loaded. No font swaps, and the hook has nothing to re-measure. The trigger passes vacuously.
              review-probes/INV-009-font-load-late.probe.ts tests it for real:
              - **The setup:** it holds `/_next/static/media/*.woff2` back, so the hook measures the fallback faces.
              - **The result:** after release `--own-head` changes (fit play card 1: 380 → 373), and the rows are the
                greedy rows of the new widths.
              - **Where:** desktop, firefox and Linux, both pages, at 768 and 1280.
      traces: FR-010, INV-009 (its trigger list)

- [ ] MINOR F6 — PLAUSIBLE: the re-pinned `wide-order` row test can read the cards before they settle. It failed once
      under load.
      where:  e2e/wide-order.spec.ts:44-52
      why:    In the 7-worker run of the spec 010 specs, "cards read left to right … at 768" (desktop) read a card
              273.3px wide against its measured minimum of 342.5.
              - **Reproduction:** the 768 test passed 8 of 8 alone. A 14-worker stress run of the row tests (768, 1024
                and 1280, desktop and mobile) passed 150 of 150, so it was seen once in about 170 runs.
              - **The likely gap:** the poll at lines 44-47 waits only for `--own-head` to be present on every `li`, not
                for a settled layout. `cards-print-measure.ts`'s `settle` waits for two frames after
                `document.fonts.ready`.
              - **Why only MINOR:** the product's settled state was right in every other run, and CI retries once.
      traces: FR-022 (a re-pinned pin), INV-006

- NOTE F7 — T048 is ticked with its "confirm it can fail" mutation not run, and the task says so. Its control half
  shows that the recorder sees a measuring batch, so the test can fail. T046's can-fail step is confirmed
  independently by this round's mutation run (INV-013 above).

## Follow-ups

These are not this spec's blocking work, and they do not gate the merge. They are unboxed on purpose.

- FU1 — F1: give an unmeasured card on wide paper a safe fallback, for example the whole row instead of `--card-min`.
  Do not change a wide screen's ruler-less cards. Then adopt the frozen-script half of
  review-probes/INV-013-print-from-narrow-screen.probe.ts. A landscape print from a Firefox window narrower than 768
  would settle whether it is real.
- FU2 — F2: cap the printed symbol at its line only. Then the 375 member of
  review-probes/INV-012-print-chord-any-column.probe.ts can join the suite.
- FU3 — F3: bring the listed contract, plan and DECISIONS lines in line with the code.
- FU4 — F4: one own-width/greedy helper with one tie rule, and make `e2e/wide-print.spec.ts:58` assert something on a
  tie.
- FU5 — F5: adopt review-probes/INV-009-font-load-late.probe.ts into `e2e/cards-follow.spec.ts`, replacing the no-op
  trigger at line 61.
  - **Shown to fail:** this round ran it with `PROBES=1 MUTATION=no-ro`, which serves a hook that never observes. It
    failed 4 of 4 (`--own-head 380px stale against its head 372.9`). The control passed 4 of 4.
- FU6 — F6: make `e2e/wide-order.spec.ts:44-47` wait for a settled layout, as `settle` does (two frames after
  `document.fonts.ready`, and the `--own-*` values steady across two reads).
- FU7 — **out of scope:** `e2e/click-timing.spec.ts:192` (spec 005's "INV-022 500 rows landing mid-run") is flaky on
  `main`.
  - **The failure:** "Stopped because the click could not keep time": the main thread stalls past the 0.75s lookahead
    while 4008 columns re-render.
  - **The evidence:** review-probes/INV-009-click-timing-main-vs-branch.sh runs one test at one worker on clean exports
    of both trees. Interleaved, `main` passed 13 of 24 and the branch 8 of 16.
  - **The bisect:** proxy mutations of each branch change, and of all of them at once, never beat `main`'s rate. Nothing
    shows the branch makes it worse.
  - **The risk:** CI's one retry may not absorb it.
- FU8 — Carried from round 1:
  - `e2e/cards-rows.spec.ts:83`, `:85`, `:87` and `:92` allow 1.5px, where the plan says 0.5.
  - The `e2e/wide-order.spec.ts:71` last-row re-pin asserts less than DECISIONS records.
- FU9 — **out of scope** (carried): printing the song page below 768 printable px clips a long part at its scrolling
  staff. `src/components/app/SongView.tsx:471` is unchanged from `main`.
- FU10 — Carried: whether the ruler should count the empty part's `EmptyStaff` placeholder is a spec 010 question.
  `main` reads the same (`src/components/tab/TabStaff.tsx:556`).
- FU11 — T023's full e2e run is now in this review: 8 shards, 2632 passed, 514 skipped, 3 failed (noise or pre-existing,
  see Coverage). T001's baseline on the untouched branch is still unrecorded, so a person may tick or close both.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 23 | 21 | 2 (FR-019 script-less narrow print, F1 MINOR; FR-017 narrow paper, F2 MINOR) | 0 | 0 |
| Success criteria | 9 | 6 | 2 (SC-002 Deviation 3; SC-003 Deviation 7, both recorded) | 0 | 0; SC-009 not checked (human) |
| User stories (18 acceptance scenarios) | 5 | 1 (US4) | 4 (US1 AS2, Deviation 3; US2 AS1 on Linux, Deviation 7; US3 AS5, F1 MINOR; US5 AS1, F2 MINOR) | 0 | 0 |
| Plan invariants | 18 | 18 held over their enumerations | — | 0 | 0 violated |
| Round-3 findings re-checked | 1 blocking, 4 MINOR | F1 fixed (`npm test` 6296/6296; guard unedited) | 4 MINORs open (now F1–F4); F4's records partly fixed by T045 | 0 | 0 |
| Working-rule gates (the constitution is the unfilled template) | 10 | 9 | 0 | 0 | 0; "browser testing" owed to a person (T032) |

**Ran on Windows, on one build of the working tree:**
- **Unit tests:** `npm test`: 187 files, 6296 tests, all passed.
- **Static checks:** `tsc --noEmit` clean. ESLint is clean on every changed and new source and e2e file.
- **Guards:** `check:untouched-cards`, `check:cards-amendments`, `check:line-endings`, `check:untouched-wide` and
  `check:wide-amendments`: all ok.
- **Review probes:** all 13 earlier probes plus the new one, in desktop, mobile and firefox.
- **The feature's e2e specs:** `e2e/cards-*`: 319 passed and 32 skipped.
- **Earlier entries' specs:**
  - `e2e/wide-*`, `play-whole-song-outline` and the memo specs: 282 passed, 38 skipped, 1 failed. The failure is F6. Its
    test passed 8 of 8 alone and in 150 of 150 stress runs.
  - Every other spec that prints, plus `memo-recorder`: 308 passed, 43 skipped, 1 failed. `usability-reach` INV-026 on
    mobile, which is click-state text the branch does not touch, passed 4 of 4 on re-run.
- **The whole suite, every project, in 8 shards at 7 workers:** 2632 passed, 514 skipped, 3 failed.
  - `click-timing` INV-022 is FU7, out of scope.
  - `memo-endings` E7 and E8 on desktop passed 36 of 36 on re-run.
  - The `x` lines of `click-bar-fit` and `tempo-tap-pad-and-set` are `test.fail()` cases.
- **Mutation runs** (review-probes/INV-013-mutation-proxy.mjs):
  - T046 fails under `own-head-print`, and the control passes.
  - The late-font probe fails under `no-ro`, and the control passes.
  - The click-timing bisect is FU7.

**Ran in the Linux replica** (the tree synced into `spec007-linux-work` and rebuilt):
- `cards-print`, `wide-print` and `cards-rows`: 181 passed, 12 skipped.
- `INV-013-real-print-every-member`, `-print-remeasure`, `INV-009-font-load-late` and `-no-measure-while-reading`:
  19 passed.

## What I could not check

- **Firefox's and Safari's real print path.** F1 rests on a model of a print that runs no script. Playwright drives
  only Chromium's `page.pdf()`.
- **The interactive print dialog.** Chrome's and Firefox's print preview were not opened.
- **The browser check at actual size (SC-009, T032, INV-018).** It needs a person.
- **Firefox in the replica, iOS Safari, and real touch screens.** The touch pointer is the `mobile` project's emulation.
- **CI's own run.** GitHub's runners are slower than this machine, so FU7's flake may fail more often there.
- **F6's cause.** It did not reproduce, so the cause is inferred from the test's wait condition, not observed.
- **`npm run test:timing`, `check:untouched-playback` and `check:untouched-memos`.** CI runs the first. DECISIONS "013 —
  earlier entries' untouched guards" records that the other two name this branch's own files.
