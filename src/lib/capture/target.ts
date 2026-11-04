/**
 * What the cursor resolves to, and the one applicability rule three surfaces
 * share (FR-017, FR-018). See contracts/descriptors.md for the contract this
 * implements.
 */

import type { EventRow, PartRow } from "@/lib/model";

export type CursorTarget =
  | { readonly kind: "no-part" }
  | { readonly kind: "no-column" }
  | { readonly kind: "playable"; readonly event: EventRow }
  | { readonly kind: "barline"; readonly event: EventRow };

export type Scope = "column-property" | "next-note" | "transition" | "part";

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
): CursorTarget {
  if (part === null) return { kind: "no-part" };
  if (afterId === null) return { kind: "no-column" };

  const event = columns.find((column) => column.id === afterId);
  if (!event) return { kind: "no-column" };

  if (event.kind === "barline") return { kind: "barline", event };
  return { kind: "playable", event };
}

const APPLICABILITY: Record<Scope, Record<CursorTarget["kind"], boolean>> = {
  "column-property": { "no-part": false, "no-column": false, playable: true, barline: false },
  "next-note": { "no-part": false, "no-column": false, playable: true, barline: false },
  transition: { "no-part": false, "no-column": false, playable: true, barline: true },
  part: { "no-part": false, "no-column": true, playable: true, barline: true },
};

/** The ONE applicability rule. Three callers, no copies. */
export function appliesTo(scope: Scope, target: CursorTarget): boolean {
  return APPLICABILITY[scope][target.kind];
}

/** The event a scope would act on, or undefined when the scope does not apply. */
export function targetEvent(scope: Scope, target: CursorTarget): EventRow | undefined {
  if (!appliesTo(scope, target)) return undefined;
  return target.kind === "playable" || target.kind === "barline" ? target.event : undefined;
}
