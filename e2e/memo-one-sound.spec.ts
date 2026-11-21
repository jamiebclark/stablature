import { expect, test, type Page } from "@playwright/test";
import { n, seedSong } from "./reading-helpers";
import { installPlayRecorder, recordedAudio } from "./play-helpers";
import { seedMemo, withFakeMicrophone } from "./memo-helpers";

/** INV-010 (e2e half): one sound at a time among memos and the recorder; nothing from play survives into a memo. */
withFakeMicrophone();

async function twoMemos(page: Page) {
  const s = await seedSong(page, [{ key: "a", label: "A", columns: [n(3), n(5), n(7)] }]);
  await seedMemo(page, { partLabel: "A", state: "local-signed-out", recordedAt: Date.now() - 2000 });
  await seedMemo(page, { partLabel: "A", state: "local-signed-out", recordedAt: Date.now() - 1000 });
  await page.reload();
  await expect(page.getByTestId("memo")).toHaveCount(2);
  return s;
}

const paused = (memo: ReturnType<Page["locator"]>) => memo.locator("audio").evaluate((el) => (el as HTMLAudioElement).paused);

test("INV-010 playing B pauses A; recording pauses B", async ({ page }) => {
  await twoMemos(page);
  const [a, b] = [page.getByTestId("memo").nth(0), page.getByTestId("memo").nth(1)];
  await a.getByTestId("memo-play").click();
  await expect(a.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "true");
  await b.getByTestId("memo-play").click();
  await expect(a.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "false");
  expect(await paused(a)).toBe(true);
  await expect(b.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /^Actions for part A(,|$)/ }).click();
  await page.getByRole("menuitem", { name: "Record a memo on part A" }).click();
  await expect(page.getByTestId("record-panel")).toBeVisible();
  await expect(b.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "false");
  expect(await paused(b)).toBe(true);
  await page.getByTestId("record-discard").click();
  await page.getByTestId("record-discard-confirm").click();
});

test("FR-042 nothing from part playback is sounding when a memo starts", async ({ page }) => {
  await installPlayRecorder(page);
  const s = await twoMemos(page);
  await page.goto(`${s.playUrl}/${s.parts.a}`);
  await page.goBack();
  await expect(page.getByTestId("memo")).toHaveCount(2);
  await page.getByTestId("memo").nth(0).getByTestId("memo-play").click();
  const rec = await recordedAudio(page);
  expect(JSON.stringify(rec)).not.toContain('"state":"running"');
});
