# Review: Note names, intervals, and seeing what a variant changed

Reviewed 45 file(s) changed across 0 commit(s), against main...HEAD (`eec2f54`). HEAD is `main`: all of this feature is uncommitted, so this is a review of the present working tree against HEAD, not of a commit range. That is 13 tracked files modified and 32 new, outside `specs/`.
Round 3. Round 1 had 6 MAJOR, round 2 had 3 MAJOR, neither had a BLOCKER, and `## Phase 8` and `## Phase 9: Review remediation` (T055–T072) are all ticked. Read in full: `plan.md`, `spec.md`, `tasks.md`, the round 2 `review.md`, `src/lib/reading/view.ts`, `useStaffView.ts`, `ViewControl.tsx`, `VariantLine.tsx`, `src/lib/sync/runner.ts`, `SyncProvider.tsx`, `snapshot.test.ts`, the whole of `applyRemoteRows` and `readPull`, `scripts/untouched-by-reading.sh`, and the diffs of `client.ts`, `hooks.ts`, `queries.ts`, `SongView.tsx`, `PlayView.tsx`, `package.json` and `ci.yml`. Sampled: `e2e/reading-sync.spec.ts` (lines 1 to 210), `e2e/variant-marks.spec.ts`, `compare-oracle.test.ts` and `view.test.ts`, and every probe title matched against the plan's enumerations. Not read again: `compare.ts`, `align.ts`, `marks.ts`, `played.ts`, `labels.ts`, `spelling.ts`, `layout.ts`, `techniques.ts`, `chords.ts` and `TabStaff.tsx`, which Phase 9 did not change and every probe re-ran over. The constitution is the unfilled template, so the plan's de facto gates stand in for it.

## Verdict

Yes. This satisfies the spec and hangs together, and I would ship it: no BLOCKER, no MAJOR, 37 of 38 invariants held, and the 38th is the person-level pass the plan owes after merge. All three of round 2's MAJORs are closed. A pull now lands in one transaction, nothing on the read path knows sync exists, lint is clean, and the view survives the link to the play view with no storage. The redesign holds up when attacked: undoing it fails a suite test, and a variant arriving by a real pull showed no false line in any run, on either page, in notes or intervals. What remains is 15 MINORs in § Follow-ups. One thing outside this spec needs a person's attention before anything else. While closing F23 I found that **the sync server can move a device's cursor past a row it never sent, and that device then never gets the row**. It is on `main` too, so it does not gate this entry, but it is silent divergence between bandmates' devices (FU19).

## Round 2's blocking findings

| Finding | Status | Evidence |
|---|---|---|
| F18 the network is in the read path | Closed | `settled`, `stuck`, `STUCK_SYNC_MS` and `syncing` are gone. All of `INV-015-a-slow-sync-holds-nothing.spec.ts` and `INV-015-031-held-reads.spec.ts` pass, in both projects and as adopted in `e2e/reading-sync.spec.ts`. Mutant: a pull landing one table at a time fails `snapshot.test.ts` |
| F19 `npm run lint` fails | Closed | 0 errors, the same 2 warnings in unrelated files, no `eslint-disable` in the feature |
| F20 no storage forgets the view across pages | Closed | Both `INV-006-no-storage-across-pages` probes pass. Mutant: undoing T071 fails `view.test.ts` |

## Invariants

