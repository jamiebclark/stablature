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
import type { CSSProperties, ReactNode } from "react";
import type { AnnotationRow, EventRow } from "@/lib/model";
import { layoutPart, tupletSpans, type Density } from "@/lib/tab/layout";
import type { Tuning } from "@/lib/tunings";
import { useLongPress } from "@/components/capture/useLongPress";

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
  /** Events in the current selection, drawn as a band behind the staff. */
  selectedEventIds?: ReadonlySet<string>;
  onSelectColumn?: (eventId: string) => void;
  /** Long-press on a column. When absent, no press handlers are attached at all. */
  onInspectColumn?: (eventId: string) => void;
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
  selectedEventIds,
  onSelectColumn,
  onInspectColumn,
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
  // Drawn width: the widest cells plus any connector gaps, so a widened tail
  // (a decorated note, a new connector) stays in view too.
  const drawnWidth = layout.columns.reduce(
    (total, column) => total + column.width + (column.connectors.some(Boolean) ? 1 : 0),
    0,
  );

  useEffect(() => {
    if (!followTail) return;
    const el = scroller.current;
    if (!el) return;
    // Capture appends to the right, so the newest column is the one that
    // matters. Jumping to the end beats asking the user to chase it.
    el.scrollLeft = el.scrollWidth;
  }, [followTail, columnCount, drawnWidth]);

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
                const previous = layout.columns[index - 1];
                return (
                  <Fragment key={`${column.eventId}-${column.repetition}`}>
                  {column.connectors.some(Boolean) ? (
                    <Gap
                      connectors={column.connectors}
                      showChordRow={hasChords}
                      showTupletRow={hasTuplets}
                      bracket={!!span && !!previous && spanAt(index - 1) === span}
                      selected={selectedEventIds?.has(column.eventId) ?? false}
                      active={
                        column.eventId === activeEventId && previous?.eventId === column.eventId
                      }
                    />
                  ) : null}
                  <Column
                    label={column.description}
                    cells={column.cells}
                    width={column.width}
                    chord={column.chord}
                    barline={column.kind === "barline"}
                    active={column.eventId === activeEventId}
                    selected={selectedEventIds?.has(column.eventId) ?? false}
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
                    onInspect={onInspectColumn ? () => onInspectColumn(column.eventId) : undefined}
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
  label: string;
  cells: (string | null)[];
  width: number;
  chord: string | null;
  barline: boolean;
  active: boolean;
  selected: boolean;
  showChordRow: boolean;
  showTupletRow: boolean;
  tuplet: { count: number | null; start: boolean; end: boolean; labelled: boolean } | null;
  onSelect?: () => void;
  onInspect?: () => void;
}

function Column({
  label,
  cells,
  width,
  chord,
  barline,
  active,
  selected,
  showChordRow,
  showTupletRow,
  tuplet,
  onSelect,
  onInspect,
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
              className="tab-bracket absolute inset-x-0 bottom-[0.2rem] border-t"
              data-testid="tab-bracket"
              data-start={tuplet.start ? "" : undefined}
              style={{
                borderLeftWidth: tuplet.start ? 1 : 0,
                borderRightWidth: tuplet.end ? 1 : 0,
                borderLeftStyle: "solid",
                borderRightStyle: "solid",
                height: "0.3rem",
              }}
            />
          ) : null}
          {tuplet?.labelled && tuplet.count !== null ? (
            <div className="tab-bracket-label absolute inset-x-0 top-0 text-center text-[0.65rem] leading-[0.9rem]">
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
        className={columnClass(active, selected)}
        data-testid="tab-column"
        data-selected={selected ? "true" : undefined}
        data-barline={barline ? "true" : undefined}
        role="img"
        aria-label={label}
      >
        {body}
      </div>
    );
  }

  const className = `text-left ${columnClass(active, selected) ?? "hover:bg-bg-raised"}`;

  if (onInspect) {
    return (
      <InspectableColumn
        style={style}
        className={className}
        onSelect={onSelect}
        onInspect={onInspect}
        selected={selected}
        barline={barline}
        active={active}
        label={label}
      >
        {body}
      </InspectableColumn>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      className={className}
      data-testid="tab-column"
      data-selected={selected ? "true" : undefined}
      data-barline={barline ? "true" : undefined}
      aria-label={label}
      aria-current={active ? "true" : undefined}
    >
      {body}
    </button>
  );
}

/** The hook lives here so columns without `onInspect` carry no press machinery. */
function InspectableColumn({
  style,
  className,
  onSelect,
  onInspect,
  selected,
  barline,
  active,
  label,
  children,
}: {
  style: CSSProperties;
  className: string;
  onSelect: () => void;
  onInspect: () => void;
  selected: boolean;
  barline: boolean;
  active: boolean;
  label: string;
  children: ReactNode;
}) {
  const press = useLongPress({ onLongPress: onInspect });
  return (
    <button
      type="button"
      onClick={(event) => {
        if (press.consumeSuppressedClick(event)) return;
        onSelect();
      }}
      onPointerDown={press.onPointerDown}
      onPointerMove={press.onPointerMove}
      onPointerUp={press.onPointerUp}
      onPointerCancel={press.onPointerCancel}
      onContextMenu={press.onContextMenu}
      onKeyDown={(event) => {
        if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
          event.preventDefault();
          onInspect();
        }
      }}
      aria-keyshortcuts="Shift+F10"
      aria-haspopup="dialog"
      style={style}
      className={`select-none ${className}`}
      data-testid="tab-column"
      data-selected={selected ? "true" : undefined}
      data-barline={barline ? "true" : undefined}
      aria-label={label}
      aria-current={active ? "true" : undefined}
    >
      {children}
    </button>
  );
}

/**
 * The one character between two columns. Decorative: the arriving column's
 * label already says what the connector means, so this is hidden from
 * assistive tech and takes no input.
 */
function Gap({
  connectors,
  showChordRow,
  showTupletRow,
  bracket,
  selected,
  active,
}: {
  connectors: (string | null)[];
  showChordRow: boolean;
  showTupletRow: boolean;
  bracket: boolean;
  selected: boolean;
  active: boolean;
}) {
  return (
    <div
      style={{ width: "1ch" }}
      className={`tab-connector shrink-0 ${columnClass(active, selected) ?? ""}`.trim()}
      data-testid="tab-connector"
      aria-hidden
    >
      {showChordRow ? <div className="h-[1.1rem]" /> : null}
      {showTupletRow ? (
        <div className="relative h-[1.1rem]">
          {bracket ? (
            <div
              className="tab-bracket absolute inset-x-0 bottom-[0.2rem] border-t"
              style={{ height: "0.3rem" }}
            />
          ) : null}
        </div>
      ) : null}
      <div>
        {connectors.map((glyph, index) => (
          <div key={index} className="tab-cell">
            {glyph ? <span>{glyph}</span> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function columnClass(active: boolean, selected: boolean): string | undefined {
  const classes = [selected ? "tab-column-selected" : null, active ? "tab-column-active" : null]
    .filter(Boolean)
    .join(" ");
  return classes || undefined;
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
