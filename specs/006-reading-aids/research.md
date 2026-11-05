# Research: Note names, intervals, and seeing what a variant changed

Phase 0 for [plan.md](./plan.md). Every unknown in Technical Context is resolved. Each entry is a
decision, why it was made, and what else was weighed. **Ran** marks a claim that was measured for this
plan, not reasoned.

## What was run

Throwaway probes in a scratch directory, deleted afterwards. Nothing here touched the app or `.next`.

| Question | Result |
|---|---|
| Does a furthest-reaching edit-distance search with substitution, and with barline-for-note substitution forbidden, find the true minimum? | **Yes.** 200,000 random pairs of up to 8 columns over alphabets of 2 to 5 with barlines mixed in, against a plain dynamic-programming table: 0 mismatches. |
| How fast is it? SC-009: 20 variants of 1,000 columns, ten differences each. | 0.25 ms median for all twenty alignments in Node on this desktop. |
| How fast on parts with nothing in common? SC-010: two parts of 5,000 columns. | Capped at 256 edits: 0.8 ms. Capped at 512: 2.4 ms. Capped at 1,000: 9.9 ms. Periodic riffs and parts sharing an alphabet measured about the same, up to 3.1 ms and 10.5 ms median, 15.8 ms worst. |
| What does building the column signatures cost? | 6.3 ms median for 21 parts of 1,000 distinct events on six strings, including string keys and interning. This, not the alignment, is what spends SC-009's 20 ms. |
| Does a `db.transaction("r", ...)` inside a live query still observe all three tables, and give one consistent result? | **Yes**, on Dexie with `fake-indexeddb`. One `rw` transaction adding a part, an event and a chord gave one emission `{parts:1, ev:1, an:1}`, never a partial one. Later writes to either child table each re-ran the query. |
| What do the candidate tint tokens measure? | Dark `#1b2f45` with ink `#8ecbff`: cell text 11.68, ink on `--bg-raised` 10.52, tint against `--bg-raised` 1.33. Light `#d9ecff` with `#0b4f8a`: 14.94, 8.40, 1.21. |
| Could the tint cover the whole column, as selection does? | **No.** On the light tint `--accent` measures 4.16, against 5.02 on `--bg-raised` today, so a chord label on a marked column would fall under 4.5:1. The tint stops at the string cells (R15). |
| Does a tinted cell stay apart from an unmarked one in greyscale? | Luminance-only values: dark `#313131` against `#1c1c1c`, light `#e9e9e9` against `#ffffff`. A real step in both, and the glyph and weight do not depend on it. Only a person at actual size can call it enough (INV-038). |
| Is there any Next.js guidance that changes the view store? | `02-guides/preventing-flash-before-hydration.md` covers values in server-rendered HTML. Its inline script is for text that is in that HTML. No staff is (R1), so no script is needed. |

Not run: nothing here was measured in a real browser. Layout claims in R13, R14 and R16 are reasoned
from the CSS and pinned by e2e invariants, not observed.

## R1. Where the view choice lives

**Decision**: `localStorage`, key `stablature.staffView`, read through `useSyncExternalStore` with
`"frets"` as the server snapshot. An in-memory value takes over for the visit once one is set, so a
store that refuses writes still works. A `storage` event keeps a second tab in step.

**Rationale**: FR-005 wants the choice in place before the first staff, and `localStorage` is
synchronous. `device.ts` is the precedent, and has the same reasoning and the same `try`/`catch` for
private windows. No staff exists in server HTML: `SongView` and `PlayView` render `<Loading />` until
Dexie answers, which cannot happen on the server. So the hydration render has nothing to mismatch, and
every render after it reads the real value, because `useSyncExternalStore` calls `getSnapshot` on each
update. React flushes the passive store check before any later render, so the first staff always sees
the stored choice.

**Alternatives**: the Dexie `meta` table, where the clipboard lives, which is asynchronous and would
draw frets first. A cookie, which would reach the server, against FR-003. An inline script, which is
for correcting server HTML that does not exist here. A lazy `useState`, which leaves two screens with
two copies of the choice.

## R2. How labels enter the layout

**Decision**: `layout.ts` gains an internal builder that takes a cell writer. `layoutPart` keeps its
exact signature and calls the builder with the fret writer. A new `layoutReading`, in
`src/lib/reading/`, calls the same builder with the label writer.