Every saved probe re-ran first. No probe that held in round 2 fails now, apart from one race in the probe itself, described under F24. Reading the enumerations against the probes turned up members no earlier round had run, in INV-002, INV-003, INV-015, INV-031 and INV-034. Each now has a probe, and every one held. Final tally: 477 of 479 unit probes and 214 of 216 browser probes pass, and each failure is accounted for: unit F11 and F12, browser F7 (2). `OOS-staff-font.spec.ts` stays red for FU14, and `OOS-F23-a-pull-under-load.spec.ts` stays red under load for FU19. Neither is an invariant probe.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | **H** × **Den** × 2 surfaces × `showRhythm` × {absent, frets with no marks}, against `baseline.json` | review-probes/INV-001-012-019-020-021-024-harvest.test.ts |
| INV-002 | held | Copy text and Download × **V** × **Den** on a marked variant. New: what was copied in each **V** × **Den**, given to `parseTab`, reads back the seeded frets of both parts | INV-002-…-view.spec.ts, review-probes/INV-002-the-reader-reads-the-export.spec.ts |
| INV-003 | held | 100 changes × {song page, play view} with a reload, signed out and signed in; a second real device. New: the play view signed in, which no round had run | INV-002-…-view.spec.ts, INV-003-015-031-two-devices.spec.ts, review-probes/INV-003-signed-in-play-view.spec.ts |
| INV-004 | held | **N** × {capture, a selection, paste preview, preview after a refusal} | INV-002-…-view.spec.ts |
| INV-005 | held | **N** × {song, play} × {direct, reload, band link, link between the two, offline after a visit}. New: a tab left on frets while another tab chooses notes, the render T064's repair could have exposed, 20 of 20 | INV-002-…-view.spec.ts, review-probes/INV-005-a-tab-left-on-frets.spec.ts |
| INV-006 | held | **St** × {read, set, read again}, all 8. The second tab, and `localStorage` undefined, its getter throwing, `getItem` throwing and `setItem` throwing across the link to the play view and back. Round 2's violation is closed | INV-002-…-view.spec.ts, review-probes/INV-006-no-storage-across-pages.test.ts, INV-006-no-storage-across-pages.spec.ts |
| INV-007 | held | **V** × {song, play} × 2 themes at 375×667; export, BPM, density and note beside it; print; no tuning; no arrangement | INV-002-…-view.spec.ts |
| INV-008 | held | **T** × every string × frets 0 to 36 × {no chord, Am, Bb7} | review-probes/INV-008-009-010-011-013-018-cells.test.ts |
| INV-009 | held | **Q** × 12 pitch classes × **N**, and the worked spellings | INV-008-…-cells.test.ts |
| INV-010 | held | **Dec** × names and degrees × **Den** × repeats 1, 2, 8; the painted face through CDP, with `♭` as a control | INV-008-…-cells.test.ts, INV-014-…-layout.spec.ts |
| INV-011 | held | **N** × harmonic, dead and their combinations × neighbours | INV-008-…-cells.test.ts |
| INV-012 | held | **H** with chords laid on, against `main`'s `chordInForceAt` kept verbatim; **Unread**; the listed anchors | INV-001-…-harvest.test.ts |
| INV-013 | held | All four members | INV-008-…-cells.test.ts |
| INV-014 | held | The five slice starts, a long chord and a column holding its own chord × **V** on the real play view | INV-014-…-layout.spec.ts |
| INV-015 | held | **Load** × {song page, play view} × **N**. Parts, events, annotations, batch and paste as before. New: the sync batch on two real devices × both surfaces × both **N**, which had only run on the song page in frets: 48 runs at 10 workers, no false line in any. 27 arrived as `Same as A`, and 21 never arrived, every one a lost row (FU19), not a page fault. A pull slower than 10 s, a dead pull and a stale `syncing` all hold. Round 2's violation is closed | review-probes/INV-015-031-every-write-every-route.spec.ts, INV-015-031-held-reads.spec.ts, INV-015-a-slow-sync-holds-nothing.spec.ts, INV-015-one-read-one-snapshot.test.ts |
| INV-016 | held | **Rows** × **V** × **Den** × 2 sizes × 2 themes on both surfaces. A 3-digit removal count still overruns: F7 | INV-014-…-layout.spec.ts, INV-016-text-in-its-column.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-017 | held | **V** × **Surf** × 2 sizes × 2 themes, heights, captions and overlap | INV-014-…-layout.spec.ts |
| INV-018 | held | Every table row, **Dec** × **N**, **H** in frets. `Bbbb` still loses its name: F11 | INV-008-…-cells.test.ts |
| INV-019 | held | **H** × every id set × one of each op | INV-001-…-harvest.test.ts |
| INV-020 | held | **F** each exactly 1 changed; **NotF** all Same; keys and bars over **H** | INV-001-…-harvest.test.ts, INV-020-not-compared.test.ts |
| INV-021 | held | **H** × every position × each edit; every group shape of 2 to 7 equal columns × every position × {remove, add into each neighbouring group} | INV-001-…-harvest.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-022 | held | 5,000 seeded pairs, and 20,000 grouped pairs | INV-021-…-compare.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-023 | held | The whole enumerated set, and a second run of the 20,000. Two chords on one anchor stays outside it: F12 | INV-021-…-compare.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-024 | held | **H** × INV-021's edits, the pairs of INV-022, the grouped pairs, `coarse`, empty parts | INV-001-…-harvest.test.ts, INV-021-023-024-the-slide.test.ts |
| INV-025 | held | All six members alone through `npm run test:budget`, 8 of 8; `MAX_EDITS` edges; no clock | INV-021-…-compare.test.ts, `budget.test.ts` |
| INV-026 | held | **Par** × {song, play}, a chain, all three last-pass substitutes, a variant as an entry's own part | INV-026-…-marks.spec.ts, INV-021-…-compare.test.ts |
| INV-027 | held | **Surf** × {each op, additions only, removals only, none}; compact against expanded. The one red run this round was the probe's own race, fixed and 75 of 75 since: F24 | INV-026-…-marks.spec.ts, INV-027-028-029-marks.test.ts |
| INV-028 | held | **V** × **Den** × all five shapes | INV-027-028-029-marks.test.ts |
| INV-029 | held | 20,000+ slices against an independent oracle | INV-027-028-029-marks.test.ts |
| INV-030 | held | Parent, `A x4` passes 1 to 3, text entry, no parent, unrelated substitute; pass 4 equals the song page | INV-026-…-marks.spec.ts |
| INV-031 | held | Five writes × three routes, on both surfaces. New: every write by a real pull (edit parent, edit variant, chord on each, delete a column of each, delete the parent), and a chord and the parent's deletion from a real second tab. "From this tab" is what these pages can do: delete a part, `+ variant`, and a local edit during a sync. Round 2's violation is closed. A row the server never delivers cannot reach the marks, and that is FU19 | review-probes/INV-015-031-every-write-every-route.spec.ts, INV-026-…-marks.spec.ts, INV-015-031-held-reads.spec.ts |
| INV-032 | held | Each mark, gap, line and marked cell × 2 themes × its real ground × {song, play} | INV-026-…-marks.spec.ts |
| INV-033 | held | **Surf** × **V** × each mark | INV-026-…-marks.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-034 | held | 2 schemes × play view × each mark, gap, line, real caption, against white. New: `--diff-tint` and `--diff-ink` read as the print values in dark, with the screen values as a control | INV-014-…-layout.spec.ts, review-probes/INV-034-print-tokens.spec.ts |
| INV-035 | held | Every words row × **F**, removals of 1 and 2, compact | INV-016-033-035-036-staff.test.tsx |
| INV-036 | held | No column moves over **Den** × **V**; a Same variant's markup equals a plain staff; the line runs across a removal, with and without a connector | INV-014-…-layout.spec.ts, INV-016-033-035-036-staff.test.tsx |
| INV-037 | held | Every path of the amended list, exit 0, typecheck clean. `client.ts`'s diff is confined to `applyRemoteRows`, read by hand as well | scripts/untouched-by-reading.sh |
| INV-038 | not checked | — | Person-level at actual size, and owed after merge. T054 stays `🛑 BLOCKED` and unticked, as the plan says |

