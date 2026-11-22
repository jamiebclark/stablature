/** INV-002, INV-003, INV-006, INV-016: reading order, track width and the threshold. */
import { expect, test, type Page } from "@playwright/test";
import { seedFitSong, seedWideSong } from "./wide-helpers";
import { cardMinimum, drawnRows, greedyRows, measureCards, ownWidths } from "./cards-helpers";

test.setTimeout(400_000);

const geometry = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector("ol.reading-cards") as HTMLElement;
    const lr = list.getBoundingClientRect();
    const items = [...list.children].map((li) => {
      const r = li.getBoundingClientRect();
      const cs = getComputedStyle(li);
      return {
        left: r.left, right: r.right, top: r.top, width: r.width,
        order: cs.order, row: cs.gridRowStart, col: cs.gridColumnStart,
        number: li.querySelector('[data-testid="card-number"]')?.textContent,
      };
    });
    const rulers = [...list.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]')].map((r) => r.offsetWidth);
    return {
      list: { left: lr.left, right: lr.right, width: lr.width },
      items,
      rulers,
      wrapped: !!list.querySelector(".tab-staff-wrapped"),
      line: list.style.getPropertyValue("--staff-line"),
      display: getComputedStyle(list).display,
      mainWidth: document.querySelector("main")!.getBoundingClientRect().width,
    };
  });

for (const width of [768, 1024, 1280]) {
  test(`cards read left to right, top to bottom at ${width}`, async ({ page }) => {
    const { playUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height: 800 });
    await page.goto(playUrl);
    await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
    // The wide layout turns on after hydration; the rulers are its sign.
    await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
    // Fonts and the first measuring pass settle after the rulers attach (Linux is slower): wait for every card's own width.
    await page.evaluate(() => document.fonts.ready);
    await expect
      .poll(() => page.evaluate(() => [...document.querySelectorAll("ol.reading-cards > li")].every((li) => (li as HTMLElement).style.getPropertyValue("--own-head") !== "")))
      .toBe(true);
    const g = await geometry(page);
    const m = await measureCards(page);
    expect(g.items.map((i) => i.number)).toEqual(["1", "2", "3", "4", "5", "6"]);
    for (const [k, i] of g.items.entries()) {
      expect([i.order, i.row, i.col]).toEqual(["0", "auto", "auto"]);
      // re-pinned by spec 013: the floor is the card's measured minimum, not the fixed 343
      expect(i.width).toBeGreaterThanOrEqual(Math.min(cardMinimum(m, k), g.list.width) - 0.5);
      expect(i.right).toBeLessThanOrEqual(g.list.right + 0.5);
    }
    // Row-major: a card is right of the previous in the same row, or starts a lower row at the left edge.
    for (let k = 1; k < g.items.length; k++) {
      const a = g.items[k - 1];
      const b = g.items[k];
      if (Math.abs(b.top - a.top) <= 0.5) expect(b.left).toBeGreaterThan(a.left);
      else {
        expect(b.top).toBeGreaterThan(a.top);
        expect(b.left).toBeLessThanOrEqual(g.items[0].left + 0.5);
      }
    }
    const rows = new Map<number, number[]>();
    for (const i of g.items) rows.set(Math.round(i.top), [...(rows.get(Math.round(i.top)) ?? []), i.right]);
    const rowRights = [...rows.values()];
    rowRights.forEach((rights, k) => {
      // re-pinned by spec 013: every row but the last ends at the list's right; the last keeps its own widths
      if (k < rowRights.length - 1 && rights.length > 1) expect(Math.abs(Math.max(...rights) - g.list.right)).toBeLessThanOrEqual(0.5);
      else expect(Math.max(...rights)).toBeLessThanOrEqual(g.list.right + 0.5);
    });
    // re-pinned by spec 013: drawn rows equal the greedy rows of the cards' own widths (one a row at 768, SC-003 amended)
    expect(drawnRows(m.cards)).toEqual(greedyRows(ownWidths(m), m.row, m.tokens.gap));
    expect(parseFloat(g.line)).toBeCloseTo(Math.max(...g.rulers), 0);
  });
}

