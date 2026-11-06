# Research: Usability pass across every screen, phone first

Every claim marked **measured** was run before this was written. Reader claims ran on a throwaway copy of
`HEAD` with a candidate `parse.ts`. Browser claims ran through `audit/plan-candidate.audit.ts` against a
production build of `HEAD`, using style tags and no source change. Results are in `audit/results/plan-*.json`.
Nothing here has been seen by a person at actual size.

No item was left NEEDS CLARIFICATION.

## R1. Density: tokens under one media query

**Decision.** Touch sizes are the default values of custom properties in `:root`. A single
`@media (pointer: fine)` block overrides them. A Tailwind variant, `@custom-variant fine (@media (pointer: fine))`,
covers the few classes that are not sizes. `pointer: coarse` is never written.

**Rationale.** FR-023 needs no pointer to mean touch, and a default that only `fine` overrides gives that for
free. It also means a touch size cannot change because of this requirement: no touch rule is involved. Tokens
keep a row's controls at one height (FR-012), because they all read the same value.

**Alternatives.** `coarse` overrides over a mouse default would leave `pointer: none` on mouse sizes. `matchMedia`
in JS would flash on first paint and split the rule across two languages.

**Measured.** Chromium reports `pointer: fine` for Desktop Chrome and `coarse` for Pixel 7. The launch flag
`--blink-settings=primaryPointerType=1,availablePointerTypes=1,primaryHoverType=1,availableHoverTypes=1` gives
`pointer: none`. CDP's `setEmulatedMedia` does not: it ignores the feature. So a probe can reach the third state,
but must assert `matchMedia("(pointer: none)").matches` first, or it would pass on a mouse.

## R2. Mouse sizes that meet SC-009

**Decision.** On a fine pointer: staff text 0.875rem, column padding 0.5rem, string height 1.3rem, staff row
height 0.95rem.

**Measured.** With JetBrains Mono, a one-digit column goes from 19.19px to 16.39px, which is **17.1% more columns**.
String height 24.8 to 20.8. Height alone was not enough: changing only the strings gave 12.6% on a five-string
staff with a chord row and a rhythm row. With the rows at 15.2px too, a six-string staff goes 184 to 155.2,
**15.7% shorter**, and with a bar-number row 201.6 to 170.4, **15.5%**. The margin is thin, and INV-020 holds it.

## R3. The rows at their touch floors

**Decision.** Stable and contextual rows pad 8px at each side. The selection row pads 4px. The repeat count's
minimum falls from 40px to 36px. Contextual buttons pad 8px at each side. Delete in the stable row and in the
selection row keeps 8px from its neighbours.

**Measured at 375px, six strings, every control 44 tall.**

| Row | Rightmost edge | Limit | Spare |
|---|---|---|---|
| Stable | 360.9 | 367 | 6.1 |
| Contextual (stepper halves 32 wide) | 362.5 | 367 | 4.5 |
| Selection, seven controls, brackets 36 wide, delete 8px clear | 364 of content | 367 | 3.0 |

The selection figure is from summed widths (332) and gaps (24 plus 8). The band measures 189.8 at rest and while
selecting, with `overflow: 0` and the page unscrolled. That is the spec's budget holding with the floors applied.

## R4. One overflow rule

**Decision.** The band is always `flex-col-reverse`. Nothing branches on string count.

**Rationale.** A column-reverse scroller starts at its bottom, keeps overflow on the reachable side, and with
short content sits at the bottom, which is what `justify-end` was for. So one class gives both behaviours, and
FR-005's "opens showing the strings nearest the neck" is what it does by default.

**Alternatives.** `justify-end` puts overflow above the scroll origin (A31). `mt-auto` stops anchoring once content
overflows, as the code's own comment records.

## R5. Showing chords whole, with the arithmetic left to CSS

**Decision.** `chordRooms(columns)` returns, for each column with a chord, how many characters the chord has, and
how many columns and cell characters of room it owns. Room runs from the chord's column up to the next chord, or
through the closing barline, or to the end. `TabStaff` then writes the width as one `calc()`:

```css
calc(<w>ch + var(--col-pad) + max(0px, <n> * var(--chord-ch) + var(--chord-gap) - (<roomChars>ch + <roomColumns> * var(--col-pad))))
```

The label is `white-space: nowrap`, overflows its column, and sits above later columns' backgrounds. Only a chord
that would otherwise touch something widens its column.

