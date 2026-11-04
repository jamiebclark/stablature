/** Shared drivers for the spec 003 browser probes. Builds on the suite's own helpers. */
import { expect, type Page } from "@playwright/test";
import { addChord, columns, space } from "../../../e2e/capture-surface-helpers";
import { selectionBar } from "../../../e2e/grouping-helpers";

export * from "../../../e2e/capture-surface-helpers";
export * from "../../../e2e/grouping-helpers";

export const REFUSAL = "a triplet needs three columns in one bar";
export const triplet = (page: Page) => page.getByRole("button", { name: "Triplet", exact: true });
export const refusal = (page: Page) => page.getByText(REFUSAL);

/** The string counts INV-013 names. One tuning per count, each with its own band and song. */
export const TUNINGS = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "Drop A", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
] as const;

/** A part in a real tuning, at phone size. Rests need no string name, so any tuning can use them. */
export async function startWith(
  page: Page,
  tuning: { family: string; preset: string; strings: number },
) {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/");
  await page.getByLabel("Band name").fill("Hollow Crown");
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = page.url();
  await page.goto(`${bandUrl}/tunings`);
  await page.getByRole("button", { name: tuning.family, exact: true }).click();
  await page.getByRole("button", { name: `Add ${tuning.preset}` }).first().click();
  await page.getByRole("button", { name: "Make default" }).first().click();
  // The default sorts first. Waiting on the word "default" proves nothing: it is on screen
  // before the click lands, and leaving early loses the write.
  const first = page.getByRole("listitem").first();
  await expect(first).toContainText(`${tuning.strings}-string`);
  await expect(first).toContainText(tuning.preset);
  await page.goto(bandUrl);
  await page.getByLabel("Song title").fill("Dirge");
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();
  await page.getByRole("link", { name: "Capture" }).click();
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  return { songUrl, partUrl: page.url() };
}

export async function addRests(page: Page, count: number) {
  for (let i = 0; i < count; i++) await space(page);
  await expect(columns(page)).toHaveCount(count);
}

export const setChordOn = addChord;

export const cancelSelection = (page: Page) =>
  selectionBar(page).getByRole("button", { name: "cancel" }).click();

/**
 * The band that actually clips: the nearest scrolling ancestor of the staff, not `tab-staff`,
 * which is the content and so always contains its own rows.
 */
export async function measureBand(page: Page) {
  return page.evaluate(() => {
    const root = document.scrollingElement!;
    const staff = document.querySelector('[data-testid="tab-staff"]')!;
    let scroller: Element | null = staff.parentElement;
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) {
      scroller = scroller.parentElement;
    }
    const band = scroller!.getBoundingClientRect();
    const column = staff.querySelector('[data-testid="tab-column"]')!;
    const rows = [...column.querySelectorAll(".tab-cell")].map((c) => c.getBoundingClientRect());
    return {
      pageOver: root.scrollHeight - root.clientHeight,
      band: Math.round(band.height * 10) / 10,
      strings: rows.length,
      clippedPx: Math.max(0, ...rows.map((r) => Math.max(band.top - r.top, r.bottom - band.bottom))),
      stringsClipped: rows.filter((r) => r.top < band.top - 1 || r.bottom > band.bottom + 1).length,
    };
  });
}

/** Contrast of an element's top border against its effective background, and its opacity. */
export const measureContrast = `(el) => {
  const px = (css) => {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    const g = c.getContext("2d");
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    return Array.from(g.getImageData(0, 0, 1, 1).data);
  };
  const lum = ([r, g, b]) => {
    const f = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  let bg = [255, 255, 255, 255];
  for (let n = el; n; n = n.parentElement) {
    const c = px(getComputedStyle(n).backgroundColor);
    if (c[3] > 250) { bg = c; break; }
  }
  let opacity = 1;
  for (let n = el; n; n = n.parentElement) opacity *= Number(getComputedStyle(n).opacity);
  const [a, b] = [lum(px(getComputedStyle(el).borderTopColor)), lum(bg)].sort((x, y) => y - x);
  return { ratio: (a + 0.05) / (b + 0.05), opacity, fg: getComputedStyle(el).borderTopColor, bg: bg.join(",") };
}`;
