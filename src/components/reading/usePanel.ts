"use client";

import { useSyncExternalStore } from "react";
import { getPanelOpen, setPanelOpen, subscribePanels, type PanelId } from "@/lib/reading/panels";

/** The server snapshot is closed, so server and first client render agree; a remembered panel opens before paint. */
export function usePanel(id: PanelId): readonly [boolean, (open: boolean) => void] {
  const open = useSyncExternalStore(
    subscribePanels,
    () => getPanelOpen(id),
    () => false,
  );
  return [open, (next: boolean) => setPanelOpen(id, next)] as const;
}
