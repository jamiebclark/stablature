import { expect, test, type Page } from "@playwright/test";
import { columns, details, inspector, openDialog } from "./capture-surface-helpers";
import { pasteTab } from "./import-helpers";
import { box, KEYBOARD, openCluster, openTools, safeArea, showKeyboard, stubKeyboard } from "./usability-helpers";
import { songWorld } from "./usability-world";

test.setTimeout(180_000);

const kbTop = (page: Page, keyboard: number) => page.evaluate((k) => window.innerHeight - k, keyboard);

/**
 * INV-011: with a soft keyboard up, what you are typing into and the words about it are above it.
 * The keyboard is stubbed through `visualViewport`, so the page's own listeners run as they would.
 */
// The smallest phone, 375x667 with a 260px keyboard, leaves the least room above the keyboard.
for (const size of [KEYBOARD[0]]) {
  test.describe(`INV-011 keyboard ${size.name}`, () => {
    test.beforeEach(async ({ isMobile }) => {
      test.skip(!isMobile, "touch projects only");
    });

    test("paste with a refusal, and paste ready", async ({ page }) => {
      await stubKeyboard(page, size.keyboard);
      const world = await songWorld(page, 2);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(world.songUrl);
      const limit = await kbTop(page, size.keyboard);

      await pasteTab(page, "e|--zz--|\nB|--3---|\nG|--0---|");
      const box = page.getByRole("textbox", { name: "Tab text" });
      await box.focus();
      await showKeyboard(page, true);
      await page.waitForTimeout(150);
      const status = page.getByTestId("paste-tab").getByRole("status");
      const s = (await status.boundingBox())!;
      expect(s.y + s.height, "refusal status above the keyboard").toBeLessThanOrEqual(limit);
      expect(s.y, "refusal status on screen").toBeGreaterThanOrEqual(0);
      const first = page.getByTestId("paste-refusals").locator("li").first();
      if (await first.count()) {
        await first.evaluate((el) => el.scrollIntoView({ block: "start" }));
        const f = (await first.boundingBox())!;
        expect(f.y + f.height, "first refused line reachable by scrolling").toBeLessThanOrEqual(limit);
      }

      await showKeyboard(page, false);
      await pasteTab(page, "e|--5--|\nB|--3--|\nG|--0--|\nD|-----|\nA|-----|\nE|-----|");
      await box.focus();
      await showKeyboard(page, true);
      await page.waitForTimeout(150);
      const ready = (await status.boundingBox())!;
      expect(ready.y + ready.height, "ready status above the keyboard").toBeLessThanOrEqual(limit);
    });

    test("the inspector's chord input and set button", async ({ page }) => {
      await stubKeyboard(page, size.keyboard);
      const world = await songWorld(page, 2);
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.goto(world.partUrl);
      await columns(page).first().click();
      await details(page).click();
      await expect(openDialog(page)).toHaveCount(1);
      const form = inspector(page).locator("form").first();
      const input = form.getByRole("textbox");
      await input.focus();
      await showKeyboard(page, true);
      await page.waitForTimeout(250);
      const limit = await kbTop(page, size.keyboard);
      const i = (await input.boundingBox())!;
      const set = (await form.getByRole("button", { name: "set" }).boundingBox())!;
      expect(i.y + i.height, "input above the keyboard").toBeLessThanOrEqual(limit);
      expect(set.y + set.height, "set button above the keyboard").toBeLessThanOrEqual(limit);
      expect(i.y, "input still on screen").toBeGreaterThanOrEqual(0);
    });
  });
}

type Insets = { top: number; right: number; bottom: number; left: number };