test("767 is one column; 768 is two columns", async ({ page }) => {
  const { playUrl } = await seedFitSong(page);
  await page.setViewportSize({ width: 767, height: 800 });
  await page.goto(playUrl);
  await expect(page.locator("ol.reading-cards > li")).toHaveCount(6);
  const narrow = await geometry(page);
  expect(new Set(narrow.items.map((i) => Math.round(i.top))).size).toBe(6);
  await page.setViewportSize({ width: 768, height: 800 });
  const wide = await geometry(page);
  // re-pinned by spec 013: at 768 the list is a flex row-wrap and a card is narrower than the list; 767 stays a grid
  expect(narrow.display).toBe("grid");
  expect(wide.display).toBe("flex");
  expect(wide.items.some((i) => i.width < wide.list.width - 0.5)).toBe(true);
});

/** INV-016 (review F2): at a 20px default font size the grid and the wrap still switch at 768px, on both pages. */
const thresholdState = (page: Page) =>
  page.evaluate(() => {
    const list = document.querySelector<HTMLElement>(".reading-cards")!;
    return {
      display: getComputedStyle(list).display,
      wrapped: document.querySelectorAll(".tab-staff-wrapped").length,
      jsWide: matchMedia("(min-width: 768px)").matches,
    };
  });

test("a 20px default font size: the grid and the wrap switch at 768px, not 48rem", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "CDP font settings; Chromium desktop");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Page.enable");
  await cdp.send("Page.setFontSizes", { fontSizes: { standard: 20 } });
  const { songUrl, playUrl } = await seedFitSong(page);
  const bad: string[] = [];
  for (const width of [767, 768, 900]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(300);
      const s = await thresholdState(page);
      const where = `${which} at ${width}: ${JSON.stringify(s)}`;
      if (width < 768) {
        // re-pinned by spec 013: the list is a grid below 768 and a flex row-wrap at 768+
        if (s.display !== "grid") bad.push(`${where} - display`);
        if (which === "song" && s.wrapped !== 0) bad.push(`${where} - wrapped`);
      } else {
        if (!s.jsWide) bad.push(`${where} - JS narrow`);
        if (s.display !== "flex") bad.push(`${where} - display`);
        if (which === "song" && s.wrapped === 0) bad.push(`${where} - not wrapped`);
      }
    }
  }
  expect(bad).toEqual([]);
});

/** INV-002, INV-003, INV-006 (review F8): order, floor, rows and widths over Ww x Pg x songs, and the two pages share one main width. */
const ALL_WIDTHS = [768, 1024, 1280, 1440, 1920, 2560];

const geometryAll = (page: Page) =>
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
    for (const width of ALL_WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      const mains: Record<string, number> = {};
      for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
        await page.goto(url);
        await expect(page.locator(".reading-cards > li").first()).toBeVisible();
        await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
        await page.waitForFunction(() => document.querySelector<HTMLElement>(".reading-cards")!.style.getPropertyValue("--staff-line") !== "");
        await page.evaluate(() => document.fonts.ready);
        const g = await geometryAll(page);
        const m = await measureCards(page);
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
          // re-pinned by spec 013: the floor is the card's measured minimum
          if (i.width < Math.min(cardMinimum(m, k), g.list.width) - 0.5) bad.push(`${at} card ${k}: ${i.width} under the floor`);
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
        rows.forEach((r, k) => {
          // re-pinned by spec 013: full-row rule applies to every row but the last
          const full = k < rows.length - 1 && r.length > 1;
          if (full && Math.abs(r[r.length - 1].right - g.list.right) > 0.5) bad.push(`${at}: row ${k} ends at ${r[r.length - 1].right}, list ${g.list.right}`);
        });
        // re-pinned by spec 013: drawn rows equal the greedy rows (replaces perRow >= 2)
        const want = greedyRows(ownWidths(m), m.row, m.tokens.gap);
        if (JSON.stringify(drawnRows(m.cards)) !== JSON.stringify(want)) bad.push(`${at}: rows ${JSON.stringify(drawnRows(m.cards))} vs ${JSON.stringify(want)}`);
        if (g.rulers.length && Math.abs(parseFloat(g.line) - Math.max(...g.rulers)) > 0.5) bad.push(`${at}: --staff-line ${g.line} vs widest ruler ${Math.max(...g.rulers)}`);
      }
      if (Math.abs(mains.song - mains.play) > 0.5) bad.push(`${width}: song page main ${mains.song} vs play view ${mains.play}`);
    }
    expect(bad).toEqual([]);
  });
}
