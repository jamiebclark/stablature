"use client";

/**
 * Runs the sync engine for as long as somebody is signed in.
 *
 * Mounted in the root layout and renders nothing. It is deliberately the only
 * thing in the app that knows sync exists -- no screen waits on it, and
 * stopping it changes nothing about whether capture works.
 */

import { useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { startSync } from "@/lib/sync/runner";

export function SyncProvider() {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  useEffect(() => {
    // No session means no server to talk to. Local writes keep queueing in the
    // outbox and go out whenever a session appears.
    if (!userId) return;
    return startSync();
  }, [userId]);

  return null;
}
