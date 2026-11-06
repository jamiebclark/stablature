/**
 * INV-007 and INV-008 over their whole lists. audit/after.txt recorded `clipped: −×1+ (clip +11)` on capture at 375,
 * so this reads each control's own content against its box.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector } from "../../../e2e/capture-surface-helpers";
import { addRests, groupControl, selectColumns, startWith, tupletControl } from "../../../e2e/probe-helpers";
import { fullWorld, reach, SCREENS } from "./screens";

test.setTimeout(180_000);
test.skip(({ isMobile }) => !isMobile, "the row budget is the touch column");

const GUITAR = { family: "Guitar 6", preset: "E Standard", strings: 6 } as const;

const row = (page: Page, id: string) =>
  page.getByTestId(id).evaluate((el) => {
    const kids = [...el.querySelectorAll<HTMLElement>("button, a, input, select")].filter((k) => k.getBoundingClientRect().width > 0);
    const b = el.getBoundingClientRect();
    return {
      fits: el.scrollWidth <= el.clientWidth + 0.5,
      over: el.scrollWidth - el.clientWidth,
      past: kids.filter((k) => k.getBoundingClientRect().right > b.right + 0.5).map((k) => k.textContent),
      squeezed: kids
        .filter((k) => k.scrollWidth > k.clientWidth + 1)
        .map((k) => `${(k.getAttribute("aria-label") ?? k.textContent ?? "").trim()} content ${k.scrollWidth} in ${k.clientWidth}`),
      heights: [...new Set(kids.map((k) => Math.round(k.getBoundingClientRect().height)))],
    };
  });

test("INV-007 stable, contextual with every member, and the repeat stepper at 375", async ({ page }) => {
  await startWith(page, GUITAR);
  await addRests(page, 4);
  await columns(page).nth(1).click();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.waitForTimeout(150);
  for (const id of ["toolbar-stable", "toolbar-contextual"]) {
    const r = await row(page, id);
    expect(r, id).toMatchObject({ fits: true, past: [], squeezed: [] });
    expect(r.heights.length, `${id}: one height ${r.heights}`).toBe(1);
  }
});

for (const count of ["2", "16"]) {
  test(`INV-007 the selection row with seven controls, numeral ${count}`, async ({ page }) => {
    await startWith(page, GUITAR);
    await addRests(page, 20);
    await page.setViewportSize({ width: 375, height: 667 });
    await selectColumns(page, 0, Number(count) - 1);
    await expect(tupletControl(page).or(groupControl(page)).first()).toBeVisible();
    await page.waitForTimeout(150);
    const r = await row(page, "toolbar-selection");
    expect(r, "toolbar-selection").toMatchObject({ fits: true, past: [], squeezed: [] });
    expect(r.heights.length, `one height ${r.heights}`).toBe(1);
  });
}

/** The nearest rect to `name` among the controls around it. */
const gap = (page: Page, name: RegExp | string) =>
  page.evaluate(
    ({ source, flags }) => {
      const test = new RegExp(source, flags);
      const scope = document.querySelector("dialog[open]") ?? document;
      const all = [...scope.querySelectorAll<HTMLElement>("button, a, input, select")].filter(
        (el) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== "hidden",
      );
      const named = (el: HTMLElement) => (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      const hits = all.filter((el) => test.test(named(el)));
      if (hits.length === 0) return null;
      let least = Infinity;
      let who = "";
      for (const hit of hits) {
        const a = hit.getBoundingClientRect();
        for (const other of all) {
          if (other === hit || hits.includes(other) || other.contains(hit) || hit.contains(other)) continue;
          const b = other.getBoundingClientRect();
          // FR-014 on the row: a control in the next row is 2px off by the height budget, which has 1.8px left.
          if (!(b.top < a.bottom && b.bottom > a.top)) continue;
          const dx = Math.max(0, Math.max(a.left, b.left) - Math.min(a.right, b.right));
          const dy = Math.max(0, Math.max(a.top, b.top) - Math.min(a.bottom, b.bottom));
          const d = Math.hypot(dx, dy);
          if (d < least) {
            least = d;
            who = named(other).slice(0, 20);
          }
        }
      }
      return { least, who };
    },
    { source: typeof name === "string" ? `^${name}$` : name.source, flags: "i" },
  );

for (const width of [375, 390]) {
  test(`INV-008 every destructive control at ${width}`, async ({ page }) => {
    const world = await fullWorld(page);
    await page.setViewportSize({ width, height: width === 375 ? 667 : 844 });
    const seen: Record<string, number | null> = {};
    const who: Record<string, string> = {};
    const note = (name: string, g: { least: number; who: string } | null) => {
      seen[name] = g?.least ?? null;
      who[name] = g?.who ?? "";
    };
    const go = async (name: string) => reach(page, SCREENS.find((s) => s[0] === name)!, world);

    await page.goto(world.partUrl);
    await columns(page).first().click();
    await page.waitForTimeout(150);
    note("stable delete", await gap(page, /^Delete the/));

    await go("capture selecting");
    note("selection delete", await gap(page, "delete"));

    await page.goto(world.partUrl);
    await columns(page).first().click();
    await details(page).click();
    await expect(inspector(page)).toBeVisible();
    note("inspector delete", await gap(page, /^delete/));

    await page.goto(world.songUrl);
    await page.getByTestId("part-heading").first().waitFor();
    note("part delete", await gap(page, /^Delete part/));

    await page.goto(`${world.bandUrl}/tunings`);
    await page.getByRole("button", { name: /^Add / }).nth(1).click();
    await page.waitForTimeout(200);
    note("tuning delete", await gap(page, /^Delete (?!part)/));

    await go("arrangement entry selected");
    note("arrangement remove", await gap(page, "Remove"));

    console.log(`GAPS ${width} ${JSON.stringify(seen)} ${JSON.stringify(who)}`);
    for (const [name, least] of Object.entries(seen)) {
      expect(least, `${name} was found`).not.toBeNull();
      expect.soft(least!, `${name}, nearest ${who[name]}`).toBeGreaterThanOrEqual(8);
    }
  });
}
