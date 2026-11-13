/**
 * Review probe, spec 008 INV-011, INV-012 (outside half) and INV-013 over the plan's sets.
 * **Card** (base named, base unnamed, variant named, variant unnamed) × {Enter, Space} × **Close** (Escape, a backdrop
 * tap, Tab, Shift+Tab, an item running); **Outside** (another card's trigger, another card's label link, a staff, the
 * bottom bar's Capture, the page background, the top bar's Sign in) × {coarse, fine}; placement for the first card, the
 * last card at the page end and a card at the top edge × **Sz**; print; the second trigger inert.
 * The implementation's spec covers one card, one outside point and two sizes.
 */
import { expect, test, type Page } from "@playwright/test";
import { dumpDatabase, n, seedSong } from "../../../e2e/reading-helpers";

test.setTimeout(300_000);

const CARDS = [
  { key: "a", label: "A", name: "main riff" },
  { key: "b", label: "B", name: null },
  { key: "c", label: "A'", name: "outro", variantOf: "a" },
  { key: "d", label: "B'", name: null, variantOf: "b" },
];

async function song(page: Page) {
  const cols = [n(3), n(5), n(7), { kind: "barline" as const }, n(8), n(9)];
  return seedSong(
    page,
    CARDS.map((c) => ({ key: c.key, label: c.label, name: c.name, variantOf: c.variantOf, columns: cols })),
    CARDS.map((c) => ({ part: c.key })),
  );
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\']/g, "\\$&");
const trigger = (page: Page, label: string) => page.getByRole("button", { name: new RegExp(`^Actions for part ${esc(label)}(,|$)`) });

test("INV-011 every card's menu from the keyboard, every close route returns focus", async ({ page }) => {
  await song(page);
  const bad: string[] = [];
  for (const card of CARDS) {
    const t = trigger(page, card.label);
    const name = await t.getAttribute("aria-label");
    if (!name?.includes(card.label) || (card.name && !name.includes(card.name))) bad.push(`${card.label}: trigger named "${name}"`);
    for (const open of ["Enter", "Space"]) {
      for (const close of ["Escape", "backdrop", "Tab", "Shift+Tab"]) {
        await t.focus();
        await page.keyboard.press(open);
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        const items = menu.getByRole("menuitem");
        const names = await items.evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent?.trim()));
        const want = card.variantOf ? 2 : 3;
        if (names.length !== want) bad.push(`${card.label}: ${names.length} items (${names.join(", ")})`);
        const focusedIndex = () => items.evaluateAll((els) => els.indexOf(document.activeElement as HTMLElement));
        if ((await focusedIndex()) !== 0) bad.push(`${card.label} ${open}: first item not focused`);
        for (let i = 1; i < names.length; i++) {
          await page.keyboard.press("ArrowDown");
          if ((await focusedIndex()) !== i) bad.push(`${card.label}: ArrowDown did not reach item ${i}`);
        }
        await page.keyboard.press("Home");
        if ((await focusedIndex()) !== 0) bad.push(`${card.label}: Home`);
        await page.keyboard.press("End");
        if ((await focusedIndex()) !== names.length - 1) bad.push(`${card.label}: End`);
        if (close === "backdrop") {
          const vp = page.viewportSize()!;
          const box = (await page.locator("dialog[open]").boundingBox())!;
          await page.mouse.click(box.x > 40 ? 4 : vp.width - 4, Math.min(vp.height - 4, box.y + box.height + 30));
        } else await page.keyboard.press(close);
        await expect(menu).toHaveCount(0);
        if (!(await t.evaluate((el) => el === document.activeElement))) bad.push(`${card.label} ${open}/${close}: focus not on the trigger`);
      }
    }
    // An item running: + variant on a base card. Focus goes back to the trigger.
    if (!card.variantOf) {
      await t.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menuitem", { name: "+ variant" }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toHaveCount(0);
      await page.waitForTimeout(300);
      if (!(await t.evaluate((el) => el === document.activeElement))) bad.push(`${card.label}: after + variant ran, focus not on the trigger`);
    }
  }
  const snapshot = await page.locator("body").ariaSnapshot();
  void snapshot;
  expect(bad).toEqual([]);
});

