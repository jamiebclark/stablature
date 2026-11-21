# Data model: Voice memos on a part

**Feature**: `012-voice-memos` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

There are three places data lives: the synced row (everywhere), the server's audio table (once), and the device's local
tables (per device). The derived per-device state, the recorder's states and the notices are below them.

## 1. Constants: `src/lib/memos/limits.ts`

One module. The recorder, the zod schema, the server route and the words all import from here (INV-022).

| Name | Value | Used by |
|---|---|---|
| `MAX_DURATION_MS` | `180_000` | the recorder's time limit; the countdown |
| `MIN_DURATION_MS` | `1_000` | the too-short rule (FR-017); `memoRowSchema.durationMs.min` |
| `DURATION_SLACK_MS` | `5_000` | `memoRowSchema.durationMs.max = MAX + SLACK` (timer jitter at stop) |
| `MAX_BYTES` | `8 * 1024 * 1024` | the recorder's size guard; `memoRowSchema.size.max`; `readCapped` |
| `BAND_TOTAL_BYTES` | `500 * 1024 * 1024` | the upload route's per-band check |
| `TIMESLICE_MS` | `1_000` | `MediaRecorder.start(TIMESLICE_MS)` (FR-016) |
| `BITRATE` | `96_000` | `audioBitsPerSecond` (research R8) |
| `WARN_LAST_MS` | `15_000` | when the countdown changes style |
| `ANNOUNCE_AT_MS` | `[60_000, 30_000, 10_000]` | live announcements |
| `LIST_VISIBLE` | `3` | the newest memos shown before "Show N earlier" |
| `WAITING_RECHECK_MS` | `5_000` | the shortest wait before asking about a "not uploaded yet" memo again |
| `BACKOFF_MS` | `[5_000, 15_000, 45_000, 120_000, 300_000]` | upload and fetch retry waits; the last one repeats |
| `LABEL_MAX` | `120` | `memoRowSchema.label.max`; the rename input's `maxLength` |

## 2. The memo row (synced)

### 2.1 `src/lib/model.ts`

```ts
export interface MemoRow extends SyncMeta {
  id: string;               // client-minted UUIDv7
  bandId: string;           // = the part's bandId (checked by push, §2.4)
  partId: string;
  recordedById: string | null;    // server-stamped at insert; null until then (research R4)
  recordedByName: string | null;  // server-stamped at insert
  durationMs: number;       // integer, MIN..MAX+SLACK
  format: string;           // normalised MIME, one of MEMO_FORMATS (research R7)
  size: number;             // bytes, 1..MAX_BYTES
  recordedAt: number;       // ms since epoch, at Stop (device clock)
  label: string | null;     // mergeable
}
```

- `SyncedRows` gains `memos: MemoRow`.
- `SYNCED_TABLES` gains `"memos"` **last**, after `"arrangementEntries"`. Push and pull apply tables in this order, so
  a memo always lands after its part (the foreign key), and every existing table keeps its position. Nothing points
  at a memo.
- `MERGEABLE_FIELDS.memos = ["label", "deletedAt"]` (FR-004).
- New: `SERVER_STAMPED_FIELDS = { memos: ["recordedById", "recordedByName"] } as const satisfies Partial<{ [K in SyncedTable]: readonly (keyof SyncedRows[K])[] }>`.

### 2.2 `src/db/schema/domain.ts`

```ts
export const memos = pgTable("memos", {
  id: uuid("id").primaryKey(),
  bandId: uuid("band_id").notNull().references(() => bands.id, { onDelete: "cascade" }),
  partId: uuid("part_id").notNull().references(() => parts.id, { onDelete: "cascade" }),
  recordedById: text("recorded_by_id").references(() => user.id, { onDelete: "set null" }),
  recordedByName: text("recorded_by_name"),
  durationMs: integer("duration_ms").notNull(),
  format: text("format").notNull(),
  size: integer("size").notNull(),
  recordedAt: bigint("recorded_at", { mode: "number" }).notNull(),
  label: text("label"),
  ...sync,
}, (t) => [index("memos_part_idx").on(t.partId), index("memos_band_idx").on(t.bandId), index("memos_seq_idx").on(t.serverSeq)]);
```

