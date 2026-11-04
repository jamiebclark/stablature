# Review: Playing techniques

Reviewed 48 file(s) changed across 0 commit(s), against main (5986674) plus the working tree. `main...HEAD` is empty because all of this work is uncommitted, so the view is `git diff main` (21 modified files, +845 −211) and 27 new files outside `specs/` (3,732 lines). This is the present working tree, not a commit range.

Round 2. Round 1 had two MAJORs and no BLOCKER. Phase 8 (T049 to T063) answered them. Since round 1 only one product file changed, `src/components/ui/index.tsx`; everything else that changed is a test or a test helper.

Read in full: `spec.md`, `plan.md`, `tasks.md`, the round 1 `review.md`, `contracts/notation.md`, `contracts/components.md`, `src/lib/tab/techniques.ts`, `src/components/capture/useLongPress.ts`, `src/components/capture/LatchStrip.tsx`, `src/components/ui/__tests__/Sheet.test.tsx`, `src/lib/__tests__/storage-fence.test.ts`, `e2e/techniques.spec.ts`, `e2e/techniques-finger-on-control.spec.ts`; and the whole diff against main of every non-test source file in the change, `e2e/capture-surface.spec.ts` and `e2e/capture-surface-helpers.ts`.

Sampled: `src/lib/tab/ascii.ts` (to the bracket row), `src/components/capture/CaptureScreen.tsx` (lines 95 to 560, plus the diff), `e2e/techniques-layout.spec.ts`, and `contracts/descriptors.md`, `research.md` and the roadmap by search. All nine adopted e2e specs and three adopted unit tests were compared line by line with their probes: the only differences are the helper import and, in `e2e/techniques-surfaces.spec.ts:115`, the F2 fix.

Not reviewed this round: the bodies of `src/lib/capture/__tests__/*`, `src/components/tab/__tests__/*` and `src/components/capture/__tests__/ColumnInspector-toggles.test.tsx`. They are unchanged since round 1 read them, and they pass.

## Verdict

Yes: this satisfies the spec and hangs together, and I would merge it. There is no BLOCKER and no MAJOR, so `tasks.md` is unchanged. Both round 1 MAJORs are closed and stayed closed: the press record now clears at every open and on every cancel, and the INV-005 test passed 40 of 40 repeats. No probe that held in round 1 fails now. All 27 invariants held over their full enumerations, with INV-027's person-level half still owed to T048, as the plan expects. This round also closed two of round 1's gaps with real comparisons: writes match main exactly on all 7 routes, and the layout matches a real main build in both themes. A technique also went through a real push to Postgres and came back on a second signed-in browser. What remains is six MINORs. Fix one early: `src/lib/__tests__/storage-fence.test.ts` compares against `main`, so it will fail on the next roadmap entry, `generalised-grouping`, which plans a migration (F11).

## Invariants

Gates: `npm run typecheck` and `npm run lint` pass; `npm test` 824 of 824 in 36 files; `npm run test:e2e` 887 passed, 81 skipped, 0 failed, with `e2e/sync.spec.ts` running against Postgres. The skips are mobile-only or desktop-only members. Every `e2e/techniques*` spec three times over: 1,395 passed, 81 skipped, 0 failed.