Mutants, through `review-probes/run-mutants.mjs` in a throwaway tree. Killed by the suite: a pull landing one table at a time (T068), no store forgetting the choice (T071), a first subscribe not re-reading storage (T064), the slide not running (T058, T072). Survived the suite: the song read outside one transaction (F25), which this round's probe kills.

## Findings

- [ ] MINOR F7 — A removal of 100 or more columns overruns its gap by 3.3 px
      where:  src/components/tab/TabStaff.tsx:589
      why:    The gap is a fixed `3ch`, and `−125` measures 29.2 px in 25.9 px. Carried from round 1. It needs 100 columns cut in one run, and it runs only into the next column's own mark row.
      owed:   Size the gap from the text's length. INV-036 already allows the gap's own width as a shift.
      traces: INV-016

- [ ] MINOR F8 — T055 is ticked, but the original second-device test still skips itself
      where:  e2e/reading-sync.spec.ts:49, e2e/reading-helpers.ts:10
      why:    The old test still seeds the fixed band, never drains and skipped in both projects again, which is the `bands_slug_idx` error in the server log. The adopted `INV-003 (two devices)` test at `:123` covers the behaviour. Carried from round 2.
      owed:   Delete the old test, which is now redundant.
      traces: INV-003, T055

- [ ] MINOR F9 — Three of round 1's five weak assertions are still there
      where:  e2e/variant-marks-paint.spec.ts:172, src/lib/reading/__tests__/cells.test.ts:38, src/lib/reading/__tests__/frets-unchanged.test.ts:8
      why:    `.staff-caption` still matches nothing, so that print branch never runs. `cells.test.ts:38` still compares `chordInForceAt` with the map it looks up in. The header of `frets-unchanged.test.ts` still promises a variant it never renders. Each behaviour has a real test elsewhere, so nothing is unguarded. Carried from round 2.
      owed:   Delete the two dead checks and correct the header.
      traces: INV-001, INV-012, INV-034