- `SYNC_TABLE_ORDER` gains `"memos"` last. It mirrors `SYNCED_TABLES`, and `assert-model.ts` gains `_Memos`.
- `recordedById` uses `set null` on user delete, so deleting an account keeps the band's memo with its stamped name.
  The audio is the band's. This is the same as every other row an account wrote.

### 2.3 `src/lib/sync/protocol.ts`

```ts
export const memoRowSchema = z.object({
  id, bandId: id, partId: id,
  recordedById: z.string().min(1).max(64).nullable(),
  recordedByName: z.string().max(200).nullable(),
  durationMs: z.number().int().min(MIN_DURATION_MS).max(MAX_DURATION_MS + DURATION_SLACK_MS),
  format: z.string().max(100).refine((s) => parseFormat(s) !== null, "format not allowed"),
  size: z.number().int().min(1).max(MAX_BYTES),
  recordedAt: z.number().int().min(0),
  label: z.string().max(LABEL_MAX).nullable(),
  ...syncMeta,
});
```

It is added to `ROW_SCHEMAS` and to `mutationSchema`'s union.

### 2.4 Server push (`src/lib/server/sync.ts`)

- `TABLES.memos = schema.memos`.
- `upsert`, for the **insert** of a memo, writes `recordedById = userId` and `recordedByName = <user.name>` over
  whatever arrived. The name is cut to 200 characters, the schema's maximum. Otherwise a long account name would make
  the row fail `memoRowSchema` on every device, and `applyRemoteRows` would drop it without a word. The **update** path is unchanged: structural fields are never written.
- Before the upsert of a memo, push checks that `parts.id = row.partId` exists with `parts.band_id = row.bandId`.
  Otherwise the row is rejected with `reason: "invalid"` and the message "That memo's part is not in that band.".
- After the upsert of a `memos` row: if `merged.deletedAt !== null`, or the memo's part has `deleted_at` set, call
  `eraseMemoAudio(tx, [id], bandId)`.
- After the upsert of a `parts` row with `merged.deletedAt !== null`, call `eraseMemoAudio(tx, ids of that part's
  memos, bandId)`.
- `eraseMemoAudio` upserts `memo_audio (memo_id, band_id, bytes = NULL, erased_at = now(), size = 0)`. It is
  idempotent: an already-erased row keeps its first `erased_at`.

### 2.5 Merge (`src/lib/sync/merge.ts`)

`mergeRow` keeps today's loop over `MERGEABLE_FIELDS`. After the loop it adds one step: for each field in
`SERVER_STAMPED_FIELDS[table] ?? []`, `merged[f] = local[f] ?? remote[f]`. `applyPatch` refuses these fields (they are
not mergeable), as today. `stampNewRow` is unchanged.

### 2.6 Validation rules

| Field | Rule | Source |
|---|---|---|
| `partId` | a live or deleted part of the same band; immutable | FR-001, §2.4 |
| `durationMs` | integer ≥ 1 000 and ≤ 185 000 | FR-014, FR-017 |
| `format` | `parseFormat` ≠ null | FR-031 |
| `size` | integer 1 … 8 388 608 | FR-032 |
| `label` | null or ≤ 120 chars; trimmed; `""` is stored as `null` | FR-045 |
| `recordedBy*` | the device sends null; the server overwrites at insert | FR-006 |
| only `label` and `deletedAt` change | `applyPatch` throws on anything else | FR-004 |

## 3. The server's audio table: `memo_audio` (not synced, never pulled)

```ts
export const memoAudio = pgTable("memo_audio", {
  memoId: uuid("memo_id").primaryKey().references(() => memos.id, { onDelete: "cascade" }),
  bandId: uuid("band_id").notNull().references(() => bands.id, { onDelete: "cascade" }),
  contentType: text("content_type").notNull(),   // the memo row's format, as stored
  size: integer("size").notNull(),                // 0 once erased
  sha256: text("sha256"),                         // hex; null once erased
  bytes: bytea("bytes"),                          // null once erased
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }),
  erasedAt: timestamp("erased_at", { withTimezone: true }),
}, (t) => [index("memo_audio_band_idx").on(t.bandId)]);
```

