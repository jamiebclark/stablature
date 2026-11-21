import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { landed } from "./reading-helpers";
import { denyCanPlay, fillDevice, seedMemo, seedSongM, setDeviceFull, startRecording, withFakeMicrophone } from "./memo-helpers";

withFakeMicrophone();

/** INV-021: the saved file is named plainly and holds exactly the stored bytes. */
const SHAPE = /^[a-z0-9-]{1,40}(-[a-z0-9-]{1,40}){2}\.(m4a|webm|ogg)$/;

const stored = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      new Promise<number[]>((resolve, reject) => {
        const open = indexedDB.open("stablature");
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction("memoAudio").objectStore("memoAudio").getAll();
          all.onsuccess = () => resolve(Array.from(new Uint8Array(all.result[0].bytes)));
        };
      }),
  );

test("menu Download saves a plainly named file holding the stored bytes", async ({ page }) => {
  await seedSongM(page);
  await seedMemo(page, { partLabel: "B", state: "local-signed-out", format: "audio/webm" });
  await landed(page);
  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    (async () => {
      await page.getByRole("button", { name: /^Actions for memo/ }).click();
      await page.getByRole("menuitem", { name: /^Download memo/ }).click();
    })(),
  ]);
  expect(download.suggestedFilename()).toMatch(SHAPE);
  const path = await download.path();
  expect(Array.from(readFileSync(path))).toEqual(await stored(page));
});

test("the unplayable state's Download saves the same", async ({ page }) => {
  await denyCanPlay(page, "audio/webm");
  await seedSongM(page);
  await seedMemo(page, { partLabel: "B", state: "unplayable", format: "audio/webm" });
  await landed(page);
  await page.reload();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("memo-download").click()]);
  expect(download.suggestedFilename()).toMatch(SHAPE);
  expect(Array.from(readFileSync(await download.path()))).toEqual(await stored(page));
});

test("Download the clip, from a held recording, is named plainly too", async ({ page }) => {
  await fillDevice(page);
  await seedSongM(page);
  await startRecording(page, "A");
  await setDeviceFull(page, true);
  await page.waitForTimeout(4000);
  await page.getByTestId("record-stop").click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("record-download-held").click()]);
  expect(download.suggestedFilename()).toMatch(SHAPE);
  expect(readFileSync(await download.path()).byteLength).toBeGreaterThan(0);
});
