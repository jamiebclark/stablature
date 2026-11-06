/**
 * Which collapsible panels are open, kept on this device only -- not song data, never synced, never exported.
 * React-free; `components/reading/usePanel.ts` wraps it in `useSyncExternalStore`.
 *
 * Storage is untrusted at every touch: missing, throwing, or holding anything (`"[]"`, `"nope"`). Whatever
 * does not parse to an object of booleans reads as closed and is left where it is. Keys this version does not
 * know are kept on write. A refused write still changes the screen for the visit, because memory wins over
 * storage once a panel has been set. The server snapshot is closed.
 */

export const PANEL_IDS = ["song-tools", "song-arrange", "play-cluster"] as const;
export type PanelId = (typeof PANEL_IDS)[number];
export const PANELS_KEY = "stablature.panels";

type Store = Pick<Storage, "getItem" | "setItem">;

/** `undefined` means the browser's `localStorage`; `null` means there is none. */
let override: Store | null | undefined;
const memory = new Map<string, boolean>();
const listeners = new Set<() => void>();

/** Test seam: inject storage, and forget what this visit set. */
export function setPanelStorage(store: Store | null | undefined): void {
  override = store;
  memory.clear();
  notify();
}

function store(): Store | null {
  if (override !== undefined) return override;
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** The stored object, or `{}` for anything else. Never throws. */
function readAll(): Record<string, unknown> {
  try {
    const raw = store()?.getItem(PANELS_KEY);
    if (typeof raw !== "string") return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function getPanelOpen(id: PanelId): boolean {
  const remembered = memory.get(id);
  if (remembered !== undefined) return remembered;
  return readAll()[id] === true;
}

function notify() {
  for (const listener of [...listeners]) listener();
}

/** Never throws. */
export function setPanelOpen(id: PanelId, open: boolean): void {
  memory.set(id, open);
  try {
    store()?.setItem(PANELS_KEY, JSON.stringify({ ...readAll(), [id]: open }));
  } catch {
    // Refused (quota, private mode): the screen still changes, the choice just is not remembered.
  }
  notify();
}

function onStorage(event: StorageEvent) {
  if (event.key !== null && event.key !== PANELS_KEY) return;
  // Another tab wrote: its value is the truth now, so what this visit set no longer shadows it.
  memory.clear();
  notify();
}

export function subscribePanels(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}