**Rationale.** `ch` and the pad differ by pointer, so a JS pixel figure would need the density. Letting the browser
do it keeps one rule for both, and the layout (`layoutPart`, `TabColumn.width`) stays untouched, so the export has
no route to a screen width. Ending room at a barline means a chord never depends on the next bar, which is what
lets a line break at any barline.

**Alternatives.** Making a chord's column `max-content` needs no arithmetic, but widens every chord column, even
with empty columns beside it (about 15px a chord). FR-024 says "as needed". Widening in `layoutPart` would change
the export.

## R6. Wrapping the play view with no script

**Decision.** In `wrap` mode, `TabStaff` draws each bar as a flex item in a wrapping row, ending with its barline.
String labels are an absolutely placed, clipped gutter holding one label block per bar, so each line finds a block
at its own height. Bars and columns grow to fill a line, and a filler item keeps the last line unstretched. A bar
wider than the line is capped at `max-width: 100%` and scrolls alone, with its scrollbar hidden.

**Rationale.** The browser does the breaking, so there is no `ResizeObserver`, no width arithmetic to disagree with
the drawing, and no reflow script. Resizing, font loading and printing all work because they are layout. Every line
has the same rows, so every block in the gutter is the same height.

**Measured** in a static page with the same structure:

| Window | Lines | Worst label offset | Page scroll | Blocks in view | Line reach |
|---|---|---|---|---|---|
| 375, even bars | 8 | 0.05px | 0 | 8 | 375, last line 327 |
| 1280, even bars | 2 | 0.03px | 0 | 2 | 1280, last line 1248 |
| 375, one wide bar | 9 | 0.05px | 0 | 9 | that bar scrolls by 1372 |
| 1280, one wide bar | 4 | 0.05px | 0 | 4 | that bar scrolls by 467 |

**Alternatives.** Measuring in JS and breaking into several `TabStaff` would split the connectors, chord in force and
variant marks across calls, and needs a separate print width. A label per bar shown only at line start cannot be
written in CSS.

**Cost.** A hidden scrollbar is needed because a classic desktop scrollbar has height and would push later lines off
their labels (spec 006, Deviation 7). See Deviation 7 in the plan.

## R7. The reading position

**Decision.** `notation.ts` gets one internal walker. `readNotation` and a new `notationColumns` are both built on it,
so a column's tick comes out of the same loop as the clicks, and `readNotation`'s shape does not change. The engine
gets a read-only `playhead()`: the tick now, interpolated between the last click shown and the next click queued,
from the times they were actually scheduled at. `useClick`'s existing animation frame calls it right after `due()`.

**Rationale.** Columns fall between clicks, so clicks alone would leave eighth notes unmarked. `timeOf` and the anchor
cannot be used, because after `setTempo` the anchor sits ahead of clicks already queued at the old tempo. Interpolating
between scheduled times stays right across a tempo change. Using the same frame as the beat gives SC-013 with no
timer. The audio path is not touched: `playhead()` reads `clock.now()` and two stored clicks, and schedules nothing.

The DOM is written directly, as the beat is, with one attribute on one column, and only when the column changes.

**Alternatives.** A React state per column would re-render every staff on a hot path. A separate timer could drift
from the beat.

## R8. Keeping the highlight on screen

**Decision.** Reader intent is taken from `wheel`, `touchmove`, a `pointerdown` on the page's scrollbar and the scroll
keys, not from `scroll` events. The view follows with `scrollIntoView({ block: "nearest", inline: "nearest" })`, with
`scroll-padding-bottom` on the document equal to the cluster's height.

**Rationale.** A `scroll` event cannot tell the view's own glide from the reader's. `nearest` also walks a wide bar's
own scroller, so FR-056 needs no separate code. Reduced motion is already forced to `auto` in `globals.css`.

## R9. The reader: which lines become commentary

**Decision.** `readsAsProse` gains one case. A line is prose when it splits on `-` into two or more pieces, every piece
reads as a chord with an **uppercase** root, and at least one has a letter straight after its root and accidental.

**Rationale.** FR-034's "a quality a fret row cannot hold" needs a definition that is about the line, not the notation's
alphabet, because `m` is a legal cell character (palm mute, drawn `7m`). What rules out a row is a letter directly after
the root, which puts it before any digit. Uppercase roots matter: `parseChord` takes lowercase, so without this `Am7-b7`
would be admitted, and `b7` could be a damaged bend. `readsAsProse` already refuses any line opening or closing on a rail,
so "no rail at either end" costs nothing, and S5 and S6 both ask it, so one change covers every route.

