import { expect, test } from "@playwright/test";
import { THEMES } from "./capture-surface-helpers";
import { TUNINGS, emptySong, pasteTab, startWith, tabText } from "./import-helpers";

test.use({ viewport: { width: 375, height: 667 } });

for (const theme of THEMES) {
  test(`idle and ready panels fit the phone (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    const seeded = await startWith(page, TUNINGS[0]);
    await emptySong(page, seeded.songUrl);
    await page.getByRole("button", { name: "Paste tab" }).first().click();

    for (const state of ["idle", "ready"] as const) {
      if (state === "ready") await pasteTab(page, await tabText(2000));
      const panel = page.getByTestId("paste-tab");
      await expect(panel).toBeVisible();
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll).toBeLessThanOrEqual(doc.client);
      const box = await page.getByRole("textbox", { name: "Tab text" }).boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      for (const button of await panel.getByRole("button").all()) {
        const b = await button.boundingBox();
        expect(b!.x).toBeGreaterThanOrEqual(0);
        expect(b!.x + b!.width).toBeLessThanOrEqual(375);
      }
      const faded = await panel.evaluate((el) => {
        for (let n: Element | null = el; n; n = n.parentElement)
          if (Number(getComputedStyle(n).opacity) < 1) return true;
        return false;
      });
      expect(faded).toBe(false);
      const ratio = await page.getByRole("status").evaluate((el) => {
        const fg = getComputedStyle(el).color;
        let bg = "rgba(0, 0, 0, 0)";
        for (let n: Element | null = el; n; n = n.parentElement) {
          const c = getComputedStyle(n).backgroundColor;
          if (c !== "rgba(0, 0, 0, 0)") {
            bg = c;
            break;
          }
        }
        const lum = (css: string) => {
          const [r, g, b] = (css.match(/[\d.]+/g) ?? ["0", "0", "0"])
            .slice(0, 3)
            .map(Number)
            .map((v) => {
              const s = v / 255;
              return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
            });
          return 0.2126 * r + 0.7152 * g + 0.0722 * b;
        };
        const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a);
        return (hi + 0.05) / (lo + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    }
  });
}

// INV-028: refusal states at 375px, 4/5/6 strings, a 200- and a 2,000-character line.
for (const rows of [4, 5, 6]) {
  for (const width of [200, 2000]) {
    test(`a refusal over ${rows} rows with a ${width}-character line fits the phone`, async ({ page }) => {
      const seeded = await startWith(page, TUNINGS[0]);
      await emptySong(page, seeded.songUrl);
      const names = ["E", "B", "G", "D", "A", "C"].slice(0, rows);
      const body = (n: number, first: string) => `${first}${"-".repeat(n - first.length)}`;
      const lines = names.map((n, i) => `${n} |${body(width, i === 0 ? "-5s7" : "")}|`);
      await pasteTab(page, lines.join("\n"));
      const refusals = page.getByTestId("paste-refusals");
      await expect(refusals.locator("[data-line]").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /Import|Switch to/ })).toHaveCount(0);
      const doc = await page.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        client: document.documentElement.clientWidth,
      }));
      expect(doc.scroll).toBeLessThanOrEqual(doc.client);
      const box = await refusals.boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    });
  }
}
