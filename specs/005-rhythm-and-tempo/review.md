# Review: Rhythm and tempo

Reviewed 69 file(s) changed across 0 commit(s), against main 8460e06. The branch has no commits, so
this is the **present state of the working tree** (`git diff HEAD` plus untracked files), not
`base...HEAD`: 13 tracked files modified and 56 new, outside `specs/` and `.specify/`.

Round 3. Round 1 had 4 MAJOR and round 2 had 5 MAJOR, neither had a BLOCKER, and `## Phase 9` and
`## Phase 10: Review remediation` (T062–T097) are all ticked. An earlier attempt at this round died on
an API error (`ENOTFOUND`) after 21 turns and wrote nothing, so this one started again from the probes.

Read in full: `ClickBar.tsx`, the `ColumnInspector.tsx` and `properties.ts` diffs, `Sheet` in
`ui/index.tsx`, `e2e/durations-row-tall-sheets.spec.ts`, `e2e/durations.spec.ts`, the `noSideways`
change in `e2e/click-bar-at-size.spec.ts`, the new test in `e2e/click-state.spec.ts`, and implement's
closing report.

Sampled: `e2e/click-bar-fit.spec.ts`, diffed against its probe, which differs only in the import path and
the removed `CANDIDATE` branch. `rhythm-writes.test.ts`, by matching every test name in both probes
against it (all kept), and by mutants.

Not reviewed again: `src/lib/rhythm/*.ts`, `src/lib/arrangement/passes.ts`, `useClick.ts`,
`TempoControl.tsx`, `editing.ts`, `layout.ts` and `TabStaff.tsx`. T089–T097 changed none of them, and
their last read was round 1 or 2. Every probe re-ran over them.

## Verdict

Ready to merge: no BLOCKER and no MAJOR. All five of round 2's MAJORs are closed, and this time the
fixes did not cause new ones. The duration row holds y 532 on all 33 shape and tuning pairs, and now does
so by structure, because the footer's height depends on nothing in the column. The bar fits at 375 in
every state, `npm test` was green in 6 of 6 runs, every write mutant is killed by the suite, and reduced
motion starts nothing on any beat. No probe regressed. Round 2 could not say whether every control stays
reachable above the new footer, so I probed that by pointer and by keyboard at three heights, and it
holds. The whole e2e suite ran, which implement's pass did not do: one test failed once, on what reads as
a race in the test itself (F24, MINOR). What remains is 13 MINORs in § Follow-ups, plus the person and
real-phone passes the plan owes after merge (T051–T057). `tasks.md` is unchanged. Four files are still
flipped to CRLF (F21), which is cheap to fix before committing and noisy to fix after.

## Closed since round 2

- **F15 closed.** `pinned` on the descriptor puts `duration` and `delete` in a footer, chosen by a field
  and not by id, and `no-id-branch.test.tsx` is unedited. y is 532 on all 33 pairs, light on both
  projects and dark on mobile, and `ui/index.tsx` has zero diff (src/components/capture/ColumnInspector.tsx:41,
  src/lib/capture/properties.ts:172).
- **F16 closed.** Start and the beat box are 86 px. Every tempo fits in every state on both projects, at
  one line each, with the page 375 wide, and Stop is at x 110, clear of Start's right edge at 102
  (src/components/rhythm/ClickBar.tsx:68, src/components/rhythm/ClickBar.tsx:80). Round 2 worried that
  86 px was this machine's fonts. It is not: Geist and JetBrains Mono ship with the app
  (src/app/layout.tsx:9, src/app/layout.tsx:23).
- **F17 closed.** `INV-001-suite-stays-green.sh` gave 5 green runs of 5, and a sixth run was green too.
  The test that timed out took 5.6 s under load and now has a 300 s timeout
  (src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:125). No other feature test is above 3.6 s.
