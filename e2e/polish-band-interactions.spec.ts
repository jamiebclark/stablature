import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";
import { blur, longPart } from "./polish-long-part";
import { addChord, caret, columns, space, startCapturing, startWith, storedRows, touchHold, triplet, TUNINGS } from "./probe-helpers";

/**
 * Spec 008 US1, the interaction invariants of the wrapped capture band:
 * INV-004 (stills never move the band), INV-006 (every row stays on its column on every line),
 * INV-007 (one-line and wrapped staffs give the same results). Production build only.
 */
test.setTimeout(300_000);

const SIX = TUNINGS[2];
const WRAPPED = { width: 412, height: 915 };
const ONE_LINE = { width: 375, height: 667 };

async function part(page: Page, size: { width: number; height: number }, bars: number) {
  await startWith(page, SIX);
  await space(page);
  await addChord(page, 0, "Am");
  await page.setViewportSize(size);
  const barline = page.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" });
  for (let bar = 0; bar < bars; bar++) {
    for (let i = 0; i < (bar === 0 ? 2 : 3); i++) await space(page);
    await barline.click();
  }
  await expect(columns(page).last()).toBeVisible();
}

const bandState = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      scrollTop: band.scrollTop,
      tops: [...band.querySelectorAll<HTMLElement>(".tab-bar-run")].map((r) => r.getBoundingClientRect().top),
    };
  });

const near = (a: number[], b: number[]) => {
  expect(a.length).toBe(b.length);
  a.forEach((v, i) => expect(Math.abs(v - b[i])).toBeLessThanOrEqual(1));
};

test("INV-004 a still never moves the band", async ({ page }) => {
  await part(page, WRAPPED, 16);
  const base = await bandState(page);
  expect(base.wrapped).toBe(true);
  const settle = async () => {
    await page.waitForTimeout(250);
    const now = await bandState(page);
    expect(Math.abs(now.scrollTop - base.scrollTop)).toBeLessThanOrEqual(1);
    near(now.tops, base.tops);
  };
  const cols = columns(page);
  const visible = await cols.evaluateAll((els) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    return els
      .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.top >= band.top && r.bottom <= band.bottom)
      .map(({ i, r }) => ({ i, top: r.top }));
  });
  const tops = [...new Set(visible.map((v) => Math.round(v.top)))].sort((a, b) => a - b);
  for (const top of [tops[0], tops[tops.length - 1]]) {
    await cols.nth(visible.find((v) => Math.round(v.top) === top)!.i).click();
    await settle();
  }
  await page.getByRole("button", { name: "select" }).click();
  await cols.nth(visible[visible.length - 1].i).click();
  await settle();
  await page.getByRole("button", { name: "cancel" }).click();
  await settle();
  await touchHold(page, cols.nth(visible[0].i)).catch(() => undefined);
  await page.keyboard.press("Escape");
  await settle();
});

/**
 * INV-004: a sync arrival (a change this device did not make) never moves the band, however long after a trigger.
 * Page B, a second tab on the same origin, writes through the app, so A's live query delivers a change A did not
 * make. The members sit at the end of the part, where the swiped-to-top position differs from the anchor; at the
 * start or mid-part the swiped position is where line 1 or 2 anchors anyway, so "held" there is not evidence.
 * A trigger whose write changes neither the columns nor the cursor (a jump to where the cursor already is, a chord
 * symbol), or only one of them (x4, repeat, triplet), must not leave a request outstanding for the next arrival.
 */
interface SyncCase {
  name: string;
  act: (page: Page) => Promise<void>;
}
const jumpTo = (page: Page, which: "start" | "end") =>
  page.getByTestId("status-row").getByRole("button", { name: which === "start" ? "⇤ start" : "end ⇥" });
