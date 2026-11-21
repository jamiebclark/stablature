# Implementation Plan: Voice memos on a part, recorded offline and synced to the band

**Branch**: `012-voice-memos` | **Date**: 2026-11-16 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-voice-memos/spec.md`

## Summary

A part's menu gains **Record memo**. The phone records from its microphone to IndexedDB, a chunk a second. **Stop**
saves the clip as a memo, which plays under the part's staff on the song page. The memo's details are a new synced
row, `memos`. Its audio never rides the row sync. It moves through one new route,
`/api/memos/{id}/audio` (`PUT` to upload, `GET` to download), into a new Postgres table, `memo_audio`. Deleting a memo
tombstones its row, and **erases** its audio on the server in the same push transaction, and on each device when the
tombstone is applied.

The design has six parts. In each, the things that must agree are kept in agreement because one **calls** the other:

- **One row, one merge.**
  - `memos` goes everywhere a synced table is declared, and a unit test asserts that those lists agree.
  - Only `label` and `deletedAt` merge. The recorder is stamped by the server at insert.
  - The device's `mergeRow` takes `local ?? remote` for exactly the fields named in `SERVER_STAMPED_FIELDS`. Only
    the server ever writes a non-null value, once, so merging stays commutative and idempotent (research R4).
- **One store for bytes on each side.**
  - Server: `memo_audio`, with the states *(none)* → STORED → ERASED. ERASED is terminal, so "erased" stays
    answerable for ever (R1).
  - Device: `memoAudio`. A memo is saved with its row, outbox entry, audio and upload entry in one Dexie transaction.
- **One eraser on each side.**
  - Server: `eraseMemoAudio(tx, ids)` is the only statement that nulls bytes. Push calls it for a memo tombstone, for
    a part tombstone, and for a memo on a deleted part.
  - Device: `eraseLocalMemoAudio(db, ids)`. Every local delete, pulled tombstone and `410` calls it (data-model §4.6).
- **One lock.** An upload's write runs under push's own advisory lock. So it serialises with tombstones and with
  other uploads, and the band total and "no audio for a deleted memo" cannot race (R3).
- **One pass, after each sync.**
  - The runner's existing single-flight `run()` calls `workMemos()` after `syncNow()`: uploads first, then fetches,
    one at a time, newest first.
  - An upload's success calls the existing `notifyChanged`, so every other device's runner wakes and fetches. No new
    wire field and no third route (R5).
- **One recorder, one way out.**
  - `createRecorder(ports)` has a single `finish(ending)`. It always releases the microphone, then applies the
    ending's save rule, then writes the ending's notice.
  - Sixteen endings are enumerated with their exact words (contracts/recorder.md §3). No ending is silent by
    construction.

Memos appear only on the song page. Capture, the play view, the playback engine, the export and `public/sw.js` have
zero diff.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.3, Next.js 16.4.3 (App Router).
- Route handler `params` is a `Promise`, awaited, per
  `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.
- The app has no `proxy.ts`, so a route handler's `request.body` is the raw stream. Next does not buffer it
  (`…/05-config/01-next-config-js/proxyClientMaxBodySize.md`).

**Primary Dependencies**:
- Existing: Dexie 4, `dexie-react-hooks`, Drizzle ORM 0.45 with drizzle-kit 0.31, `postgres` 3, zod 4,
  better-auth 1.7 and `lucide-react` (the `Mic`, `Square`, `Pause` and `Download` icons).
- Browser APIs: `getUserMedia`, `MediaRecorder`, `AudioContext` with `AnalyserNode` (level only), `HTMLAudioElement`,
  `navigator.storage`, and Web Crypto `subtle.digest` on the server (`node:crypto` `createHash`).
- **No new dependency.**

**Storage**:
- Postgres gains two tables, `memos` (synced) and `memo_audio` (`bytea`, not synced). There is one generated
  migration, `drizzle/0006_*.sql`.
- Dexie gains version 2: `memos` plus five local tables (data-model §4).
- `localStorage` gains `stablature.memos`, which holds the list expansion and the persistence flags.

**Testing**:
- Vitest (`npm test`): node by default, jsdom by docblock, with `fake-indexeddb` for the Dexie tests. It covers the
  merge, formats, `readCapped`, the refusal table, the recorder with fake ports, `memoState`, the transfer pass with a
  fake `fetch`, the sound singleton and the agreement of the table lists.
- Playwright 1.64 (`npm run test:e2e`), against a production build and the real Postgres (`STABLATURE_DATABASE_URL`).
  The routes are probed over HTTP and a raw socket (research R14). Recording uses Chromium's fake device with a
  committed WAV (R13).
- A new Playwright project, `insecure`, reaches the app at `http://lan.test:3100` (R12).
- A browser check at actual size, and real-phone items, follow (quickstart §5, §6).

**Target Platform**: The installable offline PWA, in mobile Safari (iOS 17+), Chrome on Android, and desktop Chromium
and Firefox. Self-hosted with `docker-compose.yml` and `.env` only. Budgeted sizes: 375×667, 412×915, 1280×800.

**Project Type**: Next.js web application, single package.

**Performance Goals**:
- A memo is playable within 1 s of **Stop** (SC-001). The save is one Dexie transaction of at most 8 MiB, and the list
  is a live query.
- Another online member lists it and can play it within 10 s of Stop for a 30 s clip (SC-003). Within 10 s of a
  reconnect for an offline recording (SC-004).
- No pull is ever larger because of audio (INV-003).
- The upload holds the push lock only for the checks and one insert.

**Constraints**:
- Screens read memos only from Dexie. Writes go only through `mutate.ts` and the new `src/lib/local/memos.ts`, which
  calls it (FR-002).
- The microphone is asked for only inside the tap on **Record memo** (FR-011).
- Capture, the play view, `src/lib/playback/`, `src/lib/rhythm/`, `src/lib/tab/`, `src/lib/export/` and
  `public/sw.js` have **zero diff** (*Scope fence*).
- `docker-compose.yml`, `.env.docker.example`, `Dockerfile` and `next.config.ts` have zero diff (FR-009).
- Never run the build or the e2e suite while a dev server holds `.next`.
- Keep each file's line endings; every file in this tree is LF (`npm run check:line-endings`).

**Scale/Scope**:
- About 18 new source files (≈1,900 LOC) and 14 modified, plus one migration.
- 9 new unit spec files.
- 17 new e2e specs, plus a helper and one fixture.
- 2 guard scripts.
- 1 existing e2e spec re-pinned on purpose.

**Story dependencies**: The foundation is the row, the tables, the migration, merge, push, the device store, the
formats and the limits. Then:
- US1 (record and play, offline) needs the recorder and the memo area.
- US3 (never lost) is the recorder's endings and recovery.
- US2 (the band gets it) needs the routes and the transfer pass.
- US5 (label, download, delete) needs the erasers.
- US4 (unavailable) and US6 (unplayable) are capability and `memoState` rows.