- **F18 closed.** All 11 write mutants read `suite=KILLED`, with no `BROKEN` or `STALE` row. Across all 55,
  52 are killed and the 3 survivors are the three T073 allows (`mutants-round-3.txt`). Every test in both
  write probes is in `src/lib/local/__tests__/rhythm-writes.test.ts`.
- **F19 closed.** The observer reads 0 animations on every beat, both with reduced motion and without
  (src/components/rhythm/ClickBar.tsx:25). The new test at `e2e/click-state.spec.ts:45` does not depend
  on polling.

## Invariants

Sets are named as in plan.md. Probe paths are under `review-probes/`. Every probe from rounds 1 and 2 was
re-run first, and none regressed. A `test.fail` in a probe marks a known MINOR, so a re-run stays green and
flags the day it is fixed. T089–T097 touched INV-001, 003, 004, 006, 015, 024, 028 and 040. The others
rest on code that has not changed, and on their probes passing again.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | H × 2 densities through `TabStaff` with `showRhythm` on and off; S; capture; paste preview | `INV-001-002-harvest.test.ts`, `INV-010-011-012-marks.spec.ts`, `INV-001-006-010-016-members.spec.ts`, `INV-001-suite-stays-green.sh` |
| INV-002 | held | H × (6 of D, D cycled) × 2 densities: `toAscii`, `songToText`, all layout fields, `countBars`, `expandedLength` | `INV-001-002-harvest.test.ts` |
| INV-003 | held | 6 null paths × D; copy, cut, `createVariant` × D; rhythm line above and below pasted tab. The suite sees them all again | `INV-003-004-015-lost-writes.test.ts`, `INV-003-004-every-path.test.ts`, `mutants-round-3.txt` |
| INV-004 | held | All named edits; ×4 both ways × D; both group kinds; 4 merges × both orders | `INV-003-004-015-lost-writes.test.ts`, `INV-003-004-every-path.test.ts`, `mutants-round-3.txt` |
| INV-005 | held | 6 values of U and `undefined` × inspector, status, S, export, walk; no rewrite; tap 8 | `INV-005-unknown-values.spec.ts`, `INV-033-034-037-arrangements.test.ts` |
| INV-006 | held | y over 33 shape and tuning pairs, light on both projects and dark on mobile; repeated, order, one line, ≥44, ≤375, no scroll, barline absent. New: every control in the sheet by pointer and keyboard, 3 tunings × 2 sheets × 3 heights × 2 projects | `INV-006-tall-sheets.spec.ts`, `INV-006-row-every-column.spec.ts`, `INV-006-footer-reach.spec.ts` |
| INV-007 | held | 42 pairs (suite); two taps in one tick, same and different; a change from another device | `INV-007-008-lit-and-nowhere-else.spec.ts` |
| INV-008 | held | 4 containers × 4 targets | `INV-007-008-lit-and-nowhere-else.spec.ts` |
| INV-009 | held | 3 tunings × {none, D} × {mid, end} × 2 themes; long title; `N unsynced`; header 37 px | `INV-009-capture-height.spec.ts` |
| INV-010 | held | D under 1-digit, 2-digit, space; ×8 both densities; barline; mixed; S; print. Marks sit up to 6 px off centre (F13) | `INV-010-011-012-marks.spec.ts`, `INV-001-006-010-016-members.spec.ts` |
| INV-011 | held | D × 2 themes × 2 surfaces, computed contrast. Greyscale is INV-044 | `INV-010-011-012-marks.spec.ts` |
| INV-012 | held | D × 6 column shapes; null equals today's strings | `INV-010-011-012-marks.spec.ts`, `INV-001-002-harvest.test.ts` |
| INV-013 | held | Every listed tap rule, literal; SC-002 over 2,000 seeds | `INV-013-018-021-tables.test.ts` |
| INV-014 | held | All 7 members | `INV-014-015-tap-pad-and-set.spec.ts` |
| INV-015 | held | 3 closes; set new, stored, no tempo, out of range; `setSongTempo` directly, in the suite again. Two rows only at ~0 ms (F5) | `INV-014-015-tap-pad-and-set.spec.ts`, `INV-003-004-015-lost-writes.test.ts` |
| INV-016 | held | Capture 4 × 2; play view idle and all 6 of K × 2, with `starting` held open by a 400 ms resume | `INV-016-017-018-sheet-and-tempo.spec.ts`, `INV-001-006-010-016-members.spec.ts` |
| INV-017 | held | All surfaces, row and outbox shape; another device by `e2e/tempo-sync.spec.ts`, which ran against Postgres on both projects | `INV-016-017-018-sheet-and-tempo.spec.ts` |
| INV-018 | held | T through the screen; `120.5` typed; every whole number −2 to 1002 against `songRowSchema` | `INV-016-017-018-sheet-and-tempo.spec.ts`, `INV-013-018-021-tables.test.ts` |
| INV-019 | held | All members, including each return to the screen | `INV-019-020-021-022-timing.spec.ts` |
| INV-020 | held | 40, 120, 240; 5 starts; timed and untimed; follow off; stop during each of four | `INV-019-020-021-022-timing.spec.ts` |
| INV-021 | held | 10 simulated minutes × 3 tempos, jitter to 200 ms, score with 3-, 5- and 7-groups; real 60 s recorder run | `INV-013-018-021-tables.test.ts`, `INV-019-020-021-022-timing.spec.ts` |
| INV-022 | held | Stall × 3 stages; 500 rows; a whole-view re-render | `INV-013-018-021-tables.test.ts`, `INV-019-020-021-022-timing.spec.ts` |
| INV-023 | held | X × K: 36 in place, 15 away, 5 deleted, 5 reload; SC-006 100 stops | `INV-023-026-029-every-ending.spec.ts` |
| INV-024 | held | Double tap at 50, 70, 90% of Start × gaps 0, 50, 120 ms × with and without follow chip × 2 projects, re-run at the new width; one tick; start-stop-start; SC-012 50 cycles. A keyboard double press stops it (F20), outside the set | `INV-024-double-tap-start.spec.ts`, `INV-024-025-engine-seams.test.ts`, `INV-040-bar-fit.spec.ts` |
| INV-025 | held | Count-in, following, plain; both devices; 5 tempo pairs × 3 moments; the 5.9 s case; same value; null and 120.5. A change inside the resume window is dropped (F7), outside the set | `INV-025-027-028-030-running.spec.ts`, `INV-013-018-021-tables.test.ts`, `INV-024-025-engine-seams.test.ts` |
| INV-026 | held | Hidden, `pagehide`, each context state, dry queue; no auto restart | `INV-023-026-029-every-ending.spec.ts`, `INV-013-018-021-tables.test.ts` |
| INV-027 | held | 3 failures × K; normal run | `INV-025-027-028-030-running.spec.ts`, `INV-024-025-engine-seams.test.ts` |
| INV-028 | held | Reduced motion both ways, read on each beat at 240 bpm: 0 on all 12 beats in both. Levels, count-in numbers and timing hold. By reading, the app-wide 0.01 ms rule in `globals.css` still applies under `reduce`, but `transition-none` leaves it nothing to run | `INV-028-no-motion-at-any-beat.spec.ts`, `INV-025-027-028-030-running.spec.ts` |
| INV-029 | held | X; absent; rejecting; resolving after stop. A late lock after stop and restart leaks (F8), which the set does not name | `INV-023-026-029-every-ending.spec.ts` |
| INV-030 | held | A whole run through K; toggle; X; stores byte-identical | `INV-025-027-028-030-running.spec.ts` |
| INV-031 | held | 2 stories × 3 arrivals, offline after a visit online | `INV-031-offline-arrivals.spec.ts` |
| INV-032 | held | All 8 shapes in one arrangement, click against bars read off the DOM | `INV-032-036-038-following.spec.ts` |
| INV-033 | held | N, plain × D and repeats (suite); G: 6,000 arrangements against an exact reference | `INV-033-034-037-arrangements.test.ts` |
| INV-034 | held | Literal cases (suite); G with U, mixed numbers, cut groups, legacy rows | `INV-033-034-037-arrangements.test.ts` |
| INV-035 | held | Worked example by ear and by table; G; positions strictly increase | `INV-032-036-038-following.spec.ts`, `INV-033-034-037-arrangements.test.ts` |
| INV-036 | held | First plain tick equals the score's end over G; by ear and on screen | `INV-033-034-037-arrangements.test.ts`, `INV-032-036-038-following.spec.ts` |
| INV-037 | held | 300 shuffles of bars from ⅛ to 32 beats | `INV-033-034-037-arrangements.test.ts` |
| INV-038 | held | K × follow on and off; 5 first-bar cases; reset on return | `INV-032-036-038-following.spec.ts`, `INV-024-025-engine-seams.test.ts`, `INV-038-seed-lands.spec.ts` |
| INV-039 | held | Duration and barline edits, both devices; deleted part; live tempo. A slow store is by the suite and by reading: `click-bar.test.tsx:43`, `PlayView.tsx:130` | `INV-025-027-028-030-running.spec.ts` |
| INV-040 | held | 5 tempos × {following, plain, running} × 2 projects, one line each, page 375 wide; no tempo beside the chip; reach, height, print and resting position | `INV-040-bar-fit.spec.ts`, `INV-040-bar-at-size.spec.ts` |
| INV-041 | held | Every status row; 16 beats add no announcement; focus lands on stop | `INV-025-027-028-030-running.spec.ts` |
| INV-042 | held | 20, 21, 120, 399, 400 and every reading the pad can offer, through the schema | `INV-013-018-021-tables.test.ts` |
| INV-043 | held | `check:untouched-rhythm` exit 0 over all named paths; D and U through the schema | `npm run check:untouched-rhythm`, `INV-013-018-021-tables.test.ts` |
| INV-044 | not checked | — | Needs a person at actual size, `quickstart.md` §8. Owed after merge by the plan, T051 |
| INV-045 | not checked | — | Needs a real phone, `quickstart.md` §9. T052–T057 stay 🛑 BLOCKED, correctly unticked |

