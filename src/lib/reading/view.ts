/**
 * Which way the staff reads: frets (as written), notes, or intervals.
 *
 * A reader's preference, kept on this device only -- it is not song data, never syncs and never enters
 * the export. React-free; `components/reading/useStaffView.ts` wraps it in `useSyncExternalStore`.
 *
 * Storage is untrusted at every touch: it may be missing (private mode, SSR), may throw on read or write,
 * and may hold anything. Whatever is not one of the three views reads as frets and is left where it is.
 * Once a view has been set, the in-memory value wins over the store for as long as a write is refused, so a
 * refused write still changes the screen. With a listener's first subscribe, storage is read again.
 */

export const STAFF_VIEWS = ["frets", "notes", "intervals"] as const;
export type StaffView = (typeof STAFF_VIEWS)[number];
export const STAFF_VIEW_KEY = "stablature.staffView";

type Store = Pick<Storage, "getItem" | "setItem">;

/** Anything unknown is frets. */
export function readStaffView(raw: unknown): StaffView {
  return STAFF_VIEWS.find((v) => v === raw) ?? "frets";
}

/** `undefined` means the browser's `localStorage`; `null` means there is none. */
let override: Store | null | undefined;
let current: StaffView | null = null;
/** The last write was refused, so memory is the only place the choice lives. */
let unwritten = false;
const listeners = new Set<() => void>();

function store(): Store | null {
  if (override !== undefined) return override;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export function getStaffView(): StaffView {
  if (current !== null) return current;
  try {
    return readStaffView(store()?.getItem(STAFF_VIEW_KEY));
  } catch {
    return "frets";
  }
}

function notify() {
  for (const listener of [...listeners]) listener();
}

/** Never throws. */
export function setStaffView(view: StaffView): void {
  current = readStaffView(view);
  const target = store();
  // With no storage nothing is written, so storage can never be the truth again: keep the choice for the visit.
  unwritten = target === null;
  try {
    target?.setItem(STAFF_VIEW_KEY, current);
  } catch {
    unwritten = true;
    // Refused (quota, private mode): the screen still changes, the choice just is not remembered.
  }
  notify();
}

function onStorage(event: StorageEvent) {
  // A null key is `storage.clear()`: this key went with it.
  if (event.key !== null && event.key !== STAFF_VIEW_KEY) return;
  unwritten = false;
  current = readStaffView(event.key === null ? null : event.newValue);
  notify();
}

export function subscribeStaffView(listener: () => void): () => void {
  if (listeners.size === 0) {
    // Nothing was listening for storage events, so another tab may have chosen since: storage is the truth again.
    if (!unwritten && current !== null) {
      try {
        current = readStaffView(store()?.getItem(STAFF_VIEW_KEY));
      } catch {
        // Unreadable: keep what the screen shows.
      }
    }
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function resetStaffViewForTest(storage?: Store | null): void {
  override = storage;
  current = null;
  unwritten = false;
}
