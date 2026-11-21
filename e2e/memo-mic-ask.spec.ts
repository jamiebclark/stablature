import { expect, test } from "@playwright/test";
import { recordMemo, seedSongM, withFakeMicrophone } from "./memo-helpers";

/** INV-013: the microphone is requested only when someone chooses Record memo. */
withFakeMicrophone();

test("INV-013 no getUserMedia on any page or menu; exactly one after Record memo", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __gum: number };
    w.__gum = 0;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) return;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => {
      w.__gum++;
      return real(c);
    };
  });
  const gum = () => page.evaluate(() => (window as unknown as { __gum: number }).__gum);
  const seeded = await seedSongM(page);
  const [a, b] = Object.values(seeded.parts);
  const urls = [
    "/",
    `/songs/${seeded.songId}`,
    `/songs/${seeded.songId}/capture/${a}`,
    `/songs/${seeded.songId}/capture/${b}`,
    `${seeded.playUrl}/${a}`,
    `${seeded.playUrl}/${b}`,
  ];
  for (const url of urls) {
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    expect(await gum(), url).toBe(0);
  }
  await page.goto(seeded.songUrl);
  await page.getByRole("button", { name: /^Actions for part A(,|$)/ }).click();
  await page.keyboard.press("Escape");
  expect(await gum()).toBe(0);

  await recordMemo(page, "A", 3000);
  expect(await gum()).toBe(1);
});
