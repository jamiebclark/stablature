/**
 * INV-018: 4 string counts (4, 5, 6, 7), EVERY string played, x 2 themes. The suite's test
 * plays 1, 2, 4 and 5 strings on one 5-string tuning, so 6 and 7 are never reached.
 *
 * INV-024: 3 routes (Shift+F10, ContextMenu, the details button) x 6 toggles x {Space, Enter};
 * a single tap on details; names unique on Guitar 6; no route opens the sheet in a selection.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  columns,
  DECORATIONS,
  details,
  exportRow,
  exportText,
  fret,
  inspector,
  openDialog,
  PHONE,
  playEveryString,
  stable,
  startCapturing,
  startWith,
  storedRows,
  THEMES,
} from "./probe-helpers";

const TUNINGS = [
  { family: "Bass 4", preset: "E Standard", strings: 4 },
  { family: "Bass 5", preset: "Drop A", strings: 5 },
  { family: "Guitar 6", preset: "E Standard", strings: 6 },
  { family: "Guitar 7", preset: "B Standard", strings: 7 },
] as const;

for (const t of TUNINGS) {
  for (const theme of THEMES) {
    test(`INV-018 ${t.strings} strings, ${theme}`, async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.emulateMedia({ colorScheme: theme });
      await startWith(page, t.family, t.preset, t.strings);
      await playEveryString(page, t.strings);
      await details(page).click();
      await expect(openDialog(page)).toHaveCount(1);
      const dialog = openDialog(page);
      const groups = inspector(page).getByTestId("decoration-group");
      await expect(groups).toHaveCount(t.strings);
      const toggles = groups.getByRole("button");
      await expect(toggles).toHaveCount(t.strings * 6);
      const close = inspector(page).getByRole("button", { name: "close" });

      const count = await toggles.count();
      for (let i = 0; i < count; i += 1) {
        const toggle = toggles.nth(i);
        await toggle.scrollIntoViewIfNeeded();
        const b = (await toggle.boundingBox())!;
        expect(b.y, `toggle ${i} top`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height, `toggle ${i} bottom`).toBeLessThanOrEqual(PHONE.height);
        expect(b.x + b.width, `toggle ${i} right`).toBeLessThanOrEqual(PHONE.width);
        // In view is not the same as reachable: the sticky header can sit on top of it.
        const hit = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.getAttribute("aria-label") ?? null,
          [b.x + b.width / 2, b.y + b.height / 2],
        );
        expect(hit, `toggle ${i} is what a tap would hit`).toBe(await toggle.getAttribute("aria-label"));
      }

      for (const f of [0, 0.5, 1]) {
        await dialog.evaluate((el, at) => {
          el.scrollTop = (el.scrollHeight - el.clientHeight) * at;
        }, f);
        const b = (await close.boundingBox())!;
        expect(b.y, `close at ${f}`).toBeGreaterThanOrEqual(0);
        expect(b.y + b.height).toBeLessThanOrEqual(PHONE.height);
      }

      const sizes = await dialog.evaluate((el) => ({
        sheetX: el.scrollWidth > el.clientWidth,
        pageX: document.scrollingElement!.scrollWidth > document.scrollingElement!.clientWidth,
        pageY: document.scrollingElement!.scrollHeight > document.scrollingElement!.clientHeight,
      }));
      expect(sizes).toEqual({ sheetX: false, pageX: false, pageY: false });

      await close.click();
      await expect(openDialog(page)).toHaveCount(0);
    });
  }
}

const ROUTES: Record<string, (page: Page) => Promise<void>> = {
  "Shift+F10": async (page) => {
    await columns(page).first().focus();
    await page.keyboard.press("Shift+F10");
  },
  ContextMenu: async (page) => {
    await columns(page).first().focus();
    await page.keyboard.press("ContextMenu");
  },
  "details button": async (page) => {
    await details(page).focus();
    await page.keyboard.press("Enter");
  },
};

for (const [route, open] of Object.entries(ROUTES)) {
  for (const key of ["Space", "Enter"] as const) {
    test(`INV-024 ${route}, every toggle by ${key}`, async ({ page }) => {
      const { songUrl } = await startCapturing(page);
      await fret(page, "A", 7).click();
      await expect(columns(page)).toHaveCount(1);
      await open(page);
      await expect(openDialog(page)).toHaveCount(1);
      for (const d of DECORATIONS) {
        const toggle = inspector(page).getByRole("button", { name: `${d.words} on the A1 string` });
        await expect(toggle).toHaveAttribute("aria-pressed", "false");
        await toggle.focus();
        await page.keyboard.press(key);
        await expect(toggle).toHaveAttribute("aria-pressed", "true");
        await expect(toggle, "focus stays on the toggle").toBeFocused();
      }
      await expect(openDialog(page)).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(openDialog(page)).toHaveCount(0);
      expect(exportRow(await exportText(page, songUrl), "A")).toBe("-t(<7>)b~m-");
    });
  }
}

test("INV-024 a single tap on details", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 7).click();
  await details(page).click();
  await expect(openDialog(page)).toHaveCount(1);
  await expect(inspector(page).getByTestId("decoration-group")).toHaveCount(1);
});

test("INV-024 names unique on Guitar 6, with its two E strings", async ({ page }) => {
  await startWith(page, "Guitar 6", "E Standard", 6);
  await playEveryString(page, 6);
  await details(page).click();
  const names = await inspector(page)
    .getByTestId("decoration-group")
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  expect(names).toHaveLength(36);
  expect(new Set(names).size).toBe(36);
  const labels = await inspector(page)
    .getByTestId("decoration-group")
    .evaluateAll((els) => els.map((e) => e.querySelector("span")?.textContent));
  console.log(`MEASURE guitar 6 group labels: ${JSON.stringify(labels)}`);
});

test("INV-024 no route opens the sheet during a selection", async ({ page }) => {
  await startCapturing(page);
  await fret(page, "A", 7).click();
  await fret(page, "A", 5).click();
  await expect(columns(page)).toHaveCount(2);
  await columns(page).first().click();
  await stable(page).getByRole("button", { name: /select/ }).click();
  await expect(details(page)).toHaveCount(0);
  await columns(page).first().focus();
  await page.keyboard.press("Shift+F10");
  await expect(openDialog(page)).toHaveCount(0);
  await page.keyboard.press("ContextMenu");
  await expect(openDialog(page)).toHaveCount(0);
  expect((await storedRows(page)).length).toBe(2);
});
