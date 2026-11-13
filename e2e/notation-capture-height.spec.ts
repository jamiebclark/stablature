/**
 * Review probe, INV-005 and INV-008 over their whole sets, at 375×667 on touch:
 * Str {4, 5, 6} × Cap (all six rows) × Th {dark, light} × cursor {at the end, on the group's labelled column,
 * a selection across the group}, each with a chord row (the binding case of FR-018).
 *
 * INV-005: every string cell, the chord row, every rhythm cell, bracket and numeral lie inside the band's content
 * box; the page does not scroll; the band is at least 189px tall.
 * INV-008: a stem's top is at or below the lowest fret label's bottom in its column; the beam stack ends 1px above
 * the bracket line; the bracket line ends above the numeral; the numeral ends 2px above the column's bottom (the
 * capture cursor's 2px rule); the numeral is at least 12px. The landed `notation-capture-height.spec.ts` reads
 * `[data-part=numeral]`, `[data-part=bracket-line]` and `[data-testid=tab-chord]`, which nothing draws.
 * Also measured, not asserted: rows of digit ink inside the column's bottom 2px, where the cursor's rule paints.
 */
import { expect, test, type Page } from "@playwright/test";
import { addChord, columns } from "./capture-surface-helpers";
import { startWith, TUNINGS } from "./probe-helpers";
import { writeColumns, type Col } from "./rhythm-probe-helpers";

test.setTimeout(900_000);

const grp = (n: number, id: string, count: number | null, d: string | null): Col[] =>
  Array.from({ length: n }, () => ({
    d,
    tupletId: id,
    tupletCount: count,
    groupKind: count === null ? ("plain" as const) : ("tuplet" as const),
  }));

/** Cap: [name, list, index of the labelled column of the group the cursor visits, the group's first and last]. */
const CAP: [string, Col[], [number, number, number] | null][] = [
  ["no group, no durations", [{ d: null }, { d: null }, { d: null }, { d: null }, { d: null }], null],
  ["plain group, no durations", [{ d: null }, ...grp(3, "p", null, null), { d: null }], [2, 1, 3]],
  ["counted group, no durations", [{ d: null }, ...grp(3, "t", 3, null), { d: null }], [2, 1, 3]],
  ["no group, durations", [{ d: "q" }, { d: "8" }, { d: "8" }, { d: "16" }, { d: "32" }, { d: "32" }, { d: "h" }], null],
  ["counted group, durations", [{ d: "q" }, ...grp(3, "t", 3, "8"), { d: "32" }, { d: "32" }], [2, 1, 3]],
  ["plain and counted, durations", [{ d: "q" }, ...grp(3, "t", 3, "8"), ...grp(2, "p", null, "16"), { d: "w" }], [2, 1, 3]],
];

const measure = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector("[data-testid=tab-band]") as HTMLElement;
    const cs = getComputedStyle(band);
    const box = band.getBoundingClientRect();
    const top = box.top + parseFloat(cs.paddingTop);
    const bottom = box.bottom - parseFloat(cs.paddingBottom);
    const bad: string[] = [];
    const inside = (name: string, el: Element) => {
      const b = el.getBoundingClientRect();
      if (b.height === 0) return;
      if (b.top < top - 0.5 || b.bottom > bottom + 0.5) bad.push(`${name} ${b.top.toFixed(1)}-${b.bottom.toFixed(1)} outside ${top.toFixed(1)}-${bottom.toFixed(1)}`);
    };
    const staff = band.querySelector("[data-testid=tab-staff]")!;
    staff.querySelectorAll("[data-testid=tab-column] .tab-cell").forEach((el) => inside("cell", el));
    staff.querySelectorAll("[data-testid=tab-column] > div.text-accent").forEach((el) => inside("chord row", el));
    staff.querySelectorAll("[data-testid=tab-rhythm]").forEach((el) => inside("rhythm cell", el));
    staff.querySelectorAll(".tab-bracket, .tab-bracket-label").forEach((el) => inside(el.className, el));
    const chordRows = staff.querySelectorAll("[data-testid=tab-column] > div.text-accent").length;

    const ink: number[] = [];
    for (const col of Array.from(staff.querySelectorAll("[data-testid=tab-column]"))) {
      const c = col.getBoundingClientRect();
      const r = col.querySelector("[data-testid=tab-rhythm]");
      if (!r) continue;
      const spans = Array.from(col.querySelectorAll(".tab-cell > span")).map((s) => s.getBoundingClientRect().bottom);
      const lowestCell = Array.from(col.querySelectorAll(".tab-cell")).at(-1)!.getBoundingClientRect();
      const stem = r.querySelector("[data-part=stem]")?.getBoundingClientRect();
      if (stem && spans.length && stem.top < Math.max(...spans) - 0.5) bad.push(`stem top ${stem.top} above a fret label ${Math.max(...spans)}`);
      if (stem && stem.top < lowestCell.top - 0.5) bad.push("stem starts above the lowest string row");
      const beams = Array.from(r.querySelectorAll("[data-part=beam], [data-part=stub], [data-part=flag]")).map((b) => b.getBoundingClientRect().bottom);
      const bracket = r.querySelector(".tab-bracket");
      const label = r.querySelector(".tab-bracket-label") as HTMLElement | null;
      if (bracket) {
        const lineTop = bracket.getBoundingClientRect().bottom - 1;
        if (beams.length && Math.max(...beams) > lineTop - 1 + 0.5) bad.push(`beam stack ${Math.max(...beams)} reaches bracket line ${lineTop}`);
        if (label && bracket.getBoundingClientRect().bottom > label.getBoundingClientRect().top + 0.5) bad.push("bracket line crosses the numeral");
      }
      if (label) {
        const l = label.getBoundingClientRect();
        if (l.bottom > c.bottom - 2 + 0.5) bad.push(`numeral bottom ${l.bottom.toFixed(1)} within 2px of column bottom ${c.bottom.toFixed(1)}`);
        if (parseFloat(getComputedStyle(label).fontSize) < 12) bad.push("numeral under 12px");
        ink.push(c.bottom);
      }
    }
    return {
      bad,
      bandOuter: Math.round(box.height * 100) / 100,
      bandContent: Math.round((bottom - top) * 100) / 100,
      overflow: document.documentElement.scrollHeight - innerHeight,
      rhythm: staff.querySelectorAll("[data-testid=tab-rhythm]").length,
      chordRows,
      labels: staff.querySelectorAll(".tab-bracket-label").length,
    };
  });

