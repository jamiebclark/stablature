# Tasks: Voice memos on a part, recorded offline and synced to the band

**Input**: Design documents from `/specs/012-voice-memos/` (plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md)

**Tests**: The plan's invariants (INV-001 to INV-029) are the tests. Each has a probe task, and each probe is the FIRST
task(s) of the phase that builds what it protects. **Every probe must FAIL on the pre-change code** (the module, route
or test id it exercises does not exist yet, or the behaviour is absent). Run it, see it fail for that reason, then
implement. Probes live in the project's suites (`src/**/__tests__/`, `e2e/`), never a temp dir.

**Order** (plan.md): Setup → Foundation → US1 (record, play) → US3 (never lost) → US2 (band gets it) → US5 (label,
download, delete) → US4 (unavailable) → US6 (unplayable) → Polish.

**Format**: `- [ ] T### [P?] [Story?] description with file path`. `[P]` = different files, no dependency on an
incomplete task.

**Headless rules** (the implement phase has no browser UI, no display, and no `curl`/`wget`):
- All browser behaviour is verified by Playwright specs (`npx playwright test e2e/<file>`) or Vitest, never by hand.
- Never run `next dev` while building or running e2e (the harness builds and serves its own production build on 3100).
- Redirect stdin (`< /dev/null`) on anything that might prompt. Run long commands synchronously.
- Behaviour definitions live in `contracts/` and `data-model.md`; cite them, do not restate them in code comments.
- Keep LF line endings (`npm run check:line-endings`).

---

## Phase 1: Setup (shared scaffolding)

**Purpose**: Baselines recorded on `main` behaviour BEFORE any product change, fences, fixtures, harness.