/** Every control's rect against the insets: the notch, the home bar, and in landscape the sides. */
async function insideInsets(page: Page, insets: Insets, where: string) {
  const bad = await page.evaluate((ins) => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const out: string[] = [];
    const sel = "a, button, input, select, textarea, [role=button], summary";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === "hidden") continue;
      if (r.bottom <= 0 || r.top >= h) continue;
      let fixed = false;
      let scrolled = false;
      for (let p: HTMLElement | null = el; p; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.position === "fixed" || cs.position === "sticky") fixed = true;
        // A control inside a scroller is cut by the scroller's edge, which sits inside the insets.
        if (p !== document.body && p !== document.documentElement && /(auto|scroll)/.test(cs.overflowX + cs.overflowY)) {
          if (p.scrollWidth > p.clientWidth || p.scrollHeight > p.clientHeight) scrolled = true;
        }
      }
      if (scrolled && !fixed) continue;
      const name = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30);
      if (r.top < ins.top - 0.5) out.push(`"${name}" top ${Math.round(r.top)} < ${ins.top}`);
      if (r.left < ins.left - 0.5) out.push(`"${name}" left ${Math.round(r.left)} < ${ins.left}`);
      if (r.right > w - ins.right + 0.5 && r.left < w) out.push(`"${name}" right ${Math.round(r.right)} > ${w - ins.right}`);
      if (fixed && r.bottom > h - ins.bottom + 0.5) out.push(`"${name}" bottom ${Math.round(r.bottom)} > ${h - ins.bottom}`);
    }
    return out;
  }, insets);
  return bad.map((b) => `${where}: ${b}`);
}

test("INV-013 nothing sits under a notch or the home bar", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  const world = await songWorld(page, 3);
  await page.goto(world.songUrl);
  await openTools(page);
  await page.getByLabel("Beats per minute").fill("120");
  await page.getByLabel("Beats per minute").blur();
  await page.goto(world.songUrl);
  await page.getByRole("link", { name: "Band" }).click();
  const bandUrl = page.url();

  const bad: string[] = [];
  const orientations: { name: string; size: { width: number; height: number }; insets: Insets }[] = [
    { name: "portrait", size: { width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } },
    { name: "landscape", size: { width: 844, height: 390 }, insets: { top: 0, bottom: 21, left: 47, right: 47 } },
  ];
  for (const o of orientations) {
    await page.setViewportSize(o.size);
    await safeArea(page, o.insets);
    const check = async (where: string) => bad.push(...(await insideInsets(page, o.insets, `${where} (${o.name})`)));
    await page.goto(world.partUrl);
    await expect(columns(page).first()).toBeVisible();
    await check("capture");
    await page.getByTestId("tempo-control").click();
    await expect(page.getByTestId("tap-pad")).toBeVisible();
    await check("capture, tempo sheet open");
    await page.keyboard.press("Escape");
    await page.goto(world.songUrl);
    await check("song page");
    await page.goto(world.playUrl);
    await expect(page.getByTestId("click-bar")).toBeVisible();
    await check("play view idle");
    const start = page.getByTestId("click-start");
    if (await start.isEnabled()) {
      await start.click();
      await expect(page.getByTestId("click-beat")).toBeVisible();
      await check("play view running");
      await page.getByTestId("click-stop").click();
    }
    await page.goto(bandUrl);
    await check("band's songs");
  }
  expect([...new Set(bad)], "controls inside the insets").toEqual([]);
});

const LONG = "A very long title that goes on and on and on and on and on, well past a phone's width, for good measure ok";

