"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { SongRow } from "@/lib/model";
import { readNotation } from "@/lib/rhythm/notation";
import { TempoControl } from "./TempoControl";
import { useClick } from "./useClick";

export interface ClickBarProps {
  song: Pick<SongRow, "id" | "bpm">;
  passes: readonly DrawnPass[];
  notationReady: boolean;
}

const STOPPED_WORDS = {
  hidden: "Stopped because the screen was hidden. Start again when you are ready.",
  "audio-lost": "Stopped because the device took the audio. Start again when you are ready.",
  "fell-behind": "Stopped because the click could not keep time. Start again when you are ready.",
} as const;

/* The shape is set by data-level on the box; nothing animates. */
const SHAPE =
  "block transition-none border-2 border-text-dim rounded-full h-3 w-3 " +
  "group-data-[level=soft]:h-2.5 group-data-[level=soft]:w-2.5 group-data-[level=soft]:border-accent group-data-[level=soft]:bg-accent " +
  "group-data-[level=beat]:h-5 group-data-[level=beat]:w-5 group-data-[level=beat]:border-accent group-data-[level=beat]:bg-accent " +
  "group-data-[level=accent]:h-8 group-data-[level=accent]:w-8 group-data-[level=accent]:rounded-none group-data-[level=accent]:border-accent group-data-[level=accent]:bg-accent";

export function ClickBar({ song, passes, notationReady }: ClickBarProps) {
  const score = useMemo(() => readNotation(passes), [passes]);
  const [wantFollow, setWantFollow] = useState(true);
  const follow = wantFollow && score.timedFromStart;
  const { state, phase, soundless, stopped, usable, start, stop, beatRef } = useClick({
    bpm: song.bpm,
    score,
    follow,
  });
  const idle = state === "idle";
  const stopRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!idle) stopRef.current?.focus();
  }, [idle]);

  let words: string;
  if (usable === null) words = "Set a tempo to use the click.";
  else if (idle) {
    words = stopped
      ? STOPPED_WORDS[stopped]
      : follow
        ? "Click follows the notation."
        : "Click is a plain beat.";
  } else if (phase === "following") words = "Following the notation.";
  else if (phase === "plain") words = "Plain beat.";
  else words = "Counting in.";

  return (
    <div
      data-testid="click-bar"
      className="no-print sticky bottom-0 z-10 -mx-4 mt-4 border-t border-border-subtle bg-bg px-4 py-2"
    >
      <div className="flex items-center gap-2">
        {idle ? (
          <Button
            variant="primary"
            data-testid="click-start"
            className="h-11 w-[86px] shrink-0"
            disabled={usable === null || !notationReady}
            onClick={start}
          >
            Start click
          </Button>
        ) : (
          <div
            ref={beatRef}
            data-testid="click-beat"
            data-level=""
            aria-hidden="true"
            className="group relative flex transition-none h-11 w-[86px] shrink-0 items-center justify-center"
          >
            <span className={SHAPE} />
            <span
              data-role="count"
              className="absolute inset-0 flex transition-none items-center justify-center font-mono text-sm font-semibold text-accent-text"
            />
          </div>
        )}
        {idle ? (
          score.timedFromStart ? (
            <Button
              data-testid="click-follow"
              className="h-11"
              aria-pressed={wantFollow}
              onClick={() => setWantFollow((on) => !on)}
            >
              {wantFollow ? "Following notation" : "Plain beat"}
            </Button>
          ) : null
        ) : (
          <Button ref={stopRef} data-testid="click-stop" className="h-11" onClick={stop}>
            Stop
          </Button>
        )}
        <span className="ml-auto">
          <TempoControl song={song} variant="bar" />
        </span>
      </div>
      <p data-testid="click-state" role="status" className="mt-1 text-xs text-text-dim">
        {words}
      </p>
      {!idle ? (
        <p data-testid="click-help" className="text-xs text-text-dim">
          {soundless
            ? "No sound on this device. The beat is still shown."
            : "Can't hear it? Check the silent switch and volume."}
        </p>
      ) : null}
    </div>
  );
}
