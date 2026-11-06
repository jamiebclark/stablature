# Contract: the staff

**Normative** for `src/components/tab/TabStaff.tsx` and `src/lib/reading/staff.ts`.

`src/lib/tab/layout.ts` and `src/lib/tab/ascii.ts` have **zero diff**. Everything here is on the drawing side. A `TabColumn` keeps its
shape and values, so the export has no route to a screen width, a bar number or a line.

## 1. New props

```ts
export interface TabStaffProps {
  // ...as now...
  /** Draws a bar number row. `offset` is added to each column's `barNumber`. Off for capture and the paste preview. */
  barNumbers?: { offset: number };
  /** Breaks at barlines across as many lines as it needs. Play view only. */
  wrap?: boolean;
  /** Which pass this is, written on the wrapper for the reading position. */
  pass?: number;
  /** Bumped to bring the newest group into view once it is drawn. */
  revealGroups?: number;
}
```

| Surface | `barNumbers` | `wrap` | `showRhythm` |
|---|---|---|---|
| Song page | `{ offset: 0 }` | no | yes |
| Play view | `{ offset: passBars.offset[i] }` | yes | yes |
| Capture | no | no | no |
| Paste preview | no | no | no |

## 2. `src/lib/reading/staff.ts`

```ts
export interface ChordRoom { chars: number; roomChars: number; roomColumns: number }
export function chordRooms(columns: readonly TabColumn[]): Map<number, ChordRoom>;
export function barRuns(columns: readonly TabColumn[]): { start: number; end: number }[];
export function barStarts(columns: readonly TabColumn[]): Set<number>;
```

- `chordRooms`: see [data-model.md](../data-model.md). The key is the column's index.
- `barRuns`: inclusive index ranges, each ending with its closing barline. The last may have none. Every column is in exactly one.
- `barStarts`: indices of columns that open a bar. Never a barline. An empty bar has none.

All three are pure, and they import no React.

## 3. A column's width

```text
calc(<width>ch + var(--col-pad))                                     // no chord, or no widening needed
calc(<width>ch + var(--col-pad) + max(0px, <chars> * var(--chord-ch) + var(--chord-gap)
     - (<roomChars>ch + <roomColumns> * var(--col-pad))))            // a chord
```

`0.6rem` no longer appears in `TabStaff`. On a wrapped staff the column is `flex: 1 0 <that width>`, and elsewhere it is `width`.

## 4. Rows, in order

| Row | Height | Drawn when | Text |
|---|---|---|---|
| Bar number | `--staff-row` | `barNumbers`, and the part has columns | 12px, `--text-dim`, left of its column, `data-testid="tab-bar-number"` |
| Chord | `--staff-row` | Any chord | `text-[0.7rem]`, semibold, accent, `nowrap`, no `truncate`, `relative z-[1]` |
| Bracket | `--staff-row` | Any group | See below |
| Strings | `--string-height` each | Always | |
| Rhythm | `--staff-row` | `showRhythm` and any duration | 12px, `text-center` |
| Diff mark | 1.1rem | Marks | As now |

`offsetFor` counts the bar-number row too, so labels, carets and empty staves stay aligned.

**Bracket row.** The line is at `bottom: 0`, its hooks 0.2rem. The numeral is 12px with `line-height: 12px`, at `top: 0`, centred.

**Rhythm.** The mark's row is centred and takes the column's width, so its centre is the cell's. A mark of `32` is 14.4px, inside the
16.39px mouse column and the 19.19px touch column, and never widens either.

**Bar numbers** sit inside their own column. A column that opens a bar takes `min-width: calc(<digits> * 0.45rem)`, since a 12px digit is 7.2px. So a number can never overflow, and cannot reach another. One or two digits fit every column as it is. From bar 100, a one-digit column widens by 2.4px on touch.

## 5. Wrapped markup

```html
<div class="tab-staff tab-staff-wrapped" data-pass="3">
  <div class="tab-gutter" aria-hidden="true">
    <div class="tab-gutter-block">…rows, with the label cells…</div>  <!-- one per bar -->
  </div>
  <div class="tab-lines" role="group" aria-label="Tablature">
    <div class="tab-bar-run">…columns, gaps, removal gaps, closing barline…</div>
    <div class="tab-lines-end"></div>
  </div>
</div>
```

```css
.tab-staff-wrapped { position: relative; padding-left: var(--gutter); }
.tab-gutter { position: absolute; inset-block: 0; left: 0; width: var(--gutter); overflow: hidden; }
.tab-gutter-block { margin-bottom: var(--line-gap); }
.tab-lines { display: flex; flex-wrap: wrap; row-gap: var(--line-gap); }
.tab-bar-run { display: flex; flex: 1 0 auto; max-width: 100%; overflow-x: auto; scrollbar-width: none; }
.tab-bar-run::-webkit-scrollbar { display: none; }
.tab-lines-end { flex: 9999 0 0; }
```

- Each block in the gutter is built from the same row components as a column, so it has the same height by construction.
- The caption stays in the card's padding.
- `RemovalGap` and `Gap` go in the run of the column they come before. A removal after the last column goes in the last run.
- A column's bracket comes from `spanAt(index)` over the whole layout, as now. Groups do not cross a barline, so no span crosses a run.
- `.tab-lines` has no sideways scroll of its own.

An unwrapped staff keeps its current scroller and label column, with no new wrapper.

## 6. Bringing a new group into view

`revealGroups` is a number. `CaptureScreen` bumps it just before any write that makes a group: tuplet, plain group and the triplet
button.

An effect in `TabStaff` compares the set of `tupletId`s with the set last drawn. If the prop has moved and a new id has appeared, it
calls `scrollIntoView({ block: "nearest", inline: "nearest" })` on that group's first bracket element, then records the prop as handled.

- With no new id yet, it waits for the next delivery.
- A group arriving by sync moves nothing, because the prop has not moved.
- Changing part moves nothing, for the same reason.

A cursor moved by key is kept in view by the same call on the active column, gated on the keyboard having moved it.

## 7. The reading position on a column

Every column has `data-column="<columnKey>"`.

`.tab-column-reading`:

```css
.tab-column-reading { outline: 2px solid var(--text); outline-offset: -2px; }
@media print { .tab-column-reading { outline: none; } }
```

A full box in the text colour. The selection has fill and two rules in accent, the capture cursor one rule, a variant's mark a tint,
a glyph and weight. So it differs by shape in both themes, with no colour needed. The class is written directly on the DOM by
`useReadingPosition`, and never by React, so a staff re-render must not lose it. `useReadingPosition` reapplies it after any commit of
the passes.

## 8. What does not change

- `role="img"` and `aria-label` of a column, and its description.
- `activeEventId`, `insertAfterEventId`, `selectedEventIds`, `followTail` and press handling.
- `reading`, `marks` and `caption`.
- `Density`, and how compact draws a repeat. A wrapped staff is always expanded, as the play view is.
