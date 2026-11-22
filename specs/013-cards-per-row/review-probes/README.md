# Spec 013 review probes

Kept so the next review round re-runs them first. Each is named for the invariant it probes.
- **Round 1:** its eight probes were adopted by `tasks.md` Phase 9.
- **Round 2:** its two new probes were adopted by Phase 10 (T042, T044).
- **Round 3:** its three new probes are adopted by Phase 11 (T046–T048). The exception is the frozen-script half of
  `INV-013-print-from-narrow-screen`. That half is review round 3 F2 (MINOR), and it stays here.
- **Round 4:** no finding blocks, so no task adopts its probe. `INV-009-font-load-late` waits in review.md § Follow-ups.
  It adds three tools that are not probes:
  - `INV-013-mutation-proxy.mjs` and `INV-013-mutation.config.ts` run the project's own e2e specs against a stylesheet
    or bundle that a proxy mutates. That shows an adopted test can fail, with no source file edited.
  - `INV-009-click-timing-main-vs-branch.sh` runs one e2e test on clean exports of `main` and of the branch.

Run from the repo root, after one `npx next build`:

```sh
PROBE_NO_BUILD=1 npx playwright test -c specs/013-cards-per-row/review-probes/review.config.ts \
  --project=probe-desktop --project=probe-mobile --project=probe-firefox < /dev/null
```

`suite.config.ts` runs the project's own suite (its projects and PHONE_ONLY skips) against a server started from that
build, so the whole suite can be run in chunks that each finish inside a 10-minute command limit:

```sh
E2E_PORT=3115 npx playwright test -c specs/013-cards-per-row/review-probes/suite.config.ts \
  --project=mobile --project=desktop --workers=6 e2e/usability- < /dev/null
```

Linux Chrome: with the spec 007 replica set up (`INV-016-linux-chrome.sh setup`), copy this directory into the
replica's volume and run `review.config.ts` there with `PROBE_NO_BUILD=1` (round 1 did this; see review.md).

