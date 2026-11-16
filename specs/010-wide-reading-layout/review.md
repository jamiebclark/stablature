# Review: Full-width reading layout, a whole song on one screen

Reviewed 50 file(s) changed across 0 commit(s), against `main` (merge-base 03fc3c7). The branch still has no commits, so this
is the **uncommitted working tree** diffed against `main`: 25 modified tracked files and 25 new untracked ones (not counting
`specs/010-wide-reading-layout/` and `.specify/roadmaps/best-in-class.json`). **Round 3.** Round 1 found three MAJORs, fixed by
Phase 9 (T064–T078). Round 2 found one MAJOR (F1, line endings), fixed by Phase 10 (T079–T082). No round has had a BLOCKER, so
no component is on a repeat.

**Read in full:** the round-3 diff, meaning every file written after round 2 closed (05:50):
- `src/components/reading/useReadingPosition.ts` (T079: line endings only);
- `src/lib/reading/__tests__/wide-threshold.test.ts` (T081);
- `e2e/wide-print.spec.ts` (T080) and `e2e/wide-order.spec.ts` (T082);
- `contracts/reading-cards.md` §1 and `data-model.md` §4;
- `review-probes/INV-016-threshold-test-sees-range-syntax.probe.sh`, whose copied regexes T081 brought up to the test's new
  ones. That is the right maintenance for a probe that runs the test's own regexes.

**Read again in full, for the invariant walk:** the product diff of `globals.css`, `PlayView.tsx`, `SongView.tsx`,
`Footer.tsx`, `ClickBar.tsx` and `TabStaff.tsx`, plus the loops of every `wide-*.spec.ts`, which I checked member by member
against each invariant's "Holds over" cell. No product code changed this round apart from `useReadingPosition.ts`'s line
endings.

**Evidence base:**
- Everything ran against one fresh production build of this tree.
- **A fresh build of `main`:** a `git archive` export with a real copy of `node_modules`, built and served by
  `review-probes/playwright.baseline.config.ts`.
- **The whole e2e suite:** run in 8 shards by the new `review-probes/suite.config.ts`. It spreads `playwright.config.ts`, so
  it has the same projects, the same `PHONE_ONLY` list, and Firefox. It reuses the build and sets retries to 0.

## Verdict

**Ready to merge: no BLOCKER, no MAJOR.** Every finding of rounds 1 and 2 is fixed and stays fixed:
- **Round 2's F1.** `useReadingPosition.ts` is LF again. Its diff against `main` is 39+/5− with or without
  `--ignore-cr-at-eol`, and `npm run check:line-endings` exits 0.
- **Round 2's F2.** `wide-print.spec.ts` now waits for the cards and the bar and asserts the card count. It passed 48 of 48
  over 6 repeats.
- **Round 2's F3.** The threshold test now rejects a width condition in any syntax. The probe catches all three forms (exit 0).

