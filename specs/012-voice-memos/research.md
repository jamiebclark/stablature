# Research: Voice memos on a part

**Feature**: `012-voice-memos` | **Date**: 2026-11-16 | **Plan**: [plan.md](./plan.md)

Each item gives the decision, why it was chosen, and what else was considered. Every item that the Technical Context
could have left open is resolved here.

---

## R1. Where the audio lives on the server

**Decision**: A new Postgres table, `memo_audio`, outside the synced tables and outside pull. One row per memo id:
`memo_id` (primary key, foreign key to `memos.id`, cascade), `band_id`, `content_type`, `size`, `sha256`, `bytes`
(`bytea`, nullable), `uploaded_at`, `erased_at`. Erasing sets `bytes = NULL` and `erased_at = now()`, and keeps the
row. It is never deleted by the app.

**Rationale**:
- The spec fixes `bytea` in its own table (Decisions table). Large objects are not deleted with their row, which would
  defeat FR-061.
- Keeping the row after an erase is what lets the download route answer "erased because the memo was deleted" for ever
  (FR-030a), even if the memo row later comes back live. "Never uploaded" (no row) and "erased" (row with
  `erased_at`) are then two states the database can tell apart.
- A tombstone that reaches the server **before** any upload still writes an erased row (`bytes` NULL, `erased_at`
  set). A later upload for that memo then finds the erased row and is refused (FR-033).
- `size` is a column, so the per-band total is `sum(size) where bytes is not null`, with no read of the bytes.
- Postgres TOAST stores `bytea` out of line and compressed where it can. Opus and AAC do not compress, so there is no
  gain and no harm.
- `docker-compose.yml`, `.env` and the Postgres image are unchanged (FR-009).

**Alternatives considered**:
- A `bytes` column on `memos`: pull does `select()` on every synced table, so the audio would ride the row sync. FR-008
  forbids that.
- Files on a volume: this needs a new volume in `docker-compose.yml` and a second thing to back up. The spec rules it
  out.
- Deleting the `memo_audio` row on erase: then "erased" and "never uploaded" look the same, and FR-030a fails.

## R2. The two routes, and reading a body the client may lie about

**Decision**: One route file, `src/app/api/memos/[memoId]/audio/route.ts`, with two handlers. `PUT` uploads and `GET`
downloads. `params` is a `Promise`, awaited, per `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`.
The upload reads `request.body` as a stream, through `readCapped(stream, MAX_BYTES)` in `src/lib/memos/body.ts`. That
function counts bytes as they arrive and cancels the reader as soon as the count passes 8 MiB. It never calls
`request.arrayBuffer()`. A `Content-Length` over the cap is refused before any byte is read. A smaller or missing
`Content-Length` buys nothing, because the count is of bytes read. The full order of checks and every answer are in
[contracts/memo-audio-routes.md](./contracts/memo-audio-routes.md).

**Rationale**:
- The app has no `proxy.ts` (or `middleware.ts`). Next only buffers request bodies when a proxy runs
  (`proxyClientMaxBodySize`, default 10 MB, in `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md`).
  So a route handler's `request.body` is the raw stream, and the cap is ours to enforce. `next.config.ts` is
  unchanged. If a proxy is ever added, its default 10 MB buffer is above our 8 MiB cap, so the route's check still
  decides. This is recorded in DECISIONS as a trap.
- Auth and visibility are checked **before** the body is read. A non-member's upload costs a session lookup and one
  `select`, not 8 MB of memory.
- The bytes are checked against the declared container's magic numbers before anything is stored (R7).
- Download sends `content-type` (the stored one), `x-content-type-options: nosniff`, `cache-control: private, no-store`
  and `content-length`. `public/sw.js` already never caches `/api/*` (its header), so it has zero diff.

**Alternatives considered**:
- `multipart/form-data`: this needs a parser and a boundary scan, and it hides the declared type inside the body.
  A raw body with a `content-type` header is simpler and is what `fetch(url, { body: arrayBuffer })` sends.
- Separate `/upload` and `/download` paths: one resource with `PUT` and `GET` is the natural shape, and it is still the
  "two routes" FR-030 asks for (two handlers, each with its own authority).

