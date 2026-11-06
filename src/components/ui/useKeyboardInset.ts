"use client";

import { useEffect } from "react";

/**
 * While `active`, publishes the height the soft keyboard covers as `--kb-inset` on the root, so a bottom
 * sheet can lift clear of it. Cleared on close. Does nothing where `visualViewport` is missing.
 */
export function useKeyboardInset(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty("--kb-inset", `${Math.round(inset)}px`);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb-inset");
    };
  }, [active]);
}
