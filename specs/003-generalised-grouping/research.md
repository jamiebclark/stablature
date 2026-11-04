# Research: Group any run of columns, as a counted tuplet or as plain phrasing

Phase 0 for [plan.md](./plan.md). Technical Context carried no NEEDS CLARIFICATION: the stack
is fixed and the spec settled the modelling decision. What needed working out is how each
requirement lands on the code as it stands. Every "measured" figure below came from a
production build of `main` (`421b130`) at 375×667 in the `mobile` Playwright project on
2026-11-04, using a throwaway copy of the tree that has since been deleted. Every "ran" claim
was compiled or executed there, not read.

---

## R1. How `groupKind` is typed

**Decision**: `EventRow.groupKind?: GroupKind | null`, optional in the type. `assert-model.ts`
gains one extra assertion on that field. Creation paths spread a shared `NO_GROUP` constant, so
a new row stores a real `null`.

**Rationale**: three requirements pull against each other, and only this shape meets all of them.

- FR-037 says other tests pass unedited, and `tsc` includes test files (`tsconfig.json`
  `**/*.ts`). **Ran**: with a required field, 11 test files fail `npm run typecheck`, because
  their typed `EventRow` fixtures have no `groupKind`.
- FR-003 and FR-006 say a row can really lack the field. An optional type says so honestly,
  and makes every reader handle it.
- FR-008 says the guard must not be weakened, and an optional field **does** weaken it.
  **Ran**: with the field optional, deleting the column from `domain.ts` left `tsc` clean,
  because a missing key is assignable to an optional one. Adding
  `_EventGroupKind = AssertExtends<(typeof events.$inferSelect)["groupKind"], …>` makes the
  same deletion fail with TS2339 in `assert-model.ts`, and passes with the column present.

**Alternatives considered**: a required field and 11 edited fixtures, which FR-037 forbids.
Making `NewRow<"events">` require the field, which breaks `queries.test.ts:60` the same way.

---

## R2. One reading rule

**Decision**: one function in `model.ts`, `groupNumber(row)`, returns the number a group
prints, or null for none. `layoutPart` and the column sheet both call it.

```text
groupKind === "plain" and tupletCount === null  → null
otherwise                                       → tupletCount ?? 3
```

**Rationale**: FR-003 needs null and absent to read as counted, and `?? 3` keeps today's
reading of a null count (`layout.ts:266`). The `tupletCount === null` half covers the one
state outside the stored-states table. A device on an older cached version writes
`tupletId` and `tupletCount` but not `groupKind`, so its triplet over a plain group merges to
`(new id, 3, "plain")`. A stored number is evidence of a count, so the 3 is drawn rather than
silently lost.

**Alternatives considered**: `groupKind === "plain"` alone, which erases that old device's 3.
`tupletCount === null` alone, which cannot tell a plain group from a legacy row with a null
count, and which the spec's Assumptions reject in favour of a named value.

---

## R3. The wire

**Decision**: `groupKind: z.enum(GROUP_KINDS).nullable().optional()` on `eventRowSchema`.
`tupletCount` takes its maximum from `MAX_TUPLET_COLUMNS` in `model.ts`.

**Rationale**: `.optional()` is what FR-006 needs. Rows queued before this entry have no key,
and a refused row fails the whole push request. A `.default(null)` would be wrong: it invents
a value on a row that has no clock for it. No server change is needed, because `upsert` walks
`MERGEABLE_FIELDS` and a row with no `groupKind` clock compares at `ZERO_HLC`, so it cannot
overwrite a stored value. A brand-new row with the key absent reaches the insert as
`undefined`, which is the column default of NULL.

An older cached client strips the key on pull but keeps its clock in `fieldClocks`. When it
pushes that row back, the clock ties and the server's value stands, so a plain group survives
a round trip through an old device.

`pushRequestSchema` caps a push at 500 mutations and the client sends `PUSH_BATCH = 200`, so
a very long plain group drains across requests with no change.

