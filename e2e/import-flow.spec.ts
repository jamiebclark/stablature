/**
 * The flow through the real screen.
 * INV-021 preview = written, INV-022 nothing written before the tap, INV-024 one part per intent,
 * INV-027 always there, offline and with no permission.
 */
import { expect, test, type Page } from "@playwright/test";
import { openTools } from "./usability-helpers";
import {
  TUNINGS,
  dumpStore,
  emptySong,
  pasteTab,
  readStaffText,
  startWith,
} from "./import-helpers";

const staff = (names: string, bodies: string[]) => bodies.map((b, i) => `${names[i]} |${b}|`).join("\n");
const four = (top: string) => {
  const rails = top.replace(/[^|]/g, "-");
  return staff("GDAE", [top, rails, rails, rails]);
};
const FIVE = staff("GDAEB", ["-5-7-", "-----", "-----", "-----", "-3---"]);
const BAD = four("-5s7-");
const RICH = `    Am\n    ,-3-,\n${four("-5-7-9-|-7-7-7-7-")}`;

async function emptyTo(page: Page) {
  const seeded = await startWith(page, TUNINGS[0]);
  await emptySong(page, seeded.songUrl);
}

const importButton = (page: Page) => page.getByRole("button", { name: /^(Import as part|Switch to)/ });
const parts = (page: Page) => page.locator('[id^="part-"]');

test.describe("INV-022 nothing is written until the tap", () => {
  test("type, refuse, fix, cancel", async ({ page }) => {
    await emptyTo(page);
    const before = await dumpStore(page);
    await pasteTab(page, BAD);
    await expect(page.getByTestId("paste-refusals")).toBeVisible();
    await pasteTab(page, four("-5-7-"));
    await expect(importButton(page)).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(await dumpStore(page)).toEqual(before);
  });

  test("offer, then cancel", async ({ page }) => {
    await emptyTo(page);
    const before = await dumpStore(page);
    await pasteTab(page, FIVE);
    await expect(page.getByRole("button", { name: /^Switch to / })).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    expect(await dumpStore(page)).toEqual(before);
  });

  test("the density toggled while open, then leaving the page", async ({ page }) => {
    await emptyTo(page);
    const before = await dumpStore(page);
    await pasteTab(page, RICH);
    await expect(importButton(page)).toBeVisible();
    await openTools(page);
    await page.getByRole("button", { name: /compact/i }).first().click();
    await page.getByRole("button", { name: /expanded/i }).first().click();
    await page.goto("/");
    await expect(page.getByLabel("Band name")).toBeVisible();
    expect(await dumpStore(page)).toEqual(before);
  });
});

test.describe("INV-021 the new part is what the preview drew", () => {
  test("a chord, a group and a repeat together, at both densities", async ({ page }) => {
    await emptyTo(page);
    await pasteTab(page, RICH);
    await expect(importButton(page)).toBeVisible();
    const expanded = await readStaffText(page, "preview");
    await openTools(page);
    await page.getByRole("button", { name: /compact/i }).first().click();
    await expect.poll(() => readStaffText(page, "preview")).not.toBe(expanded);
    const compact = await readStaffText(page, "preview");
    await importButton(page).click();
    await expect(parts(page)).toHaveCount(1);
    expect(await readStaffText(page)).toBe(compact);
    await page.getByRole("button", { name: /expanded/i }).first().click();
    await expect.poll(() => readStaffText(page)).toBe(expanded);
  });

  test("a tap before the deferred reading lands writes what is on the screen", async ({ page }) => {
    await emptyTo(page);
    const drawn = four("-5-7-");
    await pasteTab(page, drawn);
    await expect(importButton(page)).toBeVisible();
    const preview = await readStaffText(page, "preview");
    // One task: the text changes and the button is tapped before the deferred pass has rendered.
    const seen = await page.evaluate((next) => {
      const box = document.querySelector("textarea")!;
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
      set.call(box, next);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      const button = [...document.querySelectorAll("button")].find((b) =>
        /^Import as part/.test(b.textContent ?? ""),
      )!;
      button.click();
      return document.querySelector('[data-testid="paste-tab"] [data-testid="tab-staff"]')?.textContent ?? "";
    }, four("-9-3-"));
    await expect(parts(page)).toHaveCount(1);
    expect(seen).toContain("5");
    expect(await readStaffText(page), "the part must be the tab that was on the screen").toBe(preview);
  });
});

