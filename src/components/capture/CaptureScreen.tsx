"use client";

/**
 * The capture screen.
 *
 * This is the screen the whole app exists for: someone is playing a riff at
 * you and you have one hand and about four seconds. Every decision here is in
 * service of that.
 *
 *  - A tap always appends a new column. Correcting goes through backspace
 *    rather than through tap-to-overwrite, because an ambiguous tap costs more
 *    than an extra button press -- playing 7 then 5 is far more common than
 *    meaning to fix a 7 into a 5.
 *  - Stacking a chord is an explicit mode, since bass is mostly single notes.
 *  - The repeat stepper acts on the last column, which is almost always the one
 *    you mean, and turns "same note sixteen times" into two taps.
 *  - The staff follows the tail, so the newest column is never off screen.
 */

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, Input, Loading } from "@/components/ui";
import {
  appendBarline,
  appendNote,
  bumpColumnRepeat,
  createPart,
  deleteLastColumn,
  setChord,
  stackNote,
  tripletFromTail,
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

export function CaptureScreen({ songId, partId }: { songId: string; partId?: string }) {
  const router = useRouter();
  const song = useSong(songId);
  const tuning = useSongTuning(song);
  const parts = useParts(songId);
  const pending = usePendingWrites();

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

  const lastColumn: EventRow | undefined = events
    ?.filter((event) => event.kind !== "barline")
    .at(-1);

  const press = useCallback(
    async (stringIndex: number, fret: FretValue) => {
      if (!part) return;
      if (stacking && lastColumn) {
        await stackNote(lastColumn, stringIndex, fret);
        // One stack per toggle: holding the mode on invites accidental chords.
        setStacking(false);
        return;
      }
      await appendNote(part, stringIndex, fret);
    },
    [part, stacking, lastColumn],
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
            router.push(`/songs/${songId}/capture/${created.id}`);
          }}
          aria-label="Add a part"
        >
          + part
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {part ? (
          <TabStaff
            events={events ?? []}
            tuning={tuning}
            annotations={annotations ?? []}
            followTail
            activeEventId={lastColumn?.id ?? null}
          />
        ) : (
          <p className="py-6 text-center text-sm text-text-dim">
            Add a part to start capturing.
          </p>
        )}
      </div>

      {chordDraft !== null && lastColumn ? (
        <form
          className="flex gap-2 border-t border-border-subtle p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (part) await setChord(part, lastColumn.id, chordDraft);
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
            disabled={!lastColumn || lastColumn.repeat <= 1}
            onClick={() => lastColumn && bumpColumnRepeat(lastColumn, -1)}
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
            &times;{lastColumn?.repeat ?? 1}
          </span>
          <button
            type="button"
            disabled={!lastColumn}
            onClick={() => lastColumn && bumpColumnRepeat(lastColumn, 1)}
            className="px-2.5 py-1.5 text-sm disabled:opacity-30"
            aria-label="Repeat one more time"
          >
            +
          </button>
        </div>

        <Button
          disabled={!lastColumn}
          onClick={() => lastColumn && bumpColumnRepeat(lastColumn, 3)}
          title="Four of these"
        >
          &times;4
        </Button>

        <Button
          variant={stacking ? "primary" : "secondary"}
          disabled={!lastColumn}
          onClick={() => setStacking((on) => !on)}
          title="Add the next note to the current column instead of a new one"
        >
          stack
        </Button>

        <Button disabled={!part} onClick={() => part && appendBarline(part)} title="Barline">
          |
        </Button>

        <Button
          disabled={!part}
          onClick={() => part && tripletFromTail(part.id, 3)}
          title="Make the last three columns a triplet"
        >
          3plt
        </Button>

        <Button disabled={!lastColumn} onClick={() => setChordDraft("")}>
          chord
        </Button>

        <Button
          variant="danger"
          className="ml-auto"
          disabled={!events || events.length === 0}
          onClick={() => part && deleteLastColumn(part.id)}
          aria-label="Delete the last column"
        >
          &#9003;
        </Button>
      </div>

      <Fretboard tuning={tuning} onPress={press} disabled={!part} />
    </div>
  );
}
