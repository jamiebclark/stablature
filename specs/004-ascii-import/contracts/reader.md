# Contract: reading tab text

> *Amended by spec 007 (see `specs/007-usability-pass/contracts/reader.md`): `parse.ts` gains `joinedByQuality`, `looksJoined` and the refusal code `chords-joined`; `readsAsProse` and `failed` change with them.*

**Normative** for `src/lib/tab/parse.ts`. The notation itself is defined in
`specs/002-playing-techniques/contracts/notation.md` and
`specs/003-generalised-grouping/contracts/notation.md`, and is not restated here. Where this file
narrows a line of the spec, the plan's *Deviations* says so.

```ts
export function parseTab(text: string): ParsedTab;
```

Pure, synchronous and total. It never throws on any string. It imports `model.ts`, `chords.ts`,
`tab/techniques.ts` and `export/text.ts`, and nothing from `local/`.

## 1. Lines

Split on `\r\n`, `\r` or `\n`. Strip a leading `U+FEFF`. Numbers count from 1, blanks included.
Non-breaking spaces become spaces outside a staff body. Trailing whitespace is dropped.

## 2. Classifying a line

Walk from the **last line to the first**, so the line below is already classified. Take the
first row that matches.

| # | Kind | Test |
|---|---|---|
| 1 | Blank | Only whitespace |
| 2 | Bracket | The line below is a staff row, and the line passes §3 |
| 3 | Chord | The line below is a staff or bracket row, and the line passes §4 |
| 4 | Heading | `isPartHeading(line)`, the line below is a staff, chord or bracket row, and a staff row appears anywhere above it |
| 5 | Staff | Any of S1 to S4 below |
| 6 | Commentary | Anything else |

Row 4 needs "above", which a bottom-up walk has not seen. So a heading candidate is marked on the
way up, and a second top-down pass over the marks turns it into `several-parts` or commentary.

**Candidates.** Two tests need column positions, and columns do not exist yet at this step: a
digits-only bracket line (§3) and a chord symbol that only passes once split (§4). Each stays a
**candidate**, and is settled when chords and brackets are placed, after the paste's reading of
rails is known. A candidate that fails there becomes commentary and never refuses. Brackets settle
first, because a chord row above a bracket candidate that failed is no longer directly above a
staff, so it becomes commentary too.

**Staff tests.** "Word" is 1 to 4 letters, digits, `#`, `♯` or `♭`, so `P.M.` is not one.