**Rationale**: FR-019 is the sharpest requirement here, and the structural way to hold it is that the
export has no route to a label. `toAscii` passes its options to `layoutPart`, so if `view` were a field
of `LayoutOptions`, `AsciiOptions` would inherit it and one stray spread would leak labels into a
paste. That is the silent wrong note specs/004 exists to prevent. With a separate entry point there is
nothing to spread. Width, repeats, connectors, bars and groups stay single-owner, because both entry
points run the same loop, so FR-013 and FR-014 cannot drift.

`TabColumn` does not change shape, so no existing `toEqual` over a column moves. What the staff needs
beyond columns comes back on `ReadingLayout`.

**Alternatives**: `view` on `LayoutOptions`, rejected above. Post-processing `cells` after layout,
which would have to parse `t(<7>)b~m` back apart and recompute every width, a second account of the
drawing rules.

## R3. Decorations

**Decision**: `decorate(text, stored, separator = "")`. The wrap order stays where it is. A letter
affix takes the separator, `~ ( ) < >` do not. The writer returns only the pitch text, and the builder
calls `decorate`.

**Rationale**: one owner of the drawing order, so FR-008's "same order as in frets" holds by
construction. With the default argument the fret path does not change. `TabStaff.tsx` still imports no
techniques, so the `single-owner.test.ts` pin stands.

The widest cell is `t·(<?>)·b~·m`, or with a pitch and no harmonic `t·(Bbb)·b~·m`. Nothing truncates:
widths come from `.length`, and `·` is one character at the mono advance.

## R4. Spelling and degrees

**Decision**: read `chord.tones` by pitch class, for the chord's own `name` and `degree`. `Chord` gains
`bassName`, the slash bass as typed. Everything else goes through `midiToNote(midi, spelling)`, and
intervals through a 12-entry `FOLDED_DEGREES` table.

The order, for one pitch class under one chord:

1. A slash bass, if this is the bass's pitch class: `bassName`.
2. A chord tone: its `name`.
3. Otherwise: sharps or flats by the rule. A flat is a `b` after the first character, because the note
   `B` is not a flat.

**Rationale**: `spellTone` already does letter arithmetic, and repeating it would be a second account.
`parseChord` keeps only a pitch class for the bass, so "as it was typed" needs the one new field. No
test asserts a whole `Chord` with `toEqual`, so adding it moves no pin.

A bass that is also a chord tone, as in `Cm/D#`, is step 1. The spec's two sentences collide here, and
"spelt as it was typed" is the more specific one (Deviation 9).

**Guards**: `fretToMidi` throws on a non-integer or negative fret. The wire forbids both, but a staff
must not die on one bad row, so the writer checks and shows `?`, the same as a pitch it cannot back up.

## R5. The chord in force

**Decision**: new `chordsInForce(events, annotations)` in `chords.ts`, one pass, giving a map from
event id to symbol. `chordInForceAt` becomes a lookup in it. New `anchoredChords(annotations)` is the
one reading of which chord sits on which event, used by `chordsInForce`, the layout's chord row and the
comparison.

**Rationale**: calling `chordInForceAt` per column is quadratic, and FR-011 needs the two to mean the
same thing. If one calls the other they cannot differ. The staff passes the **whole** part's events,
which is the trap the spec names: a slice loses any chord anchored before it.

A chord symbol that cannot be read is in force and ends the one before it. The map holds the raw text,
and `parseChord` returning null is what makes it unreadable, exactly as in `CaptureScreen.tsx`.

## R6. One snapshot for the comparison

**Decision**: new `listSongContent(songId)` reads parts, events and annotations in one `r` transaction,
and `useSongContent` wraps it. `SongView` and `PlayView` use it in place of `useParts`, `useSongEvents`
and `useSongAnnotations`.

**Rationale**: three live queries settle at three moments. `createVariant` writes the part, its columns
and its chords in one batch. With separate queries a frame can hold the new part with no columns, and
`?? []` would then report every column of the parent as removed. Or it holds the columns without their
chords, and reports every anchored column as changed. FR-026 names the chord case, and the part case is
the same defect. One transaction removes the class. **Ran**: see the table above.

The same snapshot gives Story 2 its "staff waits for chords": `content === undefined` is the one
loading state, so no label can be drawn from a missing chord list.

**Alternatives**: gating on all three being defined, which covers first load only. A frame during a
later write would still be inconsistent.

## R7. What "fewest columns that differ" means

**Decision**: unit-cost edit distance over played columns: a change, an addition and a removal each
cost one, and a barline for a note is forbidden, so that costs two.

