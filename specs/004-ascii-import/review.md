# Review: Import ASCII tab by pasting text

Reviewed 88 file(s) changed across 0 commit(s), against main...HEAD (base `eaa56ba`). The branch still has no commits of its own: all of the work is uncommitted, so HEAD equals `main` and an empty `main...HEAD` diff says nothing. This review is of the working tree, using `git diff main` for the 10 tracked files plus the 78 untracked files outside `specs/`.
Round 10. Read in full: plan.md, the round 9 review, tasks.md's nine remediation phases, `importing.ts`, `PasteTab.tsx`, `reading.ts`. Read in part: `src/lib/tab/parse.ts` lines 530 to 870, which hold all of T091's change, and spec.md's line rules and notation tables. contracts/reader.md section 2 was read, and sections 3 onward only as far as line 90. By modification time, only `parse.ts`, contracts/reader.md and T090's adopted tests have changed since round 9. All 10 adopted files were compared with their probes: 7 unit files match once line endings are set aside, 2 add a timeout, and the spec differs by one import path, so no assertion was weakened. Not read this round: contracts/writes.md, components.md and round-trip.md, data-model.md, research.md and quickstart.md, because no code they govern has changed since round 5 and their invariants were re-run. `.specify/roadmaps/capture-expression.json` is pipeline state.

## Verdict

Ready for a person to merge: no BLOCKER and no MAJOR, and `tasks.md` is unchanged. T090 and T091 did what they were asked. F78 is closed: a row of wrapped cells is now claimed, and a real browser stored all 5 notes of a wrapped system on the right strings. No earlier probe regressed. Round 9 could not say whether this class was bounded, because its zero came from a filter matching the rule, so this round used a filter taken from spec.md's table, which borrows nothing from S1 to S6. Over 1,330,860 lines in each of 4 layouts, every ignored line sits on NOTE F62's declared edge or on one new MINOR, F80, and none is lost outside them. F80 is a line with a word no string has as its label and a pipe touching a wrapped cell, and it is listed where it should refuse. The 8 other MINORs are carried or still open, and all are safe. Three things stand between this and done: `SongView.tsx` should go back to LF before the first commit (F54), T041's person-level pass is still owed after merge, and nothing here has been tested with real wild tab or a real phone paste.

## Invariants

Re-run first, before any new probe: every probe from rounds 1 to 9, after a fresh `npm run build`. Unit 2,428 of 2,443 passed. The 15 failures are `INV-006-rails-only-every-spelling.test.ts` (5, F74), `INV-002-fret-over-the-range-says-so.test.ts` (4, F67), `INV-015-016-chord-over-a-bare-bracket.test.ts` (3, F58) and `INV-008-true-reason.test.ts` (3, F53), exactly as Phase 16 predicted. `INV-026-against-main.sh` showed every named path at zero diff, and `INV-005-can-the-backbone-fail.sh` killed its 4 mutants. Browser 92 passed, 16 skipped, 0 failed. All 16 skips are follow-up import steps that skip themselves because the paste now refuses, and all the sync probes ran. So no probe that held last round fails now, and all of round 9's F78 failures pass.

Round 9's own browser paste refuses, which is why it has 2 more skips than last round. The reason is not its cells: it sets an unlabelled system beside a labelled one, which is `systems-differ` for bare digits too. That left no browser probe storing a wrapped system, so this round adds one.

