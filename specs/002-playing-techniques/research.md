# Research: Make playing techniques capturable and visible

Phase 0 for [plan.md](./plan.md). Technical Context carried no NEEDS CLARIFICATION: the
stack is fixed and the roadmap entry settled the central design. What needed working out
is how each requirement lands on the code as it stands. Every "measured" figure below came
from a production build of `main` (`5986674`) at 375×667 on 2026-11-03.

---

## R1. Where the drawing lives

**Decision**: a new pure module, `src/lib/tab/techniques.ts`, declares the ten techniques
once: glyph, affix, words, order. `layoutPart` is its only drawing caller. `TabColumn` gains
two fields, `connectors` and `description`, and `cells` now carries the affixes.
`ascii.ts` and `TabStaff.tsx` read those fields and neither imports `techniques.ts`.

**Rationale**: FR-007 says the drawing exists once, and the later `ascii-import` entry needs
the same table to parse. `latches.ts` and `properties.ts` read the same declarations, so a
chip's label is the connector's glyph by reference (FR-018) rather than by a second literal.

**Alternatives considered**:
- *Constants inside `layout.ts`.* Rejected: `latches.ts` would then import from the layout
  for a label, and the parser would have to as well.
- *Add the words to `src/lib/model.ts`.* Rejected: FR-001 fences that file.

---

## R2. Finding a transition's source

**Decision**: `layoutPart` keeps one `heard: boolean[]` per string as it walks the columns.
A connector is drawn when the string has a cell in this column, a drawn transition is
stored on it, and `heard[string]` is true. `heard` is set after each drawn column, so
inside a repeated column repetition 0 reads the state from before the event, and every
later repetition has the repetition before it as a source.

Consequences, all pinned as exact strings:

| Stored | Expanded | Compact |
|---|---|---|
| `5`, then `7` with hammer-on, `repeat: 3` | `5h7h7h7` | `5h7x3` |
| `7` with hammer-on, `repeat: 3`, first in the part | `7h7h7` | `7x3` |

The second row is the one case the spec does not spell out. It follows from FR-010: the
first repetition has no earlier note, and the later ones do.

**Rationale**: one pass, no lookups, and it needs nothing beyond the columns given, which
is exactly the behaviour the spec wants for a partial view (`eventsInBars`).

**Alternatives considered**: a second pass over finished columns. Rejected as more code for
the same result.

---

## R3. The connector in the text export

**Decision**: in `staffRow`, the rail after column `i` becomes
`layout.columns[i + 1]?.connectors[stringIndex] ?? RAIL`. `placeColumns` does not change, so
the chord row, the tuplet row and every row length are unaffected by construction (FR-011,
SC-005). Column 0 can never hold a connector, because nothing precedes it.

**A correction to one spec example.** The edge case for wide cells gives `5--h7`. A cell
pads to its column's width and the gap is then one character, so:

| Neighbouring cell in the source column | Width | Result |
|---|---|---|
| none | 1 | `5h7` |
| `12` | 2 | `5-h7` |
| `12~` | 3 | `5--h7` |

The spec's `5--h7` is right for a width-3 neighbour, and for the other case it names, one
space column between the notes. The rule it states (pad with rails before the connector) is
what gets built. Tests pin the table above, and nothing in the spec changes.

---

## R4. The connector on screen

**Decision**: a `Gap` component in `TabStaff.tsx`, rendered as a sibling before the `Column`
that owns the connector, and only when that column has one (FR-012). Its width is `1ch`,
which measures 8.6 px on the staff. It repeats the column's row structure, so it lines up
without arithmetic: a chord spacer, a tuplet row, then one `.tab-cell` per string.

| Concern | How it is met |
|---|---|
| String rows line up (FR-012) | The same `.tab-cell` in the same stacking, so the same `--string-height`. |
| Mask (FR-014) | A glyph is a `<span>` inside `.tab-cell`, so the `base`, `raised` and selected mask rules already apply. Only `padding-inline: 0` is added, under `.tab-connector`. |
| Chord row (FR-013) | An empty spacer of the same height. No column moves relative to its own chord. |
| Bracket (FR-013) | The tuplet row draws the bracket's top line when `spanAt(index - 1)` and `spanAt(index)` are the same span, with no end ticks. |
| Caret (FR-013) | React order gives `Column i`, `Caret`, `Gap i+1`, `Column i+1`. A note inserted at the caret lands before the connector's owner, so the caret is in the right place without any handling. |
| Selection band | The gap takes `tab-column-selected` when its **arriving** column is selected. The connector belongs to that column and travels with it when copied, and the band stays unbroken across a selected run. |
| Cursor rule | The gap takes `tab-column-active` only when the arriving column is active **and** the column before it is the same event. `globals.css` promises that the rule "spans every repetition". |
| Not a control (FR-013) | A `div` with `aria-hidden`, no handlers, no `tab-column` test id. A tap on it does nothing. |

