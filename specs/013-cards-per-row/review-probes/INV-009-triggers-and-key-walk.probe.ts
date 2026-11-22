/**
 * Review probe, INV-009: after each trigger, with no reload, the drawn rows are the greedy rows of the cards' own widths
 * again; while the reading position moves, no card moves and no `li` style is written.
 * The suite's cards-follow.spec.ts covers view, theme, viewport and a fonts call. This probe covers the plan's other
 * triggers (density switch, a part renamed long then emptied, a memo added then deleted) and the key walk on the play
 * view at 768 and 1280 (the suite's key walk runs on the song page, where the arrow keys move no reading position).
 */
import { expect, test, type Page } from "@playwright/test";
import { idb } from "../../../e2e/reading-helpers";
import { landed } from "../../../e2e/reading-helpers";
import { seedMemo } from "../../../e2e/memo-helpers";
import { seedFitSong } from "../../../e2e/wide-helpers";
import { openTools } from "../../../e2e/usability-helpers";
import { drawn, greedy, measure, own, settle } from "./measure";

test.setTimeout(400_000);
type Urls = { songUrl: string; playUrl: string };

async function rowsHold(page: Page, where: string, bad: string[]) {
  await settle(page);
  const m = await measure(page);
  const w = own(m);
  const g = greedy(w, m.row, m.gap);
  const d = drawn(m.cards);
  const line = `${where}: own [${w.map((x) => x.toFixed(0))}] drawn ${JSON.stringify(d)} greedy ${JSON.stringify(g.rows)} widths [${m.cards.map((c) => c.width.toFixed(0))}] memo [${m.cards.map((c) => (c.memo ? 1 : 0))}] --own-head [${m.cards.map((c) => c.ownHeadVar)}] head [${m.cards.map((c) => c.head.toFixed(0))}]`;
  console.log(line);
  if (!g.tie && JSON.stringify(d) !== JSON.stringify(g.rows)) bad.push(`rows: ${line}`);
  m.cards.forEach((c, i) => {
    if (c.width < Math.min(w[i], m.row) - 1.5) bad.push(`${where}: card ${i + 1} ${c.width.toFixed(1)} under own ${w[i].toFixed(1)}`);
    if (c.memo && c.width < Math.min(343, m.row) - 0.5) bad.push(`${where}: memo card ${i + 1} ${c.width.toFixed(1)} under 343`);
  });
  return m;
}

test("INV-009 density, rename and memo triggers hold the rows (song page)", async ({ page }, info) => {
  test.skip(info.project.name === "probe-firefox", "Chromium projects");
  const urls = (await seedFitSong(page)) as unknown as Urls;
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(urls.songUrl);
  await expect(page.locator(".reading-cards > li").first()).toBeVisible();
  const bad: string[] = [];
  await rowsHold(page, "initial", bad);

  await openTools(page);
  await page.getByRole("button", { name: "compact", exact: true }).click();
  await rowsHold(page, "compact", bad);
  await page.getByRole("button", { name: "expanded", exact: true }).click();
  await rowsHold(page, "expanded", bad);

  // Rename the last part (a short card) long, then empty.
  const lastHead = page.locator(".reading-cards > li").last().locator(".reading-card > :first-child");
  await lastHead.locator("button").first().click();
  const input = page.getByLabel("Part name", { exact: true });
  await input.fill("A much longer part name for the last card");
  await page.getByRole("button", { name: "Save" }).click();
  await rowsHold(page, "renamed long", bad);
  await lastHead.locator("button").first().click();
  await page.getByLabel("Part name", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save" }).click();
  await rowsHold(page, "renamed empty", bad);

  // A memo lands on part B (no reload), then is deleted (no reload).
  const id = await seedMemo(page, { partLabel: "B", state: "ready" });
  await landed(page);
  await expect(page.getByTestId("part-memos")).toHaveCount(1);
  await rowsHold(page, "memo added", bad);
  await idb(page, `await write("memos", (s) => s.delete(arg)); await write("memoAudio", (s) => s.delete(arg));`, id);
  await landed(page);
  await expect(page.getByTestId("part-memos")).toHaveCount(0);
  await rowsHold(page, "memo deleted", bad);

  console.log(bad.join("\n"));
  expect(bad).toEqual([]);
});

for (const width of [768, 1280]) {
  test(`INV-009 a play-view key walk moves no card and writes no li style @${width}`, async ({ page }, info) => {
    test.skip(info.project.name !== "probe-desktop", "keys, desktop");
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
      let worst = 0;
      const seen = new Set<string>();
      for (let i = 0; i < total; i++) {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
        const at = document.querySelector(".tab-column-reading");
        if (at) seen.add(at.closest("li")?.getAttribute("data-card") ?? "?");
        rect().forEach((r, j) => r.forEach((v, k) => { const dlt = Math.abs(v - before[j][k]); worst = Math.max(worst, dlt); if (dlt > 0.5) moved += 1; }));
      }
      return new Promise<{ moved: number; worst: number; cards: number; seen: number }>((res) =>
        requestAnimationFrame(() => requestAnimationFrame(() => res({ moved: moved + records * 1000, worst, cards: lis.length, seen: seen.size }))),
      );
    });
    console.log(`key walk @${width}`, JSON.stringify(out));
    expect(out.seen, "the walk reached every card").toBe(out.cards);
    expect(out.moved).toBe(0);
  });
}
