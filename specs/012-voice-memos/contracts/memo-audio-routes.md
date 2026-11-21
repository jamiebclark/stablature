# Contract: memo audio routes

**File**: `src/app/api/memos/[memoId]/audio/route.ts` (two handlers). The server logic is in `src/lib/server/memos.ts`.
The pure helpers (`readCapped`, `parseFormat`, `sniff`, `REFUSALS`) are in `src/lib/memos/`.

Every answer that is not audio is JSON: `{ "code": <code>, "message": <words> }`. Every response carries
`cache-control: private, no-store`. Requests are identified by the Better Auth session cookie, through the existing
`currentUser(request)`.

## 1. `GET /api/memos/{memoId}/audio`: download

Checks, in order. The first that applies answers.

| # | Check | Status | `code` | `message` |
|---|---|---|---|---|
| 1 | no session | 401 | `signed_out` | Sign in to sync. Your local changes are safe and will push once you do. *(today's `unauthorized()`)* |
| 2 | `memoId` is not a UUID | 404 | `not_found` | That memo is not on the server. |
| 3 | no `memos` row, **or** its `band_id` is not one of the account's bands | 404 | `not_found` | That memo is not on the server. |
| 4 | `memo_audio.erased_at` is set | 410 | `erased` | This memo's audio was deleted. |
| 5 | no `memo_audio` row | 404 | `not_uploaded` | The recording device has not uploaded this memo yet. |
| 6 | otherwise | 200 | — | body = `bytes` |

- **On 200**: `content-type: <memo_audio.content_type>`, `content-length`, `x-content-type-options: nosniff`, and
  `content-disposition: inline`.
- **Row 3** gives a byte-identical answer for "does not exist" and "exists in a band you are not in" (FR-030). The
  probe compares status, headers other than `date`, and body.
- **Any role may download**: owner, editor, viewer (FR-030).
- A `memo_audio` row in the erased state is answered by row 4 even if the memo row is live (FR-030a, FR-063).

## 2. `PUT /api/memos/{memoId}/audio`: upload

Request: body = the clip's bytes, `content-type` = the memo's format.

Checks, in order. Rows 1–7 run **before** the body is read. Rows 8–10 read it. Rows 11–17 run inside one transaction
holding `PUSH_LOCK` (research R3).

| # | Check | Status | `code` | `message` | Stores |
|---|---|---|---|---|---|
| 1 | no session | 401 | `signed_out` | *(today's `unauthorized()`)* | nothing |
| 2 | `memoId` not a UUID; no row; row's band not the account's | 404 | `not_found` | That memo is not on the server. | nothing |
| 3 | role is `viewer` | 403 | `read_only` | You have read-only access to that band. *(the exact string push uses)* | nothing |
| 4 | `parseFormat(content-type)` is null | 415 | `format` | This memo's format isn't one the server accepts. Memos must be MP4, WebM or Ogg audio. | nothing |
| 5 | the content-type's base type ≠ the row's `format` base type | 415 | `format_mismatch` | This memo's audio doesn't match the format it was saved with. | nothing |
| 6 | `content-length` present and > `MAX_BYTES` | 413 | `too_large` | This memo is larger than 8 MB, the most the server accepts. | nothing |
| 7 | `content-length` present and ≠ the row's `size` | 422 | `size_mismatch` | This memo's audio isn't the size it was saved with. Try recording it again. | nothing |
| 8 | the bytes read pass `MAX_BYTES` (the stream is cancelled at once) | 413 | `too_large` | *(as row 6)* | nothing |
| 9 | the stream ends early or errors | 400 | `incomplete` | The upload was cut off. It will be tried again. | nothing |
| 10 | bytes read ≠ the row's `size`; or `sniff(bytes) ≠` base type | 422 | `size_mismatch` / `content_mismatch` | *(as row 7)* / This memo's audio doesn't match the format it was saved with. | nothing |
| 11 | *(in lock)* the memo row's `deleted_at` is set | 410 | `deleted` | This memo was deleted. | nothing |
| 12 | *(in lock)* `memo_audio.erased_at` is set | 410 | `erased` | This memo's audio was deleted. | nothing |
| 13 | *(in lock)* the memo's part is deleted | 410 | `part_deleted` | This memo's part was deleted. | nothing (erases, research R18) |
| 14 | *(in lock)* `memo_audio` exists, same `sha256` | 200 | — | `{ "code": "stored" }` | nothing new |
| 15 | *(in lock)* `memo_audio` exists, different `sha256` | 409 | `different_file` | The server already has different audio for this memo. | nothing |
| 16 | *(in lock)* band total + `size` > `BAND_TOTAL_BYTES` | 507 | `band_full` | This band's memos have used all 500 MB of room on the server. Delete some old memos to sync this one. | nothing |
| 17 | *(in lock)* otherwise | 201 | — | `{ "code": "stored" }` | inserts STORED; after commit, `notifyChanged(row.serverSeq)` |

- The `incomplete` answer (row 9) is **not** a refusal. The client retries it (§4).
- On rows 1–16, no byte is written to `memo_audio`, except row 13, which writes the erased marker.
- The route never trusts `content-length` for the cap (rows 6–7 only refuse early; row 8 is the guarantee). A missing
  `content-length` (chunked transfer) skips rows 6–7.
- `role` comes from `rolesForUser`, read once per request. Upload needs `canEdit` (FR-030).

## 3. `readCapped(stream, max)` (`src/lib/memos/body.ts`)

```ts
type Capped = { ok: true; bytes: Uint8Array } | { ok: false; reason: "too_large" | "incomplete" };
async function readCapped(stream: ReadableStream<Uint8Array> | null, max: number): Promise<Capped>;
```

- It sums `chunk.byteLength` as each chunk is read. As soon as the sum is greater than `max`, it calls
  `reader.cancel()` and returns `too_large`. It never holds more than `max + one chunk`.
- A `null` stream, or a reader error, returns `incomplete`.
- The unit test feeds a stream of 1 KiB chunks totalling `max + 1`, asserts `too_large`, and asserts that no chunk
  after the one that crossed `max` was pulled (using a counting `pull`).

## 4. How the client classifies an answer (`src/lib/memos/transfer.ts`)

| Answer | Upload step | Fetch step |
|---|---|---|
| 200 / 201 | remove the queue entry | save `memoAudio`, remove `memoFetches` |
| 401 | stop the pass; keep the entry | stop the pass |
| 404 `not_found` | **refusal** | `waiting` |
| 404 `not_uploaded` | — | `waiting` |
| 403 `read_only` | **refusal** | — |
| 409 `different_file` | **refusal** | — |
| 410 `deleted` / `erased` / `part_deleted` | `eraseLocalMemoAudio([id])` | `erased` (410 `erased` only) |
| 413 `too_large` | **refusal** | — |
| 415 `format` / `format_mismatch` | **refusal** | — |
| 422 `size_mismatch` / `content_mismatch` | **refusal** | — |
| 507 `band_full` | **refusal** | — |
| 400 `incomplete`, 408, 429, 5xx, network error, no JSON | retry with backoff | `failed`, backoff |

A **refusal** stores `{ code, message }` from the body verbatim. That `message` is what the memo shows (FR-035). The
words come from one table, `REFUSALS` in `src/lib/memos/refusals.ts`. The server builds its answers from that table,
and the client shows whatever message arrived, so the two cannot drift.

## 5. Probes (`e2e/memo-routes.spec.ts`; FR-101, SC-006)

Accounts: **O** (owner of band X), **E** (editor of X), **V** (viewer of X), **N** (member of band Y only), and **∅**
(no session). Memo `m` is in band X, its row pushed by E, with `size = s` and format `f` as recorded by the fake
microphone. Before and after every case, the probe reads
`select bytes is not null as stored, sha256, erased_at from memo_audio where memo_id = $m`.

| Case | Who | Request | Expect | `memo_audio` after |
|---|---|---|---|---|
| H1 | ∅ | GET, PUT | 401 both | unchanged |
| H2 | N | GET `m`; GET a random UUID | 404 `not_found`, identical status, headers (minus `date`) and body | unchanged |
| H3 | N | PUT `m` | 404 `not_found` | unchanged |
| H4 | V | PUT `m` | 403 `read_only` | unchanged |
| H5 | V, E, O | GET `m` before upload | 404 `not_uploaded` | unchanged |
| H6 | E | PUT `content-length: 1000`, then 9 MiB on a raw socket | 422 `size_mismatch` (or 413, or 400 from Node's parser, or a reset before any answer: Linux resets a socket closed with bytes unread) | unchanged |
| H7 | E | PUT chunked, no length, 9 MiB | 413 `too_large`; the socket's later writes are refused or reset | unchanged |
| H8 | E | PUT `content-length: 9437184` | 413 `too_large`, answered before the body is sent (`Expect: 100-continue` is not needed; time-to-answer < 1 s) | unchanged |
| H9 | E | PUT `content-type` in **D** (below) | 415 `format` | unchanged |
| H10 | E | PUT `content-type: f`, body = `<html>…` padded to `s` | 422 `content_mismatch` | unchanged |
| H11 | E | PUT `s − 1` bytes | 422 `size_mismatch` | unchanged |
| H12 | E | PUT the real clip | 201 | STORED |
| H13 | E | PUT the real clip again | 200 `stored` | unchanged (same `sha256`, same `uploaded_at`) |
| H14 | O | PUT a different clip of the same size and format | 409 `different_file` | unchanged |
| H15 | V, E, O | GET `m` | 200, bytes equal H12's, `content-type: f`, `nosniff` | unchanged |
| H16 | E | push `m` tombstoned | push 200 | ERASED in the same push (`erased_at` set before the push's response) |
| H17 | E | GET / PUT `m` | 410 `erased` / 410 `deleted` | unchanged |
| H18 | E | push `m` **un**-deleted (`deletedAt: null`, newer clock), then GET | 410 `erased` | unchanged |
| H19 | E | memo `m2` on part P; push P tombstoned; PUT `m2` | 410 `part_deleted` | ERASED |
| H20 | E | band X seeded to `500 MiB − s + 1` of STORED sizes; PUT `m3` | 507 `band_full` | unchanged |
| H21 | E | band X at `500 MiB − s`; two PUTs of `m4` and `m5` (each `s`) in parallel | exactly one 201, one 507 | one STORED |
| H22 | E | PUT `m6` with a socket closed after half the body | no 2xx | unchanged |

**D** (disallowed `content-type`s): `audio/wav`, `audio/mpeg`, `video/webm`, `audio/webm;codecs=vorbis`,
`audio/webm;codecs=opus,vp8`, `audio/mp4;codecs=avc1.42E01E`, `text/html`, `application/octet-stream`, and no header.

**A** (allowed; unit-tested by `parseFormat`): `audio/mp4`, `audio/mp4;codecs=mp4a.40.2`, `audio/mp4; codecs="mp4a.40.5"`,
`audio/mp4;codecs=opus`, `audio/webm`, `audio/webm;codecs=opus`, `AUDIO/WEBM; CODECS=OPUS`, `audio/ogg`,
`audio/ogg;codecs=opus`.
