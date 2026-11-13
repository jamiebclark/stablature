"use client";

import { useSession } from "@/lib/auth-client";
import { usePendingWrites } from "@/lib/local/hooks";
import { useSyncStatus } from "@/lib/sync/hooks";
import { pendingWords, signInKnowledge, type PendingWords, type SignIn } from "@/lib/saving";

/** One place the top bar and the capture header read what to say about saving. */
export function useSaving(): { words: PendingWords; signIn: SignIn; status: ReturnType<typeof useSyncStatus> } {
  const session = useSession();
  const pending = usePendingWrites();
  const status = useSyncStatus();
  const signIn = signInKnowledge(
    { data: session.data, isPending: session.isPending, error: session.error ?? null },
    status?.state,
  );
  return { words: pendingWords(signIn, pending), signIn, status };
}
