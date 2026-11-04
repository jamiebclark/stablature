# Review: Generalised grouping

Reviewed 57 file(s) changed across 0 commit(s), against 421b130...HEAD. The branch still has no commits of its own (`main` and `HEAD` are both 421b130), so this is a review of the uncommitted working tree: 18 modified files, 1 deleted, 38 new, outside `specs/`.
Round 4. Read in full: `spec.md`, `plan.md`, `tasks.md`, the round 3 `review.md`, the diff of the 18 modified tracked files (the 19th is the deletion FR-036 asks for), `src/lib/capture/grouping.ts`, `e2e/grouping-band.spec.ts`, `e2e/grouping-helpers.ts`, `review-probes/INV-013-band.spec.ts`, `review-probes/INV-013-reachable.spec.ts`, and `review-probes/probe-helpers.ts`. Sampled: the last implement pass's tool calls and its closing report, every expanded name of the 345 unit probe cases against the plan's "Holds over" column, `applyPatch` in `src/lib/sync/merge.ts`, `patchRow` in `src/lib/local/mutate.ts`, `src/lib/server/sync.ts:170`, `quickstart.md` §5. Not read: the bodies of the other adopted tests and browser probes, which were run; `drizzle/meta/0004_snapshot.json` (generated; INV-025 covers what it produces); `contracts/`, `data-model.md`, `research.md` and the rest of `quickstart.md`, which were only searched for six-string wording the amendment left stale, and none was found.

## Verdict

