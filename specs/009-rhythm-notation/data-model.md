# Data model: Rhythm notation under the tab

**Feature**: `009-rhythm-notation` | **Plan**: [plan.md](./plan.md)

**Nothing is stored.** No field, table, key, migration, outbox entry or sync message is added or changed (FR-033). Every entity below is
derived on each render from data that already exists (`EventRow`, `TabColumn`), and it is thrown away afterwards.

## Inputs (existing, unchanged)

| Source | Fields read | Where |
|---|---|---|
| `EventRow` | `id`, `kind`, `durationHint`, `tupletId`, `tupletCount`, `groupKind`, `repeat` | `src/lib/model.ts` |
| `TabColumn` | `eventId`, `kind`, `repetition`, `repeat`, `duration`, `tupletId`, `bracketNumber` | `src/lib/tab/layout.ts` |
| `TupletSpan` | `tupletId`, `count`, `start`, `end` | `src/lib/tab/layout.ts` |
| `DURATIONS`, `TICKS_PER_BEAT` | `id`, `ticks` | `src/lib/rhythm/durations.ts` |

## BarPosition (new, derived)

Where a column's hit starts within its bar, or nothing when that cannot be known. `barPositions` in `src/lib/rhythm/notation.ts` produces
it by calling `readBar`, the same arithmetic the click uses (research R3).

```ts
export interface BarPosition {
  /** Ticks from the start of the bar this hit is in. */
  readonly tick: number;
  /** The group's id when the hit is in a counted group that reads; otherwise null. */
  readonly countedGroup: string | null;
}

/** Key: `${eventId}:${repetition}`. A missing key means the position is unknown. */
export function barPositions(events: readonly EventRow[]): ReadonlyMap<string, BarPosition>;
```

**Rules**

- Bars are split at `kind: "barline"`. Each bar starts at tick 0 (FR-005). Only `notes` and `rest` rows count, which matches `playable`.
- `census` runs once over `events`, exactly as `walk` does for a pass.
- Within a bar, each hit is recorded up to, but not including, the first column that has no readable duration, or the first column of a
  group that does not read. From that column to the end of the bar, nothing is recorded (FR-008).
- A failing bar never stops the next bar (FR-006).
- A repeated row records one entry per hit, `repetition` 0 to `repeat − 1` (FR-010).
- No time signature, bar length or `beatsPerBar` is read (FR-005).

## RhythmMark (new, derived)

What one layout column draws in the rhythm row. `rhythmMarks` in `src/lib/rhythm/beams.ts` produces it, one entry per column, at the same
index as `layout.columns`.

```ts
export type RhythmMark =
  | { readonly kind: "none" }
  | {
      readonly kind: "note";
      readonly duration: DurationId;
      /** 0 for w, h, q; 1, 2 or 3 for 8, 16, 32. */
      readonly levels: 0 | 1 | 2 | 3;
      /** Flags drawn: `levels` when the note is in no run, else 0. */
      readonly flags: 0 | 1 | 2 | 3;
      /** Beam levels shared with the previous column. 0 when not joined. */
      readonly left: 0 | 1 | 2 | 3;
      /** Beam levels shared with the next column. 0 when not joined. */
      readonly right: 0 | 1 | 2 | 3;
      /** Levels above max(left, right) inside a run: drawn as stubs on `stubSide`. */
      readonly stubs: 0 | 1 | 2;
      readonly stubSide: "left" | "right" | null;
    }
  | { readonly kind: "rest"; readonly duration: DurationId };

export function rhythmMarks(
  columns: readonly TabColumn[],
  positions: ReadonlyMap<string, BarPosition>,
  density: Density,
): RhythmMark[];
```

**Rules** (`contracts/beaming.md` gives the full table)

| Column | Mark |
|---|---|
| `kind: "barline"` | `none` |
| `duration === null` (unset or unknown value) | `none` (FR-003) |
| `kind: "rest"` with a duration | `rest` (FR-002) |
| `kind: "notes"` with `w`, `h` or `q` | `note`, levels 0 |
| `kind: "notes"` with `8`, `16` or `32` | `note`, levels 1 to 3; beamed or flagged by the run rule |

- **Beamable** means a note with levels ≥ 1, not a compact repeat, with a known position.
- **Unit** is `g:<countedGroup>` if `countedGroup` is set, else `b:<tupletId ?? "">:<floor(tick / TICKS_PER_BEAT)>`.
- **Run** is a maximal run of consecutive columns that are all beamable and share one unit.
- Inside a run: `left`/`right` = `min(levels)` of each neighbouring pair; `stubs = levels − max(left, right)`; `stubSide` = `"right"` on the
  run's first column, else `"left"`; `flags = 0`.
- Outside a run, where the run would hold one column or the column is not beamable: `left = right = stubs = 0` and `flags = levels`.
- **Invariant of the data**: for every adjacent pair, `marks[i].right === marks[i+1].left`. `beams.test.ts` asserts it over the corpus, so a
  beam is never half drawn.

## GroupLabels (new, derived)

```ts
/** The one column index per group id that draws its number, or none for a plain group. */
export function groupLabels(spans: readonly TupletSpan[]): ReadonlyMap<string, number>;
```

- Its key is `tupletId`. Its value is `floor((start + end) / 2)` of the **first** span that has that id, and only when that span's `count`
  is not null.
- `src/lib/tab/layout.ts` is not edited. `groupLabels` lives beside `rhythmMarks` in `src/lib/rhythm/beams.ts`, and `TabStaff` calls it for
  both placements (FR-014, research R6).

## BracketRow (new, derived, per staff)

```ts
type BracketRow = "above" | "under" | null;
// null:     the staff has no group span
// "under":  the staff draws a rhythm row (showRhythm && some column has a duration)
// "above":  otherwise
```

`TabStaff` computes it once. Every row spacer, offset and gap reads this value, and nothing re-derives it (research R7).

## DurationButton (changed shape, not stored)

`ColumnSegment` in `src/lib/capture/properties.ts` gains one optional field:

```ts
export interface ColumnSegment {
  readonly value: string;
  readonly label: string;       // still `d.mark`; drawn only when `symbol` is absent
  readonly ariaLabel: string;   // `d.words`; also the button's title (FR-028)
  readonly on: boolean;
  readonly symbol?: DurationId; // new: draws <NoteSymbol id={symbol} />
}
```

## State transitions

None are stored. The only visible transition belongs to the staff, and it is a pure function of the part's events:

```text
no column has a duration ──(first duration set)──▶ rhythm row drawn, brackets under the tab, band padding dropped
        ▲                                                               │
        └────────────────────(last duration cleared)────────────────────┘
```

Both directions are re-renders. Neither is a write beyond the existing `setColumnDuration` (FR-034).