## R3. Races between an upload, a tombstone and the band total

**Decision**: The upload's write transaction takes the same advisory lock as push (`PUSH_LOCK` in
`src/lib/server/sync.ts`, exported for this). Inside the lock it re-reads the memo row and its `memo_audio` row,
re-checks deletion, erasure, the part's deletion, the existing file and the band total, and then inserts. The body is
read into memory **before** the lock is taken, so the lock is held only for the checks and one insert of at most 8 MiB.
Push's erase on tombstone (R18) runs inside push's own transaction, under the same lock.

**Rationale**:
- With one lock, an upload and a push that tombstones the same memo can never interleave. Either the upload commits
  first and push erases it, or push commits first and the upload sees the tombstone and is refused. No audio of a
  deleted memo survives (INV-004).
- Two uploads to one band near the 500 MB total are serialised, so both cannot pass the check (INV-014).
- An upload is rare beside pushes, and the lock is held only for milliseconds. The cost to sync latency is a few
  milliseconds at most.

**Alternatives considered**:
- `SELECT … FOR SHARE` on the memo row, plus a per-band advisory lock for the total: this is two mechanisms where one
  covers both. It is also harder to state as an invariant.
- `SERIALIZABLE` isolation with retry: this works, but it adds a retry loop to a route that holds 8 MiB in memory.

## R4. "Who recorded it": the server's stamp and the merge

**Decision**:
- `memos` carries `recordedById` (text, nullable) and `recordedByName` (text, nullable). Both are **structural**. They
  are not in `MERGEABLE_FIELDS` and never get a clock.
- A device always writes both as `null` (FR-007). The UI shows "You" while they are null.
- On the **insert** of a memo row, `upsert` in `src/lib/server/sync.ts` overrides both with the pusher's id and the
  account's `user.name`. The name is read once per push that contains a memo. Whatever the device sent is dropped
  (FR-006). On an **update**, structural fields are never written, as today.