**Rationale**: the obvious tool is a longest-common-subsequence diff, and it does not meet FR-023 or
SC-008 once FR-024 pairs what it finds. Parent `a b c d e`, variant `e f g h i`: the LCS keeps the `e`
and reports 4 removed and 4 added, 8 columns. Substitution gives 5 changed. So with changes counted as
one, an LCS can sit above the true minimum. The furthest-reaching search handles substitution for the
same code size.

## R8. The search, and its bound

**Decision**: trim the common prefix and suffix, then run a furthest-reaching search over diagonals,
keeping one frontier per edit count for the walk back. Stop at `MAX_EDITS = 512`. If the budget runs
out, the whole trimmed middle is one run (R9).

**Rationale**: cost is about `E²` plus the slides, where `E` is the number of differences, so a real
variant costs next to nothing. The cap makes the worst case a constant: 2.4 ms at 5,000 columns against
SC-010's 50 ms. 1,000 would pass too, but scaling the measured figures, 20 unrelated variants of 1,000
columns would then cost around 200 ms on every write, and 512 keeps that near 50 ms. That case was not
run on its own, and INV-025 measures it. A variant with over 512 differing columns has
little left in common with its parent, and that is the case the spec says may read as replaced.

**The bound is a count of edits, never a clock.** FR-024 says the same two parts always give the same
result, so a time limit would break it on a busy phone.

Inputs are `Int32Array`s of interned content ids, one interning table per `compareVariants` call, so
each part is signed once however many variants point at it.

**Alternatives**: Myers's linear-space refinement, which is unnecessary at this size and much harder
to read. A library, which is a dependency for 80 lines.

## R9. Pairing inside a run

**Decision**: the search supplies only the matched columns. Each maximal run between them is rebuilt
by walking both sides in order: pair the two columns if they are both barlines or both not, otherwise
report the barline as added or removed and step past it. Whatever is left over is added or removed.

**Rationale**: the worked example `5 7 8 | 5 7 9 10` has two equally short paths, and only one is
"`*` on the 9, `+` on the 10". FR-024 fixes it, so the walk back cannot be left to pick.

This never costs more than the path it replaces. Every non-barline in a run pairs until one side runs
out, which gives `max(p, v)`, the least any path can spend on them, and barlines only ever get cheaper.
So SC-008 still holds. A pair that turns out equal is reported as the same.

## R10. Group continuation

**Decision**: alignment runs on a column's own content: in a group or not, plain or counted, the number
printed. Whether it continues the group of the column before it is then compared only where **both**
this column and the one before it are matched, and matched to neighbours in the parent.

**Rationale**: taken alone, "continues the group before it" breaks SC-007. Removing the first note of
`[a b c]` makes `b` start the group, so `b` differs, and the report is 1 removed and 1 changed. Inserting
an ungrouped column inside a group does the same to the next one. Both are false as a statement about
that column, and FR-023 says a removal leaves later columns unmarked. The bit only has a meaning when
"the column before it" is the same column in both parts, so that is when it is compared. `[a b][c d]`
against `[a b c d]` still marks `c`.

The bit reads group ids, but only within one part, so ids never cross the comparison. That is why
regenerating them changes nothing, and why `createVariant`, which keeps them, agrees with a paste,
which does not.

**Alternatives**: the bit in the signature, which fails SC-007 at every group edge in the fixtures. A
"two adjacent groups" bit, which survives most edge cases but marks a column when the separator between
two groups is removed.

## R11. Marks are keyed, not indexed

**Decision**: a mark is keyed by `eventId-repetition`, the key `TabStaff` already uses for a column.
`staffMarks` takes the events actually drawn and returns the marks and the line together.

**Rationale**: a slice renumbers everything. Indexes would need rebasing, and event ids are unique
within the part, so keys work unchanged on any pass. Taking the drawn events is what makes the count
match the marks: `eventsInBars` drops a slice's trailing barline, so an added barline there has no
column to mark and must not be counted.

**A removal is placed by bar, not by its neighbour.** The spec says it belongs to the pass holding the
column that follows it. If that column is the barline closing the slice, no pass holds it, and the
removal would vanish from every pass. So a pass takes a removal when its bar is in range, and draws it
before the following column if that is drawn, else at the end of the staff.

Bar numbers come from the whole part. `layoutPart` numbers a slice from 1, so reading a bar off the
drawn columns would make a pass of bars 3-4 say "bar 1".

## R12. Compact density

**Decision**: the comparison never sees density. `staffMarks` folds its keys for compact: `+` if every
repetition of the event is added, `*` if any is marked otherwise. A removal inside a repeated column
moves to before it, and gaps landing together add up.

