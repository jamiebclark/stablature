/**
 * INV-002, INV-003, INV-006 (review round 1), over the enumeration the feature's own wide-order.spec.ts samples:
 * **Ww** × **Ptr** × **Pg** × {fit, short, long, names, empty}. wide-order.spec.ts runs the fit song's play view at
 * 768, 1024 and 1280 only, and never compares the two pages' `main` widths.
 *
 * Per page: row-major placement, numbers 1..n (play view), no `order`/explicit placement, width ≥ min(343, list),
 * right ≤ list right, full rows end at the list's right, equal tops per row, `--staff-line` = widest ruler,
 * and the song page's `main` as wide as the play view's.
 */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong, seedWideSong } from "../../../e2e/wide-helpers";

test.setTimeout(400_000);

const WIDTHS = [768, 1024, 1280, 1440, 1920, 2560];

const geometry = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    const lr = list.getBoundingClientRect();
    const items = [...list.children].map((li) => {
      const r = li.getBoundingClientRect();
      const cs = getComputedStyle(li);
      return {
        left: r.left, right: r.right, top: r.top, width: r.width,
        placed: [cs.order, cs.gridRowStart, cs.gridColumnStart].join(" "),
        number: li.querySelector('[data-testid="card-number"]')?.textContent ?? null,
      };
    });
    const rulers = [...list.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]')].map((r) => r.offsetWidth);
    return {
      list: { right: lr.right, width: lr.width },
      items,
      rulers,
      line: list.style.getPropertyValue("--staff-line"),
      main: document.querySelector("main")!.getBoundingClientRect().width,
      dense: getComputedStyle(list).gridAutoFlow,
    };
  });

for (const name of ["fit", "short", "long", "names", "empty"] as const) {
  test(`order, floor, rows and widths: ${name}`, async ({ page }) => {
    const { songUrl, playUrl } = name === "fit" ? await seedFitSong(page) : await seedWideSong(page, name);
    const bad: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const mains: Record<string, number> = {};
      for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.locator(".reading-cards > li").first()).toBeVisible();
        await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
        await page.waitForFunction(() => document.querySelector<HTMLElement>(".reading-cards")!.style.getPropertyValue("--staff-line") !== "");
        await page.evaluate(() => document.fonts.ready);
        const g = await geometry(page);
        const at = `${which} ${width}`;
        mains[which] = g.main;
        if (g.dense.includes("dense")) bad.push(`${at}: grid-auto-flow ${g.dense}`);
        if (which === "play") {
          const numbers = g.items.map((i) => i.number);
          const want = g.items.map((_, i) => String(i + 1));
          if (numbers.join() !== want.join()) bad.push(`${at}: numbers ${numbers.join()}`);
        }
        g.items.forEach((i, k) => {
          if (i.placed !== "0 auto auto") bad.push(`${at} card ${k}: placed ${i.placed}`);
          if (i.width < Math.min(343, g.list.width) - 0.5) bad.push(`${at} card ${k}: ${i.width} under the floor`);
          if (i.right > g.list.right + 0.5) bad.push(`${at} card ${k}: right ${i.right} past ${g.list.right}`);
        });
        for (let k = 1; k < g.items.length; k++) {
          const a = g.items[k - 1];
          const b = g.items[k];
          const sameRow = Math.abs(b.top - a.top) <= 0.5;
          const ok = sameRow ? b.left >= a.right - 0.5 : b.top > a.top + 0.5 && b.left <= a.left + 0.5;
          if (!ok) bad.push(`${at}: card ${k} out of reading order`);
        }
        const rows: (typeof g.items)[] = [];
        for (const i of g.items) {
          const row = rows.find((r) => Math.abs(r[0].top - i.top) <= 0.5);
          if (row) row.push(i);
          else rows.push([i]);
        }
        const perRow = Math.max(...rows.map((r) => r.length));
        rows.forEach((r, k) => {
          const full = (k < rows.length - 1 || r.length === perRow) && r.length > 1;
          if (full && Math.abs(r[r.length - 1].right - g.list.right) > 0.5) bad.push(`${at}: row ${k} ends at ${r[r.length - 1].right}, list ${g.list.right}`);
        });
        if (g.items.length >= 2 && width <= 1280 && perRow < 2) bad.push(`${at}: one card per row (INV-006)`);
        if (g.rulers.length && Math.abs(parseFloat(g.line) - Math.max(...g.rulers)) > 0.5) bad.push(`${at}: --staff-line ${g.line} vs widest ruler ${Math.max(...g.rulers)}`);
      }
      if (Math.abs(mains.song - mains.play) > 0.5) bad.push(`${width}: song page main ${mains.song} vs play view ${mains.play}`);
    }
    expect(bad).toEqual([]);
  });
}
