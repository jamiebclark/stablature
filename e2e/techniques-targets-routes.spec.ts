/**
 * INV-011: 5 latches x 6 targets = 30 through the screen; 4 chips x 9 routes = 36.
 * "Never left armed after an action that disarms stack", so each route also runs with stack
 * armed, and a chip may survive a route only if stack does too.
 *
 * INV-012: 5 latches x 2 clipboard tails (stack alone must drop on the barline tail, the
 * member the suite skips), then the armed chip must still do its job on the next note.
 */
import { expect, test, type Page } from "@playwright/test";
import {
  addPart,
  CHIPS,
  columns,
  connectors,
  deleteButton,
  expectLit,
  fret,
  latch,
  LATCH_NAMES,
  space,
  stable,
  STACK,
  startCapturing,
  storedRows,
} from "./capture-surface-helpers";

const barlineButton = (page: Page) => page.getByTitle("Barline");

interface Target {
  name: string;
  enter: (page: Page) => Promise<void>;
  applicable: (latchName: string) => boolean;
}

const TARGETS: Target[] = [
  {
    name: "notes",
    enter: async (page) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(1);
    },
    applicable: () => true,
  },
  {
    name: "rest",
    enter: async (page) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await space(page);
      await expect(columns(page)).toHaveCount(2);
    },
    applicable: () => true,
  },
  {
    name: "barline",
    enter: async (page) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await barlineButton(page).click();
      await expect(columns(page)).toHaveCount(2);
    },
    applicable: (n) => n !== STACK,
  },
  {
    name: "start of part",
    enter: async (page) => {
      await startCapturing(page);
      await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(1);
      await page.getByRole("button", { name: /start/ }).click();
    },
    applicable: () => false,
  },
  {
    name: "empty part",
    enter: async (page) => {
      await startCapturing(page);
    },
    applicable: () => false,
  },
  {
    name: "no part",
    enter: async (page) => {
      await page.goto("/");
      await page.getByLabel("Band name").fill("Hollow Crown");
      await page.getByRole("button", { name: "Add band" }).click();
      await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
      await page.getByLabel("Song title").fill("Empty");
      await page.getByRole("button", { name: "Add song" }).click();
      await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
      await page.getByRole("link", { name: "Capture" }).click();
      await expect(page).toHaveURL(/\/capture$/);
      await expect(page.getByText("Add a part to start capturing.")).toBeVisible();
    },
    applicable: () => false,
  },
];

for (const target of TARGETS) {
  for (const name of LATCH_NAMES) {
    test(`INV-011 ${name} on ${target.name}`, async ({ page }) => {
      await target.enter(page);
      const chip = latch(page, name);
      await expect(chip).toBeVisible();
      if (target.applicable(name)) {
        await expect(chip).toBeEnabled();
        await chip.click();
        await expect(chip).toHaveAttribute("aria-pressed", "true");
      } else {
        await expect(chip).toBeDisabled();
        await expect(chip).toHaveAttribute("aria-pressed", "false");
      }
    });
  }
}

/** Two parts, the open one holding 5, 7 with the cursor on the 7 unless a route moves it. */
async function routeBase(page: Page) {
  const ctx = await startCapturing(page);
  await fret(page, "A", 5).click();
  await addPart(page);
  await fret(page, "A", 5).click();
  await fret(page, "A", 7).click();
  await expect(columns(page)).toHaveCount(2);
  await columns(page).nth(1).click();
  return ctx;
}

const ROUTES: Record<string, (page: Page) => Promise<void>> = {
  "tap a column": async (page) => {
    await columns(page).nth(0).click();
  },
  "switch part": async (page) => {
    await page.getByRole("link", { name: "A", exact: true }).click();
    await expect(columns(page)).toHaveCount(1);
  },
  space: async (page) => {
    await space(page);
    await expect(columns(page)).toHaveCount(3);
  },
  barline: async (page) => {
    await barlineButton(page).click();
    await expect(columns(page)).toHaveCount(3);
  },
  start: async (page) => {
    await page.getByRole("button", { name: /start/ }).click();
  },
  "delete the target": async (page) => {
    await deleteButton(page).click();
    await expect(columns(page)).toHaveCount(1);
  },
  "delete it from a second tab": async (page) => {
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(columns(other)).toHaveCount(2);
    await columns(other).nth(1).click();
    await deleteButton(other).click();
    await expect(columns(other)).toHaveCount(1);
    await other.close();
    await expect(columns(page)).toHaveCount(1);
  },
  "add a part": async (page) => {
    await addPart(page);
  },
  "history back": async (page) => {
    const url = page.url();
    await page.goBack();
    await expect(page).not.toHaveURL(url);
    await expect(page.getByTestId("latch-strip")).toBeVisible();
  },
};

for (const [route, act] of Object.entries(ROUTES)) {
  for (const name of LATCH_NAMES) {
    test(`INV-011 route ${route} with ${name}`, async ({ page }) => {
      await routeBase(page);
      const chip = latch(page, name);
      await chip.click();
      await expect(chip).toHaveAttribute("aria-pressed", "true");
      await act(page);
      await page.waitForTimeout(150);
      const lit = await chip.getAttribute("aria-pressed");
      const survives = route === "delete the target";
      // Stack survives a delete that leaves a playable cursor, on main too, so a chip may.
      test.info().annotations.push({ type: "route", description: `${route} ${name} lit=${lit}` });
      expect(lit).toBe(survives ? "true" : "false");
    });
  }
}

const PASTE_TAILS = ["notes", "barline"] as const;

for (const tail of PASTE_TAILS) {
  for (const name of LATCH_NAMES) {
    test(`INV-012 ${name}, mid-part paste ending on ${tail}`, async ({ page }) => {
      await startCapturing(page);
      await fret(page, "E", 7).click();
      if (tail === "barline") await barlineButton(page).click();
      else await fret(page, "A", 5).click();
      await expect(columns(page)).toHaveCount(2);
      await columns(page).nth(tail === "barline" ? 1 : 0).click();
      await stable(page).getByRole("button", { name: /select/ }).click();
      await page.getByRole("button", { name: "copy", exact: true }).click();
      await columns(page).nth(0).click();
      await latch(page, name).click();
      await stable(page).getByRole("button", { name: /paste/ }).click();
      await expect(columns(page)).toHaveCount(3);
      const dropped = tail === "barline" && name === STACK;
      await expectLit(page, dropped ? [] : [name]);
      if (dropped || name === STACK) return;

      // A paste is not a note: the chip still marks the next one, then goes dark.
      await fret(page, "E", 9).click();
      await expect(columns(page)).toHaveCount(4);
      await expectLit(page, []);
      const chip = CHIPS.find((c) => c.name === name)!;
      expect((await storedRows(page)).flatMap((r) => Object.values(r.techniques).flat())).toEqual([
        chip.id,
      ]);
      await expect(connectors(page)).toHaveCount(1);
    });
  }
}
