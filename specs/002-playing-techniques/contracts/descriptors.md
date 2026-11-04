# Contract: declared data and the rules over it

Extends `specs/001-capture-control-surface/contracts/descriptors.md`. Signatures are the
contract. Later entries rely on them.

---

## `src/lib/tab/techniques.ts` (new)

```ts
import type { Technique } from "../model";

export type Transition = Extract<Technique, "hammer_on" | "pull_off" | "slide_up" | "slide_down">;
export type Decoration = Extract<
  Technique,
  "vibrato" | "harmonic" | "let_ring" | "bend" | "tap" | "palm_mute"
>;

export interface TransitionSpec {
  readonly id: Transition;
  readonly glyph: "h" | "p" | "/" | "\\";
  readonly words: string;
}

export interface DecorationSpec {
  readonly id: Decoration;
  readonly before: string;
  readonly after: string;
  readonly words: string;
  /** The toggle's visible label. */
  readonly short: string;
}

/** Priority order: the one drawn when two are stored on a string. */
export const TRANSITIONS: readonly TransitionSpec[];

/** Toggle order in the inspector (FR-026). NOT the drawing order. */
export const DECORATIONS: readonly DecorationSpec[];

/** The wire's cap on one string's list. Pinned against `eventRowSchema` by a test. */
export const MAX_TECHNIQUES_PER_STRING = 8;

/** The fret text with its affixes, in the fixed order, for any stored order (FR-008). */
export function decorate(fret: string, stored: readonly string[]): string;

/** The transition to draw from a stored list, or null. Ignores anything it does not manage. */
export function drawnTransition(stored: readonly string[]): TransitionSpec | null;

/** The decorations in a stored list, deduplicated, in reading order. */
export function drawnDecorations(stored: readonly string[]): readonly DecorationSpec[];
```

`stored` is `readonly string[]` rather than `Technique[]` because the wire accepts any
string of up to 32 characters.

Only `layout.ts`, `latches.ts`, `properties.ts` and `editing.ts` import this module.
`ascii.ts` and `TabStaff.tsx` must not (INV-005).

---

## `src/lib/tab/layout.ts` (extended)

```ts
export interface TabColumn {
  // existing fields unchanged, except that `cells` now holds affixes
  /** One entry per string, top first: the glyph in the gap BEFORE this column. */
  connectors: (string | null)[];
  /** What a screen reader reads. Words and numbers, never affix characters. */
  description: string;
}
```

Description format:

| Column | Text |
|---|---|
| Barline | `Barline` |
| No notes | `Empty column` |
| Plain | `string 4 fret 7`, as today |
| Two strings | `string 3 fret 5, string 4 fret 7`, as today |
| With techniques | `string 4 fret 7 with hammer-on and vibrato` |
| Compact, repeated | `string 4 fret 7 with vibrato, repeated 3 times` |

A transition is named only when its connector is drawn. Decorations are named in reading
order, after the transition. `string N` keeps today's numbering, where `string 1` is the
top string.

---

## `src/lib/capture/target.ts` (extended)

```ts
export type Scope = "column-property" | "next-note" | "transition" | "part";
```

| Scope | no-part | no-column | playable | barline |
|---|---|---|---|---|
| `column-property` | no | no | yes | no |
| `next-note` | no | no | yes | no |
| **`transition`** | no | no | yes | **yes** |
| `part` | no | yes | yes | yes |

`CursorTarget`, `resolveTarget` and `targetEvent` do not change.

---

## `src/lib/capture/latches.ts` (extended)

```ts
export type LatchId = "stack" | Transition;

export interface Latch {
  readonly id: LatchId;
  readonly label: string;
  readonly title: string;
  readonly ariaLabel: string;
  readonly scope: Scope;
  readonly statusText: string;
  /** Used when several latches are lit together. Falls back to `label`. */
  readonly statusShort?: string;
  /** Places the note on the marked column rather than in a new one. */
  readonly stacks?: boolean;
  /**
   * The technique the next note stores. Its presence makes the latch one-shot,
   * exclusive with other transition latches, and labelled by glyph.
   */
  readonly transition?: Transition;
}
```

New members are optional so existing descriptors and test fixtures stay valid.

`LATCHES`, in order. Labels come from `TRANSITIONS`, never from a second literal.

