"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui";
import { usePanel } from "@/components/reading/usePanel";
import type { DrawnPass } from "@/lib/arrangement/passes";
import type { SongRow } from "@/lib/model";
import {
  effective,
  getClick,
  getLoop,
  getNotes,
  getSpeed,
  setClick,
  setLoop,
  setNotes,
  setSpeed,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_STEP,
  subscribe as subscribePlay,
} from "@/lib/playback/choices";
import type { Tuning } from "@/lib/tunings";
import { notationColumns, readNotation, type ColumnTick } from "@/lib/rhythm/notation";
import { TempoControl } from "./TempoControl";
import { useScreenKeys } from "@/components/keys/useScreenKeys";
import { useClick } from "./useClick";

export interface ClickBarProps {
  song: Pick<SongRow, "id" | "bpm">;
  passes: readonly DrawnPass[];
  notationReady: boolean;
  /** Drawn in the open panel: the view control and the way to capture. */
  cluster?: ReactNode;
  /** The column the player is on, when following. */
  onColumn?: (column: ColumnTick | null) => void;
  /** Called as the click starts, so a keyed reading position is cleared (the click always starts from the top). */
  onStart?: () => void;
  /** Whether the click is stopped, kept current for the reader's keys. */
  idleRef?: { current: boolean };
  /** Receives the bar's root, so the reading position can keep scroll padding as tall as the bar. */
  rootRef?: (el: HTMLDivElement | null) => void;
  /** Absent: Notes is never offered and the bar is exactly the click's. */
  playback?: { readonly scope: "song" | "part"; readonly tuning: Tuning | null | undefined };
}

/** Every message the bar can show. The live words and their hidden ghosts both read this, so a new message has a ghost. */
export const CLICK_WORDS = {
  noTempo: "Set a tempo to use the click.",
  idleFollowing: "Click follows the notation.",
  idlePlainNothingTimed: "Click is a plain beat. Nothing at the start has a note length to follow.",
  idlePlain: "Click is a plain beat.",
  stopped: {
    hidden: "Stopped because the screen was hidden. Start again when you are ready.",
    "audio-lost": "Stopped because the device took the audio. Start again when you are ready.",
    "fell-behind": "Stopped because the click could not keep time. Start again when you are ready.",
  },
  notes: {
    noTuning: "Add a tuning to hear the notes.",
    written: "Notes play the lengths written.",
    some: "Notes with no length take the last length, or one beat.",
    none: "No note has a length, so each plays one beat.",
    empty: "There are no notes to play here.",
  },
  running: {
    playing: "Playing.",
    counting: "Counting in.",
    following: "Following the notation.",
    plain: "Plain beat.",
  },
  help: {
    sound: "Can't hear it? Check the silent switch and volume.",
    soundless: "No sound on this device. The beat is still shown.",
  },
} as const;

const IDLE_GHOSTS: string[] = [
  CLICK_WORDS.noTempo,
  CLICK_WORDS.idleFollowing,
  CLICK_WORDS.idlePlainNothingTimed,
  CLICK_WORDS.idlePlain,
  ...Object.values(CLICK_WORDS.stopped),
  ...Object.values(CLICK_WORDS.notes),
];
const RUNNING_GHOSTS: [string, string][] = Object.values(CLICK_WORDS.running).flatMap((w) =>
  Object.values(CLICK_WORDS.help).map((h): [string, string] => [w, h]),
);

/* The shape is set by data-level on the box; nothing animates. */
const SHAPE =
  "block transition-none border-2 border-text-dim rounded-full h-3 w-3 " +
  "group-data-[level=soft]:h-2.5 group-data-[level=soft]:w-2.5 group-data-[level=soft]:border-accent group-data-[level=soft]:bg-accent " +
  "group-data-[level=beat]:h-5 group-data-[level=beat]:w-5 group-data-[level=beat]:border-accent group-data-[level=beat]:bg-accent " +
  "group-data-[level=accent]:h-8 group-data-[level=accent]:w-8 group-data-[level=accent]:rounded-none group-data-[level=accent]:border-accent group-data-[level=accent]:bg-accent";

