import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { addChord, addRests, cancelSelection, selectColumns, startWith, tupletControl, TUNINGS } from "./probe-helpers";

/**
 * Spec 008 INV-001: at 375x667 capture is what it was. Compares every row's rect and the staff's markup with
 * what e2e/fixtures/capture-375-before.json recorded from the unedited build (never re-recorded).
 */
test.setTimeout(240_000);

const ROWS = ["capture-title-row", "tab-band", "status-row", "toolbar-stable", "toolbar-contextual", "toolbar-selection", "toolbar-reserved", "latch-strip", "fret-grid"];

async function snapshot(page: Page) {
  return page.evaluate((ids) => {
    const rect = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    };
    return {
      rows: Object.fromEntries(ids.map((id) => [id, rect(document.querySelector(`[data-testid="${id}"]`))])),
      staff: document.querySelector('[data-testid="tab-staff"]')?.outerHTML ?? null,
    };
  }, ROWS);
}

/** Event ids differ per run; their order of appearance is the shape. */
const shape = (html: string | null) => {
  const seen = new Map<string, string>();
  // outerHTML lists attributes in the order the node's render history set them; the markup is the same set.
  const sorted = (html ?? "").replace(/<([a-z0-9]+)((?:\s+[a-z-]+(?:="[^"]*")?)+)\s*(\/?)>/g, (_all, tag: string, attrs: string, close: string) => {
    const list = attrs.match(/[a-z-]+(?:="[^"]*")?/g) ?? [];
    return `<${tag} ${list.sort().join(" ")}${close}>`;
  });
  return sorted.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, (id) => {
    if (!seen.has(id)) seen.set(id, `<id${seen.size + 1}>`);
    return seen.get(id)!;
  });
};

test("INV-001 capture at 375x667 matches the recording", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  const before = JSON.parse(readFileSync("e2e/fixtures/capture-375-before.json", "utf8")).states as Record<
    string,
    { rows: Record<string, unknown>; staff: string | null }
  >;
  const compared: string[] = [];
  const wrappedKeys: string[] = [];
  for (const tuning of TUNINGS) {
    for (const deco of ["plain", "chord", "chord+bracket"] as const) {
      await startWith(page, tuning, `Band ${tuning.strings} ${deco}`);
      await addRests(page, 4);
      if (deco !== "plain") await addChord(page, 0, "Am");
      if (deco === "chord+bracket") {
        await selectColumns(page, 0, 1);
        await tupletControl(page).click();
      }
      await page.waitForTimeout(200);
      for (const theme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme: theme });
        await page.waitForTimeout(150);
        const key = `${tuning.strings}|${deco}|${theme}`;
        for (const state of ["rest", "selecting"] as const) {
          if (state === "selecting") await selectColumns(page, 0, 3);
          const now = await snapshot(page);
          const was = before[`${key}|${state}`];
          if (now.staff?.includes("tab-staff-wrapped")) {
            // FR-002 decides, not FR-003: where two whole lines fit, the band wraps (e.g. 4 strings, plain, at 375x667).
            const fits = await page.evaluate(() => {
              const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
              const style = getComputedStyle(band);
              const content = band.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
              const line = band.querySelector('[data-testid="tab-column"]')!.getBoundingClientRect().height;
              return content >= 2 * line + parseFloat(style.rowGap);
            });
            expect(fits, `${key}|${state} wrapped only when two lines fit`).toBe(true);
            wrappedKeys.push(`${key}|${state}`);
            continue;
          }
          compared.push(`${key}|${state}`);
          expect(now.rows, `${key}|${state} rows`).toEqual(was.rows);
          { const a = shape(now.staff), b = shape(was.staff); const at = [...a].findIndex((c, i) => c !== b[i]); expect(a.slice(Math.max(0, at - 80), at + 120), `${key}|${state} staff differs at ${at}`).toEqual(b.slice(Math.max(0, at - 80), at + 120)); }
        }
        await cancelSelection(page);
      }
    }
  }
  // The deciding case (FR-003) is one line today and must be compared, in both states.
  expect(compared).toContain("6|chord+bracket|dark|rest");
  expect(compared).toContain("6|chord+bracket|light|selecting");
  expect(wrappedKeys.every((k) => !k.startsWith("6|chord+bracket"))).toBe(true);
});
