# Data model: Import ASCII tab by pasting text

**No stored model changes.** No new table, column, field or wire shape, and no migration (FR-039).
Everything below is transient and lives only while the paste box is open. Field-level contracts
are in [contracts/](./contracts/).

## Stored rows this entry writes

All through `mutate.ts`, in one `mutateBatch`, in this order.

| Row | When | Fields of note |
|---|---|---|
| `TuningRow` | The offer is a preset the band lacks | From `createTuningFromPreset`, `isDefault: false` |
| `SongRow` patch | Any offer was taken | `tuningId` only |
| `PartRow` | Always, exactly one | From `createPart`: next letter, `rankAtEnd`, `name: null` |
| `EventRow` | One per column | From `pasteClipboard`: new id, spread rank, `durationHint: null` |
| `AnnotationRow` | One per chord | `kind: "chord"`, anchored to the new column |

**Column states written**, all within the stored-states table of spec 003:

| Column | `kind` | `frets` | `repeat` | `tupletId` | `tupletCount` | `groupKind` |
|---|---|---|---|---|---|---|
| Notes, ungrouped | `notes` | one entry or more | 1 to 512 | null | null | null |
| Space | `rest` | `{}` | 1 to 512 | null or shared | as its group | as its group |
| Barline | `barline` | `{}` | 1 | null | null | null |
| In a counted group | `notes` or `rest` | | | new shared id | 2 to 16 | `"tuplet"` |
| In a plain group | `notes` or `rest` | | | new shared id | null | `"plain"` |

## Transient entities

### Paste

The text as given. Never stored. Line numbers count from 1 at the first line, blanks included,
after line endings are split on `\r\n`, `\r` or `\n`.

### Line

| Field | Meaning |
|---|---|
| `number` | 1-indexed |
| `text` | As pasted, for messages |
| `kind` | `blank`, `bracket`, `chord`, `heading`, `staff`, `commentary` |

### Staff row

| Field | Meaning |
|---|---|
| `line` | The line it came from |
| `label` | Written label or null |
| `opening` | Had an opening pipe |
| `closing` | Had a closing pipe |
| `bodyStart` | Character index of the body in the line, the row's own origin (FR-012) |
| `body` | The text between the pipes, or after the label |

### Cell

One note on one row.

| Field | Meaning |
|---|---|
| `row` | Row index in the system, which becomes the string index (FR-002) |
| `start`, `end` | Inclusive offsets within the body |
| `fret` | `0` to `36`, or `"x"` |
| `decorations` | Technique ids drawn on it |
| `connector` | The transition arriving at it, or null |
| `repeat` | From a label, or null |

### System

| Field | Meaning |
|---|---|
| `rows` | Its staff rows, top first |
| `chordLine`, `bracketLine` | The lines above it, if any |
| `columns` | Its drawn columns, in order |

### Drawn column

The unit that chords and brackets anchor to, and that merging works on. It exists before a stored
column does.

| Field | Meaning |
|---|---|
| `start`, `end` | Extent in the system. Spaces read from rails have a position only |
| `kind` | `notes`, `rest`, `barline` |
| `cells` | One per played string |
| `chord` | Placed chord, or null |
| `group` | Index of the bracket it sits under, or null |

### ParsedTab

The result of `parseTab`: `{ ok: false, refusals }`, or `{ ok: true, ... }` holding these.

| Field | Meaning |
|---|---|
| `clipboard` | The columns and chords, in the existing `Clipboard` shape |
| `rows` | One entry per row: label or null, and whether anything is on it |
| `density` | `compact` when any repeat label was read, else `expanded` |
| `ignored` | Commentary lines: number and text |
| `spaces` | How many space columns were read from rails |
| `moved` | Chords anchored off their exact column |
| `clipped` | Chords reaching the end of the body |

### Refusal

| Field | Meaning |
|---|---|
| `line` | Number, or null when it concerns the paste as a whole |
| `text` | The line as pasted, or `""` |
| `code` | One of the codes in [contracts/reader.md](./contracts/reader.md) |
| `reason` | Plain words |

One refusal per line, the first found, sorted by line. Refusals with a null line come first.

### Fit

| Kind | Fields | Meaning |
|---|---|---|
| `fits` | `tuning`, `leftOut` | Import onto the song's tuning. `leftOut` names empty rows dropped |
| `offer` | `tuning`, `name`, `source` | `source` is `{ tuningId }` or `{ presetId }` |
| `refused` | `refusal` | A `Refusal` with a tuning code |

`fitKey` is `"fits"`, `tuning:<id>` or `preset:<id>`. It is what the button promised, and what
the write checks.

### TabReading

| Kind | Fields |
|---|---|
| `idle` | The box holds only whitespace |
| `refused` | `refusals`, never empty |
| `ready` | `clipboard`, `density`, `fit` (`fits` or `offer`), `tuning`, `fitKey`, `ignored`, `notes`, `columns`, `bars` |

A `ready` reading holds no refusals and a `refused` reading holds no columns, so the type itself
says "never both". `columns` counts stored columns other than barlines. `bars` is `countBars`.

### Reading note

Everything FR-030 means by "ignored, left out or assumed", other than ignored lines.

| Kind | Example |
|---|---|
| `spaces-read` | "3 spaces read from the rails" |
| `unlabelled` | "Rows had no labels, so they were read top down as G D A E" |
| `row-left-out` | "The empty B row was left out" |
| `row-name-differs` | "Row 4 is labelled D and the song's string is E. Nothing is on it" |
| `chord-moved` | "Am on line 3 moved to the nearest column" |
| `chord-clipped` | "The chord at the end of the staff may have been cut short" |

### ImportResult

| Kind | Meaning |
|---|---|
| `imported` | `part`: the new part |
| `changed` | Nothing was written. The re-read no longer matches what the button promised |

A failed local write is a rejected promise, not a result. The transaction has already rolled back.

## State of the paste target

```text
closed --tap paste tab--> open/idle
open/idle --text--> open/refused | open/ready
open/refused <--text--> open/ready
open/ready --tap import--> importing
importing --imported--> closed, new part in view
importing --changed--> open/refused | open/ready, with a message
importing --write failed--> open/ready, text kept, with a message
open/* --cancel--> closed, text discarded
```

`importing` is held in a ref as well as in state, because a state update is not visible to a
second tap in the same frame (FR-037).

## Validation rules, and who applies them

| Rule | Source | Applied by |
|---|---|---|
| Fret 0 to 36 | `MAX_FRET`, wire | `parse.ts` |
| Repeat 1 to 512 | `MAX_REPEAT`, wire | `parse.ts`, and the merge splits at it |
| Group number 2 to 16 | `MIN_GROUP_COLUMNS`, `MAX_TUPLET_COLUMNS`, wire | `parse.ts` |
| Chord at most 200 characters | `MAX_CHORD_LENGTH`, wire | `parse.ts` |
| A row with anything on it stays on a string of its name | Fit rule | `reading.ts` |
| Every existing note keeps its pitch | Offer rule | `reading.ts` |
