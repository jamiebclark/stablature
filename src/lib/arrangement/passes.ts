import type { EventRow } from "@/lib/model";
import { eventsInBars } from "@/lib/tab/layout";
import type { ArrangementStep } from "./expand";

/** One pass of the arrangement with the columns it draws, already sliced to its bars. */
export interface DrawnPass {
  readonly step: ArrangementStep;
  readonly events: readonly EventRow[];
}

/** The only caller of `eventsInBars` for the play view: it draws from this and the click reads it. */
export function drawnPasses(
  steps: readonly ArrangementStep[],
  eventsByPart: Readonly<Record<string, readonly EventRow[]>>,
): DrawnPass[] {
  return steps.map((step) => ({
    step,
    events: eventsInBars(eventsByPart[step.partId] ?? [], step.fromBar, step.toBar),
  }));
}
