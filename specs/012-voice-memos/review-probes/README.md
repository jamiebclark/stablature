# Spec 012 review probes

Re-run every probe here FIRST in each review round. A probe that held last round and fails now is a regression.

## How to run

From the repo root, with no dev server holding `.next`:

```sh
# unit tier
npx vitest run --config specs/012-voice-memos/review-probes/vitest.probes.config.mts

# e2e tier: build once, then the probes over that build (no rebuild; port 3412)
npm run build
npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=1

# the memo suite over the same build, mirroring playwright.config.ts's mobile/desktop/insecure projects
REVIEW_DIR=e2e REVIEW_MATCH='memo-[a-z-]+\.spec\.ts$' npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=4
```

`tsconfig.json` includes `specs/`, so run `npm run typecheck` after editing a probe: one type error here fails
`next build`.

Run the timing probes (`INV-018-*`, `FR-036-*`) with `--workers=1`. The SSE stream wakes every client on any band's
write, so another test's traffic, or the runner's 60 s poll landing inside the window, can let them pass by luck.

## Round 1 (2026-11-16)

| Probe | Tier | Result |
|---|---|---|
| `INV-002-push-cross-band-erase.spec.ts` | e2e (HTTP + Postgres) | **violated**: a viewer of band Y tombstoned Y's memo and Y's part, and erased both memos' audio, by pushing them as band X (F1) |
| `INV-018-changed-during-run.spec.ts` | e2e (two contexts) | **violated**, 4 of 4 runs: B still `waiting` 10 s after A's upload, one GET (404) only (F2) |
| `INV-028-full-resumes-next-cycle.test.ts` | unit (`workMemos`) | **violated**: 0 GETs over 5 later cycles after room was made (F3) |
| `INV-008-draft-each-second-and-recover.spec.ts` | e2e | **violated**, 3 of 3 on Chromium's `audio/mp4;codecs=mp4a.40.2`: recorded 4.51 s, recovered audio decodes to 3.03 s, about 1.48 s lost; stated length 2.0 or 3.0 s (F4, F10) |
| `INV-004-delete-paths-d6-d8.spec.ts` | e2e (HTTP + two contexts + Postgres) | held, 3 of 3 paths (D6, D7, D8) |
| `INV-029-dismiss-then-reload.spec.ts` | e2e | held (the suite's `memo-persist.spec.ts` fails 2 of 2 on its own race, F6) |
| `FR-036-try-again-runs-a-pass.spec.ts` | e2e (Postgres) | fails when run alone: no PUT within 5 s of Try again (MINOR F5) |

## Round 2 (2026-11-16)

Every round 1 probe was re-run first, over a production build of the current tree (`.next` newer than every source
file), at `--workers=1`.

| Probe | Tier | Result |
|---|---|---|
| `INV-002-push-cross-band-erase.spec.ts` | e2e | **held** (was violated). Both forged pushes are refused `invalid`, "That row belongs to a different band.", and Y's memos, part and audio are untouched. Adopted as `e2e/memo-push-cross-band.spec.ts` (T106), which passes too |
| `INV-018-changed-during-run.spec.ts` | e2e | **held** (was violated). GETs `[404, 200]`, ready 3.2 s after A's upload. Adopted as `e2e/memo-band-race.spec.ts` (T108), which passes: ready after 3.6 s |
| `INV-028-full-resumes-next-cycle.test.ts` | unit | **held** (was violated). Two GETs after room is made, and both memos are held. Adopted into `src/lib/memos/__tests__/` (T110), byte-identical |
| `INV-008-draft-each-second-and-recover.spec.ts` | e2e | **held** (was violated). On `audio/mp4;codecs=mp4a.40.2`, 16 or 17 chunks; 4.51 s recorded, 4.37 s decoded, so 135-141 ms lost; stated length 4 000 or 4 250 ms. `e2e/memo-recover.spec.ts` (T112) now uses this method and passes on `mobile` |
| `INV-004-delete-paths-d6-d8.spec.ts` | e2e | held, 3 of 3 paths. Still not in the suite |
| `INV-029-dismiss-then-reload.spec.ts` | e2e | held. Still not in the suite |
| `FR-036-try-again-runs-a-pass.spec.ts` | e2e | still fails (MINOR F5 was not in scope for remediation): no PUT within 5 s of Try again |

New in round 2:

| Probe | Tier | Result |
|---|---|---|
| `INV-028-full-stays-full.test.ts` | unit | held: the older memo is never asked for while the device stays full. It also records (MINOR F17) that the memo that did not fit is downloaded again on every cycle: 10 GETs over 10 polls 60 s apart, and 10 over 10 cycles 6 s apart, with `attempts` stuck at 0 |
| `SC-001-stop-to-playable.spec.ts` | e2e | held: Stop to `memo-play` enabled took 67-149 ms signed out (2, 4 and 8 s clips, twice each) and 56-146 ms signed in with the push held. The cut to `TIMESLICE_MS = 250` did not slow Stop |
| `INV-006-meta-line-too-short.spec.ts` | e2e (two contexts) | held, 4 of 4 runs as separate tests (`PROBE_RUNS=1 ... --repeat-each=4`). Diagnostic for MINOR F18: when the microphone opens late (1.2-1.8 s after the tap, about every second run in one worker), a test that waits 2 s from the panel showing records under 1 s, and the product rightly says "Too short to keep". The probe checks E11 against the time the recorder really ran |

`playwright.review.config.ts` gained `memo-band-race` and `memo-push-cross-band` in its PHONE_ONLY list, as
`playwright.config.ts` has them.

## Round 3 (2026-11-17)

Every probe was re-run first, over a fresh production build of the current tree (`npm run build` at 23:58, newer
than every source file). Unit tier through `vitest.probes.config.mts`; e2e tier at `--workers=1`.

| Probe | Tier | Result |
|---|---|---|
| `INV-002-push-cross-band-erase.spec.ts` | e2e | held. Both forged pushes refused `invalid`; Y's memos, part and audio untouched |
| `INV-004-delete-paths-d6-d8.spec.ts` | e2e | held, D6, D7, D8. Adopted as `e2e/memo-delete-paths.spec.ts` (T115), which passes |
| `INV-018-changed-during-run.spec.ts` | e2e | held. GETs `[404, 200]`, ready 3.2 s after A's upload |
| `INV-029-dismiss-then-reload.spec.ts` | e2e | held. Its waits are in `e2e/memo-persist.spec.ts` (T116), which passes |
| `INV-006-meta-line-too-short.spec.ts` | e2e | held, 3 of 3 runs (the microphone opened in 6-581 ms) |
| `INV-008-draft-each-second-and-recover.spec.ts` | e2e | held. 15 chunks; 4.50 s recorded, 4.37 s decoded, 131 ms lost. Stated length 3 750 ms (MINOR F10) |
| `SC-001-stop-to-playable.spec.ts` | e2e | held. Signed out 52-162 ms; signed in, push held 51-145 ms. Adopted (T118) into `memo-record.spec.ts` and `memo-band.spec.ts`, which pass |
| `INV-028-full-resumes-next-cycle.test.ts` | unit | held: `{"getsWhileFull":1,"getsAfterRoom":2}` |
| `INV-028-full-stays-full.test.ts` | unit | held (older memo asked 0 times). Adopted as `src/lib/memos/__tests__/full-stays-full.test.ts` (T117). Still 10 GETs over 10 polls (MINOR F17) |
| `FR-036-try-again-runs-a-pass.spec.ts` | e2e | still fails: no PUT within 5 s of Try again. Now part of MAJOR F23 |

New in round 3:

| Probe | Tier | Result |
|---|---|---|
| `FR-071-try-again-resumes-fetch.spec.ts` | e2e (two contexts) | **fails** (MAJOR F23). After Try again on an "Out of room on this device." memo, the memo reads `waiting`, "Waiting for the recording device to upload it.", and the first GET comes 51 s later, on the runner's 60 s poll. Run it alone: another test's server write wakes the guest and lets it pass by luck. The suite's `e2e/memo-full.spec.ts` fetch half fails 3 of 3 alone for the same reason |

`playwright.review.config.ts` gained `memo-delete-paths` in its PHONE_ONLY list, as `playwright.config.ts` has it.

## Round 4 (2026-11-17)

Every probe was re-run first. The unit tier ran through `vitest.probes.config.mts`, and the e2e tier at `--workers=1`.
The build was fresh: the project config rebuilt `.next` during the round, and no source file is newer than it. Phase
12's implement pass bounded one read in `FR-071-try-again-resumes-fetch.spec.ts` (the `memo-state` text of a `ready`
memo, which has none). Its assertion is unchanged. It also added `memo-retry` to `playwright.review.config.ts`'s
PHONE_ONLY list.