The order is: foundation → US1 → US3 → US2 → US5 → US4 → US6.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` is still **the unfilled scaffold template**, so there is no ratified constitution to
gate against. As in entries 1 to 11, the gates are the project's working rules from `docs/DECISIONS.md`, `AGENTS.md`,
the README's architecture and the code's own headers.

| Gate | Source | Status | How this plan satisfies it |
|------|--------|--------|----------------------------|
| **Screens read only the local store; the network is never in the read path.** | `src/lib/local/db.ts`, `sync/client.ts` headers | PASS | The memo list, its state and its audio come from Dexie. The routes are called only by the transfer pass inside the runner. |
| **Every write goes through `mutate.ts`.** | `mutate.ts` header | PASS | `saveMemo`, `renameMemo`, `deleteMemo` and `deletePart` call `insertRow`, `patchRow` and `deleteRow` inside `mutateBatch`. `requeueRow` is added **to** `mutate.ts` (R17). |
| **Merging is commutative and idempotent; the 24-orderings test.** | `merge.ts` header; spec FR-100 | PASS | The one merge change is null-filling over a single-writer field (R4). M1–M6 prove it, and the old test is unedited (INV-005). |
| **The SQL schema cannot drift from `model.ts`.** | `assert-model.ts` | PASS | `_Memos` and `_MemoRecorder` are added. `tables-agree.test.ts` closes the remaining lists (contracts/sync-and-storage.md §1). |
| **Deletes are tombstones.** | `domain.ts` header | PASS, with the spec's exception | The memo **row** is tombstoned like any other. Only its **audio** is erased, which is the spec's own decision (FR-060–FR-064). |
| **Self-hosting needs only `docker-compose.yml` and `.env`.** | README | PASS | Audio is `bytea` in the existing database, with no new variable (FR-009). |
| **Offline first; `public/sw.js` read before touching the network.** | `sw.js` header | PASS | `/api/*` is already never cached. `sw.js` has zero diff. Recording, playing, renaming, downloading and deleting make no request (INV-017). |
| **The server is authoritative only about membership and ordering.** | `server/sync.ts` header | PASS, extended on purpose | The server also stamps the recorder at insert and erases audio. Both are written down as blast-radius decisions below. |
| **Browser testing is part of done, at actual size, in both themes.** | `docs/DECISIONS.md` | PASS (owed) | quickstart §5 (INV-027). |
| **Real-device claims are not ticked from a desktop.** | DECISIONS entry 5 | PASS (owed) | quickstart §6 (SC-010), carried as human tasks (INV-027). |
| **Nothing relies on colour alone; no tier is opacity over a surface.** | DECISIONS | PASS | Unavailable items carry "(unavailable)". The warning countdown gains "Only" and weight. Danger keeps its word and icon. |
| **A size is never set by a width breakpoint.** | `globals.css` density header | PASS | The new controls use `Button`, `Input`, `OverflowMenu` and the `--control` floors. |
| **Domain rules live in `src/lib/`, React-free.** | `editing.ts` header | PASS | The recorder, formats, limits, state, words, refusals and transfer pass live in `src/lib/memos/`. Writes live in `src/lib/local/memos.ts`. |
| **Earlier requirements stay true or are amended in place.** | spec 007 practice | PASS | Spec 008 FR-014 ("no confirmation") is amended in place by FR-065, pinned by `check:memo-amendments` (INV-025). |
| **Tests must be able to fail for the right reason.** | entries 4 to 11 reviews | PASS | The route probes go over real HTTP and a real socket, and check Postgres. The card-height baseline is recorded on `main` before any change. No check passes by skipping, and the DB-dependent specs fail rather than skip when `STABLATURE_DATABASE_URL` is set. |
| **Simplicity.** | `ui/index.tsx` header | PASS | No new service or dependency. One route file, one lock (reused), one eraser per side. |

**Post-design re-check (after Phase 1)**: PASS. Every pair that must agree is closed by one calling the other
(*Agreement is structural*). Two things are not structural:
- whether a browser can actually play another browser's recording, which only a real phone can show (SC-010);
- whether Chromium's headless `bringToFront` fires `visibilitychange` (the probe for E8 has a stated fallback).

Both are owed, not assumed. No gate needs a Complexity Tracking entry.

### Deviations from the spec's wording

1. **"Two new routes" are one route file with two handlers**, `PUT` and `GET` on `/api/memos/{id}/audio` (research
   R2). Each handler has its own authority (editor for `PUT`, member for `GET`), which is what FR-030 asks for.
2. **Deleting a part erases its memos' audio even when the memo rows were not tombstoned** (research R18). This
   covers the race where a bandmate deletes a part, with one tap, that had no memos on their device. The server
   erases on the part's tombstone, devices erase on applying it, and an upload for such a memo is refused with
   `410 part_deleted`. The memo rows stay live but are never drawn, because their card is gone. This extends FR-061
   and FR-062 from "the memo's tombstone" to "the memo's or its part's tombstone". Recorded as **worth your eye**.
3. **The read-only words are the push's own, "You have read-only access to that band."** FR-035's example says
   "this band". US2 AS6 requires "the same words the app uses for other refused writes", and those win. The upload
   route uses the same string.
4. **The recorder's name is frozen at the first push.** Renaming the account later does not change old memos.
   Deleting the account sets `recordedById` to null and keeps the stamped name. The spec is silent on both.
5. **A final chunk that would pass 8 MB is not kept.** The saved clip is the longest run of whole chunks within 8 MiB
   (contracts/recorder.md L3), because a row over the cap would fail the wire schema and stall every push. The size
   guard makes this case practically unreachable at the requested bitrate.
6. **An upload cut off mid-transfer answers `400 incomplete` and is retried, not refused.** The spec's edge case says
   "retried whole". This makes it so: it is the one 4xx the client retries.

## Invariants — what must never happen *(mandatory)*

The probes go through the real interfaces:
- HTTP to `/api/memos/{id}/audio` and `/api/sync/*`, including a raw `node:net` socket, with Postgres read back;
- e2e on a production build, with Chromium's fake microphone, `dumpDatabase` (`e2e/reading-helpers.ts`), a request
  log (`page.on("request")`), CDP `Storage.overrideQuotaForOrigin` and CDP `Page.crash`;
- the public exports `mergeRow`, `applyPatch`, `memoRowSchema`, `parseFormat`, `chooseFormat`, `readCapped`,
  `createRecorder` (with fake ports), `memoState`, `workMemos` (with a fake `fetch` and `fake-indexeddb`),
  `sound.claim`, `recordAvailability`, `downloadName` and `recoverDrafts`.

Observation-only instrumentation, which wraps a function and records its calls without changing its behaviour, is
allowed in e2e. That covers `getUserMedia` (to keep the streams and check `readyState`) and `navigator.storage.persist`
(to count calls). Replacing a browser behaviour is not allowed, with two exceptions, both standing in for an older
browser:
- INV-020's `no-recorder` case deletes `window.MediaRecorder`.
- INV-011's `unplayable` case makes `HTMLMediaElement.prototype.canPlayType` return `""` for exactly the seeded
  memo's format.

Named sets:

- **Role**: ∅ (no session), N (member of another band only), V (viewer), E (editor), O (owner).
- **Route**: `GET`, `PUT`.
- **H**: the route cases H1–H22 ([contracts/memo-audio-routes.md](./contracts/memo-audio-routes.md) §5).
- **FmtA**, **FmtD**: the allowed and disallowed content types listed there.
- **End**: the recorder endings E1–E16 ([contracts/recorder.md](./contracts/recorder.md) §3).
- **EndFake**, the endings a fake device can produce in e2e:
  - E1 stopped;
  - E4 discarded;
  - E5 refused;
  - E7 cut-short (the fake track's `stop()`);
  - E8 hidden (a second page brought to front; if Chromium does not report `hidden`, a real `pagehide` by navigating
    away, then E13 at the next open);
  - E9 left (the back link, and browser back);
  - E11 too short;
  - E12 out of room (CDP quota);
  - E13 recovered (CDP `Page.crash` mid-recording);
  - E14 unrecoverable (a draft seeded with garbage chunks).
- **St**: the twelve `memoState` kinds (data-model §5): `deleted`, `unplayable`, `failed-play`, `refused`,
  `local-signed-out`, `local-offline`, `uploading`, `ready`, `downloading`, `full`, `fetch-failed`, `waiting`.
- **Del**, the ways audio must go:
  - D1 delete a memo on this device;
  - D2 a memo tombstone pulled;
  - D3 delete a part with memos on this device;
  - D4 a part tombstone pulled;
  - D5 a memo pushed onto an already-deleted part;
  - D6 a tombstone reaching the server before any upload;
  - D7 a tombstone landing while the recording device's upload is queued;
  - D8 a memo deleted on the recording device before it ever uploads.
- **Rec**, how a memo got its recorder:
  - recorded signed in;
  - recorded signed out, then signed in;
  - a push forging `recordedById`;
  - a push forging `recordedByName`;
  - a later rename by another member.
- **Ans**, the answer table of contracts/memo-audio-routes.md §4, every row × {upload step, fetch step}.
- **Pg**, pages: `/`, `/bands/{id}`, `/songs/{id}`, `/songs/{id}/capture`, `/songs/{id}/capture/{partId}`,
  `/songs/{id}/play`, `/songs/{id}/play/{partId}`.
- **W**, sizes: 375×667, 412×915, 1280×800.
- **Th**: dark, light.
- **Ptr**: touch (`mobile`), mouse (`desktop`).
- **Card**: base named, base unnamed, variant.
- **Net**: signed in online; signed in offline; signed out.
- **Act**: record, reload, play, seek, rename, download, delete.

| ID | Invariant (never …) | Probe (real interface) | Holds over (enumerate every member) |
|----|---------------------|------------------------|-------------------------------------|
| INV-001 | Never does a refused, oversized, mismatched, cut-off or duplicate-but-different upload leave any byte in `memo_audio`, and never is it answered without a readable `{code, message}`. | e2e `memo-routes.spec.ts`: each case's status and `code` as in the contract table, and `select bytes is not null, sha256, erased_at from memo_audio where memo_id = $1` equal before and after. H6 and H22 use a raw socket. Unit `body.test.ts`: `readCapped` returns `too_large` at `max + 1` and pulls no chunk after the crossing one. | H6, H7, H8, H9 × each of **FmtD**, H10, H11, H14, H20, H21 (the loser), H22. |
| INV-002 | Never does an account read or write audio outside its authority, and never can a non-member tell a memo in another band from one that does not exist. | e2e `memo-routes.spec.ts` H1–H5, H15: the status per cell below. For N, the status, the headers other than `date`, and the body bytes of `GET m` and `GET <random uuid>` are identical. | **Role** × **Route** × {memo in X, memo in Y, random UUID}: ∅ → 401/401; N → 404/404; V → 200 (after upload) or 404 `not_uploaded`/403; E, O → 200/201. |
| INV-003 | Never does a pull or a push response carry audio, and never does a row edit wait on an upload. | e2e `memo-sync-separate.spec.ts`: after a 2 MB memo uploads, `GET /api/sync/pull?since=0` is under 64 KiB, and each `rows.memos[i]` has exactly `memoRowSchema`'s keys. With `PUT /api/memos/**` held for 20 s by `page.route`, a column added on the same device reaches Postgres (`select … from events`) within 5 s. | {pull, push response} × {memo pending upload, memo uploaded, memo erased}. |
| INV-004 | Never does a deleted memo's audio survive on the server or on any device past one sync cycle of that device, and never does the server send it again. | e2e `memo-delete.spec.ts` (two contexts, A records, B fetched): after each path, `memo_audio` for the id has `bytes is null and erased_at is not null`, `GET` answers 410 `erased`, and `dumpDatabase` on A and B shows no `memoAudio`, `memoUploads`, `memoFetches` or `memoDrafts` entry for the id once each has synced. H16–H19 cover the server half. Unit `erase.test.ts` (fake-indexeddb): `applyRemoteRows` with a memo tombstone and with a part tombstone leaves no entry in the four tables, in the same transaction as the merge. | **Del** D1–D8. |
| INV-005 | Never do two replicas that have seen the same memo edits disagree, and never does a merge lose the server's recorder stamp. | Unit `memo-merge.test.ts` M1–M6 (contracts/sync-and-storage.md §2). The existing `merge.test.ts` passes unedited. `tables-agree.test.ts` passes. | All 24 orderings of {e1 label A, e2 label B, e3 delete, e4 server-stamped echo}; the 12 ordered pairs; each edit twice. |
| INV-006 | Never is a memo's recorder anything but the account that first pushed it, never does a device's claim reach Postgres, never does a structural field change after insert, and never does the recording device show anything but "You" before sync, or the stamp after. | e2e `memo-recorder.spec.ts`: Postgres `recorded_by_id`/`recorded_by_name` equal the pusher's. Forged pushes are sent through `request.post('/api/sync/push')` with E's cookies, and the DB still holds E. A second push from O changing `size`, `format`, `durationMs`, `partId` and `recordedAt` leaves all five unchanged. The meta line reads `You` on A before the push is allowed (the push is held by `page.route`), and E's name after, on A and on B. | **Rec** (5 members) × {meta line on A, meta line on B, Postgres}. |
| INV-007 | Never does recording end without either a saved memo or a notice that nothing was kept, and never does an ending leave the microphone open. | Unit `recorder.test.ts`: each ending's four assertions (contracts/recorder.md §3). e2e `memo-endings.spec.ts`: for each **EndFake** member, the card shows the ending's exact words or a new `memo`, and every stream captured by the observation wrapper has every track `readyState === "ended"` within 1 s. | **End** E1–E16 (unit); **EndFake** × {mobile, desktop} (e2e). |
| INV-008 | Never does a crash or close lose more than the last second recorded. | e2e `memo-recover.spec.ts`: record 4 s, CDP `Page.crash`, open a new page in the same context. Within 5 s the part shows a memo of at least 3 s with E13's words, or E14's words if the recorded format's prefix cannot play (the test reads the format and asserts which branch). Unit `recover.test.ts`: `recoverDrafts` over {playable prefix, unplayable, under 1 s, part tombstoned, part absent}. | {Chromium's chosen format} (e2e); the five draft cases (unit). |
| INV-009 | Never does a recording pass 3:00 or 8 MiB, never is a limit hit without saying which, and never does the countdown warn or announce at the wrong time. | Unit `recorder.test.ts` L1–L5 on the fake clock and fake chunk sizes. | L1 time; L2 size; L3 oversized final chunk; L4 warn at 15 001/15 000 ms left; L5 announcements at 60/30/10 s, and none otherwise. |
| INV-010 | Never do two sounds play at once among memos and the recorder, and never is anything from the play view still sounding when a memo starts. | Unit `sound.test.ts`: all ordered pairs of {memo A, memo B, recorder}. e2e `memo-one-sound.spec.ts`: memo A plays → play memo B → A's `memo-play` has `aria-pressed="false"`, and its `<audio>.paused`. Start recording → B is paused. FR-042: with `installPlayRecorder` (`e2e/play-helpers.ts`), start part playback with Notes on, use the back link, start a memo → every recorded `AudioContext` is `closed` and the analyser RMS is below −60 dBFS. | {A→B, B→A, A→rec, rec→A (refused while recording: A's play is disabled), B→rec, rec→B}; {play view → song page via back link, via browser back}. |
| INV-011 | Never is a play control shown for a memo this device cannot play, and never do a memo's words disagree with its state. | Unit `state.test.ts`: `memoState` over the full product of `hasAudio` × upload {none, queued, refused} × fetch {none, waiting, failed, full, erased} × `downloading` × `signedIn` × `online` × `canPlay` × `decodeFailed` (2 × 3 × 5 × 2⁵ = 960 inputs). It asserts that the player is shown iff the kind is in {`refused`, `local-*`, `uploading`, `ready`} and `hasAudio`, and that the words are the table's. e2e `memo-states.spec.ts`: `seedMemo` for each **St**. `data-state`, the `memo-state` text and the presence of `memo-play` match the table. `unplayable` is reached by seeding a WebM memo with the stated `canPlayType` exception for `audio/webm;codecs=opus`, and the text must read "This browser can't play WebM audio.". `failed-play` is reached by seeding bytes that do not decode. | **St** × {mobile, desktop}; 960 unit inputs. |
| INV-012 | Never does a part with no memos get taller or change shape, and never does a memo, the record control's panel or the memo list appear on capture or in the play view. | e2e `memo-card-height.spec.ts`: each card's bounding box equals `e2e/fixtures/memo-card-before.json`, recorded on `main` before any change (T001). `wide-fit*.spec.ts`, `notation-capture-height.spec.ts` and the capture height test pass unedited. On the capture and play routes, `getByTestId(/^(part-memos|memo|record-panel)$/)` has count 0, with a memo present. `check:untouched-memos` shows zero diff on `CaptureScreen.tsx` and `PlayView.tsx`. | **Card** × **W** × **Th**; **Pg** (capture × 2, play × 2). |
| INV-013 | Never is the microphone requested before the user chooses **Record memo**. | e2e `memo-mic-ask.spec.ts`: the observation wrapper's `getUserMedia` count is 0 after visiting every **Pg** member, and after opening and closing a part menu. In a context with no microphone permission, `navigator.permissions.query({name: "microphone"})` is still `prompt`. After **Record memo** the count is exactly 1. | **Pg** × {mobile, desktop}. |
| INV-014 | Never does a band's stored live audio pass 500 MiB. | e2e `memo-routes.spec.ts` H20 and H21 (parallel), with `seedServerAudio` setting the stored sizes directly. Afterwards `select sum(size) from memo_audio where band_id = $X and bytes is not null` ≤ 524 288 000. | {one upload over the line; two parallel uploads that each fit alone but not together; an upload landing exactly on the line (accepted)}. |
| INV-015 | Never is an upload sent before its row is accepted, never is a refusal retried without **Try again**, an account change or freed band room, never is a network failure left unretried, and never do fetches overlap or run oldest first. | Unit `transfer.test.ts` (fake `fetch`, fake-indexeddb, fake clock): for each **Ans** row, the entry's next state and whether a request is made over the next 3 passes (data-model §4.2–§4.3). The fetch order is newest `recordedAt` first, and at most one `GET` is in flight at once. e2e `memo-refusal.spec.ts`: V records. The memo shows "You have read-only access to that band.", no `PUT` is sent over 3 sync cycles (request log), **Try again** sends exactly one push of the row, and signing in as E sends the row and the `PUT`. | **Ans** (every row × {upload, fetch}); {row not yet accepted; accepted}; {Try again; `setMemoAccount` with another account; a same-band memo tombstone after `band_full`}. |
| INV-016 | Never is a part with memos deleted without asking, never is one without memos asked about, never does Cancel write anything, and never does a confirmed delete leave the part or any memo half-deleted. | e2e `memo-part-delete.spec.ts` with `dumpDatabase`. 0 memos: one tap, and the dump's diff is exactly the part row's `deletedAt` and one outbox entry, as recorded from `main` (T001). n memos: the sheet names `n`. Cancel → identical dump. Confirm → the part and all `n` memos are tombstoned, the outbox gains `n + 1`, and `memoAudio` lacks all `n`. After sync, Postgres agrees and `memo_audio` is ERASED for each. | memo counts {0, 1, 2, 4} × {Cancel, Confirm} (Cancel only where n > 0) × **Card**. |
| INV-017 | Never does a memo make a request while signed out or offline. | e2e `memo-offline.spec.ts`: a request log on the context. For each **Act**, signed out: no request to `/api/memos/**` or `/api/sync/**`. Offline (`context.setOffline(true)`): no request leaves at all (the log of `requestfailed` is empty for `/api/**`). After the record, reload and play steps, the clip plays (SC-002). | **Net** {signed out, signed in offline} × **Act**. |
| INV-018 | Never does a memo take longer than 10 s to be listed and playable on another online member's device, from **Stop** or from the recording device reconnecting. | e2e `memo-band.spec.ts`: contexts A and B in one band. A records 30 s. From Stop, B's `memo` with A's id has `data-state="ready"` and plays (its `memo-elapsed` advances) within 10 s. `memo-band-offline.spec.ts`: A offline records 5 s, `setOffline(false)`, and B is `ready` within 10 s of that. | {online at Stop; offline, then reconnected} × mobile. |
| INV-019 | Never is a memo row written that `memoRowSchema` would refuse, so a memo can never stall the outbox. | Unit `row-valid.test.ts`: every row produced by `saveMemo` from the recorder's keep endings (E1–E3, E7–E10, E13) on the fake ports, and by `renameMemo` with labels of length 0, 1, 120, 121 and 500 (cut to 120) and with surrounding spaces, passes `memoRowSchema.parse`. e2e: `memo-helpers.ts` installs a response listener in every memo spec, and fails the test on any `400` from `/api/sync/push`. | The keep endings × {Chromium's chosen format, each **FmtA** base type on the fake ports}; the label lengths. |
| INV-020 | Never does **Record memo** look usable where it cannot work, and never does it give the wrong reason. | e2e `memo-unavailable.spec.ts`. On the `insecure` project at `http://lan.test:3100`: the item has `aria-disabled="true"` and "(unavailable)", choosing it shows the `insecure` words exactly, and a memo synced in (seeded) still plays. On `desktop`, with `window.MediaRecorder` deleted by an init script: the `no-recorder` words. With one part recording: every other part's item reads `busy`. Unit `capability.test.ts` (jsdom) covers every case, including "insecure and no `mediaDevices`" → `insecure`. | {`insecure`, `no-microphone` (unit only), `no-recorder`, `busy`, `ok`} × **Ptr** (e2e where reachable). |
| INV-021 | Never does a download carry the wrong bytes, the wrong extension or an unsafe name. | Unit `words.test.ts`: `downloadName` over **FmtA** × {label, no label, label of only symbols, emoji, empty song title, a 200-character title}, matching `^[a-z0-9-]{1,40}(-[a-z0-9-]{1,40}){2}\.(m4a|webm|ogg)$`. e2e `memo-download.spec.ts`: `download.suggestedFilename()` matches, and the saved file's bytes equal the `memoAudio` entry's. | **FmtA** × the six name cases (unit); {menu Download, the unplayable state's Download, Download the clip (held)} (e2e). |
| INV-022 | Never do the limits, formats or refusal words have a second source. | `npm run check:memo-fence`: the literals `180000`, `180_000`, `8388608`, `8 * 1024 * 1024`, `524288000` and `500 * 1024 * 1024` appear in `src/` only in `src/lib/memos/limits.ts`. The format strings `audio/webm`, `audio/ogg` and `audio/mp4` appear only in `src/lib/memos/formats.ts` and tests. `bytes = null` / `bytes: null` appears exactly once (in `eraseMemoAudio`). Every refusal `message` in the route comes from `REFUSALS` (unit: the route module's answers are looked up by code, and `refusals.test.ts` asserts each contract row's words). | The three limit constants; the three base types; the erase statement; the 15 non-success answer codes of the contract (`signed_out`, `not_found`, `not_uploaded`, `erased`, `read_only`, `format`, `format_mismatch`, `too_large`, `size_mismatch`, `incomplete`, `content_mismatch`, `deleted`, `part_deleted`, `different_file`, `band_full`). |
| INV-023 | Never does the memo list show memos out of order, hide the newest, or forget the user's choice to show them all. | e2e `memo-list.spec.ts` with seeded memos: the order is by `recordedAt` ascending. With more than 3, exactly the newest 3 are drawn and `memo-more` reads `Show {n−3} earlier memo(s)`. Expanding, then reloading, keeps it expanded. Another part's list is unaffected. Titles are `Memo 1…n` among live memos. | memo counts {1, 3, 4, 5} × {collapsed, expanded, after reload} × {phone 375, wide 1280}. |
| INV-024 | Never is a new control under spec 007's floors, unreadable in a theme, or the cause of sideways scroll. | e2e `memo-floors.spec.ts`: every test id in contracts/memo-ui.md §9 that is present is ≥ 44 × 44 on touch and meets the fine floor with a mouse. Text contrast is ≥ 4.5:1 (using the method of `usability-contrast.spec.ts`). `scrollWidth ≤ innerWidth`. `usability-floors.spec.ts` passes unedited (it walks the part menu, now with Record memo). | Each test id × **W** × **Ptr** × **Th** × {idle with memos, recording, held, explanation open}. |
| INV-025 | Never is a page that lists what is stored left without voice recordings, and never is an earlier requirement left saying something untrue or a decision left unrecorded. | `npm run check:memo-amendments` checks: spec 008 FR-014 carries `Amended by spec 012`; DECISIONS has "012 — decisions" naming the spec's 14 decision rows (5 in "Where the brief and the code differ", 9 in "Decisions this spec makes") and this plan's 6 deviations, plus "012 — re-pinned tests" and "012 — owed on real phones". e2e `memo-privacy.spec.ts` checks that `/privacy` contains each FR-090 fact (voice recordings; on the device and the operator's database; every member can play and download; deleting erases the audio; the small record stays; signed-out recordings never leave the device; the microphone only while recording), that its date is not `2 November 2026`, that `/sign-up` mentions voice recordings, and that `/terms` does. README: `grep -n "https"` in the self-hosting section names `localhost` and a reverse proxy. | The FR-090 facts (7); `/privacy`, `/sign-up`, `/terms`, README; spec 008 FR-014; the decisions and deviations. |
| INV-026 | Never does this entry change capture, playback, the play view, the export, the parser, the service worker or the deploy files, and never is an existing test edited outside the re-pin table. | `npm run check:untouched-memos` (*Scope fence*). | The paths in *Scope fence*. |
| INV-027 | Never is a claim that needs a person or a real phone marked done. | `tasks.md` carries quickstart §5 (the browser check) and §6 (the SC-010 phone items) as human tasks, marked `🛑 BLOCKED` until done. | §5's scenarios × **W** × **Th**; §6's six items (P1–P6). |
| INV-028 | Never does a full device lose a clip, and never does a full device keep fetching. | e2e `memo-full.spec.ts`. Save: CDP `Storage.overrideQuotaForOrigin` set to the current usage + 64 KiB, then record 4 s, Stop → E12's words with `record-retry` and `record-download-held`. **Download the clip** yields non-empty bytes. Raise the quota, **Try again** → a memo appears with the clip's length. Fetch: B with a tight quota and two memos to fetch → the newest is `full` ("Out of room on this device."), and the request log shows no `GET` for the older one until **Try again**. | {save, fetch} × mobile. |
| INV-029 | Never is persistent storage requested on load or more than once per device, and never is the "may clear memos" notice shown twice. | e2e `memo-persist.spec.ts` with the observation wrapper on `navigator.storage.persist`: 0 calls after visiting **Pg**; 1 after the first Stop; still 1 after a second recording and after a fetch. When `persisted()` is false, the notice appears once on the first memo's part, and not after Dismiss and a reload, nor on a second part. | {first save, second save, first fetch on another device} × {persisted false (headless Chromium's answer for a site not installed)} (e2e). Unit `storage.test.ts`: `ensurePersisted` with a fake `navigator.storage` over {persisted already true, `persist()` → true, `persist()` → false, `persist()` rejects, no `navigator.storage`}: at most one `persist()` call per device, and a notice only when the end state is not persisted. |

### Requirements to invariants

| Requirements | Invariants |
|---|---|
| FR-001, FR-002, FR-003 | INV-005, INV-016, INV-019 |
| FR-004 | INV-005, INV-006 |
| FR-005 | INV-005 (`tables-agree`), `npm run typecheck` |
| FR-006, FR-007 | INV-006 |
| FR-008, FR-009 | INV-003, INV-026 |
| FR-010, FR-011 | INV-013, INV-020 |
| FR-012 | INV-019, INV-011 (unit `formats.test.ts`) |
| FR-013, FR-014 | INV-009, INV-007 |
| FR-015, FR-016, FR-017 | INV-007, INV-008 |
| FR-018 | INV-020 |
| FR-019 | INV-016's dump probe, reused: recording writes only memo tables and the outbox |
| FR-020 to FR-026 | INV-007, INV-008, INV-028 |
| FR-027, FR-028 | INV-020 |
| FR-029 | INV-025 |
| FR-030, FR-030a | INV-002, INV-004 |
| FR-031, FR-032, FR-033 | INV-001 |
| FR-034 | INV-014 |
| FR-035 | INV-001, INV-015, INV-022 |
| FR-036, FR-037 | INV-015 |
| FR-038 | INV-018 |
| FR-039 | INV-011 |
| FR-040, FR-041, FR-042 | INV-010, INV-012 |
| FR-043, FR-044 | INV-012, INV-023 |
| FR-045, FR-046 | INV-023, INV-024, INV-011 |
| FR-047 | INV-024 |
| FR-048 | INV-011 |
| FR-049 | INV-021 |
| FR-060, FR-061, FR-062, FR-063, FR-064 | INV-004, INV-025 |
| FR-065 | INV-016 |
| FR-070, FR-071 | INV-029, INV-028 |
| FR-080, FR-081 | INV-017, INV-006 |
| FR-090, FR-091 | INV-025 |
| FR-100 | INV-005 |
| FR-101 | INV-001, INV-002, INV-004, INV-014 |
| FR-102 | INV-018, INV-007, INV-017 |
| FR-103, FR-104 | INV-027 |
| FR-105 | INV-025 |
| SC-001 | INV-013 (two taps), and `memo-record.spec.ts`: from Stop, `memo-play` is enabled within 1 s |
| SC-002 | INV-017 |
| SC-003, SC-004 | INV-018 |
| SC-005 | INV-007, INV-028 |
| SC-006 | INV-001 |
| SC-007 | INV-004 |
| SC-008 | INV-005 |
| SC-009 | INV-012 |
| SC-010 | INV-027 |
| Edge: memo before its part | `applyRemoteRows` keeps it (no change); INV-011's `waiting` |
| Edge: audio before the row / row not yet pushed | INV-015 (upload waits for `serverSeq > 0`) |
| Edge: the recording device never returns | INV-011 (`waiting`, with no player) |
| Edge: deleted while uploading; deleted before upload | INV-004 D7, D8 |
| Edge: two renames offline | INV-005 |
| Edge: undelete with no audio | INV-001 H18, INV-011 `deleted` |
| Edge: hostile client | INV-001, INV-002, INV-006 |
| Edge: a second recording; a memo playing when recording starts | INV-020 `busy`, INV-010 |
| Edge: storage not persisted | INV-029 |
| Edge: downloads fill the device | INV-028 |
| Edge: printing | `memo-print.spec.ts`: `page.emulateMedia({ media: "print" })` → `part-memos` is not visible |
| Edge: plain-text export | INV-026 (`src/lib/export/` zero diff); the export spec passes unedited |

### Agreement is structural

| Two things that must agree | How |
|---|---|
| The tables in `model.ts`, `domain.ts`, `protocol.ts`, the server's `TABLES`, and Dexie | `tables-agree.test.ts` compares the lists. `assert-model.ts` compares the shapes. |
| The server's merge and the device's | Both call `mergeRow` (existing). |
| The recorder on the server and on each device | Only the server writes it. Devices null-fill via `SERVER_STAMPED_FIELDS`. |
| The limits used by the recorder, the wire schema and the route | All three import `src/lib/memos/limits.ts` (INV-022). |
| The formats recorded, accepted, sniffed, named in words and given an extension | One `MEMO_FORMATS` table. `parseFormat` is the only validator, and both `memoRowSchema` and the route call it. |
| The refusal the server sends and the words the memo shows | The route builds answers from `REFUSALS`. The client stores and shows `message` verbatim. |
| The read-only words for a refused push and a refused upload | One constant, `READ_ONLY_MESSAGE` in `src/lib/sync/protocol.ts`, holding today's exact words. `applyPush` and `REFUSALS.read_only` both use it. |
| Erasing audio on the server for a memo tombstone, a part tombstone, and a memo on a deleted part | All three call `eraseMemoAudio`, the only `bytes = null` (INV-022). |
| Erasing on a device for a local delete, a pulled tombstone, a part delete, and a `410` | All call `eraseLocalMemoAudio`. |
| "Erased" on the server and "deleted" on the device | `GET` 410 `erased` → `memoFetches.status = "erased"` → `memoState` row 1. |
| A memo's words, its action and whether it has a player | All read one `memoState()` result. |
| The part-delete sheet's count and the memos tombstoned | Both call `liveMemos(partId)`. `deletePart` re-reads it inside its transaction. A memo pulled in between is deleted too, which is the right outcome for a deleted part, and the sheet's words say "its memos". |
| The ending, the save and the notice | One `finish(ending)` reads one row of `ENDINGS`, which holds the save rule and the words. |
| One sound at a time | The recorder and every player call `sound.claim`. |
| Arrival on another device and the upload's success | The route calls `notifyChanged`, and the runner calls `workMemos` after every `syncNow`. |
| The list expansion and what is drawn | `prefs.ts`, through `useSyncExternalStore`, as `panels.ts` does. |

### Blast-radius decisions

| Decision | Choice | Why | Invariants it sets |
|----------|--------|-----|--------------------|
| **Deletion, server**: when audio bytes are destroyed. | In the push transaction that stores a memo tombstone, or a part tombstone (for all its memos), or a memo whose part is deleted. Bytes are set to `NULL`, and the `memo_audio` row stays as ERASED for ever. Nothing else erases, and no other table's tombstones are purged. | FR-061; spec Decisions; research R1, R18. | INV-004, INV-001 (H17–H19), INV-022 |
| **Deletion, devices**: when local audio is destroyed. | When a memo or part tombstone is applied (local or pulled), and on a `410` to an upload. Through `eraseLocalMemoAudio` only. | FR-062; R18. | INV-004 |
| **Deletion, a part with memos**. | Ask first, naming the count. Confirm tombstones the part and every live memo in one `mutateBatch`. Zero memos: one tap, writing exactly today's write. | FR-065; spec 008 FR-014 amended. | INV-016 |
| **Deletion, undo**. | None for memos. A live row with ERASED audio reads "deleted". `restoreRow` is not called anywhere for memos. | FR-063. | INV-011, INV-001 H18 |
| **Deletion, refused upload of a deleted memo**. | The recording device drops its queue entry and local audio on `410 deleted/erased/part_deleted`. | Spec edge case. | INV-004 D7, INV-015 |
| **Authority, upload**. | Owner or editor of the memo's band (`canEdit`), checked before the body is read and again under the lock (via the memo row). | FR-030. | INV-002 |
| **Authority, download**. | Any member, including viewers. A non-member gets the same answer as a missing memo. | FR-030. | INV-002 |
| **Authority, the recorder's identity**. | The server only, at insert, from the session. A device's values are discarded. | FR-006; R4. | INV-006 |
| **Authority, the server's role**. | It now stamps one structural field pair at insert and erases audio. It still never writes a mergeable field or mints a clock. | R4, R18. | INV-005, INV-006 |
| **Device authority, the microphone**. | Requested only inside the tap on Record memo. Released at every ending. Never on load. | FR-011, FR-026. | INV-013, INV-007 |
| **Device authority, storage**. | `navigator.storage.persist()` once, on the first save or fetch. A refusal blocks nothing. | FR-070. | INV-029 |
| **Data written: the schema**. | Two new tables via one generated migration. No existing column, row or index changes. Dexie version 2 adds stores only. | FR-005, FR-009. | INV-026, INV-005 |
| **Data written: rows from earlier entries**. | Untouched. No backfill. | — | INV-026 |
| **Publishing**: what leaves the device. | A signed-in device's memo rows (with the other rows) and memo audio, to the band's own server only. Signed out or offline: nothing. | FR-080; privacy. | INV-017, INV-003 |
| **Resource limits** (the operator's disk). | 8 MiB per clip, and 500 MiB of live audio per band, enforced on the server under the lock. Constants, not settings. | Spec Decisions. | INV-001, INV-014, INV-022 |
| **Network and cache authority**. | `public/sw.js` unchanged. `/api/*` is already never cached, and downloads add `no-store`. | `sw.js` header. | INV-026 |
| **Code authority**: which shared modules change. | `model.ts`, `domain.ts`, `assert-model.ts`, `protocol.ts`, `merge.ts` (one post-loop step), `server/sync.ts` (stamp, part check, erase hooks, exports), `local/db.ts` (v2), `local/mutate.ts` (`mutateBatch` tables, `requeueRow`), `sync/client.ts` (erase hooks, rejection recording), `sync/runner.ts` (`workMemos` after `syncNow`), `SyncProvider.tsx`, `layout.tsx`, `SongView.tsx`, `OverflowMenu.tsx` (`unavailable`), `privacy`, `terms`, `AuthForm.tsx`, README. Nothing else outside the new files. | research R4–R18. | INV-026 |
| **Earlier spec text**. | Spec 008 FR-014's sentence "No confirmation or undo exists today, and this entry neither adds nor removes one." is amended in place with `*(Amended by spec 012: deleting a part that has memos now asks first; see spec 012 FR-065.)*`. Nothing else. | FR-065. | INV-025 |
| **Existing tests**. | Only the files in *Existing tests this changes on purpose*, re-pinned to an equal or stronger check, never deleted, and named in DECISIONS. A test outside the table that fails is a product defect. If implement finds another test that must change, it stops and adds the file to the table, with its reason, **before** editing it. | — | INV-026, INV-025 |
| **Money** | None involved. | | |

### Scope fence

`scripts/untouched-by-memos.sh`, run as `npm run check:untouched-memos`, prints `zero diff` for every path below
against `main`, tracked or untracked, and fails on any other result:

- **Capture and play**: `src/components/capture/`, `src/app/songs/[songId]/capture/`, `src/components/app/PlayView.tsx`,
  `src/app/songs/[songId]/play/`, `src/lib/playback/`, `src/lib/rhythm/`, `src/components/rhythm/`, `src/lib/capture/`.
- **Notation, reading, export, parser**: `src/lib/tab/`, `src/lib/export/`, `src/lib/reading/`,
  `src/components/reading/`, `src/components/tab/`, `src/lib/arrangement/`.
- **Offline and deploy**: `public/sw.js`, `src/components/app/ServiceWorker.tsx`, `docker-compose.yml`,
  `docker-compose.build.yml`, `Dockerfile`, `.env.docker.example`, `next.config.ts`.
- **Sync routes**: `src/app/api/sync/` (all three routes are unchanged; the stream's frame shape stays the same).
- **Existing tests**: `src/lib/sync/__tests__/merge.test.ts`, and every file in `e2e/` that exists on `main` except
  `e2e/polish-part-card-menu.spec.ts`. For that file, the script checks that the only changed line is the one
  assigning `want`.

`scripts/check-memo-fence.sh` (`npm run check:memo-fence`) runs INV-022's greps.

### Existing tests this changes on purpose

Each file is re-pinned, never deleted. Each is named in `docs/DECISIONS.md` under "012 — re-pinned tests".

| File | What it pins today | Re-pinned to |
|---|---|---|
| `e2e/polish-part-card-menu.spec.ts` | `const want = card.variantOf ? 3 : 4;`: a variant's menu has 3 items, a base part's 4 | `card.variantOf ? 4 : 5`. FR-010 adds **Record memo** to every card. The walk is unchanged and covers one more item. |
| `e2e/reading-helpers.ts` | `dumpDatabase` listed every object store; `seedSong` used `crypto.randomUUID` | `dumpDatabase` skips empty `memo*` stores (an app without memos never wrote them); `seedSong` falls back where `crypto.randomUUID` is absent (the plain-http `insecure` project). Helpers only: no assertion in any spec changes.

**Must pass unedited**:
- **Sync.** `sync.spec.ts`, `sync-no-lost-rows.spec.ts`, `reading-sync.spec.ts`, `grouping-sync.spec.ts`,
  `import-sync*.spec.ts`, `grouping-refusal.spec.ts` and `merge.test.ts`.
- **Cards and menus.** `polish-part-card.spec.ts` (it walks the menu by Home and End), `play-part.spec.ts` (Play
  stays first), `usability-floors.spec.ts`, `wide-controls.spec.ts`, and every `wide-*` spec (the fit song has no
  memos).
- **Capture height.** `notation-capture-height.spec.ts` and every capture spec.
- **Unit.** Every unit test in `src/`.

If one of these fails, the product is wrong, not the test.

## Project Structure

### Documentation (this feature)

```text
specs/012-voice-memos/
├── plan.md              # This file
├── research.md          # Phase 0: R1–R21
├── data-model.md        # Phase 1: constants, row, server table, device tables, state, recorder, notices
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   ├── memo-audio-routes.md   # GET/PUT, checks in order, client classification, H1–H22
│   ├── sync-and-storage.md    # every declaring module, merge M1–M6, push and apply hooks, write path
│   ├── recorder.md            # ports, API, endings E1–E16, limits L1–L5, formats, sound, capability
│   └── memo-ui.md             # menu item, memo area, panel, memo, explanation, part delete, test ids
├── checklists/          # from /speckit-specify
└── tasks.md             # Phase 2 (/speckit-tasks, not created here)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/memos/[memoId]/audio/route.ts   # NEW: GET, PUT
│   ├── layout.tsx                          # mounts <MemoBoot />
│   ├── privacy/page.tsx                    # FR-090
│   └── terms/page.tsx                      # FR-091
├── db/schema/
│   ├── domain.ts                # memos, memo_audio, bytea, SYNC_TABLE_ORDER
│   └── assert-model.ts          # _Memos, _MemoRecorder
├── lib/
│   ├── model.ts                 # MemoRow, SYNCED_TABLES, MERGEABLE_FIELDS, SERVER_STAMPED_FIELDS
│   ├── memos/                   # NEW, React-free
│   │   ├── limits.ts            # every constant (data-model §1)
│   │   ├── formats.ts           # MEMO_FORMATS, chooseFormat, normaliseFormat, parseFormat, sniff
│   │   ├── body.ts              # readCapped
│   │   ├── refusals.ts          # REFUSALS: code → status, message
│   │   ├── recorder.ts          # createRecorder, ENDINGS
│   │   ├── ports.ts             # the real browser ports
│   │   ├── capability.ts        # recordAvailability
│   │   ├── sound.ts             # claim, release, current
│   │   ├── state.ts             # memoState
│   │   ├── transfer.ts          # workMemos, clearWaiting, downloading store
│   │   ├── recover.ts           # recoverDrafts, probePlayable
│   │   ├── storage.ts           # ensurePersisted
│   │   ├── prefs.ts             # stablature.memos (panels.ts-shaped)
│   │   ├── words.ts             # NOTICE_WORDS, STATE_WORDS, downloadName, formatClock
│   │   └── __tests__/           # formats, body, refusals, recorder, capability, sound, state, transfer,
│   │                            # recover, words, row-valid, erase, storage
│   ├── local/
│   │   ├── db.ts                # version(2)
│   │   ├── mutate.ts            # mutateBatch tables; requeueRow
│   │   ├── memos.ts             # NEW: saveMemo, renameMemo, deleteMemo, deletePart, liveMemos,
│   │   │                        #      retryMemo, setMemoAccount, eraseLocalMemoAudio
│   │   └── hooks.ts             # useMemos(partId), useMemoLocal(memoId)
│   ├── server/
│   │   ├── sync.ts              # stamp, part check, erase hooks; export PUSH_LOCK, TABLES; uses READ_ONLY_MESSAGE
│   │   └── memos.ts             # NEW: readAudio, storeAudio (under lock), eraseMemoAudio, bandTotal
│   └── sync/
│       ├── protocol.ts          # memoRowSchema; READ_ONLY_MESSAGE (moved here, same words)
│       ├── merge.ts             # SERVER_STAMPED_FIELDS step
│       ├── client.ts            # applyRemoteRows erase hooks; pushOnce records memo rejections
│       ├── runner.ts            # workMemos after syncNow; clearWaiting on "changed"
│       └── __tests__/
│           ├── memo-merge.test.ts     # NEW: M1–M6
│           └── tables-agree.test.ts   # NEW
├── components/
│   ├── memos/                   # NEW
│   │   ├── PartMemos.tsx  MemoItem.tsx  RecordPanel.tsx  MemoBoot.tsx
│   │   └── useRecorder.ts  useMemoPlayer.ts
│   ├── app/
│   │   ├── SongView.tsx         # Record memo item; <PartMemos>; deletePart with confirm
│   │   ├── SyncProvider.tsx     # setMemoAccount(userId)
│   │   └── AuthForm.tsx         # FR-091 sentence
│   └── ui/OverflowMenu.tsx      # optional `unavailable`

drizzle/0006_<generated>.sql, drizzle/meta/*   # npm run db:generate

scripts/
├── untouched-by-memos.sh        # NEW: INV-026
├── check-memo-fence.sh          # NEW: INV-022
├── check-memo-amendments.sh     # NEW: INV-025
└── make-memo-tone.mjs           # NEW: writes e2e/fixtures/memo-tone.wav

e2e/
├── memo-helpers.ts              # NEW: fake-mic test.use, seedMemo, seedServerAudio, observation wrappers,
│                                #      the push-400 tripwire, twoMembers()
├── fixtures/memo-tone.wav       # NEW
├── fixtures/memo-card-before.json   # NEW, recorded on main (T001)
├── memo-routes.spec.ts          # INV-001, INV-002, INV-014
├── memo-sync-separate.spec.ts   # INV-003
├── memo-delete.spec.ts          # INV-004
├── memo-recorder.spec.ts        # INV-006
├── memo-record.spec.ts          # US1, SC-001
├── memo-endings.spec.ts         # INV-007
├── memo-recover.spec.ts         # INV-008
├── memo-one-sound.spec.ts       # INV-010
├── memo-states.spec.ts          # INV-011
├── memo-card-height.spec.ts     # INV-012
├── memo-mic-ask.spec.ts         # INV-013
├── memo-refusal.spec.ts         # INV-015
├── memo-part-delete.spec.ts     # INV-016
├── memo-offline.spec.ts         # INV-017
├── memo-band.spec.ts            # INV-018 (online); memo-band-offline.spec.ts (reconnect)
├── memo-unavailable.spec.ts     # INV-020 (+ the `insecure` project)
├── memo-download.spec.ts        # INV-021
├── memo-list.spec.ts            # INV-023
├── memo-floors.spec.ts          # INV-024
├── memo-full.spec.ts            # INV-028
├── memo-persist.spec.ts         # INV-029
├── memo-privacy.spec.ts         # INV-025 (pages)
└── memo-print.spec.ts           # edge: printing

playwright.config.ts             # + the `insecure` project; the memo specs' data-only members added to PHONE_ONLY
docs/DECISIONS.md                # "012 — suite before", "012 — decisions", "012 — re-pinned tests",
                                 # "012 — owed on real phones", browser check; slow/loop idea (Out of Scope)
specs/008-usability-polish/spec.md   # FR-014 amended in place
README.md                        # FR-029 note
package.json                     # check:untouched-memos, check:memo-fence, check:memo-amendments
```

**Structure Decision**: a single Next.js package, as before. The new domain code goes in one new React-free directory,
`src/lib/memos/`. Writes go in `src/lib/local/memos.ts`, beside the other write modules, and server code in
`src/lib/server/memos.ts`. There is one new route file. The shared sync modules are extended in place, not copied.
`playwright.config.ts` gains one project for the insecure origin. Existing projects only gain list entries: the
data-only memo specs (`memo-routes`, `memo-recorder`, `memo-sync-separate`, `memo-delete`, `memo-refusal`,
`memo-band*`, `memo-recover`, `memo-full`, `memo-persist`, `memo-privacy`) join `PHONE_ONLY`.

## Complexity Tracking

No gate is violated. Nothing to justify.
