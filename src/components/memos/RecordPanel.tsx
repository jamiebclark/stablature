"use client";

/** The recording row on a part's card (contracts/memo-ui.md §3). */

import { useState } from "react";
import { Button } from "@/components/ui";
import { downloadName, formatClock } from "@/lib/memos/words";
import type { Recorder, RecorderSnapshot } from "@/lib/memos/recorder";
import { saveClip } from "./download";

export function RecordPanel({
  rec,
  snap,
  songTitle,
  partLabel,
}: {
  rec: Recorder;
  snap: RecorderSnapshot;
  songTitle: string;
  partLabel: string;
}) {
  const [confirming, setConfirming] = useState(false);

  if (snap.phase === "held") {
    return (
      <div data-testid="record-panel" className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <Button data-testid="record-retry" onClick={() => void rec.retrySave()}>
          Try again
        </Button>
        <Button
          data-testid="record-download-held"
          onClick={() => {
            const held = rec.downloadHeld();
            if (!held) return;
            saveClip(
              held.bytes,
              held.format,
              downloadName({ songTitle, partLabel, label: null, recordedAt: Date.now(), format: held.format }),
            );
          }}
        >
          Download the clip
        </Button>
        <Button data-testid="record-discard" variant="danger" onClick={() => rec.discard()}>
          Discard
        </Button>
      </div>
    );
  }

  return (
    <div data-testid="record-panel" className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="font-medium text-danger" aria-hidden>
        ●
      </span>
      <span data-testid="record-elapsed" className="tabular-nums">
        {formatClock(snap.elapsedMs)}
      </span>
      <span
        data-testid="record-left"
        className={`tabular-nums ${snap.warn ? "font-semibold text-danger" : "text-text-dim"}`}
      >
        {snap.warn ? `Only ${formatClock(snap.leftMs)} left` : `${formatClock(snap.leftMs)} left`}
      </span>
      <span
        data-testid="record-level"
        aria-hidden
        className="inline-block h-2 w-24 overflow-hidden rounded bg-bg-sunken"
      >
        <span className="block h-full bg-accent" style={{ width: `${Math.round(snap.level * 100)}%` }} />
      </span>
      <Button data-testid="record-stop" variant="primary" onClick={() => rec.stop()}>
        Stop
      </Button>
      {confirming ? (
        <>
          <Button
            data-testid="record-discard-confirm"
            variant="danger"
            onClick={() => {
              setConfirming(false);
              rec.discard();
            }}
          >
            Yes, discard
          </Button>
          <Button onClick={() => setConfirming(false)}>Keep recording</Button>
        </>
      ) : (
        <Button data-testid="record-discard" variant="danger" onClick={() => setConfirming(true)}>
          Discard
        </Button>
      )}
      <span data-testid="record-announce" aria-live="polite" className="sr-only">
        {snap.announce}
      </span>
    </div>
  );
}
