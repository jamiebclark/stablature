# Review: Tab playback, a part or the whole song as sound

Reviewed 64 file(s) changed across 0 commit(s), against main...working tree. Nothing is committed: `HEAD` is `main`
(023faa2), and the whole feature is the working tree on `011-tab-playback`. That is 14 modified tracked files and 50
new ones, not counting `specs/011-tab-playback/` and `.specify/roadmaps/`. This reviews `git diff main` plus the
untracked files.

**Round 3.**
- **Round 1** found 5 MAJOR (F1 to F5), 7 MINOR (F6 to F12) and 3 NOTEs (F13 to F15). Phase 10 (T063 to T076)
  remediated them.
- **Round 2** found 2 MAJOR (F16, the mix clipping, and F17, line endings), 1 MINOR (F18) and 3 NOTEs (F19 to F21).
  Phase 11 (T077 to T085) remediated them.
- **No BLOCKER** has been found in any round, so no component is due a REDESIGN. This round's findings are numbered
  from F22.

**Read in full (round 3, everything Phase 11 touched):**
- `src/lib/playback/synth.ts`;
- `src/lib/playback/__tests__/synth-floor.test.ts` (new);
- `e2e/play-mix.spec.ts`, `play-stop.spec.ts` and `play-sync-midrun.spec.ts`;
- the relevant parts of `src/lib/rhythm/audio.ts`, `src/lib/playback/timeline.ts`, `voice.ts`, `e2e/play-helpers.ts`
  and `scripts/check-line-endings.sh`.

**Sampled:** the T080 to T084 adoptions against their probes. These are `play-mix`'s F0 test, `play-speed.spec.ts:97`,
`play-notes-off-speed.spec.ts`, `play-keys.spec.ts:49`, `play-stop.spec.ts:72` and `play-outline.spec.ts:66`.

**Not re-read:**
- **Line endings only (T079):** `ClickBar.tsx`, `audio.ts`, `timeline.ts`, `types.ts` and the other LF-converted files.
  For the tracked ones, `git diff --stat main` (406 insertions, 65 deletions) now equals both the `--ignore-cr-at-eol`
  stat and round 2's content stat, so their content is what round 2 reviewed.
- **Untouched since round 2:** `stream.ts`, `choices.ts`, `scheduler.ts`, `notation.ts`, `passes.ts`, `PlayView.tsx`,
  `SongView.tsx`, `useClick.ts`, `TempoControl.tsx`, `shortcuts.ts` and the e2e specs Phase 11 left alone. They were
  run, not read.

## Verdict

**Ready to merge on the automated evidence. 0 BLOCKER, 0 MAJOR.** The feature satisfies the spec and hangs together.

Both round-2 MAJORs are fixed and stay fixed:
- **F16, the mix.** `shape()` now re-asserts the FLOOR start of an attacked voice after its cancel
  (src/lib/playback/synth.ts:68), so no new note opens from the GainNode's default 1.0. Every chord case that peaked at
  1.095 to 1.167 in round 2 now peaks at 0.728 to 0.805, Click on and off.
- **F17, line endings.** Both shared files are LF again, no new file carries a CR, `npm run check:line-endings` exits
  0, and the two diff stats are equal.

Every saved probe was re-run first, and none regressed. Two new probes widen the two invariants that still had
untested members. Both hold:
- **INV-018's mix**, over the tones round 2 never chorded. A column on every string of dead thuds, palm-mutes or
  harmonics, and a let-ring chord alternating with a chug, peak at 0.679 to 0.752. One case is the bass 6 chug, whose
  three lowest thuds share a 150 Hz band and one noise buffer, so they add in phase.
- **INV-009**, over the **When** members no test had timed. Mid-glide, mid-let-ring and the loop seam give 36 of 36
  across all six stop kinds on both projects.

What is left:
- **MINOR F22**: `e2e/play-stop.spec.ts` never stops mid-let-ring, which SC-007 names. The behaviour holds (probe
  above). The suite cannot see it.
- **Round 2's MINOR F18** and **round 1's MINORs F6 to F12**, all in § Follow-ups.
- **The two human tasks**, T061 (listening) and T062 (a real phone). They are open by design (INV-021).