const press = (k: string) => async (page: Page) => {
  await blur(page);
  await page.keyboard.press(k);
};
const chordAtEnd = (symbol: string) => async (p: Page) => {
  await p.getByRole("button", { name: "chord symbol" }).click();
  await p.getByRole("textbox", { name: "Chord" }).fill(symbol);
  await p.waitForTimeout(400);
  await p.getByRole("button", { name: "Set" }).click();
};
const SYNC_CASES: SyncCase[] = [
  { name: "fret tap (control: its write moves the cursor)", act: (p) => fretButton(p).click() },
  { name: "end jump, already at the end", act: (p) => jumpTo(p, "end").click() },
  { name: "End key, already at the end", act: press("End") },
  { name: "ArrowRight, already at the end", act: press("ArrowRight") },
  { name: "×4 at the end", act: (p) => p.getByTitle("Four of these").click() },
  { name: "repeat + at the end", act: (p) => p.getByRole("button", { name: "Repeat one more time" }).click() },
  { name: "triplet at the end", act: (p) => triplet(p).click() },
  { name: "chord symbol set at the end", act: chordAtEnd("Dsus4") },
];
const SYNC_CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bars: 16, label: "412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bars: 40, label: "1280x800 fine, 40 bars" },
];
const look = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const top = band.getBoundingClientRect().top;
    const cols = [...document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')];
    const first = cols.find((c) => c.getBoundingClientRect().bottom > top + 1)!;
    return {
      wrapped: !!band.querySelector(".tab-staff-wrapped"),
      overflows: band.scrollHeight > band.clientHeight + 1,
      scrollTop: Math.round(band.scrollTop),
      firstTop: Math.round(first.getBoundingClientRect().top),
      firstIndex: cols.indexOf(first),
      count: cols.length,
    };
  });
const swipeToTop = (page: Page) =>
  page.evaluate(() => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    band.scrollTop = -(band.scrollHeight - band.clientHeight);
  });
const movedBy = (a: Awaited<ReturnType<typeof look>>, b: Awaited<ReturnType<typeof look>>) =>
  Math.abs(a.scrollTop - b.scrollTop) > 1 || Math.abs(a.firstTop - b.firstTop) > 1;

for (const config of SYNC_CONFIGS) {
  test(`INV-004 a sync arrival after each trigger does not move the band (${config.label})`, async ({ page }, info) => {
    test.skip(info.project.name !== config.project, `runs on ${config.project}`);
    const { partUrl } = await longPart(page, { chord: true, bracket: true, bars: config.bars, size: config.size });
    const other = await page.context().newPage();
    await other.setViewportSize({ width: 412, height: 915 });
    await other.goto(partUrl);
    await expect(columns(other).first()).toBeVisible();
    await other.waitForTimeout(500);
    const moves: string[] = [];
    for (const c of SYNC_CASES) {
      await page.bringToFront();
      // A fresh open puts A at the end with nothing outstanding.
      await page.goto(partUrl);
      await expect(columns(page).first()).toBeVisible();
      await page.waitForTimeout(800);
      await c.act(page);
      await page.waitForTimeout(1500);
      await swipeToTop(page);
      await page.waitForTimeout(400);
      const before = await look(page);
      expect(before.wrapped && before.overflows, `${c.name}: the part must overflow a wrapped band`).toBe(true);
      await fretButton(other).click();
      await expect.poll(async () => (await look(page)).count, { timeout: 5000 }).toBe(before.count + 1);
      await page.waitForTimeout(800);
      const after = await look(page);
      if (movedBy(before, after)) moves.push(`${c.name}: scrollTop ${before.scrollTop} -> ${after.scrollTop}, first column #${before.firstIndex} top ${before.firstTop} -> ${after.firstTop}`);
    }
    expect(moves, moves.join("\n")).toEqual([]);
  });
}

