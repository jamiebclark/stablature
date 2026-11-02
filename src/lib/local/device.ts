/**
 * Per-device identity and clock.
 *
 * The node id has to be stable across reloads and available *synchronously*,
 * because the clock needs it before the first write can be stamped. That rules
 * out keeping it in IndexedDB (async) and makes localStorage the right home
 * for it, despite everything else living in Dexie.
 *
 * One id per device, not per tab: two tabs on the same machine write through
 * the same local store, so they are never concurrent with each other and
 * sharing an id is correct.
 */

import { HlcClock, randomNodeId } from "../hlc";

const NODE_ID_KEY = "stablature.nodeId";

/** Just enough of the Storage interface to be injectable in tests. */
export type NodeIdStorage = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): NodeIdStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Private browsing and some embedded webviews throw on access rather than
    // returning undefined.
    return null;
  }
}

/**
 * Stable id for this device, minting and persisting one on first call.
 *
 * If storage is unavailable the id is ephemeral, which is survivable: a new id
 * only costs us the tiebreak on genuinely simultaneous same-field edits.
 */
export function getDeviceNodeId(storage: NodeIdStorage | null = defaultStorage()): string {
  if (!storage) return randomNodeId();

  try {
    const existing = storage.getItem(NODE_ID_KEY);
    if (existing) return existing;
    const minted = randomNodeId();
    storage.setItem(NODE_ID_KEY, minted);
    return minted;
  } catch {
    return randomNodeId();
  }
}

let clock: HlcClock | undefined;

/** The device's clock. Every local write must be stamped by this one instance. */
export function getClock(): HlcClock {
  clock ??= new HlcClock(getDeviceNodeId());
  return clock;
}

/** Test seam: drop the memoised clock so a test can install its own. */
export function resetClock(replacement?: HlcClock): void {
  clock = replacement;
}
