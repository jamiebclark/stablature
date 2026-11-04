import type { EventRow } from "@/lib/model";
import { TRANSITIONS, type Transition } from "@/lib/tab/techniques";
import { appliesTo, targetEvent, type CursorTarget, type Scope } from "./target";

export type LatchId = "stack" | Transition;

export interface Latch {
  readonly id: LatchId;
  readonly label: string;
  readonly title: string;
  readonly ariaLabel: string;
  readonly scope: Scope; // "next-note" for every latch
  /** What the status line reads while this latch is armed. */
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

const TRANSITION_STATUS: Record<Transition, string> = {
  hammer_on: "next note: hammer-on",
  pull_off: "next note: pull-off",
  slide_up: "next note: slide up",
  slide_down: "next note: slide down",
};

const transitionLatches: readonly Latch[] = TRANSITIONS.map((t) => ({
  id: t.id,
  label: t.glyph,
  ariaLabel: t.words,
  title: `The next note joins the one before it as a ${t.words}`,
  scope: "transition" as const,
  statusText: TRANSITION_STATUS[t.id],
  statusShort: t.words,
  transition: t.id,
}));

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
    statusShort: "stack",
    stacks: true,
  },
  ...transitionLatches,
];

const byId = (id: LatchId): Latch => LATCHES.find((l) => l.id === id)!;

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

/** A tap on a chip. Arming a transition latch clears any other (FR-020). */
export function armLatch(armed: ReadonlySet<LatchId>, id: LatchId): ReadonlySet<LatchId> {
  const next = new Set(armed);
  if (next.has(id)) {
    next.delete(id);
    return next;
  }
  if (byId(id).transition) {
    for (const other of armed) if (byId(other).transition) next.delete(other);
  }
  next.add(id);
  return next;
}

export interface NextNote {
  /** The column to stack onto, or null to insert a new one at the cursor. */
  readonly stackOnto: EventRow | null;
  readonly techniques: readonly Transition[];
  /** Latches this note uses up. Disarmed BEFORE the write is awaited. */
  readonly consumed: readonly LatchId[];
}

export function nextNote(lit: ReadonlySet<LatchId>, target: CursorTarget): NextNote {
  const lits = LATCHES.filter((l) => lit.has(l.id));
  const stacking = lits.some((l) => l.stacks);
  const transitions = lits.flatMap((l) => (l.transition ? [l.transition] : []));
  return {
    stackOnto: stacking ? (targetEvent("next-note", target) ?? null) : null,
    techniques: transitions,
    consumed: lits.filter((l) => l.transition).map((l) => l.id),
  };
}

/** The status line, or null when nothing is lit. Stack alone keeps its exact text. */
export function statusFor(lit: ReadonlySet<LatchId>): string | null {
  const lits = LATCHES.filter((l) => lit.has(l.id));
  if (lits.length === 0) return null;
  if (lits.length === 1) return lits[0].statusText;
  return lits.map((l) => l.statusShort ?? l.label).join(" + ");
}

/** True while the cursor names a column the live query has not delivered. */
export function cursorPending(
  afterId: string | null,
  focusedId: string | undefined,
  deliveredId: string | null,
): boolean {
  return afterId !== null && focusedId === undefined && deliveredId !== afterId;
}

/** The prune. While pending, `armed` itself is returned. Otherwise `lit`, if it differs. */
export function prunedArmed(
  armed: ReadonlySet<LatchId>,
  lit: ReadonlySet<LatchId>,
  pending: boolean,
): ReadonlySet<LatchId> {
  if (pending) return armed;
  return [...armed].some((id) => !lit.has(id)) ? lit : armed;
}