`followTail` currently depends on the column count, so stacking a slide onto the tail, or
toggling an affix that widens it, would leave the new width off screen. Its effect gains a
dependency on the drawn width: the sum of column widths plus connector gaps.

**Alternatives considered**:
- *A connector inside the arriving column's button.* Rejected: it would widen the tap
  target and put the glyph inside a control.
- *Reserving a gap between all columns.* Rejected by FR-012: a plain part must keep today's
  width.

**Legibility**: the staff is JetBrains Mono. Connectors start at the fret numbers' ink with
`font-weight: 600`, set under `.tab-connector`, so FR-039's adjustment is a CSS change that
leaves the characters alone. No new colour is needed for this.

---

## R5. A screen-reader description that does not read affixes

**Decision**: `describe()` moves out of `TabStaff.tsx` and into the layout, becoming the
`description` field on `TabColumn`. `describe()` reads `cells`, which now hold affixes, so
leaving it where it is would either read `t(<7>)b~m` aloud or force the component to work
out the technique for itself, which FR-007 forbids.

Format: `string 4 fret 7 with hammer-on and vibrato`. A plain column keeps today's exact
text. A compact repeated column appends `, repeated 8 times`.

Read-only columns are plain `div`s with no label, so in the song and play views a screen
reader would read the cell text, which is exactly what FR-017 forbids. They gain
`role="img"` and the same description.

---

## R6. Writes that must not lose each other

**Finding**: `techniques` is one field and `patchRow` writes the whole value. A toggle
computed from the rendered row loses the first of two quick taps, because the second is
built from a row that has not updated yet (FR-029).

**Decision**: `toggleDecoration(eventId, stringIndex, decoration, ctx)` takes an **id**, and
reads the row inside `mutateBatch`. IndexedDB serialises `rw` transactions over one store,
so the second toggle's read sees the first toggle's write. `groupAsTuplet` is the precedent
for `patchRow` inside `mutateBatch`.

It flips what the store holds rather than setting what the screen showed, so two taps on
one toggle land as on, then off.

`stackNote` gets the same fresh read, because it now writes `techniques` as well and a
stale render could overwrite a toggle. As a side effect this also closes an existing gap,
where two fast stacks built from one render lost the first note.

**The merged-field cost is accepted**: two devices editing one column's techniques offline
resolve to the later write, as the spec assumes.

**Alternatives considered**:
- *An optimistic local copy in the sheet.* Rejected: a second source of truth, and the same
  draft problem F22 and F26 came from.
- *Debouncing toggles.* Rejected: FR-027 requires immediate effect.

---

## R7. The wire's cap on a technique list

**Finding**: `eventRowSchema` caps a string's list at 8 (`protocol.ts:97`), and the push
route rejects a malformed request **as a whole** with a 400 (`api/sync/push/route.ts:10`).
The client treats that as a retryable failure and only bumps `attempts`
(`sync/client.ts:173`). So one row with nine entries stops the device's whole outbox.

The app's own writes reach at most eight on a string: six decorations, one transition, and
an existing `dead_note`. Going over needs foreign entries, which FR-006 obliges this entry
to keep.

**Decision**: `toggleDecoration` refuses to add at the cap, and writes nothing.
`MAX_TECHNIQUES_PER_STRING = 8` lives in `techniques.ts`, because FR-001 fences the protocol
file. A unit test parses rows through the real `eventRowSchema`, so the two values cannot
drift apart unnoticed.

**Alternatives considered**: dropping an unmanaged entry to make room. Rejected by FR-006.

---

## R8. Separating "not delivered yet" from "really gone" (F14)

**Finding**: `target` is `no-column` in two different situations, and at any one render they
look identical: the cursor names a column the live query has not delivered, or one that has
been deleted. Only history separates them.

**Decision**: `CaptureScreen` remembers the last cursor column it actually saw in `columns`,
as `deliveredId`, updated during render (the idiom the prune already uses).

```text
pending = afterId !== null && column not in columns && afterId !== deliveredId
```

A cursor on a column that was delivered and then vanished is not pending, so it prunes
exactly as today (FR-035). A never-delivered id is pending, so the prune waits. `lit` stays
derived and empty during the wait, so nothing is ever lit and inapplicable, and no armed
latch can act on a target that does not exist.

