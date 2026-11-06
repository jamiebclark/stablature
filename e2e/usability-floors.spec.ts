import { addRests, columns, selectColumns, startWith, TUNINGS, selectionBar } from "./probe-helpers";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { details, inspector, openDialog } from "./capture-surface-helpers";
import { FLOORS, SENTENCE_LINKS, TARGETS, targets } from "./usability-helpers";
import { songWorld } from "./usability-world";
import { startCapturing } from "./capture-surface-helpers";

test.setTimeout(120_000);

/**
 * INV-010: no input makes the browser zoom on focus, the page can be pinch-zoomed, and touch-action is
 * set where a tap must not wait for a double-tap. Touch only: a mouse reads the 14px field.
 */
test("INV-010 inputs are 16px on touch, zoom is allowed, touch-action is set", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");

  await page.goto("/");
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/maximum-scale|user-scalable/);

  const sizes = async (label: string) =>
    page.evaluate(
      (sel) =>
        Array.from(document.querySelectorAll<HTMLElement>(sel)).map((el) => ({
          name: el.getAttribute("aria-label") ?? el.getAttribute("name") ?? el.tagName,
          size: parseFloat(getComputedStyle(el).fontSize),
        })),
      label,
    );
  for (const s of await sizes("input, select, textarea")) {
    expect(s.size, `home: ${s.name}`).toBeGreaterThanOrEqual(16);
  }

  // An ad-hoc contenteditable gets no field rule, so it is not the app's to cover; the app has none.
  const { partUrl } = await startCapturing(page);
  for (const s of await sizes("input, select, textarea, [contenteditable]")) {
    expect(s.size, `capture: ${s.name}`).toBeGreaterThanOrEqual(16);
  }
  const ta = (testId: string | null, sel: string) =>
    page.locator(sel).first().evaluate((el) => getComputedStyle(el).touchAction);
  expect(await ta(null, 'button[aria-label*="string, fret"]')).toBe("manipulation");
  expect(await ta(null, '[data-testid="toolbar-stable"] button')).toBe("manipulation");
  expect(partUrl).toBeTruthy();
});

test("INV-007 the rows fit at 375 and their controls are one height", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.setViewportSize({ width: 375, height: 667 });
  await startWith(page, TUNINGS[1]);
  await addRests(page, 16);
  for (const id of ["toolbar-stable", "toolbar-contextual", "toolbar-reserved"]) {
    const row = page.getByTestId(id);
    if (!(await row.count())) continue;
    const fit = await row.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(fit, id).toBe(true);
  }
  await selectColumns(page, 0, 15);
  const bar = selectionBar(page);
  const r = await bar.evaluate((el) => ({
    fit: el.scrollWidth <= el.clientWidth,
    h: [...el.children].map((c) => Math.round(c.getBoundingClientRect().height)),
    narrow: [...el.children].filter((c) => c.scrollWidth > c.clientWidth).length,
  }));
  expect(r.fit).toBe(true);
  expect(new Set(r.h).size, "all one height").toBe(1);
  expect(r.narrow).toBe(0);
});

// ---- US2: size floors, gaps, cues, the long-press sheet ----------------------------------------------------

type Entry = Awaited<ReturnType<typeof targets>>[number];

/** The floor a target is held to. Staff columns are excluded from the counts, so `null`. */
function floorOf(t: Entry, inRow: string | null, touch: boolean): { w: number; h: number } | null {
  const col = touch ? "touch" : "mouse";
  const f = (k: keyof typeof FLOORS) => FLOORS[k][col];
  if (t.testId && /^tab-/.test(t.testId)) return null;
  if (/^Dead note on/.test(t.name)) return f("deadNoteCell");
  if (/string, fret/.test(t.name)) return /dead|muted/i.test(t.name) ? f("deadNoteCell") : f("fretCell");
  if (inRow === "latch-strip") return f("latchChip");
  if (/^⇤ start$|^end ⇥$/.test(t.name)) return f("jump");
  if (/one (fewer|more)/i.test(t.name)) return f("stepperHalf");
  if (inRow === "toolbar-selection") return { ...f("toolbarControl"), w: f("bracketControl").w };
  if (inRow === "capture-title-row" && /^[A-Z]$/.test(t.name)) return f("partChip");
  if (inRow === "capture-title-row" && /^←/.test(t.name)) return f("backToSong");
  return f("everythingElse");
}