Yes: this satisfies the spec and hangs together, and it is ready for a human to merge. There is no BLOCKER and no MAJOR, so `tasks.md` is unchanged. Round 3's one MAJOR, F24, is closed: the product owner chose Option A, FR-020, SC-009 and INV-013 were amended, and the amended invariant holds. Through real touch input a six-string part has exactly one string out of view at rest, while selecting and after the action, in all 8 six-string cells, and four and five strings have none out of view in their 16. The last implement pass reported the opposite for a chord row, that it hides two strings and breaks FR-020. That is wrong: the "2" is Playwright's `click` scrolling the band to -52 px, which no finger does, and putting the band back reads 1. That report left one real defect behind, MINOR F27: the suite now allows two strings for that state, with a comment saying the band still needs fixing, which it does not. No product code changed this round, and no probe regressed. Two things stay owed by design and neither gates the merge: the person-level pass (T055), which should also judge Deviation 1, and T056's human sign-off.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | Selections of 2 to 40 × 6 shapes × 2 kinds and ungroup, 468 cases, plus rest and repeat 512 and legacy rows, through the real `pushRequestSchema` and batching | review-probes/INV-001-wire.test.ts |
| INV-002 | held | Counts 2 to 16 × 3 variants × 2 densities in the library; the same 45 on screen; live extension 2 to 17 | review-probes/INV-002-agreement.test.ts, review-probes/INV-002-012-controls.spec.ts |
| INV-003 | held | 4 grouping actions × 6 barline shapes × 2 cursor positions × 3 sizes, 144 cases, and a barline arriving between render and tap for the offer and for the triplet | review-probes/INV-003-barlines.test.ts |
| INV-004 | held | 8 overlap cases × 4 kind combinations, the button over `a b c` then `d` for both kinds, an old cross-bar group × 4 actions, 39 cases | review-probes/INV-004-dissolve.test.ts |
| INV-005 | held | All 6 actions × edit the variant or the parent, with two variants of one parent | review-probes/INV-005-008-action-set.test.ts |
| INV-006 | held | All 6 actions × over a tuplet or plain group; 3 merge pairs, each both ways. `applyPatch` clocks every patched field whether or not its value changed, so plain over plain keeps three equal clocks | review-probes/INV-005-008-action-set.test.ts |
| INV-007 | held | All 6 actions, failing at every N | review-probes/INV-005-008-action-set.test.ts |
| INV-008 | held | All 6 actions over columns holding techniques, a repeat, a chord, a rest and a `durationHint`; a selected column that joins nothing | review-probes/INV-005-008-action-set.test.ts |
| INV-009 | held | Local, queued and pulled rows with no key, both clock cases, clipboards grouped and ungrouped; a queued row with no key pushed beside a plain group of 20 and read back from live Postgres | review-probes/INV-009-010-legacy-and-wire.test.ts, review-probes/INV-009-queued-row-reaches-postgres.spec.ts |
| INV-010 | held | 7 rejected `groupKind` values, 3 rejected counts, every accepted value | review-probes/INV-009-010-legacy-and-wire.test.ts |
| INV-011 | held | Copy, cut, variant, partial copy × 3 kinds; new-column routes all null | review-probes/INV-011-carried.test.ts |
| INV-012 | held | The whole truth table in the library; on screen 9 rows ungrouped, 6 grouped, each step 2 to 17, a group arriving from a second tab | review-probes/INV-012-offer.test.ts, review-probes/INV-002-012-controls.spec.ts |
| INV-013 | held | As amended. 2 themes × 3 string counts × 2 rows × 2 numerals, 24 of 24, each at rest, while selecting with all seven controls, and after the action, 72 measurements through real taps: 0 out of view at four and five strings, exactly 1 at six, band never moved, page never scrolled. Swipe reach at rest and, new this round, while selecting. Both shorter control orders | review-probes/INV-013-real-taps.spec.ts, review-probes/INV-013-band.spec.ts, review-probes/INV-013-reachable.spec.ts |
| INV-014 | held | 3 actions × end, mid-part, truly on a barline, 9 of 9 on both projects | review-probes/INV-014-015-cursor-and-names.spec.ts |
| INV-015 | held | Tuplet at 2, 3, 16; group; ungroup; sheet row; existing locators | review-probes/INV-014-015-cursor-and-names.spec.ts |
| INV-016 | held | The library table, 22 cases, then on screen place, name, title, refusal by store and export, barline at each position, a burst with no wait | review-probes/INV-016-run.test.ts, review-probes/INV-016-018-button-and-sheet.spec.ts |
| INV-017 | held | All 10 named routes on both projects; 4 ways back; chord in force, chord form and stack armed at 3 string counts; the whole sentence and both jump buttons on one row beside 4 chords and none | review-probes/INV-017-refusal-routes.spec.ts, review-probes/INV-017-refusal-legible.spec.ts, review-probes/INV-026-status-row.spec.ts |
| INV-018 | held | 3 routes × 2 kinds on both projects; tuplets of 2, 5, 16, plain, legacy, legacy null count, every column; no row for an ungrouped column or barline; a rest and a repeated column | review-probes/INV-018-sheet.test.tsx, review-probes/INV-016-018-button-and-sheet.spec.ts |
| INV-019 | held | Numerals 2 to 16 × 2 themes by `getBBox()` and painted pixels; empty form; the 3 pixel-identical to main's glyph. The suite's copies survive a commit | review-probes/INV-019-markup.test.tsx, review-probes/INV-019-glyph.spec.ts, review-probes/INV-019-paint.spec.ts, review-probes/FR-036-suite-survives-commit.sh |
| INV-020 | held | 35 exact tests, zero diff from `main`, only the 3 allowed test files changed | review-probes/INV-020-exact-suites.sh |
| INV-021 | held | The notation table, n = 2 to 20 × fret widths × 2 densities, and the named edge rows | review-probes/INV-021-023-notation.test.ts |
| INV-022 | held | 4 surfaces × 3 kinds × with and without a chord row, on both projects | review-probes/INV-022-023-024-surfaces.spec.ts |
| INV-023 | held | `repeat: 8` at 3 positions × 2 kinds × 2 densities, on the export and on screen; a repeat changed up and down; a connector on 2 surfaces. The separate caret notch is MINOR F5 | review-probes/INV-021-023-notation.test.ts, review-probes/INV-022-023-024-surfaces.spec.ts, review-probes/INV-023-connector-shape.spec.ts |
| INV-024 | held | Base, raised, selected × 2 themes, print × 2 themes, a gap segment, opacity 1 throughout | review-probes/INV-022-023-024-surfaces.spec.ts |
| INV-025 | held | Mutated schema fails at `src/db/schema/assert-model.ts:34`; unmutated passes; migration is one type and one column; `git diff main -- src/lib/server src/app/api` is empty | review-probes/INV-025-schema-guard.sh |
| INV-026 | held | 7 routes as whole rows and outbox against main's real `editing.ts`; both toolbars, three states. Its set does not name the status row, which changed for people who never group: MINOR F25 | review-probes/INV-026-against-main.test.ts, review-probes/INV-026-toolbars.spec.ts |
| INV-027 | not checked | — | Person-level pass, owed after merge by design (T055, FR-038, SC-008). A headless run cannot judge legibility at actual size |

Every earlier probe was re-run first, and none regressed. All 3 shell probes pass. 345 of 345 unit probes pass. Browser probes, all 19 files: 314 passed, 208 skipped on purpose, 8 failed, and those 8 are exactly the ones FU15 predicted: F25 (3), F4 (2), F19 (2), F5 (1).

