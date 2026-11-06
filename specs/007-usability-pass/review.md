# Review: Usability pass

Reviewed 135 file(s): 80 tracked files changed against `main` and 55 untracked outside `specs/`, across 2 commit(s), against main...HEAD plus the uncommitted working tree (base `46760fd`). Only the two reader commits are on the branch, so this reviews the present working tree against `main`, not `main...HEAD` alone.
Round 4. Read in full: `plan.md`; `tasks.md` Phases 12 to 14; the previous `review.md`; `KeyboardHelp.tsx`; `useScreenKeys.ts`; `PlayView.tsx`'s diff against `main`; `parse.ts`'s diff against `main`; `spec004-holds.test.ts`. Sampled: `CaptureScreen.tsx` (lines 100 to 130 and the status row, 636 to 735); `Sheet` in `ui/index.tsx`; `shortcuts.ts` (`acceptsShortcut`); `e2e/usability-keys.spec.ts` lines 15 to 100; `e2e/variant-marks.spec.ts` (its helper, and the tests at lines 212 and 255); `spec.md` FR-026; `contracts/surfaces.md` on the status row; `research.md` R19; the audit's config and `summarise.mjs`. Not reviewed again by reading: everything else. Phase 14 changed one source file, `CaptureScreen.tsx`, and nothing under `src/` is newer than that edit, so the rest of the code is what round 3 read. It was still exercised, through every probe and the whole suite on a fresh build.

## Verdict

Ready to merge, subject to the person-level and real-phone checks already owed after merge (T108 to T114). There is no BLOCKER and no MAJOR. F39 is closed, and a refusal now keeps both jump buttons beside every symbol. Every probe in `review-probes/` was re-run and none regressed: the five failures are the five named exceptions. The whole e2e suite ran on all three projects with 2 failures in 2,654, and both are explained below. T181's open question is ruled: `variant-marks.spec.ts` has a test race, not a lost caption, because the caption arrived 400 times of 400 while 12 early reads saw nothing. That file and that render path are unchanged from `main`, so it is out of scope. I also crossed a refusal with a waiting digit, which no round had done. It looked like a repeat of F39 until I measured the row's real clip edge: `end ⇥` runs 3.9px into the row's padding and loses nothing, 128 of 128 states. That and three other small defects are MINORs in § Follow-ups, so `tasks.md` is unchanged.

## Invariants

