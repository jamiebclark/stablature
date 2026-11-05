# Contract: the fit rule and the write

**Normative** for `src/lib/tab/reading.ts`, `src/lib/local/importing.ts` and the small additions to
existing modules. Behaviour is in [spec.md](../spec.md), and the shapes are in
[data-model.md](../data-model.md).

## Limits: `src/lib/model.ts`

```ts
export const MAX_FRET = 36;
export const MAX_REPEAT = 512;
export const MAX_CHORD_LENGTH = 200;
```

`src/lib/sync/protocol.ts` uses them in place of its literals: `fretValue`, the two `repeat` fields,
and `shortText`. **The wire accepts exactly what it accepted before** (FR-039). `longText`, `rank`,
`bpm`, `fromBar` and every other limit stay as they are. `arrangementEntryRowSchema.repeat` shares
the constant because it is the same cap on the same idea.

## Reading: `src/lib/tab/reading.ts`

```ts
export interface ReadingContext {
  /** The song's resolved tuning, or null when it has none. */
  tuning: Tuning | null;
  /** The band's live tunings, in `listTunings` order. */
  bandTunings: readonly TuningRow[];
  /** Every live column of every live part of the song. */
  songEvents: readonly EventRow[];
}

export function readTab(text: string, context: ReadingContext): TabReading;
```

Pure and total. Whitespace-only text is `idle`.

### Unlabelled rows

| Case | Result |
|---|---|
| Row count equals the song's strings | `fits`, with an `unlabelled` note |
| Song has no tuning | Refuses, `unlabelled-no-tuning` |
| Any other count | Refuses, `unlabelled-count` |

### The fit rule

Names compare by pitch class, ignoring case and any octave digit. For each row, at its position
from the top:

| Row | Against | Outcome |
|---|---|---|
| Has anything on it | A string of the same name at that position | Fine |
| Has anything on it | A different name, or no string there | Does not fit |
| Empty | A string of the same name | Fine |
| Empty | A different name | Fine, with a `row-name-differs` note |
| Empty | No string there | Fine, with a `row-left-out` note |

"Anything on it" means a cell. A pipe is not.

### When it does not fit

1. Find the first tuning with the same string count as the paste has rows, and the same names top
   to bottom: `bandTunings`, then `TUNING_PRESETS`.
2. If found, every string index holding a fret or `x` in `songEvents` must exist in the candidate
   and have the same `noteToMidi` as in the song's tuning. With no song tuning, `songEvents` must
   hold no notes.
3. If it holds, the reading is `ready` with an `offer`, and `tuning` is the candidate, so the
   preview draws in it.
4. Otherwise refuse.

| Code | When | The message names |
|---|---|---|
| `rows-lowest-first` | Reversing the rows would fit the song, or would find a tuning in step 1 | That the rows run lowest first |
| `tuning-unknown` | Step 1 found nothing | The paste's labels, the song's tuning, the first row that does not match |
| `tuning-notes-change` | Step 2 failed | Both tunings, the row, and a new song as the way through |
| `unlabelled-count` | See above | The count of rows and strings |
| `unlabelled-no-tuning` | See above | That rows need labels here |

Each carries the line of the first row that does not match.

### Bars and columns

`columns` is the stored non-barline columns. `bars` is `countBars` over the draft rows, so the
number on the preview is the app's own count.

## The clipboard: `src/lib/local/clipboard.ts`

```ts
export function rowsFromClipboard(
  part: Pick<PartRow, "id" | "bandId">,
  clipboard: Clipboard,
  ranks: readonly Rank[],
  mintId: () => string,
): { events: NewRow<"events">[]; annotations: NewRow<"annotations">[] };

export function draftPart(clipboard: Clipboard): {
  events: EventRow[];
  annotations: AnnotationRow[];
};
```

`rowsFromClipboard` is the body of `pasteClipboard`'s two loops, lifted out unchanged, including
fresh group ids and the skipping of an annotation with no anchor. `pasteClipboard` then inserts
what it returns. **Its behaviour does not change**, and `clipboard.test.ts` stays unedited.

`draftPart` calls `rowsFromClipboard` with ids `draft-0`, `draft-1`, ranks from `ranksBetween`, and
the empty sync metadata. It writes nothing and touches no database.

## The heading: `src/lib/export/text.ts`

```ts
export function isPartHeading(line: string): boolean;
```

Beside the code that writes the heading. True for a flush-left part label, optional primes, an
optional name after two spaces, and an optional `(variant of X)` after three. What `songToText`
writes is unchanged.

## The write: `src/lib/local/importing.ts`

```ts
export type ImportResult =
  | { kind: "imported"; part: PartRow }
  | { kind: "changed"; reading: TabReading };

export async function importTab(
  song: Pick<SongRow, "id" | "bandId">,
  text: string,
  expected: string,
  ctx?: MutateContext,
): Promise<ImportResult>;
```

`expected` is the `fitKey` the button showed. Inside one `mutateBatch`:

1. Read the song, `resolveTuning`, `listTunings` and `listEventsBySong` from the store.
2. `readTab(text, context)`.
3. If the reading is not `ready`, or its `fitKey` differs from `expected`, return `changed`,
   having written nothing.
4. If the fit is a `preset` offer, `createTuningFromPreset(bandId, preset, false, inner)`.
5. If the fit is any offer, `patchRow("songs", song.id, { tuningId }, inner)`.
6. `createPart(song, inner)`.
7. `pasteClipboard(part, [], null, reading.clipboard, inner)`.

Any throw rolls the whole batch back and rejects. **Ran**: this shape nests correctly, and rolls
back part, columns and tuning together.

It does not touch `arrangementEntries`, any `isDefault`, or any other song.

## Agreement

| Must agree | How |
|---|---|
| Preview and write | Both call `readTab`, and both turn its `clipboard` into rows through `rowsFromClipboard` |
| The button's promise and the write | `fitKey`, recomputed inside the batch |
| The letter shown and the letter written | Both `nextPartLabel`. The write's is read inside the batch, and the shown one is live |
| Decoration order, reader and writer | The reader calls `decorate` |
| Glyphs, reader and layout | Both read `TRANSITIONS` |
| Limits, reader and wire | Both import from `model.ts` |
| Part heading, recogniser and writer | Adjacent in one file, pinned by INV-010 |
| The rail character | **Not structural.** `RAIL` stays private so `ascii.ts` has zero diff. Every fixture pins it |
