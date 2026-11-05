# Review: Note names, intervals, and seeing what a variant changed

Reviewed 91 file(s) changed across 1 commit(s), against origin/main...HEAD (`7bba9c1`), of which 48 are outside `specs/`, plus the working tree's uncommitted changes: T073 in `src/lib/reading/played.ts` and `src/lib/reading/compare.ts`, and Phase 11 in five test files, `scripts/untouched-by-reading.sh` and `plan.md`. So the code judged here is the working tree, not HEAD alone.
Round 5. Rounds 1 to 4 had 6, 3, 0 and 1 MAJOR, and none had a BLOCKER. `## Phase 8`, `## Phase 9`, `## Phase 10` and `## Phase 11: Review remediation` are ticked, and Phase 11 is what changed since round 4. No source file under `src/` changed in that time: only tests, the guard and the plan. Read in full: `played.ts`, `compare.ts`, `marks.ts`, `labels.ts`, `spelling.ts`, `view.ts`, `VariantLine.tsx`, `ViewControl.tsx`, `useStaffView.ts`, `scripts/untouched-by-reading.sh`, spec.md, plan.md, tasks.md Phases 8 to 11, the round 4 `review.md`, the working-tree diffs of the five test files, and the branch's diffs of `TabStaff.tsx`, `layout.ts`, `techniques.ts`, `chords.ts`, `text.ts`, `globals.css`, `PlayView.tsx`, `SongView.tsx`, `hooks.ts`, `queries.ts` and `client.ts`. Sampled: `align.ts` (lines 60 to 70), `protocol.ts` (the row schema), `readPull`, `ci.yml`. Not read: `baseline.json`, which is recorded output, and the test files with no change this round, which every probe and the whole suite re-ran over. The constitution is the unfilled template, so the plan's de facto gates stand in for it.

## Verdict

Yes, this satisfies the spec and hangs together, and I would ship it: **no BLOCKER and no MAJOR**, so `tasks.md` is unchanged. Round 4's one MAJOR is closed. `npm run check:untouched-reading` exits 0, and it still fails on all 22 ways of tampering with a fenced path that I tried, so the fence was narrowed and not opened. T075 and T076 did what they promised: the suite alone now kills all nine T073 mutants, and `snapshot.test.ts` itself kills the read outside one transaction. The adopted tests match their probes line for line, apart from renames and the cuts T075 asked for. 37 of 38 invariants held, and INV-038 is the person-level pass owed after merge. What is left is 18 MINORs, all safe to ship, three of them new and small (F31 to F33). F25, F27 and F29 are closed. Two things are worth a person's time. **FU19 is still the most serious thing in this report**: measured this round on `main` and on this tree under the same 6-worker load, a device loses a row for good in about half of all runs on both, so the fence holds, but the rate is higher than earlier rounds suggested. And F21 wants fixing before the merge, because `TabStaff.tsx` still has the wrong line endings.

## Round 4's blocking finding

- **F27 closed.** `npm run check:untouched-reading` exits 0. `review-probes/INV-037-the-guard-can-fail.sh` tampers with a throwaway worktree and reads the exit code: 23 of 23 right. That is the control, then a changed assertion, a deleted assertion and a changed timeout in each of the three files, a new line in two other files of the directory, a new file, a deleted file, and a new line in nine other fenced paths. Plan row INV-037 and Deviation 15 say what the guard does. One edge is left, and it is new: F31.

T075 to T079 closed F29, F25 and the adoption lines of round 3. F15 narrows to `partsOf`, since T075 pins `pack`.

## Invariants

