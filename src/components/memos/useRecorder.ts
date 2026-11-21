"use client";

/** The page's one recorder, as React state. The recorder itself is React-free (`lib/memos/recorder.ts`). */

import { useEffect, useState } from "react";
import { getRecorder } from "@/lib/memos/ports";
import type { Recorder, RecorderSnapshot } from "@/lib/memos/recorder";

export function useRecorder(): { rec: Recorder; snap: RecorderSnapshot } {
  const rec = getRecorder();
  const [snap, setSnap] = useState<RecorderSnapshot>(() => rec.snapshot());
  useEffect(() => {
    return rec.subscribe(() => setSnap(rec.snapshot()));
  }, [rec]);
  return { rec, snap };
}
