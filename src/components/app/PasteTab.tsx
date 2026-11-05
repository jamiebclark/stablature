"use client";

/**
 * Paste tab: type or paste ASCII tab, see it drawn, import it as a new part.
 *
 * Reading is derived from the text on every render path, so there is no read
 * button and no debounce. The preview is the same `TabStaff` every part uses.
 */

import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TabStaff } from "@/components/tab/TabStaff";
import { Button, Card } from "@/components/ui";
import { draftPart } from "@/lib/local/clipboard";
import { nextPartLabel } from "@/lib/local/editing";
import { importTab } from "@/lib/local/importing";
import type { EventRow, PartRow, SongRow, TuningRow } from "@/lib/model";
import type { Density } from "@/lib/tab/layout";
import { othersOnNull, readTab, type TabReading } from "@/lib/tab/reading";

const NO_SONGS: readonly SongRow[] = [];

interface Props {
  song: SongRow;
  tuning: TuningRow | undefined;
  tunings: readonly TuningRow[];
  /** The band's live songs; without them no other song is taken to sit on null. */
  bandSongs?: readonly SongRow[];
  parts: readonly PartRow[];
  eventsByPart: Record<string, EventRow[]>;
  density: Density;
  onClose: () => void;
  onImported: (partId: string) => void;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function PasteTab({
  song,
  tuning,
  tunings,
  bandSongs = NO_SONGS,
  parts,
  eventsByPart,
  density,
  onClose,
  onImported,
}: Props): ReactNode {
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const busy = useRef(false);
  const box = useRef<HTMLTextAreaElement>(null);
  const deferred = useDeferredValue(text);

  useEffect(() => {
    box.current?.focus();
  }, []);

  const songEvents = useMemo(() => Object.values(eventsByPart).flat(), [eventsByPart]);
  const reading: TabReading = useMemo(
    () =>
      readTab(deferred, {
        tuning: tuning ?? null,
        bandTunings: tunings,
        songEvents,
        othersOnNull: othersOnNull(song, bandSongs, tunings),
      }),
    [deferred, tuning, tunings, songEvents, song, bandSongs],
  );
  const draft = useMemo(
    () => (reading.kind === "ready" ? draftPart(reading.clipboard) : null),
    [reading],
  );

  const label = nextPartLabel(parts);

  let status = "Paste tab here.";
  let action: string | null = null;
  if (reading.kind === "refused") {
    const lined = reading.refusals.filter((r) => r.line !== null);
    if (lined.length === 1) status = `Line ${lined[0].line} could not be read. Nothing will be imported.`;
    else if (lined.length > 1)
      status = `${lined.length} lines could not be read. Nothing will be imported.`;
    else status = reading.refusals[0]?.reason ?? "This could not be read. Nothing will be imported.";
  } else if (reading.kind === "ready") {
    if (reading.fit.kind === "offer") {
      status = `Ready to import as part ${label} in ${reading.fit.name}.`;
      action = `Switch to ${reading.fit.name} and import`;
    } else {
      status = `Ready to import as part ${label}.`;
      action = `Import as part ${label}`;
    }
  }
  if (failure) status = failure;

  async function submit() {
    if (busy.current || reading.kind !== "ready") return;
    busy.current = true;
    setImporting(true);
    setFailure(null);
    try {
      const result = await importTab(song, deferred, reading.fitKey);
      if (result.kind === "changed") {
        setFailure("The song changed while this was open. Check the preview again.");
        return;
      }
      onClose();
      onImported(result.part.id);
    } catch {
      setFailure("Could not save this part. Nothing was changed.");
    } finally {
      busy.current = false;
      setImporting(false);
    }
  }

  return (
    <div data-testid="paste-tab" className="mb-4 min-w-0 no-print">
      <Card className="min-w-0">
        <textarea
          ref={box}
          aria-label="Tab text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFailure(null);
          }}
          rows={8}
          wrap="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="w-full overflow-x-auto rounded border border-border-subtle bg-bg-sunken p-2 font-mono text-base text-text"
        />

        <p role="status" aria-live="polite" className="my-2 text-sm text-text">
          {status}
        </p>

        {reading.kind === "refused" ? (
          <ul data-testid="paste-refusals" className="mb-2 grid min-w-0 gap-2">
            {reading.refusals
              .filter((r) => r.line !== null)
              .map((r, index) => (
                <li key={index} data-line={r.line ?? undefined} className="min-w-0 text-sm">
                  <span className="font-semibold text-danger">line {r.line}</span>
                  <code className="block overflow-x-auto whitespace-pre rounded bg-bg-sunken px-2 py-1 font-mono text-text">
                    {r.text}
                  </code>
                  <span className="text-text">{r.reason}</span>
                </li>
              ))}
          </ul>
        ) : null}

        {reading.kind === "ready" && draft ? (
          <>
            <TabStaff
              events={draft.events}
              annotations={draft.annotations}
              tuning={reading.tuning}
              density={density}
              surface="raised"
            />
            <p className="mt-2 text-sm text-text">
              Part {label}: {plural(reading.bars, "bar", "bars")},{" "}
              {plural(reading.columns, "column", "columns")}
            </p>
            {reading.fit.kind === "offer" ? (
              <p className="mt-1 text-sm text-text-dim">
                Tuning: this song will switch to {reading.fit.name}. Notes already in the song keep their
                pitch.
              </p>
            ) : null}
            {reading.notes.length > 0 ? (
              <ul data-testid="paste-notes" className="mt-1 grid min-w-0 gap-1 text-sm text-text-dim">
                {reading.notes.map((note, index) => (
                  <li key={index} className="min-w-0">
                    {note.text}
                  </li>
                ))}
              </ul>
            ) : null}
            {reading.ignored.length > 0 ? (
              <ul data-testid="paste-ignored" className="mt-1 grid min-w-0 gap-1 text-sm text-text-dim">
                {reading.ignored.map((note, index) => (
                  <li key={index} data-line={note.line} className="min-w-0">
                    line {note.line}:{" "}
                    <code className="block overflow-x-auto whitespace-pre font-mono">
                      {note.text}
                    </code>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {action ? (
            <Button variant="primary" disabled={importing} onClick={submit}>
              {action}
            </Button>
          ) : null}
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </Card>
    </div>
  );
}