Every saved probe re-ran first, on a fresh build of this tree, and no probe that held in round 4 fails now. Unit probes: 495 of 512 pass, 14 are the timing probe, which is gated and passed 14 of 14 when run alone, and 3 fail: F11, F12 and F28. Browser probes: 214 of 216 pass, and the 2 that fail are F7, in both projects. `OOS-staff-font.spec.ts` stays red for FU14. `OOS-F23-a-pull-under-load.spec.ts` fails for FU19, this time at 2 workers as well as 6.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | **H** × **Den** × 2 surfaces × `showRhythm` × {absent, frets with no marks}, against `baseline.json` | review-probes/INV-001-012-019-020-021-024-harvest.test.ts |
| INV-002 | held | Copy text and Download × **V** × **Den** on a marked variant; what was copied, given to `parseTab`, reads back the seeded frets. Now in the suite (T077) | INV-002-…-view.spec.ts, review-probes/INV-002-the-reader-reads-the-export.spec.ts |
| INV-003 | held | 100 changes × {song page, play view} with a reload, signed out and signed in; a second real device. The signed-in play view is now in the suite (T078) | INV-002-…-view.spec.ts, INV-003-015-031-two-devices.spec.ts, review-probes/INV-003-signed-in-play-view.spec.ts |
| INV-004 | held | **N** × {capture, a selection, paste preview, preview after a refusal} | INV-002-…-view.spec.ts |
| INV-005 | held | **N** × {song, play} × {direct, reload, band link, link between the two, offline after a visit}; a tab left on frets, now in the suite (T077) | INV-002-…-view.spec.ts, review-probes/INV-005-a-tab-left-on-frets.spec.ts |
| INV-006 | held | **St** × {read, set, read again}, all 8; a second tab; no storage across the link to the play view and back | INV-002-…-view.spec.ts, review-probes/INV-006-no-storage-across-pages.test.ts, INV-006-no-storage-across-pages.spec.ts |
| INV-007 | held | **V** × {song, play} × 2 themes at 375×667; export, BPM, density and note beside it; print; no tuning; no arrangement | INV-002-…-view.spec.ts |
| INV-008 | held | **T** × every string × frets 0 to 36 × {no chord, Am, Bb7} | review-probes/INV-008-009-010-011-013-018-cells.test.ts |
| INV-009 | held | **Q** × 12 pitch classes × **N**, and the worked spellings | INV-008-…-cells.test.ts |
| INV-010 | held | **Dec** × names and degrees × **Den** × repeats 1, 2, 8; the painted face through CDP | INV-008-…-cells.test.ts, INV-014-…-layout.spec.ts |
| INV-011 | held | **N** × harmonic, dead and their combinations × neighbours | INV-008-…-cells.test.ts |
| INV-012 | held | **H** with chords laid on, against `main`'s `chordInForceAt` kept verbatim; **Unread**; the listed anchors | INV-001-…-harvest.test.ts |
| INV-013 | held | All four members | INV-008-…-cells.test.ts |
| INV-014 | held | The five slice starts, a long chord and a column holding its own chord × **V** on the real play view | INV-014-…-layout.spec.ts |
| INV-015 | held | **Load** × {song page, play view} × **N**; a real sync batch on two devices; a slow pull, a dead pull and a stale `syncing`. A write landing during the read is now in the suite (T076). The suite's own two-device test went red once: F23 | review-probes/INV-015-031-every-write-every-route.spec.ts, INV-015-031-held-reads.spec.ts, INV-015-a-slow-sync-holds-nothing.spec.ts, INV-015-one-read-one-snapshot.test.ts, INV-015-sync-lands-in-pieces.test.tsx |
| INV-016 | held | **Rows** × **V** × **Den** × 2 sizes × 2 themes on both surfaces. A 3-digit removal count still overruns: F7 | INV-014-…-layout.spec.ts, INV-016-text-in-its-column.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-017 | held | **V** × **Surf** × 2 sizes × 2 themes, heights, captions and overlap | INV-014-…-layout.spec.ts |
| INV-018 | held | Every table row, **Dec** × **N**, **H** in frets. `Bbbb` still loses its name: F11 | INV-008-…-cells.test.ts |
| INV-019 | held | **H** × every id set × one of each op; `compareVariants` deep-equals the code before T073 over 12,000 seeded songs with fresh ids throughout | INV-001-…-harvest.test.ts, review-probes/INV-019-020-022-023-024-t073-results-unchanged.test.ts |
| INV-020 | held | **F** each exactly 1 changed; **NotF** all Same; keys and bars over **H**; every valid column against every class of the old signature on 1, 2, 6, 8 and 9 strings; every fret 0 to 70 and `x` against every other on eight strings; one fret apart at 1 to 12 strings. T075 put the pair, words and twin tests in the suite. An empty-string technique is outside **NotF**: F28 | INV-001-…-harvest.test.ts, INV-020-not-compared.test.ts, INV-019-…-t073-results-unchanged.test.ts |
| INV-021 | held | **H** × every position × each edit; every group shape of 2 to 7 equal columns × every position × {remove, add into each neighbouring group} | INV-001-…-harvest.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-022 | held | 5,000 seeded pairs, and 20,000 grouped pairs | INV-021-…-compare.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-023 | held | The whole enumerated set, and a second run of the 20,000. Two chords on one anchor stays outside the set: F12 | INV-021-…-compare.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-024 | held | **H** × INV-021's edits, the pairs of INV-022, the grouped pairs, `coarse`, empty parts; T073's seeded songs give the same ops as before it | INV-001-…-harvest.test.ts, INV-021-023-024-the-slide.test.ts, INV-019-…-t073-results-unchanged.test.ts |
| INV-025 | held | All six members alone through `npm run test:budget`, 8 of 8 on this desktop; `MAX_EDITS` edges; no clock in `align.ts`, `compare.ts` or `played.ts`; SC-009's song in seven shapes of column, each with and without chords, 14 of 14 under 20 ms. CI not measured, because T073 is uncommitted | INV-021-…-compare.test.ts, `budget.test.ts`, review-probes/INV-025-a-song-that-is-not-plain.test.ts |
| INV-026 | held | **Par** × {song, play}, a chain, all three last-pass substitutes, a variant as an entry's own part | INV-026-…-marks.spec.ts, INV-021-…-compare.test.ts |
| INV-027 | held | **Surf** × {each op, additions only, removals only, none}; compact against expanded | INV-026-…-marks.spec.ts, INV-027-028-029-marks.test.ts |
| INV-028 | held | **V** × **Den** × all five shapes | INV-027-028-029-marks.test.ts |
| INV-029 | held | 20,000+ slices against an independent oracle | INV-027-028-029-marks.test.ts |
| INV-030 | held | Parent, `A x4` passes 1 to 3, text entry, no parent, unrelated substitute; pass 4 equals the song page | INV-026-…-marks.spec.ts |
| INV-031 | held | Five writes × three routes, on both surfaces, by a real pull and a real second tab. Now in the suite (T078) | review-probes/INV-015-031-every-write-every-route.spec.ts, INV-026-…-marks.spec.ts, INV-015-031-held-reads.spec.ts |
| INV-032 | held | Each mark, gap, line and marked cell × 2 themes × its real ground × {song, play} | INV-026-…-marks.spec.ts |
| INV-033 | held | **Surf** × **V** × each mark | INV-026-…-marks.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-034 | held | 2 schemes × play view × each mark, gap, line, real caption, against white; the tokens in dark, with the screen values as a control, now in the suite (T079) | INV-014-…-layout.spec.ts, review-probes/INV-034-print-tokens.spec.ts |
| INV-035 | held | Every words row × **F**, removals of 1 and 2, compact | INV-016-033-035-036-staff.test.tsx |
| INV-036 | held | No column moves over **Den** × **V**; a Same variant's markup equals a plain staff; the line runs across a removal, with and without a connector | INV-014-…-layout.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-037 | held | The guard's 25 checks, covering all 23 listed paths and `text.ts`: exit 0. 22 tamperings each exit 1, and the control exits 0. Held on this machine's `grep`: F31 | scripts/untouched-by-reading.sh, review-probes/INV-037-the-guard-can-fail.sh |
| INV-038 | not checked | — | Person-level at actual size, and owed after merge. T054 stays `🛑 BLOCKED` and unticked, as the plan says |

