/**
 * INV-039 over **Keys** x **Inp**, **Keys** x **Mod**, **Keys** with a sheet open, and Space and Enter on a button, a
 * link and a column. usability-keys.spec.ts types into one input the test made itself.
 *
 * A shortcut that acts calls `preventDefault`, so that is what is read: an input's own arrow, Enter or Space keeps
 * working and is not a shortcut acting.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { columns, details, inspector } from "./capture-surface-helpers";
import { openArrange, openCluster, openTools } from "./usability-helpers";
import { fullWorld, type World } from "./probe-screens";

test.setTimeout(240_000);
test.skip(({ isMobile }) => isMobile, "a keyboard is the fine-pointer column");

const KEYS = [
  " ", "r", "ArrowLeft", "ArrowRight", "[", "]", "Home", "End", ",", ".", "ArrowUp", "ArrowDown", "5", "x", "?",
];
const PRESS: Record<string, string> = { " ": "Space" };

/** Logs each keydown after every listener has run. */
const watch = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __keys: { key: string; took: boolean }[]; __watching?: boolean };
    w.__keys = [];
    if (w.__watching) return;
    w.__watching = true;
    window.addEventListener("keydown", (e) => setTimeout(() => w.__keys.push({ key: e.key, took: e.defaultPrevented })));
  });
const taken = (page: Page) =>
  page.evaluate(() =>
    (window as unknown as { __keys: { key: string; took: boolean }[] }).__keys.filter((k) => k.took).map((k) => k.key),
  );

const state = (page: Page) =>
  page.evaluate(() => ({
    url: location.pathname,
    help: !!document.querySelector('[data-testid="help-overlay"]')?.checkVisibility(),
    running: !!document.querySelector('[data-testid="click-stop"]'),
    columns: document.querySelectorAll('[data-testid="tab-column"]').length,
    reading: document.querySelectorAll(".tab-column-reading").length,
    caret: document.querySelector('[data-testid="tab-caret"]')?.getBoundingClientRect().x ?? null,
  }));

const INPUTS: { name: string; reach: (p: Page, w: World) => Promise<void>; typed?: string }[] = [
  { name: "Band name", reach: async (p) => void (await p.goto("/")), typed: "r5x" },
  { name: "Song title", reach: async (p, w) => void (await p.goto(w.bandUrl)), typed: "r5x" },
  {
    name: "Part name",
    reach: async (p, w) => {
      await p.goto(w.songUrl);
      await p.getByTestId("part-heading").first().waitFor();
      await p.getByRole("button", { name: "main riff" }).first().click();
    },
    typed: "r5x",
  },
  {
    name: "Beats per minute",
    reach: async (p, w) => {
      await p.goto(w.songUrl);
      await openTools(p);
    },
  },
  {
    name: "Section name",
    reach: async (p, w) => {
      await p.goto(w.songUrl);
      await openArrange(p);
    },
    typed: "r5x",
  },
  {
    name: "Cue",
    reach: async (p, w) => {
      await p.goto(w.songUrl);
      await openArrange(p);
    },
    typed: "r5x",
  },
  {
    name: "Tab text",
    reach: async (p, w) => {
      await p.goto(w.songUrl);
      await p.getByRole("button", { name: "Paste tab" }).first().click();
    },
    typed: "r5x",
  },
  {
    name: "Chord",
    reach: async (p, w) => {
      await p.goto(w.partUrl);
      await columns(p).first().click();
      await p.getByRole("button", { name: "chord symbol" }).click();
    },
    typed: "r5x",
  },
  { name: "Email", reach: async (p) => void (await p.goto("/sign-in")), typed: "r5x" },
  { name: "Password", reach: async (p) => void (await p.goto("/sign-in")), typed: "r5x" },
];

/** Any preset but the one in use. */
async function addSecondTuning(page: Page) {
  const add = page.getByRole("button", { name: /^Add / }).nth(1);
  await add.waitFor();
  await add.click();
  await page.waitForTimeout(200);
}

const field = (page: Page, name: string) =>
  name === "Chord"
    ? page.getByRole("textbox", { name: "Chord" }).or(page.getByPlaceholder("Harmony, e.g. Am")).first()
    : name === "Tab text"
      ? page.getByRole("textbox", { name: "Tab text" })
      : page.getByLabel(name, { exact: name !== "Part name" }).first();

