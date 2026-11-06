# Review: Usability pass

Reviewed 208 file(s) changed across 3 commit(s), against main...HEAD plus the uncommitted working tree (base `46760fd`). T183, Phase 15's CI fix, is in the working tree only, not in a commit.
Round 5. Read in full: `tasks.md` Phases 14 and 15; the previous `review.md`; the whole uncommitted diff (`globals.css`, `DECISIONS.md`, `contracts/surfaces.md`); CI's failure log for PR #7; `Panel` in `ui/index.tsx`; `useClick.ts` and `scheduler.ts`'s diffs against `main`; `applyPush` in `src/lib/server/sync.ts`. Sampled: `panels.ts`; `SongView.tsx` (the panel and the loading branch); `e2e/reading-sync.spec.ts` (lines 1 to 66 and 120 to 146); `e2e/click-running.spec.ts` lines 1 to 80; `e2e/usability-staff.spec.ts:110`; `e2e/usability-staves.spec.ts:150`, `:295`; `e2e/usability-bars-sections.spec.ts:135`; `.github/workflows/ci.yml`; `playwright.config.ts`. Not reviewed again by reading: everything else. Round 4's tree is commit `46a6757`, and only `src/app/globals.css` under `src/` or `e2e/` is newer than round 4's `review.md`, so the rest of the code is what round 4 read. It was still exercised, through every probe and the suite on a fresh build.

## Verdict

Ready to merge once T183 is pushed and CI goes green, subject to the person-level and real-phone checks already owed after merge (T108 to T114). There is no BLOCKER and no MAJOR, so `tasks.md` is unchanged. T183 fixes CI's 14 failures, and this is measured on Linux, not inferred. No local run could see the defect, so I built a replica of CI in Docker (Linux Chrome, a throwaway Postgres set up as `ci.yml` sets it up). With the old `--chord-ch` the replica fails the same 14 tests CI failed. With T183 all of them pass. The whole suite then ran there for the first time: 2,653 passed and 2 failed, and neither failure comes from T183. Every saved probe also ran on Linux for the first time, and none showed a failure Windows does not, so the rounded glyphs hide no other defect in the sets they cover. CI's two flaky tests were flaky in `main`'s last CI run too, the same two tests on the same projects, so they are out of scope. One of them explained a real gap, which is F50: `reading-sync.spec.ts:35` cannot pass on this branch even if its old race is fixed. That is a MINOR, because the same assertion runs and passes elsewhere. The same trail led to something Jamie should see, out of scope here: two accounts on one server cannot both have a band of the same name (FU31).

## Invariants

Every probe in `review-probes/` was re-run first, on a fresh build at 6 workers: 531 passed, 5 failed, 382 skipped by project. All five failures are named exceptions: `INV-003 Guitar 7` height sweep (FU13), INV-038's 1400 columns at 600 and 794 (FU15), and the two `staff.md 6` caret probes (FU12). No probe that held in round 4 fails now. The same set then ran on Linux Chrome at 8 workers: 532 passed, 4 failed, 382 skipped, the same exceptions less one, because 1400 columns at 794 passes there.