Mutants, in a throwaway tree. Through `review-probes/run-mutants-t073.mjs`, the suite now kills all nine of T073's, with none left to the probe, which is T075's done-when. Through `run-mutants.mjs`, all six are killed, and `snapshot.test.ts` itself kills `the song is read outside one transaction (T011)`, which is T076's done-when.

Each adoption was checked with `review-probes/adopted-against-probe.mjs`, which lists every probe line missing from the suite file. T077, T078 and T079 lost none but renamed titles and one helper. T076 only renamed its helpers. T075 lost what it was told to leave out, and kept fret 36 where the task cut the list to three values, which helps: that is the value the `x` mutant shares.

## Findings

- [ ] MINOR F31 — The INV-037 guard passes only where `grep` strips carriage returns
      where:  scripts/untouched-by-reading.sh:36, src/lib/tab/__tests__/review-redraw-ledger.test.ts:1
      why:    `review-redraw-ledger.test.ts` is CRLF, so its diff lines end in `\r`, and `grep -vxF` matches whole lines. Git Bash's `grep` strips the `\r`, so here they match. Run with `grep -U`, which keeps it as `grep` does on Linux or macOS, the guard exits 1 on an untouched tree, naming the five allowed lines. It is not in CI, and this machine gives the right answer.
      owed:   Strip `\r` with `tr -d '\r'` before the filter, and re-run `INV-037-the-guard-can-fail.sh`.
      traces: INV-037, T074

