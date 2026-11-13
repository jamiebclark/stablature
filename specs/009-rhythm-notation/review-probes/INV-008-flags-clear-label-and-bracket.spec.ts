/**
 * Review probe (round 2), INV-008 over its flag members: Sym × {in no group, in a group on its labelled column} ×
 * {active column, not} × Sz × {a note on the lowest string, none there}, plus research R2's band table, which puts
 * "stems, beams, flags, rests and the whole-note oval" in the stem band (touch −4.4 to 7.1 from the rhythm row's
 * top; fine −3.4 to 8.1), below the lowest fret number's mask.
 *
 * Round 1's fix for F3 (T052) raised the flag step from 4px to 6px. The saved INV-005/INV-008 probe measures each
 * flag's svg box, never its stroke, and none of its Cap rows has a flagged note under a bracket, so neither the
 * fret label nor the bracket line was ever checked against a flag.
 *
 * The set: every Sym member alone in its beat under a two-digit fret on every string; a counted group still being built
 * (stems and flags, a numeral) for each flag count; and a counted triplet of a quarter and an eighth, which reads and
 * leaves the eighth flagged under the bracket.
 *
 * Each rhythm part's ink is measured in screen space: a div's rect, or for an svg each path sampled through
 * `getScreenCTM` and widened by half its stroke. Asserted, per drawn note:
 *   1. no part's ink rises above the stem band's top (the lowest cell's mask bottom), so nothing crosses a fret number;
 *   2. in a column with a bracket under the tab, every beam, stub and flag ends 1px above the bracket line;
 *   3. the line ends above the numeral, the numeral ends 2px above the column's bottom, and it is 12px or more.
 * And by pixels: the lowest fret label's crop with a lone 8th/16th/32nd differs from the same crop with a quarter
 * (which has no flag) by no more than anti-aliasing noise.
 */
import { expect, test, type Page } from "@playwright/test";
import { seed, writeColumns, type Col } from "../../../e2e/rhythm-probe-helpers";

test.setTimeout(300_000);

// Every string fretted at 12, so the lowest string certainly carries a two-digit label.
const ALL = { 0: 12, 1: 12, 2: 12, 3: 12, 4: 12 };
const n = (d: string, frets: Col["frets"] = ALL): Col => ({ d, frets });
const r = (d: string): Col => ({ d, kind: "rest", frets: {} });
const bar: Col = { kind: "barline" };
const building = (d: string, id: string): Col[] =>
  [0, 1, 2].map(() => ({ d, frets: ALL, tupletId: id, tupletCount: 5, groupKind: "tuplet" as const }));

/** Every Sym member alone in its beat, then a counted group still being built (stems and flags, a numeral) per flag count. */
const LIST: Col[] = [
  n("q"), n("8"), n("q"), bar,
  n("q"), n("16"), n("q"), bar,
  n("q"), n("32"), n("q"), bar,
  n("w"), bar, n("h"), n("h"), bar,
  r("w"), bar, r("h"), r("h"), bar,
  r("q"), r("8"), r("16"), r("32"), bar,
  ...building("8", "g8"), bar,
  ...building("16", "g16"), bar,
  ...building("32", "g32"), bar,
  // The shuffle figure: a counted triplet of a quarter and an eighth. It reads, the quarter breaks the unit, so the
  // eighth is alone and takes a flag, under the bracket and on the group's labelled column.
  { d: "q", frets: ALL, tupletId: "sh", tupletCount: 3, groupKind: "tuplet" },
  { d: "8", frets: ALL, tupletId: "sh", tupletCount: 3, groupKind: "tuplet" },
];

interface Got {
  index: number;
  duration: string;
  bad: string[];
}