Round 1's probes, re-run first: all passed, so there is no regression. Final run with this round's additions (`review-probes/run-probes.sh --no-build`): both shell probes pass; vitest 363 of 363; Playwright 506 passed, 76 skipped, 0 failed.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | 6 of 6 fenced surfaces, zero diff against main, and a real push to Postgres with no protocol change | review-probes/INV-001-storage-fence.sh, INV-015-techniques-reach-postgres.spec.ts |
| INV-002 | held | 7 of 7 routes through this branch's `editing.ts` and main's side by side. Whole rows and outbox match, rank and clock values included, so this is stricter than the plan asks | review-probes/INV-002-against-main.test.ts, INV-002-006-013-014-015-016-writes.test.ts |
| INV-003 | held | 3 of 3 export suites with zero diff; width formula; 0 connectors on plain parts | review-probes/INV-003-export-suites-unedited.sh, INV-003-005-023-027-surfaces.spec.ts |
| INV-004 | held | 140 exact cells, all six decorations together, two transitions, on-screen alignment | review-probes/INV-004-007-008-026-layout.test.ts, INV-021-022-structures.spec.ts |
| INV-005 | held | No `techniques` in `ascii.ts` or `TabStaff.tsx`; full fixture on 4 surfaces, compact download included. The suite's own test passed 40 of 40 repeats, so F2 is closed | review-probes/INV-003-005-023-027-surfaces.spec.ts, e2e/techniques-surfaces.spec.ts:86 |
| INV-006 | held | 8 stored forms; 5 delete routes; insert between; paste between; delete the arrival; paste elsewhere; paste at start; variant | review-probes/INV-002-006-013-014-015-016-writes.test.ts, INV-006-positions.spec.ts |
| INV-007 | held | 8 rows, source shapes, `eventsInBars`, barline, rest, dead note, unknown entry, 12 ordered pairs | review-probes/INV-004-007-008-026-layout.test.ts |
| INV-008 | held | 80 exact cases, and the chord on a repeated decorated column | review-probes/INV-004-007-008-026-layout.test.ts |
| INV-009 | held | 24 of 24, truly back to back, both projects | review-probes/INV-009-010-one-shot-and-pairs.spec.ts |
| INV-010 | held | 12 + 4 + 8 | review-probes/INV-009-010-one-shot-and-pairs.spec.ts |
| INV-011 | held | 30 targets; 9 routes × 5 latches; and 4 of 4 chips on a delete that lands on a barline, where stack goes dark and the chip stays lit and truthful. See NOTE F13 for how I read that member | review-probes/INV-011-012-targets-and-routes.spec.ts, INV-011-delete-onto-a-barline.spec.ts |
| INV-012 | held | 10 members, stack dropped on a barline tail included; 5 second-tab members; spec 001's INV-010-r2 passes with `test.fail` removed | review-probes/INV-011-012-targets-and-routes.spec.ts |
| INV-013 | held | Real unawaited clicks, 15 + 6 + 1 + 1, and the write layer | review-probes/INV-013-bursts.spec.ts, INV-002-006-013-014-015-016-writes.test.ts |
| INV-014 | held | 6 decorations × 4 lists × on and off, plus 6 plain | review-probes/INV-002-006-013-014-015-016-writes.test.ts |
| INV-015 | held | Toggles on lists of 6, 7, 8 entries, on and off; insert with a transition; stack onto a full list; 8 accepted, 9 refused; and one real push accepted, with Postgres holding exactly the stored form | review-probes/INV-002-006-013-014-015-016-writes.test.ts, INV-015-techniques-reach-postgres.spec.ts |
| INV-016 | held | 6 of 6 | review-probes/INV-002-006-013-014-015-016-writes.test.ts |
| INV-017 | held | Violated in round 1 (F1), fixed. 7 heights × {mouse, touch}. Touch: a real `detail 1` click reached the controls under the staff at 3 to 7 strings and changed nothing; at 1 and 2 strings no control lies there. After a press that ended without a click, the sheet closed by Escape at 4 to 7 strings (13 of 13 releases changed nothing; round 1 saw stored changes at 4 to 6) and by a second tab at 4 to 6. A dragged finger is cancelled, so a still finger is the only touch release that can land on a control. No toggle or `delete` lies under the staff at any height, so those members rest on the mouse probe and the jsdom cases | review-probes/INV-017-finger-on-a-control.spec.ts, INV-017-sheet-press-record.test.tsx, INV-017-release-over-control.spec.ts, INV-017-close-by-a-second-tab.spec.ts |
| INV-018 | held | 4 tunings, every string played, × 2 themes × 2 projects, with a hit test on each control | review-probes/INV-018-024-sheet-reach.spec.ts |
| INV-019 | held | Strip, neck, both toolbar rows and page scroll deep-equal a real main build in 2 of 2 themes; 8 states × 2 themes; row 2 at ×1 to ×512; 8 status texts × 5 symbols × 2 shapes, at the end and with the cursor on a column | review-probes/INV-019-baseline-any-build.spec.ts, INV-019-020-layout.spec.ts, INV-019-status-after-state.spec.ts |
| INV-020 | held | 5 chips × {unlit, lit, unavailable} × 2 themes, and the mutation: 5 of 5 go from no overflow to overflow on a long label | review-probes/INV-019-020-layout.spec.ts |
| INV-021 | held | Chord on the arrival and on the source; connector inside a tuplet, at its first column and just after its last; caret; barline either side; selection band; the cursor rule across a repeat; a tap on a connector | review-probes/INV-021-022-structures.spec.ts |
| INV-022 | held | 3 surfaces × 2 themes, real selection | review-probes/INV-021-022-structures.spec.ts |
| INV-023 | held | 10 techniques, all six together, dead note, compact repeated, transition with no source, plain columns, capture staff and read-only views. See NOTE F14 for one deliberate change | review-probes/INV-003-005-023-027-surfaces.spec.ts |
| INV-024 | held | 3 routes × 6 toggles × Space and Enter; details tap; 36 unique names on Guitar 6; none during selection | review-probes/INV-018-024-sheet-reach.spec.ts |
| INV-025 | held | Source check on every latch and property id; fabricated descriptors at 1 and 5 latches, 3 and 7 properties | review-probes/INV-025-no-id-branch.test.tsx |
| INV-026 | held | 378 cases | review-probes/INV-004-007-008-026-layout.test.ts |
| INV-027 | held (computed half); not checked (person half) | Computed style for connectors, affixes, chips and toggles × 2 themes. The person-level half needs a person with a phone: T048, SC-008 | review-probes/INV-003-005-023-027-surfaces.spec.ts; FR-039-actual-size-screens.spec.ts saves the pictures that person will look at |

