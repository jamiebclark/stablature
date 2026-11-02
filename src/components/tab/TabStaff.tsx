"use client";

/**
 * A part, drawn as tab.
 *
 * Shares `layoutPart` with the ASCII serialiser, so what you see here and what
 * gets exported or pasted into a chat cannot disagree -- and the exact-string
 * tests over the ASCII output are therefore tests of this component's layout
 * too.
 *
 * Strings are drawn as lines with the fret numbers masking them (see
 * globals.css) rather than as rows of dashes, which is what makes it read as
 * tab rather than as a terminal.
 */

import { Fragment, useEffect, useMemo, useRef } from "react";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { layoutPart, tupletSpans, type Density } from "@/lib/tab/layout";
import type { Tuning } from "@/lib/tunings";

export interface TabStaffProps {
  events: readonly EventRow[];
  tuning: Tuning;
  annotations?: readonly AnnotationRow[];
  density?: Density;
  /** Highlights a column and keeps it in view -- used during capture. */
  activeEventId?: string | null;
  /**
   * Draws an insertion caret. `null` puts it before the first column, an id
   * puts it after that event's last rendered column, and leaving it undefined
   * draws none -- which is what the read-only views want.
   *
   * Separate from `activeEventId` because they answer different questions:
   * the rule under a column says which one the controls act on, the caret says
   * where the next note goes.
   */
  insertAfterEventId?: string | null;
  onSelectColumn?: (eventId: string) => void;
  /** Keeps the right-hand edge in view as columns are appended. */
  followTail?: boolean;
  /** Raised surfaces need the fret-number mask to match their background. */
  surface?: "base" | "raised";
}

