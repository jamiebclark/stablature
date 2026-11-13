/**
 * Review probe, spec 008 FR-011 / SC-001: measure (not compute) the after-figures FR-011 asks for at the four sizes,
 * six strings with a chord row and a bracket, cursor at the end of a 16-bar part: band height, line height, lines
 * shown (whole, and any partial), and the blank height at rest. Prints a table; asserts SC-001 (blank under a line
 * at 412×915).
 */
import { expect, test } from "@playwright/test";
import { longPart } from "./helpers";

const SIZES = {
  mobile: [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ],
  desktop: [{ width: 1280, height: 800 }],
};

test("FR-011 after-figures, measured", async ({ page }, info) => {
  const sizes = SIZES[info.project.name as "mobile" | "desktop"];
  await longPart(page, { chord: true, bracket: true, bars: 48, size: sizes[0] });
  const rows: string[] = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.getByTestId("status-row").getByRole("button", { name: "end ⇥" }).click();
    await page.waitForTimeout(700);
    const m = await page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      const s = getComputedStyle(band);
      const box = band.getBoundingClientRect();
      const top = box.top + parseFloat(s.paddingTop);
      const bottom = box.bottom - parseFloat(s.paddingBottom);
      const line = band.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect().height;
      const tops = new Map<number, DOMRect>();
      for (const r of band.querySelectorAll(".tab-bar-run")) {
        const b = r.getBoundingClientRect();
        if (!tops.has(Math.round(b.top))) tops.set(Math.round(b.top), b);
      }
      const lines = [...tops.values()];
      const whole = lines.filter((b) => b.top >= top - 0.5 && b.bottom <= bottom + 0.5).length;
      const partial = lines.filter((b) => b.bottom > top + 0.5 && b.top < top - 0.5);
      // One line: there are no runs, so the staff itself is the content.
      const staff = band.querySelector('[data-testid="tab-staff"]')!.getBoundingClientRect();
      const firstContent = lines.length ? Math.min(...lines.filter((b) => b.bottom > top + 0.5).map((b) => b.top)) : staff.top;
      return {
        band: bottom - top,
        line,
        wrapped: !!band.querySelector(".tab-staff-wrapped"),
        whole,
        partialPx: partial.length ? partial[0].bottom - top : 0,
        blank: Math.max(0, firstContent - top),
      };
    });
    rows.push(`${size.width}x${size.height}: band ${m.band.toFixed(1)}, line ${m.line.toFixed(1)}, wrapped ${m.wrapped}, whole lines ${m.wrapped ? m.whole : 1}, partial ${m.partialPx.toFixed(1)}px, blank at rest ${m.blank.toFixed(1)}`);
    if (size.width === 412) expect(m.blank, "SC-001").toBeLessThan(m.line);
  }
  console.log(rows.join("\n"));
});
