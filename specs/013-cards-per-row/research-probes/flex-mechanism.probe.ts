/**
 * Spec 013 research R1/R2: does a wrapping flex row, with each card's basis at its own width and a list ::after filler,
 * give greedy in-order rows, full rows that fill, and a last row at own widths, in Chromium and in Firefox?
 * Static HTML only (no app). Run: `npx playwright test -c specs/013-cards-per-row/research-probes/mech.config.ts`.
 */
import { expect, test } from "@playwright/test";
import { writeFileSync } from "node:fs";

const CSS = `
  body { margin: 0; }
  ol { list-style: none; margin: 0; padding: 0; width: 1264px; display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
  ol::after { content: ""; flex: 9999 0 0; margin-left: -8px; height: 0; }
  li { flex: 1 0 var(--own); max-width: 100%; min-width: 0; height: 40px; box-sizing: border-box; }
`;
const CASES: Record<string, number[]> = {
  short12: Array(12).fill(144),
  fit6: [620, 620, 620, 620, 620, 620],
  long3: [2400, 160, 160],
  exactRow: [628, 628, 160],          // 628+8+628 = 1264: exactly full, then one on the last row
  exactLast: [628, 628],               // the last row exactly full: does ::after wrap and add a row gap?
  mixed: [300, 900, 200, 200, 700, 144],
  one: [400],
};

/** The greedy rows the spec defines (FR-007), from the own widths alone. */
function greedy(own: number[], row: number, gap: number): number[][] {
  const rows: number[][] = [];
  let used = -1;
  own.forEach((w, i) => {
    const c = Math.min(w, row);
    if (rows.length && used + gap + c <= row + 0.01) { rows[rows.length - 1].push(i); used += gap + c; }
    else { rows.push([i]); used = c; }
  });
  return rows;
}

test("flex row mechanism", async ({ page, browserName }) => {
  const out: Record<string, unknown> = {};
  for (const [name, own] of Object.entries(CASES)) {
    await page.setContent(`<style>${CSS}</style><ol>${own.map((w) => `<li style="--own:${w}px"></li>`).join("")}</ol>`);
    const g = await page.evaluate(() => {
      const ol = document.querySelector("ol")!;
      return {
        h: ol.getBoundingClientRect().height,
        items: [...ol.children].map((li) => { const r = li.getBoundingClientRect(); return [r.left, r.top, r.width]; }),
      };
    });
    const want = greedy(own, 1264, 8);
    const tops = [...new Set(g.items.map((i) => Math.round(i[1])))];
    const got = tops.map((t) => g.items.flatMap((i, k) => (Math.round(i[1]) === t ? [k] : [])));
    const last = got[got.length - 1];
    const lastAtOwn = last.every((k) => Math.abs(g.items[k][2] - Math.min(own[k], 1264)) <= 0.5);
    const fullRowsFill = got.slice(0, -1).every((r) => Math.abs(g.items[r[r.length - 1]][0] + g.items[r[r.length - 1]][2] - 1264) <= 0.5);
    const height = got.length * 40 + (got.length - 1) * 8;
    out[name] = { rows: got, want, lastAtOwn, fullRowsFill, listHeight: g.h, expectHeight: height };
    expect.soft(got, name).toEqual(want);
    expect.soft(lastAtOwn, `${name} last row at own widths`).toBe(true);
    expect.soft(fullRowsFill, `${name} full rows fill`).toBe(true);
    expect.soft(g.h, `${name} no extra row gap`).toBeCloseTo(height, 0);
  }
  writeFileSync(`specs/013-cards-per-row/research-probes/flex-mechanism.${browserName}.json`, JSON.stringify(out, null, 1) + "\n");
});
