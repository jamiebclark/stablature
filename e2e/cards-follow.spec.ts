/**
 * Spec 013 INV-009: the rows follow content after every trigger without a reload, and a moving reading position
 * moves no card (rects constant, no `style` mutation on any `li`).
 */
import { expect, test, type Page } from "@playwright/test";
import { drawnRows, greedyRows, isRoundingTie, measureCards, seedMemoSong } from "./cards-helpers";
import { seedMemo } from "./memo-helpers";
import { choose, idb, landed } from "./reading-helpers";
import { openTools } from "./usability-helpers";
import { seedFitSong } from "./wide-helpers";

test.setTimeout(300_000);

type Urls = { songUrl: string; playUrl: string };

async function settle(page: Page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(300);
}

/** INV-002's computation, from the page's own measurements. */
async function rowsHold(page: Page, where: string) {
  await settle(page);
  const m = await measureCards(page);
  const chrome = 2 * m.tokens.padX + 2;
  const own = m.cards.map((c) => {
    const least = c.memo
      ? Math.max(m.tokens.cardFloor, m.tokens.cardMin)
      : Math.max(m.tokens.cardMin, Math.min(c.head + chrome, m.tokens.cardFloor));
    return Math.max(least, c.ruler > 0 ? c.ruler + chrome : 0);
  });
  expect(m.display, where).toBe("flex");
  if (isRoundingTie(own, m.row, m.tokens.gap)) return;
  expect(drawnRows(m.cards), where).toEqual(greedyRows(own, m.row, m.tokens.gap));
}

for (const pg of ["song", "play"] as const) {
  test(`INV-009: rows hold after each trigger: ${pg}`, async ({ page }) => {
    const fit = (await seedFitSong(page)) as unknown as Urls;
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(pg === "play" ? fit.playUrl : fit.songUrl);
    await expect(page.locator(".reading-cards").first()).toBeVisible();
    await rowsHold(page, "initial");
    for (const v of ["notes", "intervals", "frets"] as const) {
      if (pg === "song") await openTools(page);
      await choose(page, v);
      await rowsHold(page, `view ${v}`);
    }
    await page.emulateMedia({ colorScheme: "light" });
    await rowsHold(page, "light");
    await page.emulateMedia({ colorScheme: "dark" });
    await rowsHold(page, "dark");
    for (const w of [1024, 1440, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      await rowsHold(page, `viewport ${w}`);
    }
    // A font load reflows the rulers: ask the document for fonts again and re-check.
    await page.evaluate(() => document.fonts.load("1em monospace"));
    await rowsHold(page, "fonts");
  });
}

test("INV-009: the memo song holds its rows after a viewport change", async ({ page }) => {
  const urls = (await seedMemoSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.songUrl);
  await expect(page.locator(".reading-cards").first()).toBeVisible();
  await rowsHold(page, "memo 1280");
  await page.setViewportSize({ width: 1024, height: 900 });
  await rowsHold(page, "memo 1024");
});

test("INV-009: a click run moves no card", async ({ page }) => {
  const { playUrl } = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(playUrl);
  await expect(page.getByTestId("click-bar")).toBeVisible();
  await settle(page);
  await page.evaluate(() => {
    const w = window as unknown as { __liStyle: number };
    w.__liStyle = 0;
    const o = new MutationObserver((rs) => (w.__liStyle += rs.length));
    document.querySelectorAll(".reading-cards > li").forEach((li) => o.observe(li, { attributes: true, attributeFilter: ["style"] }));
  });
  const rects = () =>
    page.evaluate(() => [...document.querySelectorAll(".reading-cards > li")].map((li) => { const r = li.getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; }));
  const before = await rects();
  await page.getByTestId("click-start").click();
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(400);
    const now = await rects();
    now.forEach((r, j) => r.forEach((v, k) => expect(Math.abs(v - before[j][k]), `rect ${j}.${k}`).toBeLessThanOrEqual(0.5)));
  }
  await page.getByTestId("click-stop").click();
  expect(await page.evaluate(() => (window as unknown as { __liStyle: number }).__liStyle)).toBe(0);
});

