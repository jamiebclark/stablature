# Research: Import ASCII tab by pasting text

Phase 0 for [plan.md](./plan.md). Technical Context had no open questions: the stack is fixed and
the spec settled the product rules. What needed working out is how those rules land on
the code as it stands, and whether they hold against what the export really writes.

Every "measured" or "ran" claim below came from a throwaway copy of `eaa56ba` outside the
repository on 2026-11-04, since deleted. It ran under Vitest with `fake-indexeddb`. None of it
is a browser measurement.

---

## R1. Where the reader lives

**Decision**: two pure modules beside the export, and one write module.

- `src/lib/tab/parse.ts`: `parseTab(text)`. Text in, parsed part or refusals out. Knows nothing
  about songs.
- `src/lib/tab/reading.ts`: `readTab(text, context)`. Calls `parseTab`, then applies the fit
  rule. This is the one function the preview and the write both call.
- `src/lib/local/importing.ts`: `importTab(...)`. The only writer.

**Rationale**: the grammar is testable with no store and no song, which is what makes the
round-trip suite cheap. The fit rule needs the song's tuning and notes, so it sits one level up.
Keeping both pure means the preview can run on every keystroke and write nothing by construction.

**Alternatives considered**: one module (rejected: the fit rule would drag `TuningRow` and
`EventRow` context through every grammar test); a method on `editing.ts` (rejected: 700 lines
already, and a parser is not an editing operation).

---

## R2. How the round-trip suite gets the export's fixtures without editing that file

The spec leaves this to the plan. FR-039 forbids editing the export's test suites, and FR-040
requires every fixture to run.

**Decision**: harvest them at run time. `src/lib/tab/__tests__/round-trip.test.ts` wraps
`layoutPart` with `vi.mock("../layout", ...)` so it records its options, then imports the test
files themselves. They register and run inside this file. A final `describe`, declared after
those imports, reads what was recorded and runs both properties at both densities.

**Rationale**: a hand-copied fixture list goes stale silently, which is exactly the failure a
backbone suite must not have. With the harvest, a fixture added to `ascii.test.ts` next year joins
the round trip with nobody remembering to. `toAscii` calls `layoutPart`, so one wrapper catches
every fixture, including those that call `layoutPart` directly and those reached through the
`rowOf` and `allRows` helpers.

**Ran**: importing `ascii.test`, `grouping.test`, `techniques.test`, `techniques-repeat.test`,
`techniques-plain.test`, `techniques-layout-invariants.test` and `export/__tests__/text.test` into
one file worked with no edits to any of them. All 315 tests ran, the harvest test ran last, and
it saw **1,697** `layoutPart` calls. Those drew **468** distinct texts across both densities.

**Cost**: those suites run twice, about half a second in total. Each file still has to be named
in an import, so a *new test file* is not picked up by itself. INV-005 closes that by listing the
directory and failing on any `src/lib/tab/__tests__/*.test.ts` that is neither harvested nor on
a short named exclusion list.

**Alternatives considered**: exporting fixtures from `ascii.test.ts` (forbidden by FR-039);
parsing the expected strings out of the file's source (loses the events, so Same events cannot
run); a copied fixture file with a checksum guard (detects drift but does not fix it).

---

## R3. Does the spec's rail rule hold on real output?

The rule in **Reading rails** rests on one claim: everything the export writes has an odd rail
run between columns, once column widths are allowed for.

**Ran**, over all 468 distinct texts: **0** with an even run, **0** with rows of unequal length.

A throwaway reader using only that rule, column extents and the merge rule then redrew **394 of
394** staff-only texts character for character. Chord and bracket rows were switched off for this
run, and one further text had no notes. So the column model is sound. The chord and bracket
readers are designed below and were not prototyped.

**How it reads**: a gap is the positions between two column extents. Its width `g` holds
`(g - 1) / 2` space columns. The opening run and the closing run follow the same formula. A
system with no columns at all is one run. A connector counts as a rail because it replaces one.

---

## R4. Lines are classified bottom-up, and the order matters

The spec defines five line kinds, but three of its definitions overlap in ways that would lose
notes or chords if read top-down.

**Decision**: walk the paste from the last line to the first, so a line's neighbour below is
already known. For each line, in this order: blank, bracket row, chord row, part heading, staff
row, commentary. The full table is in [contracts/reader.md](./contracts/reader.md).

**The overlaps, each confirmed against the code:**

