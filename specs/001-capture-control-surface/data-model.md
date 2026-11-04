# Phase 1 — Data model: Restructure the capture control surface

## No persisted data changes

This entry writes no new field, table, annotation kind or event kind, and performs no
migration. Stated plainly because it is a requirement (FR-002, and the spec's *Out of
Scope*) and because it is what INV-013 enforces:

| Store | Change |
|-------|--------|
| `events` (`EventRow`) | none — `repeat`, `kind`, `frets`, `techniques`, `tupletId` all read and written exactly as today |
| `annotations` (`AnnotationRow`) | none — `kind: "chord"` only, upserted by the existing `setChord` |
| `parts`, `songs`, `tunings`, `bands` | none |
| Drizzle schema / `drizzle/` migrations | none |
| Sync protocol (`src/lib/sync/protocol.ts`) | none |
| Clipboard (`src/lib/local/clipboard.ts`) | none |

`techniques: TechniqueMap` already exists on `EventRow` and stays empty. The later
`playing-techniques` roadmap entry is what fills it; this entry does not touch it.

The entities below are therefore **in-memory descriptor types**, new to
`src/lib/capture/`. They are the data that makes the strip and the sheet extensible by
declaration (FR-008, FR-016) and the three surfaces agree (FR-017, FR-018). Their field
shapes are the contract — see [contracts/descriptors.md](./contracts/descriptors.md).

---

## CursorTarget

What the cursor currently resolves to. Replaces the `editable` expression in
`CaptureScreen.tsx`, which conflates "a barline" with "nothing at all".

```ts
type CursorTarget =
  | { kind: "no-part" }                      // no part exists to write to
  | { kind: "no-column" }                    // a part exists; cursor before the first column, or the part is empty
  | { kind: "playable"; event: EventRow }    // event.kind is "notes" or "rest"
  | { kind: "barline";  event: EventRow };
```

**Derivation** — one function, no stored copy:

```ts
resolveTarget(part: PartRow | null, columns: readonly EventRow[], afterId: string | null): CursorTarget
```

| Input | Result |
|-------|--------|
| `part === null` | `{ kind: "no-part" }` |
| `afterId === null` (cursor at the very start, or an empty part) | `{ kind: "no-column" }` |
| `afterId` names an event with `kind === "barline"` | `{ kind: "barline", event }` |
| `afterId` names an event with `kind` `"notes"` or `"rest"` | `{ kind: "playable", event }` |
| `afterId` names nothing (deleted on another device mid-edit) | `{ kind: "no-column" }` |

The last row matters: `insertColumn` in `editing.ts` already treats an unknown
`afterEventId` as "append", and the screen must not render controls pointed at a row that
is gone. It is also one of INV-008's and INV-010's five/seven routes.

**Relationships**: `resolveTarget`'s `afterId` is today's `afterId` —
`cursor === "end" ? columns.at(-1)?.id ?? null : cursor` — unchanged. `CursorTarget` is
recomputed every render and never stored.

### Applicability

```ts
type Scope =
  | "column-property"   // acts on the column at the cursor: repeat, chord symbol, triplet, ×4
  | "next-note"         // modifies the next note pressed: every latch
  | "part";             // acts whatever the target is: space, barline, select, paste, delete

appliesTo(scope: Scope, target: CursorTarget): boolean
```

| Scope | `no-part` | `no-column` | `playable` | `barline` |
|-------|-----------|-------------|------------|-----------|
| `column-property` | false | false | **true** | false |
| `next-note` | false | false | **true** | false |
| `part` | false | **true** | **true** | **true** |

This table *is* the rule the spec's FR-017 means by "the same rule the toolbar uses". It
has exactly one definition and three callers.

---

## Latch

An entry in the next-note modifier strip. The strip is `LATCHES.map(...)`, so adding one
is appending to an array (FR-008).