## Findings

- [ ] MINOR F24 — `e2e/durations.spec.ts` can lose its second note to `page.goto`, so it failed once in the full run
      where:  e2e/durations.spec.ts:10, e2e/durations.spec.ts:13, e2e/durations.spec.ts:34
      why:    The second fret tap is followed only by a count of zero marks, which is true at once, and then `page.goto(songUrl)`. In the full feature run the song page showed one mark where the test expected two, so `["8", ""]` read `["8"]`. From reading, the second write is lost to the navigation, the race F3 closed in `seedPlayable`, in a spec that does not use it. I did not reproduce it: alone it passed 72 of 72, so it seems to need load. No person leaves a page within milliseconds of a tap, and CI retries once (playwright.config.ts:16).
      owed:   `await expect(columns(page)).toHaveCount(2)` after line 10.
      traces: T035, T041

- [ ] MINOR F5 — Two taps on Set at about 0 ms write twice, with the same value, because `setSongTempo` checks outside the write's transaction. It needs a gap under 20 ms, which no finger reaches
      where:  src/components/rhythm/TempoControl.tsx:121, src/lib/local/editing.ts:523

- [ ] MINOR F6 — The pad's inline ref callback refocuses the pad on every re-render of the sheet
      where:  src/components/rhythm/TempoControl.tsx:92