The rule is two pure functions in `latches.ts`, so it is testable without a browser. The
paste case that fails as marked in the previous review then passes.

**Accepted limit**: a pasted column deleted elsewhere before its first delivery would leave
the latch armed and unlit until the cursor next moves. The local write has already committed
by then, so the window is the live query's latency, while a delete from another device has
to sync that row first. Nothing wrong can be drawn or written in that state.

**Alternatives considered**:
- *A new `CursorTarget` kind, `"pending"`.* Rejected: `resolveTarget` has no history to
  decide with, and every `Record<CursorTarget["kind"], …>` table would have to grow.
- *A live query on the cursor's own row.* More accurate, but it is a second async source
  that can lag `columns` in the other direction, and `useLiveQuery` hands back the previous
  result when its dependencies change.
- *Delaying `setCursor` until the column arrives.* Rejected: it moves the transient rather
  than removing it, and the caret would lag.

---

## R9. Transition chips and the applicability table

**Decision**: `Scope` gains `"transition"`, whose row is
`{ "no-part": false, "no-column": false, playable: true, barline: true }`. `next-note`
does not change, so stack's behaviour does not (FR-021).

`no-column` covers the very start and the empty part (story 1 scenario 9). A **leading
space or barline** stays available even though no note precedes it. A strict reading of
"would be the first in the part" could rule that out, but availability is decided before
the string is known, and the wider case of a string nothing has played yet cannot be ruled
out anyway. The edge case already answers it: the transition is stored and the glyph appears
when a source does.

**A `Latch` stays data** (FR-025). `transition` on a descriptor implies one-shot, mutual
exclusion and a glyph label; `stacks` marks stack. Three pure functions do what would
otherwise be id branches in `CaptureScreen`:

- `armLatch(armed, id)`: toggles, and clears other transition latches (FR-020).
- `nextNote(lit, target)`: returns where the note goes, which techniques it stores, and
  which latches it uses up.
- `statusFor(lit)`: returns the status line.

**The one-shot disarm runs before the write is awaited.** If it ran afterwards, a second
fret press during the `await` would still see a lit chip and store a second transition. A
click is a discrete event, so React flushes the state before the next one is handled.

---

## R10. Chip fit and strip height

**Measured** at 375×667: the strip is 38.8 px tall, a chip 30.8 px, and chip text is 11.2 px
on a 16.8 px line. Five equal cells leave about 70 px each, so all five labels fit easily.