async function walk(page: Page, touch: boolean, where: string) {
  const all = await page.evaluate((sel) => {
    const ids = ["latch-strip", "toolbar-selection", "capture-title-row"];
    return Array.from(document.querySelectorAll<HTMLElement>(sel))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          name: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40),
          testId: el.getAttribute("data-testid"),
          w: r.width,
          h: r.height,
          labelled: (el.textContent ?? "").trim().length > 0,
          inSentence: el.tagName === "A" && el.parentElement?.tagName === "P",
          row: ids.find((id) => el.closest(`[data-testid="${id}"]`)) ?? null,
        };
      });
  }, TARGETS);
  const bad: string[] = [];
  for (const t of all) {
    if (t.inSentence && SENTENCE_LINKS.some((s) => s.text === t.name)) continue;
    const floor = floorOf(t, t.row, touch);
    if (!floor) continue;
    // "44 wide or as wide as its label": a control with a text label may be as wide as the label, but never under 24.
    const wide = t.w >= floor.w - 0.5 || (t.labelled && t.w >= 24);
    if (t.h < floor.h - 0.5 || !wide)
      bad.push(`${where}: ${t.tag} "${t.name}" ${Math.round(t.w)}x${Math.round(t.h)} < ${floor.w}x${floor.h}`);
  }
  return bad;
}

const SIZES = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
] as const;

test("INV-006 every target meets its floor on every screen", async ({ page, isMobile }) => {
  test.setTimeout(240_000);
  const sizes = isMobile ? SIZES : [{ width: 1280, height: 800 }];
  const world = await songWorld(page);
  const bad: string[] = [];
  for (const size of sizes) {
    await page.setViewportSize(size);
    const at = `${size.width}x${size.height}`;
    const visit = async (url: string, where: string, prep?: () => Promise<void>) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");
      if (prep) await prep();
      bad.push(...(await walk(page, isMobile, `${where} @${at}`)));
    };
    await visit("/", "bands");
    await visit(world.songUrl, "song page");
    await visit(world.songUrl, "song page, entry selected", async () => {
      await page.getByTestId("roadmap-chip").first().click();
    });
    await visit(world.songUrl, "paste panel", async () => {
      await page.getByRole("button", { name: "Paste tab" }).first().click();
    });
    await visit(world.playUrl, "play view");
    await visit(world.partUrl, "capture");
    await page.getByTestId("tab-column").first().click();
    bad.push(...(await walk(page, isMobile, `capture, column marked @${at}`)));
    await visit("/sign-in", "sign in");
    await visit("/sign-up", "sign up");
    await visit("/privacy", "privacy");
    await visit("/terms", "terms");
  }
  expect([...new Set(bad)], "targets under their floor").toEqual([]);

  // Every named sentence link exists, so the exemption list cannot rot into exempting nothing.
  for (const link of SENTENCE_LINKS) {
    await page.goto(link.page);
    await expect(page.locator("p a", { hasText: link.text }).first(), `${link.page} ${link.text}`).toBeVisible();
  }
});

type Rect = { x: number; y: number; width: number; height: number };
const gap = (a: Rect, b: Rect) =>
  Math.max(b.x - (a.x + a.width), a.x - (b.x + b.width), b.y - (a.y + a.height), a.y - (b.y + b.height));

/** The smallest gap from `target` to any other control in its own row, or Infinity. A row below is not a neighbour. */
async function nearestGap(page: Page, target: Locator): Promise<number> {
  const t = await target.boundingBox();
  if (!t) throw new Error("not rendered");
  const handle = await target.elementHandle();
  const others = await page.evaluate(
    ({ el, sel }) => {
      const mine = (el as HTMLElement).getBoundingClientRect();
      // Under a modal sheet the page is still in the DOM, but it is not a neighbour.
      const dlg = (el as HTMLElement).closest("dialog");
      return Array.from(document.querySelectorAll<HTMLElement>(sel))
        .filter((o) => o !== el && !o.contains(el as Node) && !(el as HTMLElement).contains(o))
        .filter((o) => !dlg || dlg.contains(o))
        .map((o) => o.getBoundingClientRect())
        .filter((r) => r.width > 0 && r.height > 0)
        .filter((r) => r.top < mine.bottom && r.bottom > mine.top)
        .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
    },
    { el: handle, sel: TARGETS },
  );
  const near = others.filter((o) => gap(t, o) < 40);
  return near.length ? Math.min(...near.map((o) => gap(t, o))) : Infinity;
}

