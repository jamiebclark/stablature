# Review: Voice memos on a part, recorded offline and synced to the band

Reviewed 108 files: 27 modified and 81 new (42 in `src/`, 33 in `e2e/`, 4 in `scripts/`, 2 in `drizzle/`), not counting
`specs/012-voice-memos/` and `.specify/`. The branch has 0 commits, so the whole feature is uncommitted. This round
reviews the **working tree** against `main` (`c5c9774`), which is also `HEAD` and the merge base.

**Round 5.** History:
- Round 1 had one BLOCKER (F1, `src/lib/server/sync.ts`) and three MAJORs (F2 runner, F3 transfer, F4 recorder).
  Phase 10 (T106-T113) fixed them.
- Round 2 had one MAJOR (F16, CRLF in `sync.ts`). Phase 11 (T114-T118) fixed it.
- Round 3 had one MAJOR (F23, Try again starts no pass). Phase 12 (T119-T120) fixed it.
- Round 4 had two MAJORs: F26 (CRLF in `playwright.config.ts`) and F27 (the recording helpers time from the panel,
  not the recorder). Phase 13 (T121-T123) is ticked.

This round:
1. re-ran all 13 saved probes first;
2. read every file Phase 13 touched;
3. ran every T123 acceptance item;
4. re-checked all 29 invariants over their enumerations. That meant running the whole memo e2e suite, the unedited
   sync, card, menu and capture-height specs, the unit suite and the guards.

Phase 13 changed no product file. Only four files are newer than round 4's `review.md`: `playwright.config.ts`,
`e2e/memo-helpers.ts`, `e2e/memo-record.spec.ts` and `e2e/memo-band.spec.ts`.

**Read in full**:
- `e2e/memo-helpers.ts`, all 427 lines.
- `e2e/memo-record.spec.ts` and `e2e/memo-band.spec.ts`.
- `git diff HEAD -- playwright.config.ts`, and its `git ls-files --eol`.
- To judge F30: `e2e/memo-endings.spec.ts`, `e2e/memo-persist.spec.ts`, `e2e/memo-full.spec.ts:1-35`,
  `e2e/memo-floors.spec.ts:80-125` and `e2e/memo-one-sound.spec.ts:20-50`. These are every caller of the changed helpers
  whose timing could change.

**Sampled**: the cited lines of every open MINOR, to keep their citations current. They are all unchanged.

**Not re-read**: every product source file. None changed since round 4, which was the last round to read them. Their
earlier reading stands, and every invariant probe over them was re-run.

**Run, all on this machine**, over the `.next` built at 00:46. It is newer than every source file, so I did not rebuild.
Other projects' dev servers were running on the machine throughout.
- `npm run typecheck`: pass, also after adding this round's probe.
- `npm run lint`: 0 errors and 15 warnings, all outside the memo files. `eslint` over every memo file, `playwright.config.ts`
  and `review-probes/` is clean.
- `npx drizzle-kit check`: "Everything's fine".
- `check:untouched-memos`, `check:memo-fence` and `check:memo-amendments`: pass.
- `check:line-endings`: **pass**, `line endings: kept`. `diff --stat` equals `--ignore-cr-at-eol`: 27 files, +650/−36.
- `npm test`, two runs: 6,744 of 6,748 tests passed, then 6,742. Every failure was a timeout or timing bound in
  `src/lib/tab/__tests__/`, which is a zero-diff path. The three failing files passed alone, 332 of 332 (FU16).
- The 13 saved probes: all hold. The exception is the new-file half of `TC-line-endings-cr-bytes.sh`, which is MINOR
  F28 (`review-probes/README.md`, "Round 5").
- One new probe, `INV-029-second-save-counted.spec.ts`. Its invariant test holds 3 of 3, and its helper test fails 1 of
  3 (F30).
- **T123's acceptance**, each item run:
  - (1) The adopted late-microphone test passes on `mobile` and `desktop`.
  - (2) `memo-retry` passes 6 of 6 at `--workers=1 --repeat-each=6`, and 12 of 12 over two such runs.
  - (3) `memo-full` passes 9 of 9 at `--repeat-each=3`.
  - (4) `memo-endings` passes on both projects, and E11 still reaches "Too short to keep".
  - (5) The whole memo suite at 3 workers, in three slices through the review config: **145 passed, 14 skipped by
    project, 0 failed.** No failure reads "Too short to keep". Round 4 had 5 such failures.
  - (6)-(8) were run as listed above.