test("INV-039 Keys x Inp: no shortcut takes a key from a field, and printable keys type", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  for (const input of INPUTS) {
    await input.reach(page, world);
    const box = field(page, input.name);
    await box.waitFor({ timeout: 6000 });
    await box.fill("").catch(() => undefined);
    await box.focus();
    await watch(page);
    const before = await state(page);
    for (const key of KEYS) await page.keyboard.press(PRESS[key] ?? key);
    await page.waitForTimeout(80);
    const took = await taken(page);
    if (took.length) bad.push(`${input.name}: a shortcut took ${took.join(" ")}`);
    const after = await state(page);
    if (JSON.stringify(after) !== JSON.stringify(before)) bad.push(`${input.name}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
    if (input.typed) {
      const value = await box.inputValue();
      for (const ch of input.typed) if (!value.includes(ch)) bad.push(`${input.name}: "${ch}" not typed, value "${value}"`);
    }
  }
  expect(bad).toEqual([]);
});

test("INV-039 Keys x selects: the tuning and last-pass selects keep their own keys", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  const press = async (name: string, select: Locator) => {
    await select.focus();
    await watch(page);
    const before = await state(page);
    for (const key of KEYS) await page.keyboard.press(PRESS[key] ?? key);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(80);
    const took = await taken(page);
    if (took.length) bad.push(`${name}: a shortcut took ${took.join(" ")}`);
    if ((await state(page)).url !== before.url) bad.push(`${name}: the page changed`);
  };
  page.setDefaultTimeout(6000);
  // The select only shows once a band has a second tuning to choose.
  await page.goto(`${world.bandUrl}/tunings`);
  await addSecondTuning(page);
  await page.goto(world.songUrl);
  await openTools(page);
  await press("tuning", page.locator("select").filter({ hasText: "Band default" }).first());
  await page.goto(world.songUrl);
  await openArrange(page);
  // The last-pass select shows for an entry whose part has a variant, so walk the chips to it.
  const chips = page.getByTestId("roadmap-chip");
  const label = page.locator("label").filter({ hasText: "Last pass" });
  for (let i = 0; i < (await chips.count()) && !(await label.isVisible()); i += 1) {
    await chips.nth(i).click();
    await page.waitForTimeout(150);
  }
  await expect(label).toBeVisible();
  await press("last pass", label.locator("select"));
  expect(bad).toEqual([]);
});

test("INV-039 Keys x a contenteditable and the inspector's chord, on the live screens", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  for (const url of [world.partUrl, world.playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-staff").first()).toBeAttached();
    await page.waitForTimeout(200);
    await page.evaluate(() => {
      const el = document.createElement("div");
      el.contentEditable = "true";
      el.id = "probe-editable";
      el.textContent = "x";
      document.body.prepend(el);
      el.focus();
    });
    await watch(page);
    const before = await state(page);
    for (const key of KEYS) await page.keyboard.press(PRESS[key] ?? key);
    await page.waitForTimeout(80);
    const took = await taken(page);
    if (took.length) bad.push(`contenteditable: a shortcut took ${took.join(" ")}`);
    if (JSON.stringify(await state(page)) !== JSON.stringify(before)) bad.push(`contenteditable on ${url}: state moved`);
  }
  await page.goto(world.partUrl);
  await columns(page).first().click();
  await details(page).click();
  await expect(inspector(page)).toBeVisible();
  const box = inspector(page).locator("input[type=text], input:not([type])").first();
  await box.focus();
  await watch(page);
  for (const key of KEYS) await page.keyboard.press(PRESS[key] ?? key);
  await page.waitForTimeout(80);
  expect([...bad, ...(await taken(page))]).toEqual([]);
});

/** Synthetic so that Alt+Left cannot leave the page. Every key with each modifier, and each form of composition. */
const firing = (page: Page, init: Record<string, unknown>) =>
  page.evaluate(
    ({ keys, init }) => {
      const took: string[] = [];
      for (const key of keys) {
        const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
        document.body.dispatchEvent(e);
        if (e.defaultPrevented) took.push(key);
      }
      return took;
    },
    { keys: KEYS, init },
  );

const MODS: { name: string; init: Record<string, unknown> }[] = [
  { name: "Ctrl", init: { ctrlKey: true } },
  { name: "Cmd", init: { metaKey: true } },
  { name: "Alt", init: { altKey: true } },
  { name: "composing", init: { isComposing: true } },
  { name: "keyCode 229", init: { keyCode: 229 } },
];

test("INV-039 Keys x Mod on capture, play and the song page", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  for (const url of [world.partUrl, world.playUrl, world.songUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-staff").first()).toBeAttached();
    await page.waitForTimeout(300);
    const before = await state(page);
    for (const mod of MODS) {
      const took = await firing(page, mod.init);
      if (took.length) bad.push(`${mod.name} on ${url}: took ${took.join(" ")}`);
    }
    await page.waitForTimeout(100);
    if (JSON.stringify(await state(page)) !== JSON.stringify(before)) bad.push(`state moved on ${url}`);
    // The control: the same keys bare are taken, so a pass above is not a dead listener.
    expect((await firing(page, {})).length, `${url} has live keys`).toBeGreaterThan(0);
    await page.evaluate(() => {
      for (const d of document.querySelectorAll("dialog[open]")) (d as HTMLDialogElement).close();
    });
  }
  expect(bad).toEqual([]);
});

test("INV-039 Keys with the tempo sheet open", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  for (const url of [world.partUrl, world.playUrl]) {
    await page.goto(url);
    await expect(page.getByTestId("tab-staff").first()).toBeAttached();
    await page.getByTestId("tempo-control").click();
    await expect(page.getByTestId("tap-pad")).toBeVisible();
    const before = await state(page);
    const took = await firing(page, {});
    if (took.length) bad.push(`sheet open on ${url}: took ${took.join(" ")}`);
    await page.waitForTimeout(100);
    if (JSON.stringify(await state(page)) !== JSON.stringify(before)) bad.push(`state moved under the sheet on ${url}`);
  }
  expect(bad).toEqual([]);
});

test("INV-039 Space and Enter belong to a focused button, a link and a column", async ({ page }) => {
  const world = await fullWorld(page);
  await page.goto(world.playUrl);
  await openCluster(page);
  // A focused button other than Start: Space presses it, and the click stays stopped.
  const view = page.getByTestId("staff-view-notes");
  await view.focus();
  await page.keyboard.press("Space");
  await expect(view).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("click-start")).toBeVisible();
  await page.getByTestId("staff-view-frets").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("staff-view-frets")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("click-start")).toBeVisible();
  // A focused link: Space does not start the click, Enter follows it.
  const link = page.locator("main a, header a").first();
  await link.focus();
  await page.keyboard.press("Space");
  await expect(page.getByTestId("click-start")).toBeVisible();
  const was = page.url();
  await page.keyboard.press("Enter");
  await expect(page).not.toHaveURL(was);
  // A focused column: Enter selects it as a tap would, and adds no note.
  await page.goto(world.partUrl);
  await expect(columns(page).first()).toBeVisible();
  const count = await columns(page).count();
  await columns(page).nth(1).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  expect(await columns(page).count()).toBe(count);
  await expect(page.getByText(/adding after the marked column/)).toBeVisible();
});

test("INV-039 a key on a screen it is not listed for does nothing", async ({ page }) => {
  const world = await fullWorld(page);
  const bad: string[] = [];
  const LOCAL = KEYS.filter((k) => k !== "?");
  for (const url of ["/", world.bandUrl, world.songUrl, "/privacy"]) {
    await page.goto(url);
    await page.waitForTimeout(250);
    const took = await page.evaluate((keys) => {
      const out: string[] = [];
      for (const key of keys) {
        const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        if (e.defaultPrevented) out.push(key);
      }
      return out;
    }, LOCAL);
    if (took.length) bad.push(`${url}: took ${took.join(" ")}`);
  }
  const capture = await (async () => {
    await page.goto(world.partUrl);
    await expect(columns(page).first()).toBeVisible();
    await page.waitForTimeout(250);
    return firing(page, {}).then((took) => took.filter((k) => k === " " || k === "r"));
  })();
  const play = await (async () => {
    await page.goto(world.playUrl);
    await expect(page.getByTestId("tab-staff").first()).toBeVisible();
    await page.waitForTimeout(250);
    return page.evaluate(() =>
      ["Home", "End", ",", ".", "ArrowUp", "ArrowDown", "5", "x"].filter((key) => {
        const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
        document.body.dispatchEvent(e);
        return e.defaultPrevented;
      }),
    );
  })();
  expect({ bad, capture, play }).toEqual({ bad: [], capture: [], play: [] });
});
