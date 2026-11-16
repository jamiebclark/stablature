# Data model: Full-width reading layout

**Feature**: `010-wide-reading-layout` | **Plan**: [plan.md](./plan.md)

**Nothing is stored.** No table, field, migration, sync message, export or import changes (spec, Key Entities). Everything
below is either a fixture the tests seed, or a value derived on each read and thrown away.

---

## 1. The fit song (the fixture for SC-001, SC-002, SC-003, SC-004, SC-007)

Seeded by `seedFitSong(page)` in `e2e/wide-helpers.ts`, through the same IndexedDB path `seedSong` uses
(`e2e/reading-helpers.ts`), then given a 4-string tuning through the band's tunings page, as
`research-probes/measure-fit-tight.probe.ts` does.

| Field | Value |
|---|---|
| Tuning | Bass 4, E Standard (4 strings) |
| Tempo | 120 bpm |
| View, density, pointer | frets, expanded, mouse (`desktop` project) |

`barOf(b)` is eight eighth notes with frets `b, b+2, b, b+2, b+3, b+2, b, b+2`, all on one string. Every fret in the song is
**one digit** (research R13).

| Part | Label | Variant of | Bars | Columns |
|---|---|---|---|---|
| A | `A` | — | 4 | bar 1: eighths `3 5 3 5 6 5 3 5`, with chord `Em7` on the first column and a **plain group** over columns 2–3; bars 2–4: `barOf(3)`, `barOf(5)`, `barOf(3)` |
| A′ | `A'` | A | 4 | A's bars 1–3; bar 4: `barOf(4)` |
| B | `B` | — | 4 | `barOf(5)`, `barOf(6)`, `barOf(5)`, `barOf(2)` |
| C | `C` | — | 2 | `barOf(2)`, `barOf(3)` |

**Arrangement** (the spec's "a section Verse holding `A ×4` with `A′` on the 4th, then `B ×2`, then `A ×2`, then a section Outro
holding `C`, then `B`"; the Verse holds only the first entry):

```text
section_start "Verse"
  part A  repeat 4  lastRepeatPartId A′
section_end
part B  repeat 2
part A  repeat 2
section_start "Outro"
  part C
section_end
part B
```

**Expanded**: ten passes, `A A A A′ B B A A C B` (indices 0–9).

**Drawn** (FR-014): six cards.

| Card | Passes | Words (rest) | Section | First bar | Span |
|---|---|---|---|---|---|
| 1 | 0–2 | `×3 · passes 1–3 of 4` | `Verse` | 1 | `bars 1–12` |
| 2 | 3 | `pass 4 of 4` | `Verse` | 13 | — |
| 3 | 4–5 | `×2 · passes 1–2 of 2` | — | 17 | `bars 17–24` |
| 4 | 6–7 | `×2 · passes 1–2 of 2` | — | 25 | `bars 25–32` |
| 5 | 8 | — | `Outro` | 33 | — |
| 6 | 9 | — | — | 35 | — |

Total 38 bars, all of which the click sounds (FR-020).

---

## 2. DrawnCard (derived, `src/lib/reading/cards.ts`)

What the play view draws for one or more consecutive passes. It is built by `drawnCards(passes, bars)` from
`drawnPasses(...)` and `passBars(...)`, which are the same arrays the click and the keys read.

| Field | Type | Meaning |
|---|---|---|
| `index` | `number` | 0-based position in reading order. The visible number is `index + 1` (FR-012). |
| `first` | `number` | Index into `passes` of the first pass it stands for. |
| `last` | `number` | Index of the last (inclusive). `last − first + 1` is the count. |
| `pass` | `DrawnPass` | `passes[first]`: the step and the events it draws. |
| `count` | `number` | Passes it stands for, ≥ 1. |
| `offset` | `number` | `bars.offset[first]`: added to its bar numbers (FR-018). |
| `span` | `{ from: number; to: number } \| null` | Running bars of all its passes, when `count > 1` and the total is > 0. |

Plus the **inverse map** `cardOf: number[]`, where `cardOf[p]` is the card that draws pass `p`. It is returned with the cards
from the same loop, so they cannot disagree.

**Validation and invariants** (unit-tested over the corpus in [contracts/cards.md](./contracts/cards.md) §4):
- Cards partition the passes. `first` of card `i+1` is `last` of card `i` plus 1. The first card's `first` is 0, and the last
  card's `last` is `passes.length − 1`.
- Passes `p` and `p+1` share a card ⇔ same `entryId`, same `partId`, and `step.pass` of `p+1` equals `step.pass` of `p` plus 1
  (research R1).
- `count > 1` ⇒ every pass in the card has identical `events` content (same part, same slice).
- `cardOf.length === passes.length`, and `cards[cardOf[p]].first ≤ p ≤ cards[cardOf[p]].last`.

**Words** (pure, same module):

| Function | Returns |
|---|---|
| `cardWords(card)` | `count > 1`: `×${count} · passes ${a}–${b} of ${n}`, where `a`, `b` are the first and last passes' `step.pass` and `n` is `step.passes`. `count == 1` and `n > 1`: `pass ${pass} of ${n}` (today's words). Else `null`. Never `×1` (Edge). |
| `cardSpanWords(card)` | `bars ${from}–${to}` when `span`, else `null`. |
| `livePassWords(card, pass)` | `pass ${passes[pass].step.pass} of ${n}` when `card.count > 1` and `pass` is in the card, else `null` (FR-017). |

