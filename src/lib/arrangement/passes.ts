import type { EventRow, PartRow } from "@/lib/model";
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

/** One whole pass of a part: every column, bar numbers from 1. Used by part playback. */
export function partPass(part: Pick<PartRow, "id">, events: readonly EventRow[]): DrawnPass {
  return {
    step: { partId: part.id, entryId: "", pass: 1, passes: 1, fromBar: null, toBar: null, sections: [], visits: [] },
    events,
  };
}