| Test | Line, after any gutter |
|---|---|
| S1 | A word, any spaces, then a pipe |
| S2 | A pipe |
| S3 | A note name, any spaces, then a rail, and the rest holds a digit or a second rail |
| S4 | Anywhere, a run of three or more rails, and a digit, or an `x` touching a rail |
| S5 | **By its block.** A note-name row with no pipe needs a rail after its cell (`E-x`, `G-5` alone refuse as row-length). A line touching a staff row of the block as it has grown is a row of that block when (a) it is made only of the notation's own characters with at least one rail or pipe (`isNotationOnly`: rails, long dashes, pipes, cell and connector characters, no spaces), with no further test, and a line with no digit or `x` on it joins only an unlabelled block; or (b) by what the line holds, for a line `isNotationOnly` did not claim: (1) no digit and no `x`: it cannot lose a note, and (a)'s rule stands; (2) a digit or `x`, and a rail, long dash or pipe: a row, unless it is positively prose; (3) a digit or `x`, and no rail, long dash or pipe: commentary, unless a digit or free `x` on it touches a mark (anything but a letter, digit, space or bracket) and it is not prose, which keeps rows whose rails are gone, as `−5−7−`. Prose is a line of only numbers and `. / :`, a line whose every token is a chord symbol, or a line holding a word of two or more letters that is not a note name, so `Cb:5-7` needs no label set aside. A line opening or closing on a rail, long dash or pipe is never prose. There is no heading exclusion. Accepted costs, each safe: `1 - 2 - 3 - 4`, `-- Verse 2 --` and `Verse 1 -` refuse. So `-5s7-`, `--5 7--`, `−5−7−`, `B:-5-7-`, `E  5-7-5` and `E-x` are rows, and `Verse 2`, `Chorus x2`, `A  12-bar` and `1   2   3   4` stay commentary |
| S6 | **Where a block starts, asked of any line wherever it sits** (a line's being a row must not depend on whether a block is already beside it). A line is a staff row when one run of characters with no space in it holds both a note (a digit, or a free `x` with no letter either side; in a run made only of the notation, any `x`) and a rail, long dash, minus sign or pipe, and the line is not prose. The unit is the cell, not the digit's neighbour, so `(5)-`, `<12>-` and `t5b-` count as notes in their run. Cost: 43 of the 202 lines in the ordinary-lines probe refuse, such as chord lists `Am7-D7`, `(c) 1999-2004`, `m.1-4`, `1st-2nd`, `x2-` and `-1/2 step`. A line of only numbers, `x`, spaces, `. / :` and hyphens also needs a rail at its own edge, or a line touching it that holds a rail and is not prose, so `1-2-3-4` alone stays commentary and `3-5-3-7` under a rails-only row is a row. A pipe touching a rail or a note makes a row whatever else the line holds, so `Guitar\|--3--5--` is a row. A rail standing apart, as in `Am7 - D7` or `x2 -`, is in a run of its own, so it is prose punctuation. The minus sign joins the long dashes and pipe in the edge test of prose, so all four rail spellings agree. So `G:-3-5-3-7-`, `E:\|--3--5--\|` and `———5———7———` each start a block, and S5 then grows it. Accepted costs, each safe: `A 1-8`, `A: 1-4`, `(1-4)`, `[1-4]` and `+1 -1` refuse, and stacked lines of only the notation refuse unless their count and width fit a staff, when they read as rows. `G 3-5-3-7` alone refuses as `bad-character`, not as a row |

One walk decides every line kind. For each line, bracket, chord, S1 to S4, S6 and S5 are tried together, so a chord
or bracket test sees the block as it has grown. The walk repeats, alternating direction (last to first, then
first to last), until a sweep changes nothing: a block grows whole in one sweep and stacked lines stay linear.
No row shape needs its own test: an empty row, a row in long dashes and a busy row such as `-5-7-5-7-5-` all
join the block they touch. A chord or bracket line is never S5. A chord line that only passes once split
(`D-G-7`) stays a chord candidate (row 3), so the staff tests above never see it.

Note names are `[A-Ga-g]`, then `#`, `b`, `♯` or `♭` at most twice, then an optional octave digit.

| Line | Result |
|---|---|
| `B \|--?--\|` | S1, then refuses on the `?` |
| `T\|---` | S1, then refuses as `label-unknown` |
| `G-5s7-` | S3, then refuses on the `s` |
| `A-men`, `E-Bow` | Commentary |
| `P.M.----\|`, `-------` | Commentary |
| `--- 2nd verse ---` | S4, refuses. Safe, and the line is one tap to delete |

## 3. Bracket rows

Split on spaces. Every token must be one of these, and at least one must exist.

| Token | Form |
|---|---|
| Full | `,` then rails and at most one run of digits, then `,` |
| Short | `<digits>,` or `,,` or `,` |
| Bare | `<digits>` |

Rails with no comma are never a token, so `---5---7---` is not a bracket row.

- **A line with any comma** is a bracket row. Problems with it refuse.
- **A line of only bare digits** is a bracket row only if every token starts on a column and is
  2 to 16. Otherwise it fails this test, and is usually commentary.

Offsets are measured against the **top row of the staff beneath**, from its `bodyStart`.

| Rule | Refuses as |
|---|---|
| A token must start on a column's start | `bracket-placement` |
| A full or short token must end on a column's end | `bracket-placement` |
| A bare digit token wider than its column need only start there | |
| A span must not contain a barline | `bracket-placement` |
| Digits must be 2 to 16 | `bracket-range` |
| A tab character in the line | `bracket-placement` |

Digits mean a counted tuplet, with `tupletCount` that number and `groupKind: "tuplet"`. No digits
mean a plain group, with `tupletCount: null` and `groupKind: "plain"`. Each token gets its own
`tupletGroup`, so its own new id. A rest column may sit in a span. In a paste read with no spaces,
a bracket can only start and end on written columns.

## 4. Chord rows

Split on spaces into symbols, keeping each symbol's offset. A symbol is a chord when:

- it does not open with `(` or `[`, and
- it is `N.C.`, or `parseChord(symbol)` is not null.

A symbol that fails whole is split at the column starts beneath it, and passes if every piece
passes. So `AmG` splits and `Am7` stays whole. Any symbol that still fails means the line is not a
chord row. It falls through to the later tests.

A line with **one symbol at offset 0** is not a chord row (the spec's lone-letter rule); `C-9` there goes on to the staff tests.

| Rule | Refuses as |
|---|---|
| Two chords on one column | `chord-collision` |
| A system with no column that is not a barline | `chord-no-column` |
| A symbol over 200 characters | `chord-too-long` |
| A tab character in the line | `chord-collision` |

**Anchoring.** The chord's offset is measured from the top row's `bodyStart`. If it is a column's
start, that is the column. Otherwise take the nearest column that is not a barline, by distance
to the column's extent, preferring the right on a tie, and record a `moved` entry. A chord stored
on a repeated column belongs to the first pass, which needs nothing special. It sits on the first
drawn column, and the merge rule keeps that column first.

If the last character of a symbol lands on the last position of the body, record a `clipped` entry.

## 5. Staff rows

**Label and pipes.** The body starts just after the opening pipe, or with no pipe, just after the
label, or with neither, at the first non-space character. A closing pipe is the last character of
the trimmed line.

| Rule | Refuses as |
|---|---|
| Anything after the closing pipe, such as `\| x4` | `repeat-sign` |
| `\|:` or `:\|` anywhere | `repeat-sign` |
| A note-name label that ends in a digit and has no pipe after it, such as `G5-7-` or `G2---5---`. The digit may be an octave or a first fret and the text cannot say which. `E1\|`, `G2 \|` and a note name with no digit (`G-5-`, `G---5---`) are not in doubt and read | `run-together` |

Outer pipes are never events. A `||` touching the opening or the closing of the row **is** that
pipe, and adds no barline, so `E||---5---||` holds no barline and bar 1 is not empty. The export
cannot write this, because it always has a rail beside a pipe.

**Body.** Scan left to right:

| Text | Meaning |
|---|---|
| Rail | Spacing |
| `\|` | A barline position. `\|\|` inside a body is one position |
| A glyph from `TRANSITIONS`, or `H`, `P` | A connector, belonging to the next cell on this row |
| Anything else | The start of a cell, which runs to the next rail, pipe or glyph |

| Character or run | Refuses as |
|---|---|
| `—` or `–` | `long-dash` |
| A space or tab | `space-in-body` |
| Any character outside the notation | `bad-character` |
| A second connector before the next cell | `connector-double` |

**Cell.** Strip a trailing `x<digits>`. Find the fret core, `\d+` or `x`. Name the decorations
from the remaining characters. Then require `decorate(core, ids)` to equal the text. A lone `X`
core folds to `x` first.

| Result | Refuses as |
|---|---|
| Fret text that opens on a zero with a digit after it, anywhere in the cell: `00`, `05`, `012`, `(00)`, `t00`, `00x3`. `Number` would drop the zeros and store one note for the run, and the text cannot say how many were meant. `0`, `10`, `0x3` and `(0)` read | `run-together` |
| Fret above 36 | `fret-range` |
| Same characters, wrong order | `decoration-order` |
| Otherwise fails, including `7b9`, `12t17`, `xx`, `x3` | `run-together` |
| Repeat of 0 or above 512 | `repeat-range` |

## 6. Building a system

All rows of a system are consecutive staff rows. Then, taken in this order:

| Rule | Refuses as |
|---|---|
| A system has one row | `lone-row` |
| Some rows labelled and some not | `labels-mixed` |
| A label that is not a note name | `label-unknown` |
| Rows differ in length, unless the difference is rails after the last note and no row has a closing pipe | `row-length` |
| A barline on only some rows, or rows' pipes at different offsets | `partial-barline` |

**Columns.** Sort cells by `start` and cluster those that overlap. A cluster is one column when
every overlapping pair nests **and** no row has two cells in it. Otherwise `cell-overlap`.
Barlines are columns of width 1.

| Rule | Refuses as |
|---|---|
| Cells in one column with different repeat labels, or a label on some and not others | `repeat-disagrees` |

## 7. Reading rails

One decision for the whole paste. The paste has the **app shape** when all of these hold:

- every row of every system is a label, at least one space, a pipe, a body and a closing pipe,
- every row of a system has the same length and the same pipe offsets, and
- every gap has odd width. The gaps are the opening run, each run between columns, and the
  closing run, measured across all rows, with a connector counting as a rail.

In the app shape, a gap of width `g` holds `(g - 1) / 2` space columns. In any other paste there
are none. A system with no columns is one gap.

## 8. Joining systems

| Rule | Refuses as |
|---|---|
| Systems differ in row count, or in labels by sound | `systems-differ` |

Append in order. Add one barline at a join whose upper system has a closing pipe on its rows.

## 9. Connectors

Along the whole joined part, for each row:

| Rule | Refuses as |
|---|---|
| No earlier note on that string in the part | `connector-unjoined` |
| No later note on that string in that system | `connector-unjoined` |

The arriving note stores the transition from the glyph, through `TRANSITIONS`. The source is
positional and is not stored. A barline, a space or a join between them does not matter.

## 10. Repeats

- **A repeat label anywhere in the paste**: the paste is compact. A labelled column stores that
  repeat, and nothing merges.
- **No label anywhere**: merge as in R7 of [research.md](../research.md), and FR-005.

| Group | Rule |
|---|---|
| None | A run stops at a barline, any difference in kind, frets or techniques, a chord on any column after the first, or a group edge. Over 512, split into chunks |
| Counted | With `excess` = drawn less the number: if `excess` is 0, negative, or more than the runs can save, nothing merges. Otherwise spend it left to right, earliest first |
| Plain | Nothing merges |

Space columns merge like any other column (FR-006). Barlines never do.

## 11. Finishing

| Rule | Refuses as |
|---|---|
| No staff row at all | `no-staff`, line null |
| No note on any row | `no-notes`, line null |
| A heading with a system above it | `several-parts`, on that line |

Any refusal means `ok: false`, with all of them, one per line, in line order. No partial result
leaves this function.

## Refusal codes

Every entry in the spec's refused list maps to a code here, and INV-007 and INV-008 run over this
table. Tuning codes come from `reading.ts`, see [writes.md](./writes.md).

| Code | Spec's case | Sample line |
|---|---|---|
| `bad-character` | A character the notation does not have | `E\|--5s7--\|` |
| `run-together` | A bend target, or two notes with no gap | `E\|--7b9--\|` |
| `fret-range` | Fret text over 36 | `E\|--57--\|` |
| `decoration-order` | Decorations in a different order | `E\|--7~b--\|` |
| `long-dash` | A long dash | `E\|--5—7--\|` |
| `space-in-body` | A space inside a staff body | `E\|--5 7--\|` |
| `repeat-sign` | Repeat signs | `E\|:--5--:\|`, `E\|--5--\| x4` |
| `partial-barline` | A barline on only some rows | `E\|--5--\|--7--\|` over rows with none |
| `row-length` | Rows of different lengths | One row two rails short, with closing pipes |
| `cell-overlap` | Cells that overlap | `12` above `34` shifted by one |
| `repeat-disagrees` | Repeat labels that disagree | `7x3` above `5x4` |
| `repeat-range` | A repeat of 0 or above 512 | `7x0`, `7x513` |
| `connector-unjoined` | A connector with nothing to join | `E\|--h7--\|`, `E\|--7h--\|` |
| `connector-double` | Two connectors in one gap | `E\|--5h/7--\|` |
| `systems-differ` | Rows out of step between systems | Four rows, then five |
| `labels-mixed` | Labels on some rows and not others | `E\|--` under `\|--` |
| `label-unknown` | Not a note name, or `T A B` | `T\|---` |
| `lone-row` | A lone staff row, or rows split by a line | One row, or a double-spaced paste |
| `bracket-placement` | A bracket that cannot be placed | `,--,` ending between columns, or across a barline |
| `bracket-range` | Its number is outside 2 to 16 | `,-1-,`, `,-17-,` |
| `chord-collision` | Two chords landing on one column | Two symbols nearest one column |
| `chord-no-column` | A chord with no column to land on | Over a system of barlines |
| `chord-too-long` | Beyond the limit sync enforces | A 201-character symbol |
| `several-parts` | More than one part in the paste | A whole song export |
| `no-staff` | No staff in the paste | Lyrics only |
| `no-notes` | A staff with no notes | `G \|-\|` and friends |