`tasks.md` is unchanged.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | **Unit:** {plain, following, following→plain} × {40, 120, 240}, 9 of 9 (`engine-golden.test.ts` in `npm test`, 6565 of 6565). **e2e:** every `click-*`, `wide-click-*` and `wide-narrow-unchanged` spec × {mobile, desktop}: 213 passed, 61 skipped. `reading-*`, `usability-{highlight*, keys, floors, cluster-states, wrap, height-budget, reach, every-screen, density, insets, surfaces, contrast, help-reopen}`, `wide-controls` and `polish-part-card*`: 362 passed, 58 skipped. `play-notes-off` on both projects | the suites named. **Th** is not run separately, because the pinned specs cover the themes they pin. |
| INV-002 | held | **Tun** × every string × {0, 1, 5, 12, 24}; the harmonic nodes; T19 (unit). Part T's pitches (e2e) | `timeline.test.ts` (in `npm test`); `e2e/play-part.spec.ts` |
| INV-003 | held | L1–L21; 6000 seeded arrangements against the oracle; `play-nothing-written` | review-probes/INV-003-length-rule-seeded.test.ts (also in the suite) |
| INV-004 | held | 11 BARS × 5 ARR plus 6000 seeds; S5 | review-probes/INV-004-agreement-seeded.test.ts (also in the suite). e2e `play-agree` is still untimed only (round-1 F12). |
| INV-005 | held | {let_ring, harmonic} × {fret, hammer-on, slide, `x`, `x[palm_mute]`, `[dead_note]`} plus the other-string controls, 14 of 14; T1–T19 (unit). `play-techniques`: no new source on connected notes after the F16 fix | review-probes/INV-005-string-holds-one-note.test.ts (adopted) |
| INV-006 | held | Len ∪ playback song via `partPass`/`drawnPasses` (unit). Whole song, part T, part of a variant (A′) 2 of 2 | review-probes/INV-006-variant-part.spec.ts (adopted as play-outline.spec.ts:66) |
| INV-007 | held | {40, 120, 240} × {Click on, off} × 10 min; L1 looped; speeds mid-run (fake clock) | `engine.test.ts` E1, E2, E5 in `npm test` |
| INV-008 | held | Loop {on, off} × Click {on, off}, part scope, focus after the end | review-probes/INV-008-focus-after-end.spec.ts 4 of 4 (adopted in `play-end`) |
| INV-009 | held | **Stop** × **When**, every member. Count-in and mid-note: `play-stop` with `play-offline` × 3 repeats, 168 of 168. **New:** {tap Stop, Space, `r`, back link, audio-lost, pagehide} × {mid-glide, mid-let-ring, loop seam} × 2 projects, 36 of 36. Browser back: `play-stop.spec.ts:72`. `fell-behind` and `ended`: `play-every-ending`, `play-end` | review-probes/INV-009-stop-every-moment.spec.ts; review-probes/INV-009-022-part-scope-keys-and-back.spec.ts |
| INV-010 | held | Whole song with Notes on: order, timing and `pass j of n` words, 2 of 2; part T (`play-outline`) | review-probes/INV-010-whole-song-outline.spec.ts (adopted as `play-whole-song-outline`) |
| INV-011 | held | 3 runs, 11 speed changes, every toggle; the storage spy over every setter | `e2e/play-nothing-written.spec.ts`, `choices.test.ts` |
| INV-012 | held | {Notes off, on} × {50, 100}; Notes off mid-run (speed and stored tempo), 2 of 2; `play-speed` 4 tests × 2 projects | review-probes/INV-012-speed-with-notes-off.spec.ts; review-probes/INV-012-notes-off-midrun.spec.ts (adopted as play-speed.spec.ts:97) |
| INV-013 | held | **BarN** heights at {375×667, 412×915, 1280×800} × 2 projects, 6 of 6; Notes off at speed 70 at rest and running, 6 of 6 | review-probes/INV-013-bar-every-state.spec.ts; review-probes/INV-013-014-notes-off-speed.spec.ts (both adopted) |
| INV-014 | held | `play-controls` (Notes on) at 375, 390 and 1280; the speed controls with Notes off at 375, 412 (touch) and 1280 (mouse), 6 of 6 | review-probes/INV-013-014-notes-off-speed.spec.ts |
| INV-015 | held | Part scope × 2 projects; double tap; `click-double-tap` unedited and passing | `e2e/play-part.spec.ts`, `play-double-tap.spec.ts` |
| INV-016 | held | {part, song} × {mobile, desktop} × 3, 12 of 12; `play-offline` × 3 repeats on both projects; `no-dynamic-import` | review-probes/INV-016-offline-requests-in-window.spec.ts |
| INV-017 | held | Menu Play first on every card; no context after navigating; the whole-song Notes choice kept (`notesAfter: false`, 2 of 2) | `e2e/play-part.spec.ts`. review-probes/INV-017-part-playback-leaves-song-choices.spec.ts fails 4 of 4, only on round-1 MINORs F7 (`loopAfter: true`) and F8 (deletion), as in rounds 1 and 2. |
| INV-018 | held | **Spectral:** the plan's 510 members plus every tone × string × fret 0..24 (unit); F0 on `bass5-drop-f`, 1.000 above 200 Hz in 10 of 10 reads (e2e). **Mix:** part T ≤ 1.0. Plain let-ring on every string × {Click on, off}, 7 of 7 at 0.728–0.805 (round 2: 6 of 7 over 1.0). **New:** dead, palm-muted and harmonic columns on every string, and let-ring alternating with a chug, 6 of 6 at 0.679–0.752 | review-probes/INV-018-mix-seven-string-chord.spec.ts (adopted in `play-mix`); review-probes/INV-018-mix-every-tone-column.spec.ts; review-probes/INV-018-every-string-every-fret.test.ts; review-probes/INV-018-mix-peak-through-the-chord.spec.ts; review-probes/INV-018-f0-drop-f.spec.ts |
| INV-019 | held | Every path of plan § Scope fence | `LC_ALL=C bash scripts/untouched-by-playback.sh` exit 0, last line `only the want line e2e/polish-part-card-menu.spec.ts` |
| INV-020 | held | Spec 005's line; 11 decisions + 4 deviations; 1 re-pin | review-probes/INV-020-amendments.mjs. The project guard still aborts here (round-1 F10). |
| INV-021 | held | T061 and T062 are open and `🛑 BLOCKED` | specs/011-tab-playback/tasks.md:192, specs/011-tab-playback/tasks.md:193 |
| INV-022 | held | {Space, `r`} × {Notes on, off} × {idle, running} (whole song); part scope Space and `r` | `e2e/play-keys.spec.ts` (with play-keys.spec.ts:49 adopted) |
| INV-023 | held | Idle states: written, some, none, empty, no tuning, no tempo. Play is disabled exactly when nothing plays | `click-bar.notes.test.tsx`, `e2e/play-words.spec.ts` |
| INV-024 | held | {hidden, pagehide, audio-lost, fell-behind} × part, plus no audio, both projects | `e2e/play-every-ending.spec.ts` |
| INV-025 | held | 50 cycles × {part, whole song} × 2 projects | `e2e/play-cycles.spec.ts` (its whole-song cycles still run with Notes off, round-1 F12) |

