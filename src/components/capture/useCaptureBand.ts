"use client";

/**
 * The capture band's mode and anchoring (specs/008-usability-polish/contracts/capture-band.md §2).
 *
 * Wraps when two whole lines fit, and then keeps the cursor's line at the bottom of the band. It
 * anchors on exactly three renders: a request that needs no write, the render that delivers the
 * request's own write, and a resize or mode change. A request ends there, or when a Still calls
 * `spend`; it is never left for a later, unrelated change to spend, so a sync arrival moves nothing.
 *
 * Delivery is not inferred from what changed. The caller passes the write's promise through
 * `deliver`, with a signature of the rows as committed after it; the request ends on the render whose
 * rows have that signature. A write that changed nothing is delivered at once, because the rows
 * already match. Reads layout only inside effects, never on a fret tap's path.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { anchorFor, bandWraps } from "@/lib/capture/band";

interface Measure {
  band: number;
  line: number;
  gap: number;
}

function measure(band: HTMLElement): Measure {
  const style = getComputedStyle(band);
  const pad = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  const column = band.querySelector<HTMLElement>('[data-testid="tab-column"]');
  return {
    band: band.clientHeight - pad,
    line: column ? column.getBoundingClientRect().height : 0,
    gap: parseFloat(style.rowGap) || 0,
  };
}

/** The run that holds the caret, or while a selection hides it, the run of the active column. */
function cursorRun(staff: HTMLElement): HTMLElement | null {
  const mark =
    staff.querySelector('[data-testid="tab-caret"]') ??
    staff.querySelector('[aria-current="true"]');
  return mark?.closest<HTMLElement>(".tab-bar-run") ?? null;
}

/** One signature for what the screen shows of a part, so "rendered" and "committed" compare by value. */
export function contentSignature(events: unknown, annotations: unknown): string {
  return JSON.stringify([events ?? null, annotations ?? null]);
}

/** What a request waits for: nothing, its own write, or a part's columns to load. */
export type AnchorWait = "now" | "write" | "load";
export interface AnchorRequest {
  id: number;
  wait: AnchorWait;
}

interface Pending {
  id: number;
  wait: AnchorWait;
  /** The columns at the request: "load" ends when others than these are shown. */
  from: unknown;
  /** The committed signature, once the write has resolved and been read back. */
  committed: string | null;
  done: boolean;
}

export function useCaptureBand(opts: {
  /** The part's columns; undefined while loading. */
  content: unknown;
  /** The part's annotations, so a write that changes only one is still seen. */
  annotations: unknown;
  /** Set by CaptureScreen at each trigger. */
  request: AnchorRequest;
}): {
  bandRef: RefObject<HTMLDivElement | null>;
  wrapped: boolean;
  /** Applied as the band child's padding-top in wrapped mode. 0 otherwise. */
  runway: number;
  /** Counts the times wrapped mode was left, so the one-line scroller can be told to show the caret. */
  leftWrapped: number;
  /** Called by every Still (tap, select, extend, cancel, long press): an outstanding request ends. */
  spend: () => void;
  /** Called when request `id`'s write has resolved, with the signature of the rows read back after it. */
  deliver: (id: number, committed: string) => void;
} {
  const { content, annotations, request } = opts;
  const bandRef = useRef<HTMLDivElement | null>(null);
  const [wrapped, setWrapped] = useState(false);
  const [runway, setRunway] = useState(0);
  const [leftWrapped, setLeftWrapped] = useState(0);
  const [size, setSize] = useState("");
  /** What decides the mode besides the band: a drawn column's height, and the gap. */
  const [metrics, setMetrics] = useState("");
  const [deliveries, setDeliveries] = useState(0);

  const pending = useRef<Pending | null>(null);
  const seen = useRef<{ request: number; wrapped: boolean; size: string } | null>(null);
  const spend = useCallback(() => {
    if (pending.current) pending.current.done = true;
  }, []);
  const deliver = useCallback((id: number, committed: string) => {
    if (pending.current?.id !== id) return;
    pending.current.committed = committed;
    setDeliveries((n) => n + 1);
  }, []);

  // The band mounts after the song loads, so this checks on each commit which elements it watches.
  const watched = useRef<{
    band: HTMLElement;
    column: Element | null;
    watch: ResizeObserver;
  } | null>(null);
  useEffect(() => {
    const band = bandRef.current;
    const column = band?.querySelector('[data-testid="tab-column"]') ?? null;
    if (watched.current?.band === band && watched.current.column === column) return;
    watched.current?.watch.disconnect();
    watched.current = null;
    if (!band || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(() => {
      setSize(`${band.clientWidth}x${band.clientHeight}`);
      const m = measure(band);
      setMetrics(`${m.line}|${m.gap}`);
    });
    watch.observe(band);
    if (column) watch.observe(column);
    watched.current = { band, column, watch };
  });
  useEffect(() => () => watched.current?.watch.disconnect(), []);

  // The mode is re-decided whenever any of bandLines's three inputs may have changed.
  useLayoutEffect(() => {
    const band = bandRef.current;
    if (!band) return;
    const m = measure(band);
    const next = bandWraps(m.band, m.line, m.gap);
    if (next !== wrapped) {
      setWrapped(next);
      if (!next) setLeftWrapped((n) => n + 1);
    }
  }, [content, annotations, size, metrics, wrapped]);

  useLayoutEffect(() => {
    const prev = seen.current;
    seen.current = { request: request.id, wrapped, size };
    let anchorNow = false;
    if (!prev || prev.request !== request.id) {
      const wait: AnchorWait = !prev && content === undefined ? "load" : request.wait;
      pending.current = { id: request.id, wait, from: content, committed: null, done: false };
      if (wait === "now") {
        anchorNow = true;
        pending.current.done = true;
      }
    }
    const p = pending.current;
    let delivered = false;
    if (p && !p.done) {
      if (p.wait === "load" && content !== undefined && content !== p.from) delivered = true;
      if (
        p.wait === "write" &&
        p.committed !== null &&
        contentSignature(content, annotations) === p.committed
      )
        delivered = true;
      if (delivered) p.done = true;
    }
    const resized = !!prev && (prev.wrapped !== wrapped || prev.size !== size);
    if (!wrapped) return;
    if (!(anchorNow || resized || delivered)) return;
    const band = bandRef.current;
    const holder = band?.firstElementChild as HTMLElement | null;
    const staff = holder?.querySelector<HTMLElement>('[data-testid="tab-staff"]');
    if (!band || !holder || !staff) return;
    const run = cursorRun(staff) ?? staff.querySelector<HTMLElement>(".tab-bar-run:last-child");
    if (!run) return;
    const m = measure(band);
    const staffBox = staff.getBoundingClientRect();
    const runBox = run.getBoundingClientRect();
    const { runway: needed } = anchorFor({
      band: m.band,
      contentHeight: staffBox.height,
      lineBottom: runBox.bottom - staffBox.top,
    });
    // The runway must be in the DOM before the move is measured, so it is written here and mirrored in state.
    // eslint-disable-next-line react-hooks/immutability
    holder.style.paddingTop = `${needed}px`;
    // Content grows upward from the origin, so the runway moves nothing on screen; measure after it.
    const bandBottom = band.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(band).paddingBottom) || 0);
    const delta = run.getBoundingClientRect().bottom - bandBottom;
    if (Math.abs(delta) >= 0.5) band.scrollBy({ top: delta });
    if (needed !== runway) setRunway(needed);
  }, [request, content, annotations, wrapped, size, runway, deliveries]);

  return { bandRef, wrapped, runway: wrapped ? runway : 0, leftWrapped, spend, deliver };
}