**One probe was changed this round, in the open.** As T074 left it, `INV-013-band.spec.ts` failed 4 cells, the six-string chord-row ones, reading 2 strings. Those cells measured after Playwright's `click`, and T074 had said to measure with no auto-scroll. `INV-013-real-taps.spec.ts` replays that flow step for step: the clicks leave the band at `scrollTop` -52 with 2 strings out, and putting the band back to 0 reads 1. So I added that one step to the band probe, and its 24 cells now agree with the real-tap probe. The red result was the harness, not the product, and no limit was loosened: six strings are still held to 1.

## Findings

- [ ] MINOR F27 — The suite allows two hidden strings beside a chord row, and tells the reader the band is broken
      where:  e2e/grouping-band.spec.ts:96, e2e/grouping-band.spec.ts:93
      why:    T074 asked for a measurement "after a fresh load with no Playwright auto-scroll", and for a regression to two hidden strings to fail the suite. Neither happened for the chord-row cells. They still measure after `click`, read 2, and were pinned with `hidden = chord ? 2 : 1`. The comment says a chord row "still costs a second string" and to tighten this "when the band is fixed". Nothing needs fixing: FR-020 holds, at 1, in all 8 six-string cells (review-probes/INV-013-real-taps.spec.ts). The risk is a later pass trusting the comment and changing a correct band. It is safe to ship because the chord row sits above the strings and the band anchors at the bottom, so a regression in how the band anchors should also fail the no-chord cells, which are held to 1. That is reasoned from the layout, not tested. T074 is ticked with these two clauses unmet, so read it with this finding.
      owed:   Adopt review-probes/INV-013-real-taps.spec.ts into e2e/grouping-band.spec.ts, set the six-string limit to 1 for both rows, and delete the comment at :93 to :95. FU18.
      traces: FR-020, SC-009, T074

- NOTE F26 — F23 still stands. T056 is labelled as needing Postgres, and Postgres is up here: `e2e/grouping-sync.spec.ts` and `e2e/grouping-queued-row.spec.ts` ran against it again this round, 5 passed and 1 skipped for being on the second project. T056 stays open for the human, as specs/003-generalised-grouping/tasks.md:181 says.

### Earlier findings, rechecked

| Finding | Now |
|---|---|
| F24 | Closed. Option A is recorded in `spec.md` FR-020 and SC-009 and in `plan.md` INV-013, and the amended invariant holds. T072's two guards are in the suite and pass |
| F15, F16, F17, F18 | Still fixed. `npm run test:e2e` gives 1295 passed, 213 skipped, 0 failed; `e2e/capture-surface.spec.ts` is unedited; the suite passes 1276 of 1276 in a clone with the work committed |
| F25 | Open MINOR. Its 3 probes stay red, as FU15 expected |
| F4, F5, F19 | Open MINORs. Their probes stay red, as FU15 expected |
| F6, F7, F8 | Proved by the adopted specs. The weak originals remain |
| F10, F11, F12, F20, F21 | Open MINORs, re-read at the lines cited below |
| F1, F2, F3, F9 | Closed, or carried on by the rows above |

