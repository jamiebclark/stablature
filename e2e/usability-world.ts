import { expect, type Page } from "@playwright/test";
import { openArrange } from "./usability-helpers";
import { addRests, startWith, TUNINGS } from "./probe-helpers";

/** A band with a song that has one part with rests, a section, a cue, and the arrangement seeded. */
export async function songWorld(page: Page, restCount = 4) {
  const { songUrl, partUrl } = await startWith(page, TUNINGS[1]);
  await addRests(page, restCount);
  await page.goto(songUrl);
  const seed = page.getByRole("button", { name: "Each part once" });
  await expect(seed.or(page.getByTestId("roadmap-chip").first())).toBeVisible();
  if (await seed.count()) await seed.click();
  await expect(page.getByTestId("panel-song-arrange")).toBeVisible();
  await openArrange(page);
  await page.getByLabel("Section name").fill("Verse");
  await page.getByRole("button", { name: "+ section" }).click();
  await page.getByLabel("Cue").fill("build slowly");
  await page.getByRole("button", { name: "+ cue" }).click();
  await expect(page.getByText("build slowly").first()).toBeVisible();
  return { songUrl, partUrl, playUrl: `${songUrl}/play` };
}
