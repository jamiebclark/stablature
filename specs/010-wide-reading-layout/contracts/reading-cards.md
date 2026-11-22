# Contract: the card list on both pages

The DOM, CSS and hooks the wide layout adds, and the hooks the tests read. Below the threshold everything here is inert, and
both pages draw exactly today's markup (FR-003, INV-001).

## 1. The list

> *Amended by spec 013:* below 768 the list is unchanged. At 768+ it is a flex row-wrap and each `li` is sized from its own `--own-head` and `--own-staff` (greedy rows, last row not stretched), so the `--card-track` grid below no longer applies.

| | Song page (`SongView`) | Play view (`PlayView`) |
|---|---|---|
| Element | `ul.reading-cards` (was `ul.grid.gap-3`) | `ol.reading-cards` (was `ol.grid.gap-4`) |
| Narrow classes | `grid gap-3` (today's) | `grid gap-4` (today's) |
| Wide | the `.reading-cards` rule below | same |
| Items | `li#part-{id}` (today's) | `li.print-keep` (today's) plus `data-card`, `data-first-pass`, `data-last-pass` |
| `--staff-line` | written by `useCardTrack(ref)` when wide | written by `useCardTrack(ref)` |

```css
@custom-variant wide (@media (min-width: 768px));

:root { --card-floor: 343px; }

@media (min-width: 768px) {
  .reading-cards {
    --card-gap: 0.5rem;
    --card-pad-x: 0.375rem;
    --card-pad-y: 0.5rem;
    --card-track: max(
      var(--card-floor),
      min(calc(var(--staff-line, 100%) + 2 * var(--card-pad-x) + 2px), calc((100% - var(--card-gap)) / 2))
    );
    grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-track)), 1fr));
    gap: var(--card-gap);
    align-items: start;          /* FR-007 */
  }
  .reading-cards > li { min-width: 0; }   /* a card never widens its track (FR-006, FR-010) */
  .reading-cards > li > .reading-card { padding: var(--card-pad-y) var(--card-pad-x); }
}
```

`.reading-card` is the card box: the play view's `div.rounded-lg…p-3`, and the song page's `Card`, through its `className`.
Both keep their narrow padding.

**Order**: document order is reading order, and grid auto-placement is row-major. Nothing sets `order`, `grid-row`,
`grid-column` or `grid-auto-flow: dense` (FR-004). INV-002 checks this.

## 2. The page

- Both `main`s are `max-w-screen-2xl` (FR-011). On the song page this replaces `max-w-3xl`, which never binds below 768px, so
  narrow is unchanged.
- Both `main`s get `wide:px-[var(--page-pad-x)]`, with `--page-pad-x: max(0.5rem, var(--safe-left))` and the matching right.
- The play view's `main` gets `padding-bottom: calc(var(--click-bar-h, 0px) + 0.5rem)` at every width
  (see [click-bar.md](./click-bar.md)).
- `Footer` returns `null` on `/songs/{id}/play`, and is `wide:hidden` on `/songs/{id}`, keyed on `usePathname` as capture already
  is (research R6).

## 3. The staff in a card

| | Song page | Play view |
|---|---|---|
| `wrap` | `useWide()` (FR-008, FR-024) | always (today) |
| `ruler` | `useWide()` | always |
| `pass` | not passed | `card.first` |
| `barNumbers` | `{ offset: 0 }` (today) | `{ offset: card.offset }` |
| `density` | the page's control (today); wrapping applies to the compact staff | `"expanded"` (today) |