**Alternatives considered**: `.default(null)`, above. A `tupletCount` cap repeated as a second
literal, which is one edit from a sync outage.

---

## R4. No Dexie version bump

**Decision**: `db.ts` does not change. Old local rows keep lacking the field.

**Rationale**: `groupKind` is not indexed, so the store's shape is unchanged. An upgrade could
not reach rows already in the outbox, so readers would still have to handle absence, and
rewriting every row buys nothing. It would also touch data on every device for a field that
is null on almost all of them.

---

## R5. Who decides what a selection can do

**Decision**: a new pure module, `src/lib/capture/grouping.ts`. `groupOffer(selected)` returns
the columns a tuplet would hold, the runs a plain group would make, and whether ungroup
applies. The toolbar renders from the offer, and the write recomputes the same offer from
stored rows.

**Rationale**: this is the "preview and action" agreement. The numeral on the control and the
number written cannot differ, because one function produces both and `tupletCount` is the
offered run's length. No count is passed in from the UI. A selection is contiguous, so
splitting it on barlines gives one run per bar. Nothing needs bar numbers, and a barline at
either edge simply yields an empty run.

**Alternatives considered**: checks inline in `CaptureScreen`, which the project's rule that
domain rules live in `src/lib/` excludes, and which could not be tested in node.

---

## R6. Writes read inside the transaction

**Decision**: every group write takes ids, and reads `listEvents(partId, inner.db)` inside
`mutateBatch`, as `toggleDecoration` reads its row. `groupSelection` takes the anchor and head,
and re-derives the range with the same `columnRange` the toolbar uses.

**Rationale**: FR-015 wants one batch, and FR-013 and FR-014 need the whole part's rows, which
a selection does not hold. Rendered rows can also be stale: sync streams in, so a barline can
arrive between render and tap. Re-deriving the range means an arriving barline splits the run
or withdraws the offer, instead of writing a bracket across a bar.

Scoping by `partId` is what keeps a variant's parent safe (FR-014). A variant shares its
parent's group ids, and `listEvents` cannot see another part.

Only live columns are read. A tombstoned column keeps its old id. Nothing in the app restores
a column (`restoreRow` is called only by its own test), so this cannot revive a remnant today.

---

## R7. The triplet button resolves "the end" from the store

**Decision**: the button calls `groupRunEndingAt(part.id, atEnd ? null : editable.id, 3)`.
A null end means the last playable stored column. `tripletFromTail` is the same call, which
is how FR-025 comes to follow the same rules as the button.

**Rationale**: the button becomes able to refuse, which makes a rendering lag visible. Three
frets then triplet is a real sequence: `e2e/capture.spec.ts:318` does exactly that with no
wait. If the third column has not rendered, today's code groups whatever it can see. A refusal
built on rendered rows would report a false "needs three columns". The write is queued behind
the insert in IndexedDB, so reading stored rows sees all three.

Mid-part, the cursor is an explicit id, so it can name the column directly.

**Rule**: `runEndingAt` walks back from the end column through **all** rows. A barline among
the `count` rows ending there is a refusal, and fewer than `count` rows is a refusal. A count
outside 2 to 16 is a refusal, so no route can write one (FR-011).

---

## R8. The refusal message

**Decision**: `CaptureScreen` holds `refusedAt`, the `afterId` and column count at the moment
of refusal. The status line shows `TRIPLET_REFUSAL` only while both still match.

**Rationale**: the spec says the existing status line with its existing lifetime, but that
line has no transient state. It is derived on every render. Deriving the message the same way
means every route that moves the cursor or changes the part clears it, including routes that
do not pass through a handler, such as a sync delete. This is the idiom `lit` uses, for the
same reason.

`no-id-branch.test.tsx` slices `CaptureScreen` on the literals `const status = statusFor(lit)`
and `{status ||`, so both must survive, and the check reads `{status || refused || !atEnd`.

---

## R9. Where seven controls fit

**Decision**: during a selection, the status row holds the "N selected" message, and all seven
controls sit on one line in the row-2 slot under the stable toolbar.

