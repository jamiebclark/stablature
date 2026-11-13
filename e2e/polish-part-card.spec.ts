import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { dumpDatabase, seedReadable } from "./reading-helpers";
import { normaliseDump, openPartMenu, partAction, textContrast } from "./part-card-helpers";

/**
 * Spec 008 US2 + US5: part cards stop shouting, an unnamed part invites a name.
 * INV-010 quiet face, INV-011 keyboard, INV-012 stray press, INV-013 placement, INV-015 same actions, INV-016 invitation.
 */
test.setTimeout(120_000);

const THEMES = ["light", "dark"] as const;
const SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;
const BEFORE = JSON.parse(readFileSync("e2e/fixtures/card-actions-before.json", "utf8")) as Record<string, unknown>;

/** The seeded song page with two variants made, so there are three cards. */
async function threeParts(page: Page) {
  const { songUrl } = await seedReadable(page);
  await partAction(page, "A", "+ variant");
  await expect(page.getByTestId("variant-line")).toHaveCount(1);
  await partAction(page, "A", "+ variant");
  await expect(page.getByTestId("variant-line")).toHaveCount(2);
  return songUrl;
}

const trigger = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^Actions for part ${label}(,|$)`) });

const dangerOnFace = (page: Page) =>
  page.evaluate(() => {
    const probe = document.createElement("i");
    probe.style.color = "var(--danger)";
    document.body.append(probe);
    const danger = getComputedStyle(probe).color;
    probe.remove();
    const hits: string[] = [];
    for (const heading of document.querySelectorAll('[data-testid="part-heading"]')) {
      const root = heading.closest("div.relative") ?? heading.parentElement!;
      for (const el of root.querySelectorAll<HTMLElement>("*")) {
        if (el.closest("dialog")) continue;
        const s = getComputedStyle(el);
        for (const p of ["color", "backgroundColor", "borderTopColor"] as const) if (s[p] === danger) hits.push(`${el.tagName}.${p}`);
      }
    }
    return hits;
  });

for (const theme of THEMES) {
  for (const size of SIZES) {
    test(`INV-010 a closed card face has no Delete, + variant, Edit button or danger ink (${theme} ${size.width}x${size.height})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme });
      await page.setViewportSize(size);
      await threeParts(page);
      for (const name of [/^Delete/, /^\+ variant/, /^Edit$/]) {
        await expect(page.getByRole("button", { name }), String(name)).toHaveCount(0);
      }
      await expect(page.getByRole("menuitem")).toHaveCount(0);
      expect(await dangerOnFace(page), "danger ink on the face").toEqual([]);
    });
  }
}