`bytea` is a `customType` in `domain.ts` (Drizzle has no built-in `bytea` for `pg-core`), mapping to a Node `Buffer`.

**States** (one row per memo at most):

```
(no row) ──upload ok──▶ STORED {bytes, sha256, size, uploadedAt}
   │                       │
   └──tombstone/part del──▶ ERASED {bytes NULL, sha256 NULL, size 0, erasedAt}  ◀──tombstone/part del── STORED
```

ERASED is terminal. Nothing in the app moves a row out of it.

**Band total**: `select coalesce(sum(size), 0) from memo_audio where band_id = $1 and bytes is not null`.

**Not in**: `SYNC_TABLE_ORDER`, `SYNCED_TABLES`, `readPull`, `assert-model.ts`. The migration that drizzle-kit
generates (`drizzle/0006_*.sql`) creates both tables.

## 4. The device's local tables (Dexie version 2)

`src/lib/local/db.ts` adds `this.version(2).stores({...v1, memos: "id, partId, bandId, serverSeq", memoAudio:
"memoId", memoUploads: "memoId", memoFetches: "memoId", memoDrafts: "id", memoDraftChunks: "[draftId+index],
draftId"})`. Version 1's stores are untouched, so no existing data moves.

### 4.1 `memoAudio`

```ts
interface MemoAudioEntry { memoId: string; bytes: ArrayBuffer; format: string; size: number }
```

It exists exactly when this device holds the clip. Writers: `saveMemo` (local record), `recoverDrafts`, and the fetch
step. Eraser: `eraseLocalMemoAudio` only (§4.6).

### 4.2 `memoUploads`: the upload queue (FR-036)

```ts
interface MemoUploadEntry {
  memoId: string;
  bandId: string;
  attempts: number;           // network/5xx failures so far
  nextAt: number;             // ms epoch; 0 = now
  refusal: { code: RefusalCode; message: string } | null;
  account: string | null;     // userId the refusal was received under
}
```

Created by `saveMemo` and `recoverDrafts` for every memo recorded on this device, signed in or not. Removed on a `200`
or `201` from `PUT`, or by `eraseLocalMemoAudio`.

**Transitions**:

| From | Event | To |
|---|---|---|
| queued | row not yet accepted (`memos.serverSeq === 0`) | queued (skipped this pass) |
| queued | `PUT` 200 / 201 | *(removed)* |
| queued | network error, 5xx, 408, 429 | queued, `attempts+1`, `nextAt = now + BACKOFF_MS[min(attempts, 4)]` |
| queued | refusal (contract §4) | refused `{code, message}`, `account = userId` |
| queued | push rejected the memo row (`read_only`, `unknown_band`, `not_a_member`) | refused, with the push's message |
| queued | `410 deleted` / `410 erased` / `410 part_deleted` | *(removed, with local audio)* via `eraseLocalMemoAudio` |
| queued | `401` | queued (the pass stops) |
| refused | Try again | queued (`refusal = null`, `attempts = 0`, `nextAt = 0`; `requeueRow` if `serverSeq === 0`) |
| refused | `setMemoAccount(u)` with `u ≠ account` | queued (as Try again) |
| refused `band_full` | this device applies a memo tombstone in the same band | queued |

### 4.3 `memoFetches`: this device's fetch state

```ts
interface MemoFetchEntry {
  memoId: string;
  status: "waiting" | "failed" | "full" | "erased";
  attempts: number;
  nextAt: number;
}
```

There is no entry while a memo has never been asked about, or while it is being fetched. **Downloading** is the
in-memory `current` of the fetch step (§4.7), exposed by a small store. An entry is removed when audio is saved.

| From | `GET` answer | To |
|---|---|---|
| any | 200 + bytes saved | *(removed)*; `memoAudio` written |
| any | 404 `not_uploaded` / `not_found` | `waiting`, `nextAt = now + WAITING_RECHECK_MS` (cleared by a `changed` event) |
| any | 410 `erased` | `erased` (terminal; never asked again) |
| any | network error, 5xx | `failed`, `attempts+1`, backoff |
| any | `QuotaExceededError` saving | `full`; **the pass stops fetching** (FR-071) |
| `failed`, `full` | Try again, or the next cycle once `nextAt` has passed | asked again |

