/**
 * INV-014 / FR-006 / FR-029 (round 3): round 2's owed look. T060 gave the armed chip a border
 * that T037's browser pass predates. Both themes at 375x667, actual size: the armed chip,
 * its neighbours and the fill it must match. Its border must be the same colour as its fill,
 * or the emphasis gains a visible ring the old stack button never had (FR-006). Also proves
 * the armed chip carries the old button's fill, by reading the accent token. Screenshots go
 * to the temp dir for a human eye.
 */
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { columns, fret, stackLatch, startCapturing } from "./helpers";

for (const theme of ["light", "dark"] as const) {
  test(`armed chip - ${theme}`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a colour");
    await page.emulateMedia({ colorScheme: theme });
    await page.setViewportSize({ width: 375, height: 667 });
    await startCapturing(page);
    await fret(page, "E", 7).click();
    await fret(page, "A", 5).click();
    await expect(columns(page)).toHaveCount(2);
    await stackLatch(page).click();
    await expect(stackLatch(page)).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 0);
    await page.waitForTimeout(300);

    const m = await stackLatch(page).evaluate((el) => {
      const cs = getComputedStyle(el);
      const probe = document.createElement("span");
      probe.style.color = "var(--accent)";
      document.body.append(probe);
      const accent = getComputedStyle(probe).color;
      probe.style.color = "var(--accent-text)";
      const accentText = getComputedStyle(probe).color;
      probe.remove();
      return {
        bg: cs.backgroundColor,
        border: cs.borderTopColor,
        borderWidth: cs.borderTopWidth,
        ink: cs.color,
        accent,
        accentText,
        height: el.getBoundingClientRect().height,
      };
    });
    console.log(`${theme}: ${JSON.stringify(m)}`);
    await page.screenshot({ path: path.join(os.tmpdir(), `spec001-r3-armed-${theme}.png`) });

    expect(m.bg).toBe(m.accent);
    expect(m.ink).toBe(m.accentText);
    expect(m.border, "the border disappears into the fill").toBe(m.bg);
    expect(parseFloat(m.borderWidth)).toBeGreaterThan(0);
  });
}