- [ ] MINOR F32 — An adopted test kept the probe's logging
      where:  e2e/reading-sync.spec.ts:1, e2e/reading-sync.spec.ts:499, e2e/reading-sync.spec.ts:501
      why:    T078 asked to keep the check that a missing variant is a lost row. It also brought `appendFileSync` and an `F23_LOG` branch, which only the probe's runs read. The check is right, and the log does nothing unless that variable is set.
      owed:   Delete the two log calls and the import.
      traces: coherence, T078

- [ ] MINOR F33 — The plan says no existing test changes, and Deviation 15 says three do
      where:  specs/006-reading-aids/plan.md:318, specs/006-reading-aids/plan.md:314
      why:    `### Existing tests this changes on purpose` still reads `None`. T074 was not asked to touch that section, and Deviation 15 is right.
      owed:   Point the section at Deviation 15.
      traces: plan.md § Deviations

- [ ] MINOR F23 — Two adopted sync tests can fail under load, and one did
      where:  e2e/reading-sync.spec.ts:151, e2e/reading-sync.spec.ts:161
      why:    `INV-015 a variant arriving from another device` failed in both projects in one 6-worker run, each with a variant missing from the first device, and passed in the other 6-worker run. It stops on the default 30 s test timeout, shorter than its own waits added up, so it cannot say late from lost, and I did not classify those two. In the same flow every miss of 30 s this round was `lost` (FU19). With CI's settings, 2 workers and one retry, all of `reading-sync.spec.ts` twice over gave 72 passed and 4 skipped, none flaky.
      owed:   It goes when FU19 is fixed. Until then this test could classify a miss, as T078's does. Do not lengthen the wait, because no wait reaches a row that is not coming.
      traces: INV-015, INV-031

- [ ] MINOR F21 — `TabStaff.tsx` still has the wrong line endings, against the plan
      where:  specs/006-reading-aids/plan.md:71, src/components/tab/TabStaff.tsx:1
      why:    It went CRLF to LF, so its diff shows 1,131 lines for 173 real ones, which buries them and breaks `git blame`. Counted by bytes (`review-probes/F21-line-endings.mjs`), it is the only one of 16 changed files that differs from `origin/main`. Nothing behaves differently.
      owed:   Restore its ending from `origin/main` before merging.
      traces: plan.md § Technical Context