test("INV-012 a tap outside the open menu acts on nothing, for every outside target", async ({ page, isMobile }) => {
  const { songUrl } = await song(page);
  await page.waitForTimeout(400);
  const before = await dumpDatabase(page);
  const OUTSIDE: [string, (p: Page) => Promise<{ x: number; y: number } | null>][] = [
    ["another card's trigger", async (p) => centre(p, trigger(p, "B"))],
    ["another card's label link", async (p) => centre(p, p.getByRole("link", { name: /^Edit part B(,|$)/ }).first())],
    ["a staff", async (p) => centre(p, p.getByTestId("tab-staff").nth(1))],
    ["the bottom bar's Capture", async (p) => centre(p, p.getByTestId("song-actions").getByRole("link", { name: "Capture" }))],
    ["the page background", async (p) => { const vp = p.viewportSize()!; return { x: vp.width - 3, y: Math.round(vp.height * 0.45) }; }],
    ["the top bar's Sign in", async (p) => centre(p, p.getByRole("link", { name: "Sign in" }).first())],
  ];
  const bad: string[] = [];
  for (const [name, where] of OUTSIDE) {
    await page.goto(songUrl);
    const t = trigger(page, "A");
    await t.scrollIntoViewIfNeeded();
    const point = await where(page);
    if (!point) {
      // The song page draws its bottom bar on phones only.
      if (!isMobile && name === "the bottom bar's Capture") continue;
      bad.push(`${name}: not on screen to tap`);
      continue;
    }
    await t.click();
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    const inMenu = await page.locator("dialog[open]").evaluate((d, pt) => {
      const r = d.getBoundingClientRect();
      return pt.x >= r.left && pt.x <= r.right && pt.y >= r.top && pt.y <= r.bottom;
    }, point);
    if (inMenu) continue; // the menu covers it: not outside
    if (isMobile) await page.touchscreen.tap(point.x, point.y);
    else await page.mouse.click(point.x, point.y);
    await page.waitForTimeout(400);
    if (await menu.count()) bad.push(`${name}: menu still open`);
    if (page.url() !== songUrl) bad.push(`${name}: navigated to ${page.url()}`);
    if (!(await t.evaluate((el) => el === document.activeElement).catch(() => false))) bad.push(`${name}: focus not on the trigger`);
    if ((await dumpDatabase(page)) !== before) bad.push(`${name}: the database changed`);
  }
  expect(bad).toEqual([]);
});

async function centre(page: Page, loc: ReturnType<Page["locator"]>) {
  if (!(await loc.count())) return null;
  await loc.first().scrollIntoViewIfNeeded().catch(() => undefined);
  const b = await loc.first().boundingBox();
  if (!b) return null;
  const vp = page.viewportSize()!;
  const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  return pt.x > 0 && pt.y > 0 && pt.x < vp.width && pt.y < vp.height ? pt : null;
}

const SZ = {
  mobile: [
    { width: 375, height: 667 },
    { width: 390, height: 844 },
    { width: 412, height: 915 },
  ],
  desktop: [{ width: 1280, height: 800 }],
};

test("INV-013 the menu is on screen and above the bottom bar, for first, last and top-edge cards, at every size", async ({ page }, info) => {
  const { songUrl } = await song(page);
  const bad: string[] = [];
  for (const size of SZ[info.project.name as "mobile" | "desktop"]) {
    await page.setViewportSize(size);
    const cases: [string, () => Promise<void>][] = [
      ["first card", async () => { await page.evaluate(() => window.scrollTo(0, 0)); }],
      ["last card at the page end", async () => { await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); }],
      ["a card at the top edge", async () => {
        await trigger(page, "A'").evaluate((el) => {
          const top = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo(0, top - 2);
        });
      }],
    ];
    for (const [name, scroll] of cases) {
      await page.goto(songUrl);
      await page.waitForTimeout(300);
      await scroll();
      await page.waitForTimeout(200);
      const label = name === "first card" ? "A" : name === "last card at the page end" ? "B'" : "A'";
      const t = trigger(page, label);
      const tb = await t.boundingBox();
      if (!tb || tb.y + tb.height < 0 || tb.y > size.height) {
        bad.push(`${size.width}x${size.height} ${name}: trigger off screen`);
        continue;
      }
      await t.click();
      const r = (await page.locator("dialog[open]").boundingBox())!;
      const actions = page.getByTestId("song-actions");
      const bar = (await actions.isVisible()) ? (await actions.boundingBox())!.y : size.height;
      if (r.x < 0 || r.y < 0 || r.x + r.width > size.width || r.y + r.height > size.height) bad.push(`${size.width}x${size.height} ${name}: off screen ${JSON.stringify(r)}`);
      if (r.y + r.height > bar + 0.5) bad.push(`${size.width}x${size.height} ${name}: under the bottom bar (${(r.y + r.height).toFixed(1)} > ${bar.toFixed(1)})`);
      const second = trigger(page, label === "A" ? "B" : "A");
      const inert = await second.click({ timeout: 800, trial: true }).then(() => false, () => true);
      if (!inert) bad.push(`${size.width}x${size.height} ${name}: a second trigger is reachable while a menu is open`);
      await page.keyboard.press("Escape");
    }
  }
  await page.goto(songUrl);
  await trigger(page, "A").click();
  await page.emulateMedia({ media: "print" });
  if (await page.locator('button[aria-haspopup="menu"]:visible').count()) bad.push("print: a trigger prints");
  if (await page.locator("dialog[open]:visible").count()) bad.push("print: the open menu prints");
  expect(bad).toEqual([]);
});
