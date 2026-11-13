/**
 * What to tell the user about saving: one decision, drawn by two surfaces.
 * Pure; the hook that feeds it lives in components/app/useSaving.ts.
 */

import type { SyncState } from "@/lib/sync/client";

export type SignIn = "signed-in" | "signed-out" | "unknown";

export function signInKnowledge(
  session: { data: unknown | null; isPending: boolean; error: { status?: number } | null },
  syncState: SyncState | undefined,
): SignIn {
  if (syncState === "signed-out") return "signed-out";
  if (session.isPending) return "unknown";
  if (session.error) return session.error.status === 401 ? "signed-out" : "unknown";
  return session.data ? "signed-in" : "signed-out";
}

export type PendingWords = null | "saved-here" | { count: number };

export function pendingWords(knowledge: SignIn, pending: number | undefined): PendingWords {
  if (!pending) return null;
  if (knowledge === "signed-out") return "saved-here";
  return { count: pending };
}

export const SAVED_HERE = "Saved on this device";
export const SAVED_HERE_SHORT = "saved · sign in";
export const SAVED_HERE_NAME = "Saved on this device. Sign in to sync with your band.";