- [ ] MINOR F28 — An empty-string technique reads as changed, where before T073 it read as Same
      where:  src/lib/reading/played.ts:97, src/lib/sync/protocol.ts:105, src/lib/reading/compare.ts:68
      why:    `pack` leaves the fast path on any non-empty list, but `[""]` gives the same signature as no technique, so one signature gets two numbers. This is the one shape that breaks T073's "results must not change" and can reach a device, because the wire takes any short string as a technique. Nothing in the app writes it, so it needs a hand-made push. On every valid row the two paths agree. Carried from round 4.
      owed:   Treat a list with no text in it as no technique in `pack`, or refuse an empty technique on the wire. Its probe stays red until then.
      traces: INV-020, T073

- [ ] MINOR F7 — A removal of 100 or more columns overruns its gap by 3.3 px
      where:  src/components/tab/TabStaff.tsx:589
      why:    The gap is a fixed `3ch`, and `−125` measures 29.2 px in 25.9 px. Carried from round 1. It needs 100 columns cut in one run, and it runs only into the next column's own mark row.
      owed:   Size the gap from the text's length. INV-036 already allows the gap's own width as a shift.
      traces: INV-016

- [ ] MINOR F8 — T055 is ticked, but the original second-device test still skips itself
      where:  e2e/reading-sync.spec.ts:34, e2e/reading-sync.spec.ts:50
      why:    The old test still seeds the fixed band, never drains and skipped in both projects again, which is the `bands_slug_idx` error in the server log. The adopted `INV-003 (two devices)` test covers the behaviour. Carried from round 2.
      owed:   Delete the old test, which is now redundant.
      traces: INV-003, T055

- [ ] MINOR F9 — Three of round 1's five weak assertions are still there
      where:  e2e/variant-marks-paint.spec.ts:172, src/lib/reading/__tests__/cells.test.ts:38, src/lib/reading/__tests__/frets-unchanged.test.ts:8
      why:    `.staff-caption` still matches nothing, so that print branch never runs. `cells.test.ts:38` still compares `chordInForceAt` with the map it looks up in. The header of `frets-unchanged.test.ts` still promises a variant it never renders. Each behaviour has a real test elsewhere. Carried from round 2.
      owed:   Delete the two dead checks and correct the header.
      traces: INV-001, INV-012, INV-034

- [ ] MINOR F11 — `Bbbb` loses its spoken name
      where:  src/lib/reading/spelling.ts:50
      why:    The word regex stops at two accidentals, and only `Cbdim7` reaches a triple flat. String and fret are still spoken. Carried from round 1.
      owed:   Allow a third accidental, or say the name plainly.
      traces: FR-018

- [ ] MINOR F12 — Two chords on one anchor, with rows in the other order, read as changed
      where:  src/lib/chords.ts:409, src/lib/reading/played.ts:162
      why:    `anchoredChords` keeps the last row. It needs a concurrent conflict in both parts with opposite order. Carried from round 1.
      owed:   Order rows by id before the last-wins pick.
      traces: INV-023

- [ ] MINOR F13 — 20 unrelated variants of 1,000 cost about 150 ms alone
      where:  src/lib/reading/align.ts:67
      why:    `start()` allocates an object per cell. It stays bounded, no spec figure covers it, and variants are copies, so this shape is pathological. Carried from round 1.
      owed:   Flat arrays in `align.ts` if a real song ever gets near this.
      traces: FR-025

- [ ] MINOR F14 — Dead code from earlier passes
      where:  src/lib/local/hooks.ts:98, src/lib/local/hooks.ts:102, src/app/globals.css:302, src/app/globals.css:307
      why:    `useSongEvents` and `useSongAnnotations` have no non-test callers left, and `.staff-caption` and `.variant-line` match no element. Carried from round 1.
      owed:   Delete them.
      traces: coherence

