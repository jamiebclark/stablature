import type { DrawnPass } from "@/lib/arrangement/passes";
import type { EventRow } from "@/lib/model";
import { DURATIONS, TICKS_PER_BEAT } from "../durations";

let n = 0;
export function ev(over: Partial<EventRow>): EventRow {
  n += 1;
  return {
    id: `e${n}`, bandId: "b", partId: "p", rank: `a${String(n).padStart(6, "0")}`, kind: "notes",
    frets: { "0": 1 }, techniques: {}, repeat: 1, durationHint: "q", tupletId: null, tupletCount: null,
    groupKind: null, updatedAt: "x", deletedAt: null, fieldClocks: {}, serverSeq: 0, ...over,
  } as EventRow;
}
export const bar = () => ev({ kind: "barline", frets: {}, durationHint: null });
export const dur = (id: string) => DURATIONS.find((d) => d.id === id)!.ticks;
export const beats = (x: number) => Math.round(x * TICKS_PER_BEAT);
export const pass = (events: EventRow[]): DrawnPass =>
  ({ step: { partId: "p", fromBar: null, toBar: null } as unknown as DrawnPass["step"], events });
/** `size` columns of `d` in one group. */
export function group(id: string, size: number, d: string, over: Partial<EventRow> = {}): EventRow[] {
  return Array.from({ length: size }, () => ev({ durationHint: d as never, tupletId: id, tupletCount: size, groupKind: "tuplet", ...over }));
}
export const quarters = (k: number) => Array.from({ length: k }, () => ev({}));
