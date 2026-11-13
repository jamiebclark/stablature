"use client";

/**
 * A part, drawn as tab.
 *
 * Shares `layoutPart` with the ASCII serialiser, so what you see here and what
 * gets exported or pasted into a chat cannot disagree -- and the exact-string
 * tests over the ASCII output are therefore tests of this component's layout
 * too.
 *
 * What is exported is what you see in fret numbers. A reader's view (note names, intervals) is a different
 * writer into the same builder, passed as `reading`; capture and the paste preview pass nothing and draw
 * exactly as before. This file never imports techniques.
 *
 * Strings are drawn as lines with the fret numbers masking them (see
 * globals.css) rather than as rows of dashes, which is what makes it read as
 * tab rather than as a terminal.
 */

import { Fragment, useEffect, useMemo, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { AnnotationRow, EventRow } from "@/lib/model";
import {
  layoutPart,
  tupletSpans,
  type Density,
  type TabLayout,
} from "@/lib/tab/layout";
import {
  barRuns,
  barStarts,
  chordRooms,
  type ChordRoom,
} from "@/lib/reading/staff";
import { layoutReading, type ReadingLayout } from "@/lib/reading/labels";
import type { StaffView } from "@/lib/reading/view";
import type { ColumnMark, StaffMarks } from "@/lib/reading/marks";
import type { Tuning } from "@/lib/tunings";
import { barPositions } from "@/lib/rhythm/notation";
import { groupLabels, rhythmMarks, type RhythmMark } from "@/lib/rhythm/beams";
import { RhythmCell } from "./RhythmCell";
import { useLongPress } from "@/components/capture/useLongPress";

export interface StaffReading {
  view: StaffView;
  /** Every event of the part, for the chord in force. */
  partEvents: readonly EventRow[];
  /** What a variant changed against its parent. Drawn in either view. */
  marks?: StaffMarks | null;
}

/** What the caption says, from how many named cells had a chord to read against. */
function captionFor(
  view: StaffView,
  cover: ReadingLayout["chordCover"],
): string | null {
  if (view === "notes") return "Note names";
  if (view !== "intervals") return null;
  switch (cover) {
    case "all":
      return "Intervals from the chord in force";
    case "some":
      return "Intervals, and note names where no chord";
    case "none":
      return "Note names: no chords to read against";
    default:
      return "Intervals";
  }
}

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
  /** Draws a duration mark row under the strings. Off for capture and export. */
  showRhythm?: boolean;
  /** A reading view. Absent, or frets, draws the fret numbers as always. */
  reading?: StaffReading;
  /**
   * Bumped by the caller just before a write that makes a group. The next
   * group to appear is scrolled into view; arrivals with no bump (sync, a part
   * change) move nothing.
   */
  revealGroups?: number;
  /** Bumped by the caller when a key moved the cursor: the caret is then scrolled into view. A tap moves nothing. */
  keepCaretInView?: number;
  /** Draws a bar number row. `offset` is added to each column's `barNumber`. Off for capture and the paste preview. */
  barNumbers?: { offset: number };
  /** Breaks at barlines across as many lines as it needs. The play view and capture; the wrapped markup is drawn there. */
  wrap?: boolean;
  /** Which pass this is, written on the wrapper for the reading position. */
  pass?: number;
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
  showRhythm = false,
  reading,
  revealGroups = 0,
  keepCaretInView = 0,
  barNumbers,
  wrap = false,
  pass,
}: TabStaffProps) {
  const readingView = reading && reading.view !== "frets" ? reading.view : null;
  const partEvents = reading?.partEvents;
  const layout: TabLayout | ReadingLayout = useMemo(
    () =>
      readingView && partEvents
        ? layoutReading({
            view: readingView,
            events,
            partEvents,
            tuning,
            annotations,
            density,
          })
        : layoutPart({ events, tuning, annotations, density }),
    [events, tuning, annotations, density, readingView, partEvents],
  );
  const caption =
    readingView && "chordCover" in layout
      ? captionFor(readingView, (layout as ReadingLayout).chordCover)
      : null;
  const spans = useMemo(() => tupletSpans(layout), [layout]);

  const scroller = useRef<HTMLDivElement>(null);
  const wrappedRoot = useRef<HTMLDivElement>(null);
  const drawnGroups = useRef<Set<string> | null>(null);
  const revealed = useRef(revealGroups);
  const kept = useRef(keepCaretInView);
  const columnCount = layout.columns.length;
  // Drawn width: the widest cells plus any connector gaps, so a widened tail
  // (a decorated note, a new connector) stays in view too.
  const drawnWidth = layout.columns.reduce(
    (total, column) =>
      total + column.width + (column.connectors.some(Boolean) ? 1 : 0),
    0,
  );

  useEffect(() => {
    if (!followTail) return;
    if (wrap) {
      // Wrapped, each line scrolls on its own: the newest column is on the last run.
      const runsEls = wrappedRoot.current?.querySelectorAll<HTMLElement>(".tab-bar-run");
      const last = runsEls?.[runsEls.length - 1];
      if (last) last.scrollLeft = last.scrollWidth;
      return;
    }
    const el = scroller.current;
    if (!el) return;
    // Capture appends to the right, so the newest column is the one that
    // matters. Jumping to the end beats asking the user to chase it.
    el.scrollLeft = el.scrollWidth;
  }, [followTail, columnCount, drawnWidth, wrap]);

  useEffect(() => {
    const ids = new Set(spans.map((span) => span.tupletId));
    const before = drawnGroups.current;
    drawnGroups.current = ids;
    if (!before || revealGroups === revealed.current) return;
    const fresh = spans.find((span) => !before.has(span.tupletId));
    if (!fresh) return;
    revealed.current = revealGroups;
    // Markup is pinned by the frets baseline, so find the bracket by order rather than by an id attribute.
    const el = (wrap ? wrappedRoot.current : scroller.current)?.querySelectorAll(
      "[data-start]",
    )[spans.indexOf(fresh)];
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [spans, revealGroups, wrap]);

  useEffect(() => {
    if (keepCaretInView === kept.current) return;
    kept.current = keepCaretInView;
    if (wrap) {
      // Horizontal only: the band owns vertical movement. Move the caret's own line, nothing above it.
      const caret = wrappedRoot.current?.querySelector<HTMLElement>('[data-testid="tab-caret"]');
      const run = caret?.closest<HTMLElement>(".tab-bar-run");
      if (!caret || !run) return;
      const at = caret.getBoundingClientRect().left;
      const box = run.getBoundingClientRect();
      if (at < box.left) run.scrollLeft -= box.left - at + 8;
      else if (at > box.right) run.scrollLeft += at - box.right + 8;
      return;
    }
    scroller.current
      ?.querySelector('[data-testid="tab-caret"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [keepCaretInView, insertAfterEventId, wrap]);

  const rooms = useMemo(() => chordRooms(layout.columns), [layout]);
  const starts = useMemo(() => barStarts(layout.columns), [layout]);
  const runs = useMemo(
    () => (wrap ? barRuns(layout.columns) : []),
    [wrap, layout],
  );
  const hasBarRow = !!barNumbers && layout.columns.length > 0;
  const hasChords = layout.columns.some((column) => column.chord !== null);
  const hasRhythm =
    showRhythm && layout.columns.some((column) => column.duration !== null);
  // The one place a group's bracket and number go: under the tab with the rhythm, above it as ever without.
  const bracketRow: "above" | "under" = hasRhythm ? "under" : "above";
  // Whether a row above the cells is drawn for them; the offset, gutter, caret and gaps all read this.
  const hasTuplets = bracketRow === "above" && spans.length > 0;
  const labels = useMemo(() => groupLabels(spans), [spans]);
  const marks = reading?.marks && reading.marks.any ? reading.marks : null;
  // One position map for both densities, so a compact repeat and its expansion read the same beats.
  const rhythm = useMemo(
    () => (hasRhythm ? rhythmMarks(layout.columns, barPositions(events), density) : null),
    [hasRhythm, layout, events, density],
  );

  const showCaret = insertAfterEventId !== undefined;
  /*
   * A repeated column renders as several columns from one event, so the caret
   * belongs after the LAST of them -- otherwise inserting after a x4 would
   * appear to drop the note into the middle of it.
   */
  const caretAfterIndex = insertAfterEventId
    ? layout.columns.findLastIndex(
        (column) => column.eventId === insertAfterEventId,
      )
    : -1;

  /** Which tuplet span, if any, a column sits in -- for drawing the bracket. */
  const spanAt = (index: number) =>
    spans.find((span) => index >= span.start && index <= span.end);

  // A removal after the last column is still inside its group when the group counts more than it holds.
  const lastSpan = spanAt(layout.columns.length - 1);
  const endsInOpenGroup =
    !!lastSpan &&
    lastSpan.count !== null &&
    lastSpan.count > lastSpan.end - lastSpan.start + 1;

  const renderColumn = (
    column: TabLayout["columns"][number],
    index: number,
  ) => {
    const span = spanAt(index);
    const previous = layout.columns[index - 1];
    const key = `${column.eventId}-${column.repetition}`;
    const removed = marks?.removals.get(key) ?? 0;
    const mark = marks?.columns.get(key);
    const own = rhythm?.[index] ?? null;
    const arriving = own?.kind === "note" ? own.left : 0;
    return (
      <Fragment key={key}>
        {marks && removed > 0 ? (
          <RemovalGap
            count={removed}
            parent={marks.parentLabel}
            showBarRow={hasBarRow}
            showChordRow={hasChords}
            showTupletRow={hasTuplets}
            showRhythmRow={hasRhythm}
            stringCount={layout.stringCount}
            beams={arriving}
            bracket={!!span && !!previous && spanAt(index - 1) === span}
            bracketUnder={bracketRow === "under"}
          />
        ) : null}
        {column.connectors.some(Boolean) ? (
          <Gap
            connectors={column.connectors}
            showBarRow={hasBarRow}
            showChordRow={hasChords}
            showTupletRow={hasTuplets}
            showRhythmRow={hasRhythm}
            beams={arriving}
            bracket={!!span && !!previous && spanAt(index - 1) === span}
            bracketUnder={bracketRow === "under"}
            selected={selectedEventIds?.has(column.eventId) ?? false}
            active={
              column.eventId === activeEventId &&
              previous?.eventId === column.eventId
            }
          />
        ) : null}
        <Column
          label={column.description}
          cells={column.cells}
          width={columnWidth(column.width, rooms.get(index))}
          wrap={wrap}
          columnKey={key}
          barNumber={
            hasBarRow
              ? starts.has(index)
                ? column.barNumber + barNumbers.offset
                : null
              : undefined
          }
          chord={column.chord}
          barline={column.kind === "barline"}
          active={column.eventId === activeEventId}
          selected={selectedEventIds?.has(column.eventId) ?? false}
          showChordRow={hasChords}
          showTupletRow={hasTuplets}
          rhythm={own ?? (hasRhythm ? { kind: "none" } : null)}
          diff={marks ? { mark, parent: marks.parentLabel } : null}
          tuplet={
            span
              ? {
                  count: span.count,
                  start: index === span.start,
                  end: index === span.end,
                  // The number is drawn once per group id, centred on its middle column.
                  labelled: labels.get(span.tupletId) === index,
                }
              : null
          }
          bracketUnder={bracketRow === "under"}
          onSelect={
            onSelectColumn ? () => onSelectColumn(column.eventId) : undefined
          }
          onInspect={
            onInspectColumn ? () => onInspectColumn(column.eventId) : undefined
          }
        />
        {showCaret && caretAfterIndex === index ? (
          <Caret
            stringCount={layout.stringCount}
            offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
            inline={!wrap}
          />
        ) : null}
      </Fragment>
    );
  };
  const endRemoval =
    marks && marks.removedAtEnd > 0 ? (
      <RemovalGap
        count={marks.removedAtEnd}
        parent={marks.parentLabel}
        showBarRow={hasBarRow}
        showChordRow={hasChords}
        showTupletRow={hasTuplets}
        showRhythmRow={hasRhythm}
        stringCount={layout.stringCount}
        beams={0}
        bracket={endsInOpenGroup}
        bracketUnder={bracketRow === "under"}
      />
    ) : null;

  if (wrap) {
    const labelRows = (
      <>
        {hasBarRow ? <div className="h-[var(--staff-row)]" /> : null}
        {hasChords ? <div className="h-[var(--staff-row)]" /> : null}
        {hasTuplets ? <div className="h-[var(--staff-row)]" /> : null}
        {layout.stringLabels.map((label, index) => (
          <div
            key={index}
            className="tab-cell justify-end pr-1 text-right text-xs text-text-dim"
          >
            <span className="bg-transparent px-0">{label}</span>
          </div>
        ))}
        {hasRhythm ? <div className="h-[var(--rhythm-row)]" /> : null}
        {marks ? <div className="tab-diff-mark" /> : null}
      </>
    );
    // A line holds one or more bars, but in print a bar wider than the page wraps onto more lines, so the
    // gutter carries spare blocks for those; the surplus is clipped.
    const blocks = Math.max(runs.length, 1) + Math.min(layout.columns.length, 40);
    return (
      <div
        ref={wrappedRoot}
        className="tab-staff tab-staff-wrapped"
        data-surface={surface}
        data-testid="tab-staff"
        data-pass={pass}
        data-rhythm={hasRhythm ? "" : undefined}
      >
        <div className="tab-wrapped-body">
          <div className="tab-gutter" aria-hidden>
            {Array.from({ length: blocks }, (_, index) => (
              <div key={index} className="tab-gutter-block">
                {labelRows}
              </div>
            ))}
          </div>
          <div className="tab-lines" role="group" aria-label="Tablature">
            {layout.columns.length === 0 ? (
              <div className="tab-bar-run">
                {showCaret && insertAfterEventId === null ? (
                  <Caret
                    stringCount={layout.stringCount}
                    offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
                    inline={false}
                  />
                ) : null}
                <EmptyStaff
                  stringCount={layout.stringCount}
                  offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
                />
              </div>
            ) : (
              runs.map((run, runIndex) => (
                <div key={run.start} className="tab-bar-run">
                  {runIndex === 0 && showCaret && insertAfterEventId === null ? (
                    <Caret
                      stringCount={layout.stringCount}
                      offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
                      inline={false}
                    />
                  ) : null}
                  {layout.columns
                    .slice(run.start, run.end + 1)
                    .map((column, offset) =>
                      renderColumn(column, run.start + offset),
                    )}
                  {runIndex === runs.length - 1 ? endRemoval : null}
                </div>
              ))
            )}
            <div className="tab-lines-end" />
          </div>
        </div>
        {caption ? (
          <p
            data-testid="staff-caption"
            className="absolute bottom-0 right-3 whitespace-nowrap text-[0.65rem] leading-3 text-text-dim"
          >
            {caption}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="tab-staff"
      data-surface={surface}
      data-testid="tab-staff"
      data-pass={pass}
      data-rhythm={hasRhythm ? "" : undefined}
    >
      <div className="flex items-stretch gap-1">
        {/* String labels stay put while the staff scrolls. */}
        <div
          className="shrink-0 pr-1 text-right text-xs text-text-dim"
          style={{ paddingTop: offsetFor(hasBarRow, hasChords, hasTuplets) }}
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
                offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
              />
            ) : null}

            {layout.columns.length === 0 ? (
              <EmptyStaff
                stringCount={layout.stringCount}
                offset={offsetFor(hasBarRow, hasChords, hasTuplets)}
              />
            ) : (
              layout.columns.map(renderColumn)
            )}
            {endRemoval}
          </div>
        </div>
      </div>
      {caption ? (
        <p
          data-testid="staff-caption"
          className="absolute bottom-0 right-3 whitespace-nowrap text-[0.65rem] leading-3 text-text-dim"
        >
          {caption}
        </p>
      ) : null}
    </div>
  );
}

/** Height of the rows drawn above the staff, so the labels line up with it. */
function offsetFor(
  hasBarRow: boolean,
  hasChords: boolean,
  hasTuplets: boolean,
): string {
  const rows = (hasBarRow ? 1 : 0) + (hasChords ? 1 : 0) + (hasTuplets ? 1 : 0);
  return `calc(${rows} * var(--staff-row))`;
}

/** A column's width: its cells plus padding, widened only as far as its chord symbol needs. */
function columnWidth(width: number, room: ChordRoom | undefined): string {
  const base = `${width}ch + var(--col-pad)`;
  if (!room) return `calc(${base})`;
  const have = `${room.roomChars}ch + ${room.roomColumns} * var(--col-pad)`;
  return `calc(${base} + max(0px, ${room.chars} * var(--chord-ch) + var(--chord-gap) - (${have})))`;
}

interface ColumnProps {
  label: string;
  cells: (string | null)[];
  /** A CSS length: see `columnWidth`. */
  width: string;
  /** Wrapped staff: the column may grow to fill its line. */
  wrap?: boolean;
  columnKey: string;
  /** The number to print at this column's left, or null when it opens no bar; undefined when the row is not drawn. */
  barNumber?: number | null;
  chord: string | null;
  barline: boolean;
  active: boolean;
  selected: boolean;
  showChordRow: boolean;
  showTupletRow: boolean;
  /** What the rhythm row draws, or null when the row is not drawn at all. */
  rhythm: RhythmMark | null;
  /** Null when the mark row is not drawn; otherwise this column's mark, if it has one. */
  diff: { mark: ColumnMark | undefined; parent: string } | null;
  tuplet: {
    count: number | null;
    start: boolean;
    end: boolean;
    labelled: boolean;
  } | null;
  /** Draw the bracket in the rhythm row (true) or the row above the cells (false). */
  bracketUnder: boolean;
  onSelect?: () => void;
  onInspect?: () => void;
}

function Column({
  label,
  cells,
  width,
  wrap = false,
  columnKey,
  barNumber,
  chord,
  barline,
  active,
  selected,
  showChordRow,
  showTupletRow,
  rhythm,
  diff,
  tuplet,
  bracketUnder,
  onSelect,
  onInspect,
}: ColumnProps) {
  const mark = diff?.mark;
  if (mark && diff) label = `${label}. ${markWords(mark, diff.parent)}`;
  const diffStatus = mark?.status;
  // Sized in `ch` so a two-digit fret gets twice the room and the staff stays
  // aligned, exactly as in the ASCII output.
  // Wrapped, the min-width repeats the basis: Firefox sizes the bar's line from its columns' content, not their
  // basis, and the line came out too narrow and scrolled its last note out of sight.
  const style: CSSProperties = wrap ? { flex: `1 0 ${width}`, minWidth: width } : { width };

  const body = (
    <>
      {barNumber !== undefined ? (
        <div
          className="relative h-[var(--staff-row)] whitespace-nowrap text-[12px] leading-[12px] text-text-dim"
          data-testid={barNumber === null ? undefined : "tab-bar-number"}
          style={
            barNumber === null
              ? undefined
              : { minWidth: `calc(${String(barNumber).length} * 0.45rem)` }
          }
        >
          {barNumber}
        </div>
      ) : null}

      {showChordRow ? (
        <div className="relative z-[1] h-[var(--staff-row)] whitespace-nowrap text-[0.7rem] font-semibold text-accent">
          {chord}
        </div>
      ) : null}

      {showTupletRow ? (
        <div className="relative h-[var(--staff-row)]">
          <Bracket tuplet={tuplet} under={false} />
        </div>
      ) : null}

      <div
        className={
          [barline ? "tab-barline" : "", mark ? "tab-diff-cells" : ""]
            .filter(Boolean)
            .join(" ") || undefined
        }
      >
        {cells.map((text, index) => (
          <div key={index} className="tab-cell">
            {barline ? null : text === null ? null : <span>{text}</span>}
          </div>
        ))}
      </div>

      {rhythm !== null ? (
        <RhythmCell mark={rhythm}>
          {bracketUnder ? <Bracket tuplet={tuplet} under /> : null}
        </RhythmCell>
      ) : null}

      {diff ? (
        <div className="tab-diff-mark" data-testid="tab-diff" aria-hidden>
          {mark ? (mark.status === "added" ? "+" : "*") : ""}
        </div>
      ) : null}
    </>
  );

  if (!onSelect) {
    return (
      <div
        style={style}
        className={columnClass(active, selected)}
        data-testid="tab-column"
        data-column={columnKey}
        data-selected={selected ? "true" : undefined}
        data-barline={barline ? "true" : undefined}
        data-diff={diffStatus}
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
        columnKey={columnKey}
        barline={barline}
        active={active}
        label={label}
        diff={diffStatus}
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
      data-column={columnKey}
      data-selected={selected ? "true" : undefined}
      data-barline={barline ? "true" : undefined}
      data-diff={diffStatus}
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
  columnKey,
  barline,
  active,
  label,
  diff,
  children,
}: {
  style: CSSProperties;
  className: string;
  onSelect: () => void;
  onInspect: () => void;
  selected: boolean;
  columnKey: string;
  barline: boolean;
  active: boolean;
  label: string;
  diff: ColumnMark["status"] | undefined;
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
        if (
          event.key === "ContextMenu" ||
          (event.key === "F10" && event.shiftKey)
        ) {
          event.preventDefault();
          onInspect();
        }
      }}
      aria-keyshortcuts="Shift+F10"
      aria-haspopup="dialog"
      style={style}
      className={`select-none ${className}`}
      data-testid="tab-column"
      data-column={columnKey}
      data-selected={selected ? "true" : undefined}
      data-barline={barline ? "true" : undefined}
      data-diff={diff}
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
  showBarRow,
  showChordRow,
  showTupletRow,
  showRhythmRow,
  beams,
  bracket,
  bracketUnder,
  selected,
  active,
}: {
  connectors: (string | null)[];
  showBarRow: boolean;
  showChordRow: boolean;
  showTupletRow: boolean;
  showRhythmRow: boolean;
  /** Beam levels the arriving column shares with the one before it: they run across the gap. */
  beams: number;
  bracket: boolean;
  bracketUnder: boolean;
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
      {showBarRow ? <div className="h-[var(--staff-row)]" /> : null}
      {showChordRow ? <div className="h-[var(--staff-row)]" /> : null}
      {showTupletRow ? (
        <div className="relative h-[var(--staff-row)]">
          {bracket ? (
            <div
              className="tab-bracket absolute inset-x-0 bottom-0 border-t"
              style={{ height: "0.2rem" }}
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
      {showRhythmRow ? <GapBeams beams={beams} bracket={bracketUnder && bracket} /> : null}
    </div>
  );
}

/**
 * A group's bracket and, on the one column that carries it, its number. One element for both places: above the
 * cells it is a row of its own, under them it sits inside the rhythm cell and CSS places it.
 */
function Bracket({ tuplet, under }: { tuplet: ColumnProps["tuplet"]; under: boolean }) {
  if (!tuplet) return null;
  return (
    <>
      <div
        className={under ? "tab-bracket" : "tab-bracket absolute inset-x-0 bottom-0 border-t"}
        data-testid="tab-bracket"
        data-start={tuplet.start ? "" : undefined}
        style={{
          borderLeftWidth: tuplet.start ? 1 : 0,
          borderRightWidth: tuplet.end ? 1 : 0,
          borderLeftStyle: "solid",
          borderRightStyle: "solid",
          height: "0.2rem",
        }}
      />
      {tuplet.labelled && tuplet.count !== null ? (
        <div
          className={
            under
              ? "tab-bracket-label"
              : "tab-bracket-label absolute inset-x-0 top-0 text-center text-[12px] leading-[12px]"
          }
        >
          {tuplet.count}
        </div>
      ) : null}
    </>
  );
}

/** The rhythm row's spacer in a gap: full-width beams for the levels the arriving column shares. */
function GapBeams({ beams, bracket }: { beams: number; bracket: boolean }) {
  return (
    <div className="tab-rhythm" aria-hidden="true">
      {bracket ? <div className="tab-bracket" /> : null}
      {[1, 2, 3]
        .filter((k) => k <= beams)
        .map((k) => (
          <div key={k} data-part="beam" data-level={k} />
        ))}
    </div>
  );
}

/** What a screen reader hears after the description of a column. */
function markWords(mark: ColumnMark, parent: string): string {
  if (mark.status === "added") return `Added, not in ${parent}`;
  const words = mark.words ? `: ${mark.words}` : "";
  if (mark.total > 1 && mark.count < mark.total) {
    return `Changed from ${parent} in ${mark.count} of ${mark.total} repetitions${words}`;
  }
  return `Changed from ${parent}${words}`;
}

/**
 * Where the parent had columns the variant lacks. The rail of the strings runs through; the mark row
 * says how many. Not interactive, so it takes no part in selection.
 */
function RemovalGap({
  count,
  parent,
  showBarRow,
  showChordRow,
  showTupletRow,
  showRhythmRow,
  stringCount,
  beams,
  bracket,
  bracketUnder,
}: {
  count: number;
  parent: string;
  showBarRow: boolean;
  showChordRow: boolean;
  showTupletRow: boolean;
  showRhythmRow: boolean;
  stringCount: number;
  beams: number;
  /** The gap sits inside a group, so the group's line runs across it like a connector's does. */
  bracket: boolean;
  bracketUnder: boolean;
}) {
  return (
    <div
      style={{ width: "3ch" }}
      className="tab-removal shrink-0"
      data-testid="tab-removal"
      role="img"
      aria-label={`${count} ${count === 1 ? "column" : "columns"} removed from ${parent} here`}
    >
      {showBarRow ? <div className="h-[var(--staff-row)]" /> : null}
      {showChordRow ? <div className="h-[var(--staff-row)]" /> : null}
      {showTupletRow ? (
        <div className="relative h-[var(--staff-row)]">
          {bracket ? (
            <div
              className="tab-bracket absolute inset-x-0 bottom-0 border-t"
              style={{ height: "0.2rem" }}
            />
          ) : null}
        </div>
      ) : null}
      <div>
        {Array.from({ length: stringCount }, (_, index) => (
          <div key={index} className="tab-cell" />
        ))}
      </div>
      {showRhythmRow ? <GapBeams beams={beams} bracket={bracketUnder && bracket} /> : null}
      <div className="tab-diff-mark">{`−${count}`}</div>
    </div>
  );
}

function columnClass(active: boolean, selected: boolean): string | undefined {
  const classes = [
    selected ? "tab-column-selected" : null,
    active ? "tab-column-active" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return classes || undefined;
}

/** The insertion point: where the next tap puts a note. */
function Caret({
  stringCount,
  offset,
  inline = true,
}: {
  stringCount: number;
  offset: string;
  /** False when wrapped: the caret then takes no room, so moving it can never move a line break. */
  inline?: boolean;
}) {
  return (
    <div
      className={inline ? "relative w-0.5 shrink-0" : "relative w-0 shrink-0"}
      data-testid="tab-caret"
      aria-hidden
    >
      <div style={{ paddingTop: offset }}>
        <div
          className={
            inline
              ? "w-0.5 rounded-full bg-accent"
              : "absolute -left-px w-0.5 rounded-full bg-accent"
          }
          style={{ height: `calc(var(--string-height) * ${stringCount})` }}
        />
      </div>
    </div>
  );
}

function EmptyStaff({
  stringCount,
  offset,
}: {
  stringCount: number;
  offset: string;
}) {
  return (
    <div style={{ paddingTop: offset, width: "6ch" }}>
      {Array.from({ length: stringCount }, (_, index) => (
        <div key={index} className="tab-cell" />
      ))}
    </div>
  );
}
