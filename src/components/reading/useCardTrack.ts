"use client";

import { useLayoutEffect, type RefObject } from "react";

const setIfChanged = (el: HTMLElement, name: string, value: string | null) => {
  if (value === null) {
    if (el.style.getPropertyValue(name) !== "") el.style.removeProperty(name);
  } else if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
};

/**
 * Writes `--own-staff`, `--own-head` and `--own-head-print` (the head with its `.no-print` items hidden, which paper uses) on each card's `li` (its one-line staff and head row) and `--staff-line` on the list,
 * so the CSS sizes each card from its own content (spec 013 contracts §2). No state and no re-render, and nothing below 768px.
 */
export function useCardTrack(listRef: RefObject<HTMLElement | null>, wide: boolean): void {
  // No dependency list: it runs after each commit; writes only land when a value changes.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const lis = () => Array.from(list.children).filter((c): c is HTMLElement => c instanceof HTMLElement && c.tagName === "LI");
    if (!wide) {
      if (list.style.getPropertyValue("--staff-line") !== "") list.style.removeProperty("--staff-line");
      for (const li of lis()) {
        setIfChanged(li, "--own-staff", null);
        setIfChanged(li, "--own-head", null);
        setIfChanged(li, "--own-head-print", null);
        if (li.getAttribute("style") === "") li.removeAttribute("style");
      }
      return;
    }
    const write = () => {
      const items = lis().map((li) => ({
        li,
        ruler: li.querySelector<HTMLElement>('[data-testid="tab-ruler"]'),
        head: li.querySelector<HTMLElement>(".reading-card > :first-child"),
        // The variant line ("Differs from A in bar 1: …") is one line of text like the head, and counts with it: a card
        // narrower than it wraps it, and the card's width moves with the view, so its height would not hold.
        line: li.querySelector<HTMLElement>('[data-testid="variant-line"]'),
      }));
      const savedLine = items.map((i) => i.line?.getAttribute("style") ?? null);
      items.forEach((i) => {
        if (!i.line) return;
        i.line.style.width = "max-content";
        i.line.style.whiteSpace = "nowrap";
      });
      const lines = items.map((i) => (i.line ? i.line.getBoundingClientRect().width : 0));
      items.forEach((i, k) => {
        if (!i.line) return;
        if (savedLine[k] === null) i.line.removeAttribute("style");
        else i.line.setAttribute("style", savedLine[k]!);
      });
      // Measure in one batch: every head on one line, read all, restore.
      const saved = items.map((i) => i.head?.getAttribute("style") ?? null);
      items.forEach((i) => {
        if (!i.head) return;
        i.head.style.width = "max-content";
        i.head.style.flexWrap = "nowrap";
      });
      const heads = items.map((i) => (i.head ? i.head.getBoundingClientRect().width : 0));
      // Paper hides `.no-print` items, so its one-line head is narrower. Measured here, under screen styles, because a real
      // print runs no observer and measures nothing under print media (FR-019).
      const hidden = items.map((i) => (i.head ? Array.from(i.head.querySelectorAll<HTMLElement>(".no-print")) : []));
      const hiddenStyle = hidden.map((els) => els.map((e) => e.getAttribute("style")));
      hidden.forEach((els) => els.forEach((e) => e.style.setProperty("display", "none", "important")));
      const printHeads = items.map((i) => (i.head ? i.head.getBoundingClientRect().width : 0));
      hidden.forEach((els, k) =>
        els.forEach((e, j) => {
          const was = hiddenStyle[k][j];
          if (was === null) e.removeAttribute("style");
          else e.setAttribute("style", was);
        }),
      );
      const rulers = items.map((i) => (i.ruler ? i.ruler.getBoundingClientRect().width : 0));
      items.forEach((i, k) => {
        if (!i.head) return;
        if (saved[k] === null) i.head.removeAttribute("style");
        else i.head.setAttribute("style", saved[k]!);
      });
      items.forEach((i, k) => {
        setIfChanged(i.li, "--own-staff", i.ruler ? `${Math.ceil(rulers[k])}px` : null);
        setIfChanged(i.li, "--own-head", `${Math.ceil(Math.max(heads[k], lines[k]))}px`);
        setIfChanged(i.li, "--own-head-print", `${Math.ceil(Math.max(printHeads[k], lines[k]))}px`);
      });
      const widest = Math.max(0, ...items.map((i) => i.ruler?.offsetWidth ?? 0));
      setIfChanged(list, "--staff-line", items.some((i) => i.ruler) ? `${widest}px` : null);
    };
    write();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(write);
    for (const li of lis()) {
      li.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]').forEach((r) => observer.observe(r));
      const head = li.querySelector<HTMLElement>(".reading-card > :first-child");
      if (head) observer.observe(head);
    }
    return () => observer.disconnect();
  });
}
