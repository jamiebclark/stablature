import { bumpColumnRepeat, deleteColumn, setChord } from "@/lib/local/editing";
import type { AnnotationRow, EventRow, PartRow } from "@/lib/model";
import { appliesTo, type CursorTarget, type Scope } from "./target";

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
  return COLUMN_PROPERTIES.filter((property) => appliesTo(property.scope, target));
}