- [ ] MINOR F15 — `partsOf` and `signatureOf` are still hand-kept twins
      where:  src/lib/reading/played.ts:37, src/lib/reading/played.ts:107
      why:    T075 pinned `pack` to `signatureOf`, which closes the worse half. A field added to one twin and not the other would still give words that miss a change. Carried from round 1, and narrowed.
      owed:   Derive `partsOf` from the same place, or widen its pin to every field.
      traces: FR-032, INV-020

- [ ] MINOR F16 — A removal in an empty final bar cannot be reached by a slice
      where:  src/lib/reading/marks.ts:60
      why:    Arrangement bar ranges stop at `countBars`. Only `| |` endings reach it. Carried from round 1.
      owed:   Decide in `usability-pass` whether that bar exists for ranges.
      traces: INV-029

- [ ] MINOR F22 — A ternary with the same value on both sides
      where:  src/lib/reading/compare.ts:128
      why:    `dir === 1 ? [x, x + 1] : [x, x + 1]`. It is correct, but it reads as if the directions differ.
      owed:   Drop the condition.
      traces: coherence

- [ ] MINOR F24 — The adopted INV-027 test reads the line before the play view can have drawn it
      where:  e2e/variant-marks.spec.ts:276, e2e/variant-marks.spec.ts:277
      why:    In frets the play view draws empty staves before the read lands (plan deviation 11), so `tab-staff.nth(2)` can be visible while `variant-line` is not there yet. The page is right, and the test is racing it. It passed this round.
      owed:   Wait for `variant-line` before reading, as the probe does.
      traces: INV-027

- [ ] MINOR F26 — Two descriptions of the design T068 replaced
      where:  src/lib/reading/__tests__/snapshot.test.ts:114, e2e/reading-sync.spec.ts:288
      why:    The comment says a pull lands "as one transaction per table", and the test is named for a "stuck timer" that no longer exists. Both will mislead whoever next reads why these tests are there.
      owed:   Reword both.
      traces: coherence

- NOTE F17 — The jsdom half of INV-015 is delicate. Inside `act`, or without a pause between commits, it passes with the invariant broken. It does fail on the mutant today, and the two-device spec is still the judge.