**Decision**: a transition chip's glyph renders in the mono face at `text-sm`, because `/`
and `\` at 11.2 px in the UI face are the most likely thing here to read as mush. It keeps
stack's line box with `leading-[1.05rem]`, because `text-sm`'s default 20 px line would grow
the row and move the neck (FR-024). `LatchStrip` picks this from `latch.transition`, a
declared property, and not from an id.

F24 is closed by carrying the probe's `overflows` check into the suite. The existing test
appends clones to a one-chip strip, so it has to become a test of the five real chips.

---

## R11. Status line

**Decision**: one lit latch reads its `statusText`, and two read `statusShort` values joined
with ` + `.

| Lit | Text | Characters |
|---|---|---|
| stack | `stacking onto the marked column` (unchanged) | 31 |
| slide down | `next note: slide down` | 21 |
| stack, hammer-on | `stack + hammer-on` | 17 |

**Rationale**: F23 records that the status row wraps at 375 px with an ordinary chord and
clips the staff. Stack's text is the longest already in the suite's 30 states, so every new
string is shorter and adds no new wrapping (FR-023).

---

## R12. Declaring the decoration toggles

**Decision**: one new entry in `COLUMN_PROPERTIES`, `decorations`, with a new control kind
`"toggles"`. It sits after `chord` and before `delete`, and its `toggles(ctx)` returns one
group per string that has a note, in tuning order.

`propertiesFor` gains an optional per-property `appliesToColumn(event)`, so a rest with no
notes shows no row. The inspector still renders what it is given.

| Visible label | Accessible name, e.g. on a B Standard A string |
|---|---|
| `vib` | `vibrato on the A1 string` |
| `harm` | `harmonic on the A1 string` |
| `ring` | `let ring on the A1 string` |
| `bend` | `bend on the A1 string` |
| `tap` | `tap on the A1 string` |
| `mute` | `palm mute on the A1 string` |

**Short words** rather than glyphs, because `()` and `<>` mean nothing on a toggle until you
know the notation. **Six equal cells** at about 49 px beside the string's name fit
comfortably, and `aria-pressed` carries the state.

**The accessible name carries the octave**, because the `Guitar 6` presets have two E
strings, so the bare note would give two toggles the same name. The visible group label
stays the bare note, which matches the staff and the neck, and the two E rows still read in
staff order.

**A row's `className` stays identical** across control kinds (INV-015 of the previous entry
compares them). Every row gains `flex-wrap`, and the toggle control takes `w-full`.

**`PropertyContext` gains `tuning`**, because the labels need it and the column does not
carry it.

---

## R13. The release of the long press (FR-030, FU12)

**Finding**: the previous entry kept the sheet clear of the pressed column by geometry, and
asserted it (`e2e/capture-surface.spec.ts:2381`). With toggles that cannot hold. A sheet for
seven played strings is estimated at roughly 520 px, which puts its top near 147 px on a
667 px screen, while a column measured 120 to 244 px on the staff.

**Decision**: replace geometry with an event rule in `Sheet`. A capture-phase click handler
drops any pointer click that has no `pointerdown` inside the dialog behind it. Keyboard and
assistive-technology activation arrive with `detail === 0` and always pass. This is the
same reasoning as `pressBeganOnBackdrop`, widened from the backdrop to the whole dialog, and
it holds at every sheet height with no timer.

The clearance assertion is retired. In its place the test asserts what it was standing in
for: the release changes nothing.

**Alternatives considered**:
- *Capping the sheet's height to stay clear of the staff.* Rejected: the column's position
  varies, and FR-031 needs a scroller anyway.
- *Ignoring clicks for a fixed time after opening.* Rejected: a finger can be held for any
  length of time.

---

## R14. A sheet that fits a phone (FR-031)

**Decision**: `Sheet` sets `max-h-dvh overflow-y-auto overscroll-contain` explicitly, rather
than relying on the browser's default dialog height. The inspector's header row, which holds
`close`, becomes `sticky top-0 bg-bg`, so close stays in view at any scroll position.

The dialog is in the top layer, so the page itself gains no scrolling.

The existing test "six rows need no scrolling" stops being true by design. It is replaced by
INV-018, which asserts what FR-031 actually requires.

---

## R15. Reaching the inspector without a sustained press (FR-032)

**Measured**: row 2 ends at 308.2 px of 365 usable, which leaves 52.8 px after a gap. The
research for the previous entry estimated 27 px, so its figure was pessimistic. A `×512`
count widens the stepper by about 4 px.

**Decision**, two routes that both call the same `setInspecting`:

1. **A `details` button in row 2**, `scope: "column-property"`, icon-only at the triplet
   button's 44 px. This is the route for someone who cannot hold a press, on any device,
   and FR-032's reason applies to them as much as to a keyboard user.
2. **`Shift+F10` and the `ContextMenu` key on a focused column**. Row 2 sits after every
   column in tab order, so on a long part the button alone would mean tabbing through the
   whole staff. These open the inspector on the focused column without moving the cursor.

Barline inspectors offer only `delete`, which the toolbar also has, so a barline loses
nothing by having no row 2 and keeps the key route.

**Alternatives considered**:
- *A second tap on the marked column.* Rejected: the previous entry requires a tap to keep
  its meaning, and an unintended sheet mid-riff is the worst place for a modal.
- *The key route alone.* It meets the letter of FR-032, but leaves touch users who cannot
  hold a press with no route to decorations.

---

## R16. Write signatures

**Decision**: `insertNote` and `stackNote` keep `ctx` as their last parameter, and that
parameter widens to `NoteWrite = MutateContext & { techniques?: readonly Technique[] }`.
Existing calls and all of `editing.test.ts` stay valid. A new positional parameter before
`ctx` would have turned each existing test's `ctx()` into a silently wrong argument, writing
to the default database at runtime.

`stackNote` includes `techniques` in its patch only when the string's list changes, so a
plain stack stamps no new clock on that field and cannot overwrite a concurrent edit
(FR-003).

`unstackNote` keeps reading `event.frets` from its argument, because
`editing.test.ts:144` passes a doctored row and relies on that.

---

## R17. Repo facts this work has to respect

- **Line endings.** `TabStaff.tsx`, `ui/index.tsx`, `e2e/capture-surface.spec.ts` and
  `ColumnInspector.test.tsx` are CRLF in the index, and every other touched file is LF.
  Edits keep each file's own endings (spec assumption, F27).
- **No Next.js API changes.** Everything here is client components, CSS and library code.
  `AGENTS.md`'s warning about the bundled docs applies if an implementer reaches for a
  framework API, which this plan does not call for.
- **`npm run build` and the e2e suite must not share `.next` with a dev server.**
- **`npm run dev:clean`** is the first response to a style that appears to do nothing.
