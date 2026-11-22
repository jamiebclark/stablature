# Data model: Cards per row follow what the cards hold

No stored data changes. No table, column, Dexie version, sync message, export or import moves (spec, Key Entities). This
file defines the **derived** values the layout reads and writes, and the one rule tests compute from them. The CSS and
hook that carry them are in [contracts/cards-per-row.md](./contracts/cards-per-row.md).

## 1. Layout tokens (`src/app/globals.css`, `:root`)

| Token | Value | Owner | Meaning |
|---|---|---|---|
| `--card-floor` | `343px` (spec 010, unchanged) | spec 010 | The phone card width. Now the cap on the head-row term, and the memo card's floor (FR-006). |
| `--card-min` | `9rem` (**new**) | this entry | The least any wide card may be (research R6). |
| `--card-gap` | `0.5rem` (unchanged) | spec 010 | Gap between cards, both axes. |
| `--card-pad-x` | `0.375rem` (unchanged) | spec 010 | A wide card's side padding. |

**Chrome** (not a token, the same `calc` spec 010's track used): `2 * var(--card-pad-x) + 2px`. That is the padding plus
a 1px border each side.

## 2. Values written by `useCardTrack` (wide only, never stored)

| Where | Property | Value | Absent when |
|---|---|---|---|
| each `li` of `.reading-cards` | `--own-staff` | `ceil(ruler.getBoundingClientRect().width)` px: the card's one-line staff, gutter included | the card has no `tab-ruler` (no tuning): the term reads as `0px` |
| each `li` | `--own-head` | `ceil` of the head row's width laid out on one line | never on a wide page |
| the list | `--staff-line` | `max` of the rulers' `offsetWidth` (spec 010, kept as its "measured" signal; no CSS reads it now) | no ruler in the list |

Below 768px none of them is present. The hook removes each one only if it is set (FR-011).

## 3. Derived per card (CSS, `li`)

```
card minimum = max(--card-min, min(--own-head + chrome, --card-floor))
own width    = max(card minimum, --own-staff + chrome)
memo card    : own width = max(own width, --card-floor)     — li:has([data-testid="part-memos"])
```

- **Own width** is FR-003's value. It is the flex basis.
- **Drawn width** in a full row is `min(own, row) + (row − Σ min(own, row) − (k − 1) · gap) / k`, the equal share of
  research R2. In the last row it is `min(own, row)`, within +0.26px (the filler's share, research R1).

## 4. The row rule (FR-007): what every test computes

Given the list's content width `row`, the gap `g`, and each card's own width `w[i]` from §3, computed by the **test**
from inputs it measures itself (see INV-002 in plan.md):

```
rows = []
for i in 0..n-1:
  c = min(w[i], row)
  if rows not empty and used + g + c <= row + 0.5:  append i to the last row; used += g + c
  else:                                             start a new row [i]; used = c
```

A drawn layout is correct when:
- its rows, grouped by `li` top ±0.5, equal `rows`;
- each card's drawn width obeys §3;
- every card but the last row's has its row end at the list's right ±0.5.

The 0.5px tolerance covers sub-pixel layout. A case where `used + g + c` lands within ±0.5 of `row` is reported, not
failed, so a rounding tie cannot flake the suite.

## 5. Inputs a test measures (never read back from the hook)

| Input | How the test measures it |
|---|---|
| ruler width | `getBoundingClientRect().width` of the card's `[data-testid=tab-ruler]` |
| one-line staff (INV-008) | clone `.tab-lines` with `flex-wrap: nowrap; width: max-content` and each `.tab-bar-run` `flex: none`, plus `--gutter` (spec 010 INV-019's method) |
| head line | clone the head row (`.reading-card > :first-child`) with `width: max-content; flex-wrap: nowrap`, hidden, and read its width |
| tokens | `getComputedStyle(li)` for `--card-min`, `--card-floor`, `--card-pad-x`, `--card-gap`, resolved to px through a probe element |
| memo card | `li.querySelector('[data-testid="part-memos"]') !== null` |
| row | the list's `clientWidth` minus its padding (0) |

## 6. State transitions

None are stored. A card's width is recomputed on these triggers (FR-010), with no reload:

| Trigger | What changes | Who notices |
|---|---|---|
| commit of either page (song loaded, parts added, view/density switched) | rulers, head rows | the hook's layout effect |
| fonts loading, view, density, pointer or theme | ruler or head-row box size | the hook's `ResizeObserver` |
| rename, record panel, notices | head-row or memo-area size | the `ResizeObserver` (head row); CSS `:has()` (memo floor) |
| a memo added or removed | `part-memos` present or absent | CSS `:has()` only |
| viewport resize | the row width | CSS only (the flex row rebreaks) |
| the reading position moving | nothing: the slot keeps its width (research R8) | nobody (INV-009 asserts it) |