test("INV-023 long titles clamp to two lines and the chord hint fits", async ({ page, isMobile }) => {
  expect(LONG.length).toBeGreaterThanOrEqual(100);
  await page.goto("/");
  await page.getByLabel("Band name").fill(LONG);
  await page.getByRole("button", { name: "Add band" }).click();
  await expect(page).toHaveURL(/\/bands\/[0-9a-f-]+$/);
  const bandUrl = page.url();

  const clamp = (selector: string) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      const line = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.2;
      return { clamp: s.getPropertyValue("-webkit-line-clamp"), lines: Math.round(el.getBoundingClientRect().height / line) };
    });

  const sizes = isMobile
    ? [
        { width: 375, height: 667 },
        { width: 390, height: 844 },
      ]
    : [{ width: 1280, height: 800 }];

  await page.getByLabel("Song title").fill(LONG);
  await page.getByRole("button", { name: "Add song" }).click();
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+$/);
  const songUrl = page.url();

  for (const size of sizes) {
    await page.setViewportSize(size);
    const at = `${size.width}x${size.height}`;
    await page.goto(bandUrl);
    const bandTitle = await clamp("h1");
    expect(bandTitle.clamp, `band title @${at}`).toBe("2");
    expect(bandTitle.lines).toBeLessThanOrEqual(2);
    const row = await clamp("main ul li a p");
    expect(row.clamp, `band's songs row @${at}`).toBe("2");
    expect(row.lines).toBeLessThanOrEqual(2);
    await page.goto(songUrl);
    const songTitle = await clamp("h1");
    expect(songTitle.clamp, `song page @${at}`).toBe("2");
    expect(songTitle.lines).toBeLessThanOrEqual(2);
    await page.goto(`${songUrl}/play`);
    const play = await clamp("h1");
    expect(play.clamp, `play view @${at}`).toBe("2");
    expect(play.lines).toBeLessThanOrEqual(2);
  }

  // Capture alone cuts the title, and its back target stays at the floor.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${songUrl}/capture`);
  await page.getByRole("button", { name: "Add a part" }).click();
  await expect(page).toHaveURL(/\/capture\/[0-9a-f-]+$/);
  const back = (await page.getByTestId("capture-title-row").getByRole("button", { name: /^Back to / }).boundingBox())!;
  expect(back.height, "back target height").toBeGreaterThanOrEqual(isMobile ? 44 : 24);
  expect(back.width, `back target width ${await page.getByTestId("capture-title-row").getByRole("button", { name: /^Back to / }).evaluate((e) => getComputedStyle(e).minWidth + " " + e.className)}`).toBeGreaterThanOrEqual(isMobile ? 44 : 24);

  // The chord form's hint, at its computed size, fits its field.
  await page.getByTestId("toolbar-stable").getByRole("button", { name: /space/ }).click();
  await columns(page).first().click();
  await page.getByRole("button", { name: "chord symbol" }).click();
  const field = page.getByRole("textbox", { name: "Chord" });
  const fit = await field.evaluate((el) => {
    const input = el as HTMLInputElement;
    const s = getComputedStyle(input);
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const text = ctx.measureText(input.placeholder).width;
    const room = input.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    return { size: parseFloat(s.fontSize), text, room, scroll: input.scrollWidth <= input.clientWidth };
  });
  if (isMobile) expect(fit.size).toBeGreaterThanOrEqual(16);
  expect(fit.text, "hint width against room").toBeLessThanOrEqual(fit.room);
  expect(fit.scroll).toBe(true);
});

/** INV-024: a panel's state never reaches a song, the queue or the network. */
test("INV-024 panel state stays on the device", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  const world = await songWorld(page, 3);
  const requests: string[] = [];
  page.on("request", (r) => (r.method() !== "GET" || r.url().includes("/api/")) && requests.push(`${r.method()} ${r.url()}`));
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && /hydrat/i.test(m.text()) && errors.push(m.text()));

  const dump = () =>
    page.evaluate(async () => {
      const dbs = await indexedDB.databases();
      const out: Record<string, unknown[]> = {};
      for (const info of dbs) {
        const db = await new Promise<IDBDatabase>((res, rej) => {
          const r = indexedDB.open(info.name!);
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
        for (const name of Array.from(db.objectStoreNames)) {
          out[`${info.name}/${name}`] = await new Promise<unknown[]>((res) => {
            const r = db.transaction(name).objectStore(name).getAll();
            r.onsuccess = () => res(r.result);
          });
        }
        db.close();
      }
      return JSON.stringify(out);
    });

  await page.goto(world.songUrl);
  await expect(page.getByTestId("panel-song-tools")).toBeVisible();
  await page.waitForTimeout(500);
  const before = await dump();
  const mark = requests.length;
  for (let i = 0; i < 50; i++) await page.getByTestId("panel-song-tools").click();
  await page.getByTestId("panel-song-tools").click(); // 51 toggles: left open
  await expect(page.getByTestId("panel-song-tools")).toHaveAttribute("aria-expanded", "true");
  expect(await dump(), "no table changed").toBe(before);
  expect(requests.slice(mark), "no request").toEqual([]);

  await page.reload();
  await expect(page.getByTestId("panel-song-tools")).toHaveAttribute("aria-expanded", "true");
  const second = await page.context().newPage();
  await second.goto(world.songUrl);
  await expect(second.getByTestId("panel-song-tools")).toHaveAttribute("aria-expanded", "true");
  expect(errors, "no hydration error").toEqual([]);
});

const SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;

