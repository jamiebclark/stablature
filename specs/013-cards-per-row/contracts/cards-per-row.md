# Contract: the card list sized from each card's content

This amends spec 010's [contracts/reading-cards.md](../../010-wide-reading-layout/contracts/reading-cards.md) §1, §4 and §5.
Everything not named here is unchanged. Below 768px this contract is inert, and both pages draw exactly today's markup
(FR-011).

## 1. The list (replaces spec 010 §1's CSS)

Markup is unchanged: `ul.reading-cards.grid.gap-3` and `ol.reading-cards.grid.gap-4`, with the same `li`s and
attributes. Only the wide rule changes:

```css
:root {
  --card-floor: 343px;   /* spec 010 */
  --card-min: 9rem;      /* new: research R6 */
}

@media (min-width: 768px) {
  .reading-cards {
    display: flex;               /* over the narrow `grid` utility */
    flex-wrap: wrap;
    gap: var(--card-gap);
    align-items: flex-start;     /* FR-009: tops aligned */
  }
  /* The last line's spare width goes here, so a last row keeps its cards at their own widths (FR-009, research R1). */
  .reading-cards::after {
    content: "";
    flex: 9999 0 0;
    margin-left: calc(-1 * var(--card-gap));
  }
  .reading-cards > li {
    --card-chrome: calc(2 * var(--card-pad-x) + 2px);
    --card-least: max(var(--card-min), min(calc(var(--own-head, 0px) + var(--card-chrome)), var(--card-floor)));
    --card-own: max(var(--card-least), calc(var(--own-staff, 0px) + var(--card-chrome)));
    flex: 1 0 var(--card-own);
    max-width: 100%;
    min-width: 0;
  }
  /* FR-006: memo rows and the recorder were built at phone width. */
  .reading-cards > li:has([data-testid="part-memos"]) {
    --card-least: max(var(--card-floor), var(--card-min));
  }
  .reading-cards > li > .reading-card {
    padding: var(--card-pad-y) var(--card-pad-x) max(var(--card-pad-y), 0.75rem);   /* spec 010, unchanged */
  }
}
```

- `--card-track` and `grid-template-columns` are removed. Nothing sets `order`, `grid-row`, `grid-column` or
  `grid-auto-flow` (FR-002).
- The memo rule overrides only `--card-least`. `--card-own` is declared on the same `li` and resolves `var(--card-least)`
  there, so the memo card's basis is `max(343px, staff + chrome)`. The head term is at most `--card-floor` by
  construction, so dropping it changes nothing. The `:has()` rule is more specific than the plain `li` rule, so source
  order does not matter.
- The 343px floor remains spec 010's `--card-floor`. It is no longer a floor for every card (amends spec 010 FR-005).

## 2. `useCardTrack(listRef, wide)` (`src/components/reading/useCardTrack.ts`, replaces spec 010 §4)

Signature unchanged. `SongView.tsx` and `PlayView.tsx` call it as today.

**When `wide`**, in a layout effect after each commit:

1. Collect `lis = list.children` (each `li`). For each, `ruler = li.querySelector('[data-testid="tab-ruler"]')` and
   `head = li.querySelector(".reading-card > :first-child")`.
2. **Measure in one batch.**
   - For every `head`: remember its `style` attribute, then set `style.width = "max-content"` and
     `style.flexWrap = "nowrap"`.
   - Read every `head.getBoundingClientRect().width` and every `ruler.getBoundingClientRect().width`.
   - Restore every head's `style` attribute exactly: remove it if it was absent.
   - Then, for every head, hide its `.no-print` descendants (`display: none !important`, inline), read the head's width
     again (the printed one-line head), and restore each descendant's `style` attribute exactly. Paper takes no
     measurement: a real print fires only `beforeprint`/`afterprint` under screen styles and runs no observer (FR-019).