| Line | Matches | Must be |
|---|---|---|
| `,---3---,` above a staff | The damaged-row rule (three rails and a digit) and a bracket | Bracket |
| `    D-7   A-7` above a staff | The damaged-row rule (label then rail) and a chord row. **Ran**: `parseChord("D-7")` and `parseChord("A-")` both read | Chord row |
| `---5---7---`, an unlabelled row | The spec's literal bracket-row test (only rails, digits and spaces) | Staff row |
| `1   2   3   4` sitting exactly over four columns | The short bracket form, which would read as four groups | Commentary |

The third and fourth are why a bracket row is defined by **tokens**, not by its character set.
See R11.

---

## R5. Reading a cell calls `decorate`

**Decision**: split a body into runs at rails, pipes and connector glyphs. For each run, strip a
trailing `x<digits>` label, find the fret core, collect which decorations its other characters
name, and then accept the run only if `decorate(core, ids)` reproduces it exactly.

**Rationale**: the fixed order `t(<7>)b~m` then has one owner. Restating it in a regex would make
a second copy, and `WRAP_ORDER` and `READING_ORDER` are private on purpose. Refusing decorations
in the wrong order falls out for free, which the spec requires. Glyphs and affix characters are
read from the `TRANSITIONS` and `DECORATIONS` tables. The header of `techniques.ts` says only
`layout.ts` and the capture descriptors read it, so that comment gets one more name.

This also settles the cases that look alike:

| Run | Strip label | Result |
|---|---|---|
| `7x8` | `7`, repeat 8 | Compact cell |
| `xx3` | `x`, repeat 3 | Dead note, repeated |
| `xm` | none | Palm-muted dead note |
| `x3`, `7x`, `xx`, `7b9`, `12t17` | none reproduces | Refused as run together |
| `57` | none | Refused as over 36 |

`X` is folded to `x` only as a fret core, and `H`, `P` only as glyphs. `7X8` stays refused.

---

## R6. Columns come from containment, with two refusals the spec does not name

**Decision**: sort a system's cells by start and cluster overlapping cells. A cluster is one
column if every overlapping pair nests. It refuses if any pair overlaps without nesting, and also
if **two cells on one row fall in the same cluster**.

**Rationale**: `t(<7>)b~m` over `5-7` passes a pairwise "one contains the other" test, because
both small cells sit inside the wide one. That would make two notes on one string in one column.
The export cannot write it, and reading it means guessing, so it refuses as an overlap.

A second connector in one gap (`5h/7`, `5h-/7`) refuses too. Nothing can draw it.

---

## R7. The order of the reader's steps

Merging depends on chords and brackets, so those are placed first.

1. Classify lines (R4).
2. Read each row: label, pipes, body runs.
3. Build each system's drawn columns (R6).
4. Decide the paste's reading of rails, once for the whole paste (R3).
5. Place chords and brackets, per system, on those drawn columns.
6. Join systems, adding a barline where an upper system has a closing pipe.
7. Resolve connectors along the whole part, because a source can be in an earlier system.
8. Merge runs, unless any cell carried a repeat label.
9. Emit a `Clipboard`.

**Merging**: with no label anywhere, a run is neighbouring columns equal in kind, frets and
techniques, and it stops at a barline, a group edge or a chord on any column after the first.
Runs longer than 512 split into chunks. Inside a counted group, let `excess` be drawn columns less
the number. If `excess` is negative or more than the group can save, nothing merges. Otherwise
walk runs left to right, spending `excess` earliest first. Ten 5s under a 3 give `5x8 5 5`, which
is the spec's example. A plain group never merges.

---

## R8. A reading is a `Clipboard`

**Decision**: `parseTab` produces the existing `Clipboard` shape, and the import writes it with
the existing `pasteClipboard`. The row-building loop inside `pasteClipboard` is lifted out as a
pure `rowsFromClipboard`, and the preview's `draftPart` calls that same function.

**Rationale**: the shape already carries what a reading needs. `tupletGroup` holds groups by
position with fresh ids minted on paste, annotations anchor by column index, and ranks come from
one `ranksBetween` call, so FR-035 is met by reuse. It also makes the preview structurally the
same rows as the write, which is the lesson the skill records from spec 460.

**Ran**: one `mutateBatch` holding `createTuningFromPreset`, `patchRow("songs", ...)`, `createPart`
and `pasteClipboard` wrote 2,000 columns and a chord in **229 ms** on `fake-indexeddb`. Ranks
stayed at most 3 characters. The same shape throwing after the paste rolled everything back,
with row and outbox counts unchanged. The nested transactions need no new mechanism.