- The unedited sync specs on both projects: 114 passed, 20 skipped by project and 0 failed. They are `sync`,
  `sync-no-lost-rows`, `reading-sync`, `grouping-sync`, `grouping-refusal` and `import-sync*`.
- The unedited card, menu and capture specs on both projects: 64 passed, 16 skipped and 0 failed. They are
  `notation-capture-height`, `polish-part-card`, `polish-part-card-menu`, `usability-floors`, `wide-fit` and
  `wide-controls`.
- `play-part` and the other nine `wide-*` specs on both projects: all 234 tests started, and none printed a failure.
  My 595 s limit stopped the run while the last three were still running, so it printed no summary.

## Verdict

**Ready to merge: no BLOCKER and no MAJOR.** Both of round 4's MAJORs are fixed, with evidence:
- **F26 is fixed.** `playwright.config.ts` is `i/lf w/lf`, and its diff is the real +32/−1. `check:line-endings` passes,
  and the byte-count probe finds no modified file whose endings changed.
- **F27 is fixed.** `recordMemo` and `startRecording` now time from the recorder's `start` event. They use an
  observation-only wrapper (`e2e/memo-helpers.ts:291-314`).
  - The late-microphone probe now keeps a 2 131 ms memo.
  - The memo suite at 3 workers is green, with no "Too short to keep" failure.
  - `memo-retry` passes 12 of 12 alone.
  - E11 still reaches its words.

All 29 invariants hold over their enumerations, and no probe that held last round fails now.

One new MINOR (F30) is a test-integrity gap, not a product defect. With a memo already on the page, `recordMemo` returns
at Stop, before the new memo is saved. So two of `memo-persist.spec.ts`'s checks can read the state from before the
save they are about. The invariant itself holds:
- `storage.test.ts` enforces the one-call rule;
- this round's probe checks it after the second save, 3 of 3.

The fix, about ten lines, goes to § Follow-ups with the other open MINORs. T104 and T105 (the browser check, and real
phones) stay `🛑 BLOCKED` for a person, as INV-027 requires. They are owed, not missing. tasks.md is unchanged.

## Invariants

