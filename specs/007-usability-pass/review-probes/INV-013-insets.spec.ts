/**
 * INV-013 with CDP insets: top 47 and bottom 34 in portrait, left and right 47 in landscape. Every target's rect, and
 * every text node's, inside the insets. The suite's walk reads controls on a subset of the set.
 */
import { expect, test, type Page } from "@playwright/test";
import { safeArea } from "../../../e2e/usability-helpers";
import { fullWorld, reach, SCREENS, TARGETS } from "./screens";

test.setTimeout(240_000);
test.skip(({ isMobile }) => !isMobile, "insets are a phone's");

const WANT = new Set([
  "capture at rest",
  "song page",
  "play view idle",
  "play view running",
  "tempo sheet",
  "band's songs",
]);

/**
 * Only what cannot be moved can sit under an inset. Scrolling content passes the edge by design, so a scroller is
 * judged at its ends: all the way along, its first and last controls must clear the inset.
 */
const outside = (page: Page, inset: { top: number; right: number; bottom: number; left: number }) =>
  page.evaluate(
    ({ sel, inset }) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const bad: string[] = [];
      const scope = document.querySelector("dialog[open]") ?? document.body;
      const scrollerOf = (el: Element) => {
        for (let n = el.parentElement; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          if (/(auto|scroll)/.test(s.overflowX) && n.scrollWidth > n.clientWidth + 1) return n;
        }
        return null;
      };
      const pinned = (el: Element) => {
        for (let n: Element | null = el; n; n = n.parentElement) {
          const p = getComputedStyle(n).position;
          if (p === "fixed" || p === "sticky") return true;
        }
        return false;
      };
      const pageScrolls = document.documentElement.scrollHeight > h + 1;
      const check = (r: DOMRect, name: string, el: Element, sideways: boolean) => {
        if (r.width <= 0 || r.height <= 0) return;
        if (r.bottom <= 0 || r.top >= h || r.right <= 0 || r.left >= w) return;
        if (!sideways) {
          if (r.left < inset.left - 0.5) bad.push(`${name} left ${Math.round(r.left)}`);
          if (r.right > w - inset.right + 0.5) bad.push(`${name} right ${Math.round(w - r.right)}`);
        }
        if (pageScrolls && !pinned(el)) return;
        if (r.top < inset.top - 0.5) bad.push(`${name} top ${Math.round(r.top)}`);
        if (r.bottom > h - inset.bottom + 0.5) bad.push(`${name} bottom ${Math.round(h - r.bottom)}`);
      };
      const walk = (root: Element, inScroller: boolean) => {
        for (const el of root.querySelectorAll<HTMLElement>(sel)) {
          if (getComputedStyle(el).visibility === "hidden" || el.closest('[data-testid="tab-column"]')) continue;
          const sideways = !!scrollerOf(el);
          if (inScroller !== sideways) continue;
          check(el.getBoundingClientRect(), (el.getAttribute("aria-label") ?? el.textContent ?? el.tagName).trim().slice(0, 24), el, sideways);
        }
        if (inScroller) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let t = walker.nextNode(); t; t = walker.nextNode()) {
          const el = t.parentElement;
          if (!el || !t.textContent?.trim() || el.closest("script,style,noscript,[hidden],[data-testid='tab-column']")) continue;
          if (scrollerOf(el)) continue;
          // Read aloud and never painted: the idle click status is sr-only.
          if (el.closest(".sr-only") || getComputedStyle(el).clipPath !== "none" || getComputedStyle(el).clip !== "auto") continue;
          const range = document.createRange();
          range.selectNodeContents(t);
          check(range.getBoundingClientRect(), `text "${t.textContent.trim().slice(0, 20)}"`, el, false);
        }
      };
      walk(scope, false);
      // Each sideways scroller, at both ends: nothing may stay stuck under the inset.
      const scrollers = [...new Set([...scope.querySelectorAll(sel)].map(scrollerOf).filter((x): x is HTMLElement => !!x))];
      for (const sc of scrollers) {
        const was = sc.scrollLeft;
        const r0 = sc.getBoundingClientRect();
        const kids = [...sc.querySelectorAll<HTMLElement>(sel)].filter((k) => !k.closest('[data-testid="tab-column"]'));
        if (kids.length === 0) continue;
        sc.scrollLeft = 0;
        const first = Math.min(...kids.map((k) => k.getBoundingClientRect().left));
        sc.scrollLeft = sc.scrollWidth;
        const last = Math.max(...kids.map((k) => k.getBoundingClientRect().right));
        sc.scrollLeft = was;
        if (first < inset.left - 0.5) bad.push(`scroller start stuck under left inset, at ${Math.round(first)}`);
        if (last > w - inset.right + 0.5) bad.push(`scroller end stuck under right inset by ${Math.round(last - (w - inset.right))}, box right ${Math.round(r0.right)}`);
      }
      return [...new Set(bad)];
    },
    { sel: TARGETS, inset },
  );

/** At the end of the page the last thing must clear the home bar. */
const atPageEnd = (page: Page, inset: { bottom: number }) =>
  page.evaluate(async (bottom) => {
    const h = window.innerHeight;
    if (document.documentElement.scrollHeight <= h + 1) return null;
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 60));
    const all = [...document.querySelectorAll<HTMLElement>("main button, main a, main input, main select")].filter(
      (el) => el.getBoundingClientRect().height > 0 && getComputedStyle(el).position !== "fixed",
    );
    const low = Math.max(...all.map((el) => el.getBoundingClientRect().bottom));
    window.scrollTo(0, 0);
    return low > h - bottom + 0.5 ? `the last control is ${Math.round(low - (h - bottom))} under the home bar at the page's end` : null;
  }, inset.bottom);

const SHAPES = [
  { name: "portrait", size: { width: 390, height: 844 }, inset: { top: 47, right: 0, bottom: 34, left: 0 } },
  { name: "landscape", size: { width: 844, height: 390 }, inset: { top: 0, right: 47, bottom: 21, left: 47 } },
];

for (const shape of SHAPES) {
  test(`INV-013 ${shape.name}`, async ({ page }) => {
    const world = await fullWorld(page);
    await page.setViewportSize(shape.size);
    await safeArea(page, shape.inset);
    const bad: string[] = [];
    for (const visit of SCREENS.filter((v) => WANT.has(v[0]))) {
      await reach(page, visit, world);
      await page.waitForTimeout(150);
      bad.push(...(await outside(page, shape.inset)).map((x) => `${visit[0]}: ${x}`));
      const end = await atPageEnd(page, shape.inset);
      if (end) bad.push(`${visit[0]}: ${end}`);
      await page.evaluate(() => {
        for (const d of document.querySelectorAll("dialog[open]")) (d as HTMLDialogElement).close();
      });
    }
    expect(bad).toEqual([]);
  });
}
