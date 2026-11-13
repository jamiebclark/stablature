# Contract: the rhythm row and the brackets under the tab (`TabStaff`)

**Component**: `src/components/tab/TabStaff.tsx`, plus a new `src/components/tab/RhythmCell.tsx`. Glyph data is in
`src/components/rhythm/glyphs.ts`, and the tokens are in `src/app/globals.css`.

This is the interface that the e2e and jsdom probes read. Tests read **attributes and element rects**. They never read the text of a
symbol, because no symbol is drawn as text.

## Props

| Prop | Change |
|---|---|
| `showRhythm` | Unchanged type and default (`false`). Its doc comment becomes "Every surface passes it; the export never renders a staff." `CaptureScreen` and `PasteTab` now pass it (research R8). |
| everything else | Unchanged. |

## When things are drawn

```text
hasRhythm  = showRhythm && layout.columns.some(c => c.duration !== null)     // the one rule, unchanged
bracketRow = spans.length === 0 ? null : hasRhythm ? "under" : "above"
```

| Staff | Bracket row above | Rhythm row | Root `data-rhythm` |
|---|---|---|---|
| no groups, no durations | no | no | absent |
| groups, no durations | **yes, as today** | no | absent |
| no groups, durations | no | yes | `""` |
| groups and durations | **no** | yes, with each bracket inside | `""` |

When `hasRhythm` is false, the markup is byte-identical to `main` (FR-019, INV-001).

## The root

`<div class="tab-staff …" data-testid="tab-staff" data-rhythm="">`. The attribute is present only when `hasRhythm`. The capture band's CSS
rule reads it (research R1).

## The rhythm cell, one per column

It is the last row of each `Column`, before the diff mark row, in the same place as today's `tab-rhythm` row:

```html
<div class="tab-rhythm" data-testid="tab-rhythm" aria-hidden="true"
     data-rhythm="note" data-duration="16" data-flags="0" data-beams-left="1" data-beams-right="2">
  <div data-part="stem"></div>
  <div data-part="beam" data-level="1" data-side="left"></div>
  <div data-part="beam" data-level="1" data-side="right"></div>
  <div data-part="beam" data-level="2" data-side="right"></div>
  <!-- flags: <svg data-part="flag" data-level="n"> ; stubs: <div data-part="stub" data-level="n" data-side="left|right"> -->
  <!-- rest:  <svg data-part="rest" data-duration="q"> ; whole note: <svg data-part="oval"> (no stem) -->
  <!-- bracket, only when bracketRow === "under" and the column is in a span: -->
  <div class="tab-bracket" data-testid="tab-bracket" data-start=""></div>
  <div class="tab-bracket-label">3</div>  <!-- only on the group's label column, once per group -->
</div>
```

- A column whose mark is `none` gets the cell (so the row keeps its height) with **no** `data-rhythm`, `data-duration`, `data-flags` or
  `data-beams-*`, and no children apart from its bracket parts.
- `data-rhythm="rest"` cells carry `data-duration` and one `rest` svg, with no stem.
- The height is `var(--rhythm-row)`. The spacer row in the wrapped gutter and in `RemovalGap` uses the same token.
- `aria-hidden="true"` is on the cell. The column's `aria-label` (its description) is unchanged (FR-031).

## Geometry (research R2)

| Part | Position | Size |
|---|---|---|
| stem | `left: 50%`, `translateX(-50%)`, `top: calc(-1 * var(--rhythm-lead))` | width 1px; quarter height `var(--rhythm-stem)`; half height `calc(var(--rhythm-stem) / 2)` |
| beam level k, side `left` | `left: 0; right: 50%` | 2px tall, bottom edge at the stem's bottom − (k−1) × 4px |
| beam level k, side `right` | `left: 50%; right: 0` | as above |
| stub | from 50% toward its side | `min(var(--rhythm-stub), 50%)` wide |
| flag level k | at the stem's lower end, pointing right, rising | stroke 2px; the same vertical step as beams |
| oval (whole) | centred, in the stem band | about 0.45rem × 0.3rem, 1.25px open stroke |
| rest | centred, in the stem band | fits inside the stem band's box |
| bracket (under) | top of the bracket band | 1px line along the bottom of a 0.2rem box; hooks rise at `start`/`end` |
| bracket label (under) | below the line | 12px type, `line-height: 9px`, centred on the label column |

In `Gap` (connector) and `RemovalGap`, when `hasRhythm`, a rhythm spacer row of `var(--rhythm-row)` is drawn. It holds full-width beams for
the arriving column's `left` levels, and the bracket line when `bracket` is true. The `Gap` gains this row only when `hasRhythm`, so a part
with no durations is unchanged.

## Colour

| Element | Colour | On a selected column |
|---|---|---|
| stem, beam, stub, flag, rest, oval | `--text` (`currentColor` from `.tab-rhythm`) | `--text` |
| bracket line | `--text-dim` (unchanged rule) | `--text` (unchanged rule) |
| bracket label | `--text-dim` (unchanged rule) | `--text` (unchanged rule) |
| print | `--text` is `#000`, `--text-dim` is `#333` (unchanged print block) | |

No `opacity` and no `color-mix` are applied to any of these (FR-026).

## The bracket row above (unchanged)

When `bracketRow === "above"`, the markup is today's: the `relative h-[var(--staff-row)]` row above the cells, with the line at its bottom
and the hooks hanging down. The only behaviour change, on every staff, is that `labelled` is decided by `groupLabels` (once per group id)
rather than once per span. No harvested layout splits a group (research R6), so no baseline hash moves.

## The capture band

```css
[data-testid="tab-band"]:has(> * > .tab-staff[data-rhythm]) { padding-top: 0; }
```

The rule is unlayered, so it beats the Tailwind `pt-1` utility, as `docs/DECISIONS.md` notes for other unlayered rules.

## What stays exactly as it is

- `layoutPart`, `layoutWith`, `tupletSpans`, `TabColumn` and `src/lib/tab/` as a whole: zero diff.
- Column widths, bar numbers, connectors, removal counts and the column's `aria-label`.
- The `[data-start]` query that `revealGroups` uses, with the same order, now matching under-tab brackets where they are drawn.
