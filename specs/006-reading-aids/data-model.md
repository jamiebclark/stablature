# Data model: Note names, intervals, and seeing what a variant changed

**No stored shape changes.** No table, field, wire shape, migration or IndexedDB version. Everything
below is derived on read, except one device-local string.

## Stored, on the device only

### Staff view

| | |
|---|---|
| Home | `localStorage`, key `stablature.staffView` |
| Values | `"frets"`, `"notes"`, `"intervals"` |
| Default | `"frets"` |
| Unknown or unreadable | Reads as `"frets"`. Left in place, not rewritten |
| Scope | One per device, every song, both screens. Survives signing out |
| Never reaches | Any Dexie table, the outbox, the server |

States: there is no sequence. Any value moves to any other on one tap. If the store refuses a write,
the value holds in memory for the visit.

## Derived for drawing

### Cell label

Derived per played cell, never stored. See [contracts/cells.md](./contracts/cells.md).

| Input | Source |
|---|---|
| Stored fret | `event.frets` |
| Open string | `tuning.strings[index]` |
| Chord in force | `chordsInForce(partEvents, annotations)`, over the **whole** part |
| Decorations | `event.techniques`, through `decorate` |
| Repeat | `event.repeat`, compact only |

### ReadingLayout

`TabLayout`, with `TabColumn` unchanged, plus:

| Field | Type | Meaning |
|---|---|---|
| `carriedChord` | `string \| null` | In intervals only: the symbol in force at the first drawn column when it is anchored outside what is drawn. Null if that column has its own anchor, or none is in force |
| `chordCover` | `"all" \| "some" \| "none" \| "nothing"` | Of the pitched cells drawn, how many had a readable chord. `"nothing"` when no cell has a pitch. Decides the caption |

### Chord additions

| Name | Where | Meaning |
|---|---|---|
| `Chord.bassName` | `chords.ts` | The slash bass as typed, or null |
| `anchoredChords(annotations)` | `chords.ts` | Map of event id to symbol. The one reading of where a chord sits |
| `chordsInForce(events, annotations)` | `chords.ts` | Map of event id to the symbol in force there. `chordInForceAt` is a lookup in it |
| `CHORD_QUALITIES` | `chords.ts` | The keys of `QUALITIES`, so SC-004 can walk them |

## Derived for comparing

### Played column

One drawn position in expanded density: `Math.max(1, repeat)` per note or rest event, one per barline.

| Field | Meaning |
|---|---|
| `eventId`, `repetition` | The key, shared with `TabStaff`. Used for placing marks only, never for comparing |
| `bar` | Bar in the whole part, as `layoutPart` numbers it: a barline carries the bar it closes |
| `content` | Interned id of the column's signature |
| `joined` | Whether it continues the group of the column before it |

`played.ts` and `layoutPart` must unroll identically. That is **pinned, not structural**: INV-020
checks one against the other over **H**.

### Column signature

The content of a played column as `What counts as different` defines it. Ids play no part.

| Part | Reading |
|---|---|
| Kind | `notes`, `rest`, `barline`. A barline's signature is its kind alone |
| Frets | Value per string for each string of the tuning, absent included. A fret on a string the tuning lacks is ignored |
| Techniques | Per **played** string: the stored list as a sorted set. Empty and absent are the same. A technique on an unplayed string is ignored. Undrawn techniques still count |
| Duration | `durationHint ?? null`, raw. Unknown values compare as stored, because the spec says "stored value" |
| Group | Null if `tupletId` is null, else `groupKind ?? "tuplet"` and `groupNumber(row)` |
| Chord | Repetition 0 only: `anchoredChords` value, trimmed, blank reading as none. Other repetitions carry none, as in the layout |

`joined` is **not** part of the signature (research R10).

### VariantComparison

For one variant and its declared parent. Derived on read, never stored.

| Field | Type | Meaning |
|---|---|---|
| `parent` | `PartRow` | Whose label the line names |
| `ops` | `Op[]` | The whole alignment, in order, accounting for every column of both |
| `coarse` | `boolean` | True if the search ran out of budget. Nothing is drawn differently, and it exists for tests |

`Op` is one of:

| Kind | Fields | Meaning |
|---|---|---|
| `same` | `from`, `to` | Parent column `from` and variant column `to` match |
| `changed` | `from`, `to`, `words` | Paired and different, or matched with a continuation that differs |
| `added` | `to` | Variant column with no parent column |
| `removed` | `from`, `bar`, `before` | Parent column gone. `before` is the key of the variant column that follows, or null at the end. `bar` is that column's bar, the last column's at the end, or 1 in an empty variant |

### What a staff receives

`staffMarks(comparison, { events, fromBar, toBar, density })` returns:

| Field | Type | Meaning |
|---|---|---|
| `columns` | `Map<key, { status, words }>` | Marks on drawn columns, folded for compact |
| `removals` | `Map<key, number>` | Count in the gap before a drawn column |
| `removedAtEnd` | `number` | Count at the end of the staff |
| `line` | `string` | The summary, from the same ops as the marks |
| `any` | `boolean` | Whether the mark row is drawn |

Rules are in [contracts/compare.md](./contracts/compare.md).

## Relationships

```text
PartRow.variantOfPartId ──> PartRow           the only link read, and it does not change
compareVariants(content, tuning) ──> Map<partId, VariantComparison>
  a part is a key exactly when its parent is another live part of this song

SongView:  PartCard(part)   ─ comparisons.get(part.id) ─> staffMarks(whole part) ─> TabStaff + line
PlayView:  pass(step)       ─ comparisons.get(step.partId) ─> staffMarks(drawn slice) ─> TabStaff + line
```

## Validation

No write means no write validation. The read rules are:

- An unknown stored view reads as frets.
- A fret that is not a non-negative integer shows `?` in notes and intervals.
- An unknown technique string compares as text, and draws as it does today, which is not at all.
- Rows are not repaired, rewritten or normalised.
