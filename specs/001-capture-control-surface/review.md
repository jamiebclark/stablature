# Review: Restructure the capture control surface

Reviewed 25 file(s) changed across 0 commit(s), against main...working tree (`ddb33ea`; the branch
has no commits of its own, so the whole feature is uncommitted: 7 modified files plus 18 untracked
ones outside `specs/`).
Round 5 (rounds 1 to 4 are `## Phase 7`, `## Phase 8`, `## Phase 9` and `## Phase 10: Review remediation`, T039–T083).
Read in full: `src/components/capture/{CaptureScreen,ColumnInspector,LatchStrip}.tsx`,
`src/components/capture/useLongPress.ts`, `src/lib/capture/{target,controls,cursor,latches,properties}.ts`,
`src/components/capture/__tests__/ColumnInspector.test.tsx`, and the whitespace-insensitive diffs of
`src/components/tab/TabStaff.tsx`, `src/components/ui/index.tsx`, `src/components/capture/Fretboard.tsx`,
`src/app/globals.css`, `e2e/capture.spec.ts`, `.specify/roadmaps/capture-expression.json`.
Sampled: `e2e/capture-surface.spec.ts`, lines 505–530, 620–690 and 905–990, which hold T080's and T082's adoptions.
Run but not re-read: the other unit test files, `e2e/capture-surface-helpers.ts` and the rest of
`e2e/capture-surface.spec.ts`. Nothing in the diff was skipped.

The only source file changed since round 4 is `src/components/capture/ColumnInspector.tsx`, by T081. So this round
re-ran everything, and read hardest around that one change.

Gates run this round: `npm run typecheck` clean, `npm run lint` clean, `npm test` 340/340. `npm run test:e2e` ran
**three times in a row, 428 passed and 54 skipped each time, 0 failed**, including the Postgres-backed `e2e/sync.spec.ts`.
The 54 skipped are the 24 touch members and T082's 30 members, which all skip on desktop. T083's repeat
(`-g "chord symbol clear: toolbar|chord clear: both surfaces" --repeat-each=40`) gave **160 passed, 0 failed**; round 4
had 19 failures in that same run.

Added stress, because a flake is what blocked last round: both capture specs at `--repeat-each=3` gave 1224 passed, 0
failed, 162 skipped. Both specs at `--workers=3`, roughly a small CI box, gave 408 passed, 0 failed, 54 skipped. The
`INV-010-r3-latch-across-inspector` and `INV-004-r4` probes at `--repeat-each=15` gave 150 of 150.

Probes, re-run first, before anything else was written: `run-probes.sh` reports 314 passed, 102 skipped, 0 failed, with
the `test.fail` paste member still failing as marked. `INV-013`, `INV-013-r2` and the `INV-015` vitest probe all exit 0.
No regression. This round adds 1 probe file with 7 members; the last run on a fresh build gives 328 passed, 102 skipped,
0 unexpected. That 328 counts 6 runs that fail as marked: the paste member, and F26's two members, on both projects.

`main` was rebuilt in a temp directory, and every "than `main`" below is a measurement on both builds. Mutations ran in a
temp copy, never in the working tree, and both trees are deleted.

## Verdict