## Findings

- [ ] MINOR F22 — `play-stop` never stops mid-let-ring, mid-glide or at the loop seam, though SC-007 names mid-let-ring
      where:  e2e/play-stop.spec.ts:25, e2e/play-stop.spec.ts:61, specs/011-tab-playback/spec.md:352
      why:    SC-007: "In 100 stops at random moments, including mid-let-ring, nothing sounds later than 50 ms after the
              stop." Part T is at 120 bpm, so the count-in lasts 2 s.
              - The fixed moments `[0, 600, 1500, 2700]` ms (:25) fall in the count-in, or on part T's first two notes.
              - The 100 seeded stops wait `next() * 900` ms after each tap (:61), so every one lands in the count-in.
              The plan's INV-009 enumerates **When** = {count-in, mid-note, mid-let-ring, mid-glide, loop seam}. The
              suite covers the first two. The behaviour holds: review-probes/INV-009-stop-every-moment.spec.ts stops
              at all three missing moments with every stop kind, 36 of 36. The gap is that a regression there would
              pass the suite. T024 (tasks.md:74) is ticked and lists all five **When** members, so tasks.md overstates
              what `play-stop` covers. It stays MINOR, as round 1 rated the same kind of gap (F12), because the
              behaviour itself is proven by a saved probe.
      owed:   Adopt the probe's three moments into `play-stop.spec.ts`. Widen the random wait to cover the whole round
              (for example, 2 s to 16 s after the tap).
      traces: SC-007, INV-009, T024 (its **Stop** × **When** member list)

