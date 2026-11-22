# Research: Cards per row follow what the cards hold

Phase 0 for [plan.md](./plan.md). Every figure here was measured on the **unedited** tree (`bcd3cde`, with the candidate
CSS injected where stated), Chromium on Windows, desktop project (fine pointer), unless a row says otherwise. The probes
and their raw output are in [research-probes/](./research-probes/). They are not part of the suite.

| Probe | What it answers | Output |
|---|---|---|
| `flex-mechanism.probe.ts` (static HTML, Chromium and Firefox) | R1, R2 | `flex-mechanism.{chromium,firefox}.json` |
| `ruler-calc.probe.ts` (static HTML, Chromium and Firefox) | R3 | `ruler-calc.{chromium,firefox}.json` |
| `long-ruler.probe.ts` (the app) | R3 | `long-ruler.json` |
| `measure-rows.probe.ts` (the app, staff-only own width, four card minima) | R4, R6 | `measure-rows.json` |
| `song-head.probe.ts` (the app, song page head rows) | R4, R5 | `song-head.json` |
| `measure-final.probe.ts` (the app, the plan's rule) | R4, R5, R7 | `measure-final.json` |

Run the static probes with `npx playwright test -c specs/013-cards-per-row/research-probes/mech.config.ts`, and the app
probes with `-c specs/013-cards-per-row/research-probes/probe.config.ts`. That one builds first. Set
`PROBE_NO_BUILD=1` to reuse a fresh build.

---

## R1. The route: a wrapping flex row, with each card's basis at its own width

**Decision**: On a wide page, `.reading-cards` becomes `display: flex; flex-wrap: wrap; gap: var(--card-gap);
align-items: flex-start`. Each `li` is `flex: 1 0 var(--card-own); max-width: 100%; min-width: 0`. The list gets one
pseudo-element filler, `.reading-cards::after { content: ""; flex: 9999 0 0; margin-left: calc(-1 * var(--card-gap)) }`.

**Why it meets the spec without a placement algorithm of our own**:
- **Greedy, in order (FR-002, FR-007).** Flex line breaking is greedy in document order on each item's hypothetical size.
  Here that is `min(own width, row)`. A line ends only when the next item does not fit. Nothing reorders flex items
  except `order`, which nothing sets.
- **Wider than the row (FR-004).** `max-width: 100%` clamps the hypothetical size to the row. Such a card takes a line
  alone, and its staff wraps at barlines inside it, as spec 010 draws it.
- **Never narrower than its own width (FR-004).** `flex-shrink: 0`.
- **Full rows fill, the last row does not (FR-009).** On every line but the last, the cards share the free space
  through `flex-grow: 1`. On the last line the filler sits after the last card. Its grow factor of 9999 takes
  9999/(9999 + k) of the free space. For a 2560px row with k ≤ 12 cards, each card grows by under 0.26px.
- **No extra row from the filler.** The filler's `margin-left` is minus one gap, so its outer size plus the gap before it
  is 0. It always fits on the last line, even when the last line is exactly full.

**Verified** in Chromium and Firefox by `flex-mechanism.probe.ts`. Seven cases were checked against the spec's greedy
rule computed from the own widths alone: twelve short cards, the fit song's six, a long card then two short, a row
exactly full, a last row exactly full, mixed widths, and one card. In both engines every case matched. Full rows ended at
the list's right ±0.5px, the last row's cards were at their own widths ±0.5px, and the list's height had no extra gap.

**Alternatives considered**:
- *A fine column grid with per-card spans* (the spec's first suggestion). JS would compute every span, and the last-row
  rule and greedy breaking would be ours to keep right. Two copies of the placement rule (CSS tracks and JS spans) would
  have to agree. Rejected.
- *JS computing every position.* That is our own layout engine. Rejected for the same reason.
- *`grid-template-columns: repeat(auto-fill, …)` with one track size.* That is what spec 010 has, and it cannot give
  cards different widths.
- *A real filler element in the list.* An `ol`/`ul` may only hold `li`. The narrow markup fixture would also change.
  The pseudo-element adds no markup and exists only inside `@media (min-width: 768px)`.

## R2. How a full row's spare width is shared: equally

**Decision**: `flex-grow: 1` on every card, so each card in a full row gets the same extra width.

**Rationale**: It is the simplest rule a test can compute: `extra = (row − Σ own − gaps) / k`. It keeps a short card
short next to a long one. Growing in proportion to width would hand most of the slack to the long card, whose staff is
already on one line. At 1280 the fit song's rows gain 4–10px a card. At 1920 a full row of short cards gains about
1px each.

**Alternatives**: proportional growth (`flex-grow: <own width>`). It is not expressible from a CSS length without
unit division, and gains nothing a reader would see.

## R3. The ruler reads 0px for any part longer than 48 columns in Chromium

**Finding** (`long-ruler.probe.ts`): in the app, a part's ruler measures correctly up to 8 bars of four quarter notes
(39 columns). At 10 bars (49 columns) and beyond, it measures **0px**. The `style="width: calc(…)"` is present and
parsed (3,148 characters for 16 bars), but the computed width is `0px`. This is the `long` song's card A. It is also
part of the browser check's finding 2: today `--staff-line` came from B and C (175.6px), which is why A got a third of
the row.

**Cause** (`ruler-calc.probe.ts`, static HTML): Chromium drops a flat `calc()` sum once it passes 48 column terms
(about 100 operands) when the units do not fold (`ch` or `rem` via `var()`). It drops it whether `--staff-ch` is a
registered `<length>` or not. Firefox computes every case up to 320 columns. The **same sum nested in groups of 8**
computes correctly in both engines at every count tested (8 to 320 columns), to the same value as the flat sum where
the flat sum works.

**Decision**: `rulerWidth` keeps exactly the same terms, but writes them as a balanced tree of nested `calc()` groups of at
most 8 terms. Groups of groups are used when there are more than 8 groups. The top level still ends
`… + var(--gutter))`. Each column's term string still appears verbatim, so `TabStaff.ruler.test.tsx` passes unedited.

**Why this is in scope**: FR-003 sizes every card from its own ruler, and the spec's Assumptions take the ruler as
accurate at every width. Without this fix, every part of 10 bars or more would be sized as an empty staff. The fix
touches only the hidden ruler. No drawn column's width string changes (FR-012; `TabStaff.wrapped-unchanged` and
`frets-unchanged` unedited).

**Alternatives**:
- *Collect like terms* (`Σwidth * var(--staff-ch) + n * var(--col-pad)`). This is shorter, but a chord column's
  `max(…, k * 1ch)` term cannot be collected, so a part with many chords would still pass the limit. It also breaks
  the unit test's substring check.
- *Measure the one-line staff in JS* by cloning lines with `nowrap`. That is a second measuring path that would have to
  agree with the ruler (INV-019). Rejected.

## R4. A card's own width: its one-line staff, and its head row up to the phone width

**Finding** (`measure-rows.probe.ts`, `song-head.probe.ts`): sizing a card from its staff alone (FR-003 as worded)
breaks spec 010 SC-001 on the song page. At 1280×800 the fit song's C card (2 bars) has an own width of 321px. Its head
row (label 41.4, "Add a name" 91.8, "120 bpm · 4 beats a bar" 124.7, menu 32, gaps 24, so 313.8px on one line) no
longer fits in 307px. It wraps to two control-height lines (32 → 72px). The page then scrolls: 832 against 800. Today
it is 800, with 768 at the last card's bottom.

**Decision**: a card's **card minimum** (FR-005, which the plan sets) is per card:

```
card minimum = max(--card-min, min(head line + chrome, --card-floor))
own width    = max(card minimum, staff line + chrome)
memo card    = max(own width, --card-floor)                     (FR-006)
```

- `staff line` is `ceil` of the card's ruler box width.
- `head line` is `ceil` of the head row's width laid out on one line (`width: max-content; flex-wrap: nowrap`).
- `chrome` is `2 * --card-pad-x + 2px` (padding and a 1px border each side), as spec 010's track formula has it.
- `--card-min` is `9rem` (R6).
- `--card-floor` is spec 010's 343px.

**Rationale**:
- *Each card is still sized only from its own content* (FR-001). The head row is the card's content too.
- *Capped at the phone floor.* A head row never makes a card wider than spec 010 made every card. So a long part name
  (`names` song) gives a 343px card whose head row wraps inside it (the spec's edge case). That card was 1264px wide
  under spec 010 at 1280.
- *The head row's first line always fits.* The first line is the play view's number and label, or the song page's label
  and menu. It is narrower than the whole head row, so FR-005's readability holds by construction, at both pointer
  sizes. The cap (343px) is the phone width those rows were built for.
- *Measured* (`measure-final.probe.ts`): the fit song page fits again at 1280×800 and 1440×900 (scroll = viewport, last
  card bottom 768, C card 328px with a one-line head row). Nothing else in the fit song moves.

**Alternatives**:
- *Staff only* (the spec's FR-003 wording). Fails SC-001 on the song page, as measured above.
- *A fixed 343px floor for song-page cards.* The short song page stays at three cards a row at 1280, which is today's
  waste.
- *Stretching the last row.* Excluded by spec Decision 3.
- *`flex-basis: max-content` in pure CSS.* The li's max-content includes the head row uncapped (a 60-character name)
  and memo rows. Capping only the head row's part is not expressible.

## R5. The short song's song page cannot fit 1280×800 within this entry's scope

**Finding** (`song-head.probe.ts`, `measure-final.probe.ts`): the part list starts at y = 359 (page header, the
12-entry arrangement and the "Parts" heading). With `pb-6` (24px) the cards must end by 776, which leaves **417px**
for card rows. A one-bar part card is 203.6px tall with a one-line head row (8 + 32 + 8 + 141.6 staff + 12 + 2). Its
head row is 265.9–274.3px on one line (label, "Add a name", "4 beats a bar", menu).

- Two rows need 2 × 203.6 + 8 = 415.2px, which fits with 1.8px to spare. But two rows of twelve need six a row, so each
  card can be at most (1264 − 40) / 6 = 204px wide. At that width the head row wraps to two control lines (72px), the
  card is 243.6px, and two rows need 495px. **Over.**
- Three rows need at least 3 × 203.6 + 16 = 627px. **Over.**
- Even an icon-only "Add a name" (a one-line head of about 220px) gives five a row, so three rows. **Over.**

So spec SC-002's song-page half and US1 AS2 ("no vertical scroll") cannot hold without changing the staff's height
(FR-012, out of scope), the arrangement section, or the head row's controls. None of those is this entry's to change.

**Decision** (deviation, recorded **worth your eye**): the song page is held to every layout rule (FR-001–FR-010) and to
a measured improvement, not to "no scroll":
- the short song page at 1280×800 is 4 + 4 + 4 cards with one-line head rows;
- its `scrollHeight` is ≤ 1010 (today 1221);
- the play view keeps all of SC-002: 8 + 4 cards, no scroll, last card bottom 502 against the bar at 743.

The follow-up (a more compact arrangement on wide pages, or a compact song-page head row) is logged as a finding for a
later entry.

**Alternatives**:
- *A 9rem minimum with head rows left to wrap.* That gives 8 + 4 cards, but the head rows run to 112px (label, "Add a
  name", heading and menu stacked one per line). The page is still 958px tall, so it does not fit either, and the cards
  are harder to read. Rejected.
- *Shrinking spacing* (the head row's `mb-2`, card padding, the 8px gap). It saves at most about 12px a row against a
  shortfall of 78px or more. Rejected.

## R6. `--card-min`: 9rem (144px)

**Decision**: `--card-min: 9rem` on `:root`, next to `--card-floor`.

**Rationale**:
- It is the floor under the per-card minimum (R4) for cards whose head row is tiny: an empty part, or a play-view card
  that is just `1 A`.
- The play view's short song gets 8 + 4 cards at 1280 (SC-002 needs at least 5). That is 10 + 2 at 1920 and 6 + 6 at
  1024, with every card wholly above the bar.
- The song page's first line on a touch pointer is label link (≈58px) + gap 8 + menu 44px + chrome 14 = 124px, under
  144. So FR-005 holds at both pointer sizes even before R4's head term.
- 8rem left one-bar play cards at 128px with a cramped head row. 10rem dropped the short play view to 7 + 5, and 12rem
  to 6 + 6. All of them fit, so the smallest readable value wins.

## R7. Measured fit figures under the plan's rule (for FR-023)

From `measure-final.probe.ts`, mouse, cluster closed, panels closed, click at rest. Each cell gives cards per row, then
scroll height against viewport height, then the last card's bottom (and the bar's top, on the play view).

| Song | Page | 1280×800 | 1440×900 | 1920×1080 |
|---|---|---|---|---|
| fit | play | 2,2,2 · 800/800 · last 705, bar 743 | 2,2,2 · 900/900 · 705, bar 843 | 2,2,2 · 1080/1080 |
| fit | song | 2,2 · 800/800 · last 768 | 2,2 · 900/900 · 768 | 2,2 · 1080/1080 |
| short | play | **8,4** · 800/800 · last 502, bar 743 | 9,3 · 900/900 | 10,2 · 1080/1080 |
| short | song | 4,4,4 · **1010/800** (R5) | 4,4,4 · 1010/900 | 5,5,2 · 1080/1080 |
| long | play | 1 (A, 1264, two lines), 2 · 800/800 | 1 (A, one line), 2 | 1 (A, one line), 2 |
| long | song | 1, 2 · 952/800 | 1, 2 · 900/900 | 1, 2 · 1080/1080 |

Today (`measure-rows.json`, "today"): the short play view is 3,3,3,3 at 1280 with scroll 962/800, and the long song is
three 416px tracks with A on four lines.

The fit play view's vertical margin is unchanged at 38px (705 against 743). Its rows are A + A' (628 + 628), A + B
(626 + 630), and C + B on the last row at own widths (321 + 616).

**At 768** the fit song's 4-bar cards are each one a row on one line, at 752px (rows that fill). The last card is 616px
wide. This is the spec's own re-pin of spec 010 SC-003 (FR-022).

## R8. The pass words: the slot moves to the end of the play view's head row

**Problem**: the slot stacks the rest words (`×3 · passes 1–3 of 4`) and the live words (`pass 1 of 4`) in one grid
cell, so it is as wide as the wider of the two. The live words are always shorter: the rest words contain
`passes a–b of n`, which is longer than `pass k of n`. While live, a blank stretch the width of the difference sits
before `bars 1–12`.

FR-014 (no hole after the visible words) and FR-015 (no other item moves on enter, pass change or leave) can both hold
only if the slot keeps its width **and** no head-row item follows it on its line. Any item after it would have to move
when the slot shrinks (breaking FR-015), or sit behind the hole (breaking FR-014).

**Decision**: in `PlayView.tsx` the `card-passes` span moves to be the **last** child of the head row (after
`card-bars`, the slice words, the part name and the heading). The stacked slot and its CSS are unchanged, so its width
never changes and the head row never rewraps. Nothing follows it, so there is no hole. At rest the card reads
`1 A VERSE bars 1–12 … ×3 · passes 1–3 of 4`.

**Why the DOM, not CSS `order`**: a screen reader reads DOM order, so the visual order and the reading order stay one.
The narrow fixture is unaffected: `wide-narrow-unchanged.spec.ts` drops `[data-testid^="card-passes"]` from the markup it
compares, and its four songs have no repeated entry, so no slot is drawn. The geometry it records is unchanged.

**Alternatives**:
- *Right-align the live words in the slot.* FR-014 holds to the letter, but the hole moves in front of the words.
  Rejected: US4 says "no hole".
- *Let the slot follow the visible words.* Breaks FR-015, because `bars 1–12` jumps left.
- *Pad or justify the live words* to the rest width. That is a hole by another name.
- *CSS `order: 1` on the slot.* The screen and the DOM would read differently. Rejected.

Recorded **worth your eye**: the `×3` words now come after the bar span and the heading rather than straight after the
section words. This amends spec 010 contracts/reading-cards.md §5's item order.

## R9. Short chord symbols print whole

**Problem**: the print rule sets `white-space: normal; overflow-wrap: anywhere` on the chord row's `div.text-accent`.
That div is as wide as its column, so `Em7` breaks after `Em`.

**Decision**: in `@media print`:
- the chord div gets `width: max-content` and `max-width: min(100cqi, calc(100vw - 8rem))`, keeping
  `white-space: normal; overflow-wrap: anywhere`;
- `.reading-card` becomes an inline-size container (`container-type: inline-size`), so `100cqi` is the card's
  content width: its printed line.

The effect:
- A symbol no wider than the line takes its own width and never breaks (FR-017). It overflows its column to the right,
  as it does on screen.
- A symbol wider than the line is held to the line and breaks inside it (FR-018).
- Outside a card (none today), `cqi` falls back to the viewport, which is today's bound.

**Why containment is safe here**: in print a card's width comes from its `li`: the flex basis on wide paper, the block
width on narrow paper. It never comes from its content, so inline-size containment changes no card's size. It applies
only in print.

**Alternatives**: `white-space: nowrap`. That would never break a symbol, which is the case the current rule was written
for (FR-018).

## R10. Measuring: when `useCardTrack` runs, and what it writes

**Decision**: `useCardTrack(listRef, wide)` keeps its signature, so both pages call it unchanged. When `wide` is true:

1. It writes on each `li`: `--own-staff` (`ceil` of its ruler's `getBoundingClientRect().width`, omitted when the card
   has no ruler) and `--own-head` (`ceil` of its head row's one-line width).
2. It keeps writing `--staff-line` on the list, the widest ruler, as spec 010 does. It is no longer used by the CSS, but
   it is spec 010's public "the list is measured" signal. `wide-fit`, `wide-ruler`, `wide-order` and
   `wide-narrow-unchanged` wait on it or assert it, so those specs stay unedited.
3. It measures the head rows in one batch: set `width: max-content; flex-wrap: nowrap` on every head row, read every
   width, then restore each row's `style` attribute exactly (remove it if it was absent). That is one forced layout per
   pass. It writes a property only when the value changed.
4. It runs after each commit (as today) and from one `ResizeObserver` on every ruler **and** every head row. Fonts
   loading, a view, density or theme change, a rename and the recorder's notices all resize one of them (FR-010). A
   memo added or removed changes the memo floor through CSS `:has()`, with no JS.

When `wide` is false it removes `--staff-line` from the list and `--own-staff`/`--own-head` from each `li`, and only if
present, so no `style=""` appears on a narrow page.

**Why rounding up**: `offsetWidth` rounds to the nearest pixel, and a card 0.4px narrower than its staff would wrap it.
`ceil` of the box width leaves 0–1px of slack, and INV-004 checks that a card whose own width fits the row draws its
staff on one line.

**Why the head row is measured and not computed**: its items are text and controls whose widths depend on fonts,
pointer size and words. Measuring is the only route that cannot drift from what is drawn.

## R11. Tests: what is new, what is re-pinned

- **New specs** (contracts/cards-per-row.md §6): `cards-rows.spec.ts` (INV-001–INV-007), `cards-ruler-long.spec.ts`
  (INV-008), `cards-pass-words.spec.ts` (INV-010), `cards-print.spec.ts` (INV-012, INV-013),
  `cards-follow.spec.ts` (INV-009). They derive every expected count from each run's own measured rulers and head rows
  and the list's width. No font advance is hard-coded (FR-021).
- **Re-pinned** (FR-022), each listed in `docs/DECISIONS.md` under "013 — re-pinned tests": the spec 010 assertions in
  `e2e/wide-order.spec.ts` that encode equal tracks, and the 1280×800 entries of `e2e/fixtures/memo-card-before.json`.
  plan.md lists them line by line.
- **Unedited and must pass**: `wide-narrow-unchanged.spec.ts` with both fixtures, `wide-sideways(-firefox)`, `wide-fit`,
  `wide-print`, `wide-ruler`, `wide-position`, `wide-fold`, `wide-click-bar`, `wide-controls`, every `memo-*` spec but
  the re-recorded fixture, entry 11's playback specs, `TabStaff.ruler.test.tsx`, `TabStaff.wrapped-unchanged` and
  `frets-unchanged`.