**Ready to merge: no BLOCKERs and no MAJORs.** Round 4's one MAJOR is closed. The e2e gate is now green on every run
tried, about 3,200 passing test runs in all, including a 3-worker run, and T081 removes the cause rather than hiding it: reverting it in a temp
copy fails all 20 runs of T080's adopted tests, for the right reason. All 16 invariants hold over their full enumerations
and no probe regressed. The fix did leave one small new defect (F26): a `set` that stores nothing new keeps its text in the
field. It writes nothing wrong and is cheap to fix later. Line endings (F27) are the one finding best fixed before the
first commit, because after that the fix is itself a whole-file diff. Neither blocks. Two things remain for a person: the
Chrome pass at actual size, and a long press on a real phone (§ What I could not check). No REDESIGN applies, because no
round has had a BLOCKER in any component.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | 17 of 17 actions, both projects | review-probes/INV-001-every-action-reachable.spec.ts |
| INV-002 | held | 6 targets × 9 controls = 54 of 54, both projects, plus row 2 across mid-part inserts | review-probes/INV-002-toolbar-presence.spec.ts, INV-002-r2-row-during-insert.spec.ts |
| INV-003 | held | the plan's 5 controls × 2 directions = 10 of 10, plus the armed-latch members and 4 column kinds × {armed, unarmed} × 2 directions, both projects | review-probes/INV-003-stable-positions.spec.ts, INV-003-r2-armed-latch-no-shift.spec.ts, INV-003-r3-every-column-kind.spec.ts |
| INV-004 | held | 6 of 6 by export parity and by stored rows, both projects; delete's cursor at 4 positions; 3 deletes of a column the cursor is not on. The two chord-clear members now finish on 160 of 160 runs. Added: 7 `set` shapes through the sheet. F26's two members keep stale text in the field but store the same as the toolbar, so parity holds | e2e/capture-surface.spec.ts:583, e2e/capture-surface.spec.ts:677, e2e/capture-surface.spec.ts:683, e2e/capture-surface.spec.ts:2557, review-probes/INV-004-r3-stored-row-parity.spec.ts, INV-004-r4-sheet-draft-gap.spec.ts, INV-004-r5-set-settles.spec.ts |
| INV-005 | held | 3 surfaces × {mouse, touch} = 6 of 6 | review-probes/INV-005-no-inspector-readonly-or-selection.spec.ts |
| INV-006 | held | 7 of 7 plan members, plus keyboard Enter after a mouse and after a touch long press, plus a touch tap straight after dismissal | review-probes/INV-006-tap-not-delayed.spec.ts, INV-009-r2-touch-dismissal.spec.ts |
| INV-007 | held | 6 drags × {mouse on both projects, touch on mobile} = 18 of 18, plus a real touch drag scrolling the staff | review-probes/INV-007-moved-press-is-neither.spec.ts, INV-007-r2-touch-drag-scrolls.spec.ts |
| INV-008 | held | 5 of 5 routes, both projects | review-probes/INV-008-inspector-closes-when-column-gone.spec.ts |
| INV-009 | held | 3 routes × 3 positions = 9 of 9, both projects, plus 3 of 3 routes by real touch | review-probes/INV-009-dismiss-changes-nothing.spec.ts, INV-009-r2-touch-dismissal.spec.ts |
| INV-010 | held | 7 of 7 routes plus history back, and 8 routes through the sheet with `stack` armed, both projects. Delete measured on both builds: with a column before it, armed on both; on the first column, `main` stays lit and inert, this branch goes dark. F14 (paste) is a separate behaviour change, still MINOR | review-probes/INV-010-latch-never-armed-inapplicable.spec.ts, INV-010-r2-transient-and-part-routes.spec.ts, INV-010-r3-latch-across-inspector.spec.ts, INV-010-r3-delete-any-build.spec.ts |
| INV-011 | held | 2 themes × 2 targets = 4 of 4. The neck measures 202, 238, 274 and 310 px for 4, 5, 6 and 7 strings on **both** builds, re-measured this round | e2e/capture-surface.spec.ts:748, review-probes/INV-012-r3-every-tuning-any-build.spec.ts |
| INV-012 | held | 12 of 12 on its letter. Chord row 8 of 8; `main` fails the 4 tuplet members at 7.4 px, re-measured. 30 status-row states, none clipped more than `main`, now in the suite; F23 records what both builds do when that row wraps | e2e/capture-surface.spec.ts:770, e2e/capture-surface.spec.ts:816, e2e/capture-surface.spec.ts:865, e2e/capture-surface.spec.ts:959, review-probes/INV-012-r3-chord-row-any-build.spec.ts, INV-012-r3-selection-any-build.spec.ts, INV-012-r4-status-row-any-build.spec.ts |
| INV-013 | held | fenced paths unchanged vs main, tracked and untracked; both export suites unedited | review-probes/INV-013-export-untouched.sh, INV-013-r2-guard-false-positive.sh |
| INV-014 | held (automated half) | 5 pairs × 2 themes = 10 of 10 by computed style. The visual half is not re-checked this round, see § What I could not check | e2e/capture-surface.spec.ts:1168, review-probes/INV-014-r3-armed-chip.spec.ts |
| INV-015 | held | all 5 jsdom members, plus at real width: five latches with 2 label sets, and six properties on 2 shapes | review-probes/INV-015-descriptor-layout.test.tsx, INV-015-r3-phone-width.spec.ts, INV-015-r3-label-sets.spec.ts |
| INV-016 | held | 6 of 6 behavioural members via `e2e/capture.spec.ts`, plus tap-to-extend by real touch and a real hold that does not extend | review-probes/INV-016-selection-toolbar.spec.ts, FR-014-r3-column-shapes.spec.ts |

