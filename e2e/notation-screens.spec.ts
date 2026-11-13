/**
 * Screenshots of the notation for the human pass (quickstart §6): each surface at 375x667 and 1280x800, in dark,
 * light and greyscale, written to test-results/notation/. Asserts only that each file is written and non-empty.
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, statSync } from "node:fs";
import { details, inspector } from "./capture-surface-helpers";
import { openTools } from "./usability-helpers";
import { type Col } from "./rhythm-probe-helpers";
import { seeded } from "./notation-helpers";

const LIST: Col[] = [
  { d: "w", frets: { 0: 5 } },
  { d: "h", frets: { 0: 12 } },
  { d: "q", frets: { 0: 7 } },
  { kind: "barline" },
  { d: "8", frets: { 0: 5 } },
  { d: "8", frets: { 0: 12 } },
  { d: "16", frets: { 0: 7 } },
  { d: "16", frets: { 0: 9 } },
  { d: "32", frets: { 0: 3 } },
  { d: "32", frets: { 0: 3 } },
  { d: "8", kind: "rest", frets: {} },
  { d: "q", frets: { 0: 7 }, repeat: 6 },
];

const SIZES = [
  { width: 375, height: 667 },
  { width: 1280, height: 800 },
];
const LOOKS = ["dark", "light", "greyscale"] as const;
const DIR = "test-results/notation";

async function look(page: Page, l: (typeof LOOKS)[number]) {
  await page.emulateMedia({ colorScheme: l === "light" ? "light" : "dark" });
  if (l === "greyscale") await page.addStyleTag({ content: "html{filter:grayscale(1)}" });
}

async function shot(page: Page, name: string) {
  const path = `${DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  expect(statSync(path).size).toBeGreaterThan(0);
}

for (const size of SIZES) {
  for (const l of LOOKS) {
    test(`notation screens ${size.width} ${l}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile" && size.width === 375, "one project per size");
      test.skip(info.project.name === "mobile" && size.width !== 375, "one project per size");
      mkdirSync(DIR, { recursive: true });
      await page.setViewportSize(size);
      const urls = await seeded(page, LIST);
      const tag = `${size.width}-${l}`;

      await page.goto(urls.songUrl);
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      await look(page, l);
      await shot(page, `song-expanded-${tag}`);
      await openTools(page);
      await page.getByRole("button", { name: "compact" }).click();
      await shot(page, `song-compact-${tag}`);

      await page.goto(urls.playUrl);
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      await look(page, l);
      await shot(page, `play-${tag}`);
      await page.emulateMedia({ media: "print", colorScheme: l === "light" ? "light" : "dark" });
      await shot(page, `play-print-${tag}`);
      await page.emulateMedia({ media: "screen", colorScheme: l === "light" ? "light" : "dark" });

      await page.goto(urls.partUrl);
      await expect(page.getByTestId("tab-column").first()).toBeVisible();
      await look(page, l);
      await shot(page, `capture-${tag}`);
      await page.getByTestId("tab-column").first().click();
      await details(page).click();
      await expect(inspector(page)).toBeVisible();
      await shot(page, `inspector-${tag}`);
    });
  }
}

// INV-010, round 3: LIST above beams every 8th, 16th and 32nd, so no screenshot it writes shows a flag. This one draws
// every Sym member alone in its beat, and a beamed pair beside each flagged duration, so the flag is on the screen.
const F = { 0: 12, 5: 3 };
const n = (d: string): Col => ({ d, frets: F });
const r = (d: string): Col => ({ d, kind: "rest", frets: {} });
const bar: Col = { kind: "barline" };
const LONE: Col[] = [
  n("w"), bar, n("h"), n("h"), bar,
  n("q"), n("8"), n("q"), n("16"), bar,
  n("q"), n("32"), n("q"), { frets: F }, bar,
  n("8"), n("8"), n("16"), n("16"), n("16"), n("16"), bar,
  n("32"), n("32"), n("32"), n("32"), n("q"), bar,
  r("w"), bar, r("h"), r("h"), bar,
  r("q"), r("8"), r("16"), r("32"),
];

for (const size of SIZES) {
  for (const l of ["dark", "light"] as const) {
    test(`notation lone symbols ${size.width} ${l}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile" && size.width === 375, "one project per size");
      test.skip(info.project.name === "mobile" && size.width !== 375, "one project per size");
      mkdirSync(DIR, { recursive: true });
      await page.setViewportSize(size);
      const urls = await seeded(page, LONE);
      await page.goto(urls.songUrl);
      await expect(page.getByTestId("tab-rhythm").first()).toBeVisible();
      await look(page, l);
      const path = `${DIR}/lone-symbols-${size.width}-${l}.png`;
      await page.getByTestId("tab-staff").first().screenshot({ path });
      expect(statSync(path).size).toBeGreaterThan(1000);
    });
  }
}
