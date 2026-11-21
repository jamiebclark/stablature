import { expect, test } from "@playwright/test";
import { recordMemo, seedSongM, withFakeMicrophone } from "./memo-helpers";

/** INV-017 / SC-002: signed out and offline, no memo act makes a request to the API. */
withFakeMicrophone();

for (const net of ["signed out", "offline"] as const) {
  test(`INV-017 ${net}: every act without /api requests; the clip plays after reload`, async ({ page, context }) => {
    await seedSongM(page);
    if (net === "offline") await context.setOffline(true);
    const api: string[] = [];
    const failed: string[] = [];
    page.on("request", (r) => {
      const p = new URL(r.url()).pathname;
      if (p.startsWith("/api/memos") || p.startsWith("/api/sync")) api.push(p);
    });
    page.on("requestfailed", (r) => {
      const p = new URL(r.url()).pathname;
      // The session poll belongs to sign-in, not to memos; it fails offline on every page.
      if (p.startsWith("/api/") && !p.startsWith("/api/auth/")) failed.push(r.url());
    });

    await recordMemo(page, "A", 3000);
    await page.reload();
    const memo = page.getByTestId("memo").first();
    await expect(memo.getByTestId("memo-play")).toBeEnabled();
    await memo.getByTestId("memo-play").click();
    await expect(memo.getByTestId("memo-play")).toHaveAttribute("aria-pressed", "true");
    await memo.getByTestId("memo-seek").fill("1000");
    await memo.getByTestId("memo-play").click();

    await page.getByRole("button", { name: /^Actions for memo/ }).click();
    await page.getByRole("menuitem", { name: /^Rename memo/ }).click();
    await page.getByLabel("Memo name").fill("Riff idea");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByTestId("memo").first()).toContainText("Riff idea");

    await page.getByRole("button", { name: /^Actions for memo/ }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: /^Download memo/ }).click();
    await download;

    await page.getByRole("button", { name: /^Actions for memo/ }).click();
    await page.getByRole("menuitem", { name: /^Delete memo/ }).click();
    await page.getByRole("button", { name: "Delete memo", exact: true }).click();
    await expect(page.getByTestId("memo")).toHaveCount(0);

    expect(api, "requests to /api/memos or /api/sync").toEqual([]);
    expect(failed, "failed /api requests").toEqual([]);
  });
}
