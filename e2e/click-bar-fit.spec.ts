/**
 * INV-040 / FR-026, round 2. T064 gave Start and the beat box 144px, so at 375 the bar's three slots
 * now share 343px. `INV-040-bar-at-size.spec.ts` asks only that each control's box is on the screen,
 * so a chip squeezed until its words wrap or spill passes it. This one asks that every control's
 * words fit inside its own box, on one line, and that no two controls touch, in each state the bar has.
 */
import { expect, test, type Page } from "@playwright/test";
import { cols, recorder, seed } from "./rhythm-probe-helpers";

const measure = (page: Page, ids: string[]) =>
  page.evaluate((list) => {
    const out: Record<string, unknown>[] = [];
    for (const id of list) {
      const el = document.querySelector(`[data-testid=${id}]`) as HTMLElement | null;
      if (!el) continue;
      const box = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      const text = range.getBoundingClientRect();
      const lines = new Set(Array.from(range.getClientRects()).map((r) => Math.round(r.top))).size;
      out.push({
        id,
        x: Math.round(box.x),
        right: Math.round(box.right),
        w: Math.round(box.width),
        h: Math.round(box.height),
        textW: Math.round(text.width),
        lines,
        spills: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
        words: el.textContent,
      });
    }
    return out;
  }, ids);

type Row = { id: string; x: number; right: number; w: number; h: number; lines: number; spills: boolean; words: string };

function problems(rows: Row[], where: string) {
  const out: string[] = [];
  const sorted = [...rows].sort((a, b) => a.x - b.x);
  for (const [i, r] of sorted.entries()) {
    if (r.right > 375 - 16) out.push(`${where}: ${r.id} ends at ${r.right}, past the bar's edge at 359`);
    if (r.right > 375) out.push(`${where}: ${r.id} ends at ${r.right}, off the screen`);
    if (r.h < 44) out.push(`${where}: ${r.id} is ${r.h} high`);
    if (r.id !== "click-beat" && r.lines !== 1) out.push(`${where}: ${r.id} "${r.words}" takes ${r.lines} lines`);
    if (r.id !== "click-beat" && r.spills) out.push(`${where}: ${r.id} "${r.words}" spills its box`);
    if (i > 0 && r.x <= sorted[i - 1].right) out.push(`${where}: ${r.id} touches ${sorted[i - 1].id}`);
  }
  return out;
}

const IDLE = ["click-start", "click-follow", "tempo-control"];
const RUNNING = ["click-beat", "click-stop", "tempo-control"];

const sideways = (page: Page) =>
  page.evaluate(() => ({ page: document.documentElement.scrollWidth, screen: innerWidth }));

for (const bpm of [96, 120, 400, 999, null]) {
  test(`INV-040 the bar fits at 375 with ${bpm ?? "no"} tempo, in every state`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await recorder(page);
    const { playUrl } = await seed(page, cols("q", "q", "q", "q"), { bpm });
    await page.goto(playUrl);
    await expect(page.getByTestId("click-follow")).toBeVisible();
    const found: string[] = [];
    const look = async (ids: string[], where: string) => {
      const rows = (await measure(page, ids)) as unknown as Row[];
      const side = await sideways(page);
      console.log(`BAR ${where}: ${JSON.stringify(rows.map((r) => [r.id, r.x, r.right, r.lines]))} page ${side.page}/${side.screen}`);
      found.push(...problems(rows, where));
      // Against 375, not innerWidth: on a phone the layout viewport grows with the page, so they always match.
      if (side.page > 375) found.push(`${where}: the page is ${side.page} wide on a 375 screen`);
    };

    await look(IDLE, `${bpm} following`);
    await page.getByTestId("click-follow").click();
    await expect(page.getByTestId("click-follow")).toHaveAttribute("aria-pressed", "false");
    await look(IDLE, `${bpm} plain`);
    if (bpm !== null) {
      await page.getByTestId("click-start").click();
      await expect(page.getByTestId("click-stop")).toBeVisible();
      await look(RUNNING, `${bpm} running`);
    }
    expect(found).toEqual([]);
  });
}

// MINOR F19. A `test.fail`, so a re-run stays green and flags the day it is fixed.
test("INV-024 a keyboard double press on Start leaves the click running", async ({ page }) => {
  test.fail();
  await page.setViewportSize({ width: 375, height: 667 });
  await recorder(page);
  const { playUrl } = await seed(page, cols("q", "q"), { bpm: 120 });
  await page.goto(playUrl);
  await page.getByTestId("click-start").focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await expect(page.getByTestId("click-stop")).toHaveCount(1);
});
