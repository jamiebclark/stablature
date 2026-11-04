# Contract: the capture screen's descriptor modules

The interfaces this feature exposes are not HTTP endpoints — this is a single-package
Next.js app whose only network surface is `src/app/api/sync/*`, and that is untouched.
The contracts that matter here are the **module boundaries inside `src/lib/capture/`**,
because three UI surfaces depend on them agreeing (FR-017, FR-018) and two later roadmap
entries extend them by appending to them (FR-008, FR-016).

Signatures below are the contract. Field names and the applicability table are what a
later entry may rely on; everything else is implementation.

---

## `src/lib/capture/target.ts`

```ts
import type { EventRow, PartRow } from "@/lib/model";

export type CursorTarget =
  | { readonly kind: "no-part" }
  | { readonly kind: "no-column" }
  | { readonly kind: "playable"; readonly event: EventRow }
  | { readonly kind: "barline";  readonly event: EventRow };

export type Scope = "column-property" | "next-note" | "part";

/**
 * What the cursor resolves to. `afterId` is the id of the column to insert
 * after, or null for the very start -- i.e. exactly today's `afterId`.
 *
 * An `afterId` that names nothing resolves to "no-column": the column was
 * deleted on another device mid-edit, and no control may point at it.
 */
export function resolveTarget(
  part: Pick<PartRow, "id"> | null,
  columns: readonly EventRow[],
  afterId: string | null,
): CursorTarget;

/** The ONE applicability rule. Three callers, no copies. */
export function appliesTo(scope: Scope, target: CursorTarget): boolean;

/** The event a scope would act on, or undefined when the scope does not apply. */
export function targetEvent(scope: Scope, target: CursorTarget): EventRow | undefined;
```

### The applicability table

Normative. A change to any cell is a behaviour change to all three surfaces at once, which
is the point.

| `scope` ↓ / `target.kind` → | `no-part` | `no-column` | `playable` | `barline` |
|---|---|---|---|---|
| `column-property` | `false` | `false` | `true` | `false` |
| `next-note` | `false` | `false` | `true` | `false` |
| `part` | `false` | `true` | `true` | `true` |

`playable` means `event.kind` is `"notes"` or `"rest"`. A `rest` takes a repeat and a
chord symbol today and must continue to (FR-001).

**Unit tests must cover all 12 cells**, plus `resolveTarget`'s five input cases from
`data-model.md`. That is the node-environment half of INV-002 and INV-010.

---

## `src/lib/capture/latches.ts`

```ts
import type { CursorTarget, Scope } from "./target";

export type LatchId = "stack";   // widened, not replaced, by `playing-techniques`

export interface Latch {
  readonly id: LatchId;
  readonly label: string;
  readonly title: string;
  readonly ariaLabel: string;
  readonly scope: Scope;         // "next-note" for every latch
  /** What the status line reads while this latch is armed. */
  readonly statusText: string;
}

/**
 * Ordered. The order is the screen order, and a latch never moves.
 *
 * Adding a latch is appending here. No component branches on `id`, so the
 * strip's arrangement is not a function of its contents (FR-008, INV-015).
 */
export const LATCHES: readonly Latch[];

/** The lit/effective set: armed intersected with applicability. Derived, never stored. */
export function litLatches(
  armed: ReadonlySet<LatchId>,
  target: CursorTarget,
): ReadonlySet<LatchId>;
```

Today's single member, pinned by FR-005/FR-006/FR-007:

```ts
{
  id: "stack",
  label: "stack",
  ariaLabel: "stack notes onto the marked column",
  title: "Keep adding notes to this column, so they sound together as a chord",
  scope: "next-note",
  statusText: "stacking onto the marked column",
}
```

`statusText` is byte-pinned by FR-007 and by the existing e2e assertion
`expect(page.getByText("stacking onto the marked column")).toBeVisible()`.

### Guarantees

- `litLatches(armed, target) ⊆ armed`, and every member satisfies
  `appliesTo("next-note", target)`. **There is no state in which a latch is lit and
  inapplicable** (INV-010).
- `LATCHES` order is stable; `id`s are unique.

---

## `src/lib/capture/properties.ts`

```ts
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import type { CursorTarget, Scope } from "./target";

export type ColumnPropertyId = "repeat" | "chord" | "delete";

export interface PropertyContext {
  readonly part: Pick<PartRow, "id" | "bandId">;
  readonly event: EventRow;
  readonly annotations: readonly AnnotationRow[];
}

export interface ColumnProperty {
  readonly id: ColumnPropertyId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly scope: Scope;
  readonly control: "stepper" | "text" | "action";
  readonly destructive: boolean;
  /** Current value for display. `null` for an action, or for "not set". */
  read(ctx: PropertyContext): string | number | null;
  /**
   * The ONLY path from the capture screen to a column mutation.
   *
   * `value` is a signed delta for "stepper", the new symbol (possibly "") for
   * "text", and ignored for "action".
   */
  commit(ctx: PropertyContext, value: string | number): Promise<void>;
}

/**
 * Ordered: the row order in the inspector, and for the "column-property"-scoped
 * members the control order in the toolbar's row 2. `delete` is scoped "part",
 * so the toolbar renders it in stable row 1 -- calling this same `commit`.
 */
export const COLUMN_PROPERTIES: readonly ColumnProperty[];

/** The subset that applies to a target, in declaration order. */
export function propertiesFor(target: CursorTarget): readonly ColumnProperty[];
```

