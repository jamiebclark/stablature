"use client";

/**
 * The capture screen.
 *
 * This is the screen the whole app exists for: someone is playing a riff at
 * you and you have one hand and about four seconds. Every decision here is in
 * service of that.
 *
 *  - There is a cursor, and by default it sits at the end, so tapping frets
 *    appends exactly as fast as it ever did. Tapping a column moves the cursor
 *    there, and new notes go in after it, pushing nothing around -- which is
 *    what makes "capture the root notes first, flesh it out later" work.
 *  - Stacking a chord is an explicit mode, since bass is mostly single notes.
 *  - The repeat stepper acts on the column at the cursor, turning "same note
 *    sixteen times" into two taps.
 *  - The staff sits just above the controls and follows the cursor, so the
 *    thing you are editing is never off screen.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  ClipboardPaste,
  Copy,
  Delete,
  Scissors,
  SlidersHorizontal,
  SquareDashedMousePointer,
  Trash2,
} from "lucide-react";
import { BarlineGlyph, SpaceGlyph, BracketGlyph } from "@/components/icons";
import { useRouter } from "next/navigation";
import { groupOffer, TRIPLET_REFUSAL } from "@/lib/capture/grouping";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, Input, Loading, Sheet } from "@/components/ui";
import { TempoControl } from "@/components/rhythm/TempoControl";
import { readDuration } from "@/lib/rhythm/durations";
import {
  columnRange,
  copyColumns,
  cutColumns,
  deleteColumns,
  pasteClipboard,
  writeClipboard,
} from "@/lib/local/clipboard";
import {
  chordInForceAt,
  chordToneMap,
  chordToneNames,
  parseChord,
} from "@/lib/chords";
import {
  createPart,
  groupRunEndingAt,
  groupSelection,
  insertBarline,
  insertNote,
  insertRest,
  stackNote,
  ungroupTuplet,
} from "@/lib/local/editing";
import {
  useAnnotations,
  useClipboard,
  useEvents,
  useParts,
  usePendingWrites,
  useSong,
  useSongTuning,
} from "@/lib/local/hooks";
import type { AnnotationRow, EventRow, FretValue, PartRow } from "@/lib/model";
import { type Tuning } from "@/lib/tunings";
import {
  LATCHES,
  armLatch,
  cursorPending,
  litLatches,
  nextNote,
  prunedArmed,
  statusFor,
  statusShortFor,
  type LatchId,
} from "@/lib/capture/latches";
import { isPresent, TOOLBAR_CONTROLS } from "@/lib/capture/controls";
import {
  COLUMN_PROPERTIES,
  propertiesFor,
  type ColumnProperty,
} from "@/lib/capture/properties";
import { resolveTarget } from "@/lib/capture/target";
import { Fretboard } from "./Fretboard";
import { HelpOpen } from "@/components/keys/HelpOpen";
import { useScreenKeys } from "@/components/keys/useScreenKeys";
import { FRET_WAIT_MS, IDLE, stepFretEntry, type FretEntry, type FretInput } from "@/lib/keys/fretEntry";
import { cursorBar, cursorStep, nextCursorAfterDelete, type Cursor } from "@/lib/capture/cursor";
import { ColumnInspector } from "./ColumnInspector";
import { LatchStrip } from "./LatchStrip";

/**
 * Where the next note lands.
 *
 * "end" rather than the id of the last column, so the cursor keeps tracking
 * the end as columns are added instead of being left behind by its own
 * insert. `null` is the very start, which is otherwise unreachable when the
 * rule is "insert after".
 */


const ignoreLongPress = () => {};

/** One sizing for every control on the selection row, so all of them fit one line. */
const SELECTION_BUTTON = "h-(--control)! px-1! text-xs! gap-1!";

/** A symbol holds its width up to ten characters, and past that gives way down to ten so the jump buttons stay on the row. */
const WIDE_ROW = "(min-width: 640px)";
const subscribeWide = (notify: () => void) => {
  const query = window.matchMedia(WIDE_ROW);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
/** True when the status row has room for the whole words while a digit waits. */
const useWideRow = () =>
  useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_ROW).matches,
    () => false,
  );

const symbolFit = (symbol: string) => (symbol.length <= 10 ? "shrink-0" : "min-w-[10ch] truncate");

