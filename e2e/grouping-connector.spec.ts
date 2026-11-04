/**
 * INV-023, "a connector inside the span": what the line is made of, segment by segment, on the
 * capture staff and on the song page, with the cursor outside the span. Reports, then asserts
 * the line covers the span from the first column's left to the last column's right.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  brackets,
  chip,
  columns,
  connectors,
  fret,
  groupControl,
  selectColumns,
  startCapturing,
  tupletControl,
} from "./probe-helpers";

const shape = (page: Page) =>
  page.getByTestId("tab-staff").first().evaluate((staff) => {
    const box = (e: Element) => {
      const r = e.getBoundingClientRect();
      return [Math.round(r.left * 10) / 10, Math.round(r.right * 10) / 10];
    };
    const row = [...staff.querySelectorAll('[data-testid="tab-column"], [data-testid="tab-connector"], [data-testid="tab-caret"]')];
    return {
      parts: row.map((e) => [e.getAttribute("data-testid"), ...box(e)]),
      line: [...staff.querySelectorAll(".tab-bracket")].map(box).sort((a, b) => a[0] - b[0]),
    };
  });

for (const kind of ["tuplet", "plain"] as const) {
  test(`a hammer-on inside a ${kind} group`, async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "one project is enough for a measurement");
    const { songUrl } = await startCapturing(page);
    await fret(page, "E", 5).click();
    await expect(columns(page)).toHaveCount(1);
    await chip(page, "hammer-on").click();
    await fret(page, "E", 7).click();
    await expect(columns(page)).toHaveCount(2);
    await expect(connectors(page)).toHaveCount(1);
    await fret(page, "E", 3).click();
    await expect(columns(page)).toHaveCount(3);
    await selectColumns(page, 0, 1);
    await (kind === "plain" ? groupControl(page) : tupletControl(page)).click();
    await expect(brackets(page)).toHaveCount(1);
    await columns(page).nth(2).click();
    const capture = await shape(page);
    console.log(JSON.stringify({ kind, surface: "capture", ...capture }));
    await page.screenshot({ path: `${info.outputDir}/capture.png` });
    await page.goto(songUrl);
    await expect(brackets(page)).toHaveCount(1);
    const song = await shape(page);
    console.log(JSON.stringify({ kind, surface: "song", ...song }));

    for (const { line } of [capture, song]) {
      for (let i = 1; i < line.length; i++) {
        expect(Math.abs(line[i][0] - line[i - 1][1])).toBeLessThan(0.51);
      }
    }
  });
}
