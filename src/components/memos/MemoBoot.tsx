"use client";

/**
 * Runs at boot, on every page, and renders nothing. It never asks for the microphone: that happens only when someone
 * chooses "Record memo" (INV-013). It recovers any recording a crash or a closed app cut off (research R11).
 */

import { useEffect } from "react";
import { recoverDrafts } from "@/lib/memos/recover";

let ran = false;

export function MemoBoot() {
  useEffect(() => {
    if (ran) return;
    ran = true;
    void recoverDrafts().catch(() => undefined);
  }, []);
  return null;
}