| Field | Type | Notes |
|-------|------|-------|
| `id` | `LatchId` | `"stack"` is the only member today. The later entry adds `"hammer-on"`, `"pull-off"`, `"slide-up"`, `"slide-down"`. |
| `label` | `string` | Shown on the chip. `"stack"`. |
| `title` | `string` | Tooltip. Today's: `"Keep adding notes to this column, so they sound together as a chord"`. |
| `ariaLabel` | `string` | Announced name, so the visible label can shorten without losing meaning. |
| `scope` | `Scope` | `"next-note"` for every latch. |
| `statusText` | `string` | What the status line reads while armed. `"stacking onto the marked column"` (FR-007 pins this string). |

**Validation / rules**:
- `LATCHES` is ordered, and the order is the screen order. A latch never changes position
  and never disappears (FR-009) — an inapplicable latch renders disabled in place.
- `id` is unique. No component branches on `id` (INV-015).

**State** — held by `CaptureScreen`, not by the descriptor:

```ts
armed: ReadonlySet<LatchId>          // stored
lit   = armed ∩ { l : appliesTo(l.scope, target) }   // derived every render
```

### State transitions

| From | Event | To | Source |
|------|-------|-----|--------|
| unarmed | tap the chip | armed | FR-005 |
| armed | tap the chip | unarmed | story 1 scenario 2 |
| armed | fret press | **armed** (stays, across any number of presses) | FR-005, story 1 scenario 1 |
| armed | tap a column | unarmed (explicit) | story 1 scenario 3 |
| armed | switch part | unarmed (explicit) | story 1 scenario 3 |
| armed | insert a space | unarmed (explicit) | story 1 scenario 3 |
| armed | insert a barline | unarmed (explicit **and** derived — the new target is a barline) | story 1 scenario 3 |
| armed | target becomes inapplicable by **any** other route | not lit, not effective (derived) | Edge case "latch armed, then the cursor moves somewhere it cannot apply" |

The derived row is the one that covers the routes today's code misses: `⇤ start`,
`end ⇥`, the target column being deleted locally or by an incoming sync.

---

## ColumnProperty

A property of one column, at rest. The inspector is
`propertiesFor(target).map(...)`, so adding a property is appending to an array (FR-016).
The toolbar renders from the **same** list rather than from its own: its contextual row 2
renders the `"column-property"`-scoped members, and `delete` — scoped `"part"` — renders in
stable row 1. Either way both surfaces call the same `commit`, which is what INV-004 needs.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `ColumnPropertyId` | `"repeat" \| "chord" \| "delete"` today. `rhythm-and-tempo` adds `"duration"`. |
| `label` | `string` | Row label in the sheet. |
| `scope` | `Scope` | `"column-property"` for `repeat` and `chord`; `"part"` for `delete`, so it survives on a barline — see *Open question recorded* below. |
| `control` | `"stepper" \| "text" \| "action"` | How the row renders. A closed set, so the sheet has one renderer per kind and none per id. |
| `destructive` | `boolean` | `true` for `delete`; drives the danger styling. |
| `read` | `(ctx) => string \| number \| null` | Current value, read from the `EventRow` / annotations. `null` for an action. |
| `commit` | `(ctx, value) => Promise<void>` | **The only path to the mutation.** |

`ctx` carries what the mutation needs and nothing more:
`{ part: Pick<PartRow, "id" | "bandId">; event: EventRow; annotations: readonly AnnotationRow[] }`
— the exact shape in [contracts/descriptors.md](./contracts/descriptors.md).

**The three properties**:

| id | scope | control | read | commit → calls |
|----|-------|---------|------|----------------|
| `repeat` | `column-property` | `stepper` | `event.repeat` | `bumpColumnRepeat(event, delta)` — `setColumnRepeat` clamps at 1 already |
| `chord` | `column-property` | `text` | the `kind: "chord"` annotation anchored to `event.id`, or `null` | `setChord(part, event.id, value)` — upserts, and deletes the annotation on an empty string |
| `delete` | `part` | `action` | `null` | `deleteColumn(event.id)` |

**Validation / rules**:
- `commit` is the sole caller of `bumpColumnRepeat`, `setChord` and `deleteColumn` from
  the capture screen. `CaptureScreen.tsx` and `ColumnInspector.tsx` import none of them
  (INV-004, asserted by a unit test on the import graph).
- `×4` is **not** a property. It is a toolbar shortcut for `repeat`'s `commit` with
  `delta = 3`, exactly as today, so it cannot disagree with the stepper.