**Measured,** with the candidate on the throwaway copy:

| Line | Above, below and apart from a good system |
|---|---|
| `Am7-D7`, `Am7-D7-G`, `Cmaj7-Fmaj7`, `Dm7-G7-Cmaj7`, `F#m7-B7` | Reads, line listed as ignored |
| `A7-D7`, `E5-A5`, `A7-D7-E7`, `C-G7`, `D-7-G-7` | Refused, with the new wording |
| `Am7-b7`, `Am7-7`, `Am7-5`, `Bm7-5`, `Am7-D7-`, `G5-7`, `E-5-7`, `1-2-3-4-`, `(c) 1999-2004` | Refused as today |

- `src/lib/tab` and `src/lib/local`: **3,396 of 3,396 pass.**
- Spec 004's unit probes: the candidate adds **no new failure**. 19 fail with or without it. They are stale probes that
  later rounds superseded, and one timing probe failed only on the unpatched run.
- F75's measure: **39 of 202 refuse, down from 43.**

## R10. The reader: rewording, with no way to change a result

**Decision.** `failed()`, which every refusal passes through, swaps the code to `chords-joined` for any refusal on a line
that reads as chords joined by hyphens.

**Rationale.** It runs only on a paste already refused, and maps a refusal to a refusal on the same line. So it cannot
turn a refusal into a reading or the other way round, and INV-006, 009 and 010 cannot be affected by it. The test is a
small table over pieces that may themselves hold a hyphen, as `D-7` does.

**Measured.** "Put spaces between them" alone would be **false**: `A7 D7` directly above a staff reads as a chord row and
refuses, because `A7` has no column. It reads when set apart from the staff. So the wording is: *This looks like chords
joined by hyphens. Use spaces between them, on a line apart from the staff, or delete it.* INV-029 tests that the advice
works.

## R11. Colour

**Decision.**

| Token | Theme | Today | After | Lowest ratio where it is drawn |
|---|---|---|---|---|
| `--text-faint` | dark | `#6b6b76` | `#84848c` | 4.57 on an inlay |
| `--text-faint` | light | `#8a8a94` | `#686870` | 4.57 on an inlay |
| `--fret-number` | dark | `#70707b` | `#84848c` | 4.57 on an inlay |
| `--fret-number` | light | `#6b6b74` | `#686870` | 4.57 on an inlay |
| `--accent` | light | `#b45309` | `#a74d08` | 4.56 on the selection band |

On the selection band the bracket numeral and line take `--text` (9.73 dark), because `--text-dim` is 4.08 there.

**Rationale.** The audit named the greys. Computing every ink on every surface found one more: the light accent measures
4.05 on the selection band, 4.15 on an inlay, 4.16 on the variant tint and 4.44 on the sunken surface. A chord tone on an
inlay and a chord label on a selected column are both real cases, so SC-006 cannot pass without it. White on the new accent
is 5.66, up from 5.02.

**Cost.** Faint and dim move closer: 1.33:1 apart in the dark theme and 1.20:1 in the light. The chord-tone comment in
`Fretboard.tsx` quotes the old figures and must be updated.

## R12. The staff's font, and a defect beside it

**Decision.** `.tab-staff` asks for `var(--font-mono-face)` directly. `layout.tsx` does not move the font variables.

**Measured.** `--font-mono` is built at `:root`, and `--font-mono-face` exists only on `<body>`, so it is invalid where it is
defined. The same style tag gives `JetBrains Mono` from CDP's `getPlatformFontsForNode`, and a column of 19.19px, up from 18.22.

**Found on the way.** `--font-sans` has the same fault. CDP reports `h1` drawn in **Segoe UI**: Geist has never been
applied to the interface. Moving the variables to `<html>` would fix both, and would change the width of every label on
every screen, after this plan's budgets were measured. So this entry fixes the staff only, and logs Geist as a new idea.

## R13. Bracket numerals with no mask

**Decision.** The bracket line moves to the bottom of its row and its hooks go from 0.3rem to 0.2rem. Numerals are 12px on a
12px line at the top of the row.

**Rationale.** In a 17.6px row the line's top is 14.4, and the numeral's box ends at 12. On a mouse, the row is 15.2 and the
line's top is 12, so it touches the box but no digit, which has no descender. No height changes, and no mask is needed, so
nothing must be repainted per surface.