- [ ] MINOR F7 — A tempo landing during `starting` is dropped until the next change, because the effect does not re-run when the state turns to running
      where:  src/components/rhythm/useClick.ts:93

- [ ] MINOR F8 — A wake lock that resolves after stop and a quick restart overwrites the held sentinel, which is then never released
      where:  src/components/rhythm/useClick.ts:36

- [ ] MINOR F9 — Accessible name drifts from the contract: `Tempo: not given` against `Tempo: none set`
      where:  src/components/rhythm/TempoControl.tsx:39, specs/005-rhythm-and-tempo/contracts/components.md:69

- [ ] MINOR F10 — Follow label drifts from the contract: `Following notation` against `Follow notation`. The contract's shorter words would also give the bar 20 px back
      where:  src/components/rhythm/ClickBar.tsx:97, specs/005-rhythm-and-tempo/contracts/components.md:112

- [ ] MINOR F11 — `e2e/capture-surface.spec.ts` is rewritten from CRLF to LF, 5,834 diff lines for 4 real ones, and those hide an unreported pin change to `i < 18`
      where:  e2e/capture-surface.spec.ts:1926

- [ ] MINOR F12 — The count-in number is wiped after `PULSE_MS`, so each number shows for 100 ms of its beat. A question for the person pass
      where:  src/components/rhythm/useClick.ts:120