test("INV-008 destructive controls keep 8px from every neighbour", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  test.setTimeout(180_000);
  const world = await songWorld(page);
  for (const size of SIZES) {
    await page.setViewportSize(size);
    const at = `${size.width}x${size.height}`;
    await page.goto(world.partUrl);
    await expect(columns(page).first()).toBeVisible();
    const del = page.getByRole("button", { name: /^Delete the (last|marked) column$/ });
    expect(await nearestGap(page, del), `stable-row delete @${at}`).toBeGreaterThanOrEqual(8);
    await columns(page).first().click();
    expect(await nearestGap(page, del), `delete with a column marked @${at}`).toBeGreaterThanOrEqual(8);
    await details(page).click();
    await expect(openDialog(page)).toHaveCount(1);
    const sheetDelete = inspector(page).getByRole("button", { name: /delete/i });
    if (await sheetDelete.count()) {
      expect(await nearestGap(page, sheetDelete.first()), `inspector delete @${at}`).toBeGreaterThanOrEqual(8);
    }
    await inspector(page).getByRole("button", { name: "close" }).click();
    await page.goto(world.songUrl);
    await page.getByTestId("roadmap-chip").first().click();
    const remove = page.getByRole("button", { name: "Remove" });
    expect(await nearestGap(page, remove), `arrangement Remove @${at}`).toBeGreaterThanOrEqual(8);
    const partDelete = page.getByRole("button", { name: /^Delete/ }).first();
    if (await partDelete.count()) {
      expect(await nearestGap(page, partDelete), `part Delete @${at}`).toBeGreaterThanOrEqual(8);
    }
  }
});

test("INV-009 a cue is a button you can reach by keyboard", async ({ page, isMobile }) => {
  const world = await songWorld(page);
  await page.goto(world.songUrl);
  const cue = page.getByRole("button", { name: "build slowly" });
  await expect(cue, `${isMobile ? "coarse" : "fine"}: a cue is a button`).toBeVisible();
  await cue.focus();
  await page.keyboard.press("Enter");
  // Selecting an entry opens its controls, which include Done.
  await expect(page.getByRole("button", { name: "Done" })).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await page.locator("body").click({ position: { x: 1, y: 1 } });
  let reached = false;
  for (let i = 0; i < 80 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.textContent?.trim() === "build slowly");
  }
  expect(reached, "tabbing reaches the cue").toBe(true);
});

test("INV-012 every action in the sheet is reachable with taps alone", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  test.setTimeout(180_000);
  const world = await songWorld(page, 3);
  await page.goto(world.partUrl);
  await expect(columns(page).first()).toBeVisible();

  const reachable = async () => {
    await details(page).click();
    if (!(await openDialog(page).count())) return { open: false, unreachable: ["sheet"] };
    const buttons = inspector(page).getByRole("button");
    const n = await buttons.count();
    const unreachable: string[] = [];
    for (let i = 0; i < n; i++) {
      const b = buttons.nth(i);
      await b.scrollIntoViewIfNeeded();
      const box = await b.boundingBox();
      if (!box || box.y < 0 || box.y + box.height > page.viewportSize()!.height) unreachable.push(await b.innerText());
    }
    await inspector(page).getByRole("button", { name: "close" }).click();
    return { open: true, unreachable };
  };

  const kinds: { name: string; prep: () => Promise<void> }[] = [
    { name: "rest", prep: async () => void (await columns(page).first().click()) },
    {
      name: "note",
      prep: async () => {
        await page.getByRole("button", { name: /string, fret 3,/ }).first().click();
        await columns(page).last().click();
      },
    },
    {
      name: "barline",
      prep: async () => {
        await page.getByRole("button", { name: "Barline" }).click();
        await columns(page).last().click();
      },
    },
    {
      name: "repeat",
      prep: async () => void (await page.getByRole("button", { name: "Repeat one more time" }).click()),
    },
  ];
  for (const k of kinds) {
    await k.prep();
    const r = await reachable();
    expect(r.open, `${k.name}: the details button opens the sheet`).toBe(true);
    expect(r.unreachable, `${k.name}: every action reachable`).toEqual([]);
  }

  // Control: with the details button hidden the sheet cannot be opened, so `reachable` would report it.
  await page.addStyleTag({ content: '[aria-label="Open column details"]{display:none !important}' });
  await expect(details(page)).toBeHidden();
});