test("INV-004 a sync arrival through the server after a no-op End key does not move the band (412x915)", async ({ browser }, info) => {
  test.skip(info.project.name !== "mobile", "runs on mobile");
  test.skip(!process.env.STABLATURE_DATABASE_URL, "STABLATURE_DATABASE_URL is not set");
  const id = randomUUID().slice(0, 8);
  const who = { email: `tester-${id}@example.test`, password: "practice-space-5" };
  const a = await (await browser.newContext({ viewport: WRAPPED, hasTouch: true, isMobile: true })).newPage();
  await a.goto("/sign-up");
  await a.getByLabel("Name").fill(`Tester ${id}`);
  await a.getByLabel("Email").fill(who.email);
  await a.getByLabel("Password").fill(who.password);
  await a.getByRole("button", { name: "Create account" }).click();
  await expect(a).toHaveURL(/\/$/);
  const { partUrl } = await startCapturing(a, `Band ${id}`);
  await a.setViewportSize(WRAPPED);
  const barline = a.getByTestId("toolbar-stable").getByRole("button", { name: "Barline" });
  for (let bar = 0; bar < 24; bar++) {
    for (let i = 0; i < 3; i++) await space(a);
    await barline.click();
  }
  const total = 24 * 4;
  await expect(columns(a)).toHaveCount(total);
  await expect(a.getByText(/unsynced/)).toHaveCount(0, { timeout: 30_000 });
  const b = await (await browser.newContext({ viewport: WRAPPED })).newPage();
  await b.goto("/sign-in");
  await b.getByLabel("Email").fill(who.email);
  await b.getByLabel("Password").fill(who.password);
  await b.getByRole("button", { name: "Sign in" }).click();
  await expect(b).toHaveURL(/\/$/);
  await b.goto(partUrl);
  await expect(columns(b)).toHaveCount(total, { timeout: 30_000 });
  await a.bringToFront();
  await jumpTo(a, "end").click();
  await a.waitForTimeout(800);
  await blur(a);
  await a.keyboard.press("End");
  await a.waitForTimeout(1500);
  await swipeToTop(a);
  await a.waitForTimeout(400);
  const before = await look(a);
  expect(before.wrapped && before.overflows, "the part must overflow a wrapped band").toBe(true);
  await b.bringToFront();
  await fretButton(b).click();
  await expect.poll(async () => (await look(a)).count, { timeout: 30_000 }).toBe(total + 1);
  await a.waitForTimeout(800);
  const after = await look(a);
  expect(movedBy(before, after), `scrollTop ${before.scrollTop} -> ${after.scrollTop}`).toBe(false);
});

test("INV-006 every row sits on its column on every line, and the caret follows its column's run", async ({ page }) => {
  await part(page, WRAPPED, 16);
  const cols = columns(page);
  const check = () =>
    page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      const c = band.querySelector<HTMLElement>('[data-testid="tab-caret"]');
      const bad: string[] = [];
      const runOf = (el: Element) => el.closest(".tab-bar-run");
      const active = [...band.querySelectorAll<HTMLElement>('[data-testid="tab-column"][aria-current="true"]')];
      if (c) {
        const prev = active[0] ?? null;
        if (prev) {
          if (runOf(c) !== runOf(prev)) bad.push("caret not in its column's run");
          const r = c.getBoundingClientRect();
          const pr = prev.getBoundingClientRect();
          if (Math.abs(r.right - pr.right) > pr.width) bad.push("caret off its column");
        } else if (runOf(c) !== band.querySelector(".tab-bar-run")) bad.push("start caret not in the first run");
      }
      for (const b of band.querySelectorAll<HTMLElement>('[data-testid="tab-bracket"]')) {
        const rr = runOf(b)?.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        if (rr && (br.top < rr.top - 1 || br.bottom > rr.bottom + 1)) bad.push("bracket outside its run");
      }
      for (const col of band.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')) {
        const cr = col.getBoundingClientRect();
        const rr = runOf(col)!.getBoundingClientRect();
        if (cr.top < rr.top - 1 || cr.bottom > rr.bottom + 1) bad.push("column outside its run");
      }
      return bad;
    });
  const lastOfLine = await cols.evaluateAll((els) =>
    els.findIndex((e, i) => els[i + 1] && els[i + 1].closest(".tab-bar-run") !== e.closest(".tab-bar-run")),
  );
  await page.getByRole("button", { name: /start/ }).click();
  await page.waitForTimeout(300);
  expect(await check()).toEqual([]);
  for (const i of [0, 1, lastOfLine, lastOfLine + 1, 30, (await cols.count()) - 1]) {
    await cols.nth(i).click();
    await page.waitForTimeout(250);
    expect(await check(), `after column ${i}`).toEqual([]);
  }
  await page.getByRole("button", { name: "select" }).click();
  await cols.nth(Math.min(lastOfLine + 3, (await cols.count()) - 1)).click();
  expect(await check()).toEqual([]);
  // A selection hides the caret; cancelling brings it back, in its column's run.
  await expect(caret(page)).toHaveCount(0);
  await page.getByRole("button", { name: "cancel" }).click();
  await expect(caret(page)).toHaveCount(1);
  expect(await check()).toEqual([]);
});