**Measured**, with a triplet in a five-string part. The staff needs 124 px for its strings,
141.6 px with the bracket row and 159.2 px with chords as well.

| Layout | Band (px) | Strings hidden | Row overflow (px) | Stable row top |
|---|---|---|---|---|
| At rest, no selection | 166 | 0 | n/a | 277.8 |
| `main` today, four controls | 108.8 | **1 of 5** | 0 | 277.8 |
| Controls stay above the stable row on one line, message in the slot | 146.8 | 0 | 91 before sizing | 277.8 |
| **Message in the status row, controls in the slot, sized as below** | **170** | **0** | **0** | **277.8** |

`main` already fails FR-020 with four controls, and `e2e/capture-surface.spec.ts:863` records
that, so adding three cannot be a matter of letting the row wrap. The row-2 slot is 56 px of
empty reserved space during a selection, and the contextual row it reserves for is already
hidden then. A selection is a context, so that is what the slot is for. The band is then wider
than at rest, so a selection costs the staff nothing on any tuning, and chords and brackets
stay visible too.

**Sizing**. `main`'s `px-2 py-1 text-xs` on these buttons does nothing: `BASE` sets `px-3 py-2
text-sm` and those utilities sort later, so copy measures 72.1×34 px. The controls need
Tailwind 4's important suffix, `h-9! px-1! text-xs! gap-1!`, as one shared constant. Measured
widths: copy 54.1, cut 45, delete 61.8, tuplet 28, group 28, ungroup 57, cancel 42.1. That is
316 px, or 356 px with gaps and padding, leaving 19 px at 375 for fonts that run wider. The
interface font here is the system stack, so widths vary by device. Height is 36 px, against
the 34 px these buttons have now.

**Alternatives considered**: the third row of the table, which keeps copy, cut and delete
physically where they are. Its band of 146.8 px holds five strings, but the staff jumps on
every selection, and a six-string part needs 148.8 px and clips. That is the fallback if the
human prefers it (plan, Deviation 1). Letting the row wrap fails FR-020. A horizontally
scrolling row hides controls that FR-017 says are present.

---

## R10. The glyph

**Decision**: `BracketGlyph({ numeral })` replaces `TripletGlyph`. Rail length depends on the
numeral.

| Numeral | Font size | Rails end at | Clear gap with round caps |
|---|---|---|---|
| 3 | 10 | today's path, unchanged | as today |
| Any other single digit | 10 | x = 3.6 and 12.4 | 7.4 |
| Two digits | 8, `textLength` 9.2 | x = 2.1 and 13.9 | 10.4 |
| None | none | one closed line | n/a |

**Measured** in Chromium: at font size 10, one digit runs from 5.76 to 7.11 units and two
digits from 11.51 to 11.97. Today's gap is 4.4 units once the round caps are counted. That
suits the open left side of a 3, but a 4 or an 8 has ink at rail height, and two digits at
size 10 cannot fit at all. At size 8, two digits run from 9.21 to 9.93.

`textLength` with `lengthAdjust="spacingAndGlyphs"` pins two digits to 9.2 units whatever the
system font, which matters because the button inherits the system stack.

"3" keeps its exact markup because the spec says the "last three" button looks as it does
today, and the tuplet control at 3 shows the same glyph because it is the same parameter.

---

## R11. Bracket contrast

**Decision**: the bracket's colour moves to a `.tab-bracket` rule, using `--text-faint` by
default and `--text-dim` inside a selected column. Both are existing per-theme tokens, so no
new colour is added. The numeral follows the same rule.

**Computed** from the committed tokens:

| | Base | Raised | **Selected** |
|---|---|---|---|
| `--text-faint`, dark | 3.74 | 3.46 | **2.16** |
| `--text-faint`, light | 3.30 | 3.42 | **2.75** |
| `--text-dim`, dark | 7.07 | 6.54 | 4.08 |
| `--text-dim`, light | 6.38 | 6.61 | 5.32 |

The spec's figures for base and raised are confirmed. It did not measure the selection band,
which is a surface a staff is drawn on (`globals.css`: "Selection sits behind the staff"), and
`--text-faint` fails 3:1 on it in both themes. A bracket matters most there, because selecting
a group is how a person works on it.

`Column` currently sets `borderLeftColor` and `borderRightColor` inline, and an inline style
beats any rule, so those lines go. The element keeps `absolute border-t`, because the
connector probe finds the line with `.absolute.border-t`.

---

## R12. Drawing a plain group

**Decision**: `TupletSpan.count` becomes `number | null`, and `TabColumn.tupletCount` is
replaced by `bracketNumber: number | null`, computed with `groupNumber`. `tupletRow` gets
`label = span.count === null ? "" : String(span.count)` and no other branch.

**Rationale**: FR-031 wants the same extents as a counted tuplet, and running plain groups
through the same lines makes that structural. With an empty label the `width <= label.length`
early exit can never fire and the label loop does nothing, so what is left is the bracket:
`,-,`, `,---,`, `,-----,`, as the notation table requires. Counted spans keep their exact
shape, so the `toEqual` at `ascii.test.ts:190` still holds.

`TabColumn.tupletCount` has one reader, `tupletSpans`, so nothing else moves. `TabStaff`'s
`hasTuplets` already comes from `spans`, so the bracket row and the label offset are right for
a plain-only part with no change (FR-032).

---

## R13. The sheet's row

**Decision**: one new `COLUMN_PROPERTIES` entry, id `group`, `control: "action"`, label
`ungroup`, before `delete`, with `appliesToColumn` true when `event.tupletId` is set.
`ColumnProperty` gains an optional `heading(ctx)`, and `ColumnInspector` renders
`property.heading?.(ctx) ?? property.label` in the row's left cell.

**Rationale**: an action row today uses one label for the row and its button. This row needs
two, "tuplet of 5" and "ungroup". The optional method is generic, so the sheet still does not
branch on an id (FR-027). `read` cannot carry it, because `read` is the control's value.
`destructive` stays false, so the cursor does not move, and the existing action path already
closes the sheet.

**The one conflict with the spec**: `properties.test.ts:84` pins `COLUMN_PROPERTIES` to exactly
four ids, so FR-027 and FR-037's "every other existing test" cannot both hold literally. See
plan, Deviation 2.

---

## R14. Existing tests that tap the triplet button

**Checked** every use, because the button can now refuse. All have three playable columns in
one bar ending at the cursor: `capture.spec.ts:319`, `capture-surface.spec.ts:728`, `:967`,
`:1240`, `:2192`, `:2633`, `:2742`, `techniques-layout.spec.ts:195`,
`techniques-structures.spec.ts:38` (mid-part, cursor on the fourth column),
`techniques-surfaces.spec.ts:63` (three columns after a barline). The presence probes at
`capture-surface.spec.ts:1302` read the button without tapping it.

The new accessible names avoid every word an existing locator matches as a substring: `select`
(`:878`), `copy`, `cut`, `delete`, `cancel`, `paste`, `chord`. `getByTitle(/triplet/)` does not
match "tuplet".

---

## R15. The migration

**Decision**: `npx drizzle-kit generate --name=group_kind < /dev/null`, with
`pgEnum("group_kind", ["tuplet", "plain"])` matching the file's other enums.

**Ran**: the generated SQL is exactly two statements, with no prompt.

```sql
CREATE TYPE "public"."group_kind" AS ENUM('tuplet', 'plain');
ALTER TABLE "events" ADD COLUMN "group_kind" "group_kind";
```

It is additive and nullable, with no backfill. The container runs `scripts/migrate.mjs` before
`server.js` (`Dockerfile:38`), so new server code never meets an unmigrated table.
`drizzle.config.ts` throws unless `STABLATURE_DATABASE_URL` is set, which `.env.local` provides.

`domain.ts` keeps a literal enum rather than importing `GROUP_KINDS`, as the file's other
enums do, and because `assert-model.ts` already catches drift.