3. **Write only on change.**
   - `li.style.setProperty("--own-staff", ceil(ruler) + "px")`, or remove the property when there is no ruler.
   - `li.style.setProperty("--own-head", ceil(head) + "px")`.
   - `li.style.setProperty("--own-head-print", ceil(printed head) + "px")`. Under `@media print` (no width condition: `--card-least` is read only by the ≥ 768 flex rule; spec 010's wide-threshold test allows no other width query)
     `--card-least` is built from `--own-head-print` in place of `--own-head` (the memo rule's override still wins).
   - `list.style.setProperty("--staff-line", max(ruler offsetWidth) + "px")`, as spec 010 does.
4. **Observe.** One `ResizeObserver` watches every ruler and every head; its callback re-runs steps 2 and 3. It is
   disconnected on cleanup.

**When not `wide`**: remove `--staff-line` from the list and `--own-staff`/`--own-head`/`--own-head-print` from each `li`, only where
present.

**Never**:
- sets React state;
- writes a property whose value is unchanged (so its own writes end the loop after at most one more observer round);
- observes attributes or text (the reading position's live words are not a trigger).

## 3. The ruler (`TabStaff.tsx` `rulerWidth`, amends spec 010 §3 "Width")

The terms are unchanged:
- one `widthTerms` string per column (with `max(…, k * 1ch)` for a chord's room);
- `connectors * var(--staff-ch)`;
- `gaps * 3 * var(--staff-ch)`;
- `var(--gutter)`.

They are now **summed in nested groups**:
- `sumTerms(terms)` returns `terms.join(" + ")` when `terms.length <= 8`.
- Otherwise it splits the terms into consecutive groups of 8, wraps each group as `calc(<group>)`, and sums the groups
  the same way, recursively.
- The ruler is `calc(${sumTerms(columnTerms)} + ${connectors} * var(--staff-ch) + ${gaps} * 3 * var(--staff-ch) + var(--gutter))`.

Properties the change must keep:
- every column's term string appears verbatim in the ruler's `width`;
- the `width` starts `calc(` and ends `var(--gutter))`;
- no `calc()` level holds more than 16 operands (research R3: Chromium drops a flat sum past about 100);
- the ruler's computed width is non-zero and equals the one-line staff ±1px for any column count (INV-008).

No other line of `TabStaff.tsx` changes (INV-015).

## 4. The play-view head row (amends spec 010 §5's item order)

The `card-passes` span moves from after the section words to the **end** of the head row:

```html
<div class="mb-1.5 flex flex-wrap items-baseline gap-x-2">
  <span data-testid="card-number" …>1</span>
  <span class="font-mono text-sm font-semibold">A</span>
  <span class="… text-accent">Verse</span>                         <!-- section words, if any -->
  <span data-testid="card-bars" …>bars 1–12</span>                 <!-- if any -->
  <span class="text-xs text-text-dim">bars 2–3 of this part</span> <!-- slice words, if any -->
  <span class="text-xs text-text-faint">main riff</span>           <!-- part name, if any -->
  <span class="text-xs text-text-dim">120 bpm · 4 beats a bar</span>   <!-- heading, if any -->
  <span data-testid="card-passes" class="card-passes text-xs text-text-faint">   <!-- moved: last -->
    <span data-testid="card-passes-rest">×3 · passes 1–3 of 4</span>
    <span data-testid="card-passes-live"></span>
  </span>
</div>
```

The slot's CSS (`.card-passes` inline-grid, both layers in one cell, the visibility rules, and the print rules) is
unchanged. `useReadingPosition` is unchanged.

## 5. Print (amends `globals.css` `@media print`)

```css
@media print {
  .reading-card { container-type: inline-size; }
  .tab-bar-run [data-testid="tab-column"] > div.text-accent {
    white-space: normal;
    overflow-wrap: anywhere;
    width: max-content;                                   /* new: a symbol takes its own width (FR-017) */
    max-width: min(100cqi, calc(100vw - 8rem));            /* new: no wider than its card's line (FR-018) */
    line-height: 1;
  }
}
```

Every other print rule is unchanged: `break-inside: avoid` on each `li`, the live words hidden, the rest words shown,
the bar runs wrapping.

## 6. Test hooks and specs

| Hook | Where | Read by |
|---|---|---|
| `li` `--own-staff`, `--own-head`, `--own-head-print` (inline style) | both lists, wide | INV-014 (absent below 768) only. Every other probe recomputes from its own measurements (data-model §5). |
| `--card-min`, `--card-floor`, `--card-pad-x`, `--card-gap` | `:root` | INV-002, INV-006 |
| `[data-testid=tab-ruler]` | each card, wide | INV-002, INV-008 |
| `.reading-card > :first-child` | the head row, both pages | INV-002, INV-006, INV-010 |
| `[data-testid=part-memos]` | song page part card | INV-006 |
| `[data-testid^=card-passes]`, `card-bars`, `li[data-reading]`, `li[data-live-words]` | play view | INV-010 |

| New spec file | Invariants |
|---|---|
| `e2e/cards-rows.spec.ts` | INV-001 to INV-007, INV-014 (the style check) |
| `e2e/cards-ruler-long.spec.ts` | INV-008 |
| `e2e/cards-follow.spec.ts` | INV-009 |
| `e2e/cards-pass-words.spec.ts` | INV-010 |
| `e2e/cards-print.spec.ts` | INV-012, INV-013 |
| `e2e/cards-helpers.ts` | `measureCards(page)` (data-model §5), `greedyRows(own, row, gap)` (data-model §4), the seeders for the long-ruler, many-chord, long-chord and memo songs |
| `src/components/tab/__tests__/TabStaff.ruler-depth.test.tsx` | INV-008 (unit half: nesting bound, terms verbatim) |