export function CaptureScreen({
  songId,
  partId,
}: {
  songId: string;
  partId?: string;
}) {
  const router = useRouter();
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const parts = useParts(songId);
  const pending = usePendingWrites();

  const [cursor, setCursor] = useState<Cursor>("end");
  // Bumped just before a write that makes a group, so the staff scrolls that group into view.
  const [revealGroups, setRevealGroups] = useState(0);
  const [keyMoves, setKeyMoves] = useState(0);
  const [armed, setArmed] = useState<ReadonlySet<LatchId>>(() => new Set());
  /** The last cursor column seen in `columns`: tells "not delivered yet" from "really gone". */
  const [deliveredId, setDeliveredId] = useState<string | null>(null);
  /** An event id, never a copy of the row: deleting it elsewhere closes the sheet. */
  const [inspecting, setInspecting] = useState<string | null>(null);
  const [refusedAt, setRefusedAt] = useState<{
    afterId: string | null;
    length: number;
  } | null>(null);
  const [chordDraft, setChordDraft] = useState<string | null>(null);
  /**
   * A selection is two tapped columns, in either order.
   *
   * Tap-to-extend rather than drag: the staff already scrolls horizontally,
   * so a horizontal drag is ambiguous between "select these" and "scroll",
   * and disambiguating it with a long press fights fast capture.
   */
  const [selection, setSelection] = useState<{
    anchorId: string;
    headId: string;
  } | null>(null);
  const clipboard = useClipboard();

  /*
   * The open part lives in the URL rather than in component state, because
   * switching parts genuinely is navigation: back and forward work, a reload
   * keeps your place, and a part is linkable from the song page.
   *
   * Falling back to the last part also handles the part being deleted on
   * another device mid-session -- the id simply stops matching and the view
   * drops to the next candidate, with no window where the screen points at
   * something that is gone.
   */
  const part = parts?.find((p) => p.id === partId) ?? parts?.at(-1) ?? null;
  const events = useEvents(part?.id);
  const annotations = useAnnotations(part?.id);

  const columns = events ?? [];
  /** The column to insert after; null when the cursor is at the start. */
  const afterId = cursor === "end" ? (columns.at(-1)?.id ?? null) : cursor;
  const focused = afterId
    ? columns.find((event) => event.id === afterId)
    : undefined;
  const cursorDuration = readDuration(focused?.durationHint);
  /** Repeats and chords are meaningless on a barline. */
  const editable: EventRow | undefined =
    focused?.kind === "barline" ? undefined : focused;
  /** One answer for the form and for the neck's wrapper, so a short screen always has one of the two. */
  const chordFormShowing = chordDraft !== null && editable !== undefined;

  /** What the cursor resolves to, and the lit (armed ∩ applicable) latches. */
  const target = resolveTarget(part, columns, afterId);
  const lit = litLatches(armed, target);
  /*
   * INV-010, for every route at once: the stored set never holds a latch the
   * cursor's target rejects. Pruning here, rather than disarming at each place
   * that moves the cursor, also covers the routes that move it without us
   * (a sync delete, a part opened from elsewhere). Adjusting state during
   * render is the documented way to derive it from a changing value.
   */
  if (focused && focused.id !== deliveredId) setDeliveredId(focused.id);
  const pruned = prunedArmed(
    armed,
    lit,
    cursorPending(afterId, focused?.id, deliveredId),
  );
  if (pruned !== armed) setArmed(pruned);
  const inspected = inspecting
    ? (columns.find((c) => c.id === inspecting) ?? null)
    : null;
  const afterInspectorAction = (property: ColumnProperty) => {
    if (property.destructive && inspected) {
      setCursor(nextCursorAfterDelete(columns, inspected.id, cursor));
    }
  };
  const propCtx =
    part && editable && tuning
      ? { part, event: editable, annotations: annotations ?? [], tuning }
      : null;
  const props = propertiesFor(target);
  const deleteProp = COLUMN_PROPERTIES.find((p) => p.id === "delete");
  const repeatProp = props.find((p) => p.id === "repeat");
  const chordProp = props.find((p) => p.id === "chord");
  const presentIds = new Set(
    TOOLBAR_CONTROLS.filter((c) => isPresent(c, target)).map((c) => c.id),
  );
  const status = statusFor(lit);
  const wideRow = useWideRow();
  /** Derived, so any route that moves the cursor or changes the part clears it. */
  const refused =
    refusedAt?.afterId === afterId && refusedAt?.length === columns.length;
  if (refusedAt && !refused) setRefusedAt(null);

  const toggleLatch = (id: LatchId) => {
    setArmed((prev) => armLatch(prev, id));
  };

  /*
   * The chord in force where the cursor is, so the neck can show where its
   * notes fall. A symbol holds until the next one rather than applying only to
   * the column it is anchored to, which is why this looks backwards -- see
   * chordInForceAt.
   *
   * Parsing is split from finding so that the parse only re-runs when the
   * symbol itself changes, and not on every note added underneath it.
   */
  const chordSymbol = useMemo(
    () => chordInForceAt(events ?? [], annotations ?? [], afterId),
    [events, annotations, afterId],
  );
  const chord = useMemo(
    () => (chordSymbol ? parseChord(chordSymbol) : null),
    [chordSymbol],
  );
  const chordTones = useMemo(
    () => (chord ? chordToneMap(chord) : undefined),
    [chord],
  );

  const selectedEvents = selection
    ? columnRange(columns, selection.anchorId, selection.headId)
    : [];
  const selectedIds = new Set(selectedEvents.map((event) => event.id));

  const offer = groupOffer(selectedEvents);

  const endSelection = (moveCursorToEnd = false) => {
    setSelection(null);
    if (moveCursorToEnd) setCursor("end");
  };

  /** Keep the cursor on what was just inserted, unless it is tracking the end. */
  const advance = (insertedId: string) => {
    if (cursor !== "end") setCursor(insertedId);
  };

  const press = useCallback(
    async (stringIndex: number, fret: FretValue) => {
      if (!part) return;
      const next = nextNote(lit, target);
      /*
       * A transition is one-shot: disarm it before awaiting the write, so a
       * second tap in the same tick cannot store it twice. Stack stays armed
       * -- a three-note chord is the common case it exists for -- and
       * disarms itself on any action that means you have moved on.
       */
      if (next.consumed.length > 0) {
        setArmed((prev) => {
          const rest = new Set(prev);
          for (const id of next.consumed) rest.delete(id);
          return rest;
        });
      }
      if (next.stackOnto) {
        await stackNote(next.stackOnto, stringIndex, fret, {
          techniques: next.techniques,
        });
        return;
      }
      const inserted = await insertNote(
        part,
        columns,
        afterId,
        stringIndex,
        fret,
        {
          techniques: next.techniques,
        },
      );
      advance(inserted.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [part, lit, target, columns, afterId, cursor],
  );

  /* ----- Keyboard (FR-057..061). Every route below is the one a tap uses; `press` is not wrapped. ----- */
  const pressRef = useRef(press);
  const renderWaiters = useRef<Array<() => void>>([]);
  const cursorSeen = useRef(cursor);
  useEffect(() => {
    pressRef.current = press;
    cursorSeen.current = cursor;
    const waiters = renderWaiters.current;
    renderWaiters.current = [];
    for (const resolve of waiters) resolve();
  });
  const [kbString, setKbString] = useState<number | null>(null);
  const [kbUsed, setKbUsed] = useState(false);
  const [waiting, setWaiting] = useState<1 | 2 | null>(null);
  const entry = useRef<FretEntry>(IDLE);
  const waitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const deliveries = useRef<Array<() => void>>([]);
  const stringCount = tuning?.strings.length ?? 0;
  const keyString = stringCount === 0 ? 0 : Math.min(kbString ?? stringCount - 1, stringCount - 1);
  const keyStringRef = useRef(keyString);
  useEffect(() => {
    keyStringRef.current = keyString;
  });

  // A write is delivered when the live query next changes `columns`, or after 250ms.
  useEffect(() => {
    const waiters = deliveries.current;
    deliveries.current = [];
    for (const resolve of waiters) resolve();
  }, [columns]);
  const waitForDelivery = () =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 250);
      deliveries.current.push(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  const enqueue = (stringIndex: number, fret: FretValue) => {
    chain.current = chain.current
      .then(() => pressRef.current(stringIndex, fret))
      .then(waitForDelivery)
      .catch(() => {});
  };
  /**
   * A navigation key goes through the same queue as a fret press, so it runs after every note before it
   * has landed and reads the columns and cursor that were delivered, not the render it was typed in.
   */
  const navRef = useRef<Record<string, () => Cursor | void>>({});
  const enqueueNav = (name: string) => {
    chain.current = chain.current
      .then(() => {
        const target = navRef.current[name]?.();
        setKeyMoves((n) => n + 1);
        // Wait for the render that carries the move, so the next press reads the new cursor.
        return new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 250);
          const check = () => {
            if (target !== undefined && cursorSeen.current !== target) {
              renderWaiters.current.push(check);
              return;
            }
            clearTimeout(timer);
            resolve();
          };
          if (target === undefined) setTimeout(resolve, 60);
          else check();
        });
      })
      .catch(() => {});
  };
  const feedEntry = (input: FretInput) => {
    const step = stepFretEntry(entry.current, input);
    entry.current = step.state;
    setWaiting(step.state.waiting);
    for (const fret of step.enters) enqueue(keyStringRef.current, fret);
    if (waitTimer.current) clearTimeout(waitTimer.current);
    waitTimer.current = step.state.waiting
      ? setTimeout(() => feedEntry({ type: "timeout" }), FRET_WAIT_MS)
      : null;
  };
  const feedRef = useRef(feedEntry);
  useEffect(() => {
    feedRef.current = feedEntry;
  });
  const flushEntry = () => {
    if (entry.current.waiting) feedEntry({ type: "other" });
  };

  // Any other key, a sheet opening or a part change enters the waiting digit first.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!entry.current.waiting) return;
      if (/^[0-9]$/.test(event.key) || event.key === "Enter") return;
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(event.key)) return;
      feedRef.current({ type: "other" });
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      // Leaving enters nothing: the digit was never confirmed.
      if (waitTimer.current) clearTimeout(waitTimer.current);
      entry.current = IDLE;
    };
  }, []);
  useEffect(() => {
    if (inspecting) feedRef.current({ type: "other" });
  }, [inspecting]);

  /** The route a tap on a column takes: a selection extends its head, otherwise the cursor moves and latches clear. */
  const routeCursor = (next: Cursor) => {
    if (selection) {
      if (typeof next === "string" && next !== "end") setSelection({ ...selection, headId: next });
      return;
    }
    setCursor(next);
    setArmed(new Set());
  };
  /** The chips' route: reset the cursor and latches. The link (or a key) then replaces the URL. */
  const openPart = (id: string) => {
    flushEntry();
    setCursor("end");
    setArmed(new Set());
    return id;
  };
  const stepPart = (by: -1 | 1) => {
    if (!parts || !part) return false;
    const next = parts[parts.findIndex((p) => p.id === part.id) + by];
    if (!next) return false;
    openPart(next.id);
    router.replace(`/songs/${songId}/capture/${next.id}`);
  };
  const onKeys =
    (fn: (event: KeyboardEvent) => void | boolean) =>
    (event: KeyboardEvent): void | boolean => {
      setKbUsed(true);
      return fn(event);
    };
  const selectionHead = selection ? selection.headId : cursor;
  // The actions only touch refs when a key arrives, never during render.
  /* eslint-disable react-hooks/refs */
  /** Each returns the cursor it moves to, when it moves the cursor and not a selection's head. */
  const moveTo = (next: Cursor) => {
    routeCursor(next);
    return selection ? undefined : next;
  };
  /** What the jump buttons do: the cursor moves and the latches stay. A selection rests. */
  const jumpTo = (next: Cursor) => {
    if (selection) return undefined;
    setCursor(next);
    return next;
  };
  navRef.current = {
    "column-back": () => moveTo(cursorStep(columns, selectionHead, -1)),
    "column-on": () => moveTo(cursorStep(columns, selectionHead, 1)),
    "bar-back": () => moveTo(cursorBar(columns, selectionHead, -1)),
    "bar-on": () => moveTo(cursorBar(columns, selectionHead, 1)),
    start: () => jumpTo(null),
    end: () => jumpTo("end"),
  };
  useScreenKeys("capture", {
    "column-back": onKeys(() => enqueueNav("column-back")),
    "column-on": onKeys(() => enqueueNav("column-on")),
    "bar-back": onKeys(() => enqueueNav("bar-back")),
    "bar-on": onKeys(() => enqueueNav("bar-on")),
    start: onKeys(() => enqueueNav("start")),
    end: onKeys(() => enqueueNav("end")),
    "part-back": onKeys(() => stepPart(-1)),
    "part-on": onKeys(() => stepPart(1)),
    "string-up": onKeys(() => setKbString(Math.max(0, keyString - 1))),
    "string-down": onKeys(() => setKbString(Math.min(stringCount - 1, keyString + 1))),
    enter: onKeys((event) => {
      if (!part || selection) return false;
      if (event.key === "Enter") {
        if (!entry.current.waiting) return false;
        feedEntry({ type: "enter" });
        return;
      }
      feedEntry({ type: "digit", digit: Number(event.key) });
    }),
    "dead-note": onKeys(() => {
      if (!part || selection) return false;
      enqueue(keyString, "x");
    }),
  });
  /* eslint-enable react-hooks/refs */

  if (song === undefined || parts === undefined) return <Loading />;
  if (!song) {
    return (
      <p className="p-6 text-sm text-text-dim">
        That song is not on this device.
      </p>
    );
  }
  if (!tuning) {
    return (
      <div className="p-6 text-sm text-text-dim">
        <p>This band has no tunings yet, and a fretboard needs one.</p>
        <Button
          className="mt-3"
          onClick={() => router.push(`/bands/${song.bandId}/tunings`)}
        >
          Add a tuning
        </Button>
      </div>
    );
  }

  const atEnd = cursor === "end";

  return (
    <div
      className="capture-surface flex h-dvh flex-col bg-bg"
      style={{
        paddingTop: "var(--safe-top)",
        paddingRight: "var(--safe-right)",
        paddingBottom: "var(--safe-bottom)",
        paddingLeft: "var(--safe-left)",
      }}
    >
      {/* One row: back, part chips, + part, tempo, sync word. Switching parts mid-capture is
          normal: the guitarist plays the B section and you need somewhere to put it immediately. */}
      <header
        data-testid="capture-title-row"
        className="flex h-[45px] shrink-0 items-center gap-1.5 border-b border-border-subtle px-3"
      >
        <button
          type="button"
          onClick={() => router.push(`/songs/${songId}`)}
          aria-label={`Back to ${song.title}`}
          className="min-h-(--control) min-w-(--control) max-w-max flex-[1_1_0] truncate text-left text-sm font-medium hover:text-accent"
        >
          &larr;<span> {song.title}</span>
        </button>
        <div className="flex min-w-0 flex-[0_1_auto] items-center gap-1.5 overflow-x-auto">
          {parts.map((candidate) => (
            <Link
              key={candidate.id}
              href={`/songs/${songId}/capture/${candidate.id}`}
              replace
              ref={(el) => {
                if (el && candidate.id === part?.id)
                  el.scrollIntoView?.({ inline: "nearest", block: "nearest" });
              }}
              onClick={() => {
                openPart(candidate.id);
              }}
              className={`inline-flex min-h-(--control) min-w-9 shrink-0 items-center justify-center rounded px-2.5 font-mono text-sm ${
                candidate.id === part?.id
                  ? "bg-accent text-accent-text"
                  : "bg-bg-raised text-text-dim"
              }`}
            >
              {candidate.label}
            </Link>
          ))}
          <Button
            variant="ghost"
            className="shrink-0 px-2 py-1"
            onClick={async () => {
              const created = await createPart(song);
              setCursor("end");
              router.push(`/songs/${songId}/capture/${created.id}`);
            }}
            aria-label="Add a part"
          >
            + part
          </Button>
        </div>
        <TempoControl song={song} variant="header" />
        <HelpOpen />
        {pending ? (
          <span className="shrink-0 font-mono text-[0.7rem] text-text-faint">
            {pending} unsynced
          </span>
        ) : null}
      </header>

      {/* Bottom-aligned: during capture your eyes are on the fretboard, and a
          staff stranded at the top of a tall screen is a lot of travel. Up to five strings
          `justify-end` does it, as it always has. Six overflow at phone size, and
          `justify-end` would put that overflow above the scroll origin where no swipe reaches
          it (and `mt-auto` stops anchoring once content overflows). A column-reverse scroller
          starts at the bottom and keeps its overflow on the side a swipe can reach. */}
      <div
        data-testid="tab-band"
        className="flex min-h-0 flex-1 flex-col-reverse overflow-y-auto px-3 pt-1"
      >
        {part ? (
          <div className="shrink-0">
            <TabStaff
              events={columns}
              tuning={tuning}
              annotations={annotations ?? []}
              followTail={atEnd}
              revealGroups={revealGroups}
              keepCaretInView={keyMoves}
              activeEventId={focused?.id ?? null}
              insertAfterEventId={selection ? undefined : afterId}
              selectedEventIds={selectedIds}
              // A selection-time hold is swallowed (FR-022): the handler does nothing, but its
              // presence arms the press hook, whose click suppression stops the hold extending.
              onInspectColumn={selection ? ignoreLongPress : setInspecting}
              onSelectColumn={routeCursor}
            />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-text-dim">
            Add a part to start capturing.
          </p>
        )}
      </div>

      {part && selection ? (
        <div
          data-testid="status-row"
          className="flex h-(--status-row) shrink-0 items-center gap-1.5 overflow-hidden whitespace-nowrap border-t border-border-subtle px-3"
        >
          <span className="text-[0.7rem] text-accent">
            {selectedEvents.length} selected &middot; tap another column to
            extend
          </span>
        </div>
      ) : part ? (
        <div
          data-testid="status-row"
          className="flex h-(--status-row) shrink-0 items-center gap-1 overflow-hidden whitespace-nowrap border-t border-border-subtle px-3 text-[0.7rem]"
        >
          <span
            className={`shrink-0 ${refused || status || !atEnd ? "text-accent" : "text-text-faint"}`}
          >
            {refused ? (
              TRIPLET_REFUSAL
            ) : (
              <>
                {/* A waiting digit takes the room the long words need, so they go short while it waits. */}
                {waiting
                  ? status
                    ? wideRow
                      ? status
                      : statusShortFor(lit)
                    : atEnd
                      ? "at the end"
                      : afterId === null
                        ? "at the start"
                        : "after the mark"
                  : status ||
                    (atEnd
                      ? "adding at the end"
                      : afterId === null
                        ? "adding at the start"
                        : "adding after the marked column")}
              </>
            )}
          </span>
          {/* Which notes the lit frets are. The unreadable-symbol case says so
              rather than leaving an unexplained bare neck. */}
          {chord ? (
            <>
              <span className={`${refused ? "min-w-0 truncate" : symbolFit(chord.symbol)} font-mono text-accent`}>
                {chord.symbol}
              </span>
              {refused ? null : (
                <span className="min-w-0 truncate font-mono text-text-dim">
                  {chordToneNames(chord).join(" ")}
                </span>
              )}
            </>
          ) : chordSymbol ? (
            <>
              <span className={`${refused ? "min-w-0 truncate" : symbolFit(chordSymbol)} font-mono text-text-faint`}>{chordSymbol}</span>
              <span
                className="min-w-0 truncate font-mono text-text-faint"
                title="Not a chord this app can read"
              >
                &mdash; not a chord I know
              </span>
            </>
          ) : null}
          {waiting ? (
            <span data-testid="digit-waiting" className="shrink-0 font-mono text-accent">
              fret {waiting}&hellip;
            </span>
          ) : !refused && cursorDuration ? (
            <span data-testid="cursor-duration" className="min-w-0 truncate font-mono text-text-dim">
              {cursorDuration.words}
            </span>
          ) : null}
          {columns.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setCursor(null)}
                className="inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded px-1.5 text-text-dim hover:text-accent"
              >
                &#8676; start
              </button>
              <button
                type="button"
                onClick={() => setCursor("end")}
                className="inline-flex h-6 min-w-[44px] shrink-0 items-center justify-center rounded px-1.5 text-text-dim hover:text-accent"
              >
                end &#8677;
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {chordFormShowing ? (
        <form
          className="flex gap-2 border-t border-border-subtle p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (chordProp && propCtx)
              await chordProp.commit(propCtx, chordDraft);
            setChordDraft(null);
          }}
        >
          <Input
            autoFocus
            value={chordDraft}
            onChange={(e) => setChordDraft(e.target.value)}
            placeholder="Harmony, e.g. Am"
            aria-label="Chord"
          />
          <Button type="submit" variant="primary">
            Set
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setChordDraft(null)}
          >
            Cancel
          </Button>
        </form>
      ) : null}

      <div
        data-testid="toolbar-stable"
        className="flex h-(--toolbar-row) shrink-0 flex-nowrap items-center gap-1 border-t border-border-subtle px-2.5"
      >
        <Button
          disabled={!part}
          onClick={async () => {
            if (!part) return;
            const inserted = await insertRest(part, columns, afterId);
            setArmed(new Set());
            advance(inserted.id);
          }}
          title="A gap: a pause, or a note left ringing. Use the repeat for a longer one."
        >
          <SpaceGlyph />
          space
        </Button>

        <Button
          disabled={!part}
          onClick={async () => {
            if (!part) return;
            const inserted = await insertBarline(part, columns, afterId);
            setArmed(new Set());
            advance(inserted.id);
          }}
          title="Barline"
          aria-label="Barline"
        >
          <BarlineGlyph />
        </Button>

        <Button
          disabled={!focused || Boolean(selection)}
          onClick={() =>
            focused &&
            setSelection({ anchorId: focused.id, headId: focused.id })
          }
          title="Select a run of columns to copy, cut or delete"
        >
          <SquareDashedMousePointer size={15} aria-hidden />
          select
        </Button>

        <Button
          disabled={!part || !clipboard}
          onClick={async () => {
            if (!part || !clipboard) return;
            const pasted = await pasteClipboard(
              part,
              columns,
              afterId,
              clipboard,
            );
            const last = pasted.at(-1);
            if (last && cursor !== "end") setCursor(last.id);
          }}
          title={
            clipboard
              ? `Paste ${clipboard.columns.length} column(s) at the cursor`
              : "Nothing copied yet"
          }
        >
          <ClipboardPaste size={15} aria-hidden />
          paste
        </Button>

        <Button
          variant="danger"
          className="ml-1 min-w-(--control)"
          disabled={!focused}
          onClick={async () => {
            if (!focused || !part) return;
            const next = nextCursorAfterDelete(columns, focused.id, cursor);
            if (!tuning) return;
            await deleteProp?.commit(
              { part, event: focused, annotations: [], tuning },
              "",
            );
            setCursor(next);
          }}
          aria-label={
            atEnd ? "Delete the last column" : "Delete the marked column"
          }
          title="Remove this column"
        >
          <Delete size={17} aria-hidden />
        </Button>
      </div>

      {/* Present iff the cursor is on a playable column; absent, never greyed. */}
      {part && selection ? (
        <div
          data-testid="toolbar-selection"
          className="flex h-(--toolbar-row) shrink-0 flex-nowrap items-center gap-1 border-t border-border-subtle px-1"
        >
          <Button
            className={SELECTION_BUTTON}
            onClick={async () => {
              await writeClipboard(
                copyColumns(selectedEvents, annotations ?? []),
              );
              endSelection();
            }}
          >
            <Copy size={14} aria-hidden />
            copy
          </Button>
          <Button
            className={SELECTION_BUTTON}
            onClick={async () => {
              await cutColumns(selectedEvents, annotations ?? []);
              endSelection(true);
            }}
          >
            <Scissors size={14} aria-hidden />
            cut
          </Button>
          {/*
            Bordered like copy and cut rather than bare red text: these three
            are peers acting on the same selection, and the odd one out read
            as a different kind of control. The red label and the bin keep it
            from being mistaken for a safe action.
          */}
          <Button
            className={`${SELECTION_BUTTON} mx-1 text-danger`}
            onClick={async () => {
              await deleteColumns(selectedEvents);
              endSelection(true);
            }}
          >
            <Trash2 size={14} aria-hidden />
            delete
          </Button>
          {offer.tuplet ? (
            <Button
              className={`${SELECTION_BUTTON} min-w-9!`}
              onClick={async () => {
                setRevealGroups((n) => n + 1);
                await groupSelection(
                  part.id,
                  selection.anchorId,
                  selection.headId,
                  "tuplet",
                );
                endSelection();
              }}
              title={`Bracket these ${offer.tuplet.length} columns with their number`}
              aria-label={`Make a tuplet of ${offer.tuplet.length}`}
            >
              <BracketGlyph numeral={offer.tuplet.length} />
            </Button>
          ) : null}
          {offer.plain.length > 0 ? (
            <Button
              className={`${SELECTION_BUTTON} min-w-9!`}
              onClick={async () => {
                setRevealGroups((n) => n + 1);
                await groupSelection(
                  part.id,
                  selection.anchorId,
                  selection.headId,
                  "plain",
                );
                endSelection();
              }}
              title="Bracket these columns with no number"
              aria-label="Group with no number"
            >
              <BracketGlyph />
            </Button>
          ) : null}
          {offer.ungroup ? (
            <Button
              className={`${SELECTION_BUTTON} min-w-9!`}
              onClick={async () => {
                await ungroupTuplet(selectedEvents);
                endSelection();
              }}
              title="Take these groups apart"
              aria-label="Ungroup"
            >
              ungroup
            </Button>
          ) : null}
          {/* Borderless, because it leaves rather than does. */}
          <Button
            variant="ghost"
            className={`${SELECTION_BUTTON} ml-auto`}
            onClick={() => endSelection()}
          >
            cancel
          </Button>
        </div>
      ) : part && editable && propCtx ? (
        <div
          data-testid="toolbar-contextual"
          className="flex h-(--toolbar-row) shrink-0 flex-nowrap items-center gap-1 border-t border-border-subtle px-2.5"
        >
          {presentIds.has("triplet") ? (
            <Button
              onClick={async () => {
                // The three columns ending at the cursor, so this works mid-part
                // and not only at the tail.
                setRevealGroups((n) => n + 1);
                const made = await groupRunEndingAt(
                  part.id,
                  atEnd ? null : editable.id,
                  3,
                );
                if (!made) {
                  // Disarm: a refusal makes no group, so the next one to
                  // arrive (by sync) must not be scrolled to.
                  setRevealGroups((n) => n - 1);
                  setRefusedAt({ afterId, length: columns.length });
                }
              }}
              title="Make this column and the two before it a triplet"
              aria-label="Triplet"
            >
              <BracketGlyph numeral={3} />
            </Button>
          ) : null}

          {repeatProp && presentIds.has("repeat") ? (
            <div className="flex items-center overflow-hidden rounded-md border border-border-subtle">
              <button
                type="button"
                disabled={editable.repeat <= 1}
                onClick={() => void repeatProp.commit(propCtx, -1)}
                className="min-h-(--control) min-w-8 px-2.5 text-sm disabled:opacity-30"
                aria-label="Repeat one fewer time"
              >
                &minus;
              </button>
              {/* Announced, because the count changes under the user's thumb and
                  there is no other feedback that the tap landed. */}
              <span
                className="min-w-10 bg-bg-raised px-1 text-center font-mono text-sm"
                aria-label="Repeat count"
                aria-live="polite"
              >
                &times;{repeatProp.read(propCtx)}
              </span>
              <button
                type="button"
                onClick={() => void repeatProp.commit(propCtx, 1)}
                className="min-h-(--control) min-w-8 px-2.5 text-sm"
                aria-label="Repeat one more time"
              >
                +
              </button>
            </div>
          ) : null}

          {repeatProp && presentIds.has("times4") ? (
            <Button
              onClick={() => void repeatProp.commit(propCtx, 3)}
              title="Four of these"
            >
              &times;4
            </Button>
          ) : null}

          {/*
            "chord symbol" rather than "chord", because the latch strip's stack
            also makes a chord -- an actual one, out of notes. This one writes
            the harmony above the staff: a label saying what the band is on, not
            something the bass plays.
          */}
          {chordProp && presentIds.has("chord") ? (
            <Button
              onClick={() => setChordDraft("")}
              title="Name the harmony here, written above the staff"
            >
              chord symbol
            </Button>
          ) : null}

          {presentIds.has("inspect") ? (
            <Button
              onClick={() => setInspecting(editable.id)}
              className="min-h-11 min-w-11"
              title="Open column details"
              aria-label="Open column details"
            >
              <SlidersHorizontal size={17} aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        /* Reserves row 2's height so the stable row above never moves (INV-003). */
        <div
          aria-hidden
          data-testid="toolbar-reserved"
          className="h-(--toolbar-row) shrink-0 border-t border-border-subtle"
        />
      )}

      <InspectorSheet
        inspected={inspected}
        part={part}
        annotations={annotations}
        tuning={tuning}
        index={columns.findIndex((c) => c.id === inspecting)}
        onActionDone={afterInspectorAction}
        onClose={() => setInspecting(null)}
      />

      {/* A short screen gives the neck's place to the chord form while it is open, so the band keeps room (INV-003). */}
      <div className={chordFormShowing ? "[@media(max-height:600px)]:hidden" : "contents"}>
        <Fretboard
          tuning={tuning}
          keyboardString={kbUsed ? keyString : null}
          onPress={press}
          highlight={editable?.frets}
          chordTones={chordTones}
          disabled={!part}
          latchStrip={
            <LatchStrip
              latches={LATCHES}
              lit={lit}
              target={target}
              onToggle={toggleLatch}
              disabled={!part || Boolean(selection)}
            />
        }
        />
      </div>
    </div>
  );
}

function InspectorSheet({
  inspected,
  part,
  annotations,
  tuning,
  index,
  onActionDone,
  onClose,
}: {
  inspected: EventRow | null;
  part: PartRow | null;
  annotations: readonly AnnotationRow[] | undefined;
  tuning: Tuning;
  index: number;
  onActionDone: (property: ColumnProperty) => void;
  onClose: () => void;
}) {
  const barline = inspected?.kind === "barline";
  return (
    <Sheet
      open={inspected !== null}
      onClose={onClose}
      label={barline ? "Barline" : "Column"}
    >
      {inspected && part ? (
        <ColumnInspector
          title={barline ? "Barline" : `Column ${index + 1}`}
          properties={propertiesFor(
            resolveTarget(part, [inspected], inspected.id),
          )}
          ctx={{
            part,
            event: inspected,
            annotations: annotations ?? [],
            tuning,
          }}
          onActionDone={onActionDone}
          onClose={onClose}
        />
      ) : null}
    </Sheet>
  );
}