- The client's `mergeRow` gains one rule, driven by a new registry `SERVER_STAMPED_FIELDS = { memos: ["recordedById",
  "recordedByName"] }` in `src/lib/model.ts`: for these fields, the merged value is `local ?? remote`.

**Rationale**:
- Only the server ever writes a non-null value, and it writes it once, at insert, from one account. Every replica
  therefore sees at most one non-null value for each field. "Take the non-null one" over a set that holds one non-null
  value at most is commutative, associative and idempotent. So the 24-orderings property still holds, and the
  extended test proves it with the stamp delivered in different orderings (INV-005).
- The recording device learns the stamp from the push response's merged rows (`applyRemoteRows`), with no extra
  round trip.
- A forged stamp cannot spread. The server ignores it at insert and never updates structural fields, and rows reach
  devices only from the server.
- Signed-out memos are stamped by whoever first signs in on that device and pushes them (FR-081). That is the person
  holding the phone.

**Alternatives considered**:
- Making the recorder a mergeable field with a server-minted HLC: this makes the server a writer with its own clock, a
  new idea in this codebase. It would also let a later client write overwrite it.
- Having the device stamp itself from `useSession()`: a device could then claim to be anyone, which FR-006 forbids.
  A signed-out device has no account to stamp.
- Pulled rows replacing **all** empty structural fields: this is too broad. A future table's nullable parent key
  would start to merge silently. The registry names exactly the two fields.

## R5. How another device learns that the audio has arrived (FR-038)

**Decision**: There is no new wire field and no third route.
- After a successful upload commits, the route calls the existing `notifyChanged(cursor)`. The cursor is the memo
  row's `serverSeq`, since the event carries no row data.
- Every connected client's runner already reacts to `changed` by running `syncNow()`. The runner then runs one **memo
  pass** (`workMemos()` in `src/lib/memos/transfer.ts`) after each `syncNow()`.
- The memo pass uploads what is queued, then fetches. The fetch step asks for every live memo with no local audio,
  newest first, one at a time. That includes memos whose last answer was "not uploaded yet".
- The 60-second poll and the `online` and `visible` triggers already run `syncNow()`, so they run the memo pass too.

**Rationale**:
- FR-004 allows only `label` and `deletedAt` to change after creation. An "uploaded" flag on the row would be a third
  mutable field, and one that only the server may set. This design keeps FR-004 exactly.
- On the arrival path (upload → NOTIFY → SSE → `syncNow` → memo pass → `GET` 200 → Dexie → `useLiveQuery`), each step
  takes well under a second on a LAN. That fits the 10 s budget (SC-003, SC-004).
- Re-asking about waiting memos costs one small `GET` (a JSON 404) per waiting memo per cycle. Waiting memos exist only
  while a recorder is offline, so the set is small. It is bounded anyway: a memo answered "not uploaded yet" is asked
  again at most once every 5 s (`WAITING_RECHECK_MS`). A `changed` event clears that wait, so a fresh upload is never
  delayed by it.

**Alternatives considered**:
- A batch status endpoint: this would be a third route, and the spec names two.
- Putting memo ids in the SSE frame: the stream's header says frames never carry row data, so that nothing there needs
  authorising per message. That stays true.

## R6. Device storage: what goes in IndexedDB, and in what shape

**Decision**: Dexie version 2 in `src/lib/local/db.ts` adds one synced table and five local tables:

| Table | Key | Holds |
|---|---|---|
| `memos` | `id`, indexes `partId`, `bandId`, `serverSeq` | the synced row |
| `memoAudio` | `memoId` | `{ memoId, bytes: ArrayBuffer, format, size }` |
| `memoUploads` | `memoId` | the upload queue entry (FR-036) |
| `memoFetches` | `memoId` | this device's fetch state for a memo it has no audio for |
| `memoDrafts` | `id` | a recording in progress: part, band, song, format, start time |
| `memoDraftChunks` | `[draftId+index]`, index `draftId` | one MediaRecorder chunk per second |

Notices live in `meta` under `memoNotices`, as a list of `{ partId, kind, words, at }`. Field-level shapes are in
[data-model.md](./data-model.md).

**Rationale**:
- The audio is stored as an `ArrayBuffer`, not a `Blob`. Every engine clones it into IndexedDB, including Safari, where
  Blobs in IndexedDB have failed in private mode and older versions. `fake-indexeddb` in the node unit tests clones it
  too. A `Blob` is made from it only at play or download time.
- One chunk per row, written as it arrives, keeps each write small. Rewriting a growing array each second would write
  about 180 MB over a 3-minute clip. FR-016's one-second loss bound is the timeslice: `recorder.start(1000)`.
- Saving a memo is one Dexie transaction over `memos`, `outbox`, `memoAudio`, `memoUploads`, `memoDrafts` and
  `memoDraftChunks`. The row and its outbox entry still go through `insertRow` (FR-002). Dexie allows the nested
  transaction because its tables are a subset of the outer one. A memo is never visible without its audio, and a
  draft is never left behind after its memo is saved.
- `mutateBatch` in `mutate.ts` lists its tables by hand. It gains `memos` and the four memo tables, so a part delete
  can tombstone memos and erase their audio in one unit (FR-065).

**Alternatives considered**:
- The Cache API or OPFS for the bytes: this would be a second store with its own quota behaviour, and it could not
  share a transaction with the row. IndexedDB holds both.
- One table holding both the upload and fetch states: their fields barely overlap, and the queries ("what do I
  upload", "what do I fetch") are cleaner apart.

## R7. Formats: what is recorded, what is allowed, what plays

**Decision**: One table, `MEMO_FORMATS` in `src/lib/memos/formats.ts`, is used by the recorder, the wire schema, the
server, the player, the words and the download name.

| Base type | Recorder asks for (in order) | Codecs allowed | Magic bytes | Words | Extension |
|---|---|---|---|---|---|
| `audio/mp4` | `audio/mp4;codecs=mp4a.40.2`, `audio/mp4` | `mp4a.*`, `opus`, or none | bytes 4–7 are `ftyp` | MP4 audio | `.m4a` |
| `audio/webm` | `audio/webm;codecs=opus`, `audio/webm` | `opus`, or none | `1A 45 DF A3` | WebM audio | `.webm` |
| `audio/ogg` | `audio/ogg;codecs=opus`, `audio/ogg` | `opus`, or none | `OggS` | Ogg audio | `.ogg` |

- `chooseFormat(isTypeSupported)` returns the first supported candidate.
- After `start`, the stored format is `normaliseFormat(recorder.mimeType)`. It is lower-cased, with spaces removed
  around `;` and `=`, and has at most one `codecs` value. If the browser reports a type outside the allow-list (for
  example `audio/webm;codecs=pcm`), recording is unavailable with the "no recording support" message (FR-028). An
  unlisted format is never saved.
- `parseFormat(s)` is the one validator. The zod `memoRowSchema.format` and the upload's `content-type` check both
  call it. A `codecs` list with more than one entry (`opus,vp8`) is refused.
- Playability on a device is `audio.canPlayType(format) !== ""`. If not, the memo is shown as unplayable (FR-048).

**Rationale**:
- iOS Safari records `audio/mp4` (AAC) only. Chrome 126 and later can record `audio/mp4`, and builds with proprietary
  codecs give AAC. Firefox records `audio/ogg` and `audio/webm` with Opus. Preferring MP4 and AAC gives clips every
  current browser plays (FR-012).
- Playwright's bundled Chromium has no AAC encoder, so it records `audio/webm;codecs=opus` (or `audio/mp4;codecs=opus`
  where its MP4 muxer offers it). The e2e tests therefore never hard-code a format. They read it from the row and
  assert that it is in the allow-list.
- Magic-byte checks catch a hostile body that declares `audio/webm` and holds HTML. With `nosniff`, a download cannot
  be turned into a page either way.

**Alternatives considered**:
- Transcoding on the server to one format: this needs ffmpeg in the image, a new dependency and CPU, which the
  self-hosting constraint rules out.
- Allowing `audio/wav`: at 3 minutes it is about 30 MB, far past 8 MB.

## R8. Bitrate and the size limit

**Decision**: `new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 96_000 })`. A browser may ignore the hint;
Safari often does. The recorder tracks the total bytes of chunks so far. It stops itself when
`total + 2 × largestChunk > MAX_BYTES` (8 MiB), so the final flush cannot pass the cap. It also stops at 180 000 ms,
whichever comes first, and says which (FR-014).

**Rationale**: At 96 kbps, 3 minutes is about 2.2 MB, far under the cap. Even a browser that records at 256 kbps
(5.8 MB) fits. The two-chunk margin covers the last `dataavailable` after `stop()`, which can be as large as any other
chunk. The 8 MiB limit is still checked on the final total before saving. A clip that somehow passes it is saved
locally and then refused on upload with the size message. It is never lost.

**Alternatives considered**:
- 64 kbps: this saves space, but a bass's low end and a room's dynamics suffer on AAC at 64. Opus at 64 is fine, but
  one number for all formats is simpler.
- 128 kbps: this has no audible benefit for a riff reference, and costs about a third more of the band's total.

## R9. Playing a memo

**Decision**: One `HTMLAudioElement` per playing memo, with `src` set to an object URL of
`new Blob([bytes], { type: format })`. The URL is revoked on pause-to-end, on switching memo, and on unmount. The
position bar's maximum is the row's `durationMs`. If `audio.duration` is finite after `loadedmetadata`, that is used
instead. Seeking sets `currentTime`. A shared module, `src/lib/memos/sound.ts`, holds at most one current sound:
`claim(owner, stop)` stops the previous owner synchronously before the new one starts (FR-040). The recorder claims
it too.

**Rationale**:
- A media element plays with the iOS silent switch on, as video does. The spec's edge case asks for exactly this. Web
  Audio on iOS is muted by the switch.
- Chrome's MediaRecorder WebM has no duration header, so `audio.duration` is `Infinity` until the clip is played to
  the end. The row's `durationMs`, measured during recording, is the reliable length.
- A decode failure arrives as the element's `error` event. It is mapped to "could not be played" with **Download**
  (FR-048).

**Alternatives considered**:
- `decodeAudioData` with an `AudioBufferSourceNode`: this gives exact seeking, but 3 minutes of decoded PCM is about
  35–70 MB in memory, and it is silenced by the iOS switch.
- Reusing the playback engine from entry `tab-playback`: it schedules synthesised notes, and has no media playback.
  Memos never share a screen with it (FR-041).

## R10. Recording endings, and releasing the microphone every time

**Decision**: The recorder is a React-free state machine, `createRecorder(ports)` in `src/lib/memos/recorder.ts`. The
ports are injected: `getUserMedia`, a `MediaRecorder` factory, an `AudioContext` factory, a clock, the draft store
and the visibility source. It has exactly one exit, `finish(ending)`. Every way out calls `finish`, and `finish`
always does the same three things in this order:

1. Stop every track of the stream, and close the analyser's `AudioContext`.
2. Run the ending's save rule (keep / drop / hold in memory).
3. Write the ending's notice.

The 16 endings, their triggers, their save rule and their words are listed in
[contracts/recorder.md](./contracts/recorder.md) §3. The triggers are:
- `track.onended` and `track.onmute` (a call, another app, an unplug, or a withdrawn permission);
- `visibilitychange` to hidden, and `pagehide`;
- the song page unmounting (in-app links and back);
- `MediaRecorder` `error`;
- the timers;
- the user.

**Rationale**:
- Structure makes "no silent ending" (FR-026) checkable. A unit test drives every ending through fake ports and
  asserts the three effects (INV-007).
- `getUserMedia` and the analyser's `AudioContext` are both created synchronously inside the menu item's click
  handler. That is what Safari requires for audio to start, and it is what FR-011 requires for the permission prompt.
- The recorder lives in module scope, not in a component. Leaving the song page then ends it through `finish("left")`,
  called from the song page's unmount. The notice survives in `meta.memoNotices` until the song page is shown again
  (FR-023).

**When the page is being unloaded**: `pagehide` during a real unload (the tab closed, or a full navigation away) may
not leave time for the final flush and the save transaction. That is safe. The draft already holds every chunk up to
the last second, and the next boot recovers it as E13 (R11). The probe for the unload case therefore expects the
memo to appear **after the next open**, with the recovered notice. It does not expect the memo before.

**Alternatives considered**:
- Keeping the recorder in React state: unmounting would lose the instance mid-flush, and the left ending would be
  silent.
- Carrying on recording while hidden: iOS suspends capture when hidden anyway. The spec says stop and keep.

## R11. Recovering a recording after a crash or close (FR-025)

**Decision**: `recoverDrafts()` runs once per app start, from a new `MemoBoot` component. `MemoBoot` is mounted in the
root layout beside `SyncProvider` and renders nothing. For each draft left in `memoDrafts`, it:
1. joins the draft's chunks in index order;
2. checks the result with `probePlayable(bytes, format)`, which loads it into an `Audio` element and waits for
   `loadedmetadata` or `error`, at most 3 s;
3. if the clip is playable and at least 1 s long, saves it as a memo through the same `saveMemo` path, with the length
   taken from the chunk count (`chunks × 1000 ms`, capped by the metadata duration where it is finite), and writes
   the `recovered` notice;
4. otherwise drops it, and writes the `unrecoverable` notice once.

The draft and its chunks are deleted in the same transaction either way.

**Rationale**: With a one-second timeslice, the chunks are a valid prefix of the stream in WebM and Ogg. Chrome's and
Safari's MP4 output is fragmented, so a prefix of whole fragments plays too. Where a browser writes a non-fragmented
MP4 (the `moov` box at the end), the prefix cannot play, and the spec's second branch covers it.

**Alternatives considered**: Recovering only on the song page: a user who never reopens that song would never learn of
the lost clip. Boot-time recovery plus a per-part notice covers both.

## R12. Where recording cannot work (FR-027, FR-028)

**Decision**: `recordAvailability()` in `src/lib/memos/capability.ts` returns exactly one of:
- `ok`;
- `insecure` (`!window.isSecureContext`);
- `no-microphone` (no `navigator.mediaDevices?.getUserMedia`);
- `no-recorder` (no `MediaRecorder`, or `chooseFormat` finds nothing in the allow-list);
- `busy` (a recording is running on another part).

They are checked in that order. Only `ok` starts recording. Any other value shows the item with `aria-disabled="true"`
and its reason, and choosing it opens the explanation panel on the card. `insecure` is checked first, because on an
insecure origin `navigator.mediaDevices` is itself undefined, and FR-028 forbids showing the wrong message.

**Rationale**: Browsers hide `mediaDevices` on insecure origins, so a check for the API alone would say "no microphone"
on a LAN address. That is the exact confusion US4 exists to prevent.

**Test**: A Playwright project, `insecure`, launches Chromium with `--host-resolver-rules=MAP lan.test 127.0.0.1` and
uses `baseURL http://lan.test:3100`. This is a real non-secure origin, because a plain-http host that is not
`localhost` is not trustworthy. No API is patched.

