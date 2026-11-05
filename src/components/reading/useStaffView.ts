"use client";

import { useSyncExternalStore } from "react";
import { getStaffView, setStaffView, subscribeStaffView, type StaffView } from "@/lib/reading/view";

const serverView = (): StaffView => "frets";

/**
 * The reader's view and its setter. The server snapshot is frets, so the server and the first client
 * render agree; a remembered view then replaces it before the browser paints, with no hydration mismatch.
 */
export function useStaffView(): readonly [StaffView, (view: StaffView) => void] {
  const view = useSyncExternalStore(subscribeStaffView, getStaffView, serverView);
  return [view, setStaffView] as const;
}
