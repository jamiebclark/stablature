/** Spec 013 research R3: why the long song's 16-bar ruler measures 0px in the app. Records only. */
import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { seedWideSong } from "../../../e2e/wide-helpers";
import { seedSong } from "../../../e2e/reading-helpers";
import { bars } from "../../../e2e/wide-helpers";

test.setTimeout(300_000);

test("long ruler", async ({ page }) => {
  const out: Record<string, unknown> = {};
  const { playUrl } = await seedWideSong(page, "long");
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(playUrl);
  await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
  await page.waitForTimeout(500);
  out.long = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]')].map((r) => ({
      attr: (r.getAttribute("style") ?? "").length,
      inline: r.style.width.length,
      computed: getComputedStyle(r).width,
      rect: r.getBoundingClientRect().width,
      head: (r.getAttribute("style") ?? "").slice(0, 120),
    })),
  );
  const counts = [4, 6, 8, 10, 12, 14, 16];
  const seeded = await seedSong(
    page,
    counts.map((c) => ({ key: `p${c}`, label: `B${c}`, columns: bars(c) })),
    counts.map((c) => ({ part: `p${c}` })),
  );
  await page.goto(seeded.playUrl);
  await expect(page.getByTestId("tab-ruler").first()).toBeAttached();
  await page.waitForTimeout(500);
  out.byBars = await page.evaluate(
    (counts) =>
      [...document.querySelectorAll<HTMLElement>('[data-testid="tab-ruler"]')].map((r, i) => ({
        bars: counts[i],
        attr: (r.getAttribute("style") ?? "").length,
        inline: r.style.width.length,
        rect: r.getBoundingClientRect().width,
      })),
    counts,
  );
  writeFileSync("specs/013-cards-per-row/research-probes/long-ruler.json", JSON.stringify(out, null, 1) + "\n");
});
