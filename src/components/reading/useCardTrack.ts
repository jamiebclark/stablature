"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Writes `--staff-line` on the card list: the widest one-line staff in it, measured from each card's hidden ruler.
 * No state and no re-render; with no ruler the property is removed and the CSS falls back to two columns.
 */
export function useCardTrack(listRef: RefObject<HTMLElement | null>, wide: boolean): void {
  // No dependency list: it runs after each commit, and a read is one `offsetWidth` per card.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (!wide) {
      list.style.removeProperty("--staff-line");
      return;
    }
    const rulers = Array.from(list.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]'));
    const write = () => {
      if (rulers.length === 0) {
        list.style.removeProperty("--staff-line");
        return;
      }
      const widest = Math.max(...rulers.map((r) => r.offsetWidth));
      list.style.setProperty("--staff-line", `${widest}px`);
    };
    write();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(write);
    rulers.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  });
}
