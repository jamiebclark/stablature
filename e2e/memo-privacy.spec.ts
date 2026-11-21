import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** INV-025: every page that lists what is stored includes voice recordings, and says what FR-090 requires. */
test("privacy states the seven FR-090 facts and a new date", async ({ page }) => {
  await page.goto("/privacy");
  const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
  const facts: [string, RegExp][] = [
    ["listed under what is stored", /voice recordings/i],
    ["on the device and in the operator's database", /on your device and in the operator.s database/i],
    ["every member can play and download", /every member of the band can play and download/i],
    ["deleting erases the audio", /deleting a memo erases its audio/i],
    ["the small record stays", /small record of the memo stays/i],
    ["signed-out recordings never leave the device", /signed out never leaves your device/i],
    ["microphone only while recording", /only while you are recording/i],
  ];
  for (const [name, re] of facts) expect(text, name).toMatch(re);
  expect(text).not.toContain("2 November 2026");
});

test("sign-up and terms mention voice recordings", async ({ page }) => {
  await page.goto("/sign-up");
  await expect(page.getByText(/voice recordings/i).first()).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByText(/voice recordings/i).first()).toBeVisible();
});

test("README self-hosting names localhost and a reverse proxy", () => {
  const readme = readFileSync("README.md", "utf8");
  expect(readme).toMatch(/localhost/);
  expect(readme).toMatch(/reverse proxy/i);
});