- [ ] MINOR F11 — `Bbbb` loses its spoken name
      where:  src/lib/reading/spelling.ts:50
      why:    The word regex stops at two accidentals, and only `Cbdim7` reaches a triple flat. String and fret are still spoken. Carried from round 1.
      owed:   Allow a third accidental, or say the name plainly.
      traces: FR-018

- [ ] MINOR F12 — Two chords on one anchor, with rows in the other order, read as changed
      where:  src/lib/chords.ts:404, src/lib/reading/played.ts:64
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

- [ ] MINOR F15 — `partsOf` and `signatureOf` are hand-kept twins with a thin pin
      where:  src/lib/reading/played.ts:37, src/lib/reading/played.ts:71
      why:    The pin covers five fields, so a sixth could drift and the words would disagree with the comparison. Carried from round 1.
      owed:   Derive one from the other, or widen the pin to every field.
      traces: FR-032

- [ ] MINOR F16 — A removal in an empty final bar cannot be reached by a slice
      where:  src/lib/reading/marks.ts:60
      why:    Arrangement bar ranges stop at `countBars`. Only `| |` endings reach it. Carried from round 1.
      owed:   Decide in `usability-pass` whether that bar exists for ranges.
      traces: INV-029

- [ ] MINOR F21 — Three files still have the wrong line endings, against the plan
      where:  specs/006-reading-aids/plan.md:71, src/components/tab/TabStaff.tsx:1, package.json:1, .github/workflows/ci.yml:1
      why:    `TabStaff.tsx` went CRLF to LF, and `package.json` and `ci.yml` LF to CRLF. `hooks.ts` and `queries.ts` are fixed, and their diffs now show only real changes. The other three still show 1,131, 136 and 213 lines for 173, 4 and 3 real ones, which buries them and breaks `git blame`. Nothing behaves differently.
      owed:   Restore each file's ending from HEAD before the commit. `git ls-files --eol -m` shows it in seconds.
      traces: plan.md § Technical Context

- [ ] MINOR F22 — A ternary with the same value on both sides
      where:  src/lib/reading/compare.ts:128
      why:    `dir === 1 ? [x, x + 1] : [x, x + 1]`. It is correct, but it reads as if the directions differ.
      owed:   Drop the condition.
      traces: coherence

- [ ] MINOR F23 — Two adopted sync tests can fail under load, now explained
      where:  e2e/reading-sync.spec.ts:150, e2e/reading-sync.spec.ts:160
      why:    Round 2 asked why the pull misses 30 s. It does not miss it: the row never comes, because the server moved the cursor past it (FU19). Both tests failed once each on mobile in the suite at 8 workers, and the whole spec then passed 54 of 54 at 4 workers. CI retries once, and Playwright's default gives it fewer workers, so a false red there should be rare, though I have not measured it. I kept no error text from those two runs, so tying them to FU19 rests on the wait they share with the 21 classified runs.
      owed:   Nothing here. It goes when FU19 is fixed. Do not lengthen the wait, because no wait reaches a row that is not coming.
      traces: INV-015, INV-031

- [ ] MINOR F24 — The adopted INV-027 test reads the line before the play view can have drawn it
      where:  e2e/variant-marks.spec.ts:276, e2e/variant-marks.spec.ts:277
      why:    In frets the play view draws empty staves before the read lands (plan deviation 11), so `tab-staff.nth(2)` can be visible while `variant-line` is not there yet. The page is right, and the test is racing it. The probe with the same two lines failed 3 of 21 on desktop. The suite's copy of that case passed 30 of 30, so it is rare there.
      owed:   Wait for `variant-line` before reading, as the probe now does.
      traces: INV-027