test("INV-009: density, rename and memo triggers hold the rows (song page)", async ({ page }) => {
  const urls = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  await rowsHold(page, "initial");

  await openTools(page);
  await page.getByRole("button", { name: "compact", exact: true }).click();
  await rowsHold(page, "compact");
  await page.getByRole("button", { name: "expanded", exact: true }).click();
  await rowsHold(page, "expanded");

  // Rename the last part (a short card) long, then empty.
  const lastHead = page.locator(".reading-cards > li").last().locator(".reading-card > :first-child");
  await lastHead.locator("button").first().click();
  await page.getByLabel("Part name", { exact: true }).fill("A much longer part name for the last card");
  await page.getByRole("button", { name: "Save" }).click();
  await rowsHold(page, "renamed long");
  await lastHead.locator("button").first().click();
  await page.getByLabel("Part name", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await rowsHold(page, "renamed empty");

  // A memo lands on part B, then is deleted, with no reload either time.
  const id = await seedMemo(page, { partLabel: "B", state: "ready" });
  await landed(page);
  await expect(page.getByTestId("part-memos")).toHaveCount(1);
  await rowsHold(page, "memo added");
  await idb(page, `await write("memos", (s) => s.delete(arg)); await write("memoAudio", (s) => s.delete(arg));`, id);
  await landed(page);
  await expect(page.getByTestId("part-memos")).toHaveCount(0);
  await rowsHold(page, "memo deleted");
});

// The arrow keys move the reading position only on the play view, so the walk runs there.
for (const width of [768, 1280]) {
  test(`INV-009: a play-view key walk moves no card and writes no li style @${width}`, async ({ page }) => {
    const urls = (await seedFitSong(page)) as unknown as Urls;
    await page.setViewportSize({ width, height: 900 });
    await page.goto(urls.playUrl);
    await expect(page.locator("ol.reading-cards > li [data-column]").first()).toBeAttached();
    await settle(page);
    const out = await page.evaluate(() => {
      let records = 0;
      const o = new MutationObserver((rs) => (records += rs.length));
      const lis = [...document.querySelectorAll<HTMLElement>(".reading-cards > li")];
      lis.forEach((li) => o.observe(li, { attributes: true, attributeFilter: ["style"] }));
      o.observe(document.querySelector(".reading-cards")!, { attributes: true, attributeFilter: ["style"] });
      const rect = () => lis.map((li) => { const r = li.getBoundingClientRect(); return [r.left, r.top + scrollY, r.width, r.height]; });
      const before = rect();
      const total = document.querySelectorAll('ol.reading-cards > li [data-testid="tab-column"]').length * 12;
      let moved = 0;
      const seen = new Set<string>();
      for (let i = 0; i < total; i++) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
        const at = document.querySelector(".tab-column-reading");
        if (at) seen.add(at.closest("li")?.getAttribute("data-card") ?? "?");
        rect().forEach((r, j) => r.forEach((v, k) => { if (Math.abs(v - before[j][k]) > 0.5) moved += 1; }));
      }
      return new Promise<{ moved: number; cards: number; seen: number }>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res({ moved: moved + records * 1000, cards: lis.length, seen: seen.size }))),
      );
    });
    expect(out.seen, "the walk reached every card").toBe(out.cards);
    expect(out.moved).toBe(0);
  });
}

/**
 * INV-009: a 40-step play-view key walk runs no measuring batch. No head row or `li` gets a `style` write and no card moves;
 * the control shows the recorder sees head-row writes (a resize runs a batch).
 */
test("INV-009: a play-view key walk at 1280 writes no head-row or li style and moves no card", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "real key presses, desktop");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.playUrl);
  await expect(page.locator("ol.reading-cards > li [data-column]").first()).toBeAttached();
  await settle(page);
  type Rec = { __rec: { head: number; li: number } };
  await page.evaluate(() => {
    const w = window as unknown as Rec;
    w.__rec = { head: 0, li: 0 };
    const list = document.querySelector(".reading-cards")!;
    new MutationObserver((rs) => {
      for (const r of rs) {
        const el = r.target as HTMLElement;
        if (el.parentElement === list) w.__rec.li++;
        else if (el.closest(".reading-card > :first-child")) w.__rec.head++;
      }
    }).observe(list, { attributes: true, subtree: true, attributeFilter: ["style"] });
  });
  const rects = () => page.evaluate(() => [...document.querySelectorAll(".reading-cards > li")].map((li) => JSON.stringify(li.getBoundingClientRect())));
  const before = await rects();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(30);
  }
  const rec = await page.evaluate(() => (window as unknown as Rec).__rec);
  expect(await page.locator(".tab-column-reading").count(), "the walk moved the position").toBeGreaterThan(0);
  expect(rec.head, "no head-row style write while the position moves").toBe(0);
  expect(rec.li).toBe(0);
  expect(await rects()).toEqual(before);
  await page.setViewportSize({ width: 1180, height: 900 });
  await settle(page);
  const after = await page.evaluate(() => (window as unknown as Rec).__rec);
  expect(after.head, "control: a resize writes head-row styles and the recorder sees them").toBeGreaterThan(rec.head);
});