/** A scripted sequence; returns what must be equal wrapped and on one line. */
async function script(page: Page) {
  const cols = columns(page);
  await cols.nth(2).click();
  await page.getByRole("button", { name: /^select$/ }).click();
  await cols.nth(8).click();
  const selected = await page.locator('[data-testid="tab-column"][data-selected="true"]').count();
  await page.getByRole("button", { name: /^Make a tuplet of \d+$/ }).first().click({ timeout: 1500 }).catch(() => undefined);
  await page.getByRole("button", { name: "Ungroup", exact: true }).click({ timeout: 1500 }).catch(() => undefined);
  await page.getByRole("button", { name: "cancel" }).click({ timeout: 1500 }).catch(() => undefined);
  await cols.nth(0).click();
  await touchHold(page, cols.nth(0)).catch(() => undefined);
  await page.keyboard.press("Escape");
  await cols.last().click();
  await touchHold(page, cols.last()).catch(() => undefined);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /end/ }).click();
  await space(page);
  const rows = (await storedRows(page)).map((r) => ({ kind: r.kind, frets: r.frets, techniques: r.techniques, repeat: r.repeat }));
  const title = await page.getByTestId("column-inspector").getAttribute("aria-label", { timeout: 1500 }).catch(() => null);
  return { rows, selected, title, count: await cols.count() };
}

test("INV-007 one scripted sequence gives the same result wrapped and on one line", async ({ browser }) => {
  const run = async (size: { width: number; height: number }) => {
    const page = await (await browser.newContext({ viewport: size, hasTouch: true })).newPage();
    await part(page, size, 8);
    const wrapped = (await bandState(page)).wrapped;
    return { wrapped, result: await script(page) };
  };
  const one = await run(ONE_LINE);
  const wide = await run(WRAPPED);
  expect(one.wrapped).toBe(false);
  expect(wide.wrapped).toBe(true);
  expect(wide.result).toEqual(one.result);
});

const LONG = { width: 412, height: 915 };
const fretButton = (page: Page) => page.locator('button[aria-label*=" string, fret 3,"]').first();
const jump = (page: Page, which: "start" | "end") =>
  page.getByTestId("status-row").getByRole("button", { name: which === "start" ? "⇤ start" : "end ⇥" });

