# Data model: generalised grouping

Phase 1 for [plan.md](./plan.md). One stored field is added. Everything else here is derived.

## Stored

### Column (`EventRow`, table `events`)

| Field | Type | Change |
|---|---|---|
| `tupletId` | `string \| null` | Unchanged. Shared by a group's columns within a part. |
| `tupletCount` | `number \| null` | Unchanged range (2 to 16 on the wire). Null for a plain group. |
| `groupKind` | `"tuplet" \| "plain" \| null`, optional | **New.** Absent on rows written before this entry. |

**Valid states** (spec, Stored states):

| State | `tupletId` | `tupletCount` | `groupKind` | Reads as |
|---|---|---|---|---|
| Not grouped | null | null | null or absent | No bracket |
| Counted tuplet | id | 2 to 16 | `"tuplet"` | Bracket with its count |
| Plain group | id | null | `"plain"` | Bracket with no number |
| Grouped before this entry | id | its count | null or absent | Bracket with its count |
| Legacy null count | id | null | null or absent | Bracket with 3, as today |
| Written by an older cached device over a plain group | id | a count | `"plain"` | Bracket with its count (research R2) |

The last two are read, never written. Every write produces one of the first three.

**Validation**

- Wire: `groupKind` accepts `"tuplet"`, `"plain"`, null, or absence, and nothing else.
- App: a counted tuplet holds 2 to 16 columns. A plain group holds 2 or more. Neither crosses
  a barline, and a barline is never in a group. These hold at write time only. Later edits can
  leave a group shorter, split, or stale, as the spec's Assumptions accept, so no reader may
  assume them.
- A column's number is the count of its group's columns at the moment of the write, with a
  rest counting as one and `repeat` ignored.

**Sync**: `groupKind` joins `MERGEABLE_FIELDS.events`, after `tupletCount`, so `stampNewRow`
clocks it and merge compares it per field. All three fields are always patched together with
one clock, so they win or lose as a set.

**Postgres**: `group_kind` column, enum type `group_kind`, nullable, no default, no backfill.

**IndexedDB**: no version change. The field is not indexed.

### Clipboard (`ClipboardColumn`, in `meta`)

| Field | Change |
|---|---|
| `tupletGroup` | Unchanged. Group by position in the copied run. |
| `tupletCount` | Unchanged. |
| `groupKind` | **New, optional.** Absent on a clipboard saved before this entry, and pasted as null. |

Paste mints a fresh id per `tupletGroup`, so a pasted group is separate from its source.

## Shared declarations (`src/lib/model.ts`)

| Name | Value | Read by |
|---|---|---|
| `GROUP_KINDS` | `["tuplet", "plain"]` | `GroupKind`, the wire enum |
| `MIN_GROUP_COLUMNS` | 2 | `groupOffer`, `runEndingAt` |
| `MAX_TUPLET_COLUMNS` | 16 | `groupOffer`, `runEndingAt`, the wire's `tupletCount` cap |
| `NO_GROUP` | all three fields null | Every creation path, every dissolve and ungroup |
| `groupNumber(row)` | number to print, or null | `layoutPart`, the sheet's heading |

## Derived, never stored

### Group

The columns of one part sharing a `tupletId`. A variant's copy shares its parent's id, so a
group is identified by **id within a part**, and every write is scoped to one `partId`.

### `GroupOffer` (`src/lib/capture/grouping.ts`)

What a selection can do. See [contracts/writes.md](./contracts/writes.md).

| Field | Meaning |
|---|---|
| `tuplet` | The columns of the one counted tuplet on offer, or null. Its length is the numeral. |
| `plain` | One run per bar holding 2 or more selected playable columns. Empty means no control. |
| `ungroup` | Whether any selected column is in a group. |

Runs come from splitting the selection on barlines. All selected playable columns are in one
bar exactly when one non-empty run exists.

| Selection (`|` is a barline) | Runs | Tuplet | Group | Ungroup |
|---|---|---|---|---|
| `a` | [a] | no | no | if `a` is grouped |
| `|` | none | no | no | no |
| `a b` | [a b] | 2 | one group | if any is grouped |
| `| a b c |` | [a b c] | 3 | one group | if any is grouped |
| `a | b` | [a] [b] | no | no | if any is grouped |
| `a b | c` | [a b] [c] | no | `a b` only | if any is grouped |
| `a b | c d` | [a b] [c d] | no | two groups | if any is grouped |
| 16 columns, one bar | one run | 16 | one group | if any is grouped |
| 17 columns, one bar | one run | no | one group | if any is grouped |

### `TupletSpan` (`src/lib/tab/layout.ts`)

`{ tupletId, count: number | null, start, end }`, derived at draw time. `count` is null for a
plain group, and the shape is otherwise unchanged. A legacy group across a barline still gives
two spans, each with its stored number, as it does today.

### `TabColumn`

`tupletCount` is replaced by `bracketNumber: number | null`, the column's `groupNumber`, or
null outside a group. `tupletId` is unchanged.

## State transitions

Every action writes all three fields on every column it touches, and only those columns.

| Action | Joining columns | Other columns of any group that lost one | Everything else |
|---|---|---|---|
| Tuplet control | new id, run length, `"tuplet"` | `NO_GROUP` | Not written |
| Group control | new id per run, null, `"plain"` | `NO_GROUP` | Not written |
| Triplet button, `tripletFromTail` | new id, count, `"tuplet"` | `NO_GROUP` | Not written |
| Refused triplet | Not written | Not written | Not written |
| Ungroup, either route | `NO_GROUP`, for every column of each affected group in the part | n/a | Not written |

A selected column that joins nothing, such as a lone column in its bar, is not written unless
its own group lost a column to the new group.