| Probe | Tier | Result |
|---|---|---|
| `FR-036-try-again-runs-a-pass.spec.ts` | e2e | **held** (was failing since round 1): `{"putsBefore":1,"putsAfter":1,"firstPutMs":75}`. Adopted as `e2e/memo-retry.spec.ts` (T119), which fails alone about 1 run in 4 on the recording helper (F27), never on the PUT |
| `FR-071-try-again-resumes-fetch.spec.ts` | e2e | **held** (was violated): state `ready` 1 s after the tap, first GET 60 ms after it. Adopted into `e2e/memo-full.spec.ts` (T119), which passes 3 of 3 alone with the project config |
| `INV-002-push-cross-band-erase.spec.ts` | e2e | held. Both forged pushes refused `invalid`; Y's memos, part and audio untouched |
| `INV-004-delete-paths-d6-d8.spec.ts` | e2e | held, D6, D7, D8 |
| `INV-018-changed-during-run.spec.ts` | e2e | held. GETs `[404, 200]`, ready 3.2 s after A's upload |
| `INV-029-dismiss-then-reload.spec.ts` | e2e | held |
| `INV-006-meta-line-too-short.spec.ts` | e2e | held, 3 of 3. `getUserMedia` resolved 727, 14 and 10 ms after the call |
| `INV-008-draft-each-second-and-recover.spec.ts` | e2e | held. 13 chunks; 4 517 ms recorded, 4 373 ms decoded, 144 ms lost. Stated length 3 250 ms (MINOR F10) |
| `SC-001-stop-to-playable.spec.ts` | e2e | held. Signed out 56-189 ms; signed in, push held 65-145 ms |
| `INV-028-full-resumes-next-cycle.test.ts` | unit | held: `{"getsWhileFull":1,"getsAfterRoom":2}` |
| `INV-028-full-stays-full.test.ts` | unit | held (older memo asked 0 times). Still 10 GETs over 10 polls (MINOR F17) |