## Findings

- [ ] MINOR F26 — T081's draft is never dropped by a `set` that stores nothing new
      where:  src/components/capture/ColumnInspector.tsx:110, src/components/capture/ColumnInspector.tsx:117, src/components/capture/ColumnInspector.tsx:127, src/lib/local/editing.ts:535
      why:    T081 drops the draft when `current` changes, but `setChord` trims (editing.ts:535), so `"Am "` over a stored
              `"Am"`, or `"   "` over no chord, never changes `current`. Measured: the field keeps `"Am "`, `set` stays
              enabled, and in the `"Am "` case each further press queues one more outbox row (2 presses, 2 rows). Before T081
              the draft dropped on resolve, so by the code the field went back to `"Am"`; that part was read, not measured.
              This is new this round, but it is small: the stored chord is right, the same as the toolbar's, and a real
              edit or a dismissal clears it. A padded set that does change the chord, such as `" Am "` over no chord,
              settles correctly. The rows are the same kind of no-op write as F7's.
      owed:   Compare what was sent after normalising, or let the property say what a value will read as, so a `set` that
              cannot change `current` drops its draft on resolve. Keep it free of id branching. Then remove the two
              `test.fail` marks in review-probes/INV-004-r5-set-settles.spec.ts.
      traces: FR-018, T081

- [ ] MINOR F27 — Four files in the feature are CRLF where `src/` and `e2e/` have none, and two of them rewrite every line
      where:  src/components/tab/TabStaff.tsx:1, src/components/ui/index.tsx:1, e2e/capture-surface.spec.ts:1, src/components/capture/__tests__/ColumnInspector.test.tsx:1
      why:    `git ls-files --eol` gives `i/lf w/crlf` for TabStaff.tsx and ui/index.tsx, and no file under `src/` or `e2e/` has
              CRLF at HEAD. There is no `.gitattributes` and `core.autocrlf` is false, so nothing will normalise them. The
              diff is 717 lines for 77 real ones in TabStaff.tsx, and 258 for 50 in ui/index.tsx. Earlier rounds read `-w` diffs,
              which hide this. Nothing misbehaves, but committed as it stands, `git blame` on both files points at this
              feature, and `playing-techniques` is about to edit TabStaff.tsx.
      owed:   Convert the four files to LF before the first commit. After it, the fix is another whole-file diff.
      traces: plan § Summary (a re-arrangement, no change to how tab is drawn)

- [ ] MINOR F23 — When the status row wraps, a part with a tuplet loses its chord row, on `main` and on this branch alike (carried from round 4)
      where:  src/components/capture/CaptureScreen.tsx:372, src/components/capture/CaptureScreen.tsx:396, src/components/capture/CaptureScreen.tsx:292
      why:    Nothing stops the status row wrapping, and at 375 px it does so with ordinary chords. Of 15 states on the tuplet
              part, 8 wrap, and the chord label is then clipped out of view. `main` wraps the same 8 and clips 24.2 px, re-measured
              this round, so this is not this branch's doing, and the status row still names the chord in force. T082 now
              pins "no worse than `main`" in the suite.
      owed:   Keep the status row on one line. Measured in round 4 and NOT sufficient: `shrink-0 whitespace-nowrap` on the
              status text alone.
      traces: FR-028, story 3 scenario 3, INV-012

