# Contract: the round-trip suite

**Normative** for `src/lib/tab/__tests__/round-trip.test.ts`. This is the backbone FR-040 asks for.
How it gets its fixtures is research R2, and the numbers behind it are R3 and R14.

## The harvest

```text
vi.mock("../layout")  wraps layoutPart so it records its options
import "./ascii.test" and the rest  registers and runs them here
a final describe, after those imports, reads what was recorded
```

**Files harvested**: `ascii.test`, `grouping.test`, `techniques.test`, `techniques-repeat.test`,
`techniques-plain.test`, `techniques-layout-invariants.test`, and
`../../export/__tests__/text.test`.

The suite's own calls go through the real functions, taken with `vi.importActual`, so it does not
record itself.

**Guards**, so the suite cannot pass by seeing nothing:

- The count of recorded calls is at least 1,000, and distinct texts at least 400. Today's figures
  are 1,697 and 468.
- `readdirSync` of `src/lib/tab/__tests__` finds no `*.test.ts` outside the harvested list and a
  named exclusion list, which is `round-trip.test.ts`, `reader.test.ts`, `reading.test.ts`, and
  `single-owner.test.ts` (it reads source, and holds no fixtures).

## The two properties

For each recorded `options`, each density in `expanded` and `compact`, and each unique text:

```text
text     = toAscii({ ...options, density })
reading  = parseTab(text)
rows     = draftPart(reading.clipboard)
```

The suite uses `draftPart`, so it tests the same rows the preview draws.

**Same events.** `rows` equal the source, column for column, on every field the export draws, with
ids and ranks ignored, after the source is passed through `carried` below.

**Same text.** `toAscii({ ...options, events: rows, density: reading.density })` equals `text`.

Both run with chord and bracket rows on. Group ids are compared by partition (which columns share
one), not by value.

## `carried`: what the text can hold

Each rule is a named function, and each is a row of the Summary's table or of the additions in the
plan's *Deviations*.

| Rule | What it does to the source |
|---|---|
| `undrawnTechniques` | Removes a transition with no drawn connector, a second transition, `dead_note`, anything unknown |
| `techniqueSets` | Compares a string's list as a set |
| `emptyColumn` | A `notes` column with nothing on a string of this tuning becomes `rest` |
| `kindlessGroup` | A group with null kind becomes `"tuplet"`, and a null count becomes 3 |
| `splitAtBarline` | An old group across a barline becomes two groups |
| `durations` | Sets `durationHint` to null |
| `chordValues` | Drops a chord that is not a chord symbol |
| `chordOverwrite` | Replaces chords with what the chord row actually kept |

## The ledger

Anything that still differs must fall in exactly one class. An unclassified difference fails the
test and prints the text. **Every class must be hit at least once**, or the test fails too, so a
class cannot quietly become dead (FR-040: "asserted as such, and not skipped silently").

| Class | Property | Text | Asserted result |
|---|---|---|---|
| `separately-stored` | Same events | Expanded, or compact with no label | Unrolled columns equal, and rows hold the merged form |
| `compact-without-label` | Same text | Compact with no label | Redraw equals `text` in **expanded**, as the spec names |
| `first-note-repeat` | Same events | `7h7h7` | First pass `repeat: 1` with no technique, the rest repeated with it |
| `counted-split` | Same events | `5 5x8 5` drawn as ten | `5x8 5 5`, drawing the same |
| `plain-unrolled` | Same events | A repeat under a plain bracket, expanded | Columns unrolled, drawing the same |
| `repeated-space` | Same events | A repeated rest, compact | One space |
| `no-notes` | Both | The empty part, a part of only rests or barlines | Refused as `no-notes` |
| `chord-clipped` | Same events | A chord cut at the end of the body | Reads what is drawn, with a `clipped` entry |
| `chord-not-a-symbol` | Same text | A chord value that is not a chord symbol | The line is commentary, and the redraw has no chord row |

`chord-clipped` and `chord-not-a-symbol` do not occur in today's fixtures, so the pinned fixtures
below hit them rather than the harvest.

## Pinned fixtures

Written out in this file because the harvest cannot reach them:

- The whole of `specs/002-playing-techniques/contracts/notation.md`'s exact fixture, and every row
  of its Spacing table.
- Every row of `specs/003-generalised-grouping/contracts/notation.md`'s tables, and its short spans.
- `Cmaj7` on the only column, which reads `Cm` with a `clipped` entry.
- `riff` as a chord value, which comes back as commentary, in the `chord-not-a-symbol` class. Its
  redraw has no chord row, and that is asserted.
- `Am7` then `G`, reading `Am` and `G`, and a Same text pass.
- `16` running past a one-column group.

## The seeded generator

No new dependency. A small seeded generator in the test file builds parts from: frets 0 to 36,
`x`, one to six strings, all six decorations, all four transitions, repeats 1 to 12, spaces,
barlines at any position including first and last, chords from a fixed list, and counted and plain
groups inside a bar.

500 parts from a fixed seed, over `bass4-e`, `bass5-b` and `guitar6-e`, at both densities, through
both properties and the same ledger. A failure prints the seed and the text.