export function TabStaff({
  events,
  tuning,
  annotations = [],
  density = "expanded",
  activeEventId = null,
  insertAfterEventId,
  onSelectColumn,
  followTail = false,
  surface = "base",
}: TabStaffProps) {
  const layout = useMemo(
    () => layoutPart({ events, tuning, annotations, density }),
    [events, tuning, annotations, density],
  );
  const spans = useMemo(() => tupletSpans(layout), [layout]);

  const scroller = useRef<HTMLDivElement>(null);
  const columnCount = layout.columns.length;

  useEffect(() => {
    if (!followTail) return;
    const el = scroller.current;
    if (!el) return;
    // Capture appends to the right, so the newest column is the one that
    // matters. Jumping to the end beats asking the user to chase it.
    el.scrollLeft = el.scrollWidth;
  }, [followTail, columnCount]);

  const hasChords = layout.columns.some((column) => column.chord !== null);
  const hasTuplets = spans.length > 0;

  const showCaret = insertAfterEventId !== undefined;
  /*
   * A repeated column renders as several columns from one event, so the caret
   * belongs after the LAST of them -- otherwise inserting after a x4 would
   * appear to drop the note into the middle of it.
   */
  const caretAfterIndex = insertAfterEventId
    ? layout.columns.findLastIndex((column) => column.eventId === insertAfterEventId)
    : -1;

  /** Which tuplet span, if any, a column sits in -- for drawing the bracket. */
  const spanAt = (index: number) =>
    spans.find((span) => index >= span.start && index <= span.end);

  return (
    <div className="tab-staff" data-surface={surface} data-testid="tab-staff">
      <div className="flex items-stretch gap-1">
        {/* String labels stay put while the staff scrolls. */}
        <div
          className="shrink-0 pr-1 text-right text-xs text-text-dim"
          style={{ paddingTop: offsetFor(hasChords, hasTuplets) }}
          aria-hidden
        >
          {layout.stringLabels.map((label, index) => (
            <div key={index} className="tab-cell justify-end">
              <span className="bg-transparent px-0">{label}</span>
            </div>
          ))}
        </div>

        <div
          ref={scroller}
          className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden"
          role="group"
          aria-label="Tablature"
        >
          <div className="flex w-max items-stretch">
            {showCaret && insertAfterEventId === null ? (
              <Caret
                stringCount={layout.stringCount}
                offset={offsetFor(hasChords, hasTuplets)}
              />
            ) : null}

            {layout.columns.length === 0 ? (
              <EmptyStaff
                stringCount={layout.stringCount}
                offset={offsetFor(hasChords, hasTuplets)}
              />
            ) : (
              layout.columns.map((column, index) => {
                const span = spanAt(index);
                return (
                  <Fragment key={`${column.eventId}-${column.repetition}`}>
                  <Column
                    cells={column.cells}
                    width={column.width}
                    chord={column.chord}
                    barline={column.kind === "barline"}
                    active={column.eventId === activeEventId}
                    showChordRow={hasChords}
                    showTupletRow={hasTuplets}
                    tuplet={
                      span
                        ? {
                            count: span.count,
                            start: index === span.start,
                            end: index === span.end,
                            // Centred over the middle column of the span. On
                            // the first one it sits above the opening note
                            // rather than above the bracket it labels.
                            labelled: index === Math.floor((span.start + span.end) / 2),
                          }
                        : null
                    }
                    onSelect={onSelectColumn ? () => onSelectColumn(column.eventId) : undefined}
                  />
                  {showCaret && caretAfterIndex === index ? (
                    <Caret
                      stringCount={layout.stringCount}
                      offset={offsetFor(hasChords, hasTuplets)}
                    />
                  ) : null}
                  </Fragment>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Height of the rows drawn above the staff, so the labels line up with it. */
function offsetFor(hasChords: boolean, hasTuplets: boolean): string {
  const rows = (hasChords ? 1 : 0) + (hasTuplets ? 1 : 0);
  return `${rows * 1.1}rem`;
}

interface ColumnProps {
  cells: (string | null)[];
  width: number;
  chord: string | null;
  barline: boolean;
  active: boolean;
  showChordRow: boolean;
  showTupletRow: boolean;
  tuplet: { count: number; start: boolean; end: boolean; labelled: boolean } | null;
  onSelect?: () => void;
}

function Column({
  cells,
  width,
  chord,
  barline,
  active,
  showChordRow,
  showTupletRow,
  tuplet,
  onSelect,
}: ColumnProps) {
  // Sized in `ch` so a two-digit fret gets twice the room and the staff stays
  // aligned, exactly as in the ASCII output.
  const style = { width: `calc(${width}ch + 0.6rem)` };

  const body = (
    <>
      {showChordRow ? (
        <div className="h-[1.1rem] truncate text-[0.7rem] font-semibold text-accent">
          {chord}
        </div>
      ) : null}

      {showTupletRow ? (
        <div className="relative h-[1.1rem]">
          {tuplet ? (
            <div
              className="absolute inset-x-0 bottom-[0.2rem] border-t border-text-faint"
              style={{
                borderLeftWidth: tuplet.start ? 1 : 0,
                borderRightWidth: tuplet.end ? 1 : 0,
                borderLeftColor: "var(--text-faint)",
                borderRightColor: "var(--text-faint)",
                borderLeftStyle: "solid",
                borderRightStyle: "solid",
                height: "0.3rem",
              }}
            />
          ) : null}
          {tuplet?.labelled ? (
            <div className="absolute inset-x-0 top-0 text-center text-[0.65rem] leading-[0.9rem] text-text-faint">
              {tuplet.count}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className={barline ? "tab-barline" : undefined}>
        {cells.map((text, index) => (
          <div key={index} className="tab-cell">
            {barline ? null : text === null ? null : <span>{text}</span>}
          </div>
        ))}
      </div>
    </>
  );

  if (!onSelect) {
    return (
      <div
        style={style}
        className={active ? "tab-column-active" : undefined}
        data-testid="tab-column"
        data-barline={barline ? "true" : undefined}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      className={`text-left ${active ? "tab-column-active" : "hover:bg-bg-raised"}`}
      data-testid="tab-column"
      data-barline={barline ? "true" : undefined}
      aria-label={describe(cells, barline)}
      aria-current={active ? "true" : undefined}
    >
      {body}
    </button>
  );
}

/** The insertion point: where the next tap puts a note. */
function Caret({ stringCount, offset }: { stringCount: number; offset: string }) {
  return (
    <div className="relative w-0.5 shrink-0" data-testid="tab-caret" aria-hidden>
      <div style={{ paddingTop: offset }}>
        <div
          className="w-0.5 rounded-full bg-accent"
          style={{ height: `calc(var(--string-height) * ${stringCount})` }}
        />
      </div>
    </div>
  );
}

function EmptyStaff({ stringCount, offset }: { stringCount: number; offset: string }) {
  return (
    <div style={{ paddingTop: offset, width: "6ch" }}>
      {Array.from({ length: stringCount }, (_, index) => (
        <div key={index} className="tab-cell" />
      ))}
    </div>
  );
}

/** Screen-reader description of a column, read when stepping through a part. */
function describe(cells: (string | null)[], barline: boolean): string {
  if (barline) return "Barline";
  const played = cells
    .map((text, index) => (text === null ? null : `string ${index + 1} fret ${text}`))
    .filter(Boolean);
  return played.length === 0 ? "Empty column" : played.join(", ");
}
