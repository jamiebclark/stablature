/**
 * INV-014: the notation is drawn from the page's own code. After one warm load, with the network gone, song,
 * play and capture still show note symbols, and nothing asks for a font, an image or another origin.
 */
import { expect, test } from "@playwright/test";
import { type Col } from "./rhythm-probe-helpers";
import { cells, seeded } from "./notation-helpers";

const LIST: Col[] = [
  { d: "q", frets: { 0: 5 } },
  { d: "8", frets: { 0: 7 } },
  { d: "8", frets: { 0: 9 } },
  { d: "16", frets: { 0: 3 } },
  { d: "16", frets: { 0: 3 } },
  { d: "8", kind: "rest", frets: {} },
];

for (const surface of ["songUrl", "playUrl", "partUrl"] as const) {
  test(`INV-014 notation draws offline with no new requests, ${surface}`, async ({ page, context }) => {
    const urls = await seeded(page, LIST);
    await page.goto(urls[surface]);
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    const origin = new URL(page.url()).origin;
    const seen: { url: string; type: string }[] = [];
    page.on("request", (r) => seen.push({ url: r.url(), type: r.resourceType() }));
    await context.setOffline(true);
    await page.waitForTimeout(500);

    const got = await cells(page);
    await context.setOffline(false);
    expect(got.filter((c) => c.duration !== null).length).toBe(6);
    expect(got.some((c) => c.parts.length > 0)).toBe(true);

    const own = seen.filter((r) => !r.url.startsWith("data:") && !r.url.startsWith("blob:"));
    expect(own.filter((r) => r.type === "font" || r.type === "image")).toEqual([]);
    expect(own.filter((r) => new URL(r.url).origin !== origin)).toEqual([]);
  });
}