## R14. Zoom, insets and the on-screen keyboard

**Decision.** Per `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-viewport.md`: remove
`maximumScale`, add `viewportFit: "cover"`. `touch-action: manipulation` goes in `@layer base` on the capture surface. Tokens
`--safe-top` and friends wrap `env()`. `Sheet` lifts by `--kb-inset`, set from `visualViewport`. `interactiveWidget` is left
alone.

**Rationale.**

- `manipulation` keeps pinch and drops double-tap zoom. It is in a layer so that `touch-none` on the tap pad still wins.
- `resizes-content` would shrink `h-dvh` under the capture form and crush the neck, so a visual-viewport inset is the safer
  route for the one surface that needs it.
- The paste status needs no inset: it moves above the box, and the box is capped at 30dvh. On a 667 screen that leaves status
  and box inside the 407px above the keyboard.

**Measured.** CDP `Emulation.setSafeAreaInsetsOverride` moves `env(safe-area-inset-top)` to 47px, so FR-022 has a real probe.
A keyboard cannot be emulated, so a probe stubs `visualViewport` and reads real layout. A real phone stays owed.

## R15. Fast typing

**Decision.** Frets entered by key run through a queue. Each one calls the latest `press`, waits for the write, then waits for
the live query to deliver before the next.

**Rationale.** `insertColumn` works out its rank from the `events` it is handed. Two presses from one render get
`rankBetween(last, null)` twice, so they tie, and their order rests on ids. A thumb cannot tap that fast, and a keyboard can. A
silent wrong order is exactly what this app must never do. The queue keeps `press` as the only write route, so FR-060's "exactly
what tapping does" stays structural.

**Alternatives.** Rereading rows inside `insertNote` would change `editing.ts`, which FR-063's spirit fences, and the tap path.

## R16. Panels

**Decision.** One `Panel` primitive: a button with `aria-expanded` and a `hidden` body, so what is inside stays mounted. Open
state is remembered in one `localStorage` key, `stablature.panels`, read with the discipline of `view.ts`, and closed on the
server and first client render.

**Rationale.** Staying mounted keeps `ExportSong`'s state and lets the export note stay beside the buttons (FR-042). An empty
arrangement shows its add controls with no panel, or a new song would open with no visible way to begin.

## R17. Reach on the song page

**Decision.** On touch, Capture and Play view sit in a sticky bar at the end of `main`, the pattern `ClickBar` already uses. On a
mouse they stay in the header. Both are rendered, and one is `display: none` by pointer.

**Rationale.** Sticky keeps the bar in the flow, so it never covers the last card, and `no-print` drops it. A fixed bar would need
padding to match.

## R18. The vertical budgets of SC-010

Today, from `audit/results/plan-fonts-tops.json`: song page first staff 744, play view 244, click bar 81.

**Song page, planned.** Top bar 45, `pt-3` 12, one-row header 64, gap 12, tools and arrange on one row 44, gap 12, heading 28,
roadmap 48, gap 16, parts row 52, card padding 16, card head 88. **That is y≈437, or y≈491 with chips on two rows, against 520.**

**Play view, planned.** Top bar 45, `pt-2` 8, heading 62, gap 8, card edge and padding 11, card head 24. **That is y≈158 against
160, so 2px to spare.** It depends on a pass heading staying on one line, which is why the section name moves into the card's head
row (Deviation 8). Neither figure has been tried in a browser. If the play view misses, trim `pt-2` first.

**Idle cluster.** 44 + 12 of padding + 1 of border = 57, against 60.

## R19. Status row words

**Measured** at 11.2px in the system stack, with 351px usable at 375, 88 for the jump buttons and 24 of gaps:

| Case | Words | Chord (10 chars) | Total | Fits |
|---|---|---|---|---|
| Stacking onto the marked column | 166.2 | 67.2 | 345.4 | Yes, 5.6 spare |
| Adding after the marked column | 159.6 | 67.2 | 338.8 | Yes |
| Triplet refusal | 197.2 | 67.2 | 376.4 | **No, by 25.4** |

So the order of giving way is tones, then the duration, and in a refusal the chord. See Deviations 3 and 4.

## R20. Next.js, Tailwind and dependencies

`Viewport` still takes `viewportFit` and `interactiveWidget` (`dist/lib/metadata/types/extra-types.d.ts`). No other Next.js API is
involved. `@custom-variant` is a standard Tailwind 4 directive. **No new dependency.**
