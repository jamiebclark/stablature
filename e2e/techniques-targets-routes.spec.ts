/**
 * INV-011: every target and every route, each with the latches whose rules differ there.
 * "Never left armed after an action that disarms stack", so stack runs where its handling
 * differs, and a chip may survive a route only if stack does too.
 *
 * INV-012: stack and a chip x 2 clipboard tails (stack alone must drop on the barline tail, the
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

const TARGET_CASES: [target: string, latch: string][] = [
  ["notes", "hammer-on"], // the typical case: a chip arms on a note
  ["rest", STACK], // a rest is a column stack can mark
  ["barline", STACK], // the one per-latch rule: stack is refused on a barline
  ["barline", "slide down"], // ...while a chip still arms there
  ["start of part", "pull-off"], // no column under the cursor
  ["empty part", STACK], // no columns at all
  ["no part", "slide up"], // the strip with no part to capture into
];

for (const [targetName, name] of TARGET_CASES) {
  const target = TARGETS.find((t) => t.name === targetName)!;
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

// Each route is its own disarm path, so every route runs once with a chip; stack joins where
// its own handling differs.
const ROUTE_CASES: [route: string, latch: string][] = [
  ["tap a column", "hammer-on"], // a cursor move
  ["switch part", "pull-off"], // a part change
  ["space", "slide up"], // a rest insert
  ["barline", "slide down"], // a barline insert
  ["start", "hammer-on"], // the cursor leaves every column
  ["delete the target", STACK], // the one survivor: stack keeps its playable cursor
  ["delete the target", "pull-off"], // ...and a chip survives with it
  ["delete it from a second tab", "slide up"], // a delete arriving from another tab
  ["add a part", "slide down"], // a new part
  ["history back", "hammer-on"], // a navigation the app did not start
  ["history back", STACK], // stack through the same navigation
];

for (const [route, name] of ROUTE_CASES) {
  const act = ROUTES[route];
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

const PASTE_CASES: [tail: "notes" | "barline", latch: string][] = [
  ["notes", STACK], // stack survives a paste ending on notes
  ["barline", STACK], // stack alone drops on a barline tail
  ["notes", "hammer-on"], // a chip survives, then marks the next note
  ["barline", "slide down"], // a chip survives the barline tail too, then marks the next note
];

for (const [tail, name] of PASTE_CASES) {
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
