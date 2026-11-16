# Research: Full-width reading layout

**Feature**: `010-wide-reading-layout` | **Date**: 2026-11-13 | **Plan**: [plan.md](./plan.md)

Every figure below was measured on the **unedited** tree (`main` at `03fc3c7`), in a production build, Chromium on Windows 11,
with the probes in [research-probes/](./research-probes/). Their raw output is `measure-fit.json` (5-string, panels as the seed
left them) and `measure-fit-tight.json` (4-string, panels closed). Re-run them with
`npx playwright test -c specs/010-wide-reading-layout/research-probes/probe.config.ts` after `npm run build`.

---

## R1. Which passes fold: the rule falls out of `expandArrangement`

**Decision**: two consecutive passes `i`, `i+1` are drawn as one card when, and only when,
`steps[i+1].entryId === steps[i].entryId`, `steps[i+1].partId === steps[i].partId` and `steps[i+1].pass === steps[i].pass + 1`.

**Rationale**: `expandArrangement` (`src/lib/arrangement/expand.ts`) emits an entry's passes from one `for (pass = 1..repeat)` loop
inside one `walk` of one section visit. So `pass + 1` on the same entry can only be the next pass **of the same visit**: a new
visit of an enclosing section (named or not) calls `walk` again and restarts at `pass = 1`. That makes FR-014's three
conditions (one entry, same part, same section visit) one integer comparison, with no need to compare `visits` objects:

| Shape | Steps (`entry:pass:part`) | Cards |
|---|---|---|
| `A ×4` | `e:1:A e:2:A e:3:A e:4:A` | `A ×4` |
| `A ×4`, `A′` on the 4th | `…e:3:A e:4:A′` | `A ×3`, `A′` (the part differs) |
| `[Verse: A ×2] ×2` | `e:1 e:2 e:1 e:2` | `A ×2`, `A ×2` (pass restarts) |
| `[A ×2] ×2`, no label | `e:1 e:2 e:1 e:2` | `A ×2`, `A ×2` |
| `A, A` (two entries) | `e1:1 e2:1` | `A`, `A` (entry differs) |
| `A ×1`, `A′` on the last | `e:1:A′` | `A′` |

`lastRepeatPartId` is never folded into the run because it changes `partId` (FR-019). The full corpus is in
[contracts/cards.md](./contracts/cards.md) §4.

**Alternatives considered**: comparing `step.visits` by label and time (fragile: two unnamed sections have no label, and a
named section's `time` is a song-wide count, not a visit identity); folding by `partId` alone (folds `A, A` written as two
entries, which Decision 4 rules out).

---

## R2. What today draws: the fit song measured

The fit song is fixed in [data-model.md](./data-model.md) §1. Today's play view draws 10 cards, one per row, at the full width.

| Figure (1280×800, mouse) | Today | Notes |
|---|---|---|
| Top of the first card | 115px | top bar 41, `pt-2` 8, header 54, `mb-3` 12 |
| Click bar at rest / running | 57px / 93px | running adds the state line (20) and the help line (16) **below** the controls |
| One note column (fine pointer) | 16.4px | `1ch` (8.4) + `--col-pad` (8). A barline column is the same width |
| One bar of eight eighths | 147.6px | nine columns; A's first bar, with its chord, 151.4 |
| A's four bars on one line (runs only) | 578px | plus the wrapped gutter (28px): **one-line staff ≈ 603–606px** |
| One wrapped line's height, 4 strings | 136px with a chord row, 121px without | bar row 15.2, chord row 15.2, strings 4 × 20.8, rhythm row 22.4 |
| Play view, all 10 cards | overflow 1749px (5-string) | the page is 3.2 screens tall |
| Song page, `max-w-3xl` | main 768px wide, staff in a 736px card | the one-line staff (574px) uses 78% of its card, and on a 1280 screen the page uses 60% of the width |
| Footer, below `main` | ≈129px | `mt-12`, border, links, `pb-8`. It is page height on both pages |

The brief's "a third of its card" is on a wider page; at `max-w-3xl` the A staff fills more of a narrower card. The real waste
is the page width (FR-011) and the one-card-per-row stack.

---

## R3. Packing: equal columns whose count follows the widest card