- [ ] MINOR F25 — The suite cannot tell whether a song is read in one transaction
      where:  src/lib/local/queries.ts:202, src/lib/reading/__tests__/snapshot.test.ts:54
      why:    Deleting the transaction passes all of `snapshot.test.ts`, because each test awaits every write, so nothing ever lands inside a read. Half of INV-015's design is unguarded. The code is right today: `INV-015-one-read-one-snapshot.test.ts` holds on this tree and fails on the mutant.
      owed:   Add that probe to `snapshot.test.ts` (FU23).
      traces: INV-015, plan.md § Agreement is structural

- [ ] MINOR F26 — Two descriptions of the design T068 replaced
      where:  src/lib/reading/__tests__/snapshot.test.ts:114, e2e/reading-sync.spec.ts:287
      why:    The comment says a pull lands "as one transaction per table", and the test is named for a "stuck timer" that no longer exists. Both will mislead whoever next reads why these tests are there.
      owed:   Reword both.
      traces: coherence

- NOTE F17 — The jsdom half of INV-015 is delicate. Inside `act`, or without a pause between commits, it passes with the invariant broken. It does fail on the mutant today, and the two-device spec is still the judge.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU19 — **out of scope, and the most serious thing in this report. Worth a person's eye first.** The server can hand a device a cursor past a row it never sent, and that device then never gets the row. Under 10 workers, each of these was a row on the server, missing from the device, with the device's cursor above the row's `serverSeq`, and a reload did not bring it back: 2 of 24 and 21 of 48 runs on this tree, and 12 of 60 on a build of `main`. `src/lib/server/` has zero diff, so this branch neither caused nor worsened it. Likely mechanism, reasoned and not isolated: `readPull` reads each table in its own statement with no shared snapshot (src/lib/server/sync.ts:226, src/lib/server/sync.ts:238), so a push that commits between the `parts` read and the `events` read gives a page holding the events without the part, and `pullOnce` then stores a cursor above the part (src/lib/sync/client.ts:219). In the 14 reports that recorded the cursor, the lost row was a `parts` row 1 to 6 below it, which fits, though the probe watched only `parts`. The same shape should lose `events` under an existing part, which would show as a permanent false `removed` line here, and on every screen as a device silently holding fewer columns than its bandmates. It needs no load in principle. `changed` goes to every open stream whichever band pushed (src/app/api/sync/stream/route.ts:38), so one band's push makes every device pull, and `runner.ts` itself describes a bandmate pushing in several batches. A device recovers only if the row is edited again or the cursor rewinds. One snapshot per pull closes this shape, but it does not cover two concurrent pushes to one band committing out of `serverSeq` order, so a fix needs to consider both. Evidence: review-probes/OOS-F23-a-pull-under-load.spec.ts, with `playwright.baseline.config.ts` for `main`.
- FU1 — MINOR F7, src/components/tab/TabStaff.tsx:589. Its probe, `INV-014-…-layout.spec.ts:347`, stays red until then.
- FU2 — MINOR F8, e2e/reading-sync.spec.ts:49
- FU3 — MINOR F9, e2e/variant-marks-paint.spec.ts:172
- FU5 — MINOR F11, src/lib/reading/spelling.ts:50. Its probe in `INV-008-…-cells.test.ts` stays red until then.
- FU6 — MINOR F12, src/lib/chords.ts:404. Its probe in `INV-021-…-compare.test.ts` stays red until then.
- FU7 — MINOR F13, src/lib/reading/align.ts:67
- FU8 — MINOR F14, src/lib/local/hooks.ts:98
- FU9 — MINOR F15, src/lib/reading/played.ts:37
- FU10 — MINOR F16, src/lib/reading/marks.ts:60
- FU11 — out of scope: `review-*` files in `src/lib/tab/__tests__/` hit their 5 s timeouts under full parallel load. Not seen this round: 5,849 of 5,849 at 8 workers. The directory has zero diff.
- FU12 — out of scope: load flakes outside this feature, `e2e/grouping-band.spec.ts:218`, `e2e/click-offline.spec.ts:5` and `e2e/sync.spec.ts:100`. None failed this round. `sync.spec.ts` may share FU19's cause.
- FU13 — not a defect: a variant larger than one `PUSH_BATCH` (200 rows), or split across two pull pages (500 rows), can still arrive in pieces. Closing that means changing the wire. Recorded in plan.md's Deviation 14.
- FU14 — out of scope, and worth doing soon: the staff has never been in JetBrains Mono. `.tab-staff` asks for `var(--font-mono)` (src/app/globals.css:184), which `:root` builds from `--font-mono-face`, and only `<body>` has that (src/app/layout.tsx:28). Same on `main`. It changes the look of every staff, so it belongs with `usability-pass`. Evidence: review-probes/OOS-staff-font.spec.ts.
- FU15 — MINOR F21, src/components/tab/TabStaff.tsx:1. Do this before the entry is committed.
- FU16 — MINOR F22, src/lib/reading/compare.ts:128
- FU17 — MINOR F23, e2e/reading-sync.spec.ts:150
- FU18 — every round 1 and round 2 probe is in the suite, except the ones red for F7, F11 and F12 and `OOS-staff-font.spec.ts`. T067, T070 and T072 did as they said.
- FU20 — MINOR F24, e2e/variant-marks.spec.ts:277
- FU21 — MINOR F26, src/lib/reading/__tests__/snapshot.test.ts:114
- FU22 — adopt review-probes/INV-002-the-reader-reads-the-export.spec.ts into `e2e/reading-view.spec.ts`
- FU23 — adopt review-probes/INV-015-one-read-one-snapshot.test.ts into `src/lib/reading/__tests__/snapshot.test.ts`, which closes F25
- FU24 — adopt review-probes/INV-015-031-every-write-every-route.spec.ts into `e2e/reading-sync.spec.ts`. Keep its check that a missing variant is a lost row and not a page fault until FU19 is fixed, and set each test's timeout, because the probe config's does not move with it.
- FU25 — adopt review-probes/INV-034-print-tokens.spec.ts into `e2e/variant-marks-paint.spec.ts`
- FU26 — adopt review-probes/INV-005-a-tab-left-on-frets.spec.ts into `e2e/reading-view.spec.ts`, and review-probes/INV-003-signed-in-play-view.spec.ts into `e2e/reading-sync.spec.ts`
- FU27 — review-probes/OOS-F23-a-pull-under-load.spec.ts is the failing test for FU19's fix, and belongs with that work rather than here. `run-mutants.mjs` and `playwright.baseline.config.ts` are review tools and stay out of the suite.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 33 | 32 | 1 | 0 | 0 |
| Success criteria | 14 | 11 | 3 | 0 | 0 |
| Constitution principles | 0 | 0 | 0 | 0 | 0 |

