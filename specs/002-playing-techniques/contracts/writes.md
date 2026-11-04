# Contract: write operations

All in `src/lib/local/editing.ts`, all through `mutate.ts`, so every one is a local write
that queues itself for sync. `src/lib/local/clipboard.ts` is **not** changed (FR-001).

```ts
export type NoteWrite = MutateContext & { techniques?: readonly Technique[] };

export async function insertColumn(
  part, events, afterEventId, frets,
  options: { repeat?: number; kind?: EventRow["kind"]; techniques?: TechniqueMap } = {},
  ctx?: MutateContext,
): Promise<EventRow>;

export async function insertNote(
  part, events, afterEventId, stringIndex, fret,
  write: NoteWrite = {},
): Promise<EventRow>;

export async function stackNote(
  event: EventRow, stringIndex: number, fret: FretValue,
  write: NoteWrite = {},
): Promise<EventRow>;

export async function unstackNote(event, stringIndex, ctx?): Promise<void>;

export async function toggleDecoration(
  eventId: string, stringIndex: number, decoration: Decoration,
  ctx?: MutateContext,
): Promise<void>;
```

`ctx` stays the last parameter, so every existing call and test keeps its meaning.

## `insertNote`

- `techniques` absent or empty: stores `{}`, exactly as today.
- Otherwise: stores `{ [String(stringIndex)]: [...techniques] }`.

## `stackNote`

Reads the row inside one `mutateBatch`, so the patch is built from what is stored rather
than from the row the caller rendered.

- `frets` gains or replaces the string, and a rest becomes `notes`, as today.
- The string's list becomes `techniques`, or is removed when none are given. Every other
  string is untouched.
- **`techniques` joins the patch only if the map changes.** A plain stack on a clean string
  therefore writes the same field clocks as today.
- A `dead_note` or unknown entry on a **replaced** note is dropped: the note it belonged to
  has gone (FR-004).

## `unstackNote`

- Removes the string from `frets`, as today, reading `frets` from its argument.
- Removes the string's `techniques` key in the same patch (FR-005).
- If the column empties it is deleted, as today.

## `toggleDecoration`

The one operation with no precedent here, and the reason FR-029 can hold.

```text
inside one mutateBatch:
  row = read the event by id
  stop, writing nothing, if:
    the row is missing or tombstoned,
    the string has no note,
    it would turn on and the list is already at MAX_TECHNIQUES_PER_STRING
  if the decoration is present: remove every copy
  else: append it
  if the list is now empty: delete the string's key
  patch { techniques } only
```

| Guarantee | Why |
|---|---|
| Takes an id, never a row | A stale render cannot be the base of a write. |
| Reads inside the transaction | Two quick toggles serialise, so the second sees the first. |
| Flips what is stored | Two taps on one toggle land as on, then off. |
| Patches only `techniques` | No other field gets a new clock. |
| Keeps every other entry | FR-006: other strings, a transition, `dead_note`, unknown entries. |
| Never exceeds the cap | One over-long row makes the push route refuse the device's whole batch. |
| Writes nothing when nothing changes | No empty outbox rows (compare F7). |

## What is deliberately not here

- No operation sets or clears a transition on its own. Transitions change by stacking
  (spec assumption).
- No operation names a source.
- No migration, and nothing under `src/db/`, `drizzle/` or `src/lib/sync/`.