test("INV-011 the menu works from the keyboard", async ({ page }) => {
  await threeParts(page);
  const t = trigger(page, "A");
  await expect(t).toHaveAttribute("aria-haspopup", "menu");
  for (const key of ["Enter", "Space"]) {
    await t.focus();
    await page.keyboard.press(key);
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const items = menu.getByRole("menuitem");
    await expect(items.first()).toBeFocused();
    const n = await items.count();
    expect(n).toBeGreaterThanOrEqual(2);
    await page.keyboard.press("ArrowDown");
    await expect(items.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("End");
    await expect(items.nth(n - 1)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(items.first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(items.nth(n - 1)).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(t).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(menu).toHaveCount(0);
    await expect(t).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "+ variant" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(page.getByTestId("variant-line")).toHaveCount(3);
});

test("INV-012 opening never runs an item, and a tap outside runs nothing", async ({ page }) => {
  await threeParts(page);
  const before = await dumpDatabase(page);
  const url = page.url();
  const t = trigger(page, "A");
  await t.click();
  await expect(page.getByRole("menu")).toBeVisible();
  expect(await dumpDatabase(page), "opening by click changes nothing").toBe(before);
  const box = (await page.getByRole("menu").boundingBox())!;
  const vp = page.viewportSize()!;
  await page.mouse.click(box.x > 40 ? 4 : vp.width - 4, vp.height - 4);
  await expect(page.getByRole("menu")).toHaveCount(0);
  await expect(t).toBeFocused();
  expect(page.url()).toBe(url);
  expect(await dumpDatabase(page)).toBe(before);
  // A click whose press did not begin inside the dialog is swallowed.
  await t.click();
  const del = page.getByRole("menuitem", { name: "Delete part A" });
  await expect(del).toBeVisible();
  await del.dispatchEvent("click", { detail: 1 });
  expect(await dumpDatabase(page), "a stray click on Delete runs nothing").toBe(before);
});

test("INV-013 the menu sits inside the viewport and above the song actions", async ({ page }) => {
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await threeParts(page);
    for (const label of ["A", "A''"]) {
      await trigger(page, label).scrollIntoViewIfNeeded();
      const menu = await openPartMenu(page, label);
      void menu;
      const r = (await page.locator("dialog[open]").boundingBox())!;
      expect(r.x, `${label} left`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${label} top`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, `${label} right`).toBeLessThanOrEqual(size.width);
      expect(r.y + r.height, `${label} bottom`).toBeLessThanOrEqual(size.height);
      const actions = page.getByTestId("song-actions");
      if (await actions.isVisible()) expect(r.y + r.height).toBeLessThanOrEqual((await actions.boundingBox())!.y + 0.5);
      await expect(trigger(page, "A'").click({ timeout: 1000, trial: true }), "second trigger inert").rejects.toThrow();
      await page.keyboard.press("Escape");
    }
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.locator('button[aria-haspopup="menu"]:visible')).toHaveCount(0);
});

const settle = (page: Page) => page.waitForTimeout(600);
const CASES: [string, (p: Page) => Promise<void>][] = [
  ["+ variant", (p) => partAction(p, "A", "+ variant")],
  ["delete a part used in the arrangement", (p) => partAction(p, "A", "Delete")],
  [
    "delete a variant",
    async (p) => {
      await partAction(p, "A", "+ variant");
      await settle(p);
      await partAction(p, "A'", "Delete");
    },
  ],
  [
    "delete a variant's base",
    async (p) => {
      await partAction(p, "A", "+ variant");
      await settle(p);
      await partAction(p, "A", "Delete");
    },
  ],
];
for (const [key, steps] of CASES) {
  test(`INV-015 the menu's ${key} writes what the buttons wrote`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width: 375, height: 667 }, hasTouch: true, isMobile: true })).newPage();
    await seedReadable(page);
    await steps(page);
    await settle(page);
    expect(normaliseDump(await dumpDatabase(page))).toEqual(BEFORE[key]);
  });
}

test("INV-015 the label link and the Edit item go to the same URL", async ({ page }) => {
  await seedReadable(page);
  const href = await page.getByRole("link", { name: /^Edit part A/ }).first().getAttribute("href");
  expect(href).toMatch(/\/capture\/[0-9a-f-]+$/);
  await partAction(page, "A", "Edit");
  await expect(page).toHaveURL(new RegExp(`${href}$`));
});

for (const theme of THEMES) {
  test(`INV-016 an unnamed part invites a name, a named one does not (${theme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await seedReadable(page);
    const invite = page.getByRole("button", { name: "Name part A" });
    await expect(invite).toBeVisible();
    await expect(invite.locator("svg")).toHaveCount(1);
    expect(await invite.evaluate((el) => getComputedStyle(el).textDecorationStyle)).toBe("dashed");
    expect(await invite.evaluate(textContrast)).toBeGreaterThanOrEqual(4.5);
    const before = await invite.screenshot();
    await invite.click();
    await expect(page.getByLabel("Part name")).toHaveValue("");
    await page.getByLabel("Part name").fill("main riff");
    await page.getByRole("button", { name: "Save" }).click();
    const named = page.getByRole("button", { name: "main riff", exact: true });
    await expect(named).toBeVisible();
    await expect(named.locator("svg")).toHaveCount(0);
    expect(await named.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe("none");
    expect(before.equals(await named.screenshot())).toBe(false);
    await named.click();
    await expect(page.getByLabel("Part name")).toHaveValue("main riff");
    await page.getByLabel("Part name").fill("   ");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: "Name part A" })).toBeVisible();
  });
}