Partial FR: FR-018 (F11). Partial SCs: SC-012, SC-013 and SC-014, whose automated halves hold and whose person-level halves are INV-038. The constitution is the unfilled template, so it has no principles to count. All of the plan's de facto gates stand, and Offline first passes again.

Project suites, this tree: typecheck clean. `npm run lint` 0 errors and 2 warnings in unrelated files. `npm run check:untouched-reading` exit 0. `npm test` at 8 workers: 5,849 of 5,849. `npm run test:budget`: 8 of 8. `npx playwright test` in three synchronous parts at 8 workers: 2,023 passed, 2 failed (F23), 361 skipped, which accounts for all 2,386.

## What I could not check

- INV-038 and `quickstart.md` §8: a person at actual size in both themes, including `·` visibility, the greyscale capture, scrollbars, and the caption at the very bottom of the card. T054 stays open.
- Real phones. Everything ran in Chromium on Windows with Pixel 7 emulation, so Safari, Firefox and real system fonts are unmeasured.
- FU19's mechanism. That a cursor passes an undelivered row is measured, on this tree and on `main`. Why it does is reasoned from `readPull`, not isolated, and the probe watches `parts` only, so lost `events` rows are predicted and not observed. How often it happens outside a load test is unknown.
- The two F23 failures themselves. My output filter dropped their error text, and the spec passed 54 of 54 when run alone at 4 workers.
- CI's timing, for the budgets and for F23.
- A variant larger than one push batch or pull page across two devices (FU13). Reasoned from `client.ts` and `protocol.ts`, not run.
- The 361 skipped e2e tests, beyond `reading-sync`. The count has not moved since round 2.
