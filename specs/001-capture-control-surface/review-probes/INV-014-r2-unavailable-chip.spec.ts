/**
 * INV-014 / FR-009 (round 2): the plan's 5 pairs cover the unarmed and the armed chip,
 * not the unavailable one, which FR-009 says must be VISIBLY unavailable and which uses
 * `disabled:opacity-40`. Both themes, cursor on a barline: reports the chip's computed
 * colours and writes an actual-size screenshot to the temp dir for a human eye.
 */
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { fret, stackLatch, startCapturing } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`unavailable chip - ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a colour");
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await page.getByRole("button", { name: "Barline" }).click();
    await expect(stackLatch(page)).toBeDisabled();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);

    const m = await stackLatch(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      const strip = getComputedStyle(el.parentElement!.parentElement!).backgroundColor;
      return { bg: cs.backgroundColor, border: cs.borderTopColor, ink: cs.color, opacity: cs.opacity, strip };
    });
    console.log(`${theme}: ${JSON.stringify(m)}`);
    await page.screenshot({ path: path.join(os.tmpdir(), `spec001-chip-${theme}.png`) });
    expect(Number(m.opacity)).toBeGreaterThan(0);
  });
}