- [ ] MINOR F13 — The mark is left-aligned while the fret above it is centred, so it sits up to 6 px off centre, inside its own column
      where:  src/components/tab/TabStaff.tsx:290

- [ ] MINOR F20 — A keyboard double press on Start starts the click and stops it. Focus moves to Stop, as the contract asks, so the second Enter lands there. A held key should do the same through auto-repeat, which I did not run. `INV-040-bar-fit.spec.ts` holds it as a `test.fail`
      where:  src/components/rhythm/ClickBar.tsx:43

- [ ] MINOR F21 — Implement's text-mode Python edits turned four LF files into CRLF, against plan.md:73. `properties.ts` shows 381 changed lines for about 40 real ones. Still open: all four read CRLF today
      where:  src/lib/capture/properties.ts:1, src/lib/capture/__tests__/properties.test.ts:1, src/lib/capture/__tests__/properties-decorations.test.ts:1, src/components/capture/__tests__/grouping-sheet.test.tsx:1

- [ ] MINOR F22 — Comments and a title describe the old state. The adopted tests' headers still say the file they now live in lacks what it holds, and a test title lists five properties while its body pins six
      where:  src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:6, src/lib/local/__tests__/rhythm-writes.test.ts:4, src/lib/capture/__tests__/properties.test.ts:84

- NOTE F14 — `score` is computed in `ClickBar`, where the contract puts it, not in `PlayView` as T048 says. Nothing depends on the difference (src/components/rhythm/ClickBar.tsx:31).

- NOTE F23 — The design documents still put the row second, after `repeat`, and say nothing of the footer: contracts/writes.md:39, research.md:148, plan.md:307. The code is right, and review may not edit plan.md.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F5, src/components/rhythm/TempoControl.tsx:121, src/lib/local/editing.ts:523
- FU2 — MINOR F6, src/components/rhythm/TempoControl.tsx:92
- FU3 — MINOR F7, src/components/rhythm/useClick.ts:93
- FU4 — MINOR F8, src/components/rhythm/useClick.ts:36
- FU5 — MINOR F9, src/components/rhythm/TempoControl.tsx:39
- FU6 — MINOR F10, src/components/rhythm/ClickBar.tsx:97
- FU7 — MINOR F11, e2e/capture-surface.spec.ts:1926
- FU8 — MINOR F12, src/components/rhythm/useClick.ts:120
- FU9 — MINOR F13, src/components/tab/TabStaff.tsx:290
- FU10 — out of scope: the play view subtitle prints a raw stored tempo, so `120.5 bpm` sits beside a control that says no tempo. The song page field that stores it is the existing defect spec.md:346 already names (src/components/app/PlayView.tsx).
- FU11 — `run-mutants.sh`, `vitest.mutants.config.mts`, `INV-038-seed-lands.spec.ts` and `INV-001-suite-stays-green.sh` are review tools, not tests. They stay in `review-probes/`.
- FU12 — MINOR F20, src/components/rhythm/ClickBar.tsx:43
- FU13 — MINOR F21, src/lib/capture/properties.ts:1. Restore LF before the entry is committed.
- FU14 — MINOR F22, src/lib/rhythm/__tests__/fixtures-gain-durations.test.ts:6
- FU15 — NOTE F23, specs/005-rhythm-and-tempo/contracts/writes.md:39
- FU16 — MINOR F24, e2e/durations.spec.ts:10
- FU17 — add `review-probes/INV-006-footer-reach.spec.ts` to the suite as a new file, `e2e/durations-sheet-reach.spec.ts`. It walks the group row, the chord field and the stepper above the footer, which `e2e/techniques-sheet-reach.spec.ts` does not. That spec's scroll check at line 68 moves the dialog, which no longer scrolls, so it now proves nothing about `close`.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 51 | 51 | 0 | 0 | 0 |
| Success criteria | 12 | 10 | 2 (SC-010, SC-011: person pass owed) | 0 | 0 |
| Edge cases | 19 | 19 | 0 | 0 | 0 |
| Invariants | 45 | 43 | — | — | 0 violated, 2 not checked |
| Constitution principles | 0 | — | — | — | — |