**Measured** (`measure-fit-tight.json`, 4-string, the six cards FR-014 leaves, 1280×800):

| Packing | Lines per 4-bar card | Last card's bottom | Fits above a 57px bar? | above a 93px bar? |
|---|---|---|---|---|
| Today, one per row | 1 | 1439.6 | no | no |
| 3 columns (≈411px cards) | 2 | 826.0 | no (−91) | no |
| 2 columns, side 16, card padding 12, gap 8 | 2 (card 620, A needs ≈632) | 1163.5 | no | no |
| 2 columns, side 16, card padding 8, gap 8 | 2 for A, 1 for B | 1006.8 | no | no |
| 2 columns, side 12, card padding 8, gap 8 | 1 (card 624, inner 606) | 693.3 | **yes (+41.7)** | yes (+5.7) |
| 2 columns, side 12, card padding 6, gap 8 | 1 | 681.3 | yes (+53.7) | yes (+17.7) |

At 1440×900 every two-column variant draws one line per card, and the last card ends at 681–725 against 900.

**Finding**: the fit song fits 1280×800 **only** with two cards to a row, each 4-bar staff on one line. Three to a row wraps
every 4-bar card onto two lines, which costs ≈148px a row and cannot fit. Two to a row needs each card's inner width to reach
the one-line staff (≈606px). Today's chrome (page side 16, card padding 12, gap 16) gives a 616px card with a 590px inner
width: ≈16px short, or ≈24px short of an 8px margin.

**Decision**:
- **Equal-width columns in a CSS grid**, row-major by document order, top-aligned (FR-004, FR-007). Equal columns line every
  row's right edge up by construction, and a card is never wider than its row (FR-006).