T072 said to break each guard "in a scratch copy", and the implement pass broke `CaptureScreen.tsx` in the working tree. It restored the file, which is why its timestamp moved: the file is byte-identical to the backup the pass took first, and both changes are present at src/components/capture/CaptureScreen.tsx:376 and src/components/capture/CaptureScreen.tsx:419. No harm done.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F4, a refusal hides the armed-latch status until the cursor moves, src/components/capture/CaptureScreen.tsx:422
- FU2 — MINOR F5, the caret notches a bracket, src/components/tab/TabStaff.tsx:449
- FU3 — MINOR F6, "seven controls fit" has six, e2e/grouping-layout.spec.ts:229 (the real proof is in `e2e/grouping-band.spec.ts`)
- FU4 — MINOR F7, the "barline" cursor test never reaches a barline, e2e/grouping.spec.ts:384 (the real proof is in `e2e/grouping-cursor-names.spec.ts`)
- FU5 — MINOR F8, the queued-row test parses and never pushes, e2e/grouping-sync.spec.ts:95 (the real proof is in `e2e/grouping-queued-row.spec.ts`)
- FU6 — MINOR F10, the entry describes a different feature, docs/DECISIONS.md:276
- FU7 — MINOR F11, leftovers from separate passes, src/db/schema/domain.ts:48, src/components/capture/CaptureScreen.tsx:595, src/components/capture/CaptureScreen.tsx:544, src/lib/local/editing.ts:27, src/components/icons/__tests__/BracketGlyph.test.tsx:7
- FU8 — MINOR F12, `TabColumn.tupletCount` is a dead field, src/lib/tab/layout.ts:42
- FU9 — MINOR F19, a refusal in the same task as a fret never shows, because the length is read one render behind. No person can reach it, src/components/capture/CaptureScreen.tsx:712
- FU10 — MINOR F20, adopted text no longer describes the code, e2e/grouping-refusal.spec.ts:5, e2e/grouping-band.spec.ts:5, e2e/grouping.spec.ts:306
- FU11 — MINOR F21, a formatter reflowed lines nobody changed, src/components/capture/CaptureScreen.tsx:109
- FU12 — out of scope: opening the chord form costs 63 px of band at any string count, identically on main, src/components/capture/CaptureScreen.tsx:375
- FU13 — out of scope: a seven-string tuning hides four strings at rest (band 94 px), identically on main, src/components/capture/CaptureScreen.tsx:375. T068 makes them reachable. Round 2's figures, not re-measured
- FU14 — out of scope: the server logs a 23505 on `events_pkey` during the queued-row spec, confirmed again this round. The code checks for the row and then inserts, which fits two pushes of one new row racing, though I did not prove that. The spec still passes, and `git diff main -- src/lib/server` is empty, src/lib/server/sync.ts:200
- FU15 — these probes are expected to stay red next round, and are not regressions: "arming stack still says so" (F4), "the caret inside a span does not notch the line" (F5), the two "a refusal 0ms after a fret" cases (F19), and "every status beside" `Cmaj7`, `F#m7b5` and `Zork` (F25). No INV-013 probe is on this list any more: a red one is now a real regression
- FU16 — keep in review-probes/, not adoptable, because they compare against `main` or a commit, or edit the DOM: INV-020-exact-suites.sh, INV-025-schema-guard.sh, INV-026-against-main.test.ts, INV-026-toolbars.spec.ts, INV-013-rest-baseline.spec.ts, INV-019-markup.test.tsx, INV-019-glyph.spec.ts, FR-036-suite-survives-commit.sh, FR-037-band-overflow.spec.ts, INV-013-candidate.spec.ts, INV-013-touch-control.spec.ts, and the "every status beside" group of INV-026-status-row.spec.ts
- FU17 — MINOR F25, the status text is cut beside a wide chord, including for people who never group. If this row is touched again, let the chord give way first in every state, as it does during a refusal, src/components/capture/CaptureScreen.tsx:419
- FU18 — MINOR F27, adopt review-probes/INV-013-real-taps.spec.ts into e2e/grouping-band.spec.ts and hold six strings to 1 in both rows, e2e/grouping-band.spec.ts:96

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 38 | 35 | 2 | 1 | 0 |
| Success criteria | 10 | 8 | 2 | 0 | 0 |
| Constitution principles | 0 | 0 | 0 | 0 | 0 |

Partial: FR-018 and SC-010 (Deviation 1: copy, cut and delete keep their order but sit about 105 px lower, a recorded, cheap-to-overturn decision that `plan.md` leaves for the person-level pass; SC-010 also carries F25), FR-033 (F5), SC-008 (the contrast half is measured, the person-level half is owed). Absent: FR-038, owed by design as T055. `.specify/memory/constitution.md` is still the unfilled template, so there are no principles to check; the plan's gates from `docs/DECISIONS.md` were used in its place.

Baseline on this tree: `npm run typecheck` and `npm run lint` clean with the probes included, `npm test` 54 files and 1276 tests passing, whole e2e suite 1295 passed, 213 skipped, 0 failed, run as two shards.

## What I could not check

- **INV-027, FR-038, SC-008**: whether a bracket reads at actual size on a real screen. That needs a person, and it is T055. So does judging Deviation 1.
- **Real touch hardware and other engines**: every browser probe ran in Chromium under Playwright, with Pixel 7 emulation at 375×667, because Chromium is the only engine installed here. Taps and swipes were raw touch input, not a finger. There was no WebKit, and six strings now depend on a `flex-col-reverse` scroller, so a person should try that swipe on an iPhone during T055. Print is emulated media.
- **Seven strings under T068**: no probe covers them. FU13 comes from round 2 and from reading the code.
- **A build of `main` this round**: none was made. The comparisons with `main` come from earlier rounds or from probes that read `main` through git.
- **CI itself**: nothing was pushed. The suite was shown to survive a commit in a clone, not on GitHub.
- **A populated production database, and two real devices at once**: as in earlier rounds. The migration ran only on the local Postgres, and merge is proven in the library both ways.