New in round 4:

| Probe | Tier | Result |
|---|---|---|
| `F27-record-helper-late-microphone.spec.ts` | e2e | **fails** (MAJOR F27): the real stream resolves 1.5 s late, and `recordMemo(page, "A", 2_000)` keeps nothing: `{"kept":[],"notices":["Too short to keep. Recordings need at least 1 second.Dismiss"]}`. It probes the suite's helper, not the product, so it may delay the stream. Phase 13 adopts it (T122) |
| `TC-line-endings-cr-bytes.sh` | shell | **fails**. It counts CR bytes with `tr`, because Git for Windows' grep strips CR without `-U`. One `modified` line, `playwright.config.ts` (index 0 CRs, working tree 157), is MAJOR F26. Ten `new` lines are MINOR F28. After T121, only the ten `new` lines remain until FU15 |

Run the e2e probe with `npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=1 F27`,
and the shell probe with `bash specs/012-voice-memos/review-probes/TC-line-endings-cr-bytes.sh < /dev/null`.

## Round 5 (2026-11-18)

Every probe was re-run first. The unit tier ran through `vitest.probes.config.mts`, and the e2e tier at `--workers=1`,
over the `.next` built at 00:46. No source file is newer than it, and Phase 13 changed no product file.

| Probe | Tier | Result |
|---|---|---|
| `F27-record-helper-late-microphone.spec.ts` | e2e | **held** (was failing): `{"lateMs":1500,"kept":[{"durationMs":2131}]}`. Adopted as a test in `e2e/memo-record.spec.ts` (T122), which passes on `mobile` and `desktop` |
| `TC-line-endings-cr-bytes.sh` | shell | modified half **held** (was violated): no `modified` line, so `playwright.config.ts` is LF again (T121). The ten `new` lines remain (MINOR F28, FU15), so the script still exits 1 |
| `FR-036-try-again-runs-a-pass.spec.ts` | e2e | held: `{"putsBefore":1,"putsAfter":1,"firstPutMs":65}` |
| `FR-071-try-again-resumes-fetch.spec.ts` | e2e | held: `ready` after the tap, first GET 84 ms after it |
| `INV-002-push-cross-band-erase.spec.ts` | e2e | held. Both forged pushes refused `invalid`; Y's memos, part and audio untouched |
| `INV-004-delete-paths-d6-d8.spec.ts` | e2e | held, D6, D7, D8 |
| `INV-006-meta-line-too-short.spec.ts` | e2e | held, 3 of 3. `getUserMedia` resolved 8-16 ms after the call |
| `INV-008-draft-each-second-and-recover.spec.ts` | e2e | held. 14 chunks; 4 512 ms recorded, 4 373 ms decoded, 139 ms lost. Stated length 3 500 ms (MINOR F10) |
| `INV-018-changed-during-run.spec.ts` | e2e | held. GETs `[404, 200]`, ready 3.2 s after A's upload |
| `INV-029-dismiss-then-reload.spec.ts` | e2e | held |
| `SC-001-stop-to-playable.spec.ts` | e2e | held. Signed out 63-177 ms; signed in, push held 68-160 ms |
| `INV-028-full-resumes-next-cycle.test.ts` | unit | held |
| `INV-028-full-stays-full.test.ts` | unit | held |

New in round 5:

| Probe | Tier | Result |
|---|---|---|
| `INV-029-second-save-counted.spec.ts` | e2e | Test 1 **held**, 3 of 3: one `persist()` call once the second save has landed. Test 2 **fails** 1 of 3 (MINOR F30): `recordMemo` returned with 1 live memo, before the second save, so `e2e/memo-persist.spec.ts:28` read the count from before the save it checks. `recordMemo` waits on `memo-play`.first(), which is the older memo |

Run it with `npx playwright test -c specs/012-voice-memos/review-probes/playwright.review.config.ts --workers=1 --repeat-each=3 INV-029-second`.