const measure = (page: Page) =>
  page.getByTestId("tab-staff").first().evaluate((staff) => {
    const out: { index: number; duration: string; bad: string[] }[] = [];
    const ink = (el: Element) => {
      if (el instanceof SVGSVGElement) {
        let top = Infinity, bottom = -Infinity;
        for (const path of Array.from(el.querySelectorAll("path"))) {
          const m = path.getScreenCTM()!;
          const w = (parseFloat(getComputedStyle(path).strokeWidth) * Math.hypot(m.a, m.b)) / 2;
          const len = path.getTotalLength();
          for (let i = 0; i <= 200; i++) {
            const p = path.getPointAtLength((len * i) / 200);
            const y = m.b * p.x + m.d * p.y + m.f;
            top = Math.min(top, y - w);
            bottom = Math.max(bottom, y + w);
          }
        }
        return { top, bottom };
      }
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom };
    };
    Array.from(staff.querySelectorAll("[data-testid=tab-column]")).forEach((col, index) => {
      const cell = col.querySelector("[data-testid=tab-rhythm]");
      const duration = cell?.getAttribute("data-duration");
      if (!cell || !duration) return;
      const bad: string[] = [];
      const cells = Array.from(col.querySelectorAll(".tab-cell"));
      const lowest = cells.at(-1)!;
      const lc = lowest.getBoundingClientRect();
      const text = parseFloat(getComputedStyle(lowest).fontSize);
      const bandTop = lc.bottom - (lc.height - text) / 2;
      const span = lowest.querySelector(":scope > span")?.getBoundingClientRect();
      const ceiling = span ? Math.max(span.bottom, bandTop) : bandTop;
      for (const part of Array.from(cell.querySelectorAll("[data-part]"))) {
        const k = ink(part);
        const name = `${part.getAttribute("data-part")}${part.getAttribute("data-level") ?? ""}`;
        if (k.top < ceiling - 0.5)
          bad.push(`${name} ink top ${k.top.toFixed(2)} is ${(ceiling - k.top).toFixed(2)}px above the stem band (lowest label ${span ? "present" : "absent"})`);
      }
      const bracket = cell.querySelector(".tab-bracket");
      const label = cell.querySelector(".tab-bracket-label") as HTMLElement | null;
      if (bracket) {
        const lineTop = bracket.getBoundingClientRect().bottom - 1;
        for (const part of Array.from(cell.querySelectorAll("[data-part=beam], [data-part=stub], [data-part=flag]"))) {
          const k = ink(part);
          if (k.bottom > lineTop - 1 + 0.25)
            bad.push(`${part.getAttribute("data-part")}${part.getAttribute("data-level")} ink bottom ${k.bottom.toFixed(2)} within 1px of bracket line top ${lineTop.toFixed(2)} (gap ${(lineTop - k.bottom).toFixed(2)})`);
        }
        if (label && bracket.getBoundingClientRect().bottom > label.getBoundingClientRect().top + 0.5) bad.push("bracket line crosses the numeral");
      }
      if (label) {
        const l = label.getBoundingClientRect();
        const c = col.getBoundingClientRect();
        if (l.bottom > c.bottom - 2 + 0.5) bad.push(`numeral bottom ${l.bottom.toFixed(1)} within 2px of column bottom ${c.bottom.toFixed(1)}`);
        if (parseFloat(getComputedStyle(label).fontSize) < 12) bad.push("numeral under 12px");
      }
      out.push({ index, duration, bad });
    });
    return out;
  });

/** Differing pixels between two same-size PNG crops (luma difference over 48). */
async function differ(page: Page, a: Buffer, b: Buffer) {
  return page.evaluate(
    async ([x, y]) => {
      const load = async (b64: string) => {
        const img = new Image();
        img.src = "data:image/png;base64," + b64;
        await img.decode();
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const g = c.getContext("2d")!;
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const [p, q] = [await load(x), await load(y)];
      if (p.length !== q.length) return -1;
      let n = 0;
      for (let i = 0; i < p.length; i += 4) {
        const l = (d: Uint8ClampedArray) => d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11;
        if (Math.abs(l(p) - l(q)) > 48) n++;
      }
      return n;
    },
    [a.toString("base64"), b.toString("base64")],
  );
}

test("INV-008 flags stay in the stem band and clear the bracket line, song page", async ({ page }, info) => {
  const urls = await seed(page, LIST, { bpm: 120 });
  await page.goto(urls.songUrl);
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
  const got: Got[] = await measure(page);
  console.log(info.project.name, "song", JSON.stringify(got.filter((g) => g.bad.length)));
  expect(got.length).toBeGreaterThan(20);
  expect(got.filter((g) => g.bad.length)).toEqual([]);
});

test("INV-008 flags in capture, cursor on the labelled column and not", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "capture's rhythm row is the touch column's budget");
  const urls = await seed(page, LIST, { bpm: 120 });
  await page.goto(urls.partUrl);
  await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
  const failures: string[] = [];
  const labelled = await page.getByTestId("tab-column").evaluateAll((els) =>
    els.map((el, i) => (el.querySelector(".tab-bracket-label") ? i : -1)).filter((i) => i >= 0),
  );
  expect(labelled.length).toBe(4);
  for (const state of ["end", ...labelled.map(String)]) {
    if (state !== "end") await page.getByTestId("tab-column").nth(Number(state)).click();
    await page.waitForTimeout(150);
    for (const g of await measure(page)) for (const b of g.bad) failures.push(`cursor ${state}: column ${g.index} (${g.duration}) ${b}`);
  }
  console.log(JSON.stringify([...new Set(failures)].slice(0, 30)));
  expect(failures).toEqual([]);
});

test("INV-008 a lone flagged note does not paint over the lowest fret number", async ({ page }, info) => {
  const one = (d: string): Col[] => [n("q"), n(d), n("q")];
  const urls = await seed(page, one("q"), { bpm: 120 });
  const crop = async (d: string) => {
    await writeColumns(page, urls.partId, one(d));
    await page.goto(urls.songUrl);
    await expect(page.getByTestId("tab-rhythm").nth(1)).toHaveAttribute("data-duration", d);
    const label = page.getByTestId("tab-column").nth(1).locator(".tab-cell > span").last();
    return label.screenshot();
  };
  const plain = await crop("q");
  const out: Record<string, number> = {};
  for (const d of ["8", "16", "32"]) out[d] = await differ(page, plain, await crop(d));
  console.log(info.project.name, "pixels of the lowest label changed by flags", JSON.stringify(out));
  expect(out).toEqual({ "8": 0, "16": 0, "32": 0 });
});