**State**: none. Rebuilt whenever `passes` changes (a `useMemo` on the same dependency as `passBars`).

---

## 3. The reading position on a card (derived, DOM only)

Unchanged from spec 007's `ReadingStop { pass, key, bar }`: stops and the click's `ColumnTick`s are per **pass**. What is new is
where a stop is drawn:

| Input | Where it lands |
|---|---|
| `{ pass: p, key }` | the `[data-column=key]` inside `li[data-card=cardOf[p]]` |
| the card's head row, while the position is in it and `count > 1` | `[data-testid=card-passes-live]` reads `livePassWords(card, p)`, and the `li` has `data-reading` |
| the position leaves the card, or is cleared | the live text is emptied, `data-reading` is removed, and the rest words show again |

**Transitions** (FR-016, FR-017), with the fit song as the example:

| From | Event | To |
|---|---|---|
| pass 0, last column (card 1) | click advances, or "column on" | pass 1, first column: still card 1. Live words `pass 1 of 4` → `pass 2 of 4` |
| pass 2, last column (card 1) | same | pass 3, first column: card 2 (`A′`). Card 1's rest words return |
| pass 1, any column | "bar on" in the last bar | pass 2's first stop (card 1, first column, `pass 3 of 4`) |
| anything | Start, or Stop with no keyed position | position cleared; every card shows its rest words |

---

## 4. Layout tokens (CSS custom properties, `src/app/globals.css`)

They live in the `wide` media block unless marked.

| Token | Value | Set by | Read by |
|---|---|---|---|
| `--card-floor` | `343px` (all widths) | CSS | the track formula (FR-005) |
| `--card-gap` | `0.5rem` | CSS | the grid's `gap` and the track formula |
| `--card-pad-x` | `0.375rem` | CSS | card padding-inline and the track formula |
| `--card-pad-y` | `0.5rem` | CSS | card padding-block |
| `--page-pad-x` | `max(0.5rem, var(--safe-left/right))` | CSS | both pages' `main` padding-inline |
| `--staff-line` | `<n>px`, the widest one-line staff in the list | `useCardTrack` (JS, a DOM write on the list) | the track formula |
| `--card-track` | `max(var(--card-floor), min(calc(var(--staff-line, 100%) + 2 * var(--card-pad-x) + 2px), calc((100% - var(--card-gap)) / 2)))` | CSS | `grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--card-track)), 1fr))` |
| `--click-bar-h` | `<n>px`, the bar's `offsetHeight` (all widths) | the `ResizeObserver` in `useReadingPosition`, which already writes `scroll-padding-bottom` | the play view's `main` padding-bottom |

`2px` is the card's two 1px borders.

---

## 5. Width (derived)

| Name | Where | Value |
|---|---|---|
| `wide` variant | `globals.css` | `@custom-variant wide (@media (min-width: 768px));` |
| `WIDE_QUERY` | `src/lib/reading/wide.ts` | `"(min-width: 768px)"`, pinned equal to the variant's condition by a unit test (INV-016) |
| `useWide()` | `src/components/reading/useWide.ts` | `true` when `matchMedia(WIDE_QUERY).matches`; `false` on the server and before hydration |

Pointer type takes no part (FR-002). Sizes still come from the `pointer: fine` block, unchanged.