- A property appears on a target iff `appliesTo(property.scope, target)`. `repeat` and
  `chord` are `"column-property"`, so on a barline neither appears; `delete` is `"part"`,
  so it does. That is exactly the spec's edge case — a long-pressed barline offers delete
  and not repeat or chord symbol — reached with one rule rather than a special case. The
  scoping is argued below.
- `COLUMN_PROPERTIES` is ordered; the order is the row order in the sheet and, for its
  `"column-property"`-scoped members, the control order in the toolbar's contextual row.

### Open question recorded, with the resolution taken

The spec's Edge Cases say a long-pressed **barline** "opens the inspector for the barline
and offers only what applies to it (**delete**)", while FR-017 says the inspector follows
"the same rule the toolbar uses: a barline offers delete and not repeat or chord symbol" —
and FR-011 requires the toolbar's `delete` to be in the always-present stable group, which
it is.

So `delete` needs two scopes: it is a *column property* in the sheet and a *stable*
toolbar control. Resolved by giving `delete` the scope `"part"` rather than
`"column-property"` — `appliesTo("part", …)` is true for `barline`, `playable` and
`no-column`, which is precisely today's toolbar behaviour (`disabled={!focused}`) and
precisely the sheet behaviour the edge case asks for. `repeat` and `chord` keep
`"column-property"`.

Consequence, deliberate: a long press on a barline opens a sheet containing one row,
`delete`. That satisfies the edge case's "it does not open an inspector with nothing in
it" and keeps one rule for both surfaces. The sheet renders nothing at all — and the long
press is a no-op — only when **no** property applies, which under this scoping cannot
happen for an existing column.

---

## ToolbarControl

The nine bottom-toolbar controls, declared so that presence is data rather than nine
JSX conditionals. Rendering stays in `CaptureScreen.tsx` (a stepper, a form trigger and
seven buttons are not one renderer); this list decides *group* and *presence* only.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `ToolbarControlId` | `space`, `barline`, `select`, `paste`, `delete`, `triplet`, `repeat`, `times4`, `chord` |
| `group` | `"stable" \| "contextual"` | Stable controls are always present; contextual ones are present iff applicable. |
| `scope` | `Scope` | `"part"` for the stable five, `"column-property"` for the contextual four. |

Order is the DOM order: the five stable controls first (row 1), the four contextual ones
after (row 2). That ordering is what makes INV-003 structural — nothing in row 1 can move,
because nothing before it ever changes.

`triplet` is `contextual`, which is a knowing deviation from FR-012's literal list; see
`plan.md` → *Deviations* §1.

---

## Cursor repair

Not a new entity — one shared function, so the toolbar's delete and the inspector's delete
cannot disagree about where the cursor lands (INV-004).

```ts
nextCursorAfterDelete(
  columns: readonly EventRow[],
  deletedId: string,
  cursor: Cursor,
): Cursor
```

| Case | Result |
|------|--------|
| `cursor === "end"` | `"end"` (keeps tracking the tail, as today) |
| `cursor === deletedId`, a previous column exists | that column's id |
| `cursor === deletedId`, no previous column | `null` (the start) |
| `cursor` is some other column | unchanged |

The third row is today's behaviour (`previous ? previous.id : null`). The fourth is new
only in that the inspector can delete a column the cursor is not on, which the toolbar
never could.

---

## InspectorState

Held by `CaptureScreen`:

```ts
inspecting: string | null          // an event id, never an EventRow
```

**Derivation, not mirroring** — this is what makes INV-008 structural:

```ts
const inspected = inspecting ? columns.find(c => c.id === inspecting) ?? null : null;
// the sheet is open iff inspected !== null
```

Because `columns` comes from the `useEvents` live query, a column deleted locally or by an
incoming sync drops out of `columns` and the sheet closes on the next render. No effect,
no subscription, no stale copy. `inspecting` is also cleared on part switch (the route is
a navigation, and the chip's `onClick` already resets screen state).

Opening the inspector sets `inspecting` and **nothing else** — not the cursor, not the
armed set, not the selection (FR-023, INV-009).