- **The column count follows the widest card's one-line width.** Each list carries `--staff-line`, the widest one-line staff
  among its cards in px, measured by the browser (R4). The track is
  `max(var(--card-floor), min(var(--staff-line) + card chrome, (100% − gap) / 2))`, repeated with `auto-fit` and `1fr`.
  - It is never under the floor (FR-005).
  - It is never over half the row, so two cards share a row whenever two floors fit (SC-003 at 768, 1024 and 1280).
  - It never asks for more columns than the widest card allows, so the fit song's 4-bar cards stay on one line (SC-001).
  - A song of short parts gets three or four columns.
  - `auto-fit` collapses unused tracks, so a one-card song fills the row (spec 007 FR-055's 90%, kept for a lone card).
- **Wide chrome**, the only sizes this entry changes, each "spacing between cards" (spec Assumptions):

  | Token (wide only) | Today | Wide | Why |
  |---|---|---|---|
  | page side padding | 16px | **8px** (`max(0.5rem, safe-area)`) | +8px per card at 1280 |
  | card padding, horizontal | 12px (play), 16px (song) | **6px** | +12px / +20px per card |
  | card padding, vertical | 12px / 16px | **8px** | −8px / −16px a row |
  | gap between cards | 16px / 12px | **8px** | +4px per card |

  At 1280 this gives a card 628px wide and an inner width of 614px against the A staff's ≈606px: **8px of margin** in Chromium on
  Windows. Chromium on Linux (CI) rounds `1ch` of JetBrains Mono at 14px to 8px, not 8.4px, so the staff is ≈14px narrower there.
  Vertically, the play view's six cards end at ≈693px against a ceiling of 800 − 57 − 8 = 735px: **≈42px of margin**. The song
  page's four cards end at ≈760px, plus `pb-6`, against 800: **≈16px of margin**, which needs the footer gone (R6).
- **Narrow is untouched**: below the threshold the grid is today's one column with today's gaps and padding (FR-003).

**Alternatives considered**:
- *Always two columns when wide.* It is simple and fits the fixture. But a song of one- and two-bar parts would sit in cards
  twice as wide as their staves, which is the waste the brief describes.
- *Text-like flow, cards sized to their own one-line width* (flex-wrap with each card's width as its basis). FR-006's
  "no row ends with floor-sized room while cards remain" then needs a card to join a row and shrink below its one-line width.
  That wraps it onto two lines and makes the row taller. Measured on the fixture with B's two-digit frets, it gave four rows and
  did not fit. It also needs a per-card basis, so the packing would live in JS.
- *Column-major (CSS columns).* Ruled out by the spec (Decision 1).
- *A JS packer.* Adds layout state, a re-render on resize, and a second copy of what the grid already does.

---

## R4. Measuring a card's one-line width: a ruler built from the columns' own widths

**Decision**: a wrapped `TabStaff` given the new `ruler` prop draws one extra element, `.tab-ruler`. It is absolutely positioned,
zero-height and hidden, and its `width` is one CSS `calc()` built from the **same** width terms the columns use:

- `Σ width` ch, plus `n × var(--col-pad)` (the columns);
- `+ k ch` (connector gaps, 1ch each);
- `+ 3m ch` (removal gaps);
- `+ Σ` the `max(0px, …)` chord-room terms;
- `+ var(--gutter)`.

`columnWidth()` is refactored into a `widthTerms()` helper that both the column style and the ruler's sum call (structural
agreement). A hook, `useCardTrack(listRef)`, reads each ruler's `offsetWidth` in a layout effect and in a `ResizeObserver`
(fonts loading, a view change, density). It writes the maximum as `--staff-line: <n>px` on the list element. That is a DOM
write, with no React state and no re-render, the same idiom `useReadingPosition` uses.

**Rationale**: the browser computes `ch` in the staff's own font, so the ruler is exact and agrees with the drawn columns. It
costs one `offsetWidth` read per card. It is opt-in, so the wrapped-markup snapshot (`TabStaff.wrapped-unchanged.test.tsx`),
`frets-unchanged.test.ts` and capture's markup are untouched (INV-014).

**Alternatives considered**:
- *Summing each column's computed `min-width`.* O(columns) `getComputedStyle` calls a render; a long song has thousands.
- *Hard-coding `1ch = 0.6em`.* Chromium on Linux rounds glyph advances (DECISIONS.md, `--chord-ch`), so it is wrong by up to
  0.4px a column, ≈14px a 4-bar line.
- *Temporarily un-wrapping the staff to measure it.* Layout thrash, and it is visible for a frame.

---

## R5. The click bar: fixed at the foot, with a constant height

**Decision**:
1. The bar is `position: fixed` at the bottom, with `inset-inline: 0`. Its inner box is centred and capped at the main's
   `max-w-screen-2xl`, with today's safe-area padding.
2. The play view's `main` gets `padding-bottom: calc(var(--click-bar-h) + 0.5rem)`. `--click-bar-h` is written by the
   `ResizeObserver` that already writes `scroll-padding-bottom` from the bar's `offsetHeight` (`useReadingPosition`). One
   measurement feeds both, so the last card always clears the bar (spec 005 FR-026, INV-026) and following still stops short of
   it (INV-037).
3. **The status words sit in one slot whose height is the tallest message it can hold** (FR-028). The slot is a one-cell CSS
   grid. In that cell:
   - the live `click-state` and, while running, `click-help` (testids, roles and texts unchanged);
   - one hidden ghost per message the bar can show, drawn as `::before { content: attr(data-ghost); visibility: hidden }` on
     empty `span`s.

   Every message is laid out in the same cell, so the cell is always as tall as the tallest, **at the current width**. A start,
   a stop, the help line arriving, or the words being `sr-only` while quiet cannot change the bar's height. Ghost text is in no
   `textContent` and no accessibility tree (pseudo-element content under `visibility: hidden`), so `getByText` and screen
   readers see only the live words.
4. **Where the slot sits.**
   - Narrow: below the controls, as today.
   - Wide: between Start/Stop and the tempo control, in the controls row (CSS grid areas, one DOM). Measured on the wide bar
     the slot's two lines (32px) fit inside the 44px control row, so the wide bar stays at 57px at 1280 and 1440. That is where
     the play view's ≈42px of vertical margin comes from (R3).
   - At 768 the slot is narrower. If a message wraps to three lines, the bar is taller there, but the same height in every
     state.
5. The cluster body stays above the controls. With the bar anchored at the bottom it opens upward, and Start and More do not
   move (FR-029).

**Measured cost**: on a phone the rest height becomes the running height, ≈93px against today's 57px idle-collapsed bar.
Spec 007 SC-010 ("idle cluster at most 60px") becomes untrue. It is amended in place (plan, *Blast-radius decisions*). The two
tests that pin ≤60 (`usability-cluster-states.spec.ts`, `usability-reach.spec.ts`) are re-pinned to "rest height equals running
height, within 0.5px, and ≤ the recorded figure" (FR-032).

**Alternatives considered**:
- *Sticky bar plus a min-height page.* It needs the top bar's height in CSS (41px fine, 53px touch). The footer still follows
  `main`, so on a short song the bar would sit above the footer, not at the screen's foot.
- *Status words above the controls* (growth goes up, controls stay). It meets FR-029 but breaks FR-028 and US5 scenario 2
  (the bar's top edge would move).
- *A fixed `min-height` in px.* Wrong at some width: the stopped message wraps to two lines at 375 and one at 1280.

---

## R6. The footer

**Decision**: the `Footer` (Privacy, Terms) is not drawn on the play view at any width, and on the song page only when wide. It
is still drawn on every other page and on a narrow song page.

**Rationale**: it is ≈129px of page height under `main`. SC-002's 16px margin and SC-001's no-scroll cannot hold with it. On
the play view a fixed bar would cover it. The play view is a reading surface like capture, which already hides it. Privacy and
Terms stay one tap away from the band list and every other page.

**Alternatives considered**: a footer that only shows when scrolled to the end, which would still add page height; hiding it
everywhere when wide, which removes it from pages this entry does not touch.

---

## R7. The width switch: CSS for layout, one `matchMedia` for the song page's `wrap`

**Decision**:
- `@custom-variant wide (@media (width >= 48rem));` in `globals.css` drives every layout rule. `48rem` in a media query is
  768px whatever the root font size.
- The only JS reader is the song page's `wrap` prop on `TabStaff`, which is markup, not style. It comes from
  `useWide()` (`useSyncExternalStore` over `matchMedia(WIDE_QUERY)`, with server snapshot `false`), where
  `WIDE_QUERY = "(width >= 48rem)"` lives in `src/lib/reading/wide.ts`.
- A unit test reads `globals.css` and fails unless the custom variant's condition is exactly `WIDE_QUERY` (INV-016). A media
  query cannot take a CSS variable, so a pinned equality is the strongest agreement available.
- The play view needs no JS switch: it always draws wrapped staves, and only the grid changes.

**Rationale**: a phone keeps today's markup byte for byte (unwrapped song page staves, FR-024). The wide song page wraps
(FR-008). Rotating or resizing re-renders through the `matchMedia` listener (Edge: resizing). Print uses the page width
through CSS. A wide screen printing the song page prints wrapped staves; a phone prints today's.

**Alternatives considered**:
- *Always wrapped markup, made one-line on narrow with CSS* (`flex-wrap: nowrap` on `.tab-lines`). It changes every phone song
  page's DOM (the `role="group"` scroller moves), which FR-003 and FR-024 forbid.
- *Tailwind's `md:`.* It is the same 48rem, but a named `wide` variant says why it exists, and the test can find it.

---

## R8. The reading position on a drawn-once card

**Decision**:
- The play view's `li` carries `data-card` (0-based) and `data-first-pass` / `data-last-pass`.
- `useReadingPosition` gains an optional `cardOf: readonly number[]` (pass → card) and finds the column at
  `[data-card="${cardOf[pass]}"] [data-column="${key}"]`.
- The keyboard's stops (`readingStops`) and the click's columns (`notationColumns(passes)`) stay **per pass, unchanged**. So
  "column on" from the last column of pass 1 is the first stop of pass 2, which `cardOf` maps to the same card's first column
  (FR-016).
- The same `apply()` that moves the highlight class writes the card's live pass words (FR-017):
  - it sets `textContent` of the card's `[data-testid=card-passes-live]` to `livePassWords(card, step)`;
  - it sets `data-reading` on the `li`;
  - it clears both on the card it leaves.

  These are DOM writes, so the staff never re-renders. The live `span` is rendered by React with no children, so React never
  overwrites its text.
- The rest words and the live words share one inline-grid cell. The rest words are hidden with `visibility`, not `display`, so
  the slot keeps the rest words' width and the head row cannot re-wrap mid-song (INV-020). The rest words are always the
  longer: `×k · passes a–b of n` against `pass p of n`.

**Rationale**: the click and the keys already walk passes; drawing once is a mapping from pass to card, applied at the one
place the DOM is touched. Moving the highlight within a card from pass 1's last column to pass 2's first is an ordinary
class move.

**Alternatives considered**: React state for the live pass, which re-renders every `TabStaff` (whose `reading` prop is a fresh
object each render, so the layout memo recomputes) once per pass change, mid-song; rendering the live words with `::after`,
which leaves them out of `textContent`, so a test or an AT would not read them.

---

## R9. Bar numbers on a drawn-once card

**Decision**:
- The card draws its **first** pass with `barNumbers.offset = bars.offset[card.first]`.
- The head row's span is `bars ${offset[first] + 1}–${offset[last] + countBars(passes[last].events)}`, which is
  `offset[last + 1]` or `bars.total`. It is omitted when that total is 0, for an empty part.
- The next card draws `bars.offset[next.first]`, so the running count carries on (FR-018).
- `passBars` and `readingStops` are not changed. They already count every pass.

**Fit song**: cards 1–6 start at bars 1, 13, 17, 25, 33 and 35. Card 1 says `bars 1–12`, card 3 `bars 17–24`, card 4
`bars 25–32`.

---

## R10. Print

**Decision**:
- **Grid.** The `wide` media query is evaluated against the printed page in print. A4 or Letter portrait (≈718–740px) prints
  one card per row. Landscape prints the grid, with the screen's `--staff-line` (it is in px and font-bound, so it holds).
- **Cards.** `.print-keep` stays on every `li`, and Chromium honours `break-inside: avoid` on grid items. Grid items get
  `min-width: 0`, so nothing is cut at the right edge.
- **Words.** In print the live words are `display: none` and the rest words are always visible. The card number prints.
- **Bar.** The bar is `no-print`, as today.

---

## R11. What this changes in the existing suite, and why

Three deliberate changes move existing pins:

- **C1, drawn once.**
  - Ten e2e files seed `A ×N` and then count cards or read `pass k of N`. Five of them seed ×12 to ×40 only to make the page
    long, which a folded entry no longer does.
  - Each is re-pinned in one of two ways. Either it seeds N **separate entries** (a new `entries` option on `seed` and
    `seedPlayable`), so its original assertion stands, unedited, about a long song. Or its assertion is changed to the folded
    card, where folding is what it now tests.
  - The table is in the plan, *Existing tests this changes on purpose*.
- **C2, held bar height.** Two tests pin the idle bar at ≤60px on a phone (spec 007 SC-010).
- **C3, the wide song page.** Its staves wrap and its page is wider. No existing assertion was found that pins the song page's
  width or its sideways scroll at desktop size. `usability-staff.spec.ts` reads `[role="group"]` on the song page; in wrapped
  markup that is `.tab-lines`, and its assertions still hold there. Any C3 failure found at T001's full run is added to the
  table, with its reason, before the edit.

---

## R12. Earlier requirements this makes untrue

| Spec | Requirement | Today's words | After |
|---|---|---|---|
| 007 | SC-010 | "Its idle cluster is at most 60px, down from 81px." | The idle cluster's height equals its running height (FR-028 of spec 010), measured in `docs/DECISIONS.md`. |
| 007 | FR-055 | "…filling at least 90% of the window at 1280 wide…" | "…filling its card. On a wide page cards sit side by side (spec 010); a lone card fills at least 90% of the window at 1280." |
| 005 | research R17 | Stop is clear of Start because the bar grows **down**. | Unchanged in substance: the bar no longer grows at all. Noted in DECISIONS, not amended (research is not a requirement). |

Each amendment is made in place with `Amended by spec 010` and a note, as specs 008 and 009 did, and is pinned by
`npm run check:wide-amendments` (INV-017).

---

## R13. The fixture is part of the claim

The fit song uses single-digit frets (data-model.md §1). A two-digit fret widens its column by `1ch` (8.4px). One bar of
two-digit eighths makes a 4-bar line ≈75px wider. That pushes the card onto two lines at 1280 and breaks the fit. This is
recorded, not hidden:

- SC-001 and SC-002 are claims about this fixture.
- Decision 8 already says note names and touch sizes may scroll.
- The DECISIONS.md entry states the two-digit case and what it costs (one more line per card).
