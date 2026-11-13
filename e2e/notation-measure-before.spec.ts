/**
 * Spec 009 quickstart §1: the "before" figures, measured on the UNEDITED tree and written to
 * specs/009-rhythm-notation/research-probes/measure-before.json. Records only; it asserts that a figure
 * was found, and the numbers are compared with research R1/R2 by hand (T001). Run before any source edit.
 */
import { expect, test } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { addChord, addRests, columns, selectColumns, startWith, TUNINGS, tupletControl } from "./probe-helpers";

test.setTimeout(120_000);

const OUT = "specs/009-rhythm-notation/research-probes/measure-before.json";
const SIZES = [
  { name: "375x667-touch", width: 375, height: 667 },
  { name: "1280x800-fine", width: 1280, height: 800 },
];

test("measure the band and the lowest string's mask before any edit", async ({ page, isMobile }) => {
  const key = isMobile ? "touch" : "fine";
  const size = SIZES.find((s) => s.name.endsWith(key))!;
  await startWith(page, TUNINGS[2]);
  await page.setViewportSize({ width: size.width, height: size.height });
  await page.getByTestId("fret-grid").getByRole("button").last().click();
  await expect(columns(page)).toHaveCount(1);
  await addRests(page, 2);
  await addChord(page, 0, "Am");
  await selectColumns(page, 0, 2);
  await tupletControl(page).click();
  await expect(page.locator('[data-testid="tab-bracket"][data-start]')).toHaveCount(1);

  const m = await page.evaluate(() => {
    const r = (n: number) => Math.round(n * 100) / 100;
    const band = document.querySelector('[data-testid="tab-band"]') as HTMLElement;
    const staff = document.querySelector('[data-testid="tab-staff"]') as HTMLElement;
    const bs = getComputedStyle(band);
    const outer = band.getBoundingClientRect().height;
    const content = outer - parseFloat(bs.paddingTop) - parseFloat(bs.paddingBottom);
    const staffH = staff.getBoundingClientRect().height;
    const rowPx = parseFloat(getComputedStyle(staff).getPropertyValue("--staff-row")) || null;
    const rootRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const rowVar = getComputedStyle(document.documentElement).getPropertyValue("--staff-row").trim();
    const staffRow = rowVar.endsWith("rem") ? parseFloat(rowVar) * rootRem : rowPx;

    // The lowest string's cell in the first column, and its fret-number span (the mask).
    const col = document.querySelector('[data-testid="tab-column"]') as HTMLElement;
    const cells = [...col.querySelectorAll(".tab-cell")] as HTMLElement[];
    const cell = cells[cells.length - 1];
    const span = cell.querySelector("span") as HTMLElement;
    const cr = cell.getBoundingClientRect();
    const sr = span.getBoundingClientRect();
    let digit: { top: number; bottom: number; height: number } | null = null;
    const text = span.firstChild;
    if (text && text.nodeType === 3 && (text.textContent ?? "").trim()) {
      const range = document.createRange();
      range.selectNodeContents(text);
      const d = range.getBoundingClientRect();
      digit = { top: r(d.top - cr.top), bottom: r(d.bottom - cr.top), height: r(d.height) };
    }

    // A 12px numeral with line-height 9px in the staff's font.
    const probe = document.createElement("div");
    probe.textContent = "8";
    probe.style.cssText = "position:absolute;font-size:12px;line-height:9px;white-space:nowrap";
    probe.style.fontFamily = getComputedStyle(staff).fontFamily;
    staff.appendChild(probe);
    const pb = probe.getBoundingClientRect();
    const numeral = { height: r(pb.height), width: r(pb.width), fontFamily: getComputedStyle(probe).fontFamily };
    probe.remove();

    const rows = ["tab-bar-number", "tab-bracket"].map((id) => id);
    return {
      band: { outer: r(outer), content: r(content), paddingTop: bs.paddingTop, paddingBottom: bs.paddingBottom },
      staff: { height: r(staffH) },
      staffRow: staffRow === null ? null : r(staffRow),
      oneLine: staffRow === null ? null : r(staffRow),
      stringHeight: r(cr.height),
      lowestString: {
        cellHeight: r(cr.height),
        maskTop: r(sr.top - cr.top),
        maskBottom: r(sr.bottom - cr.top),
        maskHeight: r(sr.height),
        freeBelowMask: r(cr.bottom - sr.bottom),
        digit,
        spanText: span.textContent,
      },
      numeral,
      rowsPresent: rows,
      chordRow: !!staff.textContent?.includes("Am"),
    };
  });

  expect(m.band.outer).toBeGreaterThan(0);
  expect(m.lowestString.maskHeight).toBeGreaterThan(0);
  const file = `${OUT}`;
  mkdirSync(dirname(file), { recursive: true });
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  } catch {
    /* first write */
  }
  all[size.name] = m;
  writeFileSync(file, JSON.stringify(all, null, 2) + "\n");
});
