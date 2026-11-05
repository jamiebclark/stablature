"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button, Sheet } from "@/components/ui";
import { setSongTempo } from "@/lib/local/editing";
import type { SongRow } from "@/lib/model";
import { addTap, EMPTY_RUN, readTaps, type TapReading, type TapRun } from "@/lib/rhythm/tap";
import { TAP_TEMPO_MAX, TAP_TEMPO_MIN, usableTempo } from "@/lib/rhythm/tempo";

export interface TempoControlProps {
  song: Pick<SongRow, "id" | "bpm">;
  variant: "header" | "bar";
}

const RANGE = `Tempo runs from ${TAP_TEMPO_MIN} to ${TAP_TEMPO_MAX}.`;

function words(reading: TapReading): string {
  switch (reading.kind) {
    case "waiting":
      return reading.tapsNeeded === 3 ? "Tap in time" : reading.tapsNeeded === 2 ? "Keep tapping" : "Once more";
    case "reading":
      return String(reading.bpm);
    case "out-of-range":
      return reading.bpm === null
        ? `Too slow to read. ${RANGE}`
        : `${reading.bpm} is out of range. ${RANGE}`;
  }
}

export function TempoControl({ song, variant }: TempoControlProps) {
  const [open, setOpen] = useState(false);
  const tempo = usableTempo(song.bpm);
  return (
    <>
      <button
        type="button"
        data-testid="tempo-control"
        aria-haspopup="dialog"
        aria-label={tempo === null ? "Tempo: not given" : `Tempo: ${tempo} bpm`}
        onClick={() => setOpen(true)}
        className={
          variant === "header"
            ? "-my-2 shrink-0 py-2 font-mono text-[0.7rem] text-text-dim hover:text-accent"
            : "h-11 shrink-0 rounded-md border border-border-subtle bg-bg-raised px-3 font-mono text-sm text-text-dim"
        }
      >
        {tempo === null ? "no tempo" : `${tempo} bpm`}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} label="Tempo">
        <TempoSheet song={song} onClose={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

function TempoSheet({ song, onClose }: { song: Pick<SongRow, "id" | "bpm">; onClose: () => void }) {
  const [run, setRun] = useState<TapRun>(EMPTY_RUN);
  const padRef = useRef<HTMLButtonElement>(null);
  // A key press is followed by a click with detail 0 that must not count twice.
  const keyCounted = useRef(false);
  const stored = usableTempo(song.bpm);
  const reading = readTaps(run);
  const tap = (time: number) => setRun((r) => addTap(r, time));

  const onPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    tap(e.timeStamp);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== " " && e.key !== "Enter") return;
    e.preventDefault();
    if (e.repeat) return;
    keyCounted.current = true;
    tap(e.timeStamp);
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Tempo</h2>
        <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onClose}>
          close
        </Button>
      </div>
      <p data-testid="tempo-stored" className="text-xs text-text-dim">
        {stored === null ? "This song has no tempo" : `This song: ${stored} bpm`}
      </p>
      <p data-testid="tempo-reading" role="status" className="min-h-8 font-mono text-2xl">
        {words(reading)}
      </p>
      <button
        ref={(el) => {
          padRef.current = el;
          // The dialog opens in its own effect, after this one, and focuses its first control.
          if (el) requestAnimationFrame(() => el.focus());
        }}
        type="button"
        data-testid="tap-pad"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
        onKeyUp={() => {
          keyCounted.current = false;
        }}
        onClick={(e) => {
          if (e.detail !== 0) return;
          if (keyCounted.current) {
            keyCounted.current = false;
            return;
          }
          tap(e.timeStamp);
        }}
        className="min-h-24 w-full touch-none select-none rounded-md border border-border-subtle bg-bg-raised text-lg"
      >
        Tap here
      </button>
      <div className="min-h-11">
        {reading.kind === "reading" ? (
          <Button
            data-testid="tempo-set"
            className="h-11 w-full"
            onClick={async () => {
              await setSongTempo(song.id, reading.bpm);
              onClose();
            }}
          >
            Set {reading.bpm} bpm
          </Button>
        ) : null}
      </div>
    </div>
  );
}