## Findings

- [ ] MINOR F11 — The storage fence test compares against `main`, so it fails on any later branch that is allowed to change the schema, and the next roadmap entry is one.
      where:  src/lib/__tests__/storage-fence.test.ts:21, src/lib/__tests__/storage-fence.test.ts:39, .specify/roadmaps/capture-expression.json:22
      why:    "No stored change" is true of this feature, not of the project. Once this merges, `git diff main` over `src/db`, `drizzle` and `src/lib/model.ts` is non-empty on any branch that touches them. `generalised-grouping` plans a Drizzle migration, so its first `npm test` goes red on a rule that no longer applies. The same goes for a later edit to `ascii.test.ts`. Round 1's FU9 called this the lasting half of INV-001, and that was wrong: it means nothing in a suite, for the reason FU9 gave about the shell probes. Read from code and the roadmap; no later branch exists to run it on.
      owed:   Delete the test once this merges, or pin it to this feature's base. The shell probes keep the check for this review.
      traces: T004, INV-001, INV-003

- [ ] MINOR F12 — The adoption left loose ends in the suite.
      where:  e2e/capture-surface.spec.ts:1024, e2e/capture-surface.spec.ts:1025, e2e/capture-surface.spec.ts:1030, e2e/capture-surface.spec.ts:990, e2e/techniques.spec.ts:22, e2e/techniques.spec.ts:34
      why:    The five-latch test's neck and toolbar checks became `height > 0` and `y > 0`, which cannot fail for the reason they are there. `e2e/techniques-layout.spec.ts` carries the real check, so nothing is unguarded. The comment at :1030 points to INV-018 in a file it moved out of, and the comment at :990 lost its backslash. `e2e/techniques.spec.ts` keeps its own `strip`, `latch`, `STACK` and `expectPressed` beside the shared helpers T053 to T063 moved in. Ten `console.log` measurement lines came across from the probes.
      owed:   Drop the two vacuous lines, fix the comments, use the shared helpers.
      traces: INV-019, T024, T061

