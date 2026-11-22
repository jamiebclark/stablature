/** Spec 013 print probes' measurement: the list row, gap, tokens, each card's ruler/head/box/lines, then FR-003 own widths and FR-007 greedy rows, computed here and never read back from `--own-*`. */
import type { Page } from "@playwright/test";

export interface Card {
  ruler: number;
  head: number;
  memo: boolean;
  left: number;
  right: number;
  top: number;
  width: number;
  lines: number;
  runs: number;
  ownStaffVar: string;
  ownHeadVar: string;
}
export interface M {
  row: number;
  gap: number;
  display: string;
  tok: { min: number; floor: number; padX: number };
  cards: Card[];
}

export const measure = (page: Page): Promise<M> =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    const lis = [...list.children].filter((c): c is HTMLElement => c.tagName === "LI");
    const px = (v: string) => {
      const d = document.createElement("div");
      d.style.cssText = `position:absolute;visibility:hidden;height:0;width:${v || "0px"}`;
      list.appendChild(d);
      const w = d.getBoundingClientRect().width;
      d.remove();
      return w;
    };
    const root = getComputedStyle(document.documentElement);
    const ls = getComputedStyle(list);
    const cards = lis.map((li) => {
      const ruler = li.querySelector<HTMLElement>('[data-testid="tab-ruler"]');
      const head = li.querySelector<HTMLElement>(".reading-card > :first-child");
      let headW = 0;
      if (head) {
        const c = head.cloneNode(true) as HTMLElement;
        c.style.cssText = "position:absolute;visibility:hidden;width:max-content;flex-wrap:nowrap";
        head.parentElement!.appendChild(c);
        headW = c.getBoundingClientRect().width;
        c.remove();
      }
      const r = li.getBoundingClientRect();
      const runs = [...li.querySelectorAll<HTMLElement>(".tab-bar-run")];
      return {
        ruler: ruler ? ruler.getBoundingClientRect().width : 0,
        head: headW,
        memo: li.querySelector('[data-testid="part-memos"]') !== null,
        left: r.left,
        right: r.right,
        top: r.top,
        width: r.width,
        lines: new Set(runs.map((e) => Math.round(e.getBoundingClientRect().top))).size,
        runs: runs.length,
        ownStaffVar: li.style.getPropertyValue("--own-staff"),
        ownHeadVar: li.style.getPropertyValue("--own-head"),
      };
    });
    return {
      row: list.clientWidth - parseFloat(ls.paddingLeft) - parseFloat(ls.paddingRight),
      gap: parseFloat(ls.columnGap) || 0,
      display: ls.display,
      tok: { min: px(root.getPropertyValue("--card-min").trim()), floor: px(root.getPropertyValue("--card-floor").trim()), padX: px(root.getPropertyValue("--card-pad-x").trim()) },
      cards,
    };
  });

/** FR-003 / FR-005 / FR-006 as plan.md Deviation 1 and contracts §1 set them. */
export function own(m: M): number[] {
  const chrome = 2 * m.tok.padX + 2;
  return m.cards.map((c) => {
    const least = c.memo ? Math.max(m.tok.floor, m.tok.min) : Math.max(m.tok.min, Math.min(c.head + chrome, m.tok.floor));
    return Math.max(least, c.ruler > 0 ? c.ruler + chrome : 0);
  });
}

/** FR-007: greedy, in order. Returns rows of card indexes, and whether any break was within ±1px (a tie). */
export function greedy(w: number[], row: number, gap: number): { rows: number[][]; tie: boolean } {
  const rows: number[][] = [];
  let used = 0;
  let tie = false;
  w.forEach((x, i) => {
    const c = Math.min(x, row);
    if (rows.length && Math.abs(used + gap + c - row) <= 1) tie = true;
    if (rows.length && used + gap + c <= row + 0.5) {
      rows[rows.length - 1].push(i);
      used += gap + c;
    } else {
      rows.push([i]);
      used = c;
    }
  });
  return { rows, tie };
}

export function drawn(cards: Pick<Card, "top">[]): number[][] {
  const rows: number[][] = [];
  let top = NaN;
  cards.forEach((c, i) => {
    if (rows.length && Math.abs(c.top - top) <= 0.5) rows[rows.length - 1].push(i);
    else {
      rows.push([i]);
      top = c.top;
    }
  });
  return rows;
}

export async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(300);
}
