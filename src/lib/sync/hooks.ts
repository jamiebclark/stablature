"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { getStatus, type SyncStatus } from "./client";

/**
 * Current sync state, read from the local store like everything else.
 *
 * Reactive because the engine writes its status into Dexie rather than into
 * React state -- which means the indicator is correct even though the engine
 * lives outside the component tree.
 */
export function useSyncStatus(): SyncStatus | undefined {
  return useLiveQuery(() => getStatus(), []);
}
