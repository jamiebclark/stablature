import { appliesTo, type CursorTarget, type Scope } from "./target";

export type ToolbarControlId =
  | "space"
  | "barline"
  | "select"
  | "paste"
  | "delete" // stable, row 1, in this order
  | "triplet"
  | "repeat"
  | "times4"
  | "chord"
  | "inspect"; // contextual, row 2, in this order

export interface ToolbarControl {
  readonly id: ToolbarControlId;
  readonly group: "stable" | "contextual";
  readonly scope: Scope;
}

/** Declaration order IS DOM order: all five stable controls, then all five contextual. */
export const TOOLBAR_CONTROLS: readonly ToolbarControl[] = [
  { id: "space", group: "stable", scope: "part" },
  { id: "barline", group: "stable", scope: "part" },
  { id: "select", group: "stable", scope: "part" },
  { id: "paste", group: "stable", scope: "part" },
  { id: "delete", group: "stable", scope: "part" },
  { id: "triplet", group: "contextual", scope: "column-property" },
  { id: "repeat", group: "contextual", scope: "column-property" },
  { id: "times4", group: "contextual", scope: "column-property" },
  { id: "chord", group: "contextual", scope: "column-property" },
  { id: "inspect", group: "contextual", scope: "column-property" },
];

/** Present iff stable, or applicable. */
export function isPresent(control: ToolbarControl, target: CursorTarget): boolean {
  return control.group === "stable" || appliesTo(control.scope, target);
}
