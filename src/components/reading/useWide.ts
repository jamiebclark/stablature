"use client";

import { useSyncExternalStore } from "react";
import { WIDE_QUERY } from "@/lib/reading/wide";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Whether the window is wide. False on the server and on the first client render, so hydration agrees. */
export function useWide(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}