/** The index and centre of a column on the top (or bottom) line wholly in view. */
const pickColumn = (page: Page, where: "top" | "bottom") =>
  columns(page).evaluateAll((els, where) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const seen = els
      .map((e, i) => ({ i, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.top >= band.top - 0.5 && r.bottom <= band.bottom + 0.5 && r.left >= band.left && r.right <= band.right);
    const tops = [...new Set(seen.map((s) => Math.round(s.r.top)))].sort((a, b) => a - b);
    const top = where === "top" ? tops[0] : tops[tops.length - 1];
    const pick = seen.filter((s) => Math.round(s.r.top) === top)[1] ?? seen.find((s) => Math.round(s.r.top) === top)!;
    return { i: pick.i, x: pick.r.left + pick.r.width / 2, y: pick.r.top + pick.r.height / 2, top: pick.r.top };
  }, where);

const columnTop = (page: Page, i: number) => columns(page).nth(i).evaluate((e) => e.getBoundingClientRect().top);
const scrollTop = (page: Page) => page.evaluate(() => document.querySelector<HTMLElement>('[data-testid="tab-band"]')!.scrollTop);

const TRIGGERS: [string, (p: Page) => Promise<void>][] = [
  ["a fret tap", (p) => fretButton(p).click()],
  ["the end jump", (p) => jump(p, "end").click()],
  ["ArrowLeft", async (p) => { await blur(p); await p.keyboard.press("ArrowLeft"); }],
];

test("INV-004 a tap soon after a trigger does not move the band under the finger", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  await longPart(page, { chord: true, bracket: true, bars: 16, size: LONG });
  const moved: string[] = [];
  const report: string[] = [];
  for (const [name, trigger] of TRIGGERS) {
    for (const delay of [150, 900]) {
      await jump(page, "end").click();
      await page.waitForTimeout(800);
      await trigger(page);
      await page.waitForTimeout(delay);
      const target = await pickColumn(page, "top");
      const before = { top: target.top, scroll: await scrollTop(page) };
      const t0 = Date.now();
      await page.touchscreen.tap(target.x, target.y);
      const gap = Date.now() - t0;
      await page.waitForTimeout(700);
      const after = { top: await columnTop(page, target.i), scroll: await scrollTop(page) };
      const line = `${name}, then a tap on the top line ${delay}ms later (tap took ${gap}ms): column moved ${(after.top - before.top).toFixed(1)}px, scrollTop ${before.scroll} -> ${after.scroll}`;
      report.push(line);
      if (Math.abs(after.top - before.top) > 1) moved.push(line);
    }
  }
  for (const r of report) console.log(`  ${r}`);
  expect(moved).toEqual([]);
});

test("INV-004 stills the implementation's spec does not cover", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "touch");
  // A bracket already in the part, so grouping or ungrouping a run adds or removes no row (that would reflow every line).
  await longPart(page, { chord: true, bracket: true, bars: 16, size: LONG });
  // The part's first duration adds the capture rhythm row (every run grows), so make it here and settle; the measured write is then an ordinary one.
  await columns(page).nth(1).click();
  await page.waitForTimeout(800);
  await touchHold(page, columns(page).nth(1));
  await page.getByTestId("column-inspector").getByRole("button", { name: "quarter note", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  const moved: string[] = [];
  const state = () =>
    page.evaluate(() => {
      const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
      return { scroll: band.scrollTop, tops: [...band.querySelectorAll(".tab-bar-run")].map((r) => r.getBoundingClientRect().top) };
    });
  const same = (a: { scroll: number; tops: number[] }, b: { scroll: number; tops: number[] }) =>
    Math.abs(a.scroll - b.scroll) <= 1 && a.tops.length === b.tops.length && a.tops.every((t, i) => Math.abs(t - b.tops[i]) <= 1);
  // `ungroup` must select what `group from a selection` grouped on the same line; with a duration in the part pickColumn lands elsewhere.
  const grouped: Record<string, number> = {};
  const ungrouped = new Set<number>();
  const STILLS: [string, (p: Page, i: number) => Promise<void>][] = [
    ["copy", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByTitle("Copy").click({ timeout: 5000 }); }],
    ["group from a selection", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByRole("button", { name: "Group with no number", exact: true }).click({ timeout: 5000 }); }],
    ["ungroup", async (p, i) => { await columns(p).nth(i).click(); await p.getByRole("button", { name: /^select$/ }).click(); await columns(p).nth(i + 1).click(); await p.getByTestId("toolbar-selection").getByRole("button", { name: "Ungroup", exact: true }).click({ timeout: 5000 }); }],
    ["a latch toggle", async (p) => { await p.getByTestId("latch-strip").getByRole("button").first().click(); }],
    ["the help overlay", async (p) => { await blur(p); await p.keyboard.press("?"); await p.waitForTimeout(300); await p.keyboard.press("Escape"); }],
    ["an inspector write", async (p, i) => { await touchHold(p, columns(p).nth(i)); await p.getByTestId("column-inspector").getByRole("button", { name: /dead|ghost|x/i }).first().click(); await p.keyboard.press("Escape"); }],
  ];
  for (const [name, still] of STILLS) {
    for (const where of ["top", "bottom"] as const) {
      await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 300 }).catch(() => undefined);
      await page.waitForTimeout(800);
      const target = await pickColumn(page, where);
      // Settle any tap used to reach the column, then measure across the still alone.
      await columns(page).nth(target.i).click();
      await page.waitForTimeout(800);
      const at = name === "ungroup" ? (grouped[where] ?? target.i) : target.i;
      // When one line is all that is in view, top and bottom pick the same columns; the first ungroup took the bracket, so put it back (unmeasured).
      if (name === "ungroup" && ungrouped.has(at)) {
        await STILLS[1][1](page, at);
        await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
        await page.waitForTimeout(800);
      }
      const before = await state();
      try {
        await still(page, at);
        if (name === "ungroup") ungrouped.add(at);
        if (name === "group from a selection") grouped[where] = target.i;
      } catch (error) {
        moved.push(`${name} (${where}): could not run: ${String(error).split("\n")[0].slice(0, 120)}`);
        continue;
      }
      await page.waitForTimeout(800);
      const after = await state();
      if (!same(before, after)) moved.push(`${name} (${where} line): scrollTop ${before.scroll} -> ${after.scroll}`);
    }
  }
  for (const m of moved) console.log(`  MOVED ${m}`);
  expect(moved).toEqual([]);
});

