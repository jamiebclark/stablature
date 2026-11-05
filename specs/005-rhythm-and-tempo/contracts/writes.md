# Contract: writes

There are exactly two new writes, both in `src/lib/local/editing.ts`, both through `patchRow`. The
click writes nothing.

## `setColumnDuration`

```ts
export async function setColumnDuration(
  eventId: string,
  duration: DurationHint | null,
  ctx: MutateContext = {},
): Promise<void>;
```

- One `patchRow("events", eventId, { durationHint: duration })`, so only that field's clock moves.
- Absolute, never read-modify-write. The toggle is decided by the caller from what was on screen.
- Reached only from `COLUMN_PROPERTIES`' `duration` property, as `properties.ts`' header says of every
  column write on the capture screen.

## `setSongTempo`

```ts
export async function setSongTempo(
  songId: string,
  bpm: number,
  ctx: MutateContext = {},
): Promise<boolean>;
```

- Reads the song. If its `bpm` already equals `bpm`, returns `false` and writes nothing (FR-024).
- Otherwise one `patchRow("songs", songId, { bpm })`, and returns `true`.
- Called only by the sheet's set button, with a `reading` from the tap reducer, so `bpm` is a whole
  number from 20 to 400 and the wire accepts it.
- The song page's field keeps its own `patchRow` and is not touched.

## The `duration` property

Added to `COLUMN_PROPERTIES` in `src/lib/capture/properties.ts`, second, after `repeat`:

| Key | Value |
|---|---|
| `id` | `"duration"` |
| `label` | `"duration"` |
| `ariaLabel` | `"note duration"` |
| `scope` | `"column-property"` |
| `control` | `"segments"`, new |
| `destructive` | `false` |
| `read` | `readDuration(ctx.event.durationHint)?.id ?? null` |
| `segments` | One per `DURATIONS` entry, in table order: `{ value, label: mark, ariaLabel: words, on }` |
| `commit` | `setColumnDuration(ctx.event.id, nextDuration(ctx.event.durationHint, value))` |

No entry in `TOOLBAR_CONTROLS`. `ColumnProperty["control"]` gains `"segments"`, `ColumnProperty` gains
an optional `segments(ctx)`, `ColumnPropertyId` gains `"duration"`, and `PropertyValue` is unchanged
because a `DurationHint` is already a string.

`ctx.event` is the row the sheet last rendered, which is what makes a tap mean what the person saw.

## What must not write

| Action | Writes |
|---|---|
| Opening or closing the inspector | Nothing |
| Opening the tempo sheet, tapping, closing | Nothing |
| Set, with the value already stored | Nothing |
| Anything the click does | Nothing |
| Reading a column with an unknown stored duration | Nothing |

## What must not change

Every create path keeps writing `durationHint: null` (`editing.ts:299`, `:379`, `:527`, and
`parse.ts:1204`). Copy, cut, paste and `createVariant` keep carrying the value (`clipboard.ts:96`,
`:163`, `editing.ts:225`). None of those lines change.