All 21 invariants hold over their full enumerations. This round closes the members earlier rounds left unrun:
- **INV-001** now holds against a fresh recording of `main` at all 8 narrow size × pointer members in both themes: 128 page
  loads, 0 differences. Before, it covered only 3 of 8 sizes (round 2's FU5).
- **INV-012** now holds on the fit song as well as the 40-entry one, at rest and running, with the cluster open and closed.
- **INV-011**'s "fell behind" and "screen hidden" states are now reached by their real routes, not written into the slot.
- **INV-020** now holds for "column on" and "column back" at 768.

Every saved probe holds: 162 runs plus the shell probe. The whole suite passed: 2005 passed, 0 failed, 462 skipped (all of
them designed project skips).

One new MINOR goes to follow-ups. Six of this entry's new files are CRLF, and the project's line-endings guard cannot see it
on Windows. Convert them to LF before the commit. It does not gate the merge.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | **Wn** × **Ptr** = {320, 375, 412, 767} × {touch, mouse}, 8 of 8, × **Th** × **Pg** × 4 fixture songs: 128 page loads against a fresh recording of `main`. Also the suite's 3 fixture sizes × **Th**, and the structural test at {320, 375, 767} | New `review-probes/INV-001-narrow-every-size-vs-main.probe.ts`. It checks (a) rects ±0.5, (b) the normalised markup's sha256 and (c) no wrapped song-page staff, every li spanning its list: 16 of 16 tests, 0 differences. Recording `main`'s layout at the 3 sizes the fixture also holds matched `e2e/fixtures/narrow-before.json` exactly (4956 values, max Δ 0). Rects tell touch from mouse at 375 (1442 values differ), so (a) can fail. `e2e/wide-narrow-unchanged.spec.ts` passes. Closes round 2's FU5 |
| INV-002 | held | **Ww** (6) × **Ptr** × **Pg** × {fit, short, long, names, empty}, 120 of 120 loads | `e2e/wide-order.spec.ts` passes (in the wide run and the full suite); `review-probes/INV-002-003-order-and-track.probe.ts` holds |
| INV-003 | held | The same 120 loads, plus the song page's `main` width equal to the play view's at 6 widths × 2 **Ptr** × 5 songs | The same two |
| INV-004 | held | **W** ∪ {2560} (10 widths) × **Ptr** × **Th** × **Pg** × **View** × {fit, wide-bar, names, long}, as `wide-sideways.spec.ts:8-20` loops. Firefox: {375, 767, 768, 1280} × **Pg** × {long, wide-bar, fit} | `e2e/wide-sideways.spec.ts` passes. `e2e/wide-sideways-firefox.spec.ts` passes on the `firefox` project (shard 8 of the full suite). `review-probes/INV-004-ruler-overflow.firefox.probe.ts` holds |
| INV-005 | held | {1280×800, 1440×900} × **Th** × play view, mouse, 4 of 4; song page 2 of 2; touch skipped (Decision 8) | `e2e/wide-fit.spec.ts` passes; `review-probes/INV-005-012-015-bar-clearance-and-print.probe.ts` holds |
| INV-006 | held | {768, 1024, 1280} × **Ptr** × **Pg** | `e2e/wide-order.spec.ts` passes |
| INV-007 | held | **Fold** F1–F15 (unit); {F1–F9, F13, F15} × {375, 1280} plus the F11 twins (e2e) | `src/lib/reading/__tests__/cards.test.ts` (in `npm test`, 6394/6394); `e2e/wide-fold.spec.ts` passes |
| INV-008 | held | **Fold** (unit); {F1–F9, F13, F15} × {screen, **Prn**} | The same two |
| INV-009 | held | Keys: {fit, F5, F8} × {375, 1280}. Following: the same, plus fit at 768. A resize across 768 mid-walk (768, 767, 1280). Pass words while read: {fit, F3} × {375, 1280}. F15 *is* the fit song (`contracts/cards.md` §4) | `e2e/wide-position.spec.ts` passes; `review-probes/INV-009-single-pass-card-words.probe.ts` and `INV-009-020-following-and-bar-steps.probe.ts` hold |
| INV-010 | held | {fit, F2, F5, F8}: accents = 38, 16, 16, 6 exactly, desktop | `e2e/wide-click-plays-all.spec.ts` passes; probe holds; `click-following.spec.ts` passes unedited (full suite) |
| INV-011 | held | **Every message:** every `CLICK_WORDS` idle message and every running × help pair × **Bw** × **Ptr** × **Clu**, written into the slot. **Real routes:** "fell behind" (2.5 s main-thread stall) and "hidden" (`pagehide`) × **Bw** × **Ptr**, 24 of 24. **Rest/running/stopped × Clu × Bw × Ptr:** {one pass, fit, 40 entries}, 3 of 3 songs | `e2e/wide-click-bar.spec.ts` passes; `review-probes/INV-011-bar-every-message.probe.ts` holds. New `review-probes/INV-011-012-020-every-song-and-route.probe.ts`: height ±0.5 and Start, tempo and More still, in every case. `click-double-tap.spec.ts` and `click-bar-fit.spec.ts` pass unedited. "Audio lost" is not reachable headless (see below) |
| INV-012 | held | {rest, running} × **Clu** × **Bw** × **Ptr** × {fit, 40 entries}, 48 of 48 members, ×6 repeats = 144 runs | New `review-probes/INV-011-012-020-every-song-and-route.probe.ts`, scrolling by wheel and classifying each read: 144 of 144. The suite's INV-012 test covers 40 entries only, and passed 96 of 96 (×8). The fit song was never run running or with the cluster open before this round. On the followed column, `reading-highlight-on-screen.spec.ts` passes (full suite). See **F2** |
| INV-013 | held | {768, 1024, 1280} × **Ptr** × **View** × **Dens** × {fit, wide-bar, names}; {375, 412} never wraps | `e2e/wide-sideways.spec.ts` (compact and expanded) passes; `review-probes/INV-013-compact-and-rows.probe.ts` holds; `reading-layout.spec.ts` and `notation-beams.spec.ts` pass unedited (full suite) |
| INV-014 | held | Every path in *Scope fence* | `npm run check:untouched-wide`: exit 0, zero diff everywhere, `capture.spec.ts` changed only inside its test. `npm test` 6394/6394. `npm run test:spec004` passes. **Full suite, 0 failed**, including every `capture-*`, `notation-capture*` and `polish-*` spec, which round 2 could not run |
| INV-015 | held | **Prn** × **Th** × {fit, F5}, both projects | `e2e/wide-print.spec.ts` 48 of 48 (×6). `review-probes/INV-005-012-015-…` and `INV-015-print-measures-before-render.probe.ts` hold |
| INV-016 | held | {767, 768} × **Ptr** × **Pg** at 16px. {767, 768, 900} × **Pg** at a 20px default font size | `wide-threshold.test.ts` (3 tests, now any syntax) passes; `INV-016-threshold-test-sees-range-syntax.probe.sh` exits 0 (all three forms caught); `e2e/wide-order.spec.ts` with T082's 20px test passes; `INV-016-threshold-font-size.probe.ts` holds |
| INV-017 | held | Every row of the plan's table; spec 007 SC-010, FR-055 | `npm run check:wide-amendments` ok. No re-pinned file changed this round: the round-3 files are this entry's own `wide-*` tests and unit test |
| INV-018 | held | §6 and §7 | T057 and T058 unchecked and `🛑 BLOCKED` (`tasks.md:199-200`) |
| INV-019 | held | **View** × {fit's parts, names (two-digit frets), wide-bar}; **View** × {chord-widened, connector gaps, removal gaps mid and end}; the fit song settled; × **Ptr** (both projects) | `e2e/wide-ruler.spec.ts` passes; `review-probes/INV-019-ruler-every-case.probe.ts` and `INV-019-ruler-fit-song.probe.ts` hold |
| INV-020 | held | {fit} × {768, 1280} × **Pos**. Following at 768 and 1280, "bar on"/"bar back" at {375, 768, 1280}, and now "column on"/"column back" at 768 as well as 375 and 1280 | `e2e/wide-position.spec.ts` passes; `review-probes/INV-009-020-…` holds. New `review-probes/INV-011-012-020-every-song-and-route.probe.ts`: at 768 and 1280, 304 stops each way, worst card shift 0, 0 `childList` records |
| INV-021 | held | {part menu, rename, label link, song tools panel, view control, density control, cluster} × {768, 1280} × **Ptr** | `e2e/wide-controls.spec.ts` passes; `review-probes/INV-021-001-cluster-and-narrow-320.probe.ts` holds |

## Findings

- [ ] MINOR F1 — Six of this entry's new files are CRLF, against plan.md's "Every file touched is LF", and the guard meant to catch it cannot see a CR on Windows
      where:  src/components/reading/useCardTrack.ts:1, e2e/wide-helpers.ts:1, e2e/wide-position.spec.ts:1, e2e/wide-fit.spec.ts:1, e2e/wide-narrow-record.ts:1, e2e/wide-click-plays-all.spec.ts:1, specs/010-wide-reading-layout/plan.md:87, scripts/check-line-endings.sh:27
      why:    Counted by bytes, each of the six is CRLF on every line: 33, 222, 339, 80, 114 and 30 CRs. The other 19 new
              files under `src/`, `e2e/` and `scripts/` are LF. So is 92% of the index (996 LF against 79 CRLF). With
              `core.autocrlf=false` and no `.gitattributes`, a commit stores them as CRLF.
              The guard's new-file check, `grep -q $'\r'` at `scripts/check-line-endings.sh:27`, never matches under Git for
              Windows' GNU grep 3.0, which strips the CR before matching. So `npm run check:line-endings` prints "kept",
              and T056 and T079 record it as passing. Rounds 1 and 2 relied on that output and missed this. `useCardTrack.ts`
              has been CRLF since 2026-11-13.
              **Not MAJOR**, unlike round 2's F1. That one flipped an existing file and made its diff rewrite every line, which
              buried the real change. These are whole new files, so no diff or blame is damaged, nothing behaves differently,
              and entries 5 and 6 shipped the same class as a follow-up.
      owed:   Convert the six files to LF with no other change, before the commit. Afterwards
              `for f in $(git ls-files --others --exclude-standard -- src e2e scripts); do tr -cd '\r' < "$f" | wc -c; done`
              prints only zeros.
      traces: plan.md Technical Context (line endings), T056

- NOTE F2 — The suite's INV-012 test reads its running cases after a programmatic `scrollTo`, which the click's following does
  not treat as a reader's scroll. It held 96 of 96 here, so this is a hazard, not a defect. `useReadingPosition.ts` rests the
  following only after a wheel, touch, pointer or key scroll (`:84-99`, `FOLLOW_REST_MS` 4 s), so a following beat can start
  a smooth `scrollIntoView` between the test's `scrollTo` (`e2e/wide-click-bar.spec.ts:107`) and its read. This round's probe,
  written the same way at first, read 10 of 144 runs while the page was 2–9px short of its end. Every one of the 10 was
  `atEnd: false`, and the page read 7.75px of clearance at its end. Scrolled by wheel, as a reader scrolls, it held 144 of 144.
  The product is right: a reader who scrolls to the end rests the following. Adopting the wheel form removes the hazard (FU6).

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — MINOR F1: convert the six CRLF files to LF before the entry is committed (`src/components/reading/useCardTrack.ts:1`
  and five `e2e/wide-*` files).
- FU2 — out of scope, on `main`: `scripts/check-line-endings.sh:27` uses `grep -q $'\r'`, which cannot match under Git for
  Windows. Count bytes with `tr -cd '\r' | wc -c`, or use `grep -qU`, so the new-file check can fail on the machine it runs
  on.
- FU3 — carried from round 2's FU2, the part T081 did not cover. `research.md:207` and `:211` still give `(width >= 48rem)`
  and say `48rem` "is 768px whatever the root font size", which is the error behind round 1's F2. The contract and data model
  are corrected, and the unit test now catches the form.
- FU4 — carried from round 1's F9: "010 — decisions" does not record that spec 006's fence, `npm run
  check:untouched-reading`, exits 1 on `src/components/rhythm/ClickBar.tsx`, as entries 007 and 008 recorded theirs
  (`docs/DECISIONS.md:601`, `:706`).
- FU5 — carried from round 1's F10: `docs/DECISIONS.md:786` says the play view leaves its footer out "at `wide`".
  `src/components/app/Footer.tsx:16` leaves it out at every width, as plan.md Deviation 3 says it should.
- FU6 — adopt `review-probes/INV-011-012-020-every-song-and-route.probe.ts` into `e2e/wide-click-bar.spec.ts` and
  `e2e/wide-position.spec.ts`. That brings the fit song × running × cluster open (INV-012), the "fell behind" and "hidden"
  routes (INV-011) and the column walk at 768 (INV-020) into the suite. Switch `wide-click-bar.spec.ts:107`'s `scrollTo` to a
  wheel (NOTE F2).
- FU7 — adopt `review-probes/INV-001-narrow-every-size-vs-main.probe.ts` and its `INV-001-main-narrow/` recording (8 × 11 KB
  of rects and hashes, taken from `main` at 03fc3c7) into `e2e/wide-narrow-unchanged.spec.ts`, so the suite holds INV-001 at
  320, at 375/412 with a mouse and at 767 on touch. `e2e/fixtures/narrow-before.json` stays untouched.

Round 2's FU1 (print flake), FU5 (INV-001's missing sizes) and FU6 (the 20px cases) are closed. FU2 is closed apart from
research.md (FU3 above). Round 2's FU3 and FU4 are carried as FU4 and FU5.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Invariants (plan § Invariants) | 21 | 21 | 0 | 0 | 0 |
| Functional requirements | 33 | 33 | 0 | 0 | 0 |
| Success criteria (SC-008 also needs a person: T057) | 7 | 7 | 0 | 0 | 0 |
| Plan working-rule gates (the constitution file is an unfilled template) | 13 | 13 | 0 | 0 | 0 |
| Plan Technical Context constraints (zero-diff paths, click specs unedited, `TabStaff` markup without `ruler`, no opacity tier, line endings, specs typecheck) | 6 | 5 | 1 (line endings: six new files CRLF, MINOR F1) | 0 | 0 |
| Round-2 findings re-checked | 4 | 3 fixed (F1–F3) | 0 | 0 | 0 (F4 was a note) |
| Round-2 follow-ups re-checked | 6 | 3 closed (FU1, FU5, FU6) | 1 (FU2: research.md) | 0 | 2 open MINORs carried (FU3, FU4) |

Guards and runs this round, all against one build of this tree:
- `npm run typecheck`: exit 0, with every review probe and the two new configs, which `tsconfig` includes.
- `npm run lint`: 0 errors, 13 warnings.
- `npm test`: 6394/6394. `npm run test:spec004`: pass.
- `npm run check:untouched-wide`: exit 0. `npm run check:wide-amendments`: ok.
- `npm run check:untouched-reading`: exit 1, on `ClickBar.tsx` only, as known (FU4).
- `npm run check:line-endings`: exit 0, but blind to CRs in new files (F1, FU2).
- **Every saved probe:** 162 passed, 41 designed skips, 0 failed. The shell probe exits 0.
- **Every `wide-*` spec over the probe server:** 218 passed, 32 designed skips (desktop-only or mouse-only), 0 failed.
- **The whole e2e suite** in 8 shards through `review-probes/suite.config.ts`: 2467 runs, 2005 passed, 462 skipped, 0 failed.
- **Repeats:** `wide-print.spec.ts` ×6, 48 of 48. The suite's INV-012 test ×8, 96 of 96. The new INV-011/012 cases ×6, 144 of
  144.
- **`main`:** built from a `git archive` of 03fc3c7, recorded at 8 narrow members, and checked against the committed fixture
  at the 3 sizes they share.

## What I could not check

- **A person at actual size, in both themes and in print preview** (quickstart §6, T057). **A real coarse-pointer tablet,
  and a phone in landscape** (§7, T058). Everything here is emulation in headless Chromium and Firefox. SC-008 rests on T057.
- **"Audio lost" by its real route.** It needs the device to take the AudioContext, which headless Chromium cannot do. Its
  words are covered by the every-message test, and the held height comes from the ghosts, not from the route. "Hidden" was
  reached by a synthetic `pagehide` on the app's own listener, not by switching tabs or locking a screen.
- **Linux rendering.** Every figure was measured on Windows Chromium. The plan records about 14px more horizontal fit
  margin on Linux, and CI runs there.
- **Safari/WebKit**, and **print from a real print dialog**. Print is `emulateMedia` at 718 and 1047px.
- **The suite through `npm run test:e2e` itself.** I ran the same projects over the same build through
  `review-probes/suite.config.ts`, with retries 0. The only difference is that it does not rebuild.