"Both platforms" below means the row's probes passed on Windows and on Linux, apart from those exceptions.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | 3 tunings × 2 themes × 5 cursor states, 30 of 30, both platforms | review-probes/INV-001-002-003-004-031-capture-matrix.spec.ts |
| INV-002 | held | {Bass 4, Bass 5, Guitar 6} × 2 themes × 5 states, 30 of 30, both platforms | same file |
| INV-003 | held | 4 tunings × 2 heights × 3 states, 24 of 24, and 3 of 3 routes that take the column away with the form open, both platforms. The band between 601 and 624px high stays MINOR F36 | review-probes/INV-003-chord-form-and-the-neck.spec.ts |
| INV-004 | held | 4 tunings × 2 heights, and the cursor over a note, rest, barline and the start, both platforms | review-probes/INV-001-002-003-004-031-capture-matrix.spec.ts |
| INV-005 | held | 3 controls × 2 ends × 2 shapes, 12 of 12; sync arrival; sync arrival after a refused triplet; part change; both platforms | review-probes/INV-005-new-group-in-view.spec.ts |
| INV-006 | held | 24 states of **Scr** × 2 sizes × 2 themes on touch, and 1280×800 × 2 themes on a mouse, plus capture at 4, 5, 6 strings and bands empty, both platforms | review-probes/INV-006-010-018-every-screen.spec.ts, review-probes/INV-031-title-row-fully-loaded.spec.ts |
| INV-007 | held | stable; contextual with every member; selection with seven at numerals 2 and 16, at 375, both platforms | review-probes/INV-007-008-toolbars.spec.ts |
| INV-008 | held | 6 controls × 2 widths, 12 of 12, both platforms | same file |
| INV-009 | held | a cue on the song page and in a section, by Tab and Enter, × coarse, fine, both platforms | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-010 | held | every visible field over **Scr** × 2 sizes × 2 themes on touch; viewport `meta`; `touch-action` on the three named controls; both platforms | review-probes/INV-006-010-018-every-screen.spec.ts, e2e/usability-floors.spec.ts:14 |
| INV-011 | held | **Sz** × {paste with a refusal, paste ready, inspector chord}, stubbed keyboard, both platforms. Owed to a phone as well | e2e/usability-reach.spec.ts |
| INV-012 | held | note, rest, repeat by the details button; a barline's one action on the stable row; both platforms | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-013 | held | 6 screens × portrait and landscape insets, both platforms | review-probes/INV-013-insets.spec.ts |
| INV-014 | held | **Ptr** × **W**, with `matchMedia` asserted first, on all three projects, both platforms | e2e/usability-density.spec.ts |
| INV-015 | held | `frets-unchanged.test.ts` passes; Copy text over every view and density; the guard's paths show zero diff | `npm test`, e2e/usability-staff.spec.ts:16, `npm run check:untouched-usability` |
| INV-016 | held | 5 symbols × 7 shapes × 2 **Ptr** on every surface, and the paste preview, both platforms. This is the invariant T183 repairs: on Linux, `.42rem` fails 14 tests with gaps of 0.9px and -5px, and `.4375rem` passes all 116 tests of that slice | review-probes/INV-016-017-038-staves.spec.ts, review-probes/INV-016-017-remaining-surfaces.spec.ts, review-probes/INV-016-linux-chrome.sh |
| INV-017 | held | **Rows** on every line, same matrix, and song page compact in notes and intervals × 2 sizes, both platforms | those files, and review-probes/INV-017-compact-in-every-view.spec.ts |
| INV-018 | held | as INV-006, both themes, both platforms | review-probes/INV-006-010-018-every-screen.spec.ts |
| INV-019 | held | Neck 4 of 4; numerals 2, 3, 16; bar numbers 1, 17, 128; all six marks; × 2 **Ptr** × 2 themes; both platforms. Marks `1` and dotted do not exist, see FU14 | review-probes/INV-019-neck.spec.ts, review-probes/INV-019-numerals-marks-and-bars.spec.ts |
| INV-020 | held | {500×800, 1280×800} × {chord row, bar row, plain}, 6 of 6, both platforms | review-probes/INV-020-two-pointers.spec.ts |
| INV-021 | held | staff cell, chord row, numeral, mark, paste box, refused line, ignored line, both platforms | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-022 | held | 6 symbols × 7 armed states × 3 positions × waiting or not, 30 reachable per symbol, 180 of 180; with a refusal, 6 of 6; a refusal with a digit waiting, 128 of 128; both platforms. Whole-pixel glyphs move none of these past a limit | review-probes/INV-022-every-long-symbol-state.spec.ts, review-probes/INV-022-refusal-with-a-waiting-digit.spec.ts, review-probes/INV-022-status-every-combination.spec.ts, review-probes/INV-022-long-symbols-and-waiting-words.spec.ts |
| INV-023 | held | 120 characters on bands, band's songs, song page, play view and capture × **Sz**, and the form's hint, both platforms | review-probes/INV-009-012-021-023-025-surfaces.spec.ts, review-probes/INV-031-title-row-fully-loaded.spec.ts |
| INV-024 | held | **St** × 3 panels; 50 toggles, reload, second tab | src/lib/reading/__tests__/panels.test.ts, e2e/usability-reach.spec.ts |
| INV-025 | held | top, middle, end × **Sz** × touch, mouse; one part, many parts; print; an empty song; both platforms | review-probes/INV-009-012-021-023-025-surfaces.spec.ts |
| INV-026 | held | 7 states × {collapsed, open} × **Sz**, 14 of 14, idle ≤60, and `fell behind` by a real stall × 2 sizes × {collapsed, open}, both platforms | review-probes/INV-026-cluster-states.spec.ts, review-probes/INV-026-fell-behind-by-a-real-stall.spec.ts |
| INV-027 | held | 108 of 108 joined, 8 offset, against an extraction of `main` in this session | review-probes/reader/compare.mjs, src/lib/reading/__tests__/reader-vs-main.test.ts |
| INV-028 | held | 204 of 204, same run | same files |
| INV-029 | held | 72 advice cases and 12 kept codes, same run | same files |
| INV-030 | held | every `src/lib/tab/__tests__/` file passes; `npm run test:spec004` 1 of 1. Spec 004's probes, second run: 2,561 passed and exactly the 19 listed failures, compared by name. The first run added a 20th, a timing ratio by 1.4ms, which passed 2 of 2 alone, see FU26 | `npm test`, `npm run test:spec004`, specs/004-ascii-import/review-probes/vitest.probes.config.mts |
| INV-031 | held | **Cap** with a short title, and 3 titles × 2 tempos × {1, 12} parts × {6, 136} unsynced × {375, 390}, 48 of 48, and a 120-character title with twelve parts on a mouse at 500, 820 and 1280, both platforms | review-probes/INV-031-title-row-fully-loaded.spec.ts, review-probes/INV-031-title-beside-chips.spec.ts. The mouse half has no copy in the suite, FU25 |
| INV-032 | held | 11 **Arr** and 5 **Bars** shapes, hand lists, both platforms | review-probes/INV-032-033-034-bars-sections.spec.ts |
| INV-033 | held | 11 **Arr**, hand lists of section words, both platforms | same file |
| INV-034 | held | 13 shapes × play view and song page, both platforms. The e2e copy of this reads too early, see FU22. The product holds, because the probe waits and passes | same file |
| INV-035 | held | count-in, two passes, barline, repeat, tuplet, timed-to-plain, follow off, tempo mid-run, 6 endings, untimed part; 13 of 13, within 50ms; both platforms | review-probes/INV-035-highlight-timing.spec.ts |
| INV-036 | held | baseline deep-equal, `playhead()` read-only, `engine-seams`, `tables`, `click-timing`, `click-running`. `click-running.spec.ts:62`, flaky in CI, passed 40 of 40 on Linux, see FU32 | `npm test`, e2e click specs |
| INV-037 | held | 6 size × pointer runs; {wheel, touch swipe, scroll key} × {page, a wide bar's own scroller}; a column removed mid-run; reduced motion; resuming; both platforms | review-probes/INV-037-highlight-stays-on-screen.spec.ts, e2e/usability-highlight.spec.ts |
| INV-038 | held | 9 **Bars** × 3 **V** × {375, 820, 1280} × 2 **Ptr** on screen; print emulation at 600 and 794 over 6 shapes up to 900 columns; both platforms. Past the plan's set, FU15 and FU16 stand | review-probes/INV-016-017-038-staves.spec.ts, review-probes/INV-038-print-lines.spec.ts, review-probes/INV-038-print-every-row-and-long-bars.spec.ts, review-probes/INV-038-page-break-in-a-long-staff.spec.ts, review-probes/INV-038-variant-line-arrives.spec.ts |
| INV-039 | held | 15 keys × 10 fields, 2 selects, the inspector's chord and a `contenteditable`; 15 keys × 5 modifier forms × 3 screens; a sheet open; keys on a focused control; keys off their screens; both platforms | review-probes/INV-039-every-input.spec.ts |
| INV-040 | held | Digits 21 of 21; jump keys 18 of 18; Left, Right, `,`, `.` and `x` against their taps × 7 armed states, 35 of 35; every help row run on each screen, 21 of 21; both platforms. FU24 stands | review-probes/INV-040-capture-keys.spec.ts, review-probes/INV-040-jump-keys-against-buttons.spec.ts, review-probes/INV-040-041-every-key-against-its-tap.spec.ts, review-probes/INV-040-every-help-row-runs.spec.ts, review-probes/INV-040-help-closes-then-opens.spec.ts |
| INV-041 | held | The listed set, F1's sequences, part changes with 3 to 24 queued, and the jump keys in the queue at 0, 10 and 150ms, both platforms | review-probes/INV-041-typing-keeps-order.spec.ts, review-probes/INV-041-part-change-with-a-long-queue.spec.ts, review-probes/INV-040-041-every-key-against-its-tap.spec.ts |
| INV-042 | not checked | a person at actual size, owed after merge (T114) | a person-level pass |
| INV-043 | held | T108 to T114 present, open and marked `🛑 BLOCKED`, 7 of 7 | specs/007-usability-pass/tasks.md:311 |
| INV-044 | held | `src/` and `e2e/` fixtures | src/lib/reading/__tests__/no-other-product.test.ts |
| INV-045 | held | `npm run check:usability-amendments` passes. T183's `--chord-ch` row is amended in `contracts/surfaces.md:24`, recorded at `docs/DECISIONS.md:363`, and no other document gives the old value as current | scripts/check-usability-amendments.sh |
| INV-046 | held | `npm run check:usability-audit` passes, A1 to A33. The walk was re-run on this build, 28 of 28: 414 of `after.txt`'s 420 lines unchanged, 6 staff widths 1 to 2px wider, see F51 | scripts/check-usability-audit.sh, specs/007-usability-pass/audit/walk.audit.ts |

## Findings

- [ ] MINOR F50 — `reading-sync.spec.ts:35` cannot pass on this branch, and two older defects hide that
      where:  e2e/reading-sync.spec.ts:64, e2e/reading-sync.spec.ts:62, e2e/reading-sync.spec.ts:51, src/components/app/SongView.tsx:184, src/components/app/SongView.tsx:106
      why:    This branch moved `ViewControl` into the Song tools panel, which is closed on a new device. Line 64 waits for `staff-view` to be visible on a new device and never opens the panel, unlike the rest of the file, which gained `openTools`. Nobody saw this, for two reasons, neither of them this branch's. Line 62 clicks Sign in and line 63 navigates at once, which cancels the sign-in, so the page stays on `Sign in` and `Loading…`: read at 1, 5 and 15s, and it fails at line 64 with `element(s) not found`, 2 of 2 on an empty database. And on a database that already holds a band called Hollow Crown, the outbox cannot drain (FU31), so the test skips at line 51: 20 of 20. That fits CI calling it flaky: the first attempt fails, and the retry finds the band already there and skips. CI's log does not show the retry, so that part is inferred. Fix only the race and the test fails every time, on `staff-view` being hidden. The behaviour itself holds: a device signed in properly gets the song, and with the panel open `frets` is pressed. `reading-sync.spec.ts:127` asserts the same thing through `twoDevices`, which signs in properly and uses a band name of its own, so that is why this is not a MAJOR.
      owed:   Wait for the sign-in to leave the page, then `await openTools(second)` before line 64. Tried in review-probes/F50-second-device-opens-a-song.spec.ts, which passes.
      traces: spec 006 INV-003, FR-064

- [ ] MINOR F51 — T183 left `audit/after.txt` 1 to 2px behind on six staff widths
      where:  specs/007-usability-pass/audit/after.txt:6, specs/007-usability-pass/audit/after.txt:14, specs/007-usability-pass/audit/after.txt:175
      why:    Chord columns grew with `--chord-ch`, so `summarise.mjs` now prints `288/327` where the file says `288/325`, on 6 of 420 lines. Those are the only differences. No document quotes those figures, no A-number depends on them, and `check:usability-audit` passes.
      owed:   Regenerate the file as quickstart.md §8 says.
      traces: INV-046

Round 4's F46 to F49 are open and unchanged, in § Follow-ups as FU23 to FU26.

### Earlier findings, rechecked

| Finding | Now |
|---|---|
| T183's cause | Confirmed, with a control. Old value on Linux: 14 failed, the same 14 names as CI, compared by name, with CI's shortfall of 4.96px, and 102 passed. New value: 116 passed. 32 × 7 + 4 = 228 reserves more than the 224 drawn |
| F45 (FU22) | Still open, and it did fail on Linux: once in the suite, then 4 of 260 at `usability-bars-sections.spec.ts:141`, each `Received: null`. It did not fail in PR #7's CI run, and CI's one retry should absorb it, so it does not gate |
| T181's reading of sync failures as FU19 | Not for `reading-sync.spec.ts:35`. That one is F50's sign-in race, not a lost row |
| F12, F13, F15 to F19, F24 to F27, F35, F36, F38, F40 to F49 | Still open, not gating, see § Follow-ups. T183 changed no code they cite |

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose. Numbers carry over from round 4, because `tasks.md` cites them.

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
- FU22 — MINOR F45, `usability-bars-sections.spec.ts` reads the beats figure before the events arrive, e2e/usability-bars-sections.spec.ts:145. The repaired probe is the fix to copy. On Linux at 8 workers it fails 4 of 260
- FU23 — MINOR F46, src/components/capture/CaptureScreen.tsx:688. Adopt review-probes/INV-022-refusal-with-a-waiting-digit.spec.ts into e2e/usability-status-row.spec.ts
- FU24 — MINOR F47, src/components/ui/index.tsx:194. review-probes/INV-040-help-closes-then-opens.spec.ts prints the losses at 0 and 5ms and asserts only from 50ms up. Adopt it with the fix, asserting every delay
- FU25 — MINOR F48, adopt the three mouse tests of review-probes/INV-031-title-row-fully-loaded.spec.ts:92
- FU26 — MINOR F49, src/lib/reading/__tests__/spec004-holds.test.ts:44. This round the same ratio tripped on a shape in specs/004-ascii-import/review-probes/INV-014-030-wrapped-cells-only-s6-claims.test.ts:74, `many runs only the notation test asks about`, at 101.77 against 100.41, then passed 2 of 2 alone. It is not one of the 19, and `spec004-holds` itself passed
- FU27 — out of scope: `variant-marks.spec.ts` reads the caption once, before the song's content has arrived, e2e/variant-marks.spec.ts:232, e2e/variant-marks.spec.ts:277. Wait for `variant-line` before the read. review-probes/INV-038-variant-line-arrives.spec.ts is a measure for this ruling, and has nothing to adopt
- FU28 — out of scope: `test.setTimeout(120_000)` sits inside a comment on `main` too, so these two files run at the default timeout, e2e/variant-marks.spec.ts:4, e2e/reading-layout.spec.ts:10
- FU29 — MINOR F50, e2e/reading-sync.spec.ts:64. Adopt the wait and `openTools(second)` from review-probes/F50-second-device-opens-a-song.spec.ts, and give the test a band name of its own, or FU31 keeps skipping it
- FU30 — MINOR F51, specs/007-usability-pass/audit/after.txt:6
- FU31 — out of scope, and worth raising first: two accounts on one server cannot both have a band of the same name. `slugify` adds nothing to make a slug unique, src/lib/local/editing.ts:90; the index is unique across the whole server, drizzle/0000_modern_elektra.sql:183; and `applyPush` runs a device's whole batch in one transaction, src/lib/server/sync.ts:84. So the duplicate fails that batch: 301 `bands_slug_idx` errors in a run of 20 tests, and the outbox did not drain within 15s in any of the 20. No file under `src/lib/server`, `src/lib/sync` or `drizzle` differs from `main`. e2e/reading-sync.spec.ts:51 reports this as `sync is not reaching a database`, which it is not
- FU32 — out of scope: `click-running.spec.ts:62` flaked in PR #7's CI on a set of 3 gap sizes against 2. It flaked in `main`'s last CI run too, run 42077179082, as line 61, e2e/click-running.spec.ts:75. It passed 40 of 40 on Linux at 8 workers, so I have no cause for it
- FU33 — out of scope: a device with no such song shows `Loading…` for good, because `getSong` returns `undefined` for a row it lacks and `undefined` is what the page reads as loading, so `That song is not on this device.` is never reached that way, src/components/app/SongView.tsx:72, src/lib/local/queries.ts:66. F50's probe read this at 1, 5 and 15s. Neither line is in this branch's diff
- FU34 — keep review-probes/INV-016-linux-chrome.sh as a tool, with nothing to adopt, since CI is the run it copies. Run it before a push: every check in this pipeline ran on Windows, which is how T183's defect reached CI

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 66 | 66 | 0 | 0 | 0 |
| Success criteria | 17 | 17 | 0 | 0 | 0 |
| Constitution principles | 14 | 13 | 1 | 0 | 0 |

`.specify/memory/constitution.md` is still the unfilled template, so the third row counts the 14 gates of plan.md § Constitution Check. The partial gate is browser testing, owed by T114. The first two rows carry over from round 4. This round re-ran their tests, and T183 changes no requirement.

Run on this working tree, on a fresh build: typecheck clean, with this round's probes; lint 0 errors, 9 warnings; `npm test` 146 files, 6,139 tests passed; `test:budget` 8 of 8; `test:spec004` 1 of 1; `check:untouched-usability`, `check:usability-amendments` and `check:usability-audit` pass. Line endings match `main`: `git diff main --shortstat` and the same with `--ignore-space-at-eol` agree, at 208 files. No scratch files at the repo root.

The whole e2e suite on Linux Chrome, all three projects, in four slices at 8 workers with no retries: 2,653 passed, 2 failed, 723 skipped, the same skipped count as CI. The failures are `reading-sync.spec.ts:35` on mobile (F50) and `usability-bars-sections.spec.ts:141` on desktop (FU22). On Windows, `usability-*`, `reading-*` and `tab*`, the specs that read column widths: 662 passed, 261 skipped, none failed.

## What I could not check

- **GitHub's own CI on T183.** Pushing is not part of this phase, so PR #7 still shows the red run for `46a6757`. The replica is close but not the same: Node 26 against 24, 8 workers, no retries, `next start` over one build, and slices. Its control reproducing CI's 14 failures by name is why I trust it. It is not a green check.
- **Anything on a real phone.** T108 to T113 stay open and marked. The on-screen keyboard is stubbed and insets are emulated, so INV-011 and INV-013 are held in emulation only. Whether a real Android phone rounds glyphs as Linux Chrome does is unmeasured. 7px is safe either way, because it only reserves more room.
- **INV-042, legibility at actual size.** Needs a person, T114. No screenshot was reviewed this round.
- **Printed pages by eye.** No PDF renderer is installed here. A5, Letter, landscape and a real printer were not tried.
- **Other browsers.** Everything ran in Chromium, now on two platforms. Safari and Firefox are unread.
- **The whole suite on Windows.** This round only the width-reading slice ran there. Every probe did.
- **`main`, built.** I did not build it. "Out of scope" for F50's race and FU32 rests on `main`'s CI flagging the same tests and on their lines having no diff, not on a measured rate. I have no cause for FU32's third gap size.
- **How far FU31 goes.** I measured a failed push and an outbox that does not drain in 15s. I did not check what the person sees, whether anything else on that device stops syncing for good, or what happens if the band is renamed.
- **The fixes for F46, F47 and F49 are still untried.** F50's is tried only in its probe, not in `e2e/`.
- **Timing depends on load.** Other projects were loading this machine throughout. FU22's rate is from 8 workers in Docker, and a quieter or busier machine will differ.