| id | scope | control | `read` | `commit` delegates to |
|----|-------|---------|--------|-----------------------|
| `repeat` | `column-property` | `stepper` | `event.repeat` | `bumpColumnRepeat(event, delta)` |
| `chord` | `column-property` | `text` | the `kind: "chord"` annotation anchored to `event.id`, else `null` | `setChord(part, event.id, value)` |
| `delete` | `part` | `action` | `null` | `deleteColumn(event.id)` |

`delete`'s scope is `"part"`, not `"column-property"`, so it survives on a barline — which
is what both the spec's barline edge case and FR-011's stable-group requirement need. See
`data-model.md` → *Open question recorded*.

### Guarantees — these are INV-004

1. `commit` is the **sole** caller of `bumpColumnRepeat`, `setChord` and `deleteColumn`
   from the capture screen. Neither `CaptureScreen.tsx` nor `ColumnInspector.tsx` imports
   them. A unit test asserts the import graph, so a future shortcut is caught by the suite
   rather than by review.
2. `commit` is idempotent in the sense that matters: calling it with the same `ctx` and
   `value` from either surface produces the same stored row. It is **not** idempotent for
   `repeat`, which takes a delta — by design, because that is what the stepper is.
3. `×4` is not a property. The toolbar calls the `repeat` property's `commit` with
   `value: 3`, exactly as today's `bumpColumnRepeat(editable, 3)`, so the shortcut cannot
   drift from the stepper.
4. `setChord` with an empty string deletes the annotation — existing behaviour, relied on
   by the inspector's "clear the chord symbol" path, and one of INV-004's six members.

---

## `src/lib/capture/controls.ts`

```ts
import type { CursorTarget, Scope } from "./target";

export type ToolbarControlId =
  | "space" | "barline" | "select" | "paste" | "delete"   // stable, row 1, in this order
  | "triplet" | "repeat" | "times4" | "chord";            // contextual, row 2, in this order

export interface ToolbarControl {
  readonly id: ToolbarControlId;
  readonly group: "stable" | "contextual";
  readonly scope: Scope;
}

/** Declaration order IS DOM order: all five stable controls, then all four contextual. */
export const TOOLBAR_CONTROLS: readonly ToolbarControl[];

/** Present iff stable, or applicable. */
export function isPresent(control: ToolbarControl, target: CursorTarget): boolean;
```

### Presence and enablement are different questions

| Group | Present | Disabled |
|-------|---------|----------|
| `stable` | always | when the control's own precondition fails — no part, no target column, or an empty clipboard. Today's `disabled={…}` expressions, unchanged. |
| `contextual` | iff `appliesTo(control.scope, target)` | only `repeat`'s `−`, when `event.repeat <= 1` (today's rule) |

So `select` and `delete` are present-and-disabled with the cursor at the very start, as
today, and the contextual row is **absent entirely** on a barline — the two spec
contradictions resolved in `plan.md` → *Deviations*.

Enablement stays in `CaptureScreen.tsx` next to the handler it guards; it is a one-line
predicate per control and does not need to be shared, because no second surface renders
these controls. Only *presence* needed promoting, because only presence is what two
surfaces must agree about.

---

## `src/lib/capture/cursor.ts`

```ts
import type { EventRow } from "@/lib/model";

/** "end" tracks the tail; null is the very start; a string is a column id. */
export type Cursor = "end" | null | string;

/**
 * Where the cursor goes after a column is deleted. Called by BOTH the toolbar's
 * delete and the inspector's delete, so they cannot disagree (INV-004).
 */
export function nextCursorAfterDelete(
  columns: readonly EventRow[],
  deletedId: string,
  cursor: Cursor,
): Cursor;
```

| Case | Result |
|------|--------|
| `cursor === "end"` | `"end"` |
| `cursor === deletedId` and a previous column exists | that column's id |
| `cursor === deletedId` and none does | `null` |
| otherwise | `cursor` unchanged |

`Cursor` moves here from its current home at the top of `CaptureScreen.tsx`, keeping its
docblock. The type is otherwise unchanged.

---

## What is NOT in these contracts

Named so a reviewer can check the diff against it:

- No change to `src/lib/local/editing.ts` — its signatures are already what `commit` needs.
- No change to `src/lib/model.ts`, `src/db/schema/`, `drizzle/`, `src/lib/sync/`,
  `src/lib/tab/`, `src/lib/export/` or `src/lib/local/clipboard.ts` (INV-013).
- No new `EventKind`, `AnnotationKind` or `TechniqueMap` key.
- No new route, route handler or server action.