export function ClickBar({ song, passes, notationReady, cluster, onColumn, onStart, idleRef, rootRef, playback }: ClickBarProps) {
  const [open, setOpen] = usePanel("play-cluster");
  const score = useMemo(() => readNotation(passes), [passes]);
  const columns = useMemo(() => notationColumns(passes), [passes]);
  const [wantFollow, setWantFollow] = useState(true);
  const follow = wantFollow && score.timedFromStart;
  // A part opens with Notes and Loop on, without writing the whole-song choice.
  const storedNotes = useSyncExternalStore(subscribePlay, getNotes, () => false);
  const notes = !!playback && (playback.scope === "part" || storedNotes);
  useEffect(() => {
    if (playback?.scope === "part") setLoop(true);
  }, [playback?.scope]);
  const speed = useSyncExternalStore(
    subscribePlay,
    () => getSpeed(song.id),
    () => 100,
  );
  const clickOn = useSyncExternalStore(subscribePlay, getClick, () => true);
  const loopOn = useSyncExternalStore(subscribePlay, getLoop, () => false);
  const playTuning = playback?.tuning;
  const play = useMemo(
    () => (notes && playTuning ? { passes, tuning: playTuning } : null),
    [notes, playTuning, passes],
  );
  const { state, phase, soundless, stopped, ended, usable, rule, start, stop, restart, beatRef } = useClick({
    play,
    speed,
    bpm: song.bpm,
    score,
    follow,
    columns,
    onColumn,
  });
  const idle = state === "idle";
  useEffect(() => {
    if (idleRef) idleRef.current = idle;
  }, [idleRef, idle]);
  const ready = usable !== null && notationReady && (!notes || (!!playback?.tuning && rule !== "empty"));
  const begin = () => {
    onStart?.();
    start();
  };
  useScreenKeys("play", {
    "toggle-click": () => {
      if (!idle) return stop();
      if (!ready) return false;
      begin();
    },
    restart: () => {
      if (!ready) return false;
      onStart?.();
      if (idle) start();
      else restart();
    },
  });
  const stopRef = useRef<HTMLButtonElement>(null);

  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!idle) stopRef.current?.focus();
    // After a run ends by itself, a Stop that held focus has gone; focus returns to the start button.
    else if (ended && (!document.activeElement || document.activeElement === document.body)) startRef.current?.focus();
  }, [idle, ended]);

  let words: string;
  if (usable === null) words = CLICK_WORDS.noTempo;
  else if (idle) {
    words = stopped
      ? CLICK_WORDS.stopped[stopped]
      : notes
        ? !playback?.tuning
          ? CLICK_WORDS.notes.noTuning
          : CLICK_WORDS.notes[rule ?? "empty"]
        : follow
        ? CLICK_WORDS.idleFollowing
        : wantFollow
          ? CLICK_WORDS.idlePlainNothingTimed
          : CLICK_WORDS.idlePlain;
  } else if (notes) words = phase === "count-in" || phase === null ? CLICK_WORDS.running.counting : CLICK_WORDS.running.playing;
  else if (phase === "following") words = CLICK_WORDS.running.following;
  else if (phase === "plain") words = CLICK_WORDS.running.plain;
  else words = CLICK_WORDS.running.counting;

  // Idle with nothing to report is read aloud, and shown only when the panel is open.
  const quiet = idle && usable !== null && !stopped && !open && !(notes && (!playback?.tuning || rule === "empty"));

  return (
    <div
      ref={rootRef}
      data-testid="click-bar"
      className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-border-subtle bg-bg py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] wide:pl-[max(0.5rem,env(safe-area-inset-left))] wide:pr-[max(0.5rem,env(safe-area-inset-right))]"
    >
      <div className="click-bar-inner mx-auto max-w-screen-2xl">
      <div
        id="panel-play-cluster-body"
        data-testid="panel-play-cluster-body"
        hidden={!open}
        className={`mb-1.5 flex-wrap items-center gap-2 ${open ? "flex" : "hidden"}`}
      >
        {idle && score.timedFromStart ? (
          <Button
            data-testid="click-follow"
            aria-pressed={wantFollow}
            onClick={() => setWantFollow((on) => !on)}
          >
            {wantFollow ? "Following notation" : "Plain beat"}
          </Button>
        ) : null}
        {playback ? (
          <>
            {playback.scope === "song" ? (
              <Button
                data-testid="play-notes"
                aria-pressed={notes}
                disabled={!idle}
                onClick={() => setNotes(!notes)}
              >
                {`Notes ${notes ? "on" : "off"}`}
              </Button>
            ) : null}
            {notes ? (
              <>
                <Button data-testid="play-click" aria-pressed={clickOn} onClick={() => setClick(!clickOn)}>
                  {`Click ${clickOn ? "on" : "off"}`}
                </Button>
                <Button data-testid="play-loop" aria-pressed={loopOn} onClick={() => setLoop(!loopOn)}>
                  {`Loop ${loopOn ? "on" : "off"}`}
                </Button>
              </>
            ) : null}
            {playback ? (
              <span className="flex items-center gap-1" role="group" aria-label="Speed">
                <Button
                  data-testid="play-slower"
                  aria-label="Slower"
                  disabled={speed <= SPEED_MIN}
                  onClick={() => setSpeed(song.id, speed - SPEED_STEP)}
                >
                  Slower
                </Button>
                <span data-testid="play-speed" className="min-w-[3.25rem] text-center font-mono text-sm">{speed < 100 && usable !== null ? `${speed}% · ${Math.round(effective(usable, speed))} bpm` : `${speed}%`}</span>
                <Button
                  data-testid="play-faster"
                  aria-label="Faster"
                  disabled={speed >= SPEED_MAX}
                  onClick={() => setSpeed(song.id, speed + SPEED_STEP)}
                >
                  Faster
                </Button>
              </span>
            ) : null}
          </>
        ) : null}
        {cluster}
      </div>
      <div className="click-bar-row">
        <div className="click-lead flex items-center gap-2">
        {idle ? (
          <Button
            variant="primary"
            data-testid="click-start"
            className="h-11 w-[86px] shrink-0"
            ref={startRef}
            disabled={!ready}
            onClick={begin}
          >
            {notes ? "Play" : "Start click"}
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
        {idle ? null : (
          <Button ref={stopRef} data-testid="click-stop" className="h-11" onClick={stop}>
            Stop
          </Button>
        )}
        </div>
        <div className="click-status">
          {IDLE_GHOSTS.map((g) => (
            <span key={g} aria-hidden="true" className="click-ghost" data-ghost={g} />
          ))}
          {RUNNING_GHOSTS.map(([g, h]) => (
            <span key={g + h} aria-hidden="true" className="click-ghost click-ghost-2" data-ghost={g} data-ghost-2={h} />
          ))}
          <div className="click-live">
            <p
              data-testid="click-state"
              role="status"
              className={quiet ? "sr-only" : "text-xs text-text-dim"}
            >
              {words}
            </p>
            {!idle ? (
              <p data-testid="click-help" className="text-xs text-text-dim">
                {soundless ? CLICK_WORDS.help.soundless : CLICK_WORDS.help.sound}
              </p>
            ) : null}
          </div>
        </div>
        <span className="click-tools flex items-center gap-2">
          <TempoControl song={song} variant="bar" speed={speed} />
          <Button
            data-testid="panel-play-cluster"
            className="min-w-[4.5rem]"
            aria-expanded={open}
            aria-controls="panel-play-cluster-body"
            onClick={() => setOpen(!open)}
          >
            {open ? "Less" : "More"}
          </Button>
        </span>
      </div>
      </div>
    </div>
  );
}