**Rationale**: FR-030. Counts come from the unfolded list, so they cannot differ between densities.

## R13. Where the caption goes

**Decision**: `TabStaff` draws the caption absolutely positioned in the bottom padding of its card, and
both cards become `relative`.

**Rationale**: FR-015 and FR-016 together rule out anything in flow. The card header is `flex-wrap`, so
a caption there wraps at 375 px depending on the part's name, which adds a row. Reserving a row would
change frets, against FR-002. The padding is the one place that is always there, 16 px on the song page
and 12 px on the play view, and a `0.65rem` line fits both. Text stays short enough for 311 px
(`contracts/components.md`), and comes from `ReadingLayout`, so it cannot claim something the cells do
not show. **Worth your eye**: it reads as a footnote, and only a look at actual size can say whether
that is good enough.

## R14. The carried chord

**Decision**: `ReadingLayout.carriedChord` holds the symbol, `TabStaff` draws `(Am)` over the first
column, and that column gets `min-width: max-content` with the label untruncated.

**Rationale**: the chord row has `truncate`, and `(Am)` in a `calc(1ch + 0.6rem)` column would draw as
`(A…`, which fails the point of FR-012. Letting it overflow would collide with a chord anchored on the
next column. The column widens to fit, everything else follows it, and FR-014 holds. This bends FR-013
for one column (Deviation 4). Anchored chords keep their existing truncation, which is `usability-pass`
work.

## R15. Colour

**Decision**: two tokens per theme. `--diff-tint`: `#1b2f45` dark, `#d9ecff` light. `--diff-ink`:
`#8ecbff` dark, `#0b4f8a` light. The print block sets them to `#fff` and `#000`. The tint goes on the
string cells only, with their masks repainted, and the ink colours the mark row.

**Rationale**: blue, because amber already means the accent and the selection band. The tint stops at
the cells because on the column it would drop chord labels to 4.16:1, and bracket numerals are already
under par (`usability-pass`). Marked cell text is `700` against the inherited `400`. JetBrains Mono is
loaded as a variable font with no fixed weight, so `700` is a real weight, and the advance does not
change, so bold moves nothing.

The print rule sits on `:root` and loses to the light theme's `:root:not(...)` on specificity. That is
harmless, because the light values are print-safe, and it does mean a dark-theme print is the one that
needs the override. Both are in INV-034.

The new rule must follow `.tab-staff[data-surface="raised"] .tab-cell > span` at equal specificity,
the same way `.tab-column-selected` does, and custom classes win ties against utilities in this build
(`globals.css`). Check computed styles.

## R16. The mark row and the removal gap

**Decision**: `Column` takes `mark: string | null`, drawn in its own row under the rhythm row, the way
`rhythm` is, with `null` meaning no row at all. A new `RemovalGap` draws its own placeholders for each
row, carries the bracket across if it sits inside a group, shows rail through the strings, and puts
`−2` in the mark row. It comes before a connector `Gap`, so the connector stays against the column it
arrives at.

**Rationale**: being a child of the same flex row makes FR-014 structural for marks. The row is drawn
only when something on this staff is marked, so a same-as-parent variant keeps its height and an
ordinary staff keeps its markup. `−` is U+2212, inside the Google latin subset's `unicode-range`, so it
needs no fallback font, unlike `♯` and `♭`. INV-010 reads this in the page.

## R17. Where the tests go

**Decision**: `src/lib/reading/__tests__/`, never `src/lib/tab/__tests__/`, because `round-trip.test.ts`
fails on any unlisted file there.

**Oracles share nothing with the code**, which is entry 4's lesson. Pitch: a hand table of semitones per
open string, not `fretToMidi`. Alignment: a plain DP table, not the diagonal search. Cell reading: a
small reader in the test that strips affixes by its own rules. A sweep filtered by the rule's own test
passes on whatever the rule misses, so nothing here is filtered that way.

## R18. Timing tests

**Decision**: SC-009 and SC-010 take the best of five runs, with an explicit test timeout.

**Rationale**: a budget test asks what the code can do, not how busy the machine is, and the pre-commit
hook has already failed under load on a default timeout (`usability-pass`, item 5). Measured headroom
is about 7 ms against 20 ms, and 2.4 ms against 50 ms, before a browser's slower JIT.

## R19. Next.js

No new route, no `next/dynamic`, no server component, no change to `public/sw.js`. The relevant bundled
guides are `05-server-and-client-components.md`, which places `localStorage` in Client Components, and
`preventing-flash-before-hydration.md`, addressed in R1.