| Probe | Invariant | Round 1 result | Round 2 result | Round 3 result |
|---|---|---|---|---|
| `INV-012-print-80-char-chord-firefox.probe.ts` | INV-012 / FR-018 | **fails** in Chromium, Firefox and Linux Chrome (review F1) | passes (desktop, firefox, Linux) | passes (desktop, mobile, firefox) |
| `INV-012-print-long-chord-column.probe.ts` | INV-012 / FR-017 | passes (the narrow song page's scrolling-staff clip is logged as out of scope) | passes | passes |
| `INV-012-print-chord-any-column.probe.ts` (round 2) | INV-012 / FR-017, FR-018 | — | 5 of 6 shapes pass; "40 in bar 4 of short bars" fails at 375 only (a 269px symbol in a 289px line breaks: the `100vw - 8rem` cap, review F2, MINOR) | unchanged: the 375 member still fails in desktop and firefox (round 3 F3, MINOR); the other 5 shapes pass |
| `INV-013-print-greedy-one-line.probe.ts` | INV-013 / FR-019 | **fails**: fit, short, long at 1047 (review F2); F5 passes | passes | passes |
| `INV-013-print-nothing-cut.probe.ts` | INV-013 / FR-019 | passes in scope (narrow song page logged as out of scope, FU6) | passes | passes |
| `INV-013-print-remeasure.probe.ts` (round 2) | INV-013 / INV-009 / FR-019 | — | round trip passes; `page.pdf()` logs only `beforeprint`/`afterprint` under screen styles; the real-print layout **fails** for `short`'s song page at 1047 (3,3,3,3 vs greedy 4,4,4), Windows and Linux (review F1, MAJOR) | passes. The real-print layout holds: `short`'s song page at 1047 draws `[[0,1,2,3],[4,5,6,7],[8,9,10,11]]`, the greedy rows, in desktop, firefox and Linux |
| `INV-008-ruler-every-member.probe.ts` | INV-008 | **fails**: the empty part's ruler is 0px in every browser (review F3) | passes. Round 2 corrected the empty member: it is checked against the gutter (main's value, round 1's owed fix), not the drawn `EmptyStaff` placeholder, which no ruler has ever counted | passes (desktop, mobile, firefox) |
| `INV-007-long-1920-and-play-views.probe.ts` | INV-007, INV-004 | passes on Windows; **fails on Linux** at 1920, play view, mouse (review F4) | passes on Windows and Linux. Round 2 accepts plan.md Deviation 7 (greedy puts B beside A) only when the drawn rows are the greedy rows | passes |
| `INV-009-triggers-and-key-walk.probe.ts` | INV-009 | passes (density, rename, memo add/delete, play-view key walk at 768 and 1280) | passes | passes |
| `INV-006-017-recorder-floor.probe.ts` | INV-006, INV-017 | passes (the recorder's card keeps 343px at 768–1920) | passes. Round 2 skips Firefox at file level: it cannot grant the microphone permission, and the context was made before the in-test skip ran | passes |
| `INV-013-real-print-every-member.probe.ts` (round 3) | INV-013 / FR-019 | — | — | passes on all 288 members, and in the Linux replica (desktop) too. See the note below the table. |
| `INV-013-print-from-narrow-screen.probe.ts` (round 3) | INV-013 / FR-019 / FR-004 | — | — | Chromium passes, and the frozen-script model **fails** for fit and long (round 3 F2, MINOR, PLAUSIBLE). The wide-screen control passes. See the note below the table. |
| `INV-009-no-measure-while-reading.probe.ts` (round 3) | INV-009 / plan Performance Goals | — | — | passes: a 40-step play-view key walk runs no measuring batch (0 head-style records). A resize afterwards shows 18, so the probe can see a batch. |

`measure.ts` is the probes' own measurement and greedy rule, independent of `e2e/cards-helpers.ts`.

**Round 3 notes:**
- **`INV-013-real-print-every-member`, its 288 members:** {fit, short, long, F5} × paper {718, 1047} × screen
  {1047, 1280, 1920} × Th × Pg × {desktop, mobile, firefox}.
- **`INV-013-print-from-narrow-screen`, Chromium:** `page.pdf()` from a 412 screen draws rows `[[0],[1],[2,3]]`, as it
  does from 1280. The event log shows why: the `(min-width: 768px)` and `print` media changes fire, and React re-renders
  wide.
- **`INV-013-print-from-narrow-screen`, the frozen-script model:** it stands in for a print that runs no script, as
  Firefox's static-clone print is understood to work. In it, every card falls to 9rem. The fit play view prints 6 a row
  on 4 lines each, and the narrow song page cuts 465px of each 606px staff.

**Where it ran:**
- **Round 2:** the probes ran in the Linux replica. The working tree was synced into the `spec007-linux-work` volume and
  rebuilt there, then `review.config.ts --project=probe-desktop` ran with `PROBE_NO_BUILD=1` (see review.md).
- **Round 3:** every probe ran in `probe-desktop`, `probe-mobile` and `probe-firefox` on Windows. The round-3 INV-013
  and INV-009 probes then ran in the Linux replica (`probe-desktop`), after the same sync and rebuild.

**Round 4** (Windows, then the Linux replica):
- **Every earlier probe re-run first:** 84 passed, 51 skipped by design and 6 failed in desktop, mobile and firefox. The
  6 failures are the known MINORs, unchanged:
  - the INV-012 "40 in bar 4" member at 375 (desktop, firefox);
  - the frozen-script half of `INV-013-print-from-narrow-screen`, for fit and long (desktop, firefox).

  None regressed. In the Linux replica, `INV-013-real-print-every-member`, `-print-remeasure` and both INV-009 probes
  passed (19 tests).
- **`INV-009-font-load-late.probe.ts` (new):** it holds the web fonts back, so the hook first measures the fallback
  faces, then releases them. It passes for {fit, short} × {768, 1280} × both pages, in desktop, firefox and Linux. The
  `--own-head` values change (for example 380 → 373), and the rows come out greedy again. The suite's own font trigger
  (`e2e/cards-follow.spec.ts:61`) asks for fonts that are already loaded, so it re-measures nothing.
- **The mutation proxy:** `PROBES=1` runs this directory's probes through it instead of `e2e/`.
  - **`no-ro`** serves a hook that never observes. Under it the late-font probe fails 4 of 4 (`--own-head` stale), and
    the control passes 4 of 4.
  - **`own-head-print`** puts round 2's print rule back. Under it, `cards-print.spec.ts`'s adopted "real-print layout"
    test (T046) fails for `short`, dark and light: 3 a row against greedy 4.
  - **`none`**, the control, passes 8 of 8.
- **`INV-009-click-timing-main-vs-branch.sh`:** spec 005's `click-timing` "INV-022 500 rows landing mid-run" fails
  ("could not keep time") on `main` as well as on the branch.
  - Interleaved at one worker, the two are within noise: `main` 13 of 24 and the branch 8 of 16. That covers the
    branch's last two runs, and its first ran next to a 6-of-8 `main`.
  - Over all runs, which were not all interleaved: `main` 23 of 36 and the branch 16 of 37.
  - Bisecting with the proxy (the head toggle, the head observer, the `.no-print` step, flex, the flat ruler, `:has()`,
    and all of these at once) never restored a better pass rate than `main`'s. So nothing in the branch is shown to
    cause it, and it is out of scope (review.md FU7).
