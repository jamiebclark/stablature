# Contract: comparing a variant with its parent

Public surface of `src/lib/reading/played.ts`, `align.ts`, `compare.ts` and `marks.ts`. All React-free.
Shapes are in [data-model.md](../data-model.md).

```ts
// align.ts: integers in, matched pairs out. Knows nothing about music.
export const MAX_EDITS = 512;
export interface Alignment { matches: readonly (readonly [number, number])[]; coarse: boolean }
export function alignColumns(
  parent: Int32Array,
  variant: Int32Array,
  isBarline: (content: number) => boolean,
): Alignment;

// played.ts
export function playedColumns(
  events: readonly EventRow[],
  annotations: readonly AnnotationRow[],
  strings: number,
  intern: (signature: string) => number,
): PlayedColumn[];

// compare.ts
export function compareParts(parent: PartInput, variant: PartInput, strings: number): VariantComparison;
export function compareVariants(content: SongContent, tuning: Tuning): ReadonlyMap<string, VariantComparison>;

// marks.ts
export function staffMarks(comparison: VariantComparison, drawn: DrawnSlice): StaffMarks;
```

## When a part is compared

`compareVariants` returns an entry for a part exactly when all of these hold:

- `part.variantOfPartId` is not null.
- It is not the part's own id.
- A live part in `content.parts` has that id.

The parent is that part, and nothing further up. `content.parts` is already live and of this song, so
one lookup covers both. There is no parameter for choosing a parent.

## Building the ops

1. Sign each part once, sharing one interning table.
2. `alignColumns` on the content arrays. Cost: a change, an addition and a removal are one each. A
   barline may not substitute for a non-barline. Trim the common prefix and suffix first. If the edit
   count passes `MAX_EDITS`, treat the trimmed middle as one run and set `coarse`. Budget is counted in
   edits, never time.
3. Between matches, rebuild each run in order: pair the two heads if both are barlines or neither is,
   otherwise emit the barline as `removed` or `added` and advance past it. Emit what is left as `added`
   or `removed`. A pair with equal content is `same`, otherwise `changed`.
4. **Continuation.** For each `same` whose previous op is also `same`, with `to` and `from` each one
   above the previous op's: if `joined` differs, it becomes `changed`, with the words `group changed`.
5. Set `before` and `bar` on each `removed` from the next variant column.
6. Build `words` on each `changed` from the two columns.

The result for two parts depends only on their content. No id, clock, random value or iteration order
of an object may enter it.

## Worked examples, exact

Parent `5 7 8 | 5 7 8`.

| Variant | Ops that are not `same` | `line` |
|---|---|---|
| `5 7 8 \| 5 7 8` | none | `Same as A` |
| `5 7 9 8 \| 5 7 8` | `added` 9 | `Differs from A in bar 1: 1 added` |
| `5 7 9 \| 5 7 8` | `changed` 8 to 9 | `Differs from A in bar 1: 1 changed` |
| `5 7 \| 5 7 8` | `removed` 8, before the barline | `Differs from A in bar 1: 1 removed` |
| `5 7 8 5 7 8` | `removed` barline, before the second 5 | `Differs from A in bar 1: 1 removed` |
| `5 7 8 \| 5 7 9 10` | `changed` 8 to 9, `added` 10 | `Differs from A in bar 2: 1 changed, 1 added` |

Further exact cases:

| Parent | Variant | Result |
|---|---|---|
| `7x8` | `7x4 7x4` | Same |
| `7x8` | `7x6` | 2 removed |
| `a b c d e` | `e f g h i` | 5 changed, never 4 removed and 4 added |
| `[a b c]` | `[b c]` | 1 removed, and `b` unmarked |
| `[a b c]` | `[a n b c]` with `n` ungrouped | 1 added, and `b` unmarked |
| `[a b][c d]` | `[a b c d]` | `c` changed, words `group changed` |
| Empty | Empty | Same |
| Empty | `5 7` | 2 added |
| `5 7` | Empty | 2 removed, `removedAtEnd` 2, bar 1 |

## `words`

Joined with `, ` in this order. Strings are numbered from 1, as in the column description.

| Field | Words |
|---|---|
| Kind | `rest to notes` |
| Fret | `fret 5 to fret 7 on string 2`, `fret 7 added on string 2`, `fret 5 removed on string 2` |
| Technique | `bend added on string 2`, `bend removed on string 2` |
| Duration | `duration quarter to eighth`, with `unset` for none and the raw value if unknown |
| Group | `group changed` |
| Chord | `chord Am to C`, `chord C added`, `chord Am removed` |

Technique and duration words come from `TRANSITIONS`, `DECORATIONS` and `DURATIONS`, not new strings.
A technique in none of those reads by its stored id.

## `staffMarks`

```ts
export interface DrawnSlice {
  events: readonly EventRow[];     // exactly what the staff is given
  fromBar: number | null;
  toBar: number | null;
  density: Density;
}
```

1. Column ops (`changed`, `added`) are kept when their `eventId` is in `events`.
2. `removed` ops are kept when `bar` is in `[fromBar ?? 1, toBar ?? ∞]`.
3. A kept removal is drawn before `before` if that column is drawn, otherwise at the end of the staff.
4. **Compact.** Marks fold to `eventId-0`: `+` if every repetition is `added`, otherwise `*`. Removals
   inside a repeated column move to before it, and those in one gap add up.
5. `line` counts the ops kept in steps 1 and 2, before folding. So counts do not depend on density, and
   the view is not an input at all.

The song page calls this with the whole part and nulls. The play view calls it with `pass.events` and
the step's bars. There is no other caller.

## The line

Count words, omitted when zero, in this order: `N changed`, `N added`, `N removed`.

| Case | `line` |
|---|---|
| Nothing kept, whole part | `Same as A` |
| Nothing kept, sliced | `Same as A in these bars` |
| One bar | `Differs from A in bar 4: 2 changed, 1 added` |
| Two bars | `Differs from A in bars 2 and 5: 1 changed, 1 added` |
| Three or more, not consecutive | `Differs from A in bars 2, 5 and 7: 3 changed` |
| A run of three or more consecutive bars | `Differs from A in bars 2–5: 4 changed`, and runs mix: `bars 2–5 and 8` |
| Any of those, sliced | The same, ending `, in these bars only` |

A pass is sliced when `fromBar` or `toBar` is set. Bar numbers are the part's own, so a pass of bars 3-4
says `bar 3`, not `bar 1`.

## What a screen reader hears

| Element | Label |
|---|---|
| Changed column | The column's description, then `. Changed from A: <words>` |
| Repeated column in compact, some marked | `. Changed from A in 3 of 8 repetitions: <words of the first>` |
| Added column | The description, then `. Added, not in A` |
| Removal gap | `2 columns removed from A here`, or `1 column` |

## Budget

| Case | Budget | Measured in Node |
|---|---|---|
| SC-009: `compareVariants`, 20 variants of 1,000 columns, ten differences each | 20 ms | About 7 ms, signatures included |
| SC-010: two unrelated parts of 5,000 | 50 ms | About 2.4 ms |
