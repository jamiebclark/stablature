import { appliesTo, type CursorTarget, type Scope } from "./target";

export type LatchId = "stack"; // widened, not replaced, by `playing-techniques`

export interface Latch {
  readonly id: LatchId;
  readonly label: string;
  readonly title: string;
  readonly ariaLabel: string;
  readonly scope: Scope; // "next-note" for every latch
  /** What the status line reads while this latch is armed. */
  readonly statusText: string;
}

/**
 * Ordered. The order is the screen order, and a latch never moves.
 *
 * Adding a latch is appending here. No component branches on `id`, so the
 * strip's arrangement is not a function of its contents (FR-008, INV-015).
 */
export const LATCHES: readonly Latch[] = [
  {
    id: "stack",
    label: "stack",
    ariaLabel: "stack notes onto the marked column",
    title: "Keep adding notes to this column, so they sound together as a chord",
    scope: "next-note",
    statusText: "stacking onto the marked column",
  },
];

/** The lit/effective set: armed intersected with applicability. Derived, never stored. */
export function litLatches(
  armed: ReadonlySet<LatchId>,
  target: CursorTarget,
): ReadonlySet<LatchId> {
  const lit = new Set<LatchId>();
  for (const latch of LATCHES) {
    if (armed.has(latch.id) && appliesTo(latch.scope, target)) lit.add(latch.id);
  }
  return lit;
}
