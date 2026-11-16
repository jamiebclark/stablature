/** INV-021: the song page's controls still work in the card grid, at a size a finger or a mouse can use. */
import { expect, test } from "@playwright/test";
import { seedFitSong } from "./wide-helpers";

test.setTimeout(120_000);

for (const width of [768, 1280]) {
  test(`song page controls at ${width}`, async ({ page }) => {
    const { songUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(songUrl);
    const touch = await page.evaluate(() => !matchMedia("(pointer: fine)").matches);
    const floor = touch ? 44 : 32;
    const cards = page.locator("ul.reading-cards > li");
    await expect(cards).toHaveCount(4);

    const tools = page.getByTestId("panel-song-tools");
    if ((await tools.getAttribute("aria-expanded")) !== "true") await tools.click();
    await expect(tools).toHaveAttribute("aria-expanded", "true");
    for (const id of ["staff-view-frets", "staff-view-notes", "staff-view-intervals"]) {
      const box = await page.getByTestId(id).boundingBox();
      expect(box!.height, id).toBeGreaterThanOrEqual(floor - 1);
    }
    for (const option of ["expanded", "compact"]) {
      const b = page.getByRole("button", { name: option, exact: true });
      expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(floor - 1);
    }
    await page.getByRole("button", { name: "compact", exact: true }).click();
    await page.getByRole("button", { name: "expanded", exact: true }).click();
    await page.getByTestId("staff-view-notes").click();
    await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("staff-view-frets").click();

    const first = cards.first();
    const menuButton = first.getByRole("button", { name: /Actions for part A/ });
    expect((await menuButton.boundingBox())!.height).toBeGreaterThanOrEqual(floor - 1);
    await menuButton.click();
    await expect(page.getByRole("menu").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(menuButton).toBeFocused();

    // Rename saves.
    await first.getByRole("button", { name: /Name part A|Add a name/ }).first().click();
    await first.getByLabel("Part name").fill("main riff");
    await first.getByRole("button", { name: "Save" }).click();
    await expect(first.getByText("main riff")).toBeVisible();

    // + variant acts: a fifth card appears.
    await menuButton.click();
    await page.getByRole("menuitem", { name: "+ variant" }).click();
    await expect(cards).toHaveCount(5);

    // The label link opens capture.
    await first.getByRole("link", { name: /Edit part A/ }).click();
    await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  });
}

// --- INV-021 the play view's cluster at both widths and both pointers (review round 1) ---
for (const width of [768, 1280]) {
  test(`INV-021 the play view's cluster works at ${width}`, async ({ page }) => {
    const { playUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto(playUrl);
    const touch = await page.evaluate(() => !matchMedia("(pointer: fine)").matches);
    const floor = touch ? 44 : 32;
    const more = page.getByTestId("panel-play-cluster");
    expect((await more.boundingBox())!.height).toBeGreaterThanOrEqual(floor - 1);
    expect((await page.getByTestId("click-start").boundingBox())!.height).toBeGreaterThanOrEqual(floor - 1);
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    for (const id of ["staff-view-frets", "staff-view-notes", "staff-view-intervals"]) {
      expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(floor - 1);
    }
    await page.getByTestId("staff-view-notes").click();
    await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
    await page.getByTestId("staff-view-frets").click();
    await more.click();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await more.click();
    const capture = page.getByTestId("panel-play-cluster-body").getByRole("link", { name: "Capture" });
    expect((await capture.boundingBox())!.height).toBeGreaterThanOrEqual(floor - 1);
    await capture.click();
    await expect(page).toHaveURL(/\/capture/);
  });
}