### 4.4 `memoDrafts` and `memoDraftChunks`: a recording in progress (FR-016, FR-025)

```ts
interface MemoDraft { id: string; memoId: string; partId: string; bandId: string; songId: string; format: string; startedAt: number }
interface MemoDraftChunk { draftId: string; index: number; bytes: ArrayBuffer }
```

A draft is created when recording starts. A chunk is added on each `dataavailable` (about once a second). Both are
deleted in the transaction that saves the memo, or on Discard, too-short or recovery.

### 4.5 `meta` keys

| Key | Value |
|---|---|
| `memoNotices` | `MemoNotice[]`: see §7 |
| `memoAccount` | the `userId` last passed to `setMemoAccount` |

And in `localStorage["stablature.memos"]`, a `panels.ts`-shaped module (`src/lib/memos/prefs.ts`) holds
`{ expanded: Record<partId, true>, persistAsked?: true, persistNoticeShown?: true }`. It is device-only and never
synced (FR-044, FR-070).

### 4.6 The one eraser (FR-062)

`eraseLocalMemoAudio(database, memoIds)` deletes from `memoAudio`, `memoUploads`, `memoFetches`, and any
`memoDrafts`/`memoDraftChunks` whose `memoId` is listed. It also stops the current sound if it is one of them. **Every**
local erase calls it:

| Path | Caller |
|---|---|
| Delete a memo on this device | `deleteMemo(id)` in `src/lib/local/memos.ts` (one `mutateBatch`: `deleteRow("memos")` + erase) |
| Delete a part on this device | `deletePart(partId)` (one `mutateBatch`: `deleteRow("parts")` + `deleteRow("memos")` for each live memo + erase) |
| A memo tombstone pulled or echoed | `applyRemoteRows`: after merging a `memos` row whose `deletedAt !== null` |
| A part tombstone pulled or echoed | `applyRemoteRows`: after merging a `parts` row whose `deletedAt !== null`, for that part's memos |
| Upload answered `410` | the upload step |

`applyRemoteRows`'s transaction gains the four memo tables, so the merge and the erase commit together.

### 4.7 The memo pass (`src/lib/memos/transfer.ts`)

`workMemos({ fetch, database, userId })` runs after each `syncNow()` inside the runner's single-flight `run`, so it
never overlaps itself:

1. **Upload**: every `memoUploads` entry with `refusal === null`, `nextAt ≤ now`, and `memos.serverSeq > 0`, oldest
   `recordedAt` first, one at a time. Stop on a `401`.
2. **Fetch**: every live `memos` row whose part is not tombstoned on this device, that has no `memoAudio`, and that
   has no `memoFetches` entry which is `erased`, `full`, or has `nextAt > now`. Newest `recordedAt` first, one at a
   time (FR-037). Stop after a `full`. The first fetch on a device calls `ensurePersisted()` (FR-070).

It never runs while signed out, because the runner only exists while `SyncProvider` has a `userId`.

## 5. Derived state: `memoState()` (`src/lib/memos/state.ts`, FR-039, FR-048)

Pure: `memoState(input) → MemoState`. The UI calls it. It is never stored.

```ts
type MemoStateInput = {
  row: MemoRow;
  hasAudio: boolean;                 // memoAudio entry exists
  upload: MemoUploadEntry | null;
  fetch: MemoFetchEntry | null;
  downloading: boolean;              // fetch step's current === row.id
  recordedHere: boolean;             // upload entry exists, or row.serverSeq === 0
  signedIn: boolean;
  online: boolean;
  canPlay: boolean;                  // audio.canPlayType(row.format) !== ""
  decodeFailed: boolean;             // set by the player's `error` event this visit
};
```

The first matching row wins:

| # | Condition | `kind` | Player? | Words (exact) | Action |
|---|---|---|---|---|---|
| 1 | `fetch?.status === "erased"` | `deleted` | no | This memo's audio was deleted. | — |
| 2 | `hasAudio && !canPlay` | `unplayable` | no | This browser can't play {Words} (R7 words, e.g. "WebM audio"). | Download |
| 3 | `hasAudio && decodeFailed` | `failed-play` | no | This memo couldn't be played. | Download |
| 4 | `hasAudio && upload?.refusal` | `refused` | yes | {refusal.message} | Try again |
| 5 | `hasAudio && upload && !signedIn` | `local-signed-out` | yes | Saved on this device. | — |
| 6 | `hasAudio && upload && !online` | `local-offline` | yes | Will upload when online. | — |
| 7 | `hasAudio && upload` | `uploading` | yes | Uploading… | — |
| 8 | `hasAudio` | `ready` | yes | *(none)* | — |
| 9 | `downloading` | `downloading` | no | Downloading… | — |
| 10 | `fetch?.status === "full"` | `full` | no | Out of room on this device. | Try again |
| 11 | `fetch?.status === "failed"` | `fetch-failed` | no | Couldn't download. | Try again |
| 12 | otherwise | `waiting` | no | Waiting for the recording device to upload it. | — |

Rows 5 and 6 depend on the device's sign-in state, not on the memo, so they still read right after the user signs in.
Every memo menu offers **Rename** and **Delete**. **Download** is offered when `hasAudio`.

## 6. The recorder (`src/lib/memos/recorder.ts`)

```
idle ──start(part)──▶ asking ──granted──▶ recording ──finish(e)──▶ ending ──saved/dropped/held──▶ idle | held
          │                                                                                  ▲
          └──refused / unavailable──▶ finish(e) ────────────────────────────────────────────────┘
held ──Try again ok / Download ok / Discard──▶ idle
```

- At most one recorder exists per page (module singleton). `recordAvailability()` returns `busy` while one is not
  `idle`.
- `held` is the out-of-room state (FR-024). The clip is in memory, and the card offers **Try again**, **Download the
  clip** and **Discard**.
- The endings are enumerated with their save rule and words in [contracts/recorder.md](./contracts/recorder.md) §3.

## 7. Notices (`meta.memoNotices`)

```ts
interface MemoNotice { id: string; partId: string; kind: EndingKind | "recovered" | "unrecoverable" | "persist" | "discarded"; words: string; at: number }
```

- Written by `finish(ending)` (one per ending), by `recoverDrafts`, and by `ensurePersisted`.
- Shown on the part's card, in its memo area, as a `role="status"` line with a **Dismiss** button. Dismissing removes it.
- A new recording on the same part replaces the part's earlier notices.
- At most 5 are kept per part (oldest dropped).
- A notice for a part that is gone (tombstoned, or not on this device) is removed by `recoverDrafts` at boot.

## 8. Relationships

```
bands 1─* parts 1─* memos 1─0..1 memo_audio (server)
                     │
                     ├─0..1 memoAudio    (device)
                     ├─0..1 memoUploads  (device that recorded it)
                     ├─0..1 memoFetches  (other devices)
                     └─0..1 memoDrafts 1─* memoDraftChunks (while recording)
user 1─* memos.recordedById (set null on account delete)
```

## 9. The seeded data the tests use (`e2e/memo-helpers.ts`)

- **Song M**: band "Memo band", song "Memo song", parts A (no memos), B (memos), and B′, a variant of B with no memos.
- `seedMemo(page, { partLabel, durationMs, format, label, bytes, state })` writes raw IndexedDB, the way `seedSong`
  in `e2e/reading-helpers.ts` already does: the `memos` row, plus the `memoAudio`, `memoUploads` or `memoFetches`
  entries that the wanted §5 state needs. It runs after the app has opened the database at version 2. The app exposes
  no test hook on `window`.
- `seedServerAudio(sql, { bandId, memoId, size })` inserts `memo_audio` rows directly, for the band-total probes. The
  declared `size` is used, with 1 byte of payload.
- `memo-tone.wav`: a 2 s, 220 Hz sine at −12 dBFS, 48 kHz mono, used as the fake microphone input.