/** INV-025: Capture and Play view are in reach on touch, absent from the header-bar on a fine pointer, and the bar covers nothing. */
test("INV-025 main actions are under the thumb", async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  const world = await songWorld(page, 3);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await page.goto(world.songUrl);
    const bar = page.getByTestId("song-actions");
    if (!isMobile) {
      await expect(bar).toBeHidden();
      await expect(page.locator("main > header").getByRole("link", { name: "Capture" })).toBeVisible();
      await expect(page.locator("main > header").getByRole("link", { name: "Play view" })).toBeVisible();
      continue;
    }
    await expect(page.locator("main > header").getByRole("link", { name: "Capture" })).toBeHidden();
    // SC-010: the tab is on the first screen.
    for (const id of ["panel-song-tools", "panel-song-arrange"]) {
      const toggle = page.getByTestId(id);
      if ((await toggle.getAttribute("aria-expanded")) === "true") await toggle.click();
    }
    expect((await box(page.getByTestId("tab-staff").first())).y, "first staff y").toBeLessThanOrEqual(520);
    for (const where of ["top", "middle", "end"] as const) {
      await page.evaluate((w) => {
        const max = document.documentElement.scrollHeight - innerHeight;
        scrollTo(0, w === "top" ? 0 : w === "middle" ? max / 2 : max);
      }, where);
      for (const name of ["Capture", "Play view"]) {
        const b = await box(bar.getByRole("link", { name }));
        expect(b.y, `${name} at ${where}, ${size.width}`).toBeGreaterThanOrEqual(size.height / 2);
      }
    }
    const lastCard = await box(page.locator("li[id^=part-]").last());
    const barBox = await box(bar);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const after = await box(page.locator("li[id^=part-]").last());
    expect(after.y + after.h, "last card clears the bar").toBeLessThanOrEqual(barBox.y + 1);
    void lastCard;
  }
  await page.emulateMedia({ media: "print" });
  if (isMobile) await expect(page.getByTestId("song-actions")).toBeHidden();
});

async function setBpm(page: Page, songUrl: string, bpm: string) {
  await page.goto(songUrl);
  await openTools(page);
  await page.getByLabel("Beats per minute").fill(bpm);
  await page.getByLabel("Beats per minute").blur();
}

/** INV-026 and SC-010: the cluster is a thin bar, hides no message, covers no staff, and prints nothing. */
test("INV-026 the click cluster stays small and honest", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  test.setTimeout(240_000);
  const world = await songWorld(page, 3);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    await setBpm(page, world.songUrl, "");
    await page.goto(world.playUrl);
    const bar = page.getByTestId("click-bar");
    const state = page.getByTestId("click-state");
    await expect(bar).toBeVisible();
    // No tempo.
    await expect(state).toBeVisible();
    await expect(state).toHaveText("Set a tempo to use the click.");
    await setBpm(page, world.songUrl, "120");
    await page.goto(world.playUrl);
    await expect(page.getByTestId("click-start")).toBeEnabled();
    if ((await page.getByTestId("panel-play-cluster").getAttribute("aria-expanded")) === "true") await page.getByTestId("panel-play-cluster").click();
    // Idle, collapsed: one thin row, message for screen readers only.
    const idle = await box(bar);
    expect(idle.h, "idle height").toBeGreaterThanOrEqual(44);
    expect(idle.h, "idle height").toBeLessThanOrEqual(60);
    await expect(state).toHaveText(/Click (follows the notation|is a plain beat)\./);
    expect(await state.evaluate((el) => el.getBoundingClientRect().width <= 1 || el.className.includes("sr-only"))).toBe(true);
    // The first staff is near the top (SC-010).
    const staff = await box(page.locator("li.print-keep").first());
    expect(staff.y, "first staff y").toBeLessThanOrEqual(160);
    // Open: the message shows.
    await openCluster(page);
    await expect(state).toBeVisible();
    await expect(page.getByTestId("staff-view")).toBeVisible();
    // Running with sound: the message is visible even when collapsed.
    await page.getByTestId("click-start").click();
    await expect(page.getByTestId("click-stop")).toBeVisible();
    await expect(state).toBeVisible();
    await expect(page.getByTestId("click-help")).toBeVisible();
    // Stopped because the screen was hidden: the words stay up, collapsed.
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(state).toContainText("Stopped because the screen was hidden");
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    });
    // The last staff clears the bar at the end of the page.
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const last = await box(page.locator("li.print-keep").last());
    expect(last.y + last.h, "last staff clears the cluster").toBeLessThanOrEqual((await box(bar)).y + 1);
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("click-bar")).toBeHidden();
});