/** Pixels of digit ink in the bottom 2px of the labelled column (where the cursor's rule paints), cursor elsewhere. */
async function inkUnderRule(page: Page): Promise<number | null> {
  const label = page.locator("[data-testid=tab-rhythm] .tab-bracket-label").first();
  if ((await label.count()) === 0) return null;
  const box = await label.evaluate((el) => {
    const l = el.getBoundingClientRect();
    const c = el.closest("[data-testid=tab-column]")!.getBoundingClientRect();
    return { x: Math.floor(l.left), y: Math.round(c.bottom - 2), width: Math.ceil(l.width), height: 2 };
  });
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = "data:image/png;base64," + b64;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, img.width, img.height).data;
    const y = (i: number) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
    // The band's background is the lightest or darkest pixel; ink is what differs from the row's mode.
    const lums: number[] = [];
    for (let i = 0; i < d.length; i += 4) lums.push(Math.round(y(i)));
    const counts = new Map<number, number>();
    for (const v of lums) counts.set(v, (counts.get(v) ?? 0) + 1);
    const bg = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    return lums.filter((v) => Math.abs(v - bg) > 60).length;
  }, shot.toString("base64"));
}

const figures: Record<string, unknown> = {};

for (const tuning of TUNINGS)
  for (const theme of ["dark", "light"] as const)
    test(`INV-005 INV-008 ${tuning.strings} strings, ${theme}, every Cap row`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "the height budget is the touch column");
      await page.emulateMedia({ colorScheme: theme });
      const { partUrl } = await startWith(page, tuning);
      await page.getByRole("button", { name: /string, fret 5,/ }).first().click();
      await expect(columns(page)).toHaveCount(1);
      const partId = partUrl.split("/capture/")[1];
      const failures: string[] = [];
      for (const [name, list, group] of CAP) {
        await writeColumns(page, partId, list);
        await page.goto(partUrl);
        await expect(columns(page)).toHaveCount(list.length);
        await addChord(page, 0, "Am7");
        // Leave the cursor at the end: a reload puts it there.
        await page.goto(partUrl);
        await expect(columns(page)).toHaveCount(list.length);
        const states: [string, () => Promise<void>][] = [["end", async () => {}]];
        if (group) {
          const [labelled, first, last] = group;
          states.push(["labelled", async () => void (await columns(page).nth(labelled).click())]);
          states.push([
            "selection",
            async () => {
              await columns(page).nth(first).click();
              await page.getByRole("button", { name: /select/ }).click();
              await columns(page).nth(last).click();
            },
          ]);
        }
        for (const [state, go] of states) {
          if (state === "end") figures[`${tuning.strings} ${theme} ${name} ink`] = await inkUnderRule(page);
          await go();
          await page.waitForTimeout(150);
          const m = await measure(page);
          figures[`${tuning.strings} ${theme} ${name} ${state}`] = m;
          const tag = `${tuning.strings} strings, ${theme}, ${name}, ${state}`;
          if (m.chordRows === 0) failures.push(`${tag}: no chord row drawn`);
          if (!name.includes("no durations") && m.rhythm === 0) failures.push(`${tag}: no rhythm row`);
          if (name.includes("no durations") && m.rhythm > 0) failures.push(`${tag}: a rhythm row with no durations`);
          for (const b of m.bad) failures.push(`${tag}: ${b}`);
          if (m.overflow > 0) failures.push(`${tag}: page scrolls ${m.overflow}`);
          if (m.bandOuter < 189) failures.push(`${tag}: band ${m.bandOuter}`);
        }
        if (group) await page.keyboard.press("Escape");
      }
      await info.attach("figures", { body: JSON.stringify(figures, null, 2), contentType: "application/json" });
      console.log(JSON.stringify({ [`${tuning.strings}-${theme}`]: figures }, null, 1));
      expect(failures).toEqual([]);
    });
