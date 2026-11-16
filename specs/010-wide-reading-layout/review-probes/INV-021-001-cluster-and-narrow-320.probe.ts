/**
 * INV-021 and INV-001 (review round 1), the members the feature's specs do not reach.
 *
 * INV-021: wide-controls.spec.ts covers the song page; the play view's cluster at {768, 1280} × **Ptr** is not
 * reached. The cluster opens and closes, its view control and Capture link work, and each control meets the floor
 * (44 on touch, 32 with a mouse).
 *
 * INV-001: narrow-before.json holds 375 and 412 on touch and 767 with a mouse. At 320 (both pointers), 375 with a
 * mouse and 767 on touch there is no recording of main, so this checks what can be checked without one: one card per
 * row at the list's full width, no wrapped staff on the song page, no sideways scroll, no ruler-driven track.
 */
import { expect, test } from "@playwright/test";
import { seedFitSong } from "../../../e2e/wide-helpers";

test.setTimeout(240_000);

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

for (const width of [320, 375, 767]) {
  test(`INV-001 one column and no wrap on the song page at ${width}`, async ({ page }) => {
    const { songUrl, playUrl } = await seedFitSong(page);
    await page.setViewportSize({ width, height: 800 });
    const bad: string[] = [];
    for (const [which, url] of [["song", songUrl], ["play", playUrl]] as const) {
      await page.goto(url);
      await expect(page.getByTestId("tab-staff").first()).toBeVisible();
      await page.waitForTimeout(300);
      const m = await page.evaluate(() => {
        const list = document.querySelector<HTMLElement>(".reading-cards")!;
        const lr = list.getBoundingClientRect();
        return {
          spans: [...list.children].map((li) => {
            const b = li.getBoundingClientRect();
            return Math.max(Math.abs(b.left - lr.left), Math.abs(b.right - lr.right));
          }),
          wrapped: document.querySelectorAll(".tab-staff-wrapped").length,
          line: list.style.getPropertyValue("--staff-line"),
          sideways: document.documentElement.scrollWidth - innerWidth,
          mainPadX: getComputedStyle(document.querySelector("main")!).paddingLeft,
        };
      });
      const at = `${which} ${width}`;
      if (m.spans.some((d) => d > 0.5)) bad.push(`${at}: a card does not span the list (${m.spans.join(",")})`);
      if (which === "song" && m.wrapped > 0) bad.push(`${at}: song page staff wraps`);
      if (m.line !== "") bad.push(`${at}: --staff-line written below 768 (${m.line})`);
      if (m.sideways > 0) bad.push(`${at}: page scrolls sideways by ${m.sideways}`);
      if (m.mainPadX !== "16px") bad.push(`${at}: main side padding ${m.mainPadX}, main drew 16px`);
    }
    expect(bad).toEqual([]);
  });
}