/** INV-004 regression guard: a tap on the top line in view, after the band is swiped away, never moves the band. */
const TAP_CONFIGS = [
  { project: "mobile", size: { width: 412, height: 915 }, bracket: true, label: "412x915 coarse" },
  { project: "desktop", size: { width: 1280, height: 800 }, bracket: true, label: "1280x800 fine" },
  { project: "mobile", size: { width: 390, height: 844 }, bracket: false, label: "390x844 coarse, no bracket" },
];
const tapState = (page: Page, index: number) =>
  page.evaluate((index) => {
    const band = document.querySelector<HTMLElement>('[data-testid="tab-band"]')!;
    const col = document.querySelectorAll<HTMLElement>('[data-testid="tab-column"]')[index];
    return { scrollTop: Math.round(band.scrollTop), colTop: Math.round(col.getBoundingClientRect().top) };
  }, index);
const topLineColumn = (page: Page) =>
  columns(page).evaluateAll((els) => {
    const band = document.querySelector('[data-testid="tab-band"]')!.getBoundingClientRect();
    const seen = els.map((e, i) => ({ i, r: e.getBoundingClientRect() })).filter(({ r }) => r.top >= band.top && r.bottom <= band.bottom);
    const first = Math.min(...seen.map((x) => x.r.top));
    return seen.filter((x) => x.r.top === first)[1]?.i ?? seen[0].i;
  });

for (const config of TAP_CONFIGS)
  for (const prep of ["none", "copy"] as const) {
    test(`INV-004 a tap on the top line after a swipe does not move the band (${config.label}, prep: ${prep})`, async ({ page }, info) => {
      test.skip(info.project.name !== config.project, `runs on ${config.project}`);
      await longPart(page, { chord: true, bracket: config.bracket, bars: 16, size: config.size });
      if (prep === "copy") {
        await columns(page).nth(5).click();
        await page.getByRole("button", { name: /^select$/ }).click();
        await columns(page).nth(6).click();
        await page.getByTestId("toolbar-selection").getByTitle("Copy").click();
        await page.getByTestId("toolbar-selection").getByRole("button", { name: "cancel" }).click({ timeout: 1000 }).catch(() => undefined);
        await page.waitForTimeout(650);
      }
      const moves: string[] = [];
      for (const from of ["end", "mid"] as const) {
        if (from === "end") await jumpTo(page, "end").click();
        else await columns(page).nth(20).click();
        await page.waitForTimeout(700);
        await swipeToTop(page);
        await page.waitForTimeout(300);
        const index = await topLineColumn(page);
        const before = await tapState(page, index);
        await columns(page).nth(index).click();
        await page.waitForTimeout(900);
        const after = await tapState(page, index);
        if (Math.abs(after.scrollTop - before.scrollTop) > 1 || Math.abs(after.colTop - before.colTop) > 1)
          moves.push(`from ${from}: ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      }
      expect(moves, moves.join("\n")).toEqual([]);
    });
  }