## R13. Fake microphones in the e2e suite

**Decision**: The memo specs run in the existing `mobile` and `desktop` projects. They get
`launchOptions.args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream",
"--use-file-for-fake-audio-capture=e2e/fixtures/memo-tone.wav"]` and `permissions: ["microphone"]`, through
`test.use` in `e2e/memo-helpers.ts`. The fixture `memo-tone.wav` is about 2 s of 220 Hz sine at −12 dBFS, so the level
meter moves. It is generated once by `scripts/make-memo-tone.mjs` and committed. For the refused-microphone test, a
context is created without the permission and with `--use-fake-ui-for-media-stream` removed, plus
`context.clearPermissions()`. Chromium then denies the request, and no API is patched. "Microphone taken away" is the
fake track's real `stop()` from the page (`ended` fires), which is how an unplug presents.

**Rationale**: These are Chromium's documented test switches. Each ending fires through the real browser event.

**What a fake device cannot produce**: a phone call's `mute`, iOS's suspension when hidden, a real permission
withdrawal, and the silent switch. They are owed on real phones (SC-010, quickstart §6).

## R14. How the server is tested (FR-101)

**Decision**: There are no unit tests against Postgres in this repo today. Server behaviour is tested by Playwright
against the production build and the real database, as `sync.spec.ts` does, polling Postgres with `postgres`. The
route matrix is `e2e/memo-routes.spec.ts`, which uses `request` contexts that carry each test account's cookies. A
body that lies about its length is sent over a raw `node:net` socket:
- `Transfer-Encoding: chunked` with 9 MiB and no length;
- `Content-Length: 1000` followed by 9 MiB on the socket.

