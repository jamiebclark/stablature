/**
 * Feasibility, not a guarantee (round 3): can F18 and F19 be closed without touching the neck?
 * Applies candidate fixes as inline styles to the live DOM (this phase may not change code) on
 * the worst-case part, and measures. Passes today by construction, so it proves the recipe,
 * not the product; the failing proofs are INV-012-r3-chord-row and INV-015-r3-phone-width.
 *
 * F18: the staff is bottom-anchored (`justify-end`), so the wrapper's TOP padding buys nothing.
 *      Only space below the staff or above the band moves it down.
 * F19: a chip is 70 px at five latches. "hammer-on" and "slide-down" need about 63 px.
 */
import { expect, test, type Page } from "@playwright/test";
import { columns, fret, startCapturing } from "./helpers";

const worstCase = async (page: Page) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await startCapturing(page);
  await fret(page, "A", 5).click();
  await fret(page, "A", 7).click();
  await fret(page, "A", 9).click();
  await expect(columns(page)).toHaveCount(3);
  await page.getByTitle(/triplet/).click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  await page.getByLabel("Chord", { exact: true }).fill("Am");
  await page.getByRole("button", { name: "Set", exact: true }).click();
  await expect(page.getByLabel("Chord", { exact: true })).toHaveCount(0);
};

const measure = (page: Page) =>
  page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const scroller = staff.closest(".justify-end")!;
    const band = scroller.getBoundingClientRect();
    const walker = document.createTreeWalker(staff, NodeFilter.SHOW_TEXT);
    let chord: DOMRect | null = null;
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.textContent?.trim() === "Am") {
        const r = document.createRange();
        r.selectNodeContents(n);
        chord = r.getBoundingClientRect();
      }
    }
    return {
      chordClippedPx: Math.round((band.top - chord!.top) * 10) / 10,
      grid: document.querySelector('[data-testid="fret-grid"]')!.getBoundingClientRect().height,
      strip: document.querySelector('[data-testid="latch-strip"]')!.getBoundingClientRect().height,
      pageOver: document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight,
    };
  });

test("F18: part-chip row, status row and the staff's bottom padding recover the chord row", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a layout");
  await worstCase(page);
  const before = await measure(page);
  await page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const wrapper = staff.closest(".justify-end") as HTMLElement;
    wrapper.style.paddingBottom = "0.25rem"; // pb-3 -> pb-1: 8 px
    const chips = wrapper.previousElementSibling as HTMLElement;
    chips.style.paddingBlock = "0.25rem"; // py-2 -> py-1: 8 px
    const statusRow = wrapper.nextElementSibling as HTMLElement;
    statusRow.style.paddingBlock = "0.25rem"; // py-1.5 -> py-1: 4 px
  });
  const after = await measure(page);
  console.log(`RECIPE F18 before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);
  expect(after.chordClippedPx).toBeLessThanOrEqual(1);
  expect(after.grid).toBe(before.grid);
  expect(after.pageOver).toBeLessThanOrEqual(0);
});

test("F18: the same recipe brings a selection back to no worse than main", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a layout");
  await worstCase(page);
  await columns(page).nth(0).click();
  await page.getByRole("button", { name: "select" }).click();
  await expect(page.getByText(/^1 selected/)).toBeVisible();
  const hidden = () =>
    page.evaluate(() => {
      const staff = document.querySelector('[data-testid="tab-staff"]')!;
      const band = staff.closest(".justify-end")!.getBoundingClientRect();
      const rows = [...staff.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
      const tops = [...new Set(rows.map((r) => Math.round(r.top)))];
      return tops.filter((t) => rows.find((x) => Math.round(x.top) === t)!.top < band.top - 1).length;
    });
  const before = await hidden();
  await page.evaluate(() => {
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    const wrapper = staff.closest(".justify-end") as HTMLElement;
    wrapper.style.paddingBottom = "0.25rem";
    (wrapper.previousElementSibling as HTMLElement).style.paddingBlock = "0.25rem";
  });
  const after = await hidden();
  console.log(`RECIPE F18 selection: strings hidden ${before} -> ${after}`);
  expect(after, "main hides one").toBeLessThanOrEqual(1);
});

test("F19: one line, tighter side padding and the status row's type size hold five latches", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "one project is enough for a layout");
  await worstCase(page);
  const before = await measure(page);
  const chips = await page.getByTestId("latch-strip").evaluate((el) => {
    const chip = el.querySelector("button")!;
    for (const word of ["hammer-on", "pull-off", "slide-up", "slide-down"]) {
      const clone = chip.cloneNode(true) as HTMLButtonElement;
      clone.textContent = word;
      el.append(clone);
    }
    return [...el.querySelectorAll("button")].map((b) => {
      b.style.whiteSpace = "nowrap";
      b.style.paddingInline = "0.25rem"; // px-2 -> px-1
      b.style.fontSize = "0.7rem"; // the status row's size; text-xs is 0.75rem
      return { text: b.textContent, fits: b.scrollWidth <= b.clientWidth, height: b.offsetHeight };
    });
  });
  const after = await measure(page);
  console.log(`RECIPE F19 ${JSON.stringify(chips)} strip ${before.strip} -> ${after.strip}`);
  for (const chip of chips) expect(chip.fits, `${chip.text} fits`).toBe(true);
  expect(after.strip).toBeLessThanOrEqual(before.strip);
});