- NOTE F30 — T073's speed-up reaches plain columns only. On this desktop, best of 30, one fret per column went from 8.1 ms to 3.7 ms. With a duration, a technique or a group on every column there is no real change: 8 to 12 ms now, against 8 to 13 ms before. SC-009 says "on a desktop" and holds for every shape. So `test:budget` measures the one shape that got faster. If CI is about as much slower as it was (23 to 25 ms against about 9), a song full of durations would not make 20 ms there, and no test would say so. That is not a defect in the spec's terms. It is what the number on CI does and does not mean.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU19 — **out of scope, and the most serious thing in this report. Worth a person's eye first.** The server can hand a device a cursor past a row it never sent, and that device then never gets the row. A reload does not bring it back. Measured this round on one machine at 6 workers, interleaved, 24 runs each, with `playwright.baseline.config.ts` serving a fresh build of `origin/main`: `main` lost a row in 14 and in 12 runs, and this tree in 12 and in 10. That is 26 of 48 against 22 of 48, so the branch does not worsen it, and `src/lib/server/` has zero diff. All 48 misses were `lost` and none was `late`, each a `parts` row on the server, missing from the device, 1 to 6 below its cursor. It also lost a row in one of two runs at 2 workers, so it needs little load. Likely mechanism, reasoned and not isolated: `readPull` reads each table in its own statement with no shared snapshot (src/lib/server/sync.ts:226, src/lib/server/sync.ts:238), so a push that commits between the `parts` read and the `events` read gives a page holding the events without the part, and `pullOnce` then stores a cursor above the part (src/lib/sync/client.ts:219). The same shape should lose `events` under an existing part, which would show as a permanent false `removed` line here, and on every screen as a device silently holding fewer columns than its bandmates. `changed` goes to every open stream whichever band pushed (src/app/api/sync/stream/route.ts:38), so one band's push makes every device pull. A device recovers only if the row is edited again or the cursor rewinds. One snapshot per pull closes this shape, but it does not cover two concurrent pushes to one band committing out of `serverSeq` order, so a fix needs to consider both. Evidence: review-probes/OOS-F23-a-pull-under-load.spec.ts.
- FU1 — MINOR F7, src/components/tab/TabStaff.tsx:589. Its probe, `INV-014-…-layout.spec.ts:347`, stays red until then.
- FU2 — MINOR F8, e2e/reading-sync.spec.ts:34
- FU3 — MINOR F9, e2e/variant-marks-paint.spec.ts:172
- FU5 — MINOR F11, src/lib/reading/spelling.ts:50. Its probe in `INV-008-…-cells.test.ts` stays red until then.
- FU6 — MINOR F12, src/lib/chords.ts:409. Its probe in `INV-021-…-compare.test.ts` stays red until then.
- FU7 — MINOR F13, src/lib/reading/align.ts:67
- FU8 — MINOR F14, src/lib/local/hooks.ts:98
- FU9 — MINOR F15, src/lib/reading/played.ts:37
- FU10 — MINOR F16, src/lib/reading/marks.ts:60
- FU11 — out of scope: `review-*` files in `src/lib/tab/__tests__/` hit their 5 s timeouts under full parallel load. Three now have timeouts. The rest of the directory has not, and `usability-pass` already plans this for the ledger test. Not seen this round: 5,856 of 5,856.
- FU12 — out of scope: load flakes outside this feature, `e2e/grouping-band.spec.ts:218`, `e2e/click-offline.spec.ts:5` and `e2e/sync.spec.ts:100`. None failed this round. `sync.spec.ts` may share FU19's cause.
- FU13 — not a defect: a variant larger than one `PUSH_BATCH` (200 rows), or split across two pull pages (500 rows), can still arrive in pieces. Closing that means changing the wire. Recorded in plan.md's Deviation 14.
- FU14 — out of scope, and worth doing soon: the staff has never been in JetBrains Mono. `.tab-staff` asks for `var(--font-mono)` (src/app/globals.css:184), which `:root` builds from `--font-mono-face`, and only `<body>` has that (src/app/layout.tsx:28). Same on `main`. It changes the look of every staff, so it belongs with `usability-pass`. Evidence: review-probes/OOS-staff-font.spec.ts.
- FU15 — MINOR F21, src/components/tab/TabStaff.tsx:1. Do this before the entry is merged.
- FU16 — MINOR F22, src/lib/reading/compare.ts:128
- FU17 — MINOR F23, e2e/reading-sync.spec.ts:151
- FU20 — MINOR F24, e2e/variant-marks.spec.ts:277
- FU21 — MINOR F26, src/lib/reading/__tests__/snapshot.test.ts:114
- FU27 — review-probes/OOS-F23-a-pull-under-load.spec.ts is the failing test for FU19's fix, and belongs with that work rather than here. `run-mutants.mjs`, `run-mutants-t073.mjs`, `playwright.baseline.config.ts` and `oracle-776c993/` are review tools and stay out of the suite.
- FU28 — MINOR F28, src/lib/reading/played.ts:97. Its probe in `INV-019-…-t073-results-unchanged.test.ts` stays red until then.
- FU29 — review-probes/INV-025-a-song-that-is-not-plain.test.ts stays out of the suite on purpose. It is wall-clock, Phase 10 forbids changing `budget.test.ts` or conditioning it on the environment, and on CI it would likely fail a limit that SC-009 sets for a desktop. It runs when asked, with `PROBE_TIMING=1`. Decide with F30 whether CI's budget should cover a real column.
- FU30 — `scripts/untouched-by-reading.sh` compares with the local `main`, here `eec2f54`, one release commit behind `origin/main`. That commit touches no fenced path, so the result is the same today.
- FU31 — MINOR F31, scripts/untouched-by-reading.sh:36
- FU32 — MINOR F32, e2e/reading-sync.spec.ts:499
- FU33 — MINOR F33, specs/006-reading-aids/plan.md:318
- FU34 — this round's three probes are review tools and stay out of the suite: `INV-037-the-guard-can-fail.sh` needs a worktree, and `F21-line-endings.mjs` and `adopted-against-probe.mjs` report for a reader. The `T073 songs` part of `INV-019-…-t073-results-unchanged.test.ts` stays out too, as T075 said, because it needs the frozen oracle.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 33 | 32 | 1 | 0 | 0 |
| Success criteria | 14 | 11 | 3 | 0 | 0 |
| Constitution principles | 0 | 0 | 0 | 0 | 0 |