The second case is read by the server as 1 000 bytes under HTTP framing, and is refused for the size mismatch.
Every case then asserts `select count(*) from memo_audio where bytes is not null and memo_id = $1` is unchanged. The
React-free parts get vitest unit tests: `readCapped`, `parseFormat`, `sniff`, and the refusal table.

**Rationale**: The real interface is the HTTP route over a real socket. A unit test of the handler with a mocked
`db` would read the implementation back to itself.

## R15. Persistent storage (FR-070)

**Decision**: `ensurePersisted()` in `src/lib/memos/storage.ts`:
- Runs on the first save or fetch of a memo on this device, tracked by `localStorage["stablature.memos"].persistAsked`.
- Calls `navigator.storage.persist()` if `navigator.storage.persisted()` is false. A rejection or `false` blocks
  nothing.
- If storage is then still not persistent and `persistNoticeShown` is unset, it writes a `persist` notice on the part
  of the memo that triggered it, and sets the flag. The notice is shown once.

## R16. The download's file name (FR-049)

**Decision**: `downloadName(song, part, memo)` in `src/lib/memos/words.ts` builds
`{song}-{part label}-{label or yyyy-mm-dd-hhmm}{ext}`. Each piece is made safe by `filePiece` in the same file: lower
case, `[a-z0-9]` runs joined by `-`, at most 40 characters, with "memo" as the fallback for an empty piece. The
existing `slugify` is not reused, because its fallback is a random `band-…` id. The extension comes from
`MEMO_FORMATS` (R7). The download is an `<a download>` on an object URL of the same bytes the player uses.

