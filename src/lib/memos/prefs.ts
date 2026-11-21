"use client";

/**
 * What this device remembers about memos: which parts' lists are expanded, and whether it has already asked the
 * browser to keep storage. Device-only, never synced (FR-044, FR-070). Shaped like `reading/panels.ts`:
 * storage is untrusted at every touch, a refused write still changes the screen for the visit.
 */

import { useSyncExternalStore } from "react";

export const MEMO_PREFS_KEY = "stablature.memos";

interface Stored {
  expanded: Record<string, true>;
  persistAsked?: true;
  persistNoticeShown?: true;
}

type Store = Pick<Storage, "getItem" | "setItem">;

let override: Store | null | undefined;
let memory: Stored | null = null;
const listeners = new Set<() => void>();

/** Test seam: inject storage, and forget what this visit set. */
export function setMemoPrefsStorage(store: Store | null | undefined): void {
  override = store;
  memory = null;
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

function read(): Stored {
  if (memory) return memory;
  try {
    const raw = store()?.getItem(MEMO_PREFS_KEY);
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : null;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      const p = parsed as Record<string, unknown>;
      const expanded: Record<string, true> = {};
      if (p.expanded !== null && typeof p.expanded === "object" && !Array.isArray(p.expanded)) {
        for (const [k, v] of Object.entries(p.expanded as Record<string, unknown>)) if (v === true) expanded[k] = true;
      }
      const out: Stored = { expanded };
      if (p.persistAsked === true) out.persistAsked = true;
      if (p.persistNoticeShown === true) out.persistNoticeShown = true;
      return out;
    }
  } catch {
    // fall through to the empty default
  }
  return { expanded: {} };
}

function write(next: Stored): void {
  memory = next;
  try {
    store()?.setItem(MEMO_PREFS_KEY, JSON.stringify(next));
  } catch {
    // Refused: the choice holds for this visit only.
  }
  notify();
}

function notify() {
  for (const l of [...listeners]) l();
}

export function subscribeMemoPrefs(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isExpanded(partId: string): boolean {
  return read().expanded[partId] === true;
}

export function setExpanded(partId: string, open: boolean): void {
  const cur = read();
  const expanded = { ...cur.expanded };
  if (open) expanded[partId] = true;
  else delete expanded[partId];
  write({ ...cur, expanded });
}

export function persistAsked(): boolean {
  return read().persistAsked === true;
}
export function markPersistAsked(): void {
  write({ ...read(), persistAsked: true });
}
export function persistNoticeShown(): boolean {
  return read().persistNoticeShown === true;
}
export function markPersistNoticeShown(): void {
  write({ ...read(), persistNoticeShown: true });
}

export function useMemosExpanded(partId: string): [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribeMemoPrefs,
    () => isExpanded(partId),
    () => false,
  );
  return [open, (next) => setExpanded(partId, next)];
}
