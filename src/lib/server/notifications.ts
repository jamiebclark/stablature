/**
 * Fan-out for "something changed".
 *
 * One Postgres LISTEN connection for the whole process, fanned out in memory
 * to however many clients have an open event stream. LISTEN/NOTIFY rather than
 * a bare in-process emitter so this keeps working if the app ever runs as more
 * than one container -- which is cheap to get right now and painful to retrofit.
 */

import { sql } from "@/db/client";
import { SYNC_CHANNEL } from "./sync";

type Listener = (cursor: number) => void;

const listeners = new Set<Listener>();
let listening: Promise<unknown> | undefined;

function ensureListening(): Promise<unknown> {
  listening ??= sql.listen(SYNC_CHANNEL, (payload) => {
    const cursor = Number(payload);
    for (const listener of listeners) {
      listener(Number.isFinite(cursor) ? cursor : 0);
    }
  });
  return listening;
}

/** Subscribe until the returned function is called. */
export async function subscribeToChanges(listener: Listener): Promise<() => void> {
  await ensureListening();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
