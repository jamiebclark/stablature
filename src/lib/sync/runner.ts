"use client";

/**
 * When to sync.
 *
 * Five triggers, because any one of them alone leaves a hole:
 *
 *  - On start, so opening the app catches up.
 *  - When the outbox grows, so something you just captured goes out in a
 *    second rather than whenever the next timer happens to fire. Without this
 *    a riff can sit on the device for a full minute, which is exactly the
 *    window in which a phone gets locked and pocketed.
 *  - On a server event, so a bandmate's edit appears without waiting.
 *  - On coming back online and on the tab becoming visible, which is the
 *    realistic end of an offline session -- you walk out of the rehearsal room
 *    with the phone in your pocket and unlock it later.
 *  - On a slow timer, because an event stream can be silently eaten by a
 *    reverse proxy, and a sync tool that has quietly stopped working is worse
 *    than one that is merely slow.
 */

import { liveQuery } from "dexie";
import { db } from "../local/db";
import { syncNow } from "./client";

/** Fallback cadence when the event stream is not delivering. */
const POLL_MS = 60_000;

/**
 * Settle time after a local write.
 *
 * Fast capture produces a write per tap, and pushing on every one would be a
 * request per note. One second is short enough to feel immediate and long
 * enough that a flurry of taps becomes a single push.
 */
const WRITE_DEBOUNCE_MS = 1_000;

let active: (() => void) | undefined;

/**
 * Start syncing. Idempotent, and returns a stop function.
 *
 * Safe to call from a component mount: a second call while already running
 * returns the existing stopper rather than opening a second event stream.
 */
export function startSync(): () => void {
  if (typeof window === "undefined") return () => {};
  if (active) return active;

  let disposed = false;
  let running = false;
  let queued = false;

  /*
   * One cycle at a time, with at most one more queued. A burst of events (a
   * bandmate pushing a long offline session in several batches) should settle
   * into a single follow-up sync, not a stampede of overlapping ones.
   */
  const run = async (): Promise<void> => {
    if (disposed) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    try {
      await syncNow();
    } finally {
      running = false;
      if (queued && !disposed) {
        queued = false;
        void run();
      }
    }
  };

  const trigger = () => {
    void run();
  };

  let debounce: number | undefined;
  const triggerSoon = () => {
    window.clearTimeout(debounce);
    debounce = window.setTimeout(trigger, WRITE_DEBOUNCE_MS);
  };

  trigger();

  // Local writes are the most common reason to sync, and nothing else here
  // notices them: every other trigger is about the network or the clock.
  const outbox = liveQuery(() => db.outbox.count()).subscribe({
    next: (count) => {
      if (count > 0) triggerSoon();
    },
    error: () => {
      // A failed local query is not a reason to stop syncing; the poll covers it.
    },
  });

  const source = new EventSource("/api/sync/stream");
  source.onmessage = (event) => {
    try {
      const payload = JSON.parse(event.data) as { type?: string };
      if (payload.type === "changed") trigger();
    } catch {
      // A frame we cannot parse is not worth failing over; the poll will catch
      // whatever it was announcing.
    }
  };
  // EventSource reconnects by itself, so there is nothing to do on error
  // beyond not treating it as fatal.

  const onVisible = () => {
    if (document.visibilityState === "visible") trigger();
  };

  window.addEventListener("online", trigger);
  document.addEventListener("visibilitychange", onVisible);
  const timer = window.setInterval(trigger, POLL_MS);

  active = () => {
    disposed = true;
    window.clearTimeout(debounce);
    outbox.unsubscribe();
    window.clearInterval(timer);
    window.removeEventListener("online", trigger);
    document.removeEventListener("visibilitychange", onVisible);
    source.close();
    active = undefined;
  };

  return active;
}