---

## R9. The write reads again

**Decision**: `importTab` takes the **text** and the fit the button promised, and calls `readTab`
inside the batch on rows read from the store. If the outcome differs from what was promised, it
writes nothing and returns `changed`.

**Rationale**: the safety condition on a tuning offer, that every note in the song keeps its pitch,
is a statement about a moment. Between preview and tap, sync can land notes on this song. Grouping
closed the same gap the same way in spec 003, where the write recomputes the offer from stored
rows. Parsing twice costs milliseconds.

---

## R10. Fit and offers

**Decision**: names compare with `pitchClass` from `pitch.ts`, after stripping a trailing octave
and mapping `♯` and `♭`. An offer looks through `listTunings` order, then `TUNING_PRESETS` order,
and takes the first with the same string count and names. "Keeps its pitch" compares
`noteToMidi` of the old and new string, for every string index holding a fret or `x` on any live
column of any live part. A string past the candidate's end fails.

**Ran**: no two of the 17 presets share a name list, so "first match" never hides a second
candidate with different octaves. Bands only get tunings from presets, so this holds for band
tunings too. A future custom-tuning screen would need to revisit it.

`listEventsBySong` reads live parts only, so a deleted part's notes do not block an offer. Dead
notes count because they would lose their string.

A band with no tunings gains its first one with `isDefault: false`, as FR-025 requires.
`resolveTuning` falls back to `forBand[0]`, so other songs in that band change from "no tuning"
to this one. They had nothing drawable before, so nothing they hold changes pitch.

---

## R11. Gaps between the chord reader, the bracket grammar and real text

**Chords.** **Ran** through `parseChord`:

| Text | Reads? | Consequence |
|---|---|---|
| `[A]`, `(A)`, `[Am]` | Yes, `normalise` strips brackets | A section mark `[A]` above a staff would become a chord called `[A]`. **Decision**: a symbol opening with `(` or `[` is not a chord here, so the line is commentary. `C(add9)` is unaffected. |
| `a`, `am`, `e`, `em` | Yes, roots may be lower case | Kept. The export can write them, and FR-001 needs them back. A lyric line of only those words is unlikely and is shown in the preview. |
| `D-7`, `A-`, `G-7` | Yes | See R4. |
| `AmG`, `AmDm` | No | Split at the columns beneath, per the spec. |
| `N.C.` | No | Added by the importer, per the spec. |

**The export can turn one chord into another. Ran**: `Cmaj7` on the only column of a part draws
`Cm`, because `chordRow` clips at the body width. That is a major seventh coming back as a minor
triad, and no reader can see it. The spec's table names overwriting by a neighbour and not this.
FR-039 rules out fixing the export. **Decision**: accept it, and add a preview note on any chord
whose last character reaches the last position of the body: "the chord at the end of the staff
may have been cut short". It is listed in the ledger (R14).

**Brackets.** A bracket row is a line whose every token is one of `,[-digits]*,`, `<digits>,`,
`,`, `,,` or bare digits. Rails with no comma are never a token, which keeps `---5---7---` a staff
row. Then:

- A line with a comma is a bracket row, and any placement or number problem refuses.
- A digits-only line is a bracket row only if **every** token sits on a column and is 2 to 16.
  Anything else is commentary. So `1   2   3   4` is commentary even when it lines up exactly.
- **Ran**: a stale group of 16 on one narrow column draws `16` running past it into the gap. So a
  digit token needs only to **start** on a column when it is wider than that column.

---

## R12. The paste target is an inline panel, not a `Sheet`

**Decision**: a new `PasteTab` card in the Parts section of `SongView`, under the section heading,
in normal page flow.

**Rationale**: FR-029 and the spec's assumption make the preview follow the song screen's density
toggle, so the toggle must stay reachable. `Sheet` is a modal `<dialog>`, which would put it behind
the backdrop and force a second control. Normal flow also gives the phone keyboard the page to
scroll, where a bottom sheet would be squeezed.

**Typing stays quick**: the box is controlled, and the reading and preview hang off
`useDeferredValue(text)` with a memoised preview, so a keystroke paints before the staff redraws.
**Ran**: `layoutPart` plus `toAscii` over 2,000 columns takes 14 ms, so the cost is React drawing
columns, which is what deferring moves off the keystroke. That has not been measured on a phone.