- [ ] MINOR F24 — The suite's five-latch test cannot see a label that does not fit (carried from round 4)
      where:  e2e/capture-surface.spec.ts:1045, src/components/capture/LatchStrip.tsx:39
      why:    With `whitespace-nowrap` on the chip, "stays on one line" cannot fail, and T071's adoption left out the probe's
              `overflows` check. The labels declared for later entries fit today, so nothing is wrong on screen.
      owed:   Carry `overflows` from review-probes/INV-015-r3-phone-width.spec.ts:55 into the suite's test.
      traces: SC-007, FR-008, plan gate "Tests must be able to fail for the right reason"

- [ ] MINOR F14 — The render-time prune disarms the latch on a mid-part paste, which `main` does not (carried from round 2)
      where:  src/components/capture/CaptureScreen.tsx:141, src/components/capture/CaptureScreen.tsx:132, src/components/capture/CaptureScreen.tsx:488
      why:    The prune trusts `target`, which is "no-column" while the cursor names a column the live query has not delivered
              yet. Still failing as marked in review-probes/INV-010-r2-transient-and-part-routes.spec.ts:23.
      owed:   Prune only against a settled target. The roadmap's `playing-techniques` entry carries this.
      traces: FR-005

- [ ] MINOR F15 — A landscape phone now needs page-level scrolling, where `main` needed none (carried from round 2)
      where:  src/components/capture/Fretboard.tsx:119, src/components/capture/Fretboard.tsx:124
      why:    `overflow-x-auto` moved from the neck's wrapper to the inner grid, so on a short viewport the wrapper holds its full
              height. Measured at 667×375 in round 4; Fretboard.tsx has not changed since. The plan's smallest viewport holds.
      owed:   Let the neck's wrapper shrink again on short viewports without changing its height at 375×667.
      traces: FR-026

- [ ] MINOR F21 — INV-012's `four` shape can silently measure a five-string part (carried from round 3)
      where:  e2e/capture-surface.spec.ts:699, e2e/capture-surface.spec.ts:801
      why:    `startFourString` waits on text that is on screen before "Make default" lands, then navigates. The test asserts only
              `rowCount > 0`, so it passes either way. A five-string part is the harder case, so a lost race cannot hide a real failure.
      owed:   Wait for the default to move, and assert the string count.
      traces: INV-012

- [ ] MINOR F5 — `CaptureScreen` still computes its own `editable` and gates the contextual row with it (carried from round 1)
      where:  src/components/capture/CaptureScreen.tsx:129, src/components/capture/CaptureScreen.tsx:519
      why:    The plan says `CaptureScreen` no longer computes `editable`. They agree today (INV-002 over 54 pairs), but a change to
              the table at src/lib/capture/target.ts:39 would not reach row 2.
      owed:   Gate row 2 on `isPresent` and derive `propCtx` from `targetEvent("column-property", target)`.
      traces: plan § Blast-radius "Who owns the applicability rule?"

- [ ] MINOR F6 — `Cursor` is declared twice (carried from round 1)
      where:  src/components/capture/CaptureScreen.tsx:84, src/lib/capture/cursor.ts:4
      why:    T009 said the type moves to `cursor.ts`. It was copied, so the two can drift.
      owed:   Import it from `@/lib/capture/cursor`.
      traces: contracts/descriptors.md `cursor.ts`

- [ ] MINOR F7 — The inspector's "one fewer" is live at ×1, where the toolbar's is disabled, and writes a no-op row (carried from round 1)
      where:  src/components/capture/ColumnInspector.tsx:60, src/components/capture/CaptureScreen.tsx:544
      why:    At ×1 `bumpColumnRepeat(event, -1)` clamps to 1 but still writes, stamping a new clock and queueing an outbox row that
              can win over a concurrent edit from another device.
      owed:   Disable the decrement when `read(ctx) <= 1`, through a descriptor-level `min`, so the component stays free of id branching.
      traces: FR-018, SC-009

