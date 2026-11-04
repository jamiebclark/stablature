import {
  bumpColumnRepeat,
  deleteColumn,
  setChord,
  toggleDecoration,
  ungroupTuplet,
} from "@/lib/local/editing";
import { groupNumber, type AnnotationRow, type EventRow, type PartRow } from "@/lib/model";
import { DECORATIONS, type Decoration } from "@/lib/tab/techniques";
import { noteLabel } from "@/lib/pitch";
import type { Tuning } from "@/lib/tunings";
import { appliesTo, type CursorTarget, type Scope } from "./target";

export type ColumnPropertyId = "repeat" | "chord" | "decorations" | "group" | "delete";

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
  readonly label: string;
  readonly ariaLabel: string;
  readonly on: boolean;
}

export interface ColumnToggleGroup {
  readonly stringIndex: number;
  /** The bare note, as on the staff. */
  readonly label: string;
  readonly toggles: readonly ColumnToggle[];
}

export interface ColumnProperty {
  readonly id: ColumnPropertyId;
  readonly label: string;
  readonly ariaLabel: string;
  readonly scope: Scope;
  readonly control: "stepper" | "text" | "action" | "toggles";
  readonly destructive: boolean;
  /** Current value for display. `null` for an action, or for "not set". */
  read(ctx: PropertyContext): string | number | null;
  /**
   * The ONLY path from the capture screen to a column mutation.
   *
   * `value` is a signed delta for "stepper", the new symbol (possibly "") for
   * "text", and ignored for "action".
   */
  commit(ctx: PropertyContext, value: PropertyValue): Promise<void>;
  /** Declared by a "toggles" control. */
  toggles?(ctx: PropertyContext): readonly ColumnToggleGroup[];
  /** Replaces `label` in the row's left cell. Absent means `label`. */
  heading?(ctx: PropertyContext): string;
  /** Narrows `scope` for one column. Absent means every column the scope allows. */
  appliesToColumn?(event: EventRow): boolean;
}

/**
 * Ordered: the row order in the inspector, and for the "column-property"-scoped
 * members the control order in the toolbar's row 2. `delete` is scoped "part",
 * so the toolbar renders it in stable row 1 -- calling this same `commit`.
 */
export const COLUMN_PROPERTIES: readonly ColumnProperty[] = [
  {
    id: "repeat",
    label: "repeat",
    ariaLabel: "repeat count",
    scope: "column-property",
    control: "stepper",
    destructive: false,
    read: (ctx) => ctx.event.repeat,
    commit: async (ctx, value) => {
      await bumpColumnRepeat(ctx.event, Number(value));
    },
  },
  {
    id: "chord",
    label: "chord symbol",
    ariaLabel: "chord symbol",
    scope: "column-property",
    control: "text",
    destructive: false,
    read: (ctx) =>
      ctx.annotations.find((a) => a.kind === "chord" && a.anchorEventId === ctx.event.id)
        ?.value ?? null,
    commit: async (ctx, value) => {
      await setChord(ctx.part, ctx.event.id, String(value));
    },
  },
  {
    id: "decorations",
    label: "techniques",
    ariaLabel: "note techniques",
    scope: "column-property",
    control: "toggles",
    destructive: false,
    read: () => null,
    appliesToColumn: (event) => Object.keys(event.frets).length > 0,
    toggles: (ctx) =>
      Object.keys(ctx.event.frets)
        .map(Number)
        .filter((i) => ctx.tuning.strings[i] !== undefined)
        .sort((a, b) => a - b)
        .map((stringIndex) => {
          const note = ctx.tuning.strings[stringIndex];
          const stored: readonly string[] = ctx.event.techniques[String(stringIndex)] ?? [];
          return {
            stringIndex,
            label: note.note,
            toggles: DECORATIONS.map((d) => ({
              value: { stringIndex, decoration: d.id },
              label: d.short,
              ariaLabel: `${d.words} on the ${noteLabel(note)} string`,
              on: stored.includes(d.id),
            })),
          };
        }),
    commit: async (ctx, value) => {
      const change = value as DecorationChange;
      await toggleDecoration(ctx.event.id, change.stringIndex, change.decoration);
    },
  },
  {
    id: "group",
    label: "ungroup",
    ariaLabel: "ungroup",
    scope: "column-property",
    control: "action",
    destructive: false,
    read: () => null,
    appliesToColumn: (event) => event.tupletId !== null,
    heading: (ctx) => {
      const n = groupNumber(ctx.event);
      return n === null ? "plain group" : `tuplet of ${n}`;
    },
    commit: async (ctx) => {
      await ungroupTuplet([ctx.event]);
    },
  },
  {
    id: "delete",
    label: "delete",
    ariaLabel: "delete column",
    scope: "part",
    control: "action",
    destructive: true,
    read: () => null,
    commit: async (ctx) => {
      await deleteColumn(ctx.event.id);
    },
  },
];

/** The subset that applies to a target, in declaration order. */
export function propertiesFor(target: CursorTarget): readonly ColumnProperty[] {
  return COLUMN_PROPERTIES.filter(
    (property) =>
      appliesTo(property.scope, target) &&
      (!("event" in target) || (property.appliesToColumn?.(target.event) ?? true)),
  );
}