test.describe("INV-024 one part per intent", () => {
  test("a double click", async ({ page }) => {
    await emptyTo(page);
    await pasteTab(page, four("-5-7-"));
    await importButton(page).dblclick();
    await expect(parts(page)).toHaveCount(1);
    await page.waitForTimeout(300);
    expect((await dumpStore(page)).parts.length).toBe(1 + 1); // Dirge's part, and this one.
  });

  test("Enter with the button in focus, twice", async ({ page }) => {
    await emptyTo(page);
    await pasteTab(page, four("-5-7-"));
    await importButton(page).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(parts(page)).toHaveCount(1);
    await page.waitForTimeout(300);
    expect((await dumpStore(page)).parts.length).toBe(1 + 1);
  });
});

test.describe("INV-027 always reachable", () => {
  test("with parts and with none, and with no clipboard permission asked", async ({ page, context }) => {
    await context.clearPermissions();
    await emptyTo(page);
    await expect(page.getByRole("button", { name: "Paste tab" })).toHaveCount(2);
    await pasteTab(page, four("-5-7-"));
    await importButton(page).click();
    await expect(parts(page)).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Paste tab" })).toHaveCount(1);
  });

  test("offline, fits and offer, and the rows wait in the outbox", async ({ page, context }) => {
    await emptyTo(page);
    await context.setOffline(true);
    const before = (await dumpStore(page)).outbox.length;
    await pasteTab(page, four("-5-7-"));
    await importButton(page).click();
    await expect(parts(page)).toHaveCount(1);
    await pasteTab(page, FIVE);
    await page.getByRole("button", { name: /^Switch to / }).click();
    await expect(parts(page)).toHaveCount(2);
    expect((await dumpStore(page)).outbox.length).toBeGreaterThan(before);
    await context.setOffline(false);
  });

  /**
   * Reached the way a person reaches it: Delete on the band's tunings page. spec.md, Accepted: "A
   * song with no tuning at all. Nothing fits, so an exact tuning is offered if labels name one."
   */
  test("a song with no tuning opens, reads, previews the offer, and imports", async ({ page }) => {
    const seeded = await startWith(page, TUNINGS[0]);
    // The band's only song, so no other song follows the band's tuning and withholds the offer
    // (F32): the song itself ends on a deleted tuning, which resolves to none.
    const songUrl = seeded.songUrl;
    await page.goto(songUrl);
    await page.getByRole("link", { name: "Band" }).click();
    await page.waitForURL(/\/bands\/[0-9a-f-]+$/);
    const bandUrl = page.url();
    await page.goto(`${bandUrl}/tunings`);
    const remove = page.getByRole("button", { name: /^Delete / });
    // The list arrives after the page does: a count taken now would read 0 and delete nothing.
    await expect(remove.first()).toBeVisible();
    while ((await remove.count()) > 0) {
      const count = await remove.count();
      await remove.first().click();
      await expect(remove).toHaveCount(count - 1);
    }
    const live = (await dumpStore(page)).tunings as { deletedAt: string | null }[];
    expect(live.filter((t) => t.deletedAt === null), "the band really has no tuning").toEqual([]);
    await page.goto(songUrl);
    await pasteTab(page, FIVE);
    await expect(page.getByRole("button", { name: /^Switch to B Standard/ })).toBeVisible();
    await expect(
      page.getByTestId("paste-tab").getByTestId("tab-staff"),
      "FR-029: the preview is what the person agrees to",
    ).toBeVisible();
  });
});