- [x] T001 Record the card-height baseline BEFORE any product change: write `e2e/memo-card-before-record.spec.ts` (a throwaway recorder, deleted after use) that seeds a song with a base named part, a base unnamed part and a variant, and for each of {375×667, 412×915, 1280×800} × {dark, light} writes each card's bounding box to `e2e/fixtures/memo-card-before.json`. Run it with `npx playwright test e2e/memo-card-before-record.spec.ts`, commit the JSON, delete the recorder spec. (INV-012 baseline)
- [x] T002 Record the part-delete baseline BEFORE any product change: in the same throwaway style, delete a memo-less part through the UI and write the `dumpDatabase` (`e2e/reading-helpers.ts`) diff (the part row's `deletedAt` plus exactly one outbox entry) to `e2e/fixtures/part-delete-before.json`. Run, commit the JSON, delete the throwaway spec. (INV-016 baseline)
- [x] T003 [P] Write `scripts/untouched-by-memos.sh` and add `check:untouched-memos` to `package.json`: prints `zero diff` per path in plan.md § Scope fence against `main` (tracked or untracked), fails otherwise; for `e2e/polish-part-card-menu.spec.ts` it asserts the only changed line is the `want` assignment. Model it on `scripts/untouched-by-notation.sh`. (INV-026)
- [x] T004 [P] Write `scripts/check-memo-fence.sh` and add `check:memo-fence` to `package.json`: the INV-022 greps (the six limit literals only in `src/lib/memos/limits.ts`; `audio/webm|audio/ogg|audio/mp4` only in `src/lib/memos/formats.ts` and tests; `bytes = null`/`bytes: null` exactly once in `src/lib/server/memos.ts`). Model it on the existing `scripts/check-*.sh`. (INV-022)
- [x] T005 [P] Write `scripts/make-memo-tone.mjs` (writes a deterministic 16-bit mono 8 kHz sine WAV of ~6 s) and generate the committed `e2e/fixtures/memo-tone.wav` with `node scripts/make-memo-tone.mjs`. (R13)
- [x] T006 Add the `insecure` Playwright project (`http://lan.test:3100`, with the host mapping the harness needs, R12) to `playwright.config.ts`, and note in the config the data-only memo specs that join `PHONE_ONLY` (`memo-routes`, `memo-recorder`, `memo-sync-separate`, `memo-delete`, `memo-refusal`, `memo-band*`, `memo-recover`, `memo-full`, `memo-persist`, `memo-privacy`). Existing projects only gain list entries. (plan § Structure Decision)
- [x] T007 Write `e2e/memo-helpers.ts`: fake-microphone `test.use` flags (`--use-fake-device-for-media-stream`, `--use-fake-ui-for-media-stream`, `--use-file-for-fake-audio-capture=e2e/fixtures/memo-tone.wav`), `seedMemo` (one per `St` kind, data-model §9), `seedServerAudio`, observation-only wrappers (`getUserMedia` stream keeper, `navigator.storage.persist` counter), the push-400 tripwire response listener that fails the test on any 400 from `/api/sync/push`, and `twoMembers()` (two signed-in contexts in one band). Observation only: no behaviour replacement beyond the two stated exceptions in plan § Invariants.
- [x] T008 [P] Read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` (per AGENTS.md) before writing the route in T070; the rule relied on is that `params` is a Promise and must be awaited.

---

## Phase 2: Foundation (blocks every story)

**Purpose**: the synced `memos` row everywhere a table is declared, the two Postgres tables and migration, merge, push stamp, the Dexie v2 store, formats, limits, refusals, words, and the write path.

**⚠️ CRITICAL**: No story work starts until this phase is complete.

### Invariant probes (FIRST — each must FAIL on the pre-change code)

- [x] T009 [P] Probe INV-005 in `src/lib/sync/__tests__/memo-merge.test.ts`: M1–M6 (contracts/sync-and-storage.md §2) over all 24 orderings of {e1 label A, e2 label B, e3 delete, e4 server-stamped echo}, the 12 ordered pairs, each edit twice, through the public `mergeRow`. Fails first: `memos` is not a synced table and `SERVER_STAMPED_FIELDS` does not exist. The existing `merge.test.ts` must stay unedited and green.
- [x] T010 [P] Probe INV-005/FR-005 in `src/lib/sync/__tests__/tables-agree.test.ts`: `SYNCED_TABLES` deep-equals `SYNC_TABLE_ORDER`; keys of `ROW_SCHEMAS`, `MERGEABLE_FIELDS` and the server `TABLES` equal `SYNCED_TABLES` as sets; `SERVER_STAMPED_FIELDS` keys ⊂ `SYNCED_TABLES`; no field is in both `SERVER_STAMPED_FIELDS[t]` and `MERGEABLE_FIELDS[t]`. Fails first: `memos` is in none of them and `TABLES` is not exported.
- [x] T011 [P] Probe INV-022 (formats half) in `src/lib/memos/__tests__/formats.test.ts`: `parseFormat` over every **FmtA** (accepted, normalised) and **FmtD** (rejected, incl. `audio/webm;codecs=vorbis`, `audio/webm;codecs=opus,vp8`, `audio/mp4;codecs=avc1.42E01E`, `audio/wav`, no header); `chooseFormat` order MP4→WebM→Ogg over fake `isTypeSupported`; container sniff for each base type. Fails first: module absent.
- [x] T012 [P] Probe INV-001/INV-022 (body and refusals) in `src/lib/memos/__tests__/body.test.ts` and `src/lib/memos/__tests__/refusals.test.ts`: `readCapped` returns `too_large` at `max + 1` and pulls no chunk after the crossing one; `REFUSALS` has exactly the 15 non-success codes with the status and exact words of contracts/memo-audio-routes.md §4, and `read_only` uses `READ_ONLY_MESSAGE` from `src/lib/sync/protocol.ts`. Fails first: modules absent.
- [x] T013 [P] Probe INV-006 (Postgres half) in `e2e/memo-recorder.spec.ts`: E pushes a memo row; `select recorded_by_id, recorded_by_name` equals E's; forged pushes via `request.post('/api/sync/push')` with E's cookies setting `recordedById`/`recordedByName` leave E in the DB; a second push from O changing `size`, `format`, `durationMs`, `partId`, `recordedAt` leaves all five unchanged; a memo pushed onto an already-deleted part is stored with its audio never storable (data for D5 is reused later). Fails first: the `memos` table does not exist. Meta-line assertions are added in T066 (US2).

### Implementation

- [x] T014 [P] Create `src/lib/memos/limits.ts` with every constant in data-model §1 (the only home of the limit literals).
- [x] T015 [P] Create `src/lib/memos/formats.ts`: `MEMO_FORMATS`, `chooseFormat`, `normaliseFormat`, `parseFormat`, container sniffing (contracts/recorder.md §5, memo-audio-routes.md §2). Makes T011 pass.
- [x] T016 [P] Create `src/lib/memos/body.ts` (`readCapped`) and `src/lib/memos/refusals.ts` (`REFUSALS`: code → status, message). Makes T012 pass.
- [x] T017 Move `READ_ONLY_MESSAGE` into `src/lib/sync/protocol.ts` with today's exact words, make `applyPush` in `src/lib/server/sync.ts` import it, and add `memoRowSchema` (`parseFormat`, `limits.ts`), `ROW_SCHEMAS.memos` and the `mutationSchema` union member (data-model §2.3). The existing sync unit tests stay green.
- [x] T018 Edit `src/lib/model.ts`: `MemoRow`, `SyncedRows.memos`, `SYNCED_TABLES` + `"memos"` (last), `MERGEABLE_FIELDS.memos = ["label","deletedAt"]`, `SERVER_STAMPED_FIELDS` (data-model §2.1).
- [x] T019 Edit `src/db/schema/domain.ts`: `memos` and `memoAudio` tables, the `bytea` custom type, `SYNC_TABLE_ORDER` + `"memos"` (last); edit `src/db/schema/assert-model.ts`: `_Memos`, `_MemoRecorder` (data-model §2.2, §3). Run `npm run typecheck`.
- [x] T020 Generate the migration with `npm run db:generate < /dev/null` (never hand-write; produces `drizzle/0006_*.sql` and `drizzle/meta/*`), then run `npx drizzle-kit check < /dev/null` and confirm the SQL creates only `memos` and `memo_audio`. (R1)
- [x] T021 Edit `src/lib/sync/merge.ts`: one post-loop `local ?? remote` step for exactly the fields named in `SERVER_STAMPED_FIELDS` (contracts/sync-and-storage.md §2). Makes T009 pass; `merge.test.ts` unedited.
- [x] T022 Edit `src/lib/server/sync.ts`: `TABLES.memos` (exported), `export const PUSH_LOCK`, the insert stamp of `recordedById`/`recordedByName` from the session discarding the device's values, structural fields fixed after insert, and the part-exists check (contracts/sync-and-storage.md §3). Make T010 and T013's row half pass. Erase hooks arrive with T071 (US2).
- [x] T023 Edit `src/lib/local/db.ts`: `version(2)` adding `memos` and the five local tables (`memoAudio`, `memoUploads`, `memoFetches`, `memoDrafts`, `memoDraftChunks`) — stores only (data-model §4). Edit `src/lib/local/mutate.ts`: add those tables to `mutateBatch`'s transaction scope and add `requeueRow` (R17).
- [x] T024 Edit `src/lib/sync/client.ts` `applyRemoteRows`: include the four memo tables in its transaction and call `eraseLocalMemoAudio` for a memo tombstone and a part tombstone (contracts/sync-and-storage.md §4); `pushOnce` records memo rejections on the upload entry (§5). Create `src/lib/local/memos.ts` with `eraseLocalMemoAudio` first (data-model §4.6) so `client.ts` can import it.
- [x] T025 [P] Create `src/lib/memos/words.ts`: `NOTICE_WORDS`, `STATE_WORDS`, `downloadName`, `formatClock` with the exact words from contracts/recorder.md §3, memo-ui.md §5–§6 and data-model §5, §7.
- [x] T026 Run foundation gates and fix failures: `npm run typecheck`, `npm test -- src/lib/sync src/lib/memos`, `npm run check:memo-fence`, `npx playwright test e2e/memo-recorder.spec.ts`, and the existing `sync*.spec.ts` unedited.

**Checkpoint**: the `memos` row syncs and merges; nothing draws it yet.

---

## Phase 3: User Story 1 — Record a memo and play it back, offline (Priority: P1) 🎯 MVP

**Goal**: Record on a part from its menu, Stop saves to IndexedDB, the memo plays under the staff, with no network and signed out.

**Independent Test**: offline and signed out, record with the fake mic, Stop, reload, play. No `/api` request.

### Invariant probes for User Story 1 (FIRST — each must FAIL on the pre-change code)

- [x] T027 [P] [US1] Probe INV-009 in `src/lib/memos/__tests__/recorder.test.ts` (limits section): L1 time 3:00, L2 size 8 MiB, L3 oversized final chunk (longest run of whole chunks within 8 MiB), L4 warn at 15 001/15 000 ms left, L5 announce at 60/30/10 s only, all on a fake clock and fake chunk sizes through `createRecorder(ports)`. Fails first: `createRecorder` absent. The ending table E1–E16 is added in US3.
- [x] T028 [P] [US1] Probe INV-011 (unit half) in `src/lib/memos/__tests__/state.test.ts`: `memoState` over the full 960-input product (hasAudio × upload × fetch × downloading × signedIn × online × canPlay × decodeFailed); the player is shown iff kind ∈ {`refused`,`local-*`,`uploading`,`ready`} and `hasAudio`; words equal the table. Fails first: absent.
- [x] T029 [P] [US1] Probe INV-010 (unit half) in `src/lib/memos/__tests__/sound.test.ts`: every ordered pair of {memo A, memo B, recorder} through `claim`/`release`/`current`; rec→A is refused while recording. Fails first: absent.
- [x] T030 [P] [US1] Probe INV-019 in `src/lib/memos/__tests__/row-valid.test.ts`: every row from `saveMemo` for the keep endings (E1–E3, E7–E10, E13) on fake ports × {Chromium's format, each **FmtA** base type}, and `renameMemo` with label lengths 0, 1, 120, 121, 500 and surrounding spaces, passes `memoRowSchema.parse`. Fails first: `saveMemo` absent. (fake-indexeddb)
- [x] T031 [P] [US1] Probe INV-029 (unit half) in `src/lib/memos/__tests__/storage.test.ts`: `ensurePersisted` over {already persisted, `persist()`→true, →false, rejects, no `navigator.storage`}: at most one `persist()` per device, notice only when end state is not persisted. Fails first: absent.
- [x] T032 [P] [US1] Probe INV-013 in `e2e/memo-mic-ask.spec.ts`: observation-wrapped `getUserMedia` count is 0 after visiting every **Pg** (`/`, `/bands/{id}`, `/songs/{id}`, capture ×2, play ×2) and after opening/closing a part menu; microphone permission is still `prompt`; exactly 1 after **Record memo**. × {mobile, desktop}. Fails first: no Record memo item.
- [x] T033 [P] [US1] (specs written; memo-record passes, memo-offline fails: play stays aria-pressed=false after reload, desktop offline logs failed /api requests) Probe SC-001/SC-002/INV-017 in `e2e/memo-record.spec.ts` and `e2e/memo-offline.spec.ts`: record 4 s, Stop, `memo-play` enabled within 1 s; signed out and offline, for each **Act** (record, reload, play, seek, rename, download, delete) no request to `/api/memos/**` or `/api/sync/**` (request log, `requestfailed` empty for `/api/**`); the clip plays after reload. Fails first: no feature.
- [x] T034 [P] [US1] Probe INV-023 in `e2e/memo-list.spec.ts`: seeded counts {1,3,4,5} × {collapsed, expanded, after reload} × {375, 1280}: order by `recordedAt` ascending, newest 3 drawn, `memo-more` reads `Show {n−3} earlier memo(s)`, expansion persists, other parts unaffected, titles `Memo 1…n` among live memos. Fails first: no list.
- [x] T035 [P] [US1] (fixture re-recorded on HEAD in a throwaway worktree; spec pinned to the mobile project) Probe INV-012 in `e2e/memo-card-height.spec.ts`: each card's bounding box equals `e2e/fixtures/memo-card-before.json` (**Card** × **W** × **Th**); on capture and play routes `getByTestId(/^(part-memos|memo|record-panel)$/)` count 0 with a memo present. Passes trivially only if no card changes — it must fail against a deliberately-wrong box before the implementation (assert the fixture is non-empty and the spec reads it).
- [x] T036 [P] [US1] Probe INV-010 (e2e half) in `e2e/memo-one-sound.spec.ts`: memo A playing → play B → A `aria-pressed="false"` and its `<audio>.paused`; start recording → B paused; FR-042 with `installPlayRecorder` (`e2e/play-helpers.ts`): part playback with Notes on, back link and browser back, start a memo → every recorded `AudioContext` closed, analyser RMS < −60 dBFS. Fails first: no memos.
- [x] T037 [P] [US1] Probe INV-029 (e2e half) in `e2e/memo-persist.spec.ts`: `navigator.storage.persist` observation count 0 after visiting **Pg**, 1 after first Stop, still 1 after a second recording; the "may clear memos" notice shows once, not after Dismiss + reload, not on a second part. Fails first: no feature.

### Implementation for User Story 1

- [x] T038 [P] [US1] Create `src/lib/memos/sound.ts` (`claim`, `release`, `current`). Makes T029 pass.
- [x] T039 [P] [US1] Create `src/lib/memos/storage.ts` (`ensurePersisted`). Makes T031 pass.
- [x] T040 [P] [US1] Create `src/lib/memos/prefs.ts` (`stablature.memos`, `useSyncExternalStore`, shaped like `src/lib/**/panels.ts`).
- [x] T041 [US1] Create `src/lib/memos/state.ts` with `memoState` implementing all twelve kinds (data-model §5). Makes T028 pass.
- [x] T042 [US1] Create `src/lib/memos/ports.ts` (real browser ports: `getUserMedia`, `MediaRecorder`, `AudioContext`+`AnalyserNode` level only, clock, visibility, storage, draft store) and `src/lib/memos/recorder.ts` (`createRecorder(ports)`, `finish(ending)`, `ENDINGS` table with its save rule and words, limits L1–L5) per contracts/recorder.md §1–§4. Makes T027 pass.
- [x] T043 [US1] In `src/lib/local/memos.ts` add `saveMemo` (row, outbox entry, `memoAudio` and, when signed in, upload entry in ONE Dexie transaction through `mutateBatch`), `renameMemo` (label trim + cut to `LABEL_MAX`), `liveMemos`, `deleteMemo` (data-model §4, contracts/sync-and-storage.md §6). Makes T030 pass.
- [x] T044 [P] [US1] Add `useMemos(partId)` and `useMemoLocal(memoId)` live-query hooks to `src/lib/local/hooks.ts`.
- [x] T045 [P] [US1] Create `src/components/memos/useRecorder.ts` and `useMemoPlayer.ts` (one `<audio>` per memo, `sound.claim`, seek, elapsed).
- [x] T046 [P] [US1] Create `src/components/memos/RecordPanel.tsx` (timer, countdown with the last-15-s style, announcements only at 60/30/10 s, level, **Stop**, **Discard** with one confirming tap) per contracts/memo-ui.md §3, test ids from §9.
- [x] T047 [P] [US1] Create `src/components/memos/MemoItem.tsx` (label or `Memo n`, recorder or `You`, date, `m:ss`, player or state words, per-memo menu shell) and `src/components/memos/PartMemos.tsx` (list under the staff, newest 3 + `memo-more`, expansion via `prefs.ts`; renders nothing for a part with no memos) per contracts/memo-ui.md §2, §4.
- [x] T048 [US1] Edit `src/components/ui/OverflowMenu.tsx`: optional per-item `unavailable` (renders `aria-disabled="true"` and "(unavailable)"; still focusable and chooseable). Existing menu specs (`polish-part-card.spec.ts`, `usability-floors.spec.ts`) stay unedited and green.
- [x] T049 [US1] Edit `src/components/app/SongView.tsx`: add **Record memo** to every card's overflow menu (accessible name names the part; Play stays first), mount `<PartMemos>` and `<RecordPanel>` inside the card only when there are memos or a recording, call `ensurePersisted` on first save. Create `src/components/memos/MemoBoot.tsx` and mount it in `src/app/layout.tsx` (runs `recoverDrafts` in US3; no mic request on load).
- [x] T050 [US1] Re-pin on purpose `e2e/polish-part-card-menu.spec.ts`: change only the `want` line to `card.variantOf ? 4 : 5` (plan § Existing tests this changes on purpose). Name it in the later DECISIONS task.
- [x] T051 [US1] (all green; play-part timing specs flake under 12 workers, pass at --workers=2) Run `npx playwright test e2e/memo-record.spec.ts e2e/memo-offline.spec.ts e2e/memo-mic-ask.spec.ts e2e/memo-list.spec.ts e2e/memo-card-height.spec.ts e2e/memo-one-sound.spec.ts e2e/memo-persist.spec.ts e2e/polish-part-card.spec.ts e2e/usability-floors.spec.ts e2e/play-part.spec.ts` plus `npm test -- src/lib/memos`; fix failures.

**Checkpoint**: US1 works alone, offline and signed out. MVP.

---

## Phase 4: User Story 3 — A recording is never silently lost (Priority: P1)

**Goal**: every ending (E1–E16) leaves a saved memo with a notice or a notice that nothing was kept, and releases the microphone; crashes recover.

**Independent Test**: from a fake mic, stop the track, hide the page, fill the quota, crash the page: each ends with a memo + notice or a notice.

### Invariant probes for User Story 3 (FIRST — each must FAIL on the pre-change code)

- [x] T052 [P] [US3] Probe INV-007 (unit) in `src/lib/memos/__tests__/recorder.test.ts`: each ending E1–E16's four assertions (saved-or-not per its rule, exact notice words, microphone released, no silent path) on fake ports. Fails first: the ENDINGS rows beyond what US1 needed are absent.
- [x] T053 [P] [US3] Probe INV-008 (unit) in `src/lib/memos/__tests__/recover.test.ts`: `recoverDrafts` over {playable prefix, unplayable, under 1 s, part tombstoned, part absent}. Fails first: `recover.ts` absent.
- [x] T054 [P] [US3] Probe INV-007 (e2e) in `e2e/memo-endings.spec.ts`: each **EndFake** member (E1, E4, E5, E7, E8, E9 via back link and browser back, E11, E12 via CDP `Storage.overrideQuotaForOrigin`, E13, E14 via a seeded garbage draft) × {mobile, desktop}: the exact words or a new `memo`, and every stream from the `getUserMedia` wrapper has all tracks `readyState === "ended"` within 1 s. E8 falls back to a real `pagehide` navigation if Chromium does not report `hidden` (stated in plan § Invariants).
- [x] T055 [P] [US3] Probe INV-008 (e2e) in `e2e/memo-recover.spec.ts`: record 4 s, CDP `Page.crash`, open a new page in the same context; within 5 s the part shows a memo of ≥ 3 s with E13's words, or E14's words if the format's prefix cannot play (the test reads the format and asserts the branch).
- [x] T056 [P] [US3] Probe INV-028 (save half) in `e2e/memo-full.spec.ts`: CDP quota = usage + 64 KiB, record 4 s, Stop → E12's words with `record-retry` and `record-download-held`; **Download the clip** yields non-empty bytes; raise quota, **Try again** → a memo with the clip's length. The fetch half is added in US2.

### Implementation for User Story 3

- [x] T057 [US3] Complete `ENDINGS` and `finish(ending)` in `src/lib/memos/recorder.ts` for E1–E16 (contracts/recorder.md §3), including the held-clip path (E12) and the draft write each second (`memoDrafts`/`memoDraftChunks`, FR-016). Makes T052 pass.
- [x] T058 [US3] Create `src/lib/memos/recover.ts` (`recoverDrafts`, `probePlayable`) and call it from `MemoBoot.tsx`; E13/E14 notices go to `meta.memoNotices` (data-model §7). Makes T053 pass.
- [x] T059 [US3] Wire into `RecordPanel.tsx`/`PartMemos.tsx`: visibility, track-ended and route-leave listeners via the ports, the held-clip card with **Try again**, **Download the clip**, **Discard**, and one-time notices with Dismiss (contracts/memo-ui.md §3, §6).
- [x] T060 [US3] Run `npx playwright test e2e/memo-endings.spec.ts e2e/memo-recover.spec.ts e2e/memo-full.spec.ts` and `npm test -- src/lib/memos`; fix failures.

**Checkpoint**: no recording is lost without a word.

---

## Phase 5: User Story 2 — The memo reaches the rest of the band (Priority: P1)

**Goal**: upload and fetch by their own route, queued, retried, refused with readable words; another online member gets it within 10 s.

**Independent Test**: two signed-in contexts; A records 30 s, B lists and plays it within 10 s.

### Invariant probes for User Story 2 (FIRST — each must FAIL on the pre-change code)

- [x] T061 [P] [US2] Probe INV-001, INV-002, INV-014 in `e2e/memo-routes.spec.ts`: cases H1–H22 exactly as in contracts/memo-audio-routes.md §5 over real HTTP and a raw `node:net` socket (H6, H22), with `select bytes is not null, sha256, erased_at from memo_audio` read back before/after; **Role** × **Route** × {memo in X, memo in Y, random UUID}; for N the status, headers minus `date`, and body bytes of `GET m` and `GET <random uuid>` are identical; H20/H21 band total ≤ 524 288 000 via `seedServerAudio`. Fails first: the route returns 404.
- [x] T062 [P] [US2] Probe INV-003 in `e2e/memo-sync-separate.spec.ts`: after a 2 MB memo uploads, `GET /api/sync/pull?since=0` is < 64 KiB and each `rows.memos[i]` has exactly `memoRowSchema`'s keys; with `PUT /api/memos/**` held 20 s by `page.route`, a column added on the same device reaches `events` in Postgres within 5 s. {pull, push response} × {pending, uploaded, erased}.
- [x] T063 [P] [US2] Probe INV-015 in `src/lib/memos/__tests__/transfer.test.ts` (fake `fetch`, fake-indexeddb, fake clock): for each **Ans** row × {upload, fetch}, the entry's next state and whether a request is made over 3 passes; fetch newest `recordedAt` first, at most one `GET` in flight; no upload before `serverSeq > 0`; refusals not retried until **Try again**, account change or freed band room; network failures retried with `BACKOFF_MS`. Fails first: absent.
- [x] T064 [P] [US2] Probe INV-015 (e2e) in `e2e/memo-refusal.spec.ts`: V records → "You have read-only access to that band.", no `PUT` over 3 sync cycles, **Try again** sends exactly one push of the row, signing in as E sends the row and the `PUT`.
- [x] T065 [P] [US2] Probe INV-018/SC-003/SC-004 in `e2e/memo-band.spec.ts` (A records 30 s; B `data-state="ready"` and `memo-elapsed` advances within 10 s of Stop) and `e2e/memo-band-offline.spec.ts` (A offline records 5 s, `setOffline(false)`, B ready within 10 s).
- [x] T066 [P] [US2] Probe INV-006 (meta line) in `e2e/memo-recorder.spec.ts` (extend T013): the meta line reads `You` on A while the push is held by `page.route`, and E's name after, on A and on B, over all **Rec** members.
- [x] T067 [P] [US2] Probe INV-028 (fetch half) in `e2e/memo-full.spec.ts` (extend T056): B with a tight quota and two memos to fetch → the newest is `full` ("Out of room on this device."), no `GET` for the older one until **Try again**.
- [x] T068 [P] [US2] Probe INV-004 (device half; the server half H16–H19 is in T061) as the unit probe `src/lib/memos/__tests__/erase.test.ts` (fake-indexeddb): `applyRemoteRows` with a memo tombstone and with a part tombstone leaves no entry in `memoAudio`, `memoUploads`, `memoFetches`, `memoDrafts`/`memoDraftChunks` for the id, in the same transaction as the merge. `eraseLocalMemoAudio` is wired in T024, so this may already pass; if so, say so in the task note and keep it as the regression guard. Note: it already passed (T024 wired the erase); kept as the regression guard.

### Implementation for User Story 2

- [x] T069 [US2] Create `src/lib/server/memos.ts`: `readAudio`, `storeAudio` (runs under `PUSH_LOCK`, re-checks authority and band total, one insert), `eraseMemoAudio(tx, ids)` (the only `bytes = null`), `bandTotal`.
- [x] T070 [US2] Create `src/app/api/memos/[memoId]/audio/route.ts` with `GET` (member) and `PUT` (editor/owner): checks in the order of contracts/memo-audio-routes.md §1–§2, answers from `REFUSALS`, `readCapped`, `parseFormat`, sniffing, `nosniff` and `no-store` headers, `notifyChanged` after a successful store; `params` awaited (Promise) per the Next docs. Makes T061 pass.
- [x] T071 [US2] Hook `eraseMemoAudio` into push in `src/lib/server/sync.ts`: for a memo tombstone, a part tombstone, and a memo pushed on a deleted part (contracts/sync-and-storage.md §3). Makes H16–H19 pass.
- [x] T072 [US2] Create `src/lib/memos/transfer.ts`: `workMemos` (uploads first, then fetches one at a time newest first), `clearWaiting`, the `downloading` store, answer classification per contracts/memo-audio-routes.md §4, backoff. Makes T063 pass.
- [x] T073 [US2] Edit `src/lib/sync/runner.ts`: `await workMemos()` after each `syncNow()` inside the single-flight `run()`, and `clearWaiting()` first on `changed`; edit `src/components/app/SyncProvider.tsx` to call `setMemoAccount(userId)`; add `retryMemo` and `setMemoAccount` to `src/lib/local/memos.ts` (uses `requeueRow`).
- [x] T074 [US2] Wire the state words and actions into `MemoItem.tsx`: Downloading, Waiting for the recording device, Couldn't download + **Try again**, Out of room, refused message verbatim, Saved on this device, Will upload when online (FR-039). Call `ensurePersisted` on first fetch.
- [x] T075 [US2] Run `npx playwright test e2e/memo-routes.spec.ts e2e/memo-sync-separate.spec.ts e2e/memo-refusal.spec.ts e2e/memo-band.spec.ts e2e/memo-band-offline.spec.ts e2e/memo-recorder.spec.ts e2e/memo-full.spec.ts`, `npm test -- src/lib/memos`, and the existing `sync*.spec.ts` unedited; fix failures.

**Checkpoint**: the band shares memos; all sync specs still green.

---

## Phase 6: User Story 5 — Label, download and delete (Priority: P2)

**Goal**: Rename, Download, Delete a memo; deleting erases audio everywhere; deleting a part with memos asks first.

**Independent Test**: label syncs to a second context; delete erases audio on the server and both devices.

### Invariant probes for User Story 5 (FIRST — each must FAIL on the pre-change code)

- [X] T076 [P] [US5] Probe INV-004 in `e2e/memo-delete.spec.ts` (two contexts, A records, B fetched): for **Del** D1–D8, after sync `memo_audio` has `bytes is null and erased_at is not null`, `GET` answers 410 `erased`, and `dumpDatabase` on A and B shows no `memoAudio`, `memoUploads`, `memoFetches`, `memoDrafts` entry for the id.
- [X] T077 [P] [US5] Probe INV-016 in `e2e/memo-part-delete.spec.ts`: memo counts {0,1,2,4}: 0 memos → one tap and the dump diff equals `e2e/fixtures/part-delete-before.json`; n memos → the sheet names `n`; Cancel (n>0) → identical dump; Confirm → part and all `n` memos tombstoned, outbox gains `n + 1`, `memoAudio` lacks all `n`, Postgres agrees and `memo_audio` is ERASED for each × **Card**.
- [X] T078 [P] [US5] Probe INV-021 in `src/lib/memos/__tests__/words.test.ts`: `downloadName` over **FmtA** × {label, no label, only symbols, emoji, empty song title, 200-char title} matches `^[a-z0-9-]{1,40}(-[a-z0-9-]{1,40}){2}\.(m4a|webm|ogg)$`; and `e2e/memo-download.spec.ts`: `download.suggestedFilename()` matches and bytes equal the `memoAudio` entry, for {menu Download, unplayable state's Download, Download the clip}.
- [X] T079 [P] [US5] Probe label sync (AS2) in `e2e/memo-list.spec.ts` (extend T034): rename on A reaches B; two offline renames converge.

### Implementation for User Story 5

- [X] T080 [US5] Finish `src/lib/local/memos.ts`: `deleteMemo` (tombstone through `mutateBatch` + `eraseLocalMemoAudio`) and `deletePart` (re-reads `liveMemos(partId)` inside its transaction, tombstones part + every live memo in one `mutateBatch`; zero memos writes exactly today's write). Handle a `410` to an upload by dropping the entry and audio (D7/D8).
- [X] T081 [US5] Wire the memo menu in `MemoItem.tsx`: **Rename** (inline `Input`, `maxLength={LABEL_MAX}`), **Download** (object URL, `downloadName`, no request), **Delete** (one confirm saying it deletes for everyone in the band); keyboard/Escape/outside tap/focus return per spec 008 FR-016 (contracts/memo-ui.md §4).
- [X] T082 [US5] Edit `src/components/app/SongView.tsx`: deleting a part with live memos asks first naming the count and calls `deletePart`; with zero memos behaves exactly as today (contracts/memo-ui.md §7).
- [X] T083 [US5] Amend `specs/008-usability-polish/spec.md` FR-014 in place: append `*(Amended by spec 012: deleting a part that has memos now asks first; see spec 012 FR-065.)*` and change nothing else.
- [X] T084 [US5] Run `npx playwright test e2e/memo-delete.spec.ts e2e/memo-part-delete.spec.ts e2e/memo-download.spec.ts e2e/memo-list.spec.ts e2e/polish-part-card.spec.ts` and `npm test -- src/lib/memos`; fix failures.

**Checkpoint**: delete means erased, everywhere.

---

## Phase 7: User Story 4 — Recording where the microphone does not exist (Priority: P2)

**Goal**: unavailable Record memo with the right reason and fix.

**Independent Test**: at `http://lan.test:3100` the item is unavailable with the https explanation and a seeded memo still plays.

### Invariant probes for User Story 4 (FIRST — each must FAIL on the pre-change code)

- [x] T085 [P] [US4] Probe INV-020 (unit) in `src/lib/memos/__tests__/capability.test.ts` (jsdom): `recordAvailability` over {`insecure`, `no-microphone`, `no-recorder`, `busy`, `ok`} including "insecure and no `mediaDevices`" → `insecure`. Fails first: absent.
- [x] T086 [P] [US4] Probe INV-020 (e2e) in `e2e/memo-unavailable.spec.ts`: on the `insecure` project the item has `aria-disabled="true"` and "(unavailable)", choosing it shows the `insecure` words exactly, a seeded memo plays; on `desktop` with `window.MediaRecorder` deleted by an init script → `no-recorder` words; with one part recording every other part's item reads `busy`.

### Implementation for User Story 4

- [x] T087 [US4] Create `src/lib/memos/capability.ts` (`recordAvailability`) and use it in `SongView.tsx` for the menu item's `unavailable` flag and the explanation panel (contracts/memo-ui.md §1, §5). Makes T085 pass.
- [x] T088 [US4] Add the FR-029 note to the README's self-hosting section: recording needs https or `localhost`; a plain-http LAN address will not record; https can go in front via a reverse proxy or tunnel without changing `docker-compose.yml`. The note must name `localhost` and a reverse proxy.
- [x] T089 [US4] (supervisor 2026-11-16: not a sandbox limit. `ERR_NAME_NOT_RESOLVED` is a test bug. `useFakeMicrophone()` in `e2e/memo-helpers.ts` calls `test.use({ launchOptions: { args: FAKE_MICROPHONE } })`, which REPLACES the `insecure` project's `launchOptions` and drops its `--host-resolver-rules=MAP lan.test 127.0.0.1`. A bare `chromium.launch` with that flag reaches `http://lan.test` fine on this machine. Keep the project's host rule when a spec also needs the fake microphone: for example, have `useFakeMicrophone` append its flags to the host rule, exported from one place both files read. Then run the command below; it must pass on `insecure` and `desktop`.) — Run `npx playwright test --project=insecure e2e/memo-unavailable.spec.ts` and `npx playwright test e2e/memo-unavailable.spec.ts` plus `npm test -- src/lib/memos/__tests__/capability.test.ts`; fix failures.

**Checkpoint**: no dead Record button.

---

## Phase 8: User Story 6 — Unplayable or undecodable memos say so (Priority: P3)

**Goal**: a memo this browser cannot play shows its reason and Download, never a dead player.

**Independent Test**: seed a WebM memo with `canPlayType` returning `""` for it: message, Download, no `memo-play`.

### Invariant probes for User Story 6 (FIRST — each must FAIL on the pre-change code)

- [X] T090 [P] [US6] Probe INV-011 (e2e) in `e2e/memo-states.spec.ts`: `seedMemo` for each **St** (12 kinds) × {mobile, desktop}: `data-state`, `memo-state` text and `memo-play` presence match the table; `unplayable` via the single stated `canPlayType` exception for `audio/webm;codecs=opus` reading "This browser can't play WebM audio."; `failed-play` via seeded undecodable bytes. Fails first for any kind whose UI path is not yet complete.

### Implementation for User Story 6

- [X] T091 [US6] In `MemoItem.tsx`/`useMemoPlayer.ts`: `canPlay` via `probePlayable`/`canPlayType`, decode-failure handling → `failed-play`, **Download** shown instead of the player (FR-048). Fix any remaining state rows `memo-states.spec.ts` shows missing.
- [X] T092 [US6] Run `npx playwright test e2e/memo-states.spec.ts` and `npm test -- src/lib/memos/__tests__/state.test.ts`; fix failures.

---

## Phase 9: Polish & cross-cutting

**Purpose**: privacy copy, decisions, floors, print, scope fence, human checks, guards.

### Invariant probes (FIRST in the phase — each must FAIL on the pre-change code)

- [x] T093 [P] Probe INV-025 (script) — write `scripts/check-memo-amendments.sh` and `check:memo-amendments` in `package.json`: spec 008 FR-014 carries `Amended by spec 012`; `docs/DECISIONS.md` has "012 — decisions" naming the spec's 14 decision rows (5 + 9) and this plan's 6 deviations, plus "012 — re-pinned tests" and "012 — owed on real phones". Run it BEFORE T097 and confirm it fails on the missing DECISIONS sections.
- [x] T094 [P] Probe INV-025 (pages) in `e2e/memo-privacy.spec.ts`: `/privacy` contains each of the seven FR-090 facts, its date is not `2 November 2026`, `/sign-up` mentions voice recordings, `/terms` does; the README self-hosting section names `localhost` and a reverse proxy. Fails first: copy unchanged.
- [x] T095 [P] Probe INV-024 in `e2e/memo-floors.spec.ts`: every test id in contracts/memo-ui.md §9 present is ≥ 44×44 on touch and meets the fine floor with a mouse; contrast ≥ 4.5:1 (method of `usability-contrast.spec.ts`); `scrollWidth ≤ innerWidth`; × **W** × **Ptr** × **Th** × {idle with memos, recording, held, explanation open}.
- [x] T096 [P] Probe print edge in `e2e/memo-print.spec.ts`: `page.emulateMedia({ media: "print" })` → `part-memos` not visible.

### Implementation

- [x] T097 Edit `docs/DECISIONS.md`: sections "012 — suite before" (existing-suite state recorded at T001), "012 — decisions" (spec's 14 rows + plan's 6 deviations), "012 — re-pinned tests" (`e2e/polish-part-card-menu.spec.ts`), "012 — owed on real phones" (P1–P6 table from quickstart §6), "012 — browser check" (pending, see T104), and the slow/loop idea under Out of Scope. Make T093's script pass.
- [x] T098 [P] Edit `src/app/privacy/page.tsx` (FR-090 facts, new date), `src/app/terms/page.tsx` and `src/components/app/AuthForm.tsx` (FR-091). Makes T094 pass.
- [x] T099 Fix any floor/contrast/overflow failures from T095 in the memo components (use `Button`, `Input`, `OverflowMenu` and the `--control` floors; no width breakpoints; nothing relies on colour alone) and add print hiding if T096 fails.
- [x] T100 Run `npm run check:untouched-memos`, `npm run check:memo-fence`, `npm run check:memo-amendments`; fix any non-`zero diff`.
- [x] T101 Run `npx playwright test e2e/memo-floors.spec.ts e2e/memo-print.spec.ts e2e/memo-privacy.spec.ts`; fix failures.
- [x] T102 Run the quickstart's automated parts: `npm run typecheck`, `npm run lint`, `npx drizzle-kit check < /dev/null`, `npm run check:line-endings < /dev/null`, `npm test`, `npx playwright test e2e/memo-*.spec.ts`, `npx playwright test --project=insecure`.
- [x] T103 Guards (final fast guard tier): run `npm run typecheck && npm run lint && npm test && npm run check:untouched-memos && npm run check:memo-fence && npm run check:memo-amendments && npm run check:line-endings < /dev/null && npm run check:untouched-notation && npm run check:untouched-wide`, and the unedited structural e2e guards (`npx playwright test e2e/wide-*.spec.ts e2e/notation-capture-height.spec.ts e2e/usability-floors.spec.ts e2e/sync.spec.ts e2e/sync-no-lost-rows.spec.ts`). Fix every failure BEFORE any push; a failing test outside the re-pin table is a product defect, not a test to edit.
- [ ] T104 🛑 BLOCKED: needs a person at a real browser — quickstart §5 browser check at 100% zoom, both themes, 375×667 and 1280×800 (one survey over all eight items: recording card, out-of-room card, every FR-039 state, unplayable memo, insecure-address item and explanation, 5 memos collapsed and expanded, part- and memo-delete confirmations, print preview); record the result in `docs/DECISIONS.md` under "012 — browser check". (INV-027, FR-103)
- [ ] T105 🛑 BLOCKED: needs real phones (iPhone Safari incl. home screen, Android Chrome) over https — quickstart §6 P1–P6 as ONE survey (record 20 s, cross-play, airplane-mode upload, silent switch, call during recording); record each outcome under "012 — owed on real phones" in `docs/DECISIONS.md`. (INV-027, SC-010)

---

## Dependencies & Execution Order

- **Setup (T001–T008)**: T001 and T002 MUST run before any product change (baselines). T003–T008 parallel after.
- **Foundation (T009–T026)** blocks all stories. Probes T009–T013 first; then T014–T016 [P], T017–T025 in order of their dependencies (T017→T018→T019→T020; T021 after T018; T022 after T017–T019; T023 after T019; T024 after T023; T025 [P]).
- **Stories** follow plan order: US1 → US3 (needs the recorder from US1) → US2 (needs rows, `memos.ts`, state words from US1) → US5 (needs erasers and the list) → US4 (menu from US1) → US6 (state/player from US1, US2).
- **Polish** after all stories; T104/T105 are human-owned and stay unchecked; they are owed, not missing.
- Within a story: probes → models/lib → hooks → components → integration run.

## Parallel examples

```text
Foundation probes:  T009, T010, T011, T012, T013 together
Foundation libs:    T014, T015, T016, T025 together
US1 probes:         T027–T037 together (distinct files)
US1 UI:             T046, T047, T045 together after T041–T043
```

## Implementation Strategy

- **MVP**: Setup + Foundation + US1 (record and play offline, signed out). Then US3 (a P1: never lose a recording),
  then US2 (the band), each independently testable at its checkpoint.
- Incremental: US5, US4, US6 add value without breaking earlier stories; the full unedited existing suite is the
  regression net (INV-026).
- Never edit an existing test outside the re-pin table. If implement finds another that must change, stop, add it to
  plan.md's table with its reason, then edit.

## Notes

- Probes fail first: run each before its implementation and confirm it fails for the stated reason.
- Real browser behaviour is checked only by Playwright; nothing here relies on a person except T104 and T105.
- Commit after each task or logical group.

---

## Phase 10: Review remediation

**Purpose**: the blocking findings of `review.md` (round 1). Each violated invariant's probe is adopted first and must
FAIL on the current code before its fix. The probes, and how to run them, are in `review-probes/README.md`. MINORs are in
`review.md` § Follow-ups, not here.

- [x] T106 Adopt `review-probes/INV-002-push-cross-band-erase.spec.ts` as `e2e/memo-push-cross-band.spec.ts` (import from `./memo-helpers`; add it to PHONE_ONLY in `playwright.config.ts`) and run it to see it FAIL first: both forged pushes are accepted, and band Y's memo audio is erased — review F1 (BLOCKER), INV-002
- [x] T107 In `src/lib/server/sync.ts` (`applyPush`/`upsert`, lines 110-111, 155-161, 204-207, 261-275), refuse a mutation whose `id` names an existing row in a different band before `mergeRow`, and for `memos` one in a different part. Use the existing rejection shape. No tombstone and no `eraseMemoAudio` may then reach another band's memo or part. T106, `e2e/memo-routes.spec.ts`, `e2e/memo-recorder.spec.ts` and the unedited `sync*.spec.ts` pass — review F1 (BLOCKER), INV-002, FR-030, FR-061
- [x] T108 Adopt `review-probes/INV-018-changed-during-run.spec.ts` as `e2e/memo-band-race.spec.ts` (the `memo-band*` PHONE_ONLY glob covers it) and see it FAIL first: B still `waiting` 10 s after A's upload — review F2 (MAJOR), INV-018
- [x] T109 In `src/lib/sync/runner.ts:61-77`, carry a "changed" that arrives while a pass is running into the queued follow-up pass, so that pass runs `clearWaiting()` before `syncNow()` and `workMemos()`. T108 passes 3 of 3 with `--repeat-each=3 --workers=1`; `e2e/memo-band*.spec.ts` and the sync specs pass — review F2 (MAJOR), INV-018, FR-038
- [x] T110 Adopt `review-probes/INV-028-full-resumes-next-cycle.test.ts` into `src/lib/memos/__tests__/` (beside `transfer.test.ts`) and see it FAIL first: 0 requests over 5 cycles after room is made — review F3 (MAJOR), INV-028
- [x] T111 In `src/lib/memos/transfer.ts` (line 208 stores `full` with `nextAt = 0`; line 244 holds every pass), give `full` a backoff `nextAt`, and hold all fetches only while a `full` entry's `nextAt` is in the future. Once it passes, ask for that memo again first, and stop again if the device is still full (data-model §4.3, FR-071). T110, the existing `transfer.test.ts` case "a full device holds the older memos until Try again" and `e2e/memo-full.spec.ts` pass — review F3 (MAJOR), INV-028, FR-071
- [x] T112 Replace the test in `e2e/memo-recover.spec.ts` with `review-probes/INV-008-draft-each-second-and-recover.spec.ts`'s method: copy the draft a crash would leave, recover it on a fresh device, decode it, and compare lengths. It needs no `Page.crash`, which closes the whole context on desktop too. Drop the desktop-only skip that made the spec run on no project. The file is new on this branch, so it is not on the re-pin list. See it FAIL first: about 1.48 s lost on `audio/mp4;codecs=mp4a.40.2` — review F4 (MAJOR), INV-008
- [x] T113 Keep the recording's draft within 1 s of the microphone on every format: for example a shorter `TIMESLICE_MS` (`src/lib/memos/limits.ts:18`), or a `requestData()` every second beside `rec.start` (`src/lib/memos/recorder.ts:416`). `recorder.test.ts` L1–L5 and E1–E16 stay green, and `recover.ts`'s length estimate (`kept × TIMESLICE_MS`, line 109) stays true. T112 passes 3 of 3 with `--repeat-each=3` — review F4 (MAJOR), INV-008, FR-016

---

## Phase 11: Review remediation

**Purpose**: the blocking finding of `review.md` (round 2), then the adoption of the review probes that hold but are
not yet in the suite. Round 1's four blocking findings are fixed (review.md § Round 1, re-checked). MINORs are in
`review.md` § Follow-ups, not here. How to run the probes is in `review-probes/README.md`.

- [X] T114 Convert `src/lib/server/sync.ts` back to LF line endings with no other change: the T107 fix rewrote it as CRLF. First run `npm run check:line-endings < /dev/null` and see it FAIL on `changed ending src/lib/server/sync.ts (index lf, working tree crlf)`. After the change, it passes. `git diff --stat HEAD -- src/lib/server/sync.ts` equals the `--ignore-cr-at-eol` count (about +90/−11). `npm run typecheck` and `e2e/memo-push-cross-band.spec.ts` pass — review F16 (MAJOR), plan § Technical Context "Constraints", T103 DONE (supervisor 2026-11-16): the check first failed with `changed ending src/lib/server/sync.ts (index lf, working tree crlf)`. Converted with `sed -i 's/$//'`, and nothing else changed; `npm run check:line-endings` now prints `line endings: kept`, and `diff --stat` equals `--ignore-cr-at-eol` (27 files, +646/−36).
- [X] T115 Adopt `review-probes/INV-004-delete-paths-d6-d8.spec.ts` as `e2e/memo-delete-paths.spec.ts`: import from `./memo-helpers`, and add it to PHONE_ONLY in `playwright.config.ts`. Do not copy the probe's module-level `postgres` client with `afterAll(sql.end)`, which is review F7's `CONNECTION_ENDED` under `fullyParallel`; open the client inside each test, or end it only at worker teardown. It holds today, so it must PASS (D6, D7, D8), and it stays as the regression guard for the D6–D8 half of INV-004 — review F8, INV-004
- [X] T116 Adopt `review-probes/INV-029-dismiss-then-reload.spec.ts`'s waits into `e2e/memo-persist.spec.ts:30-32`. Before reloading, wait for the Dismiss to take effect (the notice is gone, and its Dexie write is committed). After the reload, wait for the memo list to draw before asserting 0 notices. The file is new on this branch, so it is not on the re-pin list. It must pass 3 of 3 with `--repeat-each=3` — review F6, INV-029
- [X] T117 Adopt `review-probes/INV-028-full-stays-full.test.ts` into `src/lib/memos/__tests__/` beside `transfer.test.ts`. Keep its one assertion: the older memo is never asked for while the device stays full. Do not assert the re-download count, which is MINOR F17 and not this phase's work. It must pass — INV-028
- [X] T118 Adopt `review-probes/SC-001-stop-to-playable.spec.ts`'s two tests into the suite: the signed-out one into `e2e/memo-record.spec.ts`, and the signed-in one (it uses `twoMembers`) into a PHONE_ONLY memo spec such as `e2e/memo-band.spec.ts`. Import from `./memo-helpers`. Both must pass, with every sample ≤ 1 000 ms — SC-001

---

## Phase 12: Review remediation

**Purpose**: the blocking finding of `review.md` (round 3). Round 2's MAJOR (F16) is fixed, and every Phase 11 task
holds as ticked. The probes are adopted first and must FAIL on the current code before the fix. Run them ALONE, at
`--workers=1`: another test's server write wakes every client through the SSE stream and lets them pass by luck.
How to run the probes is in `review-probes/README.md`. MINORs are in `review.md` § Follow-ups, not here.

- [X] T119 Adopt the two Try-again probes into the suite, and see each FAIL first when run alone with `--workers=1`. (1) `review-probes/FR-071-try-again-resumes-fetch.spec.ts` becomes a test in `e2e/memo-full.spec.ts`: no GET within 5 s of Try again; the first GET comes on the 60 s poll. (2) `review-probes/FR-036-try-again-runs-a-pass.spec.ts` becomes `e2e/memo-retry.spec.ts`: no PUT within 5 s of Try again on a `band_full` memo. Add `memo-retry.spec.ts` to PHONE_ONLY in `playwright.config.ts`. Import from `./memo-helpers`. Open the Postgres client per test, as `e2e/memo-delete-paths.spec.ts:20-27` does, not at module level with `afterAll(sql.end)` — review F23 (MAJOR), FR-071, FR-036
- [X] T120 Make Try again start a sync pass at once. In `src/lib/local/memos.ts:207-216` (`retryMemo`), after the transaction, dispatch `MEMO_RETRY_EVENT` on `window`, guarded by `typeof window !== "undefined"` for the node unit tests. In `src/lib/sync/runner.ts` (`startSync`), add `window.addEventListener(MEMO_RETRY_EVENT, trigger)`, and remove it in the stopper beside the `online` listener; this clears the lint warning at `runner.ts:25`. Then T119's two tests pass 3 of 3 alone (`--repeat-each=3 --workers=1`), `npx playwright test e2e/memo-full.spec.ts` passes alone with the project config, and `npm test`, `e2e/memo-refusal.spec.ts` and `e2e/memo-band*.spec.ts` pass — review F23 (MAJOR), src/lib/local/memos.ts:203-216, src/lib/sync/runner.ts:25, e2e/memo-full.spec.ts:61, FR-071, T111

---

## Phase 13: Review remediation

**Purpose**: the two blocking findings of `review.md` (round 4), both in Phase 12's own work. Round 3's MAJOR (F23) is
fixed, and all 29 invariants hold. The probe is adopted first and must FAIL on the current code before the fix. How to
run the probes is in `review-probes/README.md`. MINORs are in `review.md` § Follow-ups, not here. A remediation pass has
now turned a tracked LF file into CRLF twice (round 2 F16, round 4 F26). So every task below edits only LF files, keeps
them LF, and ends with `npm run check:line-endings < /dev/null` passing.

- [x] T121 Convert `playwright.config.ts` back to LF line endings with no other change: T119's edit at line 75 rewrote all 157 lines as CRLF. First run `npm run check:line-endings < /dev/null` and see it FAIL on `changed ending  playwright.config.ts  (index lf, working tree crlf)`. Convert with `sed -i 's/\r$//' playwright.config.ts`. After the change, the check prints `line endings: kept`. `git diff --stat HEAD -- playwright.config.ts` equals its `--ignore-cr-at-eol` count (+32/−1), and `bash specs/012-voice-memos/review-probes/TC-line-endings-cr-bytes.sh < /dev/null` prints no `modified` line. Its `new` lines are MINOR F28 and not this task's work. `npm run typecheck` passes — review F26 (MAJOR), playwright.config.ts:75, plan § Technical Context "Constraints", round 2 F16
- [x] T122 Adopt `review-probes/F27-record-helper-late-microphone.spec.ts` as a test in `e2e/memo-record.spec.ts`. Import from `./memo-helpers`; that file already calls `withFakeMicrophone()`. Keep the init script that resolves the real `getUserMedia` stream 1.5 s late and changes nothing else. Do not touch `playwright.config.ts`: `memo-record` runs on both `mobile` and `desktop`, which is wanted. Run it on both projects and see it FAIL first: no memo kept, and the notice reads "Too short to keep. Recordings need at least 1 second." `e2e/memo-record.spec.ts` stays LF — review F27 (MAJOR), e2e/memo-helpers.ts:287-301
- [x] T123 In `e2e/memo-helpers.ts`, start the recording helpers' clock when the recorder has actually started, not when `record-panel` shows. The panel is drawn from the `asking` phase (`src/components/memos/PartMemos.tsx:35`, `src/lib/memos/recorder.ts:427`), before `getUserMedia` resolves. Install an observation-only wrapper on `MediaRecorder.prototype.start`, the plan's allowed kind, that records when its `start` event fires, as `review-probes/INV-006-meta-line-too-short.spec.ts` does. Then `startRecording` waits for that event, with a bounded wait, so E5 (refused, never starts) still ends at once under its `.catch`. `recordMemo` waits for it, then `ms`, then Stop. Move the two identical `memoIds` and `stopToPlayable` copies (`e2e/memo-record.spec.ts:17-38`, `e2e/memo-band.spec.ts:26-47`) into `memo-helpers.ts` with the same fix, and import them. No product file changes. Afterwards:
  - (1) T122's test passes on `mobile` and `desktop`.
  - (2) `npx playwright test e2e/memo-retry.spec.ts --workers=1 --repeat-each=6 < /dev/null` passes 6 of 6.
  - (3) `npx playwright test e2e/memo-full.spec.ts --workers=1 --repeat-each=3 < /dev/null` passes 9 of 9.
  - (4) `e2e/memo-endings.spec.ts` passes on both projects, and E11 (`:118-125`) still reaches "Too short to keep" by pressing Stop right after `startRecording`.
  - (5) The whole memo suite at 3 workers, through the review config's `REVIEW_DIR=e2e` command in `review-probes/README.md`, has no failure that reads "Too short to keep".
  - (6) `review-probes/F27-record-helper-late-microphone.spec.ts` and `review-probes/INV-006-meta-line-too-short.spec.ts` pass.
  - (7) The SC-001 samples stay ≤ 1 000 ms, and `memo-full.spec.ts:33`'s length check passes.
  - (8) `npm run typecheck` and `npm run check:line-endings < /dev/null` pass.

  — review F27 (MAJOR; carries F18 and F24), e2e/memo-helpers.ts:287-301, e2e/memo-retry.spec.ts:67-69, T120's "3 of 3 alone" acceptance, plan gate "tests must be able to fail for the right reason"
