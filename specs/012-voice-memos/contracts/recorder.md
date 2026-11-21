# Contract: the recorder

`src/lib/memos/recorder.ts` (React-free), `src/lib/memos/capability.ts`, `src/lib/memos/formats.ts`,
`src/lib/memos/sound.ts`. The card's UI drives it through `src/components/memos/useRecorder.ts`.

## 1. Ports (injected; the real ones are built in `src/lib/memos/ports.ts`)

```ts
interface RecorderPorts {
  getUserMedia(c: MediaStreamConstraints): Promise<MediaStream>;
  isTypeSupported(type: string): boolean;
  makeRecorder(stream: MediaStream, opts: MediaRecorderOptions): MediaRecorderLike;
  makeAnalyser(stream: MediaStream): { level(): number; close(): Promise<void> } | null; // null if AudioContext fails
  now(): number;                                   // performance.now()
  setTimer(fn: () => void, ms: number): () => void;
  drafts: DraftStore;                              // memoDrafts / memoDraftChunks
  save(draft: MemoDraft, bytes: ArrayBuffer, durationMs: number): Promise<void>; // saveMemo
  notice(n: Omit<MemoNotice, "id" | "at">): Promise<void>;
  visibility: { onHidden(fn: () => void): () => void };  // visibilitychange→hidden, pagehide
}
```

## 2. API

```ts
recordAvailability(): "ok" | "insecure" | "no-microphone" | "no-recorder" | "busy";
start(part: { id; bandId; songId; label }): void;  // synchronous up to getUserMedia() and makeAnalyser()
stop(): void;          // ending "stopped"
discard(): void;       // ending "discarded" (the UI's confirm comes first)
leave(): void;         // ending "left"; called by the song page's unmount
retrySave(): void;     // held → idle on success
downloadHeld(): Blob;  // held clip, for "Download the clip"
subscribe(fn): () => void;
snapshot(): RecorderSnapshot;  // { phase, partId, elapsedMs, leftMs, level, warn, held? }
```

`start` calls `sound.claim("recorder", stop)` first, which stops any playing memo (FR-040). `start` while
`recordAvailability() !== "ok"` does nothing to the microphone. It only opens the explanation (UI).

## 3. Endings: every way out (FR-014, FR-017, FR-020–FR-026)

`finish(ending)` always does these steps in this order:
1. stop every track;
2. `analyser.close()`;
3. clear the timers;
4. unsubscribe visibility;
5. `sound.release("recorder")`;
6. the save rule;
7. one notice.

The notice words are fixed here and live in `NOTICE_WORDS` in `src/lib/memos/words.ts`. `{len}` is `m:ss` of the
kept part.

| # | `ending` | Trigger | Save rule | Notice (exact words) |
|---|---|---|---|---|
| E1 | `stopped` | **Stop** | keep if ≥ 1 s | *(none; the memo appearing is the feedback)* |
| E2 | `limit-time` | elapsed reaches 180 000 ms | keep | Stopped at the 3-minute limit. The memo is saved. |
| E3 | `limit-size` | `total + 2 × largestChunk > MAX_BYTES` | keep | Stopped at the 8 MB limit. The memo is saved. |
| E4 | `discarded` | **Discard**, confirmed | drop | Recording discarded. Nothing was saved. |
| E5 | `refused` | `getUserMedia` rejects `NotAllowedError` / `SecurityError` | none started | The microphone was refused. To record, allow the microphone for this site in your browser's settings, then try again. |
| E6 | `no-device` | `getUserMedia` rejects `NotFoundError` / `NotReadableError` / `OverconstrainedError` | none started | No microphone could be opened on this device. |
| E7 | `cut-short` | `track.onended` or `track.onmute` while recording | keep if ≥ 1 s | The recording was cut short. The first {len} was kept. |
| E8 | `hidden` | `visibilitychange` to hidden, or `pagehide` | keep if ≥ 1 s | Recording stopped when you left the app. The first {len} was kept. |
| E9 | `left` | `leave()` (song page unmounted) | keep if ≥ 1 s | Recording stopped when you left the song. The first {len} was kept. |
| E10 | `recorder-error` | `MediaRecorder` `error` event | keep if ≥ 1 s | The recording stopped because of an error. The first {len} was kept. |
| E11 | `too-short` | any of E1, E7–E10 with < 1 s recorded | drop | Too short to keep. Recordings need at least 1 second. |
| E12 | `out-of-room` | `save` or a chunk write throws `QuotaExceededError` | **hold** in memory (`held`) | This device is out of room, so the recording isn't saved yet. Try again, or download the clip. |
| E13 | `recovered` | boot: a draft that plays (research R11) | keep | A recording was cut off when the app closed. The first {len} was recovered. |
| E14 | `unrecoverable` | boot: a draft that does not play | drop | A recording was cut off when the app closed and couldn't be recovered. |
| E15 | `unsupported` | `chooseFormat` is null, or `recorder.mimeType` fails `parseFormat` | none started | This browser can't record audio here. Memos recorded elsewhere still play. |
| E16 | `save-failed` | `save` throws anything other than a quota error | **hold** | The recording couldn't be saved. Try again, or download the clip. |

