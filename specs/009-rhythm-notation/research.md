# Research: Rhythm notation under the tab

**Feature**: `009-rhythm-notation` | **Date**: 2026-11-13 | **Plan**: [plan.md](./plan.md)

No `NEEDS CLARIFICATION` was left in Technical Context. The open questions were design questions, and each is settled below. Figures marked
**measured** were read from the tree or a probe on this branch. Figures marked **calculated** come from the measured tokens and the font's
published metrics. The first implementation task re-measures each calculated figure on the production build (`quickstart.md` §1) before any
drawing code lands.

## R1. How much height capture has for the rhythm row

**Measured** (spec 008 research R1, same tokens on this branch, `src/app/globals.css` lines 75–100, `CaptureScreen.tsx:677`): at 375×667
on touch, the band's outer height is **189.6px**, and its `pt-1` takes 4px. That leaves **185.6px** of content height, which spec 008 rounds
to 186. One line of six strings with a chord row and a bracket row is **184.0px**: 6 × 24.8 (`--string-height`) + 17.6 (chord row,
`--staff-row`) + 17.6 (bracket row). The spare is **1.6px**, not the 5px the spec's summary quotes.

**Binding**: spec 007 FR-030 says bracket numerals MUST be 12px or larger, and no line may cross a digit. Spec 009 does not amend it, so the
number under the tab stays at 12px.

**Calculated** need, from the top of a stem's visible part to the row's bottom (R2 gives the bands):

| Piece | Touch (px) |
|---|---|
| Stem showing above a thirty-second's third beam | 1.5 |
| Three beams and two gaps (FR-027) | 10 |
| Clearance, the bracket line, clearance | 3 |
| The numeral: 12px type in a 9px line box (cap height 0.73 em = 8.8) | 9 |
| Clearance from the capture cursor's 2px rule | 2 |
| **Total** | **25.5** |

Without new height, the space is 22.0px: the lead below the lowest fret number's mask (4.4, R2) plus a row the bracket row's height (17.6).
**That is short by 3.5px.**

**Decision**: FR-018's escape hatch, with the extra height taken from a named place: the band's own `pt-1`. While the staff draws a rhythm
row, the band's 4px top padding is dropped. One rule in `globals.css` does this:
`[data-testid="tab-band"]:has(> * > .tab-staff[data-rhythm]) { padding-top: 0 }`. It reads what `TabStaff` drew, so it cannot disagree with
the staff's own rule. A part with no durations keeps its padding and stays byte-identical. `useCaptureBand` already reads the band's padding
from computed style (`useCaptureBand.ts:35`), so the wrap decision sees the change without a code edit.

The content height becomes 185.6 + 4 = **189.6px**, and the touch rhythm row is **21.6px** (`1.35rem`):

| Staff (touch, 375×667) | Line before | Line after | Band content height |
|---|---|---|---|
| 6 strings + chord, no durations | 166.4 | 166.4 (unchanged) | 185.6 (unchanged) |
| 6 strings + chord + bracket, no durations | 184.0 | 184.0 (unchanged) | 185.6 (unchanged) |
| 6 strings + chord + durations, with or without a group | rhythm not drawn in capture | **188.0** | **189.6** |