- NOTE F23 — The F16 fix is the minimal one. `shape()` keeps its cancel and re-asserts FLOOR only for an attacked voice
  (src/lib/playback/synth.ts:68). The legato path (src/lib/playback/synth.ts:116) still ramps from the current value,
  as before.
  - **The unit pin.** `synth-floor.test.ts` checks the call order, which is the structural cause. It fails on the
    round-2 code (no FLOOR `set` after the last cancel) and passes now.
  - **The new levels.** Notes now peak 0.73 to 0.80 under the limiter, against the count-in's 0.66 alone.
  - **Owed by ear (T061):** whether the click stays audible over a full chord (FR-026).
- NOTE F24 — Round 2's NOTEs F19 (the lift removes the lowest partials under 400 Hz) and F21 (round 1's F13 to F15)
  stand unchanged. F20's flake again did not reproduce. `play-stop` and `play-offline` passed 168 of 168 over 3
  repeats.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- **Round-1 MINORs, all still present:**
  - FU1 — F6, src/components/rhythm/ClickBar.tsx:58: `CLICK_WORDS.notes` has no `noTempo` (FR-044 partial).
  - FU2 — F7, src/components/rhythm/ClickBar.tsx:106: part playback's `setLoop(true)` leaks into the whole song. The
    INV-017 probe reads `loopAfter: "true"`.
  - FU3 — F8, src/components/app/PlayView.tsx:252: deleting the part mid-run unmounts the bar and ends the run.
    The spec's edge case says "The run plays what it started with". `e2e/play-sync-midrun.spec.ts:37` accepts either
    outcome, so it cannot see this.
  - FU4 — F9, src/lib/playback/timeline.ts:133: `voice.glideTicks` is computed, and the synth never reads it
    (`glideSeconds`, src/lib/playback/synth.ts:49).
  - FU5 — F10, scripts/check-playback-amendments.sh:29: `grep -qiF` aborts, so the guard cannot pass here. My run of
    it re-created `grep.exe.stackdump` at the repo root. I deleted it again, and the working tree is as I found it.
  - FU6 — F11, e2e/play-outline.spec.ts:54: the "with Notes off" test never turns Notes off.
  - FU7 — F12: `play-agree`, `play-cycles` and `play-controls` are still narrower than the plan's members.
- FU8 — MINOR F18 (round 2): drop the unused `plan` (src/lib/playback/__tests__/voice.test.ts:11), and assert or drop
  `audio` (e2e/play-every-ending.spec.ts:50). Lint: 0 errors, 15 warnings.
- FU9 — MINOR F22: adopt review-probes/INV-009-stop-every-moment.spec.ts into `e2e/play-stop.spec.ts`, and widen its
  random range.
- FU10 — adopt review-probes/INV-018-mix-every-tone-column.spec.ts into `e2e/play-mix.spec.ts`. It is the mix's worst
  case over every tone. The plain-tone cases already went in via T077.
- FU11 — adopt review-probes/INV-017-part-playback-leaves-song-choices.spec.ts once FU2 and FU3 land.
- FU12 — review-probes/INV-020-amendments.mjs stays a probe until FU5 makes the project guard run here.
- FU13 — review-probes/INV-018-mix-gain-stages.spec.ts is a diagnostic. It models the graph without app code, so do not
  adopt it.