| ID | Result | Enumerated over | Probe / reason |
|---|---|---|---|
| INV-001 | held | H6, H7, H8, H9 × 9 FmtD, H10, H11, H14, H20, H21, H22: 18 of 18 | `e2e/memo-routes.spec.ts` (pass, slice C), `body.test.ts` (pass) |
| INV-002 | held | Role × Route × {X, Y, random}: 15 of 15 on the routes; push path, forged memo and part tombstones: 2 of 2 refused | `e2e/memo-routes.spec.ts` H1-H5, H15; `review-probes/INV-002-push-cross-band-erase.spec.ts` (both refused `invalid`, Y untouched); `e2e/memo-push-cross-band.spec.ts` (pass) |
| INV-003 | held | {pull, push response} × {pending, uploaded, erased}: 6 of 6 | `e2e/memo-sync-separate.spec.ts` (pass) |
| INV-004 | held | Del D1-D8: 8 of 8 | D1, D2 `memo-delete.spec.ts`; D3 `memo-part-delete.spec.ts`; D4 `erase.test.ts`; D5 `memo-recorder.spec.ts`; D6-D8 `review-probes/INV-004-delete-paths-d6-d8.spec.ts` and `e2e/memo-delete-paths.spec.ts` (all pass) |
| INV-005 | held | 24 orderings, 12 pairs, 4 idempotence checks, M1-M6 | `memo-merge.test.ts`, `tables-agree.test.ts`, unedited `merge.test.ts` (pass in both `npm test` runs) |
| INV-006 | held | Rec 5 × {meta A, meta B, Postgres} | `e2e/memo-recorder.spec.ts` (pass); `review-probes/INV-006-meta-line-too-short.spec.ts` 3 of 3 |
| INV-007 | held | E1-E16 (unit); EndFake × {mobile, desktop} | `recorder.test.ts`; `e2e/memo-endings.spec.ts` on both projects, alone and at 3 workers. E11 still reaches "Too short to keep" (`e2e/memo-endings.spec.ts:118-125`) |
| INV-008 | held | {`audio/mp4;codecs=mp4a.40.2`}: 139 ms lost; the 5 unit draft cases | `review-probes/INV-008-draft-each-second-and-recover.spec.ts` (14 chunks, 4 512 ms recorded, 4 373 ms decoded), `e2e/memo-recover.spec.ts`, `recover.test.ts` (pass). The stated length, 3 500 ms, is F10 |
| INV-009 | held | L1-L5 | `recorder.test.ts` (pass) |
| INV-010 | held | 6 ordered pairs; {back link, browser back} | `sound.test.ts`, `e2e/memo-one-sound.spec.ts` (pass) |
| INV-011 | held | 960 unit inputs; St 12 × {mobile, desktop} | `state.test.ts`, `e2e/memo-states.spec.ts` (pass) |
| INV-012 | held | Card 3 × W 3 × Th 2; Pg capture × 2, play × 2 | `e2e/memo-card-height.spec.ts` (pass); `wide-fit` and `notation-capture-height` pass unedited on both projects; `check:untouched-memos` zero diff |
| INV-013 | held | Pg 7 × {mobile, desktop} | `e2e/memo-mic-ask.spec.ts` (pass). `watchRecorderStart` (`e2e/memo-helpers.ts:291-303`) wraps `MediaRecorder.prototype.start` only, never `getUserMedia`, and is installed only inside `openRecorder` |
| INV-014 | held | over the line; two parallel uploads; exactly on the line | `e2e/memo-routes.spec.ts` H20, H21 (pass) |
| INV-015 | held | Ans rows × {upload, fetch}; {accepted, not}; {Try again, account change, band_full freed} | `transfer.test.ts`; `e2e/memo-refusal.spec.ts` and `e2e/memo-retry.spec.ts` (12 of 12 alone, and at 3 workers); `review-probes/FR-036-try-again-runs-a-pass.spec.ts` (`PUT` 65 ms after the tap) |
| INV-016 | held | memo counts {0, 1, 2, 4} × {Cancel, Confirm} × Card | `e2e/memo-part-delete.spec.ts` (pass) |
| INV-017 | held | Net {signed out, offline} × Act 7 | `e2e/memo-offline.spec.ts` on both projects at 3 workers (pass) |
| INV-018 | held | {online at Stop, reconnect, "changed" during the bandmate's pass} | `e2e/memo-band.spec.ts`, `memo-band-offline.spec.ts`, `memo-band-race.spec.ts`, `review-probes/INV-018-changed-during-run.spec.ts` (all pass; GETs `[404, 200]`, ready 3.2 s after the upload) |
| INV-019 | held | keep endings × formats; labels 0, 1, 120, 121, 500, spaces | `row-valid.test.ts`; the push-400 tripwire in every memo spec (no 400 seen) |
| INV-020 | held | {insecure, no-recorder, busy} e2e; 5 states unit | `e2e/memo-unavailable.spec.ts` on `insecure`, mobile and desktop; `capability.test.ts` |
| INV-021 | held | FmtA × 6 name cases; 3 download routes | `words.test.ts`, `e2e/memo-download.spec.ts` (pass) |
| INV-022 | held | 3 limits, 3 bases, 1 erase, 15 codes | `check:memo-fence`, `refusals.test.ts` (pass) |
| INV-023 | held | counts {1, 3, 4, 5} × 3 states × 2 widths | `e2e/memo-list.spec.ts` (pass) |
| INV-024 | held | test ids × W × Ptr × Th × 4 states | `e2e/memo-floors.spec.ts` (pass); `usability-floors.spec.ts` passes unedited on both projects |
| INV-025 | held | 7 FR-090 facts; 4 pages; spec 008; decisions | `check:memo-amendments`, `e2e/memo-privacy.spec.ts` (pass) |
| INV-026 | held | every Scope-fence path | `check:untouched-memos`: zero diff, and only the `want` line in `polish-part-card-menu` |
| INV-027 | held | §5 survey, §6 P1-P6 | T104 and T105 are unchecked and `🛑 BLOCKED` (`tasks.md:254-255`). DECISIONS lists P1-P6 as pending (`docs/DECISIONS.md:888-889` onward) |
| INV-028 | held | {save; fetch while full; fetch resuming on Try again; resuming on a later cycle; device staying full} | `e2e/memo-full.spec.ts` 9 of 9 at `--repeat-each=3`; `review-probes/FR-071-try-again-resumes-fetch.spec.ts` (first GET 84 ms after the tap); both INV-028 unit probes hold |
| INV-029 | held | {first save, second save} × persisted false; unit 5 cases | `storage.test.ts`; `review-probes/INV-029-dismiss-then-reload.spec.ts`; `review-probes/INV-029-second-save-counted.spec.ts` test 1 (one call after the second save lands, 3 of 3); `e2e/memo-persist.spec.ts` (pass, but two of its checks can read too early: F30) |

Not an INV, but a plan constraint with its own check: § Technical Context, "Keep each file's line endings"
(`npm run check:line-endings`). It **holds** on every modified file this round. `review-probes/TC-line-endings-cr-bytes.sh`
finds no `modified` line. Its `new` lines are MINOR F28.

## Findings

### Round 5

- [ ] MINOR F30 — With a memo already on the page, `recordMemo` returns at Stop, before the new memo is saved. So two
      of `memo-persist`'s checks can read the state from before the save they are about.
      - **where**:
        - `e2e/memo-helpers.ts:321`: `recordMemo` waits on `getByTestId("memo-play").first()`. The list is oldest first,
          so with an earlier memo present, `.first()` is that memo, already enabled before Stop.
        - `e2e/memo-persist.spec.ts:27-28`: "still 1 after a second recording" reads `persistCalls` straight after the
          second `recordMemo`.
        - `e2e/memo-persist.spec.ts:37-38`: "not on a second part" asserts `toHaveCount(0)`. That holds at once, so it
          does not wait for the save on B.
        - The same file already has the right pattern. `stopToPlayable` (`e2e/memo-helpers.ts:334-351`) finds the new
          memo by id. So two helpers that do the same job in one file disagree on how to find the new memo.
      - **why**:
        - `review-probes/INV-029-second-save-counted.spec.ts` test 2. When `recordMemo` returned, the device held 1 live
          memo, not 2, in 1 of 3 runs: `{"liveMemosWhenRecordMemoReturned":1,"callsAtReturn":1}`.
        - In such a run, a regression that called `persist()` again on the second save would pass `:28`.
      - **why not blocking**: the product holds the invariant.
        - Test 1 of the same probe reads one call after the second save has landed, 3 of 3.
        - `storage.test.ts` enforces at most one `persist()` per device on the unit tier.
        - The `review-probes/INV-029-dismiss-then-reload.spec.ts` probe waits 500 ms before its part-B check, and holds.
        - The gap predates Phase 13: round 4 cited the same `.first()` wait.
      - **owed** (FU17): `recordMemo` finds the new memo by id, as `stopToPlayable` does, and waits for its `memo-play`.
        Then adopt the probe's helper test.
      - **traces**: INV-029 ("still 1 after a second recording", "nor on a second part"), plan gate "tests must be able
        to fail for the right reason"

### Round 4, re-checked

- [x] MAJOR F26 — fixed.
  - `git ls-files --eol playwright.config.ts` gives `i/lf w/lf`.
  - `git diff --stat HEAD -- playwright.config.ts` is +32/−1 with and without `--ignore-cr-at-eol`.
  - `npm run check:line-endings` prints `line endings: kept`.
  - `TC-line-endings-cr-bytes.sh` prints no `modified` line.
- [x] MAJOR F27 — fixed.
  - `e2e/memo-helpers.ts:291-303` (`watchRecorderStart`) records the `start` event of each `MediaRecorder` without
    changing it.
  - `openRecorder` (`:306-314`) waits for the panel, then for the start, bounded at 5 s. `recordMemo` (`:317-322`)
    counts `ms` from that start.
  - `memoIds` and `stopToPlayable` now exist once, in `memo-helpers.ts:330-351`. `e2e/memo-record.spec.ts:2` and
    `e2e/memo-band.spec.ts:2` import them.
  - The probe keeps a 2 131 ms memo with a 1.5 s late microphone. Its adoption, `e2e/memo-record.spec.ts:32-51`, passes
    on both projects.
  - The suite at 3 workers has no "Too short" failure.
- [ ] MINOR F28 — open. The same ten new files are CRLF, and `scripts/check-line-endings.sh:27` (`grep -Iq $'\r'`) still
      cannot see it on Git for Windows. No Phase 13 file is among them: the three e2e files it touched have 0 CRs.
- NOTE F29 — not seen this round. No build ran, because `.next` was already fresh.

### Round 3, re-checked

- [x] MAJOR F23 — still fixed. Both Try-again probes pass, and so do `e2e/memo-retry.spec.ts` (12 of 12 alone) and
  `e2e/memo-full.spec.ts` (9 of 9).
- [x] MINOR F24 — fixed with F27.

### Round 2, re-checked

- [x] MAJOR F16 — still fixed. `src/lib/server/sync.ts` is `i/lf w/lf`.
- [ ] MINOR F17 — open. `src/lib/memos/transfer.ts:208` keeps `attempts` on `full`.
- [x] MINOR F18 — fixed with F27.
- [ ] MINOR F19 — open. `src/lib/server/sync.ts:291` reads `mutation.row.partId`, not the stored part.
- [ ] MINOR F20 — open. `e2e/memo-recover.spec.ts:51-55` accepts E14 for MP4; `src/lib/memos/recover.ts:109-110`.
- NOTE F21 — unchanged: an editor who knows a UUIDv7 can tell that it exists in some band
  (`src/lib/server/sync.ts:184-191`).
- NOTE F22 — `stash@{0}` ("WIP on 012-voice-memos") is still in the stash list. Drop it when committing.

### Round 1, re-checked

- [x] 🛑 BLOCKER F1 — still fixed. The probe and `e2e/memo-push-cross-band.spec.ts` pass.
- [x] MAJOR F2 — still fixed. The probe and `e2e/memo-band-race.spec.ts` pass.
- [x] MAJOR F3 — still fixed. Both unit probes and their adoptions pass. Its cost is F17.
- [x] MAJOR F4 — still fixed. 139 ms lost.
- [ ] MINOR F7 — open. A module-level `postgres` client with `afterAll(sql.end)` is still used in six specs, for
      example `e2e/memo-recorder.spec.ts:16-22`. No `CONNECTION_ENDED` was seen this round.
- [ ] MINOR F9 — open. `e2e/memo-helpers.ts:372-382` (`fillDevice`) still patches `IDBObjectStore.put`, and the header
      at `:1-6` still says "Observation only".
- [ ] MINOR F10 — open. `src/lib/memos/recover.ts:109`: the stated length was 3 500 ms against 4 373 ms decoded.
- [ ] MINOR F11 — open. `src/app/api/memos/[memoId]/audio/route.ts:82` stores the upload's type, not the row's.
- [ ] MINOR F12 — open. `src/components/memos/MemoBoot.tsx:14-18` and `src/lib/memos/recover.ts:98`: a second tab
      recovers a live draft.
- NOTE F13-F15 — unchanged:
  - `check:untouched-notation` and `-wide` fail by design (DECISIONS "012 T103").
  - `check-line-endings.sh` gained `grep -I`.
  - Chromium records MP4.

## Follow-ups

Not this spec's work, and not gating. Unboxed on purpose.

- FU1 — closed (round 4).
- FU3 — MINOR F7: one Postgres client per test, or `sql.end()` only at worker teardown, in the six specs listed under
  F7.
- FU5 — MINOR F9: record two test deviations in DECISIONS, then correct `e2e/memo-helpers.ts:1-6`, which says only the
  two stated exceptions change a behaviour.
  - `fillDevice`'s patched `put`.
  - The late-microphone test's delayed `getUserMedia` (`e2e/memo-record.spec.ts:33-42`). Round 4 asked for that delay:
    it tests the suite's helper, not the product.
- FU6 — MINOR F10 and F20: derive the recovered length from the decoded audio, never drop a draft that plays, and
  require E13 for Chromium's MP4 in `e2e/memo-recover.spec.ts:51-55`.
- FU7 — MINOR F11: store the row's `format` in `memo_audio.content_type` (`route.ts:82`).
- FU8 — MINOR F12: give drafts an owner (a per-tab id and a heartbeat), so boot recovery skips a live one.
- FU9 — MINOR F17: increment `attempts` on `full` (`src/lib/memos/transfer.ts:208`).
- FU10 — closed: F27 is fixed. Its probe is adopted (T122).
- FU11 — MINOR F19: erase on the stored `partId` (`src/lib/server/sync.ts:291`).
- FU12 — two comments to repair when the files are next edited for a reason:
  - `src/lib/server/sync.ts:173-174` is still cut off mid-sentence.
  - `src/lib/sync/runner.ts:6` still says "Five triggers". There are six: Try again is one, and it is not listed.
- FU13 — out of scope: `e2e/play-part.spec.ts:66` timing under 3 or more workers (round 1 FU10). It printed no failure
  this round, at 3 workers.
- FU14 — out of scope: Next.js 16.4.3 carries a security advisory, and `next build` stops on it intermittently
  (NOTE F25, F29). Upgrading Next is not this spec's work.
- FU15 — MINOR F28: in `scripts/check-line-endings.sh:27`, use `grep -IUq $'\r'` or count bytes with `tr`. Then
  convert the ten new CRLF files to LF before they are first committed. After that, adopt
  `review-probes/TC-line-endings-cr-bytes.sh`'s new-file half into the script.
- FU16 — out of scope: tests in `src/lib/tab/__tests__/` fail on time when the machine is loaded. This round's two full
  runs failed:
  - `review-every-character-stored.test.ts`: four cases, each at the 5 s timeout;
  - `review-growth-of-a-tall-block.test.ts` ("only S6 claims these", 6 191 against a bound of 2 000);
  - `round-trip.test.ts` ("the seeded generator G", at the 5 s timeout).

  All three files pass alone, 332 of 332, and `src/lib/tab/` is a zero-diff path. I did not run `main` under the same
  load, so I cannot say whether this branch's added unit files make it worse.
- FU17 — MINOR F30:
  - In `e2e/memo-helpers.ts:317-322`, make `recordMemo` find the new memo by id, as `stopToPlayable` (`:334-351`)
    does, and wait for its `memo-play`.
  - In `e2e/memo-persist.spec.ts:37-38`, wait for the save on B before asserting no notice.
  - Then adopt `review-probes/INV-029-second-save-counted.spec.ts`. Its test 2 fails 1 of 3 today.
- FU18 — adopt `review-probes/INV-006-meta-line-too-short.spec.ts` into the suite. Round 4 held it back until the
  helper race was fixed, and F27 has fixed it. It holds 3 of 3 this round.

## Coverage

| Checked | Count | Satisfied | Partial | Absent | Contradicted |
|---|---|---|---|---|---|
| Plan invariants (INV-001-INV-029) | 29 | 29 | 0 | 0 | 0 |
| Functional requirements (FR-001-FR-105, incl. FR-030a) | 68 | 67 | 0 | 1 (FR-103, the browser check, owed to a person: T104) | 0 |
| Success criteria | 10 | 9 | 0 | 1 (SC-010, owed on real phones: T105) | 0 |
| Plan gates (the constitution is the unfilled template; plan § Constitution Check's 16 working rules) | 16 | 14 | 1 ("tests must be able to fail for the right reason": MINOR F30, in two checks of one spec) | 1 ("browser testing at actual size": owed, T104) | 0 |
| Plan constraints (§ Technical Context; "never run the build beside a dev server" is process) | 5 | 4 | 1 (line endings: MINOR F28 on new files only; every modified file keeps its endings) | 0 | 0 |
| User stories | 6 | 6 | 0 | 0 | 0 |
| Acceptance scenarios | 29 | 29 | 0 | 0 | 0 |
| Round 4 blocking findings | 2 | 2 fixed (F26, F27) | 0 | 0 | 0 |
| Phase 13 tasks (T121-T123) | 3 | 3 (each acceptance item re-run) | 0 | 0 | 0 |
| Saved probes re-run | 13 | 13 hold (TC's new-file half is MINOR F28) | 0 | 0 | 0 |

## What I could not check

- **Real phones** (SC-010, P1-P6). This includes:
  - Safari's MP4 cadence at a 250 ms timeslice, on which F10's and F20's length estimate depends;
  - a phone's `getUserMedia` latency after the permission prompt, which decides how much of what a user says while the
    panel shows in `asking` goes unrecorded.
- **The browser check at actual size** (FR-103, quickstart §5), in both themes, by a person.
- **A real browser crash.** INV-008 rests on copying the draft a crash would leave.
- **A real storage quota.** INV-028 and E12 rest on a patched `put` (F9).
- **A reverse proxy in front of the SSE stream.** The 60 s poll is still the only other fallback for a bandmate's memo.
- **CI.** It retries each test once (`playwright.config.ts:90`) across 4 shards. This round's green suite is from this
  machine, through the review config over an existing build, not the project config's rebuild.
- **Postgres under concurrent multi-band load** beyond H21.
- **The migration against a production database.** `drizzle-kit check` passes against the local snapshot only.
- **Specs not run, or not run to the end, this round**:
  - `play-part.spec.ts` and nine `wide-*` specs: no failure printed, but the run was stopped during its last three
    tests, so there is no summary.
  - The `firefox` and `no-pointer` projects (`usability-staves`, `wide-sideways-firefox`, `usability-density`). Each is
    zero-diff and draws nothing this branch changed.
  - The rest of the non-memo e2e suite.
- **`main`'s unit suite under the same machine load** (FU16).