**The box**: a plain `<textarea>`, because `ui/index.tsx` has none, is CRLF, and one screen does
not earn a primitive. `wrap="off"` with its own scroll keeps long lines off the page.
`autoCorrect="off"`, `autoCapitalize="off"` and `spellCheck={false}` stop a phone making the long
dashes the spec refuses. `text-base` keeps iOS from zooming on focus. No new colour token:
`text-danger`, `text-text`, `text-text-dim` and `bg-bg-sunken` already exist per theme.

---

## R13. Limits and the part heading

**Limits. Decision**: add `MAX_FRET`, `MAX_REPEAT` and `MAX_CHORD_LENGTH` to `model.ts` and have
`protocol.ts` import them, as spec 003 did with `MAX_TUPLET_COLUMNS`. The wire accepts exactly what
it accepted before. Keeping a second copy in the parser would be two numbers staying in sync by
hope, and FR-020 exists because one bad row blocks a batch.

**Heading. Decision**: `isPartHeading(line)` sits in `export/text.ts`, directly beside the code
that writes the heading. It is additive, and the text written does not change. A flush-left line
counts when it is a part label, optionally a name after two spaces, optionally `(variant of X)`.

A wild flush-left chord row `A  D  E` also fits that pattern and is common above every system of
a chord-charted tab. **Decision**: a flush-left line with two or more symbols that all read as
chords is a chord row first, and only a lone symbol is a heading. The cost is a song whose every
part is named after chords. It would join its parts, but one unnamed part anywhere still refuses.

**Damaged rows. Decision**: the spec's "a string label followed by rails" is narrowed for a note
name followed by one rail. The rest of the line must hold a digit or a second rail. Otherwise
`A-men`, `E-Bow` and `G-Funk` would refuse a paste over a lyric or a song title. `G-5s7-`,
`B--?--` and every piped row stay staff rows. A non-note label needs a pipe (`T|`, `HH|`, `Bass|`),
so a hyphenated lyric word such as `Hal-le-lu-jah` stays commentary.

---

## R14. What the ledger holds

The spec says "ignoring only ids and ranks", with the Summary's table as the only exclusions.

**Ran** over each distinct pair of events and density, chord and bracket rows off: **1,369 of
1,392** came back exact, with technique lists compared as sets and undrawn techniques removed.
The other 23 were all explained:

| Count | Shape | Covered by |
|---|---|---|
| 11 | Expanded: separately stored identical columns come back as one repeated column | Spec table, Repeats |
| 8 | Compact text with no label, read as expanded | Spec, the one named exception |
| 4 | `7h7h7`: a transition on a string's first note, on `repeat: 3`. The first pass draws no connector, so it splits into `7` and `7` with `repeat: 2` | Spec table, Techniques |

With brackets switched on, some of those 19 stop being differences, because a counted bracket
stops the merge. The implementation's real ledger replaces these numbers.

Four things the spec's table does not list are needed for the suite to be true:

1. **Stored technique order and duplicates.** `decorate` reads a `Set`, so neither is drawn. The
   fixtures store both orders on purpose.
2. **A repeat inside a plain group, in expanded density.** Six harvested calls hold one. It comes
   back as separate columns, because "nothing merges" under a plain bracket.
3. **A chord clipped at the end of the body** (R11).
4. **A part with no notes.** Two harvested calls hold one, including `draws an empty part`. FR-019
   says it refuses, so SC-001's "100%" cannot include it, and it is asserted as `no-notes`.

One more is a true exception to **Same text**, which the spec calls single: a chord value that is
not a chord symbol comes back as commentary, so the redraw has no chord row. The fixtures do not
hit it (the only chord values are `Am` and `Em`), but the seeded generator must keep it in a named
class. See Deviations in the plan.

---

## R15. Things checked and not needing work

- **Sync order**: `outbox` drains by `seq`, and the batch writes tuning, song, part, events, then
  annotations, so a batch boundary at 200 never strands a child ahead of its parent.
- **Next.js**: nothing here touches a Next API. It is a client component and library code, so no
  guide under `node_modules/next/dist/docs/` applies.
- **`TabStaff`**: takes `EventRow[]` and keys on `eventId` and repetition, so draft rows with
  synthetic ids need no change to it. `src/components/tab/TabStaff.tsx` stays untouched.
- **`single-owner.test.ts`**: names only `ascii.ts`, `TabStaff.tsx` and capture files, so a parser
  importing `techniques.ts` does not trip it.
