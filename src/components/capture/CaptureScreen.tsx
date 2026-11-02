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

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, Input, Loading } from "@/components/ui";
import {
  bumpColumnRepeat,
  createPart,
  deleteColumn,
  groupAsTuplet,
  insertBarline,
  insertNote,
  setChord,
  stackNote,
} from "@/lib/local/editing";
import {
  useAnnotations,
  useEvents,
  useParts,
  usePendingWrites,
  useSong,
  useSongTuning,
} from "@/lib/local/hooks";
import type { EventRow, FretValue } from "@/lib/model";
import { Fretboard } from "./Fretboard";

/**
 * Where the next note lands.
 *
 * "end" rather than the id of the last column, so the cursor keeps tracking
 * the end as columns are added instead of being left behind by its own
 * insert. `null` is the very start, which is otherwise unreachable when the
 * rule is "insert after".
 */
type Cursor = "end" | null | string;

export function CaptureScreen({ songId, partId }: { songId: string; partId?: string }) {
  const router = useRouter();
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const parts = useParts(songId);
  const pending = usePendingWrites();

  const [cursor, setCursor] = useState<Cursor>("end");
  const [stacking, setStacking] = useState(false);
  const [chordDraft, setChordDraft] = useState<string | null>(null);

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
  const focused = afterId ? columns.find((event) => event.id === afterId) : undefined;
  /** Repeats and chords are meaningless on a barline. */
  const editable: EventRow | undefined = focused?.kind === "barline" ? undefined : focused;

  /** Keep the cursor on what was just inserted, unless it is tracking the end. */
  const advance = (insertedId: string) => {
    if (cursor !== "end") setCursor(insertedId);
  };

  const press = useCallback(
    async (stringIndex: number, fret: FretValue) => {
      if (!part) return;
      if (stacking && editable) {
        /*
         * Stays armed. A three-note chord is the common case this exists for,
         * and disarming after each note made it cost two mode toggles. The
         * button is lit while it is on and the status line says so, so this is
         * visible state rather than a trap -- and it disarms itself on any
         * action that means you have moved on.
         */
        await stackNote(editable, stringIndex, fret);
        return;
      }
      const inserted = await insertNote(part, columns, afterId, stringIndex, fret);
      advance(inserted.id);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [part, stacking, editable, columns, afterId, cursor],
  );

  if (song === undefined || parts === undefined) return <Loading />;
  if (!song) {
    return <p className="p-6 text-sm text-text-dim">That song is not on this device.</p>;
  }
  if (!tuning) {
    return (
      <div className="p-6 text-sm text-text-dim">
        <p>This band has no tunings yet, and a fretboard needs one.</p>
        <Button className="mt-3" onClick={() => router.push(`/bands/${song.bandId}/tunings`)}>
          Add a tuning
        </Button>
      </div>
    );
  }

  const atEnd = cursor === "end";

  return (
    <div className="flex h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
        <button
          type="button"
          onClick={() => router.push(`/songs/${songId}`)}
          className="truncate text-sm font-medium hover:text-accent"
        >
          &larr; {song.title}
        </button>
        <span className="shrink-0 font-mono text-[0.7rem] text-text-faint">
          {pending ? `${pending} unsynced` : "all synced"}
        </span>
      </header>

      {/* Part chips. Switching parts mid-capture is normal: the guitarist plays
          the B section and you need somewhere to put it immediately. */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border-subtle px-3 py-2">
        {parts.map((candidate) => (
          <Link
            key={candidate.id}
            href={`/songs/${songId}/capture/${candidate.id}`}
            replace
            onClick={() => {
              setCursor("end");
              setStacking(false);
            }}
            className={`shrink-0 rounded px-2.5 py-1 font-mono text-sm ${
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

      {/* Bottom-aligned: during capture your eyes are on the fretboard, and a
          staff stranded at the top of a tall screen is a lot of travel. */}
      <div className="flex min-h-0 flex-1 flex-col justify-end overflow-y-auto px-3 py-3">
        {part ? (
          <TabStaff
            events={columns}
            tuning={tuning}
            annotations={annotations ?? []}
            followTail={atEnd}
            activeEventId={focused?.id ?? null}
            onSelectColumn={(eventId) => {
              setCursor(eventId);
              setStacking(false);
            }}
          />
        ) : (
          <p className="py-6 text-center text-sm text-text-dim">
            Add a part to start capturing.
          </p>
        )}
      </div>

      {part ? (
        <div className="flex items-center gap-2 border-t border-border-subtle px-3 py-1.5 text-[0.7rem]">
          <span className={stacking || !atEnd ? "text-accent" : "text-text-faint"}>
            {stacking
              ? "stacking onto the marked column"
              : atEnd
                ? "adding at the end"
                : afterId === null
                  ? "adding at the start"
                  : "adding after the marked column"}
          </span>
          {columns.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setCursor(null)}
                className="rounded px-1.5 py-0.5 text-text-dim hover:text-accent"
              >
                &#8676; start
              </button>
              <button
                type="button"
                onClick={() => setCursor("end")}
                className="rounded px-1.5 py-0.5 text-text-dim hover:text-accent"
              >
                end &#8677;
              </button>
              <span className="ml-auto hidden text-text-faint sm:inline">
                tap a column to insert after it
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      {chordDraft !== null && editable ? (
        <form
          className="flex gap-2 border-t border-border-subtle p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (part) await setChord(part, editable.id, chordDraft);
            setChordDraft(null);
          }}
        >
          <Input
            autoFocus
            value={chordDraft}
            onChange={(e) => setChordDraft(e.target.value)}
            placeholder="Chord above this column, e.g. Am"
            aria-label="Chord"
          />
          <Button type="submit" variant="primary">
            Set
          </Button>
          <Button type="button" variant="ghost" onClick={() => setChordDraft(null)}>
            Cancel
          </Button>
        </form>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-border-subtle px-3 py-2">
        <div className="flex items-center overflow-hidden rounded-md border border-border-subtle">
          <button
            type="button"
            disabled={!editable || editable.repeat <= 1}
            onClick={() => editable && bumpColumnRepeat(editable, -1)}
            className="px-2.5 py-1.5 text-sm disabled:opacity-30"
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
            &times;{editable?.repeat ?? 1}
          </span>
          <button
            type="button"
            disabled={!editable}
            onClick={() => editable && bumpColumnRepeat(editable, 1)}
            className="px-2.5 py-1.5 text-sm disabled:opacity-30"
            aria-label="Repeat one more time"
          >
            +
          </button>
        </div>

        <Button
          disabled={!editable}
          onClick={() => editable && bumpColumnRepeat(editable, 3)}
          title="Four of these"
        >
          &times;4
        </Button>

        <Button
          variant={stacking ? "primary" : "secondary"}
          disabled={!editable}
          onClick={() => setStacking((on) => !on)}
          title="Keep adding notes to this column to build a chord"
        >
          stack
        </Button>

        <Button
          disabled={!part}
          onClick={async () => {
            if (!part) return;
            const inserted = await insertBarline(part, columns, afterId);
            setStacking(false);
            advance(inserted.id);
          }}
          title="Barline"
        >
          |
        </Button>

        <Button
          disabled={!editable}
          onClick={() => {
            if (!editable) return;
            // The three columns ending at the cursor, so this works mid-part
            // and not only at the tail.
            const playable = columns.filter((event) => event.kind !== "barline");
            const index = playable.findIndex((event) => event.id === editable.id);
            void groupAsTuplet(playable.slice(Math.max(0, index - 2), index + 1), 3);
          }}
          title="Make this column and the two before it a triplet"
        >
          3plt
        </Button>

        <Button disabled={!editable} onClick={() => setChordDraft("")} title="Chord above this column">
          chord
        </Button>

        <Button
          variant="danger"
          className="ml-auto"
          disabled={!focused}
          onClick={async () => {
            if (!focused) return;
            const index = columns.findIndex((event) => event.id === focused.id);
            const previous = columns[index - 1];
            await deleteColumn(focused.id);
            if (cursor !== "end") setCursor(previous ? previous.id : null);
          }}
          aria-label={atEnd ? "Delete the last column" : "Delete the marked column"}
        >
          &#9003;
        </Button>
      </div>

      <Fretboard tuning={tuning} onPress={press} disabled={!part} />
    </div>
  );
}
