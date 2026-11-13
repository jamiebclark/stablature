/**
 * Review probe, INV-011 members the landed `notation-capture.spec.ts` leaves out, at 375×667 on touch:
 * {a tuplet, a plain group} × Th: setting the part's first duration moves the group's bracket under the tab (one
 * number for a tuplet, none for a plain group, no row above), every string stays in the band; clearing it puts the
 * bracket back above, and the staff's markup equals what it was before the first duration.
 * Wrapped (four strings at 412×915): each `.tab-bar-run` draws its own rhythm cells, and no beam crosses runs.
 * INV-018's capture member: the first duration moves no column (x and width) and no string row.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { startWith, TUNINGS } from "./probe-helpers";
import { writeColumns, type Col } from "./rhythm-probe-helpers";

test.setTimeout(300_000);

const grp = (n: number, id: string, count: number | null): Col[] =>
  Array.from({ length: n }, () => ({ d: null, tupletId: id, tupletCount: count, groupKind: count === null ? ("plain" as const) : ("tuplet" as const) }));

async function setDuration(page: Page, words: string) {
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  await page.getByTestId("duration-row").getByRole("button", { name: words, exact: true }).click();
  await page.keyboard.press("Escape");
}

const state = (page: Page) =>
  page.getByTestId("tab-staff").evaluate((staff) => {
    const band = document.querySelector("[data-testid=tab-band]")!.getBoundingClientRect();
    const cells = Array.from(staff.querySelectorAll("[data-testid=tab-column] .tab-cell")).map((c) => c.getBoundingClientRect());
    return {
      rhythm: staff.hasAttribute("data-rhythm"),
      brackets: staff.querySelectorAll("[data-testid=tab-bracket]").length,
      under: staff.querySelectorAll(".tab-rhythm [data-testid=tab-bracket]").length,
      labels: Array.from(staff.querySelectorAll(".tab-bracket-label")).map((l) => l.textContent),
      rowAbove: Array.from(staff.querySelectorAll("[data-testid=tab-column]")).some((c) =>
        (c.firstElementChild as HTMLElement).className.includes("staff-row"),
      ),
      out: cells.filter((c) => c.top < band.top - 0.5 || c.bottom > band.bottom + 0.5).length,
      boxes: Array.from(staff.querySelectorAll("[data-testid=tab-column]")).map((c) => {
        const r = c.getBoundingClientRect();
        return [Math.round(r.x * 100) / 100, Math.round(r.width * 100) / 100];
      }),
    };
  });

for (const kind of ["tuplet", "plain"] as const)
  for (const theme of ["dark", "light"] as const)
    test(`INV-011 first and last duration with a ${kind} group, ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "capture is a phone screen");
      await page.emulateMedia({ colorScheme: theme });
      const { partUrl } = await startWith(page, TUNINGS[2]);
      await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
      const list: Col[] = [{ d: null }, ...grp(3, "g", kind === "tuplet" ? 3 : null), { d: null }];
      await writeColumns(page, partUrl.split("/capture/")[1], list);
      await page.goto(partUrl);
      await expect(columns(page)).toHaveCount(list.length);
      await columns(page).nth(2).click();
      const staff = page.getByTestId("tab-staff");
      const before = await staff.evaluate((el) => el.outerHTML);
      const above = await state(page);
      expect(above.rhythm).toBe(false);
      expect(above.under).toBe(0);
      expect(above.rowAbove).toBe(true);

      await setDuration(page, "eighth note");
      await expect(staff).toHaveAttribute("data-rhythm", "");
      const under = await state(page);
      expect(under.brackets).toBe(above.brackets);
      expect(under.under).toBe(under.brackets);
      expect(under.labels).toEqual(kind === "tuplet" ? ["3"] : []);
      expect(under.rowAbove).toBe(false);
      expect(under.out, "string cells outside the band").toBe(0);
      expect(under.boxes, "INV-018: no column moves or resizes").toEqual(above.boxes);

      await setDuration(page, "eighth note");
      await expect(staff).not.toHaveAttribute("data-rhythm", "");
      expect(await staff.evaluate((el) => el.outerHTML)).toBe(before);
    });

test("INV-011 wrapped: each line its own rhythm cells, no beam across lines", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "capture is a phone screen");
  const { partUrl } = await startWith(page, TUNINGS[0]);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
  const bar: Col[] = Array.from({ length: 8 }, () => ({ d: "8" }));
  const list: Col[] = [...bar, { kind: "barline" }, ...bar, { kind: "barline" }, ...bar, { kind: "barline" }, ...bar];
  await writeColumns(page, partUrl.split("/capture/")[1], list);
  await page.goto(partUrl);
  await expect(columns(page)).toHaveCount(list.length);
  const runs = await page.locator(".tab-bar-run").evaluateAll((els) =>
    els.map((run) => {
      const cells = Array.from(run.querySelectorAll("[data-testid=tab-rhythm][data-rhythm=note]"));
      return {
        top: run.getBoundingClientRect().top,
        cells: cells.length,
        firstLeft: Number(cells[0]?.getAttribute("data-beams-left") ?? -1),
        lastRight: Number(cells.at(-1)?.getAttribute("data-beams-right") ?? -1),
      };
    }),
  );
  expect(new Set(runs.map((r) => Math.round(r.top))).size, "more than one line").toBeGreaterThan(1);
  for (const r of runs) {
    expect(r.cells).toBeGreaterThan(0);
    expect(r.firstLeft).toBe(0);
    expect(r.lastRight).toBe(0);
  }
});
