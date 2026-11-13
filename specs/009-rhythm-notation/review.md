# Review: Rhythm notation under the tab

Reviewed 66 file(s) changed across 0 commit(s), against main (d9d2393)...working tree. The whole feature is still uncommitted on
`009-rhythm-notation`, whose HEAD is `main`, so this round compares the working tree with HEAD: 31 modified tracked files
(440+/103−, the same with `--ignore-cr-at-eol`) and 35 untracked files under `src/`, `e2e/` and `scripts/`. Not counted:
`.specify/roadmaps/best-in-class.json` (the roadmap, not this feature) and `specs/009-rhythm-notation/`.

**Round 4.** Round 1 had seven MAJORs (F1–F7), round 2 one (the flag stack), round 3 one (`docs/DECISIONS.md` turned CRLF, a
regression of round 1's F7). No round has had a BLOCKER. `## Phase 10: Review remediation` (T065–T069) is all ticked.

What changed since round 3's `review.md`, by mtime and by the implement transcript (`.pipeline/implement.result.json`, every writing
command read):

- `scripts/check-line-endings.sh` (new, a copy of round 3's probe) and its `check:line-endings` script in `package.json`;
- `docs/DECISIONS.md`: CR stripped, and one line naming the new guard (docs/DECISIONS.md:743);
- `e2e/notation-flags-every-surface.spec.ts` (new; the round 3 probe with two import paths and the run line changed, checked by `diff`);
- `e2e/notation-screens.spec.ts`: the lone-symbols set appended (e2e/notation-screens.spec.ts:84-114);
- `specs/009-rhythm-notation/tasks.md`: T065–T069 ticked. The pass's `sed -i` also normalised it from CRLF to LF, so round 3's FU11 is
  moot;
- `research-probes/measure-before.json` was rewritten by the run of `e2e/notation-measure-before.spec.ts` (FU7). Its figures still read
  as the "before" ones, because that scenario has no durations (INV-001).

Nothing in `src/` changed. Read in full this round: every file above, and the implement transcript's commands. Sampled: everything round 3
read, all of it unchanged since. Its invariants are re-proved by re-running their probes and the landed specs.

Run this round, all in the foreground against one fresh `npm run build`:

- Every saved review probe, first:
  - `review-probes/PLAN-line-endings-kept.sh`: exit 0, "line endings: kept" (round 3's failure is closed). Then fixed, see F1, and
    re-run: still exit 0 on the tree, and exit 1 on a throwaway repo holding a new CRLF file under `src/`;
  - unit (`vitest.review.config.ts`): 5 files, 97 tests, all pass;
  - browser (`playwright.review.config.ts`): 44 pass, 12 skip on `desktop` by design (touch-only capture probes), 0 fail.
- `npm test`: 160 files, 6,371 tests pass. `typecheck` passes. `lint`: 0 errors, the 12 warnings that were there before this branch.
- `check:untouched-notation`, `check:notation-amendments`, `check:polish-amendments`, `check:usability-amendments` and the new
  `check:line-endings` all exit 0. `test:spec004` passes.
- Browser specs on `mobile` and `desktop`, through `review-probes/playwright.e2e-prebuilt.config.ts` (the project config with the
  build step dropped, so batches share one build), 0 failures in every batch:
  - `e2e/notation-*` (except `notation-measure-before`), `polish-band-unchanged`, `usability-height-budget`, `rhythm-capture-height`,
    `rhythm-marks`, `usability-surfaces`, `usability-staves`: 218 pass, 46 skip;
  - every other re-pinned spec, plus `rhythm-unknown-values`, `durations-row-tall-sheets`, `usability-wrap`, `click-bar-at-size` and
    `reading-layout`: 222 pass, 48 skip;
  - every `grouping-*` and `polish-band*` spec (must pass unedited): 230 pass, 55 skip.
- The lone-symbols screenshots T068 added, regenerated and looked at (F2).

## Verdict

Yes. The feature satisfies its spec and hangs together. There is no BLOCKER and no MAJOR, so it is ready for its person-level pass
(T043–T045) and then a human merge.

Round 3's MAJOR is fixed, and the fix is guarded:

- `docs/DECISIONS.md` is `i/lf w/lf` again, and its diff is 44 insertions and 0 deletions: round 3's 43, plus the line naming the guard.
- `git diff --stat` equals `git diff --stat --ignore-cr-at-eol` (440+/103−).
- `npm run check:line-endings` exists and fails on the fault round 3 found: a tracked file whose working-tree ending differs from its
  index. I confirmed that on a throwaway repo.

The guard's other clause, a CR in a new file, cannot fail on this machine (F1, MINOR). Git for Windows' `grep` 3.0 strips CRs before it
matches unless given `-U`. The defect came from round 3's own probe, and the probe is fixed. Nothing is wrong with the tree today:
`git ls-files --eol` reads `w/lf` for all 65 new files. And once committed, every file falls under the clause that does work.

T068's screenshots now show a lone flag, for the eye of T043 and T044. But they cut the staff off at the viewport's edge, so no rest
other than the whole rest appears in them (F2, MINOR).

All 19 invariants hold over their full sets. No `src/` file changed since round 3, and every probe and spec that proved them passes again.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | Surf × {no group, every Grp shape} × Th through `baseline.json` (unedited; `frets-unchanged.test.ts` green in `npm test`); capture's no-duration Cap rows; paste, 4 fixtures; clearing the last duration restores the markup, tuplet and plain × Th | review-probes/INV-011-capture-transition-with-group.spec.ts and review-probes/INV-005-INV-008-capture-height-every-row.spec.ts (green); `polish-band-unchanged.spec.ts`, every `polish-band*` and `grouping-*` spec, `notation-paste.spec.ts` (green); `check:untouched-notation` (`src/lib/reading/` zero diff) |
| INV-002 | held | 13 tokens × up to 4 columns × every single-group overlay × 2 densities, plus adjacent pairs; Corp × surfaces in the browser | review-probes/INV-002-INV-019-beam-breaks-exhaustive.test.ts (green; adopted as `beam-breaks-exhaustive.test.ts`, green in `npm test`); `notation-beams.spec.ts` (green) |
| INV-003 | held | every `notation-baseline` input × every timed bar × every hit, plus generated passes | review-probes/INV-003-positions-vs-click.test.ts (green; adopted as `positions-vs-click.test.ts`). `src/lib/rhythm/notation.ts` additions only (`check:untouched-notation`) |
| INV-004 | held | 9 Grp shapes × {rhythm, none} × 2 densities × {single, wrapped}; e2e song ×2, play, print | review-probes/INV-004-brackets-every-group-shape.test.tsx (green, adopted); `notation-brackets.spec.ts` (green) |
| INV-005 | held | Str {4, 5, 6} × Cap (6) × Th (2) × cursor {end, labelled, selection}, each with a chord row: 84 states | review-probes/INV-005-INV-008-capture-height-every-row.spec.ts (green); `notation-capture-height.spec.ts`, `usability-height-budget.spec.ts`, `rhythm-capture-height.spec.ts` (green) |
| INV-006 | held | Gapk 2 × {single, wrapped} × levels 1–3 in jsdom; connector gap × Wid × View × Dens × Sz in the browser | review-probes/INV-006-gap-beams.test.tsx and review-probes/INV-006-INV-007-INV-013-song-page.spec.ts (green, both adopted). A removal gap's beam is the same `GapBeams` element as the connector's (src/components/tab/TabStaff.tsx:955). Print of a bar wider than the page is judged by construction, as in round 3 |
| INV-007 | held | Wid × View (switched, no reload) × Dens × Sz (song); 13 Sym × surfaces × Sz | review-probes/INV-006-INV-007-INV-013-song-page.spec.ts (green); `notation-alignment.spec.ts`, `usability-staff.spec.ts`, `usability-staves.spec.ts` (green) |
| INV-008 | held | Flags: {song expanded, song compact, play, print song, print play, capture} × Sz = 12 runs, each 42 notes, 13 Sym, 19 flags under a bracket, lowest label present for 22 stems and absent for 11, capture also with the cursor on each labelled column; numeral, line and cursor-rule members over 84 capture states; label crop 8/16/32 against a quarter | review-probes/INV-008-INV-009-flags-every-surface.spec.ts (green; now adopted as `e2e/notation-flags-every-surface.spec.ts`, green, its counts logged identically); review-probes/INV-008-flags-clear-label-and-bracket.spec.ts (green; adopted as `notation-flags-clear.spec.ts`); review-probes/INV-005-INV-008-capture-height-every-row.spec.ts (green) |
| INV-009 | held | flag × levels 2–3 × Sz × {screen, print} on 6 surfaces: least gap between stacked flag strokes 2.01px in every measurement (needs ≥ 2); beam and stub × levels × Sz | review-probes/INV-008-INV-009-flags-every-surface.spec.ts and review-probes/INV-009-flag-gaps.spec.ts (green; both adopted); `notation-alignment.spec.ts` (green) |
| INV-010 | held | `--text` against {`--bg`, `--bg-raised`, `--selection`} × Th, plus print; 13 greyscale crops pairwise distinct | review-probes/INV-010-symbol-contrast-tokens.test.ts (green, adopted); `notation-symbols.spec.ts`, `rhythm-marks.spec.ts`, `usability-contrast.spec.ts` (green). For the eye: NOTE F3, and F2 on what the screenshots show |
| INV-011 | held | {tuplet, plain} × Th at 6 strings 375×667; 4 strings wrapped 412×915 | review-probes/INV-011-capture-transition-with-group.spec.ts (green; adopted as `notation-capture-transition.spec.ts`); `notation-capture.spec.ts` (green) |
| INV-012 | held | D 6 × stored {null, each D, `"64"`} × 2 projects; lit against unlit in greyscale | `notation-buttons.spec.ts`, `durations-layout.spec.ts`, `durations-row-every-column.spec.ts`, `rhythm-lit-and-nowhere-else.spec.ts` (green); `duration-row.test.tsx` (green in `npm test`) |
| INV-013 | held | aria snapshot with durations against without × 2 projects; `aria-hidden` on every rhythm part over 72 renders; `descriptions` hashes unedited | review-probes/INV-006-INV-007-INV-013-song-page.spec.ts and review-probes/INV-004-brackets-every-group-shape.test.tsx (green); `baseline.json` zero diff (`check:untouched-notation`) |
| INV-014 | held | {song, play, capture} | `notation-offline.spec.ts` (green). The cold offline open is judged by construction, as in round 3: no `url(`, `<img>`, font or `fetch` in the rhythm sources, and `public/sw.js` zero diff. The landed test's weakness is FU8 |
| INV-015 | held | every Scope fence path; `notation.ts` additions only; spec 004 | `check:untouched-notation` (exit 0); `test:spec004` (pass) |
| INV-016 | held | the 10 FR-035 amendments; every re-pinned test, and now the new guard, named in DECISIONS (docs/DECISIONS.md:742-743) | `check:notation-amendments`, `check:polish-amendments`, `check:usability-amendments` (exit 0). Spec 007 FR-064 still ends `))` (FU1) |
| INV-017 | held | quickstart §6 and both §7 items | specs/009-rhythm-notation/tasks.md:151-153: T043–T045 unchecked and `🛑 BLOCKED`; 66 of 69 tasks ticked, those 3 open |
| INV-018 | held | capture: x and width before and after the first duration, tuplet and plain × Th; song ×2, play, print × Sz | review-probes/INV-011-capture-transition-with-group.spec.ts (green); `notation-alignment.spec.ts`, `rhythm-marks.spec.ts` (green) |
| INV-019 | held | generated sequences with `x2`/`x3` repeats × 2 densities; Corp rows 15, 16 | review-probes/INV-002-INV-019-beam-breaks-exhaustive.test.ts (green); `beams.test.ts` (green in `npm test`) |

Plan Technical Context, "Edits keep each file's line endings": **held**. 31 of 31 modified tracked files keep their index ending, and 65
of 65 new files are `w/lf` by `git ls-files --eol`. The probe is review-probes/PLAN-line-endings-kept.sh (exit 0, and fixed this round:
F1).

## Findings

- [ ] MINOR F1 — The new guard's "a new file holds a CR" check cannot fail on Windows, so T065 is ticked on a clause that is vacuous
      where this branch is built
      where:  scripts/check-line-endings.sh:27 (`grep -q $'\r' "$f"`), scripts/check-line-endings.sh:2 (the header still reads "Review
              probe (round 3)"), docs/DECISIONS.md:743 (says the guard "fails … when a new file under `src/`, `e2e/` or `scripts/` holds
              a CR"), specs/009-rhythm-notation/tasks.md:254 (T065)
      why:    Git for Windows ships GNU grep 3.0, which strips each CR before it matches unless told `-U`. So `grep -q $'\r'` returns 1
              on a CRLF file. On a throwaway repo with a new `src/n.ts` of `x\r\n`, the guard printed "line endings: kept" and exited 0.
              The same blind `grep -c $'\r'` is what the implement pass used to confirm its new files had no CR. The other two clauses
              do work: a tracked LF file rewritten CRLF made the guard exit 1. The defect is inherited from round 3's own probe
              (review-probes/PLAN-line-endings-kept.sh:27 as it was).
      not blocking because: nothing is wrong with the tree. `git ls-files --eol` reads `w/lf` for all 65 new files, and it does not go
              through grep. The only tasks left are a person's (T043–T045), which write no files. Once committed, every new file is
              tracked and falls under the first clause, which works.
      owed:   `grep -qU` in scripts/check-line-endings.sh:27, or read `git ls-files --eol --others` instead, and fix the header. The
              probe is already fixed (`grep -qU`). It exits 0 on the tree and 1 on the CRLF fixture. → FU12
      traces: plan.md Technical Context (line endings), T065

- [ ] MINOR F2 — The lone-symbols screenshots T068 added cut the staff off at the viewport. No rest except the whole rest is in them, and
      at 375 neither is the thirty-second's flag
      where:  e2e/notation-screens.spec.ts:111 (`getByTestId("tab-staff").first().screenshot`), e2e/notation-screens.spec.ts:89-97 (the
              set), specs/009-rhythm-notation/review-probes/INV-010-lone-symbols-screens.spec.ts:46 (the probe it came from)
      why:    on the song page the staff is wider than the viewport, and an element screenshot keeps only its visible box. Regenerated
              this round:
              - `lone-symbols-1280-*.png` shows bars 1–7: every note, the lone and beamed flags, and the whole rest. The rests in bars
                8–10 (h, q, 8, 16, 32) are cut off;
              - `lone-symbols-375-*.png` shows bars 1–4: whole, half, quarter, the lone 8th and the lone 16th. The lone 32nd, the
                beamed pairs and every rest are cut off. The page's fixed bottom bar also overlaps the rhythm row.

              The test asserts only that each file is written, so it passes. T068's own condition, "the screenshots show a flag", holds.
              Its set, "every Sym member alone in its beat", is not on the screen.
      not blocking because: these are aids for T043, which a person does in a real browser and can scroll. INV-010's distinctness is
              measured in `notation-symbols.spec.ts` over all 13 states.
      owed:   screenshot each bar, or the scroll container after scrolling it to each bar, at both sizes. → FU13
      traces: INV-010, T068, quickstart §6

- NOTE F3 — For T043 and T044's eye (round 3's NOTE F2, unchanged): the staff flag is a straight foot (src/components/rhythm/glyphs.ts:54).
  So a lone eighth reads as an "L", and a sixteenth or thirty-second as stacked feet. It is distinct by measure: the 13 greyscale crops
  are pairwise distinct, and stacked flags are 2.01px apart. `lone-symbols-1280-light.png` now shows all three lone, beside their beamed
  pairs. Whether it reads as a flag rather than a beam stub, at actual size and at arm's length, is the person-level call.

## Follow-ups

Not this spec's work to gate on, and unboxed on purpose. FU1–FU10 are carried from round 3 with their locations re-checked. Round 3's
FU11 (tasks.md CRLF) is gone, because tasks.md is LF now.

- FU1 — MINOR: spec 007 FR-064's amendment note still ends `…see docs/DECISIONS.md.))*` (specs/007-usability-pass/spec.md:444).
- FU2 — MINOR: `e2e/notation-capture-height.spec.ts:2` still calls itself a "Review probe", and its header says the landed spec reads
  selectors "which nothing draws", which is untrue of the file it sits in.
- FU3 — MINOR: `docs/DECISIONS.md:772` still says "Open: `polish-band-interactions.spec.ts:363` … Shards 6 to 8 were not yet run". T046
  and T039 closed both, and `polish-band-interactions.spec.ts` passed this round.
- FU4 — MINOR: capture computes its own `hasRhythm` for the band (src/components/capture/CaptureScreen.tsx:209, :677) instead of the
  contract's `:has(… .tab-staff[data-rhythm])` rule.
- FU5 — MINOR: `showRhythm`'s doc comment still says "Off for capture and export" (src/components/tab/TabStaff.tsx:97).
- FU6 — MINOR, for T043's eye: whole and half rests are drawn as unfilled outlines (src/app/globals.css:433-444, `fill: none`), where
  printed rests are solid.
- FU7 — MINOR, three small things:
  - `e2e/notation-measure-before.spec.ts:13` rewrites `research-probes/measure-before.json` on every full run. It did so again this round
    at 09:10, during T069. The figures are unchanged, because the scenario has no durations;
  - `docs/DECISIONS.md:765` says "1.4rem on the touch rule", but 1.4rem is the fine rule (src/app/globals.css:108);
  - `scripts/untouched-by-notation.sh:14` fences a `src/lib/rhythm/__tests__/notation-baseline.test.ts` that does not exist.
- FU8 — MINOR, test integrity: `e2e/notation-offline.spec.ts:27-28` starts listening for requests just before going offline, once the
  notation is already drawn. Its request assertions therefore cannot fail for what INV-014 guards.
- FU9 — out of scope: `specs/004-ascii-import/review-probes/INV-014-030-wrapped-cells-only-s6-claims.test.ts` is a `parseTab` timing
  probe that flaked in round 2. `src/lib/tab/` has zero diff.
- FU10 — MINOR: the staff flag's box is stated twice with nothing pinning the two together: `STAFF_FLAG`'s `width: 7, height: 4`
  (src/components/rhythm/glyphs.ts:54, the viewBox at src/components/tab/RhythmCell.tsx:72), and `width: 7px; height: 4px`
  (src/app/globals.css:448-449). INV-009 has 0.01px of slack. The adopted e2e specs would catch a drift, but no unit test would.
- FU12 — MINOR F1: `grep -qU` in scripts/check-line-endings.sh:27, and drop the "Review probe (round 3)" header (:2). Adopting the fixed
  review-probes/PLAN-line-endings-kept.sh is the same change.
- FU13 — MINOR F2: make the lone-symbols screenshots (e2e/notation-screens.spec.ts:111) show every bar, so the T043 reader sees all 13
  states alone.
- Probe adoption:
  - every round 1–3 probe is in the suite (T047, T049, T051, T055–T060, T063, T065, T067, T068). The one that is not yet adopted as
    written is the round 4 fix to PLAN-line-endings-kept.sh (FU12);
  - `review-probes/playwright.e2e-prebuilt.config.ts` is new this round. It is a harness that runs `e2e/` against an existing build,
    not a probe, and needs no adoption.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted | Not checked |
|---|---|---|---|---|---|---|
| Plan invariants | 19 | 19 | 0 | 0 | 0 | 0 |
| Round 3 findings | 1 | 1 (F1: DECISIONS.md LF, 44+/0−, guarded) | 0 | 0 | 0 | 0 |
| Round 2 findings | 1 | 1 | 0 | 0 | 0 | 0 |
| Round 1 findings | 7 | 7 (F7 fixed again by T066) | 0 | 0 | 0 | 0 |
| Phase 10 tasks (T065–T069) | 5 | 4 | 1 (T065: one clause of three is vacuous on Windows, F1) | 0 | 0 | 0 |
| Functional requirements | 37 | 37 (FR-027's "told apart by eye" is measured, not seen: T044) | 0 | 0 | 0 | 0 |
| Success criteria | 9 | 7 | 0 | 0 | 0 | 2 (SC-002, SC-009: the person-level pass, T043) |
| Plan gates (the constitution is the unfilled template) | 14 | 13 | 0 | 0 | 0 | 1 (the browser pass, owed to T043) |
| Plan technical constraints | 7 | 6 (line endings held again) | 0 | 0 | 0 | 1 ("never run the build while a dev server holds `.next`" is a process rule: none was running this round) |
| User stories | 4 | 4 (US1–US4, by automated measure) | 0 | 0 | 0 | 0 |

## What I could not check

- How it looks to a person (SC-002, SC-009, T043): the 13 symbols at actual size, the greyscale pass, and whether the straight flag reads
  as a flag (F3). I looked at the regenerated lone-symbol screenshots. They show the flags distinctly, but they are crops and miss the
  rests (F2).
- Anything on a real phone (T044, T045): three flags 2.01px apart at arm's length, and a thumb over the capture row.
- A cold reload with no network. Playwright's offline emulation fails a reload before it reaches the service worker, so INV-014's cold open
  is judged by construction.
- INV-006 in print with a bar wider than the page (not emulated), and a removal gap's beam in a real browser. That beam is measured in
  jsdom, and it is the same element as the connector's beam, which is measured in a browser.
- The `firefox` and `no-pointer` projects, the `import-*` specs, and the specs that need Postgres. They were not run this round, and
  nothing they cover changed since the full-suite run in T039/T046.
- That CI is green. Nothing has been pushed.
