"use client";

/**
 * One memo's playback: one `<audio>` element per memo, its bytes read from this device only when first needed,
 * and `sound.claim` so a second sound (another memo, the recorder) stops this one first (FR-040).
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { db } from "@/lib/local/db";
import * as sound from "@/lib/memos/sound";

export function useMemoPlayer(memoId: string, format: string) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const loaded = useRef(false);
  const urlRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [canPlay, setCanPlay] = useState(true);
  const [decodeFailed, setDecodeFailed] = useState(false);
  const owner = `memo:${memoId}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) setCanPlay(audio.canPlayType(format) !== "");
  }, [format]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      sound.release(owner);
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [owner],
  );

  const ensureLoaded = useCallback(async (): Promise<boolean> => {
    const audio = audioRef.current;
    if (!audio) return false;
    if (loaded.current) return true;
    const entry = await db.memoAudio.get(memoId);
    if (!entry) return false;
    urlRef.current = URL.createObjectURL(new Blob([entry.bytes], { type: entry.format }));
    audio.src = urlRef.current;
    loaded.current = true;
    return true;
  }, [memoId]);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (!(await ensureLoaded())) return;
    sound.claim(owner, () => audio.pause());
    try {
      await audio.play();
    } catch (err) {
      sound.release(owner);
      // A pause (another sound claimed the device) aborts a pending play(); that is not a decode failure.
      if (!(err instanceof DOMException && err.name === "AbortError")) setDecodeFailed(true);
    }
  }, [ensureLoaded, owner]);

  const seek = useCallback(
    async (ms: number) => {
      setElapsedMs(ms);
      if (await ensureLoaded()) {
        const audio = audioRef.current;
        if (audio) audio.currentTime = ms / 1000;
      }
    },
    [ensureLoaded],
  );

  const audioProps = {
    ref: audioRef,
    preload: "none" as const,
    "data-testid": "memo-audio",
    onPlay: () => setPlaying(true),
    onPause: () => {
      setPlaying(false);
      sound.release(owner);
    },
    onEnded: () => {
      setPlaying(false);
      setElapsedMs(0);
      sound.release(owner);
    },
    onTimeUpdate: () => setElapsedMs(Math.floor((audioRef.current?.currentTime ?? 0) * 1000)),
    onError: () => {
      if (loaded.current) setDecodeFailed(true);
    },
  };

  return { audioProps, playing, elapsedMs, canPlay, decodeFailed, toggle, seek };
}

function subscribeOnline(fn: () => void): () => void {
  window.addEventListener("online", fn);
  window.addEventListener("offline", fn);
  return () => {
    window.removeEventListener("online", fn);
    window.removeEventListener("offline", fn);
  };
}

/** Whether the browser thinks it is online; the server's guess is "online". */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