`.specify/memory/constitution.md` is the unfilled template, so the plan's own gates were used. "Satisfied"
means on Chromium; real-phone halves are below.

Suite and gates on this tree:

| Check | Result |
|---|---|
| `npx vitest run` | 4,627 tests, all passed in 6 of 6 runs |
| `npm run typecheck` | clean, with the probes included |
| `npm run lint` | 0 errors, 2 warnings, both from spec 004 |
| `npm run check:untouched-rhythm` | exit 0 |
| `npm run build` | passed |
| e2e, `click*`, `rhythm*`, `durations*`, `tempo*` | 373 passed, 1 failed (F24), 130 skipped |
| e2e, the other 42 specs | 1,433 passed, 229 skipped, 0 failed |
| `e2e/durations.spec.ts` alone, on mobile | 72 of 72 passed |
| Unit probes | 396 passed |
| Browser probes from rounds 1 and 2 | 298 passed, 130 skipped, 0 failed |
| Browser probe new this round | 20 passed |
| Mutants | 52 of 55 killed by the suite, 3 allowed survivors, none `BROKEN` or `STALE` |

## What I could not check

- **Real phones (INV-045):** the six items in the spec's *Owed to a real phone*, including the silent switch, real wake-lock behaviour, output latency and whether the click is audible over a bass. T052–T057 stay open.
- **A person at actual size (INV-044):** `quickstart.md` §8, including greyscale reading for SC-011 and whether a 100 ms count number can be read (F12). One more for that pass: `delete` is one tap with no prompt, and is now under the row on every sheet, 25 px below it and 36 px high, as measured in `INV-006-footer-reach.spec.ts`. No requirement covers it, so whether that is enough is a judgement for a thumb.
- **The on-screen keyboard over the footer:** the chord field now sits in a scrolling area above pinned rows, and no headless run opens a keyboard. The 553 px height stands in for browser bars, not for a keyboard.
- **Touch scrolling in the rows:** the walk scrolls by script and by focus. A finger dragging an inner scroller inside a `dialog`, on iOS especially, is for the phone pass.
- **Heights below the supported size:** the capture screen would not take the seeding taps under 375×667, so 553 and 375 were tested on an open sheet only.
- **Firefox and Safari:** only Chromium ran. From reading, `keyCounted` and `keyup` ordering in `TempoControl.tsx:101` could double-count on Firefox; I could not run it.
- **CI's timing:** the 6 green runs are this machine under this load.
- **Real audio:** the recorder proves what was scheduled, in headless Chromium, not what came out of a speaker.
- **Mutants through e2e:** in-memory mutants only reach Vitest.