## Earlier findings, re-checked

| Finding | Status | Evidence |
|---|---|---|
| F22 the e2e gate flaked on the sheet's draft | closed | 160 of 160 at T083's repeat (round 4: 141 of 160); `seen` is `["Am"]` and the clear typed in the gap is not lost, on both projects. Mutation M1 (T081 reverted): 20 of 20 adopted runs fail, on the value the field falls back to. Mutation M3 (same revert, unit level): `drops the draft once the live row shows it` fails, so T081's unit test can fail too |
| F25 T079 read as a clean gate | closed | T083 replaced a single green pass with the repeat, and it reproduces here |
| INV-012 status-row states not in the suite | closed | T082's 30 members run on `mobile`. Mutation M2 (status row `py-1` to `py-4`): 16 of 30 fail on "no more clipped than on main", at 22.4 and 40 px against bars of 6.6 and 24.2. The other 14 pass, so the test discriminates |
| F18, F19, F20 | closed, still | every earlier probe still passes; 6 and 7 strings re-measured on both builds |
| F1–F4, F8, F9, F12, F13 | closed, still | every earlier probe still passes |
| F5, F6, F7, F14, F15, F21, F23, F24 | open, still MINOR | carried above with current line numbers |
| F10, F11, F16, F17 | unchanged NOTEs | src/components/ui/index.tsx:1, src/app/globals.css:310, e2e/capture.spec.ts:212, contracts/components.md:19. Nothing to do until those files are next touched |

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F27, src/components/tab/TabStaff.tsx:1. **Best done before this feature's first commit**, which is the one follow-up with a deadline.
- FU2 — MINOR F26, src/components/capture/ColumnInspector.tsx:110. Do this before an entry adds a second text property to the sheet, since each one inherits it.
- FU3 — MINOR F24, e2e/capture-surface.spec.ts:1045. Do this before `playing-techniques` declares its labels.
- FU4 — MINOR F14, src/components/capture/CaptureScreen.tsx:141. The `playing-techniques` entry in .specify/roadmaps/capture-expression.json already carries this as MUST HANDLE.
- FU5 — MINOR F23, src/components/capture/CaptureScreen.tsx:372.
- FU6 — MINOR F15, src/components/capture/Fretboard.tsx:119.
- FU7 — MINOR F21, e2e/capture-surface.spec.ts:699.
- FU8 — MINOR F5, src/components/capture/CaptureScreen.tsx:129.
- FU9 — MINOR F6, src/components/capture/CaptureScreen.tsx:84.
- FU10 — MINOR F7, src/components/capture/ColumnInspector.tsx:60.
- FU11 — out of scope: strings hidden with no way to reach them, because `justify-end` overflows upward (src/components/capture/CaptureScreen.tsx:292). A seven-string part hides 4 of 7, the same as `main`, re-measured. Making the overflow reachable would be a design change to the staff, and FR-028 asks for no vertical scrolling.
- FU12 — For entries that add inspector properties: F2's fix stops the release's click dismissing the sheet, not activating a control under the finger. With six rows the sheet's top reaches 225 px and the columns end at 232.8 px. review-probes/FR-014-r2-release-over-sheet-control.spec.ts asserts clearance at three rows only.
- FU13 — Update contracts/components.md (F17), the stale tick note (F16) and research.md §3's budget table next time those documents are touched.
- FU14 — adopt review-probes/INV-004-r5-set-settles.spec.ts into `e2e/capture-surface.spec.ts` with F26's fix. Its five passing members are worth keeping now.
- FU15 — Not adopted, on purpose: FR-029-r4-actual-size.spec.ts and INV-014-r2-unavailable-chip.spec.ts (their output is a screenshot for a human eye); INV-012-r2-measure-any-build.spec.ts, INV-012-r3-every-tuning-any-build.spec.ts and INV-010-r3-delete-any-build.spec.ts with playwright.baseline.config.ts (they need a separate build of `main`, and their output is numbers); INV-013-r2-guard-false-positive.sh (its subject is deleted); INV-012-r3-budget-recipe.spec.ts (delete it, T070 and T072 have landed); INV-012-r3-four-string-is-four.spec.ts (F21's fix replaces it); and the paste member of INV-010-r2 (marked `test.fail` until F14 is fixed).
- FU16 — `review-probes/` itself: keep it until the last adoption, then delete the directory. Do not delete INV-015-r3-phone-width.spec.ts before F24 is fixed, because it is now the only check that a label fits its chip.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted | Not checked |
|---|---|---|---|---|---|---|
| Plan invariants | 16 | 16 held | — | — | 0 violated | 0 |
| Functional requirements | 30 | 26 | 3 (FR-005 F14; FR-026 F15, landscape only; FR-028 F23, no worse than `main`) | 0 | 0 | 1 (FR-029) |
| Success criteria | 11 | 11 | 0 | 0 | 0 | 0 |
| Acceptance scenarios (US1 4, US2 5, US3 9) | 18 | 17 | 1 (US3-3 on a tuplet part with a wrapped status row, F23, no worse than `main`) | 0 | 0 | 0 |
| Edge cases | 8 | 8 | 0 | 0 | 0 | 0 |
| Constitution principles (template unfilled; plan's 8 de facto gates) | 8 | 5 | 2 (domain rules in `src/lib` F5; tests fail for the right reason F21, F24) | 0 | 0 | 1 (browser pass) |

**A call a human may want to overturn.** The review rubric's MAJOR includes "an obligation is partially satisfied", and three
requirements above are partial. They stay MINOR, as in earlier rounds, because none of them misbehaves on the spec's own terms.
FR-005 (F14): paste is arguably an action that means the capturer has moved on, the visible state stays honest and no data
is touched, and the next entry already has to fix it. FR-026 (F15): landscape is below the plan's stated smallest viewport of 375×667,
and the neck stays reachable by scrolling the page. FR-028 (F23): `main` does the same or worse in every state measured.

FR-012 and SC-005 count as satisfied under plan Deviation 1: `triplet` is absent on a barline, and the five stable controls hold.

Cross-pass coherence checked: one applicability module called by the toolbar, the strip and the inspector (one inline leftover,
F5); one mutation path through `properties.ts` `commit` for both surfaces, confirmed in the stored rows; one cursor-repair
function called by both deletes; the inspector derives its properties from the inspected column
(src/components/capture/CaptureScreen.tsx:647), not the cursor's. No dead code. Toolbar logic was compared line by line against `main`:
delete's cursor, `×4` as `+3`, the triplet range and the explicit disarms all match. The seam round 4 found, between the `commit`
promise and the live query, is closed; F26 is what is left of it, for a write the live query never reports.

## What I could not check

- **FR-029 and INV-014's visual half, as a person in Chrome.** T037's pass came before Phase 9 shrank the chip text and tightened
  three rows. Round 4 looked at headless renders only, and Phase 10 changed nothing visual, so that evidence stands but no person
  has seen the final state. The post-merge Chrome pass should look once at the chip text and the tighter rows.
- **A real phone.** All touch evidence is Chromium's touch emulation through CDP on the `mobile` project. Android Chrome and iOS
  Safari may route a long press through `contextmenu`, or cancel the pointer early. A human should long-press a column on a real
  phone. The soft keyboard over the sheet's chord field needs the same check.
- **The gate on a real CI runner.** The 3-worker run approximates a small box on a 24-core machine. It is not a GitHub runner.
- **SC-007 and SC-008 by real declaration.** The evidence appends clones of the rendered chip and row to the live DOM, which
  exercises the real CSS at the real width but not a declared descriptor. The jsdom tests cover the declared path.
- **Screen-reader output** of `aria-pressed` and the dialog's name. Attributes are verified, speech is not.
- **Sync across real devices.** `e2e/sync.spec.ts` is green against Postgres, but the deletes in INV-008 and INV-010 are a second
  tab sharing IndexedDB, not a second device.
- **F15 this round.** Its 105 px figure is from round 4. It was not re-measured, because Fretboard.tsx has not changed since.