**`ruler`** (new optional prop on `TabStaff`):
- **When drawn.** Only in the wrapped branch, only when `ruler` is true. Absent, the markup is byte-identical to today
  (`TabStaff.wrapped-unchanged.test.tsx`'s snapshot and `frets-unchanged.test.ts` unedited).
- **Markup.** `<div class="tab-ruler" aria-hidden="true" data-testid="tab-ruler" style="width: calc(…)"></div>`, as the
  last child of `.tab-staff-wrapped`.
- **CSS.** `.tab-ruler { position: absolute; top: 0; left: 0; height: 0; visibility: hidden; pointer-events: none; }`.
- **Width.** The sum of the staff's one-line width terms:
  - `Σ widthTerms(column)`, the same helper the columns' `width`/`flex-basis` use (refactored out of `columnWidth`);
  - `+ connectors × 1ch`;
  - `+ removal gaps × 3ch`;
  - `+ var(--gutter)`.
- **Agreement.** INV-019 checks the ruler against the staff drawn on one line.

## 4. `useCardTrack(listRef)` (`src/components/reading/useCardTrack.ts`)

> *Amended by spec 013:* the hook also writes each `li`'s `--own-head` and `--own-staff` (px) when its ruler, head row or fonts resize; `--staff-line` stays as the measured signal. It still sets no React state.

- **When it runs.** In a layout effect after each commit, and in a `ResizeObserver` callback on every `.tab-ruler` in the list.
- **What it does.** It reads each ruler's `offsetWidth` and writes `listRef.current.style.setProperty("--staff-line", max + "px")`.
- **What it never does.** It sets no React state and causes no re-render. With no ruler in the list it removes the property,
  and the CSS falls back to two columns.
- **Cost.** One `offsetWidth` read per card per change.

## 5. The play-view card

> *Amended by spec 013:* the pass words (`card-passes`) move to the end of the head row, so the rest and live words never move another item (013 deviation 4).

```html
<li class="print-keep" data-card="0" data-first-pass="0" data-last-pass="2" [data-reading]>
  <div class="reading-card relative rounded-lg border … bg-bg-raised p-3">
    <div class="mb-1.5 flex flex-wrap items-baseline gap-x-2">           <!-- the head row -->
      <span data-testid="card-number" class="font-mono text-sm font-semibold text-text-dim">1</span>   <!-- FR-012 -->
      <span class="font-mono text-sm font-semibold">A</span>             <!-- today's items, today's order -->
      <span class="… uppercase … text-accent">Verse</span>
      <span data-testid="card-passes" class="card-passes text-xs text-text-faint">
        <span data-testid="card-passes-rest">×3 · passes 1–3 of 4</span>
        <span data-testid="card-passes-live"></span>                     <!-- React renders it with no children -->
      </span>
      <span data-testid="card-bars" class="text-xs text-text-faint">bars 1–12</span>   <!-- FR-018, count > 1 only -->
      … today's slice words, part name, heading …
    </div>
    <TabStaff … />
    <VariantLine … />
  </div>
</li>
```

- **Pass words.**
  - `card-passes` is drawn when `cardWords` is not null. It replaces today's `pass {k} of {n}` span, and for a single pass of a
    repeated entry it says the same words.
  - `card-bars` is drawn when `cardSpanWords` is not null.
- **The words' slot.**

  ```css
  .card-passes { display: inline-grid; }
  .card-passes > * { grid-area: 1 / 1; }
  li[data-live-words] .card-passes [data-testid=card-passes-rest] { visibility: hidden; }
  li:not([data-live-words]) .card-passes [data-testid=card-passes-live] { visibility: hidden; }
  @media print {
    .card-passes [data-testid=card-passes-live] { display: none; }
    .card-passes [data-testid=card-passes-rest] { visibility: visible !important; }
  }
  ```

- **Colours.** `card-number` uses `text-text-dim`; `card-passes` and `card-bars` use `text-text-faint`, as today's pass words do.
  No opacity, no `color-mix` (spec Assumptions; INV-010 of spec 009's rule).

## 6. `useReadingPosition(passes, cluster, cardOf?, cards?)`

When `cardOf` is given:
- **Locate.** `apply()` finds `[data-card="${cardOf[pass]}"] [data-column="${CSS.escape(key)}"]`.
- **Live words.** It writes `livePassWords(cards[cardOf[pass]], passes, pass)` into that card's `[data-testid=card-passes-live]`
  and sets `data-reading` on the `li`. It sets `data-live-words` too, only when `livePassWords` returned text (a folded card);
  a single pass keeps its rest words `pass k of n` visible (review F1).
- **Leaving.** It empties the live text and removes `data-reading` and `data-live-words` from the card it leaves, or on clear.

Absent `cardOf`, it behaves exactly as today. The `ResizeObserver` on the bar also writes `--click-bar-h` on
`document.documentElement`, from the same `offsetHeight` it writes `scroll-padding-bottom` from, and clears both on unmount.

## 7. Test hooks (new)

| Hook | Where | Used by |
|---|---|---|
| `li[data-card]`, `data-first-pass`, `data-last-pass` | play view | INV-002, INV-007, INV-009 |
| `[data-testid=card-number]` | play view head row | INV-002, INV-008, SC-008 |
| `[data-testid=card-passes]`, `-rest`, `-live` | play view head row | INV-008, INV-009, INV-020 |
| `[data-testid=card-bars]` | play view head row | INV-008 |
| `li[data-reading]` | play view | INV-009 |
| `[data-testid=tab-ruler]` | wrapped staff with `ruler` | INV-019 |
| `--staff-line` on the list | both pages | INV-003 |
