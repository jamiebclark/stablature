"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import type { DrawnPass } from "@/lib/arrangement/passes";
import { livePassWords, type DrawnCard } from "@/lib/reading/cards";
import { mayFollow } from "@/lib/reading/position";

export interface Position {
  readonly pass: number;
  readonly key: string;
}

const CLASS = "tab-column-reading";
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"]);

/**
 * Owns the one highlighted column in the play view. The class is written straight onto the DOM so a
 * moving highlight never re-renders the staff, and is reapplied after any commit of `passes`.
 */
export function useReadingPosition(
  passes: readonly DrawnPass[],
  cluster?: RefObject<HTMLElement | null>,
  cardOf?: readonly number[],
  cards?: readonly DrawnCard[],
) {
  const current = useRef<Position | null>(null);
  const element = useRef<Element | null>(null);
  const card = useRef<Element | null>(null);
  // Read inside `apply` so the callback stays stable while the maps change.
  const maps = useRef({ passes, cardOf, cards });
  useLayoutEffect(() => {
    maps.current = { passes, cardOf, cards };
  });
  const lastScroll = useRef<number | null>(null);

  const apply = useCallback((follow: boolean) => {
    element.current?.classList.remove(CLASS);
    element.current = null;
    if (card.current) {
      const live = card.current.querySelector('[data-testid="card-passes-live"]');
      if (live) live.textContent = "";
      card.current.removeAttribute("data-reading");
      card.current.removeAttribute("data-live-words");
      card.current = null;
    }
    const at = current.current;
    if (!at) return;
    const { passes: all, cardOf: of, cards: drawn } = maps.current;
    const index = of?.[at.pass];
    const li = index === undefined ? null : document.querySelector(`[data-card="${index}"]`);
    const el = li
      ? li.querySelector(`[data-column="${CSS.escape(at.key)}"]`)
      : document.querySelector(`[data-pass="${at.pass}"] [data-column="${CSS.escape(at.key)}"]`);
    if (!el) return;
    if (li && index !== undefined && drawn) {
      li.setAttribute("data-reading", "");
      const live = li.querySelector('[data-testid="card-passes-live"]');
      const words = livePassWords(drawn[index], all, at.pass);
      if (live) live.textContent = words ?? "";
      // The rest words give way only when live words replace them; a single pass keeps its `pass k of n`.
      if (words) li.setAttribute("data-live-words", "");
      card.current = li;
    }
    el.classList.add(CLASS);
    element.current = el;
    if (follow && mayFollow(lastScroll.current, performance.now())) {
      const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reduced ? "auto" : "smooth" });
    }
  }, []);

  const place = useCallback(
    (position: Position | null) => {
      current.current = position;
      apply(true);
    },
    [apply],
  );

  // A commit of new passes may have replaced the element, or removed the column.
  useEffect(() => {
    apply(false);
  }, [passes, apply]);

  useEffect(() => {
    const note = () => {
      lastScroll.current = performance.now();
    };
    const onPointer = (e: PointerEvent) => {
      if (e.target === document.documentElement) note();
    };
    const onKey = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key) && !e.defaultPrevented) note();
    };
    window.addEventListener("wheel", note, { passive: true });
    window.addEventListener("touchmove", note, { passive: true });
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", note);
      window.removeEventListener("touchmove", note);
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const target = cluster?.current;
    if (!target) return;
    const root = document.documentElement;
    const write = () => {
      root.style.scrollPaddingBottom = `${target.offsetHeight}px`;
      root.style.setProperty("--click-bar-h", `${target.offsetHeight}px`);
    };
    write();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(write);
    observer?.observe(target);
    return () => {
      observer?.disconnect();
      root.style.scrollPaddingBottom = "";
      root.style.removeProperty("--click-bar-h");
    };
  }, [cluster]);

  return { place };
}