- In E7–E10 the "keep" rule first flushes: `recorder.stop()`, then waits for the final `dataavailable` (at most
  1 000 ms), then saves.
- "≥ 1 s" is measured from the first `start` event to the finish, on `ports.now()`.
- E12 and E16 hold the clip until `retrySave()` succeeds (→ notice "Saved."), `downloadHeld()` is used (→ the clip
  stays held until Discard), or Discard (→ E4's words). FR-024: never dropped without one of those.
- E5, E6 and E15 run no save rule. They still run steps 1–5 on whatever was acquired. A stream obtained before a later
  failure is always stopped.

**Unit probe** (`src/lib/memos/__tests__/recorder.test.ts`, INV-007): for each of E1–E16, drive the fake ports to the
trigger, then assert:
- (a) every fake track's `stop` was called and `analyser.close` was called (where acquired);
- (b) `save` was called exactly as the rule says (0 or 1 times, with `durationMs` within ±50 ms of the fake clock);
- (c) `notice` was called with exactly the row's words, or not called for E1;
- (d) `snapshot().phase` is `idle` (or `held` for E12/E16).

It also asserts that `finish` is reachable only once per recording: a second trigger after the first is a no-op.

## 4. Limits (INV-009)

Driven on the fake clock and fake chunk sizes:

- **L1**: a 96 kbps chunk stream reaches 180 000 ms → E2 at 180 000 ± 0 ms (the timer is set for the remainder).
- **L2**: 1 MiB chunks → E3 fires after the 7th chunk. After 6 chunks, 6 + 2 × 1 = 8 is not over 8. After 7,
  7 + 2 = 9 is. The final flush adds at most 1 MiB, so the saved size ≤ `MAX_BYTES`.
- **L3**: a final chunk larger than the margin cannot push the saved size past `MAX_BYTES`. The clip saved is the
  longest prefix of whole chunks whose total is ≤ `MAX_BYTES`, the same prefix rule recovery uses (research R11).
  Its `durationMs` is scaled by the bytes kept. The notice is E3's. A row whose `size` passes `MAX_BYTES` would fail
  `memoRowSchema`, which would make every push of that batch a `400`. So this is a hard rule, not a nicety (INV-019).
- **L4**: the countdown's `warn` flag is false at `leftMs = 15 001` and true at `leftMs = 15 000`.
- **L5**: announcements fire exactly once each at `leftMs` 60 000, 30 000 and 10 000, and never otherwise.

## 5. Format choice (`chooseFormat`, `normaliseFormat`, `parseFormat`)

Unit table (`formats.test.ts`):

| `isTypeSupported` true for | `chooseFormat` |
|---|---|
| everything | `audio/mp4;codecs=mp4a.40.2` |
| `audio/mp4` only | `audio/mp4` |
| `audio/webm;codecs=opus`, `audio/ogg;codecs=opus` | `audio/webm;codecs=opus` |
| `audio/ogg;codecs=opus` only | `audio/ogg;codecs=opus` |
| nothing in the list | `null` |

`normaliseFormat("audio/webm; codecs=\"opus\"") === "audio/webm;codecs=opus"`. `parseFormat` accepts the set **A** and
refuses the set **D** in [memo-audio-routes.md](./memo-audio-routes.md) §5.

## 6. One sound at a time (`src/lib/memos/sound.ts`, FR-040)

```ts
claim(owner: string, stop: () => void): void;   // stops the previous owner synchronously, if different
release(owner: string): void;                    // only if owner is current
current(): string | null;
```

The owners are `"recorder"` and `"memo:{id}"`. The unit test covers all four ordered pairs of {memo A, memo B,
recorder}: the earlier `stop` is called before `claim` returns.

## 7. Capability (`recordAvailability`, FR-027, FR-028)

Order: `insecure` → `no-microphone` → `no-recorder` → `busy` → `ok`. The unit test patches globals in jsdom, one case
per row, plus "insecure **and** no `mediaDevices`", which must read `insecure`.