- [ ] MINOR F5 — T046 is ticked but the notation is documented nowhere. Open from round 1.
      where:  README.md:115
      why:    T046 says to document the notation table where the project documents its export format. "Getting your work back out" is that place, and neither `README.md` nor `docs/` has changed.
      owed:   Add the notation there.
      traces: T046

- [ ] MINOR F6 — `appliesToColumn` counts every stored fret, not strings in the tuning. Open from round 1, and now driven through the screen.
      where:  src/lib/capture/properties.ts:101, specs/002-playing-techniques/contracts/descriptors.md:232
      why:    A column whose frets all lie beyond the tuning shows a `techniques` row with no toggles. Measured: rows `repeat, chord symbol, techniques, delete`, 0 groups (review-probes/FR-026-frets-beyond-the-tuning.spec.ts). The row is empty, not harmful.
      owed:   Test against the tuning's strings, as the contract says.
      traces: FR-026

- [ ] MINOR F7 — The `details` button is 43 px wide, and its `min-w-11` does nothing. Open from round 1, and the suite now pins the shortfall.
      where:  src/components/capture/CaptureScreen.tsx:614, src/app/globals.css:103, specs/002-playing-techniques/contracts/components.md:142, e2e/techniques-layout.spec.ts:144
      why:    The contract says 44 px. `* { min-width: 0; }` beats the utility, and the computed value is 0 px. Measured 43 px wide and 44 px tall, with row 2 fitting at every repeat width. The adopted test asserts `>= 42`.
      owed:   Give it a width that survives the global rule, raise the test to 44, and re-measure row 2 at ×512.
      traces: FR-032, INV-019

- [ ] MINOR F8 — Stale comment on the latch scope. Open from round 1.
      where:  src/lib/capture/latches.ts:12, src/lib/capture/latches.ts:38
      why:    The comment says `"next-note" for every latch`, but the four new chips declare `scope: "transition"`.
      owed:   Correct or drop the comment.
      traces: FR-025

- NOTE F1 — Closed. The press record now clears on `pointercancel` (src/components/ui/index.tsx:149) and at every open (src/components/ui/index.tsx:138), and not on `pointerup`. Clearing at open covers every way of closing, so Android's back gesture no longer needs its own reasoning. Re-driven with Escape and with a second tab.

- NOTE F2 — Closed. The test now waits for the arrangement write to land (e2e/techniques-surfaces.spec.ts:115): 40 of 40 repeats, and green in all three repeats of the techniques specs.

- NOTE F3, F4 — Closed by T053 to T063. Each adopted file matches its probe apart from the helper import and the F2 wait, and the INV-020 mutation is in the suite at e2e/techniques-layout.spec.ts:221.

- NOTE F9 — Unchanged from round 1. Six spec 001 probes fail by construction, not by regression, starting at `specs/001-capture-control-surface/review-probes/INV-015-r3-label-sets.spec.ts:21`. I did not re-run them.

- NOTE F10 — Unchanged. The limit research R8 accepts, a pasted column deleted before its first delivery, remains as described at `specs/002-playing-techniques/research.md:174`. Recorded so that it reads as accepted, not missed.

- NOTE F13 — A delete that lands on a barline leaves a chip armed while stack goes dark (src/lib/capture/target.ts:42, src/components/capture/CaptureScreen.tsx:155). Read word for word, INV-011 and FR-022 could call that a chip surviving an action that disarms stack. I recorded it as held. Stack is dropped there because a barline cannot hold it, not because of the delete. The plan accepts the same split for a paste ending on a barline, and `contracts/components.md` limits FR-022 to the four routes that clear `armed`. The chip stays lit and the next note matches it (`5-|h9`). If that is not the wanted reading, it is a small change.

