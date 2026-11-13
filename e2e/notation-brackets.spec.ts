/** INV-004: with rhythm a group's bracket and number sit under the tab, once per group; without it they stay above. */
import { expect, test } from "@playwright/test";
import type { Col } from "./rhythm-probe-helpers";
import { open, seeded } from "./notation-helpers";

const SURFACES = ["song expanded", "song compact", "play", "print"] as const;

const group = (n: number, id: string, count: number | null, d: string | null): Col[] =>
  Array.from({ length: n }, () => ({
    d,
    tupletId: id,
    tupletCount: count,
    groupKind: count === null ? ("plain" as const) : ("tuplet" as const),
  }));

const list = (withRhythm: boolean): Col[] => {
  const d = (x: string) => (withRhythm ? x : null);
  return [
    ...group(3, "t", 3, d("8")),
    { kind: "barline" },
    ...group(2, "p", null, d("q")),
    ...group(5, "f", 5, d("16")),
  ];
};

for (const surface of SURFACES) {
  for (const withRhythm of [true, false]) {
    test(`INV-004 brackets ${withRhythm ? "under" : "above"}, ${surface}`, async ({ page }) => {
      const urls = await seeded(page, list(withRhythm));
      await open(page, surface, urls);
      await expect(page.getByTestId("tab-column")).toHaveCount(11);
      const got = await page.getByTestId("tab-staff").first().evaluate((staff) => {
        const brackets = Array.from(staff.querySelectorAll("[data-testid=tab-bracket]"));
        const cell = (col: Element) => col.querySelector(".tab-cell")!.getBoundingClientRect().top;
        const cols = Array.from(staff.querySelectorAll("[data-testid=tab-column]"));
        return {
          rhythm: staff.hasAttribute("data-rhythm"),
          labels: Array.from(staff.querySelectorAll(".tab-bracket-label")).map((l) => l.textContent),
          brackets: brackets.length,
          inside: brackets.filter((b) => b.closest(".tab-rhythm")).length,
          // y of each bracket against the top of the first string row of its column
          below: brackets.every((b) => b.getBoundingClientRect().top >= cell(b.closest("[data-testid=tab-column]")!)),
          cols: cols.length,
        };
      });
      expect(got.rhythm).toBe(withRhythm);
      expect(got.labels).toEqual(["3", "5"]);
      expect(got.brackets).toBeGreaterThanOrEqual(10);
      expect(got.inside).toBe(withRhythm ? got.brackets : 0);
      expect(got.below).toBe(withRhythm);
    });
  }
}
