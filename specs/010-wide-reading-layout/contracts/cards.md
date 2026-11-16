# Contract: drawn cards (`src/lib/reading/cards.ts`)

React-free and pure. It is the **only** place that decides which passes share a card. `PlayView` renders from it, and
`useReadingPosition` maps a pass to a card with its `cardOf`. Neither re-derives the rule.

## 1. API

```ts
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { PassBars } from "@/lib/reading/bars";

export interface DrawnCard {
  readonly index: number;          // 0-based, reading order
  readonly first: number;          // index into passes
  readonly last: number;           // inclusive
  readonly count: number;          // last - first + 1
  readonly pass: DrawnPass;        // passes[first]
  readonly offset: number;         // bars.offset[first]
  readonly span: { readonly from: number; readonly to: number } | null;
}

export interface DrawnCards {
  readonly cards: readonly DrawnCard[];
  /** cardOf[p] is the index of the card that draws pass p. Built in the same loop as `cards`. */
  readonly cardOf: readonly number[];
}

export function drawnCards(passes: readonly DrawnPass[], bars: PassBars): DrawnCards;
export function cardWords(card: DrawnCard, passes: readonly DrawnPass[]): string | null;
export function cardSpanWords(card: DrawnCard): string | null;
export function livePassWords(card: DrawnCard, passes: readonly DrawnPass[], pass: number): string | null;
```

## 2. The fold rule

Passes `p` and `p + 1` are in one card **iff** all of these hold (research R1):

```ts
passes[p + 1].step.entryId === passes[p].step.entryId &&
passes[p + 1].step.partId  === passes[p].step.partId  &&
passes[p + 1].step.pass    === passes[p].step.pass + 1
```

Nothing else is read: not `visits`, not `sections`, not events, not the width. So the rule is the same at every width, on
screen and in print (FR-014).

## 3. Words

| Case | `cardWords` | `cardSpanWords` | `livePassWords(card, p)` |
|---|---|---|---|
| `count > 1` | `×{count} · passes {a}–{b} of {n}` | `bars {from}–{to}` (null if the passes draw 0 bars) | `pass {passes[p].step.pass} of {n}` |
| `count == 1`, `n > 1` | `pass {pass} of {n}` | null | null |
| `count == 1`, `n == 1` | null | null | null |

Here `a` is `passes[first].step.pass`, `b` is `passes[last].step.pass` and `n` is `step.passes`. The `×` is U+00D7, the `–` is
U+2013 and the `·` is U+00B7, as the roadmap and the section words already use. `span.from = bars.offset[first] + 1`;
`span.to = bars.offset[last] + countBars(passes[last].events)`.

## 4. The corpus (unit test `src/lib/reading/__tests__/cards.test.ts`; e2e `wide-fold.spec.ts` draws F1–F9, F13 and F15)

Each row is an arrangement and parts with known bar counts, then the expected cards as `passes [first–last] words / span`. A
hand table, never a second implementation.

| # | Arrangement | Expected cards |
|---|---|---|
| F1 | `A ×4` (A = 4 bars) | `[0–3] ×4 · passes 1–4 of 4 / bars 1–16` |
| F2 | `A ×4`, last `A′` | `[0–2] ×3 · passes 1–3 of 4 / bars 1–12`; `[3] pass 4 of 4` |
| F3 | `A ×2`, last `A′` | `[0] pass 1 of 2`; `[1] pass 2 of 2`. Nothing says `×1` |
| F4 | `A ×1`, last `A′` | `[0]` no words (it draws `A′`) |
| F5 | `[Verse: A ×2] ×2` | `[0–1] ×2 · passes 1–2 of 2 / bars 1–8`; `[2–3] ×2 · passes 1–2 of 2 / bars 9–16` |
| F6 | `[A ×2] ×2` (no label) | as F5 |
| F7 | `A`, `A` (two entries) | `[0]`; `[1]` (no words) |
| F8 | `A bars 1–2 ×3` | `[0–2] ×3 · passes 1–3 of 3 / bars 1–6` (and its existing `bars 1–2 of this part`) |
| F9 | `A′ ×3` (a variant part, repeated) | `[0–2] ×3 · passes 1–3 of 3 / bars 1–12`, drawn with its variant marks |
| F10 | `A ×3` where A has no columns | `[0–2] ×3 · passes 1–3 of 3`, span null |
| F11 | `A ×3` where A starts with a barline (bar 1 empty) | `[0–2] ×3 · …`, span `bars 1–15` (5 bars a pass, as `countBars`) |
| F12 | `A ×2`, text cue, `A ×2` | `[0–1]`; `[2–3]` (a text entry draws no pass) |
| F13 | `[Outer: [Inner: A ×3] ×2]` | `[0–2] ×3 …`; `[3–5] ×3 …` |
| F14 | an empty arrangement | no cards, `cardOf` empty |
| F15 | the fit song (data-model.md §1) | the six cards of data-model.md §1, `cardOf = [0,0,0,1,2,2,3,3,4,5]` |

Plus, for every row:
- `cardOf` agrees with the cards: `cards[cardOf[p]].first ≤ p ≤ .last`.
- The cards partition the passes.
- The card after a folded card has `offset === span.to` of the folded card.

## 5. What the click and the keys keep

`readingStops(passes, bars.offset)` and `notationColumns(passes)` are **not** given cards. They are unchanged files
(`src/lib/reading/position.ts`, `src/lib/rhythm/notation.ts`, both in the scope fence). So the click counts and sounds every
pass (FR-020), and the keys step every pass (FR-016, FR-021). Folding is display only.