## R17. Refusals, "Try again", and "the account changes" (FR-036)

**Decision**:
- **Refusal records.** `memoUploads` entries carry `refusal: { code, message } | null` and `account: string | null`.
  A refusal is any upload answer listed as one in [contracts/memo-audio-routes.md](./contracts/memo-audio-routes.md)
  §4, or a **push** rejection of the memo row itself. `pushOnce` in `src/lib/sync/client.ts` records `read_only`,
  `unknown_band` and `not_a_member` rejections of `memos` rows onto the matching entry, with the push's own
  message. That keeps the words the same as for every other refused write (US2 AS6).
- **Account changes.** `SyncProvider` already knows `userId`. It calls `setMemoAccount(userId)`, which clears every
  refusal recorded under another account (or under none) and requeues their rows (below).
- **Try again.** It clears the memo's refusal. If the row was never accepted (`serverSeq === 0`), it also puts the row
  back in the outbox through a new `requeueRow(table, id)` in `mutate.ts`. That function adds an outbox entry for the
  row as it stands, with no new clock. Try again then triggers a sync.
- **Band total.** A `band_full` refusal is also cleared when this device applies a tombstone of any memo in the same
  band, local or pulled. Room may have been freed (spec edge case).
- **Retries.** Network failures and 5xx get backoff: 5 s, 15 s, 45 s, 2 min, then every 5 min (`nextAt`).
- **Not refusals.** A `401` is not a refusal; the pass stops, as push does. A `410` (deleted or erased) is not a
  refusal either: the device drops the entry and its local audio (spec edge case).