- FU14 — **out of scope:** scripts/check-line-endings.sh:27's `grep -q $'\r'` never matches in Git Bash's grep here,
  so the guard cannot see a CR in a new file on Windows. It predates this branch. The review probe
  `plan-line-endings-kept.mjs` reads the bytes and passes.
- FU15 — **out of scope:** `npm run build` (Next.js 16.4.3, the version `package.json` already had on `main`) exited 1
  once with `SecurityFatalError`. That is a notice that this Next.js version has a known advisory. It came after a
  successful compile, and the identical rerun exited 0. This branch does not change the Next.js version. Whether to
  upgrade is the owner's call, and CI may hit the same stop.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Functional requirements | 56 | 54 | 1 | 1 | 0 |
| Success criteria | 13 | 12 | 0 | 1 | 0 |
| Plan invariants | 25 | 25 | 0 | 0 | 0 |
| Plan gates (the constitution is the unfilled template) | 15 | 13 | 0 | 2 | 0 |

**Functional requirements:**
- **Partial:** FR-044 (round-1 F6).
- **Absent:** FR-055, which is owed to a person (T061, `🛑 BLOCKED` by design).
- **Now satisfied:** FR-026 (F16 fixed). Its "the click MUST stay audible over the notes" clause is still owed by ear.

**Success criteria:**
- **Absent:** SC-013, owed by ear.
- **SC-007** holds by probe. Its suite test is narrower than its words (F22, MINOR).

**Plan gates:** the two owed gates are "Browser testing is part of done" (T061) and "Real-device claims are not ticked
from a desktop" (T062). "Tests must be able to fail for the right reason", partial in round 2, now holds: `play-mix`
measures six- and seven-string chords and failed on the round-2 code.

**Suites run this round, over one production build:**
- **Unit:** `npm test`, 6565 of 6565 in 176 files. `npm run typecheck` is clean. `npm run lint` has 0 errors and 15
  warnings.
- **play-\* e2e, both projects:** 168 passed, 10 skipped. `play-stop` and `play-offline` × 3 repeats: 168 of 168.
- **click-\*, wide-click-\* and wide-narrow-unchanged:** 213 passed, 61 skipped.
- **reading-\*, the 13 usability specs under INV-001, wide-controls and polish-part-card\*:** 362 passed, 58 skipped.
- **Review probes:**
  - The unit tier, 18 of 18.
  - The e2e tier: 50 passed, 10 skipped, and INV-017 4 failed, as designed.
  - The new probes: INV-018-mix-every-tone-column 6 of 6, INV-009-stop-every-moment 36 of 36.
  - INV-020 and plan-line-endings-kept both pass.
- **Guards:**
  - `check:untouched-playback` and `check:line-endings` exit 0.
  - `check:playback-amendments` aborts (FU5).
  - I did not run the project's other `check:untouched-*` and `*-amendments` guards this round. This branch's diff
    content is unchanged since T060 ran them.

## What I could not check

- **Listening.** Nothing here has a speaker, so these are owed to T061:
  - SC-013 by ear;
  - whether the click stays audible over a seven-note chord now that the notes sit near 0.75 (FR-026);
  - the thinner low end after F19;
  - the legato swell (F13);
  - the thud and the bell.
- **A real phone.** None of quickstart §6 can run here: the speaker's low end, the silent switch, a lock or a call,
  wake lock, airplane mode, and thumb reach.
- **Real devices.** Every mix and F0 read is Chromium's analyser on desktop. Firefox, Safari and CI's Linux runner
  were not run.
- **Sizes and themes.** INV-001's **Th** was not run as its own axis.
- **Suites I did not run.**
  - The capture-\*, notation-\* and remaining usability e2e specs. They are fenced zero-diff by
    `check:untouched-playback`, and ClickBar is mounted only in `PlayView`, but I did not run them.
  - The full `npx playwright test` with the project's own config.
- **Side effects of mine.**
  - The amendments guard's crash re-created `grep.exe.stackdump`. I deleted it, because it was not there at the start
    of this round.
  - `npm run build` rewrote `.next/`, which git ignores.
  - Nothing else outside `specs/011-tab-playback/` was written: `review.md`, `review-probes/README.md` and the two
    new probes.