Every probe in `review-probes/` was re-run first, on a fresh build at 6 workers: 516 passed, 5 failed, 367 skipped by project. All five failures are named exceptions: `INV-003 Guitar 7` height sweep (FU13), INV-038's 1400 columns at 600 and 794 (FU15), and the two `staff.md 6` caret probes (FU12). `INV-039 Space declined on load` (FU20) passed this time. No probe that held in round 3 fails now, and round 3's four F39 failures now pass.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | 3 tunings × 2 themes × 5 cursor states, 30 of 30 | review-probes/INV-001-002-003-004-031-capture-matrix.spec.ts |
| INV-002 | held | {Bass 4, Bass 5, Guitar 6} × 2 themes × 5 states, 30 of 30 | same file |
| INV-003 | held | 4 tunings × 2 heights × 3 states, 24 of 24, and 3 of 3 routes that take the column away with the form open. The band between 601 and 624px high stays MINOR F36 | review-probes/INV-003-chord-form-and-the-neck.spec.ts |
| INV-004 | held | 4 tunings × 2 heights, and the cursor over a note, rest, barline and the start | review-probes/INV-001-002-003-004-031-capture-matrix.spec.ts |
| INV-005 | held | 3 controls × 2 ends × 2 shapes, 12 of 12; sync arrival; sync arrival after a refused triplet; part change | review-probes/INV-005-new-group-in-view.spec.ts |
| INV-006 | held | 24 states of **Scr** × 2 sizes × 2 themes on touch, and 1280×800 × 2 themes on a mouse, plus capture at 4, 5, 6 strings and bands empty | review-probes/INV-006-010-018-every-screen.spec.ts, review-probes/INV-031-title-row-fully-loaded.spec.ts |
| INV-007 | held | stable; contextual with every member; selection with seven at numerals 2 and 16, at 375 | review-probes/INV-007-008-toolbars.spec.ts |
| INV-008 | held | 6 controls × 2 widths, 12 of 12 | same file |
| INV-009 | held | a cue on the song page and in a section, by Tab and Enter, × coarse, fine | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-010 | held | every visible field over **Scr** × 2 sizes × 2 themes on touch; viewport `meta`; `touch-action` on the three named controls | review-probes/INV-006-010-018-every-screen.spec.ts, e2e/usability-floors.spec.ts:14 |
| INV-011 | held | **Sz** × {paste with a refusal, paste ready, inspector chord}, stubbed keyboard. Owed to a phone as well | e2e/usability-reach.spec.ts |
| INV-012 | held | note, rest, repeat by the details button; a barline's one action on the stable row | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-013 | held | 6 screens × portrait and landscape insets | review-probes/INV-013-insets.spec.ts |
| INV-014 | held | **Ptr** × **W**, with `matchMedia` asserted first | e2e/usability-density.spec.ts on all three projects |
| INV-015 | held | `frets-unchanged.test.ts` passes; Copy text over every view and density; the guard's paths show zero diff | `npm test`, e2e/usability-staff.spec.ts:16, `npm run check:untouched-usability` |
| INV-016 | held | 5 symbols × 2 sizes × 2 **Ptr** on every surface, and the paste preview | review-probes/INV-016-017-038-staves.spec.ts, review-probes/INV-016-017-remaining-surfaces.spec.ts |
| INV-017 | held | **Rows** on every line, same matrix, and song page compact in notes and intervals × 2 sizes | those files, and review-probes/INV-017-compact-in-every-view.spec.ts |
| INV-018 | held | as INV-006, both themes | review-probes/INV-006-010-018-every-screen.spec.ts |
| INV-019 | held | Neck 4 of 4; numerals 2, 3, 16; bar numbers 1, 17, 128; all six marks; × 2 **Ptr** × 2 themes. Marks `1` and dotted do not exist, see FU14 | review-probes/INV-019-neck.spec.ts, review-probes/INV-019-numerals-marks-and-bars.spec.ts |
| INV-020 | held | {500×800, 1280×800} × {chord row, bar row, plain}, 6 of 6 | review-probes/INV-020-two-pointers.spec.ts |
| INV-021 | held | staff cell, chord row, numeral, mark, paste box, refused line, ignored line | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-022 | held | 6 symbols × 7 armed states × 3 positions × waiting or not, 30 reachable per symbol, 180 of 180. With a refusal, 6 of 6, so F39 is closed. Newly run, the cross no round had made: a refusal with a digit waiting, 8 symbols × 4 armed states × 2 positions × 2 digits, 128 of 128: words whole, both buttons seen at 44px or more and taking a tap at both edges. Unknown symbols run 3.9px into the padding, see F46 | review-probes/INV-022-every-long-symbol-state.spec.ts, review-probes/INV-022-refusal-with-a-waiting-digit.spec.ts |
| INV-023 | held | 120 characters on bands, band's songs, song page, play view and capture × **Sz**, and the form's hint | review-probes/INV-009-012-021-023-025-surfaces.spec.ts, review-probes/INV-031-title-row-fully-loaded.spec.ts |
| INV-024 | held | **St** × 3 panels; 50 toggles, reload, second tab | src/lib/reading/__tests__/panels.test.ts, e2e/usability-reach.spec.ts |
| INV-025 | held | top, middle, end × **Sz** × touch, mouse; one part, many parts; print; an empty song | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-026 | held | 7 states × {collapsed, open} × **Sz**, 14 of 14, idle ≤60, and `fell behind` by a real stall × 2 sizes × {collapsed, open} | review-probes/INV-026-cluster-states.spec.ts, review-probes/INV-026-fell-behind-by-a-real-stall.spec.ts |
| INV-027 | held | 108 of 108 joined, 8 offset, against an extraction of `main` in this session | review-probes/reader/compare.mjs, src/lib/reading/__tests__/reader-vs-main.test.ts |
| INV-028 | held | 204 of 204, same run | same files |
| INV-029 | held | 72 advice cases and 12 kept codes, same run | same files |
| INV-030 | held | every `src/lib/tab/__tests__/` file passes. Spec 004's probes: 2,561 passed and exactly the 19 listed failures, in the 5 listed files. F75's measure is 39 of 202. `npm run test:spec004` was green 4 runs of 5, see F49 | `npm test`, `npm run test:spec004`, specs/004-ascii-import/review-probes/vitest.probes.config.mts |
| INV-031 | held | **Cap** with a short title, and 3 titles × 2 tempos × {1, 12} parts × {6, 136} unsynced × {375, 390}, 48 of 48, and a 120-character title with twelve parts on a mouse at 500, 820 and 1280 | review-probes/INV-031-title-row-fully-loaded.spec.ts. The mouse half has no copy in the suite, see F48 |
| INV-032 | held | 11 **Arr** and 5 **Bars** shapes, hand lists | review-probes/INV-032-033-034-bars-sections.spec.ts |
| INV-033 | held | 11 **Arr**, hand lists of section words | same file |
| INV-034 | held | 13 shapes × play view and song page | same file |
| INV-035 | held | count-in, two passes, barline, repeat, tuplet, timed-to-plain, follow off, tempo mid-run, 6 endings, untimed part; 13 of 13, within 50ms | review-probes/INV-035-highlight-timing.spec.ts |
| INV-036 | held | baseline deep-equal, `playhead()` read-only, `engine-seams`, `tables`, `click-timing`, `click-running` | `npm test`, e2e click specs |
| INV-037 | held | 6 size × pointer runs; {wheel, touch swipe, scroll key} × {page, a wide bar's own scroller}; a column removed mid-run; reduced motion; resuming | review-probes/INV-037-highlight-stays-on-screen.spec.ts, e2e/usability-highlight.spec.ts |
| INV-038 | held | 9 **Bars** × 3 **V** × {375, 820, 1280} × 2 **Ptr** on screen; print emulation at 600 and 794 over 6 shapes up to 900 columns. Newly run: a variant's caption on the play view arrives however early it is read, 400 of 400. Past the plan's set, FU15 and FU16 stand | review-probes/INV-016-017-038-staves.spec.ts, review-probes/INV-038-print-lines.spec.ts, review-probes/INV-038-print-every-row-and-long-bars.spec.ts, review-probes/INV-038-page-break-in-a-long-staff.spec.ts, review-probes/INV-038-variant-line-arrives.spec.ts |
| INV-039 | held | 15 keys × 10 fields, 2 selects, the inspector's chord and a `contenteditable`; 15 keys × 5 modifier forms × 3 screens; a sheet open; keys on a focused control; keys off their screens | review-probes/INV-039-every-input.spec.ts |
| INV-040 | held | Digits 21 of 21; jump keys 18 of 18; Left, Right, `,`, `.` and `x` against their taps × 7 armed states, 35 of 35; every help row run on each screen, 21 of 21. Newly measured, past the set the plan names: a `?` less than about 20ms after the help closed can be lost, see F47 | review-probes/INV-040-capture-keys.spec.ts, review-probes/INV-040-jump-keys-against-buttons.spec.ts, review-probes/INV-040-041-every-key-against-its-tap.spec.ts, review-probes/INV-040-every-help-row-runs.spec.ts, review-probes/INV-040-help-closes-then-opens.spec.ts |
| INV-041 | held | The listed set, F1's sequences, part changes with 3 to 24 queued, and the jump keys in the queue at 0, 10 and 150ms | review-probes/INV-041-typing-keeps-order.spec.ts, review-probes/INV-041-part-change-with-a-long-queue.spec.ts, review-probes/INV-040-041-every-key-against-its-tap.spec.ts |
| INV-042 | not checked | a person at actual size, owed after merge (T114) | a person-level pass |
| INV-043 | held | T108 to T114 present, open and marked `🛑 BLOCKED` | specs/007-usability-pass/tasks.md:311 |
| INV-044 | held | `src/` and `e2e/` fixtures | src/lib/reading/__tests__/no-other-product.test.ts |
| INV-045 | held | `npm run check:usability-amendments` passes | scripts/check-usability-amendments.sh |
| INV-046 | held | `npm run check:usability-audit` passes, A1 to A33. The walk was re-run on this build, 28 of 28, and `summarise.mjs` gives all 420 lines of `after.txt` unchanged, so FU17 is closed | scripts/check-usability-audit.sh, specs/007-usability-pass/audit/walk.audit.ts |

## Findings

- [ ] MINOR F46 — During a refusal with a digit waiting, an unknown symbol pushes `end ⇥` 3.9px into the row's padding
      where:  src/components/capture/CaptureScreen.tsx:688, src/components/capture/CaptureScreen.tsx:696, src/components/capture/CaptureScreen.tsx:115
      why:    T175 gave both branches the same fit for the symbol, but the span beside it still differs. The known branch drops its tones during a refusal, and the unknown branch keeps `not a chord I know`, so it has one more flex item. 3.9px matches one flex gap, though I did not try removing it. It needs an unknown symbol of any length, a refusal, a digit waiting for up to 600ms, and a window near 375. Nothing is lost, because `overflow: hidden` clips at the padding box: over 128 states the button is seen whole and takes a tap at both edges. So INV-022 holds. The two rules are also two inline ternaries, not the one rule T175 named, and `symbolFit`'s comment sits above `WIDE_ROW`.
      owed:   Drop the second span during a refusal, as the known branch does, with the choice made in one place. Not tried.
      traces: FR-026, INV-022, Deviation 3

- [ ] MINOR F47 — A `?` pressed less than about 20ms after the help closed can leave it closed
      where:  src/components/ui/index.tsx:194, src/components/ui/index.tsx:187, e2e/usability-keys.spec.ts:67
      why:    `Sheet` drops its children on commit, closes the dialog in an effect, and the `close` event comes later still. A `?` landing before that event reopens the dialog, and then the old event's `onClose` sets `open` to false. The page's log shows the order: key at 32.2ms, close event at 35.4ms. Lost under 16 workers: 48 of 180 at 0ms, 1 of 180 at 5ms, and 0 of 180 at each of 20, 50, 100 and 200ms. No person presses twice that fast, so this is not a product defect in use. It is what failed `usability-keys.spec.ts:47` this round, and what T172 called a load flake on both projects. Its set in the plan names no timing, so I read INV-040 as held. That is the call to overturn if you read it more strictly.
      owed:   Ignore a `close` event while the dialog is open again, for example `if (!e.currentTarget.open) onClose()`. Not tried.
      traces: INV-040

- [ ] MINOR F48 — T176 is ticked, but the mouse half of its probe never reached the suite
      where:  specs/007-usability-pass/tasks.md:441, e2e/capture-matrix.spec.ts:12, specs/007-usability-pass/review-probes/INV-031-title-row-fully-loaded.spec.ts:92
      why:    `FR-001 on a mouse at ${width}`, three tests, is not in `e2e/`. `capture-matrix.spec.ts` skips every non-mobile test at file level, so those tests could not run there. The probe still passes, so the behaviour holds, but a later change to the title row on a mouse has no test in the suite. The other five probes of Phase 14 are adopted, by title.
      owed:   Add the three tests to a spec that runs on `desktop`.
      traces: INV-031, FR-001

- [ ] MINOR F49 — `npm run test:spec004` can go red on a timing shape the quickstart says may fail
      where:  src/lib/reading/__tests__/spec004-holds.test.ts:44, specs/007-usability-pass/quickstart.md:70
      why:    The quickstart allows the whole timing probe to fail under load, and the test exempts one of its five shapes. `many wrapped runs on one line` failed 1 run of 5, the first, straight after an e2e slice. The other four were green, and the probe file alone passed 6 of 6. It compares about 3ms with about 11ms, so one pause trips the ratio. Its timings show no slowdown, 11 to 22ms for 5,000 runs. T172 recorded a `spec004-holds` failure too, without naming the shape.
      owed:   Exempt every shape of `INV-030 a line of many runs stays linear`, not one.
      traces: INV-030

### Earlier findings, rechecked

| Finding | Now |
|---|---|
| F39 MAJOR | Closed. A refusal beside each of 6 symbols keeps both buttons. Its neighbour, which cuts nothing, is F46 |
| T181's open question | Ruled: a test race, out of scope, FU27. `variant-marks.spec.ts:255` reads the caption once, straight after `tab-staff` is visible, and a staff is drawn before the song's content arrives. Same early read, then a wait: 12 of 400 read nothing, and 400 of 400 got the right text. The real test failed 4 of 150 at 16 workers, each with T181's exact message. `variant-marks.spec.ts:212` failed once in this round's suite in the same way: one early null, then later lines present |
| FU17 | Closed, see INV-046 |
| F12, F13, F15 to F19, F24 to F27, F35, F36, F38, F40 to F45 | Still open, not gating, see § Follow-ups |

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose. Numbers carry over from round 3, because `tasks.md` cites them.

- FU1 — MINOR F12, `looksJoined` tests for the letter `s`, src/lib/tab/parse.ts:586
- FU2 — MINOR F13, a ruling on FR-014's axis, e2e/usability-floors.spec.ts:189
- FU3 — MINOR F15, two functions named `barStarts`, src/lib/reading/bars.ts:25, src/lib/reading/staff.ts:54
- FU4 — MINOR F16, `src/lib/keys/` imports a component, src/lib/keys/fretEntry.ts:1
- FU5 — MINOR F17, `--title-row` unused, so a mouse gets 45px, src/components/capture/CaptureScreen.tsx:550
- FU6 — MINOR F18, `visits.opens` is never read, src/lib/arrangement/expand.ts:129
- FU7 — MINOR F19, the neck's comment quotes old contrast figures, src/components/capture/Fretboard.tsx:46
- FU8 — MINOR F24, sticky bars read `env()` directly, src/components/rhythm/ClickBar.tsx:102, src/components/app/SongView.tsx:275
- FU9 — MINOR F25, single-glyph controls pass by the label clause, src/components/arrangement/ArrangementEditor.tsx:197
- FU10 — MINOR F26, ticked probes that claimed more than they checked, e2e/usability-highlight.spec.ts:48
- FU11 — NOTE F27, plan.md's offset clause in INV-027, specs/007-usability-pass/plan.md:172
- FU12 — MINOR F35, the caret and a selection's head can walk off the strip by keyboard, src/components/capture/CaptureScreen.tsx:622. Its two probes in review-probes/staff-section-6-caret-beyond-the-keys.spec.ts fail by design until then, so they are not adopted
- FU13 — MINOR F36, seven strings with the form open get a thin band between 601 and 624px high, src/components/capture/CaptureScreen.tsx:1075. Its height sweep in review-probes/INV-003-chord-form-and-the-neck.spec.ts stays in the probes for the same reason
- FU14 — NOTE F38, INV-019 names marks that do not exist, specs/007-usability-pass/plan.md:164
- FU15 — MINOR F40, too few spare gutter blocks for a very long bar and too many for an ordinary song, src/components/tab/TabStaff.tsx:357. review-probes/INV-038-print-every-row-and-long-bars.spec.ts fails on its 1400-column shape by design until then, and review-probes/INV-038-what-the-spare-blocks-cost.spec.ts is a measure with no assertion, so neither is adopted
- FU16 — MINOR F41, a pass taller than a page tears a line, and past two pages the labels sit half a string off, src/app/globals.css:514. review-probes/INV-038-page-break-in-a-long-staff.spec.ts and review-probes/pdf-lines.mjs read real PDFs by hand, so they stay in the probes
- FU18 — out of scope: `durations.spec.ts` reads every mark straight after waiting on the first one. The file is unchanged on this branch, e2e/durations.spec.ts:33
- FU19 — MINOR F42, while a digit waits, words go short by window width, not by what the row needs, src/components/capture/CaptureScreen.tsx:116
- FU20 — MINOR F43, for a few milliseconds after the click becomes ready, Space does nothing, src/components/keys/useScreenKeys.ts:24. review-probes/INV-039-space-declined-on-load.spec.ts fails under load by design until then, so it is not adopted
- FU21 — NOTE F44, a pass that does not fit page 1 moves whole to page 2, src/app/globals.css:514
- FU22 — MINOR F45, `usability-bars-sections.spec.ts` reads the beats figure before the events arrive, e2e/usability-bars-sections.spec.ts:145. The repaired probe is the fix to copy
- FU23 — MINOR F46, src/components/capture/CaptureScreen.tsx:688. Adopt review-probes/INV-022-refusal-with-a-waiting-digit.spec.ts into e2e/usability-status-row.spec.ts
- FU24 — MINOR F47, src/components/ui/index.tsx:194. review-probes/INV-040-help-closes-then-opens.spec.ts prints the losses at 0 and 5ms and asserts only from 50ms up. Adopt it with the fix, asserting every delay
- FU25 — MINOR F48, adopt the three mouse tests of review-probes/INV-031-title-row-fully-loaded.spec.ts:92
- FU26 — MINOR F49, src/lib/reading/__tests__/spec004-holds.test.ts:44
- FU27 — out of scope: `variant-marks.spec.ts` reads the caption once, before the song's content has arrived, e2e/variant-marks.spec.ts:232, e2e/variant-marks.spec.ts:277. The file has no diff against `main`, and `{marks ? <VariantLine ... /> : null}` and `comparisons` are unchanged in src/components/app/PlayView.tsx. Wait for `variant-line` before the read. review-probes/INV-038-variant-line-arrives.spec.ts is a measure for this ruling, and has nothing to adopt
- FU28 — out of scope: `test.setTimeout(120_000)` sits inside a comment on `main` too, so these two files run at the default timeout, e2e/variant-marks.spec.ts:4, e2e/reading-layout.spec.ts:10

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 66 | 66 | 0 | 0 | 0 |
| Success criteria | 17 | 17 | 0 | 0 | 0 |
| Constitution principles | 14 | 13 | 1 | 0 | 0 |

`.specify/memory/constitution.md` is still the unfilled template, so the third row counts the 14 gates of plan.md § Constitution Check. The partial gate is browser testing, owed by T114.

Run on this working tree, on a fresh build: typecheck clean, with this round's probes; lint 0 errors, 9 warnings; `npm test` 146 files, 6,139 tests passed; `check:untouched-usability`, `check:usability-amendments` and `check:usability-audit` pass. Line endings match `main`: `git diff main --stat` and the same with `--ignore-space-at-eol` agree, at 80 files. No scratch files at the repo root.

The whole e2e suite, all 98 specs, in four slices through `review-probes/playwright.suite.config.ts` on all three projects at 6 workers: 2,652 passed, 2 failed, 724 skipped by project. The failures are `variant-marks.spec.ts:212` on mobile (FU27) and `usability-keys.spec.ts:47` on desktop (F47). Spec 006's sync flake, `durations.spec.ts` and `usability-bars-sections.spec.ts:145` did not fail this run.

T174 and T177 said to keep each probe's timeout, and the adopted files run lower: 240s against 280s, and 150s against 200s. The longest of those sweeps took 10.6s, so this costs nothing.

## What I could not check

- **Anything on a real phone.** T108 to T113 stay open and marked. The on-screen keyboard is stubbed and insets are emulated, so INV-011 and INV-013 are held in emulation only.
- **INV-042, legibility at actual size.** Needs a person, T114. No screenshot was reviewed this round.
- **Printed pages by eye.** No PDF renderer is installed here. FU16's figures come from text positions in Chromium's PDFs. A5, Letter, landscape and a real printer were not tried.
- **Other browsers.** Everything ran in Chromium. F47 depends on when the `close` event fires, and F46 on where `overflow: hidden` clips, so their timing and figures are Chromium's. Safari's handling of `max-width: max-content` on the back button, and of the print rules, is unread.
- **`variant-marks`' rate on `main`.** I did not build `main`, so "out of scope" rests on the file having no diff and the render path being unchanged, not on a measured rate. This branch's extra work per render could have made the race a little more likely. That would not change the ruling, because the caption always arrives.
- **The fixes for F46, F47 and F49 were not tried.** The cause given for F46's 3.9px is arithmetic.
- **Timing depends on load.** The e2e suite ran once, at 6 workers. F47's rates are from 16 workers, and F45 showed that a test race can stay hidden at lower load, so a clean slice does not prove there are no others like it.
- **Corrections to earlier work, so they are not read as app results.** My first refusal-and-digit probe reported `end ⇥ clipped by 3.9px`, which would have reopened INV-022. It read the row's content edge, as round 3's probe does, and the row clips at its padding box, 12px further out. By the same arithmetic, which I did not measure, round 3's F39 figures overstated what was cut by 12px, so 6.6px cut nothing and 20px cut 8px. F39 was still a real cut from 9 characters, and the fix stands. The adopted test keeps the stricter edge, which does no harm. The audit re-run wrote into `audit/results/`, so I backed that folder up and restored it, and checked the audit folder byte for byte against a hash taken first. The first comparison showed no change in `after.txt`, so I re-ran to confirm the walk really writes: 92 of 112 files were rewritten and 32 differ in bytes, in fields `summarise.mjs` does not print.
