import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { n, seedSong } from "./reading-helpers";
import { seedMemo } from "./memo-helpers";

/** INV-012: a card with no memos keeps its recorded box; capture and play never show memo UI. */
type Box = { label: string; width: number; height: number };
const before = JSON.parse(readFileSync("e2e/fixtures/memo-card-before.json", "utf8")) as Record<string, Box[]>;
const SIZES = [
  { width: 375, height: 667 },
  { width: 412, height: 915 },
  { width: 1280, height: 800 },
];

test("the fixture is read and non-empty", () => {
  expect(Object.keys(before).length).toBe(6);
  for (const boxes of Object.values(before)) expect(boxes.length).toBeGreaterThan(0);
});

for (const size of SIZES) {
  for (const theme of ["dark", "light"] as const) {
    test(`INV-012 cards at ${size.width}x${size.height} ${theme}`, async ({ page }, info) => {
      test.skip(info.project.name !== "mobile", "the baseline was recorded on the phone project (a fine pointer lays cards out denser)");
      await page.setViewportSize(size);
      await page.emulateMedia({ colorScheme: theme });
      const cols = [n(5)];
      await seedSong(page, [
        { key: "a", label: "A", name: "Verse", columns: cols },
        { key: "b", label: "B", columns: cols },
        { key: "c", label: "A2", variantOf: "a", columns: cols },
      ]);
      const off: string[] = [];
      for (const want of before[`${size.width}x${size.height}-${theme}`]) {
        const card = page.getByRole("button", { name: want.label, exact: true }).locator("xpath=ancestor::*[contains(@class,'reading-card')][1]");
        const box = (await card.boundingBox())!;
        if (Math.abs(box.width - want.width) > 1 || Math.abs(box.height - want.height) > 1) {
          off.push(`${want.label}: want ${want.width}x${want.height}, got ${box.width}x${box.height}`);
        }
      }
      expect(off).toEqual([]);
    });
  }
}

test("INV-012 no memo UI on capture or play with a memo present", async ({ page }) => {
  const s = await seedSong(page, [
    { key: "a", label: "A", columns: [n(3), n(5)] },
    { key: "b", label: "B", columns: [n(7)] },
  ]);
  await seedMemo(page, { partLabel: "A", state: "local-signed-out" });
  const any = /^(part-memos|memo|record-panel)$/;
  for (const url of [
    `/songs/${s.songId}/capture/${s.parts.a}`,
    `/songs/${s.songId}/capture/${s.parts.b}`,
    `${s.playUrl}/${s.parts.a}`,
    `${s.playUrl}/${s.parts.b}`,
  ]) {
    await page.goto(url);
    await page.waitForLoadState("load");
    await page.waitForTimeout(800);
    await expect(page.getByTestId(any), url).toHaveCount(0);
  }
});