- NOTE F14 — A compact repeated plain column now reads `string 1 fret 7, repeated 3 times` where main read `string 1 fret 7x3` (src/lib/tab/layout.ts:204). That is a plain description changing, which INV-023 rules out word for word, but it follows the contract's wording at `specs/002-playing-techniques/contracts/descriptors.md:82` and FR-017's rule against reading marks out as text. It is the better text. Read from code.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F11, src/lib/__tests__/storage-fence.test.ts:21. Do this before or with `generalised-grouping`.
- FU2 — MINOR F12, e2e/capture-surface.spec.ts:1024
- FU3 — MINOR F5, README.md:115
- FU4 — MINOR F6, src/lib/capture/properties.ts:101
- FU5 — MINOR F7, src/components/capture/CaptureScreen.tsx:614
- FU6 — MINOR F8, src/lib/capture/latches.ts:12
- FU7 — out of scope: a second mid-part press arriving before the first is delivered may append to the part's end through `insertColumn`'s unknown-id fallback, src/lib/local/editing.ts:274. Present on main. Read from code; the ordering was not measured.
- FU8 — out of scope: retire or rebase the six stale spec 001 recipes in F9. They belong to that entry's probes and were not edited here.
- FU9 — adopt review-probes/INV-017-release-over-control.spec.ts. Its mouse half is the only test that moves a held mouse onto a sheet control and releases it there, and T050 adopted only the touch half.
- FU10 — adopt review-probes/INV-017-close-by-a-second-tab.spec.ts into the suite.
- FU11 — adopt review-probes/INV-011-delete-onto-a-barline.spec.ts into the suite once NOTE F13's reading is confirmed.
- FU12 — adopt review-probes/INV-019-status-after-state.spec.ts into the suite.
- FU13 — adopt review-probes/INV-015-techniques-reach-postgres.spec.ts into `e2e/sync.spec.ts`. No test there carries a technique.
- FU14 — adopt review-probes/FR-026-frets-beyond-the-tuning.spec.ts, inverted, when F6 is fixed. Today it pins the defect.
- FU15 — no adoption needed: review-probes/INV-001-storage-fence.sh, INV-003-export-suites-unedited.sh, INV-002-against-main.test.ts and INV-019-baseline-any-build.spec.ts all compare this branch with main, so they mean nothing in a suite.
- FU16 — no adoption needed: review-probes/FR-039-actual-size-screens.spec.ts asserts nothing about legibility. It saves pictures for whoever does T048.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 40 | 39 | 1 (FR-039: person pass owed) | 0 | 0 |
| Success criteria | 10 | 9 | 1 (SC-008: person pass owed) | 0 | 0 |
| Plan invariants | 27 | 26 | 1 (INV-027: computed half only) | 0 | 0 |
| Constitution principles | 0 | 0 | 0 | 0 | 0 |
| De facto gates (plan § Constitution check) | 9 | 8 | 1 ("Browser testing is part of done": T048) | 0 | 0 |

The requirements were judged through the invariants, this round's reading of the diff, and round 1's pass over each one, which still applies because only `Sheet` changed in product code. The constitution is still the unfilled template, so nothing ratified applies. The plan's nine gates from `docs/DECISIONS.md` stand in for it.

## What I could not check

- **The person-level pass (T048, FR-039, SC-008, INV-027's second half).** Nobody has looked at this at actual size on a phone for legibility. The slash glyphs remain the likeliest thing to need adjusting. T048 stays open and owed after merge, as the plan says.
- **A real phone.** All touch evidence is Chromium's Pixel 7 emulation driven through CDP touch events. How a physical screen treats a nearly still finger is untested.
- **Android's back gesture as a close.** It was not driven. It no longer matters to F1, because the record clears at every open however the sheet closed.
- **Screen readers on real devices.** The Sheet passes a `detail 0` click and needs a press inside for any other. If a screen reader's activation arrives as a `detail 1` click with no `pointerdown`, the toggle would be dropped. Chromium's keyboard route is tested; TalkBack and VoiceOver are not.
- **Two real devices.** Multi-device behaviour was covered by a second tab and by a second browser context on one machine, through the local server and Postgres.
- **F11 on a real later branch.** No such branch exists yet, so that failure is reasoned from the test and the roadmap, not observed.