| id | label | ariaLabel | scope | statusText | statusShort |
|---|---|---|---|---|---|
| `stack` | `stack` | unchanged | `next-note` | `stacking onto the marked column` | `stack` |
| `hammer_on` | `h` | `hammer-on` | `transition` | `next note: hammer-on` | `hammer-on` |
| `pull_off` | `p` | `pull-off` | `transition` | `next note: pull-off` | `pull-off` |
| `slide_up` | `/` | `slide up` | `transition` | `next note: slide up` | `slide up` |
| `slide_down` | `\` | `slide down` | `transition` | `next note: slide down` | `slide down` |

```ts
/** Unchanged: armed ∩ applicable. */
export function litLatches(armed, target): ReadonlySet<LatchId>;

/** A tap on a chip. Arming a transition latch clears any other (FR-020). */
export function armLatch(armed: ReadonlySet<LatchId>, id: LatchId): ReadonlySet<LatchId>;

export interface NextNote {
  /** The column to stack onto, or null to insert a new one at the cursor. */
  readonly stackOnto: EventRow | null;
  readonly techniques: readonly Transition[];
  /** Latches this note uses up. Disarmed BEFORE the write is awaited. */
  readonly consumed: readonly LatchId[];
}
export function nextNote(lit: ReadonlySet<LatchId>, target: CursorTarget): NextNote;

/** The status line, or null when nothing is lit. Stack alone keeps its exact text. */
export function statusFor(lit: ReadonlySet<LatchId>): string | null;

/** True while the cursor names a column the live query has not delivered. */
export function cursorPending(
  afterId: string | null,
  focusedId: string | undefined,
  deliveredId: string | null,
): boolean;

/** The prune. While pending, `armed` itself is returned. Otherwise `lit`, if it differs. */
export function prunedArmed(
  armed: ReadonlySet<LatchId>,
  lit: ReadonlySet<LatchId>,
  pending: boolean,
): ReadonlySet<LatchId>;
```

---

## `src/lib/capture/properties.ts` (extended)

```ts
export type ColumnPropertyId = "repeat" | "chord" | "decorations" | "delete";

export interface PropertyContext {
  readonly part: Pick<PartRow, "id" | "bandId">;
  readonly event: EventRow;
  readonly annotations: readonly AnnotationRow[];
  readonly tuning: Tuning;
}

export interface DecorationChange {
  readonly stringIndex: number;
  readonly decoration: Decoration;
}

export type PropertyValue = string | number | DecorationChange;

export interface ColumnToggle {
  /** Handed back to `commit` unchanged. */
  readonly value: DecorationChange;
  readonly label: string;        // "vib"
  readonly ariaLabel: string;    // "vibrato on the A1 string"
  readonly on: boolean;
}

export interface ColumnToggleGroup {
  readonly stringIndex: number;
  readonly label: string;        // the bare note, as on the staff: "A"
  readonly toggles: readonly ColumnToggle[];
}

export interface ColumnProperty {
  // existing members; `control` widens, and `commit` takes PropertyValue
  readonly control: "stepper" | "text" | "action" | "toggles";
  /** Declared by a "toggles" control. */
  toggles?(ctx: PropertyContext): readonly ColumnToggleGroup[];
  /** Narrows `scope` for one column. Absent means every column the scope allows. */
  appliesToColumn?(event: EventRow): boolean;
}
```

`COLUMN_PROPERTIES`, in order: `repeat`, `chord`, **`decorations`**, `delete`.

| Member | Value |
|---|---|
| `id` | `decorations` |
| `label` | `techniques` |
| `ariaLabel` | `note techniques` |
| `scope` | `column-property` |
| `control` | `toggles` |
| `destructive` | `false` |
| `appliesToColumn` | True when any string in the tuning has a note. |
| `commit` | `toggleDecoration(ctx.event.id, value.stringIndex, value.decoration)`, passing the **id**, never the row. |

`propertiesFor(target)` filters by `appliesTo(scope, target)` and then, for a target with an
event, by `appliesToColumn`.

---

## `src/lib/capture/controls.ts` (extended)

`ToolbarControlId` gains `"inspect"`, declared last:
`{ id: "inspect", group: "contextual", scope: "column-property" }`.

Row 2 becomes `triplet`, `repeat`, `times4`, `chord`, `inspect`, so nothing already there
moves.
