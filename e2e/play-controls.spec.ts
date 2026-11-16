/** Spec 011 INV-014: the Notes controls are real controls — floors, state words, and the rules between them. */
import { expect, test, type Page } from "@playwright/test";
import { openCluster } from "./usability-helpers";
import { installPlayRecorder, seedPlaybackSong } from "./play-helpers";

const SIZES = [
  { name: "375", width: 375, height: 667, touch: true },
  { name: "390", width: 390, height: 844, touch: true },
  { name: "1280", width: 1280, height: 800, touch: false },
];

async function ready(page: Page) {
  await installPlayRecorder(page);
  const seeded = await seedPlaybackSong(page);
  await page.goto(seeded.playUrl);
  await openCluster(page);
  await expect(page.getByTestId("play-notes")).toBeVisible();
}
const box = async (page: Page, id: string) => (await page.getByTestId(id).boundingBox())!;

for (const size of SIZES) {
  test(`controls at ${size.name}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport: size, hasTouch: size.touch, isMobile: size.touch });
    const page = await context.newPage();
    await ready(page);
    const floor = size.touch ? 44 : 32;
    const notes = page.getByTestId("play-notes");
    await expect(notes).toHaveAttribute("aria-pressed", "false");
    await expect(notes).toContainText("off");
    await expect(page.getByTestId("play-click")).toHaveCount(0);
    await expect(page.getByTestId("play-loop")).toHaveCount(0);
    await notes.click();
    await expect(notes).toHaveAttribute("aria-pressed", "true");
    await expect(notes).toContainText("on");
    for (const id of ["play-notes", "play-click", "play-loop", "play-slower", "play-faster"]) {
      await expect(page.getByTestId(id)).toBeVisible();
      const b = await box(page, id);
      expect(b.width, `${id} width`).toBeGreaterThanOrEqual(floor - 0.5);
      expect(b.height, `${id} height`).toBeGreaterThanOrEqual(floor - 0.5);
      expect(b.x + b.width).toBeLessThanOrEqual(size.width);
    }
    for (const id of ["play-click", "play-loop"]) {
      await expect(page.getByTestId(id)).toHaveAttribute("aria-pressed", /true|false/);
      await expect(page.getByTestId(id)).toContainText(/on|off/);
    }
    // Running: Notes cannot change under the run.
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await expect(notes).toBeDisabled();
    await page.getByTestId("click-stop").click();
    await expect(notes).toBeEnabled();
    await context.close();
  });
}

test("Slower and Faster stop at 50 and 100", async ({ page }) => {
  await ready(page);
  await page.getByTestId("play-notes").click();
  const slower = page.getByTestId("play-slower");
  const faster = page.getByTestId("play-faster");
  await expect(faster).toBeDisabled();
  await expect(page.getByTestId("play-speed")).toHaveText("100%");
  for (let i = 0; i < 10; i++) await slower.click();
  await expect(slower).toBeDisabled();
  await expect(page.getByTestId("play-speed")).toHaveText("50% · 60 bpm");
  await faster.click();
  await expect(slower).toBeEnabled();
  await expect(page.getByTestId("play-speed")).toHaveText("55% · 66 bpm");
});