Partial FR: FR-018 (F11). Partial SCs: SC-012, SC-013 and SC-014, whose automated halves hold and whose person-level halves are INV-038. I read every FR, SC, story and edge case against the source this round and found nothing the invariants had missed. The constitution is the unfilled template, so it has no principles to count. Every one of the plan's de facto gates stands.

Project suites, this tree: typecheck clean. `npm run lint` 0 errors and 2 warnings in unrelated files. `npm run check:untouched-reading` exit 0. `npm test`: 5,856 of 5,856. `npm run test:budget` alone: 8 of 8. `npx playwright test`: all 2,412 tests in 72 files ran, in four synchronous parts at 6 workers that overlap by 66, so 2,478 runs: 2,106 passed, 370 skipped, 2 failed (F23, one test in both projects, which passed in the other part it ran in).

## What I could not check

- CI. T073 is uncommitted, so `test:budget` has never run on it on `ubuntu-latest`. The numbers suggest it clears 20 ms there with margin for the budget test's plain columns, but that is an estimate, not a measurement.
- Which kind of miss F23's two failures were. They stopped on the test's own timeout, and I classified the same flow through the probe, not those two runs.
- INV-038 and `quickstart.md` §8: a person at actual size in both themes, including `·` visibility, the greyscale capture, scrollbars, and the caption at the very bottom of the card. T054 stays open.
- Real phones. Everything ran in Chromium on Windows with Pixel 7 emulation, so Safari, Firefox and real system fonts are unmeasured.
- FU19's mechanism. That a cursor passes an undelivered row is measured, on both trees. Why it does is reasoned from `readPull`, not isolated, and lost `events` rows are predicted and not observed, because the probe watches only `parts`.
- A variant larger than one push batch or pull page across two devices (FU13). Reasoned from `client.ts` and `protocol.ts`, not run.
- The skipped e2e tests, beyond `reading-sync`. Round 4 counted 361 across the suite. This round's 370 counts the overlapping parts twice, so it is not a comparable figure.
- The guard on a real Linux or macOS machine. `grep -U` stands in for one in F31.

## Follow-up: CI budget (T073)

`20 variants of 1,000 columns` (`compareVariants`), best of 30 on the desktop: **~9.2 ms before, ~3.8 ms after (-59%)**; CI measured 23–25 ms before, limit 20 ms. Time was in `playedColumns`, not the alignment: building and hashing a fresh signature string per event (~5.5 of 9 ms; alignment ~0.3 ms). Plain columns (frets 0–62 or x, no technique, duration, group or chord) now intern an exact packed number from the same id counter (`Interner.packed`), so no string is built; every other column keeps the string signature. Columns are a small class instead of an object with a closure. Results unchanged: all of `src/lib/reading/__tests__/` passes as written.

Round 4 measured it again against a frozen copy of the old code, on the same machine in the same run: 8.1 ms before, 3.7 ms after (-54%), for the budget test's own column. It agrees with the figures above, for that column only (F30). "Results unchanged" holds on every valid row, with one exception off the type (F28).