That leaves 1.6px of slack, the same as today's worst case. The band's outer height (189.6, FR-018's "≥ 189px") does not change. The
figures are re-measured on the production build before and after the change, and recorded in `docs/DECISIONS.md` (`quickstart.md` §1 and
§6).

**Alternatives considered**:
- *A separate rhythm row under the staff, with the brackets kept above.* 184 + 17.6 > 185.6, so a string leaves view. This is why the spec
  moves the brackets.
- *A 10px numeral in an 8px box, inside 17.6px.* It fits, but it breaks spec 007 FR-030, which this entry has no mandate to amend.
- *A numeral inline with the bracket's line, with a mask breaking the line behind it.* It saves 3px, but it needs a fourth surface rule for
  the selection colour, and it is still 0.5px short.
- *Letting the numeral run under the cursor's rule.* The rule would cross a digit whenever the cursor is on a group's labelled column, which
  breaks FR-030 again.
- *A smaller `--staff-row` or `--string-height` in capture.* It changes a part with no durations, which FR-019 forbids.
- *Dropping the padding on every capture staff.* It changes a part with no durations (FR-019, spec 008 FR-003).

## R2. The geometry of the rhythm row

**Calculated** from JetBrains Mono's metrics (units per em 1000, ascender 1020, descender −300, cap height 730), at the staff's
`line-height: 1`. A fret number's `<span>` is a 1em box centred in its cell, with an opaque mask behind it (`.tab-cell > span`):

| | Touch | Fine |
|---|---|---|
| `--string-height` | 24.8 | 20.8 |
| `--staff-text` | 16 | 14 |
| Mask's bottom, from the cell's top: `(string-height + staff-text) / 2` | 20.4 | 17.4 |
| Free below the mask in the lowest cell: `(string-height − staff-text) / 2` | **4.4** | **3.4** |

**Decision**: every stem starts at the bottom of the lowest string's fret-number mask, whether or not that string has a note, so all stems
of one kind are the same length. The token is `--rhythm-lead: calc((var(--string-height) - var(--staff-text)) / 2)`, drawn as a negative
`top` on the stem. That space is already drawn and already paid for. With the row's top as zero:

| Band | Touch (px) | Fine (px) | What |
|---|---|---|---|
| Lead | −4.4 to 0 | −3.4 to 0 | The top of every stem, inside the lowest cell and below its mask. |
| Stem band | −4.4 to 7.1 | −3.4 to 8.1 | Stems, beams, flags, rests and the whole-note oval. Quarter stem 11.5, half stem 5.75. |
| Bracket line | 8.1 to 9.1 | 9.1 to 10.1 | The group's 1px line. Its 0.2rem hooks rise from it at the group's outer edges. |
| Numeral | 10.1 to 19.1 | 11.1 to 20.1 | The 12px numeral, `line-height: 9px`. |
| Rule clearance | 19.1 to 21.6 | 20.1 to 22.4 | The capture cursor's 2px rule (`.tab-column-active::after`) sits here and covers nothing. |

| Token | Touch | Fine |
|---|---|---|
| `--rhythm-row` | `1.35rem` (21.6) | `1.4rem` (22.4) |
| `--rhythm-lead` | `calc((var(--string-height) - var(--staff-text)) / 2)` | the same expression |
| `--rhythm-stem` (a quarter's full length, from the lead's top) | `calc(var(--rhythm-lead) + 0.45rem)` | `calc(var(--rhythm-lead) + 0.5rem)` |
| `--rhythm-beam` and `--rhythm-beam-gap` | `2px` and `2px` | `2px` and `2px` |
| `--rhythm-stub` | `0.35rem` | `0.35rem` |

Fine is not bound by height: the band at 1280×800 holds 376px (spec 008 R1). FR-020 holds on both pointers, at 21.6 < 35.2 and
22.4 < 30.4 (two `--staff-row`s).

Beams and flags stack upward from the stem's lower end: level 1 at the bottom, then a 2px gap, level 2, another 2px gap, and level 3. Three
levels take 10px and leave 1.5px of a thirty-second's stem showing.

All of these are CSS custom properties in the two existing token blocks. No component hard-codes a pixel figure. The values are a starting
point. What must hold are these constraints:

- a stem never starts inside a fret number's mask (INV-008);
- each band's content stays inside its band, and nothing in the row overlaps another band (INV-008);
- beams and flags are ≥ 2px thick, the gaps between them are ≥ that thickness, and stems and bracket lines are ≥ 1px (FR-027, INV-009);
- the numeral is ≥ 12px, and no line crosses it (spec 007 FR-030, INV-008);
- the touch line fits the band's content at 375×667 (INV-005).

**Named fallback**: if a measured glyph box differs from the calculation, the touch `--rhythm-row` may grow into the 1.6px slack, up to
23.2px. If that is still not enough, the stem showing above a thirty-second's third beam may drop from 1.5px to 1px, and no lower. Anything
beyond that reverses a blast-radius decision. Implement then stops, records the reversal in the plan's *Blast-radius decisions*, and the
decision is re-made there.

**Alternatives considered**:
- *Stems wholly inside the row.* The row would need 25.5px on touch, and only 189.6 − 166.4 = 23.2 is available.
- *Stems from the lowest string's line, behind its digit's mask.* This is conventional when the string is empty, but a stem on a column with
  no note on the lowest string would then be 12.4px longer than one on a column with a note there.
- *Fixed pixels in the component.* Two pointer densities would need two code paths. Tokens follow the way `--staff-row` already works.

## R3. Where beat positions come from

**Measured** (`src/lib/rhythm/notation.ts`): `readBar` is the only code that turns durations, counted-group fractions and repeat hits into
ticks. Its optional `hit(eventId, repetition, at)` callback runs for each hit **before** the next column is checked. When a bar fails, the
hits already reported are exactly the columns whose position is known: those before the first unset column, or before the first column of a
group that does not read. That is FR-008's rule. `walk` stops at the first bar that fails (see the spec's "Where the brief and the code
differ"), but `readBar` itself works one bar at a time.

**Decision**: add one export to `notation.ts`, `barPositions(events)`. It runs `census` once, calls `readBar` on each bar with a `hit`
callback, and ignores the bar's result. It returns a map from `eventId:repetition` to `{ tick, countedGroup }`, with `tick` counted from the
start of the bar. `readBar`'s `hit` callback gains a fourth argument, `counted: boolean`, which is true when the hit is inside a counted group
that reads. The existing callers ignore it, so `readNotation`, `notationColumns` and `beatsPerBar` are unchanged, and their tests prove it
(`notation-baseline.test.ts`, `notation-oracle.test.ts`, run unedited).

The staff takes its positions from the same function that times the click, so the two cannot disagree (INV-003).

**Alternatives considered**:
- *`notationColumns`.* It stops at the first untimed bar, which FR-006 forbids, and its ticks count from the song's start, not the bar's.
- *A second walker in the beaming module.* It would copy the arithmetic and be one edit from drifting. That is spec 460's lesson.

## R4. The beaming rule as data

**Decision**: a pure function, `rhythmMarks(columns, positions, density)` in `src/lib/rhythm/beams.ts`, returns one `RhythmMark` per layout
column (`data-model.md`). A column is **beamable** when all of these hold:

- it is `kind: "notes"`;
- its duration is `8`, `16` or `32`;
- it is not a compact repeat (`density === "compact" && repeat > 1`);
- its position is known.

Its **unit** is `g:<tupletId>` when its hit is in a counted group that reads. Otherwise it is `b:<tupletId or "">:<floor(tick / TICKS_PER_BEAT)>`.
A **run** is a maximal sequence of *consecutive layout columns* that are all beamable and share one unit.

Each case FR-007 lists is closed by one of these:

- **Barlines** are layout columns, so a run cannot cross one.
- **Rests, unset columns and longer notes** are not beamable.
- **Group edges** cannot be crossed, because the unit carries the group's id.
- **Wrapped lines** break only at barlines (`barRuns`), so on screen a run never crosses one.

Connector and removal gaps are not columns, so a run passes through them (the "connector gap" edge case).

Within a run, a note's levels are its flag count: 8 → 1, 16 → 2, 32 → 3. For neighbours `i` and `i+1`, `join = min(levels[i], levels[i+1])`.
Column `i` records `left = join(i−1, i)` and `right = join(i, i+1)`. Any level above `max(left, right)` is a **stub**. A stub points right on
the run's first column and left everywhere else. A run of one draws `levels` flags instead.

Worked cases (each is a row in the FR-036 unit table in `contracts/beaming.md`):

| Bar | Runs | Why |
|---|---|---|
| 8 8 8 8 8 8 8 8 | four runs of two | one run per beat |
| 16 8 16 | one run of three | level 1 runs across; level 2 is a stub, pointing right on the first and left on the last |
| 8 \| 8 8 \| 8 | (8) flag, (8 8), (8) flag | barlines are columns |
| 8 q 16 16 | (8) flag, then (16 16) | the quarter starts halfway through beat 0 and is not beamable; the 16ths start at 1.5 and 1.75, both in beat 1 |
| 8 8 8 (a bar of 1.5 beats) | (8 8), then (8) flag | the partial last beat beams within itself |
| triplet 8 8 8 starting at beat 1.5 | one run of three | a counted group is one unit |
| 8 [plain 16 16 16 16] 8 | (8) flag, (16 16 16 16), (8) flag | group edges |
| unset, 8 8 | none; both flagged | positions after the unset column are unknown |
| 8 8, unset | (8 8) | positions before it are known |

**Alternatives considered**:
- *Beaming from measured x positions.* This reads the drawing back to itself.
- *Breaking runs at beats inside a counted group.* The spec decided against it ("A counted group beams as one unit").

## R5. How beams stay attached to stems at any width

**Decision**: no beam is drawn by measuring. Each column draws its own **halves**:

- a segment from its left edge to its centre for each of its `left` levels;
- a segment from its centre to its right edge for each of its `right` levels;
- stubs from the centre, `--rhythm-stub` long, capped at half the column's width.

A connector gap or a removal gap between two joined columns draws full-width segments for the arriving column's `left` levels. The stem sits
at `left: 50%`, and a column's cells are centred (`.tab-cell` uses `place-items: center`), so the stem is under the note's centre by
construction. Whatever widens a column widens the halves with it: a chord symbol, the reading view's longer cells, or the wrapped staff's
`flex-grow`. So FR-016 and FR-017 hold with no measurement and no reload (INV-007).

In print, a bar wider than the page wraps its columns (`.tab-bar-run { flex-wrap: wrap }`). A run broken there leaves a half-segment on each
line. Each half is attached to its own stem and ends at its column's edge, and no piece reaches across the page.

**Alternatives considered**:
- *One SVG over the whole staff, positioned from measured column rects.* It needs a `ResizeObserver`, redraws on every width change, and
  breaks the property that markup is a pure function of props, which the `renderToStaticMarkup` tests rely on.
- *A canvas.* It has the same problems, and it cannot be measured element by element.

## R6. One number per group, on every staff

**Measured** with the probe `research-probes/split-groups.test.ts`, run as
`npx vitest run --config specs/009-rhythm-notation/research-probes/vitest.probe.config.ts`. Of the **3,394** layouts that
`frets-unchanged.test.ts` harvests, **0** draw one group id as more than one span.

Today `TabStaff` labels each span at its middle column. A legacy group stored across a barline (a spec 003 edge case) draws two spans, so
its number prints twice.

**Decision**: each group's number is drawn once, at the middle column of the group's **first** span. That column is computed once,
by `groupLabels(spans)`, and both placements use it. FR-014 then holds on every staff. Since no harvested layout splits a group, no
`baseline.json` markup hash moves, and FR-019 and SC-001 still hold.

**Alternatives considered**: deduplicating only on staves with rhythm. That would keep FR-019 with no test, but it would leave FR-014 false
on staves with no durations, and the probe shows there is nothing to protect.

## R7. One computation, two placements, for brackets

**Decision**: `TabStaff` derives one value, `bracketRow: "above" | "under" | null`. It is null with no groups, `"under"` when the staff draws
rhythm, and `"above"` otherwise. Every place that reads `hasTuplets` today reads `bracketRow === "above"` instead:

- the label offset (`offsetFor`);
- the caret;
- the empty staff;
- the wrapped gutter;
- `Gap`;
- `RemovalGap`.

The bracket is the same element in both places. It keeps the `tab-bracket` test id, `data-start`, the `start`, `end` and `labelled` inputs,
and the CSS classes. Under the tab it is mirrored: the line runs along the bottom of a 0.2rem box, with its hooks rising. These carry over
unchanged, which is FR-015:

- revealing a new group (`querySelectorAll("[data-start]")`);
- the selection colour (`.tab-column-selected .tab-bracket`);
- the line across gaps (`bracket` on `Gap` and `RemovalGap`);
- drawing the bracket on each line.

**Alternatives considered**: a separate component for the bracket under the tab. That would be a second copy of the start, end and label
logic.

## R8. Which surfaces draw rhythm

**Measured**: `SongView.tsx:416` and `PlayView.tsx:183` pass `showRhythm`. `CaptureScreen.tsx:681` and `PasteTab.tsx:194` do not. Whether
the row is drawn is already decided by one expression in `TabStaff`: `showRhythm && columns.some(duration !== null)`.

**Decision**: capture and the paste preview pass `showRhythm`. The prop's default stays `false`. That keeps `baseline.json`'s
`markup:*:plain` entries, and every test that renders without the prop, unchanged. The rule stays the one expression in `TabStaff`, so every
surface follows the same rule (FR-024). The prop's doc comment changes from "Off for capture and export" to "Every surface passes it; the
export never renders a staff."

**Alternatives considered**: removing the prop, or defaulting it to true. Either would edit every test that renders `TabStaff` with a
duration but no `showRhythm`, and would merge `frets-unchanged.test.ts`'s plain and rhythm pair into one, for no change in behaviour.

## R9. Drawing the symbols: SVG or text

**Decision**: stems and beams are absolutely positioned `div`s, with `background: currentColor`, at 1px and 2px. They are crisp, and their
rects are what the probes measure. Flags, rests and the whole-note oval are small inline `<svg>` elements, drawn in `currentColor` and
`aria-hidden`. Their path data lives in one table, `src/components/rhythm/glyphs.ts`, which the inspector's buttons also use for noteheads and
flags (FR-028). No font, image or fetched asset is added (FR-033).

Colour: the symbols use `--text`, which spec 007 already holds at 4.5:1 or better on `--bg`, `--bg-raised` and `--selection`. The 1px strokes
are thin, so the brighter `--text` is used rather than `--text-dim`. Brackets and numerals keep their existing `--text-dim`, which becomes
`--text` on a selection, unchanged (FR-015). Print maps `--text` to `#000`.

**Alternatives considered**:
- *Unicode music symbols (U+1D15F and so on).* They depend on the system font, are missing on many phones, and cannot be beamed.
- *Bravura or another SMuFL font.* It is a fetched asset (FR-033) and needs a service-worker change.

## R10. The duration buttons

**Measured** (`ColumnInspector.tsx:159`): `SegmentRow` draws `segment.label` as text, in a `grid-cols-6` row of `min-h-11` buttons with
`aria-label` set. `properties.ts:176` sets `label: d.mark`.

**Decision**: `ColumnSegment` gains an optional `symbol?: DurationId`. When it is present, `SegmentRow` draws `<NoteSymbol id={symbol} />`
in place of the label text and adds `title={segment.ariaLabel}`. `properties.ts` stays free of React and sets `symbol: d.id`. The symbol is
1.25rem tall, which fits inside the 44px button, and it is drawn in `currentColor`, so the lit state (`text-accent-text` on `bg-accent`, with
`aria-pressed`) carries over. The pressed state does not rely on colour alone: the existing border and fill change remain.

`Duration.mark` stays in the table, because spec 005's table tests pin it. Nothing draws it any more.

## R11. What breaks on purpose, and how tests read the notation

**Measured**: 20 e2e files and 3 unit specs read `data-testid="tab-rhythm"` or `duration-row`. Some of them read the mark's **text**
(`toHaveText("")`, `/\S/`, `textContent`). The plan's *Existing tests this changes on purpose* table lists them.

**Decision**: the rhythm cell keeps `data-testid="tab-rhythm"` and gains machine-readable attributes, so that tests read the notation rather
than pixels:

- `data-rhythm="note|rest"` and `data-duration="<id>"`;
- `data-flags`, `data-beams-left` and `data-beams-right`;
- `data-part` on each stem, beam, flag, stub, rest and oval.

A cell with nothing to draw carries none of these and has no children. Tests that read the text are re-pinned to `data-duration`. That is
FR-037's "updated to pin the notation, not deleted". Each one is named in `docs/DECISIONS.md` and in the plan's table, and
`check:notation-amendments` enforces this.