Then round 10's probes, run with the rest. Unit 2,561 of 2,580 passed. The 19 failures are the 15 above and F80 (4). Browser 94 passed, 16 skipped, 0 failed.

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | Every named boundary, H, F, the app's own group of two 512s: 25 of 25, plus H through the wire | review-probes/INV-001-002-wire.test.ts |
| INV-002 | held | Every named sample and the constants against the real schema, lower-case roots included. `100`, `105` and `205` refuse under the wrong code, so the outcome holds and the reason does not: F67 | review-probes/INV-001-002-wire.test.ts, INV-002-fret-over-the-range-says-so.test.ts |
| INV-003 | held | H, generator, pinned fixtures, the group of two 512s | review-probes/INV-003-004-005-021-harvest.test.ts, INV-013-counted-past-the-cap.test.ts |
| INV-004 | held | H, generator, pinned fixtures, two named exceptions only | review-probes/INV-003-004-005-021-harvest.test.ts, INV-004-015-rail-chords-from-the-export.test.ts |
| INV-005 | held | 4 of 4 mutants killed by the backbone, all 9 ledger classes asserted. S6's mutants re-pointed at T091's rule, with 3 added: 13 of 14 killed by the project's suites, control 3,402 passed. `digits-only` survives, which is a gap in the tests of one branch and no gap in the backbone: FU30 | review-probes/INV-005-can-the-backbone-fail.sh, INV-006-009-can-the-suite-see-s6.sh |
| INV-006 | held | Every named member. F78's matrices: all pass. Wrapped systems read, 4 of 4, and stored whole in a real browser on both projects, on the right keys. Every line spec.md's table calls a staff row, six characters deep with 10 label openings: 1,330,860 lines × 4 layouts, 0 lost outside NOTE F62's edge and F80. F74 is recorded apart, as a MINOR | review-probes/INV-006-009-every-cell-as-a-row.test.ts, INV-006-every-cell-of-a-system.test.ts, INV-006-009-a-token-holds-note-and-rail.test.ts, INV-006-wrapped-rows-read-not-refused.test.ts, INV-006-wrapped-system-stored.spec.ts, INV-006-009-spec-row-definition.test.ts |
| INV-007 | held | R: each code alone and among good lines at first, middle and last line; rows, outbox and `meta` compared | review-probes/INV-007-008-refusals.test.ts, INV-006-zeros-run-together.test.ts |
| INV-008 | held | Different codes, one code across rows and columns, and several rows of one column, 5 of 5 | review-probes/INV-007-008-refusals.test.ts, INV-008-same-system.test.ts, INV-008-same-code.test.ts, INV-008-one-column.test.ts |
| INV-009 | held | All 10 named samples at top, middle and bottom of 4 and 5 rows, every earlier row form, and the spec-table sweep above. `--(5)--(7)--` alone between two systems now refuses. F80 is outside this set and is judged there | review-probes/INV-006-009-rows.test.ts, INV-006-009-a-token-holds-note-and-rail.test.ts, INV-006-009-wider-line-sweep.test.ts, INV-006-009-spec-row-definition.test.ts |
| INV-010 | held | Every named line. The real `Arrangement` line, the real meta line of 17 presets × 4 shapes, and 202 ordinary lines apart from any staff, none read as notes and none unlisted. 43 of those 202 refuse, as reader.md now says, which is F75 and safe | review-probes/INV-010-commentary.test.ts, INV-010-touching-a-staff.test.ts, INV-010-short-marks.test.ts, INV-010-wild-commentary.test.ts, INV-010-stacked-notation.test.ts, INV-010-arrangement-line.test.ts, INV-010-ordinary-lines-anywhere.test.ts |
| INV-011 | held | Every named barline shape, joins with and without a closing pipe, 16 bars across 4 systems with lyrics | review-probes/INV-011-012-013-014-layout-of-text.test.ts |
| INV-012 | held | Every named shape, H at both densities | review-probes/INV-011-012-013-014-layout-of-text.test.ts |
| INV-013 | held | Named rows, and every counted run past the cap, 7 of 7 | review-probes/INV-011-012-013-014-layout-of-text.test.ts, INV-013-counted-past-the-cap.test.ts |
| INV-014 | held | Every line ending, gutter, label width and cell alignment named. T091 splits a line on whitespace, so new this round: 7 systems holding wrapped cells or an `x` beside a letter × 15 transforms, compared deep-equal | review-probes/INV-011-012-013-014-layout-of-text.test.ts, INV-014-030-lines-only-s6-claims.test.ts, INV-014-030-wrapped-cells-only-s6-claims.test.ts |
| INV-015 | held | Named placements 28 of 28; `D-7` and `A-` crossed with touching chords, 98 of 98; 3 of 3 two-column splits; 12 of 12 above a block that grew. `D-7` above a bare bracket digit refuses instead of reading: that is F58, against FR-001, not this invariant | review-probes/INV-015-chords.test.ts, INV-004-015-rail-chords-from-the-export.test.ts, INV-015-016-above-a-grown-block.test.ts, INV-015-016-chord-over-a-bare-bracket.test.ts |
| INV-016 | held | Spec 003's notation tables, every named bracket shape, 3 of 3 above a block that grew | review-probes/INV-016-017-groups-techniques.test.ts, INV-015-016-above-a-grown-block.test.ts |
| INV-017 | held | 4 transitions × 6 shapes, the broken forms, dead notes, 63 decoration subsets × 3 on a staff row, and the redraw ledger | review-probes/INV-016-017-groups-techniques.test.ts, INV-006-009-redraw-ledger.test.ts |
| INV-018 | held | 17 × 17 presets, committed, with a note on each string and empty; dead notes; two parts, a variant, a deleted part | review-probes/INV-018-019-tunings.test.ts |
| INV-019 | held | F × band default, null on this song, other songs on null, another song on a deleted tuning | review-probes/INV-018-019-tunings.test.ts, INV-019-resolves-like-null.test.ts |
| INV-020 | held | All 5 store changes, and a new part only moving the letter on | review-probes/INV-020-023-025-writes.test.ts |
| INV-021 | held | H through `importTab`, F, chord, group and repeat together, density toggled, no-tuning preview, a tap before the deferred pass | review-probes/INV-021-022-024-027-flow.spec.ts, INV-021-024-029-panel.test.tsx |
| INV-022 | held | All 5 flows in a real browser with every table dumped; `readTab` and `draftPart` with a `db` whose writes throw | review-probes/INV-021-022-024-027-flow.spec.ts, INV-020-023-025-writes.test.ts |
| INV-023 | held | F × every N from 1 to the row count; text kept and message shown | review-probes/INV-020-023-025-writes.test.ts |
| INV-024 | held | Double click and Enter twice in a real browser; two synchronous clicks, a click during the write, a click after `changed` | review-probes/INV-021-022-024-027-flow.spec.ts, INV-021-024-029-panel.test.tsx |
| INV-025 | held | F × 6 part shapes, arrangement entries, `name` null, twin store against `createPart` | review-probes/INV-020-023-025-writes.test.ts |
| INV-026 | held | All 11 named paths have zero diff; `protocol.ts` swaps limits only; `text.ts` adds lines only; typecheck 0 | review-probes/INV-026-against-main.sh |
| INV-027 | held | Both controls; no clipboard permission; offline × fits, offer, then online and drained; a no-tuning song opens, previews and imports | review-probes/INV-021-022-024-027-flow.spec.ts, INV-027-031-sync.spec.ts |
| INV-028 | held | 2 themes × 5 states × 3 string counts at 375×667, both projects; 200- and 2,000-character lines; 2,000-column preview | review-probes/INV-028-029-030-panel-at-size.spec.ts |
| INV-029 | held | Every Words row, a refusal fixed, both failure messages, `aria-label`s on a column with a repeat, a technique and a chord | review-probes/INV-021-024-029-panel.test.tsx, INV-028-029-030-panel-at-size.spec.ts |
| INV-030 | held | 2,000 columns × 1, 40 systems × both densities; the keystroke bound (worst 51.0 ms over this round's runs); plain lyrics; stacked lines. New: 5 shapes only T091's split asks about, each at most 19 ms at a scale of 5,000 on one run | review-probes/INV-030-at-size.test.ts, INV-030-lines-above-a-staff.test.ts, INV-030-rails-block.test.ts, INV-014-030-lines-only-s6-claims.test.ts, INV-030-growth-of-a-tall-block.test.ts, INV-014-030-wrapped-cells-only-s6-claims.test.ts, INV-028-029-030-panel-at-size.spec.ts |
| INV-031 | held | F, with Postgres and a second context, rejections zero, including a part crossing a push batch. None of the sync probes skipped | review-probes/INV-027-031-sync.spec.ts, `e2e/import-sync.spec.ts` |
| INV-032 | not checked | Person-level pass, owed after merge as T041 | Needs a person at actual size; quickstart.md §6 |

## Round 9 findings

| Finding | Status | Now |
|---|---|---|
| F78 MAJOR | Closed | All of its probes pass, wrapped systems read and store whole, and an independent sweep finds nothing outside the declared edges |
| F74 MINOR | Open | FU28 |
| F75 MINOR | Open | T091 corrected the contract's count: 43 of 202, measured again here. FU29 |
| F76 MINOR | Open | T091 did not take this up, and was not asked to. FU22 |
| F67 MINOR | Open | FU27 |
| F53 MINOR | Open | FU18 |
| F54 MINOR | Open | FU19 |
| F58 MINOR | Open | FU20 |
| F59 MINOR | Open | FU21 |

## Findings

- [ ] MINOR F80 — A pipe touching a wrapped cell does not count, so a line with a long label can be ignored where its bare twin refuses
      where:  src/lib/tab/parse.ts:798, specs/004-ascii-import/contracts/reader.md:53
      why:    reader.md says a pipe touching a rail or a note makes a row whatever else the line holds. T091 moved S6 from the digit to the cell, and kept the pipe rule on the digit, as it was told to. So in `Guitar|(5)--(7)`, `Gtr:|(5)--(7)`, `Guitar|<12>-<14>` and `Gtr:|t5-t7` the pipe touches nothing line 798 knows, and the word makes the line prose. Beside a good system the paste reads and the line is listed in `ignored`, where `Guitar|3--5` refuses. **This is a judgement call and worth a look**, since F78 was rated MAJOR for a dropped row. I rate it MINOR and do not count it against INV-009, for three reasons. It needs a label no string has, because a true label is taken by S1 or S3, and spec.md's protecting rule reaches only a string label, a leading pipe, or three rails and a fret. It is inside NOTE F62's wording, a word with neither end on a rail or pipe, and only the contract's pipe sentence reaches further. And it also needs a line closing on neither rail nor pipe with no run of three rails, so `Guitar|(5)--(7)-`, `Gtr:|(5)--(7)|` and `Guitar|(5)---(7)` all refuse. The sweep counts 44,923 such lines, but that is its alphabet and not a rate. To overturn: ask the pipe rule of a run as `touches` does. That is untried, so measure F75's cost first.

- [ ] MINOR F74 — An empty row spelled in minus signs goes uncounted, so the rows below it move up a string (carried from round 9)
      where:  src/lib/tab/parse.ts:582, src/lib/tab/parse.ts:584, src/lib/tab/parse.ts:545, src/lib/tab/parse.ts:805
      why:    `isNotationOnly` and `HOLDS_RAIL` name three rail spellings, and S6 and `readsAsProse` name four. A line of `−` at the top or bottom of an unlabelled block is therefore commentary where a line of `—` is a row. Five unlabelled rows, the first in minus signs, read `ready` on a four-string song, and the note on the paste's second row is stored on key 0, not key 1. Round 9 called this a judgement call and I reach the same answer: the line holds nothing, spec.md's row test does not make U+2212 a rail, the line is listed, the preview draws four rows, and it needs one row alone in minus signs among hyphens, which I cannot see anything producing. To overturn: add `−` to both.

- [ ] MINOR F75 — S6's real cost: 43 of 202 ordinary lines refuse (carried from round 9)
      where:  src/lib/tab/parse.ts:795, specs/004-ascii-import/contracts/reader.md:53
      why:    S6 asks of every line wherever it sits, so a line standing apart from any staff can refuse a paste: chord lists (`Am7-D7`), `(c) 1999-2004`, `m.1-4`, `1st-2nd`, `x2-`, `-1/2 step`. The contract now says so. Each refuses, names its line and costs one tap to delete, and none is read as notes. Hyphen-joined chord lists are the most likely to meet real use and the cheapest to narrow, by testing each piece of a hyphened token with `isChord`. That is untried.

- [ ] MINOR F76 — T089 is ticked with its contract work part done (carries F60)
      where:  specs/004-ascii-import/contracts/reader.md:22, specs/004-ascii-import/contracts/reader.md:30, specs/004-ascii-import/contracts/reader.md:53, src/lib/tab/parse.ts:797
      why:    Line 22 still says "Walk from the last line to the first", and line 30 still puts a heading row ahead of the staff row, while the paragraph under S6 says the walk alternates and `decide` has no heading step. The S6 row says a pipe touching a rail or a note "makes a row whatever else the line holds", but line 797 requires a note on the line, so `P.M.----|` stays commentary, as INV-010 needs. The code is right and the contract is wrong in both.

- [ ] MINOR F67 — Fret text over the range with a zero in it gives the wrong refusal (carried from round 7)
      where:  src/lib/tab/parse.ts:212, specs/004-ascii-import/contracts/reader.md:171, specs/004-ascii-import/contracts/reader.md:172
      why:    Line 212 tests `/0\d/` over the whole cell, so `100`, `105`, `205` and `1000` get `run-together` where the contract says `fret-range`. Each still refuses and nothing valid is refused.

- [ ] MINOR F53 — Two refusals give an untrue reason (carried from round 4)
      where:  src/lib/tab/parse.ts:293, src/lib/tab/parse.ts:369
      why:    A note-name row with one cell and no rail after it goes to `row-length`, so `G-5`, `D-5`, `A-3`, `E-3`, all one length, are told the strings differ. S4 also takes `,---3---,` for a row when no other line anchors a block, and blames its comma. Neither writes anything.

- [ ] MINOR F54 — `SongView.tsx` flipped from LF to CRLF (carried from round 4)
      where:  src/components/app/SongView.tsx:1
      why:    `git ls-files --eol` still says `i/lf w/crlf`, so a commit shows every line changed for 63 real ones and loses the file's blame. plan.md's Constraints name this file as LF. Nothing behaves differently, and it is one command before the first commit.

- [ ] MINOR F58 — A chord spelled with a rail and a digit refuses above a bare bracket digit (carried from round 5)
      where:  src/lib/tab/parse.ts:780, src/lib/tab/parse.ts:365, src/lib/tab/ascii.ts:119
      why:    Line 780 tests a chord only above a staff or a marked bracket, and a digits-only bracket is never marked. So `D-7`, `C-9` or `E-7` above a bare `3` refuses as `row-length` on the app's own text. The export draws that form only for a one-column span, which means an older group cut by a barline. Nothing wrong is written.

- [ ] MINOR F59 — Marks with no word on them refuse though the spec calls them commentary (carried from round 5)
      where:  src/lib/tab/parse.ts:557, src/lib/tab/parse.ts:805, src/lib/export/text.ts:102
      why:    `#1`, `x2.`, `*4`, `q=120`, `(0:32)`, `1+2+3+4+` and `A1:` read as damaged rows beside a block, and `- 2nd time: slide up` refuses. That last can be the app's own text, since line 102 writes a part's notes under its staff. Each refuses, names its line and costs one tap, and the commonest forms (`x2`, `4/4`, `Verse 1:`, `12-bar`) pass.

- NOTE F81 — The rule's design has held. S6 now asks one question of a line wherever it sits, which is why this round's sweep gives the same counts in all 4 layouts. Round 9 asked for that structurally and T091 delivered it. The five earlier BLOCKERs in this component do not repeat, so no REDESIGN is owed. The rail spellings are still named in several places (FU28), and that is the part of the component I would tidy first.

- NOTE F79 — A block thousands of rows tall grows faster than linear: 5,000 rows take 151 to 634 ms, 20,000 take 3 to 6 s, as measured in round 9. Its probe still passes. No instrument has thousands of strings, so it is no defect.

- NOTE F62 — Carried from round 5, and now the largest thing left unread. A row with no rail and no pipe (`5 7 5 7`, `(5) (7)`) is no staff row by spec.md line 45. A row holding a word with neither end on a rail or pipe (`5-sl-7`, `E string 3-5-3-7`, `Gt(3)-t(7)`, `xb-xb`) reads as prose. A rail standing apart from any note (`- 5 - 7 -`, `-- 5 -- 7 --`) is prose punctuation, as T091 kept it. Each is commentary away from a block and is listed. Together these are 171,753 of the sweep's 1,330,860 lines, which measures its alphabet and not real use. They are the declared edge of the rule, and reopening them should take a real paste, not a wider sweep.

- NOTE F68 — `5x05` reads as five passes and draws `5x5`, so a repeat label's own leading zeros are dropped. That follows reader.md section 5, and no note is lost.

- NOTE F46 — Inherited from round 3, cheap to overturn: a band that deleted all its tunings and has two songs gets a refusal where spec.md line 244 offers a tuning, since FR-025 says only this song may change. To overturn: skip the check in `readTab` when the band has no tunings, and flip `a band with no tunings at all` in `INV-018-019-tunings.test.ts`.

- NOTE F47 — Inherited from round 3: a rails-only line touching an unlabelled block is a row, as F27 required. So `-------` above four unlabelled rows on a five-string song reads `ready` with the notes on keys 1 to 4. The preview shows the empty top string and says how the rows were read.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F14 (round 1), dead code and a duplicated rule, src/lib/tab/parse.ts:938, src/lib/tab/parse.ts:958
- FU2 — MINOR F15 (round 1), a tab character gets an untrue reason, src/lib/tab/parse.ts:634
- FU3 — MINOR F16 (round 1), a tab-character gutter refuses, src/lib/tab/parse.ts:255
- FU4 — MINOR F17 (round 1), a clipped chord costs its row's other chords, src/lib/tab/parse.ts:626
- FU5 — MINOR F18 (round 1), only the top row's closing pipe decides the join barline, src/lib/tab/parse.ts:1021. Rows of one length with a closing pipe on only some of them also read, though spec.md line 227 refuses pipes at different positions. The notes are right, and only the join can differ.
- FU6 — MINOR F19 (round 1), the status line drops `no-notes` beside lined refusals, src/components/app/PasteTab.tsx:81
- FU7 — MINOR F20 (round 1), the Tuning line comes before the notes, src/components/app/PasteTab.tsx:171
- FU8 — MINOR F22 (round 1), the pure reader imports the store layer, src/lib/tab/reading.ts:11
- FU9 — MINOR F33 (round 2), a labelled long-dash row gets an untrue reason, src/lib/tab/parse.ts:260
- FU10 — MINOR F34 (round 2), the refusal protecting other songs contradicts itself, src/lib/tab/reading.ts:244
- FU11 — MINOR F35 (round 2), a double-spaced lyric can refuse as a part heading, src/lib/tab/parse.ts:953
- FU12 — MINOR F36 (round 2), the backbone's guards are weaker than the tasks say, package.json:14, src/lib/tab/__tests__/round-trip.test.ts:493
- FU13 — unused import warning, src/lib/local/__tests__/review-tunings.test.ts:16, and its probe copy, specs/004-ascii-import/review-probes/INV-018-019-tunings.test.ts:14
- FU14 — MINOR F42 (round 3), a chord value that is not a symbol can refuse instead of coming back as commentary, src/lib/tab/parse.ts:805
- FU15 — closed by T091 for the rows it covers: `--(5)--(7)--` alone now refuses, src/lib/tab/parse.ts:821. A paste of only F62's edge is still told `no-staff`.
- FU16 — MINOR F45 (round 3), `labels-mixed` always names the system's first row, src/lib/tab/parse.ts:860. T082 reaches this more often: a line below a labelled staff that now joins it also blames line 1, though it names itself too.
- FU17 — the long-dash test at src/lib/tab/parse.ts:368 is in no row of contracts/reader.md §2.
- FU18 — MINOR F53, src/lib/tab/parse.ts:293. Adopt review-probes/INV-008-true-reason.test.ts with its fix. Until then its 3 failures are expected.
- FU19 — MINOR F54, src/components/app/SongView.tsx:1. Worth doing before the first commit of this branch.
- FU20 — MINOR F58, src/lib/tab/parse.ts:780. Adopt review-probes/INV-015-016-chord-over-a-bare-bracket.test.ts with its fix. Until then its 3 failures are expected.
- FU21 — MINOR F59, src/lib/tab/parse.ts:557.
- FU22 — MINOR F76 and F60, specs/004-ascii-import/contracts/reader.md:22, specs/004-ascii-import/contracts/reader.md:30, specs/004-ascii-import/contracts/reader.md:53.
- FU23 — out of scope: deleting a band's default tuning assigns no new default and can leave no tunings at all, src/components/app/TuningsView.tsx:69. It predates this branch.
- FU24 — out of scope: `resolveTuning` falling back to `forBand[0]` lets any new tuning row move songs on null, including a preset added by hand, src/lib/local/queries.ts:97.
- FU25 — out of scope, not diagnosed: moving between screens by in-app links while offline left the song screen without its controls, in round 1. Seen from the Band link at src/components/app/SongView.tsx:75.
- FU26 — the seven specs/004-ascii-import/review-probes/vitest.candidate-*.config.mts files and vitest.t065-rule.config.mts have done their work, and all can go before the first commit. Their rules have shipped or been replaced.
- FU27 — MINOR F67, src/lib/tab/parse.ts:212. Testing `/^0\d/` on the core, as round 6's candidate did, closes it. Adopt review-probes/INV-002-fret-over-the-range-says-so.test.ts with its fix. Until then its 4 failures are expected.
- FU28 — MINOR F74, src/lib/tab/parse.ts:582. Adopt review-probes/INV-006-rails-only-every-spelling.test.ts with its fix. Until then its 5 failures are expected. Naming the rail spellings once, in place of the literals, is the structural form of that fix.
- FU29 — MINOR F75, src/lib/tab/parse.ts:795. review-probes/INV-010-ordinary-lines-anywhere.test.ts prints the cost by kind, so a narrowing can be measured.
- FU30 — `digits-only` survives in review-probes/INV-006-009-can-the-suite-see-s6.sh, src/lib/tab/parse.ts:788. Since T091 the free-`x` clause of `note` matters only to the pipe rule, for a note in a run apart from the pipe, as in `Guitar|-- x`, and no test holds that. The script is re-pointed at T091's rule and takes 5 minutes, so it stays out of `run-probes.sh`. `S6_MUTANTS` now runs a subset.
- FU31 — MINOR F80, src/lib/tab/parse.ts:798. Adopt review-probes/INV-009-pipe-touching-a-wrapped-cell.test.ts with its fix. Until then its 4 failures are expected.
- FU32 — adopt review-probes/INV-006-wrapped-rows-read-not-refused.test.ts, INV-006-wrapped-system-stored.spec.ts, INV-006-009-spec-row-definition.test.ts and INV-014-030-wrapped-cells-only-s6-claims.test.ts into the suite. All pass today. The first two matter most: every round 9 probe accepts a refusal as a fix, so nothing in the suite says valid wrapped cells read.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 40 | 39 | 1 | 0 | 0 |
| Success criteria | 10 | 6 | 2 | 0 | 0 |
| Constitution principles | 0 | 0 | 0 | 0 | 0 |

Functional requirements: partial is FR-001 (F58). FR-013, FR-016 and FR-017 are satisfied again now F78 is closed. FR-033 counts as satisfied on its automated half only.

Success criteria: SC-002 is partial (F58) and SC-004 is partial (F53 and F67's reasons). SC-001, SC-003, SC-006, SC-007, SC-008 and SC-009 are satisfied. SC-005 and SC-010 are person-level and sit in none of the four columns, so the row adds up to 8 of 10.

Constitution: `.specify/memory/constitution.md` is still the unfilled template, so it has no principles to check. The plan's own gates stand in for it.

Test integrity: the suite can see S6. 13 of 14 mutants are killed, including all 3 new ones for T091's rule, and the survivor is FU30. T090's probes were adopted without a weakened assertion. Two weaknesses are worth knowing. Every wrapped-cell probe from round 9 accepts a refusal as a pass, so a rule refusing all wrapped cells would have stayed green: FU32 closes that. And this round's sweep sets aside F62's edge by a test of its own, so it says nothing about that edge except its size. `single-owner.test.ts` is the one existing test edited, against plan.md's "every existing test stays unedited". T003 asked for it by name, the diff only adds, and no assertion changed, so I record it and raise nothing.

Project checks on this tree: `npm run typecheck` 0, `npm run lint` 0 errors and 2 warnings (FU13), `npm run build` 0, `npm test` 108 files and 4,153 tests passed, `npx playwright test` 1,433 passed, 229 skipped, 0 failed. `npm run check:backbone` 0, `npm run check:untouched` 0. `run-probes.sh` exits 1 on its 19 expected MINOR failures alone.

## What I could not check

- INV-032, SC-005, SC-010 and FR-033's person-level half: legibility at actual size and the 30-second phone flow need a person. They are T041 and quickstart.md §6-7.
- A real paste on a real phone. Every browser probe fills the box or dispatches input, so autocorrect, the system clipboard and on-screen keyboard behaviour were not exercised.
- Keystroke timing on phone hardware. This round's 51.0 ms was from this desktop, and the Pixel 7 project emulates the viewport, not the speed.
- Contrast beyond computed text colours on their surfaces. Placeholder text, focus rings and the staff's own glyphs were not measured.
- Sync against anything but local Postgres with two browser contexts on one machine.
- How wild tab really behaves. I have no corpus. F62's edge, F75's 43 of 202 and F80's rarity are all judged from memory of what tab looks like, so none is a rate over real pastes. A real paste is the test that could overturn them.
- Lines past the sweep's edges. It reaches six characters after a label, over 10 body characters and 10 label openings, and asks only about lines opening on a rail or pipe. A row spelled in rails outside the notation, such as `_` or `=`, is outside it.
- Why each of the 229 e2e skips applies. Those I sampled are project-gated. The 16 probe skips I did read.
