# Data model: Usability pass

**No stored shape changes.** No table, column, migration, sync message or export byte is added. Everything below is derived while
drawing, held in memory, or kept on the device. `src/lib/model.ts` has no diff.

## On the device

### Panel state

| Field | Type | Rule |
|---|---|---|
| key `stablature.panels` | JSON object in `localStorage` | Never synced, never on a song |
| `song-tools`, `song-arrange`, `play-cluster` | boolean | Absent or anything but `true` reads as closed |

Rules, from `reading/view.ts`:

- Storage may be missing, may throw on read or write, and may hold anything. Each reads as closed and never throws.
- A refused write still changes the screen for the visit.
- The server snapshot is closed for every panel, so the first client render matches, and a remembered panel opens before paint.
- An unknown key in the stored object is kept when writing, so a later version's panel survives an older build.
- A second tab's change reaches the first through the `storage` event.

## In memory, per screen

### Keyboard string (capture)

| Field | Type | Rule |
|---|---|---|
| `stringIndex` | number, 0 is the highest string | Starts on the lowest string, `stringCount - 1`. Clamped when the tuning changes. Never stored |
| `used` | boolean | False until the first keyboard shortcut on capture. The neck marks the string only when true |

### Fret entry (capture)

A pure reducer in `src/lib/keys/fretEntry.ts`. State is `{ waiting: 1 | 2 | null }`.

| Input | From | Result |
|---|---|---|
| `0`, `3`–`9` | nothing waiting | Enter that fret |
| `1`, `2` | nothing waiting | Wait, and show the digit |
| Any digit `d` | `w` waiting, `10w + d` ≤ highest fret | Enter `10w + d` |
| Any digit `d` | `w` waiting, `10w + d` > highest fret | Enter `w`, then treat `d` as new |
| Enter, or about 600ms passing | `w` waiting | Enter `w` |
| Any other key, sheet opening, part changing | `w` waiting | Enter `w`, then act on the key |
| Leaving the screen | `w` waiting | Enter nothing. The digit was never confirmed |

The highest fret is `Fretboard`'s `maxFret`, exported as one constant so the reducer and the neck read the same number.

### Reading position (play view)

| Field | Type | Rule |
|---|---|---|
| `pass` | index into `passes` | |
| `key` | `columnKey(eventId, repetition)` | The same text `TabStaff` puts on the column |
| `source` | `"click"` or `"keys"` | Keys set it only while stopped. Starting the click clears it |

Never stored. Lost on leaving the page.

## Derived from existing rows

### ColumnTick

From `notationColumns(passes)`, in the same walk as `readNotation`.

| Field | Type | Meaning |
|---|---|---|
| `tick` | number | From the first moment of the first bar, the same zero as `ScoreClick.tick` |
| `pass` | number | Index into `passes` |
| `eventId`, `repetition` | | Which column |

Sorted by tick, ending with the last timed column. Empty when the first bar is not timed.

### ReadingStop

From `readingStops(passes)`: every column that can hold the reading position, timed or not. Barlines are not stops.

| Field | Type | Meaning |
|---|---|---|
| `pass`, `key` | | As above |
| `bar` | number | The running bar number, from `passBars` |

### Bars

From `passBars(passes)`:

| Field | Type | Rule |
|---|---|---|
| `offset` | number per pass | The sum of `countBars(events)` over every earlier pass |
| `total` | number | Sum over all passes |

A column's running number is `offset + column.barNumber`. `column.barNumber` restarts at 1 in a slice, because `layoutPart` numbers
what it is handed. A trailing barline opens nothing, and a pass with no notes adds nothing, because `countBars` says so.

`barStarts(columns)` gives each column that opens a bar: the first non-barline column with a new `barNumber`. A bar with no
columns gets no number, and the numbering still counts it.

### Section visit

Added to `ArrangementStep` by `expandArrangement`, alongside `sections`, which does not change.

| Field | Type | Meaning |
|---|---|---|
| `visits` | `{ label, time, opens }[]` | One per enclosing named section, outermost first |
| `label` | string | As typed |
| `time` | number, from 1 | Which time through, counted over the whole song by name |
| `opens` | boolean | This step is the first played in that visit |

Rules:

- A name is compared trimmed and without case, so `Verse` and `verse ` count together.
- A visit with no steps played does not count.
- A section with no name has no visit.
- Each pass of `Verse ×2` is one visit. So are non-adjacent sections of the same name.
- The heading shows when any visit opens. From the second time, it reads `Verse, 2nd time`.

### Part heading

From `partHeading(part events, bpm)`:

| Field | Type | Rule |
|---|---|---|
| `tempo` | number or null | `usableTempo(bpm)`. Null leaves it out |
| `beats` | number or null | Below |

`beatsPerBar(events)` reads each bar with the same `readBar` the click uses:

- Every bar must be timed and all must have the same length, a whole number of beats.
- A leading or trailing empty bar is skipped. An empty bar in the middle gives null.
- A pickup, or any bar that differs, gives null.
- Shown as `4 beats a bar`, or `1 beat a bar`. Never a fraction.

### Chord room

From `chordRooms(columns)`, one per column with a chord:

| Field | Type | Meaning |
|---|---|---|
| `chars` | number | Characters in the symbol |
| `roomChars` | number | Sum of `width` over the columns it owns |
| `roomColumns` | number | How many columns it owns |

It owns its own column and those after it, up to the next chord, or through the closing barline, or to the last column. See
[contracts/staff.md](./contracts/staff.md).

## State transitions

**Reading position.**

```text
none ──start──> counting in ──end of count-in──> on a column ──last timed column passes──> none
                                                      │
none ──key──> keyed ──start──> counting in     stop ──┴──> none
```

**Panel.** Closed and open, on the panel's control only. Nothing else changes it.

**Help overlay.** Closed and open. `?` toggles it. Esc and its close control close it.