**Rationale**: `requeueRow` keeps "every write goes through `mutate.ts`" true, and it does not invent a clock. The
server merges the same row it would have merged the first time.

## R18. A part deleted while its memos are live (blast radius)

**Decision**:
- **Server.** When a push stores a `parts` row whose merged `deletedAt` is non-null, the same transaction erases the
  audio of every memo of that part (writing `memo_audio` erased rows). When a push inserts or updates a memo whose part
  is deleted, its audio is erased too. The upload route refuses a memo whose part is deleted, with `410 part_deleted`.
- **Devices.** Applying a part tombstone, local or pulled, erases the local audio and drops the queue entries of that
  part's memos. This is the same `eraseLocalMemoAudio` that a memo tombstone calls.
- **Memo rows.** They are **not** tombstoned by the server, which has no clock to write with (R4). A memo on a deleted
  part is never drawn, because its card is gone. If the part were ever restored, which no control offers, its memos
  would read "audio deleted" (FR-063).

**Rationale**: Two devices can race: A records on part P offline while B deletes P in one tap (P had no memos on B).
Without this rule, A's audio would upload and sit on the server, counting against the band's total, with no screen
that can show or delete it. That is the outcome FR-065's rationale rejects. Treating "part deleted" as "its memos'
audio erased" matches FR-065's own meaning: deleting a part deletes its memos.

**Alternatives considered**:
- Keeping the audio until someone restores the part: no control restores a part, so the audio would be kept for ever.
- The server tombstoning the memo rows: this needs a server clock, rejected in R4.

## R19. Level meter and announcements (FR-013)

**Decision**:
- **Level meter.** `AnalyserNode` (`fftSize` 512) on a `MediaStreamAudioSourceNode`, read once per animation frame
  into an RMS. It is drawn as a bar whose width is `min(1, rms × 4)` of its track. It is `aria-hidden`, because it is
  decoration; the words carry state.
- **Time left.** It reads `m:ss left` in tabular numerals. In the last 15 s it gains `font-semibold`, the `text-danger`
  token and a leading "Only", so it never relies on colour alone.
- **Announcements.** A separate `aria-live="polite"` node announces "1 minute left", "30 seconds left" and
  "10 seconds left" once each. The visible timer is not live.

## R20. What the memo list costs a card with no memos (FR-043, SC-009)

**Decision**: `PartMemos` returns `null` when the part has no live memos, no running recording and no notice. No
wrapper, margin or gap is rendered. The wide fit fixture has no memos, so `wide-fit` and `wide-*` specs run
unedited, and a new `memo-card-height.spec.ts` asserts that a card's bounding box is identical before the feature
(recorded on `main` into `e2e/fixtures/memo-card-before.json`) and after.

## R21. Is anything left unresolved?

No. Each of the spec's open planning items is decided above: the merge exception (R4), the bitrate (R8), and which
browsers record what (R7). Each choice that goes beyond the spec's words is a **plan deviation** in
[plan.md](./plan.md), and is recorded in DECISIONS.
