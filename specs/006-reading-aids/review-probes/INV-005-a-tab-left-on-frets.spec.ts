/**
 * INV-005 beside T064's repair: the first subscribe re-reads storage, so the render before it holds the old view.
 *
 * A tab has frets in memory and nothing listening. Another tab chooses notes. The first tab then opens a staff by an
 * in-app link. The remembered view is notes, so no fret number may ever reach a cell, even for one commit.
 */
import { expect, test, type Page } from "@playwright/test";
import { bar, choose, n, seedSong } from "./helpers";

const watch = (page: Page) =>
  page.addInitScript(() => {
    const w = window as unknown as { __texts: string[] };
    w.__texts = [];
    const read = () => {
      for (const column of document.querySelectorAll('[data-testid="tab-column"]')) {
        w.__texts.push((column as HTMLElement).textContent ?? "");
      }
    };
    new MutationObserver(read).observe(document, { subtree: true, childList: true, characterData: true });
  });

for (const surface of ["song page", "play view"] as const) {
  test(`no fret number from the old view: ${surface}`, async ({ page, context }) => {
    await watch(page);
    const { songUrl, playUrl } = await seedSong(
      page,
      [{ key: "a", label: "A", columns: [n(9), n(10), bar(), n(9)] }],
      [{ part: "a" }],
    );
    await choose(page, "notes");
    await choose(page, "frets");
    await page.getByRole("link", { name: "Band" }).click();
    await expect(page.getByTestId("staff-view")).toHaveCount(0);

    const second = await context.newPage();
    await second.goto(songUrl);
    await choose(second, "notes");
    await second.close();

    await page.evaluate(() => void ((window as unknown as { __texts: string[] }).__texts.length = 0));
    await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
    await expect(page).toHaveURL(songUrl);
    if (surface === "play view") {
      await page.goto(`${songUrl}`);
      await page.getByRole("link", { name: "Band" }).click();
      await expect(page.getByTestId("staff-view")).toHaveCount(0);
      await page.evaluate(() => void ((window as unknown as { __texts: string[] }).__texts.length = 0));
      await page.locator(`a[href$="${new URL(songUrl).pathname}"]`).first().click();
      await page.locator('a[href$="/play"]').first().click();
      await expect(page).toHaveURL(playUrl);
    }
    await expect(page.getByTestId("staff-view-notes")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("tab-column").first()).toBeVisible();
    const texts = await page.evaluate(() => (window as unknown as { __texts: string[] }).__texts);
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((t) => /\d/.test(t))).toEqual([]);
  });
}
